// Deterministic, seeded pseudo-random number generator.
//
// The whole simulation MUST route randomness through here: same seed + same
// state + same number of ticks => byte-for-byte identical results. This is
// what lets us fast-forward offline progress, reproduce bugs, and prevent
// clock-tampering cheats (see docs/SPEC.md, "דטרמיניזם").
//
// `Math.random()` is forbidden anywhere in src/sim.

/**
 * mulberry32 — a tiny, fast 32-bit PRNG. Its entire state is a single uint32,
 * which makes it trivial to serialize into WorldState and resume exactly.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Coerce to uint32 so behaviour is identical across platforms.
    this.state = seed >>> 0;
  }

  /** Current internal state — store this in WorldState to resume deterministically. */
  getState(): number {
    return this.state >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    // mulberry32
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Pick a uniformly random element. Caller guarantees the array is non-empty. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
}

/**
 * Derive a distinct, stable seed from a base seed and a string tag. Used so
 * that terrain, resource scattering, and the simulation stream each consume
 * their own independent RNG sequence rather than fighting over one.
 */
export function deriveSeed(seed: number, tag: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < tag.length; i++) {
    h = Math.imul(h ^ tag.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h >>> 0;
}
