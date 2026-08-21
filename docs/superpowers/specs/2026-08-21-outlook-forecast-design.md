# Outlook: forward-looking model on the observed downtown series — design

**Challenge prompt served:** "Where is San Diego downtown's homelessness situation headed,
and what should that tell the people working to address it?"

**Problem.** Parsel's only forecast is a 3-month Ridge on 311 *complaint volume* — a proxy.
The Commons holds the actual observed series unused by any model: verified DSDP monthly
counts for 6 downtown neighborhoods, 2017-01 → 2025-12 (108 months, 4 unpublished in 2025).
This adds (1) a 12-month neighborhood forecast of that series with honest uncertainty and
(2) an interrupted-time-series (ITS) estimate of the July-2023 camping ban's effect on both
counted people and complaints — the single most decision-relevant question in the data.

## Scope

In: `ml/outlook.py` (model + marts + findings doc), tests, server lib + API route, an
Outlook panel on the Signals page. Out: hotspot model changes, new data sources, UI redesign.

## Data

- Target series A: `stg_h_monthly` / `marts/monthly_by_neighborhood.csv` metric
  `dsdp_adjusted_total` (source H), 6 core neighborhoods. NOTE: multiplier-adjusted
  published totals — forecasts are in the same published unit and say so.
- Series B: `gid_requests` (311, downtown, child-duplicates excluded), 2018-08 → present.
- Missing 2025 months (Jul/Aug/Oct/Nov, true reporting gaps): linearly interpolated **for
  lag-feature construction only**; never plotted or reported as observations; flagged in meta.
- Event: camping ban — council adoption 2023-06-13, enforcement from 2023-07-31
  (seeds/events.csv). Intervention month T0 = 2023-08 (first full enforcement month).

## Model 1 — 12-month direct multi-horizon forecast

- One pooled Ridge per horizon h = 1..12 on `log1p(total)`: features lag1, lag2, lag3,
  lag12, rolling-3 mean, month sin/cos, neighborhood one-hots. Pooled across neighborhoods
  (6 × ~100 rows is too thin for per-neighborhood models).
- Origin = 2025-12 (last published month) → forecast 2026-01 … 2026-12. Months already
  past at run time are labeled `nowcast` (DSDP reports for 2026 are not in the bundle);
  2026 311 actuals are shown alongside as an external reality check, never as the target.
- **Backtest:** rolling-origin, 24 origins (2023-01 … 2024-12), every horizon 1..12, vs
  seasonal-naive (value 12 months before target) and last-value baselines. Report MAE per
  horizon for all three; the meta file states plainly at which horizons the model does NOT
  beat naive. Selection is not tuned to the test window (alpha fixed = 1.0).
- **Intervals:** empirical 10th/90th percentile of backtest residuals per horizon (in log
  space), applied to point forecasts → `lo80`/`hi80`. Honest: widths come from how wrong
  the model actually was, not a normality assumption.

## Model 2 — interrupted time series (camping ban)

- Segmented regression on monthly downtown totals, window 2021-01 → 2025-12 (DSDP) and
  2021-01 → latest (311), excluding the COVID shock years:
  `y_t = b0 + b1·t + b2·post_t + b3·(t−T0)·post_t + Σ month dummies + e_t`
  fit with OLS, HAC (Newey-West, 3 lags) standard errors via statsmodels.
- Reported per series (and per neighborhood for DSDP): immediate level change `b2`,
  slope change `b3` (per month), 95% CIs, p-values, and the implied change 12 months
  after T0 (`b2 + 12·b3`) in both absolute and % of pre-period mean.
- **Placebo:** same model with a fake T0 = 2022-08; if the placebo "effect" is comparable,
  the findings doc says the estimate is not distinguishable from trend noise.
- Interpretation language is constrained: DSDP = "counted (adjusted) units",
  311 = "reports", never "people fell/rose" for 311. Causal wording is hedged
  ("associated with"; the ban coincided with shelter openings and sweeps).

## Outputs (marts, committed like the existing forecast marts)

- `marts/outlook_forecast.csv` — obs_month, neighborhood, value, lo80, hi80, horizon, kind
  (`nowcast`|`forecast`)
- `marts/outlook_backtest.csv` — horizon, model_mae, seasonal_naive_mae, last_value_mae, n
- `marts/outlook_its.csv` — series, scope (downtown|neighborhood), term, estimate, ci_lo,
  ci_hi, p_value, pre_mean, placebo_estimate
- `marts/outlook_meta.json` — model description, origin, windows, interpolated months,
  headline numbers, notes
- `docs/OUTLOOK_FINDINGS.md` — auto-generated plain-language findings with the numbers
  (pitch-ready), including the counts-down / complaints-up divergence and the "silent
  blocks" + enforcement-divergence recommendations pulled from the existing QA numbers.

## App integration (follows `forecastServer.ts` pattern)

- `src/lib/outlookServer.ts` — DuckDB reads of the three CSVs + meta, cached; returns
  `{ history, forecast (with bands), its, backtest, meta }` with neighborhood keys
  matching `DeliveryZone.neighborhood`.
- `src/app/api/outlook/route.ts` — GET JSON.
- `src/components/charts/OutlookChart.tsx` — recharts: history line, forecast line with
  80% band (Area), ban `ReferenceLine` at 2023-08, nowcast months hatched/labelled, 311
  reality-check toggle indexed on its own panel (never dual-axis). Single accent hue
  consistent with the app's navy/emerald theme.
- `src/components/OutlookFindings.tsx` — three stat tiles: 12-mo outlook (with band),
  ban effect on counts, ban effect on reports; each with one plain-language sentence and
  the backtest caveat ("beats seasonal-naive at horizons 1–k").
- Mounted at the top of `src/app/signals/page.tsx`.

## Testing

- `tests/test_outlook.py` (pytest): ITS recovers a known synthetic level shift within CI;
  placebo on a no-shift series ≈ 0; forecast CSV has 6 × 12 rows, no NaN, lo80 ≤ value ≤
  hi80; backtest table has 12 horizons; interpolated months listed in meta equal exactly
  the 4 known gaps.
- `src/lib/outlookServer.test.ts` (vitest): band/series shaping helper on a fixture.
- Real-data run committed; findings doc regenerated by the script.

## Dependencies

`statsmodels>=0.14` added to `ml/requirements.txt` (root requirements already includes it
via `-r`). No new JS deps.

## Risks / honesty notes

- ~100 months per neighborhood with two structural breaks (COVID, ban) — a 12-month
  forecast may only beat naive at short horizons; we report that rather than hide it.
- ITS is quasi-experimental; confounders (shelter openings, sweeps, weather) are named in
  the findings. The placebo test is the guard against over-claiming.
