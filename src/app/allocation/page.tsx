'use client';

import { useMemo, useState } from 'react';
import { Boxes, CheckCircle2, PackageCheck, Send, Target } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import { useZones } from '@/lib/useZones';
import { allocate } from '@/lib/allocation';
import StatCard from '@/components/StatCard';
import { inputClass } from '@/components/FormField';

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

  const result = useMemo(
    () => allocate(inventory, zones, unitsPerPerson),
    [inventory, zones, unitsPerPerson],
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
          <h2 className="font-semibold text-stone-900">Need-based allocation</h2>
          <p className="text-sm text-stone-500">
            Splits current stock across delivery zones proportionally to need (from the data
            commons), shipping soonest-expiring items first.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-500">Units / person</span>
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
            className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
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
              <tr key={z.zoneId} className="border-b border-stone-100 last:border-0 hover:bg-yellow-50/50">
                <td className="px-4 py-3 font-medium text-stone-900">{z.label}</td>
                <td className="px-4 py-3 text-stone-600">{z.need}</td>
                <td className="px-4 py-3 text-stone-600">{z.demand}</td>
                <td className="px-4 py-3 tabular-nums text-stone-900">{z.allocated}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full rounded-full ${z.coverage >= 1 ? 'bg-emerald-500' : z.coverage >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, z.coverage * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-stone-500">{pct(z.coverage)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-stone-500">
                  {z.items.length ? categorySummary(z.items) : '—'}
                </td>
              </tr>
            ))}
            {result.zones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  {error ? 'Zones unavailable.' : 'Loading zones…'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-400">
        Method: demand = need × units/person · FEFO (soonest-expiring ships first) ·
        largest-remainder proportional split, capped by stock and demand.
      </p>
    </div>
  );
}
