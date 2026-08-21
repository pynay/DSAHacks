'use client';

import { useEffect, useMemo, useState } from 'react';
import { Boxes, CheckCircle2, PackageCheck, Send, Target, TrendingUp } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import { useZones } from '@/lib/useZones';
import { allocate, redistributeNeed } from '@/lib/allocation';
import type { ForecastPayload } from '@/lib/forecastServer';
import StatCard from '@/components/StatCard';
import ForecastChart from '@/components/charts/ForecastChart';
import { inputClass } from '@/components/FormField';

interface ForecastMeta {
  model: string;
  horizon_months: number;
  train_window: { start: string; end: string; n_rows: number };
  backtest: {
    window_months: number;
    n_predictions: number;
    model_mae: number;
    naive_last_month_mae: number;
    seasonal_naive_mae: number;
  };
  generated_on: string;
}

function categorySummary(items: { category: string; quantity: number }[]): string {
  const byCat = new Map<string, number>();
  for (const i of items) byCat.set(i.category, (byCat.get(i.category) ?? 0) + i.quantity);
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 3).map(([c, n]) => `${c} ${n}`);
  const more = sorted.length - 3;
  return top.join(' · ') + (more > 0 ? ` · +${more} more` : '');
}

export default function AllocationPage() {
  const { inventory, recordDistribution } = useInventory();
  const { zones, error } = useZones();
  const [unitsPerPerson, setUnitsPerPerson] = useState(3);
  const [staged, setStaged] = useState(false);
  const [mode, setMode] = useState<'current' | 'predicted'>('current');
  const [forecast, setForecast] = useState<ForecastPayload | null>(null);

  useEffect(() => {
    fetch('/api/forecast')
      .then((r) => r.json())
      .then((d) => {
        if (d.total) setForecast(d);
      })
      .catch(() => {});
  }, []);

  const allocZones = useMemo(() => {
    if (mode === 'predicted' && forecast) {
      const weights = Object.fromEntries(forecast.hoods.map((h) => [h.id, h.nextPredicted]));
      return redistributeNeed(zones, weights);
    }
    return zones;
  }, [zones, mode, forecast]);

  const result = useMemo(
    () => allocate(inventory, allocZones, unitsPerPerson),
    [inventory, allocZones, unitsPerPerson],
  );

  function stage() {
    const today = new Date().toISOString().slice(0, 10);
    for (const z of result.zones) {
      if (z.allocated === 0) continue;
      recordDistribution({
        date: today,
        recipient: `${z.label} drop zone`,
        type: 'mobile-pantry',
        items: z.items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
        notes: `Auto-allocated: need ${z.need}, ${Math.round(z.coverage * 100)}% coverage`,
      });
    }
    setStaged(true);
  }

  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Need-based allocation</h2>
          <p className="text-sm text-slate-500">
            Splits current stock across delivery zones proportionally to need (from the data
            commons), shipping soonest-expiring items first.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500">Allocate on</span>
            <div className="flex overflow-hidden rounded-lg border border-slate-300">
              <button
                onClick={() => {
                  setMode('current');
                  setStaged(false);
                }}
                className={`px-3 py-2 text-sm font-medium ${mode === 'current' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Current need
              </button>
              <button
                onClick={() => {
                  setMode('predicted');
                  setStaged(false);
                }}
                disabled={!forecast}
                className={`flex items-center gap-1 px-3 py-2 text-sm font-medium disabled:opacity-40 ${mode === 'predicted' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <TrendingUp size={14} /> Predicted
              </button>
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Units / person</span>
            <input
              type="number"
              min={1}
              max={20}
              value={unitsPerPerson}
              onChange={(e) => {
                setUnitsPerPerson(Math.max(1, Number(e.target.value) || 1));
                setStaged(false);
              }}
              className={`${inputClass} w-24`}
            />
          </label>
          <button
            onClick={stage}
            disabled={staged || result.totalAllocated === 0}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {staged ? <CheckCircle2 size={16} /> : <Send size={16} />}
            {staged ? 'Staged' : 'Stage distributions'}
          </button>
        </div>
      </div>

      {staged && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Distributions staged — inventory has been decremented. See the Distributions screen for
          the records. Adjust units/person to plan another run.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Target demand" value={result.totalDemand.toLocaleString()} icon={Target} />
        <StatCard label="Units allocated" value={result.totalAllocated.toLocaleString()} icon={PackageCheck} />
        <StatCard
          label="Coverage"
          value={pct(result.coverage)}
          icon={CheckCircle2}
          tone={result.coverage >= 1 ? 'default' : result.coverage >= 0.5 ? 'warn' : 'danger'}
        />
        <StatCard label="Units left in stock" value={result.unitsLeft.toLocaleString()} icon={Boxes} />
      </div>

      {mode === 'predicted' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Predictive mode: total demand is unchanged, but its split across zones follows each
          neighborhood&apos;s <b>predicted next-month 311 share</b> instead of the latest counted
          need — pre-positioning food where pressure is heading.
        </p>
      )}

      {forecast && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
            <h3 className="font-semibold text-slate-900">Downtown need forecast</h3>
            <p className="mb-1 text-xs text-slate-500">
              Monthly 311 homelessness-related requests, all six neighborhoods combined — 24 months
              actual + {(forecast.meta as ForecastMeta).horizon_months}-month model forecast.
            </p>
            <ForecastChart history={forecast.total.history} forecast={forecast.total.forecast} />
            <div className="mt-2 flex flex-wrap gap-2">
              {forecast.hoods.map((h) => {
                const delta = h.lastActual > 0 ? (h.nextPredicted - h.lastActual) / h.lastActual : 0;
                const up = h.nextPredicted >= h.lastActual;
                return (
                  <span
                    key={h.id}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${up ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}
                    title={`last ${h.lastActual} → predicted ${h.nextPredicted}`}
                  >
                    {h.label} {up ? '↑' : '↓'}
                    {Math.abs(Math.round(delta * 100))}%
                  </span>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900">Model card</h3>
            {(() => {
              const m = forecast.meta as ForecastMeta;
              const vsNaive =
                ((m.backtest.naive_last_month_mae - m.backtest.model_mae) /
                  m.backtest.naive_last_month_mae) *
                100;
              return (
                <dl className="mt-2 space-y-2 text-xs text-slate-600">
                  <div>
                    <dt className="font-medium text-slate-800">Model</dt>
                    <dd>{m.model}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-800">Training data</dt>
                    <dd>
                      {m.train_window.n_rows} neighborhood-months, {m.train_window.start} →{' '}
                      {m.train_window.end}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-800">
                      Backtest (rolling, last {m.backtest.window_months} months,{' '}
                      {m.backtest.n_predictions} predictions)
                    </dt>
                    <dd>
                      MAE <b>{m.backtest.model_mae}</b> vs last-month naive{' '}
                      {m.backtest.naive_last_month_mae} ({vsNaive.toFixed(1)}% better) · seasonal
                      naive {m.backtest.seasonal_naive_mae}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-800">Caveats</dt>
                    <dd>
                      Aggregate neighborhood-level demand forecasting for aid pre-positioning. 311
                      signals are proxies with known biases, never headcounts. No individual-level
                      data exists in the commons.
                    </dd>
                  </div>
                  <div className="text-slate-400">
                    Generated {m.generated_on} · ml/forecast.py (deterministic)
                  </div>
                </dl>
              );
            })()}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 font-medium">Need</th>
              <th className="px-4 py-3 font-medium">Demand</th>
              <th className="px-4 py-3 font-medium">Allocated</th>
              <th className="px-4 py-3 font-medium">Coverage</th>
              <th className="px-4 py-3 font-medium">What ships</th>
            </tr>
          </thead>
          <tbody>
            {result.zones.map((z) => (
              <tr key={z.zoneId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-900">{z.label}</td>
                <td className="px-4 py-3 text-slate-600">{z.need}</td>
                <td className="px-4 py-3 text-slate-600">{z.demand}</td>
                <td className="px-4 py-3 tabular-nums text-slate-900">{z.allocated}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${z.coverage >= 1 ? 'bg-emerald-500' : z.coverage >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, z.coverage * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{pct(z.coverage)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {z.items.length ? categorySummary(z.items) : '—'}
                </td>
              </tr>
            ))}
            {result.zones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {error ? 'Zones unavailable.' : 'Loading zones…'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Method: demand = need × units/person · FEFO (soonest-expiring ships first) ·
        largest-remainder proportional split, capped by stock and demand.
      </p>
    </div>
  );
}
