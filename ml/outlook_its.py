"""Interrupted time series (segmented regression) for monthly downtown series.

y_t = b0 + b1*t + b2*post_t + b3*(t - T0)*post_t + month dummies + e_t,  OLS with
Newey-West (HAC) standard errors. Pure functions, no I/O.

HAC (Newey-West) SEs: robust to autocorrelation; slightly under-covers in
samples of ~60 months -- read 95% CIs as ~85-90%.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.api as sm


def _design(idx: pd.DatetimeIndex, t0: pd.Timestamp) -> pd.DataFrame:
    t = np.arange(len(idx), dtype=float)
    t0_pos = float(np.searchsorted(idx.values, np.datetime64(t0)))
    post = (idx >= t0).astype(float)
    X = pd.DataFrame({"t": t, "post": post, "post_t": np.where(post == 1, t - t0_pos, 0.0)}, index=idx)
    months = pd.get_dummies(pd.Series(idx.month, index=idx), prefix="m", drop_first=True, dtype=float)
    return sm.add_constant(pd.concat([X, months], axis=1), has_constant="add")


def fit_its(y: pd.Series, t0: pd.Timestamp, hac_lags: int = 3) -> dict:
    y = y.sort_index()
    X_full = _design(y.index, t0)
    s = y.dropna()
    X = X_full.loc[s.index]
    res = sm.OLS(s.values, X).fit(cov_type="HAC", cov_kwds={"maxlags": hac_lags, "use_correction": True})
    ci = res.conf_int(alpha=0.05)
    out = {"n": int(len(s)), "pre_mean": float(s[s.index < t0].mean())}
    for term in ("post", "post_t"):
        out[term] = {"estimate": float(res.params[term]), "ci_lo": float(ci.loc[term, 0]),
                     "ci_hi": float(ci.loc[term, 1]), "p": float(res.pvalues[term])}
    V = res.cov_params()
    est = res.params["post"] + 12 * res.params["post_t"]
    var = V.loc["post", "post"] + 144 * V.loc["post_t", "post_t"] + 24 * V.loc["post", "post_t"]
    se = float(np.sqrt(max(var, 0.0)))
    out["effect_12m"] = {"estimate": float(est), "ci_lo": float(est - 1.96 * se),
                         "ci_hi": float(est + 1.96 * se),
                         "pct_of_pre": float(100 * est / out["pre_mean"]) if out["pre_mean"] else float("nan")}
    return out


def placebo_its(y: pd.Series, real_t0: pd.Timestamp, fake_t0: pd.Timestamp, hac_lags: int = 3) -> dict:
    return fit_its(y[y.index < real_t0], fake_t0, hac_lags)
