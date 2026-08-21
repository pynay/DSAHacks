'use client';

// Slope of La Jolla's low-access share across FARA vintages. A slope makes the
// change (the job of the data) the visual, with direct value labels so no axis
// reading is needed.
export default function LaJollaSlope({ data }: { data: { year: number; lowAccessShare: number }[] }) {
  const w = 260;
  const h = 120;
  const pad = { l: 20, r: 20, t: 20, b: 20 };
  const maxY = Math.max(50, ...data.map((d) => d.lowAccessShare));
  const xAt = (i: number) => pad.l + (w - pad.l - pad.r) * (data.length > 1 ? i / (data.length - 1) : 0);
  const yAt = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / maxY);
  const pts = data.map((d, i) => `${xAt(i)},${yAt(d.lowAccessShare)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="La Jolla low-access share by vintage">
      <polyline points={pts} fill="none" stroke="#be185d" strokeWidth={2.5} strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.year}>
          <circle cx={xAt(i)} cy={yAt(d.lowAccessShare)} r={4} fill="#be185d" stroke="#fff" strokeWidth={1.5} />
          <text x={xAt(i)} y={yAt(d.lowAccessShare) - 9} textAnchor="middle" fontSize="12" fontWeight={700} fill="#0f172a">
            {Math.round(d.lowAccessShare)}%
          </text>
          <text x={xAt(i)} y={h - 5} textAnchor="middle" fontSize="10" fill="#64748b">
            {d.year}
          </text>
        </g>
      ))}
    </svg>
  );
}
