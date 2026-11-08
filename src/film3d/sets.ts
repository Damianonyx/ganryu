import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, type FilmStage } from "./lab";

/**
 * Sets for the 3D film, built in code: skies, mountains, trees, the village
 * (houses, fences, lanterns, the gate and palisade), mist, smoke, and crows.
 */

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const easeIn = (t: number) => clamp01(t) ** 3;

export function std(color: number | string, rough = 0.85, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Smooth value noise in 2D, for ridgelines, terrain, and foliage. */
export function noise2(seed = 1) {
  const r = rng(seed);
  const perm = Array.from({ length: 512 }, () => r());
  const h = (x: number, y: number) => perm[((x & 255) + ((y & 255) * 57)) & 511];
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  };
}
export function fbm(n: (x: number, y: number) => number, x: number, y: number, oct = 4) {
  let a = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    a += n(x * f, y * f) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return a;
}

// ── Sky ─────────────────────────────────────────────────────────────────────

/** A gradient sky with a glow toward the sun (or the fires), and optional soft clouds. */
export function sky(s: FilmStage, top: string, horizon: string, glow: string, glowDir = V(0, 0, 1), o: { clouds?: string; cloudAmt?: number; glowPow?: number } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      glow: { value: new THREE.Color(glow) },
      dir: { value: glowDir.clone().normalize() },
      cloud: { value: new THREE.Color(o.clouds ?? horizon) },
      amt: { value: o.cloudAmt ?? 0 },
      pw: { value: o.glowPow ?? 6 },
    },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 dir; uniform vec3 cloud; uniform float amt; uniform float pw; varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fb(vec2 p){ float a = 0.0; float s = 0.5; for (int i = 0; i < 5; i++){ a += vn(p) * s; p *= 2.07; s *= 0.5; } return a; }
      void main(){ float h = clamp(vP.y * 1.6 + 0.08, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.7));
        vec3 d2 = normalize(vec3(dir.x, 0.0, dir.z));
        float g = pow(max(dot(normalize(vec3(vP.x, 0.0, vP.z)), d2), 0.0), pw) * (1.0 - h);
        c += glow * g;
        if (amt > 0.0 && vP.y > 0.0) {
          vec2 uv = vP.xz / (vP.y + 0.18) * 1.4;
          float k = smoothstep(0.52, 0.78, fb(uv * vec2(0.6, 1.6))) * amt * smoothstep(0.0, 0.25, vP.y);
          vec3 cc = cloud + glow * g * 1.6;
          c = mix(c, cc, k);
        }
        gl_FragColor = vec4(c, 1.0); }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), mat));
}

export function stars(s: FilmStage, n = 500, opacity = 0.8) {
  const r = rng(3);
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const e = 0.15 + r() * 1.2;
    pos.push(Math.cos(a) * Math.cos(e) * 140, Math.sin(e) * 140, Math.sin(a) * Math.cos(e) * 140);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  s.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc8d0ff, size: 0.35, sizeAttenuation: true, fog: false, transparent: true, opacity })));
}

export function moon(s: FilmStage, at: THREE.Vector3, size = 7, color = 0xdfe6ff) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ color, fog: false, transparent: true, depthWrite: false }));
  m.material.map = canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.32, "rgba(240,244,255,1)");
    g.addColorStop(0.38, "rgba(200,210,255,0.35)");
    g.addColorStop(1, "rgba(120,140,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  });
  m.position.copy(at);
  m.scale.setScalar(size);
  s.add(m);
  return m;
}

/**
 * Mountain ridges as layered silhouettes: each layer hazier than the one in
 * front (aerial perspective), with mist pooling at its foot.
 */
export function ridges(s: FilmStage, layers: { dist: number; height: number; color: string; haze: string; seed: number; rough?: number }[], center = V(0, 0, 0), dir = V(0, 0, -1), width = 400) {
  const yaw = Math.atan2(dir.x, dir.z);
  for (const L of layers) {
    const n = noise2(L.seed);
    const seg = 160;
    const pos: number[] = [];
    const col: number[] = [];
    const top = new THREE.Color(L.color);
    const bot = new THREE.Color(L.haze);
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const x = (u - 0.5) * width;
      const h = L.height * (0.35 + fbm(n, u * 6, 0.5, 5) * 1.2 * (L.rough ?? 1)) + Math.max(0, 1 - Math.abs(u - 0.5) * 3) * L.height * 0.2;
      pos.push(x, h, 0, x, -8, 0);
      col.push(top.r, top.g, top.b, bot.r, bot.g, bot.b);
    }
    const idx: number[] = [];
    for (let i = 0; i < seg; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, depthWrite: true }));
    m.position.copy(center).addScaledVector(dir.clone().normalize(), L.dist);
    m.rotation.y = yaw + Math.PI;
    s.add(m);
  }
}

// ── Ground ──────────────────────────────────────────────────────────────────

/**
 * Ground with a worn dirt road (|x| < road) and grass elsewhere, colored by noise.
 * `height(x, z)` can shape it (terraces, slopes).
 */
export function ground(s: FilmStage, color: string, size = 90, seed = 1, o: { grass?: string; road?: number; roadColor?: string; height?: (x: number, z: number) => number; path?: (x: number, z: number) => number; res?: number; center?: THREE.Vector3 } = {}) {
  const res = o.res ?? 120;
  const g = new THREE.PlaneGeometry(size, size, res, res);
  g.rotateX(-Math.PI / 2);
  if (o.center) g.translate(o.center.x, 0, o.center.z);
  const r = rng(seed);
  const n = noise2(seed + 10);
  const p = g.attributes.position;
  const cols: number[] = [];
  const dirt = new THREE.Color(o.roadColor ?? color);
  const grass = new THREE.Color(o.grass ?? color);
  const roadW = o.road ?? 1.6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const onPath = o.path ? o.path(x, z) : Math.abs(x) < roadW ? 1 : clamp01(1 - (Math.abs(x) - roadW) / 0.8);
    const h0 = o.height ? o.height(x, z) : 0;
    p.setY(i, h0 + (Math.sin(x * 0.7) * Math.cos(z * 0.5) * 0.05 + (r() - 0.5) * 0.03) * (1 - onPath * 0.7));
    const k = 0.72 + fbm(n, x * 0.25, z * 0.25, 3) * 0.5 + (r() - 0.5) * 0.08;
    const c = grass.clone().lerp(dirt, onPath).multiplyScalar(k);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, std("#ffffff", 0.95, 0, { vertexColors: true }));
  m.receiveShadow = true;
  s.add(m);
  return m;
}

/** Tufts of grass as instanced clumps of blades, with a wind sway. */
export function grass(s: FilmStage, n: number, area: (r: () => number) => [number, number] | null, color = "#4a5a34", seed = 17, height = 0.35, y?: (x: number, z: number) => number) {
  const r = rng(seed);
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r();
    const h = height * (0.6 + r() * 0.6);
    const bend = 0.15 + r() * 0.2;
    const g = new THREE.BufferGeometry();
    const w = 0.025;
    const cx = Math.cos(a) * 0.04;
    const cz = Math.sin(a) * 0.04;
    const tx = cx + Math.cos(a) * h * bend;
    const tz = cz + Math.sin(a) * h * bend;
    g.setAttribute("position", new THREE.Float32BufferAttribute([cx - w * Math.sin(a), 0, cz + w * Math.cos(a), cx + w * Math.sin(a), 0, cz - w * Math.cos(a), tx, h, tz], 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute([0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 1, 1, 1], 3));
    g.computeVertexNormals();
    blades.push(g);
  }
  const geo = mergeGeometries(blades)!;
  const mat = std(color, 0.9, 0, { vertexColors: true, side: THREE.DoubleSide });
  const im = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let placed = 0;
  for (let tries = 0; placed < n && tries < n * 10; tries++) {
    const at = area(r);
    if (!at) continue;
    q.setFromAxisAngle(V(0, 1, 0), r() * 6.28);
    const sc = 0.6 + r() * 0.9;
    m.compose(V(at[0], y ? y(at[0], at[1]) : 0, at[1]), q, V(sc, sc * (0.7 + r() * 0.6), sc));
    im.setMatrixAt(placed++, m);
  }
  im.count = placed;
  im.receiveShadow = true;
  s.add(im);
  return sway(mat, 0.08);
}

/** Adds a wind sway to an instanced material; returns a tick(dt). */
function sway(mat: THREE.MeshStandardMaterial, amount: number, from = 0) {
  const u = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = u;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5;
        float k = max(0.0, position.y - ${from.toFixed(2)});
        transformed.x += sin(uWind * 1.4 + ph) * ${amount.toFixed(3)} * k;
        transformed.z += cos(uWind * 1.1 + ph * 1.3) * ${(amount * 0.6).toFixed(3)} * k;
        #endif`,
      );
  };
  return (dt: number) => {
    u.value += dt;
  };
}

// ── Trees ───────────────────────────────────────────────────────────────────

function colorize(g: THREE.BufferGeometry, f: (p: THREE.Vector3, nrm: THREE.Vector3) => THREE.Color) {
  const p = g.attributes.position;
  const nr = g.attributes.normal;
  const cols: number[] = [];
  const v = new THREE.Vector3();
  const nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    nn.fromBufferAttribute(nr, i);
    const c = f(v, nn);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  return g;
}

/** A lumpy foliage clump: an icosphere pushed out by noise, flattened by `flat`. */
function clump(r: () => number, at: THREE.Vector3, size: number, flat: number, leaf: THREE.Color, n: (x: number, y: number) => number) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const off = r() * 100;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = 0.75 + n(v.x * 2.2 + off, v.y * 2.2 + v.z * 1.7) * 0.55;
    v.multiplyScalar(d);
    v.y *= flat;
    v.multiplyScalar(size).add(at);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const tint = 0.85 + r() * 0.3;
  return colorize(g, (q, nrm) => {
    // lit from above, dark underneath and inside
    const up = clamp01(nrm.y * 0.5 + 0.5);
    const k = (0.35 + up * 0.75) * tint;
    return leaf.clone().multiplyScalar(k);
  });
}

function trunkGeo(points: THREE.Vector3[], r0: number, r1: number, bark: THREE.Color) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, 12, 1, 7, false);
  // taper: scale each ring's radius
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const rings = 13;
  const per = p.count / rings;
  for (let i = 0; i < p.count; i++) {
    const ring = Math.floor(i / per);
    const u = ring / (rings - 1);
    const c = curve.getPoint(u);
    v.fromBufferAttribute(p, i).sub(c).multiplyScalar(lerp(r0, r1, u)).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return colorize(g, () => bark);
}

export type TreeKind = "cedar" | "pine" | "maple" | "cherry" | "bare";

/** One tree's geometry (trunk, branches, foliage) with vertex colors, around the origin. */
export function treeGeometry(kind: TreeKind, seed: number, leafColor?: string) {
  const r = rng(seed);
  const n = noise2(seed);
  const parts: THREE.BufferGeometry[] = [];
  const bark = new THREE.Color(kind === "cherry" ? "#2a1e1c" : kind === "pine" ? "#2e2620" : "#2a221c");
  if (kind === "cedar") {
    const h = 10 + r() * 4;
    parts.push(trunkGeo([V(0, 0, 0), V(0.1, h * 0.5, 0), V(0, h, 0)], 0.28, 0.05, bark));
    const leaf = new THREE.Color(leafColor ?? "#1e2e22");
    // a narrow cone of many small, fluffy clumps
    const tiers = 15;
    for (let i = 0; i < tiers; i++) {
      const u = i / (tiers - 1);
      const y = h * (0.28 + u * 0.7) + (r() - 0.5) * 0.4;
      const rad = lerp(1.7, 0.35, u) * (0.85 + r() * 0.3);
      const k = 3 + Math.round((1 - u) * 2);
      for (let j = 0; j < k; j++) {
        const a = (j / k) * Math.PI * 2 + r() * 1.2;
        parts.push(clump(r, V(Math.cos(a) * rad * 0.5, y + (r() - 0.5) * 0.3, Math.sin(a) * rad * 0.5), rad * (0.5 + r() * 0.25), 0.78, leaf, n));
      }
    }
    parts.push(clump(r, V(0, h * 1.0, 0), 0.45, 1.6, leaf, n));
  } else if (kind === "pine") {
    // a leaning, crooked trunk with flat pads of needles on its branches
    const h = 6 + r() * 3;
    const lean = (r() - 0.5) * 1.6;
    const pts = [V(0, 0, 0), V(lean * 0.3, h * 0.35, 0.2), V(lean * 0.8, h * 0.7, -0.2), V(lean, h, 0)];
    parts.push(trunkGeo(pts, 0.24, 0.07, bark));
    const curve = new THREE.CatmullRomCurve3(pts);
    const leaf = new THREE.Color(leafColor ?? "#24341e");
    const nb = 6 + Math.round(r() * 3);
    for (let i = 0; i < nb; i++) {
      const u = 0.45 + (i / nb) * 0.55;
      const at = curve.getPoint(u);
      const a = r() * Math.PI * 2;
      const len = lerp(2.6, 0.9, u) * (0.8 + r() * 0.4);
      const end = at.clone().add(V(Math.cos(a) * len, 0.3 + r() * 0.5, Math.sin(a) * len));
      parts.push(trunkGeo([at, at.clone().lerp(end, 0.5).add(V(0, 0.25, 0)), end], 0.07, 0.03, bark));
      parts.push(clump(r, end.clone().add(V(0, 0.15, 0)), 0.9 + r() * 0.5, 0.36, leaf, n));
      parts.push(clump(r, end.clone().lerp(at, 0.35).add(V(0, 0.2, 0)), 0.65 + r() * 0.3, 0.38, leaf, n));
    }
    parts.push(clump(r, curve.getPoint(1).add(V(0, 0.25, 0)), 1.2, 0.4, leaf, n));
  } else {
    // a round crown: maple, cherry in blossom, or bare winter branches
    const h = 4 + r() * 2.5;
    const pts = [V(0, 0, 0), V((r() - 0.5) * 0.4, h * 0.5, (r() - 0.5) * 0.4), V((r() - 0.5) * 0.6, h, 0)];
    parts.push(trunkGeo(pts, 0.2, 0.08, bark));
    const top = pts[2];
    const nb = 5 + Math.round(r() * 2);
    const leaf = new THREE.Color(leafColor ?? (kind === "cherry" ? "#e8b4c0" : "#8a2a1a"));
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2 + r();
      const end = top.clone().add(V(Math.cos(a) * (1.4 + r()), 0.6 + r() * 1.2, Math.sin(a) * (1.4 + r())));
      const from = pts[1].clone().lerp(top, 0.6);
      parts.push(trunkGeo([from, from.clone().lerp(end, 0.5).add(V(0, 0.2, 0)), end], 0.08, 0.025, bark));
      if (kind !== "bare") parts.push(clump(r, end, 1.0 + r() * 0.5, 0.75, leaf, n));
    }
    if (kind !== "bare") parts.push(clump(r, top.clone().add(V(0, 1.4, 0)), 1.5, 0.8, leaf, n));
  }
  for (const p of parts) {
    for (const k of Object.keys(p.attributes)) if (!["position", "normal", "color"].includes(k)) p.deleteAttribute(k);
  }
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
}

/**
 * A stand of trees: a few distinct variants, instanced, swaying in the wind.
 * Returns a tick(dt) for the sway.
 */
export function trees(s: FilmStage, kind: TreeKind, n: number, area: (r: () => number) => [number, number] | null, o: { seed?: number; scale?: [number, number]; leaf?: string; variants?: number; y?: (x: number, z: number) => number; sway?: number; shadows?: boolean } = {}) {
  const seed = o.seed ?? 5;
  const r = rng(seed);
  const nv = o.variants ?? 3;
  const mat = std("#ffffff", 0.92, 0, { vertexColors: true });
  const tick = sway(mat, o.sway ?? 0.006, 1.5);
  const ims = Array.from({ length: nv }, (_, i) => {
    const im = new THREE.InstancedMesh(treeGeometry(kind, seed * 31 + i, o.leaf), mat, n);
    im.count = 0;
    im.castShadow = o.shadows !== false;
    im.receiveShadow = true;
    s.add(im);
    return im;
  });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const [s0, s1] = o.scale ?? [0.8, 1.2];
  let placed = 0;
  for (let tries = 0; placed < n && tries < n * 30; tries++) {
    const at = area(r);
    if (!at) continue;
    const im = ims[placed % nv];
    q.setFromAxisAngle(V(0, 1, 0), r() * 6.28);
    const sc = lerp(s0, s1, r());
    m.compose(V(at[0], o.y ? o.y(at[0], at[1]) : 0, at[1]), q, V(sc, sc, sc));
    im.setMatrixAt(im.count++, m);
    placed++;
  }
  for (const im of ims) im.instanceMatrix.needsUpdate = true;
  return tick;
}

/** A single tree at a spot (foreground framing). */
export function tree(s: FilmStage, kind: TreeKind, x: number, z: number, o: { seed?: number; scale?: number; yaw?: number; leaf?: string; y?: number } = {}) {
  const mesh = new THREE.Mesh(treeGeometry(kind, o.seed ?? 1, o.leaf), std("#ffffff", 0.92, 0, { vertexColors: true }));
  mesh.position.set(x, o.y ?? 0, z);
  mesh.rotation.y = o.yaw ?? 0;
  mesh.scale.setScalar(o.scale ?? 1);
  mesh.castShadow = mesh.receiveShadow = true;
  s.add(mesh);
  return mesh;
}

// ── The village ─────────────────────────────────────────────────────────────

let thatchTex: THREE.Texture | null = null;
let plasterTex: THREE.Texture | null = null;
let shojiTex: THREE.Texture | null = null;
let woodTex: THREE.Texture | null = null;

const TEX = {
  thatch: () =>
    (thatchTex ??= canvasTex(256, 256, (x) => {
      const r = rng(5);
      x.fillStyle = "#4e4230";
      x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) {
        const px = r() * 256;
        const py = r() * 256;
        const l = 10 + r() * 26;
        const v = 50 + r() * 75;
        x.strokeStyle = `rgba(${v + 30},${v + 10},${v - 25},${0.35 + r() * 0.4})`;
        x.lineWidth = 0.6 + r() * 1.2;
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + (r() - 0.5) * 3, py + l);
        x.stroke();
      }
      // courses of thatch
      for (let y = 0; y < 256; y += 32) {
        x.fillStyle = "rgba(20,14,8,0.28)";
        x.fillRect(0, y, 256, 4);
      }
    })),
  plaster: () =>
    (plasterTex ??= canvasTex(256, 256, (x) => {
      const r = rng(8);
      x.fillStyle = "#cfc4ae";
      x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4000; i++) {
        const v = 160 + r() * 70;
        x.fillStyle = `rgba(${v},${v - 8},${v - 24},0.18)`;
        x.fillRect(r() * 256, r() * 256, 2 + r() * 4, 2 + r() * 4);
      }
      x.fillStyle = "rgba(60,40,20,0.12)";
      x.fillRect(0, 200, 256, 56); // splash stains at the foot
    })),
  wood: () =>
    (woodTex ??= canvasTex(256, 256, (x) => {
      const r = rng(9);
      x.fillStyle = "#4a3624";
      x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 16; i++) {
        x.fillStyle = `rgba(${30 + r() * 40},${20 + r() * 25},${10 + r() * 15},0.6)`;
        x.fillRect(i * 16, 0, 15, 256);
        x.fillStyle = "rgba(0,0,0,0.5)";
        x.fillRect(i * 16 + 15, 0, 1, 256);
      }
      for (let i = 0; i < 400; i++) {
        x.strokeStyle = `rgba(20,12,6,${0.15 + r() * 0.25})`;
        x.beginPath();
        const px = r() * 256;
        x.moveTo(px, r() * 256);
        x.lineTo(px + (r() - 0.5) * 2, r() * 256);
        x.stroke();
      }
    })),
  /** Shoji: warm paper with the dark lattice drawn in, used as both color and glow. */
  shoji: () =>
    (shojiTex ??= canvasTex(128, 256, (x) => {
      const g = x.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "#ffd29a");
      g.addColorStop(1, "#ffb066");
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 256);
      x.fillStyle = "#2a1a0e";
      for (let i = 0; i <= 4; i++) x.fillRect(i * 31, 0, 4, 256);
      for (let j = 0; j <= 8; j++) x.fillRect(0, j * 31.5, 128, 4);
      x.fillRect(0, 200, 128, 56); // the wooden kickboard
    })),
};

export type House = { group: THREE.Group; door: THREE.Vector3; roofY: number; shoji: THREE.MeshStandardMaterial };

/**
 * A minka farmhouse: a stone footing, timber frame with plaster panels,
 * glowing shoji, an engawa veranda, and a deep thatched hip-and-gable roof.
 * The front (with the door) faces +Z before `yaw`.
 */
export function house(s: FilmStage, x: number, z: number, yaw: number, o: { w?: number; d?: number; glow?: number; lantern?: boolean; seed?: number; y?: number } = {}): House {
  const w = o.w ?? 6;
  const d = o.d ?? 4.6;
  const r = rng(o.seed ?? Math.round(x * 13 + z * 7));
  const g = new THREE.Group();
  g.position.set(x, o.y ?? 0, z);
  g.rotation.y = yaw;
  const timber = std("#2a1c12", 0.8);
  const plaster = std("#ffffff", 0.95, 0, { map: TEX.plaster() });
  const planks = std("#ffffff", 0.88, 0, { map: TEX.wood() });
  const stone = std("#4a4844", 0.95);
  const glow = o.glow ?? 1;
  const shoji = std("#ffffff", 0.8, 0, { map: TEX.shoji(), emissive: "#ffffff", emissiveMap: TEX.shoji(), emissiveIntensity: 0.55 * glow });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, p: THREE.Vector3, rot = V(0, 0, 0), shadow = true) => {
    const o2 = new THREE.Mesh(geo, m);
    o2.position.copy(p);
    o2.rotation.setFromVector3(rot);
    o2.castShadow = shadow;
    o2.receiveShadow = true;
    g.add(o2);
    return o2;
  };
  const floor = 0.45;
  const wallH = 2.3;
  // footing and raised floor
  add(new THREE.BoxGeometry(w + 0.3, floor, d + 0.3), stone, V(0, floor / 2, 0));
  add(new THREE.BoxGeometry(w + 1.4, 0.08, 0.9), planks, V(0, floor - 0.02, d / 2 + 0.55)); // engawa
  for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(0.1, floor, 0.1), timber, V((i / 3) * (w / 2 + 0.6), floor / 2, d / 2 + 0.95));
  add(new THREE.BoxGeometry(0.9, 0.2, 0.45), stone, V(0, 0.1, d / 2 + 1.25)); // the step stone
  // walls: plaster and timber, with plank skirting
  const walls = [
    { len: w, at: V(0, 0, d / 2), rot: 0, front: true },
    { len: w, at: V(0, 0, -d / 2), rot: Math.PI, front: false },
    { len: d, at: V(w / 2, 0, 0), rot: Math.PI / 2, front: false },
    { len: d, at: V(-w / 2, 0, 0), rot: -Math.PI / 2, front: false },
  ];
  for (const wl of walls) {
    const bay = wl.len / Math.max(2, Math.round(wl.len / 1.5));
    const n = Math.round(wl.len / bay);
    const dirX = Math.cos(wl.rot);
    const dirZ = -Math.sin(wl.rot);
    const out = V(Math.sin(wl.rot), 0, Math.cos(wl.rot));
    for (let i = 0; i < n; i++) {
      const u = -wl.len / 2 + bay * (i + 0.5);
      const c = wl.at.clone().add(V(dirX * u, 0, dirZ * u));
      const isDoor = wl.front && Math.abs(u) < bay * 0.6;
      const isWindow = !isDoor && (wl.front ? r() < 0.7 : r() < 0.35);
      if (isDoor || isWindow) {
        const ph = isDoor ? wallH - 0.15 : 1.1;
        const py = isDoor ? floor + ph / 2 : floor + 1.05;
        add(new THREE.PlaneGeometry(bay - 0.12, ph), shoji, c.clone().add(V(0, py, 0)).addScaledVector(out, 0.01), V(0, wl.rot, 0), false);
        if (!isDoor) {
          add(new THREE.PlaneGeometry(bay - 0.12, 0.5), planks, c.clone().add(V(0, floor + 0.25, 0)).addScaledVector(out, 0.01), V(0, wl.rot, 0));
          add(new THREE.PlaneGeometry(bay - 0.12, wallH - 1.65), plaster, c.clone().add(V(0, floor + 1.6 + (wallH - 1.6) / 2, 0)).addScaledVector(out, 0.01), V(0, wl.rot, 0));
        }
      } else {
        add(new THREE.PlaneGeometry(bay - 0.12, 0.8), planks, c.clone().add(V(0, floor + 0.4, 0)).addScaledVector(out, 0.01), V(0, wl.rot, 0));
        add(new THREE.PlaneGeometry(bay - 0.12, wallH - 0.8), plaster, c.clone().add(V(0, floor + 0.8 + (wallH - 0.8) / 2, 0)).addScaledVector(out, 0.01), V(0, wl.rot, 0));
      }
      // posts between bays
      add(new THREE.BoxGeometry(0.14, wallH, 0.14), timber, c.clone().add(V(-dirX * bay * 0.5, floor + wallH / 2, -dirZ * bay * 0.5)).addScaledVector(out, 0.02));
    }
    // the beam on top and the sill
    add(new THREE.BoxGeometry(wl.len + 0.1, 0.16, 0.16), timber, wl.at.clone().add(V(0, floor + wallH, 0)).addScaledVector(out, 0.02), V(0, wl.rot, 0));
  }
  // the back fill so the walls are not see-through
  add(new THREE.BoxGeometry(w - 0.05, wallH, d - 0.05), std("#140c08", 1), V(0, floor + wallH / 2, 0), V(0, 0, 0), true);
  // roof: a hipped thatch with a small gable on top (irimoya)
  const roofY = floor + wallH + 0.05;
  const ov = 0.9;
  const rh = 2.4;
  const thatch = std("#ffffff", 0.97, 0, { map: TEX.thatch() });
  (thatch.map as THREE.Texture).repeat.set(2, 1);
  const hip = roofGeo(w + ov * 2, d + ov * 2, rh, 0.32, 0.7);
  add(hip, thatch, V(0, roofY, 0));
  // ridge: a dark cap and crossed ridge logs
  add(new RoundedBoxGeometry(w * 0.62, 0.32, 0.55, 2, 0.08), std("#3a2a1a", 0.9), V(0, roofY + rh + 0.05, 0));
  for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.08, 0.5, 0.7), timber, V(-w * 0.26 + (i * w * 0.52) / 4, roofY + rh + 0.12, 0), V(0, 0, 0));
  for (const sx of [-1, 1]) add(new THREE.PlaneGeometry(0.9, 0.7), std("#1a120c", 0.9, 0, { side: THREE.DoubleSide }), V(sx * w * 0.31, roofY + rh - 0.25, 0), V(0, Math.PI / 2, 0)); // gable vents
  if (o.lantern !== false) {
    // a paper lantern by the door
    lantern(s, g, V(w * 0.22, floor + 2.05, d / 2 + 0.75), 0.9 * glow, r() * 100);
  }
  // warm light spilling from the door
  if (glow > 0.2) {
    const spill = new THREE.PointLight(0xffa860, 2.2 * glow, 6, 1.8);
    spill.position.set(0, floor + 1.1, d / 2 + 0.8);
    g.add(spill);
  }
  s.add(g);
  g.updateMatrixWorld(true);
  const door = V(0, floor, d / 2 + 1.4).applyMatrix4(g.matrixWorld);
  return { group: g, door, roofY, shoji };
}

/** A hipped roof slab of thickness `th` over a w × d footprint, ridge length w·(1-2·hipK)... */
function roofGeo(w: number, d: number, h: number, th: number, ridgeK: number) {
  const rx = (w / 2) * ridgeK - d * 0.1;
  const tops = [V(-rx, h, 0), V(rx, h, 0)];
  const e = [V(-w / 2, 0, d / 2), V(w / 2, 0, d / 2), V(w / 2, 0, -d / 2), V(-w / 2, 0, -d / 2)];
  const pos: number[] = [];
  const uv: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ua: number[], ub: number[], uc: number[]) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    uv.push(...ua, ...ub, ...uc);
  };
  const L = Math.hypot(h, d / 2);
  // front and back slopes (trapezoids), hip ends (triangles)
  tri(e[0], e[1], tops[1], [0, 0], [w / 3, 0], [(w / 2 + rx) / 3, L / 3]);
  tri(e[0], tops[1], tops[0], [0, 0], [(w / 2 + rx) / 3, L / 3], [(w / 2 - rx) / 3, L / 3]);
  tri(e[2], e[3], tops[0], [0, 0], [w / 3, 0], [(w / 2 + rx) / 3, L / 3]);
  tri(e[2], tops[0], tops[1], [0, 0], [(w / 2 + rx) / 3, L / 3], [(w / 2 - rx) / 3, L / 3]);
  tri(e[1], e[2], tops[1], [0, 0], [d / 3, 0], [d / 6, L / 3]);
  tri(e[3], e[0], tops[0], [0, 0], [d / 3, 0], [d / 6, L / 3]);
  // the thick thatch edge along the eaves
  const lo = e.map((p) => p.clone().add(V(0, -th, 0)));
  for (let i = 0; i < 4; i++) {
    const a = e[i];
    const b = e[(i + 1) % 4];
    const c = lo[(i + 1) % 4];
    const dd = lo[i];
    const len = a.distanceTo(b) / 3;
    tri(a, dd, c, [0, 0.1], [0, 0], [len, 0]);
    tri(a, c, b, [0, 0.1], [len, 0], [len, 0.1]);
  }
  // underside
  tri(lo[0], lo[2], lo[1], [0, 0], [1, 1], [1, 0]);
  tri(lo[0], lo[3], lo[2], [0, 0], [0, 1], [1, 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** A paper lantern (chōchin) hanging at `at` in `parent`, glowing, with a small warm light. */
export function lantern(s: FilmStage, parent: THREE.Object3D, at: THREE.Vector3, glow = 1, seed = 1, color = "#ff9a4a") {
  const g = new THREE.Group();
  g.position.copy(at);
  const paper = canvasTex(64, 128, (x) => {
    x.fillStyle = "#fff0d0";
    x.fillRect(0, 0, 64, 128);
    x.fillStyle = "rgba(120,40,20,0.55)";
    for (let y = 6; y < 128; y += 10) x.fillRect(0, y, 64, 2);
    x.fillStyle = "rgba(170,30,20,0.85)";
    x.fillRect(18, 40, 28, 46); // a painted mark
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), std("#ffffff", 0.7, 0, { map: paper, emissive: color, emissiveMap: paper, emissiveIntensity: 1.6 * glow }));
  body.scale.set(1, 1.45, 1);
  g.add(body);
  for (const y of [0.25, -0.25]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12), std("#141010", 0.6));
    cap.position.y = y;
    g.add(cap);
  }
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.35, 4), std("#141010", 0.8));
  cord.position.y = 0.45;
  g.add(cord);
  const light = new THREE.PointLight(0xffa050, 1.6 * glow, 7, 1.7);
  g.add(light);
  parent.add(g);
  const r = rng(seed);
  const ph = r() * 10;
  // a gentle sway and flicker
  const tick = (t: number) => {
    g.rotation.z = Math.sin(t * 1.3 + ph) * 0.04;
    light.intensity = 1.6 * glow * (0.92 + Math.sin(t * 11 + ph) * 0.05 + Math.sin(t * 23 + ph) * 0.03);
  };
  s.ticks.push((c) => tick(c.t));
  return { group: g, light, body };
}

/** A stone lantern (tōrō) with a glowing fire box. */
export function stoneLantern(s: FilmStage, x: number, z: number, glow = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const st = std("#6a6660", 0.95);
  const add = (geo: THREE.BufferGeometry, y: number, m: THREE.Material = st) => {
    const o = new THREE.Mesh(geo, m);
    o.position.y = y;
    o.castShadow = o.receiveShadow = true;
    g.add(o);
    return o;
  };
  add(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 6), 0.07);
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 10), 0.49);
  add(new THREE.CylinderGeometry(0.26, 0.18, 0.12, 6), 0.9);
  add(new THREE.BoxGeometry(0.3, 0.28, 0.3), 1.1, std("#2a1a10", 0.8, 0, { emissive: "#ffa050", emissiveIntensity: 1.4 * glow }));
  add(new THREE.ConeGeometry(0.42, 0.3, 6), 1.39);
  add(new THREE.SphereGeometry(0.06, 8, 6), 1.58);
  const l = new THREE.PointLight(0xffa050, 1.4 * glow, 5, 1.8);
  l.position.y = 1.1;
  g.add(l);
  s.add(g);
  return g;
}

/** A bamboo fence (takegaki) from a to b. */
export function fence(s: FilmStage, a: [number, number], b: [number, number], h = 1.1) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const g = new THREE.Group();
  g.position.set(a[0], 0, a[1]);
  g.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  const bamboo = std("#7a7048", 0.7);
  const post = std("#3a2a1c", 0.9);
  const n = Math.max(2, Math.round(len / 1.8));
  for (let i = 0; i <= n; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h + 0.15, 8), post);
    p.position.set((i / n) * len, (h + 0.15) / 2, 0);
    p.castShadow = true;
    g.add(p);
  }
  for (const y of [h * 0.3, h * 0.65, h * 0.95]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), bamboo);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(len / 2, y, 0.05);
    rail.castShadow = true;
    g.add(rail);
  }
  const slats = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, h, 5), bamboo, Math.ceil(len / 0.09));
  const m = new THREE.Matrix4();
  let k = 0;
  for (let x = 0.05; x < len; x += 0.09) {
    m.makeTranslation(x, h / 2, 0);
    slats.setMatrixAt(k++, m);
  }
  slats.count = k;
  slats.castShadow = true;
  g.add(slats);
  s.add(g);
  return g;
}

/** A palisade of sharpened logs along x at z, leaving a gap for the gate. */
export function palisade(s: FilmStage, z: number, from: number, to: number, gap: number, seed = 9) {
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

export type Gate = { group: THREE.Group; leaves: THREE.Group[]; planks: THREE.Mesh[] };

/** The village gate: two posts, a double beam, and two plank doors with iron bands. */
export function gate(s: FilmStage, z: number): Gate {
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

/** The watchtower with its warning bell. Returns the bell (swing it) and the striker log. */
export function bellTower(s: FilmStage, x: number, z: number, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const wood = std("#3a2a1c", 0.88);
  const dark = std("#22180f", 0.9);
  const H = 5.2;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, H, 8), wood);
      p.position.set(sx * 0.9, H / 2, sz * 0.9);
      p.rotation.z = -sx * 0.05;
      p.rotation.x = sz * 0.05;
      p.castShadow = true;
      g.add(p);
    }
  for (const y of [1.4, 3.0]) {
    for (const r of [0, Math.PI / 2]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.1), dark);
      brace.position.set(0, y, 0);
      brace.rotation.y = r;
      for (const off of [-0.9, 0.9]) {
        const b2 = brace.clone();
        if (r === 0) b2.position.z = off;
        else b2.position.x = off;
        b2.castShadow = true;
        g.add(b2);
      }
    }
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 2.3), wood);
  floor.position.y = H - 1.4;
  floor.castShadow = true;
  g.add(floor);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.0, 4), std("#3e3426", 0.95));
  roof.position.y = H + 0.5;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  // the bell hangs from a beam under the roof
  const pivot = new THREE.Group();
  pivot.position.set(0, H - 0.05, 0);
  g.add(pivot);
  const bronze = std("#6a5030", 0.42, 0.85);
  const bell = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.02, 0), new THREE.Vector2(0.22, -0.05), new THREE.Vector2(0.28, -0.3), new THREE.Vector2(0.33, -0.72), new THREE.Vector2(0.36, -0.8), new THREE.Vector2(0.3, -0.8)], 20), bronze);
  bell.castShadow = true;
  pivot.add(bell);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3 + i * 0.02, 0.012, 6, 20), bronze);
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.3 - i * 0.2;
    pivot.add(band);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 0.14), dark);
  beam.position.y = H;
  g.add(beam);
  // a striker log hung on ropes beside it
  const strikerPivot = new THREE.Group();
  strikerPivot.position.set(0.75, H - 0.1, 0);
  g.add(strikerPivot);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), wood);
  log.rotation.z = Math.PI / 2;
  log.position.set(0, -0.55, 0);
  strikerPivot.add(log);
  for (const lx of [-0.3, 0.3]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.55, 4), std("#8a7a5a", 0.9));
    rope.position.set(lx, -0.27, 0);
    strikerPivot.add(rope);
  }
  s.add(g);
  return { group: g, pivot, striker: strikerPivot, top: H };
}

// ── Atmosphere ─────────────────────────────────────────────────────────────

let softTex: THREE.Texture | null = null;
export const soft = () =>
  (softTex ??= canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  }));

/** Low drifting mist: large soft sprites hugging the ground. Returns a drift(dt). */
export function mist(s: FilmStage, n: number, area: [number, number, number, number], color = 0x8a96b8, opacity = 0.22, seed = 61, y0 = 0.25, size = 1) {
  const r = rng(seed);
  const puffs: { m: THREE.Sprite; v: number }[] = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color, transparent: true, opacity: opacity * (0.5 + r() * 0.5), depthWrite: false }));
    m.position.set(lerp(area[0], area[1], r()), y0 + r() * 0.5 * size, lerp(area[2], area[3], r()));
    m.scale.set((4 + r() * 5) * size, (1.2 + r() * 1.2) * size, 1);
    s.add(m);
    puffs.push({ m, v: 0.15 + r() * 0.25 });
  }
  return (dt: number) => {
    for (const p of puffs) p.m.position.x += p.v * dt;
  };
}

/** A thin column of hearth smoke rising and spreading (cooking fires through the roof vents). */
export function wisp(s: FilmStage, at: THREE.Vector3, color = 0x9a8a84, seed = 3, rate = 3) {
  const r = rng(seed);
  const n = 24;
  const ps = Array.from({ length: n }, (_, i) => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color, transparent: true, opacity: 0, depthWrite: false }));
    s.add(m);
    return { m, age: (i / n) * (n / rate), vx: 0.2 + r() * 0.2, ph: r() * 6 };
  });
  const life = n / rate;
  s.ticks.push(({ dt }) => {
    for (const p of ps) {
      p.age += dt;
      if (p.age > life) p.age -= life;
      const u = p.age / life;
      p.m.position.set(at.x + p.vx * p.age * 1.5 + Math.sin(p.age + p.ph) * 0.15, at.y + p.age * 0.9, at.z + Math.cos(p.age * 0.7 + p.ph) * 0.15);
      p.m.scale.setScalar(0.3 + u * 2.4);
      p.m.material.opacity = Math.sin(u * Math.PI) * 0.18 * (1 - u * 0.5);
    }
  });
}

/** Shafts of light slanting through (additive, soft-edged). */
export function shafts(s: FilmStage, from: THREE.Vector3, at: THREE.Vector3[], color = 0x9aa8ff, opacity = 0.022, width = 1.1) {
  for (const a of at) {
    const dir = a.clone().sub(from);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(0.2, width, len, 16, 1, true);
    g.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(V(0, -1, 0), dir.normalize());
    s.add(m);
  }
}

/** A standing torch on a pole. */
export function torch(s: FilmStage, x: number, z: number, seed: number, light = 4.5) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.1, 8), std("#2a1e14", 0.9));
  pole.position.set(x, 1.05, z);
  pole.castShadow = true;
  s.add(pole);
  return s.fire(V(x, 2.15, z), { size: 0.32, rate: 0.7, light, smoke: 5, embers: 14, seed });
}

/** Crows crossing the sky: dark flapping chevrons. */
export function crows(s: FilmStage, n: number, from: THREE.Vector3, vel: THREE.Vector3, seed = 4) {
  const r = rng(seed);
  const mat = new THREE.MeshBasicMaterial({ color: 0x0c0a0c, side: THREE.DoubleSide, fog: false });
  const birds = Array.from({ length: n }, () => {
    const g = new THREE.Group();
    const wing = (side: number) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, side * 0.55, 0, -0.05], 3));
      const m = new THREE.Mesh(geo, mat);
      g.add(m);
      return m;
    };
    const L = wing(1);
    const Rw = wing(-1);
    const off = V((r() - 0.5) * 6, (r() - 0.5) * 2.5, (r() - 0.5) * 4);
    g.scale.setScalar(0.9 + r() * 0.4);
    s.add(g);
    return { g, L, R: Rw, off, ph: r() * 6, f: 7 + r() * 3 };
  });
  s.ticks.push(({ t }) => {
    for (const b of birds) {
      b.g.position.copy(from).add(b.off).addScaledVector(vel, t);
      b.g.position.y += Math.sin(t * 0.8 + b.ph) * 0.3;
      b.g.rotation.y = Math.atan2(vel.x, vel.z);
      const flap = Math.sin(t * b.f + b.ph) * 0.7;
      b.L.rotation.z = flap;
      b.R.rotation.z = -flap;
    }
  });
}

/** Falling particles (rain, snow, petals, ash) in a box around a point. */
export function precipitation(s: FilmStage, kind: "rain" | "snow" | "petals" | "ash", n: number, center: THREE.Vector3, size: [number, number, number], seed = 5) {
  const r = rng(seed);
  const color = kind === "rain" ? 0xaab4c8 : kind === "snow" ? 0xf0f4ff : kind === "petals" ? 0xf2c0cc : 0x8a8a8a;
  const ps: { m: THREE.Mesh | THREE.Sprite; v: THREE.Vector3; ph: number }[] = [];
  const geo = kind === "rain" ? new THREE.CylinderGeometry(0.004, 0.004, 0.35, 3) : kind === "petals" ? new THREE.CircleGeometry(0.025, 5) : null;
  const mat =
    kind === "rain"
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false })
      : kind === "petals"
        ? new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 })
        : new THREE.SpriteMaterial({ map: soft(), color, transparent: true, opacity: kind === "snow" ? 0.9 : 0.6, depthWrite: false });
  for (let i = 0; i < n; i++) {
    const m = geo ? new THREE.Mesh(geo, mat as THREE.Material) : new THREE.Sprite(mat as THREE.SpriteMaterial);
    if (!geo) m.scale.setScalar(kind === "snow" ? 0.05 + r() * 0.04 : 0.04);
    m.position.set(center.x + (r() - 0.5) * size[0], center.y + (r() - 0.5) * size[1], center.z + (r() - 0.5) * size[2]);
    const v = kind === "rain" ? V(-0.6, -9 - r() * 3, 0) : kind === "snow" ? V(0.2, -0.6 - r() * 0.4, 0) : kind === "petals" ? V(0.5, -0.5 - r() * 0.3, 0.1) : V(0.15, -0.3 - r() * 0.2, 0);
    if (kind === "rain") m.rotation.z = -0.06;
    s.add(m);
    ps.push({ m, v, ph: r() * 6 });
  }
  s.ticks.push(({ dt, t }) => {
    for (const p of ps) {
      p.m.position.addScaledVector(p.v, dt);
      if (kind !== "rain") {
        p.m.position.x += Math.sin(t * 1.5 + p.ph) * 0.2 * dt;
        if (kind === "petals") p.m.rotation.set(t * 2 + p.ph, t * 1.3, p.ph);
      }
      if (p.m.position.y < center.y - size[1] / 2) p.m.position.y += size[1];
      if (p.m.position.x < center.x - size[0] / 2) p.m.position.x += size[0];
      if (p.m.position.x > center.x + size[0] / 2) p.m.position.x -= size[0];
    }
  });
}
