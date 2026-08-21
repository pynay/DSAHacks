// Server-only live hotspot state. The offline Python model seeds a Gamma prior
// for every downtown block; aggregate drone counts update that prior and the
// six delivery centers are recomputed from the posterior intensity surface.
import fs from "node:fs";
import path from "node:path";
import type { DeliveryZone, HotspotMeta } from "./delivery";
import { appendObservation, loadObservations } from "./observationStore";
import { ucsdBlocks, UCSD_NEIGHBORHOOD } from "./ucsdDemo";

interface HotspotBlock {
  id: string;
  neighborhood: string;
  lng: number;
  lat: number;
  predicted: number;
  alpha: number;
  beta: number;
  last_observed: number;
  feedbackObservationIds?: string[];
  lastObservedAt?: string;
}

interface SeedFile {
  meta: HotspotMeta;
  blocks: HotspotBlock[];
}

export interface HotspotObservationInput {
  lat: number;
  lng: number;
  count: number;
  confidence?: number;
  coverage?: number;
  radiusKm?: number;
  observedAt?: string;
}

export interface AcceptedHotspotObservation {
  id: string;
  lat: number;
  lng: number;
  count: number;
  confidence: number;
  coverage: number;
  radiusKm: number;
  observedAt: string;
  affectedBlocks: number;
}

interface State {
  meta: HotspotMeta;
  blocks: HotspotBlock[];
  observations: AcceptedHotspotObservation[];
}

const BLOCKS_FILE = path.join(process.cwd(), "marts", "hotspot_blocks.json");
const HOTSPOT_COUNT = 6;
const MIN_CENTER_DISTANCE_KM = 0.24;
let state: State | null = null;

function haversineKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const earthKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(s));
}

function currentState(): State {
  if (state) return state;
  const seed = JSON.parse(fs.readFileSync(BLOCKS_FILE, "utf8")) as SeedFile;
  state = {
    meta: { ...seed.meta },
    // Downtown model blocks + the synthetic UCSD demo grid. UCSD blocks join the
    // same Gamma-Poisson surface so a drone observation there updates them, but
    // they are excluded from the six downtown zones below.
    blocks: [...seed.blocks.map((block) => ({ ...block })), ...ucsdBlocks()],
    observations: [],
  };
  // Rehydrate the feedback loop: replay persisted observations through the
  // same Gamma-Poisson path so the need surface survives restarts/HMR.
  // Replay never appends (only observeHotspot does), so it is idempotent.
  try {
    for (const input of loadObservations()) applyObservation(state, input);
  } catch (error) {
    console.warn("[hotspotState] observation replay failed:", error);
  }
  return state;
}

function posterior(block: HotspotBlock): number {
  return Math.max(0, block.alpha / Math.max(block.beta, 1e-6));
}

function centerIndices(blocks: HotspotBlock[]): number[] {
  const ranked = blocks
    .map((block, index) => ({ index, value: posterior(block) }))
    .sort((a, b) => b.value - a.value);
  const centers: number[] = [];
  for (const candidate of ranked) {
    if (
      centers.every(
        (center) => haversineKm(blocks[candidate.index], blocks[center]) >= MIN_CENTER_DISTANCE_KM,
      )
    ) {
      centers.push(candidate.index);
    }
    if (centers.length === HOTSPOT_COUNT) break;
  }
  return centers;
}

// Live per-block posterior intensities (position is fixed; only the posterior
// moves as drone observations assimilate). The Response Map's block choropleth
// reads this so field observations actually re-color the map.
export function getHotspotBlocks(): {
  lng: number;
  lat: number;
  neighborhood: string;
  need: number;
  verified: boolean;
}[] {
  const live = currentState();
  return live.blocks.map((block) => ({
    lng: block.lng,
    lat: block.lat,
    neighborhood: block.neighborhood,
    need: posterior(block),
    verified: (block.feedbackObservationIds?.length ?? 0) > 0,
  }));
}

// The appended UCSD zone — a drone target for the demo, computed live from the
// UCSD block posteriors so a field observation there updates its need/confidence.
export function getUcsdZone(): DeliveryZone {
  const live = currentState();
  const ucsd = live.blocks.filter((block) => block.neighborhood === UCSD_NEIGHBORHOOD);
  const weights = ucsd.map((block) => Math.max(posterior(block), 0.001));
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const lng = ucsd.reduce((sum, block, i) => sum + block.lng * weights[i], 0) / total;
  const lat = ucsd.reduce((sum, block, i) => sum + block.lat * weights[i], 0) / total;
  const obsIds = new Set(ucsd.flatMap((block) => block.feedbackObservationIds ?? []));
  const lastObservedAt = ucsd
    .map((block) => block.lastObservedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return {
    id: "ucsd-campus",
    neighborhood: UCSD_NEIGHBORHOOD,
    label: "UCSD campus",
    lng,
    lat,
    blocks: ucsd.length,
    need: Math.round(total),
    requests: 0,
    observed: 0,
    violations: 0,
    tents: 0,
    vehicles: 0,
    predicted: true,
    confidence: obsIds.size ? "drone-updated" : "historical-prior",
    feedbackObservations: obsIds.size,
    lastObservedAt,
  };
}

export function getHotspotMeta(): HotspotMeta {
  const live = currentState();
  return {
    ...live.meta,
    observations: live.observations.length,
    latest_observation: live.observations.at(-1)?.observedAt ?? null,
  };
}

export function getHotspotZones(): DeliveryZone[] {
  const live = currentState();
  const centers = centerIndices(live.blocks);
  const groups = centers.map(() => [] as number[]);

  live.blocks.forEach((block, index) => {
    if (block.neighborhood === UCSD_NEIGHBORHOOD) return; // UCSD is its own appended zone
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    centers.forEach((center, centerIndex) => {
      const distance = haversineKm(block, live.blocks[center]);
      if (distance < nearestDistance) {
        nearest = centerIndex;
        nearestDistance = distance;
      }
    });
    groups[nearest].push(index);
  });

  const latest = live.observations.at(-1)?.observedAt;
  return groups
    .map((members, rank) => {
      const weights = members.map((index) => Math.max(posterior(live.blocks[index]), 0.001));
      const totalWeight = weights.reduce((sum, value) => sum + value, 0);
      const lng = members.reduce((sum, index, i) => sum + live.blocks[index].lng * weights[i], 0) / totalWeight;
      const lat = members.reduce((sum, index, i) => sum + live.blocks[index].lat * weights[i], 0) / totalWeight;
      const hoodWeight = new Map<string, number>();
      members.forEach((index, i) => {
        const hood = live.blocks[index].neighborhood;
        hoodWeight.set(hood, (hoodWeight.get(hood) ?? 0) + weights[i]);
      });
      const neighborhood = [...hoodWeight.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const feedbackObservationIds = new Set(
        members.flatMap((index) => live.blocks[index].feedbackObservationIds ?? []),
      );
      const feedbackObservations = feedbackObservationIds.size;
      const lastObservedAt = members
        .map((index) => live.blocks[index].lastObservedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);
      const label = `${neighborhood
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")} hotspot ${rank + 1}`;
      return {
        id: `predicted-hotspot-${rank + 1}`,
        neighborhood,
        label,
        lng,
        lat,
        blocks: members.length,
        need: Math.round(totalWeight),
        requests: 0,
        observed: 0,
        violations: 0,
        tents: 0,
        vehicles: 0,
        predicted: true,
        confidence: feedbackObservations ? "drone-updated" : "historical-prior",
        model: live.meta.model,
        sourceDate: live.meta.source_date,
        targetMonth: live.meta.target_month,
        lastObservedAt: lastObservedAt ?? (feedbackObservations ? latest : undefined),
        feedbackObservations,
        elevation: null,
      } satisfies DeliveryZone;
    })
    .sort((a, b) => b.need - a.need);
}

export function observeHotspot(input: HotspotObservationInput): AcceptedHotspotObservation {
  const observation = applyObservation(currentState(), input);
  appendObservation({ ...observation, source: "live" });
  return observation;
}

function applyObservation(live: State, input: HotspotObservationInput): AcceptedHotspotObservation {
  const confidence = input.confidence ?? 0.8;
  const coverage = input.coverage ?? 1;
  const radiusKm = input.radiusKm ?? 0.18;
  const observedAt = input.observedAt ?? new Date().toISOString();
  const observationId = `drone-observation-${live.observations.length + 1}`;
  const distances = live.blocks.map((block) => haversineKm(input, block));
  let affected = distances
    .map((distance, index) => ({ distance, index }))
    .filter(({ distance }) => distance <= radiusKm);
  if (!affected.length) {
    const index = distances.indexOf(Math.min(...distances));
    affected = [{ distance: distances[index], index }];
  }

  const sigma = Math.max(radiusKm / 2, 0.03);
  const rawWeights = affected.map(({ distance }) => Math.exp(-(distance ** 2) / (2 * sigma ** 2)));
  const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0);
  const estimatedTotal = input.count / coverage;
  affected.forEach(({ index }, i) => {
    const block = live.blocks[index];
    const share = rawWeights[i] / weightTotal;
    // Gamma-Poisson update. Confidence controls evidence strength; coverage
    // expands a partial-footprint count before allocating it across blocks.
    block.alpha += estimatedTotal * share * confidence;
    block.beta += confidence;
    block.feedbackObservationIds = [
      ...new Set([...(block.feedbackObservationIds ?? []), observationId]),
    ];
    block.lastObservedAt = observedAt;
  });

  const observation: AcceptedHotspotObservation = {
    id: observationId,
    lat: input.lat,
    lng: input.lng,
    count: input.count,
    confidence,
    coverage,
    radiusKm,
    observedAt,
    affectedBlocks: affected.length,
  };
  live.observations.push(observation);
  return observation;
}

// Test/demo reset. Production persistence belongs in the mission database; the
// current API intentionally keeps no imagery or person-level records.
export function resetHotspotState(): void {
  state = null;
}
