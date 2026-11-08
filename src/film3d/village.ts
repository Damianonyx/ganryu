import * as THREE from "three";
import type { FilmStage } from "./lab";
import { V, bellTower, fence, gate, grass, ground, house, mist, palisade, ridges, sky, stoneLantern, trees, wisp, type House } from "./sets";

/**
 * The mountain village of the opening, shared by the shots set in it.
 * The street runs along z: the gate and palisade at z = +16 (south), the
 * family home at the north end, uphill. The sun sets in the west (−x).
 */

export const GATE_Z = 16;
export const HOME = { x: -2.5, z: -32 };

/** The ground rises gently to the north and steeply beyond the valley sides. */
export const height = (x: number, z: number) => Math.max(0, -z - 4) * 0.045 + Math.max(0, Math.abs(x) - 14) ** 1.3 * 0.12;

export const HOUSES: { x: number; z: number; yaw: number; w?: number; d?: number }[] = [
  { x: -8, z: 8, yaw: Math.PI / 2 },
  { x: 8, z: 5, yaw: -Math.PI / 2, w: 6.5 },
  { x: -8.4, z: -3, yaw: Math.PI / 2, w: 5.5 },
  { x: 8.2, z: -6, yaw: -Math.PI / 2 },
  { x: -8, z: -14, yaw: Math.PI / 2, w: 6.4 },
  { x: 8.4, z: -17, yaw: -Math.PI / 2, w: 5.6 },
  { x: -8.6, z: -24, yaw: Math.PI / 2 },
  { x: 8, z: -27, yaw: -Math.PI / 2 },
];

export type Light = "dusk" | "night" | "fire" | "dawn";

/** Sky, mountains, fog, and lights for a time of day. */
export function lightVillage(s: FilmStage, when: Light, o: { shadowCenter?: THREE.Vector3; shadowSize?: number; exposure?: number } = {}) {
  const P = {
    dusk: { fog: 0x7a6670, dens: 0.0085, top: "#1a2248", hor: "#d88a5c", glow: "#ffb070", cloud: "#8a5a6a", sun: 0xffa060, sunI: 1.7, hemi: [0x7a7aa8, 0x2a1e14, 0.75], exp: 1.05, ridge: ["#4a3e56", "#6a5468", "#8a6a74"], haze: "#b07a6a" },
    night: { fog: 0x141c30, dens: 0.02, top: "#05070f", hor: "#1a2236", glow: "#3a2a3a", cloud: "#1a1e2e", sun: 0xb8c4ff, sunI: 0.95, hemi: [0x4a5a8a, 0x0a0806, 0.5], exp: 1.25, ridge: ["#0e121e", "#141a2a", "#1a2236"], haze: "#1e2638" },
    fire: { fog: 0x2a1418, dens: 0.022, top: "#07060c", hor: "#3a1a18", glow: "#8a3418", cloud: "#2a1414", sun: 0x9aa8ff, sunI: 0.7, hemi: [0x4a3a5a, 0x0a0806, 0.45], exp: 1.15, ridge: ["#120a0e", "#1a0e12", "#2a1416"], haze: "#3a1a18" },
    dawn: { fog: 0x8a9098, dens: 0.018, top: "#5a6a80", hor: "#c8bcb0", glow: "#e8d0b0", cloud: "#9aa0a8", sun: 0xd8d4d0, sunI: 1.1, hemi: [0xa0a8b8, 0x3a3634, 0.9], exp: 1.0, ridge: ["#6a707c", "#80868e", "#9aa0a6"], haze: "#b0b0b0" },
  }[when];
  s.scene.fog = new THREE.FogExp2(P.fog, P.dens);
  s.scene.background = new THREE.Color(P.fog);
  const sunDir = when === "dawn" ? V(0.8, 0.25, -0.5) : V(-1, 0.12, -0.35);
  sky(s, P.top, P.hor, P.glow, sunDir, { clouds: P.cloud, cloudAmt: when === "night" ? 0.25 : 0.65, glowPow: when === "dusk" ? 4 : 6 });
  ridges(s, [
    { dist: 95, height: 26, color: P.ridge[0], haze: P.haze, seed: 3 },
    { dist: 120, height: 36, color: P.ridge[1], haze: P.haze, seed: 7 },
    { dist: 142, height: 48, color: P.ridge[2], haze: P.haze, seed: 11, rough: 1.2 },
  ], V(0, -2, -10), V(-0.4, 0, -1));
  ridges(s, [{ dist: 110, height: 30, color: P.ridge[1], haze: P.haze, seed: 21 }], V(0, -2, 0), V(-1, 0, 0.3));
  ridges(s, [{ dist: 115, height: 22, color: P.ridge[1], haze: P.haze, seed: 23 }], V(0, -2, 0), V(1, 0, -0.2));
  const hemi = new THREE.HemisphereLight(P.hemi[0] as number, P.hemi[1] as number, P.hemi[2] as number);
  s.add(hemi);
  const sun = new THREE.DirectionalLight(P.sun, P.sunI);
  const c = o.shadowCenter ?? V(0, 0, -6);
  sun.position.copy(c).addScaledVector(when === "night" || when === "fire" ? V(-0.4, 1, 0.6).normalize() : sunDir.clone().setY(0.5).normalize(), 60);
  sun.target.position.copy(c);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const half = (o.shadowSize ?? 60) / 2;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 150 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  s.add(sun, sun.target);
  s.renderer.toneMappingExposure = o.exposure ?? P.exp;
  return { sun, hemi };
}

export type Village = { houses: House[]; home: House; tower: ReturnType<typeof bellTower>; gate: ReturnType<typeof gate>; tick: (dt: number) => void };

/** Builds the village. `glow` scales the lamplight in the windows (0 for the ruined dawn). */
export function village(s: FilmStage, o: { glow?: number; smoke?: boolean; trees?: number; grassN?: number; skipHouses?: number[] } = {}): Village {
  const glow = o.glow ?? 1;
  ground(s, "#3a3226", 180, 4, {
    grass: "#3a4228",
    roadColor: "#5a4a38",
    height,
    res: 160,
    path: (x, z) => {
      const street = Math.abs(x) < 2.2 ? 1 : Math.max(0, 1 - (Math.abs(x) - 2.2) / 1.2);
      const yard = Math.hypot(x - HOME.x, z - HOME.z - 5) < 4.5 ? 0.8 : 0;
      return Math.min(1, street + yard) * (z < GATE_Z + 30 ? 1 : 0);
    },
  });
  const houses = HOUSES.map((h, i) => (o.skipHouses?.includes(i) ? null : house(s, h.x, h.z, h.yaw, { w: h.w, d: h.d, glow: glow * (0.7 + ((i * 37) % 10) / 20), y: height(h.x, h.z) - 0.05, seed: i + 3 }))).filter((h): h is House => !!h);
  const home = house(s, HOME.x, HOME.z, 0, { w: 7, d: 5, glow: glow * 1.2, y: height(HOME.x, HOME.z) - 0.05, seed: 99 });
  // fences between the yards
  for (const side of [-1, 1]) for (const z of [12.5, 1.5, -9, -20]) fence(s, [side * 4.2, z], [side * 11, z - 0.5]);
  for (const z of [6.5, -4.5, -15.5]) stoneLantern(s, 2.8 * (z > 0 ? 1 : -1), z, glow);
  palisade(s, GATE_Z, -26, 26, 2.3);
  const g = gate(s, GATE_Z);
  const tower = bellTower(s, 4.8, GATE_Z - 4.5, -0.2);
  // the forest beyond the palisade and up the valley sides; pines inside the village
  const n = o.trees ?? 160;
  const ticks = [
    trees(s, "cedar", n, (r) => {
      const x = (r() - 0.5) * 110;
      const z = -70 + r() * 120;
      if (Math.abs(x) < 16 && z < GATE_Z + 4) return null;
      if (Math.abs(x) < 4 && z > GATE_Z) return null; // the road out
      return [x, z];
    }, { seed: 12, y: height, scale: [0.8, 1.3], shadows: false }),
    trees(s, "pine", 14, (r) => {
      const x = (r() < 0.5 ? -1 : 1) * (11.5 + r() * 3);
      const z = -34 + r() * 46;
      return [x, z];
    }, { seed: 13, y: height, scale: [0.9, 1.2] }),
    trees(s, "maple", 6, (r) => [(r() < 0.5 ? -1 : 1) * (4.5 + r() * 1.5), -30 + r() * 40], { seed: 14, y: height, scale: [0.7, 0.9], leaf: "#5a6a2a" }),
  ];
  const grassTick = grass(s, o.grassN ?? 2500, (r) => {
    const x = (r() - 0.5) * 40;
    const z = -40 + r() * 60;
    return Math.abs(x) < 2.6 ? null : [x, z];
  }, "#56603a", 17, 0.35, height);
  if (o.smoke !== false)
    houses.forEach((h, i) => {
      if (i % 2 === 0) wisp(s, V(h.group.position.x, h.group.position.y + h.roofY + 2.6, h.group.position.z), 0xb0a098, 30 + i, 2.5);
    });
  const drift = mist(s, 16, [-30, 30, -60, -30], 0xb0909a, 0.12, 71, 1.5, 2);
  return {
    houses,
    home,
    tower,
    gate: g,
    tick: (dt) => {
      for (const t of ticks) t(dt);
      grassTick(dt);
      drift(dt);
    },
  };
}
