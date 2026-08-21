"""Direct multi-horizon pooled Ridge forecast of the DSDP observed series, with
rolling-origin backtest vs naive baselines and empirical residual intervals. Pure functions."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

LAGS = (1, 2, 3, 12)


def make_frame(panel: pd.DataFrame) -> pd.DataFrame:
    df = panel.sort_values(["neighborhood", "obs_month"]).reset_index(drop=True).copy()
    df["obs_month"] = pd.to_datetime(df["obs_month"])
    g = df.groupby("neighborhood", sort=False)
    df["y_filled"] = g["y"].transform(lambda s: s.interpolate(limit_area="inside"))
    df["is_interp"] = df["y"].isna() & df["y_filled"].notna()
    df["ly"] = np.log1p(df["y_filled"])
    gl = df.groupby("neighborhood", sort=False)["ly"]
    for k in LAGS:
        df[f"lag{k}"] = gl.shift(k)
    df["roll3"] = gl.transform(lambda s: s.shift(1).rolling(3).mean())
    return df


def interpolated_months(frame: pd.DataFrame) -> list[str]:
    return sorted(frame.loc[frame["is_interp"], "obs_month"].dt.strftime("%Y-%m").unique().tolist())


def _xy(frame: pd.DataFrame, h: int):
    """Rows: features at origin month, target = ly h months later (same neighborhood)."""
    g = frame.groupby("neighborhood", sort=False)
    tgt = g["ly"].shift(-h)
    tgt_month = g["obs_month"].shift(-h)
    tgt_interp = g["is_interp"].shift(-h)
    X = frame[[f"lag{k}" for k in LAGS] + ["roll3"]].copy()
    X["lag0"] = frame["ly"]
    mm = tgt_month.dt.month
    X["m_sin"], X["m_cos"] = np.sin(2 * np.pi * mm / 12), np.cos(2 * np.pi * mm / 12)
    X = pd.concat([X, pd.get_dummies(frame["neighborhood"], prefix="n", dtype=float)], axis=1)
    ok = X.notna().all(axis=1) & tgt.notna() & (tgt_interp == False)  # noqa: E712
    return X, tgt, tgt_month, ok


def _model(alpha):
    return make_pipeline(StandardScaler(), Ridge(alpha=alpha))


def backtest(frame, origins, horizons=range(1, 13), alpha=1.0):
    rows, resid = [], {h: [] for h in horizons}
    for h in horizons:
        X, tgt, tgt_month, ok = _xy(frame, h)
        errs_m, errs_s, errs_l = [], [], []
        for o in origins:
            train = ok & (tgt_month <= o)                      # targets known at origin
            test = ok & (frame["obs_month"] == o) & (~frame["is_interp"])
            if train.sum() < 30 or test.sum() == 0:
                continue
            m = _model(alpha).fit(X[train], tgt[train])
            pred = m.predict(X[test])
            actual = tgt[test].values
            resid[h].extend((actual - pred).tolist())
            errs_m.extend(np.abs(np.expm1(actual) - np.expm1(pred)).tolist())
            # baselines in level space
            for i, (_, r) in enumerate(frame[test].iterrows()):
                hood = r["neighborhood"]
                series = frame[frame["neighborhood"] == hood].set_index("obs_month")["y"]
                t_month = o + pd.DateOffset(months=h)
                sn = series.get(t_month - pd.DateOffset(months=12), np.nan)
                errs_s.append(abs(np.expm1(actual[i]) - sn) if pd.notna(sn) else np.nan)
                errs_l.append(abs(np.expm1(actual[i]) - series.get(o, np.nan)))
        rows.append({"horizon": h, "model_mae": float(np.mean(errs_m)),
                     "seasonal_naive_mae": float(np.nanmean(errs_s)),
                     "last_value_mae": float(np.nanmean(errs_l)), "n": len(errs_m)})
    return pd.DataFrame(rows), {h: np.array(v) for h, v in resid.items()}


def forecast(frame, origin, residuals, run_month, horizons=range(1, 13), alpha=1.0):
    out = []
    for h in horizons:
        X, tgt, tgt_month, ok = _xy(frame, h)
        m = _model(alpha).fit(X[ok], tgt[ok])
        at = frame["obs_month"] == origin
        Xo = X[at].copy()
        t_month = origin + pd.DateOffset(months=h)
        Xo["m_sin"], Xo["m_cos"] = np.sin(2 * np.pi * t_month.month / 12), np.cos(2 * np.pi * t_month.month / 12)
        pred = m.predict(Xo)
        q10, q90 = np.percentile(residuals[h], [10, 90]) if len(residuals[h]) else (0.0, 0.0)
        for hood, p in zip(frame.loc[at, "neighborhood"], pred):
            out.append({"obs_month": t_month, "neighborhood": hood, "value": float(np.expm1(p)),
                        "lo80": float(np.expm1(p + q10)), "hi80": float(np.expm1(p + q90)),
                        "horizon": h, "kind": "nowcast" if t_month <= run_month else "forecast"})
    return pd.DataFrame(out)
