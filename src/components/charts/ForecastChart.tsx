'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthPoint } from '@/lib/forecastServer';

// Actual history (solid) + model forecast (dashed), joined at the last
// observed month so the lines connect.
export default function ForecastChart({
  history,
  forecast,
}: {
  history: MonthPoint[];
  forecast: MonthPoint[];
}) {
  const data: { month: string; actual?: number; predicted?: number }[] = history.map((p) => ({
    month: p.month,
    actual: p.value,
  }));
  if (data.length && forecast.length) {
    data[data.length - 1].predicted = data[data.length - 1].actual; // join point
    for (const p of forecast) data.push({ month: p.month, predicted: p.value });
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="actual" name="311 requests (actual)" stroke="#ca8a04" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="predicted"
          name="Forecast"
          stroke="#f97316"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={{ r: 3, fill: '#f97316' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
