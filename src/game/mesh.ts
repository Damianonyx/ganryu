import type * as THREE from "three";
import { motion } from "./motion";
import { withBlend } from "./rig-kit";
import { buildMonster } from "./rig-monsters";
import { buildSamurai } from "./rig-samurai";
import { buildWanderer } from "./rig-wanderers";
import type { Direction } from "./rig-humanoid";
import type { AnimName, CharacterDef } from "./types";

/**
 * Every fighter's body, built from their sheets: the armored samurai
 * (rig-samurai.ts), the unarmored swordsmen Enjirō, Mokuren, and Mumyō
 * (rig-wanderers.ts), and the monsters (rig-monsters.ts). All sit on the
 * shared body in rig-humanoid.ts.
 */
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
  /** Film acting on top of the procedural motion (src/film3d only; the game never calls it). */
  direct?: (d: Direction | null) => void;
  setFolding: (on: boolean) => void;
  flash: (c: number) => void;
  dispose: () => void;
};

export function buildRig(def: CharacterDef): Rig {
  const rig = buildMonster(def) ?? buildWanderer(def) ?? buildSamurai(def);
  // The gait runs continuously through idle and walk; every other change of animation blends.
  const both = (n: AnimName) => n === "idle" || n === "walk";
  rig.setAnim = withBlend(rig.body, rig.setAnim, () => motion.pose, (a, b) => both(a) && both(b));
  return rig;
}
