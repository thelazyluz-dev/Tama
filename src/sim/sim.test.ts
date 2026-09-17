// test:sim — runs headless in Node (no browser, no rendering) and verifies the
// stage-2 transition (SPEC): the agent discovers fire on its own (after a
// lightning trigger) and that discovery is what carries a sensible agent
// through its first winter; a non-experimenting agent never gets fire and
// freezes. Plus the sim stays deterministic.

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
  fireDay: number | null; // day fire was discovered
  minHealth: number;
  maxStock: number;
  actionTicks: Record<ActionId, number>;
}

function runYear(seed: number, profile: AiProfile): YearStats {
  let state = createWorld(seed, profile);
  const stats: YearStats = {
    final: state,
    aliveAtEnd: true,
    diedDay: null,
    cause: undefined,
    fireDay: null,
    minHealth: 100,
    maxStock: 0,
    actionTicks: {
      eat: 0, drink: 0, sleep: 0, wander: 0, gather: 0, wash: 0,
      warm: 0, buildShelter: 0, makeFire: 0, experiment: 0,
    },
  };

  const totalTicks = YEAR_DAYS * TICKS_PER_DAY;
  for (let i = 0; i < totalTicks; i++) {
    const wasAlive = state.agent.alive;
    const hadFire = state.knowledge.known.includes('fire');
    state = tick(state, 1);
    const a = state.agent;
    if (wasAlive && !a.alive && stats.diedDay === null) {
      stats.diedDay = state.day;
      stats.cause = a.deathCause;
    }
    if (!hadFire && state.knowledge.known.includes('fire') && stats.fireDay === null) {
      stats.fireDay = state.day;
    }
    if (a.alive) {
      stats.minHealth = Math.min(stats.minHealth, a.health);
      stats.maxStock = Math.max(stats.maxStock, a.foodStock);
      if (a.currentAction) stats.actionTicks[a.currentAction.type] += 1;
    }
  }
  stats.final = state;
  stats.aliveAtEnd = state.agent.alive;
  return stats;
}

describe('stage 2 — a curious agent discovers fire and survives winter', () => {
  const s = runYear(4242, 'sensible');

  it('prints run stats', () => {
    console.log('\n=== SENSIBLE · seed 4242 · one game year ===');
    console.log(`  alive at end: ${s.aliveAtEnd} (final day ${s.final.day})`);
    console.log(`  known techs: ${JSON.stringify(s.final.knowledge.known)}`);
    console.log(`  fire discovered on day: ${s.fireDay} · lightning: ${s.final.knowledge.triggers.lightning}`);
    console.log(`  min health: ${s.minHealth.toFixed(1)} · max food stock: ${s.maxStock.toFixed(0)}`);
    console.log(`  skills: ${JSON.stringify(round(s.final.agent.skills))} · curiosity ${s.final.agent.traits.curiosity.toFixed(2)}`);
    console.log(`  action ticks: ${JSON.stringify(s.actionTicks)}`);
    console.log(`  journal entries: ${s.final.journal.length}`);
    expect(true).toBe(true);
  });

  it('discovers fire on its own, before winter, without any intervention', () => {
    expect(s.final.knowledge.triggers.lightning).toBe(true);
    expect(s.fireDay).not.toBeNull();
    expect(s.fireDay!).toBeLessThan(WINTER_START);
  });

  it('also discovers stone tools and cooking', () => {
    expect(s.final.knowledge.known).toContain('stone_tools');
    expect(s.final.knowledge.known).toContain('cooking');
  });

  it('survives the full year on the strength of that fire', () => {
    expect(s.aliveAtEnd).toBe(true);
    expect(s.final.day).toBe(YEAR_DAYS);
    expect(s.actionTicks.makeFire).toBeGreaterThan(0);
  });

  it('the journal tells the discovery story', () => {
    expect(s.final.journal.some((e) => e.kind === 'discovery')).toBe(true);
  });
});

describe('stage 2 — an agent that never experiments never gets fire, and dies', () => {
  const s = runYear(4242, 'reactive');

  it('prints run stats', () => {
    console.log('\n=== REACTIVE (no experimenting) · seed 4242 ===');
    console.log(`  died day: ${s.diedDay} · cause: ${s.cause}`);
    console.log(`  known techs: ${JSON.stringify(s.final.knowledge.known)}`);
    expect(true).toBe(true);
  });

  it('never discovers fire', () => {
    expect(s.final.knowledge.known).not.toContain('fire');
    expect(s.actionTicks.experiment).toBe(0);
  });

  it('freezes to death in the first winter', () => {
    expect(s.aliveAtEnd).toBe(false);
    expect(s.diedDay!).toBeGreaterThanOrEqual(WINTER_START - 4);
    expect(s.diedDay!).toBeLessThan(WINTER_END + 6);
    expect(s.cause).toBe('קפיאה');
  });
});

describe('determinism', () => {
  const subset = (s: WorldState) => ({
    tick: s.tick, day: s.day, hour: s.hour, rngState: s.rngState,
    season: s.season, weather: s.weather,
    agent: s.agent, structures: s.structures, resources: s.resources,
    milestones: s.milestones, knowledge: s.knowledge,
  });

  it('same seed + same ticks => identical state', () => {
    const a = tick(createWorld(999), TICKS_PER_DAY * 40);
    const b = tick(createWorld(999), TICKS_PER_DAY * 40);
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

function round(obj: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = Math.round(v);
  return out;
}
