// Utility AI: every tick the free agent scores each action and picks the
// highest, with hysteresis so it doesn't dither. No decision tree, no state
// machine — just numbers (SPEC "מנוע ההחלטות").

import type { Agent, ActionId, WorldState } from './types';
import { ActionDef, ACTIONS, ACTION_LIST } from './actions';
import { DISTANCE_PENALTY_K, HYSTERESIS, ACTION_CATEGORY, DECISION_NODE_GAP } from './balance';

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Full score for an action given the agent's current state. RNG-free and
 * deterministic. `playerMod` is the priority-slider multiplier for the action's
 * category (stage 5) — the player's first, indirect channel of influence.
 */
export function scoreAction(def: ActionDef, agent: Agent, world: WorldState): number {
  const feasible = def.feasibility(agent, world);
  if (feasible <= 0) return 0;
  const base = def.appeal(agent, world);
  const target = def.scoringTarget(agent, world);
  const dist = distance(agent.position, target);
  const distancePenalty = 1 / (1 + DISTANCE_PENALTY_K * dist);
  const playerMod = world.playerPriorities[ACTION_CATEGORY[def.id]];
  return base * feasible * distancePenalty * playerMod;
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

/**
 * SPEC channel 3 ("צמתים"): when the two best feasible actions score within
 * DECISION_NODE_GAP of each other, the agent is genuinely torn. Read-only —
 * surfaced to the player as a deliberation, never forced. Returns the two
 * tied action ids (best first), or null when the choice is clear.
 */
export function tornChoice(agent: Agent, world: WorldState): [ActionId, ActionId] | null {
  const ranked = ACTION_LIST.map((def) => ({ id: def.id, score: scoreAction(def, agent, world) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (ranked.length < 2) return null;
  const [first, second] = ranked as [{ id: ActionId; score: number }, { id: ActionId; score: number }];
  if (first.score <= 0) return null;
  const gap = (first.score - second.score) / first.score;
  return gap < DECISION_NODE_GAP ? [first.id, second.id] : null;
}
