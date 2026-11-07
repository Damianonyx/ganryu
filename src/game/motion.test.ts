import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InputBuffer } from "./input-buffer.ts";
import { MOTION_DEFAULTS, follow, motion, resetMotion } from "./motion.ts";

const none = { slash: false, parry: false, leap: false, power: false, fold: false };

describe("input buffer", () => {
  it("keeps a press for the buffer window, then forgets it", () => {
    const b = new InputBuffer();
    assert.equal(b.push({ ...none, slash: true }, 0.15), true);
    assert.equal(b.action, "slash");
    b.tick(0.1);
    assert.equal(b.action, "slash");
    b.tick(0.06);
    assert.equal(b.action, null);
  });

  it("refreshes the window while a button is held", () => {
    const b = new InputBuffer();
    for (let i = 0; i < 30; i++) b.push({ ...none, slash: true }, 0.15);
    assert.equal(b.action, "slash");
    assert.ok(Math.abs(b.left - 0.15) < 1e-9);
  });

  it("prefers Parry when several buttons land on one frame", () => {
    const b = new InputBuffer();
    b.push({ ...none, slash: true, parry: true }, 0.15);
    assert.equal(b.action, "parry");
  });

  it("lets a newer press replace an older one", () => {
    const b = new InputBuffer();
    b.push({ ...none, power: true }, 0.15);
    b.tick(1 / 60);
    b.push({ ...none, leap: true }, 0.15);
    assert.equal(b.action, "leap");
  });

  it("with a zero window, keeps a press for its own frame only", () => {
    const b = new InputBuffer();
    b.push({ ...none, parry: true }, 0);
    assert.equal(b.action, "parry");
    b.tick(1 / 60);
    assert.equal(b.action, null);
  });

  it("reports nothing pressed on an empty frame", () => {
    const b = new InputBuffer();
    assert.equal(b.push(none, 0.15), false);
    assert.equal(b.action, null);
  });
});

describe("motion tokens", () => {
  it("follow() moves part of the way and never overshoots", () => {
    const k = follow(9, 1 / 60);
    assert.ok(k > 0 && k < 1);
    assert.equal(follow(9, 0), 0);
    assert.ok(follow(1e6, 1) <= 1);
  });

  it("follow() is frame-rate independent", () => {
    // Two 30 fps steps cover the same distance as four 60 fps steps.
    const at30 = 1 - (1 - follow(5.5, 1 / 30)) ** 2;
    const at60 = 1 - (1 - follow(5.5, 1 / 60)) ** 4;
    assert.ok(Math.abs(at30 - at60) < 1e-12);
  });

  it("resetMotion() restores tuned values", () => {
    motion.camera.look = 1;
    motion.input.buffer = 0.5;
    resetMotion();
    assert.equal(motion.camera.look, MOTION_DEFAULTS.camera.look);
    assert.equal(motion.input.buffer, MOTION_DEFAULTS.input.buffer);
  });

  it("keeps the UI durations in step with the CSS tokens", async () => {
    const { readFile } = await import("node:fs/promises");
    const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
    const ms = (name: string) => Number(css.match(new RegExp(`--dur-${name}:\\s*(\\d+)ms`))?.[1]);
    assert.equal(ms("fast") / 1000, MOTION_DEFAULTS.ui.fast);
    assert.equal(ms("base") / 1000, MOTION_DEFAULTS.ui.base);
    assert.equal(ms("slow") / 1000, MOTION_DEFAULTS.ui.slow);
  });
});

describe("leg IK", async () => {
  const { legIK, blendTime, Spring } = await import("./rig-kit.ts");
  // Forward kinematics for the same convention: rotation.x = θ turns the
  // downward leg (0,-1,0) to (0, -cos θ, -sin θ).
  const ankle = (thigh: number, shin: number, l1: number, l2: number) => ({
    y: -Math.cos(thigh) * l1 - Math.cos(thigh + shin) * l2,
    z: -Math.sin(thigh) * l1 - Math.sin(thigh + shin) * l2,
  });

  it("places the ankle on reachable targets, knee in front", () => {
    for (const [dy, dz] of [
      [-0.8, 0],
      [-0.7, 0.3],
      [-0.75, -0.3],
      [-0.5, 0.1],
    ]) {
      const { thigh, shin } = legIK(dy, dz, 0.44, 0.42);
      const a = ankle(thigh, shin, 0.44, 0.42);
      assert.ok(Math.abs(a.y - dy) < 1e-6 && Math.abs(a.z - dz) < 1e-6, `target ${dy},${dz} → ${a.y},${a.z}`);
      const knee = { y: -Math.cos(thigh) * 0.44, z: -Math.sin(thigh) * 0.44 };
      // the knee sits forward of the hip→ankle line
      assert.ok(knee.z >= (knee.y / dy) * dz - 1e-9);
    }
  });

  it("straightens toward out-of-reach targets instead of failing", () => {
    const { thigh, shin } = legIK(-2, 0.5, 0.44, 0.42);
    assert.ok(Number.isFinite(thigh) && Number.isFinite(shin));
    assert.ok(shin < 0.1);
  });

  it("blends quickly into actions and impacts, slower back to stance", () => {
    const t = MOTION_DEFAULTS.pose;
    assert.equal(blendTime("idle", "slash", t), t.attack);
    assert.equal(blendTime("walk", "hurt", t), t.react);
    assert.equal(blendTime("slash", "idle", t), t.settle);
    assert.equal(blendTime("idle", "walk", t), t.locomotion);
  });

  it("springs settle on their target", () => {
    const s = new Spring(60, 9);
    for (let i = 0; i < 240; i++) s.step(1, 1 / 60);
    assert.ok(Math.abs(s.x - 1) < 1e-3);
  });
});

describe("ropes", async () => {
  const THREE = await import("three");
  const { Rope, rootLocal } = await import("./rig-rope.ts");
  const down = new THREE.Vector3(0, -1, 0);
  const free = { gravity: 9.8, damping: 0.97, stiff: 0 };

  it("hang straight down under gravity and keep their length", () => {
    const r = new Rope(8, 0.1);
    const top = new THREE.Vector3(0, 2, 0);
    r.reset(top, new THREE.Vector3(1, 0, 0)); // start sideways
    for (let i = 0; i < 600; i++) r.step(1 / 60, top, down, free, i / 60);
    const tip = r.p[r.n - 1];
    assert.ok(Math.abs(tip.x) < 0.03 && Math.abs(tip.y - (2 - 0.7)) < 0.03, `tip ${tip.toArray()}`);
    for (let i = 1; i < r.n; i++) assert.ok(Math.abs(r.p[i].distanceTo(r.p[i - 1]) - 0.1) < 1e-6);
  });

  it("hold a rest shape when stiff (a tail sticks out)", () => {
    const r = new Rope(6, 0.1);
    const base = new THREE.Vector3(0, 1, 0);
    const back = new THREE.Vector3(0, 0, -1);
    for (let i = 0; i < 300; i++) r.step(1 / 60, base, back, { gravity: 5, damping: 0.94, stiff: 0.22 }, i / 60);
    const tip = r.p[r.n - 1];
    assert.ok(tip.z < -0.35, `tip z ${tip.z}`);
    assert.ok(tip.y > 0.6, `tip y ${tip.y}`);
  });

  it("carry an impulse to the tip more than the base", () => {
    const r = new Rope(10, 0.1);
    const top = new THREE.Vector3(0, 2, 0);
    for (let i = 0; i < 300; i++) r.step(1 / 60, top, down, free, 0);
    r.impulse(new THREE.Vector3(0, 0, 8), 1 / 60);
    for (let i = 0; i < 6; i++) r.step(1 / 60, top, down, free, 0);
    assert.ok(r.p[r.n - 1].z > r.p[2].z + 0.05, `tip ${r.p[r.n - 1].z} vs ${r.p[2].z}`);
  });

  it("maps world points into a turned root's frame", () => {
    const toLocal = rootLocal(3, 0, 4, Math.PI / 2);
    const out = toLocal(new THREE.Vector3(3, 1, 3), new THREE.Vector3());
    // Turning the local point back by the root's yaw and adding its position recovers the world point.
    const back = new THREE.Vector3(out.x, out.y, out.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).add(new THREE.Vector3(3, 0, 4));
    assert.ok(back.distanceTo(new THREE.Vector3(3, 1, 3)) < 1e-9);
  });
});
