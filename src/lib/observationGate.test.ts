import { expect, test } from 'vitest';
import { DEFAULT_GATE, gateStatus, initialGateState, nextGate, type GateState } from './observationGate';

const CFG = { armSamples: 4, clearSamples: 3, cooldownMs: 120_000 };

function feed(state: GateState, samples: Array<[number, number, string?]>) {
  const fires: Array<{ count: number; ts: number }> = [];
  for (const [stablePeople, ts, zoneId] of samples) {
    const out = nextGate(state, { stablePeople, ts, zoneId: zoneId ?? 'zone-a' }, CFG);
    state = out.state;
    if (out.fire) fires.push(out.fire);
  }
  return { state, fires };
}

test('fires exactly once after armSamples identical nonzero samples', () => {
  const { fires } = feed(initialGateState(), [[2, 1000], [2, 1400], [2, 1800], [2, 2200]]);
  expect(fires).toEqual([{ count: 2, ts: 2200 }]);
});

test('armSamples-1 samples never fire', () => {
  const { fires } = feed(initialGateState(), [[2, 1000], [2, 1400], [2, 1800]]);
  expect(fires).toEqual([]);
});

test('duplicate ts does not advance arming or double-fire', () => {
  const { fires } = feed(initialGateState(), [[2, 1000], [2, 1000], [2, 1000], [2, 1000], [2, 1000]]);
  expect(fires).toEqual([]);
});

test('flapping counts never fire; a settled run then fires', () => {
  const flap: Array<[number, number]> = [[2, 1], [3, 2], [2, 3], [3, 4], [2, 5], [3, 6]];
  const first = feed(initialGateState(), flap);
  expect(first.fires).toEqual([]);
  const settled = feed(first.state, [[3, 7], [3, 8], [3, 9], [3, 10]]);
  expect(settled.fires).toEqual([{ count: 3, ts: 9 }]); // run began at the last flap sample (ts 6)
});

test('never refires within an occupancy episode, even at a higher count', () => {
  const armed = feed(initialGateState(), [[2, 1], [2, 2], [2, 3], [2, 4]]);
  expect(armed.fires).toHaveLength(1);
  const more: Array<[number, number]> = [];
  for (let i = 0; i < 50; i++) more.push([4, 10 + i]);
  expect(feed(armed.state, more).fires).toEqual([]);
});

test('episode reset requires clearSamples zeros AND cooldown before refiring', () => {
  const fired = feed(initialGateState(), [[2, 1000], [2, 1400], [2, 1800], [2, 2200]]);
  // zone clears, new occupancy well within cooldown -> no fire
  const cleared = feed(fired.state, [[0, 2600], [0, 3000], [0, 3400], [2, 3800], [2, 4200], [2, 4600], [2, 5000]]);
  expect(cleared.fires).toEqual([]);
  // same pattern with ts past the cooldown -> fires
  const later = feed(cleared.state, [[0, 130_000], [0, 130_400], [0, 130_800],
    [2, 131_000], [2, 131_400], [2, 131_800], [2, 132_200]]);
  expect(later.fires).toEqual([{ count: 2, ts: 132_200 }]);
});

test('zeros alone never fire', () => {
  const samples: Array<[number, number]> = [];
  for (let i = 0; i < 30; i++) samples.push([0, i * 400]);
  expect(feed(initialGateState(), samples).fires).toEqual([]);
});

test('zone switch mid-episode does not fire in the new zone until reset', () => {
  const fired = feed(initialGateState(), [[2, 1], [2, 2], [2, 3], [2, 4]]);
  const switched = feed(fired.state, [[2, 5, 'zone-b'], [2, 6, 'zone-b'], [2, 7, 'zone-b'], [2, 8, 'zone-b'], [2, 9, 'zone-b']]);
  expect(switched.fires).toEqual([]);
});

test('zone switch during arming resets the run counter', () => {
  const arming = feed(initialGateState(), [[2, 1], [2, 2], [2, 3]]);
  const switched = feed(arming.state, [[2, 4, 'zone-b']]);
  expect(switched.fires).toEqual([]);
  // needs a full fresh run in zone-b
  const done = feed(switched.state, [[2, 5, 'zone-b'], [2, 6, 'zone-b'], [2, 7, 'zone-b']]);
  expect(done.fires).toEqual([{ count: 2, ts: 7 }]);
});

test('gateStatus reflects the lifecycle', () => {
  let state = initialGateState();
  expect(gateStatus(state, CFG, 0)).toBe('watching');
  state = feed(state, [[2, 1000]]).state;
  expect(gateStatus(state, CFG, 1000)).toBe('arming');
  state = feed(state, [[2, 1400], [2, 1800], [2, 2200]]).state;
  expect(gateStatus(state, CFG, 2200)).toBe('holding');
  state = feed(state, [[0, 2600], [0, 3000], [0, 3400]]).state;
  expect(gateStatus(state, CFG, 3400)).toBe('cooldown');
  expect(gateStatus(state, CFG, 200_000)).toBe('watching');
});
