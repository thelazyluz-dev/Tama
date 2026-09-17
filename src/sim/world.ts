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
  Relation,
  AiProfile,
  Sex,
} from './types';
import { Rng, deriveSeed } from './rng';
import { generateTerrain } from './terrain';
import { generateResources, regrowResources } from './resources';
import { deriveSeason, rollWeather, wintersElapsed } from './season';
import { applyNeedDecay, clampNeeds } from './needs';
import { updateHealth } from './health';
import { burnFires } from './structures';
import { playerAgent } from './agents';
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
  pushLightning,
  pushNomad,
  pushPartners,
} from './events';
import {
  NEED_KEYS,
  NEED_START,
  HEALTH_START,
  START_HOUR,
  SKILL_START,
  LIGHTNING_CHANCE_PER_STORM_DAY,
  NOMAD_MIN_DAY,
  ADULT_MIN_AGE_DAYS,
  PARTNER_AFFECTION_THRESHOLD,
  AFFECTION_DECAY_PER_DAY,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  MOVE_SPEED,
  ARRIVE_RADIUS,
  WORLD_HALF,
} from './balance';

const FEMALE_NAMES = ['נועה', 'מאיה', 'תמר', 'שירה', 'יעל', 'רוני', 'דנה', 'הדס', 'אביגיל', 'ליבי'] as const;
const MALE_NAMES = ['איתן', 'יונתן', 'אורי', 'עומר', 'נועם', 'איתי', 'דניאל', 'אלון', 'גיא', 'רועי'] as const;

interface SpawnOpts {
  id: string;
  name: string;
  sex: Sex;
  birthDay: number;
  position: { x: number; z: number };
  rng: Rng;
}

function spawnAgent(o: SpawnOpts): Agent {
  return {
    id: o.id,
    name: o.name,
    sex: o.sex,
    birthDay: o.birthDay,
    needs: { ...NEED_START },
    health: HEALTH_START,
    alive: true,
    traits: {
      curiosity: o.rng.range(0.4, 0.85),
      diligence: o.rng.range(0.3, 0.8),
      sociability: o.rng.range(0.3, 0.85),
      courage: o.rng.range(0.3, 0.8),
      temper: o.rng.range(0.2, 0.7),
      constitution: o.rng.range(0.4, 0.85),
    },
    skills: { foraging: SKILL_START, crafting: SKILL_START, firecraft: SKILL_START },
    relations: {},
    position: { ...o.position },
    currentAction: null,
  };
}

/** Build a fresh world from a seed. Deterministic. The founder is female. */
export function createWorld(seed: number, aiProfile: AiProfile = 'sensible'): WorldState {
  const nameRng = new Rng(deriveSeed(seed, 'name'));
  const traitRng = new Rng(deriveSeed(seed, 'traits'));
  const season = deriveSeason(0);

  const founder = spawnAgent({
    id: 'a0',
    name: nameRng.pick(FEMALE_NAMES),
    sex: 'female',
    birthDay: 0,
    position: { x: 0, z: 0 },
    rng: traitRng,
  });

  const startTick = START_HOUR * TICKS_PER_HOUR; // begin the first day in the morning
  return {
    seed,
    tick: startTick,
    day: 0,
    hour: START_HOUR,
    rngState: deriveSeed(seed, 'sim'),
    season,
    weather: 'clear',
    aiProfile,
    agents: [founder],
    playerAgentId: founder.id,
    foodStock: 0,
    structures: [],
    journal: [],
    milestones: {
      builtShelter: false,
      madeFire: false,
      firstGather: false,
      inCrisis: false,
      nomadArrived: false,
      becamePartners: false,
      survivedWinters: 0,
      lastSeason: season,
      lastWeather: 'clear',
    },
    knowledge: { known: [], progress: {}, triggers: { lightning: false } },
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
  // 1. Advance the clock.
  const prevDay = state.day;
  state.tick += 1;
  state.day = Math.floor(state.tick / TICKS_PER_DAY);
  state.hour = Math.floor((state.tick % TICKS_PER_DAY) / TICKS_PER_HOUR);
  const newDay = state.day !== prevDay;

  // Once everyone is dead the world stops (heirs arrive in stage 4).
  if (!state.agents.some((a) => a.alive)) return;

  const voice = playerAgent(state); // whose name carries world-level journal lines

  // 2. Daily bookkeeping: season, weather, regrowth, nomad, summary.
  if (newDay) {
    const season = deriveSeason(state.day);
    if (season !== state.season) {
      state.season = season;
      pushSeason(state, voice, rng);
    }
    const weather = rollWeather(state.season, rng);
    const changed = weather !== state.weather;
    state.weather = weather;
    if (changed) pushWeather(state, voice, rng);

    if (
      state.weather === 'storm' &&
      !state.knowledge.triggers.lightning &&
      rng.next() < LIGHTNING_CHANCE_PER_STORM_DAY
    ) {
      state.knowledge.triggers.lightning = true;
      pushLightning(state, voice, rng);
    }

    regrowResources(state.resources, state.season);
    state.milestones.survivedWinters = wintersElapsed(state.day);
    maybeSpawnNomad(state);
    decayRelationships(state);
    pushDaySummary(state, voice, rng);
  }

  // 3. Fires burn down (world-level).
  burnFires(state);

  // 4. Per-agent: needs, health, decide, act.
  for (const agent of state.agents) {
    if (!agent.alive) continue;

    applyNeedDecay(state, agent);

    const health = updateHealth(state, agent);
    if (health.justDied) {
      pushDeath(state, agent);
      continue;
    }
    if (health.enteredCrisis) pushCrisis(state, agent);

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

    moveAndPerform(state, agent);
    clampNeeds(agent);
  }

  // 5. Relationships may tip into partnership.
  promoteRelationships(state);
}

function moveAndPerform(state: WorldState, agent: Agent): void {
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

  const beforeStock = state.foodStock;
  if (def.performTick) def.performTick(state, agent);
  if (act.type === 'gather' && !state.milestones.firstGather && state.foodStock > beforeStock) {
    state.milestones.firstGather = true;
    pushFirstGather(state, agent);
  }

  act.progress += 1;
  if (act.progress >= act.durationTicks) {
    const hadShelter = state.milestones.builtShelter;
    const hadFire = state.milestones.madeFire;
    if (def.onComplete) def.onComplete(state, agent);
    if (!hadShelter && state.milestones.builtShelter) pushBuild(state, agent, 'shelter');
    if (!hadFire && state.milestones.madeFire) pushBuild(state, agent, 'fire');
    agent.currentAction = null;
  }
}

/** Spawn a nomad once the founder has survived and built shelter (SPEC "נווד"). */
function maybeSpawnNomad(state: WorldState): void {
  if (state.milestones.nomadArrived || state.agents.length >= 2) return;
  if (state.day < NOMAD_MIN_DAY || !state.milestones.builtShelter) return;

  const rng = new Rng(deriveSeed(state.seed, 'nomad'));
  const founder = state.agents[0]!;
  const nomadSex: Sex = founder.sex === 'female' ? 'male' : 'female';
  const names = nomadSex === 'male' ? MALE_NAMES : FEMALE_NAMES;
  const nomad = spawnAgent({
    id: 'a1',
    name: rng.pick(names),
    sex: nomadSex,
    birthDay: state.day - (ADULT_MIN_AGE_DAYS + 12), // already an adult
    position: { x: -(WORLD_HALF - 3), z: rng.range(-8, 8) },
    rng,
  });
  state.agents.push(nomad);
  state.milestones.nomadArrived = true;
  pushNomad(state, nomad);
}

/** Affection fades between agents who didn't interact today. */
function decayRelationships(state: WorldState): void {
  for (const agent of state.agents) {
    if (!agent.alive) continue;
    for (const rel of Object.values(agent.relations)) {
      if (rel.lastInteractionDay < state.day) {
        rel.affection = Math.max(-100, rel.affection - AFFECTION_DECAY_PER_DAY);
      }
    }
  }
}

/** Mutual high affection between two adults forms a partnership. */
function promoteRelationships(state: WorldState): void {
  const living = state.agents.filter((a) => a.alive);
  for (let i = 0; i < living.length; i++) {
    for (let j = i + 1; j < living.length; j++) {
      const a = living[i]!;
      const b = living[j]!;
      const relA = a.relations[b.id];
      const relB = b.relations[a.id];
      if (!relA || !relB || relA.kind === 'partner') continue;
      const adultA = state.day - a.birthDay >= ADULT_MIN_AGE_DAYS;
      const adultB = state.day - b.birthDay >= ADULT_MIN_AGE_DAYS;
      if (
        adultA &&
        adultB &&
        relA.affection >= PARTNER_AFFECTION_THRESHOLD &&
        relB.affection >= PARTNER_AFFECTION_THRESHOLD
      ) {
        relA.kind = 'partner';
        relB.kind = 'partner';
        if (!state.milestones.becamePartners) {
          state.milestones.becamePartners = true;
          pushPartners(state, a, b);
        }
      }
    }
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
    agents: state.agents.map(cloneAgent),
    playerAgentId: state.playerAgentId,
    foodStock: state.foodStock,
    structures: state.structures.map(cloneStructure),
    resources: state.resources.map(cloneResource),
    journal: state.journal.slice(),
    milestones: { ...state.milestones },
    knowledge: cloneKnowledge(state.knowledge),
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
    agents: saved.agents.map(cloneAgent),
    playerAgentId: saved.playerAgentId,
    foodStock: saved.foodStock,
    structures: saved.structures.map(cloneStructure),
    resources: saved.resources.map(cloneResource),
    journal: saved.journal.slice(),
    milestones: { ...saved.milestones },
    knowledge: cloneKnowledge(saved.knowledge),
    terrain: generateTerrain(saved.seed),
  };
}

function cloneRelations(r: Record<string, Relation>): Record<string, Relation> {
  const out: Record<string, Relation> = {};
  for (const [id, rel] of Object.entries(r)) out[id] = { ...rel };
  return out;
}

function cloneAgent(a: Agent): Agent {
  const action = a.currentAction;
  const cloned: Agent = {
    id: a.id,
    name: a.name,
    sex: a.sex,
    birthDay: a.birthDay,
    needs: { ...a.needs },
    health: a.health,
    alive: a.alive,
    traits: { ...a.traits },
    skills: { ...a.skills },
    relations: cloneRelations(a.relations),
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

function cloneKnowledge(k: WorldState['knowledge']): WorldState['knowledge'] {
  return { known: [...k.known], progress: { ...k.progress }, triggers: { ...k.triggers } };
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
    agents: s.agents.map(cloneAgent),
    playerAgentId: s.playerAgentId,
    foodStock: s.foodStock,
    structures: s.structures.map(cloneStructure),
    resources: s.resources.map(cloneResource),
    journal: s.journal.slice(),
    milestones: { ...s.milestones },
    knowledge: cloneKnowledge(s.knowledge),
    terrain: s.terrain, // immutable, seed-derived — safe to share
  };
}
