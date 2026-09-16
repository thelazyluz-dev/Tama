// Resource nodes: water (infinite) and fruit (harvestable quantity that
// regrows outside winter). Deterministic scatter from the seed. Pure data.

import { Rng, deriveSeed } from './rng';
import {
  NUM_WATER,
  NUM_FRUIT,
  WORLD_HALF,
  RESOURCE_MARGIN,
  FRUIT_NODE_CAP,
  FRUIT_START_FRACTION,
  FRUIT_REGROW_PER_DAY,
} from './balance';
import type { ResourceNode, ResourceType, Vec2, Season } from './types';

export function generateResources(seed: number): ResourceNode[] {
  const rng = new Rng(deriveSeed(seed, 'resources'));
  const nodes: ResourceNode[] = [];
  const limit = WORLD_HALF - RESOURCE_MARGIN;

  const scatter = (type: ResourceType, count: number, quantity: number): void => {
    for (let i = 0; i < count; i++) {
      nodes.push({
        id: `${type}-${i}`,
        type,
        position: { x: rng.range(-limit, limit), z: rng.range(-limit, limit) },
        quantity,
      });
    }
  };

  scatter('water', NUM_WATER, 0);
  scatter('fruit', NUM_FRUIT, Math.round(FRUIT_NODE_CAP * FRUIT_START_FRACTION));
  return nodes;
}

/** Nearest resource of a type (water: any; fruit: honours requireStock). */
export function nearestResource(
  resources: readonly ResourceNode[],
  type: ResourceType,
  from: Vec2,
  requireStock = false,
): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestDist = Infinity;
  for (const node of resources) {
    if (node.type !== type) continue;
    if (requireStock && node.quantity <= 0) continue;
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

/** Total harvestable fruit currently on the map. */
export function totalFruit(resources: readonly ResourceNode[]): number {
  let sum = 0;
  for (const node of resources) if (node.type === 'fruit') sum += node.quantity;
  return sum;
}

/** Daily regrowth — fruit recovers except in winter. Mutates in place. */
export function regrowResources(resources: ResourceNode[], season: Season): void {
  if (season === 'winter') return;
  for (const node of resources) {
    if (node.type !== 'fruit') continue;
    node.quantity = Math.min(FRUIT_NODE_CAP, node.quantity + FRUIT_REGROW_PER_DAY);
  }
}
