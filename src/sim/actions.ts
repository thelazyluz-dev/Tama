// The stage-1 action table. Appeal formulas follow SPEC "מנוע ההחלטות" — needs
// enter appeal SQUARED. Some actions carry side effects beyond need deltas
// (gather fills the store, eat draws it down, building creates structures);
// those run through performTick/onComplete hooks, invoked by world.ts.
//
// Scoring (utility.ts) is RNG-free; only committing a fresh wander destination
// consumes RNG, keeping the sim deterministic.

import type { Agent, WorldState, ActionId, NeedKey, Vec2, Structure } from './types';
import { nearestResource } from './resources';
import { nearestStructure, hasShelter, anyLitFire } from './structures';
import { efficiency } from './needs';
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
  FOOD_STOCK_CAP,
  EAT_FROM_STOCK,
  HUNGER_PER_FOOD,
  GATHER_RATE,
  GATHER_STOCK_APPEAL,
  GATHER_AUTUMN_BONUS,
  BUILD_SHELTER_APPEAL,
  MAKE_FIRE_APPEAL,
  WINTER_PREP_BONUS,
  FIRE_FUEL_START,
  FIRE_FUEL_PER_MAKE,
  FIRE_RADIUS,
} from './balance';

export interface ResolvedTarget {
  pos: Vec2;
  targetId?: string;
}

export interface ActionDef {
  id: ActionId;
  appeal(agent: Agent, world: WorldState): number;
  feasibility(agent: Agent, world: WorldState): number;
  scoringTarget(agent: Agent, world: WorldState): Vec2;
  commitTarget(agent: Agent, world: WorldState, rng: Rng): ResolvedTarget | null;
  durationTicks: number;
  effect: Partial<Record<NeedKey, number>>;
  /** Extra side effect each in-range tick (e.g. gather, eat). */
  performTick?(state: WorldState): void;
  /** Side effect when the action completes (e.g. place a structure). */
  onComplete?(state: WorldState): void;
}

function sq(x: number): number {
  return x * x;
}
function isNight(hour: number): boolean {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}
function isReactive(world: WorldState): boolean {
  return world.aiProfile === 'reactive';
}
/** Prep actions matter far more as winter looms. */
function prepBonus(world: WorldState): number {
  if (world.season === 'winter') return WINTER_PREP_BONUS;
  if (world.season === 'autumn') return WINTER_PREP_BONUS * 0.65;
  return 1;
}
/** Where the agent makes its home — beside the shelter if one exists. */
function campSpot(world: WorldState): Vec2 {
  const shelter = nearestStructure(world.structures, 'shelter', world.agent.position);
  return shelter ? { ...shelter.position } : { ...world.agent.position };
}

const eat: ActionDef = {
  id: 'eat',
  appeal: (a) => sq(a.needs.hunger / 100),
  feasibility: (a) => (a.foodStock > 0 ? 1 : 0),
  scoringTarget: (a) => a.position, // eaten from the store, in place
  commitTarget: (a) => ({ pos: { ...a.position } }),
  durationTicks: ACTION.eat.durationTicks,
  effect: {},
  performTick: (state) => {
    const a = state.agent;
    if (a.foodStock <= 0) return;
    const perTick = Math.min(EAT_FROM_STOCK / ACTION.eat.durationTicks, a.foodStock);
    a.foodStock -= perTick;
    a.needs.hunger -= perTick * HUNGER_PER_FOOD;
  },
};

const drink: ActionDef = {
  id: 'drink',
  appeal: (a) => sq(a.needs.thirst / 100) * THIRST_APPEAL_MULT,
  feasibility: (_a, w) => (w.resources.some((r) => r.type === 'water') ? 1 : 0),
  scoringTarget: (a, w) => nearestResource(w.resources, 'water', a.position)?.position ?? a.position,
  commitTarget: (a, w) => {
    const node = nearestResource(w.resources, 'water', a.position);
    return node ? { pos: node.position, targetId: node.id } : null;
  },
  durationTicks: ACTION.drink.durationTicks,
  effect: ACTION.drink.effect,
};

const sleep: ActionDef = {
  id: 'sleep',
  appeal: (a, w) => sq(a.needs.fatigue / 100) * (isNight(w.hour) ? NIGHT_SLEEP_BONUS : DAY_SLEEP_BONUS),
  feasibility: () => 1,
  scoringTarget: (a) => a.position,
  commitTarget: (_a, w) => ({ pos: campSpot(w) }), // sleep at camp when there is one
  durationTicks: ACTION.sleep.durationTicks,
  effect: ACTION.sleep.effect,
};

const wash: ActionDef = {
  id: 'wash',
  appeal: (a) => sq(a.needs.hygiene / 100) * 1.05,
  feasibility: (_a, w) => (w.resources.some((r) => r.type === 'water') ? 1 : 0),
  scoringTarget: (a, w) => nearestResource(w.resources, 'water', a.position)?.position ?? a.position,
  commitTarget: (a, w) => {
    const node = nearestResource(w.resources, 'water', a.position);
    return node ? { pos: node.position, targetId: node.id } : null;
  },
  durationTicks: ACTION.wash.durationTicks,
  effect: ACTION.wash.effect,
};

const warm: ActionDef = {
  id: 'warm',
  appeal: (a) => sq(a.needs.warmth / 100),
  feasibility: (_a, w) => (anyLitFire(w) ? 1 : 0),
  scoringTarget: (a, w) => nearestStructure(w.structures, 'fire', a.position)?.position ?? a.position,
  commitTarget: (a, w) => {
    const fire = nearestStructure(w.structures, 'fire', a.position);
    return fire ? { pos: { ...fire.position }, targetId: fire.id } : null;
  },
  durationTicks: ACTION.warm.durationTicks,
  effect: ACTION.warm.effect,
};

const wander: ActionDef = {
  id: 'wander',
  appeal: (a) => WANDER_APPEAL + sq(a.needs.boredom / 100) * 0.5,
  feasibility: () => 1,
  scoringTarget: (a) => a.position,
  commitTarget: (_a, _w, rng) => {
    const limit = WORLD_HALF - RESOURCE_MARGIN;
    return { pos: { x: rng.range(-limit, limit), z: rng.range(-limit, limit) } };
  },
  durationTicks: ACTION.wander.durationTicks,
  effect: ACTION.wander.effect,
};

const gather: ActionDef = {
  id: 'gather',
  appeal: (a, w) => {
    if (w.season === 'winter') return 0; // no fruit to gather
    const seasonMult = w.season === 'autumn' ? GATHER_AUTUMN_BONUS : 1;
    // Proactive stockpiling (suppressed for a reactive/neglected agent)...
    const proactive = isReactive(w) ? 0 : GATHER_STOCK_APPEAL * (1 - a.foodStock / FOOD_STOCK_CAP);
    // ...plus a reactive pull when hungry with an empty store.
    const reactive = a.foodStock < EAT_FROM_STOCK ? sq(a.needs.hunger / 100) * 1.2 : 0;
    return proactive * seasonMult + reactive;
  },
  feasibility: (a, w) =>
    w.season !== 'winter' && nearestResource(w.resources, 'fruit', a.position, true) ? 1 : 0,
  scoringTarget: (a, w) =>
    nearestResource(w.resources, 'fruit', a.position, true)?.position ?? a.position,
  commitTarget: (a, w) => {
    const node = nearestResource(w.resources, 'fruit', a.position, true);
    return node ? { pos: node.position, targetId: node.id } : null;
  },
  durationTicks: ACTION.gather.durationTicks,
  effect: {},
  performTick: (state) => {
    const a = state.agent;
    const action = a.currentAction;
    if (!action?.targetId) return;
    const node = state.resources.find((r) => r.id === action.targetId);
    if (!node || node.quantity <= 0) return;
    const room = FOOD_STOCK_CAP - a.foodStock;
    const amount = Math.min(GATHER_RATE * efficiency(state), node.quantity, room);
    if (amount <= 0) return;
    node.quantity -= amount;
    a.foodStock += amount;
  },
};

const buildShelter: ActionDef = {
  id: 'buildShelter',
  appeal: (a, w) => {
    if (isReactive(w) || hasShelter(w)) return 0;
    const coldNudge = 1 + sq(a.needs.warmth / 100);
    return BUILD_SHELTER_APPEAL * prepBonus(w) * coldNudge;
  },
  feasibility: (_a, w) => (hasShelter(w) ? 0 : 1),
  scoringTarget: (a) => a.position,
  commitTarget: (a) => ({ pos: { ...a.position } }), // build where you stand
  durationTicks: ACTION.buildShelter.durationTicks,
  effect: {},
  onComplete: (state) => {
    if (hasShelter(state)) return;
    const action = state.agent.currentAction;
    const pos = action ? { ...action.targetPos } : { ...state.agent.position };
    const shelter: Structure = { id: `shelter-${state.tick}`, type: 'shelter', position: pos, fuel: 0 };
    state.structures.push(shelter);
    state.milestones.builtShelter = true;
  },
};

const makeFire: ActionDef = {
  id: 'makeFire',
  appeal: (a, w) => {
    if (isReactive(w)) return 0;
    // Back off while a well-fuelled fire is already burning anywhere in camp.
    const fire = anyLitFire(w);
    const supplied = fire && fire.fuel > FIRE_FUEL_START * 0.4 ? 0.05 : 1;
    const cold = 0.4 + sq(a.needs.warmth / 100);
    return MAKE_FIRE_APPEAL * prepBonus(w) * cold * supplied;
  },
  feasibility: () => 1,
  scoringTarget: (a) => a.position,
  commitTarget: (_a, w) => ({ pos: campSpot(w) }),
  durationTicks: ACTION.makeFire.durationTicks,
  effect: {},
  onComplete: (state) => {
    const action = state.agent.currentAction;
    const pos = action ? { ...action.targetPos } : { ...state.agent.position };
    // Re-fuel an existing nearby fire, or light a new one.
    let fire = nearestStructure(state.structures, 'fire', pos);
    const near =
      fire &&
      (fire.position.x - pos.x) ** 2 + (fire.position.z - pos.z) ** 2 <= FIRE_RADIUS * FIRE_RADIUS;
    if (fire && near) {
      fire.fuel = Math.min(FIRE_FUEL_START, fire.fuel + FIRE_FUEL_PER_MAKE);
    } else {
      fire = { id: `fire-${state.tick}`, type: 'fire', position: pos, fuel: FIRE_FUEL_START };
      state.structures.push(fire);
    }
    state.milestones.madeFire = true;
  },
};

export const ACTIONS: Record<ActionId, ActionDef> = {
  eat,
  drink,
  sleep,
  wander,
  gather,
  wash,
  warm,
  buildShelter,
  makeFire,
};
export const ACTION_LIST: readonly ActionDef[] = [
  eat,
  drink,
  sleep,
  wash,
  warm,
  gather,
  buildShelter,
  makeFire,
  wander,
];
