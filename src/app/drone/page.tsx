'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Battery, Camera, Gauge, MapPin, Mountain, Navigation, Package, Signal, Wifi } from 'lucide-react';
import { useZones } from '@/lib/useZones';
import { useDroneTelemetry } from '@/lib/drone';
import { useDroneVision } from '@/lib/droneVision';
import { DEPOT } from '@/lib/delivery';

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-stone-100 text-sm text-stone-500">Loading map…</div>,
});

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
  const vision = useDroneVision();
  const drone = useMemo(
    () => (tel ? { lng: tel.lng, lat: tel.lat, headingDeg: tel.headingDeg } : null),
    [tel],
  );
  // Live EyePop webcam detection overrides the simulator's scripted one.
  const det = vision.connected && vision.detection
    ? vision.detection
    : tel
      ? { ...tel.detection, count: null }
      : null;
  const detClear = det?.label === 'clear';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-stone-900">Drone delivery ops</h2>
          <p className="text-sm text-stone-500">
            Live position + vision for the autonomous food-drop drone, flying real need-ranked
            zones. Drop-zone vision by EyePop.ai.
          </p>
        </div>
        {vision.connected ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            EYEPOP VISION LIVE · webcam — flight simulated
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            SIMULATED FLIGHT — connect drone/EyePop to go live
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live map: drone moving over the delivery zones */}
        <div className="lg:col-span-2">
          <div className="relative h-[520px] overflow-hidden rounded-xl border border-stone-200 shadow-sm">
            <DeliveryMap zones={zones} onAddZone={() => {}} drone={drone} zoom={13.2} />
            {/* EyePop detection overlay */}
            {det && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/65 px-3 py-2 backdrop-blur">
                <div className="text-[10px] uppercase tracking-wide text-stone-400">
                  EyePop.ai · drop-zone check{vision.connected ? ' · LIVE' : ''}
                </div>
                <div className={`flex items-center gap-2 text-sm font-semibold ${detClear ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${detClear ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {detClear ? 'CLEAR TO DROP' : 'OBSTRUCTED — HOLD'}
                  <span className="text-xs font-normal text-stone-300">
                    {det.count != null
                      ? `${det.count} in frame${det.count > 0 ? ` · ${(det.confidence * 100).toFixed(0)}%` : ''}`
                      : `${(det.confidence * 100).toFixed(0)}%`}
                  </span>
                </div>
              </div>
            )}
            {tel && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-black/65 px-3 py-1.5 text-xs font-medium text-stone-100 backdrop-blur">
                {tel.status.toUpperCase()} → {tel.targetLabel}
              </div>
            )}
          </div>

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
          <div className="col-span-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <MapPin size={13} /> Position
            </div>
            <div className="mt-1 font-mono text-sm text-stone-900">
              {tel ? `${tel.lat.toFixed(5)}, ${tel.lng.toFixed(5)}` : '—'}
            </div>
          </div>

          {/* EyePop webcam feed: every person detection, boxes drawn by the bridge */}
          {vision.connected && (
            <div className="col-span-2 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- localhost MJPEG-style feed, not an optimizable asset */}
              <img src={vision.frameUrl} alt="EyePop drone camera feed" className="aspect-video w-full object-cover" />
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
                  <Camera size={13} /> eyepop.person:latest
                </div>
                <div className="text-xs text-stone-500">
                  {vision.detection?.count ?? 0} person{(vision.detection?.count ?? 0) === 1 ? '' : 's'} ·{' '}
                  {vision.detection?.videoFps.toFixed(0) ?? 0} fps video ·{' '}
                  {vision.detection?.inferFps.toFixed(1) ?? 0} fps inference
                </div>
              </div>
              {(vision.detection?.persons.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                  {vision.detection!.persons.map((p, i) => (
                    <span key={i} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      person {(p.confidence * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="col-span-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
              <Wifi size={13} /> Connect a real feed
            </div>
            <p className="mt-1 text-[11px] text-stone-500">
              Vision: run <code className="rounded bg-stone-100 px-1">.venv/bin/python scripts/eyepop_bridge.py</code> to
              stream webcam person-detections from EyePop.ai into this view. Flight: swap the simulator in{' '}
              <code className="rounded bg-stone-100 px-1">src/lib/drone.ts</code> for a WebSocket of{' '}
              <code className="rounded bg-stone-100 px-1">DroneTelemetry</code> frames from the flight controller.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
