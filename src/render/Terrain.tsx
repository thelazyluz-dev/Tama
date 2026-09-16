// Stylised low-poly terrain built from the seed heightmap, coloured by biome
// (sand near the lowlands, grass, rock on steep slopes, snow on the peaks) with
// a lower snow line in winter. Flat-shaded for a crisp faceted look that reads
// well under AO + soft shadows. Pure rendering; never writes state.

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TerrainData, Season } from '../sim';
import { WORLD_HALF, TERRAIN_HEIGHT } from '../sim';

const SAND = new THREE.Color('#c9b784');
const GRASS_LOW = new THREE.Color('#3f7a3c');
const GRASS = new THREE.Color('#5aa64d');
const GRASS_DRY = new THREE.Color('#8f9b52');
const ROCK = new THREE.Color('#786c5c');
const SNOW = new THREE.Color('#eef3f8');

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s); // 0..1
}

function biomeColor(out: THREE.Color, hn: number, slope: number, snowLine: number): void {
  // Base by elevation.
  if (hn < 0.13) out.copy(SAND).lerp(GRASS_LOW, hn / 0.13);
  else if (hn < 0.5) out.copy(GRASS_LOW).lerp(GRASS, (hn - 0.13) / 0.37);
  else if (hn < 0.7) out.copy(GRASS).lerp(GRASS_DRY, (hn - 0.5) / 0.2);
  else out.copy(GRASS_DRY).lerp(ROCK, Math.min(1, (hn - 0.7) / 0.2));

  // Rock shows through on steep slopes.
  const steep = THREE.MathUtils.smoothstep(slope, 0.55, 1.1);
  out.lerp(ROCK, steep * 0.85);

  // Snow above the snow line (lower in winter), never on the steepest cliffs.
  const snow = THREE.MathUtils.smoothstep(hn, snowLine, snowLine + 0.12) * (1 - steep * 0.5);
  out.lerp(SNOW, snow);
}

export function Terrain({ terrain, season }: { terrain: TerrainData; season: Season }): JSX.Element {
  const geometry = useMemo(() => {
    const { size, heights } = terrain;
    const cell = (2 * WORLD_HALF) / (size - 1);
    const snowLine = season === 'winter' ? 0.5 : season === 'autumn' ? 0.78 : 0.86;

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

        // Slope from the local height gradient.
        const hl = heights[gz * size + Math.max(0, gx - 1)]!;
        const hr = heights[gz * size + Math.min(size - 1, gx + 1)]!;
        const hd = heights[Math.max(0, gz - 1) * size + gx]!;
        const hu = heights[Math.min(size - 1, gz + 1) * size + gx]!;
        const slope = (Math.abs(hr - hl) + Math.abs(hu - hd)) / (2 * cell);

        const hn = Math.min(1, Math.max(0, y / TERRAIN_HEIGHT));
        biomeColor(tmp, hn, slope, snowLine);
        // Subtle per-vertex variation so large faces don't read as flat paint.
        const n = (hash2(gx, gz) - 0.5) * 0.06;
        colors[i * 3] = Math.min(1, Math.max(0, tmp.r + n));
        colors[i * 3 + 1] = Math.min(1, Math.max(0, tmp.g + n));
        colors[i * 3 + 2] = Math.min(1, Math.max(0, tmp.b + n));
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
  }, [terrain, season]);

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.96} metalness={0} />
    </mesh>
  );
}
