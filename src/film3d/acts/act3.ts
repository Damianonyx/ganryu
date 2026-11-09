import * as THREE from "three";
import { camera, face, jolt, keys } from "../direct";
import { Hand, charm } from "../hands";
import { CELLAR, HATCH, interior } from "../interior";
import type { Pose, Shot } from "../lab";
import { PEOPLE } from "../people";
import { V, lerp, span, std } from "../sets";

/**
 * Act 3, the hiding place (18–28 s):
 *   3a  the father lifts the floor hatch; the mother lowers the boy into the cellar
 *   3b  the boy grips his mother's sleeve: "Come with me."
 *   3c  she places the wooden charm in his hand and closes his fingers around it
 *   3d  the hatch closes; through the gap he sees his parents turn toward the door
 */

const tmp = new THREE.Vector3();
const at = (o: THREE.Object3D, dx = 0, dy = 0, dz = 0): [number, number, number] => {
  o.getWorldPosition(tmp);
  return [tmp.x + dx, tmp.y + dy, tmp.z + dz];
};

/** Kneeling on one knee (the left), in the body's frame; scale by the body's size. */
const kneel = (k = 1, scale = 1) => ({
  drop: 0.46 * k * scale,
  feet: [
    { x: -0.12 * scale, z: lerp(0.15, 0.36, k) * scale },
    { x: 0.12 * scale, z: lerp(-0.13, -0.42, k) * scale, y: 0.0 },
  ],
});

/** The lid's free edge in the world, for a hand to hold. */
const lidEdge = (lid: THREE.Group, dx = 0) => {
  lid.updateWorldMatrix(true, false);
  return V(dx, 0.02, HATCH.size - 0.06).applyMatrix4(lid.matrixWorld);
};

export const ACT3: Shot[] = [
  {
    id: "3a",
    title: "The father lifts the floor hatch; the mother lowers the boy into the cellar",
    dur: 3.0,
    build: (s) => {
      const room = interior(s, { burning: 0.75, haze: 0.4 });
      const lidAngle = (t: number) => keys(t, [[0.12, 0], [0.45, -1.05], [0.75, -Math.PI / 2 - 0.05], [1.0, -Math.PI]], (u) => u * u * (3 - 2 * u));
      // the boy first (the mother's hands follow him), then the mother, then the father
      const boy = s.person(PEOPLE.boy(), (t): Pose => {
        const k = keys(t, [
          [0, { x: 0.45, z: 0.95, floor: 0 }],
          [1.1, { x: 0.55, z: 0.75, floor: 0.05 }],
          [1.6, { x: HATCH.x - 0.02, z: HATCH.z + 0.02, floor: -0.2 }],
          [2.9, { x: HATCH.x, z: HATCH.z, floor: -CELLAR.depth }],
        ]);
        return {
          x: k.x,
          z: k.z,
          floor: k.floor,
          yaw: face(-1, 0.3),
          act: {
            relax: 1,
            headPitch: -0.45,
            // arms up, holding on to her
            ra: { x: keys(t, [[0, -0.4], [1.0, -1.9]]), z: 0.15, elbow: -0.9 },
            la: { x: keys(t, [[0, -0.4], [1.0, -1.9]]), z: 0.15, elbow: -0.9 },
            // legs hang while he is held above the hole
            feet: t > 1.15 && t < 2.75 ? [{ y: 0.0, z: 0.05 }, { y: 0.0, z: -0.02 }] : undefined,
          },
        };
      });
      const mom = s.person(PEOPLE.mother(), (t): Pose => {
        const hold = keys(t, [[0.7, 0], [1.05, 1], [2.6, 1], [2.9, 0.6]]);
        return {
          x: 0.05,
          z: 0.62,
          yaw: face(1, 0),
          act: {
            relax: 1,
            ...kneel(keys(t, [[0, 0.2], [0.8, 1]]), 0.95),
            lean: keys(t, [[0, 0.15], [1.2, 0.35], [2.6, 0.75]]),
            headPitch: 0.45,
            reach: { r: at(boy.rig.body2.arms[0].shoulder, 0, -0.1, 0), l: at(boy.rig.body2.arms[1].shoulder, 0, -0.1, 0), w: hold },
          },
        };
      });
      const dad = s.person(PEOPLE.father(), (t): Pose => {
        const hold = keys(t, [[0.04, 0], [0.14, 1], [0.42, 1], [0.56, 0]]);
        const e = lidEdge(room.lid);
        return {
          x: HATCH.x + 0.05,
          z: HATCH.z + 0.68,
          yaw: face(0, -1),
          act: {
            relax: 1,
            ...kneel(keys(t, [[0, 1], [0.5, 0.7], [1.2, 1]]), 1.02),
            lean: keys(t, [[0, 0.65], [0.42, 0.4], [0.8, 0.2], [1.2, 0.3]]),
            headPitch: keys(t, [[0, 0.5], [1.3, 0.5], [2.0, 0.2]]),
            headYaw: keys(t, [[1.2, 0], [1.8, -0.8]]),
            reach: { r: [e.x - 0.14, e.y, e.z], l: [e.x + 0.14, e.y, e.z], w: hold },
          },
        };
      });
      return {
        ao: true,
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          room.lid.rotation.x = lidAngle(t);
          mom.rig.face.mood("flat", -0.7);
          dad.rig.face.mood("flat", 0.8);
          boy.rig.face.mood(t > 1.4 ? "open" : "flat", -0.8);
          camera(stage, t, [
            [0, { pos: [2.65, 1.3, -0.85], look: [0.7, 0.62, 0.8], fov: 46 }],
            [3.0, { pos: [2.45, 1.18, -0.6], look: [0.8, 0.25, 0.7], fov: 44 }],
          ], { hand: 0.01, shake: jolt(t, 1.0, 0.012, 9) });
        },
      };
    },
  },
  {
    id: "3b",
    title: "The boy grips his mother's sleeve",
    dur: 2.6,
    build: (s) => {
      const room = interior(s, { burning: 0.75, haze: 0.4 });
      room.lid.rotation.x = -Math.PI;
      const mom = s.person(PEOPLE.mother(), (): Pose => ({
        x: 0.15,
        z: HATCH.z + 0.05,
        yaw: face(1, 0),
        act: {
          relax: 1,
          ...kneel(1, 0.95),
          lean: 0.85,
          headPitch: 0.55,
          // her right hand on his shoulder, her left on the edge of the hatch
          reach: { r: [HATCH.x - 0.05, -0.32, HATCH.z - 0.1], l: [HATCH.x - 0.4, 0.03, HATCH.z + 0.32], w: 1 },
        },
      }));
      const boy = s.person(PEOPLE.boy(), (t): Pose => {
        const grip = keys(t, [[0, 0.4], [0.35, 1]]);
        const arm = mom.rig.body2.arms[0];
        const e = at(arm.elbow);
        const w = at(arm.wrist);
        const sleeve: [number, number, number] = [lerp(e[0], w[0], 0.35), lerp(e[1], w[1], 0.35) - 0.04, lerp(e[2], w[2], 0.35) + 0.03];
        return {
          x: HATCH.x + 0.05,
          z: HATCH.z,
          floor: -CELLAR.depth,
          yaw: face(-1, -0.15),
          act: { relax: 1, headPitch: -0.7, headYaw: 0.1, reach: { r: sleeve, l: [sleeve[0] + 0.05, sleeve[1] - 0.12, sleeve[2] - 0.12], w: grip } },
        };
      });
      return {
        ao: true,
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          // "Come with me." (0.3–1.9 s)
          const speaking = t > 0.3 && t < 1.9 && Math.sin(t * 22) > -0.2;
          boy.rig.face.mood(speaking ? "open" : "flat", -1);
          mom.rig.face.mood("flat", -0.8);
          camera(stage, t, [
            [0, { pos: [0.3, 0.98, 1.1], look: [0.95, -0.25, 0.52], fov: 38 }],
            [2.6, { pos: [0.36, 0.92, 1.06], look: [0.95, -0.25, 0.52], fov: 35 }],
          ], { hand: 0.006 });
        },
      };
    },
  },
  {
    id: "3c",
    title: "She places a small wooden charm in his hand and closes his fingers around it",
    dur: 3.0,
    build: (s) => {
      const room = interior(s, { burning: 0.7, lamp: true, haze: 0.2 });
      room.lid.rotation.x = -Math.PI;
      // his small right hand held up out of the hatch, palm up, fingers toward her (−x)
      const boyHand = new Hand({ side: 1, scale: 0.64, skin: "#dcb08a", sleeve: "#2e3a52", cuff: "#e8e0cc" });
      const wrist = V(HATCH.x + 0.07, 0.12, HATCH.z + 0.05);
      boyHand.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, -1), V(-1, 0.18, 0).normalize(), V(0.18, 1, 0).normalize()));
      boyHand.group.position.copy(wrist);
      s.add(boyHand.group);
      // her left hand comes in from her side (−x), palm down, the charm hanging from her fingers by its cord
      const momHand = new Hand({ side: -1, scale: 1, skin: "#e0b898", sleeve: "#5a3a4a", cuff: "#efe6d4" });
      const down = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, -1), V(1, 0, 0), V(0, -1, 0)));
      s.add(momHand.group);
      const c = charm(1.0);
      s.add(c);
      const palm = () => V(0, 0.05, 0.02).applyMatrix4(boyHand.group.matrixWorld);
      // a warm key from the fire beyond the door, a cool fill from below
      const key = new THREE.SpotLight(0xffa060, 6, 3, 0.6, 0.6, 1.5);
      key.position.set(HATCH.x - 0.4, 0.9, HATCH.z + 0.9);
      key.target.position.set(HATCH.x, 0.1, HATCH.z);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.bias = -0.0005;
      s.add(key, key.target);
      const fill = new THREE.PointLight(0x6a7aa0, 0.35, 2, 1.5);
      fill.position.set(HATCH.x + 0.3, -0.2, HATCH.z - 0.2);
      s.add(fill);
      return {
        ao: true,
        dof: { focus: 0.5, aperture: 0.025, maxblur: 0.01 },
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          boyHand.group.updateMatrixWorld(true);
          const p = palm();
          // the charm: hanging from her fingers, laid on his palm, then closed in
          const close = span(t, 1.35, 2.3);
          boyHand.pose({ curl: [lerp(0.15, 0.85, close), lerp(0.12, 0.95, close), lerp(0.12, 1.0, close), lerp(0.15, 1.0, close), lerp(0.2, 1.0, close)], spread: 0.35 * (1 - close), thumbIn: lerp(0.1, 0.9, close) });
          // tremble
          boyHand.group.position.y = wrist.y + Math.sin(t * 31) * 0.0012 * (1 - close * 0.5);
          // her hand: lowering (0–1.15), letting go (1.15–1.35), wrapping his fingers (1.35–2.3), holding
          const hk = keys(t, [
            [0, { x: -0.2, y: 0.24, tilt: 0.25, curl: 0.5 }],
            [1.15, { x: -0.17, y: 0.085, tilt: 0.3, curl: 0.5 }],
            [1.4, { x: -0.16, y: 0.1, tilt: 0.15, curl: 0.15 }],
            [2.3, { x: -0.09, y: 0.032, tilt: 0.05, curl: 0.8 }],
            [3.0, { x: -0.088, y: 0.03, tilt: 0.05, curl: 0.86 }],
          ]);
          momHand.group.position.set(p.x + hk.x, p.y + hk.y, p.z + 0.005);
          momHand.group.quaternion.copy(down).premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -hk.tilt));
          momHand.pose({ curl: [hk.curl * 0.9, hk.curl, hk.curl * 1.1, hk.curl * 1.15, hk.curl * 1.2], spread: 0.15, thumbIn: 0.55 });
          momHand.group.updateMatrixWorld(true);
          if (t < 1.15) {
            // dangling under her pinched fingers
            const pinch = V(0.02, 0.1, 0.01).applyMatrix4(momHand.group.matrixWorld);
            c.position.set(pinch.x, pinch.y - 0.045, pinch.z);
            c.rotation.set(Math.sin(t * 3) * 0.12, 0.3 + Math.sin(t * 1.7) * 0.4, Math.sin(t * 2.3) * 0.1);
          } else {
            const settle = span(t, 1.15, 1.32);
            c.position.lerp(V(p.x, p.y + 0.006, p.z), settle);
            c.rotation.set(lerp(c.rotation.x, -Math.PI / 2, settle), lerp(c.rotation.y, 0.3, settle), 0);
            c.visible = close < 0.8;
          }
          camera(stage, t, [
            [0, { pos: [HATCH.x - 0.02, 0.36, HATCH.z + 0.48], look: [HATCH.x - 0.04, 0.12, HATCH.z + 0.04], fov: 34 }],
            [3.0, { pos: [HATCH.x - 0.02, 0.32, HATCH.z + 0.42], look: [HATCH.x - 0.04, 0.11, HATCH.z + 0.04], fov: 31 }],
          ], { hand: 0.002 });
        },
      };
    },
  },
  {
    id: "3d",
    title: "The hatch closes; through the gap he sees his parents turn toward the door",
    dur: 1.4,
    build: (s) => {
      const room = interior(s, { burning: 0.8, haze: 0.4 });
      const T_SHUT = 0.6;
      const dad = s.person(PEOPLE.father(), (t): Pose => {
        const e = lidEdge(room.lid);
        const hold = keys(t, [[0, 1], [0.38, 1], [0.5, 0]]);
        const turned = t > T_SHUT + 0.15;
        return {
          x: HATCH.x - 0.05,
          z: turned ? HATCH.z + 2.3 : HATCH.z - 0.85,
          yaw: turned ? keys(t, [[0.8, face(0, -1)], [1.2, face(0.1, 1)]]) : face(0, 1),
          act: { relax: 1, lean: turned ? 0 : 0.55, drop: turned ? 0 : 0.2, headPitch: turned ? 0 : 0.6, reach: turned ? undefined : { r: [e.x - 0.15, e.y, e.z], l: [e.x + 0.15, e.y, e.z], w: hold } },
        };
      });
      const mom = s.person(PEOPLE.mother(), (t): Pose => ({
        x: HATCH.x + 0.85,
        z: HATCH.z + 2.6,
        yaw: keys(t, [[0.8, face(-0.3, -1)], [1.25, face(-0.1, 1)]]),
        act: { relax: 1, headYaw: keys(t, [[0.8, 0], [1.1, 0.3]]) },
        visible: t > T_SHUT,
      }));
      // the gap: two boards in front of the lens leave a slit (second setup)
      const boardMat = std("#120c08", 0.9);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.05), boardMat);
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.05), boardMat);
      s.camera.add(top, bottom);
      s.add(s.camera);
      return {
        ao: true,
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          // the lid swings up from the floor and over, shut at 0.6 s
          room.lid.rotation.x = keys(t, [[0, -Math.PI + 0.02], [T_SHUT, 0]], (u) => u * u);
          room.cellarLight.intensity = keys(t, [[0, 1.4], [T_SHUT, 0.05]]);
          dad.rig.face.mood("flat", 0.9);
          mom.rig.face.mood("flat", -0.5);
          const gap = t > T_SHUT;
          top.visible = bottom.visible = gap;
          top.position.set(0, 0.165, -0.32);
          bottom.position.set(0, -0.165, -0.32);
          if (!gap) {
            // from the cellar floor, looking up through the hatch as it closes over him
            camera(stage, t, [
              [0, { pos: [HATCH.x + 0.1, -0.55, HATCH.z + 0.2], look: [HATCH.x - 0.1, 1.6, HATCH.z - 0.45], fov: 52 }],
              [T_SHUT, { pos: [HATCH.x + 0.1, -0.6, HATCH.z + 0.2], look: [HATCH.x - 0.1, 1.6, HATCH.z - 0.4], fov: 50 }],
            ], { hand: 0.004, shake: jolt(t, T_SHUT, 0.02, 9) });
          } else {
            // through the slit under the lid: their legs and bodies, turning to the door
            camera(stage, t, [
              [T_SHUT, { pos: [HATCH.x + 0.05, 0.03, HATCH.z + 0.25], look: [HATCH.x + 0.1, 1.0, 3.6], fov: 46 }],
              [1.4, { pos: [HATCH.x + 0.05, 0.03, HATCH.z + 0.28], look: [HATCH.x + 0.1, 1.05, 3.6], fov: 44 }],
            ], { hand: 0.003 });
          }
        },
      };
    },
  },
];
