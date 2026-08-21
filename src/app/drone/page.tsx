'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Battery, Gauge, MapPin, Mountain, Navigation, Package, Signal, Wifi } from 'lucide-react';
import { useZones } from '@/lib/useZones';
import { useDroneTelemetry } from '@/lib/drone';
import { DEPOT } from '@/lib/delivery';

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-slate-100 text-sm text-slate-500">Loading map…</div>,
});

function Stat({ icon: Icon, label, value }: { icon: typeof Battery; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon size={13} /> {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function DronePage() {
  const { zones } = useZones();
  const tel = useDroneTelemetry(zones);
  const drone = useMemo(
    () => (tel ? { lng: tel.lng, lat: tel.lat, headingDeg: tel.headingDeg } : null),
    [tel],
  );
  const detClear = tel?.detection.label === 'clear';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Drone delivery ops</h2>
          <p className="text-sm text-slate-500">
            Live position + vision for the autonomous food-drop drone, flying real need-ranked
            zones. Drop-zone vision by EyePop.ai.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          {tel?.live ? 'LIVE FEED' : 'SIMULATED FLIGHT — connect drone/EyePop to go live'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live map: drone moving over the delivery zones */}
        <div className="lg:col-span-2">
          <div className="relative h-[520px] overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            <DeliveryMap zones={zones} onAddZone={() => {}} drone={drone} zoom={13.2} />
            {/* EyePop detection overlay */}
            {tel && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/65 px-3 py-2 backdrop-blur">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">EyePop.ai · drop-zone check</div>
                <div className={`flex items-center gap-2 text-sm font-semibold ${detClear ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${detClear ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {detClear ? 'CLEAR TO DROP' : 'OBSTRUCTED — HOLD'}
                  <span className="text-xs font-normal text-slate-300">{(tel.detection.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
            {tel && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-black/65 px-3 py-1.5 text-xs font-medium text-slate-100 backdrop-blur">
                {tel.status.toUpperCase()} → {tel.targetLabel}
              </div>
            )}
          </div>

          {tel && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>{DEPOT.label}</span>
                <span>{tel.targetLabel}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.round(tel.progress * 100)}%` }} />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {tel.distanceKm} km remaining · heading {tel.headingDeg}° · {tel.groundSpeedMps} m/s
              </div>
            </div>
          )}
        </div>

        {/* Telemetry */}
        <div className="grid grid-cols-2 gap-3 self-start">
          <Stat icon={Battery} label="Battery" value={tel ? `${tel.batteryPct}%` : '—'} />
          <Stat icon={Mountain} label="Altitude" value={tel ? `${tel.altitudeM} m` : '—'} />
          <Stat icon={Gauge} label="Ground speed" value={tel ? `${tel.groundSpeedMps} m/s` : '—'} />
          <Stat icon={Signal} label="Signal" value={tel ? `${tel.signalPct}%` : '—'} />
          <Stat icon={Package} label="Payload" value={tel ? `${tel.payloadKg} kg` : '—'} />
          <Stat icon={Navigation} label="Heading" value={tel ? `${tel.headingDeg}°` : '—'} />
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin size={13} /> Position
            </div>
            <div className="mt-1 font-mono text-sm text-slate-900">
              {tel ? `${tel.lat.toFixed(5)}, ${tel.lng.toFixed(5)}` : '—'}
            </div>
          </div>
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Wifi size={13} /> Connect a real feed
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Swap the simulator in <code className="rounded bg-slate-100 px-1">src/lib/drone.ts</code> for a
              WebSocket of <code className="rounded bg-slate-100 px-1">DroneTelemetry</code> frames: flight
              controller for position/battery, EyePop.ai ability for the drop-zone check.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
