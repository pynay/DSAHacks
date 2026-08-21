import numpy as np
import pandas as pd
from ml.outlook_its import fit_its, placebo_its

N_SEEDS = 120  # 40 seeds is too few: placebo (n=36) true HAC coverage ~85% has
# high sampling noise at N=40 (seeds 0-39 give 70% observed, failing >=80%
# deterministically); N=120 stabilizes the observed rate near the true one.
COVERAGE_MIN = 0.80


def _series(n=60, shift=0.0, shift_at=36, seed=0):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2021-01-01", periods=n, freq="MS")
    season = 40 * np.sin(2 * np.pi * idx.month.to_numpy() / 12)
    y = 800 + 2.0 * np.arange(n) + season + rng.normal(0, 15, n)
    y[shift_at:] += shift
    return pd.Series(y, index=idx)


def test_recovers_level_shift():
    ests, covers = [], []
    for seed in range(N_SEEDS):
        y = _series(shift=-150.0, seed=seed)
        r = fit_its(y, pd.Timestamp("2024-01-01"))
        ests.append(r["post"]["estimate"])
        covers.append(r["post"]["ci_lo"] <= -150.0 <= r["post"]["ci_hi"])
        if seed == 0:
            assert r["n"] == 60 and 700 < r["pre_mean"] < 950
    assert abs(np.mean(ests) - (-150.0)) <= 25
    assert np.mean(covers) >= COVERAGE_MIN


def test_no_shift_ci_contains_zero():
    ests, covers = [], []
    for seed in range(N_SEEDS):
        y = _series(shift=0.0, seed=seed)
        r = fit_its(y, pd.Timestamp("2024-01-01"))
        ests.append(r["post"]["estimate"])
        covers.append(r["post"]["ci_lo"] <= 0.0 <= r["post"]["ci_hi"])
    assert abs(np.mean(ests) - 0.0) <= 25
    assert np.mean(covers) >= COVERAGE_MIN


def test_placebo_uses_pre_sample_only():
    covers = []
    for seed in range(N_SEEDS):
        y = _series(shift=-150.0, seed=seed)
        r = placebo_its(y, pd.Timestamp("2024-01-01"), pd.Timestamp("2022-07-01"))
        assert r["n"] == 36                      # only months before the real T0
        covers.append(r["post"]["ci_lo"] <= 0.0 <= r["post"]["ci_hi"])
    assert np.mean(covers) >= COVERAGE_MIN


def test_nan_months_are_dropped():
    y = _series(); y.iloc[[50, 51]] = np.nan
    assert fit_its(y, pd.Timestamp("2024-01-01"))["n"] == 58
