// Day-night cycle: a single directional "sun" plus ambient fill, with sky
// (background + fog) colour tracking the time of day. Driven continuously from
// the world tick so it eases through dawn/dusk. Read-only.

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TICKS_PER_DAY, WORLD_HALF } from '../sim';
import { useGameStore } from '../store';

const NIGHT_SKY = new THREE.Color('#0b1026');
const DAY_SKY = new THREE.Color('#8ec5ff');
const WARM_LIGHT = new THREE.Color('#ffb367');
const NOON_LIGHT = new THREE.Color('#fff6e6');
const NIGHT_AMBIENT = new THREE.Color('#2a3358');
const DAY_AMBIENT = new THREE.Color('#dfe9ff');

const SUN_DISTANCE = WORLD_HALF * 2.2;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function DayNight(): JSX.Element {
  const sun = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const { scene } = useThree();
  const skyColor = useRef(new THREE.Color());
  const lightColor = useRef(new THREE.Color());
  const ambientColor = useRef(new THREE.Color());

  useFrame(() => {
    const { world } = useGameStore.getState();
    const dayFrac = (world.tick % TICKS_PER_DAY) / TICKS_PER_DAY;

    // Elevation: -1 at midnight, 0 at dawn/dusk, +1 at noon.
    const elevation = -Math.cos(dayFrac * Math.PI * 2);
    const azimuth = dayFrac * Math.PI * 2;
    const daylight = smoothstep(-0.15, 0.35, elevation); // 0 night -> 1 day

    if (sun.current) {
      sun.current.position.set(
        Math.cos(azimuth) * SUN_DISTANCE,
        Math.max(elevation, -0.05) * SUN_DISTANCE + 6,
        Math.sin(azimuth) * SUN_DISTANCE,
      );
      sun.current.intensity = 0.15 + 1.05 * daylight;
      // Warm near the horizon, neutral at noon.
      const warmth = 1 - smoothstep(0.15, 0.6, elevation);
      lightColor.current.copy(NOON_LIGHT).lerp(WARM_LIGHT, warmth * daylight);
      sun.current.color.copy(lightColor.current);
    }

    if (ambient.current) {
      ambient.current.intensity = 0.35 + 0.4 * daylight;
      ambientColor.current.copy(NIGHT_AMBIENT).lerp(DAY_AMBIENT, daylight);
      ambient.current.color.copy(ambientColor.current);
    }

    skyColor.current.copy(NIGHT_SKY).lerp(DAY_SKY, daylight);
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(skyColor.current);
    } else {
      scene.background = skyColor.current.clone();
    }
    if (scene.fog) {
      (scene.fog as THREE.Fog).color.copy(skyColor.current);
    }
  });

  return (
    <>
      <ambientLight ref={ambient} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={SUN_DISTANCE * 2.5}
        shadow-camera-left={-WORLD_HALF}
        shadow-camera-right={WORLD_HALF}
        shadow-camera-top={WORLD_HALF}
        shadow-camera-bottom={-WORLD_HALF}
      />
    </>
  );
}
