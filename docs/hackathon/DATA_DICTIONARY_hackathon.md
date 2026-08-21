# SD Downtown Homelessness - Hackathon Data Dictionary (exported from Drive gdoc)

All files are UTF-8 CSV with a header row, except Downtown_BlockGrid.geojson. Dates are ISO YYYY-MM-DD. Missing values are empty fields.

## DowntownCounts_Monthly.csv — 2,880 rows

One row per **date x area x component**. Long format.

| Column | Type | Description | Valid values |
|---|---|---|---|
| date | date | First day of the count month | 2017-01-01 … 2025-12-01 |
| year | int | Count year | 2017–2025 |
| month_num | int | Month number | 1–12 |
| month | string | 3-letter month | Jan … Dec |
| area | string | **Canonical area name — join on this** | 12 values (see below) |
| area_source_label | string | Original label as published | 13 values |
| area_type | string | Level in hierarchy | neighborhood, ev_subarea, supplemental |
| parent_area | string | Parent for sub-areas | East Village or empty |
| component | string | What is counted | total, individual, tent, vehicle |
| count | float | The count. **Nullable** | >= 0; max 921 |
| method | string | Methodology period in force | PRE2017, APR2017, MAY2018, POST2020 |
| tent_multiplier | float | Persons assumed per tent that month | 2.00, 1.75 |
| vehicle_multiplier | float | Persons per vehicle | 2.00, 1.66, 2.03 |
| fellowship_month | bool | Downtown Fellowship co-ran the count | True/False |
| flag | string | Data-quality provenance | see below |

**area values** — East Village, City Center, Columbia, Cortez, Gaslamp, Marina, Outside Perimeter, East Village - North East/North West/South East/South West, Outreach Area (legacy).

**flag values**: (empty)=2,526 no known issue; not_reported=140 (no value published); component_total_mismatch=100 (25 area-months where components contradict verified total); added_2017_subarea=48; corrected_2019_subarea=48; added_2017_outreach=12; corrected_from_blocklevel=3; not_in_program=3 (Outside Perimeter Jan–Mar 2021).

### Component provenance — important

- **total is published** (verified cell-by-cell against source reports).
- **individual, tent, vehicle are NOT published** — digitized from block-map images; exist only 2018+; inherit map-legibility limits. Neighborhood components vs block-level sums agree exactly for 50 of 72 comparable area-months.
- **Treat total as the reliable series; components as secondary.**

### total vs components

total ≈ round(individual + tent_multiplier x tent + vehicle_multiplier x vehicle) — reconciles exactly for 508/541 (93.9%). **Never sum total with components** (double-counts). PRE2017 rows (Jan–Mar 2017, 18 rows) carry total only — exclude from component-level analysis.

### Missing data (140 not_reported rows)

- Jul/Aug/Oct/Nov 2025 (116 rows): **true reporting gap** — no report published.
- Components (not total) Nov 2018 (18 rows); components Sept 2021 City Center + Dec 2021 Marina (6 rows).

## BlockLevel_Counts.csv — 3,737 rows

One row per **block x count date**. Columns: block_id (joins Downtown_BlockGrid, 382 values, no orphans), neighborhood_source, area (canonical, matches Monthly.area), count_date (actual sweep date, 12 values), report_month (**join on this, not count_date** — sweep dated 2022-03-01 is the February 2022 count), individuals (0–64), tents_structures (Int64, 0–76, ONE null at 16TH_ST_C_ST 2020-01-31 — left NA, not zero), vehicles (0–5), in_panel_261 (bool).

**Zero-inflation:** 55.5% of rows all-zero; 116 of 382 blocks never non-zero. Real, not a defect.

## BlockLevel_Counts_Panel261.csv — 3,132 rows

Same schema minus in_panel_261. The 261 blocks present on ALL 12 count dates. **Use for any comparison across time.**

## Downtown_BlockGrid.geojson — 382 features

Polygon FeatureCollection, CRS84/EPSG:4326. Properties = BlockGrid CSV fields plus neighborhood (NOT canonical area — join CSV by block_id for area). Validated: 0 invalid/self-intersecting/unclosed/zero-area/duplicate/overlapping.

## Downtown_BlockGrid.csv — 382 rows

block_id (PK, st_east + _ + st_north; two __2 suffixes for name collisions), neighborhood_source, area (canonical), lon/lat (centroid; two centroids fall OUTSIDE their own polygon — use polygons for spatial joins), st_north/east/south/west (labels, not topology).

## Area_Crosswalk.csv — 24 rows

source_file, source_label, canonical_area, parent_area, level (neighborhood | ev_subarea | block_neighborhood | supplemental).

## Methodology_Periods.csv — 4 rows

method (joins Monthly.method), effective_from, effective_to (empty = current), individual_multiplier, tent_multiplier, vehicle_multiplier, note.

## Known issues

1. 25 area-months where components contradict the verified total (components are the suspect side — map-reading errors). Largest: East Village 2023-12 (−57), 2019-12 (−46); Gaslamp 2019-12 (−27), 2023-02 (+26); EV 2025-09 (+39).
2. Five months where EV sub-areas don't sum to EV total by >1 (published-source inconsistencies): 2017-10 (+30), 2018-02 (−30), 2023-03 (+8), 2023-06 (−2), 2025-09 (+38).
3. Rounding: summing rounded neighborhoods gives downtown total ±1 off published in 25 of 102 months.
4. Core → City Center rename (2019, retroactive). area canonicalized; area_source_label preserves original.
5. Two centroids outside own polygon (22ND_ST_SR-94_EB_ON_RA by 12m, 22ND_ST_BROADWAY by 7m). All 382 centroids fall in the correct neighborhood.
6. Bounding-street topology imperfect (6.6%/8.5% adjacent-pair disagreement) — labels, not topology.
7. Scope: neighborhood breakdowns begin 2017. Downtown-wide monthly totals 2012–2016 exist in source PDFs but are not in this bundle.
