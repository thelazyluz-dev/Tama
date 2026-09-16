// Resource nodes as simple spheres: blue = water, green = fruit (SPEC stage-0
// placeholder). Positions are seed-derived and static in stage 0, so this
// renders once per resource set. Read-only.

import { useMemo } from 'react';
import { heightAt } from '../sim';
import type { ResourceNode, TerrainData } from '../sim';
import { RESOURCE_COLOR } from './palette';

const RADIUS = 0.6;

export function Resources({
  resources,
  terrain,
}: {
  resources: readonly ResourceNode[];
  terrain: TerrainData;
}): JSX.Element {
  const placed = useMemo(
    () =>
      resources.map((node) => ({
        node,
        y: heightAt(terrain, node.position.x, node.position.z) + RADIUS,
      })),
    [resources, terrain],
  );

  return (
    <group>
      {placed.map(({ node, y }) => (
        <mesh key={node.id} position={[node.position.x, y, node.position.z]} castShadow>
          <sphereGeometry args={[RADIUS, 16, 16]} />
          <meshStandardMaterial
            color={RESOURCE_COLOR[node.type]}
            roughness={node.type === 'water' ? 0.2 : 0.7}
            metalness={node.type === 'water' ? 0.3 : 0}
            emissive={RESOURCE_COLOR[node.type]}
            emissiveIntensity={0.12}
          />
        </mesh>
      ))}
    </group>
  );
}
