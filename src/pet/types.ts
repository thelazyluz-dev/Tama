// The Tamagotchi state schema. Pure data — no react/three/DOM in src/pet.
// One pet you care for directly: it gets hungry, bored, dirty, tired and sick,
// and it needs YOU. Classic loop first; modern features grow from here.

export type LifeStage = 'egg' | 'baby' | 'child' | 'adult';

/** What the creature's face/body is doing right now (derived, drives render). */
export type PetMood =
  | 'happy'
  | 'content'
  | 'hungry'
  | 'sad'
  | 'sleepy'
  | 'sick'
  | 'dead';

/** A brief care reaction, set by an action for the render to animate. */
export type Reaction = 'pet' | 'feed' | 'play' | 'clean' | 'heal' | 'hatch';

export interface Stats {
  fullness: number; // 0 starving .. 100 full
  happiness: number; // 0 miserable .. 100 delighted
  energy: number; // 0 exhausted .. 100 rested
  hygiene: number; // 0 filthy .. 100 clean
  health: number; // 0 dead .. 100 well
  weight: number; // grows with food, shrinks with play
}

export interface Poop {
  id: number;
  x: number; // position offset on the ground, -1..1
}

export interface LogEntry {
  tick: number;
  kind: 'care' | 'need' | 'health' | 'life' | 'play';
  text: string; // Hebrew
}

export interface PetState {
  seed: number;
  name: string;
  stage: LifeStage;
  ageTicks: number; // ticks since hatching

  tick: number;
  rngState: number;

  stats: Stats;
  sick: boolean;
  sleeping: boolean;
  alive: boolean;
  deathCause?: string;

  poops: Poop[];
  nextPoopTick: number;
  nextPoopId: number;
  neglectTicks: number; // consecutive ticks with a need bottomed out

  log: LogEntry[];

  // Transient, for the render only (not gameplay): the last care reaction.
  reaction?: Reaction;
  reactionTick: number;
}

/** The persisted subset (identical to PetState today; kept explicit for future). */
export type SavedPet = PetState;
