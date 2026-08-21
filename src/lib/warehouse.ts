// The "Warehouse Ops" engine: pure, deterministic simulation of a working food
// bank. stepDay() advances one simulated day — shipping stock out to drop zones
// (FEFO, soonest-expiring first), taking donations in, writing off expired
// perishables, and fulfilling inbound reorders. All randomness comes through an
// injected rng so the engine is testable; the provider passes Math.random.
import type {
  InventoryItem,
  Donation,
  Distribution,
  DonationItem,
  DistributionItem,
  Category,
} from './types';
import { applyDistribution, applyDonation, newId, daysUntil } from './inventory';

const DAY_MS = 86_400_000;

// Fixed start date (matches the app's "today") so the sim clock is deterministic
// across SSR/hydration and resets cleanly.
export const SIM_START = '2026-08-21';

export type EventKind = 'distribution' | 'donation' | 'spoilage' | 'reorder';

export interface SimEvent {
  id: string;
  date: string; // sim date 'YYYY-MM-DD'
  kind: EventKind;
  text: string;
}

export interface Reorder {
  id: string;
  name: string;
  category: Category;
  qty: number;
  unit: string;
  placedDate: string;
  arriveDate: string;
}

export interface WarehouseState {
  inventory: InventoryItem[];
  donations: Donation[];
  distributions: Distribution[];
  events: SimEvent[]; // newest first, capped
  reorders: Reorder[]; // pending inbound restocks
  prioritized: string[]; // inventory item ids to ship first (FEFO override)
  simDate: string;
}

export interface StepCtx {
  recipients?: string[];
  rng?: () => number;
  makeId?: () => string;
}

// Downtown drop zones — aligned with the delivery neighborhoods.
export const DROP_ZONES = [
  'East Village drop zone',
  'City Center drop zone',
  'Cortez drop zone',
  'Gaslamp outreach',
  'Columbia mobile pantry',
  'Marina outreach',
];

const DONORS: { name: string; type: Donation['donorType'] }[] = [
  { name: 'Sunrise Grocery', type: 'grocery' },
  { name: 'Harbor Markets', type: 'grocery' },
  { name: 'Pacific Foods Co.', type: 'corporate' },
  { name: 'Community Food Drive', type: 'food-drive' },
  { name: 'Neighborhood Collection', type: 'food-drive' },
  { name: 'Acme Corp', type: 'corporate' },
];

export function addDays(dateISO: string, n: number): string {
  const t = new Date(dateISO + 'T00:00:00Z').getTime() + n * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

// Shelf life by category (days) — a fresh shipment resets an item's expiry, so
// restocked perishables don't inherit a stale (already-expired) date.
const SHELF_DAYS: Record<Category, number> = {
  Produce: 12,
  Dairy: 18,
  Frozen: 120,
  Protein: 60,
  Grains: 300,
  Canned: 500,
  Beverages: 300,
  Household: 700,
};

function freshExpiry(category: Category, simDate: string): string {
  return addDays(simDate, SHELF_DAYS[category]);
}

// Restock like applyDonation, but give the affected items a fresh expiration
// dated from the incoming shipment (new stock = new shelf life).
function restock(
  inv: InventoryItem[],
  donation: Donation,
  now: Date,
  makeId: () => string,
  simDate: string,
): InventoryItem[] {
  const next = applyDonation(inv, donation, { now, makeId });
  for (const di of donation.items) {
    const idx = next.findIndex((i) => i.name.toLowerCase() === di.name.toLowerCase() && i.category === di.category);
    if (idx >= 0) next[idx] = { ...next[idx], expirationDate: freshExpiry(next[idx].category, simDate) };
  }
  return next;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] ?? arr[0];
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// --- Management-tool helpers (pure) -----------------------------------------

export interface ReorderSuggestion {
  item: InventoryItem;
  suggestedQty: number;
}

// Items at or below their reorder threshold (Low or Out), most-depleted first.
export function reorderSuggestions(inv: InventoryItem[]): ReorderSuggestion[] {
  return inv
    .filter((i) => i.quantity <= i.reorderThreshold)
    .map((i) => ({ item: i, suggestedQty: Math.max(1, i.reorderThreshold * 2 - i.quantity) }))
    .sort((a, b) => a.item.quantity - b.item.quantity);
}

export interface ExpiringEntry {
  item: InventoryItem;
  daysLeft: number;
}

// In-stock items within `withinDays` of expiry, most urgent first.
export function expiringSoon(inv: InventoryItem[], now: Date, withinDays = 14): ExpiringEntry[] {
  return inv
    .filter((i) => i.quantity > 0)
    .map((i) => ({ item: i, daysLeft: daysUntil(i.expirationDate, now) }))
    .filter((e) => e.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// --- The engine -------------------------------------------------------------

export function stepDay(state: WarehouseState, ctx: StepCtx = {}): WarehouseState {
  const rng = ctx.rng ?? Math.random;
  const makeId = ctx.makeId ?? newId;
  const recipients = ctx.recipients?.length ? ctx.recipients : DROP_ZONES;
  const simDate = addDays(state.simDate, 1);
  const now = new Date(simDate + 'T00:00:00Z');
  const newEvents: SimEvent[] = [];
  let inv = state.inventory.map((i) => ({ ...i }));
  let donations = state.donations;
  let distributions = state.distributions;

  // 1. Spoilage: any in-stock item whose expiration has passed is written off.
  for (const item of inv) {
    if (item.quantity > 0 && item.expirationDate < simDate) {
      newEvents.push({
        id: makeId(),
        date: simDate,
        kind: 'spoilage',
        text: `Wrote off ${item.quantity} ${item.unit} ${item.name} (expired)`,
      });
      item.quantity = 0;
      item.lastUpdated = simDate;
    }
  }

  // 2. Reorder arrivals: inbound restocks whose ETA has arrived.
  const arrived = state.reorders.filter((r) => r.arriveDate <= simDate);
  const reorders = state.reorders.filter((r) => r.arriveDate > simDate);
  for (const r of arrived) {
    const donation: Donation = {
      id: makeId(),
      date: simDate,
      donorName: 'Reorder restock',
      donorType: 'corporate',
      items: [{ name: r.name, category: r.category, quantity: r.qty, unit: r.unit }],
      notes: 'Auto reorder',
    };
    inv = restock(inv, donation, now, makeId, simDate);
    donations = [donation, ...donations];
    newEvents.push({
      id: makeId(),
      date: simDate,
      kind: 'reorder',
      text: `Reorder arrived: +${r.qty} ${r.unit} ${r.name}`,
    });
  }

  // 3. Distribution out (most days): ship FEFO, prioritized items first.
  if (rng() < 0.85) {
    const inStock = inv.filter((i) => i.quantity > 0);
    if (inStock.length) {
      const ordered = [...inStock].sort((a, b) => {
        const pa = state.prioritized.includes(a.id) ? 0 : 1;
        const pb = state.prioritized.includes(b.id) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return a.expirationDate.localeCompare(b.expirationDate);
      });
      const n = Math.min(ordered.length, randInt(1, 2, rng));
      const chosen = ordered.slice(0, n);
      const items: DistributionItem[] = chosen.map((i) => ({
        name: i.name,
        quantity: Math.max(1, Math.min(i.quantity, Math.round(i.quantity * (0.2 + rng() * 0.4)))),
        unit: i.unit,
      }));
      const recipient = pick(recipients, rng);
      const dist: Distribution = {
        id: makeId(),
        date: simDate,
        recipient,
        type: 'mobile-pantry',
        items,
        householdsServed: randInt(8, 55, rng),
      };
      inv = applyDistribution(inv, dist, { now });
      distributions = [dist, ...distributions];
      const summary = items.map((it) => `${it.quantity} ${it.unit} ${it.name}`).join(', ');
      newEvents.push({ id: makeId(), date: simDate, kind: 'distribution', text: `Shipped ${summary} to ${recipient}` });
    }
  }

  // 4. Donation in (some days): restock, biased toward what's running low.
  if (rng() < 0.45) {
    const low = inv.filter((i) => i.quantity <= i.reorderThreshold);
    const pool = low.length ? low : inv;
    const n = Math.min(pool.length, randInt(1, 2, rng));
    const copy = [...pool];
    const chosen: InventoryItem[] = [];
    for (let k = 0; k < n && copy.length; k++) {
      chosen.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    }
    const donor = pick(DONORS, rng);
    const items: DonationItem[] = chosen.map((i) => ({
      name: i.name,
      category: i.category,
      quantity: randInt(20, 120, rng),
      unit: i.unit,
    }));
    const donation: Donation = { id: makeId(), date: simDate, donorName: donor.name, donorType: donor.type, items };
    inv = restock(inv, donation, now, makeId, simDate);
    donations = [donation, ...donations];
    const summary = items.map((it) => `${it.quantity} ${it.unit} ${it.name}`).join(', ');
    newEvents.push({ id: makeId(), date: simDate, kind: 'donation', text: `Received ${summary} from ${donor.name}` });
  }

  // 5. Auto-reorder: emergency procurement for anything now out of stock (with
  //    no reorder already inbound), so the warehouse replenishes and never
  //    drains to permanent zero. Low-but-not-out items stay in the manual queue.
  const auto: Reorder[] = [];
  for (const item of inv) {
    const alreadyInbound = reorders.some((r) => r.name === item.name) || auto.some((r) => r.name === item.name);
    if (item.quantity === 0 && !alreadyInbound) {
      const qty = Math.max(30, item.reorderThreshold * 3);
      auto.push({
        id: makeId(),
        name: item.name,
        category: item.category,
        qty,
        unit: item.unit,
        placedDate: simDate,
        arriveDate: addDays(simDate, 2),
      });
      newEvents.push({
        id: makeId(),
        date: simDate,
        kind: 'reorder',
        text: `Auto-reorder placed: ${qty} ${item.unit} ${item.name} (out of stock)`,
      });
    }
  }

  return {
    inventory: inv,
    donations,
    distributions,
    reorders: [...reorders, ...auto],
    prioritized: state.prioritized,
    events: [...newEvents, ...state.events].slice(0, 60),
    simDate,
  };
}
