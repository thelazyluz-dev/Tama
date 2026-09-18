// The bridge: holds the single PetState, drives the real-time loop, and owns
// save/load + offline catch-up. No sim logic here — it only calls into ./pet.

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { PetState, SavedPet } from './types';
import {
  createPet,
  tick,
  toSaved,
  hydrate,
  catchUp,
  ticksToClock,
  feed as doFeed,
  play as doPlay,
  clean as doClean,
  heal as doHeal,
  toggleSleep as doToggleSleep,
  petPet as doPet,
} from './pet';
import { REAL_MS_PER_TICK } from './balance';

const SAVE_VERSION = 1;
const KEY = `tama:pet:v${SAVE_VERSION}`;

interface SaveRecord {
  version: number;
  savedAtMs: number;
  pet: SavedPet;
}

function isValid(r: SaveRecord | null): r is SaveRecord {
  if (!r || r.version !== SAVE_VERSION || !r.pet) return false;
  const p = r.pet;
  return (
    typeof p.seed === 'number' &&
    typeof p.name === 'string' &&
    !!p.stats &&
    typeof p.stats.health === 'number' &&
    Array.isArray(p.poops) &&
    Array.isArray(p.log)
  );
}

function save(pet: SavedPet, now: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: SAVE_VERSION, savedAtMs: now, pet }));
  } catch {
    /* private mode / full — keep playing */
  }
}

function load(): SaveRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveRecord;
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export interface AwaySummary {
  hours: number;
  minutes: number;
  capped: boolean;
}

export type Phase = 'return' | 'playing';

export interface PetStore {
  pet: PetState;
  phase: Phase;
  away: AwaySummary | null;

  stepTicks: (n: number) => void;
  feed: (snack?: boolean) => void;
  play: () => void;
  clean: () => void;
  heal: () => void;
  toggleSleep: () => void;
  petIt: () => void;
  dismissReturn: () => void;
  newPet: () => void;
  persistNow: () => void;
}

interface Boot {
  pet: PetState;
  phase: Phase;
  away: AwaySummary | null;
}

function freshBoot(now: number): Boot {
  const seed = ((now >>> 0) ^ 0x9e3779b9) >>> 0;
  const pet = createPet(seed);
  save(toSaved(pet), now);
  return { pet, phase: 'playing', away: null };
}

function bootstrap(): Boot {
  const now = Date.now();
  try {
    const rec = load();
    if (!rec) return freshBoot(now);
    const base = hydrate(rec.pet);
    const result = catchUp(base, Math.max(0, now - rec.savedAtMs));
    save(toSaved(result.state), now);
    const away: AwaySummary | null =
      result.simulatedTicks > 120
        ? { ...ticksToClock(result.simulatedTicks), capped: result.capped }
        : null;
    return { pet: result.state, phase: away ? 'return' : 'playing', away };
  } catch {
    clear();
    return freshBoot(now);
  }
}

const boot = bootstrap();

/** Apply a care action to a cloned pet, persist, and commit. */
function applyCare(
  get: () => PetStore,
  set: (partial: Partial<PetStore>) => void,
  action: (p: PetState) => boolean,
): void {
  const draft = tick(get().pet, 0); // deep clone
  if (action(draft)) {
    save(toSaved(draft), Date.now());
    set({ pet: draft });
  }
}

export const usePetStore = create<PetStore>((set, get) => ({
  pet: boot.pet,
  phase: boot.phase,
  away: boot.away,

  stepTicks: (n) => {
    if (n <= 0) return;
    const prev = get().pet;
    if (!prev.alive) return;
    const pet = tick(prev, n);
    // Persist roughly once a minute (every 60 ticks) and on death.
    if (Math.floor(pet.tick / 60) !== Math.floor(prev.tick / 60) || !pet.alive) {
      save(toSaved(pet), Date.now());
    }
    set({ pet });
  },

  feed: (snack) => applyCare(get, set, (p) => doFeed(p, snack)),
  play: () => applyCare(get, set, doPlay),
  clean: () => applyCare(get, set, doClean),
  heal: () => applyCare(get, set, doHeal),
  toggleSleep: () => applyCare(get, set, doToggleSleep),
  petIt: () => applyCare(get, set, doPet),

  dismissReturn: () => {
    save(toSaved(get().pet), Date.now());
    set({ phase: 'playing', away: null });
  },

  newPet: () => {
    clear();
    const now = Date.now();
    const seed = ((now >>> 0) ^ 0x85ebca6b) >>> 0;
    const pet = createPet(seed);
    save(toSaved(pet), now);
    set({ pet, phase: 'playing', away: null });
  },

  persistNow: () => save(toSaved(get().pet), Date.now()),
}));

/** Real-time loop: accumulate elapsed wall-clock and advance whole ticks. */
export function usePetLoop(): void {
  const stepTicks = usePetStore((s) => s.stepTicks);
  const persistNow = usePetStore((s) => s.persistNow);
  const acc = useRef(0);
  const last = useRef(performance.now());

  useEffect(() => {
    let raf = 0;
    const frame = (t: number): void => {
      const dt = t - last.current;
      last.current = t;
      acc.current += dt;
      if (acc.current >= REAL_MS_PER_TICK) {
        const n = Math.floor(acc.current / REAL_MS_PER_TICK);
        acc.current -= n * REAL_MS_PER_TICK;
        stepTicks(Math.min(n, 300)); // guard against huge frame gaps
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onHide = (): void => {
      if (document.visibilityState === 'hidden') persistNow();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', persistNow);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', persistNow);
    };
  }, [stepTicks, persistNow]);
}
