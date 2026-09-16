// Need decay per tick. Most needs decay at a flat rate; warmth and safety are
// dynamic — they depend on season, weather, and whether the agent is near
// shelter or a fire. Pure.

import type { WorldState, NeedKey } from './types';
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
} from './balance';
import { isSheltered, warmFireNear } from './structures';

/** Work effectiveness, dragged down by loneliness and boredom (SPEC ×0.6). */
export function efficiency(state: WorldState): number {
  const l = state.agent.needs.loneliness / 100;
  const b = state.agent.needs.boredom / 100;
  const e = 1 - LONELINESS_EFFICIENCY_PENALTY * l - BOREDOM_EFFICIENCY_PENALTY * b;
  return Math.max(MIN_EFFICIENCY, e);
}

/** Warmth ("cold") decay per game day, dampened by shelter and nearby fire. */
export function warmthDecayPerDay(state: WorldState): number {
  let base = WARMTH_DECAY_BY_SEASON[state.season] + WARMTH_DECAY_BY_WEATHER[state.weather];
  if (isSheltered(state)) base *= SHELTER_WARMTH_DECAY_FACTOR;
  if (warmFireNear(state)) base *= 0.4; // ambient warmth from the fire
  return base;
}

/** Safety distress change per game day (threat minus calm/shelter relief). */
export function safetyDeltaPerDay(state: WorldState): number {
  const threat = SAFETY_THREAT_BY_WEATHER[state.weather];
  const relief = SAFETY_DECAY_BASE + (isSheltered(state) ? SAFETY_RELIEF_IN_SHELTER : 0);
  return threat - relief;
}

/** Advance all eight needs by one tick. Mutates the agent in place. */
export function applyNeedDecay(state: WorldState): void {
  const needs = state.agent.needs;
  for (const key of NEED_KEYS) {
    needs[key] += perTick(state, key);
  }
  clampNeeds(state);
}

function perTick(state: WorldState, key: NeedKey): number {
  if (key === 'warmth') return warmthDecayPerDay(state) / TICKS_PER_DAY;
  if (key === 'safety') return safetyDeltaPerDay(state) / TICKS_PER_DAY;
  return NEED_DECAY_PER_DAY[key] / TICKS_PER_DAY;
}

export function clampNeeds(state: WorldState): void {
  const needs = state.agent.needs;
  for (const key of NEED_KEYS) {
    const v = needs[key];
    needs[key] = v < 0 ? 0 : v > 100 ? 100 : v;
  }
}
