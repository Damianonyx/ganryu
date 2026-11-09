import * as THREE from "three";
import { getChar } from "@/game/roster";
import { camera, face, jolt, keys } from "../direct";
import { Hand } from "../hands";
import type { FilmStage, Pose, Shot } from "../lab";
import { PEOPLE } from "../people";
import { ruinedHouse } from "../ruins";
import { V, grass, ground, lerp, mist, precipitation, ridges, sky, span, std, tree, trees } from "../sets";

/**
 * Act 7, the years between (58–70 s), on the ground where the house stood:
 *   7a  he takes his father's stance; swings, misses, tries again
 *   7b  rain running down his face
 *   7c  autumn: the practice sword knocked from his hands
 *   7d  a wrapped wrist tightening on the grip
 *   7e  bare feet steadying in snow
 *   7f  another fall
 *   7g  spring: another attempt, older now, the movement controlled
 *   7h  a swing begun by the child finishes in the hands of the man
 */

type Season = "ash" | "rain" | "autumn" | "snow" | "summer" | "spring" | "dusk";

const LOOK: Record<Season, { fog: number; dens: number; top: string; hor: string; glow: string; sun: number; sunI: number; sunDir: THREE.Vector3; hemi: [number, number, number]; ground: string; grass: string; ridge: [string, string]; exp: number }> = {
  ash: { fog: 0x8a8e96, dens: 0.02, top: "#5a6474", hor: "#b4b0aa", glow: "#d8c8b0", sun: 0xd8d0c8, sunI: 1.0, sunDir: V(0.8, 0.4, -0.5), hemi: [0xa0a8b8, 0x3a3634, 0.9], ground: "#3e3a36", grass: "#4a4e3a", ridge: ["#6a707c", "#8a9098"], exp: 1.2 },
  rain: { fog: 0x4a525e, dens: 0.045, top: "#2a323e", hor: "#5a626c", glow: "#6a7078", sun: 0x9aa8c0, sunI: 0.5, sunDir: V(0.3, 1, 0.2), hemi: [0x7a8494, 0x22262a, 1.0], ground: "#2e2e2c", grass: "#3a4434", ridge: ["#3a424e", "#4a525c"], exp: 1.15 },
  autumn: { fog: 0xc0906a, dens: 0.014, top: "#5a6a88", hor: "#e8b080", glow: "#ffc080", sun: 0xffb070, sunI: 2.2, sunDir: V(-1, 0.25, -0.2), hemi: [0xb0a090, 0x4a3a2a, 0.8], ground: "#5a4a36", grass: "#7a6a3a", ridge: ["#7a5a5a", "#a07a70"], exp: 1.05 },
  snow: { fog: 0xc8d0dc, dens: 0.03, top: "#8a98ac", hor: "#d8dee6", glow: "#e8eef4", sun: 0xd8e0f0, sunI: 0.8, sunDir: V(0.4, 0.8, -0.3), hemi: [0xd0d8e8, 0x9aa0a8, 1.1], ground: "#e4e8ee", grass: "#c8d0d8", ridge: ["#aab4c2", "#c4ccd6"], exp: 1.0 },
  summer: { fog: 0xa8b0a0, dens: 0.012, top: "#4a6a9a", hor: "#c8d0c0", glow: "#fff0d0", sun: 0xfff0d8, sunI: 2.4, sunDir: V(0.5, 1, 0.3), hemi: [0xb8c8d8, 0x4a4a3a, 0.9], ground: "#6a5a44", grass: "#5a6a34", ridge: ["#6a7a7a", "#8a9898"], exp: 1.0 },
  spring: { fog: 0xd8c8cc, dens: 0.014, top: "#7a8ab0", hor: "#f0d8d8", glow: "#fff0e0", sun: 0xfff0e8, sunI: 1.8, sunDir: V(0.8, 0.5, -0.4), hemi: [0xd8d0e0, 0x5a5048, 0.9], ground: "#5a5040", grass: "#6a7a44", ridge: ["#8a8aa0", "#a8a8ba"], exp: 1.05 },
  dusk: { fog: 0x6a5060, dens: 0.016, top: "#1a1a38", hor: "#c86a4a", glow: "#ff9a5a", sun: 0xff9050, sunI: 2.0, sunDir: V(-1, 0.18, -0.3), hemi: [0x6a6a98, 0x2a1e14, 0.7], ground: "#3a3028", grass: "#4a4a2c", ridge: ["#3a3048", "#5a4458"], exp: 1.15 },
};

/** Where the house stood, in a given season: the burnt frame behind, the trees, the weather. */
function ground0(s: FilmStage, season: Season, o: { ruin?: boolean; post?: boolean } = {}) {
  const L = LOOK[season];
  s.scene.fog = new THREE.FogExp2(L.fog, L.dens);
  s.scene.background = new THREE.Color(L.fog);
  sky(s, L.top, L.hor, L.glow, L.sunDir, { clouds: L.hor, cloudAmt: season === "rain" || season === "snow" ? 0.9 : 0.5 });
  ridges(s, [
    { dist: 100, height: 28, color: L.ridge[0], haze: L.hor, seed: 3 },
    { dist: 135, height: 40, color: L.ridge[1], haze: L.hor, seed: 7 },
  ], V(0, -2, 0), V(0, 0, -1));
  s.add(new THREE.HemisphereLight(...L.hemi));
  const sun = new THREE.DirectionalLight(L.sun, L.sunI);
  sun.position.copy(L.sunDir).normalize().multiplyScalar(30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  s.add(sun, sun.target);
  s.renderer.toneMappingExposure = L.exp;
  ground(s, L.ground, 120, 8, { grass: L.grass, roadColor: L.ground, path: (x, z) => (Math.hypot(x, z) < 3 ? 0.8 : 0), res: 100 });
  if (o.ruin !== false) ruinedHouse(s, 0.5, -6.5, 0, { w: 7, d: 5, seed: 99, embers: 0, smoke: false });
  const leaf = season === "autumn" ? "#a8341c" : season === "spring" ? "#f0c0cc" : undefined;
  const kind = season === "snow" ? "bare" : season === "spring" ? "cherry" : season === "autumn" ? "maple" : "maple";
  const ticks: ((dt: number) => void)[] = [
    trees(s, "cedar", 50, (r) => {
      const x = (r() - 0.5) * 60;
      const z = -40 + r() * 25;
      return [x, z];
    }, { seed: 41, shadows: false, leaf: season === "snow" ? "#3a4440" : undefined }),
    trees(s, kind, 5, (r) => [(r() < 0.5 ? -1 : 1) * (4 + r() * 3), -8 + r() * 5], { seed: 43, leaf: leaf ?? (season === "summer" || season === "rain" ? "#3a5a2a" : "#4a5a2a"), scale: [0.9, 1.2] }),
  ];
  if (season !== "snow")
    ticks.push(grass(s, 900, (r) => {
      const x = (r() - 0.5) * 14;
      const z = -6 + r() * 12;
      return Math.hypot(x, z) < 2.6 ? null : [x, z];
    }, L.grass, 23, season === "summer" ? 0.4 : 0.28));
  if (o.post) {
    // the training post, wrapped in straw rope
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.5, 10), std("#5a4a34", 0.9));
    p.position.set(-1.05, 0.75, 0.0);
    p.castShadow = true;
    s.add(p);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.5, 12), std("#a08a5a", 0.95));
    rope.position.set(-1.05, 1.0, 0.0);
    rope.castShadow = true;
    s.add(rope);
  }
  if (season === "rain") precipitation(s, "rain", 900, V(0, 2, 0), [10, 6, 10], 3);
  if (season === "snow") precipitation(s, "snow", 500, V(0, 2, 0), [8, 5, 8], 4);
  if (season === "spring") precipitation(s, "petals", 260, V(0, 2, 0), [8, 4.5, 8], 5);
  if (season === "autumn") precipitation(s, "petals", 120, V(0, 2, 0), [8, 4.5, 8], 6, 0xb8401c);
  if (season === "ash") precipitation(s, "ash", 200, V(0, 2, 0), [8, 4, 8], 7);
  ticks.push(mist(s, 10, [-20, 20, -30, -10], L.fog, 0.14, 75, 0.5, 1.5));
  return (dt: number) => ticks.forEach((k) => k(dt));
}

/** Training: kamae facing west (screen left), a swing at `at` seconds, and optionally an overbalance after it. */
function swing(at: number, o: { stumble?: boolean; dur?: number } = {}) {
  return (t: number): Partial<Pose> => {
    const on = t >= at && t < at + (o.dur ?? 0.6);
    const st = o.stumble ? span(t, at + 0.45, at + 0.6) * (1 - span(t, at + 0.9, at + 1.3)) : 0;
    return { anim: on ? "slash" : "idle", animT: on ? t - at : undefined, act: { relax: 0, lean: 0.05 + st * 0.45, pitch: st * 0.15, headPitch: st * 0.2 } };
  };
}

export const ACT7: Shot[] = [
  {
    id: "7a",
    title: "He takes his father's stance; swings, misses, tries again",
    dur: 3.0,
    build: (s) => {
      const tick = ground0(s, "ash");
      const W = face(-1, 0);
      const first = swing(0.7, { stumble: true });
      const second = swing(1.9);
      const boy = s.person(PEOPLE.boy(0.35), (t): Pose => ({ x: 0.2 - span(t, 1.15, 1.35) * 0.18 + span(t, 1.5, 1.8) * 0.18, z: 0.4, yaw: W, ...(t < 1.75 ? first(t) : second(t)) }));
      boy.rig.props.bokken.visible = true;
      return {
        update: ({ stage, t, dt }) => {
          tick(dt);
          boy.rig.face.mood("flat", 0.7);
          camera(stage, t, [
            [0, { pos: [0.4, 0.85, 3.6], look: [0.05, 0.7, 0.3], fov: 34 }],
            [3.0, { pos: [0.35, 0.82, 3.2], look: [0.05, 0.7, 0.3], fov: 33 }],
          ], { hand: 0.006, ease: (u) => u });
        },
      };
    },
  },
  {
    id: "7b",
    title: "Rain running down his face",
    dur: 1.2,
    build: (s) => {
      const tick = ground0(s, "rain");
      const youth = s.person(PEOPLE.youth("rain"), (t) => ({ x: 0, z: 0, yaw: face(-1, 0.15), act: { relax: 0, headPitch: -0.05 + Math.sin(t * 2) * 0.02 } }));
      youth.rig.props.bokken.visible = true;
      // rain drops running down the face
      const drops = Array.from({ length: 6 }, (_, i) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), new THREE.MeshStandardMaterial({ color: 0xc8d8e8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.7 }));
        s.add(m);
        return { m, ph: i * 0.37 };
      });
      const head = new THREE.Vector3();
      return {
        dof: { focus: 0.62, aperture: 0.015, maxblur: 0.008 },
        update: ({ stage, t, dt }) => {
          tick(dt);
          youth.rig.face.mood("flat", 0.9);
          youth.rig.head.getWorldPosition(head);
          drops.forEach((d, i) => {
            const u = ((t * 0.5 + d.ph) % 1);
            d.m.position.set(head.x - 0.1 + (i % 3) * 0.008, head.y + 0.16 - u * 0.14, head.z + 0.03 - (i % 2) * 0.05);
          });
          camera(stage, t, [
            [0, { pos: [head.x - 0.55, head.y + 0.05, head.z + 0.28], look: [head.x, head.y + 0.08, head.z], fov: 28 }],
            [1.2, { pos: [head.x - 0.5, head.y + 0.05, head.z + 0.25], look: [head.x, head.y + 0.08, head.z], fov: 27 }],
          ], { hand: 0.003 });
        },
      };
    },
  },
  {
    id: "7c",
    title: "Autumn: the practice sword knocked from his hands",
    dur: 1.1,
    build: (s) => {
      const tick = ground0(s, "autumn", { post: true });
      const HIT = 0.3;
      const youth = s.person(PEOPLE.youth("autumn"), (t) => ({ x: 0, z: 0, yaw: face(-1, 0), ...swing(0.0, { dur: HIT + 0.02 })(t), act: { relax: t > HIT ? 0.6 : 0, lean: t > HIT ? -0.1 : 0.05, headPitch: t > HIT ? -0.15 : 0 } }));
      youth.rig.props.bokken.visible = true;
      // the sword flies out of his hands at the knock
      const flying = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.95, 8), std("#7a5a3a", 0.5));
      blade.rotation.z = Math.PI / 2;
      flying.add(blade);
      flying.visible = false;
      s.add(flying);
      const v = V(0.6, 2.6, 1.2);
      return {
        update: ({ stage, t, dt }) => {
          tick(dt);
          youth.rig.face.mood(t > HIT ? "open" : "flat", 0.6);
          if (t >= HIT && !flying.visible) {
            youth.rig.props.bokken.getWorldPosition(flying.position);
            flying.position.y += 0.1;
            youth.rig.props.bokken.visible = false;
            flying.visible = true;
          }
          if (flying.visible) {
            v.y -= 9.8 * dt;
            flying.position.addScaledVector(v, dt);
            flying.rotation.y += dt * 9;
            flying.rotation.z += dt * 5;
          }
          camera(stage, t, [
            [0, { pos: [-0.4, 1.15, 2.6], look: [-0.55, 1.0, 0], fov: 36 }],
            [1.1, { pos: [-0.35, 1.2, 2.4], look: [-0.5, 1.05, 0], fov: 36 }],
          ], { hand: 0.006, shake: jolt(t, HIT, 0.02, 9) });
        },
      };
    },
  },
  {
    id: "7d",
    title: "A wrapped wrist tightening on the grip",
    dur: 1.1,
    build: (s) => {
      ground0(s, "summer", { ruin: false });
      const hand = new Hand({ side: 1, scale: 0.88, skin: "#d2a882", sleeve: "#2a3448", cuff: "#8a8478" });
      // the grip runs across the palm; the hand closes on it
      hand.group.position.set(0, 1.0, 0);
      hand.group.rotation.set(0.2, 0, -1.25);
      s.add(hand.group);
      const wrap = std("#b8b0a0", 0.95);
      for (let i = 0; i < 5; i++) {
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.035 - i * 0.001, 0.007, 6, 18), wrap);
        w.position.set(0, -0.025 + i * 0.022, 0.0);
        w.rotation.set(Math.PI / 2 + (i % 2 ? 0.25 : -0.2), 0, 0);
        w.scale.set(1.2, 0.85, 1);
        hand.group.add(w);
      }
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.5, 12), std("#6a4a2a", 0.55));
      grip.position.set(0.0, 0.06, 0.03);
      grip.rotation.z = Math.PI / 2;
      hand.group.add(grip);
      const key = new THREE.SpotLight(0xffe0b0, 2.5, 3, 0.5, 0.6, 1.5);
      key.position.set(-0.6, 1.6, 0.8);
      key.target.position.set(0, 1.0, 0);
      s.add(key, key.target);
      return {
        dof: { focus: 0.42, aperture: 0.03, maxblur: 0.01 },
        update: ({ stage, t }) => {
          const c = keys(t, [[0, 0.55], [0.5, 0.95], [1.1, 1.0]]);
          hand.pose({ curl: [c * 0.8, c, c, c, c], spread: 0.05, thumbIn: 0.8 });
          hand.group.rotation.x = 0.2 + Math.sin(t * 30) * 0.004 * span(t, 0.3, 0.6);
          camera(stage, t, [
            [0, { pos: [0.12, 1.12, 0.42], look: [0, 1.03, 0], fov: 32 }],
            [1.1, { pos: [0.1, 1.1, 0.38], look: [0, 1.03, 0], fov: 30 }],
          ], { hand: 0.002 });
        },
      };
    },
  },
  {
    id: "7e",
    title: "Bare feet steadying in snow",
    dur: 1.1,
    build: (s) => {
      const tick = ground0(s, "snow", { ruin: true });
      const youth = s.person(PEOPLE.youth("snow"), (t) => {
        const set = span(t, 0.15, 0.6);
        return {
          x: 0,
          z: 0,
          yaw: face(-1, 0),
          act: {
            relax: 0,
            drop: 0.02 + set * 0.05,
            feet: [
              { x: -0.1 * 0.82, z: lerp(0.08, 0.2, set) * 0.82 },
              { x: 0.1 * 0.82, z: lerp(-0.06, -0.18, set) * 0.82 },
            ],
          },
        };
      });
      youth.rig.props.bokken.visible = true;
      return {
        dof: { focus: 0.8, aperture: 0.02, maxblur: 0.01 },
        update: ({ stage, t, dt }) => {
          tick(dt);
          camera(stage, t, [
            [0, { pos: [0.15, 0.12, 0.85], look: [0.0, 0.08, 0.0], fov: 36 }],
            [1.1, { pos: [0.12, 0.12, 0.78], look: [0.0, 0.08, 0.0], fov: 35 }],
          ], { hand: 0.002 });
        },
      };
    },
  },
  {
    id: "7f",
    title: "Another fall",
    dur: 0.9,
    build: (s) => {
      const tick = ground0(s, "summer", { post: true });
      // knocked back off his feet: he tips over backward and lands on his back
      const youth = s.person(PEOPLE.youth("summer"), (t) => {
        const u = Math.min(1, (t / 0.3) ** 2);
        return {
          x: lerp(0.15, 0.55, span(t, 0.0, 0.35)),
          z: 0,
          floor: 0.12 * u,
          yaw: face(-1, 0),
          act: { relax: 0.3, pitch: -1.35 * u, drop: 0.12 * u, headPitch: -0.3 * u, ra: { x: -2.2 * u, z: 0.5, elbow: -0.6 }, la: { x: -1.6 * u, z: 0.6, elbow: -0.8 } },
        };
      });
      youth.rig.props.bokken.visible = true;
      // dust kicked up where he lands
      s.fire(V(1.2, 0.05, 0), { size: 0.5, rate: 0.01, light: 0.01, smoke: 10, embers: 0, seed: 3 });
      return {
        update: ({ stage, t, dt }) => {
          tick(dt);
          youth.rig.face.mood("open", -0.5);
          camera(stage, t, [
            [0, { pos: [0.8, 0.55, 2.7], look: [0.6, 0.55, 0], fov: 40 }],
            [0.9, { pos: [0.85, 0.45, 2.55], look: [0.9, 0.3, 0], fov: 40 }],
          ], { hand: 0.006, shake: jolt(t, 0.2, 0.03, 9) });
        },
      };
    },
  },
  {
    id: "7g",
    title: "Spring: another attempt, older now, the movement controlled",
    dur: 1.0,
    build: (s) => {
      const tick = ground0(s, "spring");
      tree(s, "cherry", -2.6, -2.2, { seed: 9, scale: 1.1, leaf: "#f0c4d0" });
      const youth = s.person(PEOPLE.youth("spring"), (t) => ({ x: 0, z: 0, yaw: face(-1, 0), ...swing(0.12, { dur: 0.75 })(t) }));
      youth.rig.props.bokken.visible = true;
      return {
        update: ({ stage, t, dt }) => {
          tick(dt);
          youth.rig.face.mood("flat", 0.5);
          camera(stage, t, [
            [0, { pos: [0.2, 1.05, 3.4], look: [-0.3, 1.0, 0], fov: 36 }],
            [1.0, { pos: [0.15, 1.05, 3.2], look: [-0.3, 1.0, 0], fov: 35 }],
          ], { hand: 0.005, ease: (u) => u });
        },
      };
    },
  },
  {
    id: "7h",
    title: "A swing begun by the child finishes in the hands of the man",
    dur: 2.6,
    build: (s) => {
      const tick = ground0(s, "dusk");
      const CUT = 0.62;
      const SW = 0.5; // the swing starts here; the cut lands mid-swing
      const W = face(-1, 0);
      const boy = s.person(PEOPLE.boy(0.2), (t) => ({ x: 0, z: 0, yaw: W, anim: t >= SW ? "slash" : "idle", animT: t >= SW ? t - SW : undefined, act: { relax: 0 }, visible: t < CUT }));
      boy.rig.props.bokken.visible = true;
      const man = s.actor(getChar("kairo"), (t) => ({ x: 0, z: 0, yaw: W, anim: t >= SW && t < SW + 0.9 ? "slash" : "idle", animT: t >= SW && t < SW + 0.9 ? t - SW : undefined, visible: t >= CUT }));
      void man;
      return {
        update: ({ stage, t, dt }) => {
          tick(dt);
          boy.rig.face.mood("flat", 0.8);
          // the same framing either side of the cut, scaled to each body
          const k = t < CUT ? 0.64 : 1.0;
          camera(stage, t, [
            [0, { pos: [0.35, 0.95 * k, 3.4 * k + 0.6], look: [0, 0.85 * k, 0], fov: 34 }],
            [2.6, { pos: [0.3, 0.95 * k, 3.1 * k + 0.6], look: [0, 0.85 * k, 0], fov: 33 }],
          ], { hand: 0.004, ease: (u) => u, shake: jolt(t, CUT, 0.006, 8) });
        },
      };
    },
  },
];
