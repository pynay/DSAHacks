// Client hook for the EyePop.ai webcam vision bridge (scripts/eyepop_bridge.py).
//
// The bridge runs an EyePop scene detector on webcam/video frames and serves
// the latest objects plus a person-only hazard count on localhost:8091. Video
// arrives as an MJPEG push stream at full camera rate; detections are polled.
// When the bridge is down this hook reports connected: false.
'use client';

import { useEffect, useState } from 'react';

const BRIDGE = 'http://localhost:8091';
const POLL_MS = 400;
const FETCH_TIMEOUT_MS = 800;

export interface VisionPerson {
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisionObject extends VisionPerson {
  label: string;
}

export interface VisionVerdict {
  state: 'GO' | 'HOLD' | 'NO_GO';
  reason: string; // human-readable, e.g. "person in zone (90%)" / "clearing 1.2s / 3s"
  score: number; // 0-100 drop-safety score
  inZone: number; // detections intersecting the landing zone
  nearby: number; // detections elsewhere in frame
  zone: number[]; // landing zone as frame fractions [x0, y0, x1, y1]
}

export interface VisionStats {
  peakPeople: number;
  holds: number; // times the verdict entered HOLD this session
  samples: number;
  series: [number, number][]; // [wall-clock ts, people] downsampled rolling window
}

export interface VisionDetection {
  label: 'people-detected' | 'no-people-detected'; // sensing-first naming (bridge sends clear/obstructed)
  confidence: number; // max person confidence (0 when none)
  count: number; // people in frame (the drop-zone hazard)
  stablePeople: number; // median-low over the last 5 inference counts; displayed telemetry, not auto-assimilated
  persons: VisionPerson[];
  objects: VisionObject[]; // every detected object (people, vehicles, packages, ...)
  verdict: VisionVerdict | null; // drop-verdict pipeline (null on older bridges)
  brightness: number; // mean frame brightness feeding the visibility gate
  bootId: string; // bridge process id; changes on restart -> UI reconnects the MJPEG stream
  faceMode: string; // 'eyepop-face' | 'head-fallback' | 'off'
  blurred: number; // face regions pixelated on the current frame
  stats: VisionStats | null;
  videoFps: number; // measured camera capture rate
  inferFps: number; // measured EyePop round-trip rate
  ts: number;
  vehicles: VisionObject[]; // DSDP's second count component (car/truck/bus/...)
  vehicleCount: number;
  source: VisionSource; // what the bridge is watching (drone RTMP stream, webcam, recorded file)
}

export interface VisionSource {
  kind: 'live-stream' | 'webcam' | 'file';
  label: string; // e.g. "DJI Mini 4K via RTMP"
  live: boolean; // false only for recorded files
}

// Pure JSON -> typed mapping for a /detection payload (unit-tested).
export function parseDetection(d: Record<string, unknown> & { verdict?: unknown }): VisionDetection {
  const raw = d as {
    label?: string; confidence?: number; count?: number;
    persons?: VisionPerson[]; objects?: VisionObject[];
    verdict?: VisionVerdict | null; brightness?: number; boot_id?: string;
    face_mode?: string; blurred?: number; stable_people?: number;
    stats?: { peak_people?: number; holds?: number; samples?: number; series?: [number, number][] };
    video_fps?: number; infer_fps?: number; ts?: number;
    vehicles?: VisionObject[]; vehicle_count?: number;
    source?: { kind?: string; label?: string; live?: boolean };
  };
  const kind = raw.source?.kind;
  const source: VisionSource = {
    kind: kind === 'live-stream' || kind === 'file' ? kind : 'webcam',
    label: raw.source?.label ?? 'webcam',
    live: raw.source?.live ?? true,
  };
  return {
    label: raw.label === 'obstructed' ? 'people-detected' : 'no-people-detected',
    confidence: raw.confidence ?? 0,
    count: raw.count ?? 0,
    stablePeople: raw.stable_people ?? raw.count ?? 0,
    persons: raw.persons ?? [],
    objects: raw.objects ?? [],
    verdict: raw.verdict ?? null,
    brightness: raw.brightness ?? 0,
    bootId: raw.boot_id ?? '',
    faceMode: raw.face_mode ?? 'off',
    blurred: raw.blurred ?? 0,
    stats: raw.stats
      ? {
          peakPeople: raw.stats.peak_people ?? 0,
          holds: raw.stats.holds ?? 0,
          samples: raw.stats.samples ?? 0,
          series: raw.stats.series ?? [],
        }
      : null,
    videoFps: raw.video_fps ?? 0,
    inferFps: raw.infer_fps ?? 0,
    ts: raw.ts ?? 0,
    vehicles: raw.vehicles ?? [],
    vehicleCount: raw.vehicle_count ?? raw.vehicles?.length ?? 0,
    source,
  };
}

interface VisionState {
  connected: boolean;
  detection: VisionDetection | null;
}

export function useDroneVision(): { connected: boolean; detection: VisionDetection | null; frameUrl: string } {
  const [state, setState] = useState<VisionState>({ connected: false, detection: null });

  useEffect(() => {
    let alive = true;
    const id = setInterval(async () => {
      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${BRIDGE}/detection`, { signal: ctl.signal });
        if (!alive) return;
        if (!res.ok) throw new Error(String(res.status)); // 503 while warming
        const d = await res.json();
        setState({ connected: true, detection: parseDetection(d) });
      } catch {
        // Bridge down/unreachable: report disconnected once, avoid re-render spam.
        if (alive) setState((s) => (s.connected || s.detection ? { connected: false, detection: null } : s));
      } finally {
        clearTimeout(timeout);
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return {
    connected: state.connected,
    detection: state.detection,
    // MJPEG push stream: constant URL, the browser renders it as live video.
    frameUrl: `${BRIDGE}/stream.mjpg`,
  };
}
