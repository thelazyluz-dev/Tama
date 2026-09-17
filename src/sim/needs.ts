// Need decay per tick, per agent. Most needs decay at a flat rate; warmth and
// safety are dynamic (season, weather, shelter, fire); loneliness eases when
// the agent has a partner. Pure.

import type { WorldState, Agent, NeedKey } from './types';
import {
  NEED_KEYS,
  NEED_DECAY_PER_DAY,
  WARMTH_DECAY_BY_SEASON,
  WARMTH_DECAY_BY_WEATHER,
  SHELTER_WARMTH_DECAY_FACTOR,
  SAFETY_THREAT_BY_WEATHER,
  SAFETY_RELIEF_IN_SHELTER,
  SAFETY_DECAY_BASE,
  TICKS_PER_DAY,
  LONELINESS_EFFICIENCY_PENALTY,
  BOREDOM_EFFICIENCY_PENALTY,
  MIN_EFFICIENCY,
  LONELINESS_PARTNER_FACTOR,
} from './balance';
import { isSheltered, warmFireNear } from './structures';
import { partnerOf } from './agents';

/** Work effectiveness, dragged down by loneliness and boredom (SPEC ×0.6). */
export function efficiency(agent: Agent): number {
  const l = agent.needs.loneliness / 100;
  const b = agent.needs.boredom / 100;
  const e = 1 - LONELINESS_EFFICIENCY_PENALTY * l - BOREDOM_EFFICIENCY_PENALTY * b;
  return Math.max(MIN_EFFICIENCY, e);
}

/** Warmth ("cold") decay per game day for an agent, dampened by shelter/fire. */
export function warmthDecayPerDay(state: WorldState, agent: Agent): number {
  let base = WARMTH_DECAY_BY_SEASON[state.season] + WARMTH_DECAY_BY_WEATHER[state.weather];
  if (isSheltered(state, agent.position)) base *= SHELTER_WARMTH_DECAY_FACTOR;
  if (warmFireNear(state, agent.position)) base *= 0.4;
  return base;
}

/** Safety distress change per game day (threat minus calm/shelter relief). */
export function safetyDeltaPerDay(state: WorldState, agent: Agent): number {
  const threat = SAFETY_THREAT_BY_WEATHER[state.weather];
  const relief = SAFETY_DECAY_BASE + (isSheltered(state, agent.position) ? SAFETY_RELIEF_IN_SHELTER : 0);
  return threat - relief;
}

/** Advance all eight needs of one agent by one tick. Mutates in place. */
export function applyNeedDecay(state: WorldState, agent: Agent): void {
  const hasPartner = partnerOf(state, agent) !== null;
  for (const key of NEED_KEYS) {
    agent.needs[key] += perTick(state, agent, key, hasPartner);
  }
  clampNeeds(agent);
}

function perTick(state: WorldState, agent: Agent, key: NeedKey, hasPartner: boolean): number {
  if (key === 'warmth') return warmthDecayPerDay(state, agent) / TICKS_PER_DAY;
  if (key === 'safety') return safetyDeltaPerDay(state, agent) / TICKS_PER_DAY;
  let rate = NEED_DECAY_PER_DAY[key];
  if (key === 'loneliness' && hasPartner) rate *= LONELINESS_PARTNER_FACTOR;
  return rate / TICKS_PER_DAY;
}

export function clampNeeds(agent: Agent): void {
  for (const key of NEED_KEYS) {
    const v = agent.needs[key];
    agent.needs[key] = v < 0 ? 0 : v > 100 ? 100 : v;
  }
}
