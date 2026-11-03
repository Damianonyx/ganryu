export const TAU = Math.PI * 2;

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function unlerp(a: number, b: number, v: number) {
  if (b === a) return 0;
  return (v - a) / (b - a);
}

export function smoothstep(a: number, b: number, x: number) {
  const t = clamp(unlerp(a, b, x), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t: number) {
  return t * t * t;
}

export function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function expDamp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function rand(a = 0, b = 1) {
  return a + Math.random() * (b - a);
}

export function randSign() {
  return Math.random() < 0.5 ? -1 : 1;
}

export function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export function noise1(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
}

export function noise2(x: number, y: number) {
  return noise1(x + y * 19.19);
}

export type Pose = Record<string, number>;

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    out[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
  }
  return out;
}

export function copyPose(p: Pose): Pose {
  return { ...p };
}

export function segIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) {
  const den = (ax - bx) * (cy - dy) - (ay - by) * (cx - dx);
  if (Math.abs(den) < 1e-8) return false;
  const t = ((ax - cx) * (cy - dy) - (ay - cy) * (cx - dx)) / den;
  const u = -((ax - bx) * (ay - cy) - (ay - by) * (ax - cx)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

export function wrap(v: number, min: number, max: number) {
  const r = max - min;
  return ((((v - min) % r) + r) % r) + min;
}
