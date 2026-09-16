// Visual mapping from sim concepts to colors. Render-only.

import type { ActionId, ResourceType } from '../sim';

/** Capsule tint by the action currently driving the agent. */
export const ACTION_COLOR: Record<ActionId, string> = {
  eat: '#5db85d', // green
  drink: '#4a90d9', // blue
  sleep: '#8e6fd6', // purple
  wander: '#d7dbe0', // pale idle
  gather: '#c7a33a', // amber — harvesting
  wash: '#3fc4c4', // teal
  warm: '#e07a3a', // ember orange
  buildShelter: '#a9764e', // timber brown
  makeFire: '#e0562f', // fire red
};

/** Resource node colors (SPEC: blue = water, green = fruit). */
export const RESOURCE_COLOR: Record<ResourceType, string> = {
  water: '#3aa0e0',
  fruit: '#54b04a',
};

/** Emoji + short Hebrew label shown in the bubble above the agent. Feminine,
 *  matching the character names. */
export const ACTION_BUBBLE: Record<ActionId, { emoji: string; label: string }> = {
  eat: { emoji: '🍎', label: 'אוכלת' },
  drink: { emoji: '💧', label: 'שותה' },
  sleep: { emoji: '😴', label: 'ישנה' },
  wander: { emoji: '🚶', label: 'משוטטת' },
  gather: { emoji: '🧺', label: 'אוספת' },
  wash: { emoji: '🫧', label: 'מתרחצת' },
  warm: { emoji: '🔥', label: 'מתחממת' },
  buildShelter: { emoji: '🛠️', label: 'בונה מחסה' },
  makeFire: { emoji: '🔥', label: 'מדליקה אש' },
};
