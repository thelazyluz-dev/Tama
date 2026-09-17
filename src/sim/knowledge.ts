// Stage 2 — the generational knowledge tree (SPEC "עץ הידע הדורי"). Discovery
// is gradual: an 'experiment' action accumulates research toward a technology,
// which unlocks at a cost threshold. Some techs also need an environmental
// TRIGGER (fire needs a witnessed lightning storm), turning each discovery into
// a story rather than a line on a tech tree. Pure.

import type { WorldState, Agent, TechId, SkillKey, KnowledgeState, NeedKey } from './types';
import {
  DISCOVERY_RATE,
  SKILL_GAIN_PER_EXPERIMENT,
  EXPERIMENT_COMFORT,
  EXPERIMENT_MIN_HEALTH,
  STONE_TOOLS_GATHER_MULT,
  COOKING_HUNGER_MULT,
  FOOD_STOCK_CAP,
  POTTERY_CAP_MULT,
  SCHOOL_TEACH_MULT,
} from './balance';

export interface Tech {
  id: TechId;
  name: string; // Hebrew, for the journal/UI
  domain: SkillKey;
  cost: number;
  prereqs: TechId[];
  trigger?: keyof KnowledgeState['triggers'];
}

export const TECHS: Record<TechId, Tech> = {
  stone_tools: { id: 'stone_tools', name: 'כלי אבן', domain: 'crafting', cost: 30, prereqs: [] },
  fire: { id: 'fire', name: 'אש', domain: 'firecraft', cost: 62, prereqs: [], trigger: 'lightning' },
  cooking: { id: 'cooking', name: 'בישול', domain: 'firecraft', cost: 46, prereqs: ['fire'] },
  pottery: { id: 'pottery', name: 'קדרות', domain: 'crafting', cost: 40, prereqs: ['stone_tools'] },
  spear: { id: 'spear', name: 'ציד', domain: 'crafting', cost: 58, prereqs: ['stone_tools', 'fire'] },
  agriculture: { id: 'agriculture', name: 'חקלאות', domain: 'foraging', cost: 82, prereqs: ['pottery'] },
  schooling: { id: 'schooling', name: 'בית ספר', domain: 'crafting', cost: 100, prereqs: ['cooking', 'agriculture'] },
};

export const TECH_LIST: readonly Tech[] = [
  TECHS.stone_tools,
  TECHS.fire,
  TECHS.cooking,
  TECHS.pottery,
  TECHS.spear,
  TECHS.agriculture,
  TECHS.schooling,
];

export function isKnown(k: KnowledgeState, id: TechId): boolean {
  return k.known.includes(id);
}

export function fireKnown(state: WorldState): boolean {
  return isKnown(state.knowledge, 'fire');
}

/** Gather yield multiplier from tools. */
export function gatherMultiplier(state: WorldState): number {
  return isKnown(state.knowledge, 'stone_tools') ? STONE_TOOLS_GATHER_MULT : 1;
}

/** Hunger-relief multiplier from cooking (cooked food is more filling). */
export function hungerReliefMultiplier(state: WorldState): number {
  return isKnown(state.knowledge, 'cooking') ? COOKING_HUNGER_MULT : 1;
}

/** Food-store capacity, raised by pottery (a bigger winter larder). */
export function foodCap(state: WorldState): number {
  return isKnown(state.knowledge, 'pottery') ? FOOD_STOCK_CAP * POTTERY_CAP_MULT : FOOD_STOCK_CAP;
}

/** Passive tribe provisions per day from farming (non-winter) and hunting (winter). */
export function agricultureKnown(state: WorldState): boolean {
  return isKnown(state.knowledge, 'agriculture');
}
export function huntingKnown(state: WorldState): boolean {
  return isKnown(state.knowledge, 'spear');
}

/** Knowledge-transfer multiplier from a school (SPEC turning point). */
export function teachMultiplier(state: WorldState): number {
  return isKnown(state.knowledge, 'schooling') ? SCHOOL_TEACH_MULT : 1;
}
export function schoolingKnown(state: WorldState): boolean {
  return isKnown(state.knowledge, 'schooling');
}

/** Techs discoverable right now: unknown, prereqs met, trigger witnessed. */
export function availableTechs(k: KnowledgeState): Tech[] {
  return TECH_LIST.filter((tech) => {
    if (isKnown(k, tech.id)) return false;
    if (!tech.prereqs.every((p) => isKnown(k, p))) return false;
    if (tech.trigger && !k.triggers[tech.trigger]) return false;
    return true;
  });
}

export function hasDiscoverable(state: WorldState): boolean {
  return availableTechs(state.knowledge).length > 0;
}

const SURVIVAL: NeedKey[] = ['hunger', 'thirst', 'warmth', 'fatigue', 'safety'];

/** Only a comfortable, healthy agent has the slack to tinker (SPEC dynamic). */
export function comfortableForResearch(_state: WorldState, agent: Agent): boolean {
  if (agent.health < EXPERIMENT_MIN_HEALTH) return false;
  return SURVIVAL.every((k) => agent.needs[k] < EXPERIMENT_COMFORT);
}

/**
 * One tick of experimenting: raise the relevant skills and push research toward
 * each available tech; returns any techs newly discovered this tick. Mutates.
 */
export function attemptDiscovery(state: WorldState, agent: Agent): TechId[] {
  const discovered: TechId[] = [];
  for (const tech of availableTechs(state.knowledge)) {
    agent.skills[tech.domain] = Math.min(100, agent.skills[tech.domain] + SKILL_GAIN_PER_EXPERIMENT);
    const skillFactor = 0.3 + agent.skills[tech.domain] / 100;
    const rate = agent.traits.curiosity * skillFactor * DISCOVERY_RATE;
    const prog = (state.knowledge.progress[tech.id] ?? 0) + rate;
    state.knowledge.progress[tech.id] = prog;
    if (prog >= tech.cost) {
      state.knowledge.known.push(tech.id);
      discovered.push(tech.id);
    }
  }
  return discovered;
}
