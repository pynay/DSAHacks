// Client-safe drone telemetry types + a simulator.
//
// The live drone/EyePop feed is meant to replace `useDroneTelemetry`'s
// simulator: point it at a WebSocket/SSE endpoint that emits `DroneTelemetry`
// frames (the drone's flight controller for position/battery, EyePop.ai's
// ability result for `detection`). Until then it simulates a sensing run
// from the operations base out to the highest-priority zone.
'use client';

import { useEffect, useRef, useState } from 'react';
import { DEPOT, haversineKm, type DeliveryZone } from './delivery';

export type DroneStatus = 'en-route' | 'observing' | 'returning' | 'idle';

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
  observationsCollected: number;
  distanceKm: number; // remaining to target
  etaMin: number;
  detection: { label: 'people-detected' | 'no-people-detected'; confidence: number };
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
const SPEED = 12; // m/s cruise (shown in telemetry)
const TICK_MS = 650;
const DEMO_SPEEDUP = 7; // compress flight time so the map motion is visible in a demo

// Simulate an information-gathering loop across the given zones (highest-need first).
export function useDroneTelemetry(zones: DeliveryZone[]): DroneTelemetry | null {
  const [tel, setTel] = useState<DroneTelemetry | null>(null);
  const ref = useRef({ idx: 0, progress: 0, phase: 'out' as 'out' | 'observe' | 'back', battery: 92, observeTicks: 0, observations: 0 });

  useEffect(() => {
    if (!zones.length) return;
    const targets = [...zones].filter((z) => z.need > 0).sort((a, b) => b.need - a.need);
    if (!targets.length) return;

    const id = setInterval(() => {
      const s = ref.current;
      const target = targets[s.idx % targets.length];
      const legKm = Math.max(0.05, haversineKm(DEPOT, target));
      const legMeters = legKm * 1000;
      const step = (SPEED * DEMO_SPEEDUP * (TICK_MS / 1000)) / legMeters; // fraction of leg per tick

      let status: DroneStatus = 'en-route';
      let alt = CRUISE_ALT;
      let detection: DroneTelemetry['detection'] = {
        label: 'no-people-detected',
        confidence: 0,
      };

      if (s.phase === 'out') {
        s.progress = Math.min(1, s.progress + step);
        alt = CRUISE_ALT;
        if (s.progress >= 1) {
          s.phase = 'observe';
          s.observeTicks = 0;
        }
      } else if (s.phase === 'observe') {
        status = 'observing';
        s.observeTicks += 1;
        alt = CRUISE_ALT;
        // Illustrative sensor result while the drone holds position.
        detection =
          s.observeTicks >= 2
            ? { label: 'people-detected', confidence: 0.91 }
            : { label: 'no-people-detected', confidence: 0 };
        if (s.observeTicks >= 5) {
          s.phase = 'back';
          s.progress = 1;
          s.observations += 1;
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
      const remainingKm = legKm * (s.phase === 'observe' ? 0 : status === 'returning' ? s.progress : 1 - s.progress);

      setTel({
        live: false,
        status,
        targetId: target.id,
        targetLabel: target.label,
        lng,
        lat,
        progress: s.progress,
        altitudeM: Math.round(alt),
        groundSpeedMps: status === 'observing' ? 0 : SPEED,
        headingDeg: Math.round(bearing(from, to)),
        batteryPct: Math.round(s.battery),
        signalPct: 88 + ((s.idx * 3) % 10),
        observationsCollected: s.observations,
        distanceKm: Math.round(remainingKm * 100) / 100,
        etaMin: Math.max(0, Math.round((remainingKm * 1000) / SPEED / 60)),
        detection,
        updatedAt: Date.now(),
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, [zones]);

  return tel;
}
