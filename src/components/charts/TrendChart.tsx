'use client';

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function TrendChart({ data }: { data: { label: string; intake: number; outflow: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="intake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ca8a04" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#ca8a04" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="outflow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={{ stroke: '#e7e5e4' }} />
        <YAxis tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="intake" name="Intake" stroke="#ca8a04" fill="url(#intake)" strokeWidth={2} />
        <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#f97316" fill="url(#outflow)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
