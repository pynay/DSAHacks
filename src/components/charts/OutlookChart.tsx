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

type HistoryPoint = { month: string; value: number };
type ForecastPoint = { month: string; value: number; lo: number; hi: number; kind: 'nowcast' | 'forecast' };

type Row = {
  month: string;
  actual: number | null;
  nowcast: number | null;
  forecast: number | null;
  band: [number, number] | null;
};

const COLOR = '#0369a1';

// All 'YYYY-MM' months from start to end inclusive, so unpublished months
// that never appear in the source data still get a row (actual: null) and
// render as a genuine break in the line, not a skipped-over connection.
function monthRange(start: string, end: string): string[] {
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  const out: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

// Downtown DSDP total: actual history, then the model's nowcast (unpublished
// recent months) bridging into the forecast horizon, with an 80% band. Single
// hue throughout (no dual axis) — nowcast vs. forecast is a dash-weight
// distinction, not a separate legend series.
export default function OutlookChart({ history, forecast }: { history: HistoryPoint[]; forecast: ForecastPoint[] }) {
  const histMap = new Map(history.map((h) => [h.month, h.value]));
  const fcMap = new Map(forecast.map((f) => [f.month, f]));
  const allMonths = [...history.map((h) => h.month), ...forecast.map((f) => f.month)].sort();
  const months =
    allMonths.length > 0 ? monthRange(allMonths[0], allMonths[allMonths.length - 1]) : [];

  const lastHistoryMonth = history[history.length - 1]?.month;
  const firstNowcastMonth = forecast.find((f) => f.kind === 'nowcast')?.month;
  const lastNowcastMonth = [...forecast].reverse().find((f) => f.kind === 'nowcast')?.month;
  const firstForecastMonth = forecast.find((f) => f.kind === 'forecast')?.month;

  const data: Row[] = months.map((month) => {
    const actual = histMap.get(month) ?? null;
    const fc = fcMap.get(month);
    const nowcast = fc?.kind === 'nowcast' ? fc.value : null;
    const forecastVal = fc?.kind === 'forecast' ? fc.value : null;
    return {
      month,
      actual,
      // Bridge the actual line into the nowcast line at the handoff month.
      nowcast: month === lastHistoryMonth && firstNowcastMonth ? actual : nowcast,
      forecast: forecastVal,
      band: fc ? [fc.lo, fc.hi] : null,
    };
  });
  // Bridge the nowcast line into the forecast line at the handoff month.
  if (lastNowcastMonth && firstForecastMonth) {
    const row = data.find((d) => d.month === lastNowcastMonth);
    const val = fcMap.get(lastNowcastMonth)?.value;
    if (row && val != null) row.forecast = val;
  }

  const janTicks = months.filter((m) => m.endsWith('-01'));

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            ticks={janTicks}
            tickFormatter={(m: string) => m.slice(0, 4)}
          />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            formatter={(value, name, item) => {
              if (name === '80% band') {
                const band = (item.payload as Row | undefined)?.band;
                return [band ? `${band[0]} – ${band[1]}` : 'N/A', name];
              }
              return [value == null ? 'N/A' : value, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area dataKey="band" name="80% band" stroke="none" fill={COLOR} fillOpacity={0.12} connectNulls legendType="rect" />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual (DSDP)"
            stroke={COLOR}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="nowcast"
            stroke={COLOR}
            strokeWidth={2}
            strokeDasharray="2 3"
            strokeOpacity={0.55}
            dot={false}
            connectNulls
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke={COLOR}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
          />
          <ReferenceLine
            x="2023-08"
            stroke="#dc2626"
            strokeDasharray="4 4"
            label={{ value: 'camping ban', position: 'insideTopLeft', fontSize: 10, fill: '#dc2626' }}
          />
          {firstForecastMonth && (
            <ReferenceLine
              x={firstForecastMonth}
              stroke="#94a3b8"
              strokeDasharray="2 2"
              label={{ value: 'forecast →', position: 'insideTopRight', fontSize: 10, fill: '#64748b' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[11px] text-slate-400">
        DSDP published totals (multiplier-adjusted). 80% band from backtest residuals. Unpublished months
        (Jul/Aug/Oct/Nov 2025) are gaps, not zeros.
      </p>
    </div>
  );
}
