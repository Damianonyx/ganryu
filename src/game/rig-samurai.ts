import * as THREE from "three";
import type { Rig } from "./mesh";
import { motion } from "./motion";
import {
  G,
  Spring,
  bake,
  clamp01,
  contactShadow,
  disposeBaked,
  ease,
  joint,
  legIK,
  lerp,
  materials,
  part,
  span,
} from "./rig-kit";
import type { AnimName, CharacterDef } from "./types";

/**
 * The armored samurai body used by the human fighters (all four protagonists
 * and five antagonists). Built like the reference robot: many small rounded
 * parts in a few lacquer, steel, cloth, and cord materials, merged per joint.
 *
 * Space: the rig faces +Z with +Y up, so the character's right side is -X.
 * The whole body is turned to face the direction the game moves it.
 *
 * Motion is procedural (docs/MOTION.md): a distance-driven gait with two-bone
 * leg IK keeps planted feet still on the ground; actions have anticipation,
 * a fast strike, and follow-through; scarves, hair, and armor plates swing on
 * springs.
 */

type Style = "heavy" | "light" | "robe";

const STYLE: Partial<Record<string, Style>> = {
  kairo: "heavy",
  kurogane: "heavy",
  hakuren: "light",
  akari: "light",
  mumyo: "light",
  enjiro: "light",
  shion: "robe",
  mokuren: "robe",
  nethrak: "robe",
};

/** Lacing colors where the sheet's accent is too dark to read on black lacquer. */
const LACE: Partial<Record<string, string>> = {
  kairo: "#b8462a", // ember, for The Last Ember
  kurogane: "#7a6a4a",
};

const R = -1; // the character's right side is -X
const THIGH = 0.44;
const SHIN = 0.42;
const ANKLE_H = 0.065; // ankle height above the sole
const HIP_Y = 0.93; // hip joints above the ground at rest

export function buildSamurai(def: CharacterDef): Rig {
  const k = def.kit;
  const id = def.id as string;
  const style: Style = STYLE[id] ?? "light";
  const M = materials();

  const cloth = M.cloth(k.cloth);
  const under = M.cloth(new THREE.Color(k.cloth).lerp(new THREE.Color("#000000"), 0.35).getStyle());
  const trimCloth = M.cloth(k.trim);
  const armor = M.lacquer(style === "robe" ? k.trim : k.cloth);
  const armor2 = M.lacquer(new THREE.Color(style === "robe" ? k.trim : k.cloth).lerp(new THREE.Color(k.accent), 0.25).getStyle());
  const steel = M.metal(k.metal);
  const darkSteel = M.metal("#2a2a30", 0.34);
  const lace = M.cord(LACE[id] ?? k.accent, id === "kairo" ? 0.35 : 0.18);
  const skin = M.skin(k.skin);
  const obiMat = M.cloth(k.accent);

  const root = new THREE.Group();
  const turn = joint(root); // faces the rig's +Z toward the game's forward
  turn.rotation.y = Math.PI;
  const body = joint(turn);
  body.scale.setScalar(k.scale);
  const shadow = contactShadow(0.55 * k.scale);
  root.add(shadow);

  // ── Pelvis, skirt, and tassets ──────────────────────────────────────────
  const pelvis = joint(body, [0, HIP_Y + 0.02, 0]);
  part(pelvis, G.cyl(0.17, 0.19, 0.1), obiMat, [0, 0.02, 0]); // obi
  part(pelvis, G.rbox(0.1, 0.12, 0.05), obiMat, [0.06, 0.0, -0.18], [0, 0, 0.3]); // knot
  const skirt = joint(pelvis, [0, -0.02, 0]);
  const robe = style === "robe";
  // Hakama stop above the shin guards so the legs (and their stepping) read; robes fall long.
  const skirtH = robe ? 0.8 : 0.46;
  part(skirt, G.skirt(0.19, robe ? 0.4 : 0.29, skirtH, 9, robe ? 0.025 : 0.018), robe ? cloth : under, [0, -skirtH / 2, 0]);

  const tassets: { g: THREE.Group; a: number; s: Spring }[] = [];
  if (style !== "robe") {
    const angles = style === "heavy" ? [0.5, -0.5, 1.6, -1.6, Math.PI] : [0.55, -0.55, Math.PI];
    for (const a of angles) {
      const r = 0.2;
      const g = joint(pelvis, [Math.sin(a) * r, -0.03, Math.cos(a) * r]);
      g.rotation.y = a;
      // Overlapping lacquer lames, each a little wider than the one above.
      const rows = style === "heavy" ? 4 : 3;
      const pitch = 0.062;
      for (let i = 0; i < rows; i++) {
        const rr = r + 0.02 + i * 0.014;
        part(g, G.plate(rr, rr + 0.016, 0.078, style === "heavy" ? 0.95 : 0.85), i % 2 ? armor2 : armor, [0, -0.045 - i * pitch, -r]);
        part(g, G.plate(rr + 0.009, rr + 0.009, 0.008, 0.9), lace, [0, -0.083 - i * pitch, -r]); // laced edge
      }
      for (const x of [-0.045, 0.045]) part(g, G.rbox(0.01, rows * pitch, 0.01), lace, [x, -0.03 - rows * pitch * 0.5, 0.03 + rows * 0.007]);
      tassets.push({ g, a, s: new Spring(70, 8) });
    }
  }

  // ── Legs ────────────────────────────────────────────────────────────────
  const legs = ([-1, 1] as const).map((side) => {
    const hip = joint(pelvis, [0.11 * side, -0.02, 0]);
    hip.rotation.order = "ZXY"; // pitch and bend in the leg's plane, then roll that plane sideways
    part(hip, G.capsule(0.075, THIGH - 0.14), under, [0, -THIGH / 2, 0]);
    if (style === "heavy") part(hip, G.plate(0.095, 0.085, 0.24, 1.9), armor, [0, -0.2, 0]); // haidate
    const knee = joint(hip, [0, -THIGH, 0]);
    part(knee, G.sphere(0.06), darkSteel, [0, 0, 0.02]);
    part(knee, G.capsule(0.058, SHIN - 0.14), under, [0, -SHIN / 2, 0]);
    // suneate (shin guard) with a steel knee cop
    part(knee, G.plate(0.074, 0.066, SHIN * 0.78, 2.3), style === "robe" ? trimCloth : armor, [0, -SHIN * 0.48, 0]);
    part(knee, G.dome(0.055, 0.8), steel, [0, -0.02, 0.045], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) part(knee, G.rbox(0.13, 0.008, 0.01), lace, [0, -0.1 - i * 0.1, 0.07]);
    const ankle = joint(knee, [0, -SHIN, 0]);
    ankle.rotation.order = "ZXY";
    part(ankle, G.rbox(0.095, 0.06, 0.21, 0.35), M.cloth("#e8e4da"), [0, -0.03, 0.045]); // tabi
    part(ankle, G.rbox(0.11, 0.018, 0.24, 0.3), M.cloth("#3a2a1c"), [0, -0.062, 0.045]); // sandal
    return { hip, knee, ankle, side };
  });

  // ── Torso ───────────────────────────────────────────────────────────────
  const spine = joint(body, [0, HIP_Y + 0.08, 0]);
  part(spine, G.capsule(0.13, 0.1), under, [0, 0.09, 0]);
  const chest = joint(spine, [0, 0.3, 0]);
  if (style === "robe") {
    part(chest, G.capsule(0.17, 0.16), cloth, [0, -0.04, 0], [0, 0, 0], [1, 1, 0.78]);
    part(chest, G.rbox(0.05, 0.34, 0.02), trimCloth, [0.05, -0.02, 0.135], [0, 0, 0.42]); // crossed collar
    part(chest, G.rbox(0.05, 0.34, 0.02), trimCloth, [-0.05, -0.02, 0.14], [0, 0, -0.42]);
    part(chest, G.plate(0.2, 0.22, 0.12, 2.6), armor, [0, 0.12, 0], [0, Math.PI, 0]); // mantle on the back
  } else {
    // dō: a breastplate over laced lames
    const w = style === "heavy" ? 0.42 : 0.38;
    part(chest, G.rbox(w, 0.24, 0.28, 0.35), armor, [0, 0.02, 0]);
    part(chest, G.rbox(w * 0.7, 0.05, 0.02), steel, [0, 0.1, 0.145]);
    for (let i = 0; i < 3; i++) {
      const y = -0.12 - i * 0.055;
      part(chest, G.plate(0.19 - i * 0.008, 0.19 - i * 0.008, 0.05, 2.7), i % 2 ? armor2 : armor, [0, y, 0]);
      part(chest, G.plate(0.19 - i * 0.008, 0.19 - i * 0.008, 0.05, 2.7), i % 2 ? armor2 : armor, [0, y, 0], [0, Math.PI, 0]);
    }
    for (const x of [-0.08, 0, 0.08]) part(chest, G.rbox(0.012, 0.18, 0.012), lace, [x, -0.17, 0.19]);
  }
  part(chest, G.cyl(0.075, 0.09, 0.06), robe ? cloth : armor, [0, 0.17, 0]); // collar

  // Shoulder guards (sode) hang from the chest and follow the arm partway.
  const sodes: { g: THREE.Group; side: number; sx: Spring; sz: Spring }[] = [];
  if (style !== "robe") {
    for (const side of [-1, 1]) {
      if (style === "light" && side !== R) continue; // light armor guards the sword arm
      const g = joint(chest, [0.255 * side, 0.15, 0]);
      for (let i = 0; i < 4; i++) {
        part(g, G.rbox(0.2 - i * 0.006, 0.05, 0.22 - i * 0.01, 0.3), i % 2 ? armor2 : armor, [0.035 * side + i * 0.012 * side, -0.035 - i * 0.052, 0], [0, 0, -0.32 * side]);
      }
      part(g, G.rbox(0.012, 0.2, 0.012), lace, [0.09 * side, -0.1, 0.07], [0, 0, -0.32 * side]);
      part(g, G.rbox(0.012, 0.2, 0.012), lace, [0.09 * side, -0.1, -0.07], [0, 0, -0.32 * side]);
      if (id === "kairo") part(g, G.cone(0.025, 0.16, 8), steel, [0.12 * side, 0.02, 0], [0, 0, -0.9 * side]); // spikes
      sodes.push({ g, side, sx: new Spring(80, 9), sz: new Spring(80, 9) });
    }
  }

  // ── Arms ────────────────────────────────────────────────────────────────
  const arms = ([-1, 1] as const).map((side) => {
    const shoulder = joint(chest, [0.225 * side, 0.12, 0]);
    part(shoulder, G.sphere(0.07), robe ? cloth : armor, [0, 0, 0]);
    if (robe) part(shoulder, G.cyl(0.08, 0.15, 0.3, 16), cloth, [0, -0.17, 0]); // wide sleeve
    else part(shoulder, G.capsule(0.06, 0.16), under, [0, -0.14, 0]);
    const elbow = joint(shoulder, [0, -0.29, 0]);
    part(elbow, G.sphere(0.05), darkSteel, [0, 0, 0]);
    // kote: an armored sleeve with steel bands
    part(elbow, G.capsule(0.05, 0.16), robe ? trimCloth : armor, [0, -0.12, 0]);
    for (let i = 0; i < 3; i++) part(elbow, G.cyl(0.057, 0.057, 0.014), steel, [0, -0.06 - i * 0.06, 0]);
    const wrist = joint(elbow, [0, -0.26, 0]);
    part(wrist, G.rbox(0.07, 0.085, 0.085, 0.4), robe ? skin : darkSteel, [0, -0.04, 0.005]);
    const hand = joint(wrist, [0, -0.05, 0.01]);
    return { shoulder, elbow, wrist, hand, side };
  });
  const right = arms.find((a) => a.side === R)!;
  const left = arms.find((a) => a.side !== R)!;

  // ── Head ────────────────────────────────────────────────────────────────
  const neck = joint(chest, [0, 0.2, 0]);
  part(neck, G.cyl(0.05, 0.055, 0.08), skin, [0, 0.02, 0]);
  const head = joint(neck, [0, 0.07, 0]);
  part(head, G.sphere(0.112), skin, [0, 0.11, 0.005], [0, 0, 0], [1, 1.12, 1.06]);
  const eyeGlow = id === "nethrak" ? "#ff2a2a" : id === "mumyo" ? "#46e0ea" : id === "kairo" ? "#ff7a3a" : null;
  const eyeMat = eyeGlow ? M.cord(eyeGlow, 1.6) : M.metal("#0c0c0e", 0.4);
  for (const x of [-0.04, 0.04]) part(head, G.rbox(0.032, 0.014, 0.012, 0.4), eyeMat, [x, 0.13, 0.108]);

  const hairChain: { g: THREE.Group; s: Spring }[] = [];
  const chainOf = (parent: THREE.Object3D, at: [number, number, number], n: number, seg: number, w: number, m: THREE.Material, base: number) => {
    let p: THREE.Object3D = parent;
    for (let i = 0; i < n; i++) {
      const g = joint(p, i === 0 ? at : [0, -seg, 0]);
      g.rotation.x = i === 0 ? base : 0;
      part(g, G.rbox(w * (1 - i * 0.18), seg, 0.04, 0.4), m, [0, -seg / 2, 0]);
      hairChain.push({ g, s: new Spring(55 - i * 12, 7 - i) });
      p = g;
    }
  };

  // helmet, hat, or mask
  if (k.hat === "kabuto") {
    part(head, G.dome(0.155, 0.86), armor, [0, 0.13, 0]);
    part(head, G.torusArc(0.153, 0.012, Math.PI * 2), steel, [0, 0.13, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      part(head, G.rbox(0.012, 0.1, 0.01), steel, [Math.sin(a) * 0.12, 0.2, Math.cos(a) * 0.12], [0, a, 0], 1).rotation.x = Math.cos(a) * 0.6;
    }
    for (let i = 0; i < 3; i++) {
      const r = 0.165 + i * 0.022;
      part(head, G.plate(r, r + 0.02, 0.045, 4.2), i % 2 ? armor2 : armor, [0, 0.11 - i * 0.04, 0], [0, Math.PI, 0]); // shikoro
    }
    for (const s of [-1, 1]) part(head, G.rbox(0.06, 0.07, 0.015, 0.3), armor, [0.15 * s, 0.13, 0.06], [0, 0.8 * s, 0]); // fukigaeshi
    // maedate: two swept horns rising from a crest plate on the brow
    const hornMat = M.metal(k.metal, 0.18);
    part(head, G.rbox(0.07, 0.05, 0.02, 0.4), hornMat, [0, 0.2, 0.15]);
    for (const s of [-1, 1]) {
      part(head, G.cone(0.022, id === "kairo" ? 0.34 : 0.3, 10), hornMat, [0.055 * s, 0.33, 0.13], [-0.25, 0, -0.42 * s]);
    }
    part(head, G.rbox(0.025, 0.025, 0.012, 0.4), lace, [0, 0.2, 0.162]);
    // mempo (face guard)
    part(head, G.rbox(0.15, 0.08, 0.07, 0.4), darkSteel, [0, 0.055, 0.08]);
    part(head, G.rbox(0.1, 0.012, 0.012), lace, [0, 0.05, 0.12]);
  } else if (k.hat === "mask") {
    part(head, G.rbox(0.18, 0.2, 0.07, 0.4), M.lacquer(k.accent), [0, 0.11, 0.085]);
    for (const x of [-0.045, 0.045]) part(head, G.rbox(0.045, 0.012, 0.01), eyeGlow ? eyeMat : M.cord("#e8e4da", 0.5), [x, 0.135, 0.122]);
  } else if (k.hat === "kasa" || k.hat === "straw") {
    const hatMat = id === "nethrak" ? M.metal("#c8ccd4", 0.32) : k.hat === "straw" ? M.cloth("#b89a5c") : M.cloth(k.trim);
    part(head, G.cone(0.38, 0.17, 24), hatMat, [0, 0.27, 0]);
    part(head, G.torusArc(0.375, 0.01, Math.PI * 2), id === "nethrak" ? M.metal("#8a1418", 0.3) : trimCloth, [0, 0.19, 0], [Math.PI / 2, 0, 0]);
    part(head, G.cyl(0.11, 0.12, 0.06), hatMat, [0, 0.2, 0]);
    if (id === "shion") {
      // A sheer veil hanging from the brim, open at the face.
      const veil = M.cloth("#2a2a38");
      veil.transparent = true;
      veil.opacity = 0.42;
      veil.side = THREE.DoubleSide;
      veil.depthWrite = false;
      part(head, G.plate(0.355, 0.375, 0.26, 4.5), veil, [0, 0.06, 0], [0, Math.PI, 0]).userData.keep = true;
    }
  } else if (k.hat === "crown") {
    const wood = M.cloth("#5a4632");
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      part(head, G.cone(0.022, 0.22 + (i % 3) * 0.06, 6), wood, [Math.sin(a) * 0.1, 0.27, Math.cos(a) * 0.1], [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]);
    }
  }
  if (id === "enjiro") part(head, G.cone(0.025, 0.16, 8), M.cord(k.accent, 0.9), [0.05, 0.24, 0.08], [0.4, 0, -0.2]); // oni horn

  if (k.hair === "long") {
    part(head, G.dome(0.125, 0.8), trimCloth, [0, 0.14, -0.01]);
    chainOf(head, [0, 0.12, -0.1], 3, 0.16, 0.2, trimCloth, 0.15);
  } else if (k.hair === "white-pony") {
    part(head, G.dome(0.12, 0.85), skin, [0, 0.15, -0.005]);
    part(head, G.rbox(0.04, 0.05, 0.04), M.cord(k.accent, 0.3), [0, 0.22, -0.11]);
    chainOf(head, [0, 0.22, -0.13], 3, 0.15, 0.07, skin, 0.5);
  } else if (k.hair === "spiky" && k.hat === "none") {
    for (let i = 0; i < 6; i++) part(head, G.cone(0.035, 0.18, 6), trimCloth, [(i - 2.5) * 0.04, 0.24, -0.02], [-0.3, 0, (i - 2.5) * 0.25]);
  }

  // ── Signature details ───────────────────────────────────────────────────
  if (id === "kairo") chainOf(chest, [0.04, 0.16, -0.15], 4, 0.17, 0.15, M.cloth("#26263a"), 0.25); // shadow scarf
  if (id === "akari" || id === "mokuren") {
    const beads = M.lacquer(id === "akari" ? "#3a1c18" : "#5a3a24");
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      part(chest, G.sphere(id === "mokuren" ? 0.026 : 0.017, 8, 6), beads, [Math.sin(a) * 0.15, 0.14 - Math.cos(a) * 0.12, Math.cos(a) * 0.12 + 0.02]);
    }
  }
  if (id === "akari") for (const x of [-0.14, 0.12]) part(pelvis, G.rbox(0.04, 0.16, 0.004), M.cloth("#efe8d8"), [x, -0.1, 0.19], [0.1, 0, 0]); // talismans
  if (id === "mumyo") for (const a of arms) for (let i = 0; i < 3; i++) part(a.elbow, G.cyl(0.06, 0.06, 0.03), M.cloth("#d8d4cc"), [0, -0.04 - i * 0.08, 0], [0.2, 0, 0]); // bandages
  if (id === "enjiro") {
    const fire = M.cord(k.accent, 1.1);
    part(right.elbow, G.capsule(0.056, 0.15), fire, [0, -0.12, 0]);
    part(right.wrist, G.rbox(0.075, 0.09, 0.09, 0.4), fire, [0, -0.04, 0.005]);
  }

  // ── Weapons ─────────────────────────────────────────────────────────────
  const weapon = joint(right.hand);
  if (k.weapons === "staff") {
    part(weapon, G.cyl(0.02, 0.02, 1.7, 10), M.lacquer("#2a1e16"), [0, 0, 0.1], [Math.PI / 2, 0, 0]);
    for (const z of [-0.74, 0.94]) part(weapon, G.cyl(0.03, 0.03, 0.07, 12), steel, [0, 0, z], [Math.PI / 2, 0, 0]);
    part(weapon, G.torusArc(0.06, 0.008, Math.PI * 2), steel, [0, 0, 0.98]);
  } else {
    const big = id === "nethrak" ? 1.35 : 1;
    const bladeMat = id === "nethrak" ? M.metal("#c41c26", 0.2) : M.metal("#d8dce4", 0.12);
    const sword = joint(weapon, [0, 0, 0]);
    sword.rotation.x = Math.PI / 2; // the sword is drawn along +Y; point it along the hand's +Z
    part(sword, G.capsule(0.02, 0.2), M.cloth("#1a1418"), [0, -0.02, 0]); // tsuka
    for (let i = 0; i < 5; i++) part(sword, G.rbox(0.045, 0.012, 0.045, 0.4), lace, [0, -0.1 + i * 0.045, 0], [0, 0.78, 0]); // wrap
    part(sword, G.cyl(0.065, 0.065, 0.012, 20), darkSteel, [0, 0.11, 0]); // tsuba
    part(sword, G.torusArc(0.065, 0.006, Math.PI * 2), steel, [0, 0.11, 0], [Math.PI / 2, 0, 0]);
    part(sword, G.cyl(0.022, 0.022, 0.03, 10), steel, [0, 0.13, 0]); // habaki
    part(sword, G.blade(0.78 * big, 0.034 * big, 0.05 * big), bladeMat, [0, 0.14, 0]);
    // scabbard on the left hip
    part(pelvis, G.capsule(0.022, 0.72), M.lacquer("#141416"), [-R * 0.2, -0.05, -0.08], [1.85, 0, -R * 0.2]);
  }

  bake(body, M);

  // ── Motion ──────────────────────────────────────────────────────────────
  const st = {
    dt: 1 / 60,
    x: 0,
    z: 0,
    yaw: 0,
    spd: 0, // ground speed, m/s
    fwd: 0, // forward speed, m/s
    acc: 0, // forward acceleration
    airborne: 0,
    phase: 0,
    run: 0, // 0 standing → 1 full speed
    prev: "idle" as AnimName,
    land: 0,
    time: 0,
  };
  const skirtSpring = new Spring(50, 7);
  // Each foot is pinned to a point on the ground while it is down.
  const plant = [0, 1].map(() => ({ down: false, wx: 0, wz: 0, fromX: 0, fromZ: 0 }));
  const lastFeet = [
    { x: 0.13 * R, z: 0.15 },
    { x: -0.13 * R, z: -0.13 },
  ];
  // Rig space ↔ world. The rig is turned by yaw + π, so cos and sin flip sign.
  const toRig = (wx: number, wz: number) => {
    const dx = wx - st.x;
    const dz = wz - st.z;
    const c = Math.cos(st.yaw);
    const s = Math.sin(st.yaw);
    return { x: -dx * c + dz * s, z: -dx * s - dz * c };
  };
  const toWorld = (lx: number, lz: number) => {
    const c = Math.cos(st.yaw);
    const s = Math.sin(st.yaw);
    return { x: st.x - lx * c - lz * s, z: st.z + lx * s - lz * c };
  };

  const drive = (dt: number, vx: number, vz: number, yaw: number, y: number, x = 0, z = 0) => {
    st.x = x;
    st.z = z;
    st.yaw = yaw;
    st.spd = Math.hypot(vx, vz);
    const fwd = vx * -Math.sin(yaw) + vz * -Math.cos(yaw);
    st.acc = lerp(st.acc, (fwd - st.fwd) / Math.max(dt, 1e-4), 0.3);
    st.fwd = fwd;
    st.dt = dt;
    st.airborne = y;
    st.time += dt;
    shadow.position.y = -y + 0.012;
    const s = 1 / (1 + y * 0.7);
    shadow.scale.setScalar(s);
    (shadow.material as THREE.MeshBasicMaterial).opacity = 0.6 * s * s;
  };

  // A pose is built fresh every frame from these parts.
  const setAnim: Rig["setAnim"] = (name, t) => {
    const dt = st.dt;
    const g = motion.gait;
    const speed = st.spd;
    const target = name === "walk" || name === "idle" ? clamp01(speed / 3.2) : name === "leap" ? st.run : 0;
    st.run = lerp(st.run, target, 1 - Math.exp(-10 * dt));
    const run = st.run;
    if (st.prev === "leap" && name !== "leap") st.land = g.landTime;
    st.prev = name;
    st.land = Math.max(0, st.land - dt);

    const stride = lerp(g.strideWalk, g.strideRun, run);
    const duty = lerp(g.dutyWalk, g.dutyRun, run);
    if (name === "walk" || name === "idle") st.phase = (st.phase + (speed * dt) / stride) % 1;

    // ---- defaults: kamae (fighting stance) blended toward the run ----
    const breath = Math.sin(st.time * 2.2) * 0.008;
    let hipDrop = lerp(0.05, 0.06, run) + breath;
    let hipZ = 0;
    let lean = lerp(0.04, 0.22, run);
    let twist = lerp(0.18, 0, run); // hanmi: the sword side turned forward
    let tilt = 0;
    let headPitch = -lean * 0.6;
    // feet: [right, left] targets relative to the hips' rest position
    const feet = [
      { x: 0.13 * R, z: 0.15, y: 0 },
      { x: -0.13 * R, z: -0.13, y: 0 },
    ];
    // arms: kamae holds the sword forward at chest height in both hands
    // z > 0 spreads an arm outward, z < 0 brings it across the body; wx tilts the
    // hand (and the blade) relative to the forearm.
    const ra = { x: -0.95, y: 0.15, z: -0.25, elbow: -0.9, wx: 1.4 };
    const la = { x: -1.0, y: -0.2, z: -0.42, elbow: -1.1, wx: 0.2 };

    // ---- gait: each foot pinned to the ground while down, arcing to its next spot in swing ----
    const gaitOn = run > 0.01 && name !== "leap" && st.airborne <= 0.001;
    if (gaitOn) {
      const L = duty * stride;
      feet.forEach((f, i) => {
        const s = (st.phase + (i === 0 ? 0 : 0.5)) % 1;
        const side = (i === 0 ? 0.1 : -0.1) * R;
        const pl = plant[i];
        let x: number;
        let z: number;
        let y = 0;
        if (s < duty) {
          if (!pl.down) {
            // touchdown: pin where the foot is now
            const w = toWorld(lastFeet[i].x, lastFeet[i].z);
            pl.down = true;
            pl.wx = w.x;
            pl.wz = w.z;
          }
          let p = toRig(pl.wx, pl.wz);
          // A sharp turn or stop can leave a pinned foot out of reach: walk the pin back in.
          if (Math.abs(p.z) > L * 0.85 + 0.12 || Math.abs(p.x - side) > 0.3) {
            const home = toWorld(side, (0.5 - s / duty) * L);
            pl.wx = lerp(pl.wx, home.x, 0.35);
            pl.wz = lerp(pl.wz, home.z, 0.35);
            p = toRig(pl.wx, pl.wz);
          }
          x = p.x;
          z = p.z;
        } else {
          if (pl.down) {
            pl.down = false;
            pl.fromX = pl.wx;
            pl.fromZ = pl.wz;
          }
          const u = (s - duty) / (1 - duty);
          const from = toRig(pl.fromX, pl.fromZ);
          const e = ease.smooth(u);
          x = lerp(from.x, side, e);
          z = lerp(from.z, L / 2, e);
          y = Math.sin(u * Math.PI) * g.lift * run;
        }
        f.x = lerp(f.x, x, run);
        f.z = lerp(f.z, z, run);
        f.y = lerp(f.y, y, run);
      });
      const bob = Math.cos((st.phase - duty / 2) * Math.PI * 4);
      hipDrop += -bob * 0.03 * run;
      twist += Math.sin(st.phase * Math.PI * 2) * 0.14 * run;
      // run with the blade held low and back; the free arm swings
      const swing = Math.sin(st.phase * Math.PI * 2) * run;
      ra.x = lerp(ra.x, -0.2 + swing * 0.25, run);
      ra.z = lerp(ra.z, 0.2, run);
      ra.elbow = lerp(ra.elbow, -0.5, run);
      ra.wx = lerp(ra.wx, 1.2, run);
      la.x = lerp(la.x, swing * 0.9, run);
      la.z = lerp(la.z, -0.12, run);
      la.elbow = lerp(la.elbow, -0.9, run);
    }

    if (!gaitOn) for (const pl of plant) pl.down = false;

    // ---- actions ----
    if (name === "slash") {
      const a = ease.out(span(t, 0, 0.08)); // anticipation: blade over the right shoulder
      const c = ease.inOut(span(t, 0.08, 0.2)); // the cut
      const f = ease.back(span(t, 0.2, 0.34), 1.1); // follow-through
      ra.x = lerp(lerp(lerp(ra.x, -2.75, a), -0.45, c), -0.6, f);
      ra.y = lerp(lerp(ra.y, 0.3, a), -0.25, c);
      ra.z = lerp(lerp(ra.z, 0.55, a), -0.2, c);
      ra.elbow = lerp(lerp(ra.elbow, -1.35, a), -0.25, c);
      ra.wx = lerp(lerp(ra.wx, 1.5, a), 1.2, c);
      la.x = lerp(lerp(la.x, -2.3, a), -0.5, c);
      la.z = lerp(lerp(la.z, -0.35, a), -0.25, c);
      la.elbow = lerp(lerp(la.elbow, -1.6, a), -0.4, c);
      twist = lerp(lerp(twist, -0.5, a), 0.55, c);
      tilt = lerp(lerp(0, 0.08, a), -0.1, c);
      lean = lerp(lerp(lean, -0.05, a), 0.24, c);
      hipDrop += lerp(0, 0.07, c) - 0.02 * f;
      hipZ = lerp(-0.03 * a, 0.11, c);
      feet[0].z = lerp(feet[0].z, 0.3, c); // step in with the front foot
    }
    if (name === "parry") {
      const u = ease.out(span(t, 0, 0.06));
      ra.x = lerp(ra.x, -1.7, u);
      ra.y = lerp(ra.y, -0.5, u);
      ra.z = lerp(ra.z, -0.1, u);
      ra.elbow = lerp(ra.elbow, -0.6, u);
      ra.wx = lerp(ra.wx, 1.25, u);
      la.x = lerp(la.x, -2.0, u);
      la.z = lerp(la.z, -0.5, u);
      la.elbow = lerp(la.elbow, -1.2, u);
      lean = lerp(lean, -0.08, u);
      hipDrop += 0.05 * u;
      twist = lerp(twist, 0.1, u);
      feet[1].z = lerp(feet[1].z, -0.22, u);
    }
    if (name === "hurt") {
      const u = Math.sin(Math.min(1, t / 0.28) * Math.PI);
      lean = lerp(lean, -0.35, u);
      headPitch = lerp(headPitch, -0.35, u);
      tilt = 0.12 * u;
      hipZ = -0.08 * u;
      ra.x = lerp(ra.x, -0.4, u);
      ra.z = lerp(ra.z, 0.6, u);
      la.x = lerp(la.x, -0.6, u);
      la.z = lerp(la.z, 0.6, u);
      feet[1].z = lerp(feet[1].z, -0.26, u);
    }
    if (name === "special" || name === "fold") {
      const gather = ease.out(span(t, 0, 0.14));
      const burst = ease.out(span(t, 0.14, 0.3));
      if (name === "special") {
        hipDrop += 0.12 * gather - 0.08 * burst;
        lean = lerp(lerp(lean, 0.35, gather), 0.15, burst);
        ra.x = lerp(lerp(ra.x, -0.3, gather), -1.6, burst);
        ra.z = lerp(ra.z, 0.1, gather);
        ra.elbow = lerp(lerp(ra.elbow, -1.5, gather), -0.1, burst);
        ra.wx = lerp(ra.wx, 1.6, burst);
        la.x = lerp(lerp(la.x, -0.4, gather), 0.4, burst);
        la.z = lerp(la.z, 0.5, burst);
        twist = lerp(lerp(twist, -0.4, gather), 0.3, burst);
        hipZ = 0.12 * burst;
        feet[0].z = lerp(feet[0].z, 0.34, burst);
      } else {
        // Fold: hands meet in front of the chest
        ra.x = lerp(ra.x, -1.2, gather);
        ra.z = lerp(ra.z, -0.35, gather);
        ra.elbow = lerp(ra.elbow, -1.7, gather);
        la.x = lerp(la.x, -1.2, gather);
        la.z = lerp(la.z, -0.35, gather);
        la.elbow = lerp(la.elbow, -1.7, gather);
        headPitch = 0.15 * gather;
        twist = lerp(twist, 0, gather);
      }
    }
    if (name === "leap") {
      const u = ease.out(span(t, 0, 0.12));
      feet[0].y = lerp(feet[0].y, 0.42, u);
      feet[0].z = lerp(feet[0].z, 0.18, u);
      feet[1].y = lerp(feet[1].y, 0.3, u);
      feet[1].z = lerp(feet[1].z, -0.2, u);
      ra.x = lerp(ra.x, -2.4, u);
      ra.elbow = lerp(ra.elbow, -0.9, u);
      la.x = lerp(la.x, -1.2, u);
      lean = lerp(lean, 0.25, u);
      hipDrop = lerp(hipDrop, 0.02, u);
    }
    // Landing: the hips absorb the drop and the knees bend over planted feet.
    if (st.land > 0) {
      const u = st.land / g.landTime;
      hipDrop += Math.sin(u * Math.PI) * g.landDip;
      lean += Math.sin(u * Math.PI) * 0.12;
    }

    // ---- apply ----
    body.position.set(0, -hipDrop, hipZ);
    body.rotation.set(0, 0, 0);
    pelvis.rotation.set(0, twist * 0.3, tilt * 0.5);
    spine.rotation.set(lean * 0.6, twist * 0.45, tilt);
    chest.rotation.set(lean * 0.4, twist * 0.25, tilt * 0.4);
    neck.rotation.set(headPitch * 0.5, -twist * 0.7, -tilt * 0.6); // the head stays on the opponent
    head.rotation.set(headPitch * 0.5, -twist * 0.3, 0);

    legs.forEach((leg, i) => {
      const f = feet[i];
      lastFeet[i].x = f.x;
      lastFeet[i].z = f.z;
      // Feet targets are in the body's frame; the pelvis twist is small, so solve in the sagittal plane.
      // In the body's scaled frame: the ankle target relative to the hip joint.
      const dy = (f.y + hipDrop) / k.scale + ANKLE_H - HIP_Y;
      const dz = (f.z - hipZ) / k.scale;
      const dx = f.x / k.scale - 0.11 * leg.side;
      // Roll the leg's plane sideways to reach the target, then solve the knee in that plane.
      const roll = Math.atan2(dx, -dy);
      const { thigh, shin } = legIK(-Math.hypot(dy, dx), dz, THIGH, SHIN);
      leg.hip.rotation.set(thigh, -twist * 0.3, roll);
      leg.knee.rotation.set(shin, 0, 0);
      // Keep the sole level on the ground; roll the toe during swing.
      const swingRoll = f.y > 0.01 ? -0.4 * Math.sin(clamp01(f.y / Math.max(0.01, g.lift)) * Math.PI) : 0;
      leg.ankle.rotation.set(-(thigh + shin) + swingRoll, 0, -roll);
    });

    const arm = (a: (typeof arms)[number], p: typeof ra) => {
      a.shoulder.rotation.set(p.x, p.y * a.side * R, p.z * a.side);
      a.elbow.rotation.set(p.elbow, 0, 0);
      a.wrist.rotation.set(p.wx, 0, 0);
    };
    arm(right, ra);
    arm(left, la);

    // ---- secondary motion (springs) ----
    const drag = clamp01(speed / 4.2);
    const jolt = clamp01(Math.abs(st.acc) / 30) * Math.sign(st.acc);
    hairChain.forEach((h, i) => {
      const want = (i === 0 ? 0.35 : 0.12) * drag + jolt * 0.25 + Math.sin(st.time * 3 + i) * 0.03 + lean * 0.4;
      h.g.rotation.x = (i === 0 ? h.g.userData.base ?? (h.g.userData.base = h.g.rotation.x) : 0) + h.s.step(want, dt);
    });
    tassets.forEach((p) => {
      const leg = Math.cos(p.a) > 0.3 ? (Math.sin(p.a) * R > 0 ? legs[0] : legs[1]) : null;
      const follow = leg ? Math.min(0, leg.hip.rotation.x) * -0.55 : 0;
      p.g.rotation.x = -p.s.step(follow + drag * 0.12 + Math.abs(jolt) * 0.1, dt);
    });
    sodes.forEach((s) => {
      const a = s.side === R ? right : left;
      s.g.rotation.x = s.sx.step(a.shoulder.rotation.x * 0.3, dt);
      s.g.rotation.z = s.sz.step(a.shoulder.rotation.z * 0.45, dt);
    });
    const avg = (legs[0].hip.rotation.x + legs[1].hip.rotation.x) / 2;
    skirt.rotation.x = skirtSpring.step(avg * 0.35, dt);

    if (name === "die") {
      const u = ease.out(clamp01(t / 0.7));
      body.position.y = -hipDrop - 0.35 * ease.inOut(clamp01(t / 0.35));
      body.rotation.x = u * 1.4;
      shadow.scale.setScalar(1.2);
    }
  };

  const rig = finishSamurai(root, body, head, chest, left.shoulder, right.shoulder, legs[1].hip, legs[0].hip, weapon, M.all, setAnim);
  rig.drive = drive;
  const baseDispose = rig.dispose;
  rig.dispose = () => {
    baseDispose();
    disposeBaked(body);
    shadow.geometry.dispose();
    (shadow.material as THREE.Material).dispose();
  };
  return rig;
}

function finishSamurai(
  root: THREE.Group,
  body: THREE.Group,
  head: THREE.Object3D,
  torso: THREE.Object3D,
  lArm: THREE.Group,
  rArm: THREE.Group,
  lLeg: THREE.Group,
  rLeg: THREE.Group,
  weapon: THREE.Group,
  materials: THREE.MeshStandardMaterial[],
  setAnim: Rig["setAnim"],
): Rig {
  // Flash and Fold tint every material through its emissive channel.
  const orig = materials.map((m) => m.emissive.clone());
  const origInt = materials.map((m) => m.emissiveIntensity);
  let foldOn = false;
  let flashT = 0;
  const restore = () => {
    for (let i = 0; i < materials.length; i++) {
      materials[i].emissive.copy(orig[i]);
      materials[i].emissiveIntensity = origInt[i];
    }
  };
  return {
    root,
    body,
    head,
    torso,
    lArm,
    rArm,
    lLeg,
    rLeg,
    weapon,
    weapon2: null,
    sash: null,
    materials,
    setAnim: (name, t, speed, facing) => {
      setAnim(name, t, speed, facing);
      if (flashT > 0) {
        flashT -= 1 / 60;
        if (flashT <= 0 && !foldOn) restore();
      }
    },
    setFolding: (on) => {
      if (on === foldOn) return;
      foldOn = on;
      if (on)
        for (const m of materials) {
          m.emissive.setRGB(0.35, 0.32, 0.28);
          m.emissiveIntensity = 0.55;
        }
      else restore();
    },
    flash: (c) => {
      for (const m of materials) {
        m.emissive.setRGB(c, c * 0.35, 0.12);
        m.emissiveIntensity = 0.9;
      }
      flashT = 0.07;
    },
    dispose: () => materials.forEach((m) => m.dispose()),
  };
}
