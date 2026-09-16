// Utility AI: every tick the free agent scores each action and picks the
// highest, with hysteresis so it doesn't dither. No decision tree, no state
// machine — just numbers (SPEC "מנוע ההחלטות").

import type { Agent, WorldState } from './types';
import { ActionDef, ACTIONS, ACTION_LIST } from './actions';
import { DISTANCE_PENALTY_K, HYSTERESIS } from './balance';

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Full score for an action given the agent's current state. RNG-free and
 * deterministic. Stage 0 has no traits or player priorities, so those factors
 * (traitMod, playerMod) are 1 and folded out for now — the structure stays
 * ready for later stages.
 */
export function scoreAction(def: ActionDef, agent: Agent, world: WorldState): number {
  const feasible = def.feasibility(agent, world);
  if (feasible <= 0) return 0;
  const base = def.appeal(agent, world);
  const target = def.scoringTarget(agent, world);
  const dist = distance(agent.position, target);
  const distancePenalty = 1 / (1 + DISTANCE_PENALTY_K * dist);
  return base * feasible * distancePenalty;
}

export interface Decision {
  best: ActionDef;
  bestScore: number;
  /** All scores, ordered like ACTION_LIST — handy for debugging/inspection. */
  scores: number[];
}

/**
 * Pick the highest-scoring action. If the agent already has an active action,
 * a challenger must beat it by at least HYSTERESIS (25%) to take over.
 * Deterministic tie-break: earliest in ACTION_LIST wins.
 */
export function decide(agent: Agent, world: WorldState): Decision {
  const scores = ACTION_LIST.map((def) => scoreAction(def, agent, world));

  let best = ACTION_LIST[0]!;
  let bestScore = scores[0]!;
  for (let i = 1; i < ACTION_LIST.length; i++) {
    if (scores[i]! > bestScore) {
      bestScore = scores[i]!;
      best = ACTION_LIST[i]!;
    }
  }

  const active = agent.currentAction;
  if (active) {
    const activeDef = ACTIONS[active.type];
    const activeScore = scoreAction(activeDef, agent, world);
    // Keep the active action unless the challenger clearly wins.
    if (best.id !== active.type && bestScore < activeScore * HYSTERESIS) {
      return { best: activeDef, bestScore: activeScore, scores };
    }
  }

  return { best, bestScore, scores };
}
