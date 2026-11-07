import * as THREE from "three";
import { motion } from "./motion";
import { contactShadow, studioUpgrade, withBlend } from "./rig-kit";
import { buildSamurai } from "./rig-samurai";
import type { AnimName, CharacterDef } from "./types";

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  cone: new THREE.ConeGeometry(1, 1, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  hakama: new THREE.CylinderGeometry(0.2, 0.42, 0.92, 14),
  sleeve: new THREE.CylinderGeometry(0.11, 0.16, 0.48, 10),
  brim: new THREE.CylinderGeometry(0.62, 0.68, 0.045, 20),
  blade: new THREE.BoxGeometry(0.018, 1.14, 0.055),
};

function mat(
  color: string,
  opts?: { emissive?: string; rough?: number; metal?: number; eInt?: number },
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.rough ?? 0.7,
    metalness: opts?.metal ?? 0.06,
    emissive: opts?.emissive ?? "#000000",
    emissiveIntensity: opts?.eInt ?? (opts?.emissive ? 0.7 : 0),
  });
}

function mesh(
  g: THREE.BufferGeometry,
  m: THREE.Material,
  sx: number,
  sy: number,
  sz: number,
  x = 0,
  y = 0,
  z = 0,
) {
  const o = new THREE.Mesh(g, m);
  o.scale.set(sx, sy, sz);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

export type Rig = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Object3D;
  torso: THREE.Object3D;
  lArm: THREE.Group;
  rArm: THREE.Group;
  lLeg: THREE.Group;
  rLeg: THREE.Group;
  weapon: THREE.Group;
  weapon2: THREE.Group | null;
  sash: THREE.Object3D | null;
  materials: THREE.Material[];
  setAnim: (name: AnimName, t: number, speed: number, facing: 1 | -1) => void;
  /** Per-frame motion input: velocity (world), facing yaw, and height above the floor. */
  drive?: (dt: number, vx: number, vz: number, yaw: number, y: number, x?: number, z?: number) => void;
  setFolding: (on: boolean) => void;
  flash: (c: number) => void;
  dispose: () => void;
};

export function buildRig(def: CharacterDef): Rig {
  const k = def.kit;
  const tokens = () => motion.pose;
  if (k.body === "human") {
    const rig = buildSamurai(def);
    // The gait runs continuously through idle and walk; blend everything else.
    const both = (n: AnimName) => n === "idle" || n === "walk";
    rig.setAnim = withBlend(rig.body, rig.setAnim, tokens, (a, b) => both(a) && both(b));
    return rig;
  }
  const rig = k.body === "beast" ? buildBeast(def) : k.body === "titan" ? buildTitan(def) : buildSovereign(def);
  // These bodies were modeled facing +Z, but the game moves fighters toward -Z.
  if (k.body !== "beast") {
    const turn = new THREE.Group();
    turn.rotation.y = Math.PI;
    for (const c of [...rig.root.children]) turn.add(c);
    rig.root.add(turn);
  }
  rig.materials.forEach((m) => studioUpgrade(m as THREE.MeshStandardMaterial, k.body !== "beast"));
  rig.setAnim = withBlend(rig.body, rig.setAnim, tokens);
  const shadow = contactShadow(0.6 * k.scale);
  rig.root.add(shadow);
  rig.drive = (_dt, _vx, _vz, _yaw, y) => {
    shadow.position.y = -y + 0.012;
    const s = 1 / (1 + y * 0.7);
    shadow.scale.setScalar(s);
    (shadow.material as THREE.MeshBasicMaterial).opacity = 0.6 * s * s;
  };
  const dispose = rig.dispose;
  rig.dispose = () => {
    dispose();
    shadow.geometry.dispose();
    (shadow.material as THREE.Material).dispose();
  };
  return rig;
}

function finish(
  root: THREE.Group,
  body: THREE.Group,
  head: THREE.Object3D,
  torso: THREE.Object3D,
  lArm: THREE.Group,
  rArm: THREE.Group,
  lLeg: THREE.Group,
  rLeg: THREE.Group,
  weapon: THREE.Group,
  weapon2: THREE.Group | null,
  sash: THREE.Object3D | null,
  materials: THREE.MeshStandardMaterial[],
  setAnim: Rig["setAnim"],
): Rig {
  const orig = materials.map((m) => m.emissive.clone());
  const origInt = materials.map((m) => m.emissiveIntensity);
  let foldOn = false;
  const setFolding = (on: boolean) => {
    foldOn = on;
    for (let i = 0; i < materials.length; i++) {
      if (on) {
        materials[i].emissive.setRGB(0.35, 0.32, 0.28);
        materials[i].emissiveIntensity = 0.55;
      } else {
        materials[i].emissive.copy(orig[i]);
        materials[i].emissiveIntensity = origInt[i];
      }
    }
  };
  const flash = (c: number) => {
    for (let i = 0; i < materials.length; i++) {
      materials[i].emissive.setRGB(c, c * 0.35, 0.12);
      materials[i].emissiveIntensity = 0.9;
    }
    window.setTimeout(() => {
      if (foldOn) return;
      for (let i = 0; i < materials.length; i++) {
        materials[i].emissive.copy(orig[i]);
        materials[i].emissiveIntensity = origInt[i];
      }
    }, 70);
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
    weapon2,
    sash,
    materials,
    setAnim,
    setFolding,
    flash,
    dispose: () => materials.forEach((m) => m.dispose()),
  };
}

function buildBeast(def: CharacterDef): Rig {
  const k = def.kit;
  const fur = mat(k.cloth, { rough: 0.92 });
  const belly = mat(k.accent, { rough: 0.72 });
  const claw = mat(k.trim, { rough: 0.3, metal: 0.55, emissive: k.trim, eInt: 0.45 });
  const glow = mat(k.trim, { emissive: k.trim, eInt: 0.9 });
  const dark = mat("#121214", { rough: 0.55 });
  const pad = mat("#1a1412", { rough: 0.8 });
  const mats = [fur, belly, claw, glow, dark, pad];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.scale.setScalar(k.scale);

  const isWolf = (def.id as string) === "werewolf";
  const isChimera = (def.id as string) === "chimera";
  const isHell = (def.id as string) === "hellwolf";
  const bulk = isChimera ? 1.12 : isHell ? 1.04 : 1;

  const hipsG = new THREE.Group();
  hipsG.position.set(0, 0.92, 0);
  body.add(hipsG);
  hipsG.add(mesh(GEO.box, fur, 0.38 * bulk, 0.18, 0.26, 0, 0, 0));

  const torsoG = new THREE.Group();
  torsoG.position.set(0, 1.16, -0.04);
  body.add(torsoG);
  const torso = mesh(GEO.box, fur, 0.44 * bulk, 0.52, 0.3, 0, 0.18, 0);
  const chest = mesh(GEO.sphere, belly, 0.28 * bulk, 0.22, 0.2, 0, 0.1, -0.12);
  const shoulders = mesh(GEO.box, fur, 0.56 * bulk, 0.18, 0.24, 0, 0.4, 0);
  torsoG.add(torso, chest, shoulders);
  torsoG.add(mesh(GEO.sphere, fur, 0.3 * bulk, 0.16, 0.2, 0, 0.46, 0.04));

  if (isHell) {
    for (let i = 0; i < 5; i++) {
      const s = mesh(GEO.cone, glow, 0.035, 0.28 + (i % 2) * 0.08, 0.035, (i - 2) * 0.07, 0.22, 0.16);
      s.rotation.x = 0.9;
      torsoG.add(s);
    }
    torsoG.add(mesh(GEO.box, glow, 0.04, 0.36, 0.03, 0, 0.18, -0.16));
  }
  if (isChimera) {
    for (let i = 0; i < 8; i++) {
      const sx = ((i * 17) % 7) - 3;
      const sy = ((i * 11) % 5) - 1;
      torsoG.add(mesh(GEO.sphere, belly, 0.05, 0.04, 0.05, sx * 0.06, 0.08 + sy * 0.08, -0.14));
    }
  }

  const tailG = new THREE.Group();
  tailG.position.set(0, 0.08, 0.14);
  hipsG.add(tailG);
  const tail = mesh(GEO.cyl, fur, 0.07, 0.55, 0.07, 0, 0.18, 0.18);
  tail.rotation.x = 0.95;
  tailG.add(tail);
  const tailTip = mesh(GEO.cyl, isHell ? glow : fur, 0.045, 0.42, 0.045, 0, 0.22, 0.52);
  tailTip.rotation.x = 1.15;
  tailG.add(tailTip);

  const mkLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.15, 0, 0.02);
    hipsG.add(leg);
    leg.add(mesh(GEO.cyl, fur, 0.1 * bulk, 0.4, 0.11, 0, -0.18, 0.02));
    const shin = new THREE.Group();
    shin.position.set(0, -0.38, 0.04);
    leg.add(shin);
    shin.add(mesh(GEO.cyl, fur, 0.075, 0.36, 0.08, 0, -0.16, -0.02));
    shin.add(mesh(GEO.box, pad, 0.14, 0.07, 0.22, 0, -0.36, -0.06));
    for (let i = 0; i < 3; i++) {
      const toe = mesh(GEO.cone, claw, 0.018, 0.1, 0.018, (i - 1) * 0.04, -0.38, -0.16);
      toe.rotation.x = -Math.PI * 0.55;
      shin.add(toe);
    }
    return { leg, shin };
  };
  const L = mkLeg(-1);
  const R = mkLeg(1);
  const lLeg = L.leg;
  const rLeg = R.leg;
  const lShin = L.shin;
  const rShin = R.shin;

  const mkArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.32 * bulk, 0.38, -0.04);
    torsoG.add(arm);
    arm.add(mesh(GEO.cyl, fur, 0.09 * bulk, 0.36, 0.1, 0, -0.16, 0));
    const fore = new THREE.Group();
    fore.position.set(0, -0.34, 0);
    arm.add(fore);
    fore.add(mesh(GEO.cyl, fur, 0.075, 0.32, 0.08, 0, -0.14, 0));
    const hand = new THREE.Group();
    hand.position.set(0, -0.32, -0.04);
    fore.add(hand);
    hand.add(mesh(GEO.sphere, fur, 0.08, 0.07, 0.09, 0, 0, 0));
    for (let i = 0; i < 4; i++) {
      const c = mesh(GEO.cone, isHell ? glow : claw, 0.02, 0.28, 0.02, (i - 1.5) * 0.038, -0.15, -0.05);
      c.rotation.x = Math.PI - 0.42;
      hand.add(c);
    }
    return { arm, fore, hand };
  };
  const LA = mkArm(-1);
  const RA = mkArm(1);
  const lArm = LA.arm;
  const rArm = RA.arm;
  const lFore = LA.fore;
  const rFore = RA.fore;

  const headG = new THREE.Group();
  headG.position.set(0, 0.52, -0.08);
  torsoG.add(headG);
  headG.add(mesh(GEO.sphere, fur, 0.2, 0.18, 0.22, 0, 0.08, 0));
  headG.add(mesh(GEO.box, fur, 0.16, 0.12, 0.22, 0, -0.02, -0.18));
  headG.add(mesh(GEO.sphere, belly, 0.08, 0.05, 0.1, 0, -0.04, -0.24));
  headG.add(mesh(GEO.cone, dark, 0.035, 0.07, 0.035, 0, -0.02, -0.32));
  const fangL = mesh(GEO.cone, claw, 0.018, 0.08, 0.018, -0.04, -0.08, -0.26);
  const fangR = mesh(GEO.cone, claw, 0.018, 0.08, 0.018, 0.04, -0.08, -0.26);
  fangL.rotation.x = Math.PI;
  fangR.rotation.x = Math.PI;
  headG.add(fangL, fangR);
  headG.add(mesh(GEO.sphere, glow, 0.035, 0.035, 0.035, -0.08, 0.1, -0.16));
  headG.add(mesh(GEO.sphere, glow, 0.035, 0.035, 0.035, 0.08, 0.1, -0.16));
  const earL = mesh(GEO.cone, fur, 0.055, 0.24, 0.05, -0.12, 0.26, 0.04);
  const earR = mesh(GEO.cone, fur, 0.055, 0.24, 0.05, 0.12, 0.26, 0.04);
  earL.rotation.z = 0.28;
  earR.rotation.z = -0.28;
  earL.rotation.x = 0.2;
  earR.rotation.x = 0.2;
  headG.add(earL, earR);
  const innerL = mesh(GEO.cone, isHell ? glow : belly, 0.03, 0.12, 0.028, -0.12, 0.24, 0.02);
  const innerR = mesh(GEO.cone, isHell ? glow : belly, 0.03, 0.12, 0.028, 0.12, 0.24, 0.02);
  innerL.rotation.z = 0.28;
  innerR.rotation.z = -0.28;
  headG.add(innerL, innerR);

  if (isWolf) {
    headG.add(mesh(GEO.sphere, fur, 0.18, 0.1, 0.16, 0, 0.16, 0.08));
  }
  if (isChimera) {
    const h1 = mesh(GEO.cone, claw, 0.045, 0.48, 0.045, -0.1, 0.32, 0.02);
    const h2 = mesh(GEO.cone, claw, 0.045, 0.48, 0.045, 0.1, 0.32, 0.02);
    h1.rotation.z = 0.42;
    h2.rotation.z = -0.42;
    h1.rotation.x = 0.15;
    h2.rotation.x = 0.15;
    headG.add(h1, h2);
  }

  const weapon = new THREE.Group();
  RA.hand.add(weapon);
  const weapon2 = new THREE.Group();
  LA.hand.add(weapon2);

  const setAnim: Rig["setAnim"] = (name, t, speed) => {
    const w = t * speed;
    const breath = Math.sin(w * 2.15) * 0.016;
    const hunch = -0.28;

    body.rotation.set(0, 0, 0);
    body.position.y = name === "leap" ? Math.sin(Math.min(1, t * 1.7) * Math.PI) * 1.15 : breath;
    body.scale.y = name === "hurt" ? 0.96 : name === "leap" ? 1.05 : 1;
    hipsG.rotation.set(0, 0, 0);
    torsoG.rotation.set(hunch, 0, 0);
    headG.rotation.set(-hunch + 0.04, 0, 0);
    tailG.rotation.set(0.12, 0, Math.sin(w * 2.6) * 0.22);
    tailTip.rotation.x = 1.15 + Math.sin(w * 3.2) * 0.18;

    lLeg.rotation.set(0.32, 0, 0.06);
    rLeg.rotation.set(0.32, 0, -0.06);
    lShin.rotation.x = -0.58;
    rShin.rotation.x = -0.58;
    lArm.rotation.set(-0.45, 0, 0.38);
    rArm.rotation.set(-0.45, 0, -0.38);
    lFore.rotation.x = 0.35;
    rFore.rotation.x = 0.35;

    if (name === "idle" || name === "walk") {
      const walk = name === "walk";
      const a = Math.sin(w * (walk ? 7.6 : 1.55));
      const amp = walk ? 0.7 : 0.07;
      lLeg.rotation.x = 0.32 + a * amp;
      rLeg.rotation.x = 0.32 - a * amp;
      lShin.rotation.x = -0.58 + Math.max(0, -a) * amp * 0.85;
      rShin.rotation.x = -0.58 + Math.max(0, a) * amp * 0.85;
      lArm.rotation.x = -0.45 - a * amp * 0.7;
      rArm.rotation.x = -0.45 + a * amp * 0.7;
      lArm.rotation.z = 0.38 - Math.abs(a) * 0.08;
      rArm.rotation.z = -0.38 + Math.abs(a) * 0.08;
      lFore.rotation.x = 0.35 + Math.max(0, a) * 0.2;
      rFore.rotation.x = 0.35 + Math.max(0, -a) * 0.2;
      torsoG.rotation.y = a * (walk ? 0.14 : 0.04);
      hipsG.rotation.z = a * (walk ? 0.1 : 0.02);
      hipsG.rotation.y = a * (walk ? 0.08 : 0.02);
      headG.rotation.y = -a * 0.1;
      if (walk) {
        body.position.y = breath + Math.abs(a) * 0.055;
        tailG.rotation.z = a * 0.32;
      }
    }

    if (name === "slash") {
      const p = Math.min(1, t / 0.42);
      if (p < 0.22) {
        const u = p / 0.22;
        rArm.rotation.set(-0.2 - u * 2.15, 0.35 * u, -0.42 - u * 0.55);
        rFore.rotation.x = -0.2;
        lArm.rotation.set(0.5, -0.1, 0.55);
        torsoG.rotation.y = -u * 0.7;
        torsoG.rotation.z = u * 0.12;
        headG.rotation.y = -u * 0.25;
        lLeg.rotation.x = 0.2;
        rLeg.rotation.x = 0.45;
      } else if (p < 0.52) {
        const u = (p - 0.22) / 0.3;
        rArm.rotation.set(-2.35 + u * 3.55, 0.35 - u * 0.15, -0.97 + u * 1.15);
        rFore.rotation.x = -0.2 + u * 0.9;
        torsoG.rotation.y = -0.7 + u * 1.15;
        lArm.rotation.set(0.5 - u * 1.4, 0, 0.55);
        headG.rotation.y = -0.25 + u * 0.4;
        lLeg.rotation.x = 0.15;
        rLeg.rotation.x = 0.5;
        tailG.rotation.z = -0.25 + u * 0.5;
      } else {
        const u = (p - 0.52) / 0.48;
        lArm.rotation.set(-1.1 - u * 1.2 + u * u * 3.2, -0.35, 0.7 - u * 1.0);
        lFore.rotation.x = -0.1 + u * 0.7;
        rArm.rotation.set(1.05, 0.15, 0.25);
        rFore.rotation.x = 0.35;
        torsoG.rotation.y = 0.45 - u * 1.05;
        headG.rotation.y = 0.22 - u * 0.15;
        lLeg.rotation.x = 0.45;
        rLeg.rotation.x = 0.18;
        tailG.rotation.z = 0.25 - u * 0.45;
      }
    }

    if (name === "parry") {
      rArm.rotation.set(-1.45, 0.55, -1.05);
      lArm.rotation.set(-1.45, -0.55, 1.05);
      rFore.rotation.x = 0.55;
      lFore.rotation.x = 0.55;
      torsoG.rotation.x = hunch - 0.12;
      headG.rotation.x = -0.08;
    }

    if (name === "hurt") {
      torsoG.rotation.x = hunch + 0.22;
      torsoG.rotation.z = 0.14;
      headG.rotation.x = 0.18;
      body.position.z = -0.1;
      lArm.rotation.x = -0.5;
      rArm.rotation.x = -0.35;
    }

    if (name === "die") {
      body.rotation.x = Math.min(1.35, t * 1.9);
      body.position.y = Math.min(0.2, t) * -0.4;
      lArm.rotation.x = -0.6;
      rArm.rotation.x = 0.4;
      tailG.rotation.x = 0.6;
    }

    if (name === "special" || name === "fold") {
      const lift = Math.sin(Math.min(1, t * 2.6) * Math.PI);
      body.position.y = breath + lift * 0.48;
      rArm.rotation.set(-2.25, 0.2, -0.4);
      lArm.rotation.set(-2.15, -0.2, 0.4);
      rFore.rotation.x = 0.2;
      lFore.rotation.x = 0.2;
      headG.rotation.x = -0.35;
      torsoG.rotation.x = hunch - 0.12;
      tailG.rotation.x = 0.55;
    }

    if (name === "leap") {
      lLeg.rotation.x = 0.85;
      rLeg.rotation.x = 0.7;
      lShin.rotation.x = -1.05;
      rShin.rotation.x = -0.9;
      rArm.rotation.set(-1.85, 0.15, -0.35);
      lArm.rotation.set(-1.7, -0.15, 0.35);
      rFore.rotation.x = 0.15;
      lFore.rotation.x = 0.15;
      torsoG.rotation.x = hunch - 0.22;
      headG.rotation.x = -hunch + 0.1;
      tailG.rotation.x = 0.55;
    }
  };

  return finish(root, body, headG, torso, lArm, rArm, lLeg, rLeg, weapon, weapon2, null, mats, setAnim);
}

function buildTitan(def: CharacterDef): Rig {
  const k = def.kit;
  const hide = mat(k.cloth, { rough: 0.88 });
  const glow = mat(k.accent, { emissive: k.trim, eInt: 0.9 });
  const bone = mat(k.skin, { rough: 0.55 });
  const mats = [hide, glow, bone];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.scale.setScalar(k.scale * 0.7);

  const torso = mesh(GEO.box, hide, 0.85, 1.35, 0.5, 0, 1.42, 0);
  const rib = mesh(GEO.box, bone, 0.7, 0.5, 0.2, 0, 1.5, 0.18);
  body.add(torso, rib);
  const headG = new THREE.Group();
  headG.position.set(0, 2.28, 0.08);
  headG.add(mesh(GEO.box, bone, 0.4, 0.48, 0.38, 0, 0, 0));
  headG.add(mesh(GEO.sphere, glow, 0.055, 0.055, 0.055, -0.1, 0.08, 0.18));
  headG.add(mesh(GEO.sphere, glow, 0.055, 0.055, 0.055, 0.1, 0.08, 0.18));
  const horn = mesh(GEO.cone, bone, 0.07, 0.58, 0.07, -0.16, 0.42, -0.04);
  horn.rotation.z = 0.45;
  const horn2 = mesh(GEO.cone, bone, 0.05, 0.4, 0.05, 0.16, 0.38, -0.04);
  horn2.rotation.z = -0.35;
  headG.add(horn, horn2);
  body.add(headG);

  const lArm = new THREE.Group();
  const rArm = new THREE.Group();
  lArm.position.set(-0.58, 1.95, 0);
  rArm.position.set(0.58, 1.95, 0);
  const lFore = new THREE.Group();
  const rFore = new THREE.Group();
  lFore.position.y = -0.7;
  rFore.position.y = -0.7;
  lArm.add(mesh(GEO.cyl, hide, 0.15, 0.75, 0.15, 0, -0.35, 0));
  rArm.add(mesh(GEO.cyl, hide, 0.15, 0.75, 0.15, 0, -0.35, 0));
  lFore.add(mesh(GEO.cyl, hide, 0.13, 0.7, 0.13, 0, -0.3, 0));
  rFore.add(mesh(GEO.cyl, hide, 0.13, 0.7, 0.13, 0, -0.3, 0));
  const clawShape = (g: THREE.Group) => {
    g.add(mesh(GEO.box, bone, 0.26, 0.16, 0.34, 0, -0.7, 0.08));
    for (let i = 0; i < 3; i++) g.add(mesh(GEO.cone, bone, 0.04, 0.28, 0.04, (i - 1) * 0.08, -0.88, 0.16));
  };
  clawShape(lFore);
  clawShape(rFore);
  lArm.add(lFore);
  rArm.add(rFore);
  body.add(lArm, rArm);

  const lLeg = new THREE.Group();
  const rLeg = new THREE.Group();
  lLeg.position.set(-0.26, 0.78, 0);
  rLeg.position.set(0.26, 0.78, 0);
  lLeg.add(mesh(GEO.cyl, hide, 0.15, 0.85, 0.15, 0, -0.38, 0));
  rLeg.add(mesh(GEO.cyl, hide, 0.15, 0.85, 0.15, 0, -0.38, 0));
  body.add(lLeg, rLeg);
  const weapon = new THREE.Group();
  rFore.add(weapon);

  const setAnim: Rig["setAnim"] = (name, t, speed) => {
    const a = Math.sin(t * speed * 5) * (name === "walk" ? 0.38 : 0.08);
    lLeg.rotation.x = a;
    rLeg.rotation.x = -a;
    rArm.rotation.x = name === "slash" ? -1.7 + Math.sin(t * 10) * 0.45 : a * 0.35;
    lArm.rotation.x = name === "slash" ? -0.4 : -a * 0.35;
    rFore.rotation.x = name === "slash" ? 0.4 : 0.15;
    if (name === "die") body.rotation.x = Math.min(1.1, t);
    body.position.y = name === "leap" ? Math.sin(Math.min(1, t) * Math.PI) * 0.75 : 0;
    if (name === "special") {
      rArm.rotation.x = -2;
      lArm.rotation.x = -2;
    }
  };

  return finish(root, body, headG, torso, lArm, rArm, lLeg, rLeg, weapon, null, null, mats, setAnim);
}

function buildSovereign(def: CharacterDef): Rig {
  const k = def.kit;
  const hide = mat(k.cloth, { rough: 0.75 });
  const blood = mat(k.accent, { emissive: k.trim, eInt: 1.1 });
  const spike = mat(k.metal, { emissive: "#400810", eInt: 0.55, metal: 0.4, rough: 0.35 });
  const mats = [hide, blood, spike];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.scale.setScalar(k.scale * 0.76);
  const tall = k.body === "thorn";

  const torso = mesh(GEO.cyl, hide, tall ? 0.26 : 0.42, tall ? 1.65 : 1.28, tall ? 0.26 : 0.38, 0, 1.4, 0);
  body.add(torso);
  if (!tall) body.add(mesh(GEO.sphere, blood, 0.26, 0.3, 0.14, 0, 1.48, 0.2));

  for (let i = 0; i < 16; i++) {
    const y = 0.65 + (i % 8) * 0.2;
    const a = (i / 16) * Math.PI * 2;
    const r = tall ? 0.24 : 0.32;
    const s = mesh(GEO.cone, spike, 0.05, 0.42 + (i % 3) * 0.12, 0.05, Math.cos(a) * r, y, Math.sin(a) * r * 0.85);
    s.rotation.z = Math.cos(a) * 0.85;
    s.rotation.x = Math.sin(a) * 0.55;
    body.add(s);
  }

  const headG = new THREE.Group();
  headG.position.set(0, 2.32, 0);
  headG.add(mesh(GEO.sphere, hide, 0.2, 0.2, 0.2, 0, 0, 0));
  headG.add(mesh(GEO.sphere, blood, 0.04, 0.04, 0.04, -0.07, 0.04, 0.16));
  headG.add(mesh(GEO.sphere, blood, 0.04, 0.04, 0.04, 0.07, 0.04, 0.16));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    headG.add(mesh(GEO.cone, spike, 0.035, 0.4, 0.035, Math.cos(a) * 0.15, 0.24, Math.sin(a) * 0.15));
  }
  body.add(headG);

  const lArm = new THREE.Group();
  const rArm = new THREE.Group();
  lArm.position.set(-0.38, 1.92, 0);
  rArm.position.set(0.38, 1.92, 0);
  const hang = (g: THREE.Group, sign: number) => {
    g.add(mesh(GEO.cyl, hide, 0.07, 0.95, 0.07, 0, -0.42, 0));
    g.add(mesh(GEO.box, blood, 0.07, 0.14, 0.52, sign * 0.08, -1.08, 0.12));
    g.add(mesh(GEO.cone, spike, 0.04, 0.28, 0.04, sign * 0.08, -1.28, 0.28));
  };
  hang(lArm, -1);
  hang(rArm, 1);
  body.add(lArm, rArm);

  const lLeg = new THREE.Group();
  const rLeg = new THREE.Group();
  lLeg.position.set(-0.14, 0.68, 0);
  rLeg.position.set(0.14, 0.68, 0);
  lLeg.add(mesh(GEO.cyl, hide, 0.09, 0.78, 0.09, 0, -0.34, 0));
  rLeg.add(mesh(GEO.cyl, hide, 0.09, 0.78, 0.09, 0, -0.34, 0));
  body.add(lLeg, rLeg);
  const weapon = new THREE.Group();
  rArm.add(weapon);

  const setAnim: Rig["setAnim"] = (name, t, speed) => {
    const a = Math.sin(t * speed * 4.4) * (name === "walk" ? 0.32 : 0.07);
    lLeg.rotation.x = a;
    rLeg.rotation.x = -a;
    lArm.rotation.x = name === "slash" ? -1.55 : a * 0.45;
    rArm.rotation.x = name === "slash" ? -0.15 : -a * 0.45;
    lArm.rotation.z = name === "slash" ? 0.4 : 0.15;
    body.rotation.y = name === "special" || name === "fold" ? t * 5 : Math.sin(t * 1.2) * 0.04;
    if (name === "die") body.rotation.x = Math.min(1.2, t);
    body.position.y = name === "leap" ? Math.sin(Math.min(1, t * 2) * Math.PI) * 0.9 : Math.sin(t * 2) * 0.02;
  };

  return finish(root, body, headG, torso, lArm, rArm, lLeg, rLeg, weapon, null, null, mats, setAnim);
}
