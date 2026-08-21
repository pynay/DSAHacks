import { describe, it, expect } from 'vitest';
import type { InventoryItem } from './types';
import { stepDay, reorderSuggestions, expiringSoon, SIM_START, type WarehouseState } from './warehouse';

// Deterministic rng that plays a fixed script, then repeats its last value.
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : values[values.length - 1] ?? 0);
}

function idGen(): () => string {
  let c = 0;
  return () => `e${c++}`;
}

function item(over: Partial<InventoryItem>): InventoryItem {
  return {
    id: 'x',
    name: 'Thing',
    category: 'Canned',
    quantity: 100,
    unit: 'units',
    expirationDate: '2027-01-01',
    location: 'Aisle',
    reorderThreshold: 20,
    lastUpdated: SIM_START,
    ...over,
  };
}

function baseState(inventory: InventoryItem[], over: Partial<WarehouseState> = {}): WarehouseState {
  return { inventory, donations: [], distributions: [], events: [], reorders: [], prioritized: [], simDate: SIM_START, ...over };
}

const quiet = () => 0.99; // both the distribution (<0.85) and donation (<0.45) gates fail

describe('stepDay', () => {
  it('advances the simulated date by one day', () => {
    const next = stepDay(baseState([item({})]), { rng: quiet, makeId: idGen() });
    expect(next.simDate).toBe('2026-08-22');
  });

  it('writes off expired stock as spoilage', () => {
    const next = stepDay(baseState([item({ id: 'a', quantity: 10, expirationDate: '2026-08-21' })]), {
      rng: quiet,
      makeId: idGen(),
    });
    expect(next.inventory[0].quantity).toBe(0);
    expect(next.events.some((e) => e.kind === 'spoilage')).toBe(true);
  });

  it('does not write off stock that expires later', () => {
    const next = stepDay(baseState([item({ quantity: 10, expirationDate: '2026-09-30' })]), {
      rng: quiet,
      makeId: idGen(),
    });
    expect(next.inventory[0].quantity).toBe(10);
    expect(next.events.some((e) => e.kind === 'spoilage')).toBe(false);
  });

  it('fulfills a reorder whose ETA has arrived and removes it from the queue', () => {
    const state = baseState([item({ id: 'a', name: 'Pasta', category: 'Grains', quantity: 5, unit: 'boxes' })], {
      reorders: [
        { id: 'r1', name: 'Pasta', category: 'Grains', qty: 40, unit: 'boxes', placedDate: SIM_START, arriveDate: '2026-08-22' },
      ],
    });
    const next = stepDay(state, { rng: quiet, makeId: idGen() });
    expect(next.inventory[0].quantity).toBe(45);
    expect(next.reorders).toHaveLength(0);
    expect(next.events.some((e) => e.kind === 'reorder')).toBe(true);
  });

  it('auto-reorders an item that runs out of stock', () => {
    const next = stepDay(
      baseState([
        item({ id: 'a', name: 'Tuna', category: 'Protein', quantity: 10, unit: 'cans', reorderThreshold: 30, expirationDate: '2026-08-21' }),
      ]),
      { rng: quiet, makeId: idGen() },
    );
    expect(next.inventory[0].quantity).toBe(0); // spoiled out
    const r = next.reorders.find((x) => x.name === 'Tuna');
    expect(r).toBeTruthy();
    expect(r!.qty).toBe(90); // max(30, 3 * 30)
    expect(r!.arriveDate).toBe('2026-08-24'); // simDate 08-22 + 2
    expect(next.events.some((e) => e.kind === 'reorder' && e.text.includes('Auto-reorder'))).toBe(true);
  });

  it('gives restocked items a fresh expiration (new shipment, new shelf life)', () => {
    const state = baseState([item({ id: 'a', name: 'Apples', category: 'Produce', quantity: 5, unit: 'lbs', expirationDate: '2026-08-25' })], {
      reorders: [
        { id: 'r1', name: 'Apples', category: 'Produce', qty: 40, unit: 'lbs', placedDate: SIM_START, arriveDate: '2026-08-22' },
      ],
    });
    const next = stepDay(state, { rng: quiet, makeId: idGen() });
    expect(next.inventory[0].quantity).toBe(45);
    expect(next.inventory[0].expirationDate).toBe('2026-09-03'); // 08-22 + 12 (Produce shelf life)
  });

  it('ships FEFO (soonest-expiring first) and never drives stock negative', () => {
    const inv = [
      item({ id: 'a', name: 'Later', expirationDate: '2026-12-01', quantity: 100 }),
      item({ id: 'b', name: 'Sooner', expirationDate: '2026-09-01', quantity: 100 }),
    ];
    // script: dist gate=0 (ship), n=0 (->1 item), qty factor=0 (->20%), recipient=0, households=0, donation gate=0.99 (skip)
    const next = stepDay(baseState(inv), { rng: seqRng([0, 0, 0, 0, 0, 0.99]), makeId: idGen() });
    const later = next.inventory.find((i) => i.id === 'a')!;
    const sooner = next.inventory.find((i) => i.id === 'b')!;
    expect(sooner.quantity).toBe(80); // 20% of 100 shipped
    expect(later.quantity).toBe(100); // untouched
    expect(next.inventory.every((i) => i.quantity >= 0)).toBe(true);
    expect(next.events.some((e) => e.kind === 'distribution')).toBe(true);
  });
});

describe('reorderSuggestions', () => {
  it('flags items at or below their reorder threshold with a suggested top-up', () => {
    const inv = [
      item({ id: 'ok', quantity: 100, reorderThreshold: 20 }),
      item({ id: 'low', quantity: 15, reorderThreshold: 20 }),
      item({ id: 'out', quantity: 0, reorderThreshold: 30 }),
    ];
    const s = reorderSuggestions(inv);
    expect(s.map((x) => x.item.id)).toEqual(['out', 'low']); // most depleted first, OK excluded
    expect(s.find((x) => x.item.id === 'out')!.suggestedQty).toBe(60); // 2*30 - 0
    expect(s.find((x) => x.item.id === 'low')!.suggestedQty).toBe(25); // 2*20 - 15
  });
});

describe('expiringSoon', () => {
  it('returns in-stock items within the window, most urgent first', () => {
    const now = new Date('2026-08-21T00:00:00Z');
    const inv = [
      item({ id: 'far', expirationDate: '2027-01-01' }),
      item({ id: 'soon', expirationDate: '2026-08-27' }),
      item({ id: 'expired-out', quantity: 0, expirationDate: '2026-08-22' }),
    ];
    const e = expiringSoon(inv, now, 14);
    expect(e.map((x) => x.item.id)).toEqual(['soon']); // far excluded (window), out-of-stock excluded
    expect(e[0].daysLeft).toBe(6);
  });
});
