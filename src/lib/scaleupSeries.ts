// Derives the Feeding San Diego scale-up projection from the two cited anchor
// rows in seeds/feeding_sd_scaleup.csv: linear interpolation per fiscal year,
// index-to-100 values so pounds and headcount share one honest axis (the
// IndexedSignals precedent — never a dual axis), and the headline stats the
// Signals panel quotes. Pure and unit-tested (scaleupSeries.test.ts).

export interface ScaleupAnchor {
  fyEnd: number;
  supplyLbs: number;
  volunteersNeeded: number;
  volunteersCurrent: number;
  kind: string; // 'actual' | 'projected'
}

export interface ScaleupPoint {
  fyEnd: number;
  supplyLbs: number;
  volunteersNeeded: number;
  volunteersCurrent: number;
  volunteerGap: number; // needed - current: the missing workforce
  supplyIdx: number; // all *Idx are indexed to the first year = 100
  neededIdx: number;
  currentIdx: number;
  projected: boolean;
}

export interface ScaleupStats {
  loadPerVolunteerNow: number; // lbs per volunteer per year today
  loadPerVolunteerFlat: number; // final-year lbs per volunteer if headcount stays flat
  loadPerVolunteerTarget: number; // final-year lbs per volunteer at the needed headcount
  gapFinal: number; // volunteers missing in the final year
  gapPct: number; // gapFinal / needed, rounded to 2dp
  finalYear: number;
}

const EMPTY_STATS: ScaleupStats = {
  loadPerVolunteerNow: 0,
  loadPerVolunteerFlat: 0,
  loadPerVolunteerTarget: 0,
  gapFinal: 0,
  gapPct: 0,
  finalYear: 0,
};

export function buildScaleupSeries(anchors: ScaleupAnchor[]): { series: ScaleupPoint[]; stats: ScaleupStats } {
  if (!anchors.length) return { series: [], stats: { ...EMPTY_STATS } };

  const sorted = [...anchors].sort((a, b) => a.fyEnd - b.fyEnd);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last.fyEnd - first.fyEnd;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const series: ScaleupPoint[] = [];
  for (let fy = first.fyEnd; fy <= last.fyEnd; fy++) {
    const t = span === 0 ? 0 : (fy - first.fyEnd) / span;
    const supplyLbs = lerp(first.supplyLbs, last.supplyLbs, t);
    const volunteersNeeded = lerp(first.volunteersNeeded, last.volunteersNeeded, t);
    const volunteersCurrent = lerp(first.volunteersCurrent, last.volunteersCurrent, t);
    series.push({
      fyEnd: fy,
      supplyLbs,
      volunteersNeeded,
      volunteersCurrent,
      volunteerGap: volunteersNeeded - volunteersCurrent,
      supplyIdx: (supplyLbs / first.supplyLbs) * 100,
      neededIdx: (volunteersNeeded / first.volunteersNeeded) * 100,
      currentIdx: (volunteersCurrent / first.volunteersCurrent) * 100,
      projected: fy > first.fyEnd,
    });
  }

  const stats: ScaleupStats = {
    loadPerVolunteerNow: Math.round(first.supplyLbs / first.volunteersCurrent),
    loadPerVolunteerFlat: Math.round(last.supplyLbs / first.volunteersCurrent),
    loadPerVolunteerTarget: Math.round(last.supplyLbs / last.volunteersNeeded),
    gapFinal: Math.round(last.volunteersNeeded - last.volunteersCurrent),
    gapPct: Math.round(((last.volunteersNeeded - last.volunteersCurrent) / last.volunteersNeeded) * 100) / 100,
    finalYear: last.fyEnd,
  };
  return { series, stats };
}
