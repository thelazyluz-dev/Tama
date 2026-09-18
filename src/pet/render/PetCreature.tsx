// The pet itself — the reused "bean" creature, now a single companion you care
// for. It shows the pet's live mood (hungry/sad/sleepy/sick/happy), hops and
// throws hearts when you pet/feed/play, sleeps with a Zzz, and starts life as a
// wobbling egg. Read-only: renders the pet store, never writes it (touch goes
// through the store's care actions). Poops sit on the ground and can be tapped.

import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { usePetStore } from '../store';
import { moodOf } from '../pet';
import type { PetMood } from '../types';

const COLD = new THREE.Color(0.62, 0.76, 0.96);
const SICK = new THREE.Color(0.62, 0.8, 0.5);

function hash01(s: number): number {
  let h = (s ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h >>> 0) % 1000) / 1000;
}

function stageScale(stage: string): number {
  if (stage === 'baby') return 0.62;
  if (stage === 'child') return 0.82;
  return 1;
}

export function PetCreature(): JSX.Element {
  const rig = useRef<THREE.Group>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const eyes = useRef<THREE.Group>(null);
  const smile = useRef<THREE.Mesh>(null);
  const frown = useRef<THREE.Mesh>(null);
  const open = useRef<THREE.Mesh>(null);
  const flat = useRef<THREE.Mesh>(null);
  const cheeks = useRef<THREE.Group>(null);
  const tintTarget = useRef(new THREE.Color());
  const hopStart = useRef(-999);
  const lastReaction = useRef(-999);
  const [hearts, setHearts] = useState<number[]>([]);

  const seed = usePetStore((s) => s.pet.seed);
  const id = useMemo(() => {
    const h = hash01(seed);
    const base = new THREE.Color().setHSL(h, 0.5, 0.62);
    return {
      base,
      belly: base.clone().lerp(new THREE.Color(0xffffff), 0.45),
      leg: base.clone().lerp(new THREE.Color(0, 0, 0), 0.12).getStyle(),
      foot: base.clone().lerp(new THREE.Color(0, 0, 0), 0.2).getStyle(),
      eyeSize: 0.1 + hash01(seed + 7) * 0.04,
    };
  }, [seed]);

  const spawnHearts = (): void => {
    const b = Date.now();
    const ids = [b, b + 1, b + 2];
    setHearts((h) => [...h, ...ids]);
    window.setTimeout(() => setHearts((h) => h.filter((x) => !ids.includes(x))), 1100);
  };

  useFrame((state, rawDelta) => {
    const r = rig.current;
    if (!r) return;
    const dt = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;
    const pet = usePetStore.getState().pet;

    // React to a fresh care action (hop + hearts for affectionate ones).
    if (pet.reactionTick !== lastReaction.current) {
      lastReaction.current = pet.reactionTick;
      if (pet.reactionTick > 0) {
        hopStart.current = performance.now();
        if (pet.reaction === 'pet' || pet.reaction === 'feed' || pet.reaction === 'play') spawnHearts();
      }
    }

    const mood: PetMood = moodOf(pet);
    const sleeping = pet.sleeping;
    const scale = stageScale(pet.stage);

    // Egg: just wobble.
    if (pet.stage === 'egg') {
      r.scale.setScalar(0.7);
      r.rotation.z = Math.sin(t * 6) * 0.12;
      r.position.y = 0;
      return;
    }

    r.scale.setScalar(r.scale.x + (scale - r.scale.x) * (1 - Math.exp(-4 * dt)));
    r.rotation.z += (0 - r.rotation.z) * (1 - Math.exp(-6 * dt));

    // Idle: gentle breathing / sway; sleeping barely moves.
    const idleBob = sleeping ? Math.sin(t * 1.2) * 0.015 : Math.sin(t * 2) * 0.03;
    let y = idleBob;
    const hopAge = (performance.now() - hopStart.current) / 1000;
    if (hopAge >= 0 && hopAge < 0.5) y += Math.sin((hopAge / 0.5) * Math.PI) * 0.35;
    r.position.y = y;
    r.rotation.y = Math.sin(t * 0.6) * 0.12; // face the camera, sway a little

    // Expression.
    const smiling = mood === 'happy' || mood === 'content';
    const closed = sleeping || mood === 'sleepy' || mood === 'sick' || mood === 'dead';
    if (smile.current) smile.current.visible = smiling;
    if (frown.current) frown.current.visible = mood === 'sad';
    if (open.current) open.current.visible = mood === 'hungry';
    if (flat.current) flat.current.visible = closed;
    if (cheeks.current) cheeks.current.visible = mood === 'happy';
    if (eyes.current) {
      const blink = (t * 0.7 + 0.3) % 3.2 < 0.13;
      const target = closed ? 0.12 : blink ? 0.1 : 1;
      eyes.current.scale.y += (target - eyes.current.scale.y) * (1 - Math.exp(-18 * dt));
    }
    if (bodyMat.current) {
      tintTarget.current.copy(id.base);
      if (mood === 'sick') tintTarget.current.lerp(SICK, 0.5);
      else if (sleeping) tintTarget.current.lerp(COLD, 0.15);
      if (mood === 'dead') tintTarget.current.setRGB(0.45, 0.45, 0.45);
      bodyMat.current.color.lerp(tintTarget.current, 1 - Math.exp(-6 * dt));
    }
  });

  const petTap = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    usePetStore.getState().petIt();
  };
  const hoverOn = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  };
  const hoverOff = (): void => {
    document.body.style.cursor = '';
  };

  const es = id.eyeSize;
  const sep = 0.17;

  const eye = (side: number): JSX.Element => (
    <group position={[side * sep, 0, 0]}>
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
    </group>
  );

  return (
    <group>
      <PetShadowRing />
      <group ref={rig} onClick={petTap} onPointerOver={hoverOn} onPointerOut={hoverOff}>
        <EggOrBody bodyMat={bodyMat} id={id} eye={eye} es={es} sep={sep}
          eyes={eyes} smile={smile} frown={frown} open={open} flat={flat} cheeks={cheeks} />
      </group>

      <SleepZ />

      {hearts.length > 0 && (
        <Html position={[0, 1.9, 0]} center distanceFactor={10} zIndexRange={[30, 0]}>
          <div className="pet-hearts">
            {hearts.map((h, i) => (
              <span key={h} style={{ '--dx': `${((i % 3) - 1) * 16}px` } as CSSProperties}>
                ❤️
              </span>
            ))}
          </div>
        </Html>
      )}

      <Poops />
    </group>
  );
}

// The body / egg. Split out so the ref-heavy JSX stays readable.
function EggOrBody(props: {
  bodyMat: RefObject<THREE.MeshStandardMaterial>;
  id: { base: THREE.Color; belly: THREE.Color; leg: string; foot: string; eyeSize: number };
  eye: (side: number) => JSX.Element;
  es: number;
  sep: number;
  eyes: RefObject<THREE.Group>;
  smile: RefObject<THREE.Mesh>;
  frown: RefObject<THREE.Mesh>;
  open: RefObject<THREE.Mesh>;
  flat: RefObject<THREE.Mesh>;
  cheeks: RefObject<THREE.Group>;
}): JSX.Element {
  const stage = usePetStore((s) => s.pet.stage);
  const { id, es, sep } = props;

  if (stage === 'egg') {
    return (
      <mesh position={[0, 0.62, 0]} scale={[1, 1.25, 1]} castShadow>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial color="#f3ead6" roughness={0.7} />
      </mesh>
    );
  }

  return (
    <>
      {/* legs + feet */}
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.24, 0.52, 0.1]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.14, 6, 12]} />
            <meshStandardMaterial color={id.leg} roughness={0.75} />
          </mesh>
          <mesh position={[0, -0.34, 0.05]} scale={[1, 0.7, 1.3]} castShadow>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color={id.foot} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* body + belly */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.5, 0.62, 10, 20]} />
        <meshStandardMaterial ref={props.bodyMat} color={id.base.getStyle()} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.86, 0.4]} scale={[0.72, 1.0, 0.4]}>
        <sphereGeometry args={[0.42, 18, 18]} />
        <meshStandardMaterial color={id.belly.getStyle()} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.66, -0.02]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color={id.base.clone().lerp(new THREE.Color(0, 0, 0), 0.28).getStyle()} roughness={0.85} />
      </mesh>

      {/* arms */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.5, 0.94, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.2, 6, 12]} />
          <meshStandardMaterial color={id.base.getStyle()} roughness={0.65} />
        </mesh>
      ))}

      {/* face */}
      <group position={[0, 1.28, 0.42]}>
        <group ref={props.eyes}>
          {props.eye(1)}
          {props.eye(-1)}
        </group>
        <mesh ref={props.smile} position={[0, -es * 1.7, 0.02]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[es * 1.15, es * 0.13, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#3a1b22" roughness={0.5} />
        </mesh>
        <mesh ref={props.frown} visible={false} position={[0, -es * 1.4, 0.02]} rotation={[0, 0, Math.PI * 0.2]}>
          <torusGeometry args={[es * 1.0, es * 0.12, 8, 16, Math.PI * 0.6]} />
          <meshStandardMaterial color="#3a1b22" roughness={0.5} />
        </mesh>
        <mesh ref={props.open} visible={false} position={[0, -es * 1.7, 0.02]} scale={[0.9, 1.3, 0.5]}>
          <sphereGeometry args={[es * 0.6, 14, 14]} />
          <meshStandardMaterial color="#3a1b22" roughness={0.5} />
        </mesh>
        <mesh ref={props.flat} visible={false} position={[0, -es * 1.55, 0.02]} scale={[1.5, 0.6, 0.5]}>
          <sphereGeometry args={[es * 0.34, 10, 10]} />
          <meshStandardMaterial color="#3a1b22" roughness={0.5} />
        </mesh>
        <group ref={props.cheeks} visible={false}>
          {[1, -1].map((s) => (
            <mesh key={s} position={[s * sep * 1.7, -es * 0.9, 0.05]} scale={[1, 0.7, 0.3]}>
              <sphereGeometry args={[es * 0.62, 12, 12]} />
              <meshStandardMaterial color="#ff9db0" roughness={0.6} transparent opacity={0.85} />
            </mesh>
          ))}
        </group>
      </group>
    </>
  );
}

function PetShadowRing(): JSX.Element {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <circleGeometry args={[0.7, 28]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.14} depthWrite={false} />
    </mesh>
  );
}

function SleepZ(): JSX.Element | null {
  const sleeping = usePetStore((s) => s.pet.sleeping);
  const stage = usePetStore((s) => s.pet.stage);
  if (!sleeping || stage === 'egg') return null;
  return (
    <Html position={[0.55, 1.8, 0]} center distanceFactor={11} zIndexRange={[20, 0]}>
      <div className="sleep-z">💤</div>
    </Html>
  );
}

function Poops(): JSX.Element {
  const poops = usePetStore((s) => s.pet.poops);
  const doClean = usePetStore((s) => s.clean);
  return (
    <group>
      {poops.map((p) => (
        <group
          key={p.id}
          position={[p.x * 1.6, 0.12, 0.9]}
          onClick={(e) => {
            e.stopPropagation();
            doClean();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
          }}
        >
          <mesh position={[0, 0, 0]} castShadow>
            <coneGeometry args={[0.16, 0.16, 8]} />
            <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.12, 0]} castShadow>
            <coneGeometry args={[0.1, 0.12, 8]} />
            <meshStandardMaterial color="#7a5533" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
