// Creature design lab (NOT part of the game build — lives outside src/). Renders
// several procedural creature directions with expressive faces and per-individual
// identity, so we can pick a look before wiring it into src/render. Pure Three.js,
// no external models — everything here is geometry we can reproduce in the game.

import * as THREE from 'three';

type Mood = 'happy' | 'content' | 'hungry' | 'cold' | 'sleepy' | 'sick';
type Style = 'blob' | 'bean' | 'critter';

const MOOD_HE: Record<Mood, string> = {
  happy: 'שמח', content: 'רגוע', hungry: 'רעב', cold: 'קופא', sleepy: 'ישנוני', sick: 'חולה',
};

const TAU = Math.PI * 2;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- materials -------------------------------------------------------------
function bodyMat(color: THREE.Color): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 });
}
const EYE_WHITE = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const PUPIL = new THREE.MeshStandardMaterial({ color: 0x1a1420, roughness: 0.2 });
const MOUTH = new THREE.MeshStandardMaterial({ color: 0x3a1b22, roughness: 0.5 });
const CHEEK = new THREE.MeshStandardMaterial({ color: 0xff9db0, roughness: 0.6, transparent: true, opacity: 0.85 });

// --- face ------------------------------------------------------------------
interface Face {
  group: THREE.Group;
  eyes: THREE.Group;
  closed: boolean;
}

function buildFace(mood: Mood, eyeSize: number, sep: number): Face {
  const group = new THREE.Group();
  const eyes = new THREE.Group();
  const closed = mood === 'sleepy' || mood === 'sick';

  for (const side of [-1, 1]) {
    if (closed) {
      // A closed, content eye: a small downward arc.
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(eyeSize * 0.9, eyeSize * 0.16, 6, 12, Math.PI),
        PUPIL,
      );
      arc.rotation.z = Math.PI; // gentle "u_u"
      arc.position.set(side * sep, 0, 0.02);
      eyes.add(arc);
    } else {
      const white = new THREE.Mesh(new THREE.SphereGeometry(eyeSize, 20, 20), EYE_WHITE);
      white.scale.z = 0.55;
      white.position.set(side * sep, 0, 0);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.52, 16, 16), PUPIL);
      // look direction varies with mood (hungry looks down, happy up a touch).
      const lookY = mood === 'hungry' ? -eyeSize * 0.3 : mood === 'happy' ? eyeSize * 0.12 : 0;
      pupil.position.set(side * sep, lookY, eyeSize * 0.6);
      // a tiny highlight
      const glint = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.16, 8, 8), EYE_WHITE);
      glint.position.set(side * sep + eyeSize * 0.18, lookY + eyeSize * 0.2, eyeSize * 0.78);
      eyes.add(white, pupil, glint);
    }
  }
  group.add(eyes);

  // mouth
  let mouth: THREE.Mesh;
  if (mood === 'happy' || mood === 'content') {
    const arc = mood === 'happy' ? Math.PI : Math.PI * 0.7;
    mouth = new THREE.Mesh(new THREE.TorusGeometry(eyeSize * 1.15, eyeSize * 0.14, 8, 16, arc), MOUTH);
    mouth.rotation.z = Math.PI + (Math.PI - arc) / 2; // centered U (smile)
    mouth.position.set(0, -eyeSize * 1.7, 0.02);
  } else if (mood === 'cold') {
    const arc = Math.PI * 0.6;
    mouth = new THREE.Mesh(new THREE.TorusGeometry(eyeSize * 1.0, eyeSize * 0.13, 8, 16, arc), MOUTH);
    mouth.rotation.z = -(Math.PI - arc) / 2; // frown (∩)
    mouth.position.set(0, -eyeSize * 1.5, 0.02);
  } else if (mood === 'hungry') {
    mouth = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.6, 14, 14), MOUTH);
    mouth.scale.set(0.9, 1.3, 0.5);
    mouth.position.set(0, -eyeSize * 1.7, 0.02);
  } else {
    // sleepy / sick: small soft mouth
    mouth = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.32, 10, 10), MOUTH);
    mouth.scale.set(1.4, 0.7, 0.5);
    mouth.position.set(0, -eyeSize * 1.6, 0.02);
  }
  group.add(mouth);

  if (mood === 'happy' || mood === 'content') {
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.6, 12, 12), CHEEK);
      cheek.scale.set(1, 0.7, 0.3);
      cheek.position.set(side * sep * 1.55, -eyeSize * 0.9, eyeSize * 0.1);
      group.add(cheek);
    }
  }
  return { group, eyes, closed };
}

// --- colour ----------------------------------------------------------------
function skinColor(rng: () => number, mood: Mood): THREE.Color {
  let h = rng();
  let s = 0.45 + rng() * 0.2;
  let l = 0.58 + rng() * 0.12;
  if (mood === 'cold') { h = 0.58; s = 0.35; l = 0.66; }
  if (mood === 'sick') { h = 0.28; s = 0.3; l = 0.55; }
  return new THREE.Color().setHSL(h, s, l);
}

// --- creatures -------------------------------------------------------------
interface Built {
  group: THREE.Group;
  face: Face;
  phase: number;
  baseY: number;
  mood: Mood;
}

function buildCreature(style: Style, seed: number, mood: Mood): Built {
  const rng = mulberry32(seed);
  const g = new THREE.Group();
  const col = skinColor(rng, mood);
  const light = col.clone().lerp(new THREE.Color(0xffffff), 0.4);
  const mat = bodyMat(col);
  const bellyMat = bodyMat(light);
  const eyeSize = 0.16 + rng() * 0.05;
  const sizeVar = 0.92 + rng() * 0.18;
  const castShadow = (m: THREE.Mesh) => { m.castShadow = true; return m; };

  let faceY = 0.4, faceZ = 0.7, faceScale = 1;

  if (style === 'blob') {
    const body = castShadow(new THREE.Mesh(new THREE.SphereGeometry(0.92, 28, 28), mat));
    body.scale.set(1, 0.82, 0.92);
    g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 20), bellyMat);
    belly.scale.set(0.8, 0.7, 0.35); belly.position.set(0, -0.15, 0.72);
    g.add(belly);
    for (const s of [-1, 1]) {
      const foot = castShadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), mat));
      foot.scale.set(1, 0.6, 1.2); foot.position.set(s * 0.42, -0.72, 0.28);
      g.add(foot);
    }
    faceY = 0.28; faceZ = 0.72; faceScale = 1.15;
  } else if (style === 'bean') {
    const body = castShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.75, 12, 20), mat));
    body.position.y = 0.15; g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 18), bellyMat);
    belly.scale.set(0.75, 1.0, 0.35); belly.position.set(0, 0.02, 0.42); g.add(belly);
    for (const s of [-1, 1]) {
      const arm = castShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.28, 8, 12), mat));
      arm.position.set(s * 0.52, 0.12, 0.05); arm.rotation.z = s * 0.5; g.add(arm);
      const leg = castShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.2, 8, 12), mat));
      leg.position.set(s * 0.24, -0.48, 0.04); g.add(leg);
    }
    faceY = 0.5; faceZ = 0.46; faceScale = 0.95;
  } else {
    // critter: rounded body + head + ears + tail
    const body = castShadow(new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 24), mat));
    body.scale.set(1, 0.85, 1.1); body.position.y = -0.1; g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 18), bellyMat);
    belly.scale.set(0.7, 0.9, 0.35); belly.position.set(0, -0.1, 0.6); g.add(belly);
    const head = castShadow(new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 24), mat));
    head.position.set(0, 0.6, 0.14); g.add(head);
    for (const s of [-1, 1]) {
      const ear = castShadow(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 14), mat));
      ear.position.set(s * 0.3, 0.98, 0.12); ear.rotation.z = s * -0.25; g.add(ear);
      const leg = castShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.12, 8, 12), mat));
      leg.position.set(s * 0.28, -0.62, 0.1); g.add(leg);
    }
    const tail = castShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 8, 12), mat));
    tail.position.set(0, -0.1, -0.7); tail.rotation.x = -0.9; g.add(tail);
    faceY = 0.62; faceZ = 0.6; faceScale = 0.92;
  }

  const face = buildFace(mood, eyeSize, eyeSize * 1.5);
  face.group.position.set(0, faceY, faceZ);
  face.group.scale.setScalar(faceScale);
  g.add(face.group);

  g.scale.setScalar(sizeVar);
  if (mood === 'sleepy') g.rotation.z = 0.12; // head-tilt drowse
  const built: Built = { group: g, face, phase: rng() * TAU, baseY: 0, mood };
  return built;
}

// --- scene -----------------------------------------------------------------
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2340);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 6, 12.5);
camera.lookAt(0, 0.5, -0.4);

const hemi = new THREE.HemisphereLight(0xdcecff, 0x3a3352, 1.0);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(5, 10, 7); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -9; key.shadow.camera.right = 9;
key.shadow.camera.top = 9; key.shadow.camera.bottom = -9;
scene.add(key);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(20, 48),
  new THREE.MeshStandardMaterial({ color: 0x5a7a52, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.95; ground.receiveShadow = true;
scene.add(ground);

const COLS: Style[] = ['blob', 'bean', 'critter'];
const XS = [-4.3, 0, 4.3];
const ZS = [2.6, -0.4, -3.2];

let creatures: Built[] = [];
let mood: Mood = 'happy';
let seedBase = 101;

function buildGrid(): void {
  for (const c of creatures) scene.remove(c.group);
  creatures = [];
  COLS.forEach((style, ci) => {
    ZS.forEach((z, ri) => {
      const built = buildCreature(style, seedBase + ci * 977 + ri * 131, mood);
      built.group.position.set(XS[ci], 0, z);
      built.baseY = 0;
      scene.add(built.group);
      creatures.push(built);
    });
  });
  const label = document.getElementById('mood');
  if (label) label.textContent = 'מצב רוח: ' + MOOD_HE[mood];
}
buildGrid();

(window as any).__setMood = (m: Mood) => { mood = m; buildGrid(); };
(window as any).__reseed = () => { seedBase = Math.floor(Math.random() * 1e6); buildGrid(); };

const clock = new THREE.Clock();
function animate(): void {
  const t = clock.getElapsedTime();
  for (const c of creatures) {
    const happy = c.mood === 'happy';
    const amp = happy ? 0.12 : c.mood === 'sleepy' ? 0.03 : 0.06;
    const speed = happy ? 3.2 : c.mood === 'sleepy' ? 1.0 : 2.0;
    c.group.position.y = c.baseY + Math.sin(t * speed + c.phase) * amp + amp;
    if (c.mood === 'cold') c.group.position.x += Math.sin(t * 40 + c.phase) * 0.01;
    if (!c.face.closed) {
      const bl = (t * 0.6 + c.phase) % 3.4;
      c.face.eyes.scale.y = bl < 0.12 ? 0.1 : 1;
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
