// Store adapter types: the versioned snapshot persisted by localStorageStore,
// the append-only event ledger, and the operator-tunable plan parameters.
// Pages never construct these directly except through InventoryProvider.
import type { InventoryItem, Donation, Distribution } from '@/lib/types';

export type LedgerEventType =
  | 'donation_logged'
  | 'stock_adjusted'
  | 'observation_applied'
  | 'override_set'
  | 'allocation_staged'
  | 'distribution_completed'
  | 'params_changed'
  | 'demo_loaded';

export interface LedgerEvent {
  id: string;
  ts: string;
  type: LedgerEventType;
  zoneId?: string;
  refId?: string;
  actor: 'operator' | 'model' | 'field';
  payload: Record<string, unknown>;
  note?: string;
}

export interface PlanParams {
  mealsPerPerson: number;
  visitsPerWeek: Record<string, number>;
  hoursPerRun: number;
  vehicleCapacity: number;
  coverageShare: number;
  planTo: 'point' | 'upper80';
  horizonWeeks: 4 | 8 | 12;
  staleAfterDays: number;
  // Runs the fleet can make in a week, across all zones — the capacity
  // denominator for the Today KPI strip (capacity = runsPerWeek x vehicleCapacity).
  runsPerWeek: number;
}

// visitsPerWeek default 1 per zone (applied lazily wherever a zone id is missing).
export const DEFAULT_PARAMS: PlanParams = {
  mealsPerPerson: 2,
  visitsPerWeek: {},
  hoursPerRun: 6,
  vehicleCapacity: 250,
  coverageShare: 0.6,
  planTo: 'upper80',
  horizonWeeks: 8,
  staleAfterDays: 14,
  runsPerWeek: 6,
};

export interface Override {
  zoneId: string;
  mode: 'factor' | 'absolute';
  value: number;
  reason: string;
  setAt: string;
  expiresAt: string;
}

export interface DistributionDraft {
  id: string;
  zoneId: string;
  zoneLabel: string;
  weekStart: string;
  items: { name: string; quantity: number; unit: string }[];
  meals: number;
  predictedNeed: number;
  stagedAt: string;
  status: 'staged' | 'completed';
}

export interface StoreSnapshot {
  version: 2;
  inventory: InventoryItem[];
  donations: Donation[];
  distributions: Distribution[];
  ledger: LedgerEvent[];
  params: PlanParams;
  overrides: Override[];
  drafts: DistributionDraft[];
  // The Forecast & Plan week last chosen via "Use for allocation" (Monday,
  // ISO 'YYYY-MM-DD'); Allocate falls back to next week when unset.
  selectedWeekStart?: string;
}
