# SD Homelessness Data Commons

Reproducible pipeline fusing eight San Diego homelessness signal sources into one
DuckDB database, plus exported marts. Built for the 2026-08-20 DSA hackathon.

**Core principle: this is a dataset of signals with known biases, not a census.**
Nothing here counts people directly except source A (2014-2018 street counts) and
source F (annual PIT). Everything else — 311 complaints, citations, shelter beds,
weather, rent — is a *proxy* that correlates with homelessness pressure but must
never be reported as a headcount. Every table carries `measures` and `known_bias`
text in `DATA_DICTIONARY.md`; read it before citing a number.

## Run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py        # full build: fetch all 8 sources, build marts, write docs/QA
python refresh.py    # incremental: re-pull 311 (C) + enforcement (D) only, rebuild marts/docs
python -m pytest -q  # test suite
```

`run.py` is idempotent — rerunning it re-fetches everything (cheap after the first run,
since `raw/` downloads are conditional-GET cached) and rebuilds the database from
scratch each time via `CREATE OR REPLACE TABLE`. `refresh.py` is the cheap daily-driver:
it only re-scans sources C (311) and D (72-hour violations + citations), since those are
the only auto-updating feeds; everything else (manual seeds, static bundles, annual data)
keeps its last load and marts/docs are rebuilt on top of the refreshed staging tables.

## Sources

| ID | Source | Signal | Cadence |
|---|---|---|---|
| A | Downtown block-level street counts, 2014-2019 (sandiegodata.org) | observation | static archive |
| B | DSDP monthly report totals (press/manual seed) | observation | manual/PDF |
| C | Get It Done 311 requests, homelessness categories | complaint | daily (auto) |
| D | 72-hr parking violations + selected citations | enforcement | daily/annual (auto) |
| E | Shelter capacity (City/SDHC) | capacity | monthly (manual/PDF) |
| F | Annual Point-in-Time counts (RTFH) | observation | annual (manual seed) |
| G | Weather (NOAA), rent (Zillow ZORI), policy events | context | daily/monthly/manual |
| H | Hackathon mandatory bundle: DSDP downtown counts, curated by Data Science Alliance | observation | static bundle, committed |

Full per-table lineage (grain, URL, refresh cadence, `measures`, `known_bias`) is
auto-generated into `DATA_DICTIONARY.md` on every run — that file, not this README, is
the source of truth for column-level detail.

### Source H — the hackathon mandatory dataset

The hackathon supplied a mandatory bundle mid-build: verified DSDP monthly unsheltered
totals by downtown area (2017-2025), digitized block-level component counts (2018-2025,
12 count dates), block-grid polygons, an area crosswalk, and the occupancy-multiplier
schedule. It's committed verbatim at `data/hackathon/` (not re-fetched — there is no
stable public URL, only a Drive share) with full chain-of-custody in
`docs/hackathon/PROVENANCE.md`, including the providers' own critical-analysis notes
(multiplier math, block-footprint change, area-name collisions, fellowship-month
counting-effort confounder). `docs/hackathon/DATA_DICTIONARY_hackathon.md` and
`METHODOLOGY_CHANGELOG.md` are the providers' original docs, exported to markdown.

H supersedes B as the primary modern observed downtown series: `mart_monthly_neighborhood`
carries H's `dsdp_adjusted_total` (multiplier-adjusted, matches what DSDP publishes) plus
raw digitized components (`dsdp_individuals`/`dsdp_tents`/`dsdp_vehicles`); B's
press-collected totals remain under the separate `dsdp_reported_total` metric so the two
series never collide under one name. `mart_monthly_block` carries H's `dsdp_units_total`
on census-block-mapped rows only.

## Outputs

1. **`commons.duckdb`** — every staging table plus the four marts, queryable directly.
2. **`marts/`** — flat exports, split into two tiers:
   - **Public tier**: `monthly_by_neighborhood.csv` — month x downtown neighborhood x
     metric, long format. No block IDs, coordinates, or free-text fields. Safe to
     publish/share as-is.
   - **Internal tier**: `monthly_by_block.csv`, `daily_downtown.csv` — same shape but
     at census-block or daily grain. Block-level resolution is deliberately *not*
     public: combined with public block-boundary data it could narrow down specific
     encampment locations. Treat these two files as internal-use-only.
   - `blocks.geojson` — census block polygons (from source A) used for the block grid;
     ships alongside the internal-tier files since it's what makes `geo_block` joinable
     to a map.
3. **`DATA_DICTIONARY.md`** — auto-generated every run: every table, column, grain,
   source URL, refresh cadence, `measures`, `known_bias`.
4. **`QA_REPORT.md`** — auto-generated every run: row counts and load status per
   source, date coverage, null/geocode failure rates, dedupe stats, and three
   correlation checks (311 vs DSDP/H observed totals, 311 vs block-level counts,
   citations vs both) with plain-language interpretations — or an honest
   insufficient-data line where a series doesn't overlap enough to correlate.
5. **`refresh.py`** — the incremental-refresh entrypoint described above.

No client-level or personally identifying data appears anywhere in the database or
exports. 311/citation free-text description and street-address fields are dropped at
load time in the staging loaders (`commons/staging/src_c.py`, `src_d.py`) — never
selected into any table, staging or mart.

## seeds/

Hand-maintained inputs the loaders read when a source can't be fully automated. Each
is a small CSV with a `source_url` column per row so every number is traceable.

- **`gid_service_map.csv`** — maps raw 311 `(case_record_type, service_name,
  service_name_detail)` triples to a canonical homelessness category and an
  `include` flag. 311 renames its service categories over the years; when the city
  adds/renames a category, add a row here (or flip `include` to `true`/`false`) —
  `src_c.load` re-reads this file on every run, no code change needed.
- **`violation_codes.csv`** — maps parking-citation `vio_code` values to a
  `code_category` (oversize_vehicle / 72hr / habitation-adjacent) with an
  interpretation and fine-schedule note. Update when the city adds a new relevant
  code or changes the fine schedule; `src_d.load_citations` re-reads it every run.
- **`dsdp_manual.csv`** — fallback/gap-fill for source B (DSDP monthly totals) for
  months not covered by the hackathon bundle (source H) and not parseable from PDF.
  Currently header-only (status `stubbed`) since H covers 2017-2025; add rows
  `(obs_month, neighborhood, total, source_url, note)` only for months genuinely
  missing from H that you can verify against a primary source (DSDP report, press
  coverage).
- **`capacity_manual.csv`** — shelter bed roster and occupancy figures hand-transcribed
  from City/SDHC PDFs and pages that resist automated parsing. Add a row per
  program/site/month as new roster pages are published; include the source URL and
  the exact quoted figure in `note` so it can be re-verified later.
- **`pit_annual.csv`** — annual HUD Point-in-Time sheltered/unsheltered totals by
  geography, hand-built from RTFH/HUD published tables. Add a row when a new year's
  PIT count is published; verify against the HUD CoC dataset linked in `source_url`.
- **`events.csv`** — hand-curated policy/shelter/sweep timeline (camping ban, shelter
  openings/closures, litigation milestones) used as context annotations, not joined
  into marts. Add a row with `event_date, event_type, title, description,
  date_certainty, source_url` when a new dated event is worth flagging; use
  `date_certainty=verify` if the date isn't nailed down yet.

## Known limitations

- **Citations are not geocoded.** Source D's parking-citation files carry no
  lat/lng (only a text `location` and `sector1`); `geo_block`/`h3_r8`/`neighborhood`
  are NULL for every `stg_citations` row and citation correlations in QA_REPORT are
  necessarily citywide-volume, not spatial.
- **DSDP totals are not comparable across their own multiplier boundary.** Source H's
  `dsdp_adjusted_total` (and legacy source B `dsdp_reported_total`) are
  occupancy-multiplier-adjusted (tents x1.75-2.00, vehicles x1.66-2.03); source A's
  raw counted units and H's own digitized components
  (`dsdp_individuals`/`dsdp_tents`/`dsdp_vehicles`) are not. Never sum adjusted totals
  with raw component counts, and never compare H's adjusted totals directly against
  A's raw counts or against post-2020 RTFH/PIT raw figures without noting the
  adjusted-vs-raw mismatch.
- **Source A has 3 imputed months** (Aug/Sep 2014, Jun 2015) flagged `is_imputed=true`
  in `stg_a_observations`/`mart_monthly_neighborhood` — these are not directly
  observed counts and should be visually distinguished or excluded in any trend line
  that cares about that distinction.
- **311 homelessness categories effectively start 2018-08.** Earlier `stg_gid_requests`
  rows exist (data goes back to 2016) but the relevant service categories were
  introduced/renamed later, so pre-2018-08 311 volume is sparse/non-comparable and QA
  correlations against 311 are windowed to 2018-08+.
- **Source H has 4 unreported 2025 months** (Jul/Aug/Oct/Nov) — true reporting gaps
  in the provider's own data, not a pipeline failure; those months are simply absent
  from `stg_h_monthly`, not zero-filled.
