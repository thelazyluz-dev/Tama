// Helpers for working with the agent roster. Pure; imports only types so both
// the sim and the render/ui layers can use it without cycles.

import type { WorldState, Agent, Relation } from './types';

export function getAgent(state: WorldState, id: string): Agent | undefined {
  return state.agents.find((a) => a.id === id);
}

/** The watched agent (falls back to the first living one). */
export function playerAgent(state: WorldState): Agent {
  return getAgent(state, state.playerAgentId) ?? state.agents.find((a) => a.alive) ?? state.agents[0]!;
}

export function livingAgents(state: WorldState): Agent[] {
  return state.agents.filter((a) => a.alive);
}

/** Nearest living agent other than `self`, or null. */
export function nearestOtherAgent(state: WorldState, self: Agent): Agent | null {
  let best: Agent | null = null;
  let bestDist = Infinity;
  for (const other of state.agents) {
    if (other === self || !other.alive) continue;
    const dx = other.position.x - self.position.x;
    const dz = other.position.z - self.position.z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = other;
    }
  }
  return best;
}

/** Get or create the relation record from `agent` toward `otherId`. */
export function ensureRelation(agent: Agent, otherId: string, day: number): Relation {
  let rel = agent.relations[otherId];
  if (!rel) {
    rel = { affection: 0, trust: 0, kind: 'stranger', lastInteractionDay: day };
    agent.relations[otherId] = rel;
  }
  return rel;
}

/** The agent's partner, if any (a living agent it has kind 'partner' toward). */
export function partnerOf(state: WorldState, agent: Agent): Agent | null {
  for (const [id, rel] of Object.entries(agent.relations)) {
    if (rel.kind === 'partner') {
      const other = getAgent(state, id);
      if (other && other.alive) return other;
    }
  }
  return null;
}
