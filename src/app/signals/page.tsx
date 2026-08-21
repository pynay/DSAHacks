'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CommonsStats } from '@/lib/commonsStats';
import { buildScaleupSeries } from '@/lib/scaleupSeries';
import ScaleupChart from '@/components/charts/ScaleupChart';
import type { OutlookPayload } from '@/lib/outlookServer';
import type { DeliveryZone } from '@/lib/delivery';
import PitChart from '@/components/charts/PitChart';
import IndexedSignals from '@/components/charts/IndexedSignals';
import LaJollaSlope from '@/components/charts/LaJollaSlope';
import OutlookChart from '@/components/charts/OutlookChart';
import OutlookFindings from '@/components/OutlookFindings';
import { useInventory } from '@/context/InventoryProvider';
import { buildPlanGrid } from '@/lib/plan/forecast';
import { zoneEvidence, type ZoneEvidence } from '@/lib/plan/evidence';
import PlanParamsPanel from '@/components/plan/PlanParamsPanel';
import PlanGrid from '@/components/plan/PlanGrid';
import WeekSummary from '@/components/plan/WeekSummary';
import OverrideDialog from '@/components/plan/OverrideDialog';
import type { Override } from '@/lib/store/types';

const TABS = [
  { id: 'plan', label: 'Plan' },
  { id: 'evidence', label: 'Evidence' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SignalsPage() {
  const { params, setParams, overrides, setOverride, clearOverride, ledger, selectedWeekStart, setSelectedWeekStart } =
    useInventory();

  const [tab, setTab] = useState<Tab>('plan');
  const [commons, setCommons] = useState<CommonsStats | null>(null);
  const [outlook, setOutlook] = useState<OutlookPayload | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [activeWeek, setActiveWeek] = useState<string | null>(null);
  const [overrideZone, setOverrideZone] = useState<string | null>(null);
  const scaleup = commons?.scaleup?.length ? buildScaleupSeries(commons.scaleup) : null;

  useEffect(() => {
    fetch('/api/commons')
      .then((r) => r.json())
      .then((d) => {
        if (d.pit) setCommons(d);
      })
      .catch(() => {});
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

  const today = todayISO();

  const grid = useMemo(() => {
    if (!outlook) return null;
    return buildPlanGrid({ outlook, zones, params, overrides, today });
  }, [outlook, zones, params, overrides, today]);

  // Falls back to the first week whenever the horizon changes and the
  // previously-selected week no longer exists in it — derived, not an effect.
  const displayedWeek = activeWeek && grid?.weeks.includes(activeWeek) ? activeWeek : (grid?.weeks[0] ?? null);

  const evidenceByZone = useMemo(() => {
    if (!grid) return {} as Record<string, ZoneEvidence>;
    const out: Record<string, ZoneEvidence> = {};
    for (const z of grid.zones) {
      out[z.id] = zoneEvidence({ neighborhoodId: z.id, zones, ledger, overrides, params, today });
    }
    return out;
  }, [grid, zones, ledger, overrides, params, today]);

  const overrideZoneMeta = overrideZone ? grid?.zones.find((z) => z.id === overrideZone) : undefined;
  const existingOverride: Override | undefined = overrideZone
    ? overrides.find((o) => o.zoneId === overrideZone)
    : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Forecast &amp; Plan</h1>
        <p className="text-sm text-slate-500">
          The zone-by-week resource plan, built from the Data Commons forecast, and the evidence behind it.
        </p>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 text-xs w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              tab === t.id ? 'bg-[#54b889] text-[#071a2b]' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <div className="space-y-4">
          <PlanParamsPanel params={params} zones={grid?.zones ?? []} onChange={setParams} />

          {!grid && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
              Loading forecast…
            </div>
          )}

          {grid && (
            <PlanGrid
              grid={grid}
              evidenceByZone={evidenceByZone}
              params={params}
              activeWeek={displayedWeek}
              onSelectWeek={setActiveWeek}
              onOverrideClick={setOverrideZone}
              outlook={outlook!}
              zones={zones}
              ledger={ledger}
            />
          )}

          {grid && displayedWeek && (
            <WeekSummary
              grid={grid}
              week={displayedWeek}
              onUseForAllocation={() => setSelectedWeekStart(displayedWeek)}
              isSelected={selectedWeekStart === displayedWeek}
            />
          )}

          {overrideZone && (
            <OverrideDialog
              zoneId={overrideZone}
              zoneLabel={overrideZoneMeta?.label ?? overrideZone}
              existing={existingOverride}
              onClose={() => setOverrideZone(null)}
              onSave={(override) => {
                setOverride(override);
                setOverrideZone(null);
              }}
              onClear={() => {
                clearOverride(overrideZone);
                setOverrideZone(null);
              }}
            />
          )}
        </div>
      )}

      {tab === 'evidence' && (
        <div className="space-y-4">
          {!commons && !outlook && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
              Loading signals…
            </div>
          )}

          {outlook && (
            // Rendered independent of the commons fetch (M1): the outlook card should still show
            // up if /api/outlook succeeds even when /api/commons fails.
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-slate-900">Where downtown is headed</h2>
              <p className="mb-3 text-xs text-slate-500">
                Downtown DSDP counted-unit total, nowcast for unpublished recent months, then a 12-month
                forecast with an 80% band. The 2023-08 camping ban is marked for reference; the ITS effect
                below is quasi-experimental, not causal.
              </p>
              <OutlookChart
                history={outlook.history}
                forecast={outlook.forecast}
                requests={outlook.requests}
                interpolatedMonths={outlook.meta.interpolated_months}
              />
              <div className="mt-4">
                <OutlookFindings
                  forecastLast={outlook.forecast[outlook.forecast.length - 1]}
                  beatsNaiveThrough={outlook.beatsNaiveThrough}
                  beatsLastValueFrom={outlook.beatsLastValueFrom}
                  its={outlook.its}
                  t0={outlook.meta.t0}
                />
              </div>
            </div>
          )}

          {commons && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                <h2 className="font-semibold text-slate-900">San Diego homelessness (HUD PIT counts)</h2>
                <p className="mb-1 text-xs text-slate-500">
                  Annual region-wide Point-in-Time counts (no 2021 bar: the unsheltered count was not
                  conducted that year). The dashed line is an illustrative 4-year trend projection, not
                  a validated forecast.
                </p>
                <PitChart data={commons.pit} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-semibold text-slate-900">Real data sources</h2>
                <p className="text-xs text-slate-500">via the SD Homelessness Data Commons (DuckDB)</p>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                  <li><b>DSDP downtown counts:</b> monthly unsheltered totals by neighborhood, 2017 to 2025 (hackathon bundle)</li>
                  <li><b>311 &quot;Get It Done&quot;:</b> homelessness-related requests, 2018 to 2026 (need forecast target)</li>
                  <li><b>72-hr enforcement reports:</b> per-neighborhood violation signals</li>
                  <li><b>HUD Point-in-Time:</b> annual regional counts, 2016 to 2025</li>
                  <li><b>SDHC shelter roster:</b> real sites, beds &amp; occupancy, 2026</li>
                  <li><b>Paid parking sessions:</b> downtown activity proxy, 2021 to 2026 (Source J)</li>
                  <li><b>USDA FARA:</b> La Jolla food access by tract, 2010/2015/2019 (Source I)</li>
                  <li><b>USGS / Mapbox terrain:</b> target-site ground elevation</li>
                  <li><b>Feeding San Diego scale-up:</b> FY24-25 impact report + FSD engineering-lead interview (Aug 2026)</li>
                </ul>
                <p className="mt-2 text-[11px] text-slate-400">
                  Signals are proxies with known biases, not headcounts. See the repo data dictionary.
                </p>
              </div>

              {/* Do the signals move together? Indexed multi-signal comparison. */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                <h2 className="font-semibold text-slate-900">Do the signals move together?</h2>
                <p className="mb-1 text-xs text-slate-500">
                  Three downtown series of different scale, including DSDP counts, 311 requests, and paid-parking
                  activity, are each shown as a percent of their own average (100 = typical) so they share
                  one axis. When need diverges from activity, that gap is where a drone check earns its
                  trip.
                </p>
                <IndexedSignals
                  dsdp={commons.dsdp}
                  requests={commons.requests311}
                  parking={commons.parking.map((p) => ({ month: p.month, value: p.sessions }))}
                />
              </div>

              {/* Source I: La Jolla food access */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-semibold text-slate-900">La Jolla food access</h2>
                <p className="text-xs text-slate-500">USDA Food Access Research Atlas (Source I)</p>
                {(() => {
                  const v = commons.laJolla[commons.laJolla.length - 1];
                  if (!v) return <p className="mt-2 text-xs text-slate-400">No data.</p>;
                  return (
                    <>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {Math.round(v.lowIncomeLowAccess).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">low-income + low-access residents ({v.year})</div>
                      <div className="mt-3">
                        <LaJollaSlope
                          data={commons.laJolla.map((x) => ({ year: x.year, lowAccessShare: x.lowAccessShare }))}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        A food desert beyond downtown: {Math.round(v.lowAccessShare)}% of{' '}
                        {(v.pop / 1000).toFixed(0)}k residents live &gt;1 mi from a supermarket. A
                        candidate expansion zone for field sensing and food-access planning. The dashed
                        points are an illustrative trend projection, not a validated forecast.
                      </p>
                    </>
                  );
                })()}
              </div>
              {/* Feeding San Diego scale-up: supply doubles, the workforce doesn't. */}
              {scaleup && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                  <h2 className="font-semibold text-slate-900">
                    Feeding San Diego: 2&times; the food, the same hands?
                  </h2>
                  <p className="mb-3 text-xs text-slate-500">
                    Indexed to FY26 = 100 (one axis, mixed units). FSD moved 37.4M lbs last year and
                    projects ~+50M lbs within five years; its own estimate says 240 volunteers will be
                    needed against 146 today. The amber band is the unfilled workforce.
                  </p>
                  <ScaleupChart data={scaleup.series} />
                  <p className="mt-2 text-[11px] text-slate-400">
                    Projection: FSD head of software engineering &amp; data analysis, hackathon
                    interview (Aug 21, 2026) &middot; baseline{' '}
                    <a className="underline hover:text-slate-600" href="https://feedingsandiego.org/about-us/our-impact/" target="_blank" rel="noreferrer">
                      FSD FY24-25 impact
                    </a>
                    . Demand context:{' '}
                    <a className="underline hover:text-slate-600" href="https://www.sdhunger.org/research" target="_blank" rel="noreferrer">
                      25% of San Diegans nutrition insecure (SDHC)
                    </a>
                    ,{' '}
                    <a className="underline hover:text-slate-600" href="https://feedingsandiego.org/2026-food-insecurity-in-san-diego-county/" target="_blank" rel="noreferrer">
                      food insecurity past its pandemic peak (Map the Meal Gap, Jul 2026)
                    </a>
                    ,{' '}
                    <a className="underline hover:text-slate-600" href="https://www.cafoodbanks.org/what-we-do/policy/calfresh-changes-hr1/" target="_blank" rel="noreferrer">
                      H.R.1 CalFresh cuts shifting demand to food banks
                    </a>
                    . Distinct from the SD Food Bank figures on the landing page.
                  </p>
                </div>
              )}

              {scaleup && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="font-semibold text-slate-900">The automation case</h2>
                  <div className="mt-3 border-l-4 pl-3" style={{ borderColor: '#b8860b' }}>
                    <div className="text-3xl font-semibold text-slate-900">
                      {scaleup.stats.gapFinal}
                      <span className="ml-2 text-sm font-normal text-slate-500">volunteers missing by FY{String(scaleup.stats.finalYear).slice(2)}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {Math.round(scaleup.stats.gapPct * 100)}% of the workforce FSD says it needs.
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    If nobody new signs up, each volunteer would have to move{' '}
                    <b>{scaleup.stats.loadPerVolunteerFlat.toLocaleString()} lbs a year</b> &mdash; up
                    from {scaleup.stats.loadPerVolunteerNow.toLocaleString()} today. Even at full
                    strength it&apos;s {scaleup.stats.loadPerVolunteerTarget.toLocaleString()}.
                  </p>
                  <p className="mt-3 text-xs text-slate-600">
                    A gap this size can&apos;t be recruited away. Sensing and distribution have to
                    automate &mdash; that&apos;s what Parsel is for.
                  </p>
                  <Link
                    href="/dispatch"
                    className="mt-3 inline-block rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                  >
                    See the automated response &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
