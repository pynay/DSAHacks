// Durable store for accepted hotspot observations (the teammates' P0:
// "persist the feedback loop"). Aggregate-only records — count, coordinates,
// confidence — never imagery or person-level data.
//
// JSONL on local disk (via DuckDB-served marts + this append log) so the need
// surface survives server restarts.
import fs from 'node:fs';
import path from 'node:path';
import { parseHotspotObservation } from './hotspotObservation';
import type { HotspotObservationInput } from './hotspotState';

/** Resolve the store path; empty HOTSPOT_OBSERVATIONS_FILE disables the store. */
export function observationsFile(): string | null {
  const env = process.env.HOTSPOT_OBSERVATIONS_FILE;
  if (env !== undefined) return env === '' ? null : env;
  return path.join(process.cwd(), 'data', 'hotspot_observations.jsonl');
}

/** Append one accepted observation. Crash-safe: a disk error must never 500 the observe route. */
export function appendObservation(record: Record<string, unknown>): void {
  const file = observationsFile();
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(record) + '\n');
  } catch (error) {
    console.warn('[observationStore] append failed:', error);
  }
}

/** Load persisted observations: tolerant per-line parse, ascending observedAt, latest `cap`. */
export function loadObservations(cap = 500): HotspotObservationInput[] {
  const file = observationsFile();
  if (!file || !fs.existsSync(file)) return [];
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.warn('[observationStore] read failed:', error);
    return [];
  }
  const parsed: HotspotObservationInput[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      // Reuse the route's own validator so replay accepts exactly what POST accepts.
      parsed.push(parseHotspotObservation(JSON.parse(line)));
    } catch {
      // corrupt or out-of-range line: skip, keep the rest
    }
  }
  parsed.sort((a, b) => Date.parse(a.observedAt ?? '') - Date.parse(b.observedAt ?? ''));
  return parsed.slice(-cap);
}
