// ALL balance numbers live here — never scatter tuning constants through the
// code (CLAUDE.md rule). When you change a number here, run `npm run test:sim`
// and compare the printed before/after stats.

import type { ActionId, NeedKey, PriorityCategory, Season, Weather } from './types';

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------
// SPEC time model, taking the precise sub-clause "דקת אמת = שעת משחק"
// (1 real minute = 1 game hour) as authoritative:
//   tick        = 6 game minutes
//   1 game hour = 10 ticks
//   1 game day  = 24 game hours = 240 ticks
//   1 real min  = 1 game hour   => 1 tick = 6 real seconds at ×1 speed
export const GAME_MINUTES_PER_TICK = 6;
export const TICKS_PER_HOUR = 60 / GAME_MINUTES_PER_TICK; // 10
export const HOURS_PER_DAY = 24;
export const TICKS_PER_DAY = TICKS_PER_HOUR * HOURS_PER_DAY; // 240

// Real time -> ticks. 1 real minute == 1 game hour == TICKS_PER_HOUR ticks.
export const REAL_MS_PER_TICK = 60_000 / TICKS_PER_HOUR; // 6000 ms at ×1

// Offline catch-up ceiling (SPEC: max 14 game days simulated in full).
export const MAX_CATCHUP_DAYS = 14;
export const MAX_CATCHUP_TICKS = MAX_CATCHUP_DAYS * TICKS_PER_DAY;

// In-game speed multipliers (SPEC: ×1 / ×5 / ×20 view buttons).
export const SPEED_STEPS = [1, 5, 20] as const;

// A new life starts in the morning, not at pitch-black midnight.
export const START_HOUR = 7;

// ---------------------------------------------------------------------------
// Seasons & years (SPEC: 4 seasons = 1 game year ≈ 60 real hours)
// ---------------------------------------------------------------------------
// 38 game days/season ≈ 15 real hours/season; year ≈ 152 days ≈ 61 real hours.
export const SEASON_DAYS = 38;
export const YEAR_DAYS = SEASON_DAYS * 4;
// Order matters: the game starts in spring, so the first winter is ~3 seasons in.
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

// ---------------------------------------------------------------------------
// Terrain & map
// ---------------------------------------------------------------------------
export const TERRAIN_SIZE = 64; // 64×64 heightmap
export const WORLD_HALF = TERRAIN_SIZE / 2; // 32
export const TERRAIN_NOISE_SCALE = 0.06;
export const TERRAIN_HEIGHT = 6;

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------
export const NUM_WATER = 5;
export const NUM_FRUIT = 10;
export const RESOURCE_MARGIN = 6;
// Fruit nodes hold a quantity that regrows outside winter; winter yields none.
export const FRUIT_NODE_CAP = 20;
export const FRUIT_REGROW_PER_DAY = 6; // per node, spring/summer/autumn
export const FRUIT_START_FRACTION = 0.6;

// ---------------------------------------------------------------------------
// Needs — decay is PER GAME DAY (= per real hour). 0 = satisfied, 100 =
// full distress (SPEC "צרכים והישרדות"). warmth & safety are computed
// dynamically (season/weather/structures), so they are not in this table.
// ---------------------------------------------------------------------------
export const NEED_DECAY_PER_DAY: Record<Exclude<NeedKey, 'warmth' | 'safety'>, number> = {
  hunger: 45,
  thirst: 100,
  fatigue: 60,
  hygiene: 20,
  loneliness: 12,
  boredom: 25,
};

export const NEED_START: Record<NeedKey, number> = {
  hunger: 15,
  thirst: 15,
  fatigue: 10,
  warmth: 18,
  hygiene: 10,
  loneliness: 10,
  boredom: 12,
  safety: 6,
};

// The needs shown as bars, in display order.
export const NEED_KEYS: readonly NeedKey[] = [
  'hunger',
  'thirst',
  'fatigue',
  'warmth',
  'hygiene',
  'loneliness',
  'boredom',
  'safety',
];

// Warmth ("cold") pressure per game day. NEGATIVE in mild seasons (a clothed
// body stays warm on its own), strongly POSITIVE only in winter — so a fire is
// a winter necessity, not an everyday one. Winter is the killer.
export const WARMTH_DECAY_BY_SEASON: Record<Season, number> = {
  spring: -10,
  summer: -20,
  autumn: -4,
  winter: 58,
};
// Weather adds to warmth pressure (snow/storm colder; heat warms you up).
export const WARMTH_DECAY_BY_WEATHER: Record<Weather, number> = {
  clear: 0,
  rain: 4,
  storm: 8,
  snow: 16,
  heat: -18,
};

// Safety: threat rises with bad weather, relieved by shelter proximity.
export const SAFETY_THREAT_BY_WEATHER: Record<Weather, number> = {
  clear: 2,
  rain: 8,
  storm: 40,
  snow: 22,
  heat: 6,
};
export const SAFETY_RELIEF_IN_SHELTER = 55; // per day, when near shelter
export const SAFETY_DECAY_BASE = 6; // baseline drift toward calm per day

// ---------------------------------------------------------------------------
// Health & death (SPEC "בריאות ומוות") — stage 0 had none.
// ---------------------------------------------------------------------------
export const HEALTH_START = 100;
export const HEALTH_MIN = 0;
// A need above this threshold starts damaging health, scaling to full at 100.
export const HEALTH_DAMAGE_THRESHOLD = 78;
// Health damage per game day when the need is pinned at 100. Hygiene is a
// disease-RISK multiplier in the SPEC, not direct damage, and disease is a
// later system — so it does not appear here.
export const HEALTH_DAMAGE_PER_DAY: Partial<Record<NeedKey, number>> = {
  thirst: 15,
  hunger: 8,
  warmth: 12,
  fatigue: 2,
};
// Cause label priority when several needs are hurting at once.
export const DEATH_CAUSE_BY_NEED: Partial<Record<NeedKey, string>> = {
  thirst: 'צמא',
  hunger: 'רעב',
  warmth: 'קפיאה',
  hygiene: 'מחלה',
  fatigue: 'תשישות',
};
// Regen when the survival needs are all comfortable.
export const HEALTH_REGEN_PER_DAY = 6;
export const HEALTH_COMFORT_THRESHOLD = 55; // thirst/hunger/warmth all below this
// Death-spiral guards (SPEC risk "ספירלת מוות").
export const HEALTH_MAX_DAMAGE_PER_DAY = 45; // floor: no free-fall
export const YOUTH_GRACE_DAYS = 8; // early life takes half damage
export const YOUTH_GRACE_FACTOR = 0.5;
export const CRISIS_HEALTH = 30; // below this = crisis (journal warning)

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------
export const MOVE_SPEED = 1.6;
export const ARRIVE_RADIUS = 0.9;

// ---------------------------------------------------------------------------
// Food stock (SPEC: autumn is the storage window; winter lives off the store)
// ---------------------------------------------------------------------------
// A full winter (~38 days) with no gathering must be survivable from the store.
export const FOOD_STOCK_CAP = 360;
export const EAT_FROM_STOCK = 7; // food units consumed per eat
export const HUNGER_PER_FOOD = 6; // hunger relieved per food unit eaten
export const GATHER_RATE = 2.5; // food units gathered per performing tick

// ---------------------------------------------------------------------------
// Structures — shelter (passive) and fire (active warmth, burns fuel)
// ---------------------------------------------------------------------------
export const SHELTER_WARMTH_DECAY_FACTOR = 0.45; // warmth decays slower near shelter
export const SHELTER_RADIUS = 5;
export const FIRE_RADIUS = 4.5;
export const FIRE_FUEL_START = 100;
export const FIRE_FUEL_BURN_PER_DAY = 40; // a fire left alone dies in ~2.5 days
export const FIRE_FUEL_PER_MAKE = 100; // making/tending a fire refuels it

// ---------------------------------------------------------------------------
// Actions — durations (ticks performing once in range). effect = per-tick need
// deltas while performing (negative relieves). Overshoot clamped in world.ts.
// ---------------------------------------------------------------------------
export const ACTION = {
  eat: { durationTicks: 4, effect: {} },
  drink: { durationTicks: 3, effect: { thirst: -45 } },
  sleep: { durationTicks: 80, effect: { fatigue: -1.7 } },
  wash: { durationTicks: 6, effect: { hygiene: -22 } },
  warm: { durationTicks: 8, effect: { warmth: -20 } },
  gather: { durationTicks: 8, effect: {} },
  buildShelter: { durationTicks: 60, effect: {} },
  makeFire: { durationTicks: 16, effect: {} },
  experiment: { durationTicks: 14, effect: { boredom: -8 } },
  socialize: { durationTicks: 12, effect: {} },
  wander: { durationTicks: 12, effect: { boredom: -30 } },
} as const;

// ---------------------------------------------------------------------------
// Utility AI (SPEC "מנוע ההחלטות") — needs enter appeal SQUARED.
// ---------------------------------------------------------------------------
export const THIRST_APPEAL_MULT = 1.3;
export const WANDER_APPEAL = 0.14;

export const NIGHT_SLEEP_BONUS = 1.6;
export const DAY_SLEEP_BONUS = 0.5;
export const NIGHT_START_HOUR = 21;
export const NIGHT_END_HOUR = 6;

// Proactive prep: gather to fill the store, build shelter, keep a fire going.
// These are what let a sensible agent survive winter. A "reactive" AI profile
// (used to model a neglected agent in the test) suppresses them.
export const GATHER_STOCK_APPEAL = 0.55; // scaled by (1 - stock/cap)
export const GATHER_AUTUMN_BONUS = 1.8; // storage window
export const GATHER_WINTER_FACTOR = 0.0; // no fruit in winter
export const BUILD_SHELTER_APPEAL = 0.5;
export const MAKE_FIRE_APPEAL = 0.5;
export const WINTER_PREP_BONUS = 2.2; // shelter/fire matter far more as cold looms

export const DISTANCE_PENALTY_K = 0.04;
export const HYSTERESIS = 1.25;

// Efficiency: loneliness and boredom sap effectiveness (SPEC: loneliness ×0.6).
export const LONELINESS_EFFICIENCY_PENALTY = 0.4; // at loneliness 100
export const BOREDOM_EFFICIENCY_PENALTY = 0.15; // at boredom 100
export const MIN_EFFICIENCY = 0.5;

// ---------------------------------------------------------------------------
// Stage 2 — knowledge & discovery (SPEC "עץ הידע הדורי")
// ---------------------------------------------------------------------------
export const TRAIT_KEYS = [
  'curiosity',
  'diligence',
  'sociability',
  'courage',
  'temper',
  'constitution',
] as const;
export const SKILL_KEYS = ['foraging', 'crafting', 'firecraft'] as const;
export const SKILL_START = 8; // small base so discovery can begin

// Discovery: progress per experiment tick = curiosity·(0.3+skill/100)·RATE.
// Discovery only happens when needs are met (SPEC: surplus -> progress).
export const DISCOVERY_RATE = 0.9;
export const SKILL_GAIN_PER_EXPERIMENT = 0.18; // per performing tick, in the domain
export const SKILL_GAIN_PER_GATHER = 0.05; // foraging grows with practice
export const EXPERIMENT_COMFORT = 45; // survival needs must be below this
export const EXPERIMENT_MIN_HEALTH = 60;
export const EXPERIMENT_APPEAL = 0.95; // scales curiosity into a comparable score

// A lightning strike (fire's environmental trigger) can occur on a storm day.
export const LIGHTNING_CHANCE_PER_STORM_DAY = 0.45;

// Tech effects.
export const STONE_TOOLS_GATHER_MULT = 1.5; // gather yield once known
export const COOKING_HUNGER_MULT = 1.45; // cooked food is more filling

// ---------------------------------------------------------------------------
// Stage 3 — the second (nomad, relationships, courtship)
// ---------------------------------------------------------------------------
// A nomad of the opposite sex passes through once the founder has survived and
// built shelter (SPEC preferred solution to "the lone-agent problem").
export const NOMAD_MIN_DAY = 20;

// Loneliness: a partner eases it passively; socialising relieves it actively.
export const LONELINESS_PARTNER_FACTOR = 0.28; // decay multiplier with a partner

// Courtship: affection rises from time spent together, decays when apart, and
// a partnership forms past the threshold (SPEC "חיזור וזוגיות").
export const AFFECTION_GAIN_PER_TICK = 0.7;
export const TRUST_GAIN_PER_TICK = 0.5;
export const AFFECTION_DECAY_PER_DAY = 2.5;
export const PARTNER_AFFECTION_THRESHOLD = 70;
export const SOCIALIZE_APPEAL = 0.7; // scaled by loneliness + sociability
export const SOCIALIZE_LONELINESS_RELIEF = -15; // per tick while together
export const ADULT_MIN_AGE_DAYS = 15; // fertile/adult (SPEC childhood table)

// ---------------------------------------------------------------------------
// Stage 4 — generations. Lifespans are COMPRESSED (game days, not the SPEC's
// realistic years) so a valley turns over generations in a playable span:
// with offline time (1 real min = 1 game hour) a night away advances one.
// ---------------------------------------------------------------------------
export const CHILD_HELPER_AGE_DAYS = 9; // may gather/help (SPEC 9-14)
export const TEACHING_AGE_MIN = 9;
export const TEACHING_AGE_MAX = 14;
export const SKILL_TEACH_PER_TICK = 0.12; // a child near a parent learns

export const FERTILE_MIN_AGE_DAYS = ADULT_MIN_AGE_DAYS;
export const FERTILE_MAX_AGE_DAYS = 45;
export const PREGNANCY_DAYS = 8;
export const CONCEPTION_CHANCE_PER_DAY = 0.42; // partners, fertile
export const BIRTH_RISK = 0.02; // maternal mortality
// Self-regulating population: fertility scales toward zero as the living tribe
// nears this size — prevents both extinction and unbounded growth (SPEC caps
// the object budget ~20).
export const POP_SOFT_CAP = 12;
export const TRAIT_MUTATION = 0.15; // ±15% (SPEC)

export const OLD_AGE_START_DAYS = 46; // death chance begins to ramp
export const MAX_AGE_DAYS = 64; // near-certain death by here

// A wandering nomad arrives when a lone unpartnered adult has no eligible mate
// in the tribe, no more than once per this many days (keeps lineages going).
export const NOMAD_COOLDOWN_DAYS = 12;

// ---------------------------------------------------------------------------
// Stage 5 — the player (SPEC "מנגנון ההשפעה של השחקן"). Three indirect channels
// only: priority sliders (a playerMod on appeal), a point economy, and a small
// shop of interventions. The character stays autonomous — the player nudges.
// ---------------------------------------------------------------------------
// Priority sliders multiply the appeal of every action in a category. Capped at
// ×2 so it never becomes direct control (SPEC), floored at ×0.5 so the player
// can de-emphasise without switching a whole category off.
export const PRIORITY_MIN = 0.5;
export const PRIORITY_MAX = 2;
export const PRIORITY_DEFAULT = 1;

// Which priority category each action answers to (the four SPEC sliders).
export const ACTION_CATEGORY: Record<ActionId, PriorityCategory> = {
  eat: 'survival',
  drink: 'survival',
  sleep: 'survival',
  wash: 'survival',
  warm: 'survival',
  wander: 'survival',
  gather: 'survival',
  buildShelter: 'building',
  makeFire: 'building',
  experiment: 'research',
  socialize: 'social',
};

// A decision node: when the top two actions score within this fraction of each
// other the character is genuinely torn (SPEC channel 3 — shown, not forced).
export const DECISION_NODE_GAP = 0.1;

// Point economy (SPEC "כלכלת הניקוד"). Points are the PLAYER's, cross
// generations, and are earned by showing up + achievements. THE RULE: points
// never buy food — only opportunities. A small starting purse to try the shop.
export const POINTS_START = 4;
export const POINTS_PER_DAY = 1; // daily presence (kept small — no idle reward)
export const POINTS_DISCOVERY = 20; // a first technology
export const POINTS_GENERATION = 30; // a new generation is reached
export const POINTS_WINTER = 15; // survived another winter
export const POINTS_STRUCTURE = 10; // shelter / fire (first of each)
export const POINTS_PARTNERSHIP = 12; // a couple formed

// The shop — each item buys an OPPORTUNITY, never bread (SPEC hard rule).
export const COST_SPARK = 8; // enables discovering fire (skips waiting for a storm)
export const COST_INSPIRATION = 12; // a burst of research toward the next tech
export const COST_NEWCOMER = 22; // summon a wanderer so a lone lineage can continue
export const COST_MEDICINE = 16; // rescue the agent in crisis (the one direct save)
export const INSPIRATION_PROGRESS = 30; // research points granted by inspiration
export const MEDICINE_HEAL = 55; // health restored by a rescue
