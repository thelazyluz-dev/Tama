// test:sim — runs 200 game days headless in Node (no browser, no rendering)
// and verifies the stage-0 transition invariants (kickoff / CLAUDE.md):
//   1. the agent stays alive (state stays valid; there is no death yet),
//   2. no need is pinned at 100 for more than 12 consecutive game hours,
//   3. the same seed produces the same result across two runs.

import { describe, it, expect } from 'vitest';
import { createWorld, tick } from './world';
import { catchUp } from './catchup';
import type { WorldState, NeedKey, ActionId } from './types';
import { TICKS_PER_DAY, TICKS_PER_HOUR, WORLD_HALF } from './balance';

const NEED_KEYS: NeedKey[] = ['hunger', 'thirst', 'fatigue'];
const DAYS = 200;
const TOTAL_TICKS = DAYS * TICKS_PER_DAY;
const MAX_STUCK_TICKS = 12 * TICKS_PER_HOUR; // 12 game hours = 120 ticks

interface RunStats {
  final: WorldState;
  needMin: Record<NeedKey, number>;
  needMax: Record<NeedKey, number>;
  needSum: Record<NeedKey, number>;
  longestAt100: Record<NeedKey, number>;
  currentAt100: Record<NeedKey, number>;
  actionTicks: Record<ActionId, number>;
  moved: number; // total distance travelled
}

/** Step one tick at a time so we can observe per-tick invariants. */
function runObserved(seed: number): RunStats {
  let state = createWorld(seed);
  const stats: RunStats = {
    final: state,
    needMin: { hunger: 100, thirst: 100, fatigue: 100 },
    needMax: { hunger: 0, thirst: 0, fatigue: 0 },
    needSum: { hunger: 0, thirst: 0, fatigue: 0 },
    longestAt100: { hunger: 0, thirst: 0, fatigue: 0 },
    currentAt100: { hunger: 0, thirst: 0, fatigue: 0 },
    actionTicks: { eat: 0, drink: 0, sleep: 0, wander: 0 },
    moved: 0,
  };

  for (let i = 0; i < TOTAL_TICKS; i++) {
    const prev = state.agent.position;
    state = tick(state, 1);
    const a = state.agent;

    const dx = a.position.x - prev.x;
    const dz = a.position.z - prev.z;
    stats.moved += Math.sqrt(dx * dx + dz * dz);

    if (a.currentAction) stats.actionTicks[a.currentAction.type] += 1;

    for (const key of NEED_KEYS) {
      const v = a.needs[key];
      stats.needMin[key] = Math.min(stats.needMin[key], v);
      stats.needMax[key] = Math.max(stats.needMax[key], v);
      stats.needSum[key] += v;
      if (v >= 100 - 1e-9) {
        stats.currentAt100[key] += 1;
        stats.longestAt100[key] = Math.max(stats.longestAt100[key], stats.currentAt100[key]);
      } else {
        stats.currentAt100[key] = 0;
      }
    }
  }

  stats.final = state;
  return stats;
}

describe('stage 0 simulation — 200 game days', () => {
  const seed = 12345;
  const stats = runObserved(seed);

  it('prints run statistics', () => {
    const avg = (k: NeedKey) => (stats.needSum[k] / TOTAL_TICKS).toFixed(1);
    // Visible on `npm run test:sim`; compare before/after when tuning balance.
    console.log('\n=== sim stats: seed', seed, '·', DAYS, 'game days ===');
    console.log(`final: day ${stats.final.day}, hour ${stats.final.hour}, tick ${stats.final.tick}`);
    for (const k of NEED_KEYS) {
      console.log(
        `  ${k.padEnd(8)} min ${stats.needMin[k].toFixed(1).padStart(5)} · ` +
          `avg ${avg(k).padStart(5)} · max ${stats.needMax[k].toFixed(1).padStart(5)} · ` +
          `longest@100 ${stats.longestAt100[k]} ticks`,
      );
    }
    const totalActive = Object.values(stats.actionTicks).reduce((s, n) => s + n, 0);
    console.log('  action ticks:', JSON.stringify(stats.actionTicks), `(active ${totalActive}/${TOTAL_TICKS})`);
    console.log(`  distance travelled: ${stats.moved.toFixed(0)} units`);
    expect(true).toBe(true);
  });

  it('keeps the agent in a valid, living state', () => {
    const a = stats.final.agent;
    for (const key of NEED_KEYS) {
      expect(Number.isFinite(a.needs[key])).toBe(true);
      expect(a.needs[key]).toBeGreaterThanOrEqual(0);
      expect(a.needs[key]).toBeLessThanOrEqual(100);
    }
    expect(Number.isFinite(a.position.x)).toBe(true);
    expect(Number.isFinite(a.position.z)).toBe(true);
    expect(Math.abs(a.position.x)).toBeLessThanOrEqual(WORLD_HALF + 1);
    expect(Math.abs(a.position.z)).toBeLessThanOrEqual(WORLD_HALF + 1);
    // Reached the right day.
    expect(stats.final.day).toBe(DAYS);
  });

  it('actually behaves: moves and satisfies each need at least once', () => {
    expect(stats.moved).toBeGreaterThan(50);
    // The agent must have eaten, drunk and slept over 200 days.
    expect(stats.actionTicks.eat).toBeGreaterThan(0);
    expect(stats.actionTicks.drink).toBeGreaterThan(0);
    expect(stats.actionTicks.sleep).toBeGreaterThan(0);
    expect(stats.actionTicks.wander).toBeGreaterThan(0);
  });

  it('never leaves a need pinned at 100 for more than 12 game hours', () => {
    for (const key of NEED_KEYS) {
      expect(stats.longestAt100[key]).toBeLessThanOrEqual(MAX_STUCK_TICKS);
    }
  });
});

describe('determinism', () => {
  const subset = (s: WorldState) => ({
    tick: s.tick,
    day: s.day,
    hour: s.hour,
    rngState: s.rngState,
    agent: s.agent,
  });

  it('same seed + same ticks => identical state (two runs)', () => {
    const a = tick(createWorld(999), TICKS_PER_DAY * 10);
    const b = tick(createWorld(999), TICKS_PER_DAY * 10);
    expect(subset(a)).toStrictEqual(subset(b));
  });

  it('one big batch === many small batches (RNG threading is stable)', () => {
    const big = tick(createWorld(2024), TICKS_PER_DAY * 5);

    let small = createWorld(2024);
    for (let i = 0; i < TICKS_PER_DAY * 5; i++) small = tick(small, 1);

    expect(subset(big)).toStrictEqual(subset(small));
  });

  it('does not mutate the input state', () => {
    const s0 = createWorld(7);
    const snapshot = JSON.stringify(subset(s0));
    tick(s0, TICKS_PER_DAY);
    expect(JSON.stringify(subset(s0))).toBe(snapshot);
  });

  it('offline catch-up equals live stepping for the same tick count', () => {
    // 3 real hours of absence -> some game days; must match a direct tick().
    const threeHoursMs = 3 * 60 * 60 * 1000;
    const start = createWorld(55);
    const caught = catchUp(start, threeHoursMs);
    const direct = tick(createWorld(55), caught.simulatedTicks);
    expect(subset(caught.state)).toStrictEqual(subset(direct));
    expect(caught.capped).toBe(false); // 3h is well under the 14-day ceiling
  });

  it('caps catch-up at the 14-game-day ceiling', () => {
    const hugeMs = 1000 * 24 * 60 * 60 * 1000; // 1000 real days
    const res = catchUp(createWorld(1), hugeMs);
    expect(res.capped).toBe(true);
    expect(res.simulatedTicks).toBe(14 * TICKS_PER_DAY);
    expect(res.elapsedTicks).toBeGreaterThan(res.simulatedTicks);
  });
});
