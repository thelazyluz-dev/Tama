// The heart of the sim: a PURE tick function. Same state + same seed + same
// number of ticks => identical result. No react/three/DOM, no Math.random
// (CLAUDE.md iron rule + determinism rule).

import type {
  WorldState,
  Agent,
  ActiveAction,
  SavedWorld,
  Structure,
  ResourceNode,
  AiProfile,
} from './types';
import { Rng, deriveSeed } from './rng';
import { generateTerrain } from './terrain';
import { generateResources, regrowResources } from './resources';
import { deriveSeason, rollWeather, wintersElapsed } from './season';
import { applyNeedDecay, clampNeeds } from './needs';
import { updateHealth } from './health';
import { burnFires } from './structures';
import { ACTIONS } from './actions';
import { decide } from './utility';
import {
  pushSeason,
  pushWeather,
  pushDaySummary,
  pushBuild,
  pushFirstGather,
  pushCrisis,
  pushDeath,
} from './events';
import {
  NEED_KEYS,
  NEED_START,
  HEALTH_START,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  MOVE_SPEED,
  ARRIVE_RADIUS,
} from './balance';

// Feminine given names, matching the SPEC's journal voice ("נועה מצאה...").
const NAMES = ['נועה', 'מאיה', 'תמר', 'שירה', 'יעל', 'רוני', 'דנה', 'הדס', 'אביגיל', 'ליבי'] as const;

/** Build a fresh world from a seed. Deterministic. */
export function createWorld(seed: number, aiProfile: AiProfile = 'sensible'): WorldState {
  const nameRng = new Rng(deriveSeed(seed, 'name'));
  const season = deriveSeason(0);
  const agent: Agent = {
    id: 'a0',
    name: nameRng.pick(NAMES),
    needs: { ...NEED_START },
    health: HEALTH_START,
    alive: true,
    foodStock: 0,
    position: { x: 0, z: 0 },
    currentAction: null,
  };

  return {
    seed,
    tick: 0,
    day: 0,
    hour: 0,
    rngState: deriveSeed(seed, 'sim'),
    season,
    weather: 'clear',
    aiProfile,
    agent,
    structures: [],
    journal: [],
    milestones: {
      builtShelter: false,
      madeFire: false,
      firstGather: false,
      inCrisis: false,
      survivedWinters: 0,
      lastSeason: season,
      lastWeather: 'clear',
    },
    terrain: generateTerrain(seed),
    resources: generateResources(seed),
  };
}

/** Advance by `ticks`. Returns a NEW state; the input is never mutated. */
export function tick(state: WorldState, ticks: number): WorldState {
  const next = cloneState(state);
  if (ticks <= 0) return next;
  const rng = new Rng(next.rngState);
  for (let i = 0; i < ticks; i++) tickOnce(next, rng);
  next.rngState = rng.getState();
  return next;
}

function tickOnce(state: WorldState, rng: Rng): void {
  const agent = state.agent;

  // 1. Advance the clock.
  const prevDay = state.day;
  state.tick += 1;
  state.day = Math.floor(state.tick / TICKS_PER_DAY);
  state.hour = Math.floor((state.tick % TICKS_PER_DAY) / TICKS_PER_HOUR);
  const newDay = state.day !== prevDay;

  // A dead agent's world stops advancing (generations arrive in stage 4).
  if (!agent.alive) return;

  // 2. Daily bookkeeping: season, weather, regrowth, summary.
  if (newDay) {
    const season = deriveSeason(state.day);
    if (season !== state.season) {
      state.season = season;
      pushSeason(state, rng);
    }
    const weather = rollWeather(state.season, rng);
    const changed = weather !== state.weather;
    state.weather = weather;
    if (changed) pushWeather(state, rng);

    regrowResources(state.resources, state.season);
    state.milestones.survivedWinters = wintersElapsed(state.day);
    pushDaySummary(state, rng);
  }

  // 3. Fires burn down.
  burnFires(state);

  // 4. Needs decay.
  applyNeedDecay(state);

  // 5. Health & death.
  const health = updateHealth(state);
  if (health.justDied) {
    pushDeath(state);
    return;
  }
  if (health.enteredCrisis) pushCrisis(state);

  // 6. Decide (hysteresis) and commit a target if the choice changed.
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

  // 7. Move toward the target, then perform once in range.
  moveAndPerform(state);
  clampNeeds(state);
}

function moveAndPerform(state: WorldState): void {
  const agent = state.agent;
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

  if (!act.inRange) return;

  const def = ACTIONS[act.type];
  for (const key of NEED_KEYS) {
    const delta = def.effect[key];
    if (delta !== undefined) agent.needs[key] += delta;
  }

  const beforeStock = agent.foodStock;
  if (def.performTick) def.performTick(state);
  if (act.type === 'gather' && !state.milestones.firstGather && agent.foodStock > beforeStock) {
    state.milestones.firstGather = true;
    pushFirstGather(state);
  }

  act.progress += 1;
  if (act.progress >= act.durationTicks) {
    const hadShelter = state.milestones.builtShelter;
    const hadFire = state.milestones.madeFire;
    if (def.onComplete) def.onComplete(state);
    if (!hadShelter && state.milestones.builtShelter) pushBuild(state, 'shelter');
    if (!hadFire && state.milestones.madeFire) pushBuild(state, 'fire');
    agent.currentAction = null;
  }
}

/** Extract the persistable subset (terrain is rebuilt from seed). */
export function toSaved(state: WorldState): SavedWorld {
  return {
    seed: state.seed,
    tick: state.tick,
    day: state.day,
    hour: state.hour,
    rngState: state.rngState,
    season: state.season,
    weather: state.weather,
    aiProfile: state.aiProfile,
    agent: cloneAgent(state.agent),
    structures: state.structures.map(cloneStructure),
    resources: state.resources.map(cloneResource),
    journal: state.journal.slice(),
    milestones: { ...state.milestones },
  };
}

/** Rebuild a full WorldState from a saved subset, regenerating terrain. */
export function hydrate(saved: SavedWorld): WorldState {
  return {
    seed: saved.seed,
    tick: saved.tick,
    day: saved.day,
    hour: saved.hour,
    rngState: saved.rngState,
    season: saved.season,
    weather: saved.weather,
    aiProfile: saved.aiProfile,
    agent: cloneAgent(saved.agent),
    structures: saved.structures.map(cloneStructure),
    resources: saved.resources.map(cloneResource),
    journal: saved.journal.slice(),
    milestones: { ...saved.milestones },
    terrain: generateTerrain(saved.seed),
  };
}

function cloneAgent(a: Agent): Agent {
  const action = a.currentAction;
  const cloned: Agent = {
    id: a.id,
    name: a.name,
    needs: { ...a.needs },
    health: a.health,
    alive: a.alive,
    foodStock: a.foodStock,
    position: { ...a.position },
    currentAction: action ? { ...action, targetPos: { ...action.targetPos } } : null,
  };
  if (a.deathCause !== undefined) cloned.deathCause = a.deathCause;
  return cloned;
}

function cloneStructure(s: Structure): Structure {
  return { id: s.id, type: s.type, position: { ...s.position }, fuel: s.fuel };
}

function cloneResource(r: ResourceNode): ResourceNode {
  return { id: r.id, type: r.type, position: { ...r.position }, quantity: r.quantity };
}

function cloneState(s: WorldState): WorldState {
  return {
    seed: s.seed,
    tick: s.tick,
    day: s.day,
    hour: s.hour,
    rngState: s.rngState,
    season: s.season,
    weather: s.weather,
    aiProfile: s.aiProfile,
    agent: cloneAgent(s.agent),
    structures: s.structures.map(cloneStructure),
    resources: s.resources.map(cloneResource),
    journal: s.journal.slice(),
    milestones: { ...s.milestones },
    terrain: s.terrain, // immutable, seed-derived — safe to share
  };
}
