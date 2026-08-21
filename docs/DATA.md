# The data behind Parsel — a full account

_All counts below are from the committed build (`QA_REPORT.md`, generated 2026-08-20/21). Every table in the Commons carries a plain-language `measures` and `known_bias`; this document is the narrative version._

## 1. The principle

Homelessness data in San Diego is fragmented across agencies that each measure something different: one counts people on sweep mornings, one counts resident complaints, one counts citations, one counts shelter beds. None of them is a census. The Commons joins them onto **one spatial grid and one time index** and then refuses to pretend they are the same thing:

- **Observation** data is counted units (people, tents, vehicles).
- **Complaint** data (311) is *reports* — one encampment can generate dozens.
- **Enforcement** data is *activity* — it follows policy cycles, not need.
- **Capacity** is beds; **Context** is weather, rents, and policy events.

Every number that reaches a chart or a plan keeps its label. 311 is never a headcount; DSDP's published totals are flagged as multiplier-adjusted; enforcement is never read as demand.

## 2. What was provided vs. what we added

**Provided by the hackathon (one bundle → Source H):** the Data Science Alliance's curated extract of the Downtown San Diego Partnership (DSDP) Clean & Safe monthly *Unsheltered Sleep Count* reports — `DowntownCounts_Monthly.csv`, `BlockLevel_Counts.csv` (+ the balanced 261-block panel), `Downtown_BlockGrid.csv/.geojson`, `Area_Crosswalk.csv`, `Methodology_Periods.csv`, plus a data dictionary, methodology change log, and resources overview. Committed verbatim at `data/hackathon/` with provenance in `docs/hackathon/PROVENANCE.md`.

**Added by us (nine sources), fetched live from their publishers with a caching, conditional-GET pipeline:**

| ID | Source | Publisher | Layer |
|---|---|---|---|
| A | Downtown block-level counts 2014–2018 (+ monthly totals to 2012) | sandiegodata.org / metatab | Observation |
| C | Get It Done 311 requests | City of San Diego open data | Complaint |
| D | 72-hour violation reports + parking citations | City of San Diego open data | Enforcement |
| F | Point-in-Time counts | RTFH / HUD CoC CA-601 | Observation (citywide anchor) |
| E | Shelter roster + occupancy | SDHC | Capacity |
| G | NOAA GHCN-Daily (Lindbergh Field) | NCEI | Context |
| G | Zillow Observed Rent Index, zip level | Zillow Research | Context |
| G | Policy events (camping ban, injunctions, shelter openings) | Council records, court orders, press | Context |
| B | DSDP monthly PDF loader | downtownsandiego.org | Observation (stub — H covers it) |

**Added by the team (two more):** **I** — USDA Food Access Research Atlas, La Jolla tracts (food-insecurity context); **J** — City parking-meter transactions (downtown activity proxy).

One nuance worth stating before a judge asks: Source A and Source H both *originate* from the same DSDP counting program. They are different extracts — A is the older point-level release (one row per counted unit, raw, on 2010 census blocks, with monthly totals back to 2012, which H's own notes say it excludes); H is the providers' curated 2017–2025 release (published, multiplier-adjusted totals; block sweeps on their own 382-block grid). We used the overlap as a check: A's 2018–19 neighborhood totals equal H's adjusted totals to the unit, which is how we learned A's *aggregates* are adjusted even though its point rows are raw.

## 3. Source by source

### A — Downtown block-level counts (observation, ground truth 2014–18)
- **Rows:** 41,166 counted units, 2014-01 → 2018-02, one row per person / structure / vehicle with a WKT point and a 2010 census-block geoid; 287 block polygons; monthly totals 2012-01 → 2019-04 (88 months); neighborhood totals 2018-01 → 2019-04.
- **Grain kept:** the count *date* (sweeps are not month-starts); month derived.
- **Known bias:** single pre-dawn sweep per month; 3 imputed months (Aug/Sep 2014, Jun 2015 — 1,964 rows flagged `is_imputed`); the point rows carry **no occupancy multipliers**, but the pre-aggregated totals are DSDP-published and adjusted from April 2017.
- **Role:** the raw-unit series, the census-block grid everything joins to, and the pre-2017 history.

### H — Hackathon DSDP bundle (observation, current anchor 2017–25)
- **Rows:** 2,880 monthly rows (2017-01 → 2025-12; date × area × component), 3,737 block-sweep rows (12 count dates, 2018-01 → 2025-01), 382 grid blocks (polygons validated non-overlapping), 4 methodology periods, 24 crosswalk rows.
- **Known bias (from the providers, carried verbatim):** `total` is the published, multiplier-adjusted figure — tents ×2.00→1.75, vehicles ×2.00→1.66→2.03 — never to be summed with components; the individual/tent/vehicle components are digitized from map images (secondary reliability, 2018+); block footprint grew 261 → 382 in Jan 2022 (roughly half the apparent 2021→23 surge is footprint); counting effort varied (Downtown Fellowship months, 10/12 in 2017 → 0 after 2020); four 2025 months unpublished (140 `not_reported` rows); "East Village" in the monthly file is not the block-grid "East Village".
- **Harmonization:** each grid block's representative point is assigned to the containing census block — 260 of 382 bridge; the rest (Barrio Logan, Golden Hill, Sherman Heights) lie outside the 287-block downtown footprint and stay unmapped by design.
- **Role:** the target series of the Outlook forecast and the camping-ban analysis; block-level validation for 311.

### C — Get It Done 311 (complaint)
- **Rows:** 329,515 homelessness-category requests, 2018-08 → 2026-08 (annual closed files + the open file, refreshed daily); categories mapped across renames via `seeds/gid_service_map.csv` (encampment, outreach_request; built from the enumerated real values, shopping-cart and "Other" excluded with rationale).
- **Quality:** 1.0 % missing coordinates; 31.6 % are child duplicates of an open parent (flagged, excluded from marts); 27.8 % fall inside downtown blocks (the rest are citywide — expected).
- **Privacy:** `public_description` and `street_address` are never read into memory.
- **Known bias:** the Encampment category did not exist before Aug 2018 — no 311 comparison is possible for the 2014–18 archive; reporting propensity varies by neighborhood and app adoption; one encampment → many reports. **Never a headcount.**

### D — Enforcement: 72-hour violations + coded citations
- **Rows:** 334,073 72-hour vehicle reports (2017-03 → 2026-08, geocoded) and 78,158 citations (2014-01 → 2026-07) under 15 real violation codes in three families — oversize vehicle, 72-hour, habitation-adjacent — each with an interpretation and the city's fine-schedule PDF as source (`seeds/violation_codes.csv`; unverified code-lineage claims are hedged).
- **Known bias:** complaint-driven and patrol-driven; citations have **no coordinates** (citywide analysis only); the vehicle-habitation code 86.0137(F) disappears after 2018 — matching the Aug-2018 federal injunction in our events seed.

### F — Point-in-Time counts
- **Rows:** 9 years (2016–2020, 2022–2025; 2021 had no unsheltered count), region geography, every value read this session from HUD CA-601 or RTFH PDFs with per-row URLs.
- **Known bias:** one night per year; from 2020 RTFH reports raw counts while DSDP keeps multipliers — PIT and DSDP are not comparable after 2020.

### E — Shelter capacity
- **Rows:** 23 — 14 site-roster rows (beds, as of the fetch month) and 9 program-month occupancy rows (Apr–Jun 2026), discriminated by `record_type`. Thin and labeled as such.

### G — Context
- **Weather:** 5,342 days, 2012-01 → 2026-08, TMAX/TMIN/PRCP at Lindbergh Field (single coastal station).
- **Rents:** 3,507 zip-months, 33 City of San Diego zips, 2015-01 → 2026-07 (asking rents, smoothed).
- **Events:** 9 dated rows with sources and a `date_certainty` flag — including the Unsafe Camping Ordinance (adopted 2023-06-13, enforcement from 2023-07-31), the 2018-08-21 vehicle-habitation injunction (sourced to the court order PDF), shelter openings/closures, and the VHO re-training; three dates flagged `verify`.

### I and J (team)
- **I — USDA FARA, La Jolla:** tract-level low-access population, low-income-and-low-access, LILA flag, SNAP households; vintages 2010/2015/2019. Distance-based definition, periodic snapshots, not comparable to the downtown signals — area food-insecurity context only.
- **J — Parking-meter transactions:** daily paid sessions and revenue per meter mapped to the six neighborhoods. An activity/visitation proxy — explicitly *not* foot traffic or people.

## 4. Harmonization

- **Space:** every point fact gets `geo_block` (2010 census block via polygon containment), `h3_r8`, `neighborhood` (canonical six: east_village, city_center, columbia, marina, cortez, gaslamp — the pre-2019 "core" label normalized), and `zip`. The hackathon grid is bridged to census blocks as above.
- **Time:** native grain in staging; marts at monthly (everything) and daily (downtown complaint/enforcement); months stored as first-of-month dates.
- **Layers:** every mart row is tagged `signal_type ∈ {observation, complaint, enforcement, capacity, context}` and `source_id`, so a consumer can always trace a number to its lineage and bias notes.
- **Exports:** `marts/monthly_by_neighborhood.csv` is the **public tier** — neighborhood grain only, no block IDs, coordinates, or free text; block and daily files are internal; `blocks.geojson` carries only public census attributes.

## 5. Does the data agree with itself? (validation, from `QA_REPORT.md`)

| Comparison | r | n | Reading |
|---|---|---|---|
| 311 downtown volume vs DSDP observed totals, monthly | **0.39** | 85 | Complaints track the street population loosely — a volume correlation, not a people count |
| 311 vs DSDP block-level units, census-block-month (2019–25) | **0.23** | 1,061 | Weak at block grain: complaints locate hotspots poorly; counted people exist on blocks with zero reports |
| Coded citations vs downtown observed, monthly | 0.32 | 64 | Citywide enforcement volume vs downtown counts; observed series switches basis in 2017-04 |
| Coded citations vs 311, monthly | **−0.49** | 96 | Enforcement moves *opposite* to complaints — it tracks policy cycles, not need |
| 311 vs 2014–18 block counts | — | 0 | No temporal overlap (311 category begins 2018-08); reported honestly as insufficient |

## 6. What the data is used for

- **Outlook forecast** (`ml/outlook_forecast.py`): pooled Ridge, direct 1–12-month horizons on H's published series; rolling-origin backtest vs seasonal-naive and last-value; 80 % bands from the backtest's own residuals. Downtown ≈ 886 units by Dec 2026 (525–1,174); beats seasonal-naive at every horizon, beats persistence only from month 4.
- **Camping-ban interrupted time series** (`ml/outlook_its.py`): segmented regression with HAC errors and a pre-period placebo. Counted units ran ~40 % below the pre-ban trend immediately after enforcement (−421, p<0.001; placebo n.s.; stable across five pre-window choices); 311 reports ran ~55 % above trend (+303, p=0.018), then decayed. *Associated with*, not caused by.
- **Hotspot model** (team): stacked ensemble on the block panels → six movable delivery hotspots, updated live by field observations (Gamma-Poisson).
- **The product:** the Forecast & Plan grid turns the forecast into meals, volunteer-hours, and runs per neighborhood-week with operator parameters and logged overrides; the evidence chips (historical prior / field-verified / stale / overridden) carry the lineage all the way to the operator's screen.

## 7. Honesty ledger — the things we would say before a judge asks

1. Counts are DSDP-basis units (adjusted after Apr 2017), not people in need.
2. 311 and enforcement are activity signals; we never allocate on them.
3. HAC 95 % confidence intervals read as roughly 85–90 % in ~60-month samples.
4. Summed neighborhood bands are wider than a true downtown interval.
5. Shelter capacity is thin; DSDP 2025 has four unpublished months; the block footprint changed in 2022.
6. Everything above is regenerated by `python run.py` from cached raw downloads; `refresh.py` updates only the auto-refreshing layers.
