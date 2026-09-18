// A cozy little stage for one pet — soft ground, warm light, a gentle sky. Far
// simpler than a whole valley: the pet is the whole show. Read-only.

import { Canvas } from '@react-three/fiber';
import { OrbitControls, SoftShadows } from '@react-three/drei';
import * as THREE from 'three';
import { PetCreature } from './PetCreature';

export function PetScene(): JSX.Element {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.05 }}
      camera={{ position: [0, 1.9, 5.2], fov: 42, near: 0.1, far: 100 }}
      onCreated={({ scene, gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        scene.background = new THREE.Color('#cfe0f5');
        scene.fog = new THREE.Fog('#cfe0f5', 12, 26);
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <SoftShadows size={24} samples={12} focus={0.9} />
      <hemisphereLight args={['#e7f0ff', '#6b5a48', 0.85]} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />

      {/* soft round platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[6, 48]} />
        <meshStandardMaterial color="#8fce8f" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <ringGeometry args={[2.1, 2.35, 48]} />
        <meshStandardMaterial color="#7cc07c" roughness={1} />
      </mesh>

      <PetCreature />

      <OrbitControls
        makeDefault
        target={[0, 1, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.2}
        maxDistance={7.5}
        minPolarAngle={0.6}
        maxPolarAngle={1.35}
      />
    </Canvas>
  );
}
