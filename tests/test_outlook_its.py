import numpy as np
import pandas as pd
from ml.outlook_its import fit_its, placebo_its


def _series(n=60, shift=0.0, shift_at=36, seed=0):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2021-01-01", periods=n, freq="MS")
    season = 40 * np.sin(2 * np.pi * idx.month.to_numpy() / 12)
    y = 800 + 2.0 * np.arange(n) + season + rng.normal(0, 15, n)
    y[shift_at:] += shift
    return pd.Series(y, index=idx)


def test_recovers_level_shift():
    y = _series(shift=-150.0)
    r = fit_its(y, pd.Timestamp("2024-01-01"))
    assert r["post"]["ci_lo"] <= -150.0 <= r["post"]["ci_hi"]
    assert r["post"]["p"] < 0.05
    assert r["n"] == 60 and 700 < r["pre_mean"] < 950


def test_no_shift_ci_contains_zero():
    y = _series(shift=0.0)
    r = fit_its(y, pd.Timestamp("2024-01-01"))
    assert r["post"]["ci_lo"] <= 0.0 <= r["post"]["ci_hi"]


def test_placebo_uses_pre_sample_only():
    y = _series(shift=-150.0)
    r = placebo_its(y, pd.Timestamp("2024-01-01"), pd.Timestamp("2022-07-01"))
    assert r["n"] == 36                      # only months before the real T0
    assert r["post"]["ci_lo"] <= 0.0 <= r["post"]["ci_hi"]


def test_nan_months_are_dropped():
    y = _series(); y.iloc[[50, 51]] = np.nan
    assert fit_its(y, pd.Timestamp("2024-01-01"))["n"] == 58
