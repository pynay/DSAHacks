import { describe, it, expect } from 'vitest';
import { campusTelemetry, campusDronePosition, FOOTAGE_DURATION_S, GEISEL, HDSI } from './campusMission';

describe('campusTelemetry', () => {
  it('starts over Geisel, climbing, at t=0', () => {
    const t = campusTelemetry(0);
    expect(t.phase).toBe('ascending');
    expect(t.routeProgress).toBe(0);
    expect(t.altitudeM).toBe(0);
  });

  it('is over the HDSI plaza (routeProgress 1) by the time it starts descending', () => {
    const t = campusTelemetry(30);
    expect(t.phase).toBe('descending');
    expect(t.routeProgress).toBe(1);
    expect(t.altitudeM).toBeLessThan(40);
    expect(t.altitudeM).toBeGreaterThan(0);
  });

  it('ends landed with battery drained but never below zero altitude', () => {
    const t = campusTelemetry(FOOTAGE_DURATION_S);
    expect(t.phase).toBe('landed');
    expect(t.altitudeM).toBe(0);
    expect(t.batteryPct).toBeLessThan(100);
    expect(t.groundSpeedMps).toBe(0);
  });

  it('clamps out-of-range times', () => {
    expect(campusTelemetry(-5).elapsedS).toBe(0);
    expect(campusTelemetry(999).elapsedS).toBe(FOOTAGE_DURATION_S);
  });
});

describe('campusDronePosition', () => {
  it('interpolates from Geisel to HDSI', () => {
    expect(campusDronePosition(0)).toEqual({ lng: GEISEL.lng, lat: GEISEL.lat });
    expect(campusDronePosition(1)).toEqual({ lng: HDSI.lng, lat: HDSI.lat });
    const mid = campusDronePosition(0.5);
    expect(mid.lng).toBeCloseTo((GEISEL.lng + HDSI.lng) / 2, 6);
    expect(mid.lat).toBeCloseTo((GEISEL.lat + HDSI.lat) / 2, 6);
  });
});
