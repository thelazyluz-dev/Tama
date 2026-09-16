// Assembles the 3D scene from sim state. Read-only: every child reads the
// store and draws; none writes it (CLAUDE.md iron rule).

import { useMemo } from 'react';
import { OrbitControls, SoftShadows } from '@react-three/drei';
import { useGameStore } from '../store';
import { WORLD_HALF, generateResources } from '../sim';
import { Terrain } from './Terrain';
import { Trees } from './Trees';
import { Ponds } from './Ponds';
import { Agent } from './Agent';
import { Structures } from './Structures';
import { Weather } from './Weather';
import { DayNight } from './DayNight';
import { CameraRig } from './CameraRig';

export function Scene(): JSX.Element {
  const terrain = useGameStore((s) => s.world.terrain);
  const season = useGameStore((s) => s.world.season);
  const seed = useGameStore((s) => s.world.seed);

  // Static (seed-derived) positions — stable across ticks, so foliage doesn't
  // rebuild every frame.
  const resources = useMemo(() => generateResources(seed), [seed]);

  return (
    <>
      <SoftShadows size={26} samples={12} focus={0.9} />
      <hemisphereLight args={['#bcd3ff', '#48402f', 0.55]} />
      <DayNight />
      <Terrain terrain={terrain} season={season} />
      <Ponds resources={resources} terrain={terrain} />
      <Trees resources={resources} terrain={terrain} season={season} />
      <Structures terrain={terrain} />
      <Weather />
      <Agent />
      <CameraRig />
      <OrbitControls
        makeDefault
        target={[0, 1, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={WORLD_HALF * 0.35}
        maxDistance={WORLD_HALF * 1.4}
        // Top-side band, no free rotation into the horizon or straight down.
        minPolarAngle={0.55}
        maxPolarAngle={1.05}
      />
    </>
  );
}
