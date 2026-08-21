'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PitYear } from '@/lib/commonsStats';

// Annual HUD Point-in-Time counts for the San Diego region, stacked
// sheltered/unsheltered. (No 2021 bar: the unsheltered count was not
// conducted that year.)
export default function PitChart({ data }: { data: PitYear[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={{ stroke: '#e7e5e4' }} />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: '#fefce8' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="sheltered" name="Sheltered" stackId="pit" fill="#ca8a04" />
        <Bar dataKey="unsheltered" name="Unsheltered" stackId="pit" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
