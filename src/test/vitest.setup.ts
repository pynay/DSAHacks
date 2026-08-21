// Global test isolation: hotspotState persists accepted observations to a
// JSONL file; without this override, every `npm test` run would append test
// observations (e.g. hotspotState.test.ts count: 1000) into the real
// data/hotspot_observations.jsonl and the dev server would replay them into
// the demo's need surface at next boot.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.HOTSPOT_OBSERVATIONS_FILE = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'parsel-obs-')),
  'observations.jsonl',
);
