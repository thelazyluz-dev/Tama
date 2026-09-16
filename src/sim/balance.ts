// ALL balance numbers live here — never scatter tuning constants through the
// code (CLAUDE.md rule). When you change a number here, run `npm run test:sim`
// and compare the printed before/after stats.

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
export const REAL_MS_PER_TICK = (60_000 / TICKS_PER_HOUR); // 6000 ms at ×1

// Offline catch-up ceiling (SPEC: max 14 game days simulated in full).
export const MAX_CATCHUP_DAYS = 14;
export const MAX_CATCHUP_TICKS = MAX_CATCHUP_DAYS * TICKS_PER_DAY;

// In-game speed multipliers (SPEC: ×1 / ×5 / ×20 view buttons).
export const SPEED_STEPS = [1, 5, 20] as const;

// ---------------------------------------------------------------------------
// Terrain & map
// ---------------------------------------------------------------------------
export const TERRAIN_SIZE = 64; // 64×64 heightmap
// World spans [-HALF, +HALF] on both x and z, centred on the origin.
export const WORLD_HALF = TERRAIN_SIZE / 2; // 32
export const TERRAIN_NOISE_SCALE = 0.06; // frequency of the simplex noise
export const TERRAIN_HEIGHT = 6; // peak height amplitude (render units)

// ---------------------------------------------------------------------------
// Resources (stage 0: static, non-depleting)
// ---------------------------------------------------------------------------
export const NUM_WATER = 5;
export const NUM_FRUIT = 9;
export const RESOURCE_MARGIN = 6; // keep nodes away from the very edge

// ---------------------------------------------------------------------------
// Needs — decay is expressed PER GAME DAY (= per real hour). 0 = satisfied,
// 100 = full distress. See SPEC "צרכים והישרדות".
// ---------------------------------------------------------------------------
export const NEED_DECAY_PER_DAY = {
  hunger: 45,
  thirst: 100,
  fatigue: 60,
} as const;

export const NEED_START = {
  hunger: 15,
  thirst: 15,
  fatigue: 10,
} as const;

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------
export const MOVE_SPEED = 1.6; // world units per tick
export const ARRIVE_RADIUS = 0.9; // "close enough" to a target to act

// ---------------------------------------------------------------------------
// Actions — durations are in ticks spent PERFORMING once the agent has arrived
// at the target. `effect` values are per-tick deltas applied while performing
// (negative = relieves the need). Overshoot is clamped to 0 in world.ts.
// ---------------------------------------------------------------------------
export const ACTION = {
  eat: { durationTicks: 5, effect: { hunger: -30 } },
  drink: { durationTicks: 3, effect: { thirst: -45 } },
  sleep: { durationTicks: 80, effect: { fatigue: -1.7 } },
  wander: { durationTicks: 0, effect: {} },
} as const;

// ---------------------------------------------------------------------------
// Utility AI
// ---------------------------------------------------------------------------
// Needs enter appeal SQUARED, so a need is calm until it is high and then it
// dominates (SPEC "מנוע ההחלטות").
export const THIRST_APPEAL_MULT = 1.3;
export const WANDER_APPEAL = 0.15; // low constant baseline; the "alive" idle

// Sleeping is far more appealing at night than during the day.
export const NIGHT_SLEEP_BONUS = 1.6;
export const DAY_SLEEP_BONUS = 0.5;
export const NIGHT_START_HOUR = 21; // 21:00–05:59 counts as night
export const NIGHT_END_HOUR = 6;

// Distance penalty multiplier: 1 / (1 + k * distance), in (0, 1].
export const DISTANCE_PENALTY_K = 0.04;

// Hysteresis: a challenger must beat the *active* action by at least this
// factor to steal control, so the agent doesn't dither between two options
// (SPEC risk "הדמות נראית טיפשה" / kickoff: 25%).
export const HYSTERESIS = 1.25;
