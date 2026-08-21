# Spec: La Jolla Food Access (Source I) — USDA Food Access Research Atlas

## Goal

Add real **food-insecurity / food-relief** coverage for the **La Jolla** area to the
homelessness Data Commons pipeline, as a new, purely additive, seed-backed source.
The data comes from the USDA ERS **Food Access Research Atlas (FARA)** at census-tract
grain, harmonized into the existing pipeline's long-format marts.

This is a monorepo whose commons pipeline is otherwise **Downtown San Diego only**. La Jolla
sits ~12 miles northwest, outside the downtown block grid. This source deliberately does
**not** extend the downtown grid or neighborhood vocabulary; it uses the pipeline's existing
non-downtown lane, the context mart's free-text `geography` column (the same lane weather,
rents, and PIT already use).

## Why this design

The commons pipeline keys its three exported marts (`monthly_by_neighborhood`,
`monthly_by_block`, `daily_downtown`) to a fixed 6-value downtown neighborhood vocabulary
(`config.DOWNTOWN_NEIGHBORHOODS`) and a downtown-only spatial grid (`dim_blocks`, built by
`src_a`, consumed by `geo.enrich`). A fourth mart, `mart_monthly_context`, is keyed instead
by a free-text `geography` column (existing values include `san_diego_city`, `zip_<zip>`,
`san_diego_region`) and carries no downtown assumption. La Jolla food-access data lands there.

Rejected alternatives:
- **Fetched source** (download the full ~100 MB FARA file at runtime): over-engineered for
  ~12 tracts; FARA is archived/periodic, not auto-refreshing. Not worth the fragility.
- **Promote `la_jolla` to a first-class neighborhood** (add polygons to `dim_blocks`, broaden
  the vocabulary, emit into the downtown marts): large blast radius across `geo.enrich`,
  `src_a`, all three downtown marts, and QA correlations; also conflates a food-access signal
  into homelessness-oriented marts. Out of scope.

## Data source (to verify live during implementation)

**USDA ERS Food Access Research Atlas (FARA)** — one row per census tract.
- Download / documentation page (canonical `source_url`):
  `https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data`
- Vintages to include: **2010, 2015, 2019** (all three archived FARA releases; each is a
  point-in-time snapshot on **2010 census-tract boundaries**).
- Format: XLSX (main sheet "Food Access Research Atlas") / CSV.

**Real FARA fields used** (1-mile / 10-mile "1And10" measure — La Jolla is urban, so the
1-mile threshold applies):

| Canonical metric               | FARA field           | Meaning |
|--------------------------------|----------------------|---------|
| `pop_total`                    | `POP2010`            | Tract population (denominator/context) |
| `low_access_pop`               | `lapop1`             | People > 1 mi (urban) from nearest supermarket |
| `low_access_pop_share`         | `lapop1share`        | % of tract population with low access |
| `low_income_low_access_pop`    | `lalowi1`            | Low-income **and** low-access population |
| `lila_flag`                    | `LILATracts_1And10`  | 1 = tract flagged low-income & low-access ("food desert") |
| `snap_housing_units`           | `TractSNAP`          | Housing units receiving SNAP (food-relief tie-in) |

**Vintage field-harmonization caveat:** FARA column names shift slightly across releases
(e.g. the `LILATracts_1And10` flag and some `lapop*`/`TractSNAP` fields were not present or
were named differently in the 2010 release). The extraction step maps each vintage's columns
to the 6 canonical metrics above. Where a field is genuinely absent for a vintage, the seed
value is left blank (NULL) and the reason recorded in that row's `note` — never faked as 0.

## Area definition (La Jolla)

La Jolla = the set of San Diego County (FIPS `06073`) 2010 census tracts covering ZIP `92037`
(La Jolla Village, Shores, North, etc.). The exact tract GEOIDs are resolved during
implementation from a Census tract↔ZIP crosswalk (e.g. the Census ZCTA-to-tract relationship
file), cross-checked against the FARA file's own tract list — **not fabricated**. The resolved
tract list is recorded in the seed (one row per tract per vintage) and documented in the README.

## Seed schema

`seeds/food_access_la_jolla.csv` — wide, one row per (vintage, tract), populated from the real
FARA files filtered to La Jolla tracts:

```
vintage_year, census_tract, pop_total, low_access_pop, low_access_pop_share,
low_income_low_access_pop, lila_flag, snap_housing_units, source_url, note
```

- `census_tract` — 11-digit tract GEOID (state+county+tract), e.g. `06073008201`.
- `source_url` — the FARA download page (per row); the specific vintage/file noted in `note`.
- Blank numeric cells are allowed only where a vintage genuinely lacks a field (see caveat),
  with an explanatory `note`.

## Staging module `commons/staging/src_i.py`

Modeled on `src_f.py`, with one deliberate deviation: it emits a **long** table (not wide),
because the La Jolla rollup requires an aggregation that is cleaner and unit-testable in Python
than in marts SQL.

- **Registry:** at import, `register_table("stg_i_food_access", grain="tract x vintage",
  signal_type="food_access", source_id="I", refresh="periodic (USDA FARA release; edit seed)",
  measures="USDA Food Access Research Atlas food-access indicators for La Jolla census tracts.",
  known_bias="Low access defined purely by distance to a supermarket, not affordability or
  need; periodic snapshots (2010/2015/2019) on 2010 tract boundaries, not a continuous series;
  SNAP counts are housing units, not people; field availability varies by vintage (see note
  column).")`
- **`load(con) -> LoadResult`:**
  1. Read `seeds/food_access_la_jolla.csv`; validate required columns exist.
  2. Melt the 6 metric columns to long: `(census_tract, vintage_year, metric, value)`,
     dropping NULL values.
  3. Set `geography = 'tract_' || census_tract` for per-tract rows.
  4. Compute the **`la_jolla` rollup** per (vintage_year, metric):
     - **Summed** across La Jolla tracts: `pop_total`, `low_access_pop`,
       `low_income_low_access_pop`, `snap_housing_units`.
     - `low_access_pop_share` (rollup) = `sum(low_access_pop) / sum(pop_total) * 100`
       (recomputed from summed counts, **not** an average of tract shares).
     - `lila_flag` (rollup) = fraction of La Jolla tracts flagged (`sum(lila_flag)/n_tracts`),
       i.e. 0–1. Documented as "share of La Jolla tracts flagged LILA" at rollup grain.
  5. Append rollup rows with `geography = 'la_jolla'` (rollup `source_url` = the FARA download
     page).
  6. Write `stg_i_food_access (geography, vintage_year, metric, value, source_url)` via the
     standard `con.register` / `CREATE OR REPLACE TABLE` / `con.unregister` idiom. `source_url`
     is retained for lineage/docs; the context mart itself has no `source_url` column.
  7. Return `LoadResult("ok", n_rows, note)`.
- **No `geo.enrich`** — geography is explicit, so no downtown-grid dependency.

## Registry `commons/registry.py`

Add `SOURCES["I"] = dict(name="USDA Food Access Research Atlas — La Jolla", url="https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data",
signal_type="food_access", refresh_cadence="periodic (USDA release; manual seed)",
measures=..., known_bias=...)`. Required so `register_table` does not `KeyError` on source_id `I`.

## Marts `commons/marts.py`

Add one `_has(con, "stg_i_food_access")` branch appending to the context-mart list (`parts_c`).
Because the rollup and melt are already done in staging, this is a trivial passthrough with
explicit column aliases (per the mart's R2 invariant):

```sql
SELECT make_date(vintage_year, 1, 1) AS obs_month,
       geography                      AS geography,
       'food_access'                  AS signal_type,
       metric                         AS metric,
       value::DOUBLE                  AS value,
       'I'                            AS source_id
FROM stg_i_food_access
```

`obs_month` = January 1 of the vintage year (2010-01-01, 2015-01-01, 2019-01-01), matching how
annual sources are already placed on the monthly index.

## Export `commons/marts.py :: export()`

`mart_monthly_context` is not CSV-exported today. Add a focused export:
`marts/food_access_la_jolla.csv` = the context-mart rows where `source_id = 'I'`
(columns: `obs_month, geography, signal_type, metric, value, source_id`). A dedicated file is
more discoverable than dumping the entire context mart.

## Orchestration wiring

- `run.py`: append `("load_src_i", "I", src_i.load)` to `STEPS` **before** `build_marts`.
  Not added to `refresh.py` (FARA is periodic, not auto-refreshing).
- `commons/docs_gen.py`: add `src_i` to the staging import tuple so `DATA_DICTIONARY.md`
  regenerates with the new table/source.

## Tests `tests/test_src_i.py`

Following the `test_src_f` / `test_src_h` pattern (each test builds its own DuckDB connection;
`db.ensure_schema(con)` first; **no** `src_a.load` needed since this source doesn't use geo):
- Assert `SOURCES["I"]` exists and `signal_type == "food_access"`.
- Assert the seed CSV has the required columns.
- Assert `src_i.load(con).status == "ok"`.
- Assert `stg_i_food_access` contains both per-tract rows (`geography LIKE 'tract_%'`) **and**
  `la_jolla` rollup rows, for each expected vintage.
- Assert the rollup arithmetic on a small known slice: summed `pop_total` equals the sum of the
  tract `pop_total`s, and rollup `low_access_pop_share` equals summed low-access / summed pop.
- Assert the rows surface into the context mart (build marts, check `source_id='I'` present).

## README update

Add a **"La Jolla food access (Source I)"** section to the top-level `README.md`:
- What the dataset is and its FARA provenance + the three vintages.
- The 6 metrics and their meaning (the table above).
- The `la_jolla` rollup vs per-tract `tract_<GEOID>` rows, and the rollup interpretation of
  `lila_flag` and `low_access_pop_share`.
- How to use `marts/food_access_la_jolla.csv` (and that the same rows live in the context mart).
- The known biases / caveats (distance-based low-access definition; periodic snapshots; SNAP =
  housing units; vintage field availability).

## Out of scope

- Fetching the full FARA file at runtime (seed-backed only).
- Promoting `la_jolla` to a downtown-style neighborhood, adding La Jolla geometry to
  `dim_blocks`, or altering `geo.enrich` / the three downtown marts.
- QA correlation of the food-access signal against downtown homelessness signals (the QA
  module's correlations remain downtown-only; the new source is simply not correlated there).
- Food-distribution **site locations** (a different dataset/grain; not this source).

## File change list

- **New:** `seeds/food_access_la_jolla.csv`, `commons/staging/src_i.py`, `tests/test_src_i.py`,
  this spec.
- **Edit:** `commons/registry.py` (add `SOURCES["I"]`), `commons/marts.py` (context branch +
  export), `run.py` (STEPS), `commons/docs_gen.py` (import), `README.md` (dataset usage section).
- **Regenerated (side-effect):** `DATA_DICTIONARY.md`, `marts/food_access_la_jolla.csv`,
  `commons.duckdb`.
