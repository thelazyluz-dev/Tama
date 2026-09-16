// The living capsule. It reads agent state imperatively every frame and eases
// toward it, so the ×1 tick cadence looks like smooth movement. Read-only: it
// never writes to the store.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt } from '../sim';
import { useGameStore } from '../store';
import { ACTION_COLOR } from './palette';

const RADIUS = 0.45;
const LENGTH = 1.1;
const GROUND_OFFSET = RADIUS + LENGTH / 2; // capsule centre above the surface

export function Agent(): JSX.Element {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const targetColor = useRef(new THREE.Color(ACTION_COLOR.wander));
  const initialized = useRef(false);

  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    const { world } = useGameStore.getState();
    const agent = world.agent;
    const delta = Math.min(rawDelta, 0.1);

    const gx = agent.position.x;
    const gz = agent.position.z;

    if (!initialized.current) {
      g.position.set(gx, heightAt(world.terrain, gx, gz) + GROUND_OFFSET, gz);
      initialized.current = true;
    } else {
      const ease = 1 - Math.exp(-8 * delta);
      g.position.x += (gx - g.position.x) * ease;
      g.position.z += (gz - g.position.z) * ease;
      g.position.y =
        heightAt(world.terrain, g.position.x, g.position.z) + GROUND_OFFSET;
    }

    // Colour follows the current action, eased for a soft transition.
    const action = agent.currentAction?.type ?? 'wander';
    targetColor.current.set(ACTION_COLOR[action]);
    if (material.current) {
      material.current.color.lerp(targetColor.current, 1 - Math.exp(-6 * delta));
    }
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <capsuleGeometry args={[RADIUS, LENGTH, 6, 16]} />
        <meshStandardMaterial ref={material} roughness={0.6} metalness={0.05} />
      </mesh>
    </group>
  );
}
