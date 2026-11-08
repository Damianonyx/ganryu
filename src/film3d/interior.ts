import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Fire, rng, type FilmStage } from "./lab";
import { V, std } from "./sets";

/**
 * The family's house from inside, and the stone cellar under its floor
 * (Acts 3–5). The floor is at y = 0. The door is in the front wall (z = 4),
 * the hatch over the cellar in the floor near the middle of the room.
 */

export const HATCH = { x: 0.925, z: 0.57, size: 0.74 };
export const CELLAR = { x0: HATCH.x - 1.0, x1: HATCH.x + 1.0, z0: HATCH.z - 1.2, z1: HATCH.z + 1.2, depth: 1.3 };
export const ROOM = { x0: -3.6, x1: 3.6, z0: -2.8, z1: 4.0, h: 2.7 };

function tex(w: number, h: number, draw: (x: CanvasRenderingContext2D, r: () => number) => void, seed = 1, rep: [number, number] = [1, 1]) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...rep);
  t.anisotropy = 4;
  return t;
}

const stoneTex = () =>
  tex(256, 256, (x, r) => {
    x.fillStyle = "#3a3632";
    x.fillRect(0, 0, 256, 256);
    // irregular stones with dark mortar
    for (let row = 0; row < 6; row++) {
      let px = -r() * 30;
      const y = row * 43;
      while (px < 256) {
        const w = 34 + r() * 40;
        const v = 70 + r() * 40;
        x.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
        x.beginPath();
        x.roundRect(px + 3, y + 3, w - 6, 37, 9);
        x.fill();
        x.fillStyle = "rgba(255,255,255,0.05)";
        x.fillRect(px + 6, y + 5, w - 14, 6);
        px += w;
      }
    }
  }, 3, [2, 1]);

const boardTex = () =>
  tex(64, 512, (x, r) => {
    x.fillStyle = "#4a3624";
    x.fillRect(0, 0, 64, 512);
    for (let i = 0; i < 120; i++) {
      x.strokeStyle = `rgba(${20 + r() * 30},${12 + r() * 16},${6},${0.25 + r() * 0.3})`;
      x.lineWidth = 0.5 + r() * 1.5;
      x.beginPath();
      const px = r() * 64;
      x.moveTo(px, 0);
      x.bezierCurveTo(px + (r() - 0.5) * 8, 170, px + (r() - 0.5) * 8, 340, px + (r() - 0.5) * 6, 512);
      x.stroke();
    }
    x.fillStyle = "rgba(255,220,180,0.06)";
    x.fillRect(4, 0, 20, 512);
  }, 5);

export type Interior = {
  /** the hatch lid's hinge (rotation.x: 0 closed, −π lying open on the floor) */
  lid: THREE.Group;
  /** the two leaves of the sliding door (front wall) */
  door: THREE.Group[];
  doorPlanks: THREE.Mesh[];
  /** the burning roof beams, for the ceiling fire */
  beams: THREE.Mesh[];
  shoji: THREE.MeshStandardMaterial;
  outside: Fire[];
  /** the glow falling into the cellar through the open hatch (dim it when the lid closes) */
  cellarLight: THREE.PointLight;
  tick: (t: number, dt: number) => void;
};

/**
 * Builds the room and the cellar. `burning` (0–1) sets how strongly the
 * village fire glows through the paper walls and the door.
 */
export function interior(s: FilmStage, o: { burning?: number; doorOpen?: boolean; doorBroken?: boolean; lamp?: boolean; hearth?: boolean; haze?: number } = {}): Interior {
  const burning = o.burning ?? 1;
  s.scene.fog = new THREE.FogExp2(0x140a06, 0.05);
  s.scene.background = new THREE.Color(0x0a0604);
  const r = rng(31);
  const boards = boardTex();
  const wood = std("#ffffff", 0.8, 0, { map: boards });
  const woodDark = std("#5a4a3a", 0.85, 0, { map: boards });
  const timber = std("#24180e", 0.85);
  const plaster = std("#8a7a64", 0.95);
  const stone = std("#ffffff", 0.95, 0, { map: stoneTex() });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, p: THREE.Vector3, rot = V(0, 0, 0), shadow = true) => {
    const x = new THREE.Mesh(geo, m);
    x.position.copy(p);
    x.rotation.setFromVector3(rot);
    x.castShadow = shadow;
    x.receiveShadow = true;
    s.add(x);
    return x;
  };

  // ── Floor, with the hatch opening ──────────────────────────────────────────
  const bw = 0.37;
  const hx0 = HATCH.x - HATCH.size / 2;
  const hx1 = HATCH.x + HATCH.size / 2;
  const hz0 = HATCH.z - HATCH.size / 2;
  const hz1 = HATCH.z + HATCH.size / 2;
  for (let i = -10; i <= 10; i++) {
    const x = i * bw;
    const m = i % 2 ? wood : woodDark;
    const z0 = ROOM.z0;
    const z1 = ROOM.z1;
    const inHole = x > hx0 && x < hx1;
    const segs: [number, number][] = inHole ? [[z0, hz0], [hz1, z1]] : [[z0, z1]];
    for (const [a, b] of segs) {
      const len = b - a - 0.004;
      const g = new THREE.BoxGeometry(bw - 0.006, 0.06, len);
      const mesh = add(g, m, V(x, -0.03, (a + b) / 2 + (r() - 0.5) * 0.004));
      mesh.material = m;
    }
  }
  // the hatch frame
  for (const [w, d, x, z] of [
    [HATCH.size + 0.1, 0.05, HATCH.x, hz0 - 0.025],
    [HATCH.size + 0.1, 0.05, HATCH.x, hz1 + 0.025],
    [0.05, HATCH.size, hx0 - 0.025, HATCH.z],
    [0.05, HATCH.size, hx1 + 0.025, HATCH.z],
  ] as const)
    add(new THREE.BoxGeometry(w, 0.062, d), timber, V(x, -0.028, z));
  // the lid: two planks on battens, hinged along its back edge
  const lid = new THREE.Group();
  lid.position.set(HATCH.x, 0, hz0);
  s.add(lid);
  for (const k of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(HATCH.size / 2 - 0.012, 0.045, HATCH.size - 0.01), wood);
    p.position.set((k * HATCH.size) / 4, -0.022, HATCH.size / 2);
    p.castShadow = p.receiveShadow = true;
    lid.add(p);
  }
  for (const z of [0.12, HATCH.size - 0.12]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(HATCH.size - 0.08, 0.035, 0.07), timber);
    b.position.set(0, -0.06, z);
    b.castShadow = true;
    lid.add(b);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 14), std("#2a2a2e", 0.5, 0.8));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.005, HATCH.size - 0.08);
  lid.add(ring);

  // ── The cellar ─────────────────────────────────────────────────────────────
  const C = CELLAR;
  const cw = C.x1 - C.x0;
  const cd = C.z1 - C.z0;
  const cx = (C.x0 + C.x1) / 2;
  const cz = (C.z0 + C.z1) / 2;
  add(new THREE.PlaneGeometry(cw, cd), std("#2a221a", 1), V(cx, -C.depth, cz), V(-Math.PI / 2, 0, 0));
  for (const [w, x, z, ry] of [
    [cw, cx, C.z0, 0],
    [cw, cx, C.z1, Math.PI],
    [cd, C.x0, cz, Math.PI / 2],
    [cd, C.x1, cz, -Math.PI / 2],
  ] as const) {
    const wall = add(new THREE.PlaneGeometry(w, C.depth + 0.06), stone, V(x, -C.depth / 2 - 0.03, z), V(0, ry, 0));
    wall.material = stone;
  }
  // the vent high in the cellar's side wall, with bars
  const vent = add(new THREE.PlaneGeometry(0.34, 0.16), std("#000000", 1, 0, { emissive: "#ff7a2a", emissiveIntensity: 0.0 }), V(C.x1 - 0.005, -0.22, cz + 0.4), V(0, -Math.PI / 2, 0), false);
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.015, 0.16, 0.015), timber, V(C.x1 - 0.01, -0.22, cz + 0.4 - 0.12 + i * 0.08));
  // straw on the cellar floor, jars against the wall
  for (let i = 0; i < 3; i++) {
    const jar = add(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.12, 0.02), new THREE.Vector2(0.16, 0.18), new THREE.Vector2(0.1, 0.34), new THREE.Vector2(0.07, 0.36)], 14), std("#4a3a2a", 0.6), V(C.x0 + 0.25 + i * 0.3, -C.depth, C.z0 + 0.22));
    jar.scale.setScalar(0.9 + i * 0.1);
  }

  // ── Walls: shoji on the sides, plaster and timber at the back, the door in front ──
  const glowTex = tex(128, 256, (x) => {
    x.fillStyle = "#ffd7a8";
    x.fillRect(0, 0, 128, 256);
    x.fillStyle = "#1e1208";
    for (let i = 0; i <= 4; i++) x.fillRect(i * 31, 0, 4, 256);
    for (let j = 0; j <= 8; j++) x.fillRect(0, j * 31.5, 128, 4);
  }, 9);
  const shoji = std("#ffffff", 0.8, 0, { map: glowTex, emissive: "#ff8a3a", emissiveMap: glowTex, emissiveIntensity: 0.35 * burning, side: THREE.DoubleSide });
  const posts = (x0: number, x1: number, z: number, along: "x" | "z") => {
    const n = Math.round((x1 - x0) / 0.9);
    for (let i = 0; i <= n; i++) {
      const u = x0 + ((x1 - x0) * i) / n;
      add(new THREE.BoxGeometry(0.14, ROOM.h, 0.14), timber, along === "x" ? V(u, ROOM.h / 2, z) : V(z, ROOM.h / 2, u));
    }
  };
  for (const x of [ROOM.x0, ROOM.x1]) {
    const pane = add(new THREE.PlaneGeometry(ROOM.z1 - ROOM.z0, ROOM.h - 0.5), shoji, V(x, (ROOM.h - 0.5) / 2 + 0.25, (ROOM.z0 + ROOM.z1) / 2), V(0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0), false);
    pane.material = shoji;
    (shoji.map as THREE.Texture).repeat.set(5, 1);
    add(new THREE.BoxGeometry(0.05, 0.25, ROOM.z1 - ROOM.z0), timber, V(x, 0.125, (ROOM.z0 + ROOM.z1) / 2));
    add(new THREE.BoxGeometry(0.05, 0.25, ROOM.z1 - ROOM.z0), timber, V(x, ROOM.h - 0.125, (ROOM.z0 + ROOM.z1) / 2));
    posts(ROOM.z0, ROOM.z1, x, "z");
  }
  add(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.h), plaster, V(0, ROOM.h / 2, ROOM.z0), V(0, 0, 0));
  posts(ROOM.x0, ROOM.x1, ROOM.z0 + 0.06, "x");
  // a scroll in the alcove, a chest, and the father's sword on its stand
  add(new THREE.PlaneGeometry(0.42, 1.1), std("#d8ccb0", 0.9), V(-1.6, 1.45, ROOM.z0 + 0.02));
  add(new RoundedBoxGeometry(1.0, 0.9, 0.45, 2, 0.03), std("#2a1a10", 0.5), V(1.9, 0.45, ROOM.z0 + 0.3));
  const rack = new THREE.Group();
  rack.position.set(-2.6, 0, ROOM.z0 + 0.35);
  s.add(rack);
  for (const x of [-0.25, 0.25]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.18), std("#140c08", 0.4));
    leg.position.set(x, 0.21, 0);
    rack.add(leg);
  }
  const sheath = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.85, 3, 8), std("#141010", 0.35));
  sheath.rotation.z = Math.PI / 2;
  sheath.position.set(0.05, 0.4, 0);
  rack.add(sheath);
  // front wall: plaster panels either side of the door
  for (const sx of [-1, 1]) add(new THREE.PlaneGeometry(2.95, ROOM.h), plaster, V(sx * (0.65 + 1.475), ROOM.h / 2, ROOM.z1), V(0, Math.PI, 0));
  posts(ROOM.x0, ROOM.x1, ROOM.z1 - 0.06, "x");
  add(new THREE.BoxGeometry(ROOM.x1 - ROOM.x0, 0.3, 0.2), timber, V(0, 2.05, ROOM.z1));
  add(new THREE.PlaneGeometry(1.3, ROOM.h - 2.2), plaster, V(0, 2.2 + (ROOM.h - 2.2) / 2, ROOM.z1 - 0.01), V(0, Math.PI, 0));
  // the sliding door: two plank leaves
  const door: THREE.Group[] = [];
  const doorPlanks: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(sx * 0.32, 0, ROOM.z1 - 0.03);
    s.add(leaf);
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.9, 0.04), i % 2 ? wood : woodDark);
      p.position.set((i - 1) * 0.21, 0.97, 0);
      p.castShadow = p.receiveShadow = true;
      leaf.add(p);
      doorPlanks.push(p);
    }
    for (const y of [0.4, 1.6]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.05), timber);
      b.position.set(0, y, -0.03);
      leaf.add(b);
    }
    door.push(leaf);
  }
  if (o.doorOpen) door.forEach((d, i) => (d.position.x += (i ? 1 : -1) * 0.62));
  if (o.doorBroken) {
    // the door lies smashed on the floor inside
    door.forEach((d, i) => {
      d.position.set((i ? 0.35 : -0.4) + (r() - 0.5) * 0.2, 0.04, ROOM.z1 - 1.0 - i * 0.4);
      d.rotation.set(-Math.PI / 2 + 0.05, (r() - 0.5) * 0.6, (r() - 0.5) * 0.3);
    });
  }

  // ── Ceiling: rafters and a ridge beam ──────────────────────────────────────
  const beams: THREE.Mesh[] = [];
  add(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0), std("#1a120c", 0.95, 0, { side: THREE.DoubleSide }), V(0, ROOM.h + 0.25, (ROOM.z0 + ROOM.z1) / 2), V(Math.PI / 2, 0, 0), false);
  for (let z = ROOM.z0 + 0.4; z < ROOM.z1; z += 0.8) beams.push(add(new THREE.BoxGeometry(ROOM.x1 - ROOM.x0, 0.14, 0.12), timber, V(0, ROOM.h + 0.1, z)));
  beams.push(add(new THREE.BoxGeometry(0.3, 0.3, ROOM.z1 - ROOM.z0 + 0.4), timber, V(0, ROOM.h - 0.05, (ROOM.z0 + ROOM.z1) / 2)));

  // ── The hearth (irori), and a paper lamp ───────────────────────────────────
  const outside: Fire[] = [];
  if (o.hearth !== false) {
    const hx = -1.4;
    const hz = 1.3;
    add(new THREE.BoxGeometry(0.9, 0.08, 0.9), timber, V(hx, -0.02, hz));
    add(new THREE.BoxGeometry(0.78, 0.02, 0.78), std("#4a4440", 1), V(hx, 0.01, hz));
    const embers = s.fire(V(hx, 0.04, hz), { size: 0.22, rate: 0.35, light: 4.5, smoke: 3, embers: 6, spread: 0.6, seed: 71 });
    void embers;
    // the pot hook and kettle
    add(new THREE.CylinderGeometry(0.015, 0.015, ROOM.h - 0.75, 6), std("#2a1e14", 0.8), V(hx, 0.75 + (ROOM.h - 0.75) / 2, hz));
    add(new THREE.SphereGeometry(0.16, 14, 10), std("#18181a", 0.5, 0.6), V(hx, 0.62, hz)).scale.set(1, 0.8, 1);
  }
  if (o.lamp !== false) {
    const andon = add(new THREE.BoxGeometry(0.28, 0.5, 0.28), std("#ffffff", 0.8, 0, { emissive: "#ffb060", emissiveIntensity: 1.2 }), V(-3.0, 0.55, -2.2));
    void andon;
    const l = new THREE.PointLight(0xffa860, 1.6, 6, 1.6);
    l.position.set(-3.0, 0.6, -2.2);
    s.add(l);
  }

  // ── Outside: the village burning beyond the door and the paper walls ───────
  s.add(new THREE.HemisphereLight(0x6a4a3a, 0x100806, 0.6));
  s.renderer.toneMappingExposure = 1.25;
  // firelight through the paper: warm lights just inside each side wall, flickering
  const wallLights: THREE.PointLight[] = [];
  for (const [x, z] of [
    [ROOM.x0 + 0.4, 2.2],
    [ROOM.x0 + 0.4, -1.2],
    [ROOM.x1 - 0.4, 2.0],
    [ROOM.x1 - 0.4, -1.0],
  ]) {
    const l = new THREE.PointLight(0xff8a40, 3.2 * burning + 0.6, 6.5, 1.4);
    l.position.set(x, 1.4, z);
    s.add(l);
    wallLights.push(l);
  }
  // light falling into the cellar when the hatch is open
  const cellarLight = new THREE.PointLight(0xffa060, 1.4, 3, 1.5);
  cellarLight.position.set(HATCH.x - 0.2, -0.4, HATCH.z + 0.1);
  s.add(cellarLight);
  if (burning > 0) {
    const doorLight = new THREE.SpotLight(0xff8a3a, 40 * burning, 14, 0.7, 0.6, 1.4);
    doorLight.position.set(0, 2.2, 7.5);
    doorLight.target.position.set(0.5, 0, 0.5);
    doorLight.castShadow = true;
    doorLight.shadow.mapSize.set(2048, 2048);
    s.add(doorLight, doorLight.target);
    for (const [x, z] of [
      [-5.5, 1],
      [5.5, -0.5],
    ]) {
      const side = new THREE.PointLight(0xff7a2a, 6 * burning, 8, 1.5);
      side.position.set(x, 1.5, z);
      s.add(side);
    }
    outside.push(s.fire(V(-1.8, -0.45, 7.5), { size: 1.6, rate: 1.4 * burning, light: 8 * burning, smoke: 12, embers: 40, spread: 2, seed: 41 }));
    outside.push(s.fire(V(2.2, -0.45, 8.5), { size: 1.4, rate: 1.2 * burning, light: 6 * burning, smoke: 10, embers: 30, spread: 1.8, seed: 42 }));
    // the street beyond the door
    add(new THREE.PlaneGeometry(30, 20), std("#1a120c", 1), V(0, -0.45, 12), V(-Math.PI / 2, 0, 0));
  }
  if ((o.haze ?? 0) > 0) {
    const haze = new Fire(V(0, ROOM.h - 0.3, 1.0), { size: 1.4, rate: 0.01, light: 0.01, smoke: Math.round(14 * (o.haze ?? 0)), embers: 20, seed: 43 });
    s.scene.add(haze.group);
    s.fires.push(haze);
  }
  const ventMat = vent.material as THREE.MeshStandardMaterial;
  return {
    lid,
    door,
    doorPlanks,
    beams,
    shoji,
    outside,
    cellarLight,
    tick: (t) => {
      // the fire outside breathes through the paper
      const f = 0.82 + Math.sin(t * 7.3) * 0.08 + Math.sin(t * 13.1 + 1) * 0.06;
      shoji.emissiveIntensity = 0.35 * burning * f;
      wallLights.forEach((l, i) => (l.intensity = (3.2 * burning + 0.6) * (0.85 + Math.sin(t * (6 + i) + i * 2) * 0.1 + Math.sin(t * 15.3 + i) * 0.05)));
      ventMat.emissiveIntensity = 0.6 * burning * (0.8 + Math.sin(t * 9) * 0.2);
    },
  };
}
