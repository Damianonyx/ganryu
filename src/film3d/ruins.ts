import * as THREE from "three";
import { rng, type FilmStage } from "./lab";
import { V, noise2, std, wisp } from "./sets";

/** The village after the fire: charred frames, fallen beams, ash, a last few embers. */

let charTex: THREE.Texture | null = null;
const char = () =>
  (charTex ??= (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    const r = rng(17);
    x.fillStyle = "#141110";
    x.fillRect(0, 0, 256, 256);
    // alligator cracks of burnt wood
    for (let row = 0; row < 14; row++)
      for (let col = 0; col < 8; col++) {
        const v = 22 + r() * 22;
        x.fillStyle = `rgb(${v},${v - 3},${v - 5})`;
        x.beginPath();
        x.roundRect(col * 32 + 2 + r() * 3, row * 18.3 + 2, 26 + r() * 4, 14, 4);
        x.fill();
      }
    for (let i = 0; i < 200; i++) {
      x.fillStyle = `rgba(120,110,100,${r() * 0.25})`;
      x.fillRect(r() * 256, r() * 256, 2 + r() * 6, 1 + r() * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })());

const charred = () => std("#ffffff", 0.95, 0, { map: char() });

/** A heap of ash and rubble: a flattened, lumpy mound. */
export function ashHeap(s: FilmStage, at: THREE.Vector3, size: [number, number, number], seed = 1, color = "#4a4644") {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const n = noise2(seed);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = 0.8 + n(v.x * 2.5 + 3, v.z * 2.5 + v.y) * 0.5;
    v.multiplyScalar(d);
    if (v.y < 0) v.y *= 0.1;
    p.setXYZ(i, v.x * size[0], v.y * size[1], v.z * size[2]);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, std(color, 1));
  m.position.copy(at);
  m.castShadow = m.receiveShadow = true;
  s.add(m);
  return m;
}

/** Glowing coals scattered in the ash, pulsing faintly. */
export function embersIn(s: FilmStage, center: THREE.Vector3, radius: number, n: number, seed = 3, glow = 1) {
  const r = rng(seed);
  const mat = new THREE.MeshStandardMaterial({ color: "#2a0a04", emissive: "#ff4a10", emissiveIntensity: 1.5 * glow, roughness: 0.8 });
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.03, 0), mat, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * radius;
    m.compose(V(center.x + Math.cos(a) * d, center.y + r() * 0.05, center.z + Math.sin(a) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), V(0.6 + r(), 0.5 + r() * 0.6, 0.6 + r()));
    im.setMatrixAt(i, m);
  }
  s.add(im);
  s.ticks.push(({ t }) => (mat.emissiveIntensity = 1.5 * glow * (0.75 + Math.sin(t * 2.3) * 0.15 + Math.sin(t * 5.1) * 0.1)));
  return im;
}

/**
 * A burnt minka: the stone footing, a broken charred floor, a few posts
 * standing at broken heights, fallen beams, and the roof collapsed into ash.
 * `hole` leaves an opening in the floor (the cellar hatch).
 */
export function ruinedHouse(s: FilmStage, x: number, z: number, yaw: number, o: { w?: number; d?: number; seed?: number; y?: number; hole?: { x: number; z: number; size: number }; smoke?: boolean; embers?: number } = {}) {
  const w = o.w ?? 6;
  const d = o.d ?? 4.6;
  const r = rng(o.seed ?? 5);
  const g = new THREE.Group();
  g.position.set(x, o.y ?? 0, z);
  g.rotation.y = yaw;
  s.add(g);
  const wood = charred();
  const stone = std("#2e2c2a", 0.95);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, p: THREE.Vector3, rot = V(0, 0, 0)) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.copy(p);
    mesh.rotation.setFromVector3(rot);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const floorY = o.hole ? 0 : 0.45;
  if (!o.hole) add(new THREE.BoxGeometry(w + 0.3, 0.42, d + 0.3), stone, V(0, 0.21, 0));
  // the floor: charred boards, some burnt through
  for (let i = -Math.floor(w / 0.74); i <= Math.floor(w / 0.74); i++) {
    const bx = i * 0.37;
    if (Math.abs(bx) > w / 2) continue;
    const inHole = o.hole && Math.abs(bx - o.hole.x) < o.hole.size / 2;
    let zz = -d / 2;
    while (zz < d / 2) {
      const len = 0.6 + r() * 1.8;
      const z1 = Math.min(d / 2, zz + len);
      const skip = r() < 0.18;
      const hz0 = o.hole ? o.hole.z - o.hole.size / 2 : 0;
      const hz1 = o.hole ? o.hole.z + o.hole.size / 2 : 0;
      if (!skip) {
        const segs: [number, number][] = inHole ? [[zz, Math.min(z1, hz0)], [Math.max(zz, hz1), z1]] : [[zz, z1]];
        for (const [a, b] of segs) if (b - a > 0.05) add(new THREE.BoxGeometry(0.36, 0.05, b - a - 0.01), wood, V(bx, floorY - 0.025 - r() * 0.02, (a + b) / 2), V((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.06));
      }
      zz = z1;
    }
  }
  // posts at broken heights
  for (const [px, pz] of [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
    [0, -d / 2],
    [-w / 4, d / 2],
    [w / 4, d / 2],
  ] as const) {
    if (r() < 0.2) continue;
    const h = 0.4 + r() * 2.1;
    add(new THREE.BoxGeometry(0.15, h, 0.15), wood, V(px, floorY + h / 2, pz), V((r() - 0.5) * 0.12, r(), (r() - 0.5) * 0.12));
    add(new THREE.ConeGeometry(0.1, 0.25, 5), wood, V(px, floorY + h + 0.1, pz), V(0, r(), (r() - 0.5) * 0.4));
  }
  // fallen beams, leaning and crossed
  for (let i = 0; i < 6; i++) {
    const len = 2 + r() * 3;
    const bx = (r() - 0.5) * w * 0.8;
    const bz = (r() - 0.5) * d * 0.8;
    if (o.hole && (Math.hypot(bx - o.hole.x, bz - o.hole.z) < 2.4 || bz > o.hole.z)) continue;
    add(new THREE.BoxGeometry(len, 0.16, 0.16), wood, V(bx, floorY + 0.1 + r() * 0.5, bz), V((r() - 0.5) * 0.3, r() * Math.PI, (r() - 0.5) * 0.5));
  }
  // the roof came down: a heap of ash and blackened thatch
  const heapAt = o.hole ? V(-w * 0.22, floorY, -d * 0.18) : V((r() - 0.5) * 0.8, floorY, (r() - 0.5) * 0.6);
  g.updateMatrixWorld(true);
  ashHeap(s, heapAt.clone().applyMatrix4(g.matrixWorld), [w * 0.32, 0.55, d * 0.32], (o.seed ?? 5) + 3);
  if ((o.embers ?? 1) > 0) embersIn(s, heapAt.clone().applyMatrix4(g.matrixWorld), w * 0.3, 40, (o.seed ?? 5) + 7, o.embers ?? 1);
  if (o.smoke !== false) wisp(s, heapAt.clone().applyMatrix4(g.matrixWorld).add(V(0, 0.6, 0)), 0x8a8a90, (o.seed ?? 5) + 11, 2);
  return g;
}
