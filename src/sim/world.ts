// The heart of the sim: a PURE tick function. Same state + same seed + same
// number of ticks => identical result. No react, no three, no DOM, no
// Math.random (CLAUDE.md iron rule + determinism rule).

import type { WorldState, Agent, ActiveAction, NeedKey } from './types';
import { Rng, deriveSeed } from './rng';
import { generateTerrain } from './terrain';
import { generateResources } from './resources';
import { ACTIONS } from './actions';
import { decide } from './utility';
import {
  NEED_DECAY_PER_DAY,
  NEED_START,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  MOVE_SPEED,
  ARRIVE_RADIUS,
} from './balance';

const NEED_KEYS: readonly NeedKey[] = ['hunger', 'thirst', 'fatigue'];

// A few Hebrew given names so the agent has an identity in the UI/log.
const NAMES = ['נועה', 'איתן', 'מאיה', 'יונתן', 'תמר', 'אורי', 'שירה', 'עומר'] as const;

/** Build a fresh world from a seed. Deterministic. */
export function createWorld(seed: number): WorldState {
  const nameRng = new Rng(deriveSeed(seed, 'name'));
  const agent: Agent = {
    id: 'a0',
    name: nameRng.pick(NAMES),
    needs: {
      hunger: NEED_START.hunger,
      thirst: NEED_START.thirst,
      fatigue: NEED_START.fatigue,
    },
    position: { x: 0, z: 0 },
    currentAction: null,
  };

  return {
    seed,
    tick: 0,
    day: 0,
    hour: 0,
    rngState: deriveSeed(seed, 'sim'),
    agent,
    terrain: generateTerrain(seed),
    resources: generateResources(seed),
  };
}

/**
 * Advance the world by `ticks` ticks. Returns a NEW state; the input is never
 * mutated. Immutable, seed-derived data (terrain, resources) is shared by
 * reference — it is never written to.
 */
export function tick(state: WorldState, ticks: number): WorldState {
  const next = cloneState(state);
  if (ticks <= 0) return next;

  // One RNG for the whole batch, resumed from and written back to state so the
  // stream continues seamlessly across tick() calls and save/load.
  const rng = new Rng(next.rngState);
  for (let i = 0; i < ticks; i++) {
    tickOnce(next, rng);
  }
  next.rngState = rng.getState();
  return next;
}

function tickOnce(state: WorldState, rng: Rng): void {
  const agent = state.agent;

  // 1. Advance the clock. `tick` is the master; day/hour are derived.
  state.tick += 1;
  state.day = Math.floor(state.tick / TICKS_PER_DAY);
  state.hour = Math.floor((state.tick % TICKS_PER_DAY) / TICKS_PER_HOUR);

  // 2. Needs decay toward distress.
  for (const key of NEED_KEYS) {
    agent.needs[key] += NEED_DECAY_PER_DAY[key] / TICKS_PER_DAY;
  }
  clampNeeds(agent);

  // 3. Decide what to do (with hysteresis), and commit a target if the choice
  //    changed or there is no active action.
  const { best } = decide(agent, state);
  const active = agent.currentAction;
  if (!active || active.type !== best.id) {
    const resolved = best.commitTarget(agent, state, rng);
    if (resolved) {
      const action: ActiveAction = {
        type: best.id,
        startedTick: state.tick,
        durationTicks: best.durationTicks,
        progress: 0,
        inRange: false,
        targetPos: { x: resolved.pos.x, z: resolved.pos.z },
      };
      if (resolved.targetId !== undefined) action.targetId = resolved.targetId;
      agent.currentAction = action;
    }
  }

  // 4. Move toward the target, then perform once in range.
  moveAndPerform(agent);
  clampNeeds(agent);
}

function moveAndPerform(agent: Agent): void {
  const act = agent.currentAction;
  if (!act) return;

  if (!act.inRange) {
    const dx = act.targetPos.x - agent.position.x;
    const dz = act.targetPos.z - agent.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= ARRIVE_RADIUS) {
      act.inRange = true;
    } else {
      const step = Math.min(MOVE_SPEED, dist);
      agent.position.x += (dx / dist) * step;
      agent.position.z += (dz / dist) * step;
      if (dist - step <= ARRIVE_RADIUS) act.inRange = true;
    }
  }

  if (act.inRange) {
    const effect = ACTIONS[act.type].effect;
    for (const key of NEED_KEYS) {
      const delta = effect[key];
      if (delta !== undefined) agent.needs[key] += delta;
    }
    act.progress += 1;
    if (act.progress >= act.durationTicks) {
      // Action complete; the next tick re-decides from scratch.
      agent.currentAction = null;
    }
  }
}

function clampNeeds(agent: Agent): void {
  for (const key of NEED_KEYS) {
    const v = agent.needs[key];
    agent.needs[key] = v < 0 ? 0 : v > 100 ? 100 : v;
  }
}

function cloneState(s: WorldState): WorldState {
  const a = s.agent;
  const action = a.currentAction;
  return {
    seed: s.seed,
    tick: s.tick,
    day: s.day,
    hour: s.hour,
    rngState: s.rngState,
    agent: {
      id: a.id,
      name: a.name,
      needs: { ...a.needs },
      position: { ...a.position },
      currentAction: action ? { ...action, targetPos: { ...action.targetPos } } : null,
    },
    // Immutable, seed-derived — safe to share by reference.
    terrain: s.terrain,
    resources: s.resources,
  };
}
