import * as THREE from "three";
import type { Rig } from "@/game/mesh";
import { getChar } from "@/game/roster";
import { camera, face, jolt, keys, walk } from "../direct";
import { Hand } from "../hands";
import { HATCH, ROOM, interior } from "../interior";
import { rng, type FilmStage, type Pose, type Shot } from "../lab";
import { PEOPLE } from "../people";
import { V, lerp, span, std } from "../sets";

/**
 * Act 4, the man he will remember (28–40 s), mostly seen from the cellar
 * through the gap under the hatch:
 *   4a  the door breaks inward
 *   4b  Nethrak enters slowly; Kharzul and Kurogane stay in the doorway
 *   4c  his white robe with crimson brushstroke flames, stepping across the floor
 *   4d  his sword, then his face
 *   4e  the father raises his blade; a flash of steel; he falls out of view
 *   4f  the boy's face: fear catches in his throat; a second movement of the sword
 *   4g  his mother's hand falls beside the gap; Nethrak turns to leave: "Burn it."
 */

/** The view through the gap: two boards before the lens leave a slit `open` (fraction of the frame) high. */
export function gapView(s: FilmStage, open = 0.45) {
  const boardMat = std("#100a06", 0.9);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.05), boardMat);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.05), boardMat);
  s.camera.add(top, bottom);
  s.add(s.camera);
  const set = (fov: number, frac: number) => {
    // place the boards so the slit is `frac` of the frame's height at their distance
    const d = 0.32;
    const halfH = Math.tan(((fov / 2) * Math.PI) / 180) * d;
    const y = halfH * frac + 0.1;
    top.position.set(0, y, -d);
    bottom.position.set(0, -y, -d);
  };
  set(48, open);
  return { top, bottom, set };
}

/** From under the hatch, looking out toward the door. */
const GAP_CAM = { pos: [HATCH.x + 0.05, 0.03, HATCH.z + 0.3] as [number, number, number], look: [0.35, 1.75, ROOM.z1] as [number, number, number] };

/** Nethrak's robe: crimson brushstroke flames painted up from the hem, laid over the game's robe. */
function robeFlames(rig: Rig) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const x = c.getContext("2d")!;
  const r = rng(13);
  for (let i = 0; i < 26; i++) {
    const px = (i / 26) * 1024 + r() * 20;
    const h = 90 + r() * 140;
    const w = 18 + r() * 26;
    x.fillStyle = r() < 0.5 ? "#a8141c" : "#c81e2a";
    x.beginPath();
    x.moveTo(px - w, 256);
    x.bezierCurveTo(px - w * 0.6, 256 - h * 0.45, px + w * (r() - 0.2), 256 - h * 0.7, px + w * 0.3 + (r() - 0.5) * 30, 256 - h);
    x.bezierCurveTo(px + w * 0.4, 256 - h * 0.55, px + w * 1.1, 256 - h * 0.35, px + w * 0.9, 256);
    x.closePath();
    x.fill();
    // dry-brush streaks
    x.strokeStyle = "rgba(90,8,12,0.6)";
    x.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      x.beginPath();
      x.moveTo(px - w * 0.5 + k * 6, 256);
      x.quadraticCurveTo(px, 256 - h * 0.5, px + w * 0.2, 256 - h * 0.85);
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  const pelvis = rig.lLeg.parent!;
  const skirt = pelvis.children.find((o) => o.type === "Group" && o !== rig.lLeg && o !== rig.rLeg) ?? pelvis;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.445, 0.8, 40, 1, true), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.35, roughness: 0.75, side: THREE.DoubleSide }));
  m.position.y = -0.4;
  m.castShadow = true;
  skirt.add(m);
}

function nethrak(s: FilmStage, path: (t: number) => Pose) {
  const a = s.actor(getChar("nethrak"), path);
  robeFlames(a.rig);
  return a;
}

/** The father, guarding with the household sword; the mother behind him. */
function parents(s: FilmStage, o: { dad?: (t: number) => Partial<Pose>; mom?: (t: number) => Partial<Pose> } = {}) {
  const dad = s.person(PEOPLE.father(), (t) => ({ x: 1.3, z: 2.95, yaw: face(-0.3, 1), act: { relax: 0, lean: 0.12, drop: 0.08 }, ...o.dad?.(t) }));
  dad.rig.props.katana.visible = true;
  const mom = s.person(PEOPLE.mother(), (t) => ({
    x: -0.4,
    z: 2.5,
    yaw: face(0.2, 1),
    act: { relax: 1, ra: { x: -1.35, z: -0.55, elbow: -2.0 }, la: { x: -1.2, z: -0.5, elbow: -2.1 }, headPitch: 0.05 },
    ...o.mom?.(t),
  }));
  return { dad, mom };
}

export const ACT4: Shot[] = [
  {
    id: "4a",
    title: "Through the gap: the door breaks inward",
    dur: 2.0,
    build: (s) => {
      const room = interior(s, { burning: 1, haze: 0.6 });
      const { dad, mom } = parents(s);
      const gap = gapView(s);
      const HIT = 0.15;
      const r = rng(5);
      const fly = room.doorPlanks.map((p) => ({ p, v: V((r() - 0.5) * 2.5, 0.6 + r() * 1.6, -(3 + r() * 3)), w: V((r() - 0.5) * 8, (r() - 0.5) * 8, (r() - 0.5) * 8) }));
      // the shapes in the smoke beyond the door
      nethrak(s, () => ({ x: 0.2, z: 5.6, yaw: face(0, -1), anim: "idle" }));
      return {
        ao: true,
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          dad.rig.face.mood("flat", 1);
          mom.rig.face.mood("open", -1);
          if (t > HIT) {
            for (const f of fly) {
              if (f.p.parent !== stage.scene) stage.scene.attach(f.p);
              f.v.y -= 9.8 * dt;
              f.p.position.addScaledVector(f.v, dt);
              if (f.p.position.y < 0.03) {
                f.p.position.y = 0.03;
                f.v.multiplyScalar(0.35);
                f.v.y = Math.abs(f.v.y) * 0.25;
                f.w.multiplyScalar(0.4);
              }
              f.p.rotation.x += f.w.x * dt;
              f.p.rotation.y += f.w.y * dt;
              f.p.rotation.z += f.w.z * dt;
            }
          } else {
            // blows shake the door before it gives
            room.door.forEach((d, i) => (d.position.z = ROOM.z1 - 0.03 - Math.max(0, Math.sin(t * 60 + i)) * 0.02));
          }
          for (const f of room.outside) f.power = t > HIT ? 1.3 : 0.7;
          gap.set(48, 0.55);
          camera(stage, t, [
            [0, { ...GAP_CAM, fov: 48 }],
            [2.0, { pos: [GAP_CAM.pos[0], 0.03, GAP_CAM.pos[2] + 0.05], look: GAP_CAM.look, fov: 46 }],
          ], { hand: 0.003, shake: jolt(t, HIT, 0.012, 7) });
        },
      };
    },
  },
  {
    id: "4b",
    title: "Nethrak enters slowly; Kharzul and Kurogane stay in the doorway",
    dur: 2.0,
    build: (s) => {
      const room = interior(s, { burning: 1, haze: 0.6, doorBroken: true });
      const { dad, mom } = parents(s);
      nethrak(s, (t) => ({ ...walk([0.2, 5.0], [0.25, 3.75], 0, 2.0)(t), anim: "walk", act: { relax: 1 } }));
      s.actor(getChar("kharzul"), () => ({ x: -1.0, z: 5.0, yaw: face(0.1, -1), anim: "idle" }));
      s.actor(getChar("kurogane"), () => ({ x: 1.05, z: 5.2, yaw: face(-0.1, -1), anim: "idle" }));
      const gap = gapView(s);
      return {
        ao: true,
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          dad.rig.face.mood("flat", 1);
          mom.rig.face.mood("flat", -1);
          gap.set(48, 0.55);
          camera(stage, t, [
            [0, { ...GAP_CAM, fov: 48 }],
            [2.0, { pos: [GAP_CAM.pos[0] - 0.05, 0.03, GAP_CAM.pos[2] + 0.08], look: [0.2, 1.85, ROOM.z1], fov: 44 }],
          ], { hand: 0.003 });
        },
      };
    },
  },
  {
    id: "4c",
    title: "His white robe with crimson brushstroke flames, as he steps across the floor",
    dur: 1.4,
    build: (s) => {
      const room = interior(s, { burning: 1, haze: 0.5, doorBroken: true });
      // he crosses the room from left to right, the hem at the lens
      nethrak(s, (t) => ({ ...walk([-1.3, 2.5], [0.5, 2.35], 0, 1.4)(t), anim: "walk", act: { relax: 1 } }));
      return {
        ao: true,
        dof: { focus: 1.15, aperture: 0.025, maxblur: 0.01 },
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          camera(stage, t, [
            [0, { pos: [-0.75, 0.22, 1.25], look: [-0.75, 0.38, 2.5], fov: 38 }],
            [1.4, { pos: [-0.05, 0.22, 1.25], look: [0.05, 0.4, 2.4], fov: 38 }],
          ], { hand: 0.002 });
        },
      };
    },
  },
  {
    id: "4d",
    title: "His sword, then his face",
    dur: 1.6,
    build: (s) => {
      const room = interior(s, { burning: 1, haze: 0.4, doorBroken: true, lamp: false });
      // a rim of firelight from behind; the face is a shadow with two embers in it
      const rim = new THREE.SpotLight(0xff6a2a, 40, 6, 0.5, 0.5, 1.5);
      rim.position.set(0.6, 2.6, 3.2);
      rim.target.position.set(0, 1.4, 1.6);
      s.add(rim, rim.target);
      nethrak(s, () => ({ x: 0.05, z: 1.6, yaw: face(0, -1), anim: "idle" }));
      const scale = getChar("nethrak").kit.scale;
      return {
        ao: true,
        // focus on the face; the room and the fire behind fall soft
        dof: { focus: 2.0, aperture: 0.012, maxblur: 0.012 },
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          const u = Math.min(1, t / 1.6);
          // a slow rise from the red blade to the skull beneath the steel hat
          camera(stage, t, [
            [0, { pos: [0.55, 1.15, -0.6], look: [0.12, 1.2, 1.6], fov: 30 }],
            [1.6, { pos: [0.32, 1.6 * scale, -0.35], look: [0.02, 1.66 * scale, 1.6], fov: 26 }],
          ], { hand: 0.002 });
          void u;
        },
      };
    },
  },
  {
    id: "4e",
    title: "The father raises his blade; a flash of steel; he falls out of view",
    dur: 1.6,
    build: (s) => {
      const room = interior(s, { burning: 1, haze: 0.6, doorBroken: true });
      const FLASH = 0.8;
      const { mom } = parents(s, {
        dad: (t) =>
          t < 0.25
            ? { x: 1.3, z: 2.95 }
            : t < FLASH + 0.05
              ? { x: lerp(1.3, 0.75, span(t, 0.25, FLASH)), z: lerp(2.95, 3.25, span(t, 0.25, FLASH)), anim: "slash", animT: (t - 0.25) * 0.6 }
              : // struck: he falls back and away, out of the slit
                { x: lerp(0.75, 1.9, span(t, FLASH, 1.5)), z: lerp(3.25, 2.6, span(t, FLASH, 1.5)), anim: "die", animT: t - FLASH - 0.05, act: { relax: 0, roll: -0.6 * span(t, FLASH, 1.4) } },
      });
      nethrak(s, (t) => ({ x: 0.25, z: 3.75, yaw: face(0.35, -1), anim: t > FLASH - 0.3 && t < FLASH + 0.5 ? "slash" : "idle", animT: t > FLASH - 0.3 ? t - (FLASH - 0.3) : undefined }));
      const flash = new THREE.PointLight(0xffe0d0, 0, 4, 1.4);
      flash.position.set(0.2, 1.4, 3.4);
      s.add(flash);
      const gap = gapView(s);
      return {
        ao: true,
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          mom.rig.face.mood("open", -1);
          flash.intensity = t >= FLASH ? 60 * Math.exp(-(t - FLASH) * 14) : 0;
          gap.set(48, 0.55);
          camera(stage, t, [
            [0, { ...GAP_CAM, fov: 48 }],
            [1.6, { pos: GAP_CAM.pos, look: [0.3, 1.7, ROOM.z1], fov: 46 }],
          ], { hand: 0.003, shake: jolt(t, FLASH, 0.01, 8) });
        },
      };
    },
  },
  {
    id: "4f",
    title: "The boy's face: fear catches in his throat; a second movement of the sword",
    dur: 1.6,
    build: (s) => {
      const room = interior(s, { burning: 1, haze: 0.3 });
      // light through the gaps in the hatch falls across his face in stripes
      const strip = new THREE.SpotLight(0xff9a50, 30, 4, 0.35, 0.2, 1.4);
      strip.position.set(HATCH.x + 0.2, 1.4, HATCH.z + 0.6);
      strip.target.position.set(HATCH.x, -0.4, HATCH.z);
      strip.castShadow = true;
      strip.shadow.mapSize.set(1024, 1024);
      s.add(strip, strip.target);
      room.cellarLight.intensity = 0.15;
      const tmp = new THREE.Vector3();
      const head = (o: number): [number, number, number] | null => {
        if (!boy) return null;
        boy.rig.head.getWorldPosition(tmp);
        return [tmp.x + o, tmp.y + 0.06, tmp.z + 0.14];
      };
      // (the path runs once while the actor is built, before `boy` exists)
      let boy: ReturnType<typeof s.person> | null = null;
      boy = s.person(PEOPLE.boy(), (t): Pose => ({
        x: HATCH.x,
        z: HATCH.z,
        floor: -1.3,
        yaw: face(0.1, 1),
        act: { relax: 1, headPitch: -0.35, reach: { r: head(-0.025), l: head(0.025), w: span(t, 0.9, 1.15) } },
      }));
      const kid = boy;
      const SECOND = 0.8;
      return {
        ao: true,
        dof: { focus: 0.75, aperture: 0.015, maxblur: 0.008 },
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          // he tries to call out; nothing comes; at the second blow, his hands cover his mouth
          kid.rig.face.mood(t < 0.95 ? "open" : "flat", -1);
          // a shadow sweeps across the light at the second blow
          strip.intensity = 30 * (t > SECOND && t < SECOND + 0.18 ? 0.25 : 1) * (0.9 + Math.sin(t * 17) * 0.1);
          kid.rig.head.getWorldPosition(tmp);
          camera(stage, t, [
            [0, { pos: [tmp.x + 0.08, tmp.y + 0.1, tmp.z + 0.85], look: [tmp.x, tmp.y + 0.06, tmp.z], fov: 32 }],
            [1.6, { pos: [tmp.x + 0.06, tmp.y + 0.1, tmp.z + 0.7], look: [tmp.x, tmp.y + 0.06, tmp.z], fov: 30 }],
          ], { hand: 0.002, shake: jolt(t, SECOND, 0.004, 9) });
        },
      };
    },
  },
  {
    id: "4g",
    title: "His mother's hand falls beside the gap; Nethrak turns to leave",
    dur: 1.8,
    build: (s) => {
      const room = interior(s, { burning: 1, haze: 0.6, doorBroken: true });
      nethrak(s, (t) => ({ ...walk([0.15, 2.7], [0.05, 4.8], 0.75, 1.8)(t), act: { relax: 1 }, yaw: keys(t, [[0.3, face(0.2, -1)], [0.8, face(0, 1)]]), anim: t > 0.75 ? "walk" : "idle" }));
      // her hand, palm down on the boards just beside the gap
      const hand = new Hand({ side: -1, scale: 1, skin: "#e0b898", sleeve: "#5a3a4a", cuff: "#efe6d4" });
      const down = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, -1), V(1, 0, 0.3).normalize(), V(0, -1, 0)));
      hand.group.quaternion.copy(down);
      hand.pose({ curl: [0.3, 0.25, 0.3, 0.35, 0.4], spread: 0.3, thumbIn: 0.2 });
      s.add(hand.group);
      const gap = gapView(s, 0.55);
      const rest = V(HATCH.x - 0.12, 0.035, HATCH.z + 0.72);
      return {
        ao: true,
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          // it drops into view and settles (0.15–0.45 s)
          const u = span(t, 0.15, 0.42);
          hand.group.position.set(rest.x - 0.06 * (1 - u), rest.y + 0.35 * (1 - u * u), rest.z);
          hand.group.rotation.z = 0;
          gap.set(46, 0.55);
          camera(stage, t, [
            [0, { ...GAP_CAM, look: [0.25, 0.5, ROOM.z1], fov: 46 }],
            [1.8, { pos: GAP_CAM.pos, look: [0.15, 0.6, ROOM.z1], fov: 44 }],
          ], { hand: 0.002, shake: jolt(t, 0.42, 0.004, 9) });
        },
      };
    },
  },
];
