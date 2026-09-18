// The R3F canvas wrapper. Sets up shadows, the orbital camera, and initial
// sky/fog (DayNight then animates them). Read-only.

import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_HALF } from '../sim';
import { Scene } from './Scene';
import { Effects } from './Effects';

const INITIAL_SKY = '#233251';

export function GameCanvas(): JSX.Element {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      gl={{
        antialias: false, // SMAA handles it
        powerPreference: 'high-performance',
        stencil: false,
        toneMappingExposure: 1.05,
      }}
      camera={{
        // Start intimate — close on the creature's face (Tamagotchi feel).
        // The user can still orbit and zoom out to an overview.
        position: [4.5, 5.5, 7],
        fov: 45,
        near: 0.1,
        far: WORLD_HALF * 8,
      }}
      onCreated={({ scene, gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        scene.background = new THREE.Color(INITIAL_SKY);
        scene.fog = new THREE.Fog(INITIAL_SKY, WORLD_HALF * 1.1, WORLD_HALF * 4.2);
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene />
      <Effects />
    </Canvas>
  );
}
