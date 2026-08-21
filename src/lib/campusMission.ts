// UCSD campus tracking mission: Geisel Library -> HDSI building, reconstructed
// from the team's real DJI drone footage (public/ucsd-drone.mp4, 72.04 s).
//
// What is real vs. interpolated (kept honest on purpose):
//  - The clip carries a real embedded GPS location tag at takeoff
//    (32.8812, -117.2366), just east of Geisel Library.
//  - The endpoints are the two real, recognizable UCSD landmarks the footage
//    begins and ends at. The drone is directly over the HDSI building's plaza
//    ~24 s in (its red-brick portal + diamond courtyard are visible in-frame;
//    HDSI is the former Literature Building, whose main door faces Warren
//    Lecture Hall), then descends into the courtyard and lands beside it (~71 s).
//  - The DJI clip has NO per-frame GPS track, so the path *between* the two
//    landmarks is interpolated along the takeoff->plaza line, not surveyed.
//
// The map animation and telemetry below are driven off the video's own
// playback clock so the flown path and the camera stay in lockstep.

import { interpolatePosition, bearingDegrees } from './deliveryMission';

export interface GeoPoint {
  lng: number;
  lat: number;
}

export const GEISEL = { lng: -117.2373, lat: 32.8811, label: 'Geisel Library' };
export const HDSI = { lng: -117.2344, lat: 32.8807, label: 'HDSI building' };

// Real GPS location tag embedded in DJI_0044.MP4 (takeoff, just east of Geisel).
export const FOOTAGE_TAKEOFF = { lng: -117.2366, lat: 32.8812 };
export const FOOTAGE_DURATION_S = 72.04;

export type CampusPhase = 'ascending' | 'en-route' | 'descending' | 'landed';

export interface CampusTelemetry {
  phase: CampusPhase;
  phaseLabel: string;
  routeProgress: number; // 0 over Geisel, 1 over the HDSI plaza
  altitudeM: number;
  groundSpeedMps: number;
  batteryPct: number;
  elapsedS: number;
}

// Timeline segments (seconds), matched to what the footage shows.
const ASCEND_END_S = 6; // lift-off + climb over Geisel
const CRUISE_END_S = 24; // over the HDSI plaza by ~24 s (matches the clip)
const DESCEND_END_S = 66; // spiral down into the courtyard
const CRUISE_ALT_M = 40; // cruise altitude

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const PHASE_LABEL: Record<CampusPhase, string> = {
  ascending: 'Lifting off from Geisel Library',
  'en-route': 'Tracking east to the HDSI building',
  descending: 'Descending into the HDSI courtyard',
  landed: 'Touched down beside HDSI',
};

// Telemetry as a pure function of elapsed footage seconds, so it can be driven
// straight off the <video> clock (0 -> FOOTAGE_DURATION_S).
export function campusTelemetry(elapsedS: number): CampusTelemetry {
  const t = clamp(elapsedS, 0, FOOTAGE_DURATION_S);

  let phase: CampusPhase;
  let routeProgress: number;
  let altitudeM: number;
  let groundSpeedMps: number;

  if (t < ASCEND_END_S) {
    phase = 'ascending';
    routeProgress = 0;
    altitudeM = CRUISE_ALT_M * (t / ASCEND_END_S);
    groundSpeedMps = 2;
  } else if (t < CRUISE_END_S) {
    phase = 'en-route';
    routeProgress = (t - ASCEND_END_S) / (CRUISE_END_S - ASCEND_END_S);
    altitudeM = CRUISE_ALT_M;
    groundSpeedMps = 11;
  } else if (t < DESCEND_END_S) {
    phase = 'descending';
    routeProgress = 1;
    // Over the plaza; loses altitude as it settles into the courtyard.
    altitudeM = CRUISE_ALT_M - (CRUISE_ALT_M - 3) * ((t - CRUISE_END_S) / (DESCEND_END_S - CRUISE_END_S));
    groundSpeedMps = 1.5;
  } else {
    phase = 'landed';
    routeProgress = 1;
    altitudeM = Math.max(0, 3 * (1 - (t - DESCEND_END_S) / (FOOTAGE_DURATION_S - DESCEND_END_S)));
    groundSpeedMps = 0;
  }

  return {
    phase,
    phaseLabel: PHASE_LABEL[phase],
    routeProgress: clamp(routeProgress, 0, 1),
    altitudeM: Math.round(altitudeM),
    groundSpeedMps,
    batteryPct: Math.round(100 - (t / FOOTAGE_DURATION_S) * 12),
    elapsedS: t,
  };
}

// Drone lng/lat for a given telemetry sample, along the Geisel -> HDSI line.
export function campusDronePosition(routeProgress: number): GeoPoint {
  return interpolatePosition(GEISEL, HDSI, routeProgress);
}

// Where EyePop's detected people sit, clustered in the HDSI courtyard (~10-15 m
// apart) beside the drop point. The annotated feed lands on 3 people at ground.
export const PERSON_SPOTS: GeoPoint[] = [
  { lng: -117.23432, lat: 32.88066 },
  { lng: -117.23451, lat: 32.88074 },
  { lng: -117.23440, lat: 32.88059 },
];

// EyePop detections surfaced over the timeline: the aerial pass picks up one
// person over the building, and the landing settles on 3 (matches the annotated
// feed's "3 detected"). Never exceeds PERSON_SPOTS.length.
export function campusDetections(elapsedS: number): number {
  const t = clamp(elapsedS, 0, FOOTAGE_DURATION_S);
  if (t < 20) return 0;
  if (t < 42) return 1;
  if (t < 58) return 2;
  return 3;
}

// Fixed flight heading (Geisel -> HDSI), for orienting the drone marker.
export const CAMPUS_HEADING_DEG = bearingDegrees(GEISEL, HDSI);
