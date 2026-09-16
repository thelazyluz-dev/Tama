// Drives the sim in real time. Base ratio: 1 real minute = 1 game hour, i.e.
// REAL_MS_PER_TICK real milliseconds per tick at ×1 (see balance.ts). The ×5 /
// ×20 buttons multiply that rate.
//
// This hook only advances time; it never mutates WorldState directly — it calls
// store.stepTicks, which calls the pure sim.

import { useEffect, useRef } from 'react';
import { REAL_MS_PER_TICK } from '../sim';
import { useGameStore } from './gameStore';

// Cap per-frame real delta so a backgrounded tab (rAF paused) doesn't produce a
// jarring jump on resume — the reload path handles genuine long absences.
const MAX_FRAME_MS = 500;

export function useGameLoop(): void {
  const accumulator = useRef(0);
  const lastTime = useRef(0);

  useEffect(() => {
    let raf = 0;

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        // Reset the clock so the hidden gap isn't simulated live.
        lastTime.current = performance.now();
      } else {
        useGameStore.getState().persistNow();
      }
    };
    const onBeforeUnload = () => useGameStore.getState().persistNow();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('beforeunload', onBeforeUnload);

    lastTime.current = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const store = useGameStore.getState();

      let delta = now - lastTime.current;
      lastTime.current = now;
      if (delta > MAX_FRAME_MS) delta = MAX_FRAME_MS;

      if (store.phase !== 'playing') {
        accumulator.current = 0;
        return;
      }

      accumulator.current += delta * store.speed;
      const ticks = Math.floor(accumulator.current / REAL_MS_PER_TICK);
      if (ticks > 0) {
        accumulator.current -= ticks * REAL_MS_PER_TICK;
        store.stepTicks(ticks);
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);
}
