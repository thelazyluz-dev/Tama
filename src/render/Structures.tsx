// Renders built structures: shelter (a simple timber hut placeholder) and fire
// (an ember cone with a flickering light while it has fuel). Read-only.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt } from '../sim';
import type { Structure, TerrainData } from '../sim';
import { useGameStore } from '../store';

function Shelter({ y, position }: { y: number; position: { x: number; z: number } }): JSX.Element {
  return (
    <group position={[position.x, y, position.z]}>
      {/* walls */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 2, 3]} />
        <meshStandardMaterial color="#8a6a44" roughness={0.9} />
      </mesh>
      {/* roof */}
      <mesh position={[0, 2.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.6, 1.6, 4]} />
        <meshStandardMaterial color="#5f4630" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

function Fire({ structure, y }: { structure: Structure; y: number }): JSX.Element {
  const light = useRef<THREE.PointLight>(null);
  const lit = structure.fuel > 0;

  useFrame((state) => {
    if (!light.current) return;
    // Flicker while burning; dim embers otherwise.
    const t = state.clock.elapsedTime;
    const base = lit ? 2.2 : 0.15;
    light.current.intensity = base + (lit ? Math.sin(t * 12) * 0.4 + Math.sin(t * 7.3) * 0.3 : 0);
  });

  return (
    <group position={[structure.position.x, y, structure.position.z]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <coneGeometry args={[0.6, 1.1, 8]} />
        <meshStandardMaterial
          color={lit ? '#ff7a2f' : '#4a3b33'}
          emissive={lit ? '#ff5a1f' : '#000000'}
          emissiveIntensity={lit ? 0.9 : 0}
          roughness={0.6}
        />
      </mesh>
      <pointLight ref={light} color="#ff8b3d" distance={14} decay={2} position={[0, 1.2, 0]} />
    </group>
  );
}

export function Structures({ terrain }: { terrain: TerrainData }): JSX.Element {
  const structures = useGameStore((s) => s.world.structures);

  const placed = useMemo(
    () =>
      structures.map((s) => ({
        s,
        y: heightAt(terrain, s.position.x, s.position.z),
      })),
    [structures, terrain],
  );

  return (
    <group>
      {placed.map(({ s, y }) =>
        s.type === 'shelter' ? (
          <Shelter key={s.id} y={y} position={s.position} />
        ) : (
          <Fire key={s.id} structure={s} y={y} />
        ),
      )}
    </group>
  );
}
