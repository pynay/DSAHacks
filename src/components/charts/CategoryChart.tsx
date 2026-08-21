'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function CategoryChart({ data }: { data: { category: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
        <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={{ stroke: '#e7e5e4' }} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: '#fefce8' }} />
        <Bar dataKey="total" fill="#ca8a04" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
