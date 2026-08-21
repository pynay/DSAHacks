# QA Report - generated 2026-08-20 20:21

## Run summary

| step | status | rows | note |
|---|---|---|---|
| refresh_311 | ok | 329515 | kept categories=['encampment', 'outreach_request']; failed files=[] |
| refresh_72hr | ok | 334073 |  |
| refresh_citations | ok | 78158 | failed files=[] |
| build_marts | ok | 54211 |  |
| export_marts | ok | 287 | 4 files exported |
| data_dictionary | ok | 22 | /Users/pynay/Documents/DSAHacks/DATA_DICTIONARY.md |

## Source gaps

None - all steps ok.

## Table inventory

| table | rows | min date | max date |
|---|---|---|---|
| dim_blocks | 287 |  |  |
| dim_h_blockgrid | 382 |  |  |
| mart_daily_downtown | 23054 | 2012-01-01 | 2026-08-19 |
| mart_monthly_block | 22948 | 2014-01-01 | 2026-08-01 |
| mart_monthly_context | 4235 | 2012-01-01 | 2026-08-01 |
| mart_monthly_neighborhood | 3974 | 2014-01-01 | 2026-08-01 |
| stg_a_monthly_totals | 88 | 2012-01-01 | 2019-04-01 |
| stg_a_neighborhood_totals | 96 | 2018-01-01 | 2019-04-01 |
| stg_a_observations | 41166 | 2014-01-01 | 2018-02-21 |
| stg_capacity_monthly | 23 | 2026-04-01 | 2026-08-01 |
| stg_citations | 78158 | 2014-01-02 | 2026-07-31 |
| stg_dsdp_monthly | 0 | None | None |
| stg_events | 9 | 2018-08-21 | 2024-12-29 |
| stg_gid_requests | 329515 | 2018-08-01 | 2026-08-01 |
| stg_h_area_crosswalk | 24 |  |  |
| stg_h_blocklevel | 3737 | 2018-01-01 | 2025-01-01 |
| stg_h_method_periods | 4 |  |  |
| stg_h_monthly | 2880 | 2017-01-01 | 2025-12-01 |
| stg_pit_annual | 9 |  |  |
| stg_violations_72hr | 334073 | 2017-03-01 | 2026-08-01 |
| stg_weather_daily | 5342 | 2012-01-01 | 2026-08-16 |
| stg_zori_monthly | 3507 | 2015-01-01 | 2026-07-01 |

## Data quality

- 311: 329515 rows; 1.0% missing coords (geocode failures); 31.6% flagged child duplicates (excluded from marts); 27.77% fall in downtown blocks (rest are citywide - expected).
- Citations: source has no coordinates; geo columns intentionally NULL (citywide analysis only).
- Source A: 1964 rows from imputed months (flagged is_imputed).
- Source H: 140 not_reported rows (incl. 4 unpublished 2025 months); individual/tent/vehicle components are digitized from map images (secondary reliability vs the published total).

## Validation Correlations: do independent signals agree?

- **(i) 311 downtown volume vs observed downtown totals - A/DSDP/H (monthly)**: r = 0.393 (n=85 pairs). Complaints track observed street population direction only loosely. Correlation of volumes, not a people count. Where H anchors the series, note H totals are occupancy-multiplier-adjusted volumes, not raw counted units. Observed series merges source A (raw units) and source H (multiplier-adjusted) per month via max(); bases differ in the 2018-2019 overlap, so r is not an apples-to-apples comparison across the full window.

- **(ii) 311 vs Source A counted units at block-month grain (2016-2018 overlap; note: stg_a_observations ends 2018-02 and 311 homelessness categories begin 2018-08 - by design the two series do not overlap in time)**: insufficient overlapping data (n=0).

- **(ii-b) 311 vs DSDP block-level units at census-block-month grain (2019-2025)**: r = 0.231 (n=1061 pairs). Block-level agreement is weak - fine-grained complaint data locates hotspots poorly. These are raw counted units (component sums), not multiplier-adjusted.

- **(iii) citations_vs_downtown_observed (monthly, citations are citywide)**: r = 0.320 (n=64 pairs). Enforcement volume reflects policy/patrol priorities as much as street population; treat as pressure signal, not headcount.

- **(iii) citations_vs_311 (monthly, citations are citywide)**: r = -0.488 (n=96 pairs). Note the NEGATIVE correlation: citation volume moves opposite to this series over the overlap window. Enforcement volume reflects policy/patrol priorities as much as street population; treat as pressure signal, not headcount.
