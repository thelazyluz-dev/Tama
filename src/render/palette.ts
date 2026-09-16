// Visual mapping from sim concepts to colors. Render-only.

import type { ActionId, ResourceType } from '../sim';

/** Capsule tint by the action currently driving the agent. */
export const ACTION_COLOR: Record<ActionId, string> = {
  eat: '#5db85d', // green
  drink: '#4a90d9', // blue
  sleep: '#8e6fd6', // purple
  wander: '#d7dbe0', // pale idle
};

/** Resource node colors (SPEC: blue = water, green = fruit). */
export const RESOURCE_COLOR: Record<ResourceType, string> = {
  water: '#3aa0e0',
  fruit: '#54b04a',
};
