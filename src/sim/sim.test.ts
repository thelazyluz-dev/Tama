// test:sim — headless (no browser). Verifies the accumulated transitions
// (SPEC stages 1-4) on a robust seed, plus determinism:
//  1-2  the tribe discovers fire and survives winters;
//  3    a nomad joins and a partnership forms, easing loneliness;
//  4    children are born with inherited traits across multiple generations,
//       and the watched life passes to an heir when it dies.

import { describe, it, expect } from 'vitest';
import { createWorld, tick } from './world';
import { catchUp } from './catchup';
import { scoreAction } from './utility';
import { ACTIONS } from './actions';
import { applyIntervention, petAgent } from './player';
import { foodCap, teachMultiplier } from './knowledge';
import type { WorldState, Agent } from './types';
import {
  TICKS_PER_DAY,
  POINTS_START,
  COST_SPARK,
  PRIORITY_DEFAULT,
  POTTERY_CAP_MULT,
  SCHOOL_TEACH_MULT,
} from './balance';

interface Run {
  final: WorldState;
  fireDiscovered: boolean;
  nomadArrived: boolean;
  partnersFormed: boolean;
  minLonelinessAfterNomad: number;
  births: number;
  deepestGeneration: number;
  handoffs: number;
  aChild: Agent | undefined;
}

function run(seed: number, days: number): Run {
  let state = createWorld(seed, 'sensible');
  const r: Run = {
    final: state,
    fireDiscovered: false,
    nomadArrived: false,
    partnersFormed: false,
    minLonelinessAfterNomad: 100,
    births: 0,
    deepestGeneration: 0,
    handoffs: 0,
    aChild: undefined,
  };
  let lastPlayer = state.playerAgentId;

  for (let d = 0; d < days; d++) {
    state = tick(state, TICKS_PER_DAY);
    if (state.playerAgentId !== lastPlayer) {
      r.handoffs += 1;
      lastPlayer = state.playerAgentId;
    }
    if (state.knowledge.known.includes('fire')) r.fireDiscovered = true;
    if (state.milestones.nomadArrived) r.nomadArrived = true;
    if (state.milestones.becamePartners) r.partnersFormed = true;
    if (state.agents.length > 1) {
      const founder = state.agents[0]!;
      if (founder.alive) r.minLonelinessAfterNomad = Math.min(r.minLonelinessAfterNomad, founder.needs.loneliness);
    }
  }

  r.final = state;
  r.births = state.journal.filter((e) => e.kind === 'birth').length;
  r.deepestGeneration = Math.max(...state.agents.map((a) => a.generation));
  r.aChild = state.agents.find((a) => a.parents !== undefined);
  return r;
}

describe('stages 1-4 combined (seed 4, ~400 days)', () => {
  const r = run(4, 400);

  it('prints the saga', () => {
    console.log('\n=== SAGA · seed 4 ===');
    console.log(`  known: [${r.final.knowledge.known.join(', ')}]`);
    console.log(`  fire ${r.fireDiscovered} · nomad ${r.nomadArrived} · partners ${r.partnersFormed}`);
    console.log(`  min founder loneliness after nomad: ${r.minLonelinessAfterNomad.toFixed(0)}`);
    console.log(`  births ${r.births} · deepest generation ${r.deepestGeneration} · handoffs ${r.handoffs}`);
    console.log(`  agents total ${r.final.agents.length}, living ${r.final.agents.filter((a) => a.alive).length}`);
    expect(true).toBe(true);
  });

  it('discovers fire (stages 1-2)', () => {
    expect(r.fireDiscovered).toBe(true);
    expect(r.final.milestones.survivedWinters).toBeGreaterThanOrEqual(2);
  });

  it('a nomad joins and a partnership forms, easing loneliness (stage 3)', () => {
    expect(r.nomadArrived).toBe(true);
    expect(r.partnersFormed).toBe(true);
    expect(r.minLonelinessAfterNomad).toBeLessThan(50);
  });

  it('produces children across at least five generations (stage 4)', () => {
    expect(r.births).toBeGreaterThan(4);
    expect(r.final.milestones.firstBirth).toBe(true);
    expect(r.deepestGeneration).toBeGreaterThanOrEqual(5);
  });

  it('passes the watched life to an heir when it dies', () => {
    expect(r.handoffs).toBeGreaterThan(0);
  });

  it('unfolds the later eras — pottery, hunting, farming, a school (stage 7a)', () => {
    expect(r.final.knowledge.known).toContain('pottery');
    expect(r.final.knowledge.known).toContain('agriculture');
    expect(r.final.knowledge.known).toContain('schooling');
    expect(r.final.knowledge.known.length).toBeGreaterThanOrEqual(6);
  });

  it('children inherit traits from their parents (± mutation)', () => {
    const child = r.aChild!;
    expect(child).toBeDefined();
    const [mid, fid] = child.parents!;
    const mother = r.final.agents.find((a) => a.id === mid)!;
    const father = r.final.agents.find((a) => a.id === fid)!;
    for (const key of Object.keys(child.traits) as (keyof typeof child.traits)[]) {
      const lo = Math.min(mother.traits[key], father.traits[key]) - 0.16;
      const hi = Math.max(mother.traits[key], father.traits[key]) + 0.16;
      expect(child.traits[key]).toBeGreaterThanOrEqual(Math.max(0, lo) - 1e-9);
      expect(child.traits[key]).toBeLessThanOrEqual(Math.min(1, hi) + 1e-9);
    }
  });
});

describe('later eras (stage 7a) — mechanics', () => {
  it('pottery enlarges the food larder', () => {
    const w = createWorld(1);
    const before = foodCap(w);
    w.knowledge.known.push('pottery');
    expect(foodCap(w)).toBeCloseTo(before * POTTERY_CAP_MULT, 6);
  });

  it('a school speeds knowledge transfer', () => {
    const w = createWorld(1);
    expect(teachMultiplier(w)).toBe(1);
    w.knowledge.known.push('schooling');
    expect(teachMultiplier(w)).toBe(SCHOOL_TEACH_MULT);
  });

  it('farming feeds the tribe on its own, without foraging (non-winter)', () => {
    // Days 0-3 are spring and the founder is too young to gather, so any food
    // in the farming world comes from agriculture alone.
    const plain = createWorld(11);
    const farm = createWorld(11);
    farm.knowledge.known = ['stone_tools', 'pottery', 'agriculture'];
    const p = tick(plain, TICKS_PER_DAY * 3);
    const f = tick(farm, TICKS_PER_DAY * 3);
    expect(p.foodStock).toBe(0);
    expect(f.foodStock).toBeGreaterThan(0);
  });
});

describe('stage 5 — the player', () => {
  it('a fresh world starts neutral: default priorities and a small purse', () => {
    const w = createWorld(42);
    expect(w.playerPoints).toBe(POINTS_START);
    for (const cat of ['survival', 'social', 'research', 'building'] as const) {
      expect(w.playerPriorities[cat]).toBe(PRIORITY_DEFAULT);
    }
  });

  it('a priority slider scales the appeal of its category (playerMod)', () => {
    const w = createWorld(1);
    const a = w.agents[0]!;
    const base = scoreAction(ACTIONS.wander, a, w); // wander is a survival action
    expect(base).toBeGreaterThan(0);
    w.playerPriorities.survival = 2;
    expect(scoreAction(ACTIONS.wander, a, w)).toBeCloseTo(base * 2, 6);
    w.playerPriorities.survival = 0.5;
    expect(scoreAction(ACTIONS.wander, a, w)).toBeCloseTo(base * 0.5, 6);
  });

  it('banks points for presence and achievements over time', () => {
    const w = tick(createWorld(42), TICKS_PER_DAY * 60);
    expect(w.playerPoints).toBeGreaterThan(POINTS_START);
  });

  it('a spark opens the path to fire, costs points, and is journalled', () => {
    const w = createWorld(3);
    w.playerPoints = 50;
    expect(w.knowledge.triggers.lightning).toBe(false);
    expect(applyIntervention(w, 'spark')).toBe(true);
    expect(w.knowledge.triggers.lightning).toBe(true);
    expect(w.playerPoints).toBe(50 - COST_SPARK);
    expect(w.journal.some((e) => e.kind === 'player')).toBe(true);
  });

  it('rejects an unaffordable or inapplicable intervention', () => {
    const broke = createWorld(4);
    broke.playerPoints = 0;
    expect(applyIntervention(broke, 'inspiration')).toBe(false);

    const rich = createWorld(4);
    rich.playerPoints = 999;
    expect(applyIntervention(rich, 'medicine')).toBe(false); // no one is in crisis
    expect(rich.playerPoints).toBe(999); // nothing spent
  });

  it('petting eases loneliness and boredom but never survival needs', () => {
    const w = createWorld(4);
    const a = w.agents[0]!;
    a.needs.loneliness = 80;
    a.needs.boredom = 70;
    a.needs.hunger = 60;
    const hungerBefore = a.needs.hunger;
    expect(petAgent(w, a.id)).toBe(true);
    expect(a.needs.loneliness).toBeLessThan(80);
    expect(a.needs.boredom).toBeLessThan(70);
    expect(a.needs.hunger).toBe(hungerBefore); // survival is untouched — no cheat
    // a lifted-from-low pet is chronicled
    expect(w.journal.some((e) => e.kind === 'player')).toBe(true);
    // petting a dead / missing agent is a no-op
    a.alive = false;
    expect(petAgent(w, a.id)).toBe(false);
    expect(petAgent(w, 'nobody')).toBe(false);
  });

  it('an intervention leaves the live simulation deterministic', () => {
    // Applying an intervention must not perturb rngState — a summoned newcomer
    // is seeded from the world seed, not the live stream.
    const a = tick(createWorld(9), TICKS_PER_DAY * 30);
    const b = tick(createWorld(9), TICKS_PER_DAY * 30);
    applyIntervention(a, 'spark'); // mutates a only
    expect(a.rngState).toBe(b.rngState);
    expect(tick(a, TICKS_PER_DAY).rngState).toBe(tick(b, TICKS_PER_DAY).rngState);
  });
});

describe('determinism', () => {
  const subset = (s: WorldState) => ({
    tick: s.tick, day: s.day, hour: s.hour, rngState: s.rngState,
    season: s.season, weather: s.weather, foodStock: s.foodStock,
    playerPoints: s.playerPoints, playerPriorities: s.playerPriorities,
    agents: s.agents, playerAgentId: s.playerAgentId, nextAgentId: s.nextAgentId,
    structures: s.structures, resources: s.resources,
    milestones: s.milestones, knowledge: s.knowledge,
  });

  it('same seed + same ticks => identical state (past several births)', () => {
    const a = tick(createWorld(42), TICKS_PER_DAY * 50);
    const b = tick(createWorld(42), TICKS_PER_DAY * 50);
    expect(subset(a)).toStrictEqual(subset(b));
  });

  it('one big batch === many small batches', () => {
    const big = tick(createWorld(2024), TICKS_PER_DAY * 40);
    let small = createWorld(2024);
    for (let i = 0; i < TICKS_PER_DAY * 40; i++) small = tick(small, 1);
    expect(subset(big)).toStrictEqual(subset(small));
  });

  it('does not mutate the input state', () => {
    const s0 = createWorld(7);
    const snapshot = JSON.stringify(subset(s0));
    tick(s0, TICKS_PER_DAY * 30);
    expect(JSON.stringify(subset(s0))).toBe(snapshot);
  });

  it('offline catch-up equals live stepping', () => {
    const caught = catchUp(createWorld(55), 3 * 60 * 60 * 1000);
    const direct = tick(createWorld(55), caught.simulatedTicks);
    expect(subset(caught.state)).toStrictEqual(subset(direct));
  });
});
