// The R3F canvas wrapper. Sets up shadows, the orbital camera, and initial
// sky/fog (DayNight then animates them). Read-only.

import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_HALF } from '../sim';
import { Scene } from './Scene';

const INITIAL_SKY = '#233251';

export function GameCanvas(): JSX.Element {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{
        position: [WORLD_HALF * 0.9, WORLD_HALF * 1.15, WORLD_HALF * 0.9],
        fov: 45,
        near: 0.1,
        far: WORLD_HALF * 8,
      }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color(INITIAL_SKY);
        scene.fog = new THREE.Fog(INITIAL_SKY, WORLD_HALF * 0.9, WORLD_HALF * 3.6);
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene />
    </Canvas>
  );
}
