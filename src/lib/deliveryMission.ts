import type { InventoryItem } from './types';
import type { DeliveryZone } from './delivery';
import { allocate, type AllocatedItem } from './allocation';

export type DeliveryMissionPhase = 'preparing' | 'en-route' | 'arriving' | 'returning' | 'delivered';

export interface DeliveryPlan {
  zoneId: string;
  zoneLabel: string;
  predictedPeople: number;
  requestedUnits: number;
  allocatedUnits: number;
  coverage: number;
  items: AllocatedItem[];
}

export interface MissionTelemetry {
  phase: DeliveryMissionPhase;
  routeProgress: number;
  overallProgress: number;
  altitudeM: number;
  groundSpeedMps: number;
  batteryPct: number;
  etaSeconds: number;
}

const PREPARE_MS = 2_000;
const OUTBOUND_MS = 10_000;
const DROP_MS = 3_000;
const RETURN_MS = OUTBOUND_MS;
export const MISSION_DURATION_MS = PREPARE_MS + OUTBOUND_MS + DROP_MS + RETURN_MS;

const OUTBOUND_END_MS = PREPARE_MS + OUTBOUND_MS;
const RETURN_START_MS = OUTBOUND_END_MS + DROP_MS;

export function buildDeliveryPlan(
  inventory: InventoryItem[],
  zone: DeliveryZone,
  unitsPerPerson = 3,
): DeliveryPlan {
  const result = allocate(inventory, [zone], unitsPerPerson);
  const allocation = result.zones[0];
  return {
    zoneId: zone.id,
    zoneLabel: zone.label,
    predictedPeople: zone.need,
    requestedUnits: allocation?.demand ?? Math.max(0, Math.round(zone.need * unitsPerPerson)),
    allocatedUnits: allocation?.allocated ?? 0,
    coverage: allocation?.coverage ?? 0,
    items: allocation?.items ?? [],
  };
}

export function missionTelemetry(elapsedMs: number, durationMs = MISSION_DURATION_MS): MissionTelemetry {
  const elapsed = Math.min(durationMs, Math.max(0, elapsedMs));
  const overallProgress = Math.min(1, elapsed / durationMs);

  let phase: DeliveryMissionPhase;
  let routeProgress = 0;
  if (elapsed < PREPARE_MS) {
    phase = 'preparing';
  } else if (elapsed < OUTBOUND_END_MS) {
    phase = 'en-route';
    routeProgress = (elapsed - PREPARE_MS) / OUTBOUND_MS;
  } else if (elapsed < RETURN_START_MS) {
    phase = 'arriving';
    routeProgress = 1;
  } else if (elapsed < durationMs) {
    phase = 'returning';
    routeProgress = 1 - (elapsed - RETURN_START_MS) / RETURN_MS;
  } else phase = 'delivered';

  const outboundProgress = Math.min(1, Math.max(0, (elapsed - PREPARE_MS) / OUTBOUND_MS));
  const returnProgress = Math.min(1, Math.max(0, (elapsed - RETURN_START_MS) / RETURN_MS));
  let altitudeM = 0;
  if (phase === 'preparing') altitudeM = Math.round(60 * (elapsed / PREPARE_MS));
  if (phase === 'en-route') altitudeM = outboundProgress < 0.15 ? Math.round(18 + 42 * (outboundProgress / 0.15)) : 60;
  if (phase === 'arriving') altitudeM = Math.max(18, Math.round(60 - 42 * ((elapsed - OUTBOUND_END_MS) / DROP_MS)));
  if (phase === 'returning') {
    if (returnProgress < 0.15) altitudeM = Math.round(18 + 42 * (returnProgress / 0.15));
    else if (returnProgress > 0.82) altitudeM = Math.round(60 * (1 - (returnProgress - 0.82) / 0.18));
    else altitudeM = 60;
  }

  const flying = phase === 'en-route' || phase === 'returning';
  return {
    phase,
    routeProgress,
    overallProgress,
    altitudeM,
    groundSpeedMps: flying ? 12 : phase === 'arriving' ? 4 : 0,
    batteryPct: Math.max(64, Math.round(100 - overallProgress * 34)),
    etaSeconds: Math.max(0, Math.ceil((durationMs - elapsed) / 1000)),
  };
}

export function interpolatePosition(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  progress: number,
): { lng: number; lat: number } {
  const t = Math.min(1, Math.max(0, progress));
  return { lng: from.lng + (to.lng - from.lng) * t, lat: from.lat + (to.lat - from.lat) * t };
}

export function bearingDegrees(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
): number {
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
