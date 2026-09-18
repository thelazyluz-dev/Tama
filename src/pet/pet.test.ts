// Headless tests for the Tamagotchi engine — decay, care, neglect death, and
// determinism. No browser, no rendering.

import { describe, it, expect } from 'vitest';
import { createPet, tick, feed, play, clean, moodOf, catchUp } from './pet';

describe('tamagotchi engine', () => {
  it('hatches from an egg into a baby', () => {
    const p0 = createPet(1);
    expect(p0.alive).toBe(true);
    expect(p0.stage).toBe('egg');
    const p = tick(p0, 10);
    expect(p.stage).toBe('baby');
  });

  it('needs drift down over time', () => {
    const p = tick(createPet(2), 600); // 10 min
    expect(p.stats.fullness).toBeLessThan(70);
    expect(p.stats.happiness).toBeLessThan(70);
  });

  it('feeding raises fullness; playing raises happiness', () => {
    const p = tick(createPet(3), 600);
    const before = { f: p.stats.fullness, h: p.stats.happiness };
    expect(feed(p)).toBe(true);
    expect(p.stats.fullness).toBeGreaterThan(before.f);
    expect(play(p)).toBe(true);
    expect(p.stats.happiness).toBeGreaterThan(before.h);
  });

  it('cleaning removes poop and restores hygiene', () => {
    const p = tick(createPet(4), 500); // first poop lands by tick ~480, still alive
    expect(p.alive).toBe(true);
    expect(p.poops.length).toBeGreaterThan(0);
    expect(clean(p)).toBe(true);
    expect(p.poops.length).toBe(0);
    expect(p.stats.hygiene).toBe(100);
  });

  it('total neglect ends in death', () => {
    const p = tick(createPet(5), 8000); // never cared for
    expect(p.alive).toBe(false);
    expect(moodOf(p)).toBe('dead');
  });

  it('a cared-for pet stays alive and healthy', () => {
    let p = createPet(6);
    for (let i = 0; i < 40; i++) {
      p = tick(p, 200);
      if (p.stats.fullness < 45) feed(p);
      if (p.stats.happiness < 45) play(p);
      if (p.poops.length > 0) clean(p);
    }
    expect(p.alive).toBe(true);
    expect(p.stats.health).toBeGreaterThan(50);
  });

  it('is deterministic: same seed + ticks => identical state', () => {
    const a = tick(createPet(42), 2500);
    const b = tick(createPet(42), 2500);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('offline catch-up equals live stepping', () => {
    const caught = catchUp(createPet(7), 20 * 60 * 1000); // 20 min away
    const direct = tick(createPet(7), caught.simulatedTicks);
    expect(JSON.stringify(caught.state)).toBe(JSON.stringify(direct));
  });
});
