import { describe, it, expect } from 'vitest';
import { sumBands, beatsNaiveThrough, beatsLastValueFrom } from './outlookShape';

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

describe('beatsLastValueFrom', () => {
  it('returns the smallest horizon from which the model beats naive persistence through the end', () => {
    // Matches the real backtest shape: model loses at 1-3, wins at 4-12.
    const bt = [1, 2, 3, 4, 5, 6].map((h) => ({
      horizon: h,
      model_mae: h < 4 ? 30 : 10,
      last_value_mae: h < 4 ? 28 : 40,
    }));
    expect(beatsLastValueFrom(bt)).toBe(4);
  });

  it('returns 0 when the model never wins for the rest of the range', () => {
    const bt = [1, 2, 3].map((h) => ({ horizon: h, model_mae: 99, last_value_mae: 10 }));
    expect(beatsLastValueFrom(bt)).toBe(0);
  });

  it('returns 1 when the model wins at every horizon', () => {
    const bt = [1, 2, 3].map((h) => ({ horizon: h, model_mae: 10, last_value_mae: 99 }));
    expect(beatsLastValueFrom(bt)).toBe(1);
  });

  it('ignores a single later loss that breaks an otherwise-winning streak', () => {
    // Wins at 1-2, loses at 3, wins again at 4-5: only horizon 4 has a clean run to the end.
    const bt = [
      { horizon: 1, model_mae: 10, last_value_mae: 99 },
      { horizon: 2, model_mae: 10, last_value_mae: 99 },
      { horizon: 3, model_mae: 99, last_value_mae: 10 },
      { horizon: 4, model_mae: 10, last_value_mae: 99 },
      { horizon: 5, model_mae: 10, last_value_mae: 99 },
    ];
    expect(beatsLastValueFrom(bt)).toBe(4);
  });
});
