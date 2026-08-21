import { expect, test } from 'vitest';
import { parseDetection } from './droneVision';

const fullPayload = {
  ts: 1787300000000,
  count: 1,
  label: 'obstructed',
  confidence: 0.8,
  persons: [],
  objects: [{ label: 'laptop', confidence: 0.8, x: 100, y: 900, width: 1700, height: 1000, in_zone: true }],
  video_fps: 30.6,
  infer_fps: 6.4,
  boot_id: '13651-1787308200000',
  brightness: 132.1,
  verdict: {
    state: 'HOLD',
    reason: 'laptop in zone (80%)',
    score: 68,
    inZone: 1,
    nearby: 0,
    zone: [0.25, 0.25, 0.75, 0.75],
  },
};

test('parses a full bridge payload including the verdict', () => {
  const det = parseDetection(fullPayload);
  expect(det.verdict?.state).toBe('HOLD');
  expect(det.verdict?.reason).toBe('laptop in zone (80%)');
  expect(det.verdict?.score).toBe(68);
  expect(det.verdict?.inZone).toBe(1);
  expect(det.brightness).toBe(132.1);
  expect(det.objects[0].label).toBe('laptop');
  expect(det.videoFps).toBe(30.6);
  expect(det.bootId).toBe('13651-1787308200000');
});

test('older bridge without verdict still parses, verdict is null', () => {
  const older: Record<string, unknown> = { ...fullPayload };
  delete older.verdict;
  delete older.brightness;
  const det = parseDetection(older);
  expect(det.verdict).toBeNull();
  expect(det.brightness).toBe(0);
  expect(det.count).toBe(1);
  expect(det.label).toBe('obstructed');
});

test('empty payload parses to safe defaults', () => {
  const det = parseDetection({});
  expect(det.verdict).toBeNull();
  expect(det.bootId).toBe('');
  expect(det.count).toBe(0);
  expect(det.label).toBe('clear');
  expect(det.objects).toEqual([]);
  expect(det.videoFps).toBe(0);
});
