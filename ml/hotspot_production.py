"""Train the selected hotspot ensemble on the modern DSDP block panel.

This is the offline half of Parsel's production hotspot model. It applies the
model family selected by ``hotspot_benchmark.py`` to the 261-block longitudinal
hackathon panel and exports a block intensity surface plus six movable delivery
hotspots for the Next.js application.

The browser/server does not need Python or XGBoost at runtime. Drone observations
are assimilated by ``src/lib/hotspotState.ts`` from the exported Gamma-Poisson
prior and can move the hotspot centers immediately.

Run from the repository root:

    python ml/hotspot_production.py
"""

from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_poisson_deviance
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parent.parent
COUNTS = ROOT / "data" / "hackathon" / "BlockLevel_Counts_Panel261.csv"
GRID = ROOT / "data" / "hackathon" / "Downtown_BlockGrid.csv"
BENCHMARK_META = ROOT / "marts" / "hotspot_benchmark_meta.json"
OUT_BLOCKS = ROOT / "marts" / "hotspot_blocks.json"
OUT_ZONES = ROOT / "marts" / "hotspot_zones.json"

SEED = 42
MIN_LAG = 3
GRAPH_WEIGHT = 0.75
STACKED_HYBRID_WEIGHT = 0.75
PRIOR_STRENGTH = 2.0
HOTSPOT_COUNT = 6
MIN_CENTER_DISTANCE_KM = 0.24

AREA_MAP = {
    "City Center": "city_center",
    "Columbia": "columbia",
    "Cortez": "cortez",
    "East Village": "east_village",
    "Gaslamp": "gaslamp",
    "Marina": "marina",
}


def pretty(value: str) -> str:
    return " ".join(part.capitalize() for part in value.split("_"))


def load_panel() -> tuple[pd.DatetimeIndex, pd.DataFrame, np.ndarray, np.ndarray, np.ndarray]:
    counts = pd.read_csv(COUNTS)
    counts["month"] = pd.to_datetime(counts["report_month"])
    counts["individuals"] = pd.to_numeric(counts["individuals"], errors="coerce").fillna(0)
    grid = pd.read_csv(GRID)[["block_id", "area", "lon", "lat"]]
    panel_blocks = sorted(counts["block_id"].unique())
    grid = grid[grid["block_id"].isin(panel_blocks)].drop_duplicates("block_id")
    grid = grid.set_index("block_id").loc[panel_blocks].reset_index()
    grid["neighborhood"] = grid["area"].map(AREA_MAP).fillna("other")

    months = pd.DatetimeIndex(sorted(counts["month"].unique()))
    values = (
        counts.pivot_table(index="month", columns="block_id", values="individuals", aggfunc="sum", fill_value=0)
        .reindex(index=months, columns=panel_blocks, fill_value=0)
        .to_numpy(dtype=float)
    )

    lat0 = math.radians(float(grid["lat"].mean()))
    x_km = (grid["lon"].to_numpy() - grid["lon"].mean()) * 111.32 * math.cos(lat0)
    y_km = (grid["lat"].to_numpy() - grid["lat"].mean()) * 110.57
    xy = np.column_stack([x_km, y_km])
    distances = np.sqrt(((xy[:, None, :] - xy[None, :, :]) ** 2).sum(axis=2))
    adjacency = np.zeros_like(distances)
    for i in range(len(grid)):
        nearest = np.argsort(distances[i])[1:7]
        adjacency[i, nearest] = np.exp(-(distances[i, nearest] ** 2) / (2 * 0.25**2))
        adjacency[i, i] = 1.0
    adjacency /= adjacency.sum(axis=1, keepdims=True)
    return months, grid, values, adjacency, distances


def ewma(history: np.ndarray, decay: float = 0.7) -> np.ndarray:
    age = np.arange(len(history) - 1, -1, -1)
    return np.average(history, axis=0, weights=decay**age)


def feature_at(
    months: pd.DatetimeIndex,
    grid: pd.DataFrame,
    values: np.ndarray,
    adjacency: np.ndarray,
    t: int,
    target_month: pd.Timestamp | None = None,
) -> np.ndarray:
    target = target_month if target_month is not None else months[t]
    lag1, lag2, lag3 = values[t - 1], values[t - 2], values[t - 3]
    recent = ewma(values[:t])
    graph1 = adjacency @ lag1
    graph2 = adjacency @ graph1
    graph_recent = adjacency @ recent
    elapsed = (target.year - months[0].year) * 12 + target.month - months[0].month
    gap = (target.year - months[t - 1].year) * 12 + target.month - months[t - 1].month
    temporal = np.column_stack(
        [
            np.full(len(grid), math.sin(2 * math.pi * target.month / 12)),
            np.full(len(grid), math.cos(2 * math.pi * target.month / 12)),
            np.full(len(grid), elapsed / 12),
            np.full(len(grid), gap),
        ]
    )
    lat0 = math.radians(float(grid["lat"].mean()))
    spatial = np.column_stack(
        [
            (grid["lon"].to_numpy() - grid["lon"].mean()) * 111.32 * math.cos(lat0),
            (grid["lat"].to_numpy() - grid["lat"].mean()) * 110.57,
        ]
    )
    labels = sorted(grid["neighborhood"].unique())
    hoods = np.column_stack([(grid["neighborhood"].to_numpy() == label).astype(float) for label in labels])
    dynamic = np.log1p(np.column_stack([lag1, lag2, lag3, recent, graph1, graph2, graph_recent]))
    return np.column_stack([dynamic, temporal, spatial, hoods])


def training_rows(
    months: pd.DatetimeIndex,
    grid: pd.DataFrame,
    values: np.ndarray,
    adjacency: np.ndarray,
    stop: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    x, y, time = [], [], []
    for t in range(MIN_LAG, stop):
        x.append(feature_at(months, grid, values, adjacency, t))
        y.append(values[t])
        time.append(np.full(len(grid), t))
    return np.vstack(x), np.concatenate(y), np.concatenate(time)


def graph_prediction(x: np.ndarray, y: np.ndarray, test: np.ndarray, weights: np.ndarray) -> np.ndarray:
    cols = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12]
    model = HistGradientBoostingRegressor(
        loss="poisson",
        learning_rate=0.06,
        max_iter=180,
        max_leaf_nodes=15,
        min_samples_leaf=25,
        l2_regularization=5.0,
        random_state=SEED,
    )
    model.fit(x[:, cols], y, sample_weight=weights)
    return model.predict(test[:, cols])


def boosted_prediction(x: np.ndarray, y: np.ndarray, test: np.ndarray, weights: np.ndarray) -> np.ndarray:
    model = XGBRegressor(
        objective="reg:tweedie",
        tweedie_variance_power=1.5,
        n_estimators=260,
        max_depth=3,
        learning_rate=0.04,
        min_child_weight=12,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_alpha=0.2,
        reg_lambda=8.0,
        tree_method="hist",
        n_jobs=1,
        random_state=SEED,
        verbosity=0,
    )
    model.fit(x, y, sample_weight=weights, verbose=False)
    return np.maximum(model.predict(test), 0)


def kde_prediction(history: np.ndarray, distances: np.ndarray) -> np.ndarray:
    base = ewma(history, 0.7)
    kernel = np.exp(-(distances**2) / (2 * 0.20**2))
    kernel /= kernel.sum(axis=1, keepdims=True)
    return 0.5 * base + 0.5 * (kernel @ base)


def predict_at(
    months: pd.DatetimeIndex,
    grid: pd.DataFrame,
    values: np.ndarray,
    adjacency: np.ndarray,
    distances: np.ndarray,
    stop: int,
    target_month: pd.Timestamp | None = None,
) -> np.ndarray:
    x, y, train_t = training_rows(months, grid, values, adjacency, stop)
    test = feature_at(months, grid, values, adjacency, stop, target_month)
    weights = np.exp(-0.10 * (stop - train_t))
    graph = graph_prediction(x, y, test, weights)
    kde = kde_prediction(values[:stop], distances)
    hybrid = GRAPH_WEIGHT * graph + (1 - GRAPH_WEIGHT) * kde
    boosted = boosted_prediction(x, y, test, weights)
    return STACKED_HYBRID_WEIGHT * hybrid + (1 - STACKED_HYBRID_WEIGHT) * boosted


def modern_backtest(
    months: pd.DatetimeIndex,
    grid: pd.DataFrame,
    values: np.ndarray,
    adjacency: np.ndarray,
    distances: np.ndarray,
) -> dict:
    model_mae, naive_mae, model_dev, naive_dev = [], [], [], []
    for t in range(max(MIN_LAG + 3, len(months) - 4), len(months)):
        pred = np.maximum(predict_at(months, grid, values, adjacency, distances, t), 1e-6)
        naive = np.maximum(values[t - 1], 1e-6)
        truth = values[t]
        model_mae.append(mean_absolute_error(truth, pred))
        naive_mae.append(mean_absolute_error(truth, naive))
        model_dev.append(mean_poisson_deviance(truth, pred))
        naive_dev.append(mean_poisson_deviance(truth, naive))
    return {
        "folds": len(model_mae),
        "model_mae": round(float(np.mean(model_mae)), 3),
        "naive_mae": round(float(np.mean(naive_mae)), 3),
        "model_poisson_deviance": round(float(np.mean(model_dev)), 3),
        "naive_poisson_deviance": round(float(np.mean(naive_dev)), 3),
    }


def choose_centers(prediction: np.ndarray, distances: np.ndarray) -> list[int]:
    centers: list[int] = []
    for candidate in np.argsort(prediction)[::-1]:
        if all(distances[candidate, center] >= MIN_CENTER_DISTANCE_KM for center in centers):
            centers.append(int(candidate))
        if len(centers) == HOTSPOT_COUNT:
            break
    return centers


def export() -> None:
    np.random.seed(SEED)
    months, grid, values, adjacency, distances = load_panel()
    target = pd.Timestamp(date.today()).to_period("M").to_timestamp()
    prediction = predict_at(months, grid, values, adjacency, distances, len(months), target)
    prediction = np.maximum(prediction, 0)
    backtest = modern_backtest(months, grid, values, adjacency, distances)
    benchmark = json.loads(BENCHMARK_META.read_text()) if BENCHMARK_META.exists() else {}

    meta = {
        "model": "stacked_hotspot_ensemble",
        "components": {
            "graph_diffusion_gbm": GRAPH_WEIGHT * STACKED_HYBRID_WEIGHT,
            "spatial_kde": (1 - GRAPH_WEIGHT) * STACKED_HYBRID_WEIGHT,
            "xgboost_tweedie": 1 - STACKED_HYBRID_WEIGHT,
        },
        "source": "DSDP 261-block longitudinal panel",
        "source_date": months[-1].strftime("%Y-%m-%d"),
        "target_month": target.strftime("%Y-%m-%d"),
        "generated_on": date.today().isoformat(),
        "stale_source_warning": bool(target > months[-1] + pd.DateOffset(months=3)),
        "modern_panel_backtest": backtest,
        "selection_benchmark_winner": benchmark.get("winner"),
    }

    blocks = []
    for i, row in grid.iterrows():
        mean = float(prediction[i])
        blocks.append(
            {
                "id": str(row["block_id"]),
                "neighborhood": str(row["neighborhood"]),
                "lng": round(float(row["lon"]), 7),
                "lat": round(float(row["lat"]), 7),
                "predicted": round(mean, 4),
                "alpha": round(max(mean, 0.01) * PRIOR_STRENGTH, 4),
                "beta": PRIOR_STRENGTH,
                "last_observed": int(values[-1, i]),
            }
        )
    OUT_BLOCKS.write_text(json.dumps({"meta": meta, "blocks": blocks}, indent=2) + "\n")

    centers = choose_centers(prediction, distances)
    assignment = np.argmin(distances[:, centers], axis=1)
    zones = []
    for rank, center in enumerate(centers, start=1):
        members = np.flatnonzero(assignment == rank - 1)
        weights = prediction[members]
        if weights.sum() <= 0:
            weights = np.ones(len(members))
        lng = float(np.average(grid.loc[members, "lon"], weights=weights))
        lat = float(np.average(grid.loc[members, "lat"], weights=weights))
        hood_weights: dict[str, float] = {}
        for member, weight in zip(members, weights):
            hood = str(grid.loc[member, "neighborhood"])
            hood_weights[hood] = hood_weights.get(hood, 0) + float(weight)
        hood = max(hood_weights, key=hood_weights.get)
        zones.append(
            {
                "id": f"predicted-hotspot-{rank}",
                "neighborhood": hood,
                "label": f"{pretty(hood)} hotspot {rank}",
                "lng": round(lng, 7),
                "lat": round(lat, 7),
                "blocks": int(len(members)),
                "need": int(round(float(prediction[members].sum()))),
                "predicted": True,
                "confidence": "experimental",
                "model": meta["model"],
                "sourceDate": meta["source_date"],
                "elevation": None,
            }
        )
    zones.sort(key=lambda z: z["need"], reverse=True)
    OUT_ZONES.write_text(json.dumps({"meta": meta, "zones": zones}, indent=2) + "\n")

    print(json.dumps(meta, indent=2))
    print(f"predicted total visible individuals: {prediction.sum():.1f}")
    print(f"wrote {OUT_BLOCKS.relative_to(ROOT)} ({len(blocks)} blocks)")
    print(f"wrote {OUT_ZONES.relative_to(ROOT)} ({len(zones)} moving hotspots)")


if __name__ == "__main__":
    export()
