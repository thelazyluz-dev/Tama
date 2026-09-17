// Stage-1 state schema ("הישרדות אמיתית"): eight needs, health & death,
// seasons & weather, food stock, structures, and the journal. Names/shapes
// still mirror docs/SPEC.md so later stages extend rather than rewrite. No
// `any` anywhere in src/sim.

/** The eight needs (SPEC "צרכים והישרדות"). 0 = satisfied, 100 = full distress. */
export type NeedKey =
  | 'hunger'
  | 'thirst'
  | 'fatigue'
  | 'warmth'
  | 'hygiene'
  | 'loneliness'
  | 'boredom'
  | 'safety';

/** Stage-1/2/3 actions ('socialize' is the stage-3 courtship action). */
export type ActionId =
  | 'eat'
  | 'drink'
  | 'sleep'
  | 'wander'
  | 'gather'
  | 'wash'
  | 'warm'
  | 'buildShelter'
  | 'makeFire'
  | 'experiment'
  | 'socialize';

// --- Stage 2: knowledge ---------------------------------------------------
/** Heritable personality traits, 0..1 (heritability itself arrives in stage 4). */
export type TraitKey =
  | 'curiosity'
  | 'diligence'
  | 'sociability'
  | 'courage'
  | 'temper'
  | 'constitution';

/** Personal, per-life skills, 0..100 (reset each generation in later stages). */
export type SkillKey = 'foraging' | 'crafting' | 'firecraft';

/** Technologies for the first two eras. */
export type TechId = 'stone_tools' | 'fire' | 'cooking';

/** Environmental triggers the agent has witnessed (gate certain discoveries). */
export interface KnowledgeTriggers {
  lightning: boolean; // enables discovering fire (SPEC: fire after a lightning storm)
}

/** Tribe-level knowledge (persists across generations in later stages). */
export interface KnowledgeState {
  known: TechId[];
  progress: Record<string, number>; // techId -> accumulated research
  triggers: KnowledgeTriggers;
}

export type Sex = 'male' | 'female';

/** Stage 3: relationships between agents (SPEC "חיזור וזוגיות"). */
export type RelationKind = 'stranger' | 'friend' | 'partner' | 'parent' | 'child' | 'sibling';
export interface Relation {
  affection: number; // -100..100
  trust: number; // 0..100
  kind: RelationKind;
  lastInteractionDay: number;
}

export type ResourceType = 'water' | 'fruit';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'clear' | 'rain' | 'storm' | 'snow' | 'heat';
export type StructureType = 'shelter' | 'fire';

/**
 * AI behaviour profile. 'sensible' prepares for winter (fills the food store,
 * builds shelter, keeps a fire). 'reactive' only answers immediate needs — used
 * to model a neglected agent for the stage-1 transition test, and the seam
 * where stage 5's player priorities will plug in.
 */
export type AiProfile = 'sensible' | 'reactive';

export interface Vec2 {
  x: number;
  z: number;
}

export interface ResourceNode {
  id: string;
  type: ResourceType;
  position: Vec2;
  /** Fruit only: harvestable units remaining (regrows outside winter). */
  quantity: number;
}

export interface Structure {
  id: string;
  type: StructureType;
  position: Vec2;
  /** Fire only: remaining fuel (0 = burnt out). */
  fuel: number;
}

/** Terrain is DERIVED from the seed, never persisted (keeps saves tiny). */
export interface TerrainData {
  size: number;
  heights: Float32Array;
}

export interface ActiveAction {
  type: ActionId;
  targetId?: string;
  targetPos: Vec2;
  startedTick: number;
  durationTicks: number;
  progress: number;
  inRange: boolean;
}

export type JournalKind =
  | 'need'
  | 'danger'
  | 'build'
  | 'death'
  | 'mood'
  | 'day'
  | 'season'
  | 'weather'
  | 'discovery'
  | 'social'
  | 'birth';

export interface JournalEntry {
  day: number;
  hour: number;
  kind: JournalKind;
  weight: 1 | 2 | 3; // 3 = must appear in a summary
  text: string; // Hebrew, generated from a template + state
}

export interface Pregnancy {
  conceivedDay: number;
  fatherId: string;
}

export interface Agent {
  id: string;
  name: string;
  sex: Sex;
  birthDay: number;
  /** Generation depth: founder/nomad = 0, their children = 1, ... */
  generation: number;
  /** Parent ids [mother, father], for the family tree. */
  parents?: [string, string];
  needs: Record<NeedKey, number>;
  health: number;
  alive: boolean;
  deathCause?: string;
  traits: Record<TraitKey, number>;
  skills: Record<SkillKey, number>;
  /** Relationships to other agents, keyed by agent id. */
  relations: Record<string, Relation>;
  pregnancy?: Pregnancy;
  position: Vec2;
  currentAction: ActiveAction | null;
}

/** One-time milestones, so a journal line is written once, not every tick. */
export interface Milestones {
  builtShelter: boolean;
  madeFire: boolean;
  firstGather: boolean;
  inCrisis: boolean;
  nomadArrived: boolean;
  becamePartners: boolean;
  firstBirth: boolean;
  generations: number; // deepest generation reached
  lastNomadDay: number;
  survivedWinters: number;
  lastSeason: Season;
  lastWeather: Weather;
}

export interface WorldState {
  seed: number;
  tick: number;
  day: number;
  hour: number;
  rngState: number;

  season: Season;
  weather: Weather;
  aiProfile: AiProfile;

  /** All agents (living and dead); the first is the founder. */
  agents: Agent[];
  /** The agent the camera/UI follows. */
  playerAgentId: string;
  /** Monotonic counter for unique agent ids. */
  nextAgentId: number;
  /** Shared tribe food store (SPEC: the character economy belongs to the world). */
  foodStock: number;
  structures: Structure[];
  journal: JournalEntry[];
  milestones: Milestones;
  knowledge: KnowledgeState;

  // Derived-from-seed, rebuilt on load.
  terrain: TerrainData;
  resources: ResourceNode[];
}

/** The subset of WorldState that is persisted; terrain is rebuilt from seed. */
export interface SavedWorld {
  seed: number;
  tick: number;
  day: number;
  hour: number;
  rngState: number;
  season: Season;
  weather: Weather;
  aiProfile: AiProfile;
  agents: Agent[];
  playerAgentId: string;
  nextAgentId: number;
  foodStock: number;
  structures: Structure[];
  resources: ResourceNode[];
  journal: JournalEntry[];
  milestones: Milestones;
  knowledge: KnowledgeState;
}
