// Weather effects — falling snow while it is snowing. Purely decorative and
// read-only; driven by the sim's weather flag.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_HALF, TERRAIN_HEIGHT } from '../sim';
import { useGameStore } from '../store';

const COUNT = 700;
const TOP = TERRAIN_HEIGHT + 24;
const SPAN = WORLD_HALF * 2;

export function Weather(): JSX.Element {
  const weather = useGameStore((s) => s.world.weather);
  const points = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * SPAN;
      arr[i * 3 + 1] = Math.random() * TOP;
      arr[i * 3 + 2] = (Math.random() - 0.5) * SPAN;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    const p = points.current;
    if (!p || weather !== 'snow') return;
    const attr = p.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const dt = Math.min(delta, 0.1);
    for (let i = 0; i < COUNT; i++) {
      const yi = i * 3 + 1;
      arr[yi] -= (2.5 + (i % 5)) * dt;
      arr[i * 3] += Math.sin((arr[yi] + i) * 0.5) * dt * 0.4;
      if (arr[yi] < 0) {
        arr[yi] = TOP;
        arr[i * 3] = (Math.random() - 0.5) * SPAN;
        arr[i * 3 + 2] = (Math.random() - 0.5) * SPAN;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} visible={weather === 'snow'}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#eaf2ff" size={0.35} sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}
