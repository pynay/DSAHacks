'use client';

import { projectYears } from '@/lib/project';

// Slope of La Jolla's low-access share across FARA vintages (2010/2015/2019),
// with a dashed illustrative trend projection to the next two vintages. The
// projection is a linear trend, NOT a validated forecast.
export default function LaJollaSlope({ data }: { data: { year: number; lowAccessShare: number }[] }) {
  const proj = projectYears(data.map((d) => ({ year: d.year, value: d.lowAccessShare })), 8, 4).map((p) => ({
    year: p.year,
    lowAccessShare: p.value,
    projected: true,
  }));
  const real = data.map((d) => ({ ...d, projected: false }));
  const all = [...real, ...proj];

  const w = 300;
  const h = 124;
  const pad = { l: 20, r: 24, t: 22, b: 20 };
  const maxY = Math.max(50, ...all.map((d) => d.lowAccessShare));
  const xAt = (i: number) => pad.l + (w - pad.l - pad.r) * (all.length > 1 ? i / (all.length - 1) : 0);
  const yAt = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / maxY);

  const realPts = real.map((d, i) => `${xAt(i)},${yAt(d.lowAccessShare)}`).join(' ');
  // Dashed segment: from the last real point through the projected points.
  const projPath = [real.length - 1, ...proj.map((_, k) => real.length + k)]
    .map((i) => `${xAt(i)},${yAt(all[i].lowAccessShare)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label="La Jolla low-access share by vintage with illustrative projection"
    >
      <polyline points={realPts} fill="none" stroke="#be185d" strokeWidth={2.5} strokeLinejoin="round" />
      {proj.length > 0 && (
        <polyline points={projPath} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
      )}
      {all.map((d, i) => (
        <g key={d.year}>
          <circle
            cx={xAt(i)}
            cy={yAt(d.lowAccessShare)}
            r={4}
            fill={d.projected ? '#ffffff' : '#be185d'}
            stroke={d.projected ? '#94a3b8' : '#ffffff'}
            strokeWidth={1.5}
          />
          <text
            x={xAt(i)}
            y={yAt(d.lowAccessShare) - 9}
            textAnchor="middle"
            fontSize="11"
            fontWeight={700}
            fill={d.projected ? '#94a3b8' : '#0f172a'}
          >
            {Math.round(d.lowAccessShare)}%
          </text>
          <text x={xAt(i)} y={h - 5} textAnchor="middle" fontSize="10" fill="#64748b">
            {d.year}
          </text>
        </g>
      ))}
      <text x={w - pad.r} y={11} textAnchor="end" fontSize="8.5" fill="#94a3b8">
        - - projected (illustrative)
      </text>
    </svg>
  );
}
