'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Utensils, Route, Clock, Gauge } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import { categoryTotals, recentActivity } from '@/lib/dashboard';
import type { OutlookPayload } from '@/lib/outlookServer';
import type { DeliveryZone } from '@/lib/delivery';
import { buildPlanGrid, NEIGHBORHOODS } from '@/lib/plan/forecast';
import { zoneEvidence } from '@/lib/plan/evidence';
import { attentionItems, type AttentionSeverity } from '@/lib/today';
import StatCard from '@/components/StatCard';
import ActivityFeed from '@/components/ActivityFeed';
import CategoryChart from '@/components/charts/CategoryChart';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const SEVERITY_TONE: Record<AttentionSeverity, string> = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-slate-100 text-slate-600',
};

export default function DashboardPage() {
  const { inventory, donations, distributions, ledger, params, overrides, drafts } = useInventory();
  const today = todayISO();

  const [outlook, setOutlook] = useState<OutlookPayload | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);

  useEffect(() => {
    fetch('/api/outlook')
      .then((r) => r.json())
      .then((d) => {
        if (d.forecast) setOutlook(d);
      })
      .catch(() => {});
    fetch('/api/zones')
      .then((r) => r.json())
      .then((d) => {
        if (d.zones) setZones(d.zones);
      })
      .catch(() => {});
  }, []);

  const catData = categoryTotals(inventory);
  const activity = recentActivity(donations, distributions, 8);

  const grid = useMemo(() => {
    if (!outlook) return null;
    return buildPlanGrid({ outlook, zones, params, overrides, today });
  }, [outlook, zones, params, overrides, today]);

  const zonesEvidence = useMemo(
    () =>
      NEIGHBORHOODS.map((nb) => ({
        id: nb.id,
        label: nb.label,
        evidence: zoneEvidence({ neighborhoodId: nb.id, zones, ledger, overrides, params, today }),
      })),
    [zones, ledger, overrides, params, today],
  );

  const attention = useMemo(
    () => attentionItems({ inventory, zonesEvidence, drafts, overrides, today }),
    [inventory, zonesEvidence, drafts, overrides, today],
  );

  // "Next week" = the first full week after the current one; weeks[0] is the
  // Monday-anchored week that today already falls in.
  const nextWeek = grid ? grid.weeks[grid.weeks.length > 1 ? 1 : 0] : undefined;
  const weekTotals = grid && nextWeek ? grid.totals[nextWeek] : null;
  const capacityMeals = params.runsPerWeek * params.vehicleCapacity;
  const coveragePct = weekTotals && capacityMeals > 0 ? Math.round((weekTotals.meals / capacityMeals) * 100) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Today</h1>
        <p className="text-sm text-slate-500">
          What needs attention right now, and next week&apos;s plan against fleet capacity.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Attention</h2>
        {attention.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing needs attention right now.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {attention.map((item, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5">
                <span
                  className={`mt-0.5 inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_TONE[item.severity]}`}
                >
                  {item.severity}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={item.href} className="text-sm font-medium text-slate-900 hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-semibold text-slate-900">Next week&apos;s plan vs. capacity</h2>
        {!grid || !weekTotals ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
            Loading forecast…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Planned meals"
              value={`${Math.round(weekTotals.meals).toLocaleString()} / ${capacityMeals.toLocaleString()}`}
              icon={Utensils}
            />
            <StatCard
              label="Planned runs"
              value={`${weekTotals.runs} / ${params.runsPerWeek}`}
              icon={Route}
              tone={weekTotals.runs > params.runsPerWeek ? 'warn' : 'default'}
            />
            <StatCard label="Volunteer hours" value={Math.round(weekTotals.hours)} icon={Clock} />
            <StatCard
              label="Coverage"
              value={coveragePct !== null ? `${coveragePct}%` : '—'}
              icon={Gauge}
              tone={coveragePct !== null && coveragePct > 100 ? 'danger' : 'default'}
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold text-slate-900">Inventory by category</h2>
        <CategoryChart data={catData} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-semibold text-slate-900">Recent activity</h2>
        <ActivityFeed entries={activity} />
      </div>
    </div>
  );
}
