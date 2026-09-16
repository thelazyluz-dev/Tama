// test:sim — runs headless in Node (no browser, no rendering) and verifies the
// stage-1 transition (SPEC): a sensible agent survives its first winter, a
// neglected (reactive) agent dies in it, and the sim stays deterministic.

import { describe, it, expect } from 'vitest';
import { createWorld, tick } from './world';
import { catchUp } from './catchup';
import type { WorldState, AiProfile, ActionId } from './types';
import { TICKS_PER_DAY, SEASON_DAYS, YEAR_DAYS } from './balance';

const WINTER_START = SEASON_DAYS * 3; // day 114
const WINTER_END = SEASON_DAYS * 4; // day 152

interface YearStats {
  final: WorldState;
  aliveAtEnd: boolean;
  diedDay: number | null;
  cause: string | undefined;
  minHealth: number;
  maxStock: number;
  builtShelter: boolean;
  madeFire: boolean;
  actionTicks: Record<ActionId, number>;
}

function runYear(seed: number, profile: AiProfile): YearStats {
  let state = createWorld(seed, profile);
  const stats: YearStats = {
    final: state,
    aliveAtEnd: true,
    diedDay: null,
    cause: undefined,
    minHealth: 100,
    maxStock: 0,
    builtShelter: false,
    madeFire: false,
    actionTicks: {
      eat: 0, drink: 0, sleep: 0, wander: 0, gather: 0,
      wash: 0, warm: 0, buildShelter: 0, makeFire: 0,
    },
  };

  const totalTicks = YEAR_DAYS * TICKS_PER_DAY;
  for (let i = 0; i < totalTicks; i++) {
    const wasAlive = state.agent.alive;
    state = tick(state, 1);
    const a = state.agent;
    if (wasAlive && !a.alive && stats.diedDay === null) {
      stats.diedDay = state.day;
      stats.cause = a.deathCause;
    }
    if (a.alive) {
      stats.minHealth = Math.min(stats.minHealth, a.health);
      stats.maxStock = Math.max(stats.maxStock, a.foodStock);
      if (a.currentAction) stats.actionTicks[a.currentAction.type] += 1;
    }
  }

  stats.final = state;
  stats.aliveAtEnd = state.agent.alive;
  stats.builtShelter = state.milestones.builtShelter;
  stats.madeFire = state.milestones.madeFire;
  return stats;
}

describe('stage 1 — a sensible agent survives the first winter', () => {
  const s = runYear(4242, 'sensible');

  it('prints run stats', () => {
    console.log('\n=== SENSIBLE · seed 4242 · one game year ===');
    console.log(`  alive at end: ${s.aliveAtEnd} (final day ${s.final.day}, season ${s.final.season})`);
    console.log(`  min health: ${s.minHealth.toFixed(1)} · max food stock: ${s.maxStock.toFixed(0)}`);
    console.log(`  built shelter: ${s.builtShelter} · made fire: ${s.madeFire}`);
    console.log(`  final needs:`, JSON.stringify(mapRound(s.final.agent.needs)));
    console.log(`  action ticks:`, JSON.stringify(s.actionTicks));
    console.log(`  journal entries: ${s.final.journal.length}`);
    expect(true).toBe(true);
  });

  it('is still alive after a full year', () => {
    expect(s.aliveAtEnd).toBe(true);
    expect(s.final.day).toBe(YEAR_DAYS);
  });

  it('prepared for winter (built shelter, lit a fire, stocked food)', () => {
    expect(s.builtShelter).toBe(true);
    expect(s.madeFire).toBe(true);
    expect(s.maxStock).toBeGreaterThan(150);
  });

  it('wrote a journal (season lines, day summaries)', () => {
    expect(s.final.journal.length).toBeGreaterThan(20);
    expect(s.final.journal.some((e) => e.kind === 'season')).toBe(true);
  });
});

describe('stage 1 — a neglected agent dies in the first winter', () => {
  const s = runYear(4242, 'reactive');

  it('prints run stats', () => {
    console.log('\n=== REACTIVE (neglected) · seed 4242 ===');
    console.log(`  died day: ${s.diedDay} · cause: ${s.cause}`);
    console.log(`  built shelter: ${s.builtShelter} · made fire: ${s.madeFire} · max stock: ${s.maxStock.toFixed(0)}`);
    expect(true).toBe(true);
  });

  it('is dead by the end of the year', () => {
    expect(s.aliveAtEnd).toBe(false);
    expect(s.diedDay).not.toBeNull();
  });

  it('dies during (or at the onset of) the first winter, not before', () => {
    // Survives spring/summer/autumn; winter is what kills it.
    expect(s.diedDay!).toBeGreaterThanOrEqual(WINTER_START - 4);
    expect(s.diedDay!).toBeLessThan(WINTER_END + 6);
  });

  it('records a death in the journal', () => {
    expect(s.final.journal.some((e) => e.kind === 'death')).toBe(true);
  });
});

describe('determinism', () => {
  const subset = (s: WorldState) => ({
    tick: s.tick, day: s.day, hour: s.hour, rngState: s.rngState,
    season: s.season, weather: s.weather,
    agent: s.agent, structures: s.structures, resources: s.resources,
    milestones: s.milestones,
  });

  it('same seed + same ticks => identical state', () => {
    const a = tick(createWorld(999), TICKS_PER_DAY * 30);
    const b = tick(createWorld(999), TICKS_PER_DAY * 30);
    expect(subset(a)).toStrictEqual(subset(b));
  });

  it('one big batch === many small batches', () => {
    const big = tick(createWorld(2024), TICKS_PER_DAY * 12);
    let small = createWorld(2024);
    for (let i = 0; i < TICKS_PER_DAY * 12; i++) small = tick(small, 1);
    expect(subset(big)).toStrictEqual(subset(small));
  });

  it('does not mutate the input state', () => {
    const s0 = createWorld(7);
    const snapshot = JSON.stringify(subset(s0));
    tick(s0, TICKS_PER_DAY * 3);
    expect(JSON.stringify(subset(s0))).toBe(snapshot);
  });

  it('offline catch-up equals live stepping', () => {
    const threeHoursMs = 3 * 60 * 60 * 1000;
    const caught = catchUp(createWorld(55), threeHoursMs);
    const direct = tick(createWorld(55), caught.simulatedTicks);
    expect(subset(caught.state)).toStrictEqual(subset(direct));
  });
});

function mapRound(needs: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(needs)) out[k] = Math.round(v);
  return out;
}
