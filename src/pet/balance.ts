// All Tamagotchi tuning lives here. Time model: 1 tick = 1 real second, so
// meters drift on a human scale and offline time is easy to reason about.

import type { LifeStage } from './types';

export const REAL_MS_PER_TICK = 1000; // 1 tick per real second
export const MAX_CATCHUP_HOURS = 12; // cap offline simulation (a needy, not dead-for-days, pet)
export const MAX_CATCHUP_TICKS = MAX_CATCHUP_HOURS * 3600;

// --- decay per tick (awake). A meter falls 100 -> 0 in ~ (100 / rate) seconds.
export const FULLNESS_DECAY = 0.09; // ~18 min to empty
export const HAPPINESS_DECAY = 0.075; // ~22 min
export const ENERGY_DECAY = 0.05; // ~33 min awake
export const SLEEP_DECAY_FACTOR = 0.35; // needs drift slower while asleep

// --- sleep
export const ENERGY_RECOVER = 0.35; // per tick asleep
export const SLEEPY_ENERGY = 22; // below this, the pet is drowsy
export const AUTO_SLEEP_ENERGY = 6; // below this it drops off on its own
export const WAKE_ENERGY = 96; // wakes on its own once fully rested

// --- poop & hygiene
export const POOP_MIN_GAP = 240; // 4 min
export const POOP_MAX_GAP = 480; // 8 min
export const HYGIENE_PER_POOP = 26; // each pile on the ground drags hygiene down (per tick, scaled)
export const HYGIENE_DIRTY = 30; // below this, health suffers

// --- sickness
export const SICK_NEGLECT_TICKS = 90; // a need bottomed this long risks illness
export const SICK_CHANCE_PER_TICK = 0.015; // while neglected/dirty
export const SICK_HEALTH_DRAIN = 0.18; // health lost per tick while sick & untreated

// --- health
export const HEALTH_REGEN = 0.12; // per tick when everything is well
export const HEALTH_DRAIN_STARVING = 0.14; // fullness ~0
export const HEALTH_DRAIN_DIRTY = 0.08; // hygiene very low

// --- care action effects
export const FEED_FULLNESS = 34;
export const FEED_WEIGHT = 2;
export const FEED_HAPPINESS = 4;
export const SNACK_HAPPINESS = 18;
export const SNACK_FULLNESS = 10;
export const SNACK_WEIGHT = 4;
export const PLAY_HAPPINESS = 30;
export const PLAY_ENERGY_COST = 14;
export const PLAY_FULLNESS_COST = 6;
export const PLAY_WEIGHT_LOSS = 1;
export const PET_HAPPINESS = 12;
export const HEAL_HEALTH = 22;

// --- life stages (by age in ticks/seconds since hatch)
export const STAGE_AGE: Record<Exclude<LifeStage, 'egg'>, number> = {
  baby: 0,
  child: 25 * 60, // 25 min
  adult: 90 * 60, // 90 min
};
export const OLD_AGE_TICKS = 8 * 3600; // ~8h of attentive life before old age looms

// --- starting stats
export const START_STATS = {
  fullness: 70,
  happiness: 70,
  energy: 90,
  hygiene: 100,
  health: 100,
  weight: 12,
};

// A random Hebrew name for a freshly hatched pet.
export const PET_NAMES = [
  'פוצי', 'מוצי', 'בובו', 'ניני', 'טופי', 'ליבי', 'גופי', 'זוזו', 'פיפי', 'דודו',
  'קוקו', 'לולו', 'ביבי', 'נאני', 'טוטו',
] as const;
