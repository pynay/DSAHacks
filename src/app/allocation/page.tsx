'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  PackageCheck,
  Plane,
  Send,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import { useZones } from '@/lib/useZones';
import { allocate, allocationEligibleZones } from '@/lib/allocation';
import StatCard from '@/components/StatCard';
import { inputClass } from '@/components/FormField';

function categorySummary(items: { category: string; quantity: number }[]): string {
  const byCategory = new Map<string, number>();
  for (const item of items) {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.quantity);
  }
  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 3).map(([category, quantity]) => `${category} ${quantity}`);
  const more = sorted.length - 3;
  return top.join(' · ') + (more > 0 ? ` · +${more} more` : '');
}

export default function AllocationPage() {
  const { inventory, recordDistribution } = useInventory();
  const { zones, meta, error } = useZones();
  const [unitsPerPerson, setUnitsPerPerson] = useState(3);
  const [staged, setStaged] = useState(false);

  const eligibleZones = useMemo(
    () => allocationEligibleZones(zones),
    [zones],
  );
  const excludedZones = zones.length - eligibleZones.length;
  const result = useMemo(
    () => allocate(inventory, eligibleZones, unitsPerPerson),
    [inventory, eligibleZones, unitsPerPerson],
  );

  function stage() {
    if (!eligibleZones.length) return;
    const today = new Date().toISOString().slice(0, 10);
    for (const zone of result.zones) {
      if (zone.allocated === 0) continue;
      recordDistribution({
        date: today,
        recipient: `${zone.label} distribution site`,
        type: 'mobile-pantry',
        items: zone.items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
        notes: `Operator-reviewed allocation: updated estimate ${zone.need}, ${Math.round(zone.coverage * 100)}% coverage`,
      });
    }
    setStaged(true);
  }

  const pct = (value: number) => `${Math.round(value * 100)}%`;
  const verificationRequired = eligibleZones.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Field-gated allocation</h2>
          <p className="text-sm text-slate-500">
            Applies FEFO inventory planning only to zones touched by an operator-reviewed field
            observation.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-3 xl:w-auto">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Units / person</span>
            <input
              type="number"
              min={1}
              max={20}
              value={unitsPerPerson}
              onChange={(event) => {
                setUnitsPerPerson(Math.max(1, Number(event.target.value) || 1));
                setStaged(false);
              }}
              className={`${inputClass} w-24`}
            />
          </label>
          <button
            onClick={stage}
            disabled={verificationRequired || staged || result.totalAllocated === 0}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {staged ? <CheckCircle2 size={16} /> : <Send size={16} />}
            {staged ? 'Staged' : verificationRequired ? 'Verify a zone first' : 'Stage distributions'}
          </button>
        </div>
      </div>

      {verificationRequired ? (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 xl:flex-row xl:items-center">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-amber-700" size={21} />
            <div>
              <p className="font-semibold text-amber-950">Field verification required</p>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                The six historical model priors can guide where to look, but none can create a
                distribution record until a reviewed drone or ground count updates that zone.
              </p>
            </div>
          </div>
          <Link
            href="/drone"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-950"
          >
            <Plane size={15} /> Open verification
          </Link>
        </div>
      ) : (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 xl:flex-row xl:items-center">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={21} />
            <div>
              <p className="font-semibold text-emerald-950">
                {eligibleZones.length} field-updated zone{eligibleZones.length === 1 ? '' : 's'} eligible
              </p>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                {excludedZones} historical-prior zone{excludedZones === 1 ? '' : 's'} remain visible
                for planning but are excluded from staging.
              </p>
            </div>
          </div>
          <Link
            href="/drone"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-400 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            <Plane size={15} /> Verify another zone
          </Link>
        </div>
      )}

      {staged && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Reviewed-zone distributions staged — demo inventory has been decremented. See the
          Distributions screen for the records.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {meta?.stale_source_warning && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
          Historical source: {meta.source_date}. Unverified model priors are excluded from the
          allocation below rather than treated as current headcounts.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Updated estimate"
          value={result.totalDemand ? (result.totalDemand / unitsPerPerson).toLocaleString() : '0'}
          icon={Target}
        />
        <StatCard label="Units allocated" value={result.totalAllocated.toLocaleString()} icon={PackageCheck} />
        <StatCard
          label="Coverage"
          value={pct(result.coverage)}
          icon={CheckCircle2}
          tone={result.coverage >= 1 ? 'default' : result.coverage >= 0.5 ? 'warn' : 'danger'}
        />
        <StatCard label="Units left in stock" value={result.unitsLeft.toLocaleString()} icon={Boxes} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">Reviewed zone</th>
              <th className="px-4 py-3 font-medium">Updated estimate</th>
              <th className="px-4 py-3 font-medium">Demand</th>
              <th className="px-4 py-3 font-medium">Allocated</th>
              <th className="px-4 py-3 font-medium">Coverage</th>
              <th className="px-4 py-3 font-medium">What ships</th>
            </tr>
          </thead>
          <tbody>
            {result.zones.map((zone) => (
              <tr key={zone.zoneId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-900">{zone.label}</td>
                <td className="px-4 py-3 text-slate-600">{zone.need}</td>
                <td className="px-4 py-3 text-slate-600">{zone.demand}</td>
                <td className="px-4 py-3 tabular-nums text-slate-900">{zone.allocated}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${zone.coverage >= 1 ? 'bg-emerald-500' : zone.coverage >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, zone.coverage * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{pct(zone.coverage)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {zone.items.length ? categorySummary(zone.items) : '—'}
                </td>
              </tr>
            ))}
            {result.zones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {error
                    ? 'Zones unavailable.'
                    : 'No field-updated zones yet. Apply a reviewed count in Drone Ops to unlock allocation.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Eligibility: reviewed field update required · demand = updated estimate × units/person ·
        FEFO (soonest-expiring ships first) · largest-remainder proportional split.
      </p>
    </div>
  );
}
