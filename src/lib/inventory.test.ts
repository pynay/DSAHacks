import { describe, it, expect } from 'vitest';
import type { InventoryItem, Donation, Distribution } from './types';
import {
  deriveStatus,
  applyDonation,
  applyDistribution,
  totalStock,
} from './inventory';

const NOW = new Date('2026-08-20T12:00:00Z');

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: '1',
    name: 'Canned Beans',
    category: 'Canned',
    quantity: 100,
    unit: 'cans',
    expirationDate: '2027-01-01',
    location: 'Aisle B',
    reorderThreshold: 20,
    lastUpdated: '2026-08-01',
    ...over,
  };
}

describe('deriveStatus', () => {
  it('returns Out when quantity is 0', () => {
    expect(deriveStatus(item({ quantity: 0 }), NOW)).toBe('Out');
  });
  it('returns Low when at or below reorder threshold', () => {
    expect(deriveStatus(item({ quantity: 20, reorderThreshold: 20 }), NOW)).toBe('Low');
  });
  it('returns Expiring when within 14 days', () => {
    expect(deriveStatus(item({ expirationDate: '2026-08-28' }), NOW)).toBe('Expiring');
  });
  it('returns OK otherwise', () => {
    expect(deriveStatus(item(), NOW)).toBe('OK');
  });
  it('prioritizes Low over Expiring', () => {
    expect(
      deriveStatus(item({ quantity: 5, reorderThreshold: 20, expirationDate: '2026-08-22' }), NOW),
    ).toBe('Low');
  });
});

describe('applyDonation', () => {
  it('increases quantity of a matching item', () => {
    const inv = [item({ quantity: 100 })];
    const d: Donation = {
      id: 'd1',
      date: '2026-08-20',
      donorName: 'Acme',
      donorType: 'grocery',
      items: [{ name: 'canned beans', category: 'Canned', quantity: 30, unit: 'cans' }],
    };
    const out = applyDonation(inv, d, { now: NOW });
    expect(out[0].quantity).toBe(130);
    expect(inv[0].quantity).toBe(100); // input not mutated
  });
  it('adds a new item when no match exists', () => {
    const inv: InventoryItem[] = [];
    const d: Donation = {
      id: 'd1',
      date: '2026-08-20',
      donorName: 'Acme',
      donorType: 'grocery',
      items: [{ name: 'Rice', category: 'Grains', quantity: 40, unit: 'lbs' }],
    };
    const out = applyDonation(inv, d, { now: NOW, makeId: () => 'new-1' });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'new-1', name: 'Rice', quantity: 40, unit: 'lbs' });
  });
});

describe('applyDistribution', () => {
  it('decreases matching quantity but not below zero', () => {
    const inv = [item({ quantity: 10 })];
    const dist: Distribution = {
      id: 'x1',
      date: '2026-08-20',
      recipient: 'Family',
      type: 'household',
      items: [{ name: 'Canned Beans', quantity: 25, unit: 'cans' }],
    };
    const out = applyDistribution(inv, dist, { now: NOW });
    expect(out[0].quantity).toBe(0);
  });
  it('ignores items not in inventory', () => {
    const inv = [item()];
    const dist: Distribution = {
      id: 'x1',
      date: '2026-08-20',
      recipient: 'Family',
      type: 'household',
      items: [{ name: 'Unknown', quantity: 5, unit: 'lbs' }],
    };
    const out = applyDistribution(inv, dist, { now: NOW });
    expect(out[0].quantity).toBe(100);
  });
});

describe('totalStock', () => {
  it('sums all quantities', () => {
    expect(totalStock([item({ quantity: 10 }), item({ quantity: 5 })])).toBe(15);
  });
});
