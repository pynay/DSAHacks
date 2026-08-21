// Synthetic UCSD footprint for the drone demo. A drone video recorded at UCSD
// needs somewhere on the map to land its observation, but the model's blocks are
// all downtown. This generates a small grid of UCSD blocks (for the live hotspot
// state + the choropleth) with LOW priors — UCSD starts quiet, so a reviewed
// field count makes the area visibly bloom (unlike the high-prior downtown
// hotspots, where observations mostly correct the estimate down).
import type { Feature } from "geojson";

export const UCSD_NEIGHBORHOOD = "ucsd";
export const UCSD_ZIP = "92093";

// Grid over the UCSD campus core (La Jolla).
const ORIGIN_LAT = 32.872;
const ORIGIN_LNG = -117.245;
const STEP = 0.0025; // ~0.28 km cells
const ROWS = 6;
const COLS = 6;
const CENTER_LAT = 32.8795;
const CENTER_LNG = -117.2375;

export interface UcsdBlock {
  id: string;
  neighborhood: string;
  lng: number;
  lat: number;
  predicted: number;
  alpha: number;
  beta: number;
  last_observed: number;
}

// Gentle radial prior: ~4 at the campus core, ~1 at the edges. Kept low so a
// UCSD block never outranks the six downtown centers.
function cellPrior(clat: number, clng: number): number {
  const d = Math.hypot((clat - CENTER_LAT) / STEP, (clng - CENTER_LNG) / STEP);
  return Math.max(1, Math.round((4 - d * 0.7) * 10) / 10);
}

export function ucsdBlocks(): UcsdBlock[] {
  const out: UcsdBlock[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const lat = ORIGIN_LAT + r * STEP;
      const lng = ORIGIN_LNG + c * STEP;
      const clat = lat + STEP / 2;
      const clng = lng + STEP / 2;
      const predicted = cellPrior(clat, clng);
      out.push({
        id: `UCSD_${r}_${c}`,
        neighborhood: UCSD_NEIGHBORHOOD,
        lng: clng,
        lat: clat,
        predicted,
        alpha: predicted,
        beta: 1,
        last_observed: 0,
      });
    }
  }
  return out;
}

// Matching square polygons (aligned with the block centroids) for the choropleth.
export function ucsdPolygons(): Feature[] {
  const feats: Feature[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const lat = ORIGIN_LAT + r * STEP;
      const lng = ORIGIN_LNG + c * STEP;
      feats.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [lng, lat],
              [lng + STEP, lat],
              [lng + STEP, lat + STEP],
              [lng, lat + STEP],
              [lng, lat],
            ],
          ],
        },
        properties: { geo_block: `UCSD_${r}_${c}`, neighborhood: UCSD_NEIGHBORHOOD, zip: UCSD_ZIP },
      });
    }
  }
  return feats;
}
