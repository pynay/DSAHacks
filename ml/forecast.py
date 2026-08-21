"""Neighborhood-level need forecasting for Parsel.

Forecasts monthly 311 homelessness-related request volume (`gid_requests`)
per downtown neighborhood from the data-commons mart, 3 months ahead, and
writes the result as a mart the web app reads via DuckDB.

This is aggregate demand forecasting for aid pre-positioning. The commons
holds no individual-level data, and these signals are proxies with known
biases (see the repo README) -- never report predictions as headcounts.

Model: one pooled Ridge regression (regularized linear AR) across all
neighborhoods: lag/seasonal features + neighborhood one-hots. Model
selection was done via the same rolling backtest -- a HistGradientBoosting
variant overfit badly (MAE 34.7 vs naive 20.8) and was rejected; Ridge
narrowly beats last-month persistence. Evaluation: rolling-origin backtest
over the final 12 months vs last-month-naive and seasonal-naive baselines,
reported in marts/forecast_meta.json.

Run:  python3 ml/forecast.py   (from the repo root)
Deps: ml/requirements.txt
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

ROOT = Path(__file__).resolve().parent.parent
MART = ROOT / "marts" / "monthly_by_neighborhood.csv"
OUT_CSV = ROOT / "marts" / "forecast_monthly.csv"
OUT_META = ROOT / "marts" / "forecast_meta.json"

METRIC = "gid_requests"
HORIZON = 3  # months ahead
BACKTEST_MONTHS = 12
LAGS = (1, 2, 3, 12)
SEED = 42


def load_series() -> pd.DataFrame:
    """Long frame of (neighborhood, month, value), zero-filled to a full
    monthly calendar per neighborhood.

    311 requests are an auto-updating count feed: a month with no matching
    requests is simply absent from the mart, so absence is treated as 0
    (unlike DSDP gaps, which are true reporting gaps and are NOT used here).
    """
    df = pd.read_csv(MART, parse_dates=["obs_month"])
    df = df[df["metric"] == METRIC][["obs_month", "neighborhood", "value"]]
    frames = []
    for hood, g in df.groupby("neighborhood"):
        g = g.set_index("obs_month").sort_index()
        idx = pd.date_range(g.index.min(), g.index.max(), freq="MS")
        s = g["value"].reindex(idx).fillna(0.0)
        frames.append(pd.DataFrame({"neighborhood": hood, "obs_month": idx, "value": s.values}))
    return pd.concat(frames, ignore_index=True)


def build_features(long: pd.DataFrame) -> pd.DataFrame:
    """Supervised rows: lags, 3-month rolling mean, month-of-year, hood one-hots."""
    parts = []
    for hood, g in long.groupby("neighborhood"):
        g = g.sort_values("obs_month").reset_index(drop=True)
        f = pd.DataFrame({"obs_month": g["obs_month"], "neighborhood": hood, "y": g["value"]})
        for lag in LAGS:
            f[f"lag{lag}"] = g["value"].shift(lag)
        f["roll3"] = g["value"].shift(1).rolling(3).mean()
        month = g["obs_month"].dt.month
        f["month_sin"] = np.sin(2 * np.pi * month / 12)
        f["month_cos"] = np.cos(2 * np.pi * month / 12)
        parts.append(f)
    feat = pd.concat(parts, ignore_index=True).dropna().reset_index(drop=True)
    return pd.get_dummies(feat, columns=["neighborhood"], prefix="nb")


def feature_cols(feat: pd.DataFrame) -> list[str]:
    return [c for c in feat.columns if c not in ("obs_month", "y")]


def fit(feat: pd.DataFrame) -> Ridge:
    model = Ridge(alpha=1.0)
    model.fit(feat[feature_cols(feat)], feat["y"])
    return model


def backtest(feat: pd.DataFrame) -> dict:
    """Rolling-origin 1-step-ahead over the final BACKTEST_MONTHS months."""
    months = sorted(feat["obs_month"].unique())
    test_months = months[-BACKTEST_MONTHS:]
    cols = feature_cols(feat)
    err_model, err_naive, err_seasonal = [], [], []
    for m in test_months:
        train = feat[feat["obs_month"] < m]
        test = feat[feat["obs_month"] == m]
        if train.empty or test.empty:
            continue
        model = Ridge(alpha=1.0)
        model.fit(train[cols], train["y"])
        pred = np.maximum(model.predict(test[cols]), 0)
        err_model += list(np.abs(pred - test["y"].values))
        err_naive += list(np.abs(test["lag1"].values - test["y"].values))
        err_seasonal += list(np.abs(test["lag12"].values - test["y"].values))
    return {
        "window_months": BACKTEST_MONTHS,
        "n_predictions": len(err_model),
        "model_mae": round(float(np.mean(err_model)), 2),
        "naive_last_month_mae": round(float(np.mean(err_naive)), 2),
        "seasonal_naive_mae": round(float(np.mean(err_seasonal)), 2),
    }


def forecast(long: pd.DataFrame, model, template: pd.DataFrame) -> pd.DataFrame:
    """Recursive HORIZON-step forecast per neighborhood."""
    cols = feature_cols(template)
    hoods = sorted(long["neighborhood"].unique())
    out = []
    for hood in hoods:
        g = long[long["neighborhood"] == hood].sort_values("obs_month")
        history = list(g["value"].values)
        last = g["obs_month"].max()
        for step in range(1, HORIZON + 1):
            target = last + pd.DateOffset(months=step)
            row = {c: 0.0 for c in cols}
            for lag in LAGS:
                row[f"lag{lag}"] = history[-lag]
            row["roll3"] = float(np.mean(history[-3:]))
            row["month_sin"] = np.sin(2 * np.pi * target.month / 12)
            row["month_cos"] = np.cos(2 * np.pi * target.month / 12)
            nb_col = f"nb_{hood}"
            if nb_col in row:
                row[nb_col] = 1.0
            pred = max(0.0, float(model.predict(pd.DataFrame([row])[cols])[0]))
            history.append(pred)  # recursive: predictions feed later lags
            out.append(
                {
                    "obs_month": target.strftime("%Y-%m-%d"),
                    "neighborhood": hood,
                    "metric": f"{METRIC}_forecast",
                    "value": round(pred, 1),
                }
            )
    return pd.DataFrame(out)


def main() -> None:
    long = load_series()
    feat = build_features(long)
    bt = backtest(feat)
    model = fit(feat)
    fc = forecast(long, model, feat)
    fc.to_csv(OUT_CSV, index=False)

    meta = {
        "model": "Ridge regression (pooled linear AR, alpha=1.0)",
        "target": METRIC,
        "horizon_months": HORIZON,
        "features": [f"lag{lag}" for lag in LAGS]
        + ["roll3", "month_sin", "month_cos", "neighborhood one-hots"],
        "train_window": {
            "start": str(feat["obs_month"].min().date()),
            "end": str(feat["obs_month"].max().date()),
            "n_rows": int(len(feat)),
        },
        "backtest": bt,
        "notes": [
            "Aggregate neighborhood-level demand forecasting for aid pre-positioning; no individual-level data exists in the commons.",
            "311 signals are proxies with known biases, not headcounts (see README / DATA_DICTIONARY).",
            "Missing 311 months are zero-filled (absence of requests = 0 for this auto-updating feed).",
            "Model selection by the same backtest: HistGradientBoosting overfit (MAE 34.7) and was rejected in favor of Ridge.",
            f"Deterministic (Ridge is deterministic; SEED={SEED} kept for any future stochastic variant).",
        ],
        "generated_on": str(date.today()),
    }
    OUT_META.write_text(json.dumps(meta, indent=2) + "\n")

    print(f"wrote {OUT_CSV.relative_to(ROOT)} ({len(fc)} rows) and {OUT_META.relative_to(ROOT)}")
    print(json.dumps(bt, indent=2))


if __name__ == "__main__":
    main()
