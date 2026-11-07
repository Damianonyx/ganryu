import * as THREE from "three";
import type { Rig } from "./mesh";
import { HUMAN, SAMURAI, buildHumanoid, type Body, type Ctx, type Extras } from "./rig-humanoid";
import { G, Spring, fixed, joint, part } from "./rig-kit";
import { Rope, RopeSet, rootLocal } from "./rig-rope";
import { addKatana } from "./rig-samurai";
import type { CharacterDef } from "./types";

/**
 * The three swordsmen who are not armored samurai, built from their sheets:
 *   Enjirō  — a ronin in an open, torn black kimono, a ragged dark straw hat
 *             pierced by a long red oni horn, a burning crimson demon arm, and a
 *             glowing red katana with spare scabbards
 *   Mokuren — a dead-wood spirit monk: bark-grey skin, branch antlers, a bone
 *             mask with one red eye, white prayer beads, a brown kesa over one
 *             shoulder under a grey plate, red cord on the bare arm, long purple hakama
 *   Mumyō   — bandaged from head to foot, cyan eyes and a toothy grin, layered
 *             dark and blue-grey robes, a bandage sash, a katana with a glowing cyan hilt
 */

export function buildWanderer(def: CharacterDef): Rig | null {
  const id = def.id as string;
  const dress = id === "enjiro" ? dressEnjiro : id === "mokuren" ? dressMokuren : id === "mumyo" ? dressMumyo : null;
  return dress ? buildHumanoid(def, { prop: HUMAN, temper: SAMURAI, stance: "sword", dress }) : null;
}

const up = new THREE.Vector3(0, 1, 0);
function rigDir(lx: number, ly: number, lz: number, yaw: number, out: THREE.Vector3) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return out.set(-lx * c - lz * s, ly, lx * s - lz * c).normalize();
}

/** A bare, muscled torso: chest, pecs, and abdominals. */
function bareTorso(b: Body, m: THREE.Material) {
  part(b.spine, G.sphere(1, 14, 10), m, [0, 0.1, 0.01], [0, 0, 0], [0.13, 0.16, 0.1]);
  part(b.chest, G.sphere(1, 16, 12), m, [0, -0.01, 0], [0, 0, 0], [0.19, 0.17, 0.12]);
  for (const s of [-1, 1]) part(b.chest, G.sphere(1, 12, 10), m, [0.075 * s, 0.02, 0.065], [0, 0, 0], [0.08, 0.065, 0.055]);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) part(b.spine, G.sphere(1, 8, 6), m, [0.03 * s, 0.17 - i * 0.055, 0.085], [0, 0, 0], [0.028, 0.024, 0.02]);
}

/** Muscled arm segments, shoulder to wrist. */
function bareArm(a: Body["arms"][number], m: THREE.Material, r = 1) {
  part(a.shoulder, G.sphere(1, 12, 10), m, [0.012 * a.side, 0, 0], [0, 0, 0], [0.075 * r, 0.07 * r, 0.07 * r]);
  part(a.shoulder, G.limb(0.28, 0.062 * r, 0.048 * r, 0.25), m);
  part(a.elbow, G.limb(0.25, 0.05 * r, 0.036 * r, 0.25), m);
  part(a.wrist, G.rbox(0.07, 0.085, 0.08, 0.4), m, [0, -0.04, 0.005]);
}

/** A long robe skirt and a wide sleeve, the common cloth of the three. */
function sleeve(a: Body["arms"][number], m: THREE.Material, len = 0.3, wide = 0.15) {
  part(a.shoulder, G.sphere(0.075), m);
  part(a.shoulder, G.cyl(0.08, wide, len, 14), m, [0, -0.06 - len / 2, 0]);
}

/** Wrapped bands around a limb segment (bandages or cord). */
function wraps(g: THREE.Object3D, m: THREE.Material, n: number, r0: number, r1: number, from: number, to: number) {
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1);
    const r = r0 + (r1 - r0) * u;
    part(g, G.cyl(r, r, 0.022, 12), m, [0, from + (to - from) * u, 0], [((i % 2) * 2 - 1) * 0.16, 0, ((i % 3) - 1) * 0.1]);
  }
}

// ── Enjirō, The Burning Oni ───────────────────────────────────────────────

function dressEnjiro(b: Body): Extras {
  const { M, pelvis, skirt, chest, neck, head } = b;
  const skin = M.flesh("#8a5a40", 0.6);
  const robe = M.cloth("#1c181d");
  const robe2 = M.cloth("#2a2430");
  const white = M.cloth("#e6e0d4");
  const cord = M.cord("#c81c26", 0.25);
  const plate = M.lacquer("#141216");
  const straw = M.cloth("#2c2620");
  straw.side = THREE.DoubleSide;
  const demon = M.flesh("#3a0a0e", 0.45);
  const spike = M.cord("#e0202a", 0.9);
  const fire = M.cord("#ff4a1a", 1.8);
  const eye = M.cord("#ff2a2a", 2.2);
  const hairM = M.cloth("#0c0c0e");

  // open kimono over a bare chest; torn hem, a white inner panel, a red cord sash
  part(pelvis, G.cyl(0.17, 0.19, 0.1), robe2, [0, 0.02, 0]);
  part(pelvis, G.torusArc(0.19, 0.01, Math.PI * 2), cord, [0, 0.05, 0], [Math.PI / 2, 0, 0]);
  for (const x of [0.06, 0.1]) part(pelvis, G.rbox(0.012, 0.36, 0.012), cord, [x, -0.16, 0.18], [0.05, 0, 0.06]);
  part(skirt, G.tatter(0.19, 0.36, 0.84, 0.22, 21), robe, [0, -0.42, 0]);
  part(skirt, G.rbox(0.07, 0.72, 0.01), white, [-0.03, -0.38, 0.235], [0.2, 0, 0]);
  for (const { hip, knee, ankle } of b.legs) {
    part(hip, G.capsule(0.075, 0.3), robe2, [0, -0.22, 0]);
    part(knee, G.capsule(0.058, 0.28), robe2, [0, -0.2, 0]);
    part(ankle, G.rbox(0.085, 0.05, 0.2, 0.45), skin, [0, -0.035, 0.045]); // bare foot
    part(ankle, G.rbox(0.1, 0.016, 0.23, 0.3), M.cloth("#2a1e14"), [0, -0.063, 0.045]); // zori
  }
  bareTorso(b, skin);
  for (const s of [-1, 1]) part(chest, G.rbox(0.07, 0.42, 0.016, 0.3), robe, [0.11 * s, -0.08, 0.1], [0.12, -0.3 * s, 0.35 * s]); // lapels
  part(chest, G.cyl(0.075, 0.09, 0.06), robe, [0, 0.17, 0]);
  // left arm: wide sleeve under a laced shoulder guard
  const L = b.left;
  sleeve(L, robe, 0.34, 0.16);
  part(L.elbow, G.limb(0.25, 0.05, 0.036, 0.2), skin);
  part(L.wrist, G.rbox(0.07, 0.085, 0.08, 0.4), skin, [0, -0.04, 0.005]);
  const sode = fixed(chest, [0.255 * L.side, 0.15, 0]);
  for (let i = 0; i < 3; i++) part(sode, G.rbox(0.18, 0.05, 0.2, 0.3), plate, [0.035 * L.side + i * 0.012 * L.side, -0.035 - i * 0.052, 0], [0, 0, -0.32 * L.side]);
  part(sode, G.rbox(0.012, 0.16, 0.012), cord, [0.09 * L.side, -0.08, 0.07], [0, 0, -0.32 * L.side]);
  // right arm: the burning demon arm, crowned with crimson spikes
  const D = b.right;
  part(D.shoulder, G.sphere(1, 12, 10), demon, [0.015 * D.side, 0, 0], [0, 0, 0], [0.085, 0.08, 0.08]);
  part(D.shoulder, G.limb(0.28, 0.068, 0.054, 0.25), demon);
  part(D.elbow, G.limb(0.25, 0.058, 0.044, 0.3), demon);
  part(D.wrist, G.rbox(0.085, 0.09, 0.09, 0.4), demon, [0, -0.04, 0.005]);
  const spikesOn = (g: THREE.Object3D, n: number, from: number, to: number, r: number, len: number) => {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const a = 1.1 + i * 2.3;
      const t = part(g, G.cone(0.02, len * (0.6 + ((i * 7) % 5) / 8), 6), spike, [Math.sin(a) * r * D.side, from + (to - from) * u, Math.cos(a) * r]);
      t.rotation.set(-0.9 + Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.9 * D.side);
    }
  };
  spikesOn(D.shoulder, 7, 0.02, -0.24, 0.07, 0.2);
  spikesOn(D.elbow, 6, -0.02, -0.22, 0.055, 0.16);
  // head: shadowed face, red eyes, long black hair, a ragged hat pierced by a horn
  part(neck, G.cyl(0.05, 0.055, 0.08), skin, [0, 0.02, 0]);
  part(head, G.sphere(0.11), M.flesh("#4a3026", 0.6), [0, 0.11, 0.005], [0, 0, 0], [1, 1.12, 1.06]);
  for (const s of [-1, 1]) part(head, G.rbox(0.03, 0.012, 0.012, 0.4), eye, [0.04 * s, 0.13, 0.108]);
  part(head, G.dome(0.12, 0.85), hairM, [0, 0.14, -0.01]);
  part(head, G.tatter(0.06, 0.46, 0.17, 0.06, 31), straw, [0, 0.27, 0]);
  part(head, G.cone(0.06, 0.06, 12), straw, [0, 0.38, 0]);
  const hornRed = M.lacquer("#b01822");
  let h: THREE.Object3D = fixed(head, [0.02, 0.38, 0.02]);
  for (let i = 0; i < 3; i++) {
    h.rotation.x = i === 0 ? -0.15 : -0.32;
    part(h, G.cone(0.034 - i * 0.009, 0.2, 10), hornRed, [0, 0.09, 0]);
    h = fixed(h, [0, 0.17, 0]);
  }
  // red glowing blade, three scabbards
  addKatana(b, { blade: M.cord("#ff3a24", 1.1), wrap: cord, tsuba: M.metal("#8a6a3a", 0.3), fittings: M.metal("#c8a050", 0.3), scabbards: 3 });

  // ropes: flames licking off the demon arm, and long hair down the back
  const flames = [
    joint(D.shoulder, [0.06 * D.side, -0.08, -0.02]),
    joint(D.shoulder, [0.04 * D.side, -0.2, 0.04]),
    joint(D.elbow, [0.05 * D.side, -0.06, -0.02]),
    joint(D.elbow, [0.03 * D.side, -0.18, 0.03]),
    joint(D.wrist, [0.04 * D.side, -0.06, 0]),
  ].map((at) => ({ at, r: new Rope(6, 0.06) }));
  const hair = [-0.05, 0, 0.05].map((x) => ({ at: joint(head, [x, 0.12, -0.11]), r: new Rope(6, 0.09) }));
  const flameSet = new RopeSet(flames.map((f) => f.r), G.cyl(0.35, 0.5, 1, 6), fire, (_r, i) => 0.05 * (1 - i / 6.5), false, 1.25);
  const hairSet = new RopeSet(hair.map((f) => f.r), G.cyl(0.45, 0.5, 1, 6), hairM, (_r, i) => 0.07 * (1 - i / 9), false, 1.15);
  flameSet.mesh.castShadow = false;
  b.free.add(flameSet.mesh, hairSet.mesh);
  const anchor = new THREE.Vector3();
  const rest = new THREE.Vector3();
  return {
    update: (c: Ctx) => {
      b.root.updateMatrixWorld(true);
      flames.forEach((f, i) => {
        f.at.getWorldPosition(anchor);
        f.r.step(c.dt, anchor, up, { gravity: -3.2, damping: 0.82, stiff: 0.05, wind: 14 }, c.time * 1.6 + i);
      });
      hair.forEach((f, i) => {
        f.at.getWorldPosition(anchor);
        rigDir(0, -1, -0.35, c.yaw, rest);
        f.r.step(c.dt, anchor, rest, { gravity: 9.8, damping: 0.94, stiff: 0.08 }, c.time + i);
      });
      const local = rootLocal(c.x, c.airborne, c.z, c.yaw);
      flameSet.update(local);
      hairSet.update(local);
    },
    dispose: () => {
      flameSet.dispose();
      hairSet.dispose();
    },
  };
}

// ── Mokuren, The Hollow Monk ──────────────────────────────────────────────

function dressMokuren(b: Body): Extras {
  const { M, pelvis, skirt, chest, neck, head } = b;
  const bark = M.flesh("#a39c92", 0.82);
  const crack = M.flesh("#6a645c", 0.9);
  const wood = M.flesh("#8c857b", 0.8);
  const hakama = M.cloth("#4a3c56");
  const sash = M.cloth("#2a2233");
  const kesa = M.cloth("#8a5a32");
  const lining = M.cloth("#ece6da");
  const plate = M.lacquer("#8a8e96");
  const bead = M.lacquer("#efe9dc");
  const tassel = M.cloth("#7a4a26");
  const cord = M.cord("#c03a3a", 0.2);
  const bone = M.flesh("#d8d2c6", 0.5);
  const eye = M.cord("#ff2a2a", 2.4);
  const gold = M.metal("#c8a050", 0.3);

  // long purple hakama, a dark sash, and a hanging panel with red blossoms
  part(pelvis, G.cyl(0.17, 0.19, 0.11), sash, [0, 0.02, 0]);
  part(skirt, G.skirt(0.2, 0.44, 0.88, 10, 0.03), hakama, [0, -0.44, 0]);
  part(pelvis, G.rbox(0.09, 0.5, 0.012), M.cloth("#3a2c48"), [0.02, -0.25, 0.22], [0.06, 0, 0]);
  for (let i = 0; i < 4; i++) part(pelvis, G.sphere(0.012, 6, 5), cord, [0.02 + ((i % 2) - 0.5) * 0.04, -0.34 - i * 0.05, 0.228]);
  for (const x of [0.12, -0.1]) part(pelvis, G.capsule(0.012, 0.16), tassel, [x, -0.12, 0.17]);
  for (const { hip, knee, ankle } of b.legs) {
    part(hip, G.capsule(0.075, 0.3), hakama, [0, -0.22, 0]);
    part(knee, G.capsule(0.058, 0.28), hakama, [0, -0.2, 0]);
    part(ankle, G.rbox(0.1, 0.06, 0.22, 0.4), M.cloth("#2e2a2c"), [0, -0.035, 0.045]);
  }
  // bark body with cracks
  bareTorso(b, bark);
  for (const [x, y, a] of [
    [0.05, 0.02, 0.4],
    [-0.08, -0.05, -0.3],
    [0.02, -0.12, 0.1],
  ] as const)
    part(chest, G.rbox(0.006, 0.12, 0.006), crack, [x, y, 0.12], [0, 0, a]);
  // kesa: brown cloth over the left shoulder, across the chest, hanging long
  const kL = b.left;
  part(chest, G.plate(0.2, 0.2, 0.09, 3.4), kesa, [0, -0.06, 0], [0, 0, -0.55 * kL.side]);
  part(chest, G.plate(0.21, 0.21, 0.016, 3.4), lining, [0, -0.11, 0], [0, 0, -0.55 * kL.side]);
  const drape = joint(chest, [0.2 * kL.side, 0.1, 0]);
  // the drape wraps the body's side as a curved fall of cloth with a torn hem
  part(drape, G.tatter(0.2, 0.27, 0.9, 0.08, 51, 1.5), kesa, [-0.2 * kL.side, -0.46, 0], [0, (Math.PI / 2) * kL.side * -1 + Math.PI, 0]);
  for (let i = 0; i < 5; i++) part(drape, G.rbox(0.012, 0.04, 0.024), M.cloth("#5a3a20"), [0.06 * kL.side, -0.15 - i * 0.14, 0.12]); // stitching
  sleeve(kL, kesa, 0.36, 0.17);
  part(kL.elbow, G.limb(0.25, 0.05, 0.036, 0.2), bark);
  part(kL.wrist, G.rbox(0.07, 0.085, 0.08, 0.4), bark, [0, -0.04, 0.005]);
  // the grey shoulder plate over the kesa
  const sp = fixed(chest, [0.24 * kL.side, 0.16, 0]);
  for (let i = 0; i < 3; i++) part(sp, G.dome(0.11 - i * 0.012, 0.6), plate, [0.02 * kL.side, 0.02 - i * 0.05, 0], [0, 0, -0.5 * kL.side - i * 0.15 * kL.side]);
  part(sp, G.capsule(0.01, 0.06), gold, [0.02 * kL.side, -0.14, 0.08]);
  // right arm: bare bark with red cord bindings, and branches sprouting from the shoulder
  const kR = b.right;
  bareArm(kR, bark);
  wraps(kR.elbow, cord, 6, 0.054, 0.042, -0.06, -0.22);
  const branch = (g: THREE.Object3D, at: [number, number, number], rot: [number, number, number], len: number, depth: number) => {
    const j = fixed(g, at);
    j.rotation.set(...rot);
    part(j, G.cone(0.02 * (depth + 1) * 0.6, len, 6), wood, [0, len / 2, 0]);
    if (depth > 0) {
      branch(j, [0, len * 0.85, 0], [0.1, 0, 0.55], len * 0.62, depth - 1);
      branch(j, [0, len * 0.6, 0], [-0.2, 0, -0.6], len * 0.55, depth - 1);
    }
  };
  branch(chest, [0.2 * kR.side, 0.16, -0.06], [-0.4, 0, 0.7 * kR.side], 0.22, 2);
  // prayer beads: large white beads and brown tassels
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    part(chest, G.sphere(0.03, 8, 6), bead, [Math.sin(a) * 0.15, 0.13 - Math.cos(a) * 0.11, Math.cos(a) * 0.11 + 0.02]);
  }
  part(chest, G.capsule(0.014, 0.08), tassel, [0.04, -0.02, 0.15]);
  // head: an elongated bone mask with one red eye, gold rings, and antlers of dead wood
  part(neck, G.cyl(0.045, 0.055, 0.1), bark, [0, 0.02, 0]);
  part(head, G.sphere(0.1), bone, [0, 0.12, 0.01], [0, 0, 0], [0.9, 1.3, 1.05]);
  part(head, G.rbox(0.07, 0.05, 0.03, 0.4), M.flesh("#3a3632", 0.8), [-0.03, 0.15, 0.09]); // eye socket
  part(head, G.sphere(0.014, 8, 6), eye, [-0.03, 0.15, 0.105]);
  for (const s of [-1, 1]) part(head, G.torusArc(0.018, 0.004, Math.PI * 2), gold, [0.09 * s, 0.08, 0], [0, Math.PI / 2, 0]);
  branch(head, [0.03, 0.24, -0.01], [-0.2, 0, -0.25], 0.18, 2);
  branch(head, [-0.03, 0.24, -0.01], [-0.25, 0, 0.3], 0.17, 2);
  branch(head, [0, 0.25, -0.03], [-0.5, 0, 0], 0.15, 1);
  addKatana(b, { blade: M.metal("#d8dce4", 0.12), wrap: M.cloth("#6a4428"), tsuba: M.metal("#3a3634", 0.34), fittings: gold, scabbard: M.lacquer("#1e1c20") });

  const drapeSpring = new Spring(40, 6);
  return {
    update: (c: Ctx) => {
      drape.rotation.x = drapeSpring.step(c.drag * 0.35 + Math.max(0, -c.jolt) * 0.2 - c.lean * 0.4, c.dt);
    },
  };
}

// ── Mumyō, The Bound Grin ─────────────────────────────────────────────────

function dressMumyo(b: Body): Extras {
  const { M, pelvis, skirt, chest, neck, head } = b;
  const band = M.cloth("#d8d4cc");
  const gap = M.flesh("#8a867e", 0.7);
  const robe = M.cloth("#23272e");
  const over = M.cloth("#5a6c7e");
  const obi = M.cloth("#3a3e46");
  const eye = M.cord("#46e0ea", 2.4);
  const tooth = M.lacquer("#eeeae2");

  // layered robes, a bandage sash
  part(pelvis, G.cyl(0.17, 0.19, 0.11), obi, [0, 0.02, 0]);
  for (let i = 0; i < 3; i++) part(pelvis, G.cyl(0.195, 0.2, 0.024, 16), band, [0, 0.0 + i * 0.03, 0], [0.12 * (i - 1), 0, 0.08 * (i - 1)]);
  part(pelvis, G.rbox(0.05, 0.4, 0.012), band, [0.1, -0.15, 0.17], [0.1, 0, 0.35]); // trailing sash end
  part(skirt, G.tatter(0.19, 0.34, 0.74, 0.16, 41), robe, [0, -0.37, 0]);
  part(skirt, G.tatter(0.2, 0.33, 0.56, 0.24, 43, 4.4), over, [0, -0.28, 0]);
  for (const { hip, knee, ankle } of b.legs) {
    part(hip, G.capsule(0.075, 0.3), robe, [0, -0.22, 0]);
    part(knee, G.capsule(0.06, 0.28), gap, [0, -0.2, 0]);
    wraps(knee, band, 6, 0.064, 0.056, -0.12, -0.38);
    part(ankle, G.rbox(0.1, 0.06, 0.22, 0.4), M.cloth("#141416"), [0, -0.035, 0.045]);
  }
  // a bandaged chest under an open robe
  part(b.spine, G.sphere(1, 14, 10), gap, [0, 0.1, 0.005], [0, 0, 0], [0.13, 0.16, 0.1]);
  part(chest, G.sphere(1, 16, 12), gap, [0, -0.01, 0], [0, 0, 0], [0.19, 0.17, 0.12]);
  for (let i = 0; i < 5; i++)
    for (const s of [-1, 1]) part(chest, G.rbox(0.03, 0.2, 0.012), band, [0.03 * s, 0.04 - i * 0.05, 0.12], [0, 0, 0.8 * s]);
  for (const s of [-1, 1]) part(chest, G.rbox(0.08, 0.44, 0.016, 0.3), robe, [0.12 * s, -0.08, 0.1], [0.12, -0.3 * s, 0.35 * s]); // lapels
  part(chest, G.plate(0.2, 0.22, 0.16, 3.0), over, [0, 0.06, 0], [0, Math.PI, 0]); // over-robe across the back
  for (const a of b.arms) {
    sleeve(a, robe, 0.26, 0.15);
    part(a.elbow, G.limb(0.25, 0.05, 0.036, 0.2), gap);
    wraps(a.elbow, band, 7, 0.054, 0.042, -0.02, -0.24);
    part(a.wrist, G.rbox(0.075, 0.09, 0.085, 0.4), band, [0, -0.04, 0.005]);
  }
  // a bandaged head with cyan eyes and a grin of bared teeth
  part(neck, G.cyl(0.05, 0.055, 0.09), band, [0, 0.02, 0]);
  part(head, G.sphere(0.11), gap, [0, 0.11, 0.005], [0, 0, 0], [0.95, 1.15, 1.05]);
  for (let i = 0; i < 7; i++) {
    if (i === 3) continue; // the eye line stays open
    part(head, G.cyl(0.108 - Math.abs(i - 3) * 0.008, 0.108 - Math.abs(i - 3) * 0.008, 0.022, 16), band, [0, 0.02 + i * 0.033, 0.005], [0.1 * ((i % 2) * 2 - 1), 0, 0]);
  }
  for (const s of [-1, 1]) part(head, G.rbox(0.032, 0.012, 0.012, 0.4), eye, [0.04 * s, 0.12, 0.104]);
  part(head, G.rbox(0.09, 0.02, 0.012, 0.3), M.flesh("#121214", 0.7), [0, 0.065, 0.1]); // mouth
  for (let i = 0; i < 6; i++) part(head, G.rbox(0.009, 0.014, 0.008), tooth, [(i - 2.5) * 0.013, 0.065, 0.106]);
  addKatana(b, { blade: M.metal("#d8dce4", 0.12), wrap: M.cord("#bff4f8", 1.0), hilt: M.cord("#8ae8f0", 0.6), tsuba: M.metal("#c8a050", 0.3), fittings: M.metal("#c8a050", 0.3), scabbard: M.lacquer("#1e2228") });
  return {};
}
