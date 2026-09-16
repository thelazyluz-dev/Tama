// Flat-shaded, low-poly terrain built from the seed-derived heightmap. Pure
// rendering: it reads terrain data from the sim and never writes state.

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TerrainData } from '../sim';
import { WORLD_HALF, TERRAIN_HEIGHT } from '../sim';

const LOW_COLOR = new THREE.Color('#4f7942'); // valley grass
const HIGH_COLOR = new THREE.Color('#9b8b74'); // rocky ridge

export function Terrain({ terrain }: { terrain: TerrainData }): JSX.Element {
  const geometry = useMemo(() => {
    const { size, heights } = terrain;
    const cell = (2 * WORLD_HALF) / (size - 1);

    const positions = new Float32Array(size * size * 3);
    const colors = new Float32Array(size * size * 3);
    const tmp = new THREE.Color();

    for (let gz = 0; gz < size; gz++) {
      for (let gx = 0; gx < size; gx++) {
        const i = gz * size + gx;
        const y = heights[i]!;
        positions[i * 3] = -WORLD_HALF + gx * cell;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = -WORLD_HALF + gz * cell;

        const t = Math.min(1, Math.max(0, y / TERRAIN_HEIGHT));
        tmp.copy(LOW_COLOR).lerp(HIGH_COLOR, t);
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }
    }

    const indices: number[] = [];
    for (let gz = 0; gz < size - 1; gz++) {
      for (let gx = 0; gx < size - 1; gx++) {
        const a = gz * size + gx;
        const b = a + 1;
        const c = a + size;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [terrain]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
    </mesh>
  );
}
