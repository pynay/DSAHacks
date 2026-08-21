'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ScaleupPoint } from '@/lib/scaleupSeries';

// Feeding San Diego's 5-year scale-up, indexed to FY2026 = 100 so pounds and
// headcount can share one honest axis (the IndexedSignals precedent — never a
// dual axis). Everything beyond FY26 is a projection, so both growth lines are
// dashed; today's 146 volunteers run flat and solid. The amber band is the
// chart's subject: the unfilled gap between volunteers needed and volunteers
// we actually have. Palette validated with the dataviz six-checks (CVD-safe).
const COLORS = { supply: '#2f8f63', needed: '#2a6496', current: '#64748b', gap: '#b8860b' };

function fmt(value: unknown, name: unknown, item: { payload?: ScaleupPoint }): [string, string] {
  const p = item.payload;
  if (!p) return [String(value ?? ''), String(name ?? '')];
  switch (String(name)) {
    case 'Food supply':
      return [`${(p.supplyLbs / 1e6).toFixed(1)}M lbs`, 'Food supply'];
    case 'Volunteers needed':
      return [`${Math.round(p.volunteersNeeded)} volunteers`, 'Volunteers needed'];
    case 'Volunteers today':
      return [`${Math.round(p.volunteersCurrent)} volunteers`, 'Volunteers today'];
    case 'Unfilled gap':
      return [`${Math.round(p.volunteerGap)} volunteers missing`, 'Unfilled gap'];
    default:
      return [String(value ?? ''), String(name ?? '')];
  }
}

export default function ScaleupChart({ data }: { data: ScaleupPoint[] }) {
  const rows = data.map((d) => ({ ...d, gapBand: d.neededIdx - d.currentIdx, fy: `FY${String(d.fyEnd).slice(2)}` }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="fy" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} domain={[80, 250]} />
        <Tooltip formatter={fmt} labelFormatter={(fy) => `${fy} (indexed, FY26 = 100)`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* invisible base + band = the shaded shortfall between the volunteer lines */}
        <Area dataKey="currentIdx" stackId="gap" stroke="none" fill="transparent" legendType="none" tooltipType="none" isAnimationActive={false} />
        <Area
          dataKey="gapBand"
          name="Unfilled gap"
          stackId="gap"
          stroke="none"
          fill={COLORS.gap}
          fillOpacity={0.18}
          isAnimationActive={false}
        />
        <ReferenceLine y={100} stroke="#e2e8f0" />
        <Line type="monotone" dataKey="supplyIdx" name="Food supply" stroke={COLORS.supply} strokeWidth={2} strokeDasharray="6 4" dot={false} />
        <Line type="monotone" dataKey="neededIdx" name="Volunteers needed" stroke={COLORS.needed} strokeWidth={2} strokeDasharray="6 4" dot={false} />
        <Line type="monotone" dataKey="currentIdx" name="Volunteers today" stroke={COLORS.current} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
