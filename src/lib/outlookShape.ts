export interface BandRow {
  month: string;
  value: number;
  lo: number;
  hi: number;
}

export function sumBands(rows: BandRow[]): BandRow[] {
  const m = new Map<string, BandRow>();
  for (const r of rows) {
    const cur = m.get(r.month) ?? { month: r.month, value: 0, lo: 0, hi: 0 };
    m.set(r.month, { month: r.month, value: cur.value + r.value, lo: cur.lo + r.lo, hi: cur.hi + r.hi });
  }
  return [...m.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ month: r.month, value: Math.round(r.value), lo: Math.round(r.lo), hi: Math.round(r.hi) }));
}

export function beatsNaiveThrough(
  bt: { horizon: number; model_mae: number; seasonal_naive_mae: number }[],
): number {
  let k = 0;
  for (const r of [...bt].sort((a, b) => a.horizon - b.horizon)) {
    if (r.model_mae < r.seasonal_naive_mae && r.horizon === k + 1) k = r.horizon;
    else break;
  }
  return k;
}
