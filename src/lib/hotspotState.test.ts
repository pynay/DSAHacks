import fs from "node:fs";
import os from "node:os";
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

describe("observation persistence + replay", () => {
  function useTempStore(): string {
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "hotspot-obs-test-")),
      "observations.jsonl",
    );
    process.env.HOTSPOT_OBSERVATIONS_FILE = file;
    resetHotspotState();
    return file;
  }

  const validLine = (observedAt: string, count = 25) =>
    JSON.stringify({ lat: 32.7097, lng: -117.1545, count, confidence: 0.9, coverage: 1, radiusKm: 0.18, observedAt });

  it("persists an accepted observation to the JSONL store", () => {
    const file = useTempStore();
    observeHotspot({ lat: 32.7097, lng: -117.1545, count: 42, observedAt: "2026-08-21T12:00:00.000Z" });
    const lines = fs.readFileSync(file, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]);
    expect(record.count).toBe(42);
    expect(record.lat).toBe(32.7097);
    expect(record.observedAt).toBe("2026-08-21T12:00:00.000Z");
    expect(record.source).toBe("live");
  });

  it("replays persisted observations on cold start, skipping junk", () => {
    const file = useTempStore();
    fs.writeFileSync(
      file,
      [
        validLine("2026-08-21T10:00:00.000Z"),
        "corrupt {{{",
        JSON.stringify({ lat: 1, lng: 1, count: 999999 }), // out of range
        validLine("2026-08-21T11:00:00.000Z", 30),
      ].join("\n") + "\n",
    );
    resetHotspotState(); // force rehydration from the file
    const meta = getHotspotMeta();
    expect(meta.observations).toBe(2);
    expect(meta.latest_observation).toBe("2026-08-21T11:00:00.000Z");
    const zones = getHotspotZones();
    expect(zones.some((zone) => zone.confidence === "drone-updated")).toBe(true);
  });

  it("replay never re-appends to the store (idempotent across restarts)", () => {
    const file = useTempStore();
    fs.writeFileSync(file, validLine("2026-08-21T10:00:00.000Z") + "\n");
    resetHotspotState();
    getHotspotZones();
    resetHotspotState();
    getHotspotZones();
    expect(fs.readFileSync(file, "utf8").trim().split("\n")).toHaveLength(1);
    expect(getHotspotMeta().observations).toBe(1);
  });

  it("boots clean when the store file is missing", () => {
    useTempStore(); // path exists but file never written
    expect(getHotspotZones()).toHaveLength(6);
    expect(getHotspotMeta().observations).toBe(0);
  });
});
