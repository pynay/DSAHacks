# Ops Product Implementation Plan (hackathon-demo level)

**Goal:** Wire Parsel's functional pages into one operator loop — Intake → Stock → Plan → Verify → Allocate → Distribute → Learn — with an adaptable forecast-driven resource plan at the center, persistent across reloads.
**Spec:** `docs/superpowers/specs/2026-08-21-ops-product-design.md`
**Mode:** demo-level functional. No unit tests required; `npm run check` (typecheck+lint) and `npm run build` must stay green; each task is verified by using it in the browser.

## Global constraints
- Branch `feat/ops-product`. Keep `useInventory()` as the page-facing hook (extend it; don't rename).
- Pages never touch `localStorage` directly — only `src/lib/store/localStorageStore.ts` does.
- Vocabulary: zones = the six downtown neighborhoods (`DeliveryZone` from `/api/zones`); evidence chips: `historical prior` · `field-verified · Nd` · `stale` · `overridden`.
- Honesty: counts are DSDP-basis units, never "people in need"; bands shown wherever a forecast number is; nothing labeled live unless it is.
- Styling: existing Tailwind/navy-emerald patterns (`rounded-xl border border-slate-200 bg-white p-4 shadow-sm` cards, `StatCard`, `StatusPill`, `Modal`, `FormField`).
- Commit per task, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File map
- `src/lib/store/types.ts` — `LedgerEvent`, `LedgerEventType`, `PlanParams`, `DEFAULT_PARAMS`, `Override`, `StoreSnapshot`
- `src/lib/store/localStorageStore.ts` — versioned snapshot (`parsel-store-v2`), migrate from `parsel-warehouse-v1`, `load/save/reset`
- `src/lib/store/demoData.ts` — deterministic 8-week demo dataset (inventory, donations, distributions, two observations, ledger)
- `src/context/InventoryProvider.tsx` — refactor: store-backed, no sim clock; adds `ledger`, `params`, `overrides`, `drafts`, `stagedRuns`, actions
- `src/lib/plan/forecast.ts` — `buildPlanGrid(...)` pure engine
- `src/lib/plan/evidence.ts` — `zoneEvidence(...)` → chip
- `src/components/EvidenceChip.tsx`
- `src/components/plan/PlanGrid.tsx`, `PlanParamsPanel.tsx`, `WeekSummary.tsx`, `OverrideDialog.tsx`, `ZoneEvidenceDrawer.tsx`
- `src/app/signals/page.tsx` → Forecast & Plan (tabs: Plan | Evidence)
- `src/lib/today.ts` + `src/app/dashboard/page.tsx` → Today
- `src/app/donations/page.tsx`, `src/app/inventory/page.tsx` — expiry on intake, FEFO, adjust-with-reason
- `src/app/allocation/page.tsx` + `src/components/allocation/PickList.tsx`, `RunSheet.tsx` — stage runs
- `src/app/distributions/page.tsx` — complete drafts with outcomes
- `src/app/dispatch/page.tsx` — write `observation_applied` ledger event
- `src/lib/learn/calibration.ts` + `src/app/learn/page.tsx`
- `src/components/Sidebar.tsx` — labels: Today, Forecast & Plan, Intake, Stock, Map, Verify, Allocate, Distribute, Learn, Campus Track

---

### Task 1 — Store, ledger, demo seed, provider refactor
**Build:**
```ts
// src/lib/store/types.ts
export type LedgerEventType = 'donation_logged'|'stock_adjusted'|'observation_applied'|'override_set'
  |'allocation_staged'|'distribution_completed'|'params_changed'|'demo_loaded';
export interface LedgerEvent { id:string; ts:string; type:LedgerEventType; zoneId?:string; refId?:string;
  actor:'operator'|'model'|'field'; payload:Record<string,unknown>; note?:string }
export interface PlanParams { mealsPerPerson:number; visitsPerWeek:Record<string,number>; hoursPerRun:number;
  vehicleCapacity:number; coverageShare:number; planTo:'point'|'upper80'; horizonWeeks:4|8|12; staleAfterDays:number }
export const DEFAULT_PARAMS: PlanParams = { mealsPerPerson:2, visitsPerWeek:{}, hoursPerRun:6, vehicleCapacity:250,
  coverageShare:0.6, planTo:'upper80', horizonWeeks:8, staleAfterDays:14 };   // visitsPerWeek default 1 per zone
export interface Override { zoneId:string; mode:'factor'|'absolute'; value:number; reason:string; setAt:string; expiresAt:string }
export interface DistributionDraft { id:string; zoneId:string; zoneLabel:string; weekStart:string; items:{name:string;quantity:number;unit:string}[];
  meals:number; predictedNeed:number; stagedAt:string; status:'staged'|'completed' }
export interface StoreSnapshot { version:2; inventory:InventoryItem[]; donations:Donation[]; distributions:Distribution[];
  ledger:LedgerEvent[]; params:PlanParams; overrides:Override[]; drafts:DistributionDraft[] }
```
- `localStorageStore.ts`: `loadSnapshot(): StoreSnapshot|null` (reads v2; if absent, migrates `parsel-warehouse-v1` inventory/donations/distributions into a v2 snapshot with empty ledger/params defaults), `saveSnapshot(s)`, `clearSnapshot()`.
- `demoData.ts`: `buildDemoSnapshot(today: string): StoreSnapshot` — ~18 inventory items across categories with staggered expiries (some within 7 days), 8 weeks of weekly donations (3 donor types) and distributions to the six zones with `householdsServed`, two ledger `observation_applied` events (East Village 9 days ago, Cortez 20 days ago → one fresh, one stale), one active override example (Gaslamp −20%, "Safe-sleeping site opened"), ledger `demo_loaded`. Deterministic (seeded RNG).
- `InventoryProvider.tsx`: replace sim clock (`running/speed/toggleRunning/setSpeed/stepDay/tick`) with store-backed state. Keep existing actions; add: `ledger`, `params`, `setParams`, `overrides`, `setOverride(o)`, `clearOverride(zoneId)`, `drafts`, `stageDrafts(d[])`, `completeDraft(id, outcome)`, `appendEvent(e)`, `loadDemo()`, `resetDemo()`. Every write → `saveSnapshot`. Remove/replace any UI that used `running/speed` (grep `toggleRunning|setSpeed|running` in `src/`; Topbar likely) with a "Demo data" menu: Load demo / Reset.
**Exit:** app boots with empty state → "Load demo data" populates inventory/donations/distributions; reload persists; `npm run check` green.

### Task 2 — Forecast & Plan
**Build:**
```ts
// src/lib/plan/forecast.ts
export interface PlanCell { need:number; lo:number; hi:number; meals:number; hours:number; runs:number; overridden:boolean }
export interface PlanGrid { weeks:string[]; zones:{id:string;label:string}[]; cells:Record<string,Record<string,PlanCell>>;
  totals:Record<string,{meals:number;hours:number;runs:number;need:number;lo:number;hi:number}> }
export function buildPlanGrid(input:{ outlook: OutlookPayload /* from /api/outlook */; zones: DeliveryZone[];
  params: PlanParams; overrides: Override[]; today: string }): PlanGrid
```
Logic: weeks = Monday-start weeks for `horizonWeeks` from `today`. For each zone, month need = Outlook per-neighborhood forecast value (lo/hi) for that month (fetch per-neighborhood rows — extend `/api/outlook` payload with `byNeighborhood: Record<string,{month,value,lo,hi}[]>` from `marts/outlook_forecast.csv` if not already present); current month anchored: if zone `confidence==='drone-updated'` scale the current-month value by `zone.need / modelPrior` (cap 0.5–2×), keep band width. Weekly need = month need × (7 / daysInMonth). Apply `coverageShare`, then override (factor multiplies; absolute replaces need, lo/hi scale proportionally). `planTo` picks `need` or `hi` as the planning number `plan`; `meals = plan × mealsPerPerson × visitsPerWeek[zone]||1`; `runs = ceil(meals / vehicleCapacity)`; `hours = runs × hoursPerRun`. Totals per week.
- `evidence.ts`: `zoneEvidence({zone, ledger, overrides, params, today}) → {kind:'historical'|'verified'|'stale'|'overridden', daysSince?:number, label:string}` using latest `observation_applied` for the zone (or `zone.sourceDate`).
- `EvidenceChip.tsx` (semantic colors: slate / emerald / amber / violet).
- Page `/signals` → header "Forecast & Plan" with tabs **Plan** | **Evidence**. Plan tab: `PlanParamsPanel` (all params; change → `setParams` + ledger `params_changed`), `PlanGrid` (rows zones with `EvidenceChip`, columns weeks; cell shows `plan` with `lo–hi` small, and meals/hours/runs; click → popover with the formula inputs), `WeekSummary` for a selected week (totals + top-3 zones + button "Use for allocation" → stores `selectedWeekStart` in provider), `OverrideDialog` per zone (mode, value, reason, expires; → `setOverride` + ledger). `ZoneEvidenceDrawer` (collapsible under each row): `OutlookChart` filtered to that zone if feasible, else the downtown chart + that zone's forecast numbers; ban tiles. Evidence tab: the existing charts moved verbatim (NeedHeatmap, PIT, IndexedSignals, LaJolla, Scaleup, shelter capacity).
- Sidebar label → "Forecast & Plan".
**Exit:** grid renders 6×8 with demo data; changing `mealsPerPerson` updates meals instantly; setting an override shows the `overridden` chip and changes the row; evidence chips show verified/stale per the demo observations; Evidence tab shows the old charts.

### Task 3 — Today (dashboard)
`src/lib/today.ts`: `attentionItems({inventory, zonesEvidence, drafts, overrides, today}) → {severity:'critical'|'warning'|'info', title, detail, href}[]` for: expiring ≤7d, below reorder, stale zones, staged-not-distributed drafts, overrides expiring ≤3d. KPI strip: next-week plan totals (from `buildPlanGrid`) vs capacity (`params.vehicleCapacity × runs available` — runs available = a new param `runsPerWeek`, default 6) → coverage %. Dashboard keeps activity feed + category chart below. Sidebar label → "Today".
**Exit:** Today lists ranked items linking to pages; KPI shows forecast meals vs capacity.

### Task 4 — Intake & Stock
Donations form: per-item `expirationDate` and `location`; on save, inventory upserts (match by name+category → add quantity, else new item) + ledger `donation_logged`. Inventory: default sort FEFO, `StatusPill`, category filter, "Adjust" modal with delta + reason → ledger `stock_adjusted`. Sidebar labels → Intake / Stock.
**Exit:** logging a donation increases stock with the given expiry; adjusting writes a ledger entry visible in Learn's event list later.

### Task 5 — Allocate → pick list / run sheet → stage
Allocation page uses the plan's selected week (fallback: next week) and `params.mealsPerPerson` instead of the local `unitsPerPerson`; eligible zones = field-verified (existing gate). Render **Pick list** (by item: qty, location, expiry, per-zone split) and **Run sheet** (by zone: items, meals, runs, hours). "Stage run" → `stageDrafts` (one draft per zone with items + `predictedNeed` from the grid), inventory moved to `staged` quantity (add `staged?: number` to `InventoryItem`), ledger `allocation_staged`. Buttons: Print (window.print with a print stylesheet), Download CSV (blob). Sidebar label → Allocate.
**Exit:** staging creates drafts visible on Distribute and reduces available stock.

### Task 6 — Distribute + Verify ledger
Distributions page: top section "Staged runs" (drafts) with "Complete" → modal: householdsServed, unitsDistributed (prefilled), surplusReturned, notes → `completeDraft`: stock staged→out, surplus back, `distribution_completed` ledger event with `predictedNeed`, creates a `Distribution` record. Below: history table. Dispatch: after a successful observe POST, `appendEvent({type:'observation_applied', actor:'field', zoneId, payload:{count, confidence, source: vision.detection?.source.label}})`. Sidebar labels → Distribute / Verify.
**Exit:** completing a run updates stock and appears in history; an applied observation flips the zone chip to `field-verified · 0d` on Forecast & Plan.

### Task 7 — Learn
`src/lib/learn/calibration.ts`: from ledger + drafts: per zone `{predicted, served, ratio}` per completed run; rolling mean ratio; `overrideScore(overrides, completed)` → for each expired/used override whether |override-adjusted plan − served| < |model plan − served|; summary "Your adjustments beat the model in N of M runs"; stale zones list; suggestion when a zone's mean ratio < 0.7 or > 1.3 ("consider lowering/raising coverageShare for X"). Page `/learn`: calibration table, override scorecard, suggestions, recent ledger events list. Sidebar → Learn.
**Exit:** with demo data + one completed run, Learn shows ratios and at least one suggestion.

### Task 8 — Wrap
README "Operator loop" section; `npm run check` + `npm run build`; walk the loop in the browser once end to end.
