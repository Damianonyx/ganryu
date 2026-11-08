import * as THREE from "three";
import type { Rig } from "./mesh";
import { motion } from "./motion";
import { bake, clamp01, contactShadow, disposeBaked, ease, joint, legIK, lerp, materials, span, type MatSet } from "./rig-kit";
import type { AnimName, CharacterDef } from "./types";

/**
 * The shared two-legged body: skeleton, distance-driven gait with world-pinned
 * feet and leg IK, fighting stances, action choreography, and pose blending
 * hooks. Each character family supplies proportions, a temperament (posture
 * and gait character), a fighting stance, and a `dress` function that adds
 * the geometry and any extra motion (springs, ropes, wings).
 *
 * Space: the rig faces +Z with +Y up, so the character's right side is -X.
 * The body is turned to face the direction the game moves it.
 */

export const R = -1; // the character's right side is -X

export type Stance = "sword" | "claws" | "fists" | "chains";

export type Proportions = {
  hipY: number; // hip joints above the ground at rest
  thigh: number;
  shin: number;
  ankleH: number; // ankle above the sole (digitigrade feet ride high)
  hipW: number;
  spineY: number; // spine base above the hips
  chestY: number; // chest above the spine base
  shoulderW: number;
  shoulderY: number;
  upperArm: number;
  foreArm: number;
  neckY: number;
  headY: number;
};

export const HUMAN: Proportions = {
  hipY: 0.93,
  thigh: 0.44,
  shin: 0.42,
  ankleH: 0.065,
  hipW: 0.11,
  spineY: 0.08,
  chestY: 0.3,
  shoulderW: 0.225,
  shoulderY: 0.12,
  upperArm: 0.29,
  foreArm: 0.26,
  neckY: 0.2,
  headY: 0.07,
};

/** How a body carries itself and moves. 1 is the samurai baseline. */
export type Temper = {
  hunch: number; // extra forward lean, radians
  crouch: number; // extra hip drop in stance, meters
  stride: number; // stride multiplier
  lift: number; // foot-lift multiplier
  bob: number; // vertical bob multiplier
  feetW: number; // stance width multiplier
  heavy: number; // 0 nimble → 1 ponderous (longer settle, deeper footfalls)
  breath: number; // breathing amplitude multiplier
};

export const SAMURAI: Temper = { hunch: 0, crouch: 0, stride: 1, lift: 1, bob: 1, feetW: 1, heavy: 0, breath: 1 };

export type Leg = { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group; side: number };
export type Arm = { shoulder: THREE.Group; elbow: THREE.Group; wrist: THREE.Group; hand: THREE.Group; side: number };

export type Body = {
  def: CharacterDef;
  M: MatSet;
  prop: Proportions;
  root: THREE.Group;
  body: THREE.Group;
  pelvis: THREE.Group;
  skirt: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  legs: Leg[]; // [right, left]
  arms: Arm[]; // [right, left]
  right: Arm;
  left: Arm;
  weapon: THREE.Group;
  /** Objects outside the merged body (ropes, effects) live here, in the root's frame. */
  free: THREE.Group;
};

/** What extra motion sees each frame. */
export type Ctx = {
  dt: number;
  time: number;
  name: AnimName;
  t: number;
  run: number;
  speed: number;
  /** speed as 0–1 of a full run */
  drag: number;
  /** signed forward acceleration, roughly -1…1 */
  jolt: number;
  lean: number;
  twist: number;
  airborne: number;
  phase: number;
  /** strike progress for the current action: 0 before, 1 at the end of the strike */
  strike: number;
  x: number;
  z: number;
  yaw: number;
};

export type Extras = { update?: (c: Ctx, b: Body) => void; dispose?: () => void };

export type HumanoidSpec = {
  prop: Proportions;
  temper: Temper;
  stance: Stance;
  dress: (b: Body) => Extras;
};

export type ArmPose = { x: number; y: number; z: number; elbow: number; wx: number };

/**
 * Acting for the 3D film (src/film3d): poses a director sets on top of the
 * procedural motion. The game never sets one. Angles are radians, lengths are
 * meters; feet are targets in the body's frame (x toward its left, z forward).
 */
export type Direction = {
  /** 0–1: arms hang and swing with the walk instead of holding the fighting stance */
  relax?: number;
  ra?: Partial<ArmPose>;
  la?: Partial<ArmPose>;
  lean?: number;
  twist?: number;
  tilt?: number;
  headPitch?: number;
  headYaw?: number;
  /** extra hip drop; the legs bend to keep the feet on their targets */
  drop?: number;
  hipZ?: number;
  feet?: (Partial<{ x: number; y: number; z: number }> | null)[];
  /** whole-body pitch (forward fall) and roll */
  pitch?: number;
  roll?: number;
  /** hands reaching world-space points (arm IK), blended in by `w` (default 1) */
  reach?: { r?: [number, number, number] | null; l?: [number, number, number] | null; w?: number };
};

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _e = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _fk = new THREE.Quaternion();

/** Two-bone arm IK: turn the shoulder and bend the elbow so the hand reaches a world point. */
function reachArm(a: Arm, P: Proportions, target: [number, number, number], w: number) {
  const parent = a.shoulder.parent!;
  parent.updateWorldMatrix(true, false);
  _v.set(...target);
  parent.worldToLocal(_v).sub(a.shoulder.position);
  const l1 = P.upperArm;
  const l2 = P.foreArm + 0.06;
  const D = Math.min(Math.max(_v.length(), Math.abs(l1 - l2) + 0.01), (l1 + l2) * 0.999);
  const bend = Math.PI - Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + l2 * l2 - D * D) / (2 * l1 * l2))));
  // the hand's position with the elbow bent, before the shoulder turns
  _w.set(0, -l1 - l2 * Math.cos(bend), l2 * Math.sin(bend)).normalize();
  _v.normalize();
  _q.setFromUnitVectors(_w, _v);
  // swivel about the reach so the elbow points down and out
  _e.set(0, -1, 0).applyQuaternion(_q);
  _p.set(0.45 * a.side, -1, -0.25).normalize();
  const proj = (u: THREE.Vector3) => u.sub(_v.clone().multiplyScalar(u.dot(_v)));
  proj(_e);
  proj(_p);
  // reaching straight along the pole leaves no swivel to choose
  if (_e.lengthSq() > 1e-8 && _p.lengthSq() > 1e-8) {
    _e.normalize();
    _p.normalize();
    const ang = Math.atan2(_v.dot(_e.clone().cross(_p)), _e.dot(_p));
    _q2.setFromAxisAngle(_v, ang);
    _q.premultiply(_q2);
  }
  if (!Number.isFinite(_q.x + _q.y + _q.z + _q.w)) return;
  _fk.copy(a.shoulder.quaternion);
  a.shoulder.quaternion.copy(_fk).slerp(_q, w);
  a.elbow.rotation.x = lerp(a.elbow.rotation.x, -bend, w);
}

/** Stance arm poses. z > 0 spreads an arm outward; wx tilts the hand. */
const STANCE: Record<Stance, { ra: ArmPose; la: ArmPose; twist: number; runR: ArmPose; runL?: ArmPose }> = {
  // kamae: the blade forward at chest height in both hands
  sword: {
    ra: { x: -0.95, y: 0.15, z: -0.25, elbow: -0.9, wx: 1.4 },
    la: { x: -1.0, y: -0.2, z: -0.42, elbow: -1.1, wx: 0.2 },
    twist: 0.18,
    runR: { x: -0.2, y: 0.15, z: 0.2, elbow: -0.5, wx: 1.2 },
  },
  // claws raised and spread, ready to rake
  claws: {
    ra: { x: -0.75, y: 0.1, z: 0.38, elbow: -1.15, wx: 0.45 },
    la: { x: -0.55, y: 0.1, z: 0.42, elbow: -1.25, wx: 0.45 },
    twist: 0.1,
    runR: { x: 0.35, y: 0, z: 0.3, elbow: -0.7, wx: 0.3 },
    runL: { x: 0.35, y: 0, z: 0.3, elbow: -0.7, wx: 0.3 },
  },
  // a boxer's guard: fists up before the chest
  fists: {
    ra: { x: -1.25, y: 0.1, z: -0.05, elbow: -1.85, wx: 0.1 },
    la: { x: -1.45, y: 0.1, z: -0.1, elbow: -1.75, wx: 0.1 },
    twist: 0.22,
    runR: { x: -0.4, y: 0, z: 0.1, elbow: -1.4, wx: 0.1 },
    runL: { x: -0.4, y: 0, z: 0.1, elbow: -1.4, wx: 0.1 },
  },
  // hands low and open, letting the chains hang
  chains: {
    ra: { x: -0.4, y: 0, z: 0.32, elbow: -0.55, wx: 0.3 },
    la: { x: -0.4, y: 0, z: 0.32, elbow: -0.55, wx: 0.3 },
    twist: 0.05,
    runR: { x: 0.25, y: 0, z: 0.35, elbow: -0.4, wx: 0.2 },
    runL: { x: 0.25, y: 0, z: 0.35, elbow: -0.4, wx: 0.2 },
  },
};

const mix = (p: ArmPose, q: Partial<ArmPose>, u: number) => {
  for (const k of Object.keys(q) as (keyof ArmPose)[]) p[k] = lerp(p[k], q[k]!, u);
};

export function buildHumanoid(def: CharacterDef, spec: HumanoidSpec): Rig {
  const k = def.kit;
  const P = spec.prop;
  const T = spec.temper;
  const M = materials();

  const root = new THREE.Group();
  const turn = joint(root);
  turn.rotation.y = Math.PI; // the rig's +Z toward the game's forward
  const body = joint(turn);
  body.scale.setScalar(k.scale);
  const free = joint(root);
  const shadow = contactShadow(0.55 * k.scale * (1 + T.heavy * 0.3));
  root.add(shadow);

  const pelvis = joint(body, [0, P.hipY + 0.02, 0]);
  const skirt = joint(pelvis, [0, -0.02, 0]);
  const legs: Leg[] = ([R, -R] as const).map((side) => {
    const hip = joint(pelvis, [P.hipW * side, -0.02, 0]);
    hip.rotation.order = "ZXY"; // pitch and bend in the leg's plane, then roll that plane sideways
    const knee = joint(hip, [0, -P.thigh, 0]);
    const ankle = joint(knee, [0, -P.shin, 0]);
    ankle.rotation.order = "ZXY";
    return { hip, knee, ankle, side };
  });
  const spine = joint(body, [0, P.hipY + P.spineY, 0]);
  const chest = joint(spine, [0, P.chestY, 0]);
  const arms: Arm[] = ([R, -R] as const).map((side) => {
    const shoulder = joint(chest, [P.shoulderW * side, P.shoulderY, 0]);
    const elbow = joint(shoulder, [0, -P.upperArm, 0]);
    const wrist = joint(elbow, [0, -P.foreArm, 0]);
    const hand = joint(wrist, [0, -0.05, 0.01]);
    return { shoulder, elbow, wrist, hand, side };
  });
  const neck = joint(chest, [0, P.neckY, 0]);
  const head = joint(neck, [0, P.headY, 0]);
  const weapon = joint(arms[0].hand);

  const b: Body = { def, M, prop: P, root, body, pelvis, skirt, spine, chest, neck, head, legs, arms, right: arms[0], left: arms[1], weapon, free };
  const extras = spec.dress(b);
  bake(body, M);

  // ── Motion ──────────────────────────────────────────────────────────────
  const st = { dt: 1 / 60, x: 0, z: 0, yaw: 0, spd: 0, fwd: 0, acc: 0, airborne: 0, phase: 0, run: 0, prev: "idle" as AnimName, land: 0, time: 0 };
  const plant = [0, 1].map(() => ({ down: false, wx: 0, wz: 0, fromX: 0, fromZ: 0 }));
  const fw = 0.13 * T.feetW;
  const lastFeet = [
    { x: fw * R, z: 0.15 },
    { x: -fw * R, z: -0.13 },
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
    // Keep the root's transform current so extras can read world positions this frame.
    root.position.set(x, y, z);
    root.rotation.y = yaw;
    shadow.position.y = -y + 0.012;
    const s = 1 / (1 + y * 0.7);
    shadow.scale.setScalar(s);
    (shadow.material as THREE.MeshBasicMaterial).opacity = 0.6 * s * s;
  };

  const base = STANCE[spec.stance];
  const beast = k.body === "beast";
  let direction: Direction | null = null;

  const setAnim: Rig["setAnim"] = (name, t) => {
    const dt = st.dt;
    const g = motion.gait;
    const speed = st.spd;
    const target = name === "walk" || name === "idle" ? clamp01(speed / 3.2) : name === "leap" ? st.run : 0;
    st.run = lerp(st.run, target, 1 - Math.exp(-10 * dt));
    const run = st.run;
    if (st.prev === "leap" && name !== "leap") st.land = g.landTime * (1 + T.heavy * 0.5);
    st.prev = name;
    st.land = Math.max(0, st.land - dt);

    const stride = lerp(g.strideWalk, g.strideRun, run) * T.stride;
    const duty = lerp(g.dutyWalk, g.dutyRun, run);
    if (name === "walk" || name === "idle") st.phase = (st.phase + (speed * dt) / stride) % 1;

    // ---- stance, blended toward the run ----
    const breath = Math.sin(st.time * (2.2 - T.heavy * 0.8)) * 0.008 * T.breath;
    let hipDrop = lerp(0.05, 0.06, run) + T.crouch + breath;
    let hipZ = 0;
    let lean = lerp(0.04, 0.22, run) + T.hunch;
    let twist = lerp(base.twist, 0, run);
    let tilt = 0;
    let headPitch = -lean * 0.6;
    let strike = 0;
    const feet = [
      { x: fw * R, z: 0.15, y: 0 },
      { x: -fw * R, z: -0.13, y: 0 },
    ];
    const ra = { ...base.ra };
    const la = { ...base.la };

    // ---- gait: each foot pinned to the ground while down, arcing to its next spot in swing ----
    const gaitOn = run > 0.01 && name !== "leap" && st.airborne <= 0.001;
    if (gaitOn) {
      const L = duty * stride;
      feet.forEach((f, i) => {
        const s = (st.phase + (i === 0 ? 0 : 0.5)) % 1;
        const side = (i === 0 ? fw * 0.77 : -fw * 0.77) * R;
        const pl = plant[i];
        let x: number;
        let z: number;
        let y = 0;
        if (s < duty) {
          if (!pl.down) {
            const w = toWorld(lastFeet[i].x, lastFeet[i].z);
            pl.down = true;
            pl.wx = w.x;
            pl.wz = w.z;
          }
          let p = toRig(pl.wx, pl.wz);
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
          y = Math.sin(u * Math.PI) * g.lift * T.lift * run;
        }
        f.x = lerp(f.x, x, run);
        f.z = lerp(f.z, z, run);
        f.y = lerp(f.y, y, run);
      });
      const bob = Math.cos((st.phase - duty / 2) * Math.PI * 4);
      hipDrop += -bob * 0.03 * T.bob * run;
      twist += Math.sin(st.phase * Math.PI * 2) * 0.14 * run;
      tilt += Math.sin(st.phase * Math.PI * 2) * 0.05 * T.heavy * run; // heavy bodies roll side to side
      const swing = Math.sin(st.phase * Math.PI * 2) * run;
      mix(ra, base.runR, run);
      ra.x += swing * 0.25 * run;
      if (base.runL) {
        mix(la, base.runL, run);
        la.x -= swing * 0.6 * run;
        ra.x += swing * 0.35 * run;
      } else mix(la, { x: swing * 0.9, z: -0.12, elbow: -0.9 }, run);
    }
    if (!gaitOn) for (const pl of plant) pl.down = false;

    // ---- actions ----
    if (name === "slash") {
      const s = choreograph(spec.stance, beast, t, ra, la);
      strike = s.strike;
      twist = s.twist(twist);
      tilt = s.tilt;
      lean = s.lean(lean);
      hipDrop += s.drop;
      hipZ = s.hipZ;
      feet[0].z = lerp(feet[0].z, 0.3, s.step);
    }
    if (name === "parry") {
      const u = ease.out(span(t, 0, 0.06));
      if (spec.stance === "sword") {
        mix(ra, { x: -1.7, y: -0.5, z: -0.1, elbow: -0.6, wx: 1.25 }, u);
        mix(la, { x: -2.0, z: -0.5, elbow: -1.2 }, u);
      } else if (spec.stance === "fists") {
        mix(ra, { x: -1.65, z: -0.2, elbow: -2.1, wx: 0 }, u);
        mix(la, { x: -1.65, z: -0.2, elbow: -2.1, wx: 0 }, u);
      } else {
        // claws and chains: arms crossed before the face
        mix(ra, { x: -1.55, z: -0.55, elbow: -1.35 }, u);
        mix(la, { x: -1.4, z: -0.6, elbow: -1.45 }, u);
      }
      lean = lerp(lean, -0.08 + T.hunch * 0.5, u);
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
      mix(ra, { x: -0.4, z: 0.6 }, u);
      mix(la, { x: -0.6, z: 0.6 }, u);
      feet[1].z = lerp(feet[1].z, -0.26, u);
    }
    if (name === "special" || name === "fold") {
      const gather = ease.out(span(t, 0, 0.14));
      const burst = ease.out(span(t, 0.14, 0.3));
      if (name === "special") {
        strike = burst;
        hipDrop += 0.12 * gather - 0.08 * burst;
        lean = lerp(lerp(lean, 0.35, gather), 0.15 + T.hunch, burst);
        mix(ra, { x: -0.3, z: 0.1, elbow: -1.5 }, gather);
        mix(ra, { x: -1.6, elbow: -0.1, wx: spec.stance === "sword" ? 1.6 : 0.2 }, burst);
        mix(la, { x: -0.4 }, gather);
        mix(la, spec.stance === "sword" ? { x: 0.4, z: 0.5 } : { x: -1.5, z: 0.1, elbow: -0.2 }, burst);
        twist = lerp(lerp(twist, -0.4, gather), 0.3, burst);
        hipZ = 0.12 * burst;
        feet[0].z = lerp(feet[0].z, 0.34, burst);
      } else {
        // Fold: hands meet before the chest
        mix(ra, { x: -1.2, z: -0.35, elbow: -1.7 }, gather);
        mix(la, { x: -1.2, z: -0.35, elbow: -1.7 }, gather);
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
      mix(ra, spec.stance === "sword" ? { x: -2.4, elbow: -0.9 } : { x: -2.0, z: 0.6, elbow: -0.6 }, u);
      mix(la, spec.stance === "sword" ? { x: -1.2 } : { x: -2.0, z: 0.6, elbow: -0.6 }, u);
      lean = lerp(lean, 0.25, u);
      hipDrop = lerp(hipDrop, 0.02, u);
    }
    if (st.land > 0) {
      const u = st.land / (g.landTime * (1 + T.heavy * 0.5));
      hipDrop += Math.sin(u * Math.PI) * g.landDip * (1 + T.heavy * 0.6);
      lean += Math.sin(u * Math.PI) * 0.12;
    }

    // ---- film direction ----
    const d = direction;
    let headYaw = 0;
    if (d) {
      if (d.relax) {
        // arms hang; each swings forward with the opposite foot
        let fR = 0;
        if (gaitOn) {
          const s0 = st.phase % 1;
          fR = (s0 < duty ? Math.cos((Math.PI * s0) / duty) : -Math.cos((Math.PI * (s0 - duty)) / (1 - duty))) * run;
        }
        mix(ra, { x: 0.05 + fR * 0.42, y: 0, z: 0.12, elbow: -0.18 - run * 0.55, wx: 0.1 }, d.relax);
        mix(la, { x: 0.05 - fR * 0.42, y: 0, z: 0.12, elbow: -0.18 - run * 0.55, wx: 0.1 }, d.relax);
        twist = lerp(twist, -fR * 0.12, d.relax);
      }
      if (d.ra) mix(ra, d.ra, 1);
      if (d.la) mix(la, d.la, 1);
      if (d.lean !== undefined) lean = d.lean;
      if (d.twist !== undefined) twist = d.twist;
      if (d.tilt !== undefined) tilt = d.tilt;
      if (d.headPitch !== undefined) headPitch = d.headPitch;
      headYaw = d.headYaw ?? 0;
      hipDrop += d.drop ?? 0;
      if (d.hipZ !== undefined) hipZ = d.hipZ;
      d.feet?.forEach((f, i) => {
        if (!f || !feet[i]) return;
        if (f.x !== undefined) feet[i].x = f.x;
        if (f.y !== undefined) feet[i].y = f.y;
        if (f.z !== undefined) feet[i].z = f.z;
      });
    }

    // ---- apply ----
    body.position.set(0, -hipDrop, hipZ);
    body.rotation.set(d?.pitch ?? 0, 0, d?.roll ?? 0);
    pelvis.rotation.set(0, twist * 0.3, tilt * 0.5);
    spine.rotation.set(lean * 0.6, twist * 0.45, tilt);
    chest.rotation.set(lean * 0.4, twist * 0.25, tilt * 0.4);
    neck.rotation.set(headPitch * 0.5, -twist * 0.7 + headYaw * 0.6, -tilt * 0.6);
    head.rotation.set(headPitch * 0.5, -twist * 0.3 + headYaw * 0.4, 0);

    legs.forEach((leg, i) => {
      const f = feet[i];
      lastFeet[i].x = f.x;
      lastFeet[i].z = f.z;
      const dy = (f.y + hipDrop) / k.scale + P.ankleH - P.hipY;
      const dz = (f.z - hipZ) / k.scale;
      const dx = f.x / k.scale - P.hipW * leg.side;
      const roll = Math.atan2(dx, -dy);
      const { thigh, shin } = legIK(-Math.hypot(dy, dx), dz, P.thigh, P.shin);
      leg.hip.rotation.set(thigh, -twist * 0.3, roll);
      leg.knee.rotation.set(shin, 0, 0);
      const swingRoll = f.y > 0.01 ? -0.4 * Math.sin(clamp01(f.y / Math.max(0.01, g.lift)) * Math.PI) : 0;
      leg.ankle.rotation.set(-(thigh + shin) + swingRoll, 0, -roll);
    });

    const arm = (a: Arm, p: ArmPose) => {
      a.shoulder.rotation.set(p.x, p.y * a.side * R, p.z * a.side);
      a.elbow.rotation.set(p.elbow, 0, 0);
      a.wrist.rotation.set(p.wx, 0, 0);
    };
    arm(b.right, ra);
    arm(b.left, la);
    if (d?.reach) {
      const rw = d.reach.w ?? 1;
      if (rw > 0.001) {
        if (d.reach.r) reachArm(b.right, P, d.reach.r, rw);
        if (d.reach.l) reachArm(b.left, P, d.reach.l, rw);
      }
    }

    if (name === "die") {
      const u = ease.out(clamp01(t / (0.7 + T.heavy * 0.3)));
      body.position.y = -hipDrop - 0.35 * ease.inOut(clamp01(t / 0.35));
      body.rotation.x = u * 1.4;
      shadow.scale.setScalar(1.2);
    }

    extras.update?.(
      {
        dt,
        time: st.time,
        name,
        t,
        run,
        speed,
        drag: clamp01(speed / 4.2),
        jolt: clamp01(Math.abs(st.acc) / 30) * Math.sign(st.acc),
        lean,
        twist,
        airborne: st.airborne,
        phase: st.phase,
        strike,
        x: st.x,
        z: st.z,
        yaw: st.yaw,
      },
      b,
    );
  };

  const rig = finishRig(root, body, head, chest, b.left.shoulder, b.right.shoulder, legs[1].hip, legs[0].hip, weapon, M.all, setAnim);
  rig.drive = drive;
  rig.direct = (d) => {
    direction = d;
  };
  const baseDispose = rig.dispose;
  rig.dispose = () => {
    baseDispose();
    extras.dispose?.();
    disposeBaked(body);
    shadow.geometry.dispose();
    (shadow.material as THREE.Material).dispose();
  };
  return rig;
}

/**
 * The attack for each stance: anticipation, a fast strike, follow-through.
 * Times line up with the game's hit windows (fighter.ts slashActive): blades
 * hit 0.10–0.26 s; beasts hit twice, 0.09–0.18 s and 0.24–0.36 s.
 */
function choreograph(stance: Stance, beast: boolean, t: number, ra: ArmPose, la: ArmPose) {
  const out = { strike: 0, tilt: 0, drop: 0, hipZ: 0, step: 0, twist: (x: number) => x, lean: (x: number) => x };
  if (stance === "sword") {
    const a = ease.out(span(t, 0, 0.08));
    const c = ease.inOut(span(t, 0.08, 0.2));
    const f = ease.back(span(t, 0.2, 0.34), 1.1);
    mix(ra, { x: -2.75, y: 0.3, z: 0.55, elbow: -1.35, wx: 1.5 }, a);
    mix(ra, { x: -0.45, y: -0.25, z: -0.2, elbow: -0.25, wx: 1.2 }, c);
    mix(ra, { x: -0.6 }, f);
    mix(la, { x: -2.3, z: -0.35, elbow: -1.6 }, a);
    mix(la, { x: -0.5, z: -0.25, elbow: -0.4 }, c);
    out.strike = c;
    out.twist = (x) => lerp(lerp(x, -0.5, a), 0.55, c);
    out.tilt = lerp(lerp(0, 0.08, a), -0.1, c);
    out.lean = (x) => lerp(lerp(x, x - 0.09, a), x + 0.2, c);
    out.drop = lerp(0, 0.07, c) - 0.02 * f;
    out.hipZ = lerp(-0.03 * a, 0.11, c);
    out.step = c;
    return out;
  }
  if (stance === "claws" && beast) {
    // two rakes: right, then left
    const a1 = ease.out(span(t, 0, 0.06));
    const c1 = ease.inOut(span(t, 0.06, 0.17));
    const a2 = ease.out(span(t, 0.17, 0.23));
    const c2 = ease.inOut(span(t, 0.23, 0.35));
    mix(ra, { x: -1.9, z: 0.9, elbow: -0.5, wx: 0.2 }, a1);
    mix(ra, { x: -1.1, z: -0.55, elbow: -0.35, wx: 0.6 }, c1);
    mix(ra, { x: -0.6, z: 0.2, elbow: -1.0 }, c2);
    mix(la, { x: -1.9, z: 0.9, elbow: -0.5, wx: 0.2 }, a2);
    mix(la, { x: -1.1, z: -0.55, elbow: -0.35, wx: 0.6 }, c2);
    out.strike = Math.max(c1, c2);
    out.twist = (x) => lerp(lerp(lerp(x, -0.45, a1), 0.5, c1), -0.5, c2);
    out.lean = (x) => x + 0.18 * Math.max(c1, c2);
    out.drop = 0.06 * Math.max(c1, c2);
    out.hipZ = 0.1 * c1 + 0.06 * c2;
    out.step = c1;
    return out;
  }
  if (stance === "claws") {
    // one wide rake, right to left
    const a = ease.out(span(t, 0, 0.09));
    const c = ease.inOut(span(t, 0.09, 0.22));
    const f = ease.back(span(t, 0.22, 0.34), 1.2);
    mix(ra, { x: -1.4, z: 1.15, elbow: -0.35, wx: 0.1 }, a);
    mix(ra, { x: -1.2, z: -0.7, elbow: -0.25, wx: 0.6 }, c);
    mix(ra, { x: -0.8, z: -0.4, elbow: -0.8 }, f);
    mix(la, { x: -0.3, z: 0.6, elbow: -1.0 }, a);
    out.strike = c;
    out.twist = (x) => lerp(lerp(x, -0.55, a), 0.65, c);
    out.tilt = lerp(lerp(0, -0.08, a), 0.1, c);
    out.lean = (x) => x + 0.16 * c;
    out.drop = 0.05 * c;
    out.hipZ = lerp(-0.04 * a, 0.12, c);
    out.step = c;
    return out;
  }
  if (stance === "fists") {
    // an overhead hammer blow
    const a = ease.out(span(t, 0, 0.1));
    const c = ease.in(span(t, 0.1, 0.2));
    const f = ease.out(span(t, 0.2, 0.34));
    mix(ra, { x: -2.7, z: 0.35, elbow: -1.6, wx: 0 }, a);
    mix(ra, { x: -0.9, z: -0.15, elbow: -0.25, wx: 0.3 }, c);
    mix(la, { x: -0.6, z: 0.4, elbow: -1.2 }, a);
    out.strike = c;
    out.twist = (x) => lerp(lerp(x, -0.45, a), 0.4, c);
    out.lean = (x) => lerp(lerp(x, x - 0.12, a), x + 0.32, c);
    out.drop = lerp(-0.02 * a, 0.12, c) - 0.03 * f;
    out.hipZ = lerp(-0.04 * a, 0.12, c);
    out.step = c;
    return out;
  }
  // chains: both arms whip overhead and forward; the ropes carry the motion on
  const a = ease.out(span(t, 0, 0.1));
  const c = ease.inOut(span(t, 0.1, 0.2));
  const f = ease.out(span(t, 0.2, 0.34));
  mix(ra, { x: -2.6, z: 0.5, elbow: -0.5, wx: 0 }, a);
  mix(ra, { x: -1.3, z: 0.15, elbow: -0.1, wx: 0.3 }, c);
  mix(ra, { x: -0.7, elbow: -0.4 }, f);
  mix(la, { x: -2.4, z: 0.55, elbow: -0.5, wx: 0 }, a);
  mix(la, { x: -1.2, z: 0.2, elbow: -0.1, wx: 0.3 }, c);
  mix(la, { x: -0.7, elbow: -0.4 }, f);
  out.strike = c;
  out.lean = (x) => lerp(lerp(x, x - 0.15, a), x + 0.2, c);
  out.drop = 0.04 * c;
  out.hipZ = 0.06 * c;
  out.step = c * 0.5;
  return out;
}

/** Flash, Fold tint, and dispose for a set of materials. */
export function finishRig(
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
