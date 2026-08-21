// Server-only. Builds the block-level need choropleth for the Response Map:
// each downtown census-block polygon (marts/blocks.geojson) is tagged with the
// LIVE posterior need of its nearest modeled hotspot block. Because the need is
// read from hotspotState (the Gamma-Poisson surface that assimilates drone
// observations), the choropleth re-colors when a field observation lands.
//
// Block positions are fixed, so the polygon -> nearest-block mapping is cached
// once; only the posterior values are recomputed per request.
import fs from "node:fs";
import path from "node:path";
import type { FeatureCollection, Feature, Polygon } from "geojson";
import { getHotspotBlocks } from "./hotspotState";

interface GeomCache {
  features: Feature[]; // polygon + static props (no need yet)
  nearestIdx: number[]; // index into the hotspot-block array, per feature
}

let geomCache: GeomCache | null = null;

function ringCentroid(ring: number[][]): [number, number] {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const [lng, lat] of ring) {
    x += lng;
    y += lat;
    n += 1;
  }
  return n ? [x / n, y / n] : [0, 0];
}

function buildGeom(): GeomCache {
  const blocksPath = path.join(process.cwd(), "marts", "blocks.geojson");
  const blocks = JSON.parse(fs.readFileSync(blocksPath, "utf8")) as FeatureCollection;
  const hb = getHotspotBlocks(); // positions are fixed; use for the nearest join

  const features: Feature[] = [];
  const nearestIdx: number[] = [];
  for (const f of blocks.features as Feature<Polygon>[]) {
    const ring = (f.geometry.coordinates?.[0] ?? []) as number[][];
    const [clng, clat] = ringCentroid(ring);
    let idx = 0;
    let bestD = Infinity;
    for (let i = 0; i < hb.length; i += 1) {
      const d = (hb[i].lng - clng) ** 2 + (hb[i].lat - clat) ** 2;
      if (d < bestD) {
        bestD = d;
        idx = i;
      }
    }
    features.push({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        geo_block: f.properties?.geo_block,
        neighborhood: f.properties?.neighborhood,
        zip: f.properties?.zip,
        need: 0,
      },
    });
    nearestIdx.push(idx);
  }
  return { features, nearestIdx };
}

export function getBlocksNeed(): FeatureCollection {
  geomCache ??= buildGeom();
  const hb = getHotspotBlocks(); // current posteriors + verification flags
  const features = geomCache.features.map((f, i) => {
    const src = hb[geomCache!.nearestIdx[i]];
    const need = Math.round((src?.need ?? 0) * 100) / 100;
    return { ...f, properties: { ...f.properties, need, verified: !!src?.verified } };
  });
  return { type: "FeatureCollection", features };
}
