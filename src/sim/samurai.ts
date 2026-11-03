import { copyPose, lerpPose, TAU, type Pose } from "./math";
import type { Camera } from "./camera";
import { BEAM_Y } from "./world";

export type FighterId = "ren" | "kai";

export type Joints = {
  hipX: number;
  hipY: number;
  headX: number;
  headY: number;
  shoulderX: number;
  shoulderY: number;
  handX: number;
  handY: number;
  offHandX: number;
  offHandY: number;
  bladeX: number;
  bladeY: number;
  guardX: number;
  guardY: number;
  frontFootX: number;
  frontFootY: number;
  backFootX: number;
  backFootY: number;
};

const Z: Pose = {
  crouch: 0,
  lean: 0,
  twist: 0,
  headPitch: 0,
  jump: 0,
  sleeve: 0.35,
  hakama: 0.45,
  // sword arm
  sOut: 0.15,
  sSwing: 0.35,
  sElbow: 0.35,
  sWrist: 0.1,
  // off arm
  oOut: 0.2,
  oSwing: -0.2,
  oElbow: 0.4,
  // legs: + is forward
  fLeg: 0.28,
  fKnee: 0.22,
  bLeg: -0.32,
  bKnee: 0.18,
  hatTilt: 0,
  flare: 0,
};

function p(partial: Partial<Pose>): Pose {
  return { ...Z, ...partial } as Pose;
}

export const POSES: Record<string, Pose> = {
  idle: p({}),
  ready: p({
    crouch: 0.12,
    lean: 0.06,
    sSwing: 0.55,
    sOut: 0.12,
    sElbow: 0.28,
    sWrist: -0.15,
    oSwing: -0.35,
    oElbow: 0.55,
    fLeg: 0.34,
    bLeg: -0.38,
    hakama: 0.5,
  }),
  bow: p({
    crouch: 0.18,
    lean: 0.55,
    headPitch: 0.5,
    sSwing: 0.15,
    sElbow: 0.2,
    oSwing: 0.1,
    hakama: 0.6,
  }),
  dash: p({
    crouch: 0.22,
    lean: 0.55,
    sSwing: 0.85,
    sElbow: 0.15,
    sWrist: 0.2,
    oSwing: -0.7,
    oElbow: 0.3,
    fLeg: 0.7,
    fKnee: 0.45,
    bLeg: -0.75,
    bKnee: 0.1,
    sleeve: 0.9,
    hakama: 0.85,
    flare: 0.7,
  }),
  step: p({
    crouch: 0.1,
    lean: 0.12,
    fLeg: 0.5,
    bLeg: -0.2,
    sSwing: 0.45,
  }),
  windup: p({
    crouch: 0.18,
    lean: -0.15,
    twist: -0.4,
    sSwing: -0.85,
    sOut: 0.45,
    sElbow: 0.15,
    sWrist: 0.4,
    oSwing: 0.4,
    fLeg: -0.15,
    bLeg: 0.25,
    sleeve: 0.7,
  }),
  slash: p({
    crouch: 0.08,
    lean: 0.42,
    twist: 0.5,
    sSwing: 1.15,
    sOut: 0.2,
    sElbow: 0.05,
    sWrist: -0.35,
    oSwing: -0.6,
    fLeg: 0.55,
    bLeg: -0.5,
    sleeve: 1,
    flare: 1,
    hakama: 0.8,
  }),
  slashLow: p({
    crouch: 0.4,
    lean: 0.5,
    sSwing: 0.95,
    sOut: -0.2,
    sElbow: 0.1,
    sWrist: -0.5,
    fLeg: 0.45,
    bLeg: -0.55,
    hakama: 0.7,
  }),
  thrust: p({
    crouch: 0.16,
    lean: 0.5,
    sSwing: 1.05,
    sElbow: 0.02,
    sWrist: 0,
    oSwing: -0.5,
    fLeg: 0.62,
    bLeg: -0.48,
  }),
  parry: p({
    crouch: 0.28,
    lean: 0.05,
    sSwing: 0.35,
    sOut: 0.55,
    sElbow: 0.15,
    sWrist: 0.8,
    oSwing: 0.2,
    hakama: 0.55,
  }),
  crouch: p({
    crouch: 0.58,
    lean: 0.18,
    headPitch: 0.15,
    sSwing: 0.7,
    sElbow: 0.25,
    oElbow: 0.6,
    fLeg: 0.4,
    fKnee: 0.7,
    bLeg: -0.35,
    bKnee: 0.55,
    hakama: 0.75,
  }),
  leap: p({
    crouch: 0,
    jump: 1,
    lean: 0.05,
    sSwing: 0.7,
    sOut: 0.95,
    sElbow: 0.1,
    oOut: 0.9,
    oSwing: -0.2,
    fLeg: 0.15,
    bLeg: -0.15,
    fKnee: 0.2,
    bKnee: 0.2,
    sleeve: 1,
    hakama: 1,
    flare: 1.2,
  }),
  airSlash: p({
    jump: 1,
    lean: 0.3,
    twist: 0.4,
    sSwing: 1.2,
    sOut: 0.5,
    sElbow: 0,
    oOut: 0.7,
    flare: 1,
    sleeve: 1,
    hakama: 1,
  }),
  land: p({
    crouch: 0.62,
    lean: 0.25,
    sSwing: 0.4,
    fKnee: 0.75,
    bKnee: 0.6,
    hakama: 0.8,
  }),
  stagger: p({
    crouch: 0.2,
    lean: -0.35,
    headPitch: 0.25,
    sSwing: -0.2,
    oSwing: 0.3,
    fLeg: -0.2,
    bLeg: 0.15,
  }),
  lookDown: p({
    crouch: 0.08,
    lean: 0.12,
    headPitch: 0.45,
    sSwing: 0.25,
    oSwing: -0.15,
  }),
  sheath: p({
    crouch: 0.05,
    sSwing: -0.15,
    sElbow: 0.7,
    sWrist: 0.4,
    oElbow: 0.5,
  }),
};

export type ActionName =
  | "idle"
  | "ready"
  | "bow"
  | "dash"
  | "step"
  | "windup"
  | "slash"
  | "slashLow"
  | "thrust"
  | "parry"
  | "crouch"
  | "leap"
  | "airSlash"
  | "land"
  | "stagger"
  | "lookDown"
  | "sheath";

type Key = { t: number; pose: ActionName };

const ACTION_KEYS: Record<string, { keys: Key[]; dur: number; move?: number; hop?: number }> = {
  idle: { keys: [{ t: 0, pose: "idle" }], dur: 1.2 },
  ready: { keys: [{ t: 0, pose: "ready" }], dur: 1.4 },
  bow: { keys: [{ t: 0, pose: "ready" }, { t: 0.4, pose: "bow" }, { t: 1.1, pose: "ready" }], dur: 1.4 },
  dash: { keys: [{ t: 0, pose: "dash" }], dur: 0.42, move: 5.4 },
  step: { keys: [{ t: 0, pose: "step" }, { t: 0.28, pose: "ready" }], dur: 0.4, move: 1.6 },
  slash: {
    keys: [
      { t: 0, pose: "windup" },
      { t: 0.14, pose: "slash" },
      { t: 0.28, pose: "slash" },
      { t: 0.5, pose: "ready" },
    ],
    dur: 0.55,
    move: 1.8,
  },
  slashLow: {
    keys: [
      { t: 0, pose: "windup" },
      { t: 0.12, pose: "slashLow" },
      { t: 0.45, pose: "ready" },
    ],
    dur: 0.5,
    move: 1.2,
  },
  thrust: {
    keys: [
      { t: 0, pose: "windup" },
      { t: 0.1, pose: "thrust" },
      { t: 0.4, pose: "ready" },
    ],
    dur: 0.45,
    move: 2.2,
  },
  parry: { keys: [{ t: 0, pose: "parry" }, { t: 0.32, pose: "ready" }], dur: 0.42 },
  crouch: { keys: [{ t: 0, pose: "crouch" }], dur: 0.6 },
  leap: {
    keys: [
      { t: 0, pose: "crouch" },
      { t: 0.08, pose: "leap" },
      { t: 0.5, pose: "leap" },
      { t: 0.7, pose: "airSlash" },
      { t: 0.95, pose: "land" },
      { t: 1.15, pose: "ready" },
    ],
    dur: 1.18,
    hop: 2.15,
  },
  airSlash: {
    keys: [{ t: 0, pose: "airSlash" }, { t: 0.35, pose: "land" }],
    dur: 0.5,
  },
  land: { keys: [{ t: 0, pose: "land" }, { t: 0.28, pose: "ready" }], dur: 0.32 },
  stagger: { keys: [{ t: 0, pose: "stagger" }, { t: 0.4, pose: "ready" }], dur: 0.5, move: -2.1 },
  lookDown: { keys: [{ t: 0, pose: "lookDown" }], dur: 1.2 },
  sheath: { keys: [{ t: 0, pose: "sheath" }], dur: 1 },
};

export class Samurai {
  id: FighterId;
  x: number;
  y = 0;
  vy = 0;
  facing: 1 | -1;
  pose: Pose;
  action: string = "ready";
  actionT = 0;
  locked = false;
  hat: boolean;
  blade: number;
  height: number;
  ink: string;
  joints: Joints;
  attacking = false;
  parrying = false;
  invuln = 0;
  airborne = false;
  windPhase: number;
  hpFlash = 0;

  constructor(id: FighterId, x: number, facing: 1 | -1) {
    this.id = id;
    this.x = x;
    this.facing = facing;
    this.hat = id === "kai";
    this.blade = id === "kai" ? 0.72 : 0.52;
    this.height = id === "kai" ? 1.74 : 1.68;
    this.ink = "#0c0c0e";
    this.pose = copyPose(POSES.ready);
    this.windPhase = id === "kai" ? 1.7 : 0.4;
    this.joints = this.computeJoints();
  }

  play(name: ActionName, restart = true) {
    if (!restart && this.action === name) return;
    this.action = name;
    this.actionT = 0;
    this.locked = name !== "idle" && name !== "ready" && name !== "lookDown" && name !== "crouch";
  }

  busy() {
    return this.locked && this.actionT < (ACTION_KEYS[this.action]?.dur ?? 0.4) - 0.02;
  }

  step(dt: number, wind: number, scriptMove: number | null) {
    const spec = ACTION_KEYS[this.action] ?? ACTION_KEYS.ready;
    this.actionT += dt;
    const t = this.actionT;
    const keys = spec.keys;
    let pose = POSES[keys[0].pose];
    for (let i = 0; i < keys.length; i++) {
      const k0 = keys[i];
      const k1 = keys[i + 1];
      if (!k1) {
        pose = POSES[k0.pose];
        break;
      }
      if (t >= k0.t && t <= k1.t) {
        const u = (t - k0.t) / Math.max(0.0001, k1.t - k0.t);
        pose = lerpPose(POSES[k0.pose], POSES[k1.pose], u);
        break;
      }
      if (t > k1.t) pose = POSES[k1.pose];
    }
    this.pose = pose;

    const dur = spec.dur;
    const activeSlash = this.action.startsWith("slash") || this.action === "thrust" || this.action === "airSlash";
    this.attacking = activeSlash && t > dur * 0.18 && t < dur * 0.52;
    this.parrying = this.action === "parry" && t < 0.28;

    if (scriptMove !== null) {
      this.x += scriptMove * this.facing * dt;
    } else if (spec.move && t < dur) {
      const k = Math.sin((t / dur) * Math.PI);
      this.x += spec.move * k * this.facing * dt;
    }

    if (spec.hop && t < dur) {
      const u = t / dur;
      if (u < 0.12) {
        this.vy = spec.hop * 2.4;
        this.airborne = true;
      }
    }

    if (this.airborne || this.y > 0.001) {
      this.vy -= 13.5 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.airborne = false;
      } else {
        this.airborne = true;
      }
    }

    if (t >= dur) {
      this.locked = false;
      if (this.action !== "ready" && this.action !== "idle" && this.action !== "lookDown") {
        this.action = "ready";
        this.actionT = 0;
      }
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.hpFlash = Math.max(0, this.hpFlash - dt);
    this.joints = this.computeJoints(wind);
  }

  computeJoints(wind = 0.4): Joints {
    const P = this.pose;
    const face = this.facing;
    const hipH = 0.5 * this.height * (1 - 0.38 * (P.crouch ?? 0));
    const hipX = this.x;
    const hipY = BEAM_Y + this.y + hipH;
    const lean = P.lean ?? 0;
    const shLen = 0.28 * this.height;
    const shoulderX = hipX + face * Math.sin(lean) * shLen;
    const shoulderY = hipY + Math.cos(lean) * shLen;
    const headLen = 0.16 * this.height;
    const hp = P.headPitch ?? 0;
    const headX = shoulderX + face * Math.sin(lean + hp) * headLen;
    const headY = shoulderY + Math.cos(lean + hp) * headLen;

    const arm = (out: number, swing: number, elbow: number) => {
      const upper = 0.17 * this.height;
      const lower = 0.16 * this.height;
      const ang = swing * face + (face > 0 ? 0 : 0);
      const sx = shoulderX + face * Math.cos(out) * 0.04;
      const sy = shoulderY;
      const ex = sx + face * Math.sin(swing) * upper;
      const ey = sy - Math.cos(swing) * upper * 0.85 - out * 0.04;
      const hx = ex + face * Math.sin(swing + elbow * 0.9) * lower;
      const hy = ey - Math.cos(swing + elbow * 0.6) * lower * 0.7;
      return { hx, hy, ang };
    };

    const sw = arm(P.sOut ?? 0, P.sSwing ?? 0.4, P.sElbow ?? 0.3);
    const ow = arm(P.oOut ?? 0, P.oSwing ?? -0.2, P.oElbow ?? 0.4);

    const wrist = P.sWrist ?? 0;
    const bladeAng = sw.ang + wrist;
    const guardX = sw.hx + face * 0.04;
    const guardY = sw.hy + 0.02;
    const bladeX = guardX + face * Math.cos(bladeAng * 0.35 + 0.15) * this.blade;
    const bladeY = guardY + Math.sin(P.sSwing ?? 0.4) * this.blade * 0.25 + (P.sOut ?? 0) * 0.35;

    const fLift = (P.fKnee ?? 0) * 0.08;
    const bLift = (P.bKnee ?? 0) * 0.06;
    const frontFootX = hipX + face * (P.fLeg ?? 0.3) * 0.42;
    const frontFootY = BEAM_Y + this.y + fLift + (this.airborne ? this.y * 0 : 0);
    const backFootX = hipX + face * (P.bLeg ?? -0.3) * 0.42;
    const backFootY = BEAM_Y + this.y + bLift;

    void wind;
    return {
      hipX,
      hipY,
      headX,
      headY,
      shoulderX,
      shoulderY,
      handX: sw.hx,
      handY: sw.hy,
      offHandX: ow.hx,
      offHandY: ow.hy,
      bladeX,
      bladeY,
      guardX,
      guardY,
      frontFootX,
      frontFootY,
      backFootX,
      backFootY,
    };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    _w: number,
    _h: number,
    wind: number,
    toScreen: (x: number, y: number) => { x: number; y: number },
    reflection = false,
  ) {
    const J = this.joints;
    const P = this.pose;
    const sc = cam.scale;
    const f = this.facing;
    const feet = toScreen(this.x, BEAM_Y + this.y);

    const S = (x: number, y: number) => {
      const p = toScreen(x, y);
      if (!reflection) return p;
      return { x: p.x, y: feet.y + (feet.y - p.y) * 0.34 + sc * 0.1 };
    };

    ctx.save();
    if (reflection) ctx.globalAlpha = 0.16;
    ctx.fillStyle = this.ink;
    ctx.strokeStyle = this.ink;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const hip = S(J.hipX, J.hipY);
    const head = S(J.headX, J.headY);
    const sh = S(J.shoulderX, J.shoulderY);
    const hand = S(J.handX, J.handY);
    const off = S(J.offHandX, J.offHandY);
    const ff = S(J.frontFootX, J.frontFootY);
    const bf = S(J.backFootX, J.backFootY);
    const guard = S(J.guardX, J.guardY);
    const tip = S(J.bladeX, J.bladeY);

    const H = this.height * sc;
    const flare = (P.flare ?? 0) + (P.jump ?? 0) * 0.85;
    const gust = Math.sin(performance.now() / 1000 * 1.8 + this.windPhase) * (0.35 + wind);
    const wx = gust * sc * 0.05 * (0.5 + flare);

    const hem = 0.28 * H + flare * 0.16 * H;
    ctx.beginPath();
    ctx.moveTo(sh.x - f * 0.09 * H, sh.y);
    ctx.lineTo(sh.x + f * 0.1 * H, sh.y);
    ctx.quadraticCurveTo(hip.x + f * hem * 0.7 + wx, hip.y + 0.15 * H, ff.x + f * 0.08 * H + wx, ff.y);
    ctx.lineTo(hip.x + wx * 0.4, ff.y + 3);
    ctx.lineTo(bf.x - f * 0.08 * H - wx, bf.y);
    ctx.quadraticCurveTo(hip.x - f * hem * 0.55 - wx, hip.y + 0.12 * H, sh.x - f * 0.1 * H, sh.y);
    ctx.closePath();
    ctx.fill();

    if (flare > 0.45) {
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(sh.x - 0.55 * H + wx, hip.y);
      ctx.lineTo(sh.x - 0.2 * H, ff.y - 0.05 * H);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(sh.x + 0.6 * H + wx, hip.y - 0.05 * H);
      ctx.lineTo(sh.x + 0.18 * H, ff.y - 0.08 * H);
      ctx.closePath();
      ctx.fill();
    }

    ctx.lineWidth = Math.max(3, 0.065 * H);
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(ff.x, ff.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(bf.x, bf.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(ff.x, ff.y, 0.07 * H, 0.028 * H, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bf.x, bf.y, 0.065 * H, 0.025 * H, 0, 0, TAU);
    ctx.fill();

    ctx.lineWidth = Math.max(3, 0.05 * H);
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y);
    ctx.quadraticCurveTo(sh.x - f * 0.12 * H + wx, (sh.y + off.y) / 2, off.x, off.y);
    ctx.stroke();

    ctx.lineWidth = Math.max(4, 0.058 * H);
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y);
    ctx.quadraticCurveTo((sh.x + hand.x) / 2, (sh.y + hand.y) / 2 - 0.04 * H, hand.x, hand.y);
    ctx.stroke();

    ctx.fillStyle = this.ink;
    ctx.beginPath();
    ctx.ellipse((hip.x + sh.x) / 2, (hip.y + sh.y) / 2, 0.12 * H, Math.abs(sh.y - hip.y) * 0.52 + 6, 0.15 * f, 0, TAU);
    ctx.fill();

    ctx.lineWidth = Math.max(2.2, 0.022 * H);
    ctx.strokeStyle = "#ece8e2";
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.strokeStyle = this.ink;
    ctx.lineWidth = Math.max(2, 0.028 * H);
    ctx.beginPath();
    ctx.moveTo(hand.x, hand.y);
    ctx.lineTo(guard.x, guard.y);
    ctx.stroke();
    ctx.fillStyle = this.ink;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, Math.max(1.6, 0.018 * H), 0, TAU);
    ctx.fill();

    this.drawHeadScreen(ctx, head, H, cam, P, gust, f, reflection);

    ctx.restore();
  }

  private drawHeadScreen(
    ctx: CanvasRenderingContext2D,
    head: { x: number; y: number },
    H: number,
    cam: Camera,
    P: Pose,
    gust: number,
    f: number,
    reflection: boolean,
  ) {
    const r = 0.08 * H;
    ctx.fillStyle = this.ink;

    if (this.hat) {
      ctx.beginPath();
      ctx.arc(head.x, head.y + r * 0.15, r * 0.9, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(head.x, head.y - r * 0.2, r * 2.3, r * 0.7, gust * 0.05, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(head.x, head.y - r * 0.55, r * 1.15, r * 0.62, 0, 0, TAU);
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.arc(head.x, head.y, r, 0, TAU);
    ctx.fill();

    const close = cam.scale > 170 && !reflection;
    if (!close) {
      ctx.beginPath();
      ctx.moveTo(head.x - f * r * 0.2, head.y - r * 0.6);
      ctx.quadraticCurveTo(head.x + f * r * 0.1, head.y - r * 2.15, head.x + f * r * 0.55, head.y - r * 0.2);
      ctx.quadraticCurveTo(head.x + f * r * 1.9 + gust * 4, head.y + r * 0.9, head.x + f * r * 0.7, head.y + r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(head.x - f * r * 1.05, head.y);
      ctx.quadraticCurveTo(head.x, head.y - r * 1.1, head.x + f * r * 0.8, head.y - r * 0.15);
      ctx.lineTo(head.x + f * r * 0.2, head.y + r * 0.35);
      ctx.closePath();
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(head.x - f * r * 0.15, head.y - r * 0.7);
    ctx.quadraticCurveTo(head.x + f * r * 0.2, head.y - r * 2.4, head.x + f * r * 0.7, head.y - r * 0.4);
    ctx.quadraticCurveTo(head.x + f * r * 2.2 + gust * 6, head.y + r * 1.2, head.x + f * r * 0.85, head.y + r * 0.1);
    ctx.lineTo(head.x + f * r * 0.2, head.y - r * 0.1);
    ctx.closePath();
    ctx.fill();

    const skin = cam.exposure > 0.55 ? "#cfc8be" : "#6a6762";
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(head.x + f * r * 0.22, head.y + r * 0.12, r * 0.72, r * 0.9, 0.1 * f, 0, TAU);
    ctx.fill();
    ctx.fillStyle = this.ink;
    ctx.beginPath();
    ctx.moveTo(head.x - f * r * 0.55, head.y - r * 0.05);
    ctx.quadraticCurveTo(head.x + f * r * 0.15, head.y - r * 0.55, head.x + f * r * 0.85, head.y + r * 0.05);
    ctx.lineTo(head.x + f * r * 0.35, head.y + r * 0.35);
    ctx.quadraticCurveTo(head.x, head.y + r * 0.05, head.x - f * r * 0.35, head.y + r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this.ink;
    ctx.lineWidth = Math.max(1.6, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(head.x + f * r * 0.05, head.y + r * 0.1);
    ctx.quadraticCurveTo(head.x + f * r * 0.28, head.y + r * 0.16, head.x + f * r * 0.5, head.y + r * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(head.x + f * r * 0.18, head.y + r * 0.38);
    ctx.lineTo(head.x + f * r * 0.18, head.y + r * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(head.x + f * r * 0.08, head.y + r * 0.7);
    ctx.quadraticCurveTo(head.x + f * r * 0.22, head.y + r * 0.76, head.x + f * r * 0.38, head.y + r * 0.68);
    ctx.stroke();
    void P;
  }
}
