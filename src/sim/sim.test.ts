// test:sim — headless (no browser). Verifies the accumulated transitions
// (SPEC stages 1-4) on a robust seed, plus determinism:
//  1-2  the tribe discovers fire and survives winters;
//  3    a nomad joins and a partnership forms, easing loneliness;
//  4    children are born with inherited traits across multiple generations,
//       and the watched life passes to an heir when it dies.

import { describe, it, expect } from 'vitest';
import { createWorld, tick } from './world';
import { catchUp } from './catchup';
import type { WorldState, Agent } from './types';
import { TICKS_PER_DAY } from './balance';

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

describe('stages 1-4 combined (seed 42, ~400 days)', () => {
  const r = run(42, 400);

  it('prints the saga', () => {
    console.log('\n=== SAGA · seed 42 ===');
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

describe('determinism', () => {
  const subset = (s: WorldState) => ({
    tick: s.tick, day: s.day, hour: s.hour, rngState: s.rngState,
    season: s.season, weather: s.weather, foodStock: s.foodStock,
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
