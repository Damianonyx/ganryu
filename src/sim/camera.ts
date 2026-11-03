import { clamp, expDamp, lerp } from "./math";

export type ShotName =
  | "wide"
  | "wideLow"
  | "medium"
  | "follow"
  | "closeRen"
  | "closeKai"
  | "overKai"
  | "overRen"
  | "foot"
  | "clash"
  | "skyLeap"
  | "duel";

export type Camera = {
  x: number;
  y: number;
  scale: number;
  rot: number;
  letterbox: number;
  exposure: number;
};

export type Shot = {
  x: number;
  y: number;
  scale: number;
  letterbox: number;
  exposure: number;
};

const BASE: Camera = { x: 0, y: 2.55, scale: 52, rot: 0, letterbox: 0.09, exposure: 1 };

export class DirectorCam {
  cur: Camera = { ...BASE };
  target: Shot = { x: 0, y: 2.55, scale: 52, letterbox: 0.09, exposure: 1 };
  trauma = 0;
  punch = 0;
  cutHold = 0;
  reduced = false;
  shakeOn = true;
  time = 0;

  reset() {
    this.cur = { ...BASE };
    this.target = { x: 0, y: 2.55, scale: 52, letterbox: 0.09, exposure: 1 };
    this.trauma = 0;
    this.punch = 0;
  }

  cutTo(s: Shot) {
    this.target = { ...s };
    this.cur.x = s.x;
    this.cur.y = s.y;
    this.cur.scale = s.scale;
    this.cur.letterbox = s.letterbox;
    this.cur.exposure = s.exposure;
    this.cutHold = 0.04;
  }

  pushTo(s: Shot) {
    this.target = { ...s };
  }

  addTrauma(v: number) {
    if (!this.shakeOn || this.reduced) return;
    this.trauma = clamp(this.trauma + v, 0, 1);
  }

  addPunch(v: number) {
    if (this.reduced) return;
    this.punch = Math.max(this.punch, v);
  }

  step(dt: number) {
    this.time += dt;
    const k = this.cutHold > 0 ? 28 : 4.2;
    this.cutHold = Math.max(0, this.cutHold - dt);
    this.cur.x = expDamp(this.cur.x, this.target.x, k, dt);
    this.cur.y = expDamp(this.cur.y, this.target.y, k, dt);
    this.cur.scale = expDamp(this.cur.scale, this.target.scale, k, dt);
    this.cur.letterbox = expDamp(this.cur.letterbox, this.target.letterbox, 6, dt);
    this.cur.exposure = expDamp(this.cur.exposure, this.target.exposure, 5, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.punch = Math.max(0, this.punch - dt * 3.5);
  }

  view(): Camera {
    const shake = this.trauma * this.trauma;
    const t = this.time;
    const ox = shake * 18 * (Math.sin(t * 47.1) * 0.6 + Math.sin(t * 23.7) * 0.4);
    const oy = shake * 12 * (Math.sin(t * 39.3) * 0.7 + Math.cos(t * 17.1) * 0.3);
    const rot = shake * 0.018 * Math.sin(t * 29);
    const scale = this.cur.scale * (1 + this.punch * 0.08);
    return {
      x: this.cur.x + ox / Math.max(scale, 1),
      y: this.cur.y + oy / Math.max(scale, 1),
      scale,
      rot,
      letterbox: this.cur.letterbox,
      exposure: this.cur.exposure,
    };
  }
}

export function shotWide(lookX = 0): Shot {
  return { x: lookX * 0.15, y: 2.7, scale: 48, letterbox: 0.1, exposure: 1 };
}

export function shotMedium(x: number, y: number): Shot {
  return { x, y: y + 0.35, scale: 92, letterbox: 0.08, exposure: 1 };
}

export function shotClose(x: number, y: number, exposure = 1): Shot {
  return { x, y: y + 0.12, scale: 340, letterbox: 0.06, exposure };
}

export function shotFoot(x: number): Shot {
  return { x, y: 0.22, scale: 300, letterbox: 0.12, exposure: 1 };
}

export function shotOver(fromX: number, fromY: number, toX: number): Shot {
  return {
    x: lerp(fromX, toX, 0.22),
    y: fromY + 0.35,
    scale: 130,
    letterbox: 0.1,
    exposure: 1,
  };
}

export function shotLeap(x: number, y: number): Shot {
  return { x, y: y + 0.4, scale: 70, letterbox: 0.07, exposure: 1.05 };
}

export function shotDuel(midX: number, midY: number, dist: number): Shot {
  const scale = clamp(210 / Math.max(dist, 2.4), 58, 110);
  return { x: midX, y: 1.35 + midY * 0.2, scale, letterbox: 0.06, exposure: 1 };
}
