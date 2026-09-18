// The bridge (SPEC "גשר בין sim ל־render"): holds the single WorldState, drives
// the pure sim forward, and owns save/load + offline catch-up. The store never
// contains simulation logic — it only calls into src/sim.

import { create } from 'zustand';
import type { WorldState, PriorityCategory, InterventionId } from '../sim';
import {
  createWorld,
  tick,
  toSaved,
  hydrate,
  catchUp,
  ticksToDaysHours,
  SPEED_STEPS,
  applyIntervention,
  clampPriority,
  petAgent as applyPet,
} from '../sim';
import { saveGame, loadGame, clearGame } from './persistence';

export type Phase = 'return' | 'playing';

export interface CatchUpSummary {
  days: number;
  hours: number;
  capped: boolean;
}

export interface GameStore {
  world: WorldState;
  phase: Phase;
  speed: number;
  catchUp: CatchUpSummary | null;

  /** Advance the sim by n ticks (called by the real-time loop). */
  stepTicks: (n: number) => void;
  /** Dismiss the return screen and start playing. */
  enterGame: () => void;
  /** Change view speed (×1 / ×5 / ×20). */
  setSpeed: (speed: number) => void;
  /** Persist the current world with a fresh timestamp (on leave/hide). */
  persistNow: () => void;
  /** Abandon the current valley and start a fresh one (e.g. after death). */
  newGame: () => void;
  /** Rename the current agent (a cosmetic the player controls). */
  renameAgent: (name: string) => void;
  /** Stage 5: set a priority slider (SPEC channel 1 — nudges appeal, ×0.5..×2). */
  setPriority: (category: PriorityCategory, value: number) => void;
  /** Stage 5: spend points on a shop intervention. Returns whether it applied. */
  buyIntervention: (id: InterventionId) => boolean;
  /** Direct touch: pet a creature (eases loneliness & boredom). */
  petAgent: (id: string) => void;
}

interface Boot {
  world: WorldState;
  phase: Phase;
  catchUp: CatchUpSummary | null;
}

function freshGame(now: number): Boot {
  // Derive a seed from the wall clock (low 32 bits).
  const seed = ((now >>> 0) ^ 0x5f3759df) >>> 0;
  const world = createWorld(seed);
  saveGame(toSaved(world), now);
  return { world, phase: 'playing', catchUp: null };
}

/** Load a save (and fast-forward offline time) or start a fresh valley. */
function bootstrap(): Boot {
  const now = Date.now();

  // A malformed or incompatible save must never blank the app — fall back to a
  // fresh valley instead of throwing at module load.
  try {
    const record = loadGame();
    if (!record) return freshGame(now);

    const base = hydrate(record.world);
    const result = catchUp(base, Math.max(0, now - record.savedAtMs));
    saveGame(toSaved(result.state), now); // re-anchor to now

    const summary: CatchUpSummary | null =
      result.simulatedTicks > 0
        ? { ...ticksToDaysHours(result.simulatedTicks), capped: result.capped }
        : null;

    return { world: result.state, phase: summary ? 'return' : 'playing', catchUp: summary };
  } catch {
    try {
      clearGame();
    } catch {
      // ignore
    }
    return freshGame(now);
  }
}

const boot = bootstrap();

export const useGameStore = create<GameStore>((set, get) => ({
  world: boot.world,
  phase: boot.phase,
  speed: SPEED_STEPS[0],
  catchUp: boot.catchUp,

  stepTicks: (n) => {
    if (n <= 0) return;
    const prev = get().world;
    const world = tick(prev, n);
    // Persist on every day rollover (kickoff: save on day change).
    if (world.day !== prev.day) saveGame(toSaved(world), Date.now());
    set({ world });
  },

  enterGame: () => {
    saveGame(toSaved(get().world), Date.now());
    set({ phase: 'playing', catchUp: null });
  },

  setSpeed: (speed) => set({ speed }),

  persistNow: () => saveGame(toSaved(get().world), Date.now()),

  newGame: () => {
    clearGame();
    const now = Date.now();
    const seed = ((now >>> 0) ^ 0x9e3779b9) >>> 0;
    const world = createWorld(seed);
    saveGame(toSaved(world), now);
    set({ world, phase: 'playing', catchUp: null, speed: SPEED_STEPS[0] });
  },

  renameAgent: (name) => {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return;
    const w = get().world;
    const agents = w.agents.map((a) => (a.id === w.playerAgentId ? { ...a, name: trimmed } : a));
    const world = { ...w, agents };
    saveGame(toSaved(world), Date.now());
    set({ world });
  },

  setPriority: (category, value) => {
    const w = get().world;
    const clamped = clampPriority(value);
    if (w.playerPriorities[category] === clamped) return;
    const world = { ...w, playerPriorities: { ...w.playerPriorities, [category]: clamped } };
    saveGame(toSaved(world), Date.now());
    set({ world });
  },

  buyIntervention: (id) => {
    // tick(_, 0) hands back a deep clone; the intervention mutates only that.
    const draft = tick(get().world, 0);
    const ok = applyIntervention(draft, id);
    if (ok) {
      saveGame(toSaved(draft), Date.now());
      set({ world: draft });
    }
    return ok;
  },

  petAgent: (id) => {
    const draft = tick(get().world, 0); // deep clone; pet mutates only that
    if (applyPet(draft, id)) {
      saveGame(toSaved(draft), Date.now());
      set({ world: draft });
    }
  },
}));
