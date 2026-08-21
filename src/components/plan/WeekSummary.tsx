'use client';

import type { PlanGrid } from '@/lib/plan/forecast';

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function WeekSummary({
  grid,
  week,
  onUseForAllocation,
  isSelected,
}: {
  grid: PlanGrid;
  week: string;
  onUseForAllocation: () => void;
  isSelected: boolean;
}) {
  const totals = grid.totals[week];
  if (!totals) return null;

  const topZones = grid.zones
    .map((z) => ({ ...z, meals: grid.cells[z.id]?.[week]?.meals ?? 0 }))
    .sort((a, b) => b.meals - a.meals)
    .slice(0, 3);
  const totalMeals = totals.meals || 1;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Week of {weekLabel(week)}</h2>
        <button
          onClick={onUseForAllocation}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            isSelected
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-emerald-700 text-white hover:bg-emerald-800'
          }`}
        >
          {isSelected ? 'Used for allocation' : 'Use for allocation'}
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div>
          <div className="text-xs text-slate-500">Need (counted units)</div>
          <div className="text-xl font-semibold text-slate-900">
            {fmt(totals.need)}
            <span className="ml-1 text-xs font-normal text-slate-500">
              ({fmt(totals.lo)}–{fmt(totals.hi)})
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Meals</div>
          <div className="text-xl font-semibold text-slate-900">{fmt(totals.meals)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Runs</div>
          <div className="text-xl font-semibold text-slate-900">{fmt(totals.runs)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Volunteer hours</div>
          <div className="text-xl font-semibold text-slate-900">{fmt(totals.hours)}</div>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-medium text-slate-500">Top zones by meal share</h3>
        <ul className="mt-1.5 space-y-1">
          {topZones.map((z) => (
            <li key={z.id} className="flex items-center justify-between text-sm text-slate-700">
              <span>{z.label}</span>
              <span className="text-slate-500">
                {fmt(z.meals)} meals &middot; {Math.round((z.meals / totalMeals) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
