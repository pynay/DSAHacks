'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Battery,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  PackageCheck,
  Plane,
  RadioTower,
  Route,
  Send,
  Signal,
} from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import DroneDispatchFeed from '@/components/DroneDispatchFeed';
import CampusTracking from '@/components/CampusTracking';
import DeliveryObservationPanel, { type SavedDeliveryObservation } from '@/components/DeliveryObservationPanel';
import { useZones } from '@/lib/useZones';
import { DEPOT, haversineKm, type DeliveryZone } from '@/lib/delivery';
import {
  bearingDegrees,
  buildDeliveryPlan,
  interpolatePosition,
  missionTelemetry,
  type DeliveryPlan,
  type MissionTelemetry,
} from '@/lib/deliveryMission';

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-slate-100 text-sm text-slate-500">Connecting to live map…</div>,
});

interface ActiveMission {
  id: string;
  target: DeliveryZone;
  plan: DeliveryPlan;
  startedAt: number;
  telemetry: MissionTelemetry;
  observationCompletedAt: number | null;
  observation?: SavedDeliveryObservation;
}

interface DeliveryRecord {
  id: string;
  destination: string;
  units: number;
  requestedUnits: number;
  completedAt: string;
  status: 'Drone returning' | 'Delivered';
  peopleObserved?: number;
  modelNeedBefore?: number;
  modelNeedAfter?: number;
}

const LEDGER_KEY = 'parsel-drone-delivery-ledger-v1';
const UNITS_PER_PERSON = 3;

function itemSummary(items: DeliveryPlan['items']): string {
  return items.slice(0, 3).map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(' · ') + (items.length > 3 ? ` · +${items.length - 3} more` : '');
}

function phaseLabel(phase: MissionTelemetry['phase']): string {
  if (phase === 'preparing') return 'Loading payload';
  if (phase === 'en-route') return 'Flying to site';
  if (phase === 'arriving') return 'Positioning over delivery line';
  if (phase === 'observing') return 'Waiting for volunteer camera capture';
  if (phase === 'returning') return 'Food delivered · returning to depot';
  return 'Mission complete · back at depot';
}

export default function DispatchPage() {
  const { inventory, recordDistribution, simDate } = useInventory();
  const { zones, error, refresh } = useZones();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [droneDeployed, setDroneDeployed] = useState(false);
  const [mission, setMission] = useState<ActiveMission | null>(null);
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const observationPanelRef = useRef<HTMLDivElement>(null);
  const droppedIds = useRef(new Set<string>());
  const returnedIds = useRef(new Set<string>());
  const recordDistributionRef = useRef(recordDistribution);

  useEffect(() => {
    recordDistributionRef.current = recordDistribution;
  }, [recordDistribution]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(LEDGER_KEY);
        if (raw) setRecords(JSON.parse(raw));
      } catch {
        // A missing or corrupt demo ledger should not block dispatch.
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const targets = useMemo(
    () => [...zones].filter((zone) => zone.need > 0).sort((a, b) => b.need - a.need).slice(0, 6),
    [zones],
  );
  const plans = useMemo(
    () => targets.map((target) => ({ target, plan: buildDeliveryPlan(inventory, target, UNITS_PER_PERSON) })),
    [inventory, targets],
  );
  const selected = plans.find(({ target }) => target.id === selectedId) ?? plans[0];
  const missionBusy = !!mission && mission.telemetry.phase !== 'delivered';
  const missionId = mission?.id;
  const missionPhase = mission?.telemetry.phase;

  useEffect(() => {
    if (!missionId || missionPhase === 'delivered') return;
    const timer = window.setInterval(() => {
      setMission((current) => {
        if (!current || current.id !== missionId) return current;
        const telemetry = missionTelemetry(
          Date.now() - current.startedAt,
          current.observationCompletedAt === null
            ? null
            : current.observationCompletedAt - current.startedAt,
        );
        return { ...current, telemetry };
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [missionId, missionPhase]);

  useEffect(() => {
    if (!mission) return;
    const foodDropped = mission.telemetry.phase === 'returning' || mission.telemetry.phase === 'delivered';
    if (foodDropped && !droppedIds.current.has(mission.id)) {
      droppedIds.current.add(mission.id);
      recordDistributionRef.current({
        date: simDate,
        recipient: `${mission.target.label} drone delivery site`,
        type: 'mobile-pantry',
        items: mission.plan.items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
        notes: `[Automated drone delivery] mission ${mission.id} · model predicted ${mission.plan.predictedPeople} people · EyePop observed ${mission.observation?.count ?? 0} people · ${mission.plan.allocatedUnits} units delivered`,
      });
      const delivered: DeliveryRecord = {
        id: mission.id,
        destination: mission.target.label,
        units: mission.plan.allocatedUnits,
        requestedUnits: mission.plan.requestedUnits,
        completedAt: new Date().toISOString(),
        status: mission.telemetry.phase === 'returning' ? 'Drone returning' : 'Delivered',
        peopleObserved: mission.observation?.count,
        modelNeedBefore: mission.observation?.modelNeedBefore,
        modelNeedAfter: mission.observation?.modelNeedAfter,
      };
      setRecords((existing) => {
        const next = [delivered, ...existing].slice(0, 20);
        try { localStorage.setItem(LEDGER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    }
    if (mission.telemetry.phase === 'delivered' && !returnedIds.current.has(mission.id)) {
      returnedIds.current.add(mission.id);
      setRecords((existing) => {
        const next = existing.map((record) => record.id === mission.id
          ? { ...record, completedAt: new Date().toISOString(), status: 'Delivered' as const }
          : record);
        try { localStorage.setItem(LEDGER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    }
  }, [mission, simDate]);

  function dispatch(target: DeliveryZone, plan: DeliveryPlan) {
    if (missionBusy || plan.allocatedUnits <= 0) return;
    const id = `DR-${Date.now().toString(36).toUpperCase()}`;
    droppedIds.current.delete(id);
    returnedIds.current.delete(id);
    setSelectedId(target.id);
    setMission({
      id,
      target,
      plan,
      startedAt: Date.now(),
      telemetry: missionTelemetry(0, null),
      observationCompletedAt: null,
    });
  }

  async function saveMissionObservation(input: { count: number; confidence: number; observedAt: string }) {
    if (!mission || mission.telemetry.phase !== 'observing') throw new Error('Mission is not ready for an observation');
    const missionId = mission.id;
    const response = await fetch('/api/hotspots/observe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lat: mission.target.lat,
        lng: mission.target.lng,
        count: input.count,
        confidence: Math.max(0.1, input.confidence),
        coverage: 0.25,
        radiusKm: 0.35,
        observedAt: input.observedAt,
      }),
    });
    const data = await response.json() as {
      error?: string;
      observation?: { affectedBlocks: number };
      zones?: DeliveryZone[];
    };
    if (!response.ok || !data.observation || !data.zones) {
      throw new Error(data.error || 'Could not update the hotspot model');
    }
    const updatedZone = [...data.zones].sort(
      (a, b) => haversineKm(mission.target, a) - haversineKm(mission.target, b),
    )[0];
    const modelNeedAfter = updatedZone?.need ?? mission.target.need;
    const completedAt = Date.now();
    const savedObservation: SavedDeliveryObservation = {
      count: input.count,
      confidence: input.confidence,
      observedAt: input.observedAt,
      affectedBlocks: data.observation.affectedBlocks,
      modelNeedBefore: mission.target.need,
      modelNeedAfter,
    };
    setMission((current) => current?.id === missionId
      ? {
          ...current,
          observationCompletedAt: completedAt,
          observation: savedObservation,
          telemetry: missionTelemetry(completedAt - current.startedAt, completedAt - current.startedAt),
        }
      : current);
    await refresh();
    return { affectedBlocks: data.observation.affectedBlocks, modelNeedAfter };
  }

  const telemetry = mission?.telemetry;
  const dronePosition = mission && telemetry
    ? interpolatePosition(DEPOT, mission.target, telemetry.routeProgress)
    : null;
  const drone = dronePosition && mission
    ? {
        ...dronePosition,
        headingDeg: telemetry?.phase === 'returning' || telemetry?.phase === 'delivered'
          ? bearingDegrees(mission.target, DEPOT)
          : bearingDegrees(DEPOT, mission.target),
      }
    : null;
  const distance = mission ? haversineKm(DEPOT, mission.target) : selected ? haversineKm(DEPOT, selected.target) : 0;
  const displayedPlan = missionBusy && mission ? mission.plan : selected?.plan;
  const payloadDelivered = telemetry?.phase === 'returning' || telemetry?.phase === 'delivered';
  const liveDestination = mission && payloadDelivered
    ? 'Operations depot'
    : mission?.target.label ?? selected?.target.label ?? 'Loading…';

  function scrollToObservation() {
    observationPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // "Deploy drone" swaps the downtown dispatch view for the UCSD campus flight demo.
  if (droneDeployed) {
    return (
      <div className="space-y-5">
        <CampusTracking onExit={() => setDroneDeployed(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900">Automated food delivery</h2>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> LIVE
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Model predictions set each site&apos;s food requirement. A volunteer authorizes the mission,
            and Parsel loads FEFO inventory, flies the route, releases the food, and returns to depot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDroneDeployed(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            title="Launch the UCSD campus flight demo (Geisel → HDSI, real DJI footage)"
          >
            <Plane size={14} /> Deploy drone · UCSD campus
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            <RadioTower size={14} /> Command link online · Mapbox telemetry
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[1.55fr_.75fr]">
        <div className="relative h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
          <DeliveryMap
            zones={zones}
            onAddZone={() => {}}
            drone={drone}
            zoom={13.2}
            focusRoute={mission ? { from: [DEPOT.lng, DEPOT.lat], to: [mission.target.lng, mission.target.lat] } : null}
          />
          {telemetry?.phase === 'observing' && !mission?.observation && (
            <button
              type="button"
              onClick={scrollToObservation}
              className="absolute left-1/2 top-1/2 z-30 flex w-[min(19rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border border-white/20 bg-black/75 px-5 py-4 text-center text-white shadow-2xl backdrop-blur-md transition hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              aria-label="Scroll to the camera and take an area picture"
            >
              <span className="absolute inset-0 animate-pulse rounded-2xl ring-1 ring-emerald-300/35" />
              <span className="relative text-sm font-semibold">Please take an area picture</span>
              <span className="relative mt-1 text-xs text-slate-300">The drone is holding at the delivery zone.</span>
              <span className="relative mt-3 grid h-9 w-9 animate-bounce place-items-center rounded-full bg-emerald-400 text-emerald-950">
                <ArrowDown size={19} />
              </span>
              <span className="relative mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300">Camera controls below</span>
            </button>
          )}
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-xl border border-white/10 bg-[#071a2b]/90 p-4 text-white shadow-xl backdrop-blur">
            {mission && telemetry ? (
              <>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-10 w-10 place-items-center rounded-full ${telemetry.phase === 'delivered' ? 'bg-emerald-400 text-emerald-950' : 'bg-cyan-400 text-cyan-950'}`}>
                      {telemetry.phase === 'delivered' ? <CheckCircle2 size={20} /> : <Plane size={20} />}
                    </span>
                    <div><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Mission {mission.id}</p><p className="font-semibold">{phaseLabel(telemetry.phase)} · {mission.target.label}</p></div>
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">{mission.plan.allocatedUnits} food units {payloadDelivered ? 'delivered' : 'aboard'}</p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${telemetry.overallProgress * 100}%` }} /></div>
              </>
            ) : (
              <div className="flex items-center gap-3"><Route className="text-emerald-300" size={20} /><div><p className="font-semibold">Ready for a delivery</p><p className="text-xs text-slate-400">Choose a model-ranked site and click Deliver.</p></div></div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {mission && telemetry && (
            <DroneDispatchFeed
              missionId={mission.id}
              destination={mission.target.label}
              predictedPeople={mission.plan.predictedPeople}
              telemetry={telemetry}
            />
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live mission status</p><Signal size={15} className="text-emerald-600" /></div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><Navigation size={13} /> Destination</div><p className="mt-1 truncate font-semibold text-slate-900">{liveDestination}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><Route size={13} /> Route</div><p className="mt-1 font-semibold text-slate-900">{distance.toFixed(1)} km</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><Battery size={13} /> Battery</div><p className="mt-1 font-semibold text-slate-900">{telemetry ? `${telemetry.batteryPct}%` : '100%'}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={13} /> {telemetry?.phase === 'returning' ? 'Return ETA' : telemetry?.phase === 'observing' ? 'Observation' : 'ETA'}</div><p className="mt-1 font-semibold text-slate-900">{telemetry?.etaSeconds === null ? 'Photo required' : telemetry ? `${telemetry.etaSeconds}s` : '—'}</p></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected payload</p>
            {selected && displayedPlan ? <><div className="mt-3 flex items-end justify-between"><div><p className="text-3xl font-semibold text-slate-950">{displayedPlan.allocatedUnits}</p><p className="text-xs text-slate-500">{missionBusy ? payloadDelivered ? 'food units delivered' : 'food units aboard' : 'food units available to deliver'}</p></div><PackageCheck size={24} className="text-emerald-600" /></div><p className="mt-3 text-xs leading-5 text-slate-600">{itemSummary(displayedPlan.items) || 'No inventory available'}</p><button type="button" onClick={() => dispatch(selected.target, selected.plan)} disabled={missionBusy || selected.plan.allocatedUnits <= 0} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><Send size={16} />{missionBusy ? telemetry?.phase === 'observing' ? 'Take photo to continue' : telemetry?.phase === 'returning' ? 'Drone returning' : 'Delivery in progress' : mission?.telemetry.phase === 'delivered' ? 'Deliver next payload' : 'Deliver food'}</button></> : <p className="mt-3 text-sm text-slate-500">Loading model recommendations…</p>}
          </div>
        </div>
      </div>

      {mission && telemetry && ['observing', 'returning', 'delivered'].includes(telemetry.phase) && (
        <div ref={observationPanelRef} id="delivery-observation" className="scroll-mt-5">
          <DeliveryObservationPanel
            key={mission.id}
            active={telemetry.phase === 'observing' && !mission.observation}
            missionId={mission.id}
            destination={mission.target.label}
            modelNeedBefore={mission.target.need}
            onSave={saveMissionObservation}
          />
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3"><h3 className="font-semibold text-slate-900">Model-ranked delivery queue</h3><p className="text-xs text-slate-500">Recommended quantity = predicted people × {UNITS_PER_PERSON} units, capped by available FEFO inventory.</p></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3 font-medium">Site</th><th className="px-4 py-3 font-medium">Predicted people</th><th className="px-4 py-3 font-medium">Food needed</th><th className="px-4 py-3 font-medium">Ready now</th><th className="px-4 py-3 font-medium">Distance</th><th className="px-4 py-3 font-medium"></th></tr></thead><tbody>{plans.map(({ target, plan }) => <tr key={target.id} onClick={() => setSelectedId(target.id)} className={`cursor-pointer border-b border-slate-100 last:border-0 ${selected?.target.id === target.id ? 'bg-emerald-50/70' : 'hover:bg-slate-50'}`}><td className="px-4 py-3 font-medium text-slate-900"><span className="flex items-center gap-2"><MapPin size={14} className="text-emerald-600" />{target.label}</span></td><td className="px-4 py-3 text-slate-600">{plan.predictedPeople}</td><td className="px-4 py-3 text-slate-600">{plan.requestedUnits} units</td><td className="px-4 py-3 font-semibold text-slate-900">{plan.allocatedUnits} units</td><td className="px-4 py-3 text-slate-600">{haversineKm(DEPOT, target).toFixed(1)} km</td><td className="px-4 py-3 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); dispatch(target, plan); }} disabled={missionBusy || plan.allocatedUnits <= 0} className="rounded-lg bg-[#071a2b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#123a54] disabled:opacity-35">Deliver</button></td></tr>)}</tbody></table></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3"><h3 className="font-semibold text-slate-900">Delivery status log</h3><p className="text-xs text-slate-500">Food drops appear immediately in Distributions; the mission closes when the drone returns to depot.</p></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3 font-medium">Mission</th><th className="px-4 py-3 font-medium">Destination</th><th className="px-4 py-3 font-medium">Food delivered</th><th className="px-4 py-3 font-medium">Field observation</th><th className="px-4 py-3 font-medium">Updated</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3 font-mono text-xs text-slate-500">{record.id}</td><td className="px-4 py-3 font-medium text-slate-900">{record.destination}</td><td className="px-4 py-3 text-slate-600">{record.units} units</td><td className="px-4 py-3 text-slate-600">{record.peopleObserved === undefined ? '—' : <><span className="font-semibold text-slate-900">{record.peopleObserved} people</span><br /><span className="text-xs">need {record.modelNeedBefore} → {record.modelNeedAfter}</span></>}</td><td className="px-4 py-3 text-slate-600">{new Date(record.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${record.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-cyan-100 text-cyan-800'}`}>{record.status === 'Delivered' ? <CheckCircle2 size={12} /> : <Plane size={12} />}{record.status}</span></td></tr>)}{records.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No completed drone deliveries yet.</td></tr>}</tbody></table></div>
      </section>
    </div>
  );
}
