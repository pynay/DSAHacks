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

// Smallest horizon h such that model_mae < last_value_mae for every horizon >= h
// (0 if the model never beats naive persistence for the rest of the horizon range).
export function beatsLastValueFrom(
  bt: { horizon: number; model_mae: number; last_value_mae: number }[],
): number {
  const sorted = [...bt].sort((a, b) => a.horizon - b.horizon);
  for (const candidate of sorted) {
    const rest = sorted.filter((r) => r.horizon >= candidate.horizon);
    if (rest.every((r) => r.model_mae < r.last_value_mae)) return candidate.horizon;
  }
  return 0;
}
