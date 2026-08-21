# Parsel as operations software — design (approach "C": product now, server-shaped)

**Goal.** Turn Parsel's functional pages into a coherent operations tool for a food-bank
coordinator, where every "where / how much / who" decision is driven by an adaptable
forecast built on the Data Commons — and where the app learns from what operators do.

**Persona.** A food-bank operations coordinator planning daily/weekly distribution runs in
downtown San Diego (six neighborhoods). Single user on one machine for this window;
persistence across reloads; interfaces shaped so a server/multi-user backend is a follow-on.

## The operator loop

```
Intake → Stock → Plan → Verify → Allocate → Distribute → Learn
```

Everything below exists to make that loop real. The page map after this work:

| Route | Becomes | Job |
|---|---|---|
| `/dashboard` | **Today** | What needs attention, ranked; one forecast-vs-capacity KPI |
| `/donations` | Intake | Log donations with expiry → stock updates |
| `/inventory` | Stock | FEFO order, alerts, categories |
| `/signals` | **Forecast & Plan** | Zone × week resource plan from the forecast; adaptable parameters; overrides; evidence drawer |
| `/delivery` | Map | Zones + hotspots, reading the same plan |
| `/dispatch` | Verify | Field observation (drone/EyePop) → zone update (exists) |
| `/allocation` | Allocate | Gated FEFO → pick list + run sheet → staged distributions |
| `/distributions` | Distribute | Complete runs with outcomes (served, surplus, returns) |
| `/learn` (new) | Learn | Predicted vs served per zone; override scoring; stale flags |

## 1. Foundation (server-shaped plumbing)

**Store adapter.** `src/lib/store/` defines `WarehouseStore`:
```ts
interface WarehouseStore {
  inventory: { list(): Item[]; upsert(i: Item): void; adjust(id, delta, reason): void };
  donations: { list(): Donation[]; add(d: Donation): void };
  distributions: { list(): Distribution[]; add(d: Distribution): void; complete(id, outcome): void };
  plan: { getParams(): PlanParams; setParams(p): void; listOverrides(): Override[]; setOverride(o): void };
  ledger: { append(e: LedgerEvent): void; list(filter?): LedgerEvent[] };
  seed(demo: DemoDataset): void; reset(): void;
}
```
One implementation now: `localStorageStore` (namespaced keys, versioned schema, migration on version bump). The interface is the contract a later `serverStore` (fetch → API routes → Snowflake/SQLite) fulfils without page changes. Pages never touch `localStorage` directly.

**Event ledger.** Append-only `LedgerEvent { id, ts, type, zoneId?, refId?, actor: 'operator'|'model'|'field', payload, note? }` with types: `donation_logged, stock_adjusted, observation_applied, override_set, allocation_staged, distribution_completed, params_changed`. It is the audit trail and the Learn dataset.

**Demo data.** The simulation clock is removed. A "Load demo data" action seeds 8 weeks of realistic intake/distribution history, current stock, and two past field observations; "Reset" clears. Nothing ticks on its own.

## 2. Forecast & Plan (the centerpiece)

**Forecast engine** (`src/lib/plan/forecast.ts`, pure, unit-tested):
- Input: Outlook monthly forecast per neighborhood with lo/hi bands (`/api/outlook`), current zone estimates from the hotspot state (field-updated), operator params, overrides, horizon.
- Zone monthly need = forecast neighborhood count × `coverageShare` (params) — the share of people seen that the food bank plans to reach; current month anchored to the field-updated estimate when one exists, future months follow the model's month-over-month shape.
- Weekly spread: each month's need (and its band) is divided across its weeks; the band is carried, never narrowed. Documented as "monthly model, weekly cadence" in the UI.
- Resources per zone-week: `meals = need × mealsPerPerson × visitsPerWeek`, `volunteerHours = runs × hoursPerRun`, `runs = ceil(meals / vehicleCapacity)`. All ratios are params.
- Overrides: per zone, `{ factor | absolute, reason, setBy, ts, expires }` applied after the model; shown as a chip; logged.
- Output: `PlanGrid { weeks[], zones[], cells[zone][week] = { need, lo, hi, meals, hours, runs, evidence } , totals[week] }`.

**Operator parameters** (`PlanParams`, saved in the store, editable in a side panel): `mealsPerPerson`, `visitsPerWeek` (per zone, default 1), `hoursPerRun`, `vehicleCapacity`, `coverageShare`, `planTo: 'point' | 'upper80'`, `horizonWeeks: 4 | 8 | 12`. Changing any re-renders the grid instantly and logs `params_changed`.

**Page layout** (`/signals` → "Forecast & Plan"):
1. Header: horizon selector, "plan to" toggle, last model refresh, last field verification age.
2. **Plan grid**: rows = zones, columns = weeks; cell = need (range) + meals/hours/runs; column totals; row evidence chip (historical prior / field-verified N days / stale / overridden). Click a cell → detail with the formula and inputs.
3. **Weekly staffing summary**: for the selected week, total volunteer-hours, runs, meals; top-3 zones by share; a "copy to run plan" action that pre-fills Allocate.
4. **Evidence drawer** (collapsed per zone): Outlook chart with bands, ban-effect tiles, 311 reality check, backtest honesty line, QA correlations. The existing charts (PIT, La Jolla, indexed signals, scale-up) move to a secondary "Evidence" tab on the same route — nothing deleted.

**Evidence-chip vocabulary** (one component, used everywhere a zone appears):
`historical prior` (model only) · `field-verified · Nd` (observation applied N days ago) · `stale` (last verification older than `staleAfterDays`, default 14) · `overridden` (operator adjustment active). Chip colors are semantic and separate from the accent hue.

## 3. Today (dashboard)

Ranked attention list computed from the store + plan: expiring ≤7 days, stock below reorder, zones stale, staged allocations not yet distributed, overrides expiring. KPI strip: next-week forecast need vs planned capacity (from params), coverage %. Every item links to its action page.

## 4. Intake & Stock

Donations form gains per-item expiry; saving writes inventory deltas + `donation_logged`. Inventory table sorts FEFO by default, shows `Status` pills, filters by category, allows adjustments with a reason (`stock_adjusted`). No new entities.

## 5. Verify (dispatch) — minimal change

Applying an observation additionally writes `observation_applied` to the ledger with zone, count, confidence, source label (webcam / recorded / DJI Mini 4K via RTMP). The zone's evidence chip flips to `field-verified · 0d`.

## 6. Allocate → pick list → run sheet

Input = eligible zones (field-verified, per the existing gate) and the selected plan week. Output = the existing FEFO allocation rendered two ways: **pick list** (by item: quantity, location, expiry, split by zone) and **run sheet** (by zone: items, meals, hours, runs). "Stage run" marks allocated units `staged`, creates distribution drafts per zone, logs `allocation_staged`. Print/CSV export of both sheets.

## 7. Distribute

Completing a draft records `householdsServed`, `unitsDistributed`, `surplusReturned`, notes → stock adjusts (staged → out, surplus back), `distribution_completed` logged with the zone's predicted need at staging time attached.

## 8. Learn (new `/learn`)

From the ledger: per zone, predicted need vs units actually distributed/households served per completed run; rolling calibration (mean ratio, trend); **override scoring** — for each expired override, was the operator's adjustment closer to the realized outcome than the model? Surfaces: "Your adjustments beat the model in 4 of 6 runs"; stale-model warnings; a suggestion when a zone is consistently over/under-planned ("reduce coverageShare for Gaslamp?"). All derived, no new model.

## Honesty rules (carried from the Commons)

Counts are DSDP-basis units, never "people in need"; 311 is never a need input; bands are shown wherever a number is; nothing is labeled live unless it is; every plan number is traceable to a mart or a logged operator input.

## Testing

Pure modules (`plan/forecast.ts`, `store/localStorageStore.ts`, `learn/calibration.ts`, ledger) get vitest with fixtures: weekly spread preserves monthly totals and bands; params change recomputes; override precedence and expiry; ledger ordering; calibration math; store schema migration. Pages get smoke tests via existing patterns. `npm run check` + `npm run build` green per phase.

## Out of scope

Auth, multi-user, server persistence (adapter only), donor portal, volunteer app, new data sources, changes to the landing page or the bridge.

## Build order and cut list

Phases: 1 Foundation → 2 Forecast & Plan → 3 Today → 4 Intake/Stock → 6 Allocate → 7 Distribute → 5 Verify → 8 Learn. If time runs short cut 8 → 6's export → 3's KPI strip. Phases 1 and 2 are the product and are never cut.

## Coordination

Branch `feat/ops-product` from `main` after the teammate's in-flight changes merge. Files touched: `src/lib/store/*`, `src/lib/plan/*`, `src/lib/learn/*`, the functional pages, `Sidebar`, new components. Untouched: landing, charts internals, `scripts/`, the Commons pipeline.
