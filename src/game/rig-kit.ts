import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Shared building blocks for the fighters: studio-lit materials, rounded
 * geometry, part merging, and small motion helpers (IK, springs, easing).
 * See docs/MOTION.md for how the motion values were chosen.
 */

// ── Environment lighting ─────────────────────────────────────────────────────
// Fighters get their own reflection map (a soft studio room) so lacquer,
// steel, and silk read as shapes, while the arena keeps its moody fog.

let fighterEnv: THREE.Texture | null = null;
const envUsers = new Set<THREE.MeshStandardMaterial>();

export function setFighterEnvironment(tex: THREE.Texture | null) {
  fighterEnv = tex;
  for (const m of envUsers) {
    m.envMap = tex;
    m.needsUpdate = true;
  }
}

function track<T extends THREE.MeshStandardMaterial>(m: T, envIntensity: number): T {
  m.envMap = fighterEnv;
  m.envMapIntensity = envIntensity;
  envUsers.add(m);
  const dispose = m.dispose.bind(m);
  m.dispose = () => {
    envUsers.delete(m);
    dispose();
  };
  return m;
}

// ── Materials ────────────────────────────────────────────────────────────────

export type MatSet = {
  lacquer: (color: string) => THREE.MeshStandardMaterial;
  cloth: (color: string) => THREE.MeshStandardMaterial;
  metal: (color: string, rough?: number) => THREE.MeshStandardMaterial;
  cord: (color: string, glow?: number) => THREE.MeshStandardMaterial;
  skin: (color: string) => THREE.MeshStandardMaterial;
  /** One shared, vertex-colored material per batch class (see `bake`). */
  batch: (cls: string, sample: THREE.MeshStandardMaterial) => THREE.MeshStandardMaterial;
  all: THREE.MeshStandardMaterial[];
};

/**
 * A per-fighter material factory. Every material it makes is listed in `all`
 * (for flash/fold/dispose). Only lacquer uses the costlier physical shader
 * (for its clear coat); everything else is standard PBR, which phones shade
 * far more cheaply and which still picks up the studio reflections.
 */
export function materials(): MatSet {
  const all: THREE.MeshStandardMaterial[] = [];
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const make = (key: string, f: () => THREE.MeshStandardMaterial, cls?: string) => {
    let m = cache.get(key);
    if (!m) {
      m = f();
      if (cls) m.userData.batch = cls;
      cache.set(key, m);
      all.push(m);
    }
    return m;
  };
  return {
    // Urushi lacquer: a glossy clear coat over a colored base, like the armor plates.
    lacquer: (c) =>
      make(`l${c}`, () =>
        track(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.14 }), 1.1),
        "lacquer",
      ),
    // Silk and cotton: rough and matte.
    cloth: (c) => make(`c${c}`, () => track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0 }), 0.6), "cloth"),
    // Polished blades (roughness under 0.2) keep their own material so their glint stays sharp.
    metal: (c, rough = 0.24) =>
      make(`m${c}${rough}`, () => track(new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 1 }), 1.35), rough < 0.2 ? undefined : "metal"),
    // Lacing and cords carry the accent color; a little glow keeps it readable in dark arenas.
    cord: (c, glow = 0.18) =>
      make(`k${c}${glow}`, () => {
        const m = track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0, emissive: c, emissiveIntensity: glow }), 0.6);
        m.userData.noShadow = true; // too thin to show in the shadow map
        return m;
      }),
    skin: (c) => make(`s${c}`, () => track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.58, metalness: 0 }), 0.6), "cloth"),
    batch: (cls, sample) =>
      make(`batch:${cls}`, () => {
        const m = sample.clone();
        m.color.set("#ffffff");
        m.vertexColors = true;
        if (cls === "cloth") m.roughness = 0.74;
        if (cls === "metal") m.roughness = 0.28;
        return track(m, sample.envMapIntensity);
      }),
    all,
  };
}

/**
 * Upgrade a legacy MeshStandardMaterial (the non-human bodies) to read under
 * the studio light. `gloss` gives matte shells a little shine so their form
 * shows; leave it off for fur.
 */
export function studioUpgrade(m: THREE.MeshStandardMaterial, gloss = false) {
  if (gloss && m.metalness < 0.5) m.roughness = Math.min(m.roughness, 0.5);
  track(m, m.metalness > 0.5 ? 1.3 : 0.7);
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, f: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = f();
    geoCache.set(key, g);
  }
  return g;
}

export const G = {
  /** Rounded box (108 triangles). Parts thinner than 3 cm are plain boxes (12): the bevel would not show. */
  rbox: (w: number, h: number, d: number, r = 0.25) =>
    cached(`rb${w},${h},${d},${r}`, () =>
      Math.min(w, h, d) < 0.03 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * r),
    ),
  capsule: (r: number, len: number) => cached(`cp${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 3, 10)),
  cyl: (rt: number, rb: number, h: number, seg = 14) => cached(`cy${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  sphere: (r: number, w = r < 0.04 ? 8 : 12, h = r < 0.04 ? 6 : 9) => cached(`sp${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)),
  /** Half sphere (a helmet bowl), open at the bottom. */
  dome: (r: number, sy = 1) =>
    cached(`dm${r},${sy}`, () => {
      const g = new THREE.SphereGeometry(r, 18, 7, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, sy, 1);
      return g;
    }),
  /** A curved armor strip: part of a cone wall, `arc` radians wide, centered on +Z. */
  plate: (rTop: number, rBot: number, h: number, arc: number) =>
    cached(`pl${rTop},${rBot},${h},${arc}`, () => new THREE.CylinderGeometry(rTop, rBot, h, 14, 1, true, -arc / 2, arc)),
  torusArc: (r: number, tube: number, arc: number) => cached(`ta${r},${tube},${arc}`, () => new THREE.TorusGeometry(r, tube, 6, 18, arc)),
  cone: (r: number, h: number, seg = 14) => cached(`cn${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  /** A pleated skirt (hakama) or robe: a flared tube with folds. */
  skirt: (rTop: number, rBot: number, h: number, pleats = 9, depth = 0.02) =>
    cached(`sk${rTop},${rBot},${h},${pleats},${depth}`, () => {
      const g = new THREE.CylinderGeometry(rTop, rBot, h, pleats * 4, 3, true);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        const y = p.getY(i);
        const a = Math.atan2(z, x);
        const k = (0.5 - y / h) * depth; // folds deepen toward the hem
        const r = Math.hypot(x, z) + Math.sin(a * pleats) * k;
        p.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
      }
      g.computeVertexNormals();
      return g;
    }),
  /** A curved single-edged blade along +Y with its edge toward +Z. */
  blade: (len: number, width: number, curve: number) =>
    cached(`bl${len},${width},${curve}`, () => {
      const s = new THREE.Shape();
      const n = 12;
      // A katana bends toward its spine (away from the edge).
      const back = (t: number) => -curve * Math.sin(t * Math.PI * 0.5) * t;
      s.moveTo(-width / 2, 0);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        s.lineTo(-width / 2 + back(t), t * len);
      }
      // kissaki (point)
      s.lineTo(width * 0.15 + back(1), len + width * 0.6);
      for (let i = n; i >= 0; i--) {
        const t = i / n;
        const taper = t > 0.85 ? 1 - (t - 0.85) * 2.2 : 1;
        s.lineTo(width / 2 * taper + back(t), t * len);
      }
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 1 });
      g.translate(0, 0, -0.006);
      // The shape is drawn in XY with the edge toward +X; turn it so the edge faces +Z.
      g.rotateY(-Math.PI / 2);
      return g;
    }),
};

// ── Assembly ─────────────────────────────────────────────────────────────────

/** Add a mesh to a group. Rotations are Euler XYZ in radians. */
export function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number] = [0, 0, 0],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] | number = 1,
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (typeof scale === "number") m.scale.setScalar(scale);
  else m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function joint(parent: THREE.Object3D, pos: [number, number, number] = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...pos);
  parent.add(g);
  return g;
}

/**
 * Merge the static meshes directly inside each group of a hierarchy. Child
 * groups (joints) stay separate so they can still animate. Meshes whose
 * materials share a batch class (lacquer, cloth, metal) are merged into one
 * mesh with a shared vertex-colored material from `mats.batch`; others merge
 * per material. A fighter goes from ~150 draw calls to ~30.
 */
export function bake(root: THREE.Object3D, mats?: MatSet) {
  const groups: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) groups.push(o);
  });
  for (const g of groups) {
    const meshes = g.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && !c.userData.keep);
    if (meshes.length < 2) continue;
    const byKey = new Map<unknown, THREE.Mesh[]>();
    for (const m of meshes) {
      const mat = m.material as THREE.Material;
      const key = (mats && (mat.userData.batch as string | undefined)) || mat;
      byKey.set(key, [...(byKey.get(key) ?? []), m]);
    }
    for (const [key, list] of byKey) {
      if (list.length < 2) continue;
      const distinct = new Set(list.map((m) => m.material));
      const colored = typeof key === "string" && distinct.size > 1;
      const geos = list.map((m) => {
        m.updateMatrix();
        let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        geo = geo.applyMatrix4(m.matrix);
        for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(name)) geo.deleteAttribute(name);
        if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
        if (colored) {
          const c = (m.material as THREE.MeshStandardMaterial).color;
          const n = geo.attributes.position.count;
          const arr = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
          geo.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3));
        }
        return geo;
      });
      const merged = mergeGeometries(geos, false);
      geos.forEach((x) => x.dispose());
      if (!merged) continue;
      for (const m of list) g.remove(m);
      const first = list[0].material as THREE.MeshStandardMaterial;
      const mat = colored && mats ? mats.batch(key as string, first) : first;
      const one = new THREE.Mesh(merged, mat);
      one.castShadow = true;
      one.receiveShadow = true;
      one.userData.baked = true;
      g.add(one);
    }
  }
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material).userData?.noShadow) m.castShadow = false;
  });
}

/** Dispose the geometries `bake` created (shared cached ones are kept). */
export function disposeBaked(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o.userData.baked) (o as THREE.Mesh).geometry.dispose();
  });
}

// ── Contact shadow ───────────────────────────────────────────────────────────

let blobTex: THREE.Texture | null = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(0,0,0,0.85)");
  grd.addColorStop(0.55, "rgba(0,0,0,0.35)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = grd;
  x.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

/** A soft dark disc under a fighter that keeps them grounded; fades as they leave the floor. */
export function contactShadow(radius: number) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.6 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -1;
  m.userData.keep = true;
  return m;
}

// ── Motion helpers ───────────────────────────────────────────────────────────

export const ease = {
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  out: (t: number) => 1 - (1 - t) ** 3,
  in: (t: number) => t * t * t,
  /** Ease out with a small overshoot past 1, for follow-through. */
  back: (t: number, s = 1.4) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  smooth: (t: number) => t * t * (3 - 2 * t),
};

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Progress of `t` through the window [a, b], clamped to 0–1. */
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/**
 * Two-bone IK in the leg's sagittal plane. Given the ankle target relative to
 * the hip (dy down is negative, dz forward is positive), returns the thigh and
 * knee rotations (about X) that place the ankle there with the knee in front.
 */
export function legIK(dy: number, dz: number, l1: number, l2: number) {
  const d = Math.min(Math.hypot(dy, dz), (l1 + l2) * 0.999);
  const alpha = Math.atan2(dz, -dy); // forward angle of hip→ankle from straight down
  const beta = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const knee = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));
  return { thigh: -(alpha + beta), shin: Math.PI - knee };
}

/** A damped spring for secondary motion (scarves, hair, armor plates). */
export class Spring {
  x = 0;
  v = 0;
  stiffness: number;
  damping: number;
  constructor(stiffness = 60, damping = 9) {
    this.stiffness = stiffness;
    this.damping = damping;
  }
  step(target: number, dt: number) {
    const h = Math.min(dt, 1 / 30);
    this.v += (-(this.x - target) * this.stiffness - this.v * this.damping) * h;
    this.x += this.v * h;
    return this.x;
  }
}

// ── Pose blending ────────────────────────────────────────────────────────────

type AnimLike = string;
const ACTIONS = new Set(["slash", "special", "fold", "parry", "leap"]);
const REACTIONS = new Set(["hurt", "die"]);

/** How long to blend from one pose to the next (tokens in motion.ts → pose). */
export function blendTime(from: AnimLike, to: AnimLike, tokens: { attack: number; react: number; settle: number; locomotion: number }) {
  if (ACTIONS.has(to)) return tokens.attack;
  if (REACTIONS.has(to)) return tokens.react;
  if (ACTIONS.has(from) || REACTIONS.has(from)) return tokens.settle;
  return tokens.locomotion;
}

/**
 * Wrap a pose function so a change of animation blends from the pose on
 * screen instead of snapping. `skip` lists transitions the pose function
 * already makes continuous (e.g. a gait that runs through idle and walk).
 */
export function withBlend<A extends AnimLike, R extends unknown[]>(
  body: THREE.Object3D,
  pose: (name: A, t: number, ...rest: R) => void,
  tokens: () => { attack: number; react: number; settle: number; locomotion: number },
  skip: (from: A, to: A) => boolean = () => false,
) {
  const nodes: THREE.Object3D[] = [];
  body.traverse((o) => nodes.push(o));
  const q = nodes.map(() => new THREE.Quaternion());
  const p = nodes.map(() => new THREE.Vector3());
  const s = nodes.map(() => new THREE.Vector3());
  const tq = new THREE.Quaternion();
  const tv = new THREE.Vector3();
  let last: A | null = null;
  let t0 = 0;
  let dur = 0;
  return (name: A, t: number, ...rest: R) => {
    if (last !== null && name !== last && !skip(last, name)) {
      nodes.forEach((n, i) => {
        q[i].copy(n.quaternion);
        p[i].copy(n.position);
        s[i].copy(n.scale);
      });
      t0 = t;
      dur = blendTime(last, name, tokens());
    }
    last = name;
    pose(name, t, ...rest);
    if (dur <= 0) return;
    const w = (t - t0) / dur;
    if (w >= 1 || w < 0) {
      dur = 0;
      return;
    }
    const e = ease.smooth(w);
    nodes.forEach((n, i) => {
      tq.copy(n.quaternion);
      n.quaternion.copy(q[i]).slerp(tq, e);
      tv.copy(n.position);
      n.position.lerpVectors(p[i], tv, e);
      tv.copy(n.scale);
      n.scale.lerpVectors(s[i], tv, e);
    });
  };
}
