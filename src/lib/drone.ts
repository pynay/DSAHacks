// Client-safe drone telemetry types + a simulator.
//
// The live drone/EyePop feed is meant to replace `useDroneTelemetry`'s
// simulator: point it at a WebSocket/SSE endpoint that emits `DroneTelemetry`
// frames (the drone's flight controller for position/battery, EyePop.ai's
// ability result for `detection`). Until then it simulates a delivery run
// from the depot out to the highest-need zone so the view is demo-live.
'use client';

import { useEffect, useRef, useState } from 'react';
import { DEPOT, haversineKm, type DeliveryZone } from './delivery';

export type DroneStatus = 'en-route' | 'delivering' | 'returning' | 'idle';

export interface DroneTelemetry {
  live: boolean; // false = simulated (badge in UI)
  status: DroneStatus;
  targetId: string;
  targetLabel: string;
  lng: number;
  lat: number;
  progress: number; // 0..1 along depot -> target
  altitudeM: number;
  groundSpeedMps: number;
  headingDeg: number;
  batteryPct: number;
  signalPct: number;
  payloadKg: number;
  distanceKm: number; // remaining to target
  etaMin: number;
  detection: { label: 'clear' | 'obstructed'; confidence: number };
  updatedAt: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function bearing(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const y = Math.sin(((b.lng - a.lng) * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180);
  const x =
    Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) -
    Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(((b.lng - a.lng) * Math.PI) / 180);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

const CRUISE_ALT = 60; // meters
const SPEED = 12; // m/s cruise

// Simulate a delivery loop across the given zones (highest-need first).
export function useDroneTelemetry(zones: DeliveryZone[]): DroneTelemetry | null {
  const [tel, setTel] = useState<DroneTelemetry | null>(null);
  const ref = useRef({ idx: 0, progress: 0, phase: 'out' as 'out' | 'drop' | 'back', battery: 92, dropTicks: 0 });

  useEffect(() => {
    if (!zones.length) return;
    const targets = [...zones].filter((z) => z.need > 0).sort((a, b) => b.need - a.need);
    if (!targets.length) return;

    const id = setInterval(() => {
      const s = ref.current;
      const target = targets[s.idx % targets.length];
      const legKm = Math.max(0.05, haversineKm(DEPOT, target));
      const legMeters = legKm * 1000;
      const step = SPEED / legMeters; // fraction of the leg per second

      let status: DroneStatus = 'en-route';
      let alt = CRUISE_ALT;
      let detection: DroneTelemetry['detection'] = {
        label: 'clear',
        confidence: 0.9 + (s.idx % 3) * 0.02,
      };

      if (s.phase === 'out') {
        s.progress = Math.min(1, s.progress + step);
        alt = CRUISE_ALT;
        if (s.progress >= 1) {
          s.phase = 'drop';
          s.dropTicks = 0;
        }
      } else if (s.phase === 'drop') {
        status = 'delivering';
        s.dropTicks += 1;
        alt = Math.max(2, CRUISE_ALT - s.dropTicks * 12); // descend
        // brief obstacle check during descent, then clear
        detection =
          s.dropTicks === 2
            ? { label: 'obstructed', confidence: 0.71 }
            : { label: 'clear', confidence: 0.95 };
        if (s.dropTicks >= 5) {
          s.phase = 'back';
          s.progress = 1;
        }
      } else {
        status = 'returning';
        s.progress = Math.max(0, s.progress - step);
        alt = CRUISE_ALT;
        if (s.progress <= 0) {
          s.phase = 'out';
          s.progress = 0;
          s.idx = (s.idx + 1) % targets.length;
          s.battery = s.battery > 30 ? s.battery - 6 : 100; // swap battery at base
        }
      }

      const from = s.phase === 'back' ? target : DEPOT;
      const to = s.phase === 'back' ? DEPOT : target;
      const lng = lerp(DEPOT.lng, target.lng, s.progress);
      const lat = lerp(DEPOT.lat, target.lat, s.progress);
      const remainingKm = legKm * (s.phase === 'drop' ? 0 : status === 'returning' ? s.progress : 1 - s.progress);

      setTel({
        live: false,
        status,
        targetId: target.id,
        targetLabel: target.label,
        lng,
        lat,
        progress: s.progress,
        altitudeM: Math.round(alt),
        groundSpeedMps: status === 'delivering' ? 0 : SPEED,
        headingDeg: Math.round(bearing(from, to)),
        batteryPct: Math.round(s.battery),
        signalPct: 88 + ((s.idx * 3) % 10),
        payloadKg: status === 'returning' ? 0 : 4.5,
        distanceKm: Math.round(remainingKm * 100) / 100,
        etaMin: Math.max(0, Math.round((remainingKm * 1000) / SPEED / 60)),
        detection,
        updatedAt: Date.now(),
      });
    }, 1000);

    return () => clearInterval(id);
  }, [zones]);

  return tel;
}
