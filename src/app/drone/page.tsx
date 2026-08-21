'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Loader2, MapPin, RefreshCw, ScanFace, Video, XCircle } from 'lucide-react';
import { useZones } from '@/lib/useZones';
import { useDroneVision } from '@/lib/droneVision';
import { DEFAULT_GATE, gateStatus, initialGateState, nextGate } from '@/lib/observationGate';

export default function DronePage() {
  const { zones, refresh } = useZones();
  const vision = useDroneVision();
  const det = vision.detection;
  // MJPEG in an <img> dies silently if its connection drops (e.g. bridge restart
  // while the tab is backgrounded and polls are throttled). Remount the img when
  // the bridge process changes or the tab becomes visible again.
  const [visEpoch, setVisEpoch] = useState(0);
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) setVisEpoch((e) => e + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const clear = det?.label === 'clear';
  const verdict = det?.verdict ?? null;
  // Verdict pipeline drives the decision; older bridges fall back to the person heuristic.
  const decision = det ? (verdict?.state ?? (clear ? 'GO' : 'HOLD')) : null;
  const DECISION_UI = {
    GO: { icon: CheckCircle2, title: 'CLEAR TO DROP', side: 'CLEAR', overlay: 'text-emerald-400', card: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500' },
    HOLD: { icon: XCircle, title: 'OBSTRUCTED — HOLD', side: 'HOLD', overlay: 'text-amber-400', card: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500' },
    NO_GO: { icon: AlertTriangle, title: 'NO-GO — NO VISIBILITY', side: 'NO-GO', overlay: 'text-red-400', card: 'bg-red-100 text-red-800', bar: 'bg-red-500' },
  } as const;
  const ds = decision ? DECISION_UI[decision] : null;
  const DecisionIcon = ds?.icon ?? null;
  const score = verdict?.score ?? (det ? (clear ? 100 : 0) : 0);
  const reason = verdict?.reason
    ?? (det ? `${det.count} person${det.count === 1 ? '' : 's'} detected in the drop area` : '');
  const targets = [...zones].filter((z) => z.need > 0).sort((a, b) => b.need - a.need).slice(0, 4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // Resolve from the full zone list: an assimilation-driven re-rank of the
  // top-4 targets must not silently retarget the operator's selection.
  const selected = zones.find((zone) => zone.id === selectedId) ?? targets[0];

  async function applyCount(count: number, observedAtMs: number) {
    if (!det || !selected) return;
    setFeedback('saving');
    try {
      const response = await fetch('/api/hotspots/observe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lat: selected.lat,
          lng: selected.lng,
          count,
          confidence: count > 0 ? Math.max(det.confidence, 0.1) : 0.8,
          coverage: 1,
          radiusKm: 0.18,
          observedAt: new Date(observedAtMs).toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Hotspot update failed');
      await refresh();
      setFeedback('saved');
    } catch {
      setFeedback('error');
    }
  }

  // Auto-feed: the tested episode gate decides when one stabilized count may
  // flow into the need model — at most once per occupancy episode.
  const [autoFeed, setAutoFeed] = useState(false);
  const gate = useRef(initialGateState());
  const [autoLog, setAutoLog] = useState<{ count: number; zoneLabel: string; at: number } | null>(null);
  const [gatePhase, setGatePhase] = useState<'watching' | 'arming' | 'holding' | 'cooldown'>('watching');
  useEffect(() => {
    if (!autoFeed || !det || !selected) return;
    const out = nextGate(gate.current, { stablePeople: det.stablePeople, ts: det.ts, zoneId: selected.id }, DEFAULT_GATE);
    gate.current = out.state; // sync before any await: StrictMode-safe with ts dedupe
    setGatePhase(gateStatus(out.state, DEFAULT_GATE, det.ts));
    if (out.fire) {
      void applyCount(out.fire.count, out.fire.ts);
      setAutoLog({ count: out.fire.count, zoneLabel: selected.label, at: out.fire.ts });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gate consumes each det tick once
  }, [det, autoFeed, selected?.id]);
  const classCounts = (det?.objects ?? []).reduce<Record<string, number>>((m, o) => {
    m[o.label] = (m[o.label] ?? 0) + 1;
    return m;
  }, {});
  const classes = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Drone verification</h2>
          <p className="text-sm text-slate-500">
            Live camera vision by EyePop.ai detects people and objects, holds the release while the
            landing zone is occupied, and can apply one reviewed aggregate person count to a
            historical-prior target.
          </p>
        </div>
        {vision.connected ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> EYEPOP VISION LIVE
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> vision offline — start the bridge
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live EyePop feed — the drone's-eye view */}
        <div className="lg:col-span-2">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {vision.connected ? (
              // eslint-disable-next-line @next/next/no-img-element -- localhost MJPEG live stream
              <img
                key={`stream-${det?.bootId ?? 'na'}-${visEpoch}`}
                src={vision.frameUrl}
                alt="EyePop drone camera feed"
                className="h-full w-full object-cover"
              />
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
                <div className="text-[10px] uppercase tracking-wide text-slate-400">EyePop.ai · drop-zone check · LIVE</div>
                <div className={`flex items-center gap-2 text-base font-bold ${ds!.overlay}`}>
                  {DecisionIcon && <DecisionIcon size={18} />}
                  {ds!.title}
                  <span className="text-xs font-normal text-slate-300">{reason}</span>
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

        {/* Side: decision + detections + delivery targets */}
        <div className="space-y-3">
          <div className={`rounded-xl border border-slate-200 p-4 shadow-sm ${ds ? ds.card : 'bg-white'}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">Drop decision</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-bold">
              {DecisionIcon && <DecisionIcon size={22} />}
              {ds ? ds.side : '—'}
            </div>
            <div className="mt-1 text-xs opacity-80">{det ? reason : 'Awaiting vision feed'}</div>
            {det && (
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/60">
                  <div className={`h-full rounded-full ${ds!.bar} transition-all`} style={{ width: `${score}%` }} />
                </div>
                <div className="mt-1 text-[11px] opacity-70">drop-safety score {score}/100</div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-1 text-xs font-medium text-slate-500">Detected in frame</div>
            {classes.length ? (
              <div className="flex flex-wrap gap-1.5">
                {classes.map(([label, n]) => (
                  <span
                    key={label}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${label === 'person' ? 'bg-red-100 text-red-700' : 'bg-cyan-100 text-cyan-800'}`}
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

          {det?.stats && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Activity size={13} /> Session telemetry
                </div>
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <ScanFace size={12} />
                  {det.blurred > 0 ? `${det.blurred} face${det.blurred === 1 ? '' : 's'} blurred` : 'privacy blur on'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{det.stablePeople}</div>
                  <div className="text-[11px] text-slate-500">people (stable)</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">{det.stats.peakPeople}</div>
                  <div className="text-[11px] text-slate-500">peak people</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">{det.stats.holds}</div>
                  <div className="text-[11px] text-slate-500">holds</div>
                </div>
              </div>
              {det.stats.series.length > 1 && (
                <svg viewBox="0 0 120 28" className="mt-2 h-7 w-full" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-emerald-600"
                    points={det.stats.series
                      .map(([, n], i) => {
                        const max = Math.max(1, ...det.stats!.series.map(([, v]) => v));
                        return `${(i / (det.stats!.series.length - 1)) * 120},${26 - (n / max) * 22}`;
                      })
                      .join(' ')}
                  />
                </svg>
              )}
              <div className="mt-1 text-[10px] text-slate-400">
                people in frame · 5s samples + verdict events → data/drone_vision_log.jsonl
              </div>
            </div>
          )}

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
              onClick={() => det && applyCount(det.stablePeople, det.ts)}
              disabled={!det || !selected || feedback === 'saving'}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {feedback === 'saving' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {feedback === 'saving' ? 'Updating hotspot…' : `Apply stabilized count${det ? ` (${det.stablePeople})` : ''}`}
            </button>
            {feedback === 'saved' && (
              <p className="mt-1.5 text-[11px] text-emerald-700">
                Count assimilated; the affected zone is now allocation-eligible.
              </p>
            )}
            {feedback === 'error' && (
              <p className="mt-1.5 text-[11px] text-red-700">Could not update the hotspot model.</p>
            )}
            <label className="mt-2 flex cursor-pointer items-center justify-between rounded-md bg-slate-50 px-2 py-1.5">
              <span className="text-xs font-medium text-slate-700">Auto-feed need model</span>
              <input
                type="checkbox"
                checked={autoFeed}
                onChange={(e) => setAutoFeed(e.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
            </label>
            {autoFeed && (
              <p className="mt-1 text-[11px] text-slate-500">
                {gatePhase === 'watching' && 'watching — zone empty'}
                {gatePhase === 'arming' && 'arming — stabilizing count…'}
                {gatePhase === 'holding' && 'applied — waiting for the zone to clear'}
                {gatePhase === 'cooldown' && 'cooldown — no recount for 2 min'}
                {autoLog && ` · last auto-applied ${autoLog.count} to ${autoLog.zoneLabel} at ${new Date(autoLog.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Feed runs <code className="rounded bg-slate-100 px-1">eyepop.common-objects:latest</code> via
            <code className="rounded bg-slate-100 px-1">scripts/eyepop_bridge.py</code>. Point it at a
            live webcam (run without <code className="rounded bg-slate-100 px-1">VIDEO_SOURCE</code>) or
            any video file. Manual apply submits the median-stabilized count for the selected
            target; auto-feed submits at most one stabilized count per occupancy episode (the
            zone must clear, plus a 2-minute cooldown), so the same people are never recounted. Set{' '}
            <code className="rounded bg-slate-100 px-1">EYEPOP_ABILITY</code> to swap models.
            Drop verdict = visibility gate + landing-zone filter + hazard severity + sustained-clear
            hysteresis (tune <code className="rounded bg-slate-100 px-1">CLEAR_HOLD_S</code>,{' '}
            <code className="rounded bg-slate-100 px-1">MIN_BRIGHTNESS</code>,{' '}
            <code className="rounded bg-slate-100 px-1">DROP_ZONE</code>).
            Clear/hold is decision support only and does not autonomously release a payload.
          </p>
        </div>
      </div>
    </div>
  );
}
