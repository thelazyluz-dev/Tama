// The character — a low-poly chibi placeholder (big head, minimal face) per the
// SPEC's graphics note. Reads agent state imperatively each frame and eases
// toward it, faces its direction of travel, bobs while walking and lies down to
// sleep, and shows a speech bubble of the current action. Read-only.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { heightAt } from '../sim';
import { useGameStore } from '../store';
import { ACTION_COLOR, ACTION_BUBBLE } from './palette';

const SKIN = '#f0c9a0';

function ActionBubble(): JSX.Element | null {
  const action = useGameStore((s) => s.world.agent.currentAction?.type ?? null);
  const alive = useGameStore((s) => s.world.agent.alive);
  if (!alive || !action) return null;
  const { emoji, label } = ACTION_BUBBLE[action];
  return (
    <Html position={[0, 3.1, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
      <div className="agent-bubble">
        <span className="agent-bubble-emoji">{emoji}</span>
        {label}
      </div>
    </Html>
  );
}

export function Agent(): JSX.Element {
  const group = useRef<THREE.Group>(null); // world position + facing
  const rig = useRef<THREE.Group>(null); // animated pose
  const body = useRef<THREE.MeshStandardMaterial>(null);
  const target = useRef(new THREE.Color(ACTION_COLOR.wander));
  const prev = useRef({ x: 0, z: 0, init: false });

  useFrame((state, rawDelta) => {
    const g = group.current;
    const r = rig.current;
    if (!g || !r) return;
    const { world } = useGameStore.getState();
    const agent = world.agent;
    const dt = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;

    const gx = agent.position.x;
    const gz = agent.position.z;

    if (!prev.current.init) {
      g.position.set(gx, heightAt(world.terrain, gx, gz), gz);
      prev.current = { x: gx, z: gz, init: true };
    } else {
      const ease = 1 - Math.exp(-8 * dt);
      g.position.x += (gx - g.position.x) * ease;
      g.position.z += (gz - g.position.z) * ease;
      g.position.y = heightAt(world.terrain, g.position.x, g.position.z);
    }

    // Movement speed (world units/sec) from how far the mesh moved this frame.
    const dx = g.position.x - prev.current.x;
    const dz = g.position.z - prev.current.z;
    prev.current.x = g.position.x;
    prev.current.z = g.position.z;
    const speed = Math.hypot(dx, dz) / dt;
    const walking = speed > 0.4;

    // Face the direction of travel.
    if (walking) {
      const heading = Math.atan2(dx, dz);
      let d = heading - g.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      g.rotation.y += d * (1 - Math.exp(-10 * dt));
    }

    const action = agent.currentAction;
    const sleeping = action?.type === 'sleep' && action.inRange && agent.alive;

    // Pose: lie down to sleep, otherwise bob (walk) / breathe (idle).
    const poseEase = 1 - Math.exp(-8 * dt);
    if (sleeping) {
      r.rotation.z += (-1.3 - r.rotation.z) * poseEase;
      r.position.y += (0.25 - r.position.y) * poseEase;
    } else {
      r.rotation.z += (0 - r.rotation.z) * poseEase;
      const bob = walking ? Math.abs(Math.sin(t * 9)) * 0.14 : Math.sin(t * 2) * 0.03;
      r.position.y += (bob - r.position.y) * poseEase;
    }

    // Body colour follows the action, eased.
    if (body.current && agent.alive) {
      target.current.set(ACTION_COLOR[action?.type ?? 'wander']);
      body.current.color.lerp(target.current, 1 - Math.exp(-6 * dt));
    }
  });

  return (
    <group ref={group}>
      {/* marker ring on the ground — always lit, easy to find */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.85, 1.15, 28]} />
        <meshBasicMaterial color="#bfe3ff" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <group ref={rig}>
        {/* body */}
        <mesh position={[0, 0.75, 0]} castShadow>
          <capsuleGeometry args={[0.4, 0.7, 6, 16]} />
          <meshStandardMaterial ref={body} roughness={0.65} metalness={0.05} />
        </mesh>
        {/* head (big, chibi) */}
        <mesh position={[0, 1.75, 0]} castShadow>
          <sphereGeometry args={[0.52, 20, 20]} />
          <meshStandardMaterial color={SKIN} roughness={0.85} />
        </mesh>
        {/* eyes */}
        <mesh position={[0.19, 1.82, 0.42]}>
          <sphereGeometry args={[0.075, 10, 10]} />
          <meshStandardMaterial color="#2a2320" />
        </mesh>
        <mesh position={[-0.19, 1.82, 0.42]}>
          <sphereGeometry args={[0.075, 10, 10]} />
          <meshStandardMaterial color="#2a2320" />
        </mesh>
      </group>

      <ActionBubble />
    </group>
  );
}
