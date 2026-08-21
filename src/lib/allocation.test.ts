import { describe, it, expect } from 'vitest';
import type { InventoryItem } from './types';
import type { DeliveryZone } from './delivery';
import { allocate, redistributeNeed } from './allocation';

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

function zone(over: Partial<DeliveryZone> = {}): DeliveryZone {
  return {
    id: 'z1',
    neighborhood: 'z1',
    label: 'Zone 1',
    lng: -117.16,
    lat: 32.71,
    blocks: 10,
    need: 100,
    requests: 0,
    observed: 0,
    violations: 0,
    ...over,
  };
}

describe('allocate', () => {
  it('splits stock across zones proportionally to need', () => {
    const inv = [item({ quantity: 300 })];
    const zones = [
      zone({ id: 'a', need: 200 }),
      zone({ id: 'b', need: 100 }),
    ];
    // demand = need * 1 => 200 + 100 = 300 = stock, everything ships
    const r = allocate(inv, zones, 1);
    expect(r.totalAllocated).toBe(300);
    expect(r.zones.find((z) => z.zoneId === 'a')!.allocated).toBe(200);
    expect(r.zones.find((z) => z.zoneId === 'b')!.allocated).toBe(100);
    expect(r.coverage).toBe(1);
  });

  it('caps allocation at available stock', () => {
    const inv = [item({ quantity: 30 })];
    const zones = [zone({ id: 'a', need: 100 })];
    const r = allocate(inv, zones, 1); // demand 100, stock 30
    expect(r.totalAllocated).toBe(30);
    expect(r.zones[0].allocated).toBe(30);
    expect(r.zones[0].coverage).toBeCloseTo(0.3);
    expect(r.unitsLeft).toBe(0);
  });

  it('caps allocation at demand and leaves surplus stock', () => {
    const inv = [item({ quantity: 500 })];
    const zones = [zone({ id: 'a', need: 100 })];
    const r = allocate(inv, zones, 1); // demand 100, stock 500
    expect(r.totalAllocated).toBe(100);
    expect(r.unitsLeft).toBe(400);
    expect(r.coverage).toBe(1);
  });

  it('ships soonest-expiring items first (FEFO)', () => {
    const inv = [
      item({ id: 'late', name: 'Late', quantity: 50, expirationDate: '2027-06-01' }),
      item({ id: 'soon', name: 'Soon', quantity: 50, expirationDate: '2026-09-01' }),
    ];
    const zones = [zone({ id: 'a', need: 50 })];
    const r = allocate(inv, zones, 1); // demand 50 -> only the soon-expiring item ships
    const names = r.zones[0].items.map((i) => i.name);
    expect(names).toEqual(['Soon']);
    expect(r.zones[0].items[0].quantity).toBe(50);
  });

  it('conserves units: item totals across zones match what was sent', () => {
    const inv = [item({ quantity: 10 })];
    const zones = [
      zone({ id: 'a', need: 70 }),
      zone({ id: 'b', need: 30 }),
    ];
    const r = allocate(inv, zones, 1);
    const sum = r.zones.flatMap((z) => z.items).reduce((s, i) => s + i.quantity, 0);
    expect(sum).toBe(10);
    expect(r.totalAllocated).toBe(10);
  });

  it('excludes zones with zero need', () => {
    const inv = [item({ quantity: 100 })];
    const zones = [zone({ id: 'a', need: 100 }), zone({ id: 'custom', need: 0, custom: true })];
    const r = allocate(inv, zones, 1);
    expect(r.zones.map((z) => z.zoneId)).toEqual(['a']);
  });

  it('scales demand by unitsPerPerson', () => {
    const inv = [item({ quantity: 1000 })];
    const zones = [zone({ id: 'a', need: 100 })];
    const r = allocate(inv, zones, 3);
    expect(r.totalDemand).toBe(300);
    expect(r.totalAllocated).toBe(300);
  });

  it('handles empty inventory and empty zones', () => {
    expect(allocate([], [zone()], 1).totalAllocated).toBe(0);
    const r = allocate([item()], [], 1);
    expect(r.totalAllocated).toBe(0);
    expect(r.unitsLeft).toBe(100);
    expect(r.coverage).toBe(0);
  });
});

describe('redistributeNeed', () => {
  it('re-splits total need by forecast shares, preserving the total exactly', () => {
    const zones = [zone({ id: 'a', need: 100 }), zone({ id: 'b', need: 200 })];
    const out = redistributeNeed(zones, { a: 75, b: 25 }); // shares 0.75 / 0.25
    expect(out.find((z) => z.id === 'a')!.need).toBe(225);
    expect(out.find((z) => z.id === 'b')!.need).toBe(75);
    expect(out.reduce((s, z) => s + z.need, 0)).toBe(300);
  });

  it('preserves the total under rounding (largest remainder)', () => {
    const zones = [zone({ id: 'a', need: 50 }), zone({ id: 'b', need: 50 }), zone({ id: 'c', need: 1 })];
    const out = redistributeNeed(zones, { a: 1, b: 1, c: 1 }); // thirds of 101
    expect(out.reduce((s, z) => s + z.need, 0)).toBe(101);
  });

  it('gives zero to zones without a forecast weight and falls back when no weights match', () => {
    const zones = [zone({ id: 'a', need: 100 }), zone({ id: 'b', need: 100 })];
    const out = redistributeNeed(zones, { a: 40 });
    expect(out.find((z) => z.id === 'a')!.need).toBe(200);
    expect(out.find((z) => z.id === 'b')!.need).toBe(0);
    expect(redistributeNeed(zones, {})).toEqual(zones); // no usable weights -> unchanged
  });

  it('does not mutate its input', () => {
    const zones = [zone({ id: 'a', need: 100 }), zone({ id: 'b', need: 200 })];
    redistributeNeed(zones, { a: 1, b: 3 });
    expect(zones[0].need).toBe(100);
    expect(zones[1].need).toBe(200);
  });
});
