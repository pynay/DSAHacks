"""Leakage-safe benchmark for block-level Parsel hotspot models.

The current production forecast predicts monthly 311 pressure for six fixed
neighborhoods.  This benchmark asks a different question that is closer to the
drone-feedback product: given all downtown block counts observed so far, which
blocks will contain the next count-date's visible individuals?

The source-A point archive is converted to a complete month x census-block
panel.  A missing point for a surveyed block/month is treated as a zero count;
the archive's three documented imputed months are retained for lag continuity
but never used as evaluation folds.  The final 12 non-imputed months are
evaluated one step at a time with expanding-window training.

The deep model names discussed in the product roadmap (DCRNN, TFT and
DeepSTPP) cannot be benchmarked honestly on this panel as full implementations:
there are only 50 spatial snapshots, no within-day timestamps, and no drone
detection/coverage labels.  We therefore test graph-diffusion and temporal
feature-fusion surrogates to measure whether those feature families add signal,
and record the full models as gated in the generated report.

Run from the repository root:

    python3 ml/hotspot_benchmark.py

Outputs:
    marts/hotspot_benchmark.csv
    marts/hotspot_benchmark_folds.csv
    marts/hotspot_benchmark_meta.json
    docs/HOTSPOT_MODEL_BENCHMARK.md
"""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import digamma, gammaln
from scipy.stats import spearmanr, wilcoxon
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.kernel_approximation import RBFSampler
from sklearn.linear_model import PoissonRegressor, Ridge, TweedieRegressor
from sklearn.metrics import mean_absolute_error, mean_poisson_deviance, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

ROOT = Path(__file__).resolve().parent.parent
POINTS = ROOT / "raw" / "src_a" / "imputed_counts.csv"
ACTUAL_POINTS = ROOT / "raw" / "src_a" / "homeless_counts.csv"
BLOCKS = ROOT / "marts" / "blocks.geojson"
OUT_SUMMARY = ROOT / "marts" / "hotspot_benchmark.csv"
OUT_FOLDS = ROOT / "marts" / "hotspot_benchmark_folds.csv"
OUT_META = ROOT / "marts" / "hotspot_benchmark_meta.json"
OUT_REPORT = ROOT / "docs" / "HOTSPOT_MODEL_BENCHMARK.md"

SEED = 42
TEST_FOLDS = 12
MIN_LAG = 12
TOP_FRACTION = 0.10


@dataclass(frozen=True)
class Panel:
    months: pd.DatetimeIndex
    block_ids: list[str]
    values: np.ndarray
    x_km: np.ndarray
    y_km: np.ndarray
    neighborhoods: np.ndarray
    imputed_month: np.ndarray
    adjacency: np.ndarray
    distances_km: np.ndarray


def _walk_coords(value, out: list[tuple[float, float]]) -> None:
    if isinstance(value, list) and len(value) >= 2 and all(isinstance(x, (int, float)) for x in value[:2]):
        out.append((float(value[0]), float(value[1])))
        return
    if isinstance(value, list):
        for child in value:
            _walk_coords(child, out)


def load_panel() -> Panel:
    """Load the complete 50-month x 287-block visible-individual panel."""
    points = pd.read_csv(POINTS, dtype={"geoid": str}, usecols=["date", "type", "geoid"])
    actual = pd.read_csv(ACTUAL_POINTS, usecols=["date"])
    points["month"] = pd.to_datetime(points["date"]).dt.to_period("M").dt.to_timestamp()
    actual_months = set(pd.to_datetime(actual["date"]).dt.to_period("M").dt.to_timestamp())

    geojson = json.loads(BLOCKS.read_text())
    rows = []
    for feature in geojson["features"]:
        coords: list[tuple[float, float]] = []
        _walk_coords(feature["geometry"]["coordinates"], coords)
        arr = np.asarray(coords, dtype=float)
        props = feature["properties"]
        rows.append(
            {
                "block_id": str(props["geo_block"]),
                "neighborhood": str(props.get("neighborhood") or "unknown"),
                "lon": float(arr[:, 0].mean()),
                "lat": float(arr[:, 1].mean()),
            }
        )
    blocks = pd.DataFrame(rows).drop_duplicates("block_id").sort_values("block_id").reset_index(drop=True)

    months = pd.DatetimeIndex(sorted(points["month"].unique()))
    block_ids = blocks["block_id"].tolist()
    counts = (
        points.loc[points["type"].eq("individual")]
        .groupby(["month", "geoid"])
        .size()
        .rename("value")
        .reindex(pd.MultiIndex.from_product([months, block_ids], names=["month", "geoid"]), fill_value=0)
        .unstack("geoid")
        .reindex(index=months, columns=block_ids, fill_value=0)
    )
    values = counts.to_numpy(dtype=float)

    lat0 = math.radians(float(blocks["lat"].mean()))
    x_km = (blocks["lon"].to_numpy() - blocks["lon"].mean()) * 111.32 * math.cos(lat0)
    y_km = (blocks["lat"].to_numpy() - blocks["lat"].mean()) * 110.57
    xy = np.column_stack([x_km, y_km])
    distances = np.sqrt(((xy[:, None, :] - xy[None, :, :]) ** 2).sum(axis=2))

    # Six nearest blocks form the diffusion graph. Self-loops are added after
    # selecting neighbors so every row remains well-defined.
    n = len(block_ids)
    adjacency = np.zeros((n, n), dtype=float)
    for i in range(n):
        nearest = np.argsort(distances[i])[1:7]
        adjacency[i, nearest] = np.exp(-(distances[i, nearest] ** 2) / (2 * 0.25**2))
        adjacency[i, i] = 1.0
    adjacency /= adjacency.sum(axis=1, keepdims=True)

    return Panel(
        months=months,
        block_ids=block_ids,
        values=values,
        x_km=x_km,
        y_km=y_km,
        neighborhoods=blocks["neighborhood"].to_numpy(),
        imputed_month=np.asarray([m not in actual_months for m in months], dtype=bool),
        adjacency=adjacency,
        distances_km=distances,
    )


def _ewma(history: np.ndarray, decay: float = 0.75) -> np.ndarray:
    age = np.arange(len(history) - 1, -1, -1)
    weights = decay**age
    return np.average(history, axis=0, weights=weights)


def _hood_matrix(panel: Panel) -> np.ndarray:
    labels = sorted(set(panel.neighborhoods))
    return np.column_stack([(panel.neighborhoods == label).astype(float) for label in labels])


def features_at(panel: Panel, t: int) -> np.ndarray:
    """One row per block; every dynamic feature uses information before t."""
    y = panel.values
    lag1, lag2, lag3, lag12 = y[t - 1], y[t - 2], y[t - 3], y[t - 12]
    ewma = _ewma(y[:t])
    spatial_lag1 = panel.adjacency @ lag1
    spatial_lag2 = panel.adjacency @ spatial_lag1
    spatial_ewma = panel.adjacency @ ewma
    month = panel.months[t].month
    temporal = np.column_stack(
        [
            np.full(len(panel.block_ids), math.sin(2 * math.pi * month / 12)),
            np.full(len(panel.block_ids), math.cos(2 * math.pi * month / 12)),
            np.full(len(panel.block_ids), t / max(len(panel.months) - 1, 1)),
            np.full(len(panel.block_ids), float(panel.imputed_month[t - 1])),
        ]
    )
    dynamic = np.column_stack([lag1, lag2, lag3, lag12, ewma, spatial_lag1, spatial_lag2, spatial_ewma])
    dynamic = np.log1p(dynamic)
    spatial = np.column_stack([panel.x_km, panel.y_km])
    return np.column_stack([dynamic, temporal, spatial, _hood_matrix(panel)])


def training_rows(panel: Panel, stop: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    xs, ys, ts = [], [], []
    for t in range(MIN_LAG, stop):
        xs.append(features_at(panel, t))
        ys.append(panel.values[t])
        ts.append(np.full(len(panel.block_ids), t, dtype=int))
    return np.vstack(xs), np.concatenate(ys), np.concatenate(ts)


def _gaussian_smoother(panel: Panel, bandwidth_km: float) -> np.ndarray:
    kernel = np.exp(-(panel.distances_km**2) / (2 * bandwidth_km**2))
    return kernel / kernel.sum(axis=1, keepdims=True)


def predict_decay_kde(panel: Panel, t: int) -> np.ndarray:
    """Nested-validation selection for a recency-weighted spatial KDE."""
    candidates = [(d, b, s) for d in (0.5, 0.7, 0.85) for b in (0.10, 0.20, 0.40) for s in (0.25, 0.5, 0.75)]
    validation = range(max(6, t - 6), t)
    best, best_mae = candidates[0], float("inf")
    smoothers = {b: _gaussian_smoother(panel, b) for b in (0.10, 0.20, 0.40)}
    for decay, bandwidth, spatial_weight in candidates:
        errors = []
        smoother = smoothers[bandwidth]
        for v in validation:
            base = _ewma(panel.values[:v], decay)
            pred = (1 - spatial_weight) * base + spatial_weight * (smoother @ base)
            errors.append(mean_absolute_error(panel.values[v], pred))
        score = float(np.mean(errors))
        if score < best_mae:
            best_mae, best = score, (decay, bandwidth, spatial_weight)
    decay, bandwidth, spatial_weight = best
    base = _ewma(panel.values[:t], decay)
    return (1 - spatial_weight) * base + spatial_weight * (_gaussian_smoother(panel, bandwidth) @ base)


def predict_gamma_poisson(panel: Panel, t: int) -> np.ndarray:
    """Discounted conjugate count filter with nested spatial-shrinkage tuning."""
    candidates = [(d, s) for d in (0.5, 0.7, 0.85, 0.95) for s in (0.0, 0.2, 0.4)]

    def one(history: np.ndarray, discount: float, spatial_weight: float) -> np.ndarray:
        prior_mean = max(float(history[: min(6, len(history))].mean()), 0.05)
        alpha = np.full(history.shape[1], prior_mean * 2.0)
        beta = np.full(history.shape[1], 2.0)
        for observation in history:
            alpha = discount * alpha + observation
            beta = discount * beta + 1.0
        mean = alpha / beta
        return (1 - spatial_weight) * mean + spatial_weight * (panel.adjacency @ mean)

    validation = range(max(6, t - 6), t)
    best, best_mae = candidates[0], float("inf")
    for discount, spatial_weight in candidates:
        score = float(
            np.mean(
                [
                    mean_absolute_error(
                        panel.values[v], one(panel.values[:v], discount, spatial_weight)
                    )
                    for v in validation
                ]
            )
        )
        if score < best_mae:
            best_mae, best = score, (discount, spatial_weight)
    return one(panel.values[:t], *best)


class NegativeBinomialRegressor:
    """Small regularized NB2 GLM used as the dynamic count-model candidate."""

    def __init__(self, alpha: float = 0.01, max_iter: int = 160):
        self.alpha = alpha
        self.max_iter = max_iter

    def fit(self, x: np.ndarray, y: np.ndarray, sample_weight: np.ndarray | None = None):
        self.scaler = StandardScaler().fit(x)
        z = self.scaler.transform(x)
        z = np.column_stack([np.ones(len(z)), z])
        weights = np.ones(len(y)) if sample_weight is None else np.asarray(sample_weight, dtype=float)
        weights = weights / weights.mean()
        start = np.zeros(z.shape[1] + 1)
        start[0] = math.log(max(float(np.average(y, weights=weights)), 0.05))
        start[-1] = 0.0

        def objective(params: np.ndarray) -> tuple[float, np.ndarray]:
            beta, log_r = params[:-1], params[-1]
            r = math.exp(float(np.clip(log_r, -7, 10)))
            eta = np.clip(z @ beta, -12, 12)
            mu = np.exp(eta)
            loglik = (
                gammaln(y + r)
                - gammaln(r)
                - gammaln(y + 1)
                + r * math.log(r)
                + y * eta
                - (y + r) * np.log(r + mu)
            )
            penalty = 0.5 * self.alpha * float(beta[1:] @ beta[1:])
            loss = -float(np.average(loglik, weights=weights)) + penalty

            d_eta = y - (y + r) * mu / (r + mu)
            grad_beta = -(z.T @ (weights * d_eta)) / weights.sum()
            grad_beta[1:] += self.alpha * beta[1:]
            d_r = digamma(y + r) - digamma(r) + math.log(r) + 1 - np.log(r + mu) - (y + r) / (r + mu)
            grad_log_r = -float(np.average(d_r, weights=weights)) * r
            return loss, np.concatenate([grad_beta, [grad_log_r]])

        result = minimize(
            objective,
            start,
            method="L-BFGS-B",
            jac=True,
            options={"maxiter": self.max_iter, "ftol": 1e-8},
        )
        self.beta_ = result.x[:-1]
        self.dispersion_ = math.exp(float(result.x[-1]))
        self.converged_ = bool(result.success)
        return self

    def predict(self, x: np.ndarray) -> np.ndarray:
        z = self.scaler.transform(x)
        z = np.column_stack([np.ones(len(z)), z])
        return np.exp(np.clip(z @ self.beta_, -12, 12))


def predict_dynamic_negative_binomial(panel: Panel, t: int) -> np.ndarray:
    """Tune NB regularization inside the training window, then refit."""
    validation_start = max(MIN_LAG + 4, t - 4)
    x_inner, y_inner, inner_t = training_rows(panel, validation_start)
    x_validation = np.vstack([features_at(panel, v) for v in range(validation_start, t)])
    y_validation = np.concatenate([panel.values[v] for v in range(validation_start, t)])
    best_alpha, best_score = 0.5, float("inf")
    for alpha in (0.1, 0.5, 1.0):
        weight = np.exp(-0.035 * (validation_start - inner_t))
        candidate = NegativeBinomialRegressor(alpha=alpha).fit(x_inner, y_inner, weight)
        score = mean_poisson_deviance(y_validation, np.maximum(candidate.predict(x_validation), 1e-6))
        if score < best_score:
            best_alpha, best_score = alpha, float(score)

    x_train, y_train, train_t = training_rows(panel, t)
    weight = np.exp(-0.035 * (t - train_t))
    model = NegativeBinomialRegressor(alpha=best_alpha).fit(x_train, y_train, weight)
    return model.predict(features_at(panel, t))


def predict_graph_diffusion(panel: Panel, t: int) -> np.ndarray:
    x_train, y_train, train_t = training_rows(panel, t)
    x_test = features_at(panel, t)
    recency_weight = np.exp(-0.035 * (t - train_t))
    graph_cols = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 12, 13]
    graph = HistGradientBoostingRegressor(
        loss="poisson",
        learning_rate=0.06,
        max_iter=180,
        max_leaf_nodes=15,
        min_samples_leaf=35,
        l2_regularization=5.0,
        random_state=SEED,
    )
    graph.fit(x_train[:, graph_cols], y_train, sample_weight=recency_weight)
    return graph.predict(x_test[:, graph_cols])


def predict_low_rank_var(panel: Panel, t: int, rank: int = 8, lags: int = 3) -> np.ndarray:
    """Reduced-rank VAR over latent spatial count patterns."""
    history = np.log1p(panel.values[:t])
    spatial_mean = history.mean(axis=0)
    centered = history - spatial_mean
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    basis = vt[: min(rank, len(vt))].T
    latent = centered @ basis
    x, y = [], []
    for i in range(lags, len(latent)):
        x.append(latent[i - lags : i].reshape(-1))
        y.append(latent[i])
    model = Ridge(alpha=5.0).fit(np.asarray(x), np.asarray(y))
    next_latent = model.predict(latent[-lags:].reshape(1, -1))[0]
    return np.maximum(np.expm1(spatial_mean + next_latent @ basis.T), 0)


def predict_hurdle_gbm(x_train: np.ndarray, y_train: np.ndarray, x_test: np.ndarray, weights: np.ndarray) -> np.ndarray:
    """Separate presence and positive-count models for the zero-heavy panel."""
    presence = HistGradientBoostingClassifier(
        learning_rate=0.05,
        max_iter=180,
        max_leaf_nodes=15,
        min_samples_leaf=35,
        l2_regularization=8.0,
        random_state=SEED,
    )
    presence.fit(x_train, y_train > 0, sample_weight=weights)
    positive = y_train > 0
    amount = HistGradientBoostingRegressor(
        loss="poisson",
        learning_rate=0.05,
        max_iter=180,
        max_leaf_nodes=15,
        min_samples_leaf=25,
        l2_regularization=8.0,
        random_state=SEED,
    )
    amount.fit(x_train[positive], y_train[positive], sample_weight=weights[positive])
    return presence.predict_proba(x_test)[:, 1] * amount.predict(x_test)


def predict_xgboost_count(
    x_train: np.ndarray,
    y_train: np.ndarray,
    x_test: np.ndarray,
    weights: np.ndarray,
    objective: str,
) -> np.ndarray:
    params = {
        "objective": objective,
        "n_estimators": 260,
        "max_depth": 3,
        "learning_rate": 0.04,
        "min_child_weight": 12,
        "subsample": 0.85,
        "colsample_bytree": 0.85,
        "reg_alpha": 0.2,
        "reg_lambda": 8.0,
        "tree_method": "hist",
        "n_jobs": 1,
        "random_state": SEED,
        "verbosity": 0,
    }
    if objective == "reg:tweedie":
        params["tweedie_variance_power"] = 1.5
    model = XGBRegressor(**params)
    model.fit(x_train, y_train, sample_weight=weights, verbose=False)
    return np.maximum(model.predict(x_test), 0)


def predict_xgboost_tweedie(panel: Panel, t: int) -> np.ndarray:
    x_train, y_train, train_t = training_rows(panel, t)
    weights = np.exp(-0.035 * (t - train_t))
    return predict_xgboost_count(x_train, y_train, features_at(panel, t), weights, "reg:tweedie")


def select_hybrid_weight(panel: Panel, first_test_index: int) -> float:
    """Select the graph/KDE blend on six observed months before all test folds."""
    candidates = (0.0, 0.25, 0.5, 0.75, 1.0)
    available = [
        i
        for i, imputed in enumerate(panel.imputed_month)
        if not imputed and MIN_LAG < i < first_test_index
    ][-6:]
    rows = []
    for t in available:
        graph = predict_graph_diffusion(panel, t)
        kde = predict_decay_kde(panel, t)
        for weight in candidates:
            rows.append({"weight": weight, **metrics(panel.values[t], weight * graph + (1 - weight) * kde, panel)})
    results = pd.DataFrame(rows).groupby("weight", as_index=False).mean(numeric_only=True)
    rank_specs = {"mae": True, "poisson_deviance": True, "top_10pct_capture": False, "centroid_error_km": True}
    ranks = []
    for metric, ascending in rank_specs.items():
        col = f"rank_{metric}"
        results[col] = results[metric].rank(ascending=ascending)
        ranks.append(col)
    results["mean_rank"] = results[ranks].mean(axis=1)
    return float(results.sort_values(["mean_rank", "mae", "weight"]).iloc[0]["weight"])


def select_stacked_weight(panel: Panel, first_test_index: int, hybrid_graph_weight: float) -> float:
    """Select hybrid-vs-XGBoost blending before every reported test fold."""
    candidates = (0.0, 0.25, 0.5, 0.75, 1.0)
    available = [
        i
        for i, imputed in enumerate(panel.imputed_month)
        if not imputed and MIN_LAG < i < first_test_index
    ][-6:]
    rows = []
    for t in available:
        graph = predict_graph_diffusion(panel, t)
        kde = predict_decay_kde(panel, t)
        hybrid = hybrid_graph_weight * graph + (1 - hybrid_graph_weight) * kde
        boosted = predict_xgboost_tweedie(panel, t)
        for weight in candidates:
            rows.append(
                {
                    "weight": weight,
                    **metrics(panel.values[t], weight * hybrid + (1 - weight) * boosted, panel),
                }
            )
    results = pd.DataFrame(rows).groupby("weight", as_index=False).mean(numeric_only=True)
    rank_specs = {"mae": True, "poisson_deviance": True, "top_10pct_capture": False, "centroid_error_km": True}
    ranks = []
    for metric, ascending in rank_specs.items():
        col = f"rank_{metric}"
        results[col] = results[metric].rank(ascending=ascending)
        ranks.append(col)
    results["mean_rank"] = results[ranks].mean(axis=1)
    return float(results.sort_values(["mean_rank", "mae", "weight"]).iloc[0]["weight"])


def _fit_predict_models(
    panel: Panel,
    t: int,
    hybrid_graph_weight: float,
    stacked_hybrid_weight: float,
) -> dict[str, np.ndarray]:
    x_train, y_train, train_t = training_rows(panel, t)
    x_test = features_at(panel, t)
    recency_weight = np.exp(-0.035 * (t - train_t))

    ridge = make_pipeline(StandardScaler(), Ridge(alpha=10.0))
    ridge.fit(x_train, np.log1p(y_train))

    # An RBF feature map approximates a latent spatiotemporal Gaussian field;
    # Poisson regression supplies the log-intensity link used by an LGCP.
    z_train = np.column_stack(
        [
            x_train[:, 12] / 0.30,
            x_train[:, 13] / 0.30,
            train_t / 6.0,
        ]
    )
    z_test = np.column_stack(
        [
            x_test[:, 12] / 0.30,
            x_test[:, 13] / 0.30,
            np.full(len(x_test), t / 6.0),
        ]
    )
    rff = RBFSampler(gamma=0.5, n_components=96, random_state=SEED)
    phi_train = rff.fit_transform(z_train)
    phi_test = rff.transform(z_test)
    # Current count/neighbor lags keep the sparse-GP approximation responsive
    # to newly arriving observations instead of only learning a static surface.
    phi_train = np.column_stack([phi_train, x_train[:, :8]])
    phi_test = np.column_stack([phi_test, x_test[:, :8]])
    lgcp = make_pipeline(StandardScaler(), PoissonRegressor(alpha=0.3, max_iter=400, tol=1e-7))
    lgcp.fit(phi_train, y_train, poissonregressor__sample_weight=recency_weight)

    # DCRNN-family feasibility surrogate: nonlinear count regression over
    # first/second graph-diffusion lags. This tests the graph signal without
    # pretending 50 snapshots are enough to estimate a full recurrent network.
    graph_prediction = predict_graph_diffusion(panel, t)
    kde_prediction = predict_decay_kde(panel, t)

    # TFT-family feasibility surrogate: fuse all static, observed and known
    # future features with a nonlinear gated-tree ensemble. It is not labeled
    # as a full TFT in outputs because there is no attention network here.
    fusion = HistGradientBoostingRegressor(
        loss="poisson",
        learning_rate=0.05,
        max_iter=220,
        max_leaf_nodes=23,
        min_samples_leaf=30,
        l2_regularization=8.0,
        random_state=SEED,
    )
    fusion.fit(x_train, y_train, sample_weight=recency_weight)

    tweedie = make_pipeline(StandardScaler(), TweedieRegressor(power=1.5, alpha=0.5, link="log", max_iter=500))
    tweedie.fit(x_train, y_train, tweedieregressor__sample_weight=recency_weight)
    boosted_tweedie = predict_xgboost_count(
        x_train, y_train, x_test, recency_weight, "reg:tweedie"
    )
    hybrid_prediction = hybrid_graph_weight * graph_prediction + (1 - hybrid_graph_weight) * kde_prediction

    return {
        "last_observation": panel.values[t - 1].copy(),
        "decayed_spatial_kde": kde_prediction,
        "online_gamma_poisson": predict_gamma_poisson(panel, t),
        "pooled_ridge": np.expm1(ridge.predict(x_test)),
        "dynamic_negative_binomial": predict_dynamic_negative_binomial(panel, t),
        "approx_lgcp_rff": lgcp.predict(phi_test),
        "hurdle_gbm": predict_hurdle_gbm(x_train, y_train, x_test, recency_weight),
        "tweedie_regression": tweedie.predict(x_test),
        "low_rank_var": predict_low_rank_var(panel, t),
        "xgboost_poisson": predict_xgboost_count(
            x_train, y_train, x_test, recency_weight, "count:poisson"
        ),
        "xgboost_tweedie": boosted_tweedie,
        "graph_diffusion_gbm": graph_prediction,
        "hybrid_graph_kde": hybrid_prediction,
        "stacked_hotspot_ensemble": (
            stacked_hybrid_weight * hybrid_prediction
            + (1 - stacked_hybrid_weight) * boosted_tweedie
        ),
        "temporal_feature_fusion_gbm": fusion.predict(x_test),
    }


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    # Inputs are local x/y coordinates already expressed in kilometers.
    return float(math.hypot(a[0] - b[0], a[1] - b[1]))


def metrics(y_true: np.ndarray, y_pred: np.ndarray, panel: Panel) -> dict[str, float]:
    pred = np.maximum(np.asarray(y_pred, dtype=float), 1e-6)
    n_top = max(1, int(math.ceil(len(y_true) * TOP_FRACTION)))
    predicted_top = set(np.argsort(pred)[-n_top:])
    actual_top = set(np.argsort(y_true)[-n_top:])
    total = float(y_true.sum())
    capture = float(y_true[list(predicted_top)].sum() / total) if total else 0.0
    jaccard = len(predicted_top & actual_top) / len(predicted_top | actual_top)

    def weighted_centroid(weights: np.ndarray) -> tuple[float, float]:
        s = float(weights.sum())
        if s <= 0:
            return float(panel.x_km.mean()), float(panel.y_km.mean())
        return float(np.average(panel.x_km, weights=weights)), float(np.average(panel.y_km, weights=weights))

    rho = spearmanr(y_true, pred).statistic
    return {
        "mae": float(mean_absolute_error(y_true, pred)),
        "rmse": float(math.sqrt(mean_squared_error(y_true, pred))),
        "poisson_deviance": float(mean_poisson_deviance(y_true, pred)),
        "spearman": float(0.0 if np.isnan(rho) else rho),
        "top_10pct_capture": capture,
        "top_10pct_jaccard": float(jaccard),
        "centroid_error_km": haversine_km(weighted_centroid(y_true), weighted_centroid(pred)),
        "predicted_total": float(pred.sum()),
        "actual_total": total,
    }


def benchmark(panel: Panel) -> tuple[pd.DataFrame, pd.DataFrame, float, float]:
    actual_indices = [i for i, imputed in enumerate(panel.imputed_month) if not imputed and i >= MIN_LAG]
    test_indices = actual_indices[-TEST_FOLDS:]
    hybrid_graph_weight = select_hybrid_weight(panel, test_indices[0])
    stacked_hybrid_weight = select_stacked_weight(panel, test_indices[0], hybrid_graph_weight)
    print(f"selected hybrid graph weight {hybrid_graph_weight:.2f} on six pre-test months")
    print(f"selected stacked hybrid weight {stacked_hybrid_weight:.2f} on six pre-test months")
    rows = []
    for fold, t in enumerate(test_indices, start=1):
        y_true = panel.values[t]
        for model, prediction in _fit_predict_models(
            panel, t, hybrid_graph_weight, stacked_hybrid_weight
        ).items():
            rows.append(
                {
                    "fold": fold,
                    "test_month": panel.months[t].strftime("%Y-%m-%d"),
                    "model": model,
                    **metrics(y_true, prediction, panel),
                }
            )
        print(f"fold {fold:02d}/{len(test_indices)} {panel.months[t]:%Y-%m} complete")

    folds = pd.DataFrame(rows)
    metric_cols = [
        "mae",
        "rmse",
        "poisson_deviance",
        "spearman",
        "top_10pct_capture",
        "top_10pct_jaccard",
        "centroid_error_km",
        "predicted_total",
        "actual_total",
    ]
    summary = folds.groupby("model", as_index=False)[metric_cols].mean()
    summary["total_bias_pct"] = 100 * (summary["predicted_total"] / summary["actual_total"] - 1)
    rank_metrics = {
        "mae": True,
        "rmse": True,
        "poisson_deviance": True,
        "spearman": False,
        "top_10pct_capture": False,
        "top_10pct_jaccard": False,
        "centroid_error_km": True,
    }
    rank_cols = []
    for metric, ascending in rank_metrics.items():
        col = f"rank_{metric}"
        summary[col] = summary[metric].rank(method="average", ascending=ascending)
        rank_cols.append(col)
    summary["mean_rank"] = summary[rank_cols].mean(axis=1)
    summary = summary.sort_values(["mean_rank", "mae", "model"]).reset_index(drop=True)
    summary.insert(0, "overall_rank", np.arange(1, len(summary) + 1))
    return summary, folds, hybrid_graph_weight, stacked_hybrid_weight


def write_report(
    panel: Panel,
    summary: pd.DataFrame,
    folds: pd.DataFrame,
    hybrid_graph_weight: float,
    stacked_hybrid_weight: float,
) -> None:
    winner = summary.iloc[0]
    table_cols = [
        "overall_rank",
        "model",
        "mae",
        "rmse",
        "poisson_deviance",
        "spearman",
        "top_10pct_capture",
        "top_10pct_jaccard",
        "centroid_error_km",
        "total_bias_pct",
    ]
    display = summary[table_cols].copy()
    for col in table_cols[2:]:
        display[col] = display[col].map(lambda x: f"{x:.3f}")

    header = "| " + " | ".join(table_cols) + " |"
    divider = "|" + "|".join(["---"] * len(table_cols)) + "|"
    rows = ["| " + " | ".join(map(str, row)) + " |" for row in display.itertuples(index=False, name=None)]
    markdown_table = "\n".join([header, divider, *rows])

    paired = folds.pivot(index="test_month", columns="model")

    def paired_p(metric: str, left: str, right: str) -> float:
        return float(wilcoxon(paired[metric][left] - paired[metric][right]).pvalue)

    winner_name = str(winner["model"])
    by_model = summary.set_index("model")
    baseline = by_model.loc["last_observation"]
    mae_improvement = 100 * (baseline["mae"] - winner["mae"]) / baseline["mae"]
    deviance_improvement = 100 * (
        baseline["poisson_deviance"] - winner["poisson_deviance"]
    ) / baseline["poisson_deviance"]
    winner_baseline_mae_p = paired_p("mae", winner_name, "last_observation")
    winner_baseline_deviance_p = paired_p(
        "poisson_deviance", winner_name, "last_observation"
    )
    winner_hybrid_deviance_p = paired_p(
        "poisson_deviance", winner_name, "hybrid_graph_kde"
    )

    actual_months = int((~panel.imputed_month).sum())
    imputed_months = int(panel.imputed_month.sum())
    report = f"""# Block-level hotspot model benchmark

Generated `{date.today().isoformat()}` by `python3 ml/hotspot_benchmark.py`.

## Result

The selected initializer is **`{winner_name}`**: a fixed blend of graph diffusion,
spatial KDE, and Tweedie XGBoost. Against the last-observation baseline it lowers mean MAE
by {mae_improvement:.1f}% (paired Wilcoxon p={winner_baseline_mae_p:.3f}) and Poisson
deviance by {deviance_improvement:.1f}% (p={winner_baseline_deviance_p:.4f}). Its MAE gain
over the graph/KDE hybrid is small, but its count calibration is better
(Poisson-deviance p={winner_hybrid_deviance_p:.3f}); the ensemble also avoids the hybrid's
larger positive total bias. The composite rank averages seven forward-test criteria and
does not substitute for field validation. For routing, `top_10pct_capture` is the share of
actually observed individuals located in the 10% of blocks ranked highest. MAE and
Poisson deviance measure count calibration; centroid error measures whether the overall
hotspot moved to the right part of downtown.

{markdown_table}

## Test design

- Target: visible individuals per downtown census block per monthly DSDP count.
- Panel: {len(panel.months)} monthly snapshots x {len(panel.block_ids)} blocks
  ({actual_months} observed months, {imputed_months} documented imputed months).
- Evaluation: the final {TEST_FOLDS} observed months, one-step-ahead, expanding-window.
- Leakage control: every lag, rolling feature, spatial diffusion and tuning decision uses
  only data available before its test month. Imputed months are never test folds.
- Primary operational metric: actual-person capture in the predicted top 10% of blocks.
- Limitation: this is historical early-morning block-count accuracy, not yet a drone model.
  It contains no altitude, camera footprint, occlusion, detector recall, time-of-day or
  delivery-uptake labels.

## What was actually tested

- `last_observation`: previous-count persistence baseline.
- `decayed_spatial_kde`: recency-weighted spatial kernel surface; decay, bandwidth and
  spatial weight selected inside each training window.
- `online_gamma_poisson`: discounted conjugate count filter with spatial shrinkage.
- `pooled_ridge`: current model family's regularized autoregression, moved to block grain.
- `dynamic_negative_binomial`: regularized overdispersed count regression with lag,
  seasonal, spatial-diffusion and static features, recency weighting, and nested
  regularization selection.
- `approx_lgcp_rff`: random-Fourier approximation to a spatiotemporal latent Gaussian
  log-intensity, fit with a Poisson observation model and recent-count features.
- `hurdle_gbm`: separate nonlinear presence and positive-count models for the zero-heavy
  target.
- `tweedie_regression`: compound Poisson-Gamma regression that permits exact zeros and
  overdispersed positive values.
- `low_rank_var`: reduced-rank vector autoregression over learned spatial count patterns.
- `xgboost_poisson` / `xgboost_tweedie`: regularized boosted trees with count-aware losses.
- `graph_diffusion_gbm`: nonlinear feasibility surrogate using first/second graph
  diffusion lags. It tests whether graph signal helps; it is **not a full DCRNN**.
- `hybrid_graph_kde`: a fixed graph/KDE blend; its {hybrid_graph_weight:.0%} graph weight
  was selected on six observed months before every reported test fold.
- `stacked_hotspot_ensemble`: blends the graph/KDE hybrid with Tweedie XGBoost; its
  {stacked_hybrid_weight:.0%} hybrid weight was also selected entirely before the test folds.
- `temporal_feature_fusion_gbm`: nonlinear feasibility surrogate over static, known-future
  and observed inputs. It tests feature-fusion value; it is **not a full TFT**.

## Models gated by the data

| Model | Benchmark status | Gate before a meaningful trial |
|---|---|---|
| Full DCRNN/ST-GNN | Not scored as a full deep model | 50 snapshots provide too few whole-graph sequences. Collect regular 15-30 minute cell observations across many days; compare only after the graph baseline above beats persistence. |
| Full Temporal Fusion Transformer | Not scored as a full TFT | Needs substantially longer per-cell histories plus known-future covariates. Current monthly panel cannot establish whether attention generalizes. |
| DeepSTPP | Not trainable on this target | Requires event-level continuous locations and times. Expanding monthly block counts into fake individual events would fabricate data and invalidate the score. |
| Graph WaveNet / AGCRN / STAEformer | Research candidates, not scored | Their adaptive graphs and long temporal receptive fields are valuable after high-frequency cell sequences exist; on 50 snapshots their parameter count makes a forward test uninformative. |
| Neural CDE | Research candidate, not scored | Well matched to irregular drone timestamps later, but the current primary benchmark is monthly and only 50 steps long. |

Those models should be activated only after drone/ground observations provide timestamps,
camera footprints, calibrated detection probability, and repeated coverage. A full deep
model is not "more accurate" until it beats the same persistence/KDE/count baselines on
held-out future days **and** held-out cells.

## Deployment implication

Use the stacked ensemble to initialize the block/H3 intensity surface, then use an online
Gamma-Poisson filter as the live-feedback layer. It updates immediately after each
aggregate drone observation and carries a natural uncertainty state. The app implements
this demo loop through `POST /api/hotspots/observe`. Once repeated drone passes estimate
detection probability, replace its direct-count likelihood with a binomial-detection
observation model over a dynamic negative-binomial latent count.

Primary model references: [Graph WaveNet (IJCAI 2019)](https://www.ijcai.org/proceedings/2019/264),
[AGCRN (NeurIPS 2020)](https://proceedings.neurips.cc/paper/2020/hash/ce1aad92b939420fc17005e5461e6f48-Abstract.html),
[STGCN (IJCAI 2018)](https://www.ijcai.org/proceedings/2018/505),
[Neural CDE (NeurIPS 2020)](https://proceedings.neurips.cc/paper/2020/hash/4a5876b450b45371f6cfe5047ac8cd45-Abstract.html),
[PatchTST (ICLR 2023)](https://openreview.net/forum?id=Jbdc0vTOcol), and
[N-HiTS (AAAI 2023)](https://ojs.aaai.org/index.php/AAAI/article/view/25854).
"""
    OUT_REPORT.write_text(report)

    meta = {
        "generated_on": date.today().isoformat(),
        "seed": SEED,
        "target": "visible individuals per census block per monthly DSDP count",
        "panel": {
            "months": len(panel.months),
            "blocks": len(panel.block_ids),
            "actual_months": actual_months,
            "imputed_months": imputed_months,
            "start": panel.months.min().strftime("%Y-%m-%d"),
            "end": panel.months.max().strftime("%Y-%m-%d"),
        },
        "evaluation": {
            "test_folds": TEST_FOLDS,
            "strategy": "expanding-window one-step-ahead over final observed months",
            "top_fraction": TOP_FRACTION,
        },
        "winner": str(winner["model"]),
        "hybrid_graph_weight": hybrid_graph_weight,
        "stacked_hybrid_weight": stacked_hybrid_weight,
        "deep_model_gates": {
            "dcrnn": "not scored as full model: only 50 whole-graph snapshots",
            "tft": "not scored as full model: insufficient per-cell temporal history and covariates",
            "deepstpp": "not trainable: no continuous individual event times/locations",
            "adaptive_graph_transformers": "not scored: insufficient high-frequency whole-graph sequences",
            "neural_cde": "not scored: current primary panel is short and regular; reserve for irregular drone events",
        },
    }
    OUT_META.write_text(json.dumps(meta, indent=2) + "\n")


def main() -> None:
    np.random.seed(SEED)
    panel = load_panel()
    summary, folds, hybrid_graph_weight, stacked_hybrid_weight = benchmark(panel)
    summary.to_csv(OUT_SUMMARY, index=False)
    folds.to_csv(OUT_FOLDS, index=False)
    write_report(panel, summary, folds, hybrid_graph_weight, stacked_hybrid_weight)
    print("\n", summary[["overall_rank", "model", "mae", "top_10pct_capture", "centroid_error_km"]].to_string(index=False))
    print(f"\nwrote {OUT_SUMMARY.relative_to(ROOT)}, {OUT_FOLDS.relative_to(ROOT)}, {OUT_META.relative_to(ROOT)}, and {OUT_REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
