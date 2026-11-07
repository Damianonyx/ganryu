import * as THREE from "three";
import type { Rig } from "./mesh";
import { HUMAN, R, buildHumanoid, type Body, type Ctx, type Extras, type Proportions, type Temper } from "./rig-humanoid";
import { G, Spring, fixed, joint, part } from "./rig-kit";
import { Rope, RopeSet, rootLocal } from "./rig-rope";
import type { CharacterDef } from "./types";

/**
 * The non-human fighters, built from their reference sheets on the shared
 * two-legged body (rig-humanoid.ts):
 *   Vargash  — bat-wolf brawler: wings, tail, digitigrade clawed feet, bone gauntlet
 *   Sei      — smoke shadow: silver light lines, white eyes, a jagged grin, tendrils
 *   Rei      — thorned bark stalker: long talons, swept thorn crest, violet eyes
 *   Gorvane  — spiked crimson knight: scale-mail chest, torn tabard, ponderous gait
 *   Kharzul  — the Hand of Thorns: spined crown, beaked helm, four chains with sickles
 * Chains, tendrils, and the tail are world-space ropes (rig-rope.ts).
 */

export function buildMonster(def: CharacterDef): Rig | null {
  const id = def.id as string;
  if (id === "vargash") return buildHumanoid(def, { prop: VARGASH, temper: BEAST, stance: "claws", dress: dressVargash });
  if (id === "sei") return buildHumanoid(def, { prop: LEAN, temper: SMOKE, stance: "claws", dress: dressSei });
  if (id === "rei") return buildHumanoid(def, { prop: STALKER, temper: STALK, stance: "claws", dress: dressRei });
  if (id === "gorvane") return buildHumanoid(def, { prop: BULK, temper: HEAVY, stance: "fists", dress: dressGorvane });
  if (id === "kharzul") return buildHumanoid(def, { prop: GAUNT, temper: GLIDE, stance: "chains", dress: dressKharzul });
  return null;
}

// ── Proportions and temperaments ──────────────────────────────────────────

const VARGASH: Proportions = { ...HUMAN, thigh: 0.4, shin: 0.4, ankleH: 0.15, hipW: 0.13, shoulderW: 0.29, upperArm: 0.32, foreArm: 0.3, chestY: 0.32 };
const LEAN: Proportions = { ...HUMAN, thigh: 0.46, shin: 0.43, hipY: 0.95, shoulderW: 0.23, upperArm: 0.31, foreArm: 0.28 };
const STALKER: Proportions = { ...HUMAN, thigh: 0.44, shin: 0.42, ankleH: 0.12, hipY: 0.96, hipW: 0.1, shoulderW: 0.22, upperArm: 0.34, foreArm: 0.34 };
const BULK: Proportions = { ...HUMAN, hipW: 0.14, shoulderW: 0.3, chestY: 0.32, upperArm: 0.3, foreArm: 0.27 };
const GAUNT: Proportions = { ...HUMAN, thigh: 0.47, shin: 0.45, hipY: 0.99, hipW: 0.1, shoulderW: 0.21, upperArm: 0.31, foreArm: 0.3, neckY: 0.24 };

const BEAST: Temper = { hunch: 0.26, crouch: 0.04, stride: 1.15, lift: 1.3, bob: 1.5, feetW: 1.25, heavy: 0.4, breath: 2.2 };
const SMOKE: Temper = { hunch: 0.08, crouch: 0.02, stride: 1.05, lift: 0.75, bob: 0.6, feetW: 0.95, heavy: 0, breath: 1.5 };
const STALK: Temper = { hunch: 0.2, crouch: 0.06, stride: 1.2, lift: 1.15, bob: 0.8, feetW: 1.05, heavy: 0, breath: 1.2 };
const HEAVY: Temper = { hunch: 0.05, crouch: 0.05, stride: 0.82, lift: 0.7, bob: 1.7, feetW: 1.35, heavy: 1, breath: 1.4 };
const GLIDE: Temper = { hunch: 0.04, crouch: 0, stride: 0.95, lift: 0.4, bob: 0.35, feetW: 0.9, heavy: 0, breath: 0.8 };

// ── Shared helpers ────────────────────────────────────────────────────────

const WORLD_DOWN = new THREE.Vector3(0, -1, 0);
const tmpA = new THREE.Vector3();

/** A direction in the rig's frame (front +Z) expressed in the world, for a body at `yaw`. */
function rigDir(lx: number, ly: number, lz: number, yaw: number, out = new THREE.Vector3()) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return out.set(-lx * c - lz * s, ly, lx * s - lz * c).normalize();
}

/** Thorns: cones scattered along a limb segment, pointing out and back. */
function thorns(g: THREE.Object3D, m: THREE.Material, n: number, len: number, from: number, to: number, r: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const a = seed + i * 2.399; // golden angle around the limb
    const y = from + (to - from) * u;
    const t = part(g, G.cone(0.016, len * (0.7 + ((i * 37) % 10) / 22), 6), m, [Math.sin(a) * r, y, Math.cos(a) * r]);
    t.rotation.set(Math.cos(a) * 1.2 + 0.4, 0, -Math.sin(a) * 1.2);
  }
}

/**
 * An organic limb segment: overlapping ellipsoids tapering from r0 at the joint
 * to r1 at the far end, with a muscle bulge near the top. The masses reach past
 * both joints so the segments read as one body instead of a jointed mannequin.
 */
function flesh(g: THREE.Object3D, m: THREE.Material, len: number, r0: number, r1: number, bulge = 0.15, flat = 0.85) {
  part(g, G.limb(len, r0, r1, bulge), m, [0, 0, 0], [0, 0, 0], [1, 1, flat]);
}

/** Three curved talons on a hand or foot, edges down and forward. */
function talons(g: THREE.Object3D, m: THREE.Material, len: number, spread: number, at: [number, number, number], pitch: number, width = 0.16) {
  for (const i of [-1, 0, 1]) {
    const c = fixed(g, [at[0] + i * spread, at[1], at[2]]);
    c.rotation.set(pitch, i * 0.18, 0);
    part(c, G.blade(len, len * width, len * 0.45), m, [0, 0, 0], [0, 0, 0]);
  }
}

// ── Vargash, The Night Howl ───────────────────────────────────────────────

function dressVargash(b: Body): Extras {
  const { M, pelvis, skirt, spine, chest, neck, head } = b;
  const hide = M.skin("#5a5e66"); // grey muscle
  const fur = M.cloth("#141418");
  const pants = M.cloth("#18181c");
  const strap = M.lacquer("#24201c");
  const buckle = M.metal("#8a8478", 0.3);
  const bone = M.lacquer("#c9b48c");
  const wrap = M.cloth("#b8a47e");
  const claw = M.lacquer("#d0602a");
  const membrane = M.cloth("#465062");
  membrane.side = THREE.DoubleSide;
  const eye = M.cord("#ff6a22", 1.8);
  const tooth = M.lacquer("#ece4d4");

  // belt, loincloth, baggy trousers
  part(pelvis, G.cyl(0.21, 0.22, 0.08), strap, [0, 0.03, 0]);
  part(pelvis, G.rbox(0.09, 0.07, 0.03), buckle, [0, 0.03, 0.22]);
  part(skirt, G.skirt(0.21, 0.27, 0.34, 8, 0.02), pants, [0, -0.17, 0]);
  const cloth = joint(pelvis, [0, -0.02, 0.21]);
  part(cloth, G.tatter(0.1, 0.11, 0.5, 0.12, 3, 1.4), M.cloth("#d8642a"), [0, -0.25, -0.1]);
  for (const { hip, knee, ankle } of b.legs) {
    part(hip, G.capsule(0.1, 0.22), pants, [0, -0.2, 0]);
    part(knee, G.capsule(0.075, 0.24), pants, [0, -0.14, 0]);
    for (let i = 0; i < 4; i++) part(knee, G.cyl(0.08 - i * 0.004, 0.08 - i * 0.004, 0.05), wrap, [0, -0.2 - i * 0.055, 0], [0.12 * (i % 2 ? 1 : -1), 0, 0]);
    // a digitigrade paw: the heel rides high, the toes take the ground
    part(ankle, G.rbox(0.12, 0.09, 0.2, 0.4), wrap, [0, -0.08, 0.06], [0.5, 0, 0]);
    part(ankle, G.rbox(0.13, 0.05, 0.12, 0.4), fur, [0, -0.13, 0.13]);
    talons(ankle, claw, 0.08, 0.04, [0, -0.13, 0.19], 1.75);
  }

  // torso: a hunched slab of muscle with a fur mane
  part(spine, G.capsule(0.17, 0.08), hide, [0, 0.1, 0], [0, 0, 0], [1.1, 1, 0.85]);
  part(chest, G.capsule(0.22, 0.12), hide, [0, 0.0, 0], [0, 0, 0], [1.15, 1, 0.8]);
  for (const s of [-1, 1]) part(chest, G.sphere(0.11), hide, [0.1 * s, 0.03, 0.1], [0, 0, 0], [1, 0.8, 0.6]); // pecs
  for (let i = 0; i < 3; i++) part(spine, G.rbox(0.18, 0.04, 0.03, 0.45), hide, [0, 0.15 - i * 0.06, 0.15]); // abs
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 1.6 - Math.PI * 0.8 + Math.PI; // around the back and shoulders
    part(chest, G.cone(0.05, 0.22 + (i % 3) * 0.06, 6), fur, [Math.sin(a) * 0.16, 0.2, Math.cos(a) * 0.12], [Math.cos(a) * -1.1 + 0.3, 0, Math.sin(a) * 1.1]);
  }
  // shoulder straps
  part(chest, G.rbox(0.07, 0.03, 0.44, 0.3), strap, [0.13 * R, 0.14, 0], [0, 0, 0.5 * R]);

  // arms: straps on the right, the bone gauntlet on the left
  for (const a of b.arms) {
    part(a.shoulder, G.sphere(0.11), hide, [0.01 * a.side, -0.01, 0]); // deltoid
    flesh(a.shoulder, hide, 0.34, 0.1, 0.075, 0.3);
    flesh(a.elbow, hide, 0.3, 0.085, 0.065, 0.2);
    part(a.wrist, G.rbox(0.11, 0.1, 0.11, 0.4), hide, [0, -0.05, 0.01]);
    talons(a.wrist, claw, 0.09, 0.035, [0, -0.1, 0.05], 2.2);
    if (a.side === R) {
      for (let i = 0; i < 3; i++) part(a.elbow, G.cyl(0.09, 0.09, 0.045), strap, [0, -0.05 - i * 0.08, 0]);
      part(a.shoulder, G.cyl(0.1, 0.1, 0.05), strap, [0, -0.12, 0]);
    } else {
      // bone gauntlet: stacked rings with studs
      for (let i = 0; i < 5; i++) {
        part(a.elbow, G.cyl(0.11 - i * 0.004, 0.115 - i * 0.004, 0.055), bone, [0, -0.02 - i * 0.055, 0], [0.08 * (i % 2 ? 1 : -1), 0, 0]);
        for (const s of [-1, 1]) part(a.elbow, G.sphere(0.014), buckle, [0.1 * s, -0.02 - i * 0.055, 0.04]);
      }
      part(a.wrist, G.rbox(0.13, 0.12, 0.13, 0.4), bone, [0, -0.04, 0.01]);
    }
  }

  // head: a wolf's skull with ears, snout, glowing eyes, and a hinged jaw
  part(neck, G.capsule(0.08, 0.06), hide, [0, 0.02, 0]);
  part(head, G.sphere(0.13), fur, [0, 0.12, 0], [0, 0, 0], [1, 0.95, 1.05]);
  part(head, G.rbox(0.1, 0.08, 0.18, 0.4), fur, [0, 0.1, 0.15], [0.15, 0, 0]); // muzzle
  part(head, G.sphere(0.025), M.lacquer("#0a0a0c"), [0, 0.12, 0.25]); // nose
  for (const s of [-1, 1]) {
    part(head, G.cone(0.045, 0.16, 6), fur, [0.08 * s, 0.26, -0.02], [-0.25, 0, -0.35 * s]);
    part(head, G.rbox(0.03, 0.016, 0.012, 0.4), eye, [0.05 * s, 0.15, 0.12]);
    part(head, G.cone(0.01, 0.04, 5), tooth, [0.035 * s, 0.065, 0.22], [Math.PI, 0, 0]); // fangs
  }
  const jaw = joint(head, [0, 0.07, 0.04]);
  part(jaw, G.rbox(0.085, 0.04, 0.17, 0.4), fur, [0, -0.02, 0.09]);
  for (const s of [-1, 1]) part(jaw, G.cone(0.01, 0.035, 5), tooth, [0.03 * s, 0.01, 0.16]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    part(head, G.cone(0.04, 0.16, 6), fur, [Math.sin(a) * 0.1, 0.06, Math.cos(a) * 0.08 - 0.04], [Math.cos(a) * -0.9 - 0.4, 0, Math.sin(a) * 0.9]); // cheek and neck ruff
  }

  // wings: an arm bone and a hand of finger bones with membrane between them
  const wings = [R, -R].map((side) => {
    const root = joint(chest, [0.11 * side, 0.15, -0.13]);
    const arm = joint(root);
    part(arm, G.capsule(0.03, 0.42), strap, [0.21 * side, 0.08, -0.02], [0, 0, (-Math.PI / 2 + 0.35) * side]);
    const hand = joint(arm, [0.4 * side, 0.16, -0.03]);
    const fingers: [number, number, number][] = [
      [0.22, 0.62, 0.0], // the hooked top finger
      [0.55, 0.28, 0],
      [0.6, -0.22, 0],
      [0.36, -0.72, 0],
    ];
    const tips = fingers.map(([x, y]) => new THREE.Vector3(x * side, y, -0.02));
    tips.forEach((tip, i) => {
      const len = tip.length();
      const f = part(hand, G.capsule(0.018 - i * 0.002, len - 0.04), strap, [tip.x / 2, tip.y / 2, tip.z / 2]);
      f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpA.copy(tip).normalize());
    });
    const hook = part(hand, G.blade(0.24, 0.04, 0.12), claw, [tips[0].x, tips[0].y, 0]);
    hook.rotation.set(0, side > 0 ? 0 : Math.PI, -0.9 * side);
    // membrane: a fan from the wrist through the finger tips, scalloped back to the body
    const pts: number[] = [];
    const W = new THREE.Vector3(0, 0, -0.02);
    const body = new THREE.Vector3(-0.34 * side, -0.62, 0.02);
    for (let i = 0; i < tips.length - 1; i++) {
      const mid = tips[i].clone().add(tips[i + 1]).multiplyScalar(0.5).multiplyScalar(0.86);
      pts.push(...W.toArray(), ...tips[i].toArray(), ...mid.toArray(), ...W.toArray(), ...mid.toArray(), ...tips[i + 1].toArray());
    }
    const lastMid = tips[3].clone().add(body).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.08, 0));
    pts.push(...W.toArray(), ...tips[3].toArray(), ...lastMid.toArray(), ...W.toArray(), ...lastMid.toArray(), ...body.toArray());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((pts.length / 3) * 2), 2));
    geo.computeVertexNormals();
    part(hand, geo, membrane);
    return { root, arm, hand, side, flap: new Spring(40, 6) };
  });

  // the tail, and belt chains
  const tail = new Rope(6, 0.12);
  const tailSet = new RopeSet([tail], G.cone(0.5, 1, 7), fur, (_r, i) => 0.13 - i * 0.017, false, 1.15);
  const chains = [new Rope(5, 0.06), new Rope(5, 0.06)];
  const chainSet = new RopeSet(chains, new THREE.TorusGeometry(0.5, 0.14, 4, 8), buckle, () => 0.045, true, 1.6);
  b.free.add(tailSet.mesh, chainSet.mesh);
  const tailAt = joint(pelvis, [0, -0.02, -0.2]);
  const chainAt = [joint(pelvis, [0.18 * R, 0.0, 0.1]), joint(pelvis, [-0.16 * R, 0.0, -0.08])];
  const cloth2 = new Spring(45, 6);
  const anchor = new THREE.Vector3();
  const rest = new THREE.Vector3();

  return {
    update: (c: Ctx) => {
      // jaw: snaps open on attacks, pants when running
      const roar = c.name === "slash" || c.name === "special" ? Math.sin(Math.min(1, c.t / 0.3) * Math.PI) : 0;
      jaw.rotation.x = 0.08 + roar * 0.55 + c.drag * 0.12 * (0.5 + 0.5 * Math.sin(c.time * 14));
      // wings: half-raised at rest, swept back when running, spread and beating in the air
      const air = c.airborne > 0.01 || c.name === "leap" ? 1 : 0;
      const beat = air ? Math.sin(c.time * 13) * 0.55 : Math.sin(c.time * 1.6) * 0.05;
      const spread = c.name === "special" ? 1 : air;
      for (const w of wings) {
        const target = -0.15 + spread * 0.35 - c.drag * 0.35 * (1 - air) + beat;
        // sweep back (toward -Z) at rest; open out to the sides when spread
        w.root.rotation.set(0.15 + c.drag * 0.35 * (1 - air), 0.35 * w.side * (1 - spread * 0.7), 0);
        w.arm.rotation.z = w.flap.step(target, c.dt) * w.side;
        w.hand.rotation.z = (0.25 - spread * 0.35 + c.drag * 0.3) * w.side;
      }
      cloth.rotation.x = -cloth2.step(Math.min(0, b.legs[0].hip.rotation.x) * -0.4 + c.drag * 0.3, c.dt);
      // ropes
      b.root.updateMatrixWorld(true);
      tailAt.getWorldPosition(anchor);
      rigDir(0, -0.35, -1, c.yaw, rest);
      tail.step(c.dt, anchor, rest, { gravity: 5, damping: 0.94, stiff: 0.22 }, c.time);
      chains.forEach((ch, i) => {
        chainAt[i].getWorldPosition(anchor);
        ch.step(c.dt, anchor, WORLD_DOWN, { gravity: 9.8, damping: 0.96, stiff: 0 }, c.time);
      });
      const local = rootLocal(c.x, c.airborne, c.z, c.yaw);
      tailSet.update(local);
      chainSet.update(local);
    },
    dispose: () => {
      tailSet.dispose();
      chainSet.dispose();
    },
  };
}

// ── Sei, The Silver Hollow ────────────────────────────────────────────────

function dressSei(b: Body): Extras {
  const { M, pelvis, spine, chest, neck, head } = b;
  const shade = M.flesh("#07070a", 0.55);
  const line = M.cord("#e6e8f0", 0.9);
  const eye = M.cord("#ffffff", 2.4);

  // a lean, muscular shadow traced with silver light lines
  part(pelvis, G.capsule(0.13, 0.06), shade, [0, -0.02, 0], [0, 0, Math.PI / 2], [1, 1, 0.8]);
  for (const { hip, knee, ankle, side } of b.legs) {
    flesh(hip, shade, 0.48, 0.1, 0.06, 0.2);
    flesh(knee, shade, 0.45, 0.07, 0.04, 0.3);
    part(ankle, G.rbox(0.08, 0.05, 0.2, 0.45), shade, [0, -0.04, 0.05]);
    part(hip, G.rbox(0.008, 0.34, 0.008), line, [0.04 * side, -0.22, 0.075], [0, 0, 0.08 * side]);
    part(knee, G.rbox(0.007, 0.3, 0.007), line, [-0.02 * side, -0.2, 0.055], [0.05, 0, 0]);
  }
  // a V-shaped torso: broad chest and lats over a narrow waist
  part(spine, G.sphere(1, 14, 10), shade, [0, 0.1, 0.005], [0, 0, 0], [0.12, 0.16, 0.09]);
  part(chest, G.sphere(1, 16, 12), shade, [0, 0.0, 0], [0, 0, 0], [0.2, 0.17, 0.12]);
  for (const s of [-1, 1]) {
    part(chest, G.sphere(1, 12, 10), shade, [0.075 * s, 0.03, 0.06], [0, 0, 0], [0.085, 0.07, 0.06]); // pecs
    part(chest, G.sphere(1, 12, 10), shade, [0.13 * s, -0.08, -0.02], [0, 0, 0.3 * s], [0.06, 0.13, 0.07]); // lats
  }
  part(chest, G.rbox(0.006, 0.42, 0.006), line, [0, -0.08, 0.125]); // sternum line
  for (const s of [-1, 1]) {
    part(chest, G.rbox(0.006, 0.2, 0.006), line, [0.08 * s, 0.02, 0.115], [0, 0, 0.9 * s]);
    part(spine, G.rbox(0.006, 0.16, 0.006), line, [0.06 * s, 0.08, 0.1], [0, 0, -0.35 * s]);
  }
  for (const a of b.arms) {
    part(a.shoulder, G.sphere(1, 12, 10), shade, [0.015 * a.side, 0, 0], [0, 0, 0], [0.08, 0.075, 0.075]); // deltoid
    flesh(a.shoulder, shade, 0.32, 0.068, 0.05, 0.25);
    flesh(a.elbow, shade, 0.3, 0.055, 0.035, 0.2);
    part(a.wrist, G.rbox(0.07, 0.08, 0.07, 0.4), shade, [0, -0.04, 0]);
    for (const i of [-1, 0, 1]) part(a.wrist, G.cone(0.012, 0.09, 5), shade, [i * 0.022, -0.11, 0.02], [Math.PI - 0.3, 0, 0]); // fingers
    part(a.shoulder, G.rbox(0.006, 0.26, 0.006), line, [0.03 * a.side, -0.15, 0.06]);
    part(a.elbow, G.rbox(0.006, 0.24, 0.006), line, [0, -0.13, 0.05]);
  }
  part(neck, G.cyl(0.05, 0.06, 0.1), shade, [0, 0.02, 0]);
  part(head, G.sphere(0.115), shade, [0, 0.11, 0], [0, 0, 0], [0.95, 1.12, 1]);
  for (const s of [-1, 1]) part(head, G.sphere(0.022, 10, 8), eye, [0.045 * s, 0.14, 0.1]);
  // the grin: a jagged row of light
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.018;
    const t = part(head, G.cone(0.008, 0.028, 4), eye, [x, 0.065 + Math.abs(x) * 0.6, 0.105], [i % 2 ? 0 : Math.PI, 0, 0]);
    t.rotation.z = (i - 3) * 0.1;
  }

  // smoke tendrils: hair rising from the head, wisps trailing from the limbs
  const hair = Array.from({ length: 9 }, (_, i) => ({ r: new Rope(7, 0.07), at: joint(head, [(i - 4) * 0.03, 0.17 + (i % 2) * 0.03, -0.03 - Math.abs(i - 4) * 0.012]), dir: [(i - 4) * 0.35, 0.55, -1] as const }));
  const wisps = [
    { at: joint(b.right.shoulder, [0, -0.05, -0.05]), dir: [-0.6, 0.4, -1] as const },
    { at: joint(b.left.shoulder, [0, -0.05, -0.05]), dir: [0.6, 0.4, -1] as const },
    { at: joint(b.right.elbow, [0, -0.15, -0.04]), dir: [-0.8, -0.2, -1] as const },
    { at: joint(b.left.elbow, [0, -0.15, -0.04]), dir: [0.8, -0.2, -1] as const },
    { at: joint(b.legs[0].knee, [0, -0.1, -0.05]), dir: [-0.5, -0.3, -1] as const },
    { at: joint(b.legs[1].knee, [0, -0.1, -0.05]), dir: [0.5, -0.3, -1] as const },
  ].map((w) => ({ ...w, r: new Rope(5, 0.08) }));
  const all = [...hair, ...wisps];
  const set = new RopeSet(
    all.map((h) => h.r),
    G.cyl(0.4, 0.5, 1, 6),
    shade,
    (r, i) => (r < hair.length ? 0.045 : 0.03) * (1 - i / 7.5),
    false,
    1.2,
  );
  b.free.add(set.mesh);
  const anchor = new THREE.Vector3();
  const rest = new THREE.Vector3();
  return {
    update: (c: Ctx) => {
      b.root.updateMatrixWorld(true);
      all.forEach((h, i) => {
        h.at.getWorldPosition(anchor);
        rigDir(h.dir[0], h.dir[1], h.dir[2], c.yaw, rest);
        const isHair = i < hair.length;
        h.r.step(c.dt, anchor, rest, { gravity: isHair ? -1.2 : -1.6, damping: 0.86, stiff: isHair ? 0.06 : 0.015, wind: isHair ? 10 : 12 }, c.time + i);
      });
      set.update(rootLocal(c.x, c.airborne, c.z, c.yaw));
    },
    dispose: () => set.dispose(),
  };
}

// ── Rei, The Violet Hunger ────────────────────────────────────────────────

function dressRei(b: Body): Extras {
  const { M, pelvis, spine, chest, neck, head } = b;
  const bark = M.flesh("#16141a", 0.78);
  const ridge = M.flesh("#2a2632", 0.7);
  const thorn = M.flesh("#1e1a24", 0.5);
  const glow = M.cord("#9b5cff", 1.8);
  const crack = M.cord("#9b5cff", 0.55);
  const talon = M.lacquer("#1e1a26");

  part(pelvis, G.capsule(0.12, 0.08), bark, [0, -0.03, 0], [0, 0, Math.PI / 2], [1, 1, 0.75]);
  thorns(pelvis, thorn, 5, 0.12, -0.05, 0.02, 0.13, 0.3);
  for (const { hip, knee, ankle } of b.legs) {
    flesh(hip, bark, 0.46, 0.085, 0.05, 0.15, 0.8);
    flesh(knee, bark, 0.44, 0.06, 0.035, 0.25, 0.8);
    for (const x of [-0.03, 0.03]) part(knee, G.rbox(0.012, 0.3, 0.012), ridge, [x, -0.2, 0.045]);
    thorns(knee, thorn, 3, 0.1, -0.05, -0.2, 0.05, 1.1);
    // clawed digitigrade foot
    part(ankle, G.rbox(0.07, 0.07, 0.16, 0.45), bark, [0, -0.06, 0.05], [0.5, 0, 0]);
    talons(ankle, talon, 0.1, 0.03, [0, -0.1, 0.12], 1.75);
  }
  part(spine, G.sphere(1, 14, 10), bark, [0, 0.1, 0], [0, 0, 0], [0.1, 0.17, 0.075]);
  part(chest, G.sphere(1, 16, 12), bark, [0, 0, 0], [0, 0, 0], [0.17, 0.16, 0.11]);
  for (let i = 0; i < 6; i++) part(chest, G.rbox(0.012, 0.28, 0.012), ridge, [(i - 2.5) * 0.04, -0.03, 0.105 - Math.abs(i - 2.5) * 0.01], [0, 0, (i - 2.5) * 0.1]);
  part(chest, G.rbox(0.006, 0.18, 0.006), crack, [0.02, 0, 0.115], [0, 0, 0.3]); // violet crack
  thorns(chest, thorn, 9, 0.16, -0.05, 0.18, 0.16, 2.1);
  for (const a of b.arms) {
    part(a.shoulder, G.sphere(1, 12, 10), bark, [0.01 * a.side, 0, 0], [0, 0, 0], [0.065, 0.06, 0.06]);
    flesh(a.shoulder, bark, 0.36, 0.055, 0.042, 0.2, 0.8);
    flesh(a.elbow, bark, 0.36, 0.05, 0.036, 0.3, 0.8);
    thorns(a.shoulder, thorn, 3, 0.12, 0.0, -0.25, 0.06, a.side);
    thorns(a.elbow, thorn, 4, 0.14, -0.05, -0.3, 0.05, a.side + 1);
    part(a.wrist, G.rbox(0.08, 0.09, 0.08, 0.4), bark, [0, -0.04, 0]);
    talons(a.wrist, talon, 0.27, 0.035, [0, -0.08, 0.03], 2.7, 0.07); // long hooked claws
  }
  part(neck, G.cyl(0.04, 0.05, 0.1), bark, [0, 0.02, 0]);
  part(head, G.sphere(0.09), bark, [0, 0.1, 0], [0, 0, 0], [0.85, 1.2, 1.1]);
  part(head, G.cone(0.04, 0.16, 8), bark, [0, 0.06, 0.12], [1.9, 0, 0]); // beak
  for (const s of [-1, 1]) part(head, G.rbox(0.035, 0.012, 0.012, 0.4), glow, [0.035 * s, 0.13, 0.085], [0, 0, -0.25 * s]);
  // the crest: flame-shaped thorns swept back, on a springy mount
  const crest = joint(head, [0, 0.16, -0.02]);
  for (let i = 0; i < 9; i++) {
    const a = (i - 4) * 0.22;
    part(crest, G.cone(0.03, 0.3 + (4 - Math.abs(i - 4)) * 0.07, 6), thorn, [Math.sin(a) * 0.06, 0.06, -0.02], [-1.0 - Math.abs(a) * 0.3, 0, -a * 0.9]);
  }
  const sway = new Spring(60, 7);
  return {
    update: (c: Ctx) => {
      crest.rotation.x = sway.step(-c.drag * 0.35 - c.jolt * 0.3 + Math.sin(c.time * 2) * 0.04, c.dt);
    },
  };
}

// ── Gorvane, The Crimson Bastion ──────────────────────────────────────────

function dressGorvane(b: Body): Extras {
  const { M, pelvis, skirt, spine, chest, neck, head } = b;
  const plate = M.lacquer("#0e0e11");
  const plate2 = M.lacquer("#1a1418");
  const crimson = M.lacquer("#b0142e");
  const vein = M.cord("#e01e3c", 0.7);
  const spike = M.lacquer("#c4182e");
  const cloth = M.cloth("#9a1026");
  const slit = M.cord("#ff2a3a", 2);

  const spikes = (g: THREE.Object3D, n: number, len: number, at: [number, number, number], fan: number, tiltX = 0) => {
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * fan;
      part(g, G.cone(0.035, len * (1 - Math.abs(a) * 0.25), 8), spike, at, [tiltX, 0, a]);
    }
  };

  // tabard: torn crimson front and back to the ankles, under armored tassets
  part(pelvis, G.cyl(0.23, 0.24, 0.1), plate, [0, 0.02, 0]);
  // front and back panels, open at the sides so the legs show
  part(skirt, G.tatter(0.23, 0.33, 0.86, 0.22, 5, 1.35), cloth, [0, -0.43, 0], [0, Math.PI, 0]);
  part(skirt, G.tatter(0.23, 0.32, 0.88, 0.24, 7, 1.25), cloth, [0, -0.44, 0]);
  for (const a of [0.4, -0.4, 1.5, -1.5]) {
    const g = joint(pelvis, [Math.sin(a) * 0.23, -0.04, Math.cos(a) * 0.23]);
    g.rotation.y = a;
    for (let i = 0; i < 3; i++) part(g, G.plate(0.25 + i * 0.012, 0.27 + i * 0.012, 0.08, 0.8), i % 2 ? plate2 : plate, [0, -0.05 - i * 0.07, -0.23]);
    part(g, G.plate(0.27, 0.27, 0.008, 0.82), vein, [0, -0.2, -0.23]);
  }
  for (const { hip, knee, ankle } of b.legs) {
    part(hip, G.capsule(0.1, 0.24), plate, [0, -0.2, 0]);
    part(knee, G.sphere(0.09), plate2, [0, 0, 0.03]);
    part(knee, G.cone(0.03, 0.18, 8), spike, [0, 0.02, 0.1], [1.2, 0, 0]);
    part(knee, G.capsule(0.085, 0.26), plate, [0, -0.2, 0]);
    part(knee, G.plate(0.095, 0.09, 0.3, 2.4), plate2, [0, -0.22, 0]);
    part(knee, G.plate(0.097, 0.097, 0.01, 2.2), vein, [0, -0.36, 0]);
    for (const y of [-0.12, -0.26]) part(knee, G.cone(0.022, 0.14, 7), spike, [0, y, 0.09], [1.1, 0, 0]); // shin spikes
    part(ankle, G.rbox(0.15, 0.09, 0.27, 0.35), plate, [0, -0.04, 0.05]);
    part(ankle, G.cone(0.025, 0.09, 6), spike, [0, -0.02, 0.19], [1.5, 0, 0]);
  }
  // torso: a breastplate with a crimson scale diamond, veined in light
  // a sculpted cuirass: broad chest, plated pecs, a narrow armored waist
  part(spine, G.sphere(1, 14, 10), plate2, [0, 0.1, 0.005], [0, 0, 0], [0.18, 0.18, 0.14]);
  part(chest, G.sphere(1, 18, 12), plate, [0, 0.0, 0], [0, 0, 0], [0.27, 0.2, 0.17]);
  for (const s of [-1, 1]) part(chest, G.sphere(1, 12, 10), plate2, [0.1 * s, 0.03, 0.08], [0, 0, 0], [0.12, 0.09, 0.08]);
  for (let i = 0; i < 3; i++) part(b.spine, G.plate(0.17 - i * 0.008, 0.17 - i * 0.008, 0.05, 2.6), i % 2 ? plate : plate2, [0, 0.2 - i * 0.055, 0]);
  for (let r = 0; r < 5; r++)
    for (let cI = 0; cI <= 4 - Math.abs(r - 2) * 2; cI++) {
      const n = 4 - Math.abs(r - 2) * 2;
      part(chest, G.rbox(0.05, 0.05, 0.02, 0.3), crimson, [(cI - n / 2) * 0.045, 0.1 - r * 0.045, 0.17 - Math.abs(cI - n / 2) * 0.012], [0, 0, Math.PI / 4]);
    }
  for (const s of [-1, 1]) {
    part(chest, G.rbox(0.008, 0.3, 0.008), vein, [0.15 * s, -0.01, 0.13], [0, 0, 0.25 * s]);
    part(chest, G.rbox(0.008, 0.2, 0.008), vein, [0.2 * s, 0.06, 0.07], [0.3, 0, 0.9 * s]);
  }
  spikes(chest, 3, 0.3, [0, 0.12, -0.17], 0.45, -1.2); // back spines
  for (const a of b.arms) {
    // pauldron: stacked plates crowned with radiating spikes
    const pa = fixed(chest, [0.27 * a.side, 0.17, 0]);
    for (let i = 0; i < 3; i++) part(pa, G.rbox(0.26 - i * 0.02, 0.07, 0.28 - i * 0.02, 0.35), i % 2 ? plate2 : plate, [0.04 * a.side, -0.03 - i * 0.06, 0], [0, 0, -0.35 * a.side]);
    part(pa, G.rbox(0.25, 0.008, 0.27), vein, [0.04 * a.side, -0.065, 0], [0, 0, -0.35 * a.side]);
    spikes(pa, 4, 0.36, [0.09 * a.side, 0.04, 0], 0.32);
    part(a.shoulder, G.capsule(0.09, 0.2), plate2, [0, -0.15, 0]);
    for (let i = 0; i < 3; i++) part(a.shoulder, G.plate(0.1, 0.1, 0.07, 3.6), i % 2 ? plate : plate2, [0, -0.1 - i * 0.07, 0], [0, -a.side * 0.8, 0]); // rerebrace lames
    part(a.elbow, G.dome(0.1, 0.9), plate2, [0, 0.0, -0.02], [-Math.PI / 2, 0, 0]); // couter
    part(a.elbow, G.capsule(0.085, 0.18), plate, [0, -0.12, 0]);
    part(a.elbow, G.plate(0.098, 0.088, 0.22, 3.2), plate2, [0, -0.13, 0]); // vambrace
    for (let i = 0; i < 3; i++) part(a.elbow, G.cone(0.026, 0.2 - i * 0.03, 8), spike, [0.075 * a.side, -0.05 - i * 0.07, -0.02], [-0.5, 0, -1.1 * a.side]); // forearm spikes
    part(a.elbow, G.plate(0.095, 0.095, 0.01, 2.4), vein, [0, -0.2, 0]);
    part(a.wrist, G.rbox(0.15, 0.14, 0.15, 0.35), plate, [0, -0.06, 0.01]); // gauntlet fist
    for (let i = 0; i < 4; i++) part(a.wrist, G.cone(0.012, 0.05, 5), spike, [(i - 1.5) * 0.03, -0.06, 0.09], [Math.PI / 2, 0, 0]);
  }
  // great helm with a glowing slit and a crown of spikes
  part(neck, G.cyl(0.08, 0.1, 0.1), plate2, [0, 0.02, 0]);
  part(head, G.rbox(0.22, 0.25, 0.24, 0.35), plate, [0, 0.11, 0.01]);
  part(head, G.rbox(0.15, 0.016, 0.01), slit, [0, 0.13, 0.13]);
  part(head, G.rbox(0.008, 0.1, 0.01), vein, [0, 0.05, 0.13]);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    part(head, G.cone(0.026, 0.2 + (i % 2) * 0.1, 7), spike, [Math.sin(a) * 0.08, 0.27, Math.cos(a) * 0.08], [Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4]);
  }
  // cape panels hanging from the pauldrons
  const cape = [-0.12, 0, 0.12].map((x) => ({ g: joint(chest, [x, 0.14, -0.18]), s: new Spring(30, 5) }));
  cape.forEach(({ g }, i) => part(g, G.tatter(0.12, 0.16, 1.1, 0.22, 9 + i, 1.1), cloth, [0, -0.55, 0.12]));
  return {
    update: (c: Ctx) => {
      cape.forEach(({ g, s }, i) => {
        g.rotation.x = s.step(0.12 + c.drag * 0.45 + Math.max(0, -c.jolt) * 0.3 + Math.sin(c.time * 1.4 + i) * 0.03, c.dt);
      });
    },
  };
}

// ── Kharzul, The Hand of Thorns ───────────────────────────────────────────

function dressKharzul(b: Body): Extras {
  const { M, pelvis, skirt, spine, chest, neck, head } = b;
  const shard = M.lacquer("#5e5860");
  const shard2 = M.lacquer("#3e383e");
  const red = M.lacquer("#a8162a");
  const robe = M.cloth("#4a4448");
  const robeRed = M.cloth("#7a1424");
  const vein = M.cord("#e0203a", 0.6);
  const steel = M.metal("#7a5a5e", 0.35);
  const sickle = M.cord("#ff5a2a", 1.3);
  const eye = M.cord("#ff3030", 2.2);

  // layered tattered robe: red beneath, grey shards over it
  part(pelvis, G.cyl(0.15, 0.16, 0.08), shard2, [0, 0.02, 0]);
  part(skirt, G.tatter(0.16, 0.36, 0.92, 0.26, 11), robeRed, [0, -0.47, 0]);
  part(skirt, G.tatter(0.17, 0.33, 0.7, 0.3, 13), robe, [0, -0.36, 0]);
  for (const { hip, knee, ankle } of b.legs) {
    part(hip, G.capsule(0.06, 0.32), shard2, [0, -0.22, 0]);
    part(knee, G.capsule(0.05, 0.32), shard2, [0, -0.2, 0]);
    part(ankle, G.rbox(0.08, 0.05, 0.2, 0.4), red, [0, -0.04, 0.05]);
  }
  // shard armor: overlapping angled plates with red veins and small thorns
  part(spine, G.capsule(0.1, 0.12), shard2, [0, 0.1, 0], [0, 0, 0], [1, 1, 0.8]);
  part(chest, G.capsule(0.14, 0.12), shard2, [0, 0, 0], [0, 0, 0], [1.1, 1, 0.75]);
  // shards: curved blades layered like feathers, pointing down
  const shardsOn = (g: THREE.Object3D, rows: number, per: number, top: number, pitch: number, r: number, len: number, arc = Math.PI * 2) => {
    for (let row = 0; row < rows; row++)
      for (let i = 0; i < per; i++) {
        const a = (i / per) * arc - arc / 2 + (row % 2 ? arc / per / 2 : 0);
        const j = fixed(g, [Math.sin(a) * r, top - row * pitch, Math.cos(a) * r * 0.8]);
        j.rotation.set(Math.PI - 0.35, a, 0);
        part(j, G.shard(len * (0.8 + ((i * 7 + row) % 4) * 0.12), len * 0.45), (i + row) % 2 ? shard : shard2);
      }
  };
  shardsOn(chest, 3, 10, 0.16, 0.1, 0.15, 0.13);
  shardsOn(b.spine, 2, 9, 0.2, 0.1, 0.13, 0.12);
  for (let i = 0; i < 5; i++) part(chest, G.rbox(0.03, 0.05, 0.02, 0.3), red, [0, 0.12 - i * 0.07, -0.12]); // spine ridge
  part(chest, G.rbox(0.008, 0.3, 0.008), vein, [0, -0.02, 0.125]);
  thorns(chest, M.lacquer("#6a6468"), 10, 0.1, -0.1, 0.18, 0.16, 0.7);
  for (const a of b.arms) {
    part(a.shoulder, G.sphere(0.065), shard);
    shardsOn(a.shoulder, 3, 6, 0.02, 0.08, 0.07, 0.12);
    shardsOn(a.elbow, 2, 5, -0.02, 0.1, 0.05, 0.09);
    part(a.shoulder, G.capsule(0.045, 0.24), shard2, [0, -0.16, 0]);
    part(a.elbow, G.capsule(0.04, 0.22), shard2, [0, -0.14, 0]);
    thorns(a.elbow, M.lacquer("#6a6468"), 4, 0.08, -0.04, -0.24, 0.045, a.side * 2);
    // red skeletal hand
    part(a.wrist, G.rbox(0.06, 0.06, 0.05, 0.4), red, [0, -0.03, 0]);
    for (const i of [-1.5, -0.5, 0.5, 1.5]) part(a.wrist, G.capsule(0.008, 0.08), red, [i * 0.016, -0.1, 0.01], [0.3, 0, 0]);
  }
  // beaked red helm inside a radiating crown of spines
  part(neck, G.cyl(0.04, 0.05, 0.14), shard2, [0, 0.03, 0]);
  part(head, G.sphere(0.1), red, [0, 0.11, 0], [0, 0, 0], [0.9, 1.15, 1.2]);
  part(head, G.cone(0.05, 0.18, 10), red, [0, 0.05, 0.13], [2.1, 0, 0]); // beak
  for (const s of [-1, 1]) part(head, G.rbox(0.03, 0.01, 0.01, 0.4), eye, [0.035 * s, 0.13, 0.105]);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    part(head, G.cone(0.012, 0.32 + (i % 2) * 0.12, 6), red, [Math.sin(a) * 0.05, 0.12 + Math.cos(a) * 0.05, -0.02], [0, 0, -a]).rotation.x = -0.15; // sunburst in the face's plane
  }

  // four thorn chains, two from each hand, ending in glowing sickles
  const chains = b.arms.flatMap((a) =>
    [-1, 1].map((k) => ({ r: new Rope(12, 0.085), at: joint(a.hand, [k * 0.02, -0.03, 0.02]) })),
  );
  const links = new RopeSet(
    chains.map((c) => c.r),
    new THREE.TorusGeometry(0.5, 0.16, 4, 8),
    steel,
    () => 0.04,
    true,
    1.5,
  );
  const barbs = new RopeSet(
    chains.map((c) => c.r),
    G.cone(0.5, 1, 4),
    M.lacquer("#8a1a24"),
    () => 0.014,
    false,
    0.45,
  );
  b.free.add(links.mesh, barbs.mesh);
  const sickles = chains.map(() => {
    const g = joint(b.free);
    // a hooked talon and a smaller barb, curving back along the chain
    part(g, G.blade(0.36, 0.085, 0.3), sickle, [0, -0.02, 0], [0, 0, 0]).castShadow = true;
    part(g, G.blade(0.2, 0.06, 0.18), sickle, [0, 0.04, 0], [0, Math.PI, 0.4]).castShadow = true;
    return g;
  });
  const anchor = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3();
  const bb = new THREE.Vector3();
  let lastStrike = 0;
  return {
    update: (c: Ctx) => {
      b.root.updateMatrixWorld(true);
      // A strike throws the chains forward: their momentum carries the sickles out.
      const d = Math.max(0, c.strike - lastStrike);
      lastStrike = c.strike;
      rigDir(0, 0.25, 1, c.yaw, fwd);
      chains.forEach((ch) => {
        if (d > 0) ch.r.impulse(fwd.clone().multiplyScalar(d * 260), c.dt);
        ch.at.getWorldPosition(anchor);
        ch.r.step(c.dt, anchor, WORLD_DOWN, { gravity: 9.8, damping: 0.97, stiff: 0 }, c.time);
      });
      const local = rootLocal(c.x, c.airborne, c.z, c.yaw);
      links.update(local);
      barbs.update(local);
      chains.forEach((ch, i) => {
        const n = ch.r.n;
        local(ch.r.p[n - 2], a);
        local(ch.r.p[n - 1], bb);
        sickles[i].position.copy(bb);
        sickles[i].quaternion.setFromUnitVectors(up, bb.sub(a).normalize());
      });
    },
    dispose: () => {
      links.dispose();
      barbs.dispose();
    },
  };
}
