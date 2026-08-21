'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Boxes, AlertTriangle, Clock, HandHeart, Truck, BedDouble } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import { totalStock } from '@/lib/inventory';
import { statusCounts, categoryTotals, recentActivity, flowByWeek } from '@/lib/dashboard';
import type { Status } from '@/lib/types';
import type { CommonsStats } from '@/lib/commonsStats';
import StatCard from '@/components/StatCard';
import StatusPill from '@/components/StatusPill';
import ActivityFeed from '@/components/ActivityFeed';
import CategoryChart from '@/components/charts/CategoryChart';
import TrendChart from '@/components/charts/TrendChart';
import PitChart from '@/components/charts/PitChart';
import DsdpChart from '@/components/charts/DsdpChart';
import ActivityChart from '@/components/charts/ActivityChart';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { inventory, donations, distributions } = useInventory();
  const now = useMemo(() => new Date(), []);
  const [commons, setCommons] = useState<CommonsStats | null>(null);

  useEffect(() => {
    fetch('/api/commons')
      .then((r) => r.json())
      .then((d) => {
        if (d.pit) setCommons(d);
      })
      .catch(() => {});
  }, []);

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

      {commons && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-2">
            <h2 className="font-semibold text-stone-900">
              Downtown unsheltered homelessness (DSDP monthly counts)
            </h2>
            <p className="mb-1 text-xs text-stone-500">
              The challenge&apos;s core historical series, 2017–2025, multiplier-adjusted totals
              across all six downtown neighborhoods. Line breaks are the provider&apos;s real
              reporting gaps — never interpolated or zero-filled.
            </p>
            <DsdpChart data={commons.dsdp} />
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-stone-900">
              <BedDouble size={16} className="text-yellow-700" /> City shelter capacity
            </h2>
            <p className="text-xs text-stone-500">SDHC roster, as of {commons.shelters.asOf}</p>
            <div className="mt-2 text-2xl font-semibold text-stone-900">
              {commons.shelters.totalBeds.toLocaleString()}{' '}
              <span className="text-sm font-normal text-stone-500">
                beds · {commons.shelters.siteCount} sites
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {commons.shelters.occupancy.map((o) => (
                <span
                  key={o.category}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${o.pct >= 95 ? 'bg-red-100 text-red-800' : o.pct >= 85 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}
                  title={`as of ${o.month}`}
                >
                  {o.category} {o.pct}%
                </span>
              ))}
            </div>
            <ul className="mt-3 space-y-1 text-xs text-stone-600">
              {commons.shelters.sites.slice(0, 4).map((s) => (
                <li key={`${s.program}-${s.site}`} className="flex justify-between gap-2">
                  <span className="truncate">{s.site}</span>
                  <span className="shrink-0 font-medium text-stone-800">{s.beds}</span>
                </li>
              ))}
              {commons.shelters.sites.length > 4 && (
                <li className="text-stone-400">+{commons.shelters.sites.length - 4} more sites</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-2">
            <h2 className="font-semibold text-stone-900">San Diego homelessness (HUD PIT counts)</h2>
            <p className="mb-1 text-xs text-stone-500">
              Annual region-wide Point-in-Time counts (no 2021 bar: the unsheltered count was not
              conducted that year).
            </p>
            <PitChart data={commons.pit} />
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-stone-900">Real data sources</h2>
            <p className="text-xs text-stone-500">via the SD Homelessness Data Commons (DuckDB)</p>
            <ul className="mt-2 space-y-1.5 text-xs text-stone-600">
              <li><b>DSDP downtown counts</b> — monthly unsheltered totals by neighborhood, 2017–2025 (hackathon bundle)</li>
              <li><b>311 &quot;Get It Done&quot;</b> — homelessness-related requests, 2018–2026 (need forecast target)</li>
              <li><b>72-hr enforcement reports</b> — per-neighborhood violation signals</li>
              <li><b>HUD Point-in-Time</b> — annual regional counts, 2016–2025</li>
              <li><b>SDHC shelter roster</b> — real sites, beds &amp; occupancy, 2026</li>
              <li><b>Paid parking sessions</b> — downtown activity proxy, 2021–2026 (Source J)</li>
              <li><b>USDA FARA</b> — La Jolla food access by tract, 2010/2015/2019 (Source I)</li>
              <li><b>USGS / Mapbox terrain</b> — drop-zone ground elevation</li>
            </ul>
            <p className="mt-2 text-[11px] text-stone-400">
              Signals are proxies with known biases, not headcounts — see the repo data dictionary.
            </p>
          </div>

          {/* Source J: downtown activity proxy */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-2">
            <h2 className="font-semibold text-stone-900">Downtown activity (paid parking sessions)</h2>
            <p className="mb-1 text-xs text-stone-500">
              Source J activity proxy across the six downtown neighborhoods, 2021–2026. An open
              signal of downtown activity — deliberately not read as foot traffic or a homelessness
              count.
            </p>
            <ActivityChart data={commons.parking} />
          </div>

          {/* Source I: La Jolla food access */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-stone-900">La Jolla food access</h2>
            <p className="text-xs text-stone-500">USDA Food Access Research Atlas (Source I)</p>
            {(() => {
              const v = commons.laJolla[commons.laJolla.length - 1];
              if (!v) return <p className="mt-2 text-xs text-stone-400">No data.</p>;
              return (
                <>
                  <div className="mt-2 text-2xl font-semibold text-stone-900">
                    {Math.round(v.lowIncomeLowAccess).toLocaleString()}
                  </div>
                  <div className="text-xs text-stone-500">low-income + low-access residents ({v.year})</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {commons.laJolla.map((x) => (
                      <span
                        key={x.year}
                        title={`${x.lowAccess.toLocaleString()} low-access of ${x.pop.toLocaleString()}`}
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800"
                      >
                        {x.year}: {x.lowAccessShare.toFixed(0)}% low-access
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-stone-400">
                    A food desert beyond downtown: {Math.round(v.lowAccessShare)}% of{' '}
                    {(v.pop / 1000).toFixed(0)}k residents live &gt;1 mi from a supermarket. A
                    candidate expansion zone for drone delivery.
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-stone-900">Inventory by category</h2>
          <CategoryChart data={catData} />
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-stone-900">Intake vs. outflow (6 wks)</h2>
          <TrendChart data={trend} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-stone-900">Stock status</h2>
          <div className="space-y-2">
            {(Object.keys(counts) as Status[]).map((s) => (
              <div key={s} className="flex items-center justify-between">
                <StatusPill status={s} />
                <span className="text-sm font-medium text-stone-700">{counts[s]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-1 font-semibold text-stone-900">Recent activity</h2>
          <ActivityFeed entries={activity} />
        </div>
      </div>
    </div>
  );
}
