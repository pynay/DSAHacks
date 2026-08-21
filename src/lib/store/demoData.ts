// Deterministic 8-week demo dataset: current stock with staggered expiries,
// weekly donation/distribution history, and two past field observations (one
// fresh, one stale) so the Forecast & Plan evidence chips have something real
// to show. Seeded RNG only — same `today` always produces the same snapshot.
import type { Category, Donation, DonationItem, Distribution, DistributionItem, InventoryItem } from '@/lib/types';
import { newId } from '@/lib/inventory';
import { DEFAULT_PARAMS, type LedgerEvent, type Override, type StoreSnapshot } from './types';

const DAY_MS = 86_400_000;

function addDays(dateISO: string, n: number): string {
  return new Date(new Date(dateISO + 'T00:00:00Z').getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

function isoAt(dateISO: string, hour: number): string {
  return new Date(new Date(dateISO + 'T00:00:00Z').getTime() + hour * 3_600_000).toISOString();
}

// mulberry32 — small, deterministic, no dependency.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] ?? arr[0];
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// The six downtown distribution sites, matching the recipient names already
// used in the app's mock/simulated history (src/data/mock.ts, warehouse.ts).
const DROP_ZONES = [
  'East Village distribution site',
  'City Center distribution site',
  'Cortez distribution site',
  'Gaslamp outreach',
  'Columbia mobile pantry',
  'Marina outreach',
];

// Real DeliveryZone ids served by /api/zones for this seed (see
// src/lib/hotspotState.ts: getHotspotZones ranks the six posterior-density
// clusters as `predicted-hotspot-{1..6}`, not one per named neighborhood —
// several clusters can land in the same neighborhood and some named
// neighborhoods, including Gaslamp, may not get a cluster at all). These ids
// are deterministic for the shipped seed file as long as no live field
// observation has been applied yet.
const EAST_VILLAGE_ZONE_ID = 'predicted-hotspot-2';
const CORTEZ_ZONE_ID = 'predicted-hotspot-5';
// Forecast & Plan grid rows are the six neighborhoods (not hotspots), so
// overrides key off the neighborhood id directly — Gaslamp for the demo's
// "active override" example, matching the design spec's walkthrough.
const OVERRIDE_ZONE_ID = 'gaslamp';

interface ItemSpec {
  name: string;
  category: Category;
  unit: string;
  quantity: number;
  reorderThreshold: number;
  location: string;
  expiresInDays: number;
  updatedDaysAgo: number;
}

// ~20 items across every category. A handful expire within 7 days so the
// FEFO/expiry alerts have something to show as soon as demo data loads.
const ITEM_SPECS: ItemSpec[] = [
  { name: 'Canned Black Beans', category: 'Canned', unit: 'cans', quantity: 220, reorderThreshold: 50, location: 'Aisle B', expiresInDays: 250, updatedDaysAgo: 4 },
  { name: 'Canned Corn', category: 'Canned', unit: 'cans', quantity: 35, reorderThreshold: 50, location: 'Aisle B', expiresInDays: 200, updatedDaysAgo: 6 },
  { name: 'Peanut Butter', category: 'Protein', unit: 'jars', quantity: 90, reorderThreshold: 30, location: 'Aisle C', expiresInDays: 300, updatedDaysAgo: 9 },
  { name: 'White Rice', category: 'Grains', unit: 'lbs', quantity: 140, reorderThreshold: 40, location: 'Aisle A', expiresInDays: 400, updatedDaysAgo: 3 },
  { name: 'Pasta', category: 'Grains', unit: 'boxes', quantity: 28, reorderThreshold: 40, location: 'Aisle A', expiresInDays: 220, updatedDaysAgo: 7 },
  { name: 'Whole Milk', category: 'Dairy', unit: 'gallons', quantity: 24, reorderThreshold: 15, location: 'Fridge 1', expiresInDays: 6, updatedDaysAgo: 1 },
  { name: 'Cheddar Cheese', category: 'Dairy', unit: 'blocks', quantity: 12, reorderThreshold: 15, location: 'Fridge 1', expiresInDays: 8, updatedDaysAgo: 2 },
  { name: 'Fresh Apples', category: 'Produce', unit: 'lbs', quantity: 60, reorderThreshold: 30, location: 'Produce Bin', expiresInDays: 4, updatedDaysAgo: 1 },
  { name: 'Carrots', category: 'Produce', unit: 'lbs', quantity: 45, reorderThreshold: 30, location: 'Produce Bin', expiresInDays: 16, updatedDaysAgo: 3 },
  { name: 'Frozen Chicken', category: 'Frozen', unit: 'lbs', quantity: 80, reorderThreshold: 40, location: 'Freezer 1', expiresInDays: 365, updatedDaysAgo: 5 },
  { name: 'Frozen Mixed Veg', category: 'Frozen', unit: 'bags', quantity: 30, reorderThreshold: 40, location: 'Freezer 1', expiresInDays: 300, updatedDaysAgo: 8 },
  { name: 'Canned Tuna', category: 'Protein', unit: 'cans', quantity: 0, reorderThreshold: 30, location: 'Aisle C', expiresInDays: 365, updatedDaysAgo: 10 },
  { name: 'Cereal', category: 'Grains', unit: 'boxes', quantity: 52, reorderThreshold: 25, location: 'Aisle A', expiresInDays: 240, updatedDaysAgo: 6 },
  { name: 'Apple Juice', category: 'Beverages', unit: 'bottles', quantity: 40, reorderThreshold: 20, location: 'Aisle D', expiresInDays: 200, updatedDaysAgo: 9 },
  { name: 'Bottled Water', category: 'Beverages', unit: 'bottles', quantity: 300, reorderThreshold: 100, location: 'Dock', expiresInDays: 500, updatedDaysAgo: 2 },
  { name: 'Diapers (Size 4)', category: 'Household', unit: 'packs', quantity: 18, reorderThreshold: 20, location: 'Aisle E', expiresInDays: 600, updatedDaysAgo: 11 },
  { name: 'Toothpaste', category: 'Household', unit: 'tubes', quantity: 65, reorderThreshold: 25, location: 'Aisle E', expiresInDays: 500, updatedDaysAgo: 12 },
  { name: 'Canned Soup', category: 'Canned', unit: 'cans', quantity: 110, reorderThreshold: 50, location: 'Aisle B', expiresInDays: 300, updatedDaysAgo: 5 },
  { name: 'Eggs', category: 'Dairy', unit: 'dozens', quantity: 40, reorderThreshold: 20, location: 'Fridge 2', expiresInDays: 7, updatedDaysAgo: 1 },
  { name: 'Ground Beef', category: 'Protein', unit: 'lbs', quantity: 25, reorderThreshold: 30, location: 'Freezer 2', expiresInDays: 100, updatedDaysAgo: 4 },
];

const DONORS: { name: string; type: Donation['donorType'] }[] = [
  { name: 'Sunrise Grocery', type: 'grocery' },
  { name: 'Harbor Markets', type: 'grocery' },
  { name: 'Pacific Foods Co.', type: 'corporate' },
  { name: 'Acme Corp', type: 'corporate' },
  { name: 'Community Food Drive', type: 'food-drive' },
  { name: 'Neighborhood Collection', type: 'food-drive' },
];

const DIST_TYPES: Distribution['type'][] = ['mobile-pantry', 'partner-agency', 'household'];

function buildInventory(today: string, makeId: () => string): InventoryItem[] {
  return ITEM_SPECS.map((spec) => ({
    id: makeId(),
    name: spec.name,
    category: spec.category,
    quantity: spec.quantity,
    unit: spec.unit,
    expirationDate: addDays(today, spec.expiresInDays),
    location: spec.location,
    reorderThreshold: spec.reorderThreshold,
    lastUpdated: addDays(today, -spec.updatedDaysAgo),
  }));
}

// 8 weeks back from today, one donation per week, biased toward items the
// demo inventory tends to run low on.
function buildDonations(today: string, rng: () => number, makeId: () => string): Donation[] {
  const donations: Donation[] = [];
  for (let week = 0; week < 8; week++) {
    const date = addDays(today, -(7 * week + randInt(0, 3, rng)));
    const donor = pick(DONORS, rng);
    const n = randInt(1, 2, rng);
    const chosen = new Set<number>();
    while (chosen.size < n) chosen.add(Math.floor(rng() * ITEM_SPECS.length));
    const items: DonationItem[] = [...chosen].map((idx) => {
      const spec = ITEM_SPECS[idx];
      return { name: spec.name, category: spec.category, quantity: randInt(20, 120, rng), unit: spec.unit };
    });
    donations.push({ id: makeId(), date, donorName: donor.name, donorType: donor.type, items });
  }
  return donations.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// 8 weeks back from today, one distribution per week cycled across the six
// downtown sites, each with a household count.
function buildDistributions(today: string, rng: () => number, makeId: () => string): Distribution[] {
  const distributions: Distribution[] = [];
  for (let week = 0; week < 8; week++) {
    const date = addDays(today, -(7 * week + randInt(1, 5, rng)));
    const recipient = DROP_ZONES[week % DROP_ZONES.length];
    const type = pick(DIST_TYPES, rng);
    const n = randInt(1, 2, rng);
    const chosen = new Set<number>();
    while (chosen.size < n) chosen.add(Math.floor(rng() * ITEM_SPECS.length));
    const items: DistributionItem[] = [...chosen].map((idx) => {
      const spec = ITEM_SPECS[idx];
      return { name: spec.name, quantity: randInt(10, 70, rng), unit: spec.unit };
    });
    distributions.push({
      id: makeId(),
      date,
      recipient,
      type,
      items,
      householdsServed: randInt(15, 60, rng),
    });
  }
  return distributions.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function buildDemoSnapshot(today: string): StoreSnapshot {
  const rng = mulberry32(20260821); // fixed seed: same `today` -> same dataset
  const makeId = newId;

  const inventory = buildInventory(today, makeId);
  const donations = buildDonations(today, rng, makeId);
  const distributions = buildDistributions(today, rng, makeId);

  const overrides: Override[] = [
    {
      zoneId: OVERRIDE_ZONE_ID,
      mode: 'factor',
      value: 0.8, // -20%
      reason: 'Safe-sleeping site opened nearby',
      setAt: isoAt(addDays(today, -5), 9),
      expiresAt: addDays(today, 9),
    },
  ];

  const ledger: LedgerEvent[] = [
    {
      id: makeId(),
      ts: isoAt(addDays(today, -20), 8),
      type: 'observation_applied',
      zoneId: CORTEZ_ZONE_ID,
      actor: 'field',
      payload: { count: 38, confidence: 0.72, source: 'DJI Mini 4K via RTMP' },
      note: 'Cortez field verification',
    },
    {
      id: makeId(),
      ts: isoAt(addDays(today, -5), 9),
      type: 'override_set',
      zoneId: OVERRIDE_ZONE_ID,
      actor: 'operator',
      payload: { mode: 'factor', value: 0.8, reason: 'Safe-sleeping site opened nearby', expiresAt: addDays(today, 9) },
      note: 'Safe-sleeping site opened nearby',
    },
    {
      id: makeId(),
      ts: isoAt(addDays(today, -9), 14),
      type: 'observation_applied',
      zoneId: EAST_VILLAGE_ZONE_ID,
      actor: 'field',
      payload: { count: 112, confidence: 0.86, source: 'webcam' },
      note: 'East Village field verification',
    },
    {
      id: makeId(),
      ts: isoAt(today, 7),
      type: 'demo_loaded',
      actor: 'operator',
      payload: { inventoryItems: inventory.length, donations: donations.length, distributions: distributions.length },
    },
  ];

  return {
    version: 2,
    inventory,
    donations,
    distributions,
    ledger,
    params: { ...DEFAULT_PARAMS },
    overrides,
    drafts: [],
  };
}
