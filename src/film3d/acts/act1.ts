import * as THREE from "three";
import { camera, face, keys, route, walk } from "../direct";
import type { Pose, Shot } from "../lab";
import { PEOPLE } from "../people";
import { V, crows, fence, grass, ground, house, lerp, mist, span, stoneLantern, tree, trees } from "../sets";
import { lightVillage, village } from "../village";

/**
 * Act 1, before the fire (0–9 s):
 *   1a  evening over the mountain village; lanterns glow outside the homes
 *   1b  the boy swings a wooden sword and overbalances; his father catches him and sets his feet
 *   1c  his mother calls from the doorway; the boy runs to her
 */

/** The family's yard at dusk: the house, its fence and trees, the valley behind. Used by 1b, 1c, 2a. */
export function yard(s: Parameters<Shot["build"]>[0], o: { glow?: number; clear?: [number, number, number] } = {}) {
  lightVillage(s, "dusk", { shadowCenter: V(0, 0, -2), shadowSize: 26, exposure: 1.0 });
  ground(s, "#3a3226", 120, 7, { grass: "#3e4628", roadColor: "#5e4e3a", path: (x, z) => (Math.hypot(x * 0.8, z - 0.5) < 4.2 ? 1 : 0), res: 140 });
  const home = house(s, 0, -6, 0, { w: 7.2, d: 5, glow: o.glow ?? 1.2, seed: 99 });
  fence(s, [-6.5, 3.5], [-6.5, -9]);
  fence(s, [6.5, -9], [6.5, 3.5]);
  stoneLantern(s, -3.6, -2.6, 1);
  const ticks = [
    trees(s, "cedar", 70, (r) => {
      const x = (r() - 0.5) * 70;
      const z = -40 + r() * (o.clear ? 44 : 30);
      if (o.clear && Math.hypot(x - o.clear[0], z - o.clear[1]) < o.clear[2]) return null;
      return Math.abs(x) < 6 && z > -14 ? null : [x, z];
    }, { seed: 41, scale: [0.9, 1.3] }),
    trees(s, "pine", 4, (r) => [(r() < 0.5 ? -1 : 1) * (5 + r() * 2), -10 + r() * 3], { seed: 42, scale: [0.9, 1.1] }),
    grass(s, 1800, (r) => {
      const x = (r() - 0.5) * 16;
      const z = -4 + r() * 12;
      return Math.hypot(x * 0.8, z - 0.5) < 3.6 ? null : [x, z];
    }, "#5a643c", 23, 0.3),
  ];
  tree(s, "maple", 4.6, -2.2, { seed: 8, scale: 0.85, leaf: "#6a6a2a" });
  const drift = mist(s, 10, [-30, 30, -40, -20], 0xb0909a, 0.12, 72, 1.0, 2);
  // the glow of another lantern behind the camera lights faces
  const fill = new THREE.PointLight(0xffa868, 3.5, 12, 1.6);
  fill.position.set(-1.2, 2.2, 4.2);
  s.add(fill);
  return { home, tick: (dt: number) => (ticks.forEach((k) => k(dt)), drift(dt)) };
}

export const ACT1: Shot[] = [
  {
    id: "1a",
    title: "Evening over the mountain village; lanterns glow outside the homes",
    dur: 3.4,
    build: (s) => {
      lightVillage(s, "dusk", { shadowCenter: V(0, 0, -6), shadowSize: 70, exposure: 1.35 });
      const v = village(s);
      crows(s, 5, V(-26, 22, -24), V(4.5, 0.4, 2.2));
      // villagers on their way home
      s.person(PEOPLE.villager(0), walk([1.0, 6], [0.6, -1.5], 0, 3.4));
      s.person(PEOPLE.villager(1), walk([-0.8, -9], [-1.2, -15.5], 0, 3.4));
      s.person(PEOPLE.villager(2), walk([4.2, -6.6], [5.8, -6.4], 0.6, 3.4));
      s.person(PEOPLE.villager(3), () => ({ x: -4.6, z: 8.2, yaw: face(1, 0) }));
      return {
        update: ({ stage, t, dt }) => {
          v.tick(dt);
          camera(stage, t, [
            [0, { pos: [17, 12.8, 27.5], look: [-4, 5.2, -20], fov: 40 }],
            [3.4, { pos: [14.6, 9.6, 23.6], look: [-4, 4.4, -20], fov: 38 }],
          ], { hand: 0.03, ease: (u) => u });
        },
      };
    },
  },
  {
    id: "1b",
    title: "The boy swings a wooden sword and overbalances; his father catches him and sets his feet",
    dur: 3.4,
    build: (s) => {
      const y = yard(s);
      // The boy faces west (screen left); his father stands behind him.
      const W = face(-1, 0);
      const boy = s.person(PEOPLE.boy(), (t): Pose => {
        const k = keys(t, [
          [0, { x: 0.35, lean: 0.05, pitch: 0, drop: 0, f0: 0.15, f1: -0.13, w0: 0.1, w1: -0.1 }],
          [0.78, { x: 0.32, lean: 0.12, pitch: 0, drop: 0, f0: 0.3, f1: -0.13, w0: 0.1, w1: -0.1 }],
          [1.05, { x: 0.12, lean: 0.55, pitch: 0.2, drop: 0.06, f0: 0.42, f1: -0.05, w0: 0.08, w1: -0.06 }],
          [1.35, { x: 0.12, lean: 0.4, pitch: 0.1, drop: 0.04, f0: 0.4, f1: -0.08, w0: 0.08, w1: -0.06 }],
          [1.9, { x: 0.14, lean: 0.08, pitch: 0, drop: 0.02, f0: 0.3, f1: -0.12, w0: 0.08, w1: -0.08 }],
          [2.5, { x: 0.14, lean: 0.05, pitch: 0, drop: 0.04, f0: 0.22, f1: -0.2, w0: 0.11, w1: -0.11 }],
          [3.4, { x: 0.14, lean: 0.05, pitch: 0, drop: 0.04, f0: 0.22, f1: -0.2, w0: 0.11, w1: -0.11 }],
        ]);
        const swinging = t >= 0.3 && t < 0.9;
        const stumble = span(t, 0.8, 1.0) * (1 - span(t, 1.5, 2.1));
        return {
          x: k.x,
          z: 0.6,
          yaw: W,
          anim: swinging ? "slash" : "idle",
          animT: swinging ? t - 0.3 : undefined,
          act: {
            relax: 0,
            lean: k.lean,
            pitch: k.pitch,
            drop: k.drop,
            headPitch: -0.05 + stumble * 0.25,
            feet: [
              { x: -k.w0 * 0.64, z: k.f0 * 0.64 },
              { x: -k.w1 * 0.64, z: k.f1 * 0.64 },
            ],
            // the blade dips low as he tips forward
            ...(stumble > 0.01 ? { ra: { x: lerp(-0.95, -0.35, stumble), elbow: lerp(-0.9, -0.3, stumble) }, la: { x: lerp(-1.0, -0.45, stumble), elbow: lerp(-1.1, -0.4, stumble) } } : {}),
          },
        };
      });
      boy.rig.props.bokken.visible = true;
      // his hands find the boy's shoulders (the boy is posed first each frame)
      const tmp = new THREE.Vector3();
      const shoulder = (i: number): [number, number, number] => {
        boy.rig.body2.arms[i].shoulder.getWorldPosition(tmp);
        return [tmp.x + 0.05, tmp.y + 0.06, tmp.z];
      };
      const dad = s.person(PEOPLE.father(), (t): Pose => {
        const k = keys(t, [
          // arms folded, watching
          [0, { x: 1.2, z: 0.3, lean: 0.06, drop: 0, rx: -1.25, rz: -0.75, re: -1.95, lx: -1.15, lz: -0.7, le: -2.0, head: 0.35 }],
          [0.8, { x: 1.2, z: 0.3, lean: 0.06, drop: 0, rx: -1.25, rz: -0.75, re: -1.95, lx: -1.15, lz: -0.7, le: -2.0, head: 0.4 }],
          // a quick step in, both hands to the boy's shoulders
          [1.1, { x: 0.72, z: 0.5, lean: 0.38, drop: 0.12, rx: -0.6, rz: -0.1, re: -0.6, lx: -0.6, lz: -0.1, le: -0.6, head: 0.45 }],
          [1.9, { x: 0.7, z: 0.52, lean: 0.3, drop: 0.12, rx: -0.6, rz: -0.1, re: -0.6, lx: -0.6, lz: -0.1, le: -0.6, head: 0.45 }],
          // he looks down at the boy's feet and sets them
          [2.5, { x: 0.7, z: 0.52, lean: 0.42, drop: 0.18, rx: -0.6, rz: -0.1, re: -0.6, lx: -0.6, lz: -0.1, le: -0.6, head: 0.75 }],
          // lets go and stands back
          [3.0, { x: 1.0, z: 0.38, lean: 0.12, drop: 0.02, rx: 0, rz: 0.1, re: -0.2, lx: 0, lz: 0.1, le: -0.2, head: 0.35 }],
          [3.4, { x: 1.05, z: 0.35, lean: 0.1, drop: 0, rx: 0, rz: 0.1, re: -0.2, lx: 0, lz: 0.1, le: -0.2, head: 0.3 }],
        ]);
        const w = keys(t, [[0.88, 0], [1.08, 1], [2.55, 1], [2.85, 0]]);
        return {
          x: k.x,
          z: k.z,
          yaw: W,
          act: {
            relax: 0,
            lean: k.lean,
            drop: k.drop,
            headPitch: k.head,
            ra: { x: k.rx, y: 0, z: k.rz, elbow: k.re, wx: 0.2 },
            la: { x: k.lx, y: 0, z: k.lz, elbow: k.le, wx: 0.2 },
            reach: w > 0 ? { r: shoulder(0), l: shoulder(1), w } : undefined,
          },
        };
      });
      return {
        update: ({ stage, t, dt }) => {
          y.tick(dt);
          dad.rig.face.mood(t < 1.0 || t > 2.6 ? "smile" : t < 2.0 ? "flat" : "open", t > 1.0 && t < 2.6 ? 0.3 : 0);
          boy.rig.face.mood(t > 0.95 && t < 1.5 ? "open" : "flat", t < 0.95 ? 0.5 : t < 2.0 ? -0.6 : 0.6);
          camera(stage, t, [
            [0, { pos: [0.85, 1.0, 4.9], look: [0.6, 0.98, 0.45], fov: 33 }],
            [3.4, { pos: [0.8, 0.98, 4.35], look: [0.55, 0.95, 0.45], fov: 32 }],
          ], { hand: 0.008, ease: (u) => u });
        },
      };
    },
  },
  {
    id: "1c",
    title: "His mother calls from the doorway; the boy runs to her",
    dur: 2.2,
    build: (s) => {
      const y = yard(s, { glow: 1.4 });
      // light from inside the open door falls across the veranda
      const spill = new THREE.SpotLight(0xffb070, 7, 9, 0.75, 0.6, 1.5);
      spill.position.set(0, 1.6, -4.2);
      spill.target.position.set(0, 0, 0.5);
      s.add(spill, spill.target);
      const mom = s.person(PEOPLE.mother(), (t): Pose => {
        const wave = Math.sin(t * 9) * 0.25 * span(t, 0.2, 0.5) * (1 - span(t, 1.4, 1.8));
        const raise = span(t, 0.15, 0.45) * (1 - span(t, 1.5, 2.0));
        return {
          x: 0.05,
          z: -3.05,
          floor: 0.45,
          yaw: face(0, 1),
          act: { headPitch: 0.1, ra: { x: lerp(0.05, -2.3, raise), z: lerp(0.12, 0.35 + wave, raise), elbow: lerp(-0.18, -0.55, raise), wx: 0.2 }, la: { x: -0.35, z: 0.05, elbow: -1.2 } },
        };
      });
      const boy = s.person(PEOPLE.boy(), (t) => ({ ...route([[-0.7, 1.0], [-0.35, -0.6], [-0.1, -2.0]], 0.35, 2.2)(t), anim: t > 0.35 && t < 2.15 ? "walk" : "idle" }));
      boy.rig.props.bokken.visible = true;
      const dad = s.person(PEOPLE.father(), (t) => ({ x: 2.1, z: 0.9, yaw: keys(t, [[0, face(-1, 0)], [0.6, face(-0.6, -1)]]), act: { headPitch: 0.15 } }));
      return {
        update: ({ stage, t, dt }) => {
          y.tick(dt);
          mom.rig.face.mood(t > 0.25 && t < 1.6 ? "open" : "smile", -0.1);
          dad.rig.face.mood("smile");
          camera(stage, t, [
            [0, { pos: [1.5, 0.85, 3.5], look: [-0.1, 1.2, -3.2], fov: 40 }],
            [2.2, { pos: [1.3, 0.9, 2.9], look: [-0.1, 1.25, -3.2], fov: 38 }],
          ], { hand: 0.015, ease: (u) => u });
        },
      };
    },
  },
];
