import type { InventoryItem } from './types';
import type { DeliveryZone } from './delivery';
import { allocate, type AllocatedItem } from './allocation';

export type DeliveryMissionPhase = 'preparing' | 'en-route' | 'arriving' | 'delivered';

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

const PREPARE_END = 0.12;
const ARRIVE_START = 0.82;

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

export function missionTelemetry(elapsedMs: number, durationMs = 16_000): MissionTelemetry {
  const overallProgress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  const routeProgress = Math.min(
    1,
    Math.max(0, (overallProgress - PREPARE_END) / (ARRIVE_START - PREPARE_END)),
  );

  let phase: DeliveryMissionPhase;
  if (overallProgress < PREPARE_END) phase = 'preparing';
  else if (overallProgress < ARRIVE_START) phase = 'en-route';
  else if (overallProgress < 1) phase = 'arriving';
  else phase = 'delivered';

  const flying = phase === 'en-route';
  return {
    phase,
    routeProgress,
    overallProgress,
    altitudeM: phase === 'preparing' ? Math.round(60 * (overallProgress / PREPARE_END)) : phase === 'arriving' ? Math.round(60 * (1 - (overallProgress - ARRIVE_START) / (1 - ARRIVE_START))) : phase === 'delivered' ? 0 : 60,
    groundSpeedMps: flying ? 12 : phase === 'arriving' ? 4 : 0,
    batteryPct: Math.max(72, Math.round(100 - overallProgress * 24)),
    etaSeconds: Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000)),
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
