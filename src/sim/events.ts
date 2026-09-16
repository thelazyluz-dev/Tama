// The journal — the actual content of the game (SPEC "מערכת היומן"). Every
// system writes its entries here in the same commit (CLAUDE.md iron rule).
//
// Text is Hebrew, generated from a template bank + current state, with the
// variant chosen through the seeded RNG so runs stay deterministic. Feminine
// phrasing throughout, matching the SPEC's own examples ("נועה מצאה...").
//
// This lives in src/sim: pure, no react/three/DOM.

import type { WorldState, JournalKind, Season, Weather, NeedKey } from './types';
import { Rng } from './rng';

export const MAX_JOURNAL = 200; // last 200 kept in memory (SPEC)

function add(state: WorldState, kind: JournalKind, weight: 1 | 2 | 3, text: string): void {
  state.journal.push({ day: state.day, hour: state.hour, kind, weight, text });
  if (state.journal.length > MAX_JOURNAL) {
    state.journal.splice(0, state.journal.length - MAX_JOURNAL);
  }
}

const SEASON_LINES: Record<Season, string[]> = {
  spring: [
    'האביב פרץ בעמק. הכל מלבלב מחדש.',
    'ריח של אביב. הקור נסוג סוף סוף.',
  ],
  summer: [
    'הקיץ בשיאו — שפע פירות ולחות חום.',
    'ימים ארוכים וחמים. השפע בכל מקום.',
  ],
  autumn: [
    'הסתיו הגיע. זה הזמן לאגור לפני הקור.',
    'העלים מצהיבים. חלון האגירה נפתח.',
  ],
  winter: [
    'החורף הגיע. הרוח נושכת והלילות ארוכים.',
    'יום ראשון של חורף. מי שלא אגר — ירעב.',
  ],
};

const WEATHER_LINES: Partial<Record<Weather, string[]>> = {
  storm: ['סערה מתחוללת בעמק. עדיף למצוא מחסה.', 'רעמים מתגלגלים מעל ההרים.'],
  snow: ['שלג יורד ומכסה את העמק בלבן.', 'פתיתי שלג ראשונים. הקור מעמיק.'],
  rain: ['גשם שוטף יורד על העמק.'],
  heat: ['גל חום כבד יושב על העמק.'],
};

const NEED_TROUBLE: Partial<Record<NeedKey, string>> = {
  hunger: 'הרעב מציק',
  thirst: 'הצמא מכביד',
  fatigue: 'העייפות משתלטת',
  warmth: 'הקור חודר לעצמות',
  hygiene: 'הליכלוך מטריד',
  loneliness: 'הבדידות מכרסמת',
  boredom: 'השעמום מעיק',
  safety: 'תחושת סכנה באוויר',
};

/** Season rollover line (weight 3 — belongs in any summary). */
export function pushSeason(state: WorldState, rng: Rng): void {
  const name = state.agent.name;
  add(state, 'season', 3, `${name} — ${rng.pick(SEASON_LINES[state.season])}`);
}

/** Notable weather change (calm weather isn't worth a line). */
export function pushWeather(state: WorldState, rng: Rng): void {
  const lines = WEATHER_LINES[state.weather];
  if (!lines) return;
  add(state, 'weather', 2, `${state.agent.name} — ${rng.pick(lines)}`);
}

/** One end-of-day summary reflecting the day's dominant tone. */
export function pushDaySummary(state: WorldState, rng: Rng): void {
  const a = state.agent;
  if (!a.alive) return;

  if (a.health < 30) {
    add(state, 'day', 3, `${a.name} — יום קשה. הבריאות שוחקת והכוחות אוזלים.`);
    return;
  }

  // Worst-offending need this moment.
  let worstKey: NeedKey | null = null;
  let worst = 60; // only mention needs that are genuinely pressing
  for (const key of Object.keys(NEED_TROUBLE) as NeedKey[]) {
    if (a.needs[key] > worst) {
      worst = a.needs[key];
      worstKey = key;
    }
  }

  if (worstKey) {
    add(state, 'day', 2, `${a.name} — ${NEED_TROUBLE[worstKey]}, אבל היום עבר.`);
  } else {
    const calm = [
      'יום רגוע בעמק. הכל מסופק.',
      'יום שקט. השמש עשתה את שלה.',
      'עוד יום עבר בשלווה על הגבעות.',
    ];
    add(state, 'day', 1, `${a.name} — ${rng.pick(calm)}`);
  }
}

/** Built a shelter / lit a fire (weight 3 — a real milestone). */
export function pushBuild(state: WorldState, type: 'shelter' | 'fire'): void {
  const name = state.agent.name;
  if (type === 'shelter') {
    add(state, 'build', 3, `${name} — סוף סוף יש מחסה. קורת גג ראשונה בעמק.`);
  } else {
    add(state, 'build', 3, `${name} — מדורה נדלקה. חום ואור ראשונים בחשכה.`);
  }
}

/** First time filling the store. */
export function pushFirstGather(state: WorldState): void {
  add(state, 'need', 2, `${state.agent.name} — התחילה לאגור פירות למחסן.`);
}

/** Health crossed into crisis. */
export function pushCrisis(state: WorldState): void {
  add(state, 'danger', 3, `${state.agent.name} — הבריאות במצב מסוכן. חייבים לפעול עכשיו.`);
}

const DEATH_PHRASE: Record<string, string> = {
  קפיאה: 'הקור ניצח.',
  רעב: 'הרעב גבר על הגוף.',
  צמא: 'הצמא הכריע.',
  מחלה: 'המחלה גברה.',
  תשישות: 'הגוף פשוט כבה.',
};

/** Death entry (weight 3). */
export function pushDeath(state: WorldState): void {
  const a = state.agent;
  const cause = a.deathCause ?? 'תשישות';
  const phrase = DEATH_PHRASE[cause] ?? 'החיים בעמק תמו.';
  add(state, 'death', 3, `${a.name} איננה. ${phrase} (חורף ${state.milestones.survivedWinters}).`);
}
