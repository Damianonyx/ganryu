import * as THREE from "three";
import { camera, face, jolt, keys } from "../direct";
import { CELLAR, HATCH, ROOM, interior } from "../interior";
import { rng, type Fire, type Pose, type Shot } from "../lab";
import { PEOPLE } from "../people";
import { V, lerp, soft, span, std } from "../sets";

/**
 * Act 5, buried beneath the ruins (40–49 s):
 *   5a  flames crawl across the ceiling; the boy pushes against the hatch
 *   5b  a burning beam crashes onto the floor above, covering the hatch; darkness
 *   5c  he curls beneath the stone wall clutching the charm; smoke and orange light at the vent
 */

/** Fires along the ceiling beams, catching one after another from the door inward. */
function ceilingFire(s: Parameters<Shot["build"]>[0], from: number, to: number) {
  const r = rng(9);
  const list: { f: Fire; at: number }[] = [];
  for (let z = ROOM.z1 - 0.4; z > ROOM.z0; z -= 0.8)
    for (let x = ROOM.x0 + 0.6; x < ROOM.x1; x += 1.1) {
      const u = (ROOM.z1 - z) / (ROOM.z1 - ROOM.z0);
      const f = s.fire(V(x + (r() - 0.5) * 0.4, ROOM.h + 0.02, z), { size: 0.55, rate: 0.6, light: 1.6, smoke: 6, embers: 10, spread: 1.6, seed: Math.round(x * 31 + z * 17 + 50) });
      f.power = 0;
      list.push({ f, at: lerp(from, to, u) + (r() - 0.5) * 0.3 });
    }
  return (t: number) => {
    for (const c of list) c.f.power = keys(t, [[c.at - 0.2, 0], [c.at + 0.3, 1.2], [c.at + 2, 1]]);
  };
}

export const ACT5: Shot[] = [
  {
    id: "5a",
    title: "Flames crawl across the ceiling; the boy pushes against the hatch",
    dur: 3.0,
    build: (s) => {
      const room = interior(s, { burning: 1.2, haze: 1, doorBroken: true });
      const burn = ceilingFire(s, -1.0, 2.0);
      // light through the gaps in the lid falls on him in stripes
      const strip = new THREE.SpotLight(0xff8a40, 26, 4, 0.4, 0.3, 1.4);
      strip.position.set(HATCH.x + 0.15, 1.6, HATCH.z + 0.3);
      strip.target.position.set(HATCH.x, -1.0, HATCH.z);
      strip.castShadow = true;
      strip.shadow.mapSize.set(1024, 1024);
      s.add(strip, strip.target);
      const CUT = 1.4;
      const push = (t: number) => (t > CUT ? Math.max(0, Math.sin((t - CUT) * 9)) * span(t, CUT, CUT + 0.3) : 0);
      const boy = s.person(PEOPLE.boy(), (t): Pose => ({
        x: HATCH.x + 0.03,
        z: HATCH.z,
        floor: -CELLAR.depth + 0.08,
        yaw: face(0.2, 1),
        act: {
          relax: 1,
          headPitch: -0.5,
          drop: -0.04 - push(t) * 0.03,
          // both hands flat against the underside of the lid
          reach: { r: [HATCH.x - 0.12, -0.08 + push(t) * 0.012, HATCH.z + 0.08], l: [HATCH.x + 0.14, -0.08 + push(t) * 0.012, HATCH.z + 0.1], w: 1 },
        },
      }));
      // dust shaken loose from the boards
      const dust = Array.from({ length: 40 }, (_, i) => {
        const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: 0xc8b8a0, transparent: true, opacity: 0.5, depthWrite: false }));
        m.scale.setScalar(0.012);
        m.position.set(HATCH.x + ((i * 37) % 70) / 100 - 0.35, -0.05 - ((i * 53) % 100) / 100, HATCH.z + ((i * 71) % 70) / 100 - 0.35);
        s.add(m);
        return m;
      });
      return {
        ao: true,
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          burn(t);
          room.lid.position.y = push(t) * 0.012;
          for (const d of dust) {
            d.position.y -= dt * 0.3;
            if (d.position.y < -1.2) d.position.y = -0.05;
          }
          boy.rig.face.mood("flat", -1);
          strip.intensity = 26 * (0.85 + Math.sin(t * 13) * 0.1 + Math.sin(t * 29) * 0.05);
          if (t < CUT) {
            // the room from the floor beside the hatch: fire running along the beams
            camera(stage, t, [
              [0, { pos: [HATCH.x + 0.9, 0.3, HATCH.z + 1.6], look: [HATCH.x - 0.6, ROOM.h, HATCH.z - 1.2], fov: 50 }],
              [CUT, { pos: [HATCH.x + 0.85, 0.28, HATCH.z + 1.5], look: [HATCH.x - 0.8, ROOM.h, HATCH.z - 1.6], fov: 48 }],
            ], { hand: 0.006 });
          } else {
            // in the cellar, under him, as he pushes
            camera(stage, t, [
              [CUT, { pos: [HATCH.x + 0.55, -0.95, HATCH.z + 0.75], look: [HATCH.x, -0.25, HATCH.z], fov: 46 }],
              [3.0, { pos: [HATCH.x + 0.5, -0.92, HATCH.z + 0.68], look: [HATCH.x, -0.2, HATCH.z], fov: 44 }],
            ], { hand: 0.004, shake: push(t) * 0.002 });
          }
        },
      };
    },
  },
  {
    id: "5b",
    title: "A burning beam crashes onto the floor above, covering the hatch; darkness",
    dur: 1.4,
    build: (s) => {
      const room = interior(s, { burning: 1.2, haze: 1, doorBroken: true });
      const burn = ceilingFire(s, -3, -2);
      // the beam swings down from its socket in the wall and lands across the hatch
      const pivot = new THREE.Group();
      pivot.position.set(HATCH.x - 2.2, ROOM.h - 0.1, HATCH.z + 0.1);
      s.add(pivot);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.24, 0.24), std("#1a120c", 0.95, 0, { emissive: "#ff3a0a", emissiveIntensity: 0.35 }));
      beam.position.x = 1.5;
      beam.castShadow = true;
      pivot.add(beam);
      const flames = [0.6, 1.4, 2.2, 2.8].map((x, i) => s.fire(V(0, 0, 0), { size: 0.45, rate: 0.9, light: 2.5, smoke: 5, embers: 12, spread: 0.6, seed: 80 + i }));
      const HIT = 0.25;
      const burst = s.fire(V(HATCH.x, 0.05, HATCH.z), { size: 0.9, rate: 2, light: 9, smoke: 16, embers: 60, spread: 1.6, seed: 91 });
      burst.power = 0;
      return {
        ao: true,
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          burn(t + 5);
          // angle: from tipping (−0.5 rad) to lying on the floor across the hatch
          const land = Math.atan2(ROOM.h - 0.1 - 0.12, 2.25);
          pivot.rotation.z = t < HIT ? -lerp(0.5, land, (t / HIT) ** 2) : -land + Math.exp(-(t - HIT) * 18) * Math.sin((t - HIT) * 40) * 0.03;
          pivot.updateMatrixWorld(true);
          flames.forEach((f, i) => f.move(V([0.6, 1.4, 2.2, 2.8][i], 0.12, 0).applyMatrix4(pivot.matrixWorld)));
          burst.power = t > HIT ? Math.max(0, 2.2 - (t - HIT) * 4) : 0;
          // the light goes: darkness
          stage.renderer.toneMappingExposure = 1.25 * keys(t, [[0.4, 1], [1.4, 0.04]]);
          camera(stage, t, [
            [0, { pos: [HATCH.x + 1.7, 0.42, HATCH.z + 1.9], look: [HATCH.x - 0.2, 0.35, HATCH.z], fov: 46 }],
            [1.4, { pos: [HATCH.x + 1.6, 0.4, HATCH.z + 1.8], look: [HATCH.x - 0.2, 0.25, HATCH.z], fov: 44 }],
          ], { hand: 0.004, shake: jolt(t, HIT, 0.05, 6) });
        },
      };
    },
  },
  {
    id: "5c",
    title: "He curls beneath the stone wall clutching the charm; smoke and orange light drift past the vent",
    dur: 4.6,
    build: (s) => {
      const room = interior(s, { burning: 0.6, haze: 0, doorBroken: true, hearth: false, lamp: false });
      room.cellarLight.intensity = 0;
      // the only light: the fire outside, through the vent
      const ventLight = new THREE.SpotLight(0xff7a2a, 26, 4, 0.9, 0.7, 1.4);
      ventLight.position.set(CELLAR.x1 - 0.05, -0.22, (CELLAR.z0 + CELLAR.z1) / 2 + 0.4);
      ventLight.target.position.set(CELLAR.x1 - 0.6, -1.3, CELLAR.z0 + 0.3);
      ventLight.castShadow = true;
      ventLight.shadow.mapSize.set(1024, 1024);
      s.add(ventLight, ventLight.target);
      const cool = new THREE.PointLight(0x4a5a80, 1.6, 3, 1.5);
      cool.position.set(CELLAR.x0 + 1.0, -0.7, CELLAR.z1 - 0.4);
      s.add(cool);
      // curled up in the corner, knees drawn up, the charm held to his chest
      // in the corner under the vent's wall
      const sit = V(CELLAR.x1 - 0.38, -CELLAR.depth, CELLAR.z0 + 0.42);
      const boy = s.person(PEOPLE.boy(0.4), (): Pose => ({
        x: sit.x,
        z: sit.z,
        floor: sit.y,
        yaw: face(-1, 0.9),
        act: {
          relax: 1,
          drop: 0.43,
          hipZ: -0.08,
          lean: 0.55,
          headPitch: 0.55,
          feet: [
            { x: -0.05, z: 0.2 },
            { x: 0.05, z: 0.19 },
          ],
          ra: { x: -1.1, z: -0.25, elbow: -1.7, wx: 0.3 },
          la: { x: -1.25, z: -0.35, elbow: -1.9, wx: 0.4 },
        },
      }));
      boy.rig.props.charm.visible = true;
      // smoke curls in through the vent and drifts across the cellar
      const r = rng(4);
      const puffs = Array.from({ length: 14 }, (_, i) => {
        const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: 0x6a5a54, transparent: true, opacity: 0, depthWrite: false }));
        s.add(m);
        return { m, age: (i / 14) * 4, life: 4 + r() * 1.5, dz: (r() - 0.5) * 0.6 };
      });
      return {
        ao: true,
        update: ({ stage, t, dt }) => {
          room.tick(t, dt);
          // heartbeats at 1.0, 1.9, and 2.8 s: the light pulses with them
          const beat = [1.0, 1.9, 2.8].reduce((a, b) => a + (t > b ? Math.exp(-(t - b) * 9) : 0), 0);
          ventLight.intensity = 26 * (0.8 + Math.sin(t * 5.3) * 0.1 + Math.sin(t * 11.7) * 0.08) * (1 + beat * 0.25);
          for (const p of puffs) {
            p.age += dt;
            if (p.age > p.life) p.age -= p.life;
            const u = p.age / p.life;
            p.m.position.set(CELLAR.x1 - 0.1 - u * 1.4, -0.22 - u * 0.25 + Math.sin(u * 6) * 0.05, ventLight.position.z + p.dz * u);
            p.m.scale.setScalar(0.12 + u * 0.7);
            p.m.material.opacity = Math.sin(u * Math.PI) * 0.28;
          }
          boy.rig.face.mood("flat", -1);
          camera(stage, t, [
            [0, { pos: [CELLAR.x0 + 0.35, -0.5, CELLAR.z1 - 0.75], look: [CELLAR.x1 - 0.35, -0.75, CELLAR.z0 + 0.55], fov: 50 }],
            [4.6, { pos: [CELLAR.x0 + 0.6, -0.62, CELLAR.z1 - 1.0], look: [CELLAR.x1 - 0.35, -0.85, CELLAR.z0 + 0.45], fov: 44 }],
          ], { hand: 0.003, shake: beat * 0.0015, ease: (u) => u });
        },
      };
    },
  },
];
