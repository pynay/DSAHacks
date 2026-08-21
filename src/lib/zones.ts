// Server-only. Combines model-derived, movable hotspot centers with the latest
// neighborhood-level need proxies. Drone feedback updates the center positions
// through hotspotState; DuckDB remains the source for contextual 311/tent data.
import { DuckDBInstance } from "@duckdb/node-api";
import fs from "node:fs";
import path from "node:path";
import type { DeliveryZone } from "./delivery";
import { getHotspotMeta, getHotspotZones, getUcsdZone } from "./hotspotState";

export type { DeliveryZone };
export { getHotspotMeta };

const MARTS = path.join(process.cwd(), "marts");

interface NeedRow {
  need: number;
  requests: number;
  observed: number;
  violations: number;
  tents: number;
  vehicles: number;
}

let needCache: Promise<Record<string, NeedRow>> | null = null;

function needByNeighborhood(): Promise<Record<string, NeedRow>> {
  needCache ??= (async () => {
    const csv = path.join(MARTS, "monthly_by_neighborhood.csv").replace(/'/g, "''");
    const sql = `
      WITH latest AS (
        SELECT neighborhood, metric, value,
               ROW_NUMBER() OVER (PARTITION BY neighborhood, metric ORDER BY obs_month DESC) AS rn
        FROM read_csv_auto('${csv}')
        WHERE metric IN ('dsdp_individuals','gid_requests','observed_individuals',
                         'violations_72hr_reports','dsdp_tents','dsdp_vehicles')
      )
      SELECT neighborhood,
             MAX(CASE WHEN metric = 'dsdp_individuals'        THEN value END) AS need,
             MAX(CASE WHEN metric = 'gid_requests'            THEN value END) AS requests,
             MAX(CASE WHEN metric = 'observed_individuals'    THEN value END) AS observed,
             MAX(CASE WHEN metric = 'violations_72hr_reports' THEN value END) AS violations,
             MAX(CASE WHEN metric = 'dsdp_tents'              THEN value END) AS tents,
             MAX(CASE WHEN metric = 'dsdp_vehicles'           THEN value END) AS vehicles
      FROM latest
      WHERE rn = 1
      GROUP BY neighborhood`;

    const instance = await DuckDBInstance.create(":memory:");
    const conn = await instance.connect();
    const reader = await conn.runAndReadAll(sql);
    const rows = reader.getRowObjects();
    const out: Record<string, NeedRow> = {};
    for (const row of rows) {
      out[String(row.neighborhood)] = {
        need: Number(row.need ?? 0),
        requests: Number(row.requests ?? 0),
        observed: Number(row.observed ?? 0),
        violations: Number(row.violations ?? 0),
        tents: Number(row.tents ?? 0),
        vehicles: Number(row.vehicles ?? 0),
      };
    }
    return out;
  })();
  return needCache;
}

function pretty(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function fallbackZones(): DeliveryZone[] {
  const geojson = JSON.parse(fs.readFileSync(path.join(MARTS, "blocks.geojson"), "utf8"));
  const acc: Record<string, { sx: number; sy: number; n: number; blocks: number }> = {};
  const walk = (coordinates: unknown, aggregate: { sx: number; sy: number; n: number }) => {
    if (Array.isArray(coordinates) && typeof coordinates[0] === "number") {
      aggregate.sx += coordinates[0] as number;
      aggregate.sy += coordinates[1] as number;
      aggregate.n += 1;
    } else if (Array.isArray(coordinates)) {
      for (const child of coordinates) walk(child, aggregate);
    }
  };
  for (const feature of geojson.features) {
    const neighborhood = feature.properties.neighborhood as string;
    acc[neighborhood] ??= { sx: 0, sy: 0, n: 0, blocks: 0 };
    walk(feature.geometry.coordinates, acc[neighborhood]);
    acc[neighborhood].blocks += 1;
  }
  return Object.entries(acc).map(([neighborhood, value]) => ({
    id: neighborhood,
    neighborhood,
    label: pretty(neighborhood),
    lng: value.sx / value.n,
    lat: value.sy / value.n,
    blocks: value.blocks,
    need: 0,
    requests: 0,
    observed: 0,
    violations: 0,
    tents: 0,
    vehicles: 0,
    elevation: null,
  }));
}

// Ground elevation (meters) for a point: USGS (1m, US-only) with Open-Meteo fallback.
export async function elevationMeters(lng: number, lat: number): Promise<number | null> {
  try {
    const response = await fetch(
      `https://epqs.nationalmap.gov/v1/json?x=${lng}&y=${lat}&units=Meters&wkid=4326`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (response.ok) {
      const value = Number((await response.json()).value);
      if (Number.isFinite(value) && value > -1000) return Math.round(value * 10) / 10;
    }
  } catch {
    // Fall through to the global terrain service.
  }
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (response.ok) {
      const value = Number((await response.json()).elevation?.[0]);
      if (Number.isFinite(value)) return Math.round(value * 10) / 10;
    }
  } catch {
    // Elevation is optional; the delivery model can still operate.
  }
  return null;
}

const elevationCache = new Map<string, Promise<number | null>>();

function cachedElevation(lng: number, lat: number): Promise<number | null> {
  const key = `${lng.toFixed(5)},${lat.toFixed(5)}`;
  let result = elevationCache.get(key);
  if (!result) {
    result = elevationMeters(lng, lat);
    elevationCache.set(key, result);
  }
  return result;
}

export async function getZones(): Promise<DeliveryZone[]> {
  const need = await needByNeighborhood();
  let zones: DeliveryZone[];
  try {
    zones = getHotspotZones();
  } catch (error) {
    console.warn("[zones] hotspot seed unavailable; using neighborhood centroids", error);
    zones = fallbackZones();
  }
  // Append the UCSD demo zone (a drone target away from downtown).
  zones = [...zones, getUcsdZone()];

  await Promise.all(
    zones.map(async (zone) => {
      const context = need[zone.neighborhood];
      if (!zone.predicted) zone.need = context?.need ?? 0;
      zone.requests = context?.requests ?? 0;
      zone.observed = context?.observed ?? 0;
      zone.violations = context?.violations ?? 0;
      zone.tents = context?.tents ?? 0;
      zone.vehicles = context?.vehicles ?? 0;
      zone.elevation = await cachedElevation(zone.lng, zone.lat);
    }),
  );
  return zones.sort((a, b) => b.need - a.need);
}
