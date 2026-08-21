// Client hook for the EyePop.ai webcam vision bridge (scripts/eyepop_bridge.py).
//
// The bridge runs eyepop.person:latest on laptop-webcam frames and serves the
// latest result on localhost:8091. Video arrives as an MJPEG push stream at
// full camera rate; detections are polled. When the bridge is down this hook
// reports connected: false and the Drone Ops view falls back to the
// simulator's scripted detection.
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

export interface VisionDetection {
  label: 'clear' | 'obstructed'; // obstructed = at least one person in frame
  confidence: number; // max person confidence (0 when none)
  count: number; // people in frame (the drop-zone hazard)
  persons: VisionPerson[];
  objects: VisionObject[]; // every detected object (people, vehicles, packages, ...)
  verdict: VisionVerdict | null; // drop-verdict pipeline (null on older bridges)
  brightness: number; // mean frame brightness feeding the visibility gate
  videoFps: number; // measured camera capture rate
  inferFps: number; // measured EyePop round-trip rate
  ts: number;
}

// Pure JSON -> typed mapping for a /detection payload (unit-tested).
export function parseDetection(d: Record<string, unknown> & { verdict?: unknown }): VisionDetection {
  const raw = d as {
    label?: string; confidence?: number; count?: number;
    persons?: VisionPerson[]; objects?: VisionObject[];
    verdict?: VisionVerdict | null; brightness?: number;
    video_fps?: number; infer_fps?: number; ts?: number;
  };
  return {
    label: raw.label === 'obstructed' ? 'obstructed' : 'clear',
    confidence: raw.confidence ?? 0,
    count: raw.count ?? 0,
    persons: raw.persons ?? [],
    objects: raw.objects ?? [],
    verdict: raw.verdict ?? null,
    brightness: raw.brightness ?? 0,
    videoFps: raw.video_fps ?? 0,
    inferFps: raw.infer_fps ?? 0,
    ts: raw.ts ?? 0,
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
