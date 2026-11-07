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
