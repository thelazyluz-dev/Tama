// Structures: shelter (passive warmth/safety when nearby) and fire (an active
// warm source that burns fuel). Pure helpers over the structures array.

import type { Structure, StructureType, Vec2, WorldState } from './types';
import { SHELTER_RADIUS, FIRE_RADIUS, FIRE_FUEL_BURN_PER_DAY, TICKS_PER_DAY } from './balance';

function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function nearestStructure(
  structures: readonly Structure[],
  type: StructureType,
  from: Vec2,
): Structure | null {
  let best: Structure | null = null;
  let bestDist = Infinity;
  for (const s of structures) {
    if (s.type !== type) continue;
    const d = dist2(s.position, from);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

export function hasShelter(state: WorldState): boolean {
  return state.structures.some((s) => s.type === 'shelter');
}

/** Is the given position currently under the roof of a shelter? */
export function isSheltered(state: WorldState, pos: Vec2): boolean {
  return state.structures.some(
    (s) => s.type === 'shelter' && dist2(s.position, pos) <= SHELTER_RADIUS * SHELTER_RADIUS,
  );
}

/** A lit fire (fuel > 0) next to the given position, if any. */
export function warmFireNear(state: WorldState, pos: Vec2): Structure | null {
  for (const s of state.structures) {
    if (s.type === 'fire' && s.fuel > 0 && dist2(s.position, pos) <= FIRE_RADIUS * FIRE_RADIUS) {
      return s;
    }
  }
  return null;
}

/** Any lit fire anywhere (for warmth-decay dampening near camp). */
export function anyLitFire(state: WorldState): Structure | null {
  return state.structures.find((s) => s.type === 'fire' && s.fuel > 0) ?? null;
}

/** Burn one tick of fuel from every lit fire. */
export function burnFires(state: WorldState): void {
  const perTick = FIRE_FUEL_BURN_PER_DAY / TICKS_PER_DAY;
  for (const s of state.structures) {
    if (s.type === 'fire' && s.fuel > 0) {
      s.fuel = Math.max(0, s.fuel - perTick);
    }
  }
}
