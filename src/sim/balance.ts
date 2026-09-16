// ALL balance numbers live here — never scatter tuning constants through the
// code (CLAUDE.md rule). When you change a number here, run `npm run test:sim`
// and compare the printed before/after stats.

import type { NeedKey, Season, Weather } from './types';

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
