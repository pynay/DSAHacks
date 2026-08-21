import { expect, test } from 'vitest';
import { buildScaleupSeries, type ScaleupAnchor } from './scaleupSeries';

const ANCHORS: ScaleupAnchor[] = [
  { fyEnd: 2026, supplyLbs: 37_400_000, volunteersNeeded: 146, volunteersCurrent: 146, kind: 'actual' },
  { fyEnd: 2031, supplyLbs: 87_400_000, volunteersNeeded: 240, volunteersCurrent: 146, kind: 'projected' },
];

test('interpolates one row per fiscal year between the anchors', () => {
  const { series } = buildScaleupSeries(ANCHORS);
  expect(series.map((r) => r.fyEnd)).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
});

test('endpoints match the anchors exactly', () => {
  const { series } = buildScaleupSeries(ANCHORS);
  expect(series[0].supplyLbs).toBe(37_400_000);
  expect(series[5].supplyLbs).toBe(87_400_000);
  expect(series[5].volunteersNeeded).toBe(240);
  expect(series[5].volunteersCurrent).toBe(146);
});

test('interpolation is linear (fy2028 = 40% of the way)', () => {
  const { series } = buildScaleupSeries(ANCHORS);
  const y2028 = series.find((r) => r.fyEnd === 2028)!;
  expect(y2028.supplyLbs).toBeCloseTo(57_400_000, 0);
  expect(y2028.volunteersNeeded).toBeCloseTo(183.6, 1);
  expect(y2028.volunteerGap).toBeCloseTo(37.6, 1);
});

test('index-to-100 uses the first year as base', () => {
  const { series } = buildScaleupSeries(ANCHORS);
  expect(series[0].supplyIdx).toBe(100);
  expect(series[0].neededIdx).toBe(100);
  expect(series[5].supplyIdx).toBeCloseTo(233.69, 1);
  expect(series[5].neededIdx).toBeCloseTo(164.38, 1);
  expect(series[5].currentIdx).toBe(100);
});

test('derives the load and gap stats', () => {
  const { stats } = buildScaleupSeries(ANCHORS);
  expect(stats.loadPerVolunteerNow).toBe(256_164);
  expect(stats.loadPerVolunteerFlat).toBe(598_630);
  expect(stats.loadPerVolunteerTarget).toBe(364_167);
  expect(stats.gapFinal).toBe(94);
  expect(stats.gapPct).toBe(0.39);
  expect(stats.finalYear).toBe(2031);
});

test('a single anchor yields a single point and sane stats', () => {
  const { series, stats } = buildScaleupSeries([ANCHORS[0]]);
  expect(series).toHaveLength(1);
  expect(series[0].supplyIdx).toBe(100);
  expect(stats.gapFinal).toBe(0);
});

test('empty anchors yield an empty series without throwing', () => {
  const { series, stats } = buildScaleupSeries([]);
  expect(series).toEqual([]);
  expect(stats.gapFinal).toBe(0);
});
