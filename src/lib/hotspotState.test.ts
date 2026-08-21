import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getHotspotMeta,
  getHotspotZones,
  observeHotspot,
  resetHotspotState,
} from "./hotspotState";
import { haversineKm } from "./delivery";

afterEach(() => resetHotspotState());

describe("live hotspot assimilation", () => {
  it("loads six movable zones from the offline model seed", () => {
    const zones = getHotspotZones();
    expect(zones).toHaveLength(6);
    expect(zones.every((zone) => zone.predicted && zone.need >= 0)).toBe(true);
    expect(zones.every((zone) => zone.confidence === "historical-prior")).toBe(true);
    expect(getHotspotMeta().observations).toBe(0);
  });

  it("moves a hotspot toward a strong drone observation", () => {
    const seed = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "marts", "hotspot_blocks.json"), "utf8"),
    ) as { blocks: { lat: number; lng: number; predicted: number }[] };
    const target = [...seed.blocks].sort((a, b) => a.predicted - b.predicted)[0];
    const beforeDistance = Math.min(
      ...getHotspotZones().map((zone) => haversineKm(zone, target)),
    );

    const observation = observeHotspot({
      lat: target.lat,
      lng: target.lng,
      count: 1000,
      confidence: 0.95,
      coverage: 1,
      radiusKm: 0.03,
      observedAt: "2026-08-21T12:00:00.000Z",
    });
    const after = getHotspotZones();
    const afterDistance = Math.min(...after.map((zone) => haversineKm(zone, target)));

    expect(observation.affectedBlocks).toBeGreaterThan(0);
    expect(afterDistance).toBeLessThan(beforeDistance);
    expect(afterDistance).toBeLessThan(0.12);
    const updated = after.filter((zone) => zone.confidence === "drone-updated");
    const historical = after.filter((zone) => zone.confidence === "historical-prior");
    expect(updated.length).toBeGreaterThan(0);
    expect(historical.length).toBeGreaterThan(0);
    expect(updated.every((zone) => zone.feedbackObservations === 1)).toBe(true);
    expect(historical.every((zone) => zone.feedbackObservations === 0)).toBe(true);
    expect(getHotspotMeta()).toMatchObject({
      observations: 1,
      latest_observation: "2026-08-21T12:00:00.000Z",
    });
  });
});
