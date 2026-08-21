import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { appendObservation, loadObservations, observationsFile } from './observationStore';

const savedEnv = process.env.HOTSPOT_OBSERVATIONS_FILE;
afterEach(() => {
  process.env.HOTSPOT_OBSERVATIONS_FILE = savedEnv;
});

function tempFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'obs-store-')), 'nested', 'obs.jsonl');
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'drone-observation-1',
    lat: 32.7097,
    lng: -117.1545,
    count: 12,
    confidence: 0.9,
    coverage: 1,
    radiusKm: 0.18,
    observedAt: '2026-08-21T12:00:00.000Z',
    affectedBlocks: 3,
    ...overrides,
  };
}

test('appendObservation creates parent dirs and writes one parseable line', () => {
  const file = tempFile();
  process.env.HOTSPOT_OBSERVATIONS_FILE = file;
  appendObservation(record());
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  expect(lines).toHaveLength(1);
  const parsed = JSON.parse(lines[0]);
  expect(parsed.count).toBe(12);
  expect(parsed.lat).toBe(32.7097);
  expect(parsed.observedAt).toBe('2026-08-21T12:00:00.000Z');
});

test('empty env path disables the store', () => {
  process.env.HOTSPOT_OBSERVATIONS_FILE = '';
  expect(observationsFile()).toBeNull();
  appendObservation(record()); // must not throw
  expect(loadObservations()).toEqual([]);
});

test('missing file loads as empty', () => {
  process.env.HOTSPOT_OBSERVATIONS_FILE = tempFile();
  expect(loadObservations()).toEqual([]);
});

test('corrupt, non-object, and out-of-range lines are skipped; valid neighbors survive', () => {
  const file = tempFile();
  process.env.HOTSPOT_OBSERVATIONS_FILE = file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [
    JSON.stringify(record({ observedAt: '2026-08-21T10:00:00.000Z' })),
    'not json at all {{{',
    '"just a string"',
    JSON.stringify(record({ count: 9999 })), // over parseHotspotObservation's 5000 cap
    JSON.stringify(record({ observedAt: '2026-08-21T11:00:00.000Z', count: 7 })),
  ].join('\n') + '\n');
  const loaded = loadObservations();
  expect(loaded).toHaveLength(2);
  expect(loaded.map((o) => o.count)).toEqual([12, 7]);
});

test('sorted ascending by observedAt and capped to the latest N', () => {
  const file = tempFile();
  process.env.HOTSPOT_OBSERVATIONS_FILE = file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const hours = ['05', '03', '01', '04', '02'];
  fs.writeFileSync(
    file,
    hours.map((h) => JSON.stringify(record({ observedAt: `2026-08-21T${h}:00:00.000Z`, count: Number(h) }))).join('\n') + '\n',
  );
  const capped = loadObservations(3);
  expect(capped.map((o) => o.count)).toEqual([3, 4, 5]); // latest three, ascending
});
