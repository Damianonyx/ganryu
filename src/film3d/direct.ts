import * as THREE from "three";
import type { FilmStage, Pose } from "./lab";
import { clamp01, lerp, smooth } from "./sets";

/** Directing helpers: keyframed values, paths, and camera moves. */

type Tweenable = number | boolean | string | null | undefined | Tweenable[] | { [k: string]: Tweenable };

function mixDeep(a: Tweenable, b: Tweenable, u: number): Tweenable {
  if (typeof a === "number" && typeof b === "number") return lerp(a, b, u);
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => mixDeep(x, b[i], u));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const out: { [k: string]: Tweenable } = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = mixDeep(a[k], b[k], u);
    return out;
  }
  return u < 0.5 ? a : b; // strings, booleans: switch halfway
}

/**
 * Keyframes: `[time, value]` pairs, eased between (smoothstep by default).
 * Values can be numbers, arrays, or nested objects (a pose with arms and feet).
 * A field missing from one key holds the other key's value.
 */
export function keys<T>(t: number, frames: [number, T][], ease: (u: number) => number = smooth): T {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, a] = frames[i];
    const [t1, b] = frames[i + 1];
    if (t < t1) return mixDeep(a as Tweenable, b as Tweenable, ease((t - t0) / (t1 - t0))) as T;
  }
  return frames[frames.length - 1][1];
}

/** A straight walk from a to b between t0 and t1, standing still before and after. */
export const walk =
  (a: [number, number], b: [number, number], t0: number, t1: number, extra: Partial<Pose> = {}) =>
  (t: number): Pose => {
    const u = clamp01((t - t0) / (t1 - t0));
    return { x: lerp(a[0], b[0], u), z: lerp(a[1], b[1], u), ...extra };
  };

/** A path through points, at even speed, between t0 and t1. */
export const route =
  (pts: [number, number][], t0: number, t1: number, extra: Partial<Pose> = {}) =>
  (t: number): Pose => {
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = lens.reduce((a, b) => a + b, 0);
    let d = clamp01((t - t0) / (t1 - t0)) * total;
    for (let i = 0; i < lens.length; i++) {
      if (d <= lens[i] || i === lens.length - 1) {
        const u = lens[i] ? Math.min(1, d / lens[i]) : 0;
        return { x: lerp(pts[i][0], pts[i + 1][0], u), z: lerp(pts[i][1], pts[i + 1][1], u), ...extra };
      }
      d -= lens[i];
    }
    return { x: pts[pts.length - 1][0], z: pts[pts.length - 1][1], ...extra };
  };

/** Facing: the yaw that turns a body to look along (dx, dz) in the world. */
export const face = (dx: number, dz: number) => Math.atan2(-dx, -dz);

export type CamKey = { pos: [number, number, number]; look: [number, number, number]; fov?: number; roll?: number };

/** Places the camera from keyframes, with an optional handheld drift and a shake. */
export function camera(stage: FilmStage, t: number, frames: [number, CamKey][], o: { hand?: number; shake?: number; ease?: (u: number) => number } = {}) {
  const k = keys(t, frames, o.ease);
  const hand = o.hand ?? 0.012;
  const sh = o.shake ?? 0;
  const n = (f: number, p: number) => Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.3 + p * 1.7) * 0.4;
  const c = stage.camera;
  c.position.set(k.pos[0] + n(0.9, 1) * hand + n(31, 2) * sh, k.pos[1] + n(0.7, 3) * hand + n(37, 4) * sh, k.pos[2] + n(0.8, 5) * hand * 0.5);
  c.up.set(0, 1, 0);
  c.lookAt(k.look[0] + n(0.6, 7) * hand, k.look[1] + n(0.5, 8) * hand, k.look[2]);
  if (k.roll) c.rotateZ(k.roll);
  c.fov = k.fov ?? 35;
  c.updateProjectionMatrix();
}

/** A decaying shake: trauma at time `at`, fading at `rate` per second. */
export const jolt = (t: number, at: number, amount: number, rate = 6) => (t >= at ? amount * Math.exp(-(t - at) * rate) : 0);

export const vec = (p: [number, number, number]) => new THREE.Vector3(...p);
