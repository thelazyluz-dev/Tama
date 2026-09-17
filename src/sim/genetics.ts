// Stage 4 — aging, inheritance and life stages (SPEC "דורות"). Pure.
//
// Knowledge (world.knowledge) persists across generations; skills are personal
// and (re)learned each life — the separation that turns death into progress.

import type { Agent, TraitKey } from './types';
import { Rng } from './rng';
import {
  ADULT_MIN_AGE_DAYS,
  CHILD_HELPER_AGE_DAYS,
  FERTILE_MAX_AGE_DAYS,
  TEACHING_AGE_MIN,
  TEACHING_AGE_MAX,
  TRAIT_MUTATION,
  OLD_AGE_START_DAYS,
  MAX_AGE_DAYS,
} from './balance';

const TRAIT_KEYS: TraitKey[] = [
  'curiosity',
  'diligence',
  'sociability',
  'courage',
  'temper',
  'constitution',
];

export function ageDays(agent: Agent, day: number): number {
  return day - agent.birthDay;
}
export function isAdult(agent: Agent, day: number): boolean {
  return ageDays(agent, day) >= ADULT_MIN_AGE_DAYS;
}
export function isChild(agent: Agent, day: number): boolean {
  return ageDays(agent, day) < ADULT_MIN_AGE_DAYS;
}
export function canHelp(agent: Agent, day: number): boolean {
  return ageDays(agent, day) >= CHILD_HELPER_AGE_DAYS;
}
export function isFertile(agent: Agent, day: number): boolean {
  const age = ageDays(agent, day);
  return age >= ADULT_MIN_AGE_DAYS && age <= FERTILE_MAX_AGE_DAYS;
}
export function inTeachingWindow(agent: Agent, day: number): boolean {
  const age = ageDays(agent, day);
  return age >= TEACHING_AGE_MIN && age <= TEACHING_AGE_MAX;
}

/** Daily probability of dying of old age; rises after OLD_AGE_START. */
export function oldAgeDeathChance(age: number): number {
  if (age < OLD_AGE_START_DAYS) return 0;
  const t = Math.min(1, (age - OLD_AGE_START_DAYS) / (MAX_AGE_DAYS - OLD_AGE_START_DAYS));
  return t * 0.5 + (age >= MAX_AGE_DAYS ? 0.3 : 0);
}

/** Child traits: parent average ± mutation (SPEC inherit()). */
export function inheritTraits(
  mother: Agent,
  father: Agent,
  rng: Rng,
): Record<TraitKey, number> {
  const out = {} as Record<TraitKey, number>;
  for (const key of TRAIT_KEYS) {
    const avg = (mother.traits[key] + father.traits[key]) / 2;
    const mutation = (rng.next() - 0.5) * (TRAIT_MUTATION * 2);
    out[key] = Math.min(1, Math.max(0, avg + mutation));
  }
  return out;
}
