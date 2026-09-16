// localStorage persistence for the save game. Only the seed-independent
// dynamic state (SavedWorld) is stored; terrain and resources are rebuilt from
// the seed on load (SPEC: "ה־terrain לא נשמר").
//
// This is the only place in the store that touches the real clock and browser
// storage; the actual fast-forward math lives in the pure sim (catchup.ts).

import type { SavedWorld } from '../sim';

const STORAGE_KEY = 'survival-sim:save:v0';

export interface SaveRecord {
  version: 0;
  /** Real wall-clock time (ms) at the moment of saving. */
  savedAtMs: number;
  world: SavedWorld;
}

/** Persist the world. Silently no-ops if storage is unavailable. */
export function saveGame(world: SavedWorld, now: number): void {
  const record: SaveRecord = { version: 0, savedAtMs: now, world };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage full / disabled (private mode) — nothing we can do; keep playing.
  }
}

/** Load the save record, or null if none / unreadable / wrong version. */
export function loadGame(): SaveRecord | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SaveRecord;
    if (parsed.version !== 0 || !parsed.world) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remove the save (e.g. "start a new valley"). */
export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
