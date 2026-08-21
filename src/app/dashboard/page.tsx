'use client';

import { useMemo } from 'react';
import { Package, Boxes, AlertTriangle, Clock, HandHeart, Truck } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import { totalStock } from '@/lib/inventory';
import { statusCounts, categoryTotals, recentActivity, flowByWeek } from '@/lib/dashboard';
import type { Status } from '@/lib/types';
import StatCard from '@/components/StatCard';
import StatusPill from '@/components/StatusPill';
import ActivityFeed from '@/components/ActivityFeed';
import CategoryChart from '@/components/charts/CategoryChart';
import TrendChart from '@/components/charts/TrendChart';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { inventory, donations, distributions } = useInventory();
  const now = useMemo(() => new Date(), []);

  const counts = statusCounts(inventory, now);
  const catData = categoryTotals(inventory);
  const trend = flowByWeek(donations, distributions, now, 6);
  const activity = recentActivity(donations, distributions, 8);

  const weekAgo = daysAgo(7);
  const donationsThisWeek = donations.filter((d) => d.date >= weekAgo).length;
  const distributionsThisWeek = distributions.filter((d) => d.date >= weekAgo).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total stock" value={totalStock(inventory).toLocaleString()} icon={Package} />
        <StatCard label="Distinct SKUs" value={inventory.length} icon={Boxes} />
        <StatCard label="Low stock" value={counts.Low} icon={AlertTriangle} tone="warn" />
        <StatCard label="Expiring soon" value={counts.Expiring} icon={Clock} tone="warn" />
        <StatCard label="Donations / wk" value={donationsThisWeek} icon={HandHeart} />
        <StatCard label="Distributions / wk" value={distributionsThisWeek} icon={Truck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-900">Inventory by category</h2>
          <CategoryChart data={catData} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-900">Intake vs. outflow (6 wks)</h2>
          <TrendChart data={trend} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Stock status</h2>
          <div className="space-y-2">
            {(Object.keys(counts) as Status[]).map((s) => (
              <div key={s} className="flex items-center justify-between">
                <StatusPill status={s} />
                <span className="text-sm font-medium text-slate-700">{counts[s]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-1 font-semibold text-slate-900">Recent activity</h2>
          <ActivityFeed entries={activity} />
        </div>
      </div>
    </div>
  );
}
