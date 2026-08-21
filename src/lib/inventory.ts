import type { InventoryItem, Status, Donation, Distribution } from './types';

const DAY_MS = 86_400_000;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.floor(Math.random() * 1e9).toString(36);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysUntil(dateISO: string, now: Date): number {
  const target = new Date(dateISO + 'T00:00:00Z').getTime();
  const base = new Date(isoDay(now) + 'T00:00:00Z').getTime();
  return Math.floor((target - base) / DAY_MS);
}

export function deriveStatus(item: InventoryItem, now: Date = new Date()): Status {
  if (item.quantity <= 0) return 'Out';
  if (item.quantity <= item.reorderThreshold) return 'Low';
  if (daysUntil(item.expirationDate, now) <= 14) return 'Expiring';
  return 'OK';
}

export function totalStock(inv: InventoryItem[]): number {
  return inv.reduce((sum, i) => sum + i.quantity, 0);
}

export function applyDonation(
  inv: InventoryItem[],
  donation: Donation,
  opts: { now?: Date; makeId?: () => string } = {},
): InventoryItem[] {
  const now = opts.now ?? new Date();
  const makeId = opts.makeId ?? newId;
  const stamp = isoDay(now);
  const next = inv.map((i) => ({ ...i }));
  for (const di of donation.items) {
    const idx = next.findIndex(
      (i) => i.name.toLowerCase() === di.name.toLowerCase() && i.category === di.category,
    );
    if (idx >= 0) {
      next[idx].quantity += di.quantity;
      next[idx].lastUpdated = stamp;
    } else {
      next.push({
        id: makeId(),
        name: di.name,
        category: di.category,
        quantity: di.quantity,
        unit: di.unit,
        expirationDate: isoDay(new Date(now.getTime() + 90 * DAY_MS)),
        location: 'Receiving',
        reorderThreshold: 10,
        lastUpdated: stamp,
      });
    }
  }
  return next;
}

export function applyDistribution(
  inv: InventoryItem[],
  distribution: Distribution,
  opts: { now?: Date } = {},
): InventoryItem[] {
  const now = opts.now ?? new Date();
  const stamp = isoDay(now);
  const next = inv.map((i) => ({ ...i }));
  for (const di of distribution.items) {
    const idx = next.findIndex((i) => i.name.toLowerCase() === di.name.toLowerCase());
    if (idx >= 0) {
      next[idx].quantity = Math.max(0, next[idx].quantity - di.quantity);
      next[idx].lastUpdated = stamp;
    }
  }
  return next;
}
