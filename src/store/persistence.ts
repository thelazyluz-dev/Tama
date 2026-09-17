// localStorage persistence for the save game. Only the seed-independent
// dynamic state (SavedWorld) is stored; terrain and resources are rebuilt from
// the seed on load (SPEC: "ה־terrain לא נשמר").
//
// This is the only place in the store that touches the real clock and browser
// storage; the actual fast-forward math lives in the pure sim (catchup.ts).

import type { SavedWorld } from '../sim';

// Bump this whenever the SavedWorld shape changes so older, incompatible saves
// are ignored (a fresh valley) instead of crashing hydrate(). The key includes
// the version so stale data under an old key is never read.
const SAVE_VERSION = 3;
const STORAGE_KEY = `survival-sim:save:v${SAVE_VERSION}`;

export interface SaveRecord {
  version: number;
  /** Real wall-clock time (ms) at the moment of saving. */
  savedAtMs: number;
  world: SavedWorld;
}

/** Sanity-check that a parsed record has the fields the current sim expects. */
function isValid(rec: SaveRecord | null): rec is SaveRecord {
  if (!rec || rec.version !== SAVE_VERSION) return false;
  const w = rec.world;
  if (!w || typeof w.seed !== 'number' || typeof w.foodStock !== 'number') return false;
  if (!Array.isArray(w.agents) || w.agents.length === 0 || !w.playerAgentId) return false;
  const a0 = w.agents[0];
  // Fields added across stages — their absence means an older shape.
  if (!w.knowledge || !a0.traits || !a0.skills || !a0.relations) return false;
  if (!Array.isArray(w.structures) || !Array.isArray(w.resources)) return false;
  return true;
}

/** Persist the world. Silently no-ops if storage is unavailable. */
export function saveGame(world: SavedWorld, now: number): void {
  const record: SaveRecord = { version: SAVE_VERSION, savedAtMs: now, world };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage full / disabled (private mode) — nothing we can do; keep playing.
  }
}

/** Load the save record, or null if none / unreadable / wrong version / shape. */
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
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Remove the save (e.g. "start a new valley"). */
export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Also clear any older-versioned saves so they never accumulate.
    for (let v = 0; v < SAVE_VERSION; v++) localStorage.removeItem(`survival-sim:save:v${v}`);
  } catch {
    // ignore
  }
}
