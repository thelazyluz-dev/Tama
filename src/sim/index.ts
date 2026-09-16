// Public surface of the pure simulation layer. The render, ui, and store
// layers import ONLY from here (or from these modules) — never the reverse.

export * from './types';
export * from './balance';
export { Rng, deriveSeed } from './rng';
export { generateTerrain, heightAt } from './terrain';
export { generateResources, nearestResource, totalFruit, regrowResources } from './resources';
export { deriveSeason, rollWeather, wintersElapsed } from './season';
export {
  nearestStructure,
  hasShelter,
  isSheltered,
  warmFireNear,
  anyLitFire,
  burnFires,
} from './structures';
export { applyNeedDecay, efficiency, warmthDecayPerDay, safetyDeltaPerDay } from './needs';
export { updateHealth } from './health';
export type { HealthResult } from './health';
export { ACTIONS, ACTION_LIST } from './actions';
export type { ActionDef, ResolvedTarget } from './actions';
export { scoreAction, decide } from './utility';
export type { Decision } from './utility';
export { MAX_JOURNAL } from './events';
export { createWorld, tick, toSaved, hydrate } from './world';
export { catchUp, ticksFromElapsedMs, ticksToDaysHours } from './catchup';
export type { CatchUpResult } from './catchup';
