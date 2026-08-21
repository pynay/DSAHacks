'use client';

import { Bar, ComposedChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PitYear } from '@/lib/commonsStats';
import { projectYears } from '@/lib/project';

// Annual HUD Point-in-Time counts for the San Diego region, stacked
// sheltered/unsheltered, plus a dashed 4-year trend projection of the total.
// The projection is illustrative (linear trend), NOT a validated forecast.
export default function PitChart({ data }: { data: PitYear[] }) {
  const total = (d: PitYear) => (d.sheltered ?? 0) + (d.unsheltered ?? 0);
  const fit = data.filter((d) => total(d) > 0).map((d) => ({ year: d.year, value: total(d) }));
  const proj = projectYears(fit, 4);

  const rows: Record<string, number | null>[] = data.map((d) => ({
    year: d.year,
    sheltered: d.sheltered,
    unsheltered: d.unsheltered,
    projected: null,
  }));
  // Anchor the dashed line at the last real total so it connects to the bars.
  if (rows.length && proj.length) rows[rows.length - 1].projected = total(data[data.length - 1]);
  for (const p of proj) rows.push({ year: p.year, sheltered: null, unsheltered: null, projected: p.value });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: '#f1f5f9' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="sheltered" name="Sheltered" stackId="pit" fill="#059669" />
        <Bar dataKey="unsheltered" name="Unsheltered" stackId="pit" fill="#0284c7" radius={[4, 4, 0, 0]} />
        <Line
          dataKey="projected"
          name="Projected total (illustrative)"
          stroke="#64748b"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 2.5, fill: '#64748b', strokeWidth: 0 }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
