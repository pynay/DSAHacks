'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Monthly downtown paid-parking sessions (Source J activity proxy).
export default function ActivityChart({ data }: { data: { month: string; sessions: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
        <defs>
          <linearGradient id="sessions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ca8a04" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#ca8a04" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#78716c' }}
          tickLine={false}
          axisLine={{ stroke: '#e7e5e4' }}
          ticks={data.filter((d) => d.month.endsWith('-01')).map((d) => d.month)}
          tickFormatter={(m: string) => m.slice(0, 4)}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#78716c' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
        />
        <Tooltip formatter={(v) => [Number(v).toLocaleString(), 'paid sessions']} />
        <Area type="monotone" dataKey="sessions" name="Paid parking sessions" stroke="#ca8a04" strokeWidth={2} fill="url(#sessions)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
