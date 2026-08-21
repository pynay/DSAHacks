'use client';

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Three downtown signals of different scale, each indexed to 100 at its OWN
// average over the shared window so they collapse onto ONE axis (never a
// dual-axis) and stay mutually readable. Indexing to a fixed start month would
// let the parking proxy's COVID-low 2021 base explode it to ~800 and crush the
// need signals; "% of typical" keeps every series near 100. Categorical hues
// (validated CVD-safe), legend present, hover tooltip. Shows whether
// homelessness need, 311 pressure, and downtown activity move together.
type Pt = { month: string; value: number | null };

const COLORS = { homeless: '#0369a1', requests: '#ca8a04', activity: '#be185d' };

function indexTo100(series: Pt[], months: string[]): (number | null)[] {
  const map = new Map(series.map((p) => [p.month, p.value]));
  const inWindow = months.map((m) => map.get(m)).filter((v): v is number => v != null);
  const base = inWindow.length ? inWindow.reduce((s, v) => s + v, 0) / inWindow.length : null;
  if (!base) return months.map(() => null);
  return months.map((m) => {
    const v = map.get(m);
    return v == null ? null : Math.round((v / base) * 100);
  });
}

export default function IndexedSignals({
  dsdp,
  requests,
  parking,
}: {
  dsdp: Pt[];
  requests: Pt[];
  parking: Pt[];
}) {
  // Common window: from the first month all three have data, to the last.
  const has = (s: Pt[]) => new Set(s.filter((p) => p.value != null).map((p) => p.month));
  const [d, r, p] = [has(dsdp), has(requests), has(parking)];
  const all = [...new Set([...dsdp, ...requests, ...parking].map((x) => x.month))].sort();
  const start = all.find((m) => d.has(m) && r.has(m) && p.has(m));
  const end = [...all].reverse().find((m) => d.has(m) && r.has(m) && p.has(m));
  const months = all.filter((m) => start && end && m >= start && m <= end);

  const di = indexTo100(dsdp, months);
  const ri = indexTo100(requests, months);
  const pi = indexTo100(parking, months);
  const data = months.map((month, i) => ({ month, homeless: di[i], requests: ri[i], activity: pi[i] }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <ReferenceLine y={100} stroke="#cbd5e1" strokeDasharray="4 4" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
          ticks={months.filter((m) => m.endsWith('-01'))}
          tickFormatter={(m: string) => m.slice(0, 4)}
        />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}`} />
        <Tooltip formatter={(v, name) => [v == null ? 'N/A' : `${v} (index)`, name]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="homeless" name="Homelessness (DSDP)" stroke={COLORS.homeless} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="requests" name="311 requests" stroke={COLORS.requests} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="activity" name="Downtown activity" stroke={COLORS.activity} strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
