// Hebrew game text and formatting helpers (CLAUDE.md: game text in Hebrew,
// code comments in English). Gender-neutral phrasing for the live HUD; the
// journal itself (src/sim/events.ts) uses the SPEC's feminine voice.

import type { Agent, NeedKey, Season, Weather, TechId } from '../sim';
import { TICKS_PER_HOUR } from '../sim';

export const TECH_LABEL: Record<TechId, { emoji: string; name: string }> = {
  stone_tools: { emoji: '🔪', name: 'כלי אבן' },
  fire: { emoji: '🔥', name: 'אש' },
  cooking: { emoji: '🍳', name: 'בישול' },
};

export const NEED_LABEL: Record<NeedKey, string> = {
  hunger: 'רעב',
  thirst: 'צמא',
  fatigue: 'עייפות',
  warmth: 'קור',
  hygiene: 'ניקיון',
  loneliness: 'בדידות',
  boredom: 'שעמום',
  safety: 'ביטחון',
};

export const SEASON_LABEL: Record<Season, string> = {
  spring: 'אביב',
  summer: 'קיץ',
  autumn: 'סתיו',
  winter: 'חורף',
};

export const SEASON_EMOJI: Record<Season, string> = {
  spring: '🌱',
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
};

export const WEATHER_LABEL: Record<Weather, string> = {
  clear: 'בהיר',
  rain: 'גשם',
  storm: 'סערה',
  snow: 'שלג',
  heat: 'חום כבד',
};

/** Short description of what the agent is doing right now. */
export function actionText(agent: Agent): string {
  const action = agent.currentAction;
  if (!action) return '—';
  const arrived = action.inRange;
  switch (action.type) {
    case 'sleep':
      return 'שינה';
    case 'wander':
      return 'שיטוט';
    case 'drink':
      return arrived ? 'שתייה' : 'בדרך למים';
    case 'eat':
      return 'אכילה';
    case 'gather':
      return arrived ? 'איסוף פירות' : 'בדרך ללקט';
    case 'wash':
      return arrived ? 'רחצה' : 'בדרך למים';
    case 'warm':
      return arrived ? 'התחממות' : 'בדרך למדורה';
    case 'buildShelter':
      return arrived ? 'בניית מחסה' : 'בדרך לאתר הבנייה';
    case 'makeFire':
      return arrived ? 'הדלקת מדורה' : 'בדרך למדורה';
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

/** Colour for the health bar: red when low, green when full (opposite sense). */
export function healthColor(value: number): string {
  const hue = 120 * (Math.min(100, Math.max(0, value)) / 100);
  return `hsl(${hue.toFixed(0)}, 70%, 45%)`;
}
