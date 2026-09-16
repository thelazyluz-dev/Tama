// Assembles the 3D scene from sim state. Read-only: every child reads the
// store and draws; none writes it (CLAUDE.md iron rule).

import { OrbitControls } from '@react-three/drei';
import { useGameStore } from '../store';
import { WORLD_HALF } from '../sim';
import { Terrain } from './Terrain';
import { Resources } from './Resources';
import { Agent } from './Agent';
import { Structures } from './Structures';
import { Weather } from './Weather';
import { DayNight } from './DayNight';

export function Scene(): JSX.Element {
  // terrain and resources are shared by reference across ticks, so these
  // selectors don't re-render on every tick.
  const terrain = useGameStore((s) => s.world.terrain);
  const resources = useGameStore((s) => s.world.resources);

  return (
    <>
      <DayNight />
      <Terrain terrain={terrain} />
      <Resources resources={resources} terrain={terrain} />
      <Structures terrain={terrain} />
      <Weather />
      <Agent />
      <OrbitControls
        target={[0, 1, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={WORLD_HALF * 0.7}
        maxDistance={WORLD_HALF * 2.0}
        // Top-side band, no free rotation into the horizon or straight down.
        minPolarAngle={0.55}
        maxPolarAngle={1.05}
      />
    </>
  );
}
