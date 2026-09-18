// The heart of the Tamagotchi: a PURE engine. Same seed + same ticks => the
// same life. No react/three/DOM, no Math.random (all randomness via Rng).
// The store calls tick() in real time and the care actions on player input.

import type { PetState, SavedPet, Stats, PetMood, Reaction, LogEntry, LifeStage } from './types';
import { Rng, deriveSeed } from './rng';
import * as B from './balance';

const MAX_LOG = 120;

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function log(s: PetState, kind: LogEntry['kind'], text: string): void {
  s.log.push({ tick: s.tick, kind, text });
  while (s.log.length > MAX_LOG) s.log.shift();
}

function react(s: PetState, r: Reaction): void {
  s.reaction = r;
  s.reactionTick = s.tick;
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------
export function createPet(seed: number): PetState {
  const rng = new Rng(deriveSeed(seed, 'name'));
  const name = B.PET_NAMES[rng.int(0, B.PET_NAMES.length - 1)]!;
  const s: PetState = {
    seed,
    name,
    stage: 'egg',
    ageTicks: 0,
    tick: 0,
    rngState: deriveSeed(seed, 'sim'),
    stats: { ...B.START_STATS },
    sick: false,
    sleeping: false,
    alive: true,
    poops: [],
    nextPoopTick: 0,
    nextPoopId: 1,
    neglectTicks: 0,
    log: [],
    reactionTick: -999,
  };
  const rng2 = new Rng(s.rngState);
  s.nextPoopTick = B.POOP_MIN_GAP + Math.floor(rng2.next() * (B.POOP_MAX_GAP - B.POOP_MIN_GAP));
  s.rngState = rng2.getState();
  log(s, 'life', `ביצה קטנה מתנדנדת... משהו עומד לבקוע. 🥚`);
  return s;
}

// ---------------------------------------------------------------------------
// Tick — advance real time
// ---------------------------------------------------------------------------
export function tick(state: PetState, ticks: number): PetState {
  const next = clonePet(state);
  if (ticks <= 0 || !next.alive) return next;
  const rng = new Rng(next.rngState);
  for (let i = 0; i < ticks; i++) {
    tickOnce(next, rng);
    if (!next.alive) break;
  }
  next.rngState = rng.getState();
  return next;
}

function stageForAge(age: number): LifeStage {
  if (age >= B.STAGE_AGE.adult) return 'adult';
  if (age >= B.STAGE_AGE.child) return 'child';
  return 'baby';
}

function tickOnce(s: PetState, rng: Rng): void {
  s.tick += 1;
  if (!s.alive) return;

  // Egg hatches after a short wobble.
  if (s.stage === 'egg') {
    if (s.tick >= 4) {
      s.stage = 'baby';
      react(s, 'hatch');
      log(s, 'life', `${s.name} בקע/ה מהביצה! ברוך/ה הבא/ה לעולם. 🐣`);
    }
    return;
  }

  s.ageTicks += 1;
  const st = s.stats;
  const slow = s.sleeping ? B.SLEEP_DECAY_FACTOR : 1;

  // Needs drift.
  st.fullness = clamp(st.fullness - B.FULLNESS_DECAY * slow);
  st.happiness = clamp(st.happiness - B.HAPPINESS_DECAY * slow);
  if (s.sleeping) {
    st.energy = clamp(st.energy + B.ENERGY_RECOVER);
    if (st.energy >= B.WAKE_ENERGY) {
      s.sleeping = false;
      log(s, 'need', `${s.name} התעורר/ה רענן/ה. ☀️`);
    }
  } else {
    st.energy = clamp(st.energy - B.ENERGY_DECAY);
    if (st.energy <= B.AUTO_SLEEP_ENERGY) {
      s.sleeping = true;
      log(s, 'need', `${s.name} נרדם/ה מרוב עייפות. 😴`);
    }
  }

  // Poop (not while asleep).
  if (!s.sleeping && s.tick >= s.nextPoopTick) {
    s.poops.push({ id: s.nextPoopId++, x: rng.range(-0.8, 0.8) });
    s.nextPoopTick = s.tick + B.POOP_MIN_GAP + Math.floor(rng.next() * (B.POOP_MAX_GAP - B.POOP_MIN_GAP));
    log(s, 'need', `${s.name} עשה/תה קקי. 💩 כדאי לנקות.`);
  }
  // Filth from uncollected poop.
  if (s.poops.length > 0) {
    st.hygiene = clamp(st.hygiene - B.HYGIENE_PER_POOP * 0.02 * s.poops.length);
  } else {
    st.hygiene = clamp(st.hygiene + 0.05);
  }

  // Neglect → sickness.
  const bottomed = st.fullness <= 1 || st.happiness <= 1 || st.hygiene <= B.HYGIENE_DIRTY;
  s.neglectTicks = bottomed ? s.neglectTicks + 1 : 0;
  if (!s.sick && s.neglectTicks > B.SICK_NEGLECT_TICKS && rng.next() < B.SICK_CHANCE_PER_TICK) {
    s.sick = true;
    log(s, 'health', `${s.name} חלה/תה! 🤒 צריך תרופה.`);
  }

  // Health.
  let dh = 0;
  if (s.sick) dh -= B.SICK_HEALTH_DRAIN;
  if (st.fullness <= 2) dh -= B.HEALTH_DRAIN_STARVING;
  if (st.hygiene <= B.HYGIENE_DIRTY) dh -= B.HEALTH_DRAIN_DIRTY;
  const well = !s.sick && st.fullness > 30 && st.happiness > 25 && st.hygiene > 45;
  if (well) dh += B.HEALTH_REGEN;
  st.health = clamp(st.health + dh);

  if (st.health <= 0) {
    s.alive = false;
    s.sleeping = false;
    s.deathCause = s.sick ? 'מחלה' : st.fullness <= 2 ? 'רעב' : 'הזנחה';
    log(s, 'life', `${s.name} כבר לא איתנו. 💔 (${s.deathCause})`);
    return;
  }

  // Growing up.
  const stage = stageForAge(s.ageTicks);
  if (stage !== s.stage) {
    s.stage = stage;
    const word = stage === 'child' ? 'ילד/ה' : 'בוגר/ת';
    log(s, 'life', `${s.name} גדל/ה! עכשיו ${word}. 🌱`);
  }
}

// ---------------------------------------------------------------------------
// Care actions — the player's direct touch. Each mutates and returns success.
// ---------------------------------------------------------------------------
function awakeAndAlive(s: PetState): boolean {
  return s.alive && s.stage !== 'egg';
}

export function feed(s: PetState, snack = false): boolean {
  if (!awakeAndAlive(s) || s.sleeping) return false;
  const st = s.stats;
  if (snack) {
    st.happiness = clamp(st.happiness + B.SNACK_HAPPINESS);
    st.fullness = clamp(st.fullness + B.SNACK_FULLNESS);
    st.weight += B.SNACK_WEIGHT;
    log(s, 'care', `נתת ל${s.name} חטיף. 🍬 טעים!`);
  } else {
    if (st.fullness >= 96) {
      log(s, 'care', `${s.name} שבע/ה מדי בשביל עוד ארוחה.`);
      return false;
    }
    st.fullness = clamp(st.fullness + B.FEED_FULLNESS);
    st.happiness = clamp(st.happiness + B.FEED_HAPPINESS);
    st.weight += B.FEED_WEIGHT;
    log(s, 'care', `האכלת את ${s.name}. 🍎`);
  }
  react(s, 'feed');
  return true;
}

export function play(s: PetState): boolean {
  if (!awakeAndAlive(s) || s.sleeping) return false;
  const st = s.stats;
  if (st.energy < 10) {
    log(s, 'play', `${s.name} עייף/ה מדי לשחק.`);
    return false;
  }
  st.happiness = clamp(st.happiness + B.PLAY_HAPPINESS);
  st.energy = clamp(st.energy - B.PLAY_ENERGY_COST);
  st.fullness = clamp(st.fullness - B.PLAY_FULLNESS_COST);
  st.weight = Math.max(4, st.weight - B.PLAY_WEIGHT_LOSS);
  log(s, 'play', `שיחקת עם ${s.name}. 🎾 כיף!`);
  react(s, 'play');
  return true;
}

export function clean(s: PetState): boolean {
  if (!s.alive || s.poops.length === 0) return false;
  s.poops = [];
  s.stats.hygiene = 100;
  log(s, 'care', `ניקית אחרי ${s.name}. ✨ נקי!`);
  react(s, 'clean');
  return true;
}

export function heal(s: PetState): boolean {
  if (!s.alive || !s.sick) return false;
  s.sick = false;
  s.stats.health = clamp(s.stats.health + B.HEAL_HEALTH);
  s.neglectTicks = 0;
  log(s, 'health', `נתת ל${s.name} תרופה. 💊 מרגיש/ה טוב יותר.`);
  react(s, 'heal');
  return true;
}

export function toggleSleep(s: PetState): boolean {
  if (!awakeAndAlive(s)) return false;
  s.sleeping = !s.sleeping;
  log(s, 'need', s.sleeping ? `כיבית את האור. ${s.name} נרדם/ה. 🌙` : `הדלקת את האור. ${s.name} ער/ה. 💡`);
  return true;
}

export function petPet(s: PetState): boolean {
  if (!awakeAndAlive(s) || s.sleeping) return false;
  s.stats.happiness = clamp(s.stats.happiness + B.PET_HAPPINESS);
  react(s, 'pet');
  return true;
}

// ---------------------------------------------------------------------------
// Mood (render reads this)
// ---------------------------------------------------------------------------
export function moodOf(s: PetState): PetMood {
  if (!s.alive) return 'dead';
  if (s.sleeping) return 'sleepy';
  if (s.sick) return 'sick';
  const st = s.stats;
  if (st.energy <= B.SLEEPY_ENERGY) return 'sleepy';
  if (st.fullness <= 25) return 'hungry';
  if (st.happiness <= 25 || st.hygiene <= B.HYGIENE_DIRTY) return 'sad';
  if (st.happiness > 60 && st.fullness > 45 && st.health > 60) return 'happy';
  return 'content';
}

/** A short call-to-action if the pet needs something (drives a gentle alert). */
export function petNeed(s: PetState): string | null {
  if (!s.alive) return null;
  if (s.sick) return 'חולה — צריך תרופה 💊';
  if (s.poops.length > 0) return 'צריך ניקיון 💩';
  if (s.stats.fullness <= 20) return 'רעב 🍎';
  if (s.stats.happiness <= 20) return 'משועמם — בוא לשחק 🎾';
  return null;
}

// ---------------------------------------------------------------------------
// Persistence & offline catch-up
// ---------------------------------------------------------------------------
export function toSaved(s: PetState): SavedPet {
  return clonePet(s);
}

export function hydrate(saved: SavedPet): PetState {
  return clonePet(saved);
}

export interface CatchUp {
  state: PetState;
  simulatedTicks: number;
  capped: boolean;
}

export function catchUp(state: PetState, elapsedMs: number): CatchUp {
  const raw = Math.max(0, Math.floor(elapsedMs / B.REAL_MS_PER_TICK));
  const capped = raw > B.MAX_CATCHUP_TICKS;
  const ticks = Math.min(raw, B.MAX_CATCHUP_TICKS);
  return { state: tick(state, ticks), simulatedTicks: ticks, capped };
}

export function ticksToClock(ticks: number): { hours: number; minutes: number } {
  const totalMin = Math.floor(ticks / 60);
  return { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
}

function cloneStats(s: Stats): Stats {
  return { ...s };
}

export function clonePet(s: PetState): PetState {
  const c: PetState = {
    seed: s.seed,
    name: s.name,
    stage: s.stage,
    ageTicks: s.ageTicks,
    tick: s.tick,
    rngState: s.rngState,
    stats: cloneStats(s.stats),
    sick: s.sick,
    sleeping: s.sleeping,
    alive: s.alive,
    poops: s.poops.map((p) => ({ ...p })),
    nextPoopTick: s.nextPoopTick,
    nextPoopId: s.nextPoopId,
    neglectTicks: s.neglectTicks,
    log: s.log.slice(),
    reactionTick: s.reactionTick,
  };
  if (s.deathCause !== undefined) c.deathCause = s.deathCause;
  if (s.reaction !== undefined) c.reaction = s.reaction;
  return c;
}
