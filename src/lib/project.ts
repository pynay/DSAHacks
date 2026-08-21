// Least-squares linear trend projection. ILLUSTRATIVE ONLY — it extends a sparse
// historical series forward by drawing its trend, and is never a validated
// forecast (the only backtested model in the app is the 3-month 311 forecast).
// Charts render these points dashed and labeled "projected (illustrative)".

export function linearFit(xs: number[], ys: number[]): { m: number; b: number } {
  const n = xs.length;
  if (n === 0) return { m: 0, b: 0 };
  const sx = xs.reduce((a, x) => a + x, 0);
  const sy = ys.reduce((a, y) => a + y, 0);
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const denom = n * sxx - sx * sx || 1;
  const m = (n * sxy - sx * sy) / denom;
  const b = (sy - m * sx) / n;
  return { m, b };
}

// Project `forwardYears` beyond the last point, stepping by `stepYears`.
export function projectYears(
  points: { year: number; value: number }[],
  forwardYears: number,
  stepYears = 1,
): { year: number; value: number }[] {
  if (points.length < 2) return [];
  const { m, b } = linearFit(
    points.map((p) => p.year),
    points.map((p) => p.value),
  );
  const lastYear = points[points.length - 1].year;
  const out: { year: number; value: number }[] = [];
  for (let y = lastYear + stepYears; y <= lastYear + forwardYears; y += stepYears) {
    out.push({ year: y, value: Math.max(0, Math.round((m * y + b) * 100) / 100) });
  }
  return out;
}
