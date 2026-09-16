// Hebrew game text and formatting helpers (CLAUDE.md: game text in Hebrew,
// code comments in English). Gender-neutral phrasing throughout — the stage-0
// agent has no sex yet.

import type { Agent, NeedKey } from '../sim';
import { TICKS_PER_HOUR } from '../sim';

export const NEED_LABEL: Record<NeedKey, string> = {
  hunger: 'רעב',
  thirst: 'צמא',
  fatigue: 'עייפות',
};

/** Short description of what the agent is doing right now. */
export function actionText(agent: Agent): string {
  const action = agent.currentAction;
  if (!action) return '—';
  switch (action.type) {
    case 'sleep':
      return 'שינה';
    case 'wander':
      return 'שיטוט';
    case 'drink':
      return action.inRange ? 'שתייה' : 'בדרך למים';
    case 'eat':
      return action.inRange ? 'אכילה' : 'בדרך לאוכל';
    default:
      return '—';
  }
}

/** "יום 3 · 14:30" */
export function clockText(day: number, tick: number): string {
  const hour = Math.floor((tick % (TICKS_PER_HOUR * 24)) / TICKS_PER_HOUR);
  const minute = Math.floor(((tick % TICKS_PER_HOUR) / TICKS_PER_HOUR) * 60);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `יום ${day + 1} · ${hh}:${mm}`;
}

function plural(n: number, one: string, many: string): string {
  if (n === 1) return one;
  return `${n} ${many}`;
}

/** "עברו 3 ימים ו־7 שעות" — the return-screen headline. */
export function elapsedText(days: number, hours: number): string {
  const dayPart = plural(days, 'יום אחד', 'ימים');
  const hourPart = plural(hours, 'שעה אחת', 'שעות');

  if (days === 0 && hours === 0) return 'עבר רגע קט';
  if (days === 0) return `עברו ${hourPart}`;
  if (hours === 0) return `עברו ${dayPart}`;
  return `עברו ${dayPart} ו־${hourPart}`;
}

/** Colour for a need bar: green when satisfied (0), red at full distress (100). */
export function needColor(value: number): string {
  const hue = 120 * (1 - Math.min(100, Math.max(0, value)) / 100);
  return `hsl(${hue.toFixed(0)}, 65%, 45%)`;
}
