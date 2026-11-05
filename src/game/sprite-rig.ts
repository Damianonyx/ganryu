import * as THREE from "three";
import type { Rig } from "./mesh";
import type { AnimName, CharacterDef } from "./types";

/**
 * 2.5D anime fighter: the character art from the turnaround sheets drawn as
 * a camera-facing cut-out inside the 3D arena.
 *
 * - Picks the sheet view (front, ¾, profile, back) from the angle between
 *   the fighter's facing and the camera, mirroring where needed.
 * - Motion is procedural: breathing, walk bob, wind-up/lunge slashes with a
 *   glowing arc, parry recoil, leap squash/stretch, hit knockback, falls,
 *   and afterimages for arts. Combat timing is unchanged (fighter.ts).
 *
 * Implements the same Rig interface as the old mesh puppets, so the engine
 * and combat code do not change.
 */

export type ViewName = "front" | "front34" | "left" | "right" | "back34" | "back";
const VIEWS: ViewName[] = ["front", "front34", "left", "right", "back34", "back"];

export const spriteUrl = (id: string, view: ViewName) => `/fighters/${id}/${view}.webp`;
export const allSpriteUrls = (ids: string[]) => ids.flatMap((id) => VIEWS.map((v) => spriteUrl(id, v)));

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

function tex(url: string) {
  let t = cache.get(url);
  if (!t) {
    t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(url, t);
  }
  return t;
}

const PLANE = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
const ARC = new THREE.RingGeometry(0.55, 0.95, 40, 1, -0.2, 2.6);
const SHADOW = new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2);

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
const bump = (a: number, b: number, c: number, t: number) => smooth(a, b, t) * (1 - smooth(b, c, t));

export function buildSpriteRig(def: CharacterDef): Rig {
  const height = 1.95 * def.kit.scale;
  const accent = new THREE.Color(def.kit.accent);
  const textures = Object.fromEntries(VIEWS.map((v) => [v, tex(spriteUrl(def.id, v))])) as Record<ViewName, THREE.Texture>;

  const root = new THREE.Group();
  const move = new THREE.Group(); // lunges along the fighter's facing
  const bill = new THREE.Group(); // turns to face the camera
  const pose = new THREE.Group(); // lean / squash / shake, pivot at the feet
  root.add(move);
  move.add(bill);
  bill.add(pose);

  const mat = new THREE.MeshStandardMaterial({
    map: textures.front34,
    transparent: true,
    alphaTest: 0.08,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(1, 1, 1),
    emissiveMap: textures.front34,
    emissiveIntensity: 0.55,
  });
  const mesh = new THREE.Mesh(PLANE, mat);
  mesh.renderOrder = 2;
  pose.add(mesh);

  const hsl = { h: 0, s: 0, l: 0 };
  accent.getHSL(hsl);
  const arcColor = new THREE.Color().setHSL(hsl.h, Math.max(0.75, hsl.s), 0.62);
  const arcMat = new THREE.MeshBasicMaterial({ color: arcColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const arc = new THREE.Mesh(ARC, arcMat);
  arc.scale.setScalar(height * 0.62);
  arc.position.set(0, height * 0.52, 0.05);
  arc.renderOrder = 3;
  bill.add(arc);

  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false });
  const shadow = new THREE.Mesh(SHADOW, shadowMat);
  shadow.scale.set(height * 0.42, 1, height * 0.24);
  shadow.position.y = 0.012;
  root.add(shadow);

  let view: ViewName = "front34";
  let flip = 1;
  let screenSign = 1; // +1 when the fighter faces screen-right
  let anim: AnimName = "idle";
  let animT = 0;
  let animSpeed = 1;
  let clock = 0;
  let lastFrame = performance.now();
  let folding = false;
  let flashUntil = 0;
  const ghosts: { mesh: THREE.Mesh; life: number }[] = [];
  let ghostTimer = 0;

  const camPos = new THREE.Vector3();
  const wp = new THREE.Vector3();
  const camRight = new THREE.Vector3();

  function chooseView(rel: number) {
    // rel: angle (radians, -π..π) between the fighter's facing and the camera direction
    const a = Math.abs(rel);
    const deg = (a * 180) / Math.PI;
    const hyst = 6;
    const bands: [number, ViewName][] = [
      [28, "front"],
      [72, "front34"],
      [112, "profile" as ViewName],
      [152, "back34"],
      [181, "back"],
    ];
    let next: ViewName = "back";
    for (const [lim, v] of bands) {
      if (deg < lim + (v === view || (v === ("profile" as ViewName) && (view === "left" || view === "right")) ? hyst : 0)) {
        next = v;
        break;
      }
    }
    if (next === ("profile" as ViewName)) next = screenSign > 0 ? "left" : "right";
    view = next;
    flip = next === "front34" || next === "back34" ? (screenSign > 0 ? -1 : 1) : 1;
  }

  mesh.onBeforeRender = (_r, scene, camera) => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    clock += dt;

    camera.getWorldPosition(camPos);
    root.getWorldPosition(wp);
    const toCamX = camPos.x - wp.x;
    const toCamZ = camPos.z - wp.z;
    const yaw = root.rotation.y;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    screenSign = fx * camRight.x + fz * camRight.z >= 0 ? 1 : -1;
    const rel = Math.atan2(fx * toCamZ - fz * toCamX, fx * toCamX + fz * toCamZ);
    chooseView(rel);

    // billboard: undo the fighter's yaw, then face the camera
    bill.rotation.y = Math.atan2(toCamX, toCamZ) - yaw;

    const t = textures[view];
    if (mat.map !== t) {
      mat.map = t;
      mat.emissiveMap = t;
      mat.needsUpdate = true;
    }
    const img = t.image as HTMLImageElement | undefined;
    const aspect = img && img.width ? img.width / img.height : 0.42;
    // Until the art has loaded, shrink rather than hide: a hidden mesh is never
    // rendered, so this callback would never run again to reveal it.
    const loaded = !!(img && img.width);
    mesh.scale.set(loaded ? height * aspect * flip : 1e-4, loaded ? height : 1e-4, 1);

    applyPose(dt, scene);
  };

  function applyPose(dt: number, scene: THREE.Object3D) {
    const s = screenSign;
    const t = animT;
    let lean = 0; // + leans toward the facing direction on screen
    let sx = 1;
    let sy = 1 + 0.012 * Math.sin(clock * 2.3);
    let bob = 0;
    let lunge = 0;
    let shake = 0;
    let fall = 0;
    let arcA = 0;
    let arcRot = 0;
    let glow = 0;
    let fade = 1;

    const a = anim === "idle" && animSpeed > 1.12 ? "walk" : anim;
    switch (a) {
      case "walk": {
        const ph = clock * 9 * Math.max(0.6, animSpeed);
        bob = Math.abs(Math.sin(ph)) * 0.05;
        lean = 0.07;
        sy *= 1 - 0.02 * Math.abs(Math.cos(ph));
        break;
      }
      case "slash": {
        const wind = bump(0, 0.07, 0.1, t);
        const strike = bump(0.07, 0.13, 0.32, t);
        lean = -0.14 * wind + 0.3 * strike;
        lunge = -0.08 * wind + 0.5 * strike;
        sx = 1 + 0.05 * wind + 0.07 * strike;
        sy = 1 - 0.04 * wind - 0.03 * strike;
        arcA = bump(0.08, 0.12, 0.26, t);
        arcRot = -0.9 + smooth(0.07, 0.22, t) * 2.2;
        break;
      }
      case "parry": {
        const k = bump(0, 0.06, 0.38, t);
        lean = -0.16 * k;
        sx = 1 - 0.03 * k;
        glow = bump(0, 0.04, 0.22, t);
        break;
      }
      case "leap": {
        const crouch = bump(0, 0.05, 0.12, t);
        sy = 1 - 0.1 * crouch + 0.08 * smooth(0.08, 0.2, t) * (1 - smooth(0.35, 0.6, t));
        sx = 1 + 0.08 * crouch - 0.04 * smooth(0.08, 0.2, t);
        lean = 0.18 * smooth(0.05, 0.25, t);
        break;
      }
      case "hurt": {
        const k = 1 - smooth(0.0, 0.28, t);
        lean = -0.22 * k;
        lunge = -0.15 * k;
        shake = Math.sin(t * 90) * 0.045 * k;
        break;
      }
      case "die": {
        fall = smooth(0.05, 0.6, t);
        lean = -1.45 * fall;
        bob = -0.06 * fall;
        fade = 1 - 0.55 * smooth(0.6, 1.6, t);
        break;
      }
      case "special":
      case "fold": {
        const k = bump(0, 0.1, 0.5, t);
        sx = 1 + 0.06 * k;
        sy = 1 + 0.06 * k;
        lean = 0.12 * k;
        glow = k;
        ghostTimer -= dt;
        if (ghostTimer <= 0 && t < 0.45) {
          ghostTimer = 0.05;
          spawnGhost(scene);
        }
        break;
      }
    }

    pose.rotation.z = -s * lean;
    pose.position.set(shake, bob, 0);
    pose.scale.set(sx, sy, 1);
    move.position.z = -lunge;
    arcMat.opacity = arcA * 0.85;
    arc.rotation.z = s > 0 ? -arcRot : Math.PI + arcRot;
    arc.scale.x = height * 0.62 * (s > 0 ? 1 : -1);

    const now = performance.now();
    if (now < flashUntil) {
      mat.emissive.setRGB(1, 0.25, 0.15);
      mat.emissiveIntensity = 1.1;
    } else if (folding) {
      mat.emissive.setRGB(0.7, 0.8, 1);
      mat.emissiveIntensity = 0.95;
    } else if (glow > 0) {
      mat.emissive.copy(accent).lerp(new THREE.Color(1, 1, 1), 0.5);
      mat.emissiveIntensity = 0.55 + glow * 0.7;
    } else {
      mat.emissive.setRGB(1, 1, 1);
      mat.emissiveIntensity = 0.55;
    }
    mat.opacity = fade;
    shadowMat.opacity = 0.38 * fade;

    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i];
      g.life -= dt;
      (g.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, g.life / 0.35) * 0.45;
      if (g.life <= 0) {
        g.mesh.parent?.remove(g.mesh);
        (g.mesh.material as THREE.Material).dispose();
        ghosts.splice(i, 1);
      }
    }
  }

  function spawnGhost(scene: THREE.Object3D) {
    const gm = new THREE.MeshBasicMaterial({ map: mat.map, color: accent.clone().lerp(new THREE.Color(1, 1, 1), 0.3), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, alphaTest: 0.08, side: THREE.DoubleSide });
    const g = new THREE.Mesh(PLANE, gm);
    mesh.updateWorldMatrix(true, false);
    g.matrixAutoUpdate = false;
    g.matrix.copy(mesh.matrixWorld);
    scene.add(g);
    ghosts.push({ mesh: g, life: 0.35 });
  }

  const empty = () => new THREE.Group();
  return {
    root,
    body: pose,
    head: empty(),
    torso: empty(),
    lArm: empty(),
    rArm: empty(),
    lLeg: empty(),
    rLeg: empty(),
    weapon: empty(),
    weapon2: null,
    sash: null,
    materials: [mat],
    setAnim: (name, t, speed) => {
      anim = name;
      animT = t;
      animSpeed = speed;
    },
    setFolding: (on) => {
      folding = on;
    },
    flash: () => {
      flashUntil = performance.now() + 90;
    },
    dispose: () => {
      for (const g of ghosts) {
        g.mesh.parent?.remove(g.mesh);
        (g.mesh.material as THREE.Material).dispose();
      }
      ghosts.length = 0;
      mat.dispose();
      arcMat.dispose();
      shadowMat.dispose();
    },
  };
}
