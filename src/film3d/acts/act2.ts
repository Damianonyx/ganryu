import * as THREE from "three";
import { getChar } from "@/game/roster";
import { camera, face, jolt, keys, route, walk } from "../direct";
import { rng, variant, type Fire, type Pose, type Shot } from "../lab";
import { PEOPLE } from "../people";
import { V, bellTower, clamp01, gate, ground, house, lantern, lerp, mist, moon, palisade, shafts, smooth, stars, std, torch, trees } from "../sets";
import { lightVillage } from "../village";
import { yard } from "./act1";

/**
 * Act 2, the attack (9–18 s):
 *   2a  the warning bell; the father's smile goes
 *   2b  Kurogane leads the samurai out of the fog; the twins move between the trees
 *   2c  a fire arrow strikes a lantern; fire runs across the roof
 *   2d  Vargash crashes through the gate; the villagers scatter
 */

const RANKS = [
  { metal: "#7a6a4a", accent: "#2a2a2e" },
  { metal: "#5a5a62", accent: "#2a1a1a" },
  { metal: "#8a7448", accent: "#1e1e22" },
];
export function rank(i: number) {
  const r = RANKS[i % RANKS.length];
  return variant("kurogane", { metal: r.metal, accent: r.accent, scale: 0.96 + (i % 3) * 0.03 }, `samurai${i}`);
}

export const ACT2: Shot[] = [
  {
    id: "2a",
    title: "The warning bell; the father's smile goes",
    dur: 2.0,
    build: (s) => {
      // Two setups in one shot: the bell on its tower (0–0.95 s), then the father in the yard.
      // the bell tower stands just beyond the yard fence to the west, against the last light
      const TX = -10.5;
      const TZ = -2.5;
      const y = yard(s, { glow: 1.1, clear: [TX, TZ, 6] });
      s.renderer.toneMappingExposure = 0.95;
      // the tower stands on the slope beyond the yard fence, against the last of the light
      const b = bellTower(s, TX, TZ, 0.5);
      s.person(PEOPLE.villager(0), (t) => ({ x: TX + 0.35, z: TZ - 0.35, floor: b.top - 1.34, yaw: face(-0.8, 0.4), act: { ra: { x: keys(t, [[0, -1.5], [0.05, -0.9], [0.5, -1.7], [1.15, -0.9], [2, -1.6]]), z: -0.2, elbow: -0.5 }, la: { x: keys(t, [[0, -1.5], [0.05, -0.9], [0.5, -1.7], [1.15, -0.9], [2, -1.6]]), z: -0.2, elbow: -0.5 }, lean: 0.2 } }));
      // father and son in the yard: he looks up from the boy toward the sound
      const dad = s.person(PEOPLE.father(), (t): Pose => ({
        x: 0.6,
        z: 0.4,
        yaw: face(0.2, 1),
        act: { headPitch: keys(t, [[0, 0.45], [1.1, 0.45], [1.45, -0.12]]), headYaw: keys(t, [[0, -0.55], [1.1, -0.55], [1.45, 0.65]]), lean: keys(t, [[0, 0.1], [1.45, 0.0]]) },
      }));
      const boy = s.person(PEOPLE.boy(), (t) => ({ x: -0.05, z: 0.75, yaw: face(0.6, 0.4), act: { headPitch: keys(t, [[0, -0.35], [1.3, -0.35], [1.6, -0.1]]), headYaw: keys(t, [[0, 0], [1.3, 0], [1.6, 0.8]]) } }));
      boy.rig.props.bokken.visible = true;
      return {
        update: ({ stage, t, dt }) => {
          y.tick(dt);
          // the striker swings into the bell at 0.05 s and 1.2 s
          const strike = (at: number) => (t < at - 0.3 ? 0 : t < at ? smooth((t - (at - 0.3)) / 0.3) : Math.exp(-(t - at) * 5) * Math.cos((t - at) * 12));
          b.striker.rotation.z = -0.55 + (strike(0.05) + strike(1.2)) * 0.5;
          const ring = (at: number) => (t >= at ? Math.exp(-(t - at) * 1.6) * Math.sin((t - at) * 7) : 0);
          b.pivot.rotation.z = (ring(0.05) + ring(1.2)) * 0.16;
          b.pivot.rotation.x = (ring(0.05) - ring(1.2)) * 0.05;
          dad.rig.face.mood(t < 1.25 ? "smile" : "flat", t < 1.25 ? 0 : 0.85);
          boy.rig.face.mood(t < 1.4 ? "smile" : "flat", t < 1.4 ? 0 : -0.7);
          if (t < 0.95) {
            // low under the tower, looking up at the bell against the sky
            camera(stage, t, [
              [0, { pos: [-4.4, 1.3, 2.4], look: [TX, b.top - 0.7, TZ], fov: 36 }],
              [0.95, { pos: [-4.8, 1.35, 2.2], look: [TX, b.top - 0.6, TZ], fov: 33 }],
            ], { hand: 0.02, shake: jolt(t, 0.05, 0.012, 5), ease: (u) => u });
          } else {
            camera(stage, t, [
              [0.95, { pos: [1.15, 1.62, 2.55], look: [0.55, 1.6, 0.35], fov: 30 }],
              [2.0, { pos: [1.05, 1.62, 2.3], look: [0.55, 1.62, 0.35], fov: 28 }],
            ], { hand: 0.006, ease: (u) => u });
          }
        },
      };
    },
  },
  {
    id: "2b",
    title: "Kurogane leads the samurai out of the fog; the twins move between the trees",
    dur: 3.0,
    build: (s) => {
      lightVillage(s, "night", { shadowCenter: V(0, 0, 18), shadowSize: 30, exposure: 1.3 });
      stars(s);
      moon(s, V(-14, 26, 70), 9);
      ground(s, "#1a1814", 100, 1, { grass: "#1a1e16", roadColor: "#2a241c", road: 1.8, center: V(0, 0, 20) });
      const tk = [
        trees(s, "cedar", 110, (r) => {
          const x = (r() - 0.5) * 50;
          const z = 6 + r() * 40;
          if (Math.abs(x) < 2.6) return null; // the road
          if (z < 15.5 && x > -6 && x < 8) return null; // keep the lens clear
          if (z < 21 && Math.abs(x + 0.4) < 4.6 && z > 16) return null; // room for the twins
          return [x, z];
        }, { seed: 5, scale: [0.85, 1.25] }),
        trees(s, "cedar", 2, (r) => [r() < 0.5 ? -3.8 : -4.6, 12.4 + r() * 1.5], { seed: 77, scale: [1.1, 1.2] }),
      ];
      torch(s, -1.9, 20.5, 51);
      torch(s, 1.9, 22.5, 52);
      const drift = mist(s, 26, [-10, 10, 12, 30]);
      shafts(s, V(-9, 16, 36), [V(-2.5, 0, 22), V(1.5, 0, 25), V(4.5, 0, 19)], 0x9aa8ff, 0.008);
      for (const x of [-2.3, 2.3]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.12, 0.5, 10), std("#2a2a2e", 0.5, 0.7));
        b.position.set(x, 1.05, 12.5);
        const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.85, 6), std("#1a1a1e", 0.5, 0.7));
        legs.position.set(x, 0.42, 12.5);
        s.add(b, legs);
        s.fire(V(x, 1.3, 12.5), { size: 0.55, rate: 0.9, light: 6, smoke: 8, seed: x > 0 ? 3 : 4 });
      }
      // the column: Kurogane at the head
      s.actor(getChar("kurogane"), walk([0, 24.5], [0, 19.8], 0, 3.0));
      const slots: [number, number][] = [
        [-0.9, 1.4],
        [0.9, 1.5],
        [-1.0, 2.9],
        [1.0, 3.0],
        [-0.9, 4.4],
        [0.9, 4.5],
      ];
      slots.forEach(([x, dz], i) => s.actor(rank(i), walk([x, 24.5 + dz], [x, 19.8 + dz], 0, 3.0)));
      // the twins slip between the trees on either flank, well inside the frame
      s.actor(getChar("sei"), walk([-3.8, 20.6], [-2.4, 18.6], 0.0, 3.0));
      s.actor(getChar("rei"), walk([3.9, 21.6], [2.5, 19.6], 0.0, 3.0));
      return {
        update: ({ stage, t, dt }) => {
          drift(dt);
          for (const k of tk) k(dt);
          camera(stage, t, [
            [0, { pos: [1.5, 1.0, 13.2], look: [-0.1, 1.5, 21], fov: 42 }],
            [3.0, { pos: [1.3, 1.1, 13.9], look: [0.0, 1.55, 21], fov: 38 }],
          ], { hand: 0.01 });
        },
      };
    },
  },
  {
    id: "2c",
    title: "A fire arrow strikes a lantern; fire runs across the roof",
    dur: 2.0,
    build: (s) => {
      lightVillage(s, "night", { shadowCenter: V(0, 0, 0), shadowSize: 24, exposure: 1.25 });
      stars(s, 300);
      ground(s, "#1e1a16", 80, 3, { grass: "#1a1e16", roadColor: "#2e271e", road: 2.2 });
      const h = house(s, 6.5, 0, -Math.PI / 2, { w: 6.4, d: 4.8, glow: 1.0, lantern: false, seed: 5 });
      house(s, -7, -4, Math.PI / 2, { glow: 0.9, seed: 6 });
      house(s, 7, -10, -Math.PI / 2, { glow: 0.8, seed: 7 });
      const tk = trees(s, "cedar", 60, (r) => {
        const x = (r() - 0.5) * 60;
        const z = -40 + r() * 30;
        return [x, z];
      }, { seed: 9 });
      // the lantern hangs from the eave at the corner of the house, toward the street
      const L = lantern(s, s.scene, V(3.75, 2.05, 1.6), 1.1, 3);
      const target = L.group.position.clone();
      // the arrow: shaft, head, fletching, and a burning rag behind the head
      const arrow = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.8, 5), std("#6a5034", 0.8));
      shaft.rotation.x = Math.PI / 2;
      arrow.add(shaft);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.06, 4), std("#3a3a40", 0.4, 0.8));
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.43;
      arrow.add(head);
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.1), std("#d8d0c0", 0.9, 0, { side: THREE.DoubleSide }));
        f.position.z = -0.34;
        f.rotation.set(Math.PI / 2, (i / 3) * Math.PI, 0);
        arrow.add(f);
      }
      s.add(arrow);
      const T_HIT = 0.5;
      const from = V(-6, 6.5, 14);
      const flight = (t: number) => {
        const u = clamp01(t / T_HIT);
        const p = from.clone().lerp(target, u);
        p.y += Math.sin(u * Math.PI) * 0.8;
        return p;
      };
      const flame = s.fire(from, { size: 0.12, rate: 1.4, light: 2.5, smoke: 4, embers: 10, spread: 0.2, seed: 61 });
      // the lantern bursts into flame; then fire runs up the eave and across the thatch
      const burst = s.fire(target, { size: 0.45, rate: 1.4, light: 6, smoke: 8, embers: 40, spread: 0.6, seed: 62 });
      burst.power = 0;
      const roof = h.group;
      roof.updateMatrixWorld(true);
      const spread: { f: Fire; at: number }[] = [];
      // flames catch at the eave above the lantern, then climb and spread across the thatch
      const pts: [number, number, number][] = [
        // local to the house: x along the front, z from the ridge (0) toward the street (3.3 at the eave)
        [-1.6, 3.0, 0.62],
        [-0.9, 2.6, 0.75],
        [-2.3, 2.3, 0.9],
        [-0.3, 2.0, 1.0],
        [-1.4, 1.5, 1.15],
        [0.6, 2.2, 1.25],
        [0.0, 1.0, 1.4],
        [-2.2, 0.8, 1.5],
        [1.4, 1.4, 1.62],
        [0.8, 0.3, 1.75],
      ];
      for (const [x, z, at] of pts) {
        const yy = h.roofY + 2.4 * (1 - z / 3.3) + 0.08;
        const p = V(x, yy, z).applyMatrix4(roof.matrixWorld);
        const f = s.fire(p, { size: 0.75, rate: 1.0, light: 3.5, smoke: 8, embers: 18, spread: 1.0, seed: Math.round(at * 100) });
        f.power = 0;
        spread.push({ f, at });
      }
      // villagers on the street look up
      s.person(PEOPLE.villager(2), (t) => ({ x: -0.8, z: 3.4, yaw: face(1, -0.6), act: { headPitch: keys(t, [[0, 0.1], [0.8, -0.4]]), ra: { x: keys(t, [[0, 0.05], [0.9, -1.9]]), elbow: -0.6, z: 0.1 } } }));
      s.person(PEOPLE.villager(1), (t) => ({ ...route([[-2.6, -1], [-1.4, 1.2]], 0, 1.0)(t), act: { headPitch: keys(t, [[0, 0], [1.0, -0.35]]) } }));
      return {
        update: ({ stage, t, dt }) => {
          tk(dt);
          const p = flight(t);
          const p2 = flight(t + 0.02);
          arrow.visible = t < T_HIT;
          if (t < T_HIT) {
            arrow.position.copy(p);
            arrow.lookAt(p2);
          }
          flame.move(t < T_HIT ? p : target);
          flame.power = t < T_HIT ? 1 : 0;
          L.group.visible = t < T_HIT + 0.02;
          burst.power = t < T_HIT ? 0 : keys(t, [[T_HIT, 1.8], [0.9, 1.1], [2, 0.9]]);
          for (const sp of spread) sp.f.power = keys(t, [[sp.at - 0.15, 0], [sp.at + 0.25, 1.3], [2, 1.1]]);
          camera(stage, t, [
            [0, { pos: [-1.6, 1.55, 6.8], look: [2.4, 2.4, 1.2], fov: 42 }],
            [0.55, { pos: [-1.5, 1.55, 6.6], look: [3.0, 2.55, 1.4], fov: 40 }],
            [2.0, { pos: [-1.2, 1.5, 6.3], look: [3.6, 3.6, 1.0], fov: 42 }],
          ], { hand: 0.012, shake: jolt(t, T_HIT, 0.01) + jolt(t, 0.85, 0.008) });
        },
      };
    },
  },
  {
    id: "2d",
    title: "Vargash crashes through the gate; the villagers scatter",
    dur: 2.0,
    build: (s) => {
      lightVillage(s, "fire", { shadowCenter: V(0, 0, -2), shadowSize: 30, exposure: 1.2 });
      stars(s, 300);
      ground(s, "#211c16", 90, 2, { grass: "#1e1c14", roadColor: "#2e271e", road: 2 });
      const tk = trees(s, "cedar", 60, (r) => {
        const x = (r() - 0.5) * 50;
        const z = 4 + r() * 30;
        return Math.abs(x) < 3 ? null : [x, z];
      }, { seed: 8 });
      palisade(s, 0, -18, 18, 2.3);
      const g = gate(s, 0);
      house(s, -6.2, -5, Math.PI / 2, { glow: 0.9, seed: 21 });
      house(s, 6.4, -5.8, -Math.PI / 2, { w: 6, glow: 0.9, seed: 22 });
      const drift = mist(s, 18, [-8, 8, -12, 2], 0x6a4a4a, 0.18, 62);
      // the village burns behind the camera's shoulder; firelight rakes the gate
      s.fire(V(-5.6, 4.2, -4.6), { size: 1.6, rate: 1.4, light: 8, smoke: 16, embers: 40, spread: 1.8, seed: 11 });
      s.fire(V(5.6, 4.0, -5.6), { size: 1.4, rate: 1.2, light: 7, smoke: 14, embers: 36, spread: 1.6, seed: 12 });
      s.fire(V(-2.1, 4.55, 0.05), { size: 0.35, rate: 0.6, light: 1.2, smoke: 4, seed: 13 });
      s.fire(V(2.1, 4.55, 0.05), { size: 0.35, rate: 0.6, light: 1.2, smoke: 4, seed: 14 });
      // a key light so the beast reads: firelight from the front-left, a cold rim from behind
      const key = new THREE.SpotLight(0xff8a4a, 50, 18, 0.6, 0.5, 1.4);
      key.position.set(-3.5, 3.5, -6.5);
      key.target.position.set(0, 1.5, -1.5);
      const rim = new THREE.SpotLight(0x8aa0ff, 30, 16, 0.6, 0.5, 1.4);
      rim.position.set(2, 5, 6);
      rim.target.position.set(0, 1.5, -1.5);
      s.add(key, key.target, rim, rim.target);
      // Vargash leaps through the gate (hit at 0.3 s), lands at 0.75 s, and roars
      const T0 = 0.05;
      const T1 = 0.72;
      s.actor(variant("vargash", { scale: getChar("vargash").kit.scale * 1.15 }), (t) => {
        if (t < T0) return { x: 0, z: 3.5, yaw: 0, anim: "idle" };
        if (t < T1) {
          const u = (t - T0) / (T1 - T0);
          return { x: 0, z: lerp(3.5, -2.2, u), y: Math.sin(u * Math.PI) * 1.5, yaw: 0, anim: "leap" };
        }
        return { x: 0, z: -2.2, yaw: 0, anim: t > 0.95 ? "special" : "idle", animT: t > 0.95 ? t - 0.95 : undefined };
      });
      // villagers run past the camera
      const runners: [number, [number, number][], number, number][] = [
        [0, [[-1.6, -2.0], [-2.4, -6.5], [-3.0, -12]], 0, 2.0],
        [1, [[2.0, -2.6], [2.6, -7.0], [3.2, -12.5]], 0.1, 2.0],
        [2, [[-2.6, -4.2], [-3.4, -8.2], [-3.8, -13]], 0, 2.0],
      ];
      for (const [i, pts, t0, t1] of runners) s.person(PEOPLE.villager(i), (t) => ({ ...route(pts, t0, t1)(t), act: { relax: 1, ra: { x: -0.6, elbow: -1.2 }, la: { x: 0.5, elbow: -1.0 }, lean: 0.3 } }));
      // the father pulls his family inside: at the far right, a man draws a woman and child to a doorway
      s.person(PEOPLE.father(), route([[4.2, -7.6], [5.0, -8.6]], 0.8, 2.0));
      // doors burst and planks fly when he hits
      const hit = 0.3;
      const r = rng(21);
      const fly = g.planks.map((p) => ({ p, v: V((r() - 0.5) * 4, 2 + r() * 3, -(4 + r() * 5)), w: V((r() - 0.5) * 9, (r() - 0.5) * 9, (r() - 0.5) * 9), free: r() < 0.55 }));
      const leafSpin = [0, 0];
      return {
        update: ({ stage, t, dt }) => {
          drift(dt);
          tk(dt);
          // before the hit, the doors shudder from blows
          if (t < hit) g.leaves.forEach((leaf, i) => (leaf.rotation.y = (i === 0 ? 1 : -1) * Math.max(0, Math.sin(t * 40)) * 0.04));
          if (t > hit) {
            g.leaves.forEach((leaf, i) => {
              leafSpin[i] = Math.min(1.9, leafSpin[i] + dt * 9 * (1 - leafSpin[i] / 2));
              leaf.rotation.y = (i === 0 ? 1 : -1) * leafSpin[i];
            });
            for (const f of fly) {
              if (!f.free) continue;
              if (f.p.parent !== stage.scene) stage.scene.attach(f.p);
              f.v.y -= 9.8 * dt;
              f.p.position.addScaledVector(f.v, dt);
              if (f.p.position.y < 0.08) {
                f.p.position.y = 0.08;
                f.v.multiplyScalar(0.4);
                f.v.y = Math.abs(f.v.y) * 0.3;
                f.w.multiplyScalar(0.5);
              }
              f.p.rotation.x += f.w.x * dt;
              f.p.rotation.y += f.w.y * dt;
              f.p.rotation.z += f.w.z * dt;
            }
          }
          // low in the street; a jolt on impact and on landing, then a push toward the roar
          camera(stage, t, [
            [0, { pos: [-1.0, 1.0, -8.6], look: [0, 2.0, 0], fov: 44 }],
            [0.8, { pos: [-0.9, 0.95, -8.0], look: [0, 1.8, -1.6], fov: 42 }],
            [2.0, { pos: [-0.75, 0.9, -6.6], look: [0, 1.9, -2.2], fov: 40 }],
          ], { hand: 0.015, shake: jolt(t, hit, 0.05) + jolt(t, T1, 0.06) + jolt(t, 1.0, 0.025, 3) });
        },
      };
    },
  },
];
