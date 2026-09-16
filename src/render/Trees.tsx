// Low-poly fruit trees standing in for the fruit resource nodes (was: green
// balloons). Deterministic per-node variation; bare and snow-dusted in winter.
// Positions are static, so this renders once per season. Read-only.

import { useMemo } from 'react';
import { heightAt } from '../sim';
import type { ResourceNode, TerrainData, Season } from '../sim';

const FOLIAGE = ['#3f8f3a', '#4f9c46', '#5aa650', '#679a3f'];

function hash(n: number): number {
  const s = Math.sin(n * 78.233 + 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function Tree({
  x,
  y,
  z,
  index,
  season,
}: {
  x: number;
  y: number;
  z: number;
  index: number;
  season: Season;
}): JSX.Element {
  const h0 = hash(index);
  const h1 = hash(index * 2.3 + 1);
  const scale = 0.8 + h0 * 0.6;
  const rot = h1 * Math.PI * 2;
  const winter = season === 'winter';
  const foliage = FOLIAGE[Math.floor(h0 * FOLIAGE.length) % FOLIAGE.length];
  const trunkH = 1.5 * scale;

  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]} scale={scale}>
      {/* trunk */}
      <mesh position={[0, trunkH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, trunkH, 6]} />
        <meshStandardMaterial color="#6b4a2f" roughness={1} flatShading />
      </mesh>
      {winter ? (
        // bare, snow-dusted crown
        <>
          <mesh position={[0, trunkH + 0.5, 0]} castShadow>
            <icosahedronGeometry args={[0.85, 0]} />
            <meshStandardMaterial color="#6a5a44" roughness={1} flatShading />
          </mesh>
          <mesh position={[0, trunkH + 0.95, 0]} castShadow>
            <icosahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial color="#e8eef5" roughness={1} flatShading />
          </mesh>
        </>
      ) : (
        <>
          {/* leafy crown — a few stacked low-poly blobs */}
          <mesh position={[0, trunkH + 0.35, 0]} castShadow>
            <icosahedronGeometry args={[1.05, 0]} />
            <meshStandardMaterial color={foliage} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0.35, trunkH + 0.95, 0.1]} castShadow>
            <icosahedronGeometry args={[0.7, 0]} />
            <meshStandardMaterial color={foliage} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[-0.3, trunkH + 0.85, -0.2]} castShadow>
            <icosahedronGeometry args={[0.62, 0]} />
            <meshStandardMaterial color={foliage} roughness={0.9} flatShading />
          </mesh>
          {/* berries */}
          {[0, 1, 2, 3].map((b) => {
              const a = hash(index * 7 + b) * Math.PI * 2;
              const rr = 0.7 + hash(index + b) * 0.35;
              return (
                <mesh
                  key={b}
                  position={[Math.cos(a) * rr, trunkH + 0.5 + hash(index * 3 + b) * 0.6, Math.sin(a) * rr]}
                >
                  <sphereGeometry args={[0.11, 8, 8]} />
                  <meshStandardMaterial color="#e0483a" roughness={0.5} emissive="#7a1a12" emissiveIntensity={0.2} />
                </mesh>
              );
            })}
        </>
      )}
    </group>
  );
}

export function Trees({
  resources,
  terrain,
  season,
}: {
  resources: readonly ResourceNode[];
  terrain: TerrainData;
  season: Season;
}): JSX.Element {
  const trees = useMemo(
    () =>
      resources
        .filter((r) => r.type === 'fruit')
        .map((r, i) => ({
          id: r.id,
          x: r.position.x,
          y: heightAt(terrain, r.position.x, r.position.z),
          z: r.position.z,
          index: i,
        })),
    [resources, terrain],
  );

  return (
    <group>
      {trees.map((t) => (
        <Tree key={t.id} x={t.x} y={t.y} z={t.z} index={t.index} season={season} />
      ))}
    </group>
  );
}
