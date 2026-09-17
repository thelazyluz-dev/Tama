// Stage 5 — the player's shop of interventions (SPEC "מנגנון ההשפעה של השחקן",
// channel 2). Each item buys an OPPORTUNITY, never bread: a spark that opens the
// path to fire, a burst of inspiration, a wandering newcomer for a stalled
// lineage, or a last-moment rescue in a crisis. Pure: no react/three/DOM.
//
// Interventions mutate the WorldState they are handed (the store clones first)
// and always leave a journal line, so the player's own hand is part of the
// chronicle (CLAUDE.md: a system with no journal text isn't ready). They never
// touch rngState — anything random is derived from the seed — so the live
// simulation stays deterministic across an intervention.

import type { WorldState, Agent, PriorityCategory } from './types';
import { availableTechs, fireKnown } from './knowledge';
import { playerAgent, livingAgents } from './agents';
import { newcomerCandidate, summonNewcomer } from './world';
import { pushSpark, pushInspiration, pushMedicine } from './events';
import {
  PRIORITY_MIN,
  PRIORITY_MAX,
  COST_SPARK,
  COST_INSPIRATION,
  COST_NEWCOMER,
  COST_MEDICINE,
  INSPIRATION_PROGRESS,
  MEDICINE_HEAL,
  HEALTH_START,
  CRISIS_HEALTH,
} from './balance';

export type InterventionId = 'spark' | 'inspiration' | 'newcomer' | 'medicine';

export interface ShopItem {
  id: InterventionId;
  name: string; // Hebrew
  desc: string; // Hebrew — the opportunity it buys
  cost: number;
  category: PriorityCategory | 'rescue';
  /** True when the item would actually do something right now (else dimmed). */
  available(state: WorldState): boolean;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: 'spark',
    name: 'ניצוץ',
    desc: 'ברק מכוון: פותח את הדרך לגלות אש, בלי לחכות לסערה.',
    cost: COST_SPARK,
    category: 'research',
    available: (s) => !fireKnown(s) && !s.knowledge.triggers.lightning,
  },
  {
    id: 'inspiration',
    name: 'השראה',
    desc: 'רגע של בהירות: קפיצת מחקר לעבר הגילוי הבא.',
    cost: COST_INSPIRATION,
    category: 'research',
    available: (s) => availableTechs(s.knowledge).length > 0,
  },
  {
    id: 'newcomer',
    name: 'נווד',
    desc: 'נווד עובר בעמק — הזדמנות לבן/בת זוג לשושלת שנשארה לבד.',
    cost: COST_NEWCOMER,
    category: 'social',
    available: (s) => newcomerCandidate(s) !== null,
  },
  {
    id: 'medicine',
    name: 'הצלה',
    desc: 'כוחות ברגע האחרון — פעיל רק כשמישהו במשבר בריאותי.',
    cost: COST_MEDICINE,
    category: 'rescue',
    available: (s) => livingAgents(s).some((a) => a.health < CRISIS_HEALTH),
  },
];

/** The living agent in the deepest health crisis, or null. */
function crisisAgent(state: WorldState): Agent | null {
  let worst: Agent | null = null;
  for (const a of livingAgents(state)) {
    if (a.health < CRISIS_HEALTH && (!worst || a.health < worst.health)) worst = a;
  }
  return worst;
}

/**
 * Apply an intervention to `state` (mutates — the store passes a clone). Spends
 * points and writes a journal line on success; returns false with no change
 * when the item is unaffordable or not currently applicable.
 */
export function applyIntervention(state: WorldState, id: InterventionId): boolean {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item || state.playerPoints < item.cost || !item.available(state)) return false;

  switch (id) {
    case 'spark': {
      state.knowledge.triggers.lightning = true;
      pushSpark(state, playerAgent(state));
      break;
    }
    case 'inspiration': {
      const tech = availableTechs(state.knowledge)[0];
      if (!tech) return false;
      state.knowledge.progress[tech.id] =
        (state.knowledge.progress[tech.id] ?? 0) + INSPIRATION_PROGRESS;
      pushInspiration(state, playerAgent(state));
      break;
    }
    case 'newcomer': {
      if (!summonNewcomer(state)) return false; // pushes its own journal line
      break;
    }
    case 'medicine': {
      const patient = crisisAgent(state);
      if (!patient) return false;
      patient.health = Math.min(HEALTH_START, patient.health + MEDICINE_HEAL);
      pushMedicine(state, patient);
      break;
    }
  }

  state.playerPoints -= item.cost;
  return true;
}

/** Clamp a priority slider to the allowed range (SPEC ×0.5..×2). */
export function clampPriority(v: number): number {
  return Math.min(PRIORITY_MAX, Math.max(PRIORITY_MIN, v));
}

/** Whether any living agent is in a health crisis (drives the alert UI). */
export function crisisActive(state: WorldState): boolean {
  return livingAgents(state).some((a) => a.health < CRISIS_HEALTH);
}
