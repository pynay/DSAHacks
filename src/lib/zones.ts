// Server-only. Derives food-delivery drop zones from the SD Homelessness Data
// Commons using DuckDB SQL over the committed marts:
//   - need signals per neighborhood  <- marts/monthly_by_neighborhood.csv
//   - zone geometry (block centroids) <- marts/blocks.geojson
// The DuckDB query runs once and is cached for the server's lifetime.
import { DuckDBInstance } from "@duckdb/node-api";
import fs from "node:fs";
import path from "node:path";
import type { DeliveryZone } from "./delivery";

export type { DeliveryZone };

const MARTS = path.join(process.cwd(), "marts");

function pretty(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Latest value per (neighborhood, metric), pivoted to one row per neighborhood.
async function needByNeighborhood(): Promise<
  Record<string, { need: number; requests: number; observed: number; violations: number }>
> {
  const csv = path.join(MARTS, "monthly_by_neighborhood.csv").replace(/'/g, "''");
  const sql = `
    WITH latest AS (
      SELECT neighborhood, metric, value,
             ROW_NUMBER() OVER (PARTITION BY neighborhood, metric ORDER BY obs_month DESC) AS rn
      FROM read_csv_auto('${csv}')
      WHERE metric IN ('dsdp_individuals','gid_requests','observed_individuals','violations_72hr_reports')
    )
    SELECT neighborhood,
           MAX(CASE WHEN metric = 'dsdp_individuals'        THEN value END) AS need,
           MAX(CASE WHEN metric = 'gid_requests'            THEN value END) AS requests,
           MAX(CASE WHEN metric = 'observed_individuals'    THEN value END) AS observed,
           MAX(CASE WHEN metric = 'violations_72hr_reports' THEN value END) AS violations
    FROM latest
    WHERE rn = 1
    GROUP BY neighborhood`;

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  const reader = await conn.runAndReadAll(sql);
  const rows = reader.getRowObjects();
  const out: Record<string, { need: number; requests: number; observed: number; violations: number }> = {};
  for (const r of rows) {
    out[String(r.neighborhood)] = {
      need: Number(r.need ?? 0),
      requests: Number(r.requests ?? 0),
      observed: Number(r.observed ?? 0),
      violations: Number(r.violations ?? 0),
    };
  }
  return out;
}

// Average vertex centroid + block count per neighborhood from the block polygons.
function centroidsByNeighborhood(): Record<string, { lng: number; lat: number; blocks: number }> {
  const gj = JSON.parse(fs.readFileSync(path.join(MARTS, "blocks.geojson"), "utf8"));
  const acc: Record<string, { sx: number; sy: number; n: number; blocks: number }> = {};
  const walk = (c: unknown, agg: { sx: number; sy: number; n: number }) => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      agg.sx += c[0] as number;
      agg.sy += c[1] as number;
      agg.n += 1;
    } else if (Array.isArray(c)) {
      for (const x of c) walk(x, agg);
    }
  };
  for (const f of gj.features) {
    const nb = f.properties.neighborhood as string;
    acc[nb] ??= { sx: 0, sy: 0, n: 0, blocks: 0 };
    walk(f.geometry.coordinates, acc[nb]);
    acc[nb].blocks += 1;
  }
  const out: Record<string, { lng: number; lat: number; blocks: number }> = {};
  for (const [nb, v] of Object.entries(acc)) {
    out[nb] = { lng: v.sx / v.n, lat: v.sy / v.n, blocks: v.blocks };
  }
  return out;
}

// Ground elevation (meters) for a point: USGS (1m, US-only) with Open-Meteo fallback.
export async function elevationMeters(lng: number, lat: number): Promise<number | null> {
  try {
    const r = await fetch(
      `https://epqs.nationalmap.gov/v1/json?x=${lng}&y=${lat}&units=Meters&wkid=4326`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (r.ok) {
      const v = Number((await r.json()).value);
      if (Number.isFinite(v) && v > -1000) return Math.round(v * 10) / 10;
    }
  } catch {
    /* fall through */
  }
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const v = Number((await r.json()).elevation?.[0]);
      if (Number.isFinite(v)) return Math.round(v * 10) / 10;
    }
  } catch {
    /* give up */
  }
  return null;
}

let cache: Promise<DeliveryZone[]> | null = null;

export function getZones(): Promise<DeliveryZone[]> {
  cache ??= (async () => {
    const [need, geo] = [await needByNeighborhood(), centroidsByNeighborhood()];
    const zones: DeliveryZone[] = Object.entries(geo)
      .map(([nb, g]) => ({
        id: nb,
        neighborhood: nb,
        label: pretty(nb),
        lng: g.lng,
        lat: g.lat,
        blocks: g.blocks,
        need: need[nb]?.need ?? 0,
        requests: need[nb]?.requests ?? 0,
        observed: need[nb]?.observed ?? 0,
        violations: need[nb]?.violations ?? 0,
        elevation: null as number | null,
      }))
      .sort((a, b) => b.need - a.need);
    await Promise.all(
      zones.map(async (z) => {
        z.elevation = await elevationMeters(z.lng, z.lat);
      }),
    );
    return zones;
  })();
  return cache;
}
