import { describe, it, expect } from 'vitest';
import { projectYears } from './project';

describe('projectYears', () => {
  it('extends a rising trend forward at the requested cadence', () => {
    const pts = [
      { year: 2010, value: 10 },
      { year: 2015, value: 20 },
      { year: 2019, value: 30 },
    ];
    const proj = projectYears(pts, 8, 4); // 2023, 2027
    expect(proj.map((p) => p.year)).toEqual([2023, 2027]);
    expect(proj[0].value).toBeGreaterThan(30);
    expect(proj[1].value).toBeGreaterThan(proj[0].value);
  });

  it('needs at least two points and never projects negative', () => {
    expect(projectYears([{ year: 2020, value: 5 }], 4)).toEqual([]);
    const down = projectYears(
      [
        { year: 2010, value: 50 },
        { year: 2020, value: 5 },
      ],
      40,
    );
    expect(down.every((p) => p.value >= 0)).toBe(true);
  });
});
