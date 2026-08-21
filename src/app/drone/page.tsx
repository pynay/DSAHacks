'use client';

import { Battery, Gauge, MapPin, Mountain, Navigation, Package, Signal, Wifi } from 'lucide-react';
import { useZones } from '@/lib/useZones';
import { useDroneTelemetry } from '@/lib/drone';
import { DEPOT } from '@/lib/delivery';

function Stat({ icon: Icon, label, value }: { icon: typeof Battery; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-stone-500">
        <Icon size={13} /> {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-stone-900">{value}</div>
    </div>
  );
}

export default function DronePage() {
  const { zones } = useZones();
  const tel = useDroneTelemetry(zones);

  const detClear = tel?.detection.label === 'clear';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-stone-900">Drone delivery ops</h2>
          <p className="text-sm text-stone-500">
            Live vision + telemetry for the autonomous food-drop drone. Vision by EyePop.ai.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          {tel?.live ? 'LIVE FEED' : 'SIMULATED — connect drone/EyePop to go live'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Camera feed + EyePop detection overlay */}
        <div className="lg:col-span-2">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-stone-800 bg-stone-900">
            {/* placeholder "feed": grid + scanline until a real stream is attached */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'linear-gradient(#3f3f46 1px, transparent 1px), linear-gradient(90deg, #3f3f46 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center text-stone-500">
                <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full border-2 border-stone-600">
                  <Navigation size={26} className="text-stone-400" style={{ transform: `rotate(${tel?.headingDeg ?? 0}deg)` }} />
                </div>
                <p className="text-xs">downward camera · {tel ? `${tel.altitudeM} m AGL` : '—'}</p>
                <p className="text-[11px] text-stone-600">attach EyePop stream to render frames</p>
              </div>
            </div>

            {/* crosshair */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-32 -translate-x-1/2 -translate-y-1/2 bg-white/20" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-px -translate-x-1/2 -translate-y-1/2 bg-white/20" />

            {/* EyePop detection badge */}
            {tel && (
              <div className="absolute left-3 top-3 rounded-lg bg-black/60 px-3 py-2 backdrop-blur">
                <div className="text-[10px] uppercase tracking-wide text-stone-400">EyePop.ai · drop-zone check</div>
                <div className={`flex items-center gap-2 text-sm font-semibold ${detClear ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${detClear ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {detClear ? 'CLEAR TO DROP' : 'OBSTRUCTED — HOLD'}
                  <span className="text-xs font-normal text-stone-400">
                    {(tel.detection.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}

            {/* status pill */}
            {tel && (
              <div className="absolute right-3 top-3 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-stone-200 backdrop-blur">
                {tel.status.toUpperCase()} → {tel.targetLabel}
              </div>
            )}
          </div>

          {/* flight progress depot -> target */}
          {tel && (
            <div className="mt-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
              <div className="mb-1 flex justify-between text-xs text-stone-500">
                <span>{DEPOT.label}</span>
                <span>{tel.targetLabel}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-yellow-600 transition-all" style={{ width: `${Math.round(tel.progress * 100)}%` }} />
              </div>
              <div className="mt-1 text-xs text-stone-500">
                {tel.distanceKm} km remaining · ETA {tel.etaMin} min · heading {tel.headingDeg}°
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
          <div className="col-span-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <MapPin size={13} /> Position
            </div>
            <div className="mt-1 font-mono text-sm text-stone-900">
              {tel ? `${tel.lat.toFixed(5)}, ${tel.lng.toFixed(5)}` : '—'}
            </div>
          </div>
          <div className="col-span-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
              <Wifi size={13} /> Connect a real feed
            </div>
            <p className="mt-1 text-[11px] text-stone-500">
              Swap the simulator in <code className="rounded bg-stone-100 px-1">src/lib/drone.ts</code> for a
              WebSocket of <code className="rounded bg-stone-100 px-1">DroneTelemetry</code> frames: flight
              controller for position/battery, EyePop.ai ability for the drop-zone check.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
