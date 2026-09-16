// Stage-0 state schema. Deliberately minimal (kickoff: "WorldState ו־Agent
// מצומצמים לשלב הזה"): one agent, three needs, four actions. Names and shapes
// mirror the full schema in docs/SPEC.md so later stages extend rather than
// rewrite. No `any` anywhere in src/sim.

/** The three needs tracked in stage 0. 0 = satisfied, 100 = full distress. */
export type NeedKey = 'hunger' | 'thirst' | 'fatigue';

/** The four actions available in stage 0. */
export type ActionId = 'eat' | 'drink' | 'sleep' | 'wander';

/** Resource kinds present on the map in stage 0. */
export type ResourceType = 'water' | 'fruit';

export interface Vec2 {
  x: number;
  z: number;
}

export interface ResourceNode {
  id: string;
  type: ResourceType;
  position: Vec2;
}

/** Terrain is DERIVED from the seed, never persisted (keeps saves tiny). */
export interface TerrainData {
  size: number;
  /** Row-major heightmap of size*size samples. */
  heights: Float32Array;
}

export interface ActiveAction {
  type: ActionId;
  /** Resource node id for eat/drink; undefined for sleep/wander. */
  targetId?: string;
  /** World-space destination the agent walks to before performing. */
  targetPos: Vec2;
  startedTick: number;
  durationTicks: number;
  /** Ticks spent performing while in range, 0..durationTicks. */
  progress: number;
  /** True once the agent has reached targetPos and is performing. */
  inRange: boolean;
}

export interface Agent {
  id: string;
  name: string;
  needs: Record<NeedKey, number>;
  position: Vec2;
  currentAction: ActiveAction | null;
}

export interface WorldState {
  seed: number;
  /** Master clock. day and hour are derived from this and kept in sync. */
  tick: number;
  day: number;
  hour: number;
  /** Serializable RNG state for the simulation stream (see rng.ts). */
  rngState: number;

  agent: Agent;

  // Derived-from-seed, rebuilt on load; present here so the sim is self-contained.
  terrain: TerrainData;
  resources: ResourceNode[];
}

/** The subset of WorldState that is persisted; the rest is rebuilt from seed. */
export interface SavedWorld {
  seed: number;
  tick: number;
  day: number;
  hour: number;
  rngState: number;
  agent: Agent;
}
