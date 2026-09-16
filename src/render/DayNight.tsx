// Day-night cycle: a single directional "sun" plus ambient fill, with sky
// (background + fog) colour tracking the time of day. Driven continuously from
// the world tick so it eases through dawn/dusk. Read-only.

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TICKS_PER_DAY, WORLD_HALF } from '../sim';
import { useGameStore } from '../store';

// Kept deliberately readable: nights are moonlit blue, never pitch black.
const NIGHT_SKY = new THREE.Color('#233251');
const DAY_SKY = new THREE.Color('#8ec5ff');
const WARM_LIGHT = new THREE.Color('#ffb367');
const NOON_LIGHT = new THREE.Color('#fff6e6');
const MOON_LIGHT = new THREE.Color('#9fb6e8');
const NIGHT_AMBIENT = new THREE.Color('#556488');
const DAY_AMBIENT = new THREE.Color('#eef3ff');

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
    const daylight = smoothstep(-0.28, 0.3, elevation); // 0 night -> 1 day

    if (sun.current) {
      // Keep the key light above the horizon even at night (a "moon").
      sun.current.position.set(
        Math.cos(azimuth) * SUN_DISTANCE,
        Math.max(Math.abs(elevation) * 0.6 + 0.25, 0.25) * SUN_DISTANCE + 6,
        Math.sin(azimuth) * SUN_DISTANCE,
      );
      sun.current.intensity = 0.5 + 0.85 * daylight; // 0.5 floor = moonlight
      const warmth = 1 - smoothstep(0.15, 0.6, elevation);
      lightColor.current
        .copy(NOON_LIGHT)
        .lerp(WARM_LIGHT, warmth * daylight)
        .lerp(MOON_LIGHT, 1 - daylight);
      sun.current.color.copy(lightColor.current);
    }

    if (ambient.current) {
      ambient.current.intensity = 0.62 + 0.4 * daylight; // bright enough at night
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
