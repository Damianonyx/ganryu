import * as THREE from "three";

/**
 * Ropes for chains, smoke tendrils, and tails: a chain of points simulated
 * in world space (Verlet integration, follow-the-leader length constraints),
 * pinned to a joint. Because the physics runs in the world, a rope lags when
 * the body moves, swings back, and whips forward when the arm strikes.
 *
 * Drawing: every segment of every rope in a set is one instance of a single
 * InstancedMesh, so a whole set costs one draw call.
 */

export type RopeOpts = {
  /** Downward acceleration in m/s². Negative floats upward (smoke). */
  gravity: number;
  /** Share of velocity kept each step, 0–1. */
  damping: number;
  /** Pull toward the rest shape each step, 0–1 (0 = free rope, ~0.3 = a tail). */
  stiff: number;
  /** Sideways drift amplitude for smoke, m/s². */
  wind?: number;
};

export class Rope {
  readonly n: number;
  readonly seg: number;
  readonly p: THREE.Vector3[];
  readonly prev: THREE.Vector3[];
  private ready = false;
  private seed = Math.random() * 100;
  constructor(n: number, seg: number) {
    this.n = n;
    this.seg = seg;
    this.p = Array.from({ length: n }, () => new THREE.Vector3());
    this.prev = Array.from({ length: n }, () => new THREE.Vector3());
  }

  /** Lay the rope out straight from `anchor` along `dir` (used on the first frame). */
  reset(anchor: THREE.Vector3, dir: THREE.Vector3) {
    for (let i = 0; i < this.n; i++) {
      this.p[i].copy(anchor).addScaledVector(dir, i * this.seg);
      this.prev[i].copy(this.p[i]);
    }
    this.ready = true;
  }

  /** Push every point but the pinned one by a velocity (m/s), scaled up toward the tip. */
  impulse(v: THREE.Vector3, dt: number) {
    for (let i = 1; i < this.n; i++) this.prev[i].addScaledVector(v, -dt * (i / (this.n - 1)));
  }

  private tmp = new THREE.Vector3();
  private want = new THREE.Vector3();

  step(dt: number, anchor: THREE.Vector3, rest: THREE.Vector3, o: RopeOpts, time: number) {
    if (!this.ready) this.reset(anchor, rest);
    const h = Math.min(dt, 1 / 30);
    const keep = Math.pow(o.damping, h * 60);
    const g = -o.gravity * h * h;
    const wind = (o.wind ?? 0) * h * h;
    // integrate
    for (let i = 1; i < this.n; i++) {
      const p = this.p[i];
      this.tmp.copy(p).sub(this.prev[i]).multiplyScalar(keep);
      this.prev[i].copy(p);
      p.add(this.tmp);
      p.y += g;
      if (wind) {
        const s = this.seed + i * 0.7;
        p.x += Math.sin(time * 1.7 + s) * wind;
        p.z += Math.cos(time * 1.3 + s * 1.3) * wind;
      }
    }
    // pin, rest shape, and lengths (follow the leader)
    this.p[0].copy(anchor);
    this.prev[0].copy(anchor);
    for (let i = 1; i < this.n; i++) {
      const a = this.p[i - 1];
      const p = this.p[i];
      if (o.stiff > 0) {
        this.want.copy(a).addScaledVector(rest, this.seg);
        p.lerp(this.want, o.stiff);
      }
      this.tmp.copy(p).sub(a);
      const len = this.tmp.length() || 1e-6;
      p.copy(a).addScaledVector(this.tmp, this.seg / len);
    }
    // floor: ropes rest on the ground instead of passing through it
    for (let i = 1; i < this.n; i++) if (this.p[i].y < 0.02) this.p[i].y = 0.02;
  }
}

/**
 * Draws a set of ropes as instanced segments in a parent's local frame.
 * `width(r, i)` gives the thickness of segment i of rope r; `twist` turns
 * alternate segments 90° about their axis (chain links).
 */
export class RopeSet {
  readonly mesh: THREE.InstancedMesh;
  private up = new THREE.Vector3(0, 1, 0);
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private m = new THREE.Matrix4();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private d = new THREE.Vector3();
  private s = new THREE.Vector3();
  readonly ropes: Rope[];
  readonly width: (r: number, i: number) => number;
  readonly twist: boolean;
  readonly overlap: number;
  constructor(ropes: Rope[], geo: THREE.BufferGeometry, mat: THREE.Material, width: (r: number, i: number) => number, twist = false, overlap = 1) {
    this.ropes = ropes;
    this.width = width;
    this.twist = twist;
    this.overlap = overlap;
    const count = ropes.reduce((n, r) => n + r.n - 1, 0);
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.userData.keep = true;
  }

  /** Write instance transforms. `toLocal` maps a world point into the parent's frame. */
  update(toLocal: (w: THREE.Vector3, out: THREE.Vector3) => THREE.Vector3) {
    let k = 0;
    this.ropes.forEach((r, ri) => {
      for (let i = 0; i < r.n - 1; i++) {
        toLocal(r.p[i], this.a);
        toLocal(r.p[i + 1], this.b);
        this.d.copy(this.b).sub(this.a);
        const len = this.d.length() || 1e-6;
        this.d.divideScalar(len);
        this.q.setFromUnitVectors(this.up, this.d);
        if (this.twist && i % 2) this.q.multiply(this.q2.setFromAxisAngle(this.up, Math.PI / 2));
        const w = this.width(ri, i);
        this.s.set(w, len * this.overlap, w);
        this.a.add(this.b).multiplyScalar(0.5);
        this.m.compose(this.a, this.q, this.s);
        this.mesh.setMatrixAt(k++, this.m);
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.dispose();
  }
}

/** World → root-local for a fighter's root at (x, y, z) turned by yaw. */
export function rootLocal(x: number, y: number, z: number, yaw: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return (w: THREE.Vector3, out: THREE.Vector3) => {
    const dx = w.x - x;
    const dz = w.z - z;
    // inverse of a rotation by yaw about Y
    return out.set(dx * c - dz * s, w.y - y, dx * s + dz * c);
  };
}
