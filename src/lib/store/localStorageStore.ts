'use client';

// The one place that touches localStorage. Pages and the provider go through
// loadSnapshot/saveSnapshot/clearSnapshot only; nothing else reads or writes
// the underlying keys. v2 is the current versioned snapshot shape; v1 was the
// old sim-clock "warehouse" state (see src/lib/warehouse.ts), migrated in
// place the first time v2 is missing so existing demo progress isn't lost.
import type { InventoryItem, Donation, Distribution } from '@/lib/types';
import { DEFAULT_PARAMS, type StoreSnapshot } from './types';

const V2_KEY = 'parsel-store-v2';
const V1_KEY = 'parsel-warehouse-v1';

interface V1Persisted {
  state?: {
    inventory?: InventoryItem[];
    donations?: Donation[];
    distributions?: Distribution[];
  };
}

export function emptySnapshot(): StoreSnapshot {
  return {
    version: 2,
    inventory: [],
    donations: [],
    distributions: [],
    ledger: [],
    params: { ...DEFAULT_PARAMS },
    overrides: [],
    drafts: [],
  };
}

function migrateFromV1(): StoreSnapshot | null {
  try {
    const raw = localStorage.getItem(V1_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as V1Persisted;
    const inventory = parsed.state?.inventory;
    if (!inventory) return null;
    return {
      version: 2,
      inventory,
      donations: parsed.state?.donations ?? [],
      distributions: parsed.state?.distributions ?? [],
      ledger: [],
      params: { ...DEFAULT_PARAMS },
      overrides: [],
      drafts: [],
    };
  } catch {
    return null;
  }
}

// Reads the v2 snapshot; if absent, migrates v1 (returns null only when
// neither exists, i.e. this is a genuinely fresh browser).
export function loadSnapshot(): StoreSnapshot | null {
  try {
    const raw = localStorage.getItem(V2_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreSnapshot;
      if (parsed && parsed.version === 2 && Array.isArray(parsed.inventory)) return parsed;
    }
  } catch {
    // fall through to migration
  }
  return migrateFromV1();
}

export function saveSnapshot(snapshot: StoreSnapshot): void {
  try {
    localStorage.setItem(V2_KEY, JSON.stringify(snapshot));
  } catch {
    // storage full / unavailable — the in-memory state is still correct
  }
}

// Clears both the current snapshot and the legacy key, so a reset can't be
// resurrected by re-running the v1 migration on next load.
export function clearSnapshot(): void {
  try {
    localStorage.removeItem(V2_KEY);
    localStorage.removeItem(V1_KEY);
  } catch {
    // ignore
  }
}
