import { describe, expect, it } from 'vitest';
import { bearingDegrees, buildDeliveryPlan, interpolatePosition, missionTelemetry } from './deliveryMission';
import type { DeliveryZone } from './delivery';
import type { InventoryItem } from './types';

const zone: DeliveryZone = {
  id: 'east-village', neighborhood: 'east_village', label: 'East Village', lng: -117.15,
  lat: 32.71, blocks: 1, need: 5, requests: 0, observed: 0, violations: 0,
};

const inventory: InventoryItem[] = [{
  id: 'rice', name: 'Rice', category: 'Grains', quantity: 20, unit: 'bags',
  expirationDate: '2026-09-01', location: 'A1', reorderThreshold: 2, lastUpdated: '2026-08-21',
}];

describe('automated delivery mission', () => {
  it('turns predicted people into a FEFO-backed delivery plan', () => {
    const plan = buildDeliveryPlan(inventory, zone, 3);
    expect(plan.requestedUnits).toBe(15);
    expect(plan.allocatedUnits).toBe(15);
    expect(plan.coverage).toBe(1);
    expect(plan.items).toEqual([{ name: 'Rice', category: 'Grains', unit: 'bags', quantity: 15 }]);
  });

  it('caps a plan at available inventory', () => {
    const plan = buildDeliveryPlan([{ ...inventory[0], quantity: 4 }], zone, 3);
    expect(plan.requestedUnits).toBe(15);
    expect(plan.allocatedUnits).toBe(4);
    expect(plan.coverage).toBeCloseTo(4 / 15);
  });

  it('flies out, holds for a field observation, and returns after verification', () => {
    expect(missionTelemetry(0).phase).toBe('preparing');
    expect(missionTelemetry(8_000).phase).toBe('en-route');
    expect(missionTelemetry(13_000).phase).toBe('arriving');
    expect(missionTelemetry(15_000, null).phase).toBe('observing');
    expect(missionTelemetry(60_000, null).phase).toBe('observing');
    expect(missionTelemetry(60_000, null).routeProgress).toBe(1);
    expect(missionTelemetry(60_000, null).etaSeconds).toBeNull();
    expect(missionTelemetry(30_000, 25_000).phase).toBe('returning');
    expect(missionTelemetry(30_000, 25_000).routeProgress).toBeCloseTo(0.5);
    expect(missionTelemetry(35_000, 25_000).phase).toBe('delivered');
    expect(missionTelemetry(35_000, 25_000).routeProgress).toBe(0);
  });

  it('uses equal travel time for the outbound and return legs', () => {
    expect(missionTelemetry(7_000).routeProgress).toBeCloseTo(0.5);
    expect(missionTelemetry(30_000, 25_000).routeProgress).toBeCloseTo(0.5);
    expect(missionTelemetry(7_000).groundSpeedMps).toBe(missionTelemetry(30_000, 25_000).groundSpeedMps);
  });

  it('interpolates and calculates a valid route heading', () => {
    expect(interpolatePosition({ lng: 0, lat: 0 }, { lng: 10, lat: 20 }, 0.25)).toEqual({ lng: 2.5, lat: 5 });
    expect(bearingDegrees({ lng: -117.17, lat: 32.72 }, zone)).toBeGreaterThanOrEqual(0);
    expect(bearingDegrees({ lng: -117.17, lat: 32.72 }, zone)).toBeLessThan(360);
  });
});
