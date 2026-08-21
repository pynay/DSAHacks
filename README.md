<p align="center">
  <img src="public/parsel-logo.png" alt="Parsel" width="340" />
</p>

<p align="center"><b>Data-driven food relief for downtown San Diego.</b><br/>
Built at the 2026 DSA hackathon.</p>

---

Parsel is a food-bank operations console that decides **where food should go** using real
San Diego homelessness data, and shows **how to get it there** on a 3D delivery map. It is
two connected projects in one repo:

| Part | What it is | Where it lives |
|---|---|---|
| **Parsel console** | Next.js web app: inventory, donations, distributions, a Mapbox 3D delivery map, and a need-based allocation recommender | `src/`, `public/` |
| **Need forecasting (ML)** | scikit-learn model that forecasts monthly 311 need-pressure per neighborhood 3 months ahead, backtested against naive baselines; feeds the console's predictive allocation | `ml/`, outputs in `marts/forecast_*` |
| **SD Homelessness Data Commons** | Python/DuckDB pipeline fusing eight SD homelessness signal sources into analysis-ready marts (documented in its own section below) | `commons/`, `data/`, `marts/`, `seeds/`, `tests/`, `run.py`, `refresh.py` |

The console reads the commons' exported marts directly — the pipeline does not need to be
run to use the app, because `marts/monthly_by_neighborhood.csv` and `marts/blocks.geojson`
are committed.

## The Parsel console

Six screens (left sidebar). App state (inventory, donations, distributions) is held
in-memory by a single React context provider and is seeded with demo data — it survives
sidebar navigation but resets on a full page reload. Delivery-zone data is real (see below).

| Screen | What it does |
|---|---|
| **Dashboard** | KPI cards (total stock, SKUs, low stock, expiring, weekly donation/distribution counts), inventory-by-category bar chart, 6-week intake-vs-outflow trend, stock-status breakdown, recent-activity feed |
| **Inventory** | 20 seeded items; search + category/status filters, inline quantity +/-, add-item modal. Status is **derived, never stored**: `Out` (qty 0) → `Low` (≤ reorder threshold) → `Expiring` (≤ 14 days) → `OK` |
| **Donations** | Log incoming donations; matching inventory increases automatically (case-insensitive name+category match; unknown items are added to stock) |
| **Distributions** | Record outgoing food; inventory decreases automatically (floored at zero) |
| **Delivery** | Mapbox GL 3D map of downtown SD (terrain + building extrusions): need-weighted drop zones from the data commons, a depot marker, straight-line spokes, click-to-add custom drops, per-zone popups (need / 311 requests / distance / elevation) |
| **Allocation** | Splits current stock across zones proportionally to need; one click stages the plan as real distribution records (decrementing inventory). Includes the need-forecast chart, a model card, and a **predictive mode** that re-splits demand by predicted next-month 311 shares |

### How the delivery zones are computed

`GET /api/zones` (server route, cached per server process) derives zones from the commons
marts at request time:

1. **Need signals** — DuckDB (`@duckdb/node-api`) runs SQL over
   `marts/monthly_by_neighborhood.csv` (`read_csv_auto` + a `ROW_NUMBER()` window) to get
   the **latest** value per neighborhood for four metrics:
   `dsdp_individuals` (the "need" score), `gid_requests` (311 reports),
   `observed_individuals`, `violations_72hr_reports`.
2. **Geometry** — each of the 6 downtown neighborhoods (East Village, City Center, Cortez,
   Gaslamp, Columbia, Marina) is placed at the average-vertex centroid of its census-block
   polygons from `marts/blocks.geojson` (287 blocks).
3. **Elevation** — ground elevation per zone from the USGS EPQS API (1 m resolution), with
   Open-Meteo as fallback. `GET /api/elevation?lng=&lat=` serves the same lookup for
   custom map drops.

**Read the commons caveats before citing numbers:** the need signals are *proxies with
known biases, not a census* (see the Data Commons section below). `dsdp_individuals` is a
digitized count of secondary reliability; Parsel uses it as a relative weighting between
neighborhoods, not as a headcount claim.

### How allocation works

Deterministic and explainable (`src/lib/allocation.ts`, unit-tested):

1. Zone demand = `need × units/person` (units/person is adjustable in the UI, default 3).
2. Items ship **soonest-expiring first** (FEFO), so perishables move before they are lost.
3. Each item's quantity is split across zones **proportionally to remaining demand**, with
   largest-remainder rounding — every unit lands somewhere, no zone exceeds its demand.
4. Allocation stops when demand is met or stock runs out.

"Stage distributions" converts the plan into one mobile-pantry distribution record per
zone via the same provider action the Distributions screen uses, so inventory, the
dashboard, and the activity feed all update immediately.

### Need forecasting (`ml/forecast.py`)

Forecasts monthly 311 homelessness-related request volume (`gid_requests`) per
neighborhood, 3 months ahead. **This is aggregate demand forecasting for aid
pre-positioning — the commons holds no individual-level data, and nothing here predicts
or tracks people.**

- **Model:** one pooled Ridge regression (regularized linear AR) across all
  neighborhoods — lags 1/2/3/12, 3-month rolling mean, month-of-year seasonality,
  neighborhood one-hots. ~500 neighborhood-month training rows (2019-08 → 2026-08;
  missing 311 months zero-filled, since absence of requests in an auto-updating count
  feed means zero).
- **Evaluation:** rolling-origin backtest over the last 12 months (72 one-step
  predictions): model MAE **20.55** vs last-month naive **20.81** and seasonal naive
  **33.01**. Model selection used the same backtest — a gradient-boosting variant
  overfit badly (MAE 34.7) and was rejected. All numbers live in
  `marts/forecast_meta.json` and are shown in the in-app model card.
- **Outputs:** `marts/forecast_monthly.csv` (metric `gid_requests_forecast`) +
  `marts/forecast_meta.json`, committed like the other marts, so the app needs no
  Python at runtime. The console reads them via DuckDB (`/api/forecast`).
- **Predictive allocation:** the Allocation screen's "Predicted" mode keeps total
  demand unchanged but re-splits it across zones by predicted next-month 311 shares
  (largest-remainder rounding, exact-total preserving).

Re-run after refreshing the commons:

```bash
python3 -m pip install -r ml/requirements.txt
python3 ml/forecast.py    # deterministic; rewrites marts/forecast_*
```

### Running the console

Requires Node 20.9+ (developed on Node 25) and a free
[Mapbox public token](https://account.mapbox.com/access-tokens/) for the map.

```bash
npm install
cp .env.example .env.local   # then paste your Mapbox token into .env.local
npm run dev                  # http://localhost:3000  (use `npm run dev -- -p 3007` if 3000 is taken)
npm test                     # 26 unit tests (inventory logic, dashboard aggregations, allocation)
npm run build                # production build / type-check
```

Without `NEXT_PUBLIC_MAPBOX_TOKEN` the app runs fine; the Delivery map area shows a
set-your-token message instead of the map.

`next.config.ts` marks `@duckdb/node-api` as a server-external package (it ships native
bindings and must not be bundled).

### Honest limitations

- App state is in-memory demo state; a hard refresh resets inventory/donations/
  distributions to seeds. All inventory/donation/distribution access goes through one
  provider (`src/context/InventoryProvider.tsx`), so swapping in a real backend for app
  state touches one file (zones already come from a server API).
- Delivery spokes are straight lines (haversine distances), not routed flight paths, and
  there is no visit-order optimization yet.
- The depot is a fixed demo staging point on the waterfront edge of Little Italy, not the
  real Jacobs & Cushman San Diego Food Bank warehouse (which is in Miramar).
- Need values are as fresh as the committed marts (e.g. `dsdp_individuals` runs through
  Dec 2025; 311 requests through Aug 2026). Re-run the pipeline to refresh them.

### Console tech

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Recharts 3 ·
mapbox-gl 3 · @duckdb/node-api 1.5 · lucide-react · Vitest 4 · scikit-learn 1.8 (ml/)

---

# SD Homelessness Data Commons

Reproducible pipeline fusing eight San Diego homelessness signal sources into one
DuckDB database, plus exported marts. Built for the 2026-08-20 DSA hackathon.

**Core principle: this is a dataset of signals with known biases, not a census.**
Nothing here counts people directly except source A (2014-2018 street counts) and
source F (annual PIT) — source H's digitized components (`dsdp_individuals`/
`dsdp_tents`/`dsdp_vehicles`) are also counted units, but at secondary reliability
(digitized from map images, not a primary field count like A or F). Everything else —
311 complaints, citations, shelter beds, weather, rent — is a *proxy* that correlates
with homelessness pressure but must never be reported as a headcount. Every table
carries `measures` and `known_bias` text in `DATA_DICTIONARY.md`; read it before
citing a number.

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
raw digitized components (`dsdp_individuals`/`dsdp_tents`/`dsdp_vehicles`); source A's
own DSDP-published neighborhood totals (`stg_a_neighborhood_totals`, 96 rows) and B's
press-collected totals both land under the same `dsdp_reported_total` metric name -
tagged `source_id='A'` and `source_id='B'` respectively - so they do *not* collide as
values, but they do share one metric name. B's seed is currently stubbed (no rows), but
if it's ever filled in, consumers reading `dsdp_reported_total` must group/filter by
`source_id` to keep the two series apart. `mart_monthly_block` carries H's
`dsdp_units_total` on census-block-mapped rows only.

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
exports. 311's free-text `public_description` and `street_address` fields are dropped
at load time in `commons/staging/src_c.py` — never selected into any table, staging or
mart. Citations are different: `stg_citations` retains `location_text`, the city's
published citation location string (street/block text, no personal data), for internal
staging use only — it is never selected into a mart or export (public and internal-tier
CSVs both exclude it; see `test_exports_public_tier`).

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
  `dsdp_adjusted_total`, and source A's own pre-aggregated `dsdp_reported_total`
  (`stg_a_monthly_totals`/`stg_a_neighborhood_totals`), are DSDP-published figures that
  are occupancy-multiplier-adjusted (tents x1.75-2.00, vehicles x1.66-2.03) from the
  Apr 2017 methodology change onward — they match each other exactly in their
  2017-2019 overlap. Only source A's *point-level* table (`stg_a_observations`, metric
  `observed_total_units`/`observed_individuals`/etc.) and H's own digitized components
  (`dsdp_individuals`/`dsdp_tents`/`dsdp_vehicles`) are raw, unadjusted counted units.
  Never sum adjusted totals with raw component counts, and never compare an adjusted
  total (H's or A's `dsdp_reported_total`) directly against A's raw point counts or
  against post-2020 RTFH/PIT raw figures without noting the adjusted-vs-raw mismatch.
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

---

## Repo conventions

- The web app and the pipeline share this repo but have independent toolchains
  (`package.json` / `requirements.txt`) and test suites (`npm test` / `python -m pytest`).
- `docs/superpowers/` holds the design specs and implementation plans both parts were
  built from.
- `AGENTS.md` / `CLAUDE.md` are auto-generated by Next.js tooling.
