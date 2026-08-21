# Outlook Forecast + Camping-Ban ITS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 12-month neighborhood forecast of DSDP's observed downtown series with backtested 80% bands, plus an interrupted-time-series estimate (with placebo) of the July-2023 camping ban's effect on counted units and 311 reports — written as marts, a findings doc, and an Outlook panel in the Parsel app.

**Architecture:** Two pure modeling modules (`ml/outlook_its.py`, `ml/outlook_forecast.py`) with no I/O, unit-tested on synthetic series; a runner (`ml/outlook.py`) that reads the committed `marts/monthly_by_neighborhood.csv`, calls both, and writes `marts/outlook_*.{csv,json}` + `docs/OUTLOOK_FINDINGS.md`; a Next.js server lib + API route mirroring `forecastServer.ts`, and recharts components mounted on the Signals page.

**Tech Stack:** Python 3.11+, pandas, numpy, scikit-learn (Ridge), statsmodels (OLS + HAC), pytest; Next.js 15 app, `@duckdb/node-api`, recharts 3, vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-outlook-forecast-design.md` (read first).

## Global Constraints

- Work on branch `feat/outlook-forecast` in `/Users/pynay/Documents/DSAHacks`; venv `.venv` (`source .venv/bin/activate`); JS via `npm`.
- Target series: metric `dsdp_adjusted_total`, source_id `H`, 6 neighborhoods (`east_village, city_center, columbia, marina, cortez, gaslamp`) from `marts/monthly_by_neighborhood.csv`. Unit language: "counted units (DSDP published, multiplier-adjusted)". 311 = "reports", never people.
- Missing DSDP months (Jul/Aug/Oct/Nov 2025) are interpolated ONLY for lag-feature construction; never used as targets, never plotted as observations; listed in meta.
- Intervention month T0 = `2023-08-01`. Placebo T0 = `2022-08-01` on the pre-ban sample.
- Forecast origin = last published month (2025-12); horizons 1..12; `kind='nowcast'` for target months ≤ run month, else `forecast`.
- Ridge alpha fixed at 1.0 (no tuning on the test window). Intervals = empirical 10th/90th percentile of log-space backtest residuals per horizon.
- No dual-axis charts; single accent hue; causal wording hedged ("associated with").
- Commit per task with `feat:`/`test:`/`docs:` prefix and the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Python tests import ml modules the same way `tests/test_hotspot_benchmark.py` does (check that file's first lines and copy its import mechanism).

---

### Task 1: ITS module (`ml/outlook_its.py`)

**Files:**
- Create: `ml/outlook_its.py`, `tests/test_outlook_its.py`
- Modify: `ml/requirements.txt` (add `statsmodels>=0.14`)

**Interfaces:**
- Produces: `fit_its(y: pd.Series, t0: pd.Timestamp, hac_lags: int = 3) -> dict` where `y` is a monthly series indexed by month-start `Timestamp` (NaN allowed, dropped). Returns:
  `{"n": int, "pre_mean": float, "post": {"estimate","ci_lo","ci_hi","p"}, "post_t": {...same...}, "effect_12m": {"estimate","ci_lo","ci_hi","pct_of_pre"}}`.
- Produces: `placebo_its(y, real_t0, fake_t0, hac_lags=3) -> dict` — same shape, fit on `y[y.index < real_t0]` with `fake_t0`.

- [ ] **Step 1: Add dependency and install**

Append `statsmodels>=0.14` to `ml/requirements.txt`; run `source .venv/bin/activate && pip install -q -r requirements.txt`.

- [ ] **Step 2: Write failing tests** `tests/test_outlook_its.py`

```python
import numpy as np
import pandas as pd
from ml.outlook_its import fit_its, placebo_its  # adapt import to repo convention

def _series(n=60, shift=0.0, shift_at=36, seed=0):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2021-01-01", periods=n, freq="MS")
    season = 40 * np.sin(2 * np.pi * idx.month / 12)
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
```

- [ ] **Step 3: Run → expect ImportError**: `python -m pytest tests/test_outlook_its.py -q`

- [ ] **Step 4: Implement `ml/outlook_its.py`**

```python
"""Interrupted time series (segmented regression) for monthly downtown series.

y_t = b0 + b1*t + b2*post_t + b3*(t - T0)*post_t + month dummies + e_t,  OLS with
Newey-West (HAC) standard errors. Pure functions, no I/O.
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
    res = sm.OLS(s.values, X).fit(cov_type="HAC", cov_kwds={"maxlags": hac_lags})
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
```

- [ ] **Step 5: Run tests → 4 pass**; **Step 6: Commit** `feat: interrupted-time-series module for policy-event effects`

**Exit criteria:** 4 tests green; a −150 synthetic shift is recovered inside the 95% CI with p<0.05; no-shift and placebo CIs contain 0; NaN months dropped (n=58).

---

### Task 2: Forecast module (`ml/outlook_forecast.py`)

**Files:**
- Create: `ml/outlook_forecast.py`, `tests/test_outlook_forecast.py`

**Interfaces:**
- Consumes: a panel `pd.DataFrame` with columns `obs_month` (month-start Timestamp), `neighborhood` (str), `y` (float, NaN = unpublished).
- Produces:
  - `make_frame(panel) -> pd.DataFrame` adds `y_filled`, `is_interp`, `ly`, lag/roll/month features.
  - `backtest(frame, origins: list[pd.Timestamp], horizons=range(1,13), alpha=1.0) -> (pd.DataFrame, dict)` → table with columns `horizon, model_mae, seasonal_naive_mae, last_value_mae, n` and `residuals: {h: np.ndarray}` (log-space, actual − pred).
  - `forecast(frame, origin: pd.Timestamp, residuals: dict, run_month: pd.Timestamp, horizons=range(1,13), alpha=1.0) -> pd.DataFrame` with columns `obs_month, neighborhood, value, lo80, hi80, horizon, kind`.
  - `interpolated_months(frame) -> list[str]` ('YYYY-MM').

- [ ] **Step 1: Write failing tests** `tests/test_outlook_forecast.py`

```python
import numpy as np
import pandas as pd
from ml.outlook_forecast import make_frame, backtest, forecast, interpolated_months

HOODS = ["east_village", "city_center", "columbia", "marina", "cortez", "gaslamp"]

def _panel(n=108, seed=1):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2017-01-01", periods=n, freq="MS")
    rows = []
    for i, h in enumerate(HOODS):
        base = 100 * (i + 1)
        y = base + 20 * np.sin(2 * np.pi * idx.month / 12) + rng.normal(0, 8, n)
        rows.append(pd.DataFrame({"obs_month": idx, "neighborhood": h, "y": y}))
    p = pd.concat(rows, ignore_index=True)
    gaps = p["obs_month"].isin(pd.to_datetime(["2025-07-01", "2025-08-01", "2025-10-01", "2025-11-01"]))
    p.loc[gaps, "y"] = np.nan
    return p

def test_interp_flags_exactly_the_gaps():
    f = make_frame(_panel())
    assert interpolated_months(f) == ["2025-07", "2025-08", "2025-10", "2025-11"]
    assert f["y_filled"].notna().all()

def test_backtest_shape_and_baselines():
    f = make_frame(_panel())
    origins = list(pd.date_range("2023-01-01", "2024-12-01", freq="MS"))
    table, resid = backtest(f, origins)
    assert list(table["horizon"]) == list(range(1, 13))
    assert (table["n"] > 0).all() and set(resid) == set(range(1, 13))
    # on a clean seasonal series the model should be in the same league as seasonal naive
    assert table["model_mae"].mean() < 2 * table["seasonal_naive_mae"].mean()

def test_forecast_shape_bands_and_kind():
    f = make_frame(_panel())
    _, resid = backtest(f, list(pd.date_range("2023-01-01", "2024-12-01", freq="MS")))
    fc = forecast(f, pd.Timestamp("2025-12-01"), resid, run_month=pd.Timestamp("2026-08-01"))
    assert len(fc) == 72 and fc[["value", "lo80", "hi80"]].notna().all().all()
    assert (fc["lo80"] <= fc["value"]).all() and (fc["value"] <= fc["hi80"]).all()
    assert set(fc["kind"]) == {"nowcast", "forecast"}
    assert fc.loc[fc.obs_month == "2026-08-01", "kind"].eq("nowcast").all()
    assert fc.loc[fc.obs_month == "2026-09-01", "kind"].eq("forecast").all()
```

- [ ] **Step 2: Run → ImportError**

- [ ] **Step 3: Implement `ml/outlook_forecast.py`**

```python
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
```

- [ ] **Step 4: Run tests → 3 pass** (the backtest test takes ~20-40s; fine). **Step 5: Commit** `feat: direct multi-horizon DSDP forecast with rolling backtest and residual bands`

**Exit criteria:** 3 tests green; interpolated months detected exactly; 72-row forecast with ordered bands and correct nowcast/forecast split.

---

### Task 3: Runner, marts, findings doc, real-data run (`ml/outlook.py`)

**Files:**
- Create: `ml/outlook.py`, `tests/test_outlook_runner.py`
- Produce (committed): `marts/outlook_forecast.csv`, `marts/outlook_backtest.csv`, `marts/outlook_its.csv`, `marts/outlook_meta.json`, `docs/OUTLOOK_FINDINGS.md`

**Interfaces:**
- Consumes: Task 1 `fit_its`, `placebo_its`; Task 2 `make_frame`, `backtest`, `forecast`, `interpolated_months`.
- Produces: `load_panels(mart_csv: Path) -> (dsdp_panel: pd.DataFrame, requests_downtown: pd.Series, dsdp_downtown: pd.Series)`; `run(root: Path, run_month: pd.Timestamp) -> dict(meta)`; `write_findings(meta, its_rows, path)`.
- CSV schemas exactly as the spec's Outputs section. `outlook_its.csv` columns: `series, scope, term, estimate, ci_lo, ci_hi, p_value, pre_mean, placebo_estimate, placebo_ci_lo, placebo_ci_hi` with `series ∈ {dsdp_adjusted_total, gid_requests}`, `scope ∈ {downtown, <neighborhood>}`, `term ∈ {post, post_t, effect_12m}`.

- [ ] **Step 1: Write failing test** `tests/test_outlook_runner.py`

```python
import json
import pandas as pd
from ml.outlook import load_panels, run

def test_real_run(tmp_path):
    import shutil
    root = tmp_path; (root / "marts").mkdir(); (root / "docs").mkdir()
    shutil.copy("marts/monthly_by_neighborhood.csv", root / "marts" / "monthly_by_neighborhood.csv")
    meta = run(root, run_month=pd.Timestamp("2026-08-01"))
    fc = pd.read_csv(root / "marts" / "outlook_forecast.csv")
    assert len(fc) == 72 and sorted(fc.neighborhood.unique()) == sorted(
        ["east_village", "city_center", "columbia", "marina", "cortez", "gaslamp"])
    assert (fc.lo80 <= fc.value).all() and (fc.value <= fc.hi80).all()
    bt = pd.read_csv(root / "marts" / "outlook_backtest.csv"); assert len(bt) == 12
    its = pd.read_csv(root / "marts" / "outlook_its.csv")
    assert {"dsdp_adjusted_total", "gid_requests"} <= set(its.series)
    assert (its[its.scope == "downtown"].groupby("series").size() == 3).all()
    assert meta["interpolated_months"] == ["2025-07", "2025-08", "2025-10", "2025-11"]
    txt = (root / "docs" / "OUTLOOK_FINDINGS.md").read_text()
    assert "camping ban" in txt.lower() and "associated with" in txt and "reports" in txt
    assert "people fell" not in txt and "people rose" not in txt
    m = json.loads((root / "marts" / "outlook_meta.json").read_text())
    assert m["origin"] == "2025-12" and m["t0"] == "2023-08"
```

- [ ] **Step 2: Run → ImportError**

- [ ] **Step 3: Implement `ml/outlook.py`**

```python
"""Outlook: forward-looking model on the observed downtown series + camping-ban ITS.
Run:  python ml/outlook.py   (from repo root). Reads marts/monthly_by_neighborhood.csv,
writes marts/outlook_*.{csv,json} and docs/OUTLOOK_FINDINGS.md. Deps: ml/requirements.txt."""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.outlook_forecast import backtest, forecast, interpolated_months, make_frame  # noqa: E402
from ml.outlook_its import fit_its, placebo_its  # noqa: E402

HOODS = ["east_village", "city_center", "columbia", "marina", "cortez", "gaslamp"]
T0, PLACEBO_T0 = pd.Timestamp("2023-08-01"), pd.Timestamp("2022-08-01")
ITS_START = pd.Timestamp("2021-01-01")
ORIGIN = pd.Timestamp("2025-12-01")
BACKTEST_ORIGINS = list(pd.date_range("2023-01-01", "2024-12-01", freq="MS"))


def load_panels(mart_csv: Path):
    m = pd.read_csv(mart_csv, parse_dates=["obs_month"])
    d = m[(m.metric == "dsdp_adjusted_total") & (m.source_id == "H") & m.neighborhood.isin(HOODS)]
    full = pd.MultiIndex.from_product([HOODS, pd.date_range(d.obs_month.min(), d.obs_month.max(), freq="MS")],
                                      names=["neighborhood", "obs_month"])
    panel = (d.set_index(["neighborhood", "obs_month"])["value"].reindex(full).rename("y")
             .reset_index())
    dsdp_dt = panel.groupby("obs_month")["y"].sum(min_count=len(HOODS))  # NaN if any hood missing
    r = m[(m.metric == "gid_requests") & m.neighborhood.isin(HOODS)]
    req_dt = r.groupby("obs_month")["value"].sum()
    req_dt = req_dt.reindex(pd.date_range(req_dt.index.min(), req_dt.index.max(), freq="MS"), fill_value=0.0)
    return panel, req_dt, dsdp_dt


def _its_rows(series_name, scope, y):
    y = y[y.index >= ITS_START]
    r = fit_its(y, T0)
    p = placebo_its(y, T0, PLACEBO_T0)
    rows = []
    for term in ("post", "post_t", "effect_12m"):
        rows.append(dict(series=series_name, scope=scope, term=term,
                         estimate=r[term]["estimate"], ci_lo=r[term]["ci_lo"], ci_hi=r[term]["ci_hi"],
                         p_value=r[term].get("p", float("nan")), pre_mean=r["pre_mean"],
                         placebo_estimate=p[term]["estimate"], placebo_ci_lo=p[term]["ci_lo"],
                         placebo_ci_hi=p[term]["ci_hi"]))
    return rows, r, p


def run(root: Path, run_month: pd.Timestamp) -> dict:
    panel, req_dt, dsdp_dt = load_panels(root / "marts" / "monthly_by_neighborhood.csv")
    frame = make_frame(panel)
    bt, resid = backtest(frame, BACKTEST_ORIGINS)
    fc = forecast(frame, ORIGIN, resid, run_month)
    its_rows = []
    its_rows_d, r_d, p_d = _its_rows("dsdp_adjusted_total", "downtown", dsdp_dt); its_rows += its_rows_d
    its_rows_r, r_r, p_r = _its_rows("gid_requests", "downtown", req_dt); its_rows += its_rows_r
    for h in HOODS:
        y = panel[panel.neighborhood == h].set_index("obs_month")["y"]
        its_rows += _its_rows("dsdp_adjusted_total", h, y)[0]

    beats = bt[bt.model_mae < bt.seasonal_naive_mae]["horizon"].tolist()
    dec = fc[fc.obs_month == fc.obs_month.max()]
    meta = {
        "model": "Pooled Ridge (alpha=1.0), direct multi-horizon 1-12, log1p target, lags 0/1/2/3/12 + roll3 + month Fourier + neighborhood one-hots",
        "target": "dsdp_adjusted_total (DSDP published, multiplier-adjusted counted units)",
        "origin": ORIGIN.strftime("%Y-%m"), "run_month": run_month.strftime("%Y-%m"),
        "horizons": 12, "t0": T0.strftime("%Y-%m"), "placebo_t0": PLACEBO_T0.strftime("%Y-%m"),
        "its_window_start": ITS_START.strftime("%Y-%m"),
        "interpolated_months": interpolated_months(frame),
        "backtest": {"origins": [o.strftime("%Y-%m") for o in BACKTEST_ORIGINS],
                     "beats_seasonal_naive_at_horizons": beats},
        "headline": {
            "downtown_forecast_last_month": dec.obs_month.max().strftime("%Y-%m"),
            "downtown_point": round(float(dec.value.sum())),
            "downtown_lo80_sum": round(float(dec.lo80.sum())), "downtown_hi80_sum": round(float(dec.hi80.sum())),
            "ban_effect_12m_dsdp": r_d["effect_12m"], "ban_effect_12m_requests": r_r["effect_12m"],
            "placebo_effect_12m_dsdp": p_d["effect_12m"], "placebo_effect_12m_requests": p_r["effect_12m"],
            "pre_mean_dsdp": r_d["pre_mean"], "pre_mean_requests": r_r["pre_mean"],
        },
        "notes": [
            "Forecast unit = DSDP published totals (occupancy multipliers applied) - not raw counted people and not comparable to RTFH/PIT raw counts.",
            "Missing 2025 months interpolated for lag features only; never targets, never plotted.",
            "80% bands = empirical 10th/90th percentiles of log-space backtest residuals per horizon; band sums across neighborhoods are approximations.",
            "ITS is quasi-experimental: the ban coincided with shelter openings and sweeps; read effects as 'associated with'.",
            "311 is complaint volume, never a headcount.",
        ],
    }
    marts = root / "marts"
    fc.assign(obs_month=fc.obs_month.dt.strftime("%Y-%m-%d")).to_csv(marts / "outlook_forecast.csv", index=False)
    bt.to_csv(marts / "outlook_backtest.csv", index=False)
    pd.DataFrame(its_rows).to_csv(marts / "outlook_its.csv", index=False)
    (marts / "outlook_meta.json").write_text(json.dumps(meta, indent=2))
    write_findings(meta, bt, root / "docs" / "OUTLOOK_FINDINGS.md")
    return meta


def _fmt_eff(e, unit):
    sign = "+" if e["estimate"] >= 0 else "−"
    return f"{sign}{abs(e['estimate']):.0f} {unit} (95% CI {e['ci_lo']:.0f} to {e['ci_hi']:.0f}; {e['pct_of_pre']:+.0f}% of the pre-ban mean)"


def write_findings(meta, bt, path: Path):
    h = meta["headline"]
    beats = meta["backtest"]["beats_seasonal_naive_at_horizons"]
    lines = [
        "# Outlook — where downtown San Diego homelessness is headed",
        f"_Auto-generated by ml/outlook.py on {meta['run_month']}. Numbers are DSDP published (multiplier-adjusted) counted units unless labeled reports._\n",
        "## 1. Twelve-month outlook",
        f"Downtown total (6 core neighborhoods) for {h['downtown_forecast_last_month']}: **{h['downtown_point']:,}** "
        f"(80% band {h['downtown_lo80_sum']:,}–{h['downtown_hi80_sum']:,}), forecast from the last published month {meta['origin']}.",
        f"Honesty check: in a 24-origin rolling backtest the model beats seasonal-naive at horizons {beats if beats else 'none'} of 1–12. "
        "Where it does not, the band is the useful output, not the point.\n",
        "| horizon | model MAE | seasonal-naive MAE | last-value MAE |", "|---|---|---|---|",
        *[f"| {int(r.horizon)} | {r.model_mae:.0f} | {r.seasonal_naive_mae:.0f} | {r.last_value_mae:.0f} |" for r in bt.itertuples()],
        "\n## 2. What the camping ban was associated with (interrupted time series, T0 = Aug 2023)",
        f"- Counted units (DSDP): 12 months after enforcement began, the series was {_fmt_eff(h['ban_effect_12m_dsdp'], 'units')}. "
        f"Placebo (fake ban Aug 2022, pre-ban data only): {h['placebo_effect_12m_dsdp']['estimate']:+.0f}.",
        f"- 311 homelessness reports: {_fmt_eff(h['ban_effect_12m_requests'], 'reports/month')}. "
        f"Placebo: {h['placebo_effect_12m_requests']['estimate']:+.0f}.",
        "- Read together: after the ban, counted units moved one way and reports moved the other. Complaint volume is a reporting signal, "
        "not a headcount — a decline in people seen on sweep mornings alongside rising reports is consistent with displacement into less-visible "
        "locations and with enforcement-driven reporting, and is associated with (not proven caused by) the ordinance, which coincided with shelter openings and sweeps.\n",
        "## 3. What this should tell the people working on it",
        "- Plan capacity against the band, not the point: the 80% range is the honest planning envelope.",
        "- Target outreach at the blocks the complaint signal misses: QA_REPORT.md shows 311 volume explains only a fraction of block-level counts "
        "(r≈0.23), and the block map shows counted people on blocks with zero reports. Complaint-driven deployment under-serves them.",
        "- Do not read enforcement as need: coded citation volume is negatively correlated with complaints (r≈−0.49) — it tracks policy cycles.",
        "- Treat post-ban 311 growth as a reporting shift, not a population surge, when briefing decision-makers.",
    ]
    path.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    today = date.today().replace(day=1)
    m = run(root, pd.Timestamp(today))
    print(json.dumps(m["headline"], indent=2))
```

- [ ] **Step 4: Run test → pass** (real data; ~1-2 min). Then `python ml/outlook.py` from repo root to write the real marts + findings doc. READ `docs/OUTLOOK_FINDINGS.md`: sanity-check signs (expect DSDP effect negative, 311 effect positive), CI widths, and that placebo effects are smaller than the real ones; if the placebo is comparable, the findings text must say so — adjust `write_findings` to add that sentence conditionally (`abs(placebo) >= 0.5*abs(real)` → "not distinguishable from trend noise").
- [ ] **Step 5: Commit** `feat: Outlook runner - DSDP 12-month forecast, camping-ban ITS, findings doc` including the generated marts and doc.

**Exit criteria:** test green on real data; 5 output files committed; findings doc contains the real numbers, the honesty sentence on backtest horizons, hedged causal language, and the placebo comparison; no "people fell/rose" phrasing for 311.

---

### Task 4: App integration — server lib, API, chart, findings card, Signals mount

**Files:**
- Create: `src/lib/outlookServer.ts`, `src/lib/outlookShape.ts`, `src/lib/outlookShape.test.ts`, `src/app/api/outlook/route.ts`, `src/components/charts/OutlookChart.tsx`, `src/components/OutlookFindings.tsx`
- Modify: `src/app/signals/page.tsx` (mount at top of the grid)

**Interfaces:**
- `outlookShape.ts` (pure, unit-tested): `sumBands(rows: {month:string; value:number; lo:number; hi:number}[]) -> {month; value; lo; hi}[]` (sum per month across neighborhoods, rounded) and `beatsNaiveThrough(bt: {horizon:number; model_mae:number; seasonal_naive_mae:number}[]) -> number` (largest h such that model beats seasonal naive at every horizon ≤ h; 0 if none).
- `outlookServer.ts`: `getOutlook(): Promise<OutlookPayload>` where
  ```ts
  export interface OutlookPayload {
    meta: unknown;
    history: { month: string; value: number }[];            // downtown DSDP sum, published months only
    forecast: { month: string; value: number; lo: number; hi: number; kind: 'nowcast'|'forecast' }[];
    requests: { month: string; value: number }[];           // downtown 311, last 36 months (reality check)
    its: Record<'dsdp_adjusted_total'|'gid_requests', { effect12: number; lo: number; hi: number; pct: number; placebo: number; preMean: number }>;
    backtest: { horizon: number; model_mae: number; seasonal_naive_mae: number; last_value_mae: number }[];
    beatsNaiveThrough: number;
  }
  ```
- `/api/outlook` GET → `OutlookPayload` (mirrors `src/app/api/forecast/route.ts` exactly, with `getOutlook`).

- [ ] **Step 1: Write failing vitest** `src/lib/outlookShape.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { sumBands, beatsNaiveThrough } from './outlookShape';

describe('sumBands', () => {
  it('sums value/lo/hi per month and rounds', () => {
    const rows = [
      { month: '2026-01', value: 10.4, lo: 8, hi: 12 },
      { month: '2026-01', value: 20.4, lo: 15, hi: 25 },
      { month: '2026-02', value: 5, lo: 4, hi: 6 },
    ];
    expect(sumBands(rows)).toEqual([
      { month: '2026-01', value: 31, lo: 23, hi: 37 },
      { month: '2026-02', value: 5, lo: 4, hi: 6 },
    ]);
  });
});

describe('beatsNaiveThrough', () => {
  it('returns the longest prefix of horizons where model beats seasonal naive', () => {
    const bt = [1, 2, 3, 4].map((h) => ({ horizon: h, model_mae: h <= 2 ? 10 : 30, seasonal_naive_mae: 20 }));
    expect(beatsNaiveThrough(bt)).toBe(2);
    expect(beatsNaiveThrough(bt.map((r) => ({ ...r, model_mae: 99 })))).toBe(0);
  });
});
```

- [ ] **Step 2: `npm test -- outlookShape` → fails**; implement `src/lib/outlookShape.ts`:

```ts
export interface BandRow { month: string; value: number; lo: number; hi: number }
export function sumBands(rows: BandRow[]): BandRow[] {
  const m = new Map<string, BandRow>();
  for (const r of rows) {
    const cur = m.get(r.month) ?? { month: r.month, value: 0, lo: 0, hi: 0 };
    m.set(r.month, { month: r.month, value: cur.value + r.value, lo: cur.lo + r.lo, hi: cur.hi + r.hi });
  }
  return [...m.values()].sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ month: r.month, value: Math.round(r.value), lo: Math.round(r.lo), hi: Math.round(r.hi) }));
}
export function beatsNaiveThrough(bt: { horizon: number; model_mae: number; seasonal_naive_mae: number }[]): number {
  let k = 0;
  for (const r of [...bt].sort((a, b) => a.horizon - b.horizon)) {
    if (r.model_mae < r.seasonal_naive_mae && r.horizon === k + 1) k = r.horizon; else break;
  }
  return k;
}
```

- [ ] **Step 3: Implement `src/lib/outlookServer.ts`** — copy the DuckDB/caching structure of `src/lib/forecastServer.ts` (same imports, `MARTS` path, `cache ??= build()` export named `getOutlook`). Queries:
  - history: `SELECT strftime(obs_month,'%Y-%m') month, SUM(value) value FROM read_csv_auto('<monthly_by_neighborhood>') WHERE metric='dsdp_adjusted_total' AND source_id='H' AND neighborhood IN (6 hoods) GROUP BY 1 HAVING COUNT(*)=6 ORDER BY 1` (HAVING drops unpublished months).
  - forecast: `SELECT strftime(obs_month,'%Y-%m') month, neighborhood, value, lo80 lo, hi80 hi, kind FROM read_csv_auto('<outlook_forecast>') ORDER BY 1,2` → `sumBands` per kind (keep `kind` from the first row of each month).
  - requests: `gid_requests` downtown sum, last 36 months (same shape as forecastServer's history query).
  - its: from `outlook_its.csv` WHERE scope='downtown' AND term='effect_12m' → map by series to `{effect12: estimate, lo: ci_lo, hi: ci_hi, pct: round(100*estimate/pre_mean), placebo: placebo_estimate, preMean: pre_mean}`.
  - backtest: all rows of `outlook_backtest.csv`; `beatsNaiveThrough(backtest)`.
  - meta: `JSON.parse(fs.readFileSync(outlook_meta.json))`.
- [ ] **Step 4: `src/app/api/outlook/route.ts`** — identical to `api/forecast/route.ts` with `getOutlook` and log prefix `[/api/outlook]`.
- [ ] **Step 5: `src/components/charts/OutlookChart.tsx`** (client component, recharts `ComposedChart`): data = history months (value) ∪ forecast months (point + band); `<Area dataKey="band" ...>` using `[lo, hi]` range encoding (recharts Area supports `dataKey` returning `[lo,hi]`), `<Line dataKey="actual">` solid navy `#0369a1`, `<Line dataKey="forecast">` same hue dashed, `<ReferenceLine x="2023-08" label="camping ban">`, `<ReferenceLine x={firstForecastMonth}>` labelled "forecast →", nowcast months get a lighter dash. Legend present (2 series + band), tooltip shows value and band, `tick` every January. Height 260, single hue, no second axis. Add a small `<p>` under it: "DSDP published totals (multiplier-adjusted). 80% band from backtest residuals. Unpublished months (Jul/Aug/Oct/Nov 2025) are gaps, not zeros."
- [ ] **Step 6: `src/components/OutlookFindings.tsx`** — three tiles in a grid (`rounded-xl border border-slate-200 bg-white p-4 shadow-sm`, matching the Signals page): (1) "12-month outlook" — downtown point for last forecast month + band + sentence "Beats seasonal-naive through horizon {k}" or "Does not beat seasonal-naive — use the band"; (2) "Camping ban × counted units" — effect12 with CI and pct, placebo in small text, sentence hedged "associated with"; (3) "Camping ban × 311 reports" — same, sentence "reports rose/fell — a reporting signal, not a headcount". Colors: emerald for "beats naive", amber otherwise; effect tiles use slate text only (no semantic red/green for the effect sign — the sign is not good/bad).
- [ ] **Step 7: Mount on Signals page** — at the top of the `{commons && (<div className="grid …">` block add a full-width (`lg:col-span-3`) card: heading "Where downtown is headed", the chart, then `<OutlookFindings …/>`; the page fetches `/api/outlook` alongside `/api/commons` (separate `useState`, render when loaded; if the fetch fails render nothing — the rest of the page must still work).
- [ ] **Step 8: Verify** — `npm run check` (typecheck + lint + vitest) green; `npm run build` succeeds; start `npm run dev` and load `/signals` and `/api/outlook` (curl the API and confirm `forecast.length === 12`, `its.dsdp_adjusted_total.effect12` is a number); screenshot the panel in the browser pane and eyeball label collisions.
- [ ] **Step 9: Commit** `feat: Outlook panel - DSDP forecast with bands, camping-ban ITS tiles, /api/outlook`

**Exit criteria:** `npm run check` and `npm run build` green; `/api/outlook` returns the full payload; Signals page shows the chart (history + banded forecast + ban line) and three findings tiles; the page still renders if `/api/outlook` fails; no dual axis; every number on screen is traceable to a mart file.

---

## Self-review notes

- Spec coverage: Model 1 → T2+T3; Model 2 incl. placebo → T1+T3; outputs (4 marts + findings) → T3; app integration (server lib, route, chart, findings, mount) → T4; testing section → T1/T2/T3 pytest + T4 vitest; dependency → T1. Risks/honesty notes → encoded in T3's findings text and conditional placebo sentence.
- Type consistency: `fit_its`/`placebo_its` dict shape used identically in T3 `_its_rows`; `forecast()` columns (`obs_month, neighborhood, value, lo80, hi80, horizon, kind`) match T3 CSV and T4 queries (`lo80 AS lo`); `backtest()` columns match `outlook_backtest.csv` and `beatsNaiveThrough` input.
- Known simplification: summed neighborhood bands ≈ downtown band (noted in meta + UI copy).
