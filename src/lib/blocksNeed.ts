// Server-only. Builds the block-level need choropleth for the Response Map:
// each downtown census-block polygon (marts/blocks.geojson) is tagged with the
// predicted need of its nearest modeled hotspot block (marts/hotspot_blocks.json).
// Cached per server process (the source files only change when the model reruns).
import fs from "node:fs";
import path from "node:path";
import type { FeatureCollection, Feature, Polygon } from "geojson";

interface HotspotBlock {
  lng: number;
  lat: number;
  predicted: number;
}

let cache: FeatureCollection | null = null;

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

export function getBlocksNeed(): FeatureCollection {
  if (cache) return cache;
  const blocksPath = path.join(process.cwd(), "marts", "blocks.geojson");
  const hotspotPath = path.join(process.cwd(), "marts", "hotspot_blocks.json");

  const blocks = JSON.parse(fs.readFileSync(blocksPath, "utf8")) as FeatureCollection;
  const hb = (JSON.parse(fs.readFileSync(hotspotPath, "utf8")).blocks ?? []) as HotspotBlock[];

  const features: Feature[] = (blocks.features as Feature<Polygon>[]).map((f) => {
    const ring = (f.geometry.coordinates?.[0] ?? []) as number[][];
    const [clng, clat] = ringCentroid(ring);
    // Nearest modeled block by squared lng/lat distance (fine at this scale).
    let need = 0;
    let bestD = Infinity;
    for (const p of hb) {
      const d = (p.lng - clng) ** 2 + (p.lat - clat) ** 2;
      if (d < bestD) {
        bestD = d;
        need = p.predicted;
      }
    }
    return {
      type: "Feature",
      geometry: f.geometry,
      properties: {
        geo_block: f.properties?.geo_block,
        neighborhood: f.properties?.neighborhood,
        zip: f.properties?.zip,
        need: Math.round(need * 100) / 100,
      },
    };
  });

  cache = { type: "FeatureCollection", features };
  return cache;
}
