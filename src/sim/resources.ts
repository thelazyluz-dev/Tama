// Resource nodes (water and fruit) scattered deterministically from the seed.
// Stage 0: static and non-depleting — gathering, stock, and depletion arrive
// in stage 1. Pure data.

import { Rng, deriveSeed } from './rng';
import { NUM_WATER, NUM_FRUIT, WORLD_HALF, RESOURCE_MARGIN } from './balance';
import type { ResourceNode, ResourceType } from './types';

/** Scatter resource nodes across the playable area. Deterministic. */
export function generateResources(seed: number): ResourceNode[] {
  const rng = new Rng(deriveSeed(seed, 'resources'));
  const nodes: ResourceNode[] = [];
  const limit = WORLD_HALF - RESOURCE_MARGIN;

  const scatter = (type: ResourceType, count: number): void => {
    for (let i = 0; i < count; i++) {
      nodes.push({
        id: `${type}-${i}`,
        type,
        position: {
          x: rng.range(-limit, limit),
          z: rng.range(-limit, limit),
        },
      });
    }
  };

  scatter('water', NUM_WATER);
  scatter('fruit', NUM_FRUIT);
  return nodes;
}

/** Nearest resource node of a type to a point, or null if none exist. */
export function nearestResource(
  resources: readonly ResourceNode[],
  type: ResourceType,
  from: { x: number; z: number },
): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestDist = Infinity;
  for (const node of resources) {
    if (node.type !== type) continue;
    const dx = node.position.x - from.x;
    const dz = node.position.z - from.z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best;
}
