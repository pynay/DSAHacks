import { describe, expect, it } from "vitest";
import { HotspotObservationError, parseHotspotObservation } from "./hotspotObservation";

describe("parseHotspotObservation", () => {
  it("accepts a complete, bounded observation", () => {
    expect(
      parseHotspotObservation({
        lat: 32.7157,
        lng: -117.1611,
        count: 24,
        confidence: 0.9,
        coverage: 0.8,
        radiusKm: 0.2,
        observedAt: "2026-08-21T12:00:00Z",
      }),
    ).toEqual({
      lat: 32.7157,
      lng: -117.1611,
      count: 24,
      confidence: 0.9,
      coverage: 0.8,
      radiusKm: 0.2,
      observedAt: "2026-08-21T12:00:00Z",
    });
  });

  it.each([
    null,
    [],
    { lat: 91, lng: 0, count: 1 },
    { lat: 0, lng: -181, count: 1 },
    { lat: 0, lng: 0, count: 1.5 },
    { lat: 0, lng: 0, count: 5001 },
    { lat: 0, lng: 0, count: 1, confidence: 0 },
    { lat: 0, lng: 0, count: 1, coverage: 0.01 },
    { lat: 0, lng: 0, count: 1, radiusKm: 3 },
    { lat: 0, lng: 0, count: 1, observedAt: "not-a-date" },
  ])("rejects invalid observation %#", (observation) => {
    expect(() => parseHotspotObservation(observation)).toThrow(HotspotObservationError);
  });
});
