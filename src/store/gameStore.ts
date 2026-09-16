// The bridge (SPEC "גשר בין sim ל־render"): holds the single WorldState, drives
// the pure sim forward, and owns save/load + offline catch-up. The store never
// contains simulation logic — it only calls into src/sim.

import { create } from 'zustand';
import type { WorldState } from '../sim';
import { createWorld, tick, toSaved, hydrate, catchUp, ticksToDaysHours, SPEED_STEPS } from '../sim';
import { saveGame, loadGame } from './persistence';

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
}

interface Boot {
  world: WorldState;
  phase: Phase;
  catchUp: CatchUpSummary | null;
}

/** Load a save (and fast-forward offline time) or start a fresh valley. */
function bootstrap(): Boot {
  const now = Date.now();
  const record = loadGame();

  if (record) {
    const base = hydrate(record.world);
    const result = catchUp(base, Math.max(0, now - record.savedAtMs));
    // Re-anchor the save to now so a subsequent reload measures from here.
    saveGame(toSaved(result.state), now);

    const summary: CatchUpSummary | null =
      result.simulatedTicks > 0
        ? { ...ticksToDaysHours(result.simulatedTicks), capped: result.capped }
        : null;

    return { world: result.state, phase: summary ? 'return' : 'playing', catchUp: summary };
  }

  // Fresh game: derive a seed from the wall clock (low 32 bits).
  const seed = ((now >>> 0) ^ 0x5f3759df) >>> 0;
  const world = createWorld(seed);
  saveGame(toSaved(world), now);
  return { world, phase: 'playing', catchUp: null };
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
}));
