// Water resource nodes as small ponds (was: blue balloons). A translucent
// low-roughness disc reads as water under bloom + reflections, with a darker
// rim and a gentle ripple. Read-only.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt } from '../sim';
import type { ResourceNode, TerrainData } from '../sim';

const RADIUS = 3.4;

function Pond({ x, y, z, phase }: { x: number; y: number; z: number; phase: number }): JSX.Element {
  const surface = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!surface.current) return;
    // Barely-there breathing ripple.
    const t = state.clock.elapsedTime + phase;
    surface.current.scale.setScalar(1 + Math.sin(t * 1.3) * 0.012);
  });
  return (
    <group position={[x, y + 0.05, z]}>
      {/* muddy rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <circleGeometry args={[RADIUS * 1.12, 28]} />
        <meshStandardMaterial color="#5a5038" roughness={1} />
      </mesh>
      {/* water surface */}
      <mesh ref={surface} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RADIUS, 32]} />
        <meshStandardMaterial
          color="#2f6f9e"
          transparent
          opacity={0.82}
          roughness={0.12}
          metalness={0.35}
          emissive="#123246"
          emissiveIntensity={0.25}
        />
      </mesh>
    </group>
  );
}

export function Ponds({
  resources,
  terrain,
}: {
  resources: readonly ResourceNode[];
  terrain: TerrainData;
}): JSX.Element {
  const ponds = useMemo(
    () =>
      resources
        .filter((r) => r.type === 'water')
        .map((r, i) => ({
          id: r.id,
          x: r.position.x,
          y: heightAt(terrain, r.position.x, r.position.z),
          z: r.position.z,
          phase: i * 1.7,
        })),
    [resources, terrain],
  );

  return (
    <group>
      {ponds.map((p) => (
        <Pond key={p.id} x={p.x} y={p.y} z={p.z} phase={p.phase} />
      ))}
    </group>
  );
}
