'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Battery, Camera, Clock3, MapPin, Navigation, Play, Plane, RotateCcw, ScanLine, TowerControl } from 'lucide-react';
import {
  CAMPUS_HEADING_DEG,
  campusDronePosition,
  campusTelemetry,
  FOOTAGE_DURATION_S,
  GEISEL,
  HDSI,
} from '@/lib/campusMission';

const CampusTrackingMap = dynamic(() => import('@/components/CampusTrackingMap'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-slate-100 text-sm text-slate-500">Loading campus map…</div>,
});

function fmt(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export default function CampusPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);

  const tel = campusTelemetry(elapsed);
  const pos = campusDronePosition(tel.routeProgress);
  const drone = started ? { ...pos, headingDeg: CAMPUS_HEADING_DEG } : null;
  const progressPct = Math.min(100, (elapsed / FOOTAGE_DURATION_S) * 100);

  // Drive the map + telemetry off the video clock so they stay in lockstep with
  // the footage. Sampled ~9 fps (every 110 ms): the CSS transition on the drone
  // marker bridges the gaps, and this keeps the render + Mapbox setData load off
  // the main thread on modest hardware.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      const v = videoRef.current;
      if (v && ts - last > 110) {
        last = ts;
        setElapsed(v.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const play = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setStarted(true);
    setEnded(false);
    void v.play();
  }, []);

  const replay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    setElapsed(0);
    setStarted(true);
    setEnded(false);
    void v.play();
  }, []);

  const landed = tel.phase === 'landed';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900">UCSD campus tracking · Geisel → HDSI</h2>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              <span className={`h-2 w-2 rounded-full ${playing ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} /> {playing ? 'TRACKING' : started ? 'HOLD' : 'STANDBY'}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            A real drone flight over campus, reconstructed from the team&apos;s own DJI footage. The
            camera feed runs through EyePop for on-board person detection while the map tracks the
            aircraft from Geisel Library to the Halıcıoğlu Data Science Institute.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <TowerControl size={14} /> Flight replay · Mapbox + EyePop
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_.9fr]">
        <div className="relative h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
          <CampusTrackingMap drone={drone} />

          {!started && (
            <button
              type="button"
              onClick={play}
              className="absolute inset-0 z-30 grid place-items-center bg-slate-950/45 backdrop-blur-[1px] transition hover:bg-slate-950/35"
              aria-label="Fly the mission"
            >
              <span className="flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-black/65 px-8 py-6 text-white shadow-2xl">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-400 text-emerald-950"><Play size={26} className="ml-1" /></span>
                <span className="text-sm font-semibold">Fly the mission</span>
                <span className="text-xs text-slate-300">Geisel Library → HDSI · {Math.round(FOOTAGE_DURATION_S)}s replay</span>
              </span>
            </button>
          )}

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-xl border border-white/10 bg-[#071a2b]/90 p-4 text-white shadow-xl backdrop-blur">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-full ${landed ? 'bg-emerald-400 text-emerald-950' : 'bg-cyan-400 text-cyan-950'}`}>
                  <Plane size={20} />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">DJI-0044 · UCSD campus</p>
                  <p className="font-semibold">{tel.phaseLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <MapPin size={13} className="text-emerald-300" /> {GEISEL.label}
                <span className="text-slate-500">→</span>
                <MapPin size={13} className="text-orange-300" /> {HDSI.label}
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-150 ease-linear" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Drone camera: the real EyePop-annotated footage as the feed. */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[#071a2b] shadow-sm" aria-label="Drone camera feed">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold"><Camera size={14} className="text-emerald-300" /> Drone camera · EyePop</div>
              <span className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.14em] text-emerald-300">
                <span className={`h-1.5 w-1.5 rounded-full ${playing ? 'animate-pulse bg-red-400' : ended ? 'bg-emerald-300' : 'bg-slate-400'}`} />
                {playing ? 'LIVE' : ended ? 'FEED COMPLETE' : 'READY'}
              </span>
            </div>
            <div className="relative aspect-video overflow-hidden bg-black">
              <video
                ref={videoRef}
                src="/ucsd-drone.mp4"
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="auto"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => { setPlaying(false); setEnded(true); }}
                onTimeUpdate={(e) => { if (!playing) setElapsed(e.currentTarget.currentTime); }}
              />
              {!started && (
                <button type="button" onClick={play} className="absolute inset-0 grid place-items-center bg-black/45 transition hover:bg-black/30" aria-label="Play drone feed">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-400 text-emerald-950 shadow-lg"><Play size={22} className="ml-0.5" /></span>
                </button>
              )}
              <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-2 py-1 font-mono text-[9px] leading-4 text-slate-200 backdrop-blur-sm">
                <p>DJI-0044 · CAM-01</p>
                <p>ALT {tel.altitudeM} M · {tel.batteryPct}% BAT</p>
              </div>
              <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2 text-[9px] font-medium text-white">
                <div className="min-w-0 rounded bg-black/55 px-2 py-1 backdrop-blur-sm">
                  <p className="truncate">{landed ? 'HDSI courtyard · touchdown' : `Tracking to ${HDSI.label}`}</p>
                  <p className="text-emerald-300">{landed ? 'GROUND OBSERVATION · FACES AUTO-BLURRED' : 'EYEPOP · COMMON-OBJECTS'}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded bg-black/55 px-2 py-1 text-emerald-300 backdrop-blur-sm"><ScanLine size={11} /> EYEPOP</span>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 p-3">
              {!started || ended ? (
                <button type="button" onClick={ended ? replay : play} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400">
                  {ended ? <><RotateCcw size={16} /> Replay mission</> : <><Play size={16} /> Fly the mission</>}
                </button>
              ) : (
                <div className="flex-1 text-center text-xs font-medium text-slate-300">{fmt(elapsed)} / {fmt(FOOTAGE_DURATION_S)} · {tel.phase}</div>
              )}
            </div>
          </section>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live mission status</p><Navigation size={15} className="text-emerald-600" /></div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={13} /> Origin</div><p className="mt-1 truncate font-semibold text-slate-900">{GEISEL.label}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><Navigation size={13} /> Destination</div><p className="mt-1 truncate font-semibold text-slate-900">{HDSI.label}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><Plane size={13} /> Altitude</div><p className="mt-1 font-semibold text-slate-900">{tel.altitudeM} m</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><Battery size={13} /> Battery</div><p className="mt-1 font-semibold text-slate-900">{tel.batteryPct}%</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={13} /> Elapsed</div><p className="mt-1 font-semibold text-slate-900">{fmt(elapsed)} / {fmt(FOOTAGE_DURATION_S)}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><Navigation size={13} /> Ground speed</div><p className="mt-1 font-semibold text-slate-900">{tel.groundSpeedMps} m/s</p></div>
            </div>
          </div>
        </div>
      </div>

      <p className="max-w-3xl text-[11px] leading-5 text-slate-400">
        Reconstructed from the team&apos;s real DJI flight (DJI_0044, 72 s, recorded at UCSD). The
        takeoff carries the clip&apos;s embedded GPS tag (32.8812, -117.2366, beside Geisel); the clip
        has no per-frame GPS track, so the path between the two campus landmarks is interpolated, not
        surveyed. Detections and face blurring in the feed are produced by EyePop&apos;s
        common-objects model.
      </p>
    </div>
  );
}
