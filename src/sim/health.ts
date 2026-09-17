// Health & death (SPEC "בריאות ומוות"). Health is the real resource: it drops
// from needs left in distress, regenerates slowly when the agent is
// comfortable, and has a death-spiral guard (a per-day damage floor + youth
// grace). Pure.

import type { WorldState, Agent, NeedKey } from './types';
import {
  HEALTH_DAMAGE_THRESHOLD,
  HEALTH_DAMAGE_PER_DAY,
  DEATH_CAUSE_BY_NEED,
  HEALTH_REGEN_PER_DAY,
  HEALTH_COMFORT_THRESHOLD,
  HEALTH_MAX_DAMAGE_PER_DAY,
  YOUTH_GRACE_DAYS,
  YOUTH_GRACE_FACTOR,
  CRISIS_HEALTH,
  HEALTH_MIN,
  TICKS_PER_DAY,
} from './balance';

export interface HealthResult {
  justDied: boolean;
  enteredCrisis: boolean;
  leftCrisis: boolean;
}

/** Update one agent's health for one tick; may kill it. Mutates in place. */
export function updateHealth(state: WorldState, a: Agent): HealthResult {
  const result: HealthResult = { justDied: false, enteredCrisis: false, leftCrisis: false };
  if (!a.alive) return result;

  // Accumulate damage from every need above its threshold; remember the worst.
  let damagePerDay = 0;
  let worstCause: string | undefined;
  let worstContribution = 0;
  for (const key of Object.keys(HEALTH_DAMAGE_PER_DAY) as NeedKey[]) {
    const need = a.needs[key];
    if (need <= HEALTH_DAMAGE_THRESHOLD) continue;
    const factor = (need - HEALTH_DAMAGE_THRESHOLD) / (100 - HEALTH_DAMAGE_THRESHOLD);
    const contribution = HEALTH_DAMAGE_PER_DAY[key]! * factor;
    damagePerDay += contribution;
    if (contribution > worstContribution) {
      worstContribution = contribution;
      worstCause = DEATH_CAUSE_BY_NEED[key];
    }
  }

  // Youth grace, then the per-day damage floor (no free-fall).
  if (state.day - a.birthDay < YOUTH_GRACE_DAYS) damagePerDay *= YOUTH_GRACE_FACTOR;
  damagePerDay = Math.min(damagePerDay, HEALTH_MAX_DAMAGE_PER_DAY);

  let netPerDay = -damagePerDay;
  if (damagePerDay === 0 && isComfortable(a.needs)) {
    netPerDay = HEALTH_REGEN_PER_DAY;
  }

  const wasCrisis = a.health < CRISIS_HEALTH;
  a.health = clampHealth(a.health + netPerDay / TICKS_PER_DAY);
  const isCrisis = a.health < CRISIS_HEALTH;

  if (a.health <= HEALTH_MIN) {
    a.alive = false;
    a.deathCause = worstCause ?? 'תשישות';
    a.currentAction = null;
    result.justDied = true;
    return result;
  }

  if (isCrisis && !wasCrisis) result.enteredCrisis = true;
  if (!isCrisis && wasCrisis) result.leftCrisis = true;
  return result;
}

function isComfortable(needs: Record<NeedKey, number>): boolean {
  return (
    needs.thirst < HEALTH_COMFORT_THRESHOLD &&
    needs.hunger < HEALTH_COMFORT_THRESHOLD &&
    needs.warmth < HEALTH_COMFORT_THRESHOLD
  );
}

function clampHealth(v: number): number {
  return v < 0 ? 0 : v > 100 ? 100 : v;
}
