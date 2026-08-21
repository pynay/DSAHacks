# Spec: "Ground Truth" San Diego Homelessness Data Commons

## Mission

Produce a single DuckDB database (`commons.duckdb`) plus exported CSV/GeoJSON marts, built by
an idempotent pipeline (`python run.py` rebuilds everything from raw downloads). The dataset
joins five kinds of signal about homelessness onto a shared spatial grid and time index:

1. **Observation** — people/tents/vehicles actually counted
2. **Complaint** — 311 reports from residents
3. **Enforcement** — citations and abatement activity
4. **Capacity** — shelter beds available/occupied
5. **Context** — weather, rents, policy events

**Core design principle:** this is a dataset of *signals with known biases*, not a census.
Every table carries lineage metadata and a plain-language `measures` and `known_bias`
description. Never present complaint or enforcement data as counts of people.

## Data sources (verified live 2026-08-20)

### A. Downtown block-level monthly counts, 2014–mid-2018 (observation, ground truth)

- Page: https://data.sandiegodata.org/dataset/sandiegodata-org-dowtown-homeless/
- Files (verified live):
  - `http://library.metatab.org/sandiegodata.org-dowtown_homeless-2.1.1/data/homeless_counts.csv`
    — one row per observed entity: `neighborhood,date,type,temp,rain,geoid,x,y,geometry`
    (WKT POINT, lon/lat); `type` ∈ {individual, structure, vehicle}; dates 2014-01→2018-02
    (actual count dates, not month starts)
  - `.../imputed_counts.csv` — same schema, includes 3 imputed months
  - `.../monthly_totals.csv` — `date,count`; 2012-01→2019-04
  - `.../neighborhood_totals.csv` — wide: `date,east_village,city_center,columbia,marina,cortez,gaslamp`; 2018-01→2019-04
  - `.../downtown_blocks.csv` — 2010 census block attrs + WKT POLYGON `geometry`, key `geoid10`
- Gotchas: 3 imputed months (Aug/Sep 2014, Jun 2015) — flag them. Methodology changed April
  2017 (occupancy multipliers for tents/vehicles); this dataset does NOT apply multipliers —
  keep it that way and note it.

### B. Downtown Partnership monthly report totals, ~2018–present (observation, current anchor)

- Monthly reports published by the Downtown San Diego Partnership (downtownsandiego.org;
  some months covered via press/Inside San Diego). PDFs with monthly unsheltered totals,
  sometimes by neighborhood.
- Parse tables with pdfplumber into `stg_dsdp_monthly (month, neighborhood, total, source_url)`.
  If bulk PDFs are unavailable, stub the loader and populate from manually collected numbers
  in `seeds/dsdp_manual.csv` — keep the schema identical.

### C. Get It Done 311 (complaint)

- Page: https://data.sandiego.gov/datasets/get-it-done-311/
- Files (verified live): `https://seshat.datasd.org/get_it_done_reports/get_it_done_requests_closed_{YYYY}_datasd.csv`
  for 2016..2026, plus `get_it_done_requests_open_datasd.csv` and
  `get_it_done_requests_dictionary_datasd.csv`.
- 23 columns incl. `service_request_id, service_request_parent_id, date_requested,
  case_record_type, service_name, service_name_detail, date_closed, status, lat, lng,
  zipcode, comm_plan_name, case_origin, public_description`.
- Filter to homelessness-related service names (encampment, homeless outreach, etc. —
  inspect actual category values; renamed over the years; build a mapping table
  `seeds/gid_service_map.csv`). Keep request date, close date, status, lat/lng, service name.
  Drop `public_description` and `street_address` (PII risk).

### D. Enforcement (proxy for vehicle dwelling + enforcement pressure)

- 72-hour violations (verified live):
  `https://seshat.datasd.org/get_it_done_parking_violations/get_it_done_72_hour_violation_requests_datasd.csv`
  — same 23-column GID schema, has lat/lng.
- Parking citations (verified live):
  `https://seshat.datasd.org/parking_citations/parking_citations_{YYYY}_part{1,2}_datasd.csv`
  — `citation_id,date_issue,date_creation,location,sector1,vio_code,vio_desc,vio_fine`.
  **No lat/lng** — geo columns stay NULL for citations; correlations are citywide volume.
- Filter citations to oversize-vehicle, 72-hour, and habitation-adjacent violation codes via
  explicit `seeds/violation_codes.csv` mapping with interpretation of each code; cite the
  city's fine-schedule PDF.

### E. Shelter capacity (capacity)

- https://www.sandiego.gov/homelessness-strategies-and-solutions/data-reports and SDHC
  at-a-glance PDFs (sdhc.org). Parse what is parseable into
  `stg_capacity_monthly (month, program, site, beds, occupancy_pct)`; stub + manual seed CSV
  (`seeds/capacity_manual.csv`) where PDFs resist parsing.

### F. Annual PIT counts (observation, citywide anchor)

- RTFH (rtfhsd.org) totals by year. Hand-built `seeds/pit_annual.csv`
  (year, geography, sheltered, unsheltered, source_url), values verified against live pages.

### G. Context

- Weather: NOAA GHCN-Daily, station USW00023188 (San Diego Intl Airport) via NCEI Data
  Service API — daily TMAX/TMIN/PRCP.
- Rents: Zillow ZORI zip-level CSV (zillow.com/research/data) filtered to San Diego zips.
- Events: hand-built `seeds/events.csv` — camping ban (enacted June 2023, effective July
  2023), major shelter openings/closures, sweeps milestones. Source URL per row; mark
  uncertain dates for human verification.

## Harmonization

- Spatial grid: downtown = 2010 census blocks (source A geometry) + neighborhood rollup;
  citywide = H3 resolution 8 plus zip. Every fact table gets `geo_block` (nullable),
  `h3_r8`, `neighborhood`, `zip`.
- Time index: native grain preserved in staging; marts at daily (downtown
  complaint/enforcement) and monthly (everything).
- Layer tags: every mart row tagged `signal_type` ∈
  {observation, complaint, enforcement, capacity, context}.

## Outputs

1. `commons.duckdb` — staging + marts.
2. `marts/` exports: `monthly_by_neighborhood.csv` (public tier), `monthly_by_block.csv` and
   `daily_downtown.csv` (internal tier — block resolution deliberately NOT public),
   `blocks.geojson`.
3. `DATA_DICTIONARY.md` — auto-generated: every table, column, grain, source URL, refresh
   cadence, `measures`, `known_bias`.
4. `QA_REPORT.md` — auto-generated per run: row counts, date coverage per source,
   null/geocode failure rates, dedupe stats, and validation: monthly correlation of
   (i) 311 homelessness volume vs DSDP observed totals (downtown, overlapping months),
   (ii) 311 vs 2014–18 block counts at block-month grain, (iii) citation volume vs both.
   Print r values and a one-line honest interpretation.
5. `refresh.py` — pulls only sources C and D incrementally.

## Engineering requirements

- Python 3.11+, duckdb, pandas/pyarrow, pdfplumber, h3, requests, shapely.
  `requirements.txt` + README with exact run instructions.
- Raw downloads cached to `raw/` with timestamps; never re-download unchanged files
  (conditional GET via ETag/Last-Modified); every transform rerunnable.
- Fail soft: if any single source is unreachable, build everything else and record the gap
  in QA_REPORT. Priority order if time-constrained: C → A → D → B → F → E → G.
- No client-level or personally identifying data anywhere. Public-tier exports are
  neighborhood grain only.
- Commit early and often with clear messages (hackathon fresh-code audit trail).
