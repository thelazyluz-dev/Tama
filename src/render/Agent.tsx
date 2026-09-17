// The characters — a stylised low-poly figure per agent, animated procedurally
// (faces its heading, walks with a leg/arm swing, breathes idle, lies down to
// sleep). Body (shirt) is tinted by the current action, and a speech bubble
// shows what it is doing. Read-only.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { heightAt, getAgent } from '../sim';
import { useGameStore } from '../store';
import { ACTION_COLOR, ACTION_BUBBLE } from './palette';

const SKIN = '#f0c19a';
const HAIR_F = '#3a2a1c';
const HAIR_M = '#241b12';
const PANTS = '#3b465e';

function ActionBubble({ agentId }: { agentId: string }): JSX.Element | null {
  const action = useGameStore((s) => getAgent(s.world, agentId)?.currentAction?.type ?? null);
  const alive = useGameStore((s) => getAgent(s.world, agentId)?.alive ?? false);
  if (!alive || !action) return null;
  const { emoji, label } = ACTION_BUBBLE[action];
  return (
    <Html position={[0, 3.0, 0]} center distanceFactor={13} zIndexRange={[10, 0]}>
      <div className="agent-bubble">
        <span className="agent-bubble-emoji">{emoji}</span>
        {label}
      </div>
    </Html>
  );
}

function AgentFigure({ agentId, isPlayer }: { agentId: string; isPlayer: boolean }): JSX.Element {
  const group = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null);
  const body = useRef<THREE.MeshStandardMaterial>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Color(ACTION_COLOR.wander));
  const prev = useRef({ x: 0, z: 0, init: false });
  const phase = useRef(0);

  useFrame((state, rawDelta) => {
    const g = group.current;
    const r = rig.current;
    if (!g || !r) return;
    const world = useGameStore.getState().world;
    const agent = getAgent(world, agentId);
    if (!agent) return;
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

    const dx = g.position.x - prev.current.x;
    const dz = g.position.z - prev.current.z;
    prev.current.x = g.position.x;
    prev.current.z = g.position.z;
    const speed = Math.hypot(dx, dz) / dt;
    const walking = speed > 0.35;

    if (walking) {
      const heading = Math.atan2(dx, dz);
      let d = heading - g.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      g.rotation.y += d * (1 - Math.exp(-10 * dt));
    }

    const action = agent.currentAction;
    const sleeping = action?.type === 'sleep' && action.inRange && agent.alive;
    const busy = action?.inRange && !sleeping && action.type !== 'wander';

    phase.current += (walking ? speed * 2.2 : 0) * dt;
    const swing = Math.sin(phase.current);
    const lerp = 1 - Math.exp(-12 * dt);
    const set = (grp: THREE.Group | null, x: number) => {
      if (grp) grp.rotation.x += (x - grp.rotation.x) * lerp;
    };
    if (walking) {
      set(legL.current, swing * 0.55);
      set(legR.current, -swing * 0.55);
      set(armL.current, -swing * 0.4);
      set(armR.current, swing * 0.4);
    } else if (busy) {
      const w = Math.sin(t * 6) * 0.5;
      set(armL.current, -0.6 + w);
      set(armR.current, -0.6 - w);
      set(legL.current, 0);
      set(legR.current, 0);
    } else {
      set(legL.current, 0);
      set(legR.current, 0);
      set(armL.current, 0);
      set(armR.current, 0);
    }

    const poseEase = 1 - Math.exp(-8 * dt);
    if (sleeping) {
      r.rotation.z += (-1.35 - r.rotation.z) * poseEase;
      r.position.y += (0.15 - r.position.y) * poseEase;
    } else {
      r.rotation.z += (0 - r.rotation.z) * poseEase;
      const bob = walking ? Math.abs(swing) * 0.06 : Math.sin(t * 2) * 0.025;
      r.position.y += (bob - r.position.y) * poseEase;
    }

    if (body.current) {
      const col = agent.alive ? ACTION_COLOR[action?.type ?? 'wander'] : '#6b6b6b';
      target.current.set(col);
      body.current.color.lerp(target.current, 1 - Math.exp(-6 * dt));
    }
  });

  const hair = isPlayer ? HAIR_F : HAIR_M;
  const ringColor = isPlayer ? '#bfe3ff' : '#ffd39b';

  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.8, 1.05, 28]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.45} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <group ref={rig}>
        <group ref={legL} position={[0.16, 0.85, 0]}>
          <mesh position={[0, -0.4, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.5, 4, 8]} />
            <meshStandardMaterial color={PANTS} roughness={0.9} />
          </mesh>
        </group>
        <group ref={legR} position={[-0.16, 0.85, 0]}>
          <mesh position={[0, -0.4, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.5, 4, 8]} />
            <meshStandardMaterial color={PANTS} roughness={0.9} />
          </mesh>
        </group>

        <mesh position={[0, 1.18, 0]} castShadow>
          <capsuleGeometry args={[0.3, 0.5, 6, 14]} />
          <meshStandardMaterial ref={body} roughness={0.7} metalness={0.03} />
        </mesh>

        <group ref={armL} position={[0.4, 1.5, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.42, 4, 8]} />
            <meshStandardMaterial color={SKIN} roughness={0.85} />
          </mesh>
        </group>
        <group ref={armR} position={[-0.4, 1.5, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.42, 4, 8]} />
            <meshStandardMaterial color={SKIN} roughness={0.85} />
          </mesh>
        </group>

        <mesh position={[0, 1.92, 0]} castShadow>
          <sphereGeometry args={[0.42, 20, 20]} />
          <meshStandardMaterial color={SKIN} roughness={0.82} />
        </mesh>
        <mesh position={[0, 1.95, 0]}>
          <sphereGeometry args={[0.45, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={hair} roughness={0.95} />
        </mesh>
        <mesh position={[0.15, 1.95, 0.36]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color="#2a2320" />
        </mesh>
        <mesh position={[-0.15, 1.95, 0.36]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color="#2a2320" />
        </mesh>
      </group>

      <ActionBubble agentId={agentId} />
    </group>
  );
}

export function Agents(): JSX.Element {
  // Re-renders only when the roster changes, not every tick.
  const ids = useGameStore((s) => s.world.agents.map((a) => a.id).join('|'));
  const playerId = useGameStore((s) => s.world.playerAgentId);
  const list = ids ? ids.split('|') : [];
  return (
    <group>
      {list.map((id) => (
        <AgentFigure key={id} agentId={id} isPlayer={id === playerId} />
      ))}
    </group>
  );
}
