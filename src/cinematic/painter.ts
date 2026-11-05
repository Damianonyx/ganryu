/**
 * Procedural 2D painter for the opening cinematic (temporary art).
 *
 * Every frame is a pure function of film time, so the film can be paused,
 * scrubbed, screenshotted, and replayed deterministically. Shots are drawn
 * in a 1600×900 virtual stage; key action stays inside x∈[300,1300] so the
 * portrait crop remains readable.
 *
 * This is placeholder staging: silhouettes, painted light, and simple
 * motion. It is meant to be replaced or re-skinned once character designs
 * and 3D animation exist. Swap routines in `ROUTINES` per shot kind.
 */

import { END_CARD, type ShotKind } from "./script.ts";
import { shotAt } from "./timeline.ts";

export const STAGE_W = 1600;
export const STAGE_H = 900;

export type PaintOptions = { reduced: boolean };

type G = {
  c: CanvasRenderingContext2D;
  /** 0..1 progress through the shot. */
  p: number;
  /** Seconds into the shot. */
  L: number;
  /** Absolute film time. */
  t: number;
  reduced: boolean;
};

// ---------------------------------------------------------------- utilities

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => {
  const x = clamp(k);
  return x * x * (3 - 2 * x);
};
const seg = (p: number, a: number, b: number) => ease((p - a) / (b - a));
const rnd = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function rect(c: CanvasRenderingContext2D, color: string | CanvasGradient, x = 0, y = 0, w = STAGE_W, h = STAGE_H) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function vgrad(c: CanvasRenderingContext2D, y0: number, y1: number, stops: Array<[number, string]>) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  if (alpha <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.save();
  c.globalAlpha = clamp(alpha);
  c.globalCompositeOperation = "lighter";
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

/** Push-in / pan / shake around the stage centre. */
function cam(g: G, zoom: number, px = 0, py = 0, shake = 0) {
  const s = g.reduced ? 0 : shake;
  const sx = s ? (rnd(Math.floor(g.t * 40)) - 0.5) * s : 0;
  const sy = s ? (rnd(Math.floor(g.t * 40) + 9) - 0.5) * s : 0;
  const z = g.reduced ? 1 + (zoom - 1) * 0.3 : zoom;
  g.c.translate(STAGE_W / 2 + sx, STAGE_H / 2 + sy);
  g.c.scale(z, z);
  g.c.translate(-STAGE_W / 2 + px, -STAGE_H / 2 + py);
}

/** Flicker 0..1 for firelight; steady in reduced motion. */
function flicker(g: G, seed = 0, amt = 0.25) {
  if (g.reduced) return 1 - amt * 0.5;
  const t = g.t * 9 + seed;
  return 1 - amt * (0.5 + 0.5 * Math.sin(t) * Math.sin(t * 1.7 + 2) * Math.sin(t * 0.6));
}

// ----------------------------------------------------------- scenery parts

function mountains(c: CanvasRenderingContext2D, color: string, base: number, amp: number, seed: number) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(-50, STAGE_H);
  for (let x = -50; x <= STAGE_W + 50; x += 40) {
    const y = base - amp * (0.55 * Math.sin(x * 0.004 + seed) + 0.3 * Math.sin(x * 0.011 + seed * 2) + 0.15 * Math.sin(x * 0.027 + seed * 3));
    c.lineTo(x, y);
  }
  c.lineTo(STAGE_W + 50, STAGE_H);
  c.closePath();
  c.fill();
}

function pine(c: CanvasRenderingContext2D, x: number, y: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x - h * 0.02, y - h * 0.3, h * 0.04, h * 0.3);
  for (let i = 0; i < 4; i++) {
    const ty = y - h * (0.25 + i * 0.19);
    const w = h * (0.32 - i * 0.06);
    c.beginPath();
    c.moveTo(x - w, ty + h * 0.12);
    c.lineTo(x, ty - h * 0.14);
    c.lineTo(x + w, ty + h * 0.12);
    c.closePath();
    c.fill();
  }
}

type HouseOpts = { wall: string; roof: string; door?: string; window?: string; burning?: number };

function house(g: G, x: number, y: number, w: number, h: number, o: HouseOpts) {
  const c = g.c;
  c.fillStyle = o.wall;
  c.fillRect(x, y - h, w, h);
  // posts
  c.fillStyle = "rgba(0,0,0,0.35)";
  for (let i = 0; i <= 3; i++) c.fillRect(x + (w - 8) * (i / 3), y - h, 8, h);
  if (o.door) {
    c.fillStyle = o.door;
    c.fillRect(x + w * 0.38, y - h * 0.78, w * 0.24, h * 0.78);
  }
  if (o.window) {
    c.fillStyle = o.window;
    c.fillRect(x + w * 0.1, y - h * 0.7, w * 0.18, h * 0.24);
    c.fillRect(x + w * 0.72, y - h * 0.7, w * 0.18, h * 0.24);
  }
  // curved roof
  const ov = w * 0.16;
  c.fillStyle = o.roof;
  c.beginPath();
  c.moveTo(x - ov, y - h + 6);
  c.quadraticCurveTo(x + w * 0.1, y - h - h * 0.1, x + w * 0.2, y - h - h * 0.55);
  c.lineTo(x + w * 0.8, y - h - h * 0.55);
  c.quadraticCurveTo(x + w * 0.9, y - h - h * 0.1, x + w + ov, y - h + 6);
  c.closePath();
  c.fill();
  c.fillRect(x + w * 0.17, y - h - h * 0.6, w * 0.66, h * 0.07);
  if (o.burning && o.burning > 0) fire(g, x + w * 0.5, y - h - h * 0.25, w * 1.1 * o.burning, h * 0.9 * (0.4 + o.burning * 0.6), 1, x);
}

function lantern(g: G, x: number, y: number, r: number, lit: number, seed = 0) {
  const c = g.c;
  c.strokeStyle = "rgba(20,14,12,0.9)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x, y - r * 2.4);
  c.lineTo(x, y - r);
  c.stroke();
  const f = flicker(g, seed, 0.18) * lit;
  c.fillStyle = lit > 0 ? `rgba(255,${150 + 40 * f},${70 + 30 * f},${0.55 + 0.45 * f})` : "#2b211c";
  c.beginPath();
  c.ellipse(x, y, r * 0.75, r, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(30,15,10,0.8)";
  c.fillRect(x - r * 0.5, y - r * 1.05, r, r * 0.18);
  c.fillRect(x - r * 0.5, y + r * 0.88, r, r * 0.18);
  glow(c, x, y, r * 7, "rgba(255,170,80,0.55)", f);
}

/** Flame body anchored at its base centre. */
function fire(g: G, x: number, y: number, w: number, h: number, intensity = 1, seed = 0) {
  const c = g.c;
  const n = Math.max(3, Math.round(w / 28));
  glow(c, x, y - h * 0.3, Math.max(w, h) * 1.2, "rgba(255,110,40,0.6)", 0.8 * intensity * flicker(g, seed, 0.2));
  c.save();
  c.globalCompositeOperation = "lighter";
  for (let layer = 0; layer < 3; layer++) {
    const col = ["rgba(200,50,20,0.55)", "rgba(255,130,40,0.55)", "rgba(255,220,140,0.5)"][layer];
    const lh = h * (1 - layer * 0.28);
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const fx = x - w / 2 + k * w;
      const ph = g.reduced ? 0 : g.t * (4 + rnd(i + seed) * 3) + i * 1.3;
      const fh = lh * (0.55 + 0.45 * rnd(i * 3 + seed)) * (0.85 + 0.15 * Math.sin(ph)) * intensity;
      const fw = (w / n) * (1.3 - layer * 0.25);
      const sway = g.reduced ? 0 : Math.sin(ph * 0.8) * fw * 0.3;
      c.beginPath();
      c.moveTo(fx - fw / 2, y);
      c.quadraticCurveTo(fx - fw * 0.45 + sway * 0.4, y - fh * 0.55, fx + sway, y - fh);
      c.quadraticCurveTo(fx + fw * 0.45 + sway * 0.4, y - fh * 0.55, fx + fw / 2, y);
      c.closePath();
      c.fill();
    }
  }
  c.restore();
}

function smoke(g: G, density: number, color: string, yBase = 500, speed = 1) {
  const c = g.c;
  c.save();
  for (let i = 0; i < 14; i++) {
    const r = 140 + rnd(i) * 220;
    const drift = g.reduced ? g.t * 4 : g.t * (12 + rnd(i + 4) * 20) * speed;
    const x = ((rnd(i + 1) * (STAGE_W + 600) + drift) % (STAGE_W + 600)) - 300;
    const y = yBase - rnd(i + 2) * 420 - (g.reduced ? 0 : Math.sin(g.t * 0.3 + i) * 20);
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    c.globalAlpha = density * (0.4 + 0.6 * rnd(i + 3));
    c.fillStyle = gr;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.restore();
}

function particles(g: G, n: number, kind: "ember" | "ash" | "snow" | "rain" | "leaf" | "petal" | "mote", seed = 0, speed = 1) {
  const c = g.c;
  const sp = (g.reduced ? 0.35 : 1) * speed;
  const count = g.reduced ? Math.ceil(n * 0.5) : n;
  c.save();
  for (let i = 0; i < count; i++) {
    const a = rnd(i + seed);
    const b = rnd(i * 7 + seed + 3);
    const life = g.t * sp * (0.6 + b * 0.8);
    let x: number;
    let y: number;
    switch (kind) {
      case "ember":
        x = (a * STAGE_W + Math.sin(life * 2 + i) * 40) % STAGE_W;
        y = STAGE_H - ((life * 160 + b * STAGE_H) % (STAGE_H + 100));
        c.fillStyle = `rgba(255,${120 + 80 * b},60,${0.5 + 0.5 * a})`;
        c.fillRect(x, y, 3 + b * 3, 3 + b * 3);
        break;
      case "ash":
      case "snow":
        x = (a * STAGE_W + Math.sin(life + i) * 30 + life * 20) % STAGE_W;
        y = ((life * (kind === "snow" ? 70 : 35) + b * STAGE_H) % (STAGE_H + 40)) - 20;
        c.fillStyle = kind === "snow" ? `rgba(240,244,250,${0.5 + 0.5 * b})` : `rgba(200,198,192,${0.3 + 0.4 * b})`;
        c.beginPath();
        c.arc(x, y, kind === "snow" ? 2 + b * 3 : 1.5 + b * 2, 0, Math.PI * 2);
        c.fill();
        break;
      case "rain":
        x = (a * (STAGE_W + 200) - life * 120) % (STAGE_W + 200);
        if (x < 0) x += STAGE_W + 200;
        y = ((life * 900 + b * STAGE_H) % (STAGE_H + 80)) - 40;
        c.strokeStyle = `rgba(190,205,225,${0.25 + 0.35 * b})`;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - 8, y + 34);
        c.stroke();
        break;
      case "leaf":
      case "petal":
        x = (a * STAGE_W + life * 60 + Math.sin(life * 2 + i) * 50) % STAGE_W;
        y = ((life * 60 + b * STAGE_H) % (STAGE_H + 40)) - 20;
        c.fillStyle = kind === "leaf" ? `rgba(${180 + 60 * b},${80 + 40 * a},30,0.85)` : `rgba(245,${190 + 30 * b},${205 + 20 * a},0.85)`;
        c.save();
        c.translate(x, y);
        c.rotate(life * 2 + i);
        c.beginPath();
        c.ellipse(0, 0, kind === "leaf" ? 7 : 5, kind === "leaf" ? 3.5 : 3, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
        break;
      case "mote":
        x = a * STAGE_W + Math.sin(life * 0.7 + i) * 30;
        y = 200 + b * 500 + Math.cos(life * 0.5 + i) * 20;
        glow(c, x, y, 10, "rgba(255,210,140,0.8)", 0.25 + 0.25 * Math.sin(life * 2 + i));
        break;
    }
  }
  c.restore();
}

function vignette(c: CanvasRenderingContext2D, strength = 0.65) {
  const g = c.createRadialGradient(STAGE_W / 2, STAGE_H / 2, STAGE_H * 0.35, STAGE_W / 2, STAGE_H / 2, STAGE_W * 0.62);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  c.fillStyle = g;
  c.fillRect(0, 0, STAGE_W, STAGE_H);
}

// ----------------------------------------------------------------- figures

export type FigureKind = "child" | "father" | "mother" | "samurai" | "antagonist" | "adult" | "teen" | "villager";

type Fig = {
  kind: FigureKind;
  x: number;
  y: number;
  /** Standing height in stage pixels. */
  h: number;
  facing?: 1 | -1;
  color?: string;
  rim?: string;
  lean?: number;
  /** Shoulder angles from straight down; positive swings toward facing. */
  armF?: number;
  armB?: number;
  elbowF?: number;
  elbowB?: number;
  /** Foot spread as a fraction of height. */
  spread?: number;
  /** 0..1 knee bend. */
  crouch?: number;
  /** Walk/run cycle phase in radians; undefined = standing. */
  stride?: number;
  stepLen?: number;
  /** Sword in the front hand: angle from vertical, positive toward facing. */
  sword?: { a: number; len: number; kind: "wood" | "katana" | "nodachi" | "knife" };
  /** Rotate whole figure about its feet (falls). */
  tilt?: number;
  alpha?: number;
};

function figure(c: CanvasRenderingContext2D, f: Fig) {
  if (f.rim) {
    figureBody(c, { ...f, color: f.rim, x: f.x - 3 * (f.facing ?? 1), rim: undefined });
    figureBody(c, { ...f, color: f.rim, x: f.x + 2, y: f.y - 2, rim: undefined });
  }
  figureBody(c, f);
}

function figureBody(c: CanvasRenderingContext2D, f: Fig) {
  const H = f.kind === "antagonist" ? f.h * 1.12 : f.h;
  const dir = f.facing ?? 1;
  const childish = f.kind === "child";
  const legLen = H * (childish ? 0.4 : f.kind === "teen" ? 0.45 : 0.47);
  const torso = H * (childish ? 0.29 : 0.3);
  const headR = H * (childish ? 0.095 : f.kind === "teen" ? 0.075 : 0.064);
  const limbW = H * (childish ? 0.075 : 0.065);
  const color = f.color ?? "#0d0a0c";
  const lean = f.lean ?? 0;
  const crouch = f.crouch ?? 0;
  const spread = f.spread ?? 0.12;

  c.save();
  c.globalAlpha *= f.alpha ?? 1;
  c.translate(f.x, f.y);
  if (f.tilt) c.rotate(f.tilt * dir);
  c.scale(dir, 1);
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineCap = "round";
  c.lineJoin = "round";

  const hipY = -legLen * (1 - 0.3 * crouch);
  const hip = { x: Math.sin(lean) * legLen * 0.15, y: hipY };
  const sh = { x: hip.x + Math.sin(lean) * torso, y: hip.y - Math.cos(lean) * torso };
  const head = { x: sh.x + Math.sin(lean) * headR * 1.35, y: sh.y - Math.cos(lean) * headR * 1.35 };

  // legs
  let fl = { x: spread * H * 0.5, y: 0 };
  let bl = { x: -spread * H * 0.5, y: 0 };
  if (f.stride !== undefined) {
    const sl = (f.stepLen ?? 0.22) * H;
    fl = { x: Math.sin(f.stride) * sl, y: -Math.max(0, Math.cos(f.stride)) * H * 0.05 };
    bl = { x: -Math.sin(f.stride) * sl, y: -Math.max(0, -Math.cos(f.stride)) * H * 0.05 };
  }
  c.lineWidth = limbW * 1.05;
  for (const foot of [bl, fl]) {
    const knee = { x: (hip.x + foot.x) / 2 + crouch * H * 0.08 + H * 0.01, y: (hip.y + foot.y) / 2 };
    c.beginPath();
    c.moveTo(hip.x, hip.y);
    c.lineTo(knee.x, knee.y);
    c.lineTo(foot.x, foot.y);
    c.stroke();
    c.beginPath();
    c.ellipse(foot.x + H * 0.02, foot.y - limbW * 0.3, limbW * 0.75, limbW * 0.38, 0, 0, Math.PI * 2);
    c.fill();
  }

  // garments
  c.beginPath();
  if (f.kind === "antagonist") {
    // Nethrak: long white robe to the ground
    c.moveTo(sh.x - H * 0.1, sh.y + torso * 0.2);
    c.lineTo(sh.x + H * 0.1, sh.y + torso * 0.2);
    c.lineTo(Math.max(fl.x, bl.x) + H * 0.13, -H * 0.01);
    c.lineTo(Math.min(fl.x, bl.x) - H * 0.13, -H * 0.01);
  } else if (f.kind === "mother") {
    c.moveTo(sh.x - H * 0.07, sh.y + torso * 0.25);
    c.lineTo(sh.x + H * 0.07, sh.y + torso * 0.25);
    c.lineTo(fl.x + H * 0.08, -H * 0.02);
    c.lineTo(bl.x - H * 0.08, -H * 0.02);
  } else if (f.kind === "father" || f.kind === "adult" || f.kind === "samurai" || f.kind === "teen") {
    // hakama / armored skirt
    c.moveTo(hip.x - H * 0.075, hip.y - H * 0.03);
    c.lineTo(hip.x + H * 0.075, hip.y - H * 0.03);
    c.lineTo(Math.max(fl.x, bl.x) + H * 0.07, -H * 0.12);
    c.lineTo(Math.min(fl.x, bl.x) - H * 0.07, -H * 0.12);
  } else {
    // short robe
    c.moveTo(hip.x - H * 0.08, hip.y - H * 0.05);
    c.lineTo(hip.x + H * 0.08, hip.y - H * 0.05);
    c.lineTo(hip.x + H * 0.12, hip.y + legLen * 0.45);
    c.lineTo(hip.x - H * 0.12, hip.y + legLen * 0.45);
  }
  c.closePath();
  c.fill();
  if (f.kind === "antagonist") {
    c.save();
    c.fillStyle = "rgba(160,18,28,0.9)";
    const left = Math.min(fl.x, bl.x) - H * 0.12;
    const right = Math.max(fl.x, bl.x) + H * 0.12;
    for (let i = 0; i < 7; i++) {
      const x = left + ((right - left) * (i + 0.5)) / 7;
      const hgt = H * (0.1 + 0.12 * ((i * 37) % 5) / 4);
      c.beginPath();
      c.moveTo(x - H * 0.028, -H * 0.012);
      c.quadraticCurveTo(x - H * 0.03, -hgt * 0.55, x + H * 0.012, -hgt);
      c.quadraticCurveTo(x + H * 0.005, -hgt * 0.45, x + H * 0.03, -H * 0.012);
      c.closePath();
      c.fill();
    }
    c.restore();
    c.fillStyle = color;
  }

  // torso
  c.lineWidth = H * (childish ? 0.14 : f.kind === "antagonist" ? 0.17 : 0.13);
  c.beginPath();
  c.moveTo(hip.x, hip.y);
  c.lineTo(sh.x, sh.y + c.lineWidth * 0.3);
  c.stroke();

  const armored = f.kind === "samurai";
  if (armored || f.kind === "adult") {
    // shoulder plates (sode)
    const sw = H * (f.kind === "antagonist" ? 0.13 : 0.1);
    const plate = (sx: number) => {
      c.beginPath();
      c.moveTo(sx - sw * 0.5, sh.y - H * 0.01);
      c.lineTo(sx + sw * 0.5, sh.y - H * 0.01);
      c.lineTo(sx + sw * 0.6, sh.y + H * 0.11);
      c.lineTo(sx - sw * 0.6, sh.y + H * 0.11);
      c.closePath();
      c.fill();
    };
    plate(sh.x + H * 0.07);
    if (armored) plate(sh.x - H * 0.07);
  }

  // arms
  const up = H * 0.16;
  const fore = H * 0.15;
  const arm = (a: number, e: number, back: boolean) => {
    const ox = back ? -H * 0.03 : H * 0.03;
    const s0 = { x: sh.x + ox, y: sh.y + H * 0.02 };
    const el = { x: s0.x + Math.sin(a) * up, y: s0.y + Math.cos(a) * up };
    const hand = { x: el.x + Math.sin(a + e) * fore, y: el.y + Math.cos(a + e) * fore };
    c.lineWidth = limbW * 0.95;
    c.beginPath();
    c.moveTo(s0.x, s0.y);
    c.lineTo(el.x, el.y);
    c.lineTo(hand.x, hand.y);
    c.stroke();
    return hand;
  };
  arm(f.armB ?? -0.15, f.elbowB ?? 0.2, true);
  const hand = arm(f.armF ?? 0.15, f.elbowF ?? 0.2, false);
  if (f.kind === "mother") {
    // hanging sleeves
    c.beginPath();
    c.moveTo(sh.x, sh.y + H * 0.04);
    c.quadraticCurveTo(sh.x + H * 0.12, sh.y + H * 0.14, sh.x + H * 0.02, sh.y + H * 0.24);
    c.lineTo(sh.x - H * 0.06, sh.y + H * 0.12);
    c.fill();
  }

  if (f.sword) {
    const a = f.sword.a;
    const len = f.sword.len * H;
    const tip = { x: hand.x + Math.sin(a) * len, y: hand.y - Math.cos(a) * len };
    const grip = { x: hand.x - Math.sin(a) * H * 0.06, y: hand.y + Math.cos(a) * H * 0.06 };
    c.lineWidth = f.sword.kind === "wood" ? H * 0.022 : H * 0.014;
    c.strokeStyle = f.sword.kind === "wood" ? "#5b4130" : f.sword.kind === "nodachi" ? "#8a0c16" : color;
    c.beginPath();
    c.moveTo(grip.x, grip.y);
    c.lineTo(tip.x, tip.y);
    c.stroke();
    if (f.sword.kind !== "wood") {
      c.strokeStyle = f.sword.kind === "nodachi" ? "rgba(255,70,60,0.95)" : "rgba(220,225,235,0.7)";
      c.lineWidth = H * 0.005;
      c.beginPath();
      c.moveTo(hand.x + Math.sin(a) * H * 0.03, hand.y - Math.cos(a) * H * 0.03);
      c.lineTo(tip.x, tip.y);
      c.stroke();
      c.strokeStyle = color;
    }
  }

  // neck + head
  c.beginPath();
  c.arc(head.x, head.y, headR, 0, Math.PI * 2);
  c.fill();
  const hx = head.x;
  const hy = head.y;
  if (f.kind === "father" || f.kind === "adult" || f.kind === "teen") {
    // topknot
    c.beginPath();
    c.ellipse(hx - headR * 0.2, hy - headR * 1.05, headR * 0.35, headR * 0.22, -0.3, 0, Math.PI * 2);
    c.fill();
    if (f.kind === "adult") {
      c.lineWidth = headR * 0.25;
      c.beginPath();
      c.moveTo(hx - headR * 0.4, hy - headR * 1.05);
      c.quadraticCurveTo(hx - headR * 1.6, hy - headR * 0.6, hx - headR * 2.2, hy + headR * 0.4);
      c.stroke();
    }
  } else if (f.kind === "mother") {
    c.beginPath();
    c.ellipse(hx - headR * 0.75, hy - headR * 0.35, headR * 0.6, headR * 0.5, 0, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = headR * 0.12;
    c.beginPath();
    c.moveTo(hx - headR * 1.4, hy - headR * 0.9);
    c.lineTo(hx - headR * 0.2, hy + headR * 0.1);
    c.stroke();
  } else if (f.kind === "child") {
    c.beginPath();
    c.ellipse(hx - headR * 0.1, hy - headR * 0.95, headR * 0.3, headR * 0.2, 0, 0, Math.PI * 2);
    c.fill();
  } else if (armored) {
    // kabuto dome + neck guard
    c.beginPath();
    c.ellipse(hx, hy - headR * 0.25, headR * 1.15, headR * 0.9, 0, Math.PI, 0);
    c.fill();
    c.beginPath();
    c.moveTo(hx - headR * 1.5, hy + headR * 0.15);
    c.lineTo(hx + headR * 0.2, hy - headR * 0.2);
    c.lineTo(hx - headR * 1.1, hy + headR * 0.9);
    c.closePath();
    c.fill();
    c.lineWidth = headR * 0.22;
    c.beginPath();
    c.moveTo(hx - headR * 0.9, hy - headR * 1.6);
    c.lineTo(hx, hy - headR * 0.9);
    c.lineTo(hx + headR * 0.9, hy - headR * 1.6);
    c.stroke();
  }
  if (f.kind === "antagonist") {
    // Nethrak: wide conical steel hat (jingasa) over a skull face with red eyes
    c.fillStyle = "#1a1818";
    c.beginPath();
    c.arc(hx, hy, headR * 0.95, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#9a958e";
    c.beginPath();
    c.moveTo(hx - headR * 3.0, hy - headR * 0.25);
    c.lineTo(hx, hy - headR * 1.75);
    c.lineTo(hx + headR * 3.0, hy - headR * 0.25);
    c.quadraticCurveTo(hx, hy - headR * 0.05, hx - headR * 3.0, hy - headR * 0.25);
    c.fill();
    c.strokeStyle = "rgba(235,230,222,0.7)";
    c.lineWidth = headR * 0.12;
    c.beginPath();
    c.moveTo(hx - headR * 3.0, hy - headR * 0.25);
    c.lineTo(hx, hy - headR * 1.75);
    c.stroke();
    for (const ex of [-0.38, 0.38]) {
      c.fillStyle = "rgba(255,40,30,0.95)";
      c.beginPath();
      c.arc(hx + headR * ex, hy + headR * 0.15, headR * 0.16, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = color;
  }
  c.restore();
}

/** Run cycle helper. */
const run = (L: number, rate = 9) => L * rate;

// ---------------------------------------------------------------- slit POV

/** View through the narrow gap in the floor hatch. */
function slit(g: G, center: number, half: number, scene: () => void, tint = "rgba(255,140,60,0.06)") {
  const c = g.c;
  c.save();
  c.beginPath();
  c.rect(0, center - half, STAGE_W, half * 2);
  c.clip();
  scene();
  rect(c, tint);
  c.restore();
  // floorboards above and below the gap
  for (const [y0, y1] of [
    [0, center - half],
    [center + half, STAGE_H],
  ] as const) {
    rect(c, "#0b0807", 0, y0, STAGE_W, y1 - y0);
    c.strokeStyle = "rgba(60,40,28,0.5)";
    c.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const y = y0 + ((y1 - y0) * (i + 0.5)) / 8;
      c.beginPath();
      c.moveTo(0, y + Math.sin(i) * 3);
      c.bezierCurveTo(500, y - 6, 1100, y + 6, STAGE_W, y);
      c.stroke();
    }
  }
  // light bleeding onto the board edges
  const edge = c.createLinearGradient(0, center - half - 30, 0, center + half + 30);
  edge.addColorStop(0, "rgba(255,140,60,0)");
  edge.addColorStop(0.25, "rgba(255,140,60,0.25)");
  edge.addColorStop(0.75, "rgba(255,140,60,0.25)");
  edge.addColorStop(1, "rgba(255,140,60,0)");
  c.fillStyle = edge;
  c.fillRect(0, center - half - 30, STAGE_W, 30);
  c.fillRect(0, center + half, STAGE_W, 30);
}

function interiorRoom(g: G, fireAmt: number, doorOpen = 0) {
  const c = g.c;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#2a1a12"], [1, "#120b08"]]));
  // back wall panels (shoji)
  c.fillStyle = "rgba(210,170,120,0.12)";
  for (let i = 0; i < 6; i++) c.fillRect(120 + i * 230, 180, 200, 420);
  c.strokeStyle = "rgba(20,12,8,0.8)";
  c.lineWidth = 5;
  for (let i = 0; i < 6; i++) {
    c.strokeRect(120 + i * 230, 180, 200, 420);
    c.beginPath();
    c.moveTo(220 + i * 230, 180);
    c.lineTo(220 + i * 230, 600);
    c.moveTo(120 + i * 230, 390);
    c.lineTo(320 + i * 230, 390);
    c.stroke();
  }
  // floor
  rect(c, "#1d120c", 0, 600, STAGE_W, 300);
  // door (left)
  const dx = 330;
  if (doorOpen > 0) {
    rect(c, vgrad(c, 180, 600, [[0, "#ff8a3a"], [1, "#7a2210"]]), dx, 180, 200, 420);
    fire(g, dx + 100, 600, 220, 260 * fireAmt, fireAmt, 3);
  }
  glow(c, dx + 100, 420, 520, "rgba(255,120,50,0.5)", 0.25 + 0.6 * fireAmt * flicker(g, 2, 0.35));
  // lamp on the right
  glow(c, 1260, 380, 320, "rgba(255,190,110,0.45)", 0.5 * (1 - fireAmt * 0.5) * flicker(g, 5, 0.12));
}

// ----------------------------------------------------------- close-ups

type FaceOpts = {
  kind: "child" | "father" | "adult" | "teen";
  light: string;
  /** -1 left, 1 right */
  side: 1 | -1;
  smile?: number;
  fear?: number;
  mouth?: number;
  tears?: number;
  wet?: number;
  lookUp?: number;
  turn?: number;
};

function face(c: CanvasRenderingContext2D, cx: number, cy: number, s: number, o: FaceOpts) {
  c.save();
  c.translate(cx, cy);
  const child = o.kind === "child";
  const rw = s * (child ? 0.42 : 0.36);
  const rh = s * (child ? 0.48 : 0.5);
  const turn = o.turn ?? 0;
  // neck/shoulders
  c.fillStyle = "#0f0b0a";
  c.beginPath();
  c.moveTo(-s * 0.9, s * 1.3);
  c.quadraticCurveTo(-s * 0.5, s * 0.55, -s * 0.14, s * 0.4);
  c.lineTo(s * 0.14, s * 0.4);
  c.quadraticCurveTo(s * 0.5, s * 0.55, s * 0.9, s * 1.3);
  c.fill();
  // head
  const skin = c.createLinearGradient(-rw * o.side, 0, rw * o.side, 0);
  skin.addColorStop(0, "#1a1210");
  skin.addColorStop(0.55, "#3a2820");
  skin.addColorStop(1, o.light);
  c.fillStyle = skin;
  c.beginPath();
  c.ellipse(turn * rw * 0.2, 0, rw, rh, 0, 0, Math.PI * 2);
  c.fill();
  // hair
  c.fillStyle = "#0b0807";
  c.beginPath();
  c.ellipse(turn * rw * 0.2, -rh * 0.38, rw * 1.04, rh * 0.68, 0, Math.PI * 1.02, Math.PI * 1.98);
  c.fill();
  c.beginPath();
  c.ellipse(turn * rw * 0.1 - rw * 0.1, -rh * 1.02, rw * 0.32, rh * 0.18, 0, 0, Math.PI * 2);
  c.fill();
  if (child) {
    // fringe
    for (let i = -3; i <= 3; i++) {
      c.beginPath();
      c.moveTo(i * rw * 0.25 - rw * 0.12, -rh * 0.62);
      c.lineTo(i * rw * 0.25 + rw * 0.05, -rh * 0.3);
      c.lineTo(i * rw * 0.25 + rw * 0.16, -rh * 0.62);
      c.fill();
    }
  }
  const ex = rw * 0.42;
  const ey = -rh * 0.05 - (o.lookUp ?? 0) * rh * 0.02;
  const fear = o.fear ?? 0;
  const eyeH = rh * (0.07 + 0.06 * fear) * (child ? 1.3 : 1);
  const eyeW = rw * 0.24;
  for (const sx of [-1, 1]) {
    const x = sx * ex + turn * rw * 0.3;
    c.fillStyle = "rgba(235,225,210,0.9)";
    c.beginPath();
    c.ellipse(x, ey, eyeW, eyeH, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#120c0a";
    c.beginPath();
    c.arc(x + turn * eyeW * 0.4, ey - (o.lookUp ?? 0) * eyeH * 0.5, eyeH * 0.9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = o.light;
    c.beginPath();
    c.arc(x + turn * eyeW * 0.4 + eyeH * 0.3 * o.side, ey - eyeH * 0.35, eyeH * 0.25, 0, Math.PI * 2);
    c.fill();
    // brows
    c.strokeStyle = "#0b0807";
    c.lineWidth = rh * 0.045;
    c.lineCap = "round";
    c.beginPath();
    const browY = ey - eyeH - rh * 0.1 - fear * rh * 0.06;
    c.moveTo(x - eyeW * 1.1, browY + (fear > 0.3 ? rh * 0.03 : -rh * 0.01) * sx * -sx);
    c.lineTo(x + eyeW * 1.1, browY - fear * rh * 0.05 * (sx === -1 ? -1 : 1) * -1);
    c.stroke();
  }
  // mouth
  const my = rh * 0.48;
  const smile = o.smile ?? 0;
  const mouth = o.mouth ?? 0;
  c.strokeStyle = "#140c0a";
  c.fillStyle = "#140c0a";
  c.lineWidth = rh * 0.035;
  if (mouth > 0.05) {
    c.beginPath();
    c.ellipse(turn * rw * 0.25, my, rw * 0.13, rh * 0.09 * mouth, 0, 0, Math.PI * 2);
    c.fill();
  } else {
    c.beginPath();
    c.moveTo(-rw * 0.2 + turn * rw * 0.25, my - smile * rh * 0.04);
    c.quadraticCurveTo(turn * rw * 0.25, my + smile * rh * 0.09 - (1 - smile) * rh * 0.01, rw * 0.2 + turn * rw * 0.25, my - smile * rh * 0.04);
    c.stroke();
  }
  // tears / rain
  const tears = o.tears ?? 0;
  if (tears > 0) {
    c.strokeStyle = `rgba(255,200,150,${0.6 * tears})`;
    c.lineWidth = rh * 0.025;
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.moveTo(sx * ex, ey + eyeH);
      c.quadraticCurveTo(sx * ex * 1.05, ey + rh * 0.3 * tears, sx * ex * 0.95, ey + rh * 0.45 * tears);
      c.stroke();
    }
  }
  if (o.wet) {
    c.strokeStyle = `rgba(200,215,235,${0.45 * o.wet})`;
    c.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = (rnd(i) - 0.5) * rw * 1.6;
      const y0 = (rnd(i + 3) - 0.6) * rh;
      c.beginPath();
      c.moveTo(x, y0);
      c.lineTo(x + 3, y0 + rh * 0.3);
      c.stroke();
    }
  }
  c.restore();
}

function antagonistFace(g: G, cx: number, cy: number, s: number, reveal: number) {
  // Nethrak: a skull face in the shadow of a wide conical steel hat, red eyes.
  const c = g.c;
  const fl = flicker(g, 11, 0.3);
  c.save();
  c.translate(cx, cy);
  // white robe shoulders and high collar
  c.fillStyle = "#b8b0a6";
  c.beginPath();
  c.moveTo(-s * 1.5, s * 1.4);
  c.quadraticCurveTo(-s * 0.9, s * 0.55, -s * 0.32, s * 0.5);
  c.lineTo(s * 0.32, s * 0.5);
  c.quadraticCurveTo(s * 0.9, s * 0.55, s * 1.5, s * 1.4);
  c.closePath();
  c.fill();
  c.fillStyle = "rgba(150,20,28,0.85)";
  c.beginPath();
  c.moveTo(-s * 0.12, s * 0.52);
  c.lineTo(0, s * 0.9);
  c.lineTo(s * 0.12, s * 0.52);
  c.closePath();
  c.fill();
  // skull: pale bone lit from below by fire
  const bone = c.createLinearGradient(0, s * 0.55, 0, -s * 0.35);
  bone.addColorStop(0, `rgba(230,180,150,${0.95})`);
  bone.addColorStop(1, "#5a544e");
  c.fillStyle = bone;
  c.beginPath();
  c.ellipse(0, 0.02 * s, s * 0.34, s * 0.42, 0, 0, Math.PI * 2);
  c.fill();
  // jaw and teeth
  c.fillStyle = "#1a1412";
  c.fillRect(-s * 0.2, s * 0.3, s * 0.4, s * 0.06);
  c.fillStyle = `rgba(230,215,200,${0.9 * fl})`;
  for (let i = -3; i <= 3; i++) c.fillRect(i * s * 0.055 - s * 0.02, s * 0.29, s * 0.04, s * 0.08);
  // nose cavity
  c.fillStyle = "#120d0c";
  c.beginPath();
  c.moveTo(0, s * 0.08);
  c.lineTo(-s * 0.05, s * 0.2);
  c.lineTo(s * 0.05, s * 0.2);
  c.closePath();
  c.fill();
  // eye sockets with glowing red eyes
  for (const sx of [-1, 1]) {
    c.fillStyle = "#070505";
    c.beginPath();
    c.ellipse(sx * s * 0.14, -s * 0.03, s * 0.1, s * 0.085, sx * 0.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = `rgba(255,40,30,${0.6 + 0.4 * reveal})`;
    c.beginPath();
    c.arc(sx * s * 0.14, -s * 0.03, s * 0.035, 0, Math.PI * 2);
    c.fill();
    glow(c, sx * s * 0.14, -s * 0.03, s * 0.16, "rgba(255,30,20,0.9)", 0.5 * reveal);
  }
  // wide conical steel hat casting the upper face into shadow
  const steel = c.createLinearGradient(-s * 1.6, 0, s * 1.6, 0);
  steel.addColorStop(0, "#4a4744");
  steel.addColorStop(0.45, "#a8a39c");
  steel.addColorStop(0.6, "#d8d3cb");
  steel.addColorStop(1, "#3e3b38");
  c.fillStyle = steel;
  c.beginPath();
  c.moveTo(-s * 1.65, -s * 0.22);
  c.lineTo(0, -s * 0.98);
  c.lineTo(s * 1.65, -s * 0.22);
  c.quadraticCurveTo(0, -s * 0.12, -s * 1.65, -s * 0.22);
  c.fill();
  c.strokeStyle = "rgba(40,36,34,0.8)";
  c.lineWidth = s * 0.012;
  for (let i = -4; i <= 4; i++) {
    c.beginPath();
    c.moveTo(0, -s * 0.98);
    c.lineTo(i * s * 0.38, -s * 0.18);
    c.stroke();
  }
  c.fillStyle = "rgba(0,0,0,0.45)";
  c.beginPath();
  c.ellipse(0, -s * 0.12, s * 0.36, s * 0.12, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function hand(c: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, curl: number, color: string, flip = 1) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(flip, 1);
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(0, 0, s * 0.45, s * 0.38, 0, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 4; i++) {
    const fx = -s * 0.3 + i * s * 0.2;
    c.save();
    c.translate(fx, -s * 0.3);
    c.rotate(curl * 1.9);
    c.beginPath();
    c.roundRect(-s * 0.075, -s * 0.55, s * 0.15, s * 0.55, s * 0.07);
    c.fill();
    c.restore();
  }
  c.save();
  c.translate(-s * 0.42, -s * 0.02);
  c.rotate(-0.9 + curl * 1.4);
  c.beginPath();
  c.roundRect(-s * 0.08, -s * 0.42, s * 0.17, s * 0.42, s * 0.08);
  c.fill();
  c.restore();
  c.restore();
}

function charm(c: CanvasRenderingContext2D, x: number, y: number, r: number, swing = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(swing);
  c.strokeStyle = "#8f2a22";
  c.lineWidth = r * 0.12;
  c.beginPath();
  c.moveTo(0, -r * 2.2);
  c.lineTo(0, -r);
  c.stroke();
  const gr = c.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
  gr.addColorStop(0, "#b48a5c");
  gr.addColorStop(1, "#5a3c24");
  c.fillStyle = gr;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(40,24,14,0.85)";
  c.lineWidth = r * 0.1;
  c.beginPath();
  c.moveTo(-r * 0.5, r * 0.1);
  c.quadraticCurveTo(0, -r * 0.6, r * 0.5, r * 0.1);
  c.moveTo(-r * 0.3, r * 0.4);
  c.quadraticCurveTo(0, 0, r * 0.3, r * 0.4);
  c.stroke();
  c.restore();
}

// ------------------------------------------------------------- the shots

const EVENING_SKY = (c: CanvasRenderingContext2D) =>
  vgrad(c, 0, 700, [
    [0, "#1e2140"],
    [0.55, "#6b4660"],
    [1, "#e09062"],
  ]);

function village(g: G, burning: number, lanternsLit: number) {
  const c = g.c;
  mountains(c, "#3d3552", 470, 120, 1);
  mountains(c, "#2a2338", 540, 90, 4);
  for (let i = 0; i < 9; i++) pine(c, 60 + i * 190 + rnd(i) * 40, 600, 160 + rnd(i + 2) * 80, "#1b1624");
  rect(c, "#211a1c", 0, 640, STAGE_W, 260);
  const houses = [
    [140, 660, 260, 150],
    [520, 655, 300, 170],
    [960, 660, 260, 150],
    [1300, 665, 240, 140],
  ] as const;
  houses.forEach(([x, y, w, h], i) => {
    house(g, x, y, w, h, {
      wall: "#2c2228",
      roof: "#18131a",
      door: lanternsLit ? "rgba(255,170,90,0.55)" : undefined,
      window: lanternsLit ? "rgba(255,180,100,0.45)" : undefined,
      burning: burning * (i === 1 ? 1 : i === 2 ? 0.7 : 0.4),
    });
    lantern(g, x + w * 0.2, y - h * 0.72, 12, lanternsLit, i);
    lantern(g, x + w * 0.8, y - h * 0.72, 12, lanternsLit, i + 5);
  });
}

function shotVillageEvening(g: G) {
  const c = g.c;
  rect(c, EVENING_SKY(c));
  c.save();
  cam(g, 1 + g.p * 0.06, 0, g.p * 10);
  village(g, 0, 1);
  // the boy and father, tiny, in the lane
  figure(c, { kind: "father", x: 860, y: 760, h: 120, facing: -1, color: "#100c10" });
  figure(c, { kind: "child", x: 790, y: 760, h: 70, facing: 1, color: "#100c10", sword: { a: 0.3 + Math.sin(g.t * 3) * 0.5, len: 0.6, kind: "wood" } });
  particles(g, 26, "mote", 3, 0.6);
  c.restore();
  vignette(c, 0.55);
}

function yard(g: G) {
  const c = g.c;
  rect(c, EVENING_SKY(c));
  mountains(c, "#3a3250", 420, 90, 2);
  rect(c, "#2a2024", 0, 700, STAGE_W, 200);
  house(g, 980, 710, 520, 300, { wall: "#2e2328", roof: "#17121a", door: "rgba(255,170,90,0.6)", window: "rgba(255,180,100,0.45)" });
  lantern(g, 1080, 470, 16, 1, 1);
  lantern(g, 1400, 470, 16, 1, 2);
  glow(c, 1240, 600, 300, "rgba(255,170,90,0.35)", 0.6);
}

function shotPractice(g: G) {
  const c = g.c;
  const p = g.p;
  c.save();
  cam(g, 1.04, 0, 0);
  yard(g);
  const swing = seg(p, 0.05, 0.3);
  const over = seg(p, 0.28, 0.45);
  const catchK = seg(p, 0.4, 0.55);
  const adjust = seg(p, 0.6, 0.9);
  const childLean = 0.05 + over * 0.45 - catchK * 0.4;
  figure(c, {
    kind: "child",
    x: 640 + over * 20,
    y: 760,
    h: 230,
    facing: 1,
    lean: childLean,
    armF: -2.2 + swing * 3.1,
    elbowF: -0.2,
    armB: -2.0 + swing * 2.9,
    spread: 0.12 + adjust * 0.14,
    crouch: adjust * 0.3,
    sword: { a: -0.5 + swing * 2.2 - adjust * 1.2, len: 0.65, kind: "wood" },
    rim: "rgba(255,170,100,0.55)",
    color: "#120d10",
  });
  // father: steps in, catches, kneels
  const fx = lerp(980, 760, catchK);
  figure(c, {
    kind: "father",
    x: fx,
    y: 760,
    h: 400,
    facing: -1,
    lean: catchK * 0.35 + adjust * 0.25,
    crouch: adjust * 0.6,
    armF: 0.3 + catchK * 1.1 - adjust * 0.6,
    elbowF: 0.2,
    armB: 0.2 + adjust * 0.9,
    stride: p > 0.3 && p < 0.5 ? run(g.L, 6) : undefined,
    rim: "rgba(255,170,100,0.55)",
    color: "#120d10",
  });
  c.restore();
  vignette(c, 0.55);
}

function shotMotherCalls(g: G) {
  const c = g.c;
  const p = g.p;
  c.save();
  cam(g, 1 + p * 0.03, -p * 20, 0);
  yard(g);
  figure(c, { kind: "mother", x: 1240, y: 710, h: 300, facing: -1, armF: 2.3 + Math.sin(g.t * 5) * 0.25 * (g.reduced ? 0 : 1), elbowF: 0.4, color: "#140e10", rim: "rgba(255,200,130,0.6)" });
  const bx = lerp(450, 1040, seg(p, 0.15, 1));
  figure(c, { kind: "child", x: bx, y: 770, h: 200, facing: 1, lean: 0.25, stride: run(g.L, 11), stepLen: 0.3, armF: Math.sin(run(g.L, 11)) * 0.8, armB: -Math.sin(run(g.L, 11)) * 0.8, color: "#120d10", rim: "rgba(255,170,100,0.5)" });
  figure(c, { kind: "father", x: lerp(380, 640, seg(p, 0.35, 1)), y: 770, h: 380, facing: 1, stride: p > 0.35 ? run(g.L, 6) : undefined, color: "#120d10", rim: "rgba(255,170,100,0.45)" });
  c.restore();
  vignette(c, 0.55);
}

function shotBell(g: G) {
  const c = g.c;
  const p = g.p;
  if (p < 0.4) {
    rect(c, vgrad(c, 0, STAGE_H, [[0, "#1a1a33"], [1, "#a05a48"]]));
    c.save();
    cam(g, 1.05, 0, 0);
    // bell tower
    c.fillStyle = "#0e0b10";
    c.fillRect(700, 300, 26, 600);
    c.fillRect(874, 300, 26, 600);
    c.beginPath();
    c.moveTo(640, 310);
    c.quadraticCurveTo(800, 230, 960, 310);
    c.lineTo(960, 285);
    c.quadraticCurveTo(800, 200, 640, 285);
    c.fill();
    const sw = g.reduced ? 0.08 : Math.sin(g.L * 9) * 0.25;
    c.save();
    c.translate(800, 320);
    c.rotate(sw);
    c.beginPath();
    c.moveTo(-60, 150);
    c.quadraticCurveTo(-60, 20, 0, 10);
    c.quadraticCurveTo(60, 20, 60, 150);
    c.closePath();
    c.fill();
    c.restore();
    c.restore();
  } else {
    rect(c, vgrad(c, 0, STAGE_H, [[0, "#2b1d20"], [1, "#130c0c"]]));
    glow(c, 300, 300, 200, "rgba(255,170,90,0.5)", 0.5);
    glow(c, 1300, 380, 160, "rgba(255,170,90,0.5)", 0.4);
    const k = seg(p, 0.45, 0.8);
    c.save();
    cam(g, 1 + seg(p, 0.4, 1) * 0.06, 0, 0);
    face(c, 800, 470, 420, { kind: "father", light: "#e8a070", side: 1, smile: 1 - k, fear: k * 0.6, turn: -k * 0.8 });
    c.restore();
  }
  vignette(c, 0.6);
}

function shotGateThreat(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#0d0b12"], [1, "#2a1416"]]));
  c.save();
  cam(g, 1 + p * 0.08, 0, 0);
  // forest beyond the gate
  for (let i = 0; i < 12; i++) pine(c, 40 + i * 140 + rnd(i) * 50, 690, 380 + rnd(i + 2) * 120, "#0a080d");
  // enormous shapes moving between the trees
  for (let i = 0; i < 2; i++) {
    const mx = lerp(i ? 1150 : 380, i ? 1050 : 520, p) + (g.reduced ? 0 : Math.sin(g.t * 0.8 + i) * 20);
    c.fillStyle = "#050406";
    c.beginPath();
    c.ellipse(mx, 470, 150, 220, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(mx - 70, 300);
    c.lineTo(mx - 110, 200);
    c.lineTo(mx - 30, 280);
    c.moveTo(mx + 70, 300);
    c.lineTo(mx + 110, 200);
    c.lineTo(mx + 30, 280);
    c.fill();
    glow(c, mx - 35, 330, 22, "rgba(255,80,40,0.9)", 0.6 + 0.4 * seg(p, 0.2, 0.6));
    glow(c, mx + 35, 330, 22, "rgba(255,80,40,0.9)", 0.6 + 0.4 * seg(p, 0.2, 0.6));
  }
  rect(c, "#120c0e", 0, 690, STAGE_W, 210);
  // samurai emerging from darkness (they advance and gain contrast)
  const emerge = seg(p, 0.05, 0.9);
  for (let i = 0; i < 6; i++) {
    const x = 520 + i * 110 + (i % 2) * 30;
    const y = 700 + emerge * 50 + (i % 2) * 18;
    figure(c, {
      kind: "samurai",
      x,
      y,
      h: 210 + emerge * 50,
      facing: i < 3 ? 1 : -1,
      color: "#07060a",
      rim: `rgba(255,110,60,${0.15 + 0.5 * emerge})`,
      stride: g.reduced ? undefined : run(g.L + i, 3),
      stepLen: 0.12,
      sword: { a: 0.2, len: 0.45, kind: "katana" },
    });
    glow(c, x + 30, y - 260, 60, "rgba(255,120,50,0.7)", 0.5 * emerge);
  }
  // the gate posts frame the shot
  c.fillStyle = "#0b0809";
  c.fillRect(330, 120, 60, 780);
  c.fillRect(1210, 120, 60, 780);
  c.fillRect(260, 140, 1080, 50);
  c.fillRect(300, 230, 1000, 30);
  c.restore();
  vignette(c, 0.7);
}

function shotArrowFire(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#140f1c"], [1, "#3e2026"]]));
  c.save();
  cam(g, 1.03, 0, 0, p > 0.15 && p < 0.25 ? 10 : 0);
  mountains(c, "#1f1a28", 500, 80, 7);
  rect(c, "#161013", 0, 700, STAGE_W, 200);
  const spread = seg(p, 0.15, 1);
  house(g, 340, 720, 920, 380, { wall: "#2a1f24", roof: "#130e14", burning: spread });
  const hit = p > 0.15;
  lantern(g, 820, 340, 26, hit ? 0 : 1, 3);
  if (!hit) {
    const k = p / 0.15;
    const ax = lerp(-80, 810, k);
    const ay = lerp(140, 335, k);
    c.strokeStyle = "#d8d2c8";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(ax - 90, ay - 20);
    c.lineTo(ax, ay);
    c.stroke();
  } else {
    fire(g, 820, 360, 120 + spread * 200, 140 + spread * 120, 1, 9);
    c.strokeStyle = "#1a1210";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(730, 315);
    c.lineTo(820, 338);
    c.stroke();
  }
  particles(g, 30 * spread, "ember", 4);
  smoke(g, 0.25 * spread, "rgba(40,30,32,0.9)", 300);
  c.restore();
  vignette(c, 0.6);
}

function shotGateBreach(g: G) {
  const c = g.c;
  const p = g.p;
  const impact = seg(p, 0.05, 0.15);
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#1a0c0c"], [1, "#5a2016"]]));
  c.save();
  cam(g, 1.02 + impact * 0.03, 0, 0, p > 0.08 && p < 0.3 ? 18 : 0);
  smoke(g, 0.45, "rgba(30,20,22,0.9)", 520, 1.5);
  fire(g, 200, 700, 300, 260, 1, 1);
  fire(g, 1420, 700, 300, 220, 0.9, 2);
  rect(c, "#140c0c", 0, 700, STAGE_W, 200);
  // the monster through the gate
  const mx = lerp(800, 820, p);
  const mScale = lerp(0.8, 1.15, seg(p, 0.05, 0.6));
  c.save();
  c.translate(mx, 720);
  c.scale(mScale, mScale);
  c.fillStyle = "#050304";
  c.beginPath();
  c.ellipse(0, -260, 230, 270, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(-120, -470);
  c.quadraticCurveTo(-250, -620, -180, -700);
  c.lineTo(-80, -500);
  c.moveTo(120, -470);
  c.quadraticCurveTo(250, -620, 180, -700);
  c.lineTo(80, -500);
  c.fill();
  c.fillRect(-260, -300, 80, 280);
  c.fillRect(180, -300, 80, 280);
  c.restore();
  glow(c, mx - 60, 720 - 420 * mScale, 30, "rgba(255,90,40,1)", 0.9);
  glow(c, mx + 60, 720 - 420 * mScale, 30, "rgba(255,90,40,1)", 0.9);
  // gate planks flying
  for (let i = 0; i < 8; i++) {
    const k = seg(p, 0.06, 0.7);
    const ang = (rnd(i) - 0.5) * 2.4;
    const x = 800 + Math.sin(ang) * k * 900;
    const y = 520 - Math.cos(ang) * k * 300 + k * k * 500;
    c.save();
    c.translate(x, y);
    c.rotate(k * (rnd(i + 5) * 8 - 4));
    c.fillStyle = "#2a1a14";
    c.fillRect(-60, -12, 120, 24);
    c.restore();
  }
  // villagers scatter
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const k = seg(p, 0.1, 1);
    figure(c, { kind: "villager", x: 800 + side * (180 + i * 40 + k * 500), y: 790 + (i % 3) * 14, h: 150, facing: side as 1 | -1, lean: 0.35, stride: run(g.L + i, 12), stepLen: 0.3, color: "#0a0608" });
  }
  // the family pulled inside (foreground right)
  const fk = seg(p, 0.4, 1);
  c.save();
  c.globalAlpha = 1 - seg(p, 0.85, 1);
  figure(c, { kind: "father", x: lerp(1050, 1380, fk), y: 880, h: 420, facing: 1, lean: 0.3, stride: run(g.L, 9), armB: -1.0, color: "#050304", rim: "rgba(255,120,60,0.6)" });
  figure(c, { kind: "mother", x: lerp(940, 1300, fk), y: 880, h: 380, facing: 1, lean: 0.25, stride: run(g.L + 0.3, 9), armF: 0.8, color: "#050304", rim: "rgba(255,120,60,0.6)" });
  figure(c, { kind: "child", x: lerp(900, 1260, fk), y: 880, h: 220, facing: 1, lean: 0.25, stride: run(g.L + 0.6, 12), armF: 1.2, color: "#050304", rim: "rgba(255,120,60,0.6)" });
  c.restore();
  particles(g, 40, "ember", 9, 1.3);
  c.restore();
  if (!g.reduced && p > 0.05 && p < 0.12) rect(c, "rgba(255,180,120,0.18)");
  vignette(c, 0.6);
}

function shotHatchOpen(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, "#140d0a");
  c.save();
  cam(g, 1.02, 0, 0);
  // room cutaway: floor line at 560, cellar below
  rect(c, vgrad(c, 0, 560, [[0, "#2a1a12"], [1, "#3a2416"]]), 0, 0, STAGE_W, 560);
  glow(c, 240, 260, 380, "rgba(255,120,50,0.55)", 0.6 * flicker(g, 1, 0.35));
  glow(c, 1300, 300, 300, "rgba(255,190,120,0.45)", 0.4);
  rect(c, "#1e130c", 0, 560, STAGE_W, 40);
  // stone cellar
  rect(c, "#0e0a09", 600, 600, 420, 300);
  c.strokeStyle = "rgba(70,60,55,0.45)";
  c.lineWidth = 3;
  for (let r = 0; r < 5; r++)
    for (let k = 0; k < 4; k++) c.strokeRect(600 + k * 105 + (r % 2) * 50, 600 + r * 60, 105, 60);
  // hatch board swinging up on its hinge
  const open = seg(p, 0, 0.35);
  c.save();
  c.translate(600, 560);
  c.rotate(-open * 1.9);
  c.fillStyle = "#3a2618";
  c.fillRect(0, -20, 420, 30);
  c.restore();
  figure(c, { kind: "father", x: 470, y: 560, h: 380, facing: 1, crouch: 0.75, lean: 0.4, armF: 2.2 - open * 0.5, elbowF: 0.3, color: "#0c0807", rim: "rgba(255,140,70,0.55)" });
  // mother lowers the boy
  const lower = seg(p, 0.35, 0.95);
  figure(c, { kind: "mother", x: 1110, y: 560, h: 360, facing: -1, crouch: 0.7, lean: 0.55, armF: 1.3 + lower * 0.5, elbowF: 0.2, color: "#0c0807", rim: "rgba(255,190,120,0.5)" });
  figure(c, { kind: "child", x: 870, y: lerp(560, 800, lower), h: 200, facing: -1, armF: 2.6, armB: 2.4, color: "#0c0807", rim: "rgba(255,190,120,0.5)" });
  c.restore();
  smoke(g, 0.15, "rgba(40,30,30,0.8)", 300);
  vignette(c, 0.7);
}

function shotGripSleeve(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#3b2418"], [1, "#080605"]]));
  glow(c, 800, 60, 500, "rgba(255,170,100,0.6)", 0.6 * flicker(g, 4, 0.2));
  c.save();
  cam(g, 1 + p * 0.05, 0, 0);
  // mother's sleeve hanging from above
  c.fillStyle = "#2a1c22";
  c.beginPath();
  c.moveTo(560, -20);
  c.quadraticCurveTo(620, 200, 600, 330);
  c.lineTo(900, 340);
  c.quadraticCurveTo(940, 180, 1000, -20);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(200,150,120,0.25)";
  c.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.moveTo(600 + i * 60, 0);
    c.quadraticCurveTo(620 + i * 55, 180, 620 + i * 50, 330);
    c.stroke();
  }
  face(c, 800, 660, 360, { kind: "child", light: "#f0b080", side: 1, lookUp: 1, fear: 0.6, mouth: p > 0.15 && p < 0.65 ? 0.4 : 0, tears: seg(p, 0.3, 1) * 0.7 });
  // the small hand gripping the sleeve edge
  hand(c, 760, 360, 90, 0.2, 0.85, "#3a2620");
  c.restore();
  vignette(c, 0.7);
}

function shotCharmHand(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#2c1a12"], [1, "#0b0706"]]));
  glow(c, 900, 300, 600, "rgba(255,170,100,0.5)", 0.5 * flicker(g, 6, 0.15));
  c.save();
  cam(g, 1 + p * 0.06, 0, 0);
  const place = seg(p, 0.0, 0.35);
  const close = seg(p, 0.42, 0.85);
  // boy's palm, open then closing
  c.fillStyle = "#2b1c16";
  c.fillRect(560, 560, 260, 120);
  hand(c, 820, 600, 200, -1.5, close * 0.95, "#4a3026");
  if (close < 0.75) charm(c, lerp(840, 830, place), lerp(380, 590, place), 46, 0);
  // mother's hand and sleeve folding over his
  const mx = lerp(1250, 900, place) - close * 20;
  const my = lerp(300, 470, place) + close * 90;
  c.fillStyle = "#3a2a30";
  c.beginPath();
  c.moveTo(1700, 200);
  c.lineTo(mx + 120, my - 90);
  c.lineTo(mx + 160, my + 80);
  c.lineTo(1700, 520);
  c.closePath();
  c.fill();
  hand(c, mx, my, 230, 1.9 + close * 0.6, 0.35 + close * 0.5, "#5a3a2e", -1);
  c.restore();
  vignette(c, 0.7);
}

function familyInRoom(g: G, turn: number, rim: string) {
  const c = g.c;
  figure(c, { kind: "father", x: 980, y: 900, h: 620, facing: turn > 0.5 ? -1 : 1, color: "#090605", rim, armF: 0.2 });
  figure(c, { kind: "mother", x: 1180, y: 900, h: 560, facing: turn > 0.6 ? -1 : 1, color: "#090605", rim });
}

function shotHatchClose(g: G) {
  const c = g.c;
  const p = g.p;
  const close = seg(p, 0, 0.45);
  const half = lerp(330, 92, close);
  slit(g, 400, half, () => {
    c.save();
    cam(g, 1.02, 0, 0);
    interiorRoom(g, 0.35);
    familyInRoom(g, seg(p, 0.5, 0.9), "rgba(255,170,100,0.55)");
    c.restore();
  });
  vignette(c, 0.6);
}

function shotDoorBreaks(g: G) {
  const c = g.c;
  const p = g.p;
  slit(g, 400, 92, () => {
    c.save();
    cam(g, 1.02, 0, 0, p > 0.05 && p < 0.25 ? 14 : 0);
    const open = seg(p, 0.06, 0.16);
    interiorRoom(g, 0.4 + open * 0.6, open);
    if (open < 1) {
      c.fillStyle = "#2a1a12";
      c.fillRect(330, 180, 200 * (1 - open), 420);
    }
    for (let i = 0; i < 6; i++) {
      const k = open;
      c.save();
      c.translate(430 + k * (rnd(i) * 500 + 100), 400 + (rnd(i + 3) - 0.5) * 300 * k);
      c.rotate(k * (rnd(i + 1) * 6 - 3));
      c.fillStyle = "#2a1a12";
      c.fillRect(-40, -10, 80, 20);
      c.restore();
    }
    for (let i = 0; i < 3; i++) figure(c, { kind: "samurai", x: 390 + i * 70, y: 640, h: 330, facing: 1, color: "#080505", alpha: open });
    familyInRoom(g, 1, "rgba(255,130,60,0.6)");
    c.restore();
  });
  vignette(c, 0.6);
}

function shotAntagonistEnters(g: G) {
  const c = g.c;
  const p = g.p;
  slit(g, 400, 92, () => {
    c.save();
    cam(g, 1.03 + p * 0.03, 0, 0);
    interiorRoom(g, 1, 1);
    for (let i = 0; i < 3; i++) figure(c, { kind: "samurai", x: 360 + i * 60, y: 640, h: 330, facing: 1, color: "#080505" });
    const step = seg(p, 0, 1);
    figure(c, {
      kind: "antagonist",
      x: lerp(470, 680, step),
      y: 900,
      h: 640,
      facing: 1,
      color: "#cdc5ba",
      rim: "rgba(255,120,60,0.7)",
      stride: g.reduced ? undefined : run(g.L, 2.2),
      stepLen: 0.1,
      sword: { a: 2.6, len: 0.6, kind: "nodachi" },
    });
    familyInRoom(g, 1, "rgba(255,130,60,0.55)");
    c.restore();
  }, "rgba(255,110,50,0.08)");
  vignette(c, 0.6);
}

function shotRobeInsert(g: G) {
  // Detail: his white robe and its crimson brushstroke flames, stepping slowly across the floor
  const c = g.c;
  const p = g.p;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#1c0f0a"], [1, "#0a0605"]]));
  c.save();
  cam(g, 1.04 + p * 0.05, 0, 0);
  // floorboards in firelight
  for (let i = 0; i < 6; i++) {
    c.fillStyle = i % 2 ? "#2a1710" : "#24140e";
    c.fillRect(0, 640 + i * 46, STAGE_W, 44);
  }
  glow(c, 300, 700, 700, "rgba(255,110,50,0.5)", 0.55 * flicker(g, 4, 0.3));
  const x = lerp(1300, 380, p);
  // robe hem
  const robe = c.createLinearGradient(0, 80, 0, 760);
  robe.addColorStop(0, "#a8a096");
  robe.addColorStop(1, "#e4ddd2");
  c.fillStyle = robe;
  c.beginPath();
  c.moveTo(x - 330, 60);
  c.lineTo(x + 330, 60);
  c.lineTo(x + 420, 720);
  for (let k = 0; k <= 12; k++) c.lineTo(x + 420 - k * 70, 720 + (k % 2 ? 14 : -6));
  c.closePath();
  c.fill();
  // folds
  c.strokeStyle = "rgba(90,80,72,0.35)";
  c.lineWidth = 6;
  for (let k = -3; k <= 3; k++) {
    c.beginPath();
    c.moveTo(x + k * 90, 60);
    c.quadraticCurveTo(x + k * 110 + 20, 400, x + k * 120, 720);
    c.stroke();
  }
  // crimson brushstroke flames rising from the hem
  c.fillStyle = "rgba(150,14,24,0.92)";
  for (let k = 0; k < 9; k++) {
    const fx = x - 360 + k * 90;
    const h = 160 + ((k * 53) % 5) * 55;
    c.beginPath();
    c.moveTo(fx - 34, 716);
    c.quadraticCurveTo(fx - 40, 716 - h * 0.55, fx + 14, 716 - h);
    c.quadraticCurveTo(fx + 6, 716 - h * 0.45, fx + 38, 716);
    c.closePath();
    c.fill();
  }
  c.fillStyle = "rgba(210,30,40,0.85)";
  c.beginPath();
  c.moveTo(x + 120, 300);
  c.lineTo(x + 175, 250);
  c.lineTo(x + 150, 330);
  c.lineTo(x + 200, 320);
  c.lineTo(x + 130, 420);
  c.closePath();
  c.fill();
  // a sandalled foot stepping out beneath the hem
  const step = Math.max(0, Math.sin(p * Math.PI * 2));
  c.fillStyle = "#0c0908";
  c.beginPath();
  c.ellipse(x - 120 - step * 60, 742, 80, 22, 0, 0, Math.PI * 2);
  c.fill();
  particles(g, 26, "ember", 21, 0.6);
  c.restore();
  vignette(c, 0.75);
}

function shotSwordFace(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#0d0807"], [1, "#2a120c"]]));
  if (p < 0.45) {
    const k = seg(p, 0, 0.4);
    c.save();
    cam(g, 1.04, 0, 0);
    c.translate(800, 450);
    c.rotate(-0.12);
    // scabbard
    c.fillStyle = "#120c0c";
    c.fillRect(-900, -22, 700, 44);
    // drawn blade sliding out
    const bx = -200 + k * 950;
    const blade = c.createLinearGradient(0, -16, 0, 16);
    blade.addColorStop(0, "#ff6a5a");
    blade.addColorStop(0.45, "#b0101c");
    blade.addColorStop(1, "#4a0408");
    c.fillStyle = blade;
    c.beginPath();
    c.moveTo(-200, -16);
    c.lineTo(bx, -16);
    c.quadraticCurveTo(bx + 70, -8, bx + 95, 16);
    c.lineTo(-200, 16);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(255,190,170,0.85)";
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-200, -15);
    c.lineTo(bx, -15);
    c.stroke();
    glow(c, bx * 0.6, 0, 180, "rgba(255,40,30,0.8)", 0.35 * k);
    // plain dark guard and black grip with a white diamond wrap
    c.fillStyle = "#151212";
    c.beginPath();
    c.ellipse(-210, 0, 18, 46, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#111";
    c.fillRect(-500, -18, 280, 36);
    c.fillStyle = "rgba(225,220,212,0.85)";
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.moveTo(-490 + i * 30, 0);
      c.lineTo(-478 + i * 30, -12);
      c.lineTo(-466 + i * 30, 0);
      c.lineTo(-478 + i * 30, 12);
      c.closePath();
      c.fill();
    }
    c.restore();
    glow(c, 800 + (k - 0.5) * 700, 450, 120, "rgba(255,230,200,0.7)", 0.5 * k);
  } else {
    const k = seg(p, 0.45, 1);
    c.save();
    cam(g, 1.04 + k * 0.06, 0, 0);
    glow(c, 800, 900, 700, "rgba(255,110,50,0.55)", 0.7 * flicker(g, 3, 0.3));
    antagonistFace(g, 800, 470, 420, seg(p, 0.5, 0.8));
    c.restore();
  }
  vignette(c, 0.7);
}

function shotFatherFalls(g: G) {
  const c = g.c;
  const p = g.p;
  const strike = 0.42;
  slit(g, 400, 92, () => {
    c.save();
    cam(g, 1.03, 0, 0, p > strike && p < strike + 0.1 ? 10 : 0);
    interiorRoom(g, 1, 1);
    const fall = seg(p, strike + 0.05, 0.85);
    figure(c, {
      kind: "father",
      x: 930,
      y: 900 + fall * 520,
      h: 620,
      facing: -1,
      lean: -0.1 + fall * 0.5,
      armF: 2.6 - fall * 1.5,
      armB: 2.5 - fall * 1.5,
      elbowF: -0.3,
      sword: { a: -0.2, len: 0.22, kind: "knife" },
      color: "#090605",
      rim: "rgba(255,130,60,0.6)",
      tilt: fall * 0.4,
    });
    const swing = seg(p, strike - 0.08, strike + 0.04);
    figure(c, { kind: "antagonist", x: 640, y: 900, h: 640, facing: 1, color: "#cdc5ba", rim: "rgba(255,120,60,0.7)", armF: 2.5 - swing * 2.6, armB: 2.4 - swing * 2.4, sword: { a: -0.6 + swing * 2.6, len: 0.62, kind: "nodachi" } });
    figure(c, { kind: "mother", x: 1210, y: 900, h: 560, facing: -1, color: "#090605", rim: "rgba(255,130,60,0.5)", lean: fall * 0.2 });
    // the flash of steel: a single bright arc
    if (p > strike - 0.02 && p < strike + 0.12) {
      const a = seg(p, strike - 0.02, strike + 0.12);
      c.strokeStyle = `rgba(255,245,230,${(g.reduced ? 0.5 : 0.95) * (1 - a)})`;
      c.lineWidth = 14 * (1 - a) + 2;
      c.beginPath();
      c.arc(700, 520, 360, -1.9, -1.9 + a * 2.2);
      c.stroke();
    }
    c.restore();
  });
  if (!g.reduced && p > strike && p < strike + 0.05) rect(c, "rgba(255,240,220,0.22)");
  vignette(c, 0.6);
}

function slitFaceShot(g: G, opts: { fear: number; mouth: number; tears: number; band: string; shadow?: number; handFall?: number; redden?: number }) {
  const c = g.c;
  rect(c, "#040303");
  // the child's face in the dark, a band of light across the eyes
  c.save();
  cam(g, 1 + g.p * 0.04, 0, 0);
  face(c, 800, 520, 520, { kind: "child", light: "#d88a58", side: 1, fear: opts.fear, mouth: opts.mouth, tears: opts.tears, lookUp: 0.6 });
  c.restore();
  // darkness except the band
  const bandY = 508;
  const bandH = 90;
  c.fillStyle = "rgba(4,3,3,0.72)";
  c.fillRect(0, 0, STAGE_W, bandY - bandH / 2);
  c.fillRect(0, bandY + bandH / 2, STAGE_W, STAGE_H - bandY - bandH / 2);
  const band = c.createLinearGradient(0, bandY - bandH / 2 - 40, 0, bandY + bandH / 2 + 40);
  band.addColorStop(0, "rgba(0,0,0,0)");
  band.addColorStop(0.5, opts.band);
  band.addColorStop(1, "rgba(0,0,0,0)");
  c.save();
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = 0.35 * flicker(g, 8, 0.3);
  c.fillStyle = band;
  c.fillRect(0, bandY - bandH / 2 - 40, STAGE_W, bandH + 80);
  c.restore();
  // shadow crossing the light
  if (opts.shadow !== undefined && opts.shadow > 0 && opts.shadow < 1) {
    const sx = lerp(-400, 2000, opts.shadow);
    c.fillStyle = "rgba(0,0,0,0.75)";
    c.fillRect(sx - 260, bandY - 80, 520, 160);
  }
  // board above the gap, and the hand that falls beside it
  if (opts.handFall !== undefined) {
    const k = ease(opts.handFall);
    c.fillStyle = "#2a1d22";
    c.beginPath();
    c.moveTo(1050, -40);
    c.lineTo(1180, -40);
    c.lineTo(1170, lerp(-80, 330, k));
    c.lineTo(1060, lerp(-80, 330, k));
    c.closePath();
    c.fill();
    hand(c, 1115, lerp(-40, 400, k), 120, Math.PI, 0.25, "#5a3a2e");
  }
  if (opts.redden) rect(c, `rgba(120,20,10,${0.25 * opts.redden})`);
  vignette(c, 0.6);
}

function shotChildFear(g: G) {
  const p = g.p;
  slitFaceShot(g, {
    fear: 0.7 + seg(p, 0, 0.3) * 0.3,
    mouth: p > 0.3 && p < 0.7 ? 0.55 : 0.15,
    tears: seg(p, 0.2, 1) * 0.8,
    band: "rgba(255,150,80,1)",
    shadow: p < 0.45 ? seg(p, 0.1, 0.45) : seg(p, 0.7, 0.85),
  });
}

function shotHandFalls(g: G) {
  const p = g.p;
  slitFaceShot(g, { fear: 1, mouth: 0.1, tears: 1, band: "rgba(255,120,70,1)", handFall: seg(p, 0.08, 0.4), redden: seg(p, 0.5, 1), shadow: seg(p, 0.6, 0.95) });
}

function ceiling(g: G, spread: number, intensity: number) {
  const c = g.c;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#1e100a"], [1, "#3a1a0c"]]));
  c.fillStyle = "#0d0705";
  for (let i = 0; i < 5; i++) c.fillRect(0, 60 + i * 170, STAGE_W, 50);
  for (let i = 0; i < 5; i++) fire(g, lerp(-200, 1800, spread) / 2 + i * 120, 110 + i * 170, 1600 * spread, 90, intensity, i * 3);
  particles(g, 40, "ember", 13, 1.5);
  smoke(g, 0.4, "rgba(30,15,10,0.9)", 600, 2);
}

function shotCeilingFire(g: G) {
  const c = g.c;
  const p = g.p;
  const wob = g.reduced ? 0 : Math.max(0, Math.sin(g.L * 14)) * 10 * seg(p, 0.3, 1);
  slit(g, 470, 80 + wob, () => {
    c.save();
    cam(g, 1.02, 0, 0);
    ceiling(g, seg(p, 0, 1), 0.7 + p * 0.3);
    c.restore();
  }, "rgba(255,90,30,0.08)");
  // the boy's hands pushing up against the hatch
  const push = seg(p, 0.3, 0.5);
  hand(c, 650, 600 - push * 30 - wob, 130, 0, 0.1, "#2a1a14");
  hand(c, 950, 600 - push * 30 - wob, 130, 0, 0.1, "#2a1a14", -1);
  vignette(c, 0.6);
}

function shotBeamFalls(g: G) {
  const c = g.c;
  const p = g.p;
  const fall = seg(p, 0.15, 0.35);
  c.save();
  cam(g, 1, 0, 0, p > 0.3 && p < 0.55 ? 20 : 0);
  slit(g, 470, 80 * (1 - seg(p, 0.33, 0.4)), () => {
    ceiling(g, 1, 1);
    c.save();
    c.translate(800, lerp(-300, 470, fall));
    c.rotate(0.12);
    c.fillStyle = "#1a0d08";
    c.fillRect(-1000, -70, 2000, 140);
    c.restore();
    fire(g, 800, lerp(-300, 440, fall), 1500, 160, 1, 5);
  });
  c.restore();
  rect(c, `rgba(0,0,0,${seg(p, 0.45, 0.9)})`);
  if (!g.reduced && p > 0.33 && p < 0.38) rect(c, "rgba(255,160,90,0.2)");
}

function shotCellarDark(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, "#050404");
  const vent = 1 - seg(p, 0.4, 1) * 0.6;
  // stone wall faintly lit from the vent
  c.save();
  c.globalAlpha = 0.5 * vent;
  c.strokeStyle = "rgba(120,70,40,0.4)";
  c.lineWidth = 3;
  for (let r = 0; r < 9; r++) for (let k = 0; k < 9; k++) c.strokeRect(k * 200 + (r % 2) * 100 - 100, r * 100, 200, 100);
  c.restore();
  // vent with bars
  rect(c, `rgba(255,120,50,${0.65 * vent * flicker(g, 2, 0.4)})`, 1100, 160, 220, 90);
  c.fillStyle = "#050404";
  for (let i = 0; i < 5; i++) c.fillRect(1100 + i * 50, 160, 14, 90);
  glow(c, 1210, 205, 500, "rgba(255,110,40,0.6)", 0.5 * vent * flicker(g, 2, 0.4));
  // smoke drifting past the opening
  c.save();
  c.beginPath();
  c.rect(1000, 80, 420, 300);
  c.clip();
  smoke(g, 0.5, "rgba(90,60,50,0.8)", 300, 1.6);
  c.restore();
  // the boy curled beneath the wall
  c.save();
  c.translate(560, 760);
  c.scale(1.25, 1.25);
  c.fillStyle = "#1c1311";
  c.beginPath();
  c.ellipse(0, 0, 170, 110, -0.2, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(-110, -100, 70, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = `rgba(255,140,70,${0.8 * vent})`;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(-110, -100, 70, -1.2, 0.2);
  c.stroke();
  c.beginPath();
  c.ellipse(0, 0, 170, 110, -0.2, -1.4, -0.2);
  c.stroke();
  c.restore();
  // the charm in his fists catching a little light
  glow(c, 660, 720, 50, "rgba(255,190,120,0.9)", 0.5 * vent);
  charm(c, 660, 730, 18, 0);
  vignette(c, 0.6);
}

const DAWN_SKY = (c: CanvasRenderingContext2D) =>
  vgrad(c, 0, 700, [
    [0, "#5c6068"],
    [0.6, "#9da0a4"],
    [1, "#cfc8bc"],
  ]);

function ruins(g: G, offset = 0) {
  const c = g.c;
  mountains(c, "#7d7f86", 470, 110, 1);
  mountains(c, "#6a6b72", 540, 80, 4);
  rect(c, "#3f3b3a", 0, 640, STAGE_W, 260);
  c.fillStyle = "#1c1918";
  for (let i = 0; i < 10; i++) {
    const x = ((i * 190 + offset) % (STAGE_W + 200)) - 100;
    const h = 120 + rnd(i) * 220;
    c.save();
    c.translate(x, 660);
    c.rotate((rnd(i + 3) - 0.5) * 0.4);
    c.fillRect(-10, -h, 20, h);
    c.restore();
    c.fillRect(x - 70, 640 + rnd(i + 1) * 30, 140, 16);
  }
  // thin smoke wisps rising straight in still air
  c.strokeStyle = "rgba(220,220,220,0.18)";
  c.lineWidth = 12;
  for (let i = 0; i < 5; i++) {
    const x = 200 + i * 300 + offset * 0.2;
    c.beginPath();
    c.moveTo(x, 650);
    for (let y = 650; y > 150; y -= 50) c.lineTo(x + Math.sin(y * 0.02 + g.t * (g.reduced ? 0 : 0.5) + i) * 20, y);
    c.stroke();
  }
}

function shotDawnEmerge(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, DAWN_SKY(c));
  c.save();
  cam(g, 1.05, 0, 0);
  ruins(g);
  // wreckage heap in the foreground
  c.fillStyle = "#161312";
  for (let i = 0; i < 9; i++) {
    c.save();
    c.translate(400 + i * 100, 780 + rnd(i) * 30);
    c.rotate((rnd(i + 2) - 0.5) * 1.2);
    c.fillRect(-160, -18, 320, 36);
    c.restore();
  }
  const rise = seg(p, 0.15, 0.95);
  c.save();
  c.beginPath();
  c.rect(0, 0, STAGE_W, 790);
  c.clip();
  figure(c, { kind: "child", x: 820, y: lerp(1060, 790, rise), h: 280, facing: -1, armF: 2.6 - rise * 2, armB: 2.4 - rise * 2, lean: 0.2, color: "#0e0b0a", rim: "rgba(240,240,240,0.55)" });
  c.restore();
  particles(g, 30, "ash", 5, 0.6);
  c.restore();
  vignette(c, 0.5);
}

function shotRuinsSearch(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, DAWN_SKY(c));
  c.save();
  cam(g, 1, -p * 40, 0);
  ruins(g, 40);
  const x = lerp(500, 950, p);
  figure(c, { kind: "child", x, y: 760, h: 170, facing: 1, stride: run(g.L, 4.5), stepLen: 0.14, lean: 0.05, color: "#161211", armF: p > 0.2 && p < 0.5 ? 1.2 : 0.1, elbowF: 0.6 });
  particles(g, 24, "ash", 6, 0.5);
  c.restore();
  vignette(c, 0.5);
}

function shotKneel(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, DAWN_SKY(c));
  c.save();
  cam(g, 1.06 + p * 0.05, 0, 0);
  mountains(c, "#80828a", 420, 80, 2);
  rect(c, "#4a4542", 0, 620, STAGE_W, 280);
  // stone step where the house stood
  c.fillStyle = "#2b2726";
  c.fillRect(420, 640, 760, 60);
  c.fillStyle = "#1a1716";
  c.fillRect(380, 700, 840, 30);
  const kneel = seg(p, 0, 0.4);
  figure(c, { kind: "child", x: 800, y: 760, h: 300, facing: -1, crouch: 0.3 + kneel * 0.7, lean: 0.25 + kneel * 0.2, armF: 0.4, armB: 0.1, elbowF: 0.1, color: "#141010", rim: "rgba(240,235,225,0.35)" });
  // charm hanging from the fist
  const sw = g.reduced ? 0.04 : Math.sin(g.t * 2) * 0.12;
  charm(c, 755, 760, 13, sw);
  particles(g, 20, "ash", 8, 0.4);
  c.restore();
  vignette(c, 0.5);
}

type Season = { sky: CanvasGradient; ground: string; rim: string };

function season(c: CanvasRenderingContext2D, name: "gray" | "rain" | "autumn" | "winter" | "spring" | "dusk"): Season {
  switch (name) {
    case "gray":
      return { sky: vgrad(c, 0, 700, [[0, "#6a6e74"], [1, "#b0aca2"]]), ground: "#3d3a37", rim: "rgba(230,230,225,0.35)" };
    case "rain":
      return { sky: vgrad(c, 0, 700, [[0, "#2c3540"], [1, "#58646e"]]), ground: "#232a30", rim: "rgba(190,210,230,0.4)" };
    case "autumn":
      return { sky: vgrad(c, 0, 700, [[0, "#5a2c1e"], [1, "#e0904a"]]), ground: "#3a2216", rim: "rgba(255,190,120,0.5)" };
    case "winter":
      return { sky: vgrad(c, 0, 700, [[0, "#7c8aa0"], [1, "#dfe6ee"]]), ground: "#e8edf2", rim: "rgba(255,255,255,0.5)" };
    case "spring":
      return { sky: vgrad(c, 0, 700, [[0, "#8aa0a8"], [1, "#f0d8d0"]]), ground: "#4a5a40", rim: "rgba(255,240,230,0.5)" };
    case "dusk":
      return { sky: vgrad(c, 0, 700, [[0, "#1c2236"], [0.7, "#7a3a3a"], [1, "#d07a4a"]]), ground: "#1d1618", rim: "rgba(255,160,110,0.6)" };
  }
}

function field(g: G, s: Season, treeColor = "#151213") {
  const c = g.c;
  rect(c, s.sky);
  mountains(c, "rgba(0,0,0,0.25)", 480, 100, 3);
  rect(c, s.ground, 0, 700, STAGE_W, 200);
  // the dead tree he trains beside
  c.strokeStyle = treeColor;
  c.lineCap = "round";
  c.lineWidth = 34;
  c.beginPath();
  c.moveTo(1260, 710);
  c.quadraticCurveTo(1230, 500, 1290, 330);
  c.stroke();
  c.lineWidth = 14;
  c.beginPath();
  c.moveTo(1280, 420);
  c.quadraticCurveTo(1380, 360, 1440, 260);
  c.moveTo(1270, 480);
  c.quadraticCurveTo(1170, 420, 1110, 330);
  c.stroke();
}

function swingPose(k: number) {
  // k: 0 raised, 1 finished low-forward
  return { armF: -2.4 + k * 3.4, armB: -2.2 + k * 3.2, elbowF: -0.2, sword: -0.6 + k * 2.5 };
}

function shotFirstStance(g: G) {
  const c = g.c;
  const p = g.p;
  const s = season(c, "gray");
  field(g, s);
  c.save();
  cam(g, 1.02, 0, 0);
  const s1 = seg(p, 0.08, 0.3);
  const miss = seg(p, 0.3, 0.45) * (1 - seg(p, 0.5, 0.6));
  const s2 = seg(p, 0.65, 0.88);
  const k = p < 0.6 ? s1 : s2;
  const sw = swingPose(p < 0.55 ? s1 : p < 0.65 ? 0 : s2);
  figure(c, { kind: "child", x: 700 + miss * 40, y: 760, h: 260, facing: 1, spread: 0.24, crouch: 0.3, lean: 0.05 + miss * 0.35, armF: sw.armF, armB: sw.armB, elbowF: sw.elbowF, sword: { a: sw.sword, len: 0.65, kind: "wood" }, color: "#141011", rim: s.rim });
  void k;
  c.restore();
  vignette(c, 0.5);
}

function shotMontageRain(g: G) {
  const c = g.c;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#1c232c"], [1, "#384450"]]));
  c.save();
  cam(g, 1 + g.p * 0.05, 0, 0);
  face(c, 800, 470, 460, { kind: "teen", light: "#a8bccc", side: -1, wet: 1, fear: 0.1 });
  c.restore();
  particles(g, 120, "rain", 2, 1);
  vignette(c, 0.6);
}

function shotMontageKnocked(g: G) {
  const c = g.c;
  const p = g.p;
  const s = season(c, "autumn");
  field(g, s);
  c.save();
  cam(g, 1.02, 0, 0, p > 0.25 && p < 0.35 ? 10 : 0);
  // training post
  c.fillStyle = "#1a100c";
  c.fillRect(940, 430, 50, 290);
  const hit = seg(p, 0.1, 0.25);
  const fly = seg(p, 0.25, 1);
  const sw = swingPose(hit);
  figure(c, { kind: "teen", x: 720, y: 760, h: 330, facing: 1, spread: 0.22, crouch: 0.25, lean: hit * 0.2 - fly * 0.25, armF: fly > 0 ? lerp(sw.armF, 0.5, fly) : sw.armF, armB: fly > 0 ? lerp(sw.armB, -0.6, fly) : sw.armB, color: "#140d0b", rim: s.rim, sword: fly > 0 ? undefined : { a: sw.sword, len: 0.6, kind: "wood" } });
  if (fly > 0) {
    c.save();
    c.translate(lerp(940, 1150, fly), lerp(520, 300, fly) + fly * fly * 300);
    c.rotate(fly * 9);
    c.fillStyle = "#5b4130";
    c.fillRect(-100, -6, 200, 12);
    c.restore();
  }
  particles(g, 40, "leaf", 7, 1);
  c.restore();
  vignette(c, 0.55);
}

function shotMontageWrist(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#38424e"], [1, "#151a20"]]));
  c.save();
  cam(g, 1.04 + p * 0.04, 0, 0);
  // forearm across frame, cloth wrapping
  c.save();
  c.translate(800, 470);
  c.rotate(-0.25);
  c.fillStyle = "#4a3428";
  c.fillRect(-800, -70, 760, 140);
  c.strokeStyle = "#cfc6b6";
  c.lineWidth = 22;
  for (let i = 0; i < 7; i++) {
    c.beginPath();
    c.moveTo(-420 + i * 50, -78);
    c.lineTo(-380 + i * 50, 78);
    c.stroke();
  }
  // loose end being pulled tight
  const pull = seg(p, 0.1, 0.6);
  c.lineWidth = 18;
  c.beginPath();
  c.moveTo(-90, 60);
  c.quadraticCurveTo(-60, 160 - pull * 80, -10, 260 - pull * 180);
  c.stroke();
  // wooden grip and tightening fist
  c.fillStyle = "#5b4130";
  c.fillRect(-20, -300, 50, 640);
  hand(c, 10, 0, 220, Math.PI / 2, 0.55 + seg(p, 0.3, 0.9) * 0.4, "#5a3e30");
  c.restore();
  c.restore();
  vignette(c, 0.6);
}

function shotMontageSnow(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#a8b4c4"], [1, "#e8eef4"]]));
  c.save();
  cam(g, 1.03, 0, 0);
  rect(c, "#f0f4f8", 0, 620, STAGE_W, 280);
  const settle = seg(p, 0.1, 0.6);
  // two bare feet steadying, shifting into the stance
  for (const [i, x0, x1] of [
    [0, 640, 560],
    [1, 900, 980],
  ] as const) {
    const x = lerp(x0, x1, settle);
    c.fillStyle = "#6a4a3a";
    c.beginPath();
    c.ellipse(x, 700, 120, 46, i ? 0.1 : -0.1, 0, Math.PI * 2);
    c.fill();
    c.fillRect(x - 50, 420, 100, 280);
    c.fillStyle = "#dfe6ec";
    c.beginPath();
    c.ellipse(x, 740, 150, 26, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#24242c";
  c.beginPath();
  c.moveTo(lerp(600, 520, settle), -20);
  c.lineTo(lerp(1000, 1080, settle), -20);
  c.lineTo(lerp(1060, 1160, settle), 450);
  c.lineTo(lerp(540, 440, settle), 450);
  c.closePath();
  c.fill();
  c.restore();
  particles(g, 90, "snow", 4, 1);
  vignette(c, 0.45);
}

function shotMontageFall(g: G) {
  const c = g.c;
  const p = g.p;
  const s = season(c, "winter");
  field(g, s, "#2a2a30");
  c.save();
  cam(g, 1.02, 0, 0, p > 0.4 && p < 0.55 ? 8 : 0);
  const fall = seg(p, 0.05, 0.45);
  figure(c, { kind: "teen", x: 760, y: 760, h: 360, facing: 1, tilt: -fall * 1.45, crouch: fall * 0.4, armF: 1.4 + fall, armB: 1.6, color: "#1a1a20", rim: s.rim, sword: { a: 1.2, len: 0.6, kind: "wood" } });
  if (fall > 0.95) {
    for (let i = 0; i < 12; i++) {
      const k = seg(p, 0.45, 1);
      c.fillStyle = `rgba(255,255,255,${0.8 * (1 - k)})`;
      c.beginPath();
      c.arc(600 + rnd(i) * 300, 750 - k * 80 * rnd(i + 1), 6, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
  particles(g, 70, "snow", 9, 0.8);
  vignette(c, 0.45);
}

function shotMontageAttempt(g: G) {
  const c = g.c;
  const p = g.p;
  const s = season(c, "spring");
  field(g, s, "#2a2422");
  c.save();
  cam(g, 1.02, 0, 0);
  const k = seg(p, 0.15, 0.6);
  const sw = swingPose(k);
  figure(c, { kind: "teen", x: 720, y: 760, h: 410, facing: 1, spread: 0.24, crouch: 0.3, lean: 0.08, armF: sw.armF, armB: sw.armB, elbowF: sw.elbowF, sword: { a: sw.sword, len: 0.55, kind: "wood" }, color: "#15110f", rim: s.rim });
  particles(g, 40, "petal", 11, 0.8);
  c.restore();
  vignette(c, 0.5);
}

function shotMatchCut(g: G) {
  const c = g.c;
  const p = g.p;
  const cut = 0.4;
  const k = seg(p, 0.1, 0.85);
  const sw = swingPose(k);
  const toAdult = g.reduced ? seg(p, cut - 0.06, cut + 0.06) : p >= cut ? 1 : 0;
  const draw = (who: "child" | "adult", alpha: number) => {
    if (alpha <= 0) return;
    const s = season(c, who === "child" ? "gray" : "dusk");
    c.save();
    c.globalAlpha = alpha;
    field(g, s, who === "child" ? "#151213" : "#0e0a0c");
    c.save();
    cam(g, 1.04, 0, 0);
    figure(c, {
      kind: who,
      x: who === "child" ? 700 : 690,
      y: 760,
      h: who === "child" ? 260 : 470,
      facing: 1,
      spread: 0.24,
      crouch: 0.3,
      lean: 0.06,
      armF: sw.armF,
      armB: sw.armB,
      elbowF: sw.elbowF,
      sword: { a: sw.sword, len: who === "child" ? 0.65 : 0.62, kind: who === "child" ? "wood" : "katana" },
      color: who === "child" ? "#141011" : "#0b0809",
      rim: s.rim,
    });
    c.restore();
    c.restore();
  };
  draw("child", 1 - toAdult);
  draw("adult", toAdult);
  if (toAdult > 0.5 && k > 0.55 && k < 0.8) {
    c.strokeStyle = `rgba(255,230,210,${0.5 * (1 - seg(k, 0.55, 0.8))})`;
    c.lineWidth = 6;
    c.beginPath();
    c.arc(690, 520, 330, -1.6, -1.6 + k * 2.4);
    c.stroke();
  }
  vignette(c, 0.55);
}

function shotTieCharm(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#1c1a22"], [1, "#0a090c"]]));
  c.save();
  cam(g, 1.03 + p * 0.04, 0, 0);
  // inner robe
  c.fillStyle = "#2a2226";
  c.fillRect(300, 0, 1000, 900);
  const k = seg(p, 0.05, 0.75);
  charm(c, 800, lerp(420, 560, k), 40, 0);
  // armor plate sliding over it
  for (let r = 0; r < 6; r++) {
    const y = lerp(-500, 0, k) + r * 100 + 420;
    c.fillStyle = r % 2 ? "#18141a" : "#120f14";
    c.fillRect(240, y, 1120, 96);
    c.fillStyle = "#4a1214";
    c.fillRect(240, y + 92, 1120, 6);
  }
  c.strokeStyle = "#8f2a22";
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(780, lerp(300, 410, k));
  c.quadraticCurveTo(720, lerp(360, 470, k), lerp(640, 700, k), lerp(380, 520, k));
  c.moveTo(820, lerp(300, 410, k));
  c.quadraticCurveTo(880, lerp(360, 470, k), lerp(960, 900, k), lerp(380, 520, k));
  c.stroke();
  hand(c, lerp(600, 700, k), lerp(380, 520, k), 170, 0.5, 0.7, "#4a3226");
  hand(c, lerp(1000, 900, k), lerp(380, 520, k), 170, -0.5, 0.7, "#4a3226", -1);
  c.restore();
  vignette(c, 0.6);
}

function shotFortressDraw(g: G) {
  const c = g.c;
  const p = g.p;
  rect(c, vgrad(c, 0, STAGE_H, [[0, "#141a2c"], [0.6, "#5a3440"], [1, "#b8664a"]]));
  c.save();
  cam(g, 1 + p * 0.04, 0, 0);
  // the fortress above the clouds
  mountains(c, "#2a2230", 520, 60, 6);
  c.fillStyle = "#120e16";
  c.beginPath();
  c.moveTo(360, 560);
  c.lineTo(560, 230);
  c.lineTo(760, 560);
  c.fill();
  const tiers = [
    [500, 250, 120, 40],
    [480, 205, 160, 18],
    [515, 170, 90, 35],
    [500, 140, 120, 14],
  ] as const;
  for (const [x, y, w, h] of tiers) c.fillRect(x, y, w, h);
  for (const bx of [470, 650]) {
    c.fillRect(bx, 160, 4, 110);
    c.fillStyle = "#8a1a1e";
    c.fillRect(bx + 4, 165, 24, 60);
    c.fillStyle = "#120e16";
  }
  glow(c, 560, 200, 60, "rgba(220,60,40,0.7)", 0.6);
  // sea of clouds
  for (let i = 0; i < 18; i++) {
    const x = ((rnd(i) * STAGE_W + g.t * (g.reduced ? 2 : 8)) % (STAGE_W + 300)) - 150;
    c.fillStyle = `rgba(${150 + 40 * rnd(i + 1)},${110 + 30 * rnd(i + 1)},${120 + 20 * rnd(i)},0.55)`;
    c.beginPath();
    c.ellipse(x, 520 + rnd(i + 2) * 80, 220, 50, 0, 0, Math.PI * 2);
    c.fill();
  }
  // foreground cliff with the adult protagonist
  c.fillStyle = "#08060a";
  c.beginPath();
  c.moveTo(900, 900);
  c.lineTo(980, 720);
  c.lineTo(1250, 690);
  c.lineTo(1650, 700);
  c.lineTo(1650, 900);
  c.fill();
  const draw = seg(p, 0.35, 0.7);
  figure(c, {
    kind: "adult",
    x: 1180,
    y: 700,
    h: 330,
    facing: -1,
    spread: 0.18,
    armF: lerp(0.7, 2.4, draw),
    elbowF: lerp(-1.2, 0.1, draw),
    sword: draw > 0.05 ? { a: lerp(2.6, 0.7, draw), len: 0.6, kind: "katana" } : undefined,
    color: "#08060a",
    rim: "rgba(255,170,120,0.6)",
  });
  if (draw > 0.6) glow(c, 1050, 430, 80, "rgba(255,240,220,0.9)", 0.6 * (1 - seg(p, 0.7, 1)));
  c.restore();
  vignette(c, 0.55);
}

function textCard(g: G, text: string, size: number, alpha: number, y = 450, font = "Cormorant Garamond", tracking = 0.08) {
  const c = g.c;
  c.save();
  c.globalAlpha = clamp(alpha);
  c.fillStyle = "#efece4";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `500 ${size}px "${font}", "Noto Serif JP", serif`;
  (c as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${size * tracking}px`;
  c.fillText(text, STAGE_W / 2, y);
  c.restore();
}

function shotTagline(g: G) {
  rect(g.c, "#000");
  const a = seg(g.p, 0, 0.3) * (1 - seg(g.p, 0.8, 1));
  textCard(g, END_CARD.tagline, 52, a, 450, "Cormorant Garamond", 0.04);
}

function shotTitle(g: G) {
  const c = g.c;
  rect(c, "#000");
  const a = seg(g.p, 0, 0.35);
  // brush stroke
  c.save();
  c.globalAlpha = a * 0.9;
  c.fillStyle = "#b4232a";
  c.beginPath();
  c.moveTo(560, 520);
  c.quadraticCurveTo(800, 500, 1050, 512);
  c.lineTo(1040, 524);
  c.quadraticCurveTo(800, 518, 570, 532);
  c.closePath();
  c.fill();
  c.restore();
  textCard(g, END_CARD.title, 120, a, 430, "Cormorant Garamond", 0.16);
  textCard(g, END_CARD.subtitle, 34, a * 0.8, 580, "Noto Serif JP", 0.4);
}

const ROUTINES: Record<ShotKind, (g: G) => void> = {
  "village-evening": shotVillageEvening,
  practice: shotPractice,
  "mother-calls": shotMotherCalls,
  bell: shotBell,
  "gate-threat": shotGateThreat,
  "arrow-fire": shotArrowFire,
  "gate-breach": shotGateBreach,
  "hatch-open": shotHatchOpen,
  "grip-sleeve": shotGripSleeve,
  "charm-hand": shotCharmHand,
  "hatch-close": shotHatchClose,
  "door-breaks": shotDoorBreaks,
  "antagonist-enters": shotAntagonistEnters,
  "robe-insert": shotRobeInsert,
  "sword-face": shotSwordFace,
  "father-falls": shotFatherFalls,
  "child-fear": shotChildFear,
  "hand-falls": shotHandFalls,
  "ceiling-fire": shotCeilingFire,
  "beam-falls": shotBeamFalls,
  "cellar-dark": shotCellarDark,
  "dawn-emerge": shotDawnEmerge,
  "ruins-search": shotRuinsSearch,
  kneel: shotKneel,
  "first-stance": shotFirstStance,
  "montage-rain": shotMontageRain,
  "montage-knocked": shotMontageKnocked,
  "montage-wrist": shotMontageWrist,
  "montage-snow": shotMontageSnow,
  "montage-fall": shotMontageFall,
  "montage-attempt": shotMontageAttempt,
  "match-cut": shotMatchCut,
  "tie-charm": shotTieCharm,
  "fortress-draw": shotFortressDraw,
  black: (g) => rect(g.c, "#000"),
  tagline: shotTagline,
  title: shotTitle,
};

let grainCanvas: HTMLCanvasElement | null = null;

/** Film grain; also dithers the 8-bit banding in large soft gradients. */
function grain(c: CanvasRenderingContext2D, t: number, reduced: boolean) {
  if (typeof document === "undefined") return;
  if (!grainCanvas) {
    grainCanvas = document.createElement("canvas");
    grainCanvas.width = grainCanvas.height = 192;
    const gc = grainCanvas.getContext("2d");
    if (!gc) return;
    const img = gc.createImageData(192, 192);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    gc.putImageData(img, 0, 0);
  }
  const pat = c.createPattern(grainCanvas, "repeat");
  if (!pat) return;
  const ox = reduced ? 0 : Math.floor(rnd(Math.floor(t * 24)) * 192);
  const oy = reduced ? 0 : Math.floor(rnd(Math.floor(t * 24) + 5) * 192);
  c.save();
  c.globalAlpha = 0.055;
  c.globalCompositeOperation = "overlay";
  c.translate(-ox, -oy);
  c.fillStyle = pat;
  c.fillRect(0, 0, STAGE_W + 192, STAGE_H + 192);
  c.restore();
}

/** Fit the 16:9 stage into the viewport (cover on wide, letterbox on tall). */
export function stageFit(w: number, h: number) {
  const aspect = w / h;
  const s = aspect >= STAGE_W / STAGE_H ? w / STAGE_W : Math.max(w / STAGE_W, Math.min(h / STAGE_H, w / 1000));
  return { s, ox: (w - STAGE_W * s) / 2, oy: (h - STAGE_H * s) / 2 };
}

/** Draw film time `t` into a canvas sized `w`×`h` device pixels. */
export function paintFrame(c: CanvasRenderingContext2D, w: number, h: number, t: number, opts: PaintOptions) {
  const fr = shotAt(t);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
  c.fillStyle = "#000";
  c.fillRect(0, 0, w, h);
  const { s, ox, oy } = stageFit(w, h);
  c.setTransform(s, 0, 0, s, ox, oy);
  c.save();
  c.beginPath();
  c.rect(0, 0, STAGE_W, STAGE_H);
  c.clip();
  const g: G = { c, p: fr.p, L: fr.local, t, reduced: opts.reduced };
  ROUTINES[fr.shot.kind](g);
  grain(c, t, opts.reduced);
  if (fr.fade < 1) {
    c.globalAlpha = 1;
    c.fillStyle = `rgba(0,0,0,${1 - fr.fade})`;
    c.fillRect(0, 0, STAGE_W, STAGE_H);
  }
  c.restore();
  c.setTransform(1, 0, 0, 1, 0, 0);
  return { shot: fr.shot, stage: { s, ox, oy } };
}
