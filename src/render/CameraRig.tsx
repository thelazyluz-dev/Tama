// Keeps the camera gently following the agent so the capsule stays centred and
// is never hidden behind a HUD panel. The user can still orbit and zoom — we
// only pan the controls' target (and the camera with it) toward the agent, so
// their chosen angle and distance are preserved. Read-only.

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt, playerAgent } from '../sim';
import { useGameStore } from '../store';

// Minimal shape we rely on from drei's OrbitControls.
interface OrbitLike {
  target: THREE.Vector3;
  update(): void;
}

export function CameraRig(): null {
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef(new THREE.Vector3());
  const delta = useRef(new THREE.Vector3());

  useFrame((_, rawDelta) => {
    if (!controls) return;
    const { world } = useGameStore.getState();
    const a = playerAgent(world).position;
    const y = heightAt(world.terrain, a.x, a.z) + 1;
    goal.current.set(a.x, y, a.z);

    const ease = 1 - Math.exp(-2.5 * Math.min(rawDelta, 0.1));
    delta.current.copy(goal.current).sub(controls.target).multiplyScalar(ease);
    // Move target and camera together => a true follow that preserves the
    // user's orbit angle and zoom distance.
    controls.target.add(delta.current);
    camera.position.add(delta.current);
    controls.update();
  });

  return null;
}
