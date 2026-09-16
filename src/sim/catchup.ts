// Offline progress: there is no background simulation. On return we compute
// how much real time elapsed, convert to ticks, and fast-forward the same
// deterministic tick() with no rendering (SPEC "התקדמות במצב offline").
//
// Pure: real clock reads and localStorage live in src/store. This module only
// turns "elapsed milliseconds" into a fast-forwarded WorldState.

import type { WorldState } from './types';
import { tick } from './world';
import { REAL_MS_PER_TICK, MAX_CATCHUP_TICKS, TICKS_PER_DAY, TICKS_PER_HOUR } from './balance';

export interface CatchUpResult {
  state: WorldState;
  /** True elapsed game ticks (uncapped). */
  elapsedTicks: number;
  /** Ticks actually simulated (clamped to the 14-day catch-up ceiling). */
  simulatedTicks: number;
  /** Whether the absence exceeded the catch-up ceiling. */
  capped: boolean;
}

/** Real elapsed milliseconds -> game ticks. */
export function ticksFromElapsedMs(ms: number): number {
  if (ms <= 0) return 0;
  return Math.floor(ms / REAL_MS_PER_TICK);
}

/** Fast-forward the world to account for `elapsedMs` of real absence. */
export function catchUp(state: WorldState, elapsedMs: number): CatchUpResult {
  const elapsedTicks = ticksFromElapsedMs(elapsedMs);
  const simulatedTicks = Math.min(elapsedTicks, MAX_CATCHUP_TICKS);
  return {
    state: tick(state, simulatedTicks),
    elapsedTicks,
    simulatedTicks,
    capped: elapsedTicks > MAX_CATCHUP_TICKS,
  };
}

/** Split a tick count into whole game days and hours (for the return screen). */
export function ticksToDaysHours(ticks: number): { days: number; hours: number } {
  const days = Math.floor(ticks / TICKS_PER_DAY);
  const hours = Math.floor((ticks % TICKS_PER_DAY) / TICKS_PER_HOUR);
  return { days, hours };
}
