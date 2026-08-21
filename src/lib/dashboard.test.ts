import { describe, it, expect } from 'vitest';
import type { InventoryItem, Donation, Distribution } from './types';
import { statusCounts, categoryTotals, recentActivity, flowByWeek } from './dashboard';

const NOW = new Date('2026-08-20T12:00:00Z');

const inv: InventoryItem[] = [
  { id: '1', name: 'A', category: 'Canned', quantity: 0, unit: 'cans', expirationDate: '2027-01-01', location: '', reorderThreshold: 10, lastUpdated: '2026-08-01' },
  { id: '2', name: 'B', category: 'Canned', quantity: 5, unit: 'cans', expirationDate: '2027-01-01', location: '', reorderThreshold: 10, lastUpdated: '2026-08-01' },
  { id: '3', name: 'C', category: 'Produce', quantity: 100, unit: 'lbs', expirationDate: '2026-08-25', location: '', reorderThreshold: 10, lastUpdated: '2026-08-01' },
  { id: '4', name: 'D', category: 'Produce', quantity: 100, unit: 'lbs', expirationDate: '2027-01-01', location: '', reorderThreshold: 10, lastUpdated: '2026-08-01' },
];

describe('statusCounts', () => {
  it('counts each derived status', () => {
    expect(statusCounts(inv, NOW)).toEqual({ OK: 1, Low: 1, Expiring: 1, Out: 1 });
  });
});

describe('categoryTotals', () => {
  it('sums quantity per category, descending', () => {
    expect(categoryTotals(inv)).toEqual([
      { category: 'Produce', total: 200 },
      { category: 'Canned', total: 5 },
    ]);
  });
});

describe('recentActivity', () => {
  it('merges and sorts by date descending', () => {
    const donations: Donation[] = [
      { id: 'd1', date: '2026-08-10', donorName: 'Acme', donorType: 'grocery', items: [{ name: 'A', category: 'Canned', quantity: 10, unit: 'cans' }] },
    ];
    const dists: Distribution[] = [
      { id: 'x1', date: '2026-08-15', recipient: 'Shelter', type: 'partner-agency', items: [{ name: 'A', quantity: 5, unit: 'cans' }], householdsServed: 3 },
    ];
    const out = recentActivity(donations, dists);
    expect(out.map((e) => e.id)).toEqual(['x1', 'd1']);
    expect(out[0].kind).toBe('distribution');
  });
});

describe('flowByWeek', () => {
  it('buckets intake and outflow into the current week', () => {
    const donations: Donation[] = [
      { id: 'd1', date: '2026-08-20', donorName: 'Acme', donorType: 'grocery', items: [{ name: 'A', category: 'Canned', quantity: 10, unit: 'cans' }] },
    ];
    const dists: Distribution[] = [
      { id: 'x1', date: '2026-08-20', recipient: 'S', type: 'household', items: [{ name: 'A', quantity: 4, unit: 'cans' }] },
    ];
    const out = flowByWeek(donations, dists, NOW, 6);
    expect(out).toHaveLength(6);
    expect(out[5]).toMatchObject({ intake: 10, outflow: 4 });
  });
});
