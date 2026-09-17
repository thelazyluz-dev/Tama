// The journal — the actual content of the game (SPEC "מערכת היומן"). Every
// system writes its entries here in the same commit (CLAUDE.md iron rule).
//
// Text is Hebrew, generated from a template bank + current state, the variant
// chosen through the seeded RNG so runs stay deterministic. The founder is
// female (matching the SPEC's own examples, "נועה מצאה..."); the nomad is male.
//
// This lives in src/sim: pure, no react/three/DOM.

import type { WorldState, Agent, JournalKind, Season, Weather, NeedKey, TechId } from './types';
import { Rng } from './rng';

export const MAX_JOURNAL = 200; // last 200 kept in memory (SPEC)

function add(state: WorldState, kind: JournalKind, weight: 1 | 2 | 3, text: string): void {
  state.journal.push({ day: state.day, hour: state.hour, kind, weight, text });
  while (state.journal.length > MAX_JOURNAL) {
    // Drop the oldest low-weight entry first so weight-3 milestones (births,
    // deaths, discoveries, seasons) survive as a lasting chronicle.
    let idx = state.journal.findIndex((e) => e.weight < 3);
    if (idx === -1) idx = 0;
    state.journal.splice(idx, 1);
  }
}

const SEASON_LINES: Record<Season, string[]> = {
  spring: ['האביב פרץ בעמק. הכל מלבלב מחדש.', 'ריח של אביב. הקור נסוג סוף סוף.'],
  summer: ['הקיץ בשיאו — שפע פירות ולחות חום.', 'ימים ארוכים וחמים. השפע בכל מקום.'],
  autumn: ['הסתיו הגיע. זה הזמן לאגור לפני הקור.', 'העלים מצהיבים. חלון האגירה נפתח.'],
  winter: ['החורף הגיע. הרוח נושכת והלילות ארוכים.', 'יום ראשון של חורף. מי שלא אגר — ירעב.'],
};

const WEATHER_LINES: Partial<Record<Weather, string[]>> = {
  storm: ['סערה מתחוללת בעמק. עדיף למצוא מחסה.', 'רעמים מתגלגלים מעל ההרים.'],
  snow: ['שלג יורד ומכסה את העמק בלבן.', 'פתיתי שלג ראשונים. הקור מעמיק.'],
  rain: ['גשם שוטף יורד על העמק.'],
  heat: ['גל חום כבד יושב על העמק.'],
};

const SURVIVAL_NEEDS: NeedKey[] = ['warmth', 'thirst', 'hunger', 'fatigue', 'safety'];
const TROUBLE_LINES: Partial<Record<NeedKey, string[]>> = {
  warmth: ['הקור חדר לעצמות, אבל היום נגמר.', 'יום קפוא. הרוח לא הרפתה לרגע.'],
  thirst: ['הצמא הכביד, עד שנמצאו מים.', 'יום יבש. הגרון ניחר.'],
  hunger: ['הרעב הציק לאורך כל היום.', 'הבטן קרקרה עד הערב.'],
  fatigue: ['העייפות השתלטה. הגוף דורש שינה.', 'הרגליים כבדו מהיום הארוך.'],
  safety: ['הסערה הפחידה. חיפשה מחסה.', 'יום מסוכן. העמק לא היה שקט.'],
};

const QUIET_LINES = [
  'יום רגוע בעמק. הכל מסופק.',
  'יום שקט. השמש עשתה את שלה.',
  'עוד יום עבר בשלווה על הגבעות.',
  'יום של עבודה. הכפיים עשו את שלהן.',
];

const LONELY_LINES = [
  'יום טוב, אבל בערב שוב הבדידות.',
  'העמק יפה — חבל שאין עם מי לחלוק אותו.',
];

const HARD_LINES = [
  'יום קשה. הבריאות שוחקת והכוחות אוזלים.',
  'יום על הסף. הגוף בקושי מחזיק מעמד.',
];

export function pushSeason(state: WorldState, agent: Agent, rng: Rng): void {
  add(state, 'season', 3, `${agent.name} — ${rng.pick(SEASON_LINES[state.season])}`);
}

export function pushWeather(state: WorldState, agent: Agent, rng: Rng): void {
  const lines = WEATHER_LINES[state.weather];
  if (!lines) return;
  add(state, 'weather', 2, `${agent.name} — ${rng.pick(lines)}`);
}

/** One end-of-day summary reflecting the day's dominant tone. */
export function pushDaySummary(state: WorldState, agent: Agent, rng: Rng): void {
  if (!agent.alive) return;

  if (agent.health < 30) {
    add(state, 'day', 3, `${agent.name} — ${rng.pick(HARD_LINES)}`);
    return;
  }

  let worstKey: NeedKey | null = null;
  let worst = 62;
  for (const key of SURVIVAL_NEEDS) {
    if (agent.needs[key] > worst) {
      worst = agent.needs[key];
      worstKey = key;
    }
  }

  if (worstKey) {
    add(state, 'day', 2, `${agent.name} — ${rng.pick(TROUBLE_LINES[worstKey]!)}`);
  } else if (agent.needs.loneliness > 70) {
    add(state, 'day', 1, `${agent.name} — ${rng.pick(LONELY_LINES)}`);
  } else {
    add(state, 'day', 1, `${agent.name} — ${rng.pick(QUIET_LINES)}`);
  }
}

export function pushBuild(state: WorldState, agent: Agent, type: 'shelter' | 'fire'): void {
  if (type === 'shelter') {
    add(state, 'build', 3, `${agent.name} — סוף סוף יש מחסה. קורת גג ראשונה בעמק.`);
  } else {
    add(state, 'build', 3, `${agent.name} — מדורה נדלקה. חום ואור ראשונים בחשכה.`);
  }
}

export function pushFirstGather(state: WorldState, agent: Agent): void {
  add(state, 'need', 2, `${agent.name} — התחילה לאגור פירות למחסן.`);
}

export function pushCrisis(state: WorldState, agent: Agent): void {
  add(state, 'danger', 3, `${agent.name} — הבריאות במצב מסוכן. חייבים לפעול עכשיו.`);
}

const DEATH_PHRASE: Record<string, string> = {
  קפיאה: 'הקור ניצח.',
  רעב: 'הרעב גבר על הגוף.',
  צמא: 'הצמא הכריע.',
  מחלה: 'המחלה גברה.',
  תשישות: 'הגוף פשוט כבה.',
  זקנה: 'הזקנה עשתה את שלה. חיים מלאים.',
  לידה: 'סיבוכי לידה. אבל הרך נולד.',
};

const DISCOVERY_LINES: Record<TechId, string> = {
  stone_tools: 'גילתה שאבן חדה חותכת ומפצחת. כלי האבן הראשון בעמק — הלקט מהיום קל יותר.',
  fire: 'אחרי הברק, ניסתה שוב ושוב עד שניצוץ תפס. אש! חום ואור בידיים אנושיות, לראשונה.',
  cooking: 'הניחה פרי על הגחלים, והריח שינה הכל. בישול — האוכל מעכשיו משביע הרבה יותר.',
};

export function pushDiscovery(state: WorldState, agent: Agent, tech: TechId): void {
  add(state, 'discovery', 3, `${agent.name} — ${DISCOVERY_LINES[tech]}`);
}

export function pushLightning(state: WorldState, agent: Agent, rng: Rng): void {
  const lines = [
    'ברק חבט בעץ סמוך והצית אותו. היא התבוננה בלהבות זמן רב, נדהמת.',
    'ברק ירד על העמק ועץ עלה באש. משהו בה השתנה למראה החום הרוקד.',
  ];
  add(state, 'danger', 3, `${agent.name} — ${rng.pick(lines)}`);
}

export function pushDeath(state: WorldState, agent: Agent): void {
  const cause = agent.deathCause ?? 'תשישות';
  const phrase = DEATH_PHRASE[cause] ?? 'החיים בעמק תמו.';
  const gone = agent.sex === 'female' ? 'איננה' : 'איננו';
  add(state, 'death', 3, `${agent.name} ${gone}. ${phrase}`);
}

/** A nomad passes through and joins the founder (SPEC "נווד"). */
export function pushNomad(state: WorldState, nomad: Agent): void {
  add(
    state,
    'social',
    3,
    `בעמק עבר נווד בשם ${nomad.name}. הוא נעצר ליד המחנה — כבר לא לבד.`,
  );
}

/** Two agents became a couple (SPEC "זוגיות"). */
export function pushPartners(state: WorldState, a: Agent, b: Agent): void {
  add(state, 'social', 3, `${a.name} ו${b.name} נעשו זוג. העמק כבר לא כל כך בודד.`);
}

/** A child was born (weight 3 — a new generation). */
export function pushBirth(state: WorldState, child: Agent, mother: Agent, father: Agent): void {
  const born = child.sex === 'female' ? 'נולדה' : 'נולד';
  add(
    state,
    'birth',
    3,
    `${born} ${child.name} ל${mother.name} ו${father.name} — הדור ה־${child.generation}.`,
  );
}

/** A child lost part of the knowledge because a parent died too soon. */
export function pushKnowledgeLoss(state: WorldState, child: Agent, parent: Agent): void {
  add(state, 'mood', 2, `${parent.name} מת/ה לפני ש${child.name} למד/ה הכל. חלק מהידע אבד.`);
}

/** The watched life passes to an heir (SPEC "מעבר שליטה"). */
export function pushHandoff(state: WorldState, heir: Agent): void {
  add(state, 'mood', 3, `העדשה עוברת אל ${heir.name}. השושלת ממשיכה.`);
}

// --- Stage 5: the player's interventions (SPEC "מנגנון ההשפעה") -------------
// Every intervention leaves a mark in the journal, so the player's own hand is
// part of the chronicle (CLAUDE.md: a system with no journal text isn't ready).

export function pushSpark(state: WorldState, agent: Agent): void {
  add(state, 'player', 3, `${agent.name} — ניצוץ נפל בעמק כמו מתנה. עכשיו אפשר ללמוד אש.`);
}

export function pushInspiration(state: WorldState, agent: Agent): void {
  add(state, 'player', 2, `${agent.name} — רוח של השראה עברה. המחשבות זרמו והמחקר קפץ קדימה.`);
}

export function pushMedicine(state: WorldState, agent: Agent): void {
  add(state, 'player', 3, `${agent.name} — כוחות חדשים נמזגו ברגע האחרון. הבריאות חוזרת.`);
}
