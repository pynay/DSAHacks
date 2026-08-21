'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Downtown DSDP monthly adjusted totals, 2017-2025, the challenge's core
// historical series. connectNulls is intentionally OFF so the provider's true
// reporting gaps (4 months in 2025) render as gaps, not interpolated lines.
export default function DsdpChart({ data }: { data: { month: string; value: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
          ticks={data.filter((d) => d.month.endsWith('-01')).map((d) => d.month)}
          tickFormatter={(m: string) => m.slice(0, 4)}
        />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          name="Unsheltered (DSDP adjusted)"
          stroke="#ca8a04"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
