'use client';

import FormField, { inputClass } from '@/components/FormField';
import type { PlanParams } from '@/lib/store/types';

const HORIZONS: PlanParams['horizonWeeks'][] = [4, 8, 12];

export default function PlanParamsPanel({
  params,
  zones,
  onChange,
}: {
  params: PlanParams;
  zones: { id: string; label: string }[];
  onChange: (params: PlanParams) => void;
}) {
  const set = <K extends keyof PlanParams>(key: K, value: PlanParams[K]) => onChange({ ...params, [key]: value });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">Plan parameters</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <FormField label="Meals per person">
          <input
            type="number"
            min={0}
            step={0.5}
            className={inputClass}
            value={params.mealsPerPerson}
            onChange={(e) => set('mealsPerPerson', Number(e.target.value))}
          />
        </FormField>
        <FormField label="Hours per run">
          <input
            type="number"
            min={0}
            step={0.5}
            className={inputClass}
            value={params.hoursPerRun}
            onChange={(e) => set('hoursPerRun', Number(e.target.value))}
          />
        </FormField>
        <FormField label="Vehicle capacity (meals)">
          <input
            type="number"
            min={1}
            step={10}
            className={inputClass}
            value={params.vehicleCapacity}
            onChange={(e) => set('vehicleCapacity', Number(e.target.value))}
          />
        </FormField>
        <FormField label="Coverage share (%)">
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            className={inputClass}
            value={Math.round(params.coverageShare * 100)}
            onChange={(e) => set('coverageShare', Number(e.target.value) / 100)}
          />
        </FormField>
        <FormField label="Stale after (days)">
          <input
            type="number"
            min={1}
            step={1}
            className={inputClass}
            value={params.staleAfterDays}
            onChange={(e) => set('staleAfterDays', Number(e.target.value))}
          />
        </FormField>
        <FormField label="Horizon">
          <select
            className={inputClass}
            value={params.horizonWeeks}
            onChange={(e) => set('horizonWeeks', Number(e.target.value) as PlanParams['horizonWeeks'])}
          >
            {HORIZONS.map((h) => (
              <option key={h} value={h}>
                {h} weeks
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">Plan to</span>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 text-xs">
          {(['point', 'upper80'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => set('planTo', mode)}
              className={`rounded-md px-2.5 py-1.5 font-medium transition ${
                params.planTo === mode ? 'bg-[#54b889] text-[#071a2b]' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {mode === 'point' ? 'Point estimate' : 'Upper 80% band'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-700">Visits per week, by zone</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {zones.map((z) => (
            <FormField key={z.id} label={z.label}>
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                value={params.visitsPerWeek[z.id] ?? 1}
                onChange={(e) =>
                  set('visitsPerWeek', { ...params.visitsPerWeek, [z.id]: Number(e.target.value) })
                }
              />
            </FormField>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[11px] text-slate-400">
        Monthly model, weekly cadence: the forecast is monthly per neighborhood; each month&apos;s need and
        band are spread evenly across its weeks. Bands are never narrowed by the spread.
      </p>
    </div>
  );
}
