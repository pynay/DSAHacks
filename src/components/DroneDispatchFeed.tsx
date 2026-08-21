'use client';

import { Camera, ScanLine, Wifi } from 'lucide-react';
import { useDroneVision } from '@/lib/droneVision';
import type { MissionTelemetry } from '@/lib/deliveryMission';

interface DroneDispatchFeedProps {
  missionId: string;
  destination: string;
  predictedPeople: number;
  telemetry: MissionTelemetry;
}

export default function DroneDispatchFeed({
  missionId,
  destination,
  predictedPeople,
  telemetry,
}: DroneDispatchFeedProps) {
  const vision = useDroneVision();
  const missionComplete = telemetry.phase === 'delivered';
  const returning = telemetry.phase === 'returning';
  const nearingSite = telemetry.phase === 'arriving';
  const terrainTransform = `translate3d(${-5 - telemetry.routeProgress * 13}%, ${-4 - telemetry.routeProgress * 9}%, 0) rotate(${-7 + telemetry.routeProgress * 3}deg) scale(1.24)`;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[#071a2b] shadow-sm" aria-label="Live drone camera feed">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-white">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Camera size={14} className="text-emerald-300" /> Drone camera
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em]">
          {!vision.connected && <span className="text-slate-400">DEMO SOURCE</span>}
          <span className="flex items-center gap-1 text-emerald-300">
            <span className={`h-1.5 w-1.5 rounded-full ${missionComplete ? 'bg-emerald-300' : 'animate-pulse bg-red-400'}`} />
            {missionComplete ? 'FEED COMPLETE' : 'LIVE'}
          </span>
        </div>
      </div>

      <div className="relative aspect-video overflow-hidden bg-[#172d2a]">
        {vision.connected ? (
          // eslint-disable-next-line @next/next/no-img-element -- MJPEG stream is provided by the local EyePop bridge.
          <img src={vision.frameUrl} alt="Live drone camera" className="h-full w-full object-cover" />
        ) : (
          <div
            data-testid="mock-drone-feed"
            className="absolute -inset-[28%] transition-transform duration-500 ease-linear"
            style={{
              transform: terrainTransform,
              backgroundColor: '#52624d',
              backgroundImage: [
                'radial-gradient(circle at 21% 27%, rgba(21,45,32,.82) 0 7%, transparent 7.5%)',
                'radial-gradient(circle at 76% 61%, rgba(34,60,40,.72) 0 10%, transparent 10.5%)',
                'linear-gradient(32deg, transparent 45%, rgba(205,200,169,.72) 46% 49%, transparent 50%)',
                'linear-gradient(112deg, transparent 47%, rgba(180,183,164,.56) 48% 50%, transparent 51%)',
                'repeating-linear-gradient(6deg, rgba(236,220,178,.1) 0 2px, transparent 2px 18px)',
                'repeating-linear-gradient(96deg, rgba(9,31,25,.16) 0 1px, transparent 1px 23px)',
              ].join(','),
            }}
          >
            <div className="absolute left-[48%] top-[30%] h-[30%] w-[24%] rotate-6 rounded-sm border border-white/15 bg-slate-300/20 shadow-[0_0_0_3px_rgba(20,35,31,.2)]" />
            <div className="absolute left-[18%] top-[61%] h-[13%] w-[31%] -rotate-12 rounded-sm bg-[#8a8975]/70" />
            <div className="absolute right-[13%] top-[19%] h-[17%] w-[19%] rotate-12 rounded-full bg-[#283d31]/75" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(1,10,16,.08),rgba(1,10,16,.3)),repeating-linear-gradient(0deg,transparent_0_3px,rgba(255,255,255,.025)_3px_4px)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/60">
          <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-emerald-300/60" />
          <span className="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-emerald-300/60" />
          <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-emerald-300/60" />
          <span className="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-emerald-300/60" />
        </div>

        {nearingSite && !vision.connected && [
          ['left-[26%] top-[45%]', 'P-01'],
          ['left-[62%] top-[55%]', 'P-02'],
        ].map(([position, label]) => (
          <div key={label} className={`pointer-events-none absolute ${position} h-12 w-7 border border-amber-300 text-[8px] font-semibold text-amber-200`}>
            <span className="absolute -top-4 left-0">{label}</span>
          </div>
        ))}

        <div className="absolute left-2 top-2 rounded bg-black/55 px-2 py-1 font-mono text-[9px] leading-4 text-slate-200 backdrop-blur-sm">
          <p>{missionId} · CAM-01</p>
          <p>ALT {telemetry.altitudeM} M · {telemetry.batteryPct}% BAT</p>
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2 text-[9px] font-medium text-white">
          <div className="min-w-0 rounded bg-black/55 px-2 py-1 backdrop-blur-sm">
            <p className="truncate">{returning || missionComplete ? 'Return to operations depot' : destination}</p>
            <p className="text-emerald-300">{returning ? 'PAYLOAD RELEASED · RETURN LEG' : missionComplete ? 'ROUND TRIP COMPLETE' : `MODEL NEED · ${predictedPeople} PEOPLE`}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded bg-black/55 px-2 py-1 text-emerald-300 backdrop-blur-sm">
            {vision.connected ? <ScanLine size={11} /> : <Wifi size={11} />}
            {vision.connected ? 'EYEPOP' : 'UPLINK'}
          </span>
        </div>
      </div>
    </section>
  );
}
