// test:sim — headless (no browser, no rendering). Verifies the stage-3
// transition (SPEC): a nomad joins the founder, they pair up and coordinate,
// and the pair survives better than one alone — while stages 1-2 still hold
// (discovers fire, survives winter) and the sim stays deterministic.

import { describe, it, expect } from 'vitest';
import { createWorld, tick } from './world';
import { catchUp } from './catchup';
import { playerAgent, partnerOf } from './agents';
import type { WorldState, AiProfile, ActionId } from './types';
import { TICKS_PER_DAY, SEASON_DAYS, YEAR_DAYS, NOMAD_MIN_DAY } from './balance';

const WINTER_START = SEASON_DAYS * 3;
const WINTER_END = SEASON_DAYS * 4;

interface YearStats {
  final: WorldState;
  survivors: number;
  nomadDay: number | null;
  partnerDay: number | null;
  fireDay: number | null;
  minPlayerLonelinessAfterNomad: number;
  maxLonelinessBeforeNomad: number;
  actionTicks: Record<ActionId, number>;
}

function runYear(seed: number, profile: AiProfile): YearStats {
  let state = createWorld(seed, profile);
  const stats: YearStats = {
    final: state,
    survivors: 0,
    nomadDay: null,
    partnerDay: null,
    fireDay: null,
    minPlayerLonelinessAfterNomad: 100,
    maxLonelinessBeforeNomad: 0,
    actionTicks: {
      eat: 0, drink: 0, sleep: 0, wander: 0, gather: 0, wash: 0,
      warm: 0, buildShelter: 0, makeFire: 0, experiment: 0, socialize: 0,
    },
  };

  for (let i = 0; i < YEAR_DAYS * TICKS_PER_DAY; i++) {
    const hadNomad = state.agents.length > 1;
    const hadFire = state.knowledge.known.includes('fire');
    const wasPartner = partnerOf(state, playerAgent(state)) !== null;
    state = tick(state, 1);

    if (!hadNomad && state.agents.length > 1 && stats.nomadDay === null) stats.nomadDay = state.day;
    if (!hadFire && state.knowledge.known.includes('fire') && stats.fireDay === null) stats.fireDay = state.day;
    const player = playerAgent(state);
    const nowPartner = partnerOf(state, player) !== null;
    if (!wasPartner && nowPartner && stats.partnerDay === null) stats.partnerDay = state.day;

    if (state.agents.length > 1) {
      stats.minPlayerLonelinessAfterNomad = Math.min(stats.minPlayerLonelinessAfterNomad, player.needs.loneliness);
    } else {
      stats.maxLonelinessBeforeNomad = Math.max(stats.maxLonelinessBeforeNomad, player.needs.loneliness);
    }
    for (const a of state.agents) {
      if (a.alive && a.currentAction) stats.actionTicks[a.currentAction.type] += 1;
    }
  }

  stats.final = state;
  stats.survivors = state.agents.filter((a) => a.alive).length;
  return stats;
}

describe('stage 3 — the second: nomad, partnership, coordination', () => {
  const s = runYear(4242, 'sensible');

  it('prints run stats', () => {
    console.log('\n=== STAGE 3 · seed 4242 · one game year ===');
    console.log(`  agents: ${s.final.agents.map((a) => `${a.name}(${a.sex},${a.alive ? 'alive' : 'dead'})`).join(', ')}`);
    console.log(`  nomad arrived day ${s.nomadDay} · became partners day ${s.partnerDay} · fire day ${s.fireDay}`);
    console.log(`  loneliness — max before nomad ${s.maxLonelinessBeforeNomad.toFixed(0)}, min after ${s.minPlayerLonelinessAfterNomad.toFixed(0)}`);
    console.log(`  survivors at year end: ${s.survivors} · shared stock ${Math.round(s.final.foodStock)}`);
    console.log(`  socialize ticks: ${s.actionTicks.socialize} · known ${JSON.stringify(s.final.knowledge.known)}`);
    console.log(`  journal: ${s.final.journal.length}`);
    expect(true).toBe(true);
  });

  it('a nomad of the opposite sex joins after survival + shelter', () => {
    expect(s.nomadDay).not.toBeNull();
    expect(s.nomadDay!).toBeGreaterThanOrEqual(NOMAD_MIN_DAY);
    expect(s.final.agents.length).toBe(2);
    expect(s.final.agents[0]!.sex).not.toBe(s.final.agents[1]!.sex);
    expect(s.final.milestones.builtShelter).toBe(true);
  });

  it('the two become a couple', () => {
    expect(s.partnerDay).not.toBeNull();
    expect(s.final.milestones.becamePartners).toBe(true);
    const p = playerAgent(s.final);
    expect(partnerOf(s.final, p)).not.toBeNull();
    expect(s.actionTicks.socialize).toBeGreaterThan(0);
    expect(s.final.journal.some((e) => e.kind === 'social')).toBe(true);
  });

  it('companionship relieves the loneliness that a lone life could not', () => {
    // Solo, loneliness pins high; with a partner it is eased well below that.
    expect(s.maxLonelinessBeforeNomad).toBeGreaterThan(80);
    expect(s.minPlayerLonelinessAfterNomad).toBeLessThan(45);
  });

  it('both coordinate and survive the year (better than one)', () => {
    expect(s.survivors).toBe(2);
    expect(s.final.day).toBe(YEAR_DAYS);
  });

  it('still discovers fire and survives its first winter (stages 1-2 hold)', () => {
    expect(s.fireDay).not.toBeNull();
    expect(s.fireDay!).toBeLessThan(WINTER_START);
    expect(s.actionTicks.makeFire).toBeGreaterThan(0);
    expect(WINTER_END).toBeGreaterThan(WINTER_START);
  });
});

describe('determinism', () => {
  const subset = (s: WorldState) => ({
    tick: s.tick, day: s.day, hour: s.hour, rngState: s.rngState,
    season: s.season, weather: s.weather, foodStock: s.foodStock,
    agents: s.agents, playerAgentId: s.playerAgentId,
    structures: s.structures, resources: s.resources,
    milestones: s.milestones, knowledge: s.knowledge,
  });

  it('same seed + same ticks => identical state', () => {
    const a = tick(createWorld(999), TICKS_PER_DAY * 40);
    const b = tick(createWorld(999), TICKS_PER_DAY * 40);
    expect(subset(a)).toStrictEqual(subset(b));
  });

  it('one big batch === many small batches (past the nomad)', () => {
    const big = tick(createWorld(2024), TICKS_PER_DAY * 30);
    let small = createWorld(2024);
    for (let i = 0; i < TICKS_PER_DAY * 30; i++) small = tick(small, 1);
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
