// Seasons and weather. Season is a pure function of the day; weather is rolled
// once per day from the seeded RNG, weighted by season. Pure.

import type { Season, Weather } from './types';
import { Rng } from './rng';
import { SEASONS, SEASON_DAYS, YEAR_DAYS } from './balance';

/** Which season a given day falls in. Day 0 = spring (SPEC: births in spring). */
export function deriveSeason(day: number): Season {
  const d = ((day % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  return SEASONS[Math.floor(d / SEASON_DAYS)]!;
}

/** How many winters have fully elapsed by this day (for the journal/milestones). */
export function wintersElapsed(day: number): number {
  // Winter is the 4th season; a winter completes at the end of each year.
  return Math.floor(day / YEAR_DAYS);
}

const WEATHER_WEIGHTS: Record<Season, [Weather, number][]> = {
  spring: [['clear', 0.55], ['rain', 0.33], ['storm', 0.12]],
  summer: [['clear', 0.55], ['heat', 0.25], ['storm', 0.14], ['rain', 0.06]],
  autumn: [['clear', 0.45], ['rain', 0.3], ['storm', 0.2], ['snow', 0.05]],
  winter: [['clear', 0.4], ['snow', 0.4], ['storm', 0.2]],
};

/** Roll the day's weather deterministically. */
export function rollWeather(season: Season, rng: Rng): Weather {
  const table = WEATHER_WEIGHTS[season];
  const r = rng.next();
  let acc = 0;
  for (const [weather, weight] of table) {
    acc += weight;
    if (r < acc) return weather;
  }
  return table[table.length - 1]![0];
}
