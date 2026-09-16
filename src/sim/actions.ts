// The action table: appeal, feasibility, target resolution, duration and
// effects for stage 0's four actions. Appeal formulas follow SPEC "מנוע
// ההחלטות" — needs enter SQUARED so a need is calm until high, then dominates.
//
// Scoring (utility.ts) never consumes RNG; only committing to a fresh wander
// destination does, and that happens once per action in world.ts. This keeps
// the sim deterministic.

import type { Agent, WorldState, ActionId, NeedKey, Vec2 } from './types';
import { nearestResource } from './resources';
import { Rng } from './rng';
import {
  ACTION,
  THIRST_APPEAL_MULT,
  WANDER_APPEAL,
  NIGHT_SLEEP_BONUS,
  DAY_SLEEP_BONUS,
  NIGHT_START_HOUR,
  NIGHT_END_HOUR,
  WORLD_HALF,
  RESOURCE_MARGIN,
} from './balance';

export interface ResolvedTarget {
  pos: Vec2;
  targetId?: string;
}

export interface ActionDef {
  id: ActionId;
  /** Base desirability, 0..~1.5. */
  appeal(agent: Agent, world: WorldState): number;
  /** 0 (impossible) or 1 (possible). */
  feasibility(agent: Agent, world: WorldState): number;
  /**
   * The point the agent must reach before performing, for distance scoring.
   * Deterministic and RNG-free (wander returns the agent's own position so
   * distance never penalises the idle baseline).
   */
  scoringTarget(agent: Agent, world: WorldState): Vec2;
  /**
   * The concrete target committed to when the action actually starts. Only
   * wander consumes RNG here (a fresh random destination).
   */
  commitTarget(agent: Agent, world: WorldState, rng: Rng): ResolvedTarget | null;
  durationTicks: number;
  effect: Partial<Record<NeedKey, number>>;
}

function isNight(hour: number): boolean {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

function sq(x: number): number {
  return x * x;
}

const eat: ActionDef = {
  id: 'eat',
  appeal: (agent, world) => {
    const foodAvailable = world.resources.some((r) => r.type === 'fruit') ? 1 : 0;
    return sq(agent.needs.hunger / 100) * foodAvailable;
  },
  feasibility: (_agent, world) => (world.resources.some((r) => r.type === 'fruit') ? 1 : 0),
  scoringTarget: (agent, world) =>
    nearestResource(world.resources, 'fruit', agent.position)?.position ?? agent.position,
  commitTarget: (agent, world) => {
    const node = nearestResource(world.resources, 'fruit', agent.position);
    return node ? { pos: node.position, targetId: node.id } : null;
  },
  durationTicks: ACTION.eat.durationTicks,
  effect: ACTION.eat.effect,
};

const drink: ActionDef = {
  id: 'drink',
  appeal: (agent) => sq(agent.needs.thirst / 100) * THIRST_APPEAL_MULT,
  feasibility: (_agent, world) => (world.resources.some((r) => r.type === 'water') ? 1 : 0),
  scoringTarget: (agent, world) =>
    nearestResource(world.resources, 'water', agent.position)?.position ?? agent.position,
  commitTarget: (agent, world) => {
    const node = nearestResource(world.resources, 'water', agent.position);
    return node ? { pos: node.position, targetId: node.id } : null;
  },
  durationTicks: ACTION.drink.durationTicks,
  effect: ACTION.drink.effect,
};

const sleep: ActionDef = {
  id: 'sleep',
  appeal: (agent, world) =>
    sq(agent.needs.fatigue / 100) * (isNight(world.hour) ? NIGHT_SLEEP_BONUS : DAY_SLEEP_BONUS),
  feasibility: () => 1,
  // Sleep happens in place in stage 0 (no shelter yet).
  scoringTarget: (agent) => agent.position,
  commitTarget: (agent) => ({ pos: { ...agent.position } }),
  durationTicks: ACTION.sleep.durationTicks,
  effect: ACTION.sleep.effect,
};

const wander: ActionDef = {
  id: 'wander',
  appeal: () => WANDER_APPEAL,
  feasibility: () => 1,
  // Idle baseline: distance must not penalise it, so score against self.
  scoringTarget: (agent) => agent.position,
  commitTarget: (_agent, _world, rng) => {
    const limit = WORLD_HALF - RESOURCE_MARGIN;
    return { pos: { x: rng.range(-limit, limit), z: rng.range(-limit, limit) } };
  },
  durationTicks: ACTION.wander.durationTicks,
  effect: ACTION.wander.effect,
};

/** All actions, keyed by id, and as an ordered list for deterministic scoring. */
export const ACTIONS: Record<ActionId, ActionDef> = { eat, drink, sleep, wander };
export const ACTION_LIST: readonly ActionDef[] = [eat, drink, sleep, wander];
