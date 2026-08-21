'use client';

import { useState } from 'react';
import { Loader2, MapPin, RefreshCw, ScanLine, Video } from 'lucide-react';
import { useZones } from '@/lib/useZones';
import { useDroneVision } from '@/lib/droneVision';

export default function DronePage() {
  const { zones, refresh } = useZones();
  const vision = useDroneVision();
  const det = vision.detection;
  const targets = [...zones].filter((z) => z.need > 0).sort((a, b) => b.need - a.need).slice(0, 4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const selected = targets.find((target) => target.id === selectedId) ?? targets[0];

  async function captureHotspotCount() {
    if (!det || !selected) return;
    setFeedback('saving');
    try {
      const response = await fetch('/api/hotspots/observe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lat: selected.lat,
          lng: selected.lng,
          count: det.count,
          confidence: det.count > 0 ? Math.max(det.confidence, 0.1) : 0.8,
          coverage: 1,
          radiusKm: 0.18,
          observedAt: new Date(det.ts).toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Hotspot update failed');
      await refresh();
      setFeedback('saved');
    } catch {
      setFeedback('error');
    }
  }
  const classCounts = (det?.objects ?? []).reduce<Record<string, number>>((m, o) => {
    m[o.label] = (m[o.label] ?? 0) + 1;
    return m;
  }, {});
  const classes = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Drone sensing</h2>
          <p className="text-sm text-slate-500">
            Live camera vision gathers aggregate people and object observations. An operator can
            apply one reviewed count to update a historical-prior target and improve the next plan.
          </p>
        </div>
        {vision.connected ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> EYEPOP VISION LIVE
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> vision offline: start the bridge
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live EyePop feed from the drone's-eye view */}
        <div className="lg:col-span-2">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {vision.connected ? (
              // eslint-disable-next-line @next/next/no-img-element -- localhost MJPEG live stream
              <img src={vision.frameUrl} alt="EyePop drone camera feed" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-center text-slate-400">
                <div>
                  <Video size={30} className="mx-auto mb-2" />
                  <p className="text-sm">Waiting for the EyePop vision bridge on :8091</p>
                </div>
              </div>
            )}

            {det && (
              <div className="absolute left-3 top-3 rounded-lg bg-black/65 px-3 py-2 backdrop-blur">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">EyePop.ai · aggregate field observation · LIVE</div>
                <div className="flex items-center gap-2 text-base font-bold text-emerald-400">
                  <ScanLine size={18} />
                  {det.count > 0 ? 'FIELD SIGNAL OBSERVED' : 'NO PEOPLE VISIBLE'}
                  <span className="text-xs font-normal text-slate-300">
                    {det.count} in frame{det.count > 0 ? ` · ${(det.confidence * 100).toFixed(0)}%` : ''}
                  </span>
                </div>
              </div>
            )}
            {det && (
              <div className="absolute bottom-3 right-3 rounded-lg bg-black/65 px-3 py-1.5 text-[11px] font-medium text-slate-200 backdrop-blur">
                eyepop.common-objects:latest · {det.videoFps.toFixed(0)} fps video · {det.inferFps.toFixed(1)} fps inference
              </div>
            )}
          </div>
        </div>

        {/* Side: observation summary + detections + verification targets */}
        <div className="space-y-3">
          <div className={`rounded-xl border border-slate-200 p-4 shadow-sm ${det ? 'bg-emerald-50 text-emerald-900' : 'bg-white'}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">Observation snapshot</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-bold">
              {det ? <ScanLine size={22} /> : null}
              {det ? det.count : 'N/A'}
            </div>
            <div className="mt-1 text-xs opacity-80">
              {det ? `${det.count} visible ${det.count === 1 ? 'person' : 'people'} in this frame · review required` : 'Awaiting vision feed'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-1 text-xs font-medium text-slate-500">Detected in frame</div>
            {classes.length ? (
              <div className="flex flex-wrap gap-1.5">
                {classes.map(([label, n]) => (
                  <span
                    key={label}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${label === 'person' ? 'bg-emerald-100 text-emerald-800' : 'bg-cyan-100 text-cyan-800'}`}
                  >
                    {label}
                    {n > 1 ? ` ×${n}` : ''}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">{vision.connected ? 'Nothing in frame.' : 'Offline.'}</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 text-xs font-medium text-slate-500">Targets to verify (by prior)</div>
            <ul className="space-y-1.5">
              {targets.map((z) => (
                <li key={z.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(z.id);
                      setFeedback('idle');
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-1.5 py-1 text-sm ${selected?.id === z.id ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-1.5 text-slate-800">
                      <MapPin size={12} className="text-red-500" /> {z.label}
                    </span>
                    <span className={`text-xs ${z.confidence === 'drone-updated' ? 'font-medium text-emerald-700' : 'text-slate-500'}`}>
                      {z.confidence === 'drone-updated' ? 'updated' : 'prior'} {z.need}
                    </span>
                  </button>
                </li>
              ))}
              {targets.length === 0 && <li className="text-xs text-slate-400">Loading zones…</li>}
            </ul>
            <button
              type="button"
              onClick={captureHotspotCount}
              disabled={!det || !selected || feedback === 'saving'}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {feedback === 'saving' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {feedback === 'saving' ? 'Updating hotspot…' : `Apply live count${det ? ` (${det.count})` : ''}`}
            </button>
            {feedback === 'saved' && (
              <p className="mt-1.5 text-[11px] text-emerald-700">
                Count assimilated; the affected zone is now allocation-eligible.
              </p>
            )}
            {feedback === 'error' && (
              <p className="mt-1.5 text-[11px] text-red-700">Could not update the hotspot model.</p>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Feed runs <code className="rounded bg-slate-100 px-1">eyepop.common-objects:latest</code> via
            <code className="rounded bg-slate-100 px-1">scripts/eyepop_bridge.py</code>. Point it at a
            live webcam (run without <code className="rounded bg-slate-100 px-1">VIDEO_SOURCE</code>) or
            any video file. Select a target and apply one stabilized frame count to move the
            hotspot surface; repeated frames are never counted automatically. Set{' '}
            <code className="rounded bg-slate-100 px-1">EYEPOP_ABILITY</code> to swap models.
            The drone gathers information only; food dispatch and distribution remain separate,
            human-controlled operations.
          </p>
        </div>
      </div>
    </div>
  );
}
