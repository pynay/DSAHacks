import type { InventoryItem, Status, Donation, Distribution } from './types';
import { deriveStatus } from './inventory';

const DAY_MS = 86_400_000;

export function statusCounts(inv: InventoryItem[], now: Date = new Date()): Record<Status, number> {
  const counts: Record<Status, number> = { OK: 0, Low: 0, Expiring: 0, Out: 0 };
  for (const i of inv) counts[deriveStatus(i, now)]++;
  return counts;
}

export function categoryTotals(inv: InventoryItem[]): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const i of inv) map.set(i.category, (map.get(i.category) ?? 0) + i.quantity);
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export interface ActivityEntry {
  id: string;
  kind: 'donation' | 'distribution';
  date: string;
  title: string;
  subtitle: string;
}

function sumItems(items: { quantity: number }[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

export function recentActivity(
  donations: Donation[],
  distributions: Distribution[],
  limit = 8,
): ActivityEntry[] {
  const d: ActivityEntry[] = donations.map((x) => ({
    id: x.id,
    kind: 'donation',
    date: x.date,
    title: `Donation from ${x.donorName}`,
    subtitle: `${sumItems(x.items)} units · ${x.items.length} item${x.items.length !== 1 ? 's' : ''}`,
  }));
  const x: ActivityEntry[] = distributions.map((y) => ({
    id: y.id,
    kind: 'distribution',
    date: y.date,
    title: `Distribution to ${y.recipient}`,
    subtitle: `${sumItems(y.items)} units${y.householdsServed ? ` · ${y.householdsServed} households` : ''}`,
  }));
  return [...d, ...x].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export function flowByWeek(
  donations: Donation[],
  distributions: Distribution[],
  now: Date = new Date(),
  weeks = 6,
): { label: string; intake: number; outflow: number }[] {
  const startOfWeek = (d: Date): Date => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    x.setUTCDate(x.getUTCDate() - x.getUTCDay());
    return x;
  };
  const curStart = startOfWeek(now);
  const buckets = Array.from({ length: weeks }, (_, k) => {
    const start = new Date(curStart.getTime() - (weeks - 1 - k) * 7 * DAY_MS);
    return { start: start.getTime(), label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`, intake: 0, outflow: 0 };
  });
  const first = buckets[0].start;
  const indexOf = (dateISO: string): number => {
    const t = startOfWeek(new Date(dateISO + 'T00:00:00Z')).getTime();
    return Math.round((t - first) / (7 * DAY_MS));
  };
  for (const d of donations) {
    const idx = indexOf(d.date);
    if (idx >= 0 && idx < buckets.length) buckets[idx].intake += sumItems(d.items);
  }
  for (const x of distributions) {
    const idx = indexOf(x.date);
    if (idx >= 0 && idx < buckets.length) buckets[idx].outflow += sumItems(x.items);
  }
  return buckets.map(({ label, intake, outflow }) => ({ label, intake, outflow }));
}
