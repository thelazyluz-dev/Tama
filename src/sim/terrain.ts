// Procedural terrain: a size×size heightmap generated deterministically from
// the world seed via simplex noise. Pure data — no three.js, no meshes. The
// render layer reads this to build a flat-shaded mesh; the sim uses heightAt()
// only as data (e.g. to place things on the surface).

import { createNoise2D } from 'simplex-noise';
import { Rng, deriveSeed } from './rng';
import { TERRAIN_SIZE, TERRAIN_NOISE_SCALE, TERRAIN_HEIGHT, WORLD_HALF } from './balance';
import type { TerrainData } from './types';

/** Build the heightmap for a seed. Deterministic. */
export function generateTerrain(seed: number): TerrainData {
  // Own RNG stream so terrain generation never disturbs the sim stream.
  const rng = new Rng(deriveSeed(seed, 'terrain'));
  const noise2D = createNoise2D(() => rng.next());

  const size = TERRAIN_SIZE;
  const heights = new Float32Array(size * size);

  for (let gz = 0; gz < size; gz++) {
    for (let gx = 0; gx < size; gx++) {
      // Two octaves of noise for a slightly richer, still-cheap surface.
      const wx = gx * TERRAIN_NOISE_SCALE;
      const wz = gz * TERRAIN_NOISE_SCALE;
      const base = noise2D(wx, wz);
      const detail = noise2D(wx * 2.3, wz * 2.3) * 0.4;
      // Map noise from [-1.4, 1.4] to [0, 1] then to height amplitude.
      const n = (base + detail + 1.4) / 2.8;
      heights[gz * size + gx] = n * TERRAIN_HEIGHT;
    }
  }

  return { size, heights };
}

/** Convert a world x/z coordinate to fractional grid coordinates. */
function worldToGrid(world: number, size: number): number {
  // World spans [-WORLD_HALF, +WORLD_HALF] across `size` samples.
  return ((world + WORLD_HALF) / (2 * WORLD_HALF)) * (size - 1);
}

/**
 * Sample terrain height at a world x/z, bilinearly interpolated. Coordinates
 * outside the map are clamped to the edge.
 */
export function heightAt(terrain: TerrainData, x: number, z: number): number {
  const { size, heights } = terrain;
  const fx = clampGrid(worldToGrid(x, size), size);
  const fz = clampGrid(worldToGrid(z, size), size);

  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, size - 1);
  const z1 = Math.min(z0 + 1, size - 1);
  const tx = fx - x0;
  const tz = fz - z0;

  const h00 = heights[z0 * size + x0]!;
  const h10 = heights[z0 * size + x1]!;
  const h01 = heights[z1 * size + x0]!;
  const h11 = heights[z1 * size + x1]!;

  const top = h00 + (h10 - h00) * tx;
  const bottom = h01 + (h11 - h01) * tx;
  return top + (bottom - top) * tz;
}

function clampGrid(v: number, size: number): number {
  if (v < 0) return 0;
  if (v > size - 1) return size - 1;
  return v;
}
