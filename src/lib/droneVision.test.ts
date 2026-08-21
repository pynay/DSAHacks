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
  face_mode: 'eyepop-face',
  blurred: 1,
  stats: { peak_people: 3, holds: 2, samples: 76, series: [[1787309009.6, 1], [1787309014.7, 2]] },
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
  expect(det.faceMode).toBe('eyepop-face');
  expect(det.blurred).toBe(1);
  expect(det.stats?.peakPeople).toBe(3);
  expect(det.stats?.holds).toBe(2);
  expect(det.stats?.series).toHaveLength(2);
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
  expect(det.faceMode).toBe('off');
  expect(det.blurred).toBe(0);
  expect(det.stats).toBeNull();
  expect(det.count).toBe(0);
  expect(det.label).toBe('clear');
  expect(det.objects).toEqual([]);
  expect(det.videoFps).toBe(0);
});

test('stablePeople diverges from raw count when the bridge sends it', () => {
  const det = parseDetection({ ...fullPayload, count: 3, stable_people: 2 });
  expect(det.stablePeople).toBe(2);
  expect(det.count).toBe(3);
});

test('older bridge without stable_people falls back to the raw count', () => {
  const older: Record<string, unknown> = { ...fullPayload };
  delete older.stable_people;
  expect(parseDetection(older).stablePeople).toBe(fullPayload.count);
});

test('empty payload has stablePeople 0', () => {
  expect(parseDetection({}).stablePeople).toBe(0);
});
