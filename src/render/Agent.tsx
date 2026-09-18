// The characters — a "bean" creature per agent (SPEC stage-6 direction: a small
// person-creature with a real, expressive face). Each individual's LOOK is
// derived from its traits (curiosity → eye size, constitution → body size,
// sociability → blush, temper → brows) and colour, so children resemble their
// parents (traits are inherited). The FACE reflects the agent's live mood —
// hungry, cold, sleepy, sick, content, happy — the thing that makes you care.
// Read-only: it renders sim state, never writes it.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { heightAt, getAgent, ADULT_MIN_AGE_DAYS } from '../sim';
import type { Agent } from '../sim';
import { useGameStore } from '../store';
import { ACTION_BUBBLE } from './palette';

type Mood = 'happy' | 'content' | 'hungry' | 'cold' | 'sleepy' | 'sick' | 'sad';

const COLD_TINT = new THREE.Color(0.62, 0.76, 0.96);
const SICK_TINT = new THREE.Color(0.6, 0.78, 0.5);

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

interface Identity {
  base: THREE.Color;
  belly: THREE.Color;
  tuft: THREE.Color;
  eyeSize: number;
  eyeSep: number;
  bodyScale: number;
  browAngle: number;
  blush: number;
}

/** A stable look derived from the agent's inherited traits (so kin resemble). */
function identityOf(a: Agent): Identity {
  const t = a.traits;
  const idj = hash01(a.id); // small per-individual jitter
  // Hue is trait-driven (inheritable), nudged a little per individual.
  let hue = t.curiosity * 0.4 + t.sociability * 0.35 + t.constitution * 0.25;
  hue = (hue * 0.85 + idj * 0.15) % 1;
  const base = new THREE.Color().setHSL(hue, 0.42 + t.sociability * 0.18, 0.58 + idj * 0.08);
  const belly = base.clone().lerp(new THREE.Color(0xffffff), 0.45);
  const tuft = base.clone().lerp(new THREE.Color(0x000000), 0.28);
  return {
    base,
    belly,
    tuft,
    eyeSize: 0.088 + t.curiosity * 0.05,
    eyeSep: 0.17,
    bodyScale: 0.9 + t.constitution * 0.22,
    browAngle: (t.temper - 0.5) * 0.9, // hot-tempered → slanted brows
    blush: t.sociability,
  };
}

function moodOf(a: Agent): Mood {
  if (a.health < 30) return 'sick';
  const act = a.currentAction;
  if (act?.type === 'sleep' && act.inRange) return 'sleepy';
  if (a.needs.warmth > 68) return 'cold';
  if (a.needs.hunger > 70 || a.needs.thirst > 75) return 'hungry';
  if (a.needs.fatigue > 82) return 'sleepy';
  if (a.needs.loneliness > 76) return 'sad';
  if (a.health > 68 && a.needs.hunger < 42 && a.needs.thirst < 45 && a.needs.warmth < 50) return 'happy';
  return 'content';
}

function ActionBubble({ agentId }: { agentId: string }): JSX.Element | null {
  const action = useGameStore((s) => getAgent(s.world, agentId)?.currentAction?.type ?? null);
  const alive = useGameStore((s) => getAgent(s.world, agentId)?.alive ?? false);
  if (!alive || !action) return null;
  const { emoji, label } = ACTION_BUBBLE[action];
  return (
    <Html position={[0, 2.4, 0]} center distanceFactor={12} zIndexRange={[10, 0]}>
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
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const mouthSmile = useRef<THREE.Mesh>(null);
  const mouthFrown = useRef<THREE.Mesh>(null);
  const mouthOpen = useRef<THREE.Mesh>(null);
  const mouthFlat = useRef<THREE.Mesh>(null);
  const cheeks = useRef<THREE.Group>(null);
  const prev = useRef({ x: 0, z: 0, init: false });
  const phase = useRef(0);
  const tintTarget = useRef(new THREE.Color());

  // Identity is stable per agent (from inherited traits) — computed once.
  const id = useMemo(() => {
    const a = getAgent(useGameStore.getState().world, agentId);
    return a ? identityOf(a) : null;
  }, [agentId]);

  useFrame((state, rawDelta) => {
    const g = group.current;
    const r = rig.current;
    if (!g || !r || !id) return;
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

    // Children are smaller, growing to full size at adulthood.
    const age = world.day - agent.birthDay;
    const grow = 0.5 + 0.5 * Math.min(1, Math.max(0, age / ADULT_MIN_AGE_DAYS));
    const targetScale = grow * id.bodyScale;
    const s = g.scale.x + (targetScale - g.scale.x) * (1 - Math.exp(-4 * dt));
    g.scale.setScalar(s);

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
      set(legL.current, swing * 0.5);
      set(legR.current, -swing * 0.5);
      set(armL.current, -swing * 0.45);
      set(armR.current, swing * 0.45);
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
      r.rotation.z += (-1.3 - r.rotation.z) * poseEase;
      r.position.y += (0.1 - r.position.y) * poseEase;
    } else {
      r.rotation.z += (0 - r.rotation.z) * poseEase;
      const bob = walking ? Math.abs(swing) * 0.06 : Math.sin(t * 2 + phase.current) * 0.02;
      r.position.y += (bob - r.position.y) * poseEase;
    }

    // --- expression -------------------------------------------------------
    const mood = agent.alive ? moodOf(agent) : 'content';
    const smiling = mood === 'happy' || mood === 'content';
    const closedEyes = mood === 'sleepy' || mood === 'sick';
    if (mouthSmile.current) mouthSmile.current.visible = smiling;
    if (mouthFrown.current) mouthFrown.current.visible = mood === 'cold' || mood === 'sad';
    if (mouthOpen.current) mouthOpen.current.visible = mood === 'hungry';
    if (mouthFlat.current) mouthFlat.current.visible = closedEyes;
    if (cheeks.current) cheeks.current.visible = mood === 'happy' || (mood === 'content' && id.blush > 0.5);

    if (eyes.current) {
      // blink, or hold closed when sleepy/sick
      const blink = (t * 0.6 + phase.current) % 3.4 < 0.13;
      const targetY = closedEyes ? 0.12 : blink ? 0.1 : 1;
      eyes.current.scale.y += (targetY - eyes.current.scale.y) * (1 - Math.exp(-18 * dt));
    }

    if (bodyMat.current) {
      tintTarget.current.copy(id.base);
      if (mood === 'cold') tintTarget.current.lerp(COLD_TINT, 0.5);
      else if (mood === 'sick') tintTarget.current.lerp(SICK_TINT, 0.45);
      if (!agent.alive) tintTarget.current.setRGB(0.42, 0.42, 0.42);
      bodyMat.current.color.lerp(tintTarget.current, 1 - Math.exp(-6 * dt));
    }
  });

  const ringColor = isPlayer ? '#bfe3ff' : '#ffd39b';
  if (!id) return <group ref={group} />;
  const es = id.eyeSize;

  const eye = (side: number): JSX.Element => (
    <group position={[side * id.eyeSep, 0, 0]}>
      <mesh scale={[1, 1, 0.55]}>
        <sphereGeometry args={[es, 18, 18]} />
        <meshStandardMaterial color="#ffffff" roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, es * 0.55]}>
        <sphereGeometry args={[es * 0.55, 14, 14]} />
        <meshStandardMaterial color="#1b1520" roughness={0.2} />
      </mesh>
      <mesh position={[side * es * 0.2, es * 0.25, es * 0.8]}>
        <sphereGeometry args={[es * 0.16, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[side * -0.02, es * 1.15, -es * 0.1]} rotation={[0, 0, side * id.browAngle]}>
        <boxGeometry args={[es * 1.3, es * 0.22, es * 0.4]} />
        <meshStandardMaterial color="#2a2028" roughness={0.7} />
      </mesh>
    </group>
  );

  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.55, 0.72, 28]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.45} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <group ref={rig}>
        {/* legs */}
        <group ref={legL} position={[0.2, 0.5, 0.02]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.15, 0.16, 6, 12]} />
            <meshStandardMaterial color={id.base.clone().lerp(new THREE.Color(0, 0, 0), 0.12).getStyle()} roughness={0.75} />
          </mesh>
        </group>
        <group ref={legR} position={[-0.2, 0.5, 0.02]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.15, 0.16, 6, 12]} />
            <meshStandardMaterial color={id.base.clone().lerp(new THREE.Color(0, 0, 0), 0.12).getStyle()} roughness={0.75} />
          </mesh>
        </group>

        {/* body */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <capsuleGeometry args={[0.5, 0.62, 10, 20]} />
          <meshStandardMaterial ref={bodyMat} color={id.base.getStyle()} roughness={0.6} />
        </mesh>
        {/* belly patch */}
        <mesh position={[0, 0.86, 0.4]} scale={[0.72, 1.0, 0.4]}>
          <sphereGeometry args={[0.42, 18, 18]} />
          <meshStandardMaterial color={id.belly.getStyle()} roughness={0.7} />
        </mesh>
        {/* tuft */}
        <mesh position={[0, 1.66, -0.02]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color={id.tuft.getStyle()} roughness={0.85} />
        </mesh>

        {/* arms */}
        <group ref={armL} position={[0.5, 1.12, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.2, 6, 12]} />
            <meshStandardMaterial color={id.base.getStyle()} roughness={0.65} />
          </mesh>
        </group>
        <group ref={armR} position={[-0.5, 1.12, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.2, 6, 12]} />
            <meshStandardMaterial color={id.base.getStyle()} roughness={0.65} />
          </mesh>
        </group>

        {/* face — on the upper front of the body */}
        <group position={[0, 1.28, 0.42]}>
          <group ref={eyes}>
            {eye(1)}
            {eye(-1)}
          </group>

          <mesh ref={mouthSmile} position={[0, -es * 1.7, 0.02]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[es * 1.15, es * 0.13, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#3a1b22" roughness={0.5} />
          </mesh>
          <mesh ref={mouthFrown} visible={false} position={[0, -es * 1.4, 0.02]} rotation={[0, 0, Math.PI * 0.2]}>
            <torusGeometry args={[es * 1.0, es * 0.12, 8, 16, Math.PI * 0.6]} />
            <meshStandardMaterial color="#3a1b22" roughness={0.5} />
          </mesh>
          <mesh ref={mouthOpen} visible={false} position={[0, -es * 1.7, 0.02]} scale={[0.9, 1.3, 0.5]}>
            <sphereGeometry args={[es * 0.6, 14, 14]} />
            <meshStandardMaterial color="#3a1b22" roughness={0.5} />
          </mesh>
          <mesh ref={mouthFlat} visible={false} position={[0, -es * 1.55, 0.02]} scale={[1.5, 0.6, 0.5]}>
            <sphereGeometry args={[es * 0.34, 10, 10]} />
            <meshStandardMaterial color="#3a1b22" roughness={0.5} />
          </mesh>

          <group ref={cheeks} visible={false}>
            <mesh position={[id.eyeSep * 1.7, -es * 0.9, 0.05]} scale={[1, 0.7, 0.3]}>
              <sphereGeometry args={[es * 0.62, 12, 12]} />
              <meshStandardMaterial color="#ff9db0" roughness={0.6} transparent opacity={0.85} />
            </mesh>
            <mesh position={[-id.eyeSep * 1.7, -es * 0.9, 0.05]} scale={[1, 0.7, 0.3]}>
              <sphereGeometry args={[es * 0.62, 12, 12]} />
              <meshStandardMaterial color="#ff9db0" roughness={0.6} transparent opacity={0.85} />
            </mesh>
          </group>
        </group>
      </group>

      <ActionBubble agentId={agentId} />
    </group>
  );
}

export function Agents(): JSX.Element {
  // Only living agents are drawn; re-renders when the living roster changes.
  const ids = useGameStore((s) =>
    s.world.agents.filter((a) => a.alive).map((a) => a.id).join('|'),
  );
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
