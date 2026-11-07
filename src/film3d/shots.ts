import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { getChar } from "@/game/roster";
import { Fire, rng, variant, type FilmStage, type Pose, type Shot } from "./lab";

/**
 * Sample shots for the 3D version of the opening film (src/cinematic/script.ts):
 *   2b  Kurogane leads armored samurai out of the fog; the twins move between the trees
 *   2d  Vargash crashes through the gate; villagers scatter
 *   4b  Through the floor gap: Nethrak enters; Kharzul and Kurogane wait in the doorway
 *   4d  His blade, then his face
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};

// ── Set pieces ────────────────────────────────────────────────────────────

function std(color: number | string, rough = 0.85, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

function sky(s: FilmStage, top: string, horizon: string, glow: string, glowDir = V(0, 0, 1)) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, glow: { value: new THREE.Color(glow) }, dir: { value: glowDir.clone().normalize() } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 dir; varying vec3 vP;
      void main(){ float h = clamp(vP.y * 1.6 + 0.08, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.7));
        float g = pow(max(dot(normalize(vec3(vP.x, 0.0, vP.z)), normalize(vec3(dir.x, 0.0, dir.z))), 0.0), 6.0) * (1.0 - h);
        gl_FragColor = vec4(c + glow * g, 1.0); }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), mat));
}

function stars(s: FilmStage, n = 500) {
  const r = rng(3);
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const e = 0.15 + r() * 1.2;
    pos.push(Math.cos(a) * Math.cos(e) * 140, Math.sin(e) * 140, Math.sin(a) * Math.cos(e) * 140);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  s.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc8d0ff, size: 0.35, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.8 })));
}

function moon(s: FilmStage, at: THREE.Vector3, size = 7) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xdfe6ff, fog: false, transparent: true, depthWrite: false }));
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.32, "rgba(240,244,255,1)");
  g.addColorStop(0.38, "rgba(200,210,255,0.35)");
  g.addColorStop(1, "rgba(120,140,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  m.material.map = new THREE.CanvasTexture(c);
  m.position.copy(at);
  m.scale.setScalar(size);
  s.add(m);
}

function ground(s: FilmStage, color: string, size = 90, seed = 1) {
  const g = new THREE.PlaneGeometry(size, size, 90, 90);
  g.rotateX(-Math.PI / 2);
  const r = rng(seed);
  const p = g.attributes.position;
  const cols: number[] = [];
  const base = new THREE.Color(color);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const road = Math.abs(x) < 1.6 ? 1 : 0;
    p.setY(i, (Math.sin(x * 0.7) * Math.cos(z * 0.5) * 0.05 + (r() - 0.5) * 0.04) * (1 - road * 0.7));
    const k = 0.75 + r() * 0.35 + road * 0.18;
    cols.push(base.r * k, base.g * k, base.b * k);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, std("#ffffff", 0.95, 0, { vertexColors: true }));
  m.receiveShadow = true;
  s.add(m);
}

/** Conifers as instanced trunks and stacked cones, avoiding a clear zone. */
function forest(s: FilmStage, n: number, area: (r: () => number) => [number, number] | null, seed = 5) {
  const r = rng(seed);
  const trunkGeo = new THREE.CylinderGeometry(0.09, 0.16, 1, 7);
  trunkGeo.translate(0, 0.5, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 9);
  const trunks = new THREE.InstancedMesh(trunkGeo, std("#1c1612", 0.95), n);
  const cones = new THREE.InstancedMesh(coneGeo, std("#141c16", 0.9), n * 4);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let placed = 0;
  for (let tries = 0; placed < n && tries < n * 20; tries++) {
    const at = area(r);
    if (!at) continue;
    const [x, z] = at;
    const h = 5 + r() * 5;
    q.setFromAxisAngle(V(0, 1, 0), r() * 6.28);
    m.compose(V(x, 0, z), q, V(1, h * 0.5, 1));
    trunks.setMatrixAt(placed, m);
    for (let k = 0; k < 4; k++) {
      const w = (1.7 - k * 0.35) * (0.8 + r() * 0.3);
      m.compose(V(x, h * 0.35 + k * h * 0.17, z), q, V(w, h * 0.32, w));
      cones.setMatrixAt(placed * 4 + k, m);
    }
    placed++;
  }
  trunks.count = placed;
  cones.count = placed * 4;
  for (const im of [trunks, cones]) {
    im.castShadow = true;
    im.receiveShadow = true;
    s.add(im);
  }
}

/** A palisade of sharpened logs along x at z, leaving a gap for the gate. */
function palisade(s: FilmStage, z: number, from: number, to: number, gap: number, seed = 9) {
  const r = rng(seed);
  const logs: [number, number][] = [];
  for (let x = from; x <= to; x += 0.26) if (Math.abs(x) > gap) logs.push([x, 2.4 + r() * 0.5]);
  const geo = new THREE.CylinderGeometry(0.13, 0.14, 1, 8);
  geo.translate(0, 0.5, 0);
  const tip = new THREE.ConeGeometry(0.13, 0.35, 8);
  const mat = std("#2e241c", 0.92);
  const a = new THREE.InstancedMesh(geo, mat, logs.length);
  const b = new THREE.InstancedMesh(tip, mat, logs.length);
  const m = new THREE.Matrix4();
  logs.forEach(([x, h], i) => {
    m.compose(V(x, 0, z + (r() - 0.5) * 0.05), new THREE.Quaternion(), V(1, h, 1));
    a.setMatrixAt(i, m);
    m.compose(V(x, h + 0.17, z), new THREE.Quaternion(), V(1, 1, 1));
    b.setMatrixAt(i, m);
  });
  for (const im of [a, b]) {
    im.castShadow = true;
    im.receiveShadow = true;
    s.add(im);
  }
}

type Gate = { group: THREE.Group; leaves: THREE.Group[]; planks: THREE.Mesh[] };

/** The village gate: two posts, a double beam, and two plank doors with iron bands. */
function gate(s: FilmStage, z: number): Gate {
  const group = new THREE.Group();
  group.position.z = z;
  const wood = std("#3a2a1e", 0.88);
  const dark = std("#22180f", 0.9);
  const iron = std("#3a3a40", 0.45, 0.8);
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, zz: number, parent: THREE.Object3D = group) => {
    const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.15), m);
    o.position.set(x, y, zz);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  for (const x of [-2.1, 2.1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.4, 12), wood);
    post.position.set(x, 2.2, 0);
    post.castShadow = post.receiveShadow = true;
    group.add(post);
  }
  box(5.8, 0.3, 0.42, dark, 0, 4.25, 0); // kasagi
  box(5.0, 0.22, 0.3, wood, 0, 3.55, 0); // nuki
  box(0.4, 0.72, 0.18, dark, 0, 3.9, 0); // tablet
  const leaves: THREE.Group[] = [];
  const planks: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(side * 1.9, 0, 0); // hinge at the post
    group.add(leaf);
    for (let i = 0; i < 5; i++) planks.push(box(0.36, 3.1, 0.12, i % 2 ? wood : dark, -side * (0.2 + i * 0.37), 1.6, 0, leaf));
    for (const y of [0.7, 2.5]) box(1.9, 0.12, 0.16, iron, -side * 0.95, y, 0.04, leaf);
    leaves.push(leaf);
  }
  s.add(group);
  return { group, leaves, planks };
}

/** A minka house: walls, a deep thatched gable roof, glowing paper windows. */
function house(s: FilmStage, x: number, z: number, yaw: number, w = 5, d = 4) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const wall = std("#5a4a3a", 0.9);
  const post = std("#2a1e16", 0.85);
  const thatch = std("#4a3e30", 0.97);
  const paper = std("#2a1a10", 0.8, 0, { emissive: "#ff9a4a", emissiveIntensity: 0.9 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, p: THREE.Vector3, r = V(0, 0, 0)) => {
    const o = new THREE.Mesh(geo, m);
    o.position.copy(p);
    o.rotation.setFromVector3(r);
    o.castShadow = o.receiveShadow = true;
    g.add(o);
    return o;
  };
  add(new THREE.BoxGeometry(w, 2.4, d), wall, V(0, 1.2, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.2, 2.5, 0.2), post, V((sx * w) / 2, 1.25, (sz * d) / 2));
  const roof = new THREE.CylinderGeometry(0.01, (d / 2) * 1.45, w * 1.18, 3, 1, false);
  roof.rotateZ(Math.PI / 2);
  roof.rotateX(Math.PI);
  add(roof, thatch, V(0, 3.15, 0), V(0, 0, 0)).scale.set(1, 0.9, 1);
  for (const wx of [-w * 0.27, w * 0.27]) add(new THREE.PlaneGeometry(0.9, 0.7), paper, V(wx, 1.35, d / 2 + 0.01));
  add(new THREE.PlaneGeometry(1.0, 1.9), paper, V(0, 0.95, d / 2 + 0.01));
  s.add(g);
  return g;
}

/** Low drifting mist: large soft sprites hugging the ground. */
function mist(s: FilmStage, n: number, area: [number, number, number, number], color = 0x8a96b8, opacity = 0.22, seed = 61) {
  const r = rng(seed);
  const tex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const puffs: { m: THREE.Sprite; v: number }[] = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: opacity * (0.5 + r() * 0.5), depthWrite: false }));
    m.position.set(lerp(area[0], area[1], r()), 0.25 + r() * 0.5, lerp(area[2], area[3], r()));
    m.scale.set(4 + r() * 5, 1.2 + r() * 1.2, 1);
    s.add(m);
    puffs.push({ m, v: 0.15 + r() * 0.25 });
  }
  return (dt: number) => {
    for (const p of puffs) p.m.position.x += p.v * dt;
  };
}

/** Shafts of moonlight slanting through the trees (additive, soft-edged). */
function shafts(s: FilmStage, from: THREE.Vector3, at: THREE.Vector3[], color = 0x9aa8ff, opacity = 0.022) {
  for (const a of at) {
    const dir = a.clone().sub(from);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(0.2, 1.1, len, 16, 1, true);
    g.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(V(0, -1, 0), dir.normalize());
    s.add(m);
  }
}

/** A standing torch on a pole. */
function torch(s: FilmStage, x: number, z: number, seed: number) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.1, 8), std("#2a1e14", 0.9));
  pole.position.set(x, 1.05, z);
  pole.castShadow = true;
  s.add(pole);
  s.fire(V(x, 2.15, z), { size: 0.32, rate: 0.7, light: 4.5, smoke: 5, embers: 14, seed });
}

// ── Characters ────────────────────────────────────────────────────────────

const RANKS = [
  { metal: "#7a6a4a", accent: "#2a2a2e" },
  { metal: "#5a5a62", accent: "#2a1a1a" },
  { metal: "#8a7448", accent: "#1e1e22" },
];
function rank(i: number) {
  const r = RANKS[i % RANKS.length];
  return variant("kurogane", { metal: r.metal, accent: r.accent, scale: 0.96 + (i % 3) * 0.03 }, `samurai${i}`);
}
const villagerA = () => variant("akari", { cloth: "#6a5a48", accent: "#3a3028", skin: "#c8a888", trim: "#4a3e30", hair: "none", hat: "none", metal: "#6a6a6a", scale: 0.95 }, "villager");
const villagerB = () => variant("shion", { cloth: "#4a4038", accent: "#6a2a20", skin: "#b89878", trim: "#3a3028", hat: "none", metal: "#6a6a6a", scale: 0.92 }, "villager");

/** A straight walk from a to b between t0 and t1, standing still before and after. */
const walk = (a: [number, number], b: [number, number], t0: number, t1: number, extra: Partial<Pose> = {}) => (t: number): Pose => {
  const u = clamp01((t - t0) / (t1 - t0));
  return { x: lerp(a[0], b[0], u), z: lerp(a[1], b[1], u), ...extra };
};

// ── Shots ─────────────────────────────────────────────────────────────────

export const SHOTS: Shot[] = [
  {
    id: "2b",
    title: "Kurogane leads the samurai out of the fog; the twins move between the trees",
    dur: 3.4,
    build: (s) => {
      s.scene.fog = new THREE.FogExp2(0x141c30, 0.032);
      s.scene.background = new THREE.Color(0x141c30);
      sky(s, "#05070f", "#1a2236", "#3a2a3a", V(0, 0, 1));
      stars(s);
      moon(s, V(-14, 26, 70), 9);
      ground(s, "#1a1814");
      forest(s, 130, (r) => {
        const x = (r() - 0.5) * 50;
        const z = 4 + r() * 40;
        if (Math.abs(x) < 3.2) return null; // the road
        if (z < 17 && x > -6 && x < 8) return null; // keep the lens clear
        return [x, z];
      });
      // two trunks framing the left edge of the shot, for depth
      forest(s, 2, (r) => [r() < 0.5 ? -3.6 : -4.4, 12.5 + r() * 2], 77);
      s.add(new THREE.HemisphereLight(0x4a5a8a, 0x0a0806, 0.5));
      const moonL = new THREE.DirectionalLight(0xb8c4ff, 2.4);
      moonL.position.set(-6, 14, 30);
      moonL.target.position.set(0, 0, 14);
      moonL.castShadow = true;
      moonL.shadow.mapSize.set(4096, 4096);
      Object.assign(moonL.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
      moonL.shadow.bias = -0.0004;
      s.add(moonL, moonL.target);
      s.renderer.toneMappingExposure = 1.3;
      // torches along the road light the armor as the column passes
      torch(s, -1.9, 20.5, 51);
      torch(s, 1.9, 22.5, 52);
      const drift = mist(s, 26, [-10, 10, 12, 30]);
      shafts(s, V(-9, 16, 36), [V(-2.5, 0, 22), V(1.5, 0, 25), V(4.5, 0, 19)]);
      // braziers along the road
      for (const x of [-2.3, 2.3]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.12, 0.5, 10), std("#2a2a2e", 0.5, 0.7));
        b.position.set(x, 1.05, 12.5);
        const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.85, 6), std("#1a1a1e", 0.5, 0.7));
        legs.position.set(x, 0.42, 12.5);
        s.add(b, legs);
        s.fire(V(x, 1.3, 12.5), { size: 0.55, rate: 0.9, light: 6, smoke: 8, seed: x > 0 ? 3 : 4 });
      }
      // the column: Kurogane at the head
      s.actor(getChar("kurogane"), walk([0, 24.5], [0, 19.2], 0, 3.4));
      const slots: [number, number][] = [
        [-0.9, 1.4],
        [0.9, 1.5],
        [-1.0, 2.9],
        [1.0, 3.0],
        [-0.9, 4.4],
        [0.9, 4.5],
      ];
      slots.forEach(([x, dz], i) => s.actor(rank(i), walk([x, 24.5 + dz], [x, 19.2 + dz], 0, 3.4)));
      // the twins slip between the trees on the flanks
      s.actor(getChar("sei"), walk([-5.2, 17.5], [-3.0, 15.4], 0.1, 3.4));
      s.actor(getChar("rei"), walk([6.0, 19.5], [3.6, 17.2], 0, 3.2));
      return {
        update: ({ stage, t, dt }) => {
          drift(dt);
          const u = smooth(t / 3.4);
          stage.camera.position.set(lerp(2.4, 1.9, u), lerp(1.0, 1.12, u), lerp(12.4, 13.0, u));
          stage.camera.lookAt(lerp(-0.4, -0.2, u), 1.5, 21);
          stage.camera.fov = lerp(36, 32, u);
          stage.camera.updateProjectionMatrix();
        },
      };
    },
  },
  {
    id: "2d",
    title: "Vargash crashes through the gate; villagers scatter",
    dur: 3.2,
    build: (s) => {
      s.scene.fog = new THREE.FogExp2(0x1a1018, 0.035);
      s.scene.background = new THREE.Color(0x1a1018);
      sky(s, "#07060c", "#2a1418", "#6a2a18", V(0, 0, 1));
      stars(s, 300);
      ground(s, "#211c16", 90, 2);
      forest(s, 70, (r) => {
        const x = (r() - 0.5) * 50;
        const z = 4 + r() * 30;
        return Math.abs(x) < 3 ? null : [x, z];
      }, 8);
      palisade(s, 0, -18, 18, 2.3);
      const g = gate(s, 0);
      house(s, -5.4, -4.6, Math.PI / 2);
      house(s, 5.6, -5.4, -Math.PI / 2, 5.5, 4.2);
      house(s, -6.4, -12, Math.PI / 2 - 0.2);
      s.renderer.toneMappingExposure = 1.15;
      const drift = mist(s, 18, [-8, 8, -12, 2], 0x6a4a4a, 0.18, 62);
      s.add(new THREE.HemisphereLight(0x4a3a5a, 0x0a0806, 0.4));
      const moonL = new THREE.DirectionalLight(0x9aa8ff, 0.9);
      moonL.position.set(-10, 16, 14);
      moonL.castShadow = true;
      moonL.shadow.mapSize.set(4096, 4096);
      Object.assign(moonL.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
      s.add(moonL);
      // the village burns
      s.fire(V(-5.0, 3.5, -4.2), { size: 1.6, rate: 1.4, light: 7, smoke: 16, embers: 40, spread: 1.8, seed: 11 });
      s.fire(V(5.2, 3.4, -5.0), { size: 1.4, rate: 1.2, light: 6, smoke: 14, embers: 36, spread: 1.6, seed: 12 });
      s.fire(V(-2.1, 4.55, 0.05), { size: 0.35, rate: 0.6, light: 1.2, smoke: 4, seed: 13 });
      s.fire(V(2.1, 4.55, 0.05), { size: 0.35, rate: 0.6, light: 1.2, smoke: 4, seed: 14 });
      // Vargash: a leap over the road that breaks the gate, a landing, a roar
      const T0 = 0.35;
      const T1 = 1.15;
      s.actor(getChar("vargash"), (t) => {
        if (t < T0) return { x: 0, z: 5, yaw: 0, anim: "idle" };
        if (t < T1) {
          const u = (t - T0) / (T1 - T0);
          return { x: 0, z: lerp(5, -2.6, u), y: Math.sin(u * Math.PI) * 1.9, yaw: 0, anim: "leap" };
        }
        if (t < 1.4) return { x: 0, z: -2.6, yaw: 0, anim: "idle" };
        return { x: 0, z: -2.6, yaw: 0, anim: t < 2.4 ? "special" : "idle" };
      });
      // villagers run
      for (const v of [
        s.actor(villagerA(), walk([-1.4, -3.8], [-4.8, -8.5], 0.9, 3.2)),
        s.actor(villagerB(), walk([1.6, -4.4], [4.6, -9.2], 1.0, 3.2)),
        s.actor(villagerA(), walk([-0.6, -5.4], [-3.4, -9.6], 0.8, 3.2)),
      ])
        v.rig.weapon.visible = false;
      // doors burst and planks fly when he hits
      const hit = 0.72;
      const r = rng(21);
      const fly = g.planks.map((p) => ({ p, v: V((r() - 0.5) * 4, 2 + r() * 3, -(4 + r() * 5)), w: V((r() - 0.5) * 9, (r() - 0.5) * 9, (r() - 0.5) * 9), free: r() < 0.5 }));
      const leafSpin = [0, 0];
      return {
        update: ({ stage, t, dt }) => {
          drift(dt);
          if (t > hit) {
            g.leaves.forEach((leaf, i) => {
              leafSpin[i] = Math.min(1.9, leafSpin[i] + dt * 9 * (1 - leafSpin[i] / 2));
              leaf.rotation.y = (i === 0 ? 1 : -1) * leafSpin[i];
            });
            for (const f of fly) {
              if (!f.free) continue;
              if (f.p.parent !== stage.scene) stage.scene.attach(f.p);
              f.v.y -= 9.8 * dt;
              f.p.position.addScaledVector(f.v, dt);
              if (f.p.position.y < 0.08) {
                f.p.position.y = 0.08;
                f.v.multiplyScalar(0.4);
                f.v.y = Math.abs(f.v.y) * 0.3;
                f.w.multiplyScalar(0.5);
              }
              f.p.rotation.x += f.w.x * dt;
              f.p.rotation.y += f.w.y * dt;
              f.p.rotation.z += f.w.z * dt;
            }
          }
          // camera: low in the street, a jolt on impact, then a push toward the roar
          const shake = t > hit ? Math.exp(-(t - hit) * 6) * 0.06 : 0;
          const u = smooth((t - 1.2) / 2);
          stage.camera.position.set(lerp(-1.2, -0.8, u) + Math.sin(t * 60) * shake, lerp(1.35, 1.2, u) + Math.cos(t * 53) * shake, lerp(-11.5, -9.6, u));
          stage.camera.lookAt(0, lerp(2.1, 1.8, u), lerp(0, -2.6, u));
          stage.camera.fov = 40;
          stage.camera.updateProjectionMatrix();
        },
      };
    },
  },
  ...interiorShots(),
];

/** The house interior, seen from the cellar through a gap in the floorboards. */
function room(s: FilmStage, o: { fill?: boolean } = {}) {
  s.renderer.toneMappingExposure = 1.0;
  s.scene.fog = new THREE.FogExp2(0x140a06, 0.06);
  s.scene.background = new THREE.Color(0x0a0604);
  const floorY = 0.0;
  const wood = std("#3a2a1c", 0.82);
  const dark = std("#1e140c", 0.9);
  const paper = std("#2a1a10", 0.7, 0, { emissive: "#ff7a32", emissiveIntensity: 0.32, side: THREE.DoubleSide });
  const r = rng(31);
  // floorboards
  for (let i = -8; i <= 8; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 7.6), i % 2 ? wood : std("#33261a", 0.85));
    b.position.set(i * 0.37, floorY - 0.03, 0.8 + (r() - 0.5) * 0.05);
    b.receiveShadow = true;
    s.add(b);
  }
  // walls: posts and shoji panels, the back wall with the broken door at z = 4
  const wallAt = (x0: number, x1: number, z: number) => {
    for (let x = x0; x <= x1 + 0.001; x += 1.2) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.8, 0.16), dark);
      p.position.set(x, 1.4, z);
      p.castShadow = true;
      s.add(p);
    }
    for (let x = x0 + 0.6; x < x1; x += 1.2) {
      if (Math.abs(x) < 0.7 && z > 3) continue; // the doorway
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 2.2), paper);
      pane.position.set(x, 1.3, z);
      s.add(pane);
      for (let k = 1; k < 4; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.03, 0.03), dark);
        bar.position.set(x, 0.2 + k * 0.55, z + 0.02);
        s.add(bar);
      }
      const vbar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.2, 0.03), dark);
      vbar.position.set(x, 1.3, z + 0.02);
      s.add(vbar);
    }
  };
  wallAt(-3, 3, 4);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.25, 0.25), dark);
  lintel.position.set(0, 2.75, 4);
  s.add(lintel);
  for (const x of [-3.1, 3.1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.8), paper);
    side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    side.position.set(x, 1.4, 0.2);
    s.add(side);
  }
  // the broken door on the floor
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 1.6 - i * 0.2), wood);
    p.position.set(-0.4 + i * 0.32, 0.03, 3.1 - i * 0.15);
    p.rotation.set(0, (r() - 0.5) * 0.8, (r() - 0.5) * 0.2);
    p.castShadow = p.receiveShadow = true;
    s.add(p);
  }
  // fire outside, smoke under the ceiling, embers drifting in
  s.add(new THREE.HemisphereLight(0x5a3a2a, 0x080404, 0.45));
  if (o.fill !== false) {
    const fill = new THREE.PointLight(0xff9a5a, 2.2, 8, 1.5);
    fill.position.set(1.6, 1.8, -0.5);
    s.add(fill);
  }
  const doorLight = new THREE.SpotLight(0xff8a3a, 60, 14, 0.7, 0.6, 1.4);
  doorLight.position.set(0, 2.4, 7.5);
  doorLight.target.position.set(0, 0, 0.5);
  doorLight.castShadow = true;
  doorLight.shadow.mapSize.set(2048, 2048);
  s.add(doorLight, doorLight.target);
  s.fire(V(-1.8, 0.2, 7.5), { size: 1.6, rate: 1.5, light: 10, smoke: 12, embers: 40, spread: 2, seed: 41 });
  s.fire(V(2.2, 0.2, 8.5), { size: 1.4, rate: 1.2, light: 8, smoke: 10, embers: 30, spread: 1.8, seed: 42 });
  const haze = new Fire(V(0, 2.4, 1.5), { size: 1.4, rate: 0.01, light: 0.01, smoke: 14, embers: 30, seed: 43 });
  s.scene.add(haze.group);
  s.fires.push(haze);
}

function interiorShots(): Shot[] {
  // Nethrak walks in from the doorway; Kharzul and Kurogane wait behind him.
  const cast = (s: FilmStage, nethrak: (t: number) => Pose) => {
    s.actor(getChar("nethrak"), nethrak);
    s.actor(getChar("kharzul"), () => ({ x: -1.0, z: 5.0, yaw: 0, anim: "idle" }));
    s.actor(getChar("kurogane"), () => ({ x: 1.05, z: 5.2, yaw: 0, anim: "idle" }));
  };
  return [
    {
      id: "4b",
      title: "Through the floor gap: Nethrak enters; Kharzul and Kurogane wait in the doorway",
      dur: 3.4,
      build: (s) => {
        room(s);
        cast(s, (t) => {
          const u = clamp01(t / 3.4);
          return { x: 0.05, z: lerp(4.4, 1.4, u), anim: u < 1 ? "walk" : "idle" };
        });
        // the gap: two floorboards right in front of the lens frame the view into a slit
        const boardMat = std("#120c08", 0.9);
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.05), boardMat);
        const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.05), boardMat);
        s.camera.add(top, bottom);
        // the gap shows about 45% of the frame's height
        top.position.set(0, 0.158, -0.32);
        bottom.position.set(0, -0.158, -0.32);
        s.add(s.camera);
        return {
          update: ({ stage, t }) => {
            const u = smooth(t / 3.4);
            stage.camera.position.set(0.2, 0.05, lerp(-1.4, -1.2, u));
            stage.camera.lookAt(0.05, lerp(1.05, 1.2, u), 3);
            stage.camera.fov = 44;
            stage.camera.updateProjectionMatrix();
          },
        };
      },
    },
    {
      id: "4d",
      title: "His blade, then his face",
      dur: 3.0,
      build: (s) => {
        room(s, { fill: false });
        // a rim of firelight from behind; the face is a shadow with two embers in it
        const rim = new THREE.SpotLight(0xff6a2a, 40, 6, 0.5, 0.5, 1.5);
        rim.position.set(0.6, 2.6, 3.2);
        rim.target.position.set(0, 1.4, 1.6);
        s.add(rim, rim.target);
        cast(s, () => ({ x: 0.05, z: 1.6, yaw: 0, anim: "idle" }));
        const scale = getChar("nethrak").kit.scale;
        return {
          // focus on the face; the room and the fire behind fall soft
          dof: { focus: 2.0, aperture: 0.012, maxblur: 0.012 },
          update: ({ stage, t }) => {
            const u = smooth(t / 3.0);
            // a slow rise from the red blade to the skull beneath the steel hat
            stage.camera.position.set(lerp(0.55, 0.32, u), lerp(1.15, 1.6 * scale, u), lerp(-0.6, -0.35, u));
            stage.camera.lookAt(lerp(0.12, 0.02, u), lerp(1.2, 1.66 * scale, u), 1.6);
            stage.camera.fov = lerp(30, 26, u);
            stage.camera.updateProjectionMatrix();
          },
        };
      },
    },
  ];
}
