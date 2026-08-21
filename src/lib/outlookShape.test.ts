import { describe, it, expect } from 'vitest';
import { sumBands, beatsNaiveThrough } from './outlookShape';

describe('sumBands', () => {
  it('sums value/lo/hi per month and rounds', () => {
    const rows = [
      { month: '2026-01', value: 10.4, lo: 8, hi: 12 },
      { month: '2026-01', value: 20.4, lo: 15, hi: 25 },
      { month: '2026-02', value: 5, lo: 4, hi: 6 },
    ];
    expect(sumBands(rows)).toEqual([
      { month: '2026-01', value: 31, lo: 23, hi: 37 },
      { month: '2026-02', value: 5, lo: 4, hi: 6 },
    ]);
  });
});

describe('beatsNaiveThrough', () => {
  it('returns the longest prefix of horizons where model beats seasonal naive', () => {
    const bt = [1, 2, 3, 4].map((h) => ({ horizon: h, model_mae: h <= 2 ? 10 : 30, seasonal_naive_mae: 20 }));
    expect(beatsNaiveThrough(bt)).toBe(2);
    expect(beatsNaiveThrough(bt.map((r) => ({ ...r, model_mae: 99 })))).toBe(0);
  });
});
