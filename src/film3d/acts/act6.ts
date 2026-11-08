import * as THREE from "three";
import { camera, face, keys, route } from "../direct";
import { HATCH, interior } from "../interior";
import type { FilmStage, Pose, Shot } from "../lab";
import { PEOPLE } from "../people";
import { ruinedHouse } from "../ruins";
import { V, gate, grass, ground, mist, palisade, shafts, span, trees } from "../sets";
import { GATE_Z, HOME, HOUSES, height, lightVillage } from "../village";

/**
 * Act 6, the survivor (49–58 s):
 *   6a  gray dawn; the boy crawls up out of the cellar through the cooled wreckage
 *   6b  he searches the silent ruins, calling softly: "Mother?"
 *   6c  he kneels where his home once stood, the charm in his fist
 */

/** The village the morning after: every house a charred frame, smoke still rising. */
function ruinedVillage(s: FilmStage) {
  ground(s, "#3a3634", 180, 4, {
    grass: "#3a3e2e",
    roadColor: "#4a4440",
    height,
    res: 140,
    path: (x) => (Math.abs(x) < 2.2 ? 1 : Math.max(0, 1 - (Math.abs(x) - 2.2) / 1.2)),
  });
  HOUSES.forEach((h, i) => ruinedHouse(s, h.x, h.z, h.yaw, { w: h.w, d: h.d, seed: i + 3, y: height(h.x, h.z), embers: 0.5 }));
  ruinedHouse(s, HOME.x, HOME.z, 0, { w: 7, d: 5, seed: 99, y: height(HOME.x, HOME.z), embers: 0.6 });
  palisade(s, GATE_Z, -26, 26, 2.3);
  const g = gate(s, GATE_Z);
  g.leaves[0].rotation.y = 1.7;
  g.leaves[1].rotation.y = -1.2;
  const tick = [
    trees(s, "cedar", 140, (r) => {
      const x = (r() - 0.5) * 110;
      const z = -70 + r() * 120;
      if (Math.abs(x) < 16 && z < GATE_Z + 4) return null;
      return [x, z];
    }, { seed: 12, y: height, scale: [0.8, 1.3], shadows: false }),
    // the pines inside the village burned too
    trees(s, "bare", 10, (r) => [(r() < 0.5 ? -1 : 1) * (11.5 + r() * 3), -34 + r() * 46], { seed: 13, y: height, scale: [0.9, 1.2] }),
    grass(s, 1500, (r) => {
      const x = (r() - 0.5) * 40;
      const z = -40 + r() * 60;
      return Math.abs(x) < 2.6 ? null : [x, z];
    }, "#4a4e3a", 17, 0.3, height),
  ];
  const drift = mist(s, 24, [-30, 30, -50, 10], 0xa0a4ac, 0.16, 73, 0.4, 1.6);
  return (dt: number) => {
    for (const k of tick) k(dt);
    drift(dt);
  };
}

export const ACT6: Shot[] = [
  {
    id: "6a",
    title: "Gray dawn; the boy crawls up out of the cellar through the cooled wreckage",
    dur: 3.0,
    build: (s) => {
      lightVillage(s, "dawn", { shadowCenter: V(0, 0, 0.5), shadowSize: 16, exposure: 1.35 });
      ground(s, "#3a3634", 80, 6, { grass: "#3a3e2e", roadColor: "#3e3a38", res: 80 });
      // the ruin of the house, its floor open over the cellar
      ruinedHouse(s, 0, 0.6, 0, { w: 7.2, d: 6.8, seed: 99, hole: { x: HATCH.x, z: HATCH.z - 0.6, size: HATCH.size }, embers: 0.4 });
      ruinedHouse(s, -9, -6, Math.PI / 2, { seed: 4, embers: 0.3 });
      ruinedHouse(s, 9, -3, -Math.PI / 2, { seed: 6, embers: 0.3 });
      const cel = interior(s, { cellarOnly: true });
      const tk = trees(s, "cedar", 50, (r) => {
        const x = (r() - 0.5) * 60;
        const z = -45 + r() * 25;
        return [x, z];
      }, { seed: 31, shadows: false });
      const drift = mist(s, 14, [-15, 15, -20, 8], 0xa8acb4, 0.18, 74, 0.3, 1.2);
      // he pushes the hatch up (0.2–0.9 s), then climbs out (0.9–2.6 s)
      const boy = s.person(PEOPLE.boy(0.8), (t): Pose => {
        const k = keys(t, [
          [0, { floor: -1.22, z: HATCH.z, pitch: 0, drop: 0, lean: 0.1 }],
          [0.9, { floor: -0.95, z: HATCH.z, pitch: 0, drop: 0, lean: 0.2 }],
          [1.6, { floor: -0.45, z: HATCH.z + 0.15, pitch: 0.5, drop: 0.25, lean: 0.6 }],
          [2.2, { floor: 0, z: HATCH.z + 0.75, pitch: 0.7, drop: 0.42, lean: 0.7 }],
          [3.0, { floor: 0, z: HATCH.z + 1.05, pitch: 0.55, drop: 0.4, lean: 0.6 }],
        ]);
        const crawl = span(t, 1.4, 2.2);
        return {
          x: HATCH.x,
          z: k.z,
          floor: k.floor,
          yaw: face(0, 1),
          act: {
            relax: 1,
            pitch: k.pitch,
            drop: k.drop,
            lean: k.lean,
            headPitch: -0.3,
            ra: { x: lerp3(-2.6, -1.3, crawl), z: 0.15, elbow: -0.3 },
            la: { x: lerp3(-2.5, -1.2, crawl), z: 0.15, elbow: -0.35 },
          },
        };
      });
      boy.rig.props.charm.visible = true;
      return {
        update: ({ stage, t, dt }) => {
          tk(dt);
          drift(dt);
          cel.lid.rotation.x = keys(t, [[0.2, 0], [0.9, -1.35], [1.3, -Math.PI + 0.25]]);
          boy.rig.face.mood("flat", -0.6);
          camera(stage, t, [
            [0, { pos: [HATCH.x + 0.7, 0.45, HATCH.z + 2.2], look: [HATCH.x, 0.15, HATCH.z], fov: 40 }],
            [3.0, { pos: [HATCH.x + 0.6, 0.5, HATCH.z + 2.5], look: [HATCH.x, 0.3, HATCH.z + 0.6], fov: 40 }],
          ], { hand: 0.008 });
        },
      };
    },
  },
  {
    id: "6b",
    title: "He searches the silent ruins, calling softly",
    dur: 3.0,
    build: (s) => {
      lightVillage(s, "dawn", { shadowCenter: V(0, 0, -16), shadowSize: 50, exposure: 1.05 });
      const tick = ruinedVillage(s);
      const boy = s.person(PEOPLE.boy(0.8), (t) => ({
        ...route([[0.6, -12.5], [0.2, -14.2], [-0.4, -15.4]], 0, 3.0)(t),
        act: { relax: 1, headYaw: Math.sin(t * 1.6) * 0.7, headPitch: -0.05 },
      }));
      boy.rig.props.charm.visible = true;
      return {
        update: ({ stage, t, dt }) => {
          tick(dt);
          // "Mother?" (0.6–2.2 s)
          boy.rig.face.mood(t > 0.6 && t < 2.2 && Math.sin(t * 12) > -0.3 ? "open" : "flat", -0.8);
          camera(stage, t, [
            [0, { pos: [4.2, 2.6, -6.2], look: [-0.5, 1.0, -16], fov: 40 }],
            [3.0, { pos: [3.6, 2.4, -7.0], look: [-0.8, 0.9, -17], fov: 38 }],
          ], { hand: 0.01 });
        },
      };
    },
  },
  {
    id: "6c",
    title: "He kneels where his home once stood, the charm in his fist",
    dur: 3.0,
    build: (s) => {
      lightVillage(s, "dawn", { shadowCenter: V(HOME.x, 0, HOME.z), shadowSize: 20, exposure: 1.0 });
      const tick = ruinedVillage(s);
      // the morning light breaks through the smoke behind him
      shafts(s, V(HOME.x + 18, 14, HOME.z - 8), [V(HOME.x + 1, 0, HOME.z + 2), V(HOME.x - 1.5, 0, HOME.z + 3), V(HOME.x + 2.5, 0, HOME.z + 4)], 0xe8d8c0, 0.018, 1.6);
      const at = V(HOME.x + 0.6, height(HOME.x, HOME.z + 3.6), HOME.z + 3.6);
      const boy = s.person(PEOPLE.boy(0.8), (t): Pose => {
        const down = span(t, 0, 0.9);
        return {
          x: at.x,
          z: at.z,
          floor: at.y,
          yaw: face(0, -1),
          act: {
            relax: 1,
            drop: 0.36 * down,
            feet: [
              { x: -0.07, z: lerp3(0.0, -0.22, down), y: 0 },
              { x: 0.07, z: lerp3(0.0, -0.24, down), y: 0 },
            ],
            lean: 0.25 + down * 0.2,
            headPitch: 0.25 + down * 0.4,
            // the charm held to his chest in both hands
            ra: { x: -0.9, z: -0.35, elbow: -1.9, wx: 0.2 },
            la: { x: -1.0, z: -0.4, elbow: -1.95, wx: 0.3 },
          },
        };
      });
      boy.rig.props.charm.visible = true;
      const ambient = new THREE.PointLight(0xffe0c0, 0.6, 6, 1.5);
      ambient.position.set(at.x + 1.2, at.y + 1.5, at.z + 1.2);
      s.add(ambient);
      return {
        update: ({ stage, t, dt }) => {
          tick(dt);
          boy.rig.face.mood("flat", -0.9);
          camera(stage, t, [
            [0, { pos: [at.x - 1.5, at.y + 0.55, at.z - 1.2], look: [at.x + 0.1, at.y + 0.42, at.z], fov: 36 }],
            [3.0, { pos: [at.x - 1.25, at.y + 0.5, at.z - 1.0], look: [at.x + 0.1, at.y + 0.4, at.z], fov: 34 }],
          ], { hand: 0.006, ease: (u) => u });
        },
      };
    },
  },
];

const lerp3 = (a: number, b: number, u: number) => a + (b - a) * u;
