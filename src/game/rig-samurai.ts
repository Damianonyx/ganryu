import * as THREE from "three";
import type { Rig } from "./mesh";
import { HUMAN, R, SAMURAI, buildHumanoid, type Body, type Extras } from "./rig-humanoid";
import { G, Spring, fixed, joint, part } from "./rig-kit";
import type { CharacterDef } from "./types";

/**
 * The armored samurai dressing for the human fighters (all four protagonists
 * and five antagonists), on the shared body in rig-humanoid.ts. Built like the
 * reference robot: many small rounded parts in a few lacquer, steel, cloth,
 * and cord materials, merged per joint.
 */

type Style = "heavy" | "light" | "robe";

const STYLE: Partial<Record<string, Style>> = {
  kairo: "heavy",
  kurogane: "heavy",
  hakuren: "light",
  akari: "light",
  shion: "robe",
  nethrak: "robe",
};

/** Lacing colors where the sheet's accent is too dark to read on black lacquer. */
const LACE: Partial<Record<string, string>> = {
  kairo: "#b8462a", // ember, for The Last Ember
  kurogane: "#7a6a4a",
};

/**
 * A katana in the right hand (pointing along the hand's +Z) and its scabbard
 * on the left hip. Shared by every sword fighter.
 */
export function addKatana(
  b: Body,
  o: { blade: THREE.Material; wrap: THREE.Material; tsuba: THREE.Material; fittings: THREE.Material; size?: number; hilt?: THREE.Material; scabbard?: THREE.Material; scabbards?: number },
) {
  const { M } = b;
  const big = o.size ?? 1;
  const sword = fixed(b.weapon, [0, 0, 0]);
  sword.rotation.x = Math.PI / 2; // the sword is drawn along +Y; point it along the hand's +Z
  part(sword, G.capsule(0.02, 0.2), o.hilt ?? M.cloth("#1a1418"), [0, -0.02, 0]); // tsuka
  for (let i = 0; i < 5; i++) part(sword, G.rbox(0.045, 0.012, 0.045, 0.4), o.wrap, [0, -0.1 + i * 0.045, 0], [0, 0.78, 0]); // wrap
  part(sword, G.cyl(0.065, 0.065, 0.012, 20), o.tsuba, [0, 0.11, 0]); // tsuba
  part(sword, G.torusArc(0.065, 0.006, Math.PI * 2), o.fittings, [0, 0.11, 0], [Math.PI / 2, 0, 0]);
  part(sword, G.cyl(0.022, 0.022, 0.03, 10), o.fittings, [0, 0.13, 0]); // habaki
  part(sword, G.blade(0.78 * big, 0.034 * big, 0.05 * big), o.blade, [0, 0.14, 0]);
  // scabbards on the left hip
  for (let i = 0; i < (o.scabbards ?? 1); i++) {
    part(b.pelvis, G.capsule(0.022, 0.72 - i * 0.06), o.scabbard ?? M.lacquer("#141416"), [-R * (0.2 + i * 0.03), -0.05 - i * 0.04, -0.08 + i * 0.05], [1.85 - i * 0.18, 0, -R * (0.2 + i * 0.12)]);
  }
}

export function buildSamurai(def: CharacterDef): Rig {
  return buildHumanoid(def, { prop: HUMAN, temper: SAMURAI, stance: "sword", dress: dressSamurai });
}

function dressSamurai(b: Body): Extras {
  const { def, M, prop: P, pelvis, skirt, spine, chest, neck, head } = b;
  const k = def.kit;
  const id = def.id as string;
  const style: Style = STYLE[id] ?? "light";

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
  const robe = style === "robe";

  // ── Pelvis, skirt, and tassets ──────────────────────────────────────────
  part(pelvis, G.cyl(0.17, 0.19, 0.1), obiMat, [0, 0.02, 0]); // obi
  part(pelvis, G.rbox(0.1, 0.12, 0.05), obiMat, [0.06, 0.0, -0.18], [0, 0, 0.3]); // knot
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
  for (const { hip, knee, ankle } of b.legs) {
    part(hip, G.capsule(0.075, P.thigh - 0.14), under, [0, -P.thigh / 2, 0]);
    if (style === "heavy") part(hip, G.plate(0.095, 0.085, 0.24, 1.9), armor, [0, -0.2, 0]); // haidate
    part(knee, G.sphere(0.06), darkSteel, [0, 0, 0.02]);
    part(knee, G.capsule(0.058, P.shin - 0.14), under, [0, -P.shin / 2, 0]);
    // suneate (shin guard) with a steel knee cop
    part(knee, G.plate(0.074, 0.066, P.shin * 0.78, 2.3), style === "robe" ? trimCloth : armor, [0, -P.shin * 0.48, 0]);
    part(knee, G.dome(0.055, 0.8), steel, [0, -0.02, 0.045], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) part(knee, G.rbox(0.13, 0.008, 0.01), lace, [0, -0.1 - i * 0.1, 0.07]);
    part(ankle, G.rbox(0.095, 0.06, 0.21, 0.35), M.cloth("#e8e4da"), [0, -0.03, 0.045]); // tabi
    part(ankle, G.rbox(0.11, 0.018, 0.24, 0.3), M.cloth("#3a2a1c"), [0, -0.062, 0.045]); // sandal
  }

  // ── Torso ───────────────────────────────────────────────────────────────
  part(spine, G.capsule(0.13, 0.1), under, [0, 0.09, 0]);
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
  for (const { shoulder, elbow, wrist } of b.arms) {
    part(shoulder, G.sphere(0.07), robe ? cloth : armor, [0, 0, 0]);
    if (robe) part(shoulder, G.cyl(0.08, 0.15, 0.3, 16), cloth, [0, -0.17, 0]); // wide sleeve
    else part(shoulder, G.capsule(0.06, 0.16), under, [0, -0.14, 0]);
    part(elbow, G.sphere(0.05), darkSteel, [0, 0, 0]);
    // kote: an armored sleeve with steel bands
    part(elbow, G.capsule(0.05, 0.16), robe ? trimCloth : armor, [0, -0.12, 0]);
    for (let i = 0; i < 3; i++) part(elbow, G.cyl(0.057, 0.057, 0.014), steel, [0, -0.06 - i * 0.06, 0]);
    part(wrist, G.rbox(0.07, 0.085, 0.085, 0.4), robe ? skin : darkSteel, [0, -0.04, 0.005]);
  }

  // ── Head ────────────────────────────────────────────────────────────────
  part(neck, G.cyl(0.05, 0.055, 0.08), skin, [0, 0.02, 0]);
  part(head, G.sphere(0.112), skin, [0, 0.11, 0.005], [0, 0, 0], [1, 1.12, 1.06]);
  const eyeGlow = id === "nethrak" ? "#ff2a2a" : id === "kairo" ? "#ff7a3a" : null;
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
  } else if (k.hat === "kasa") {
    const hatMat = id === "nethrak" ? M.metal("#c8ccd4", 0.32) : M.cloth(k.trim);
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
  }

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
  if (id === "akari") {
    const beads = M.lacquer("#3a1c18");
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      part(chest, G.sphere(0.017, 8, 6), beads, [Math.sin(a) * 0.15, 0.14 - Math.cos(a) * 0.12, Math.cos(a) * 0.12 + 0.02]);
    }
  }
  if (id === "akari") for (const x of [-0.14, 0.12]) part(pelvis, G.rbox(0.04, 0.16, 0.004), M.cloth("#efe8d8"), [x, -0.1, 0.19], [0.1, 0, 0]); // talismans

  // ── Weapons ─────────────────────────────────────────────────────────────
  const weapon = b.weapon;
  if (k.weapons === "staff") {
    part(weapon, G.cyl(0.02, 0.02, 1.7, 10), M.lacquer("#2a1e16"), [0, 0, 0.1], [Math.PI / 2, 0, 0]);
    for (const z of [-0.74, 0.94]) part(weapon, G.cyl(0.03, 0.03, 0.07, 12), steel, [0, 0, z], [Math.PI / 2, 0, 0]);
    part(weapon, G.torusArc(0.06, 0.008, Math.PI * 2), steel, [0, 0, 0.98]);
  } else {
    const big = id === "nethrak" ? 1.35 : 1;
    addKatana(b, {
      blade: id === "nethrak" ? M.metal("#c41c26", 0.2) : M.metal("#d8dce4", 0.12),
      wrap: lace,
      tsuba: darkSteel,
      fittings: steel,
      size: big,
    });
  }


  const skirtSpring = new Spring(50, 7);
  return {
    update: (c) => {
      const { dt, drag, jolt, lean } = c;
      hairChain.forEach((h, i) => {
        const want = (i === 0 ? 0.35 : 0.12) * drag + jolt * 0.25 + Math.sin(c.time * 3 + i) * 0.03 + lean * 0.4;
        h.g.rotation.x = (i === 0 ? (h.g.userData.base ?? (h.g.userData.base = h.g.rotation.x)) : 0) + h.s.step(want, dt);
      });
      tassets.forEach((p) => {
        const leg = Math.cos(p.a) > 0.3 ? (Math.sin(p.a) * R > 0 ? b.legs[0] : b.legs[1]) : null;
        const follow = leg ? Math.min(0, leg.hip.rotation.x) * -0.55 : 0;
        p.g.rotation.x = -p.s.step(follow + drag * 0.12 + Math.abs(jolt) * 0.1, dt);
      });
      sodes.forEach((s) => {
        const a = s.side === R ? b.right : b.left;
        s.g.rotation.x = s.sx.step(a.shoulder.rotation.x * 0.3, dt);
        s.g.rotation.z = s.sz.step(a.shoulder.rotation.z * 0.45, dt);
      });
      const avg = (b.legs[0].hip.rotation.x + b.legs[1].hip.rotation.x) / 2;
      skirt.rotation.x = skirtSpring.step(avg * 0.35, dt);
    },
  };
}
