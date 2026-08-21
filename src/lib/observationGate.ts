// Episode gate for auto-feeding vision counts into the hotspot model.
//
// Guarantees "the same people are never auto-recounted": at most one
// observation fires per occupancy episode. An episode arms after a stabilized
// count holds unchanged for `armSamples` consecutive polls, fires once, and
// only ends after `clearSamples` consecutive empty polls; a `cooldownMs` floor
// separates fires even across episodes. Pure and clock-free — the caller
// injects `ts` (detection wall-clock ms), so every rule is unit-testable.

export interface GateConfig {
  armSamples: number; // identical nonzero stabilized samples required to fire
  clearSamples: number; // zero samples required to end an occupancy episode
  cooldownMs: number; // minimum wall-clock between fires
}

export const DEFAULT_GATE: GateConfig = { armSamples: 4, clearSamples: 3, cooldownMs: 120_000 };

export interface GateSample { stablePeople: number; ts: number; zoneId: string }

export interface GateState {
  runValue: number | null;
  runLength: number;
  zeroRun: number;
  firedThisEpisode: boolean;
  lastFiredAt: number | null;
  lastSampleTs: number | null;
  zoneId: string | null;
}

export function initialGateState(): GateState {
  return {
    runValue: null,
    runLength: 0,
    zeroRun: 0,
    firedThisEpisode: false,
    lastFiredAt: null,
    lastSampleTs: null,
    zoneId: null,
  };
}

export function nextGate(
  state: GateState,
  sample: GateSample,
  cfg: GateConfig = DEFAULT_GATE,
): { state: GateState; fire: { count: number; ts: number } | null } {
  // Same detection frame delivered twice (poll overlap / React StrictMode): no-op.
  if (state.lastSampleTs !== null && sample.ts === state.lastSampleTs) {
    return { state, fire: null };
  }

  let { runValue, runLength, zeroRun, firedThisEpisode, lastFiredAt } = state;

  // Retargeting resets the arming run but not the episode/cooldown — switching
  // zones must never let the same people be counted twice.
  if (state.zoneId !== null && sample.zoneId !== state.zoneId) {
    runValue = null;
    runLength = 0;
    zeroRun = 0;
  }

  let fire: { count: number; ts: number } | null = null;
  if (sample.stablePeople === 0) {
    zeroRun += 1;
    runValue = null;
    runLength = 0;
    if (zeroRun >= cfg.clearSamples) firedThisEpisode = false; // episode over
  } else {
    zeroRun = 0;
    runLength = sample.stablePeople === runValue ? runLength + 1 : 1;
    runValue = sample.stablePeople;
    const cooledDown = lastFiredAt === null || sample.ts - lastFiredAt >= cfg.cooldownMs;
    if (runLength >= cfg.armSamples && !firedThisEpisode && cooledDown) {
      firedThisEpisode = true;
      lastFiredAt = sample.ts;
      fire = { count: runValue, ts: sample.ts };
    }
  }

  return {
    state: { runValue, runLength, zeroRun, firedThisEpisode, lastFiredAt, lastSampleTs: sample.ts, zoneId: sample.zoneId },
    fire,
  };
}

/** UI copy helper: where the gate is in its lifecycle right now. */
export function gateStatus(
  state: GateState,
  cfg: GateConfig,
  nowMs: number,
): 'watching' | 'arming' | 'holding' | 'cooldown' {
  if (state.firedThisEpisode) return 'holding';
  if (state.lastFiredAt !== null && nowMs - state.lastFiredAt < cfg.cooldownMs) return 'cooldown';
  if (state.runLength > 0) return 'arming';
  return 'watching';
}
