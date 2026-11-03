import { AudioBus } from "./audio";
import {
  DirectorCam,
  shotClose,
  shotDuel,
  shotFoot,
  shotLeap,
  shotMedium,
  shotOver,
  shotWide,
  type Shot,
} from "./camera";
import { FX } from "./fx";
import { clamp, dist, lerp, segIntersect } from "./math";
import { Samurai, type ActionName } from "./samurai";
import { useDuel } from "./store";
import { BEAM_HALF, World } from "./world";

export type InputState = {
  left: boolean;
  right: boolean;
  slash: boolean;
  leap: boolean;
  parry: boolean;
};

type Cue = {
  at: number;
  ren?: ActionName;
  kai?: ActionName;
  renFace?: 1 | -1;
  kaiFace?: 1 | -1;
  shot?: "wide" | "medium" | "closeRen" | "closeKai" | "overKai" | "overRen" | "foot" | "clash" | "leap" | "dark";
  cut?: boolean;
  clash?: boolean;
  slow?: number;
  bothBow?: boolean;
};

const LOOP = 22;

const CUES: Cue[] = [
  { at: 0.0, ren: "ready", kai: "ready", shot: "wide", cut: true },
  { at: 0.8, ren: "dash", kai: "ready" },
  { at: 1.35, kai: "step" },
  { at: 1.7, shot: "medium" },
  { at: 2.05, ren: "slash", kai: "parry", clash: true, shot: "clash", cut: true },
  { at: 2.55, shot: "overKai" },
  { at: 3.15, kai: "slash", ren: "crouch" },
  { at: 3.7, ren: "lookDown", shot: "closeRen", cut: true },
  { at: 5.05, shot: "dark", cut: true },
  { at: 5.85, shot: "clash", cut: true, ren: "slash", kai: "parry", clash: true, slow: 0.35 },
  { at: 6.55, ren: "leap", kai: "crouch", shot: "leap" },
  { at: 7.55, kai: "slash", clash: true, shot: "wide" },
  { at: 8.4, shot: "foot", cut: true, kai: "step" },
  { at: 9.15, shot: "wide", ren: "ready", kai: "ready" },
  { at: 10.0, kai: "dash" },
  { at: 10.55, ren: "parry", kai: "slash", clash: true, shot: "medium", cut: true },
  { at: 11.3, kai: "leap", ren: "crouch", shot: "leap" },
  { at: 12.2, shot: "overRen" },
  { at: 12.8, ren: "thrust", kai: "parry", clash: true },
  { at: 13.5, shot: "wide", ren: "ready", kai: "ready" },
  { at: 14.4, ren: "dash" },
  { at: 14.95, kai: "slashLow", ren: "parry", clash: true, shot: "clash", cut: true },
  { at: 15.7, shot: "closeKai", cut: true },
  { at: 16.6, shot: "wide", ren: "leap", kai: "dash" },
  { at: 17.5, clash: true, slow: 0.28 },
  { at: 18.3, shot: "foot", cut: true, ren: "step" },
  { at: 19.0, shot: "wide", ren: "ready", kai: "ready" },
  { at: 20.2, bothBow: true },
  { at: 21.4, shot: "wide", cut: true },
];

export class Engine {
  world = new World();
  fx = new FX();
  cam = new DirectorCam();
  audio = new AudioBus();
  ren: Samurai;
  kai: Samurai;
  t = 0;
  loopT = 0;
  timeScale = 1;
  cueIndex = 0;
  input: InputState = { left: false, right: false, slash: false, leap: false, parry: false };
  prevInput: InputState = { ...this.input };
  hitstop = 0;
  lastCueAt = -1;
  started = false;
  birdsT = 0;
  wind = 0.6;
  private lastStepAt = 0;
  private boundVis = () => this.audio.resume();

  constructor() {
    this.ren = new Samurai("ren", -5.4, 1);
    this.kai = new Samurai("kai", 5.4, -1);
  }

  mount() {
    document.addEventListener("visibilitychange", this.boundVis);
  }

  unmount() {
    document.removeEventListener("visibilitychange", this.boundVis);
  }

  unlock() {
    this.audio.unlock();
    this.audio.setMuted(useDuel.getState().muted);
    this.started = true;
  }

  setMuted(v: boolean) {
    this.audio.setMuted(v);
  }

  resetPositions(kind: "watch" | "duel") {
    this.ren = new Samurai("ren", kind === "duel" ? -4.2 : -5.4, 1);
    this.kai = new Samurai("kai", kind === "duel" ? 4.2 : 5.4, -1);
    this.loopT = 0;
    this.cueIndex = 0;
    this.lastCueAt = -1;
    this.timeScale = 1;
    this.fx = new FX();
    this.cam.reset();
    if (kind === "duel") {
      this.ren.play("bow");
      this.kai.play("bow");
    } else {
      this.ren.play("ready");
      this.kai.play("ready");
    }
  }

  step(dt: number) {
    const mode = useDuel.getState().mode;
    this.cam.shakeOn = useDuel.getState().shake;
    this.cam.reduced = useDuel.getState().reducedMotion;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      dt *= 0.08;
    }
    dt *= this.timeScale;
    this.timeScale = lerp(this.timeScale, 1, 1 - Math.exp(-1.8 * dt));
    this.t += dt;
    this.wind = 0.45 + Math.sin(this.t * 0.21) * 0.25;
    this.audio.tick(this.t);

    if (mode === "watch" || mode === "title") this.stepWatch(dt);
    else if (mode === "duel") this.stepDuel(dt);
    else this.stepIdle(dt);

    this.ren.step(dt, this.wind, null);
    this.kai.step(dt, this.wind, null);
    this.faceEachOther(mode === "duel");
    this.keepOnBeam(mode === "duel");
    this.fx.step(dt);
    this.recordTrails();
    this.cam.step(dt);
    this.prevInput = { ...this.input };
  }

  private stepIdle(dt: number) {
    this.loopT += dt;
    this.cam.pushTo(shotWide((this.ren.x + this.kai.x) * 0.5));
  }

  private stepWatch(dt: number) {
    this.loopT += dt;
    if (this.loopT >= LOOP) {
      this.loopT = 0;
      this.cueIndex = 0;
      this.lastCueAt = -1;
      this.ren.x = -5.4;
      this.kai.x = 5.4;
      this.ren.facing = 1;
      this.kai.facing = -1;
      this.ren.y = 0;
      this.kai.y = 0;
    }
    while (this.cueIndex < CUES.length && CUES[this.cueIndex].at <= this.loopT) {
      this.applyCue(CUES[this.cueIndex]);
      this.cueIndex += 1;
    }
    this.applyShot(this.currentShot());
  }

  private currentShot(): Cue["shot"] {
    let s: Cue["shot"] = "wide";
    for (let i = 0; i < this.cueIndex; i++) {
      if (CUES[i].shot) s = CUES[i].shot;
    }
    return s;
  }

  private applyCue(c: Cue) {
    if (c.ren) this.ren.play(c.ren);
    if (c.kai) this.kai.play(c.kai);
    if (c.renFace) this.ren.facing = c.renFace;
    if (c.kaiFace) this.kai.facing = c.kaiFace;
    if (c.bothBow) {
      this.ren.play("bow");
      this.kai.play("bow");
    }
    if (c.clash) this.doClash();
    if (c.slow) {
      this.timeScale = c.slow;
    }
    if (c.shot) this.applyShot(c.shot, c.cut);
    if (c.ren === "dash" || c.kai === "dash") this.audio.whoosh(0.8);
    if (c.ren === "leap" || c.kai === "leap") this.audio.whoosh(1.1);
  }

  private applyShot(name: Cue["shot"], cut = false) {
    if (!name) return;
    const shot = this.shotFromName(name);
    if (cut) this.cam.cutTo(shot);
    else this.cam.pushTo(shot);
  }

  private shotFromName(name: NonNullable<Cue["shot"]>): Shot {
    const r = this.ren.joints;
    const k = this.kai.joints;
    switch (name) {
      case "wide":
        return shotWide((this.ren.x + this.kai.x) * 0.35);
      case "medium":
        return shotMedium((this.ren.x + this.kai.x) * 0.5, 1.1);
      case "closeRen":
        return shotClose(r.headX, r.headY, 1);
      case "closeKai":
        return shotClose(k.headX - this.kai.facing * 0.15, k.headY + 0.12, 1);
      case "dark":
        return shotClose(r.headX, r.headY, 0.22);
      case "overKai":
        return shotOver(k.headX, k.headY, r.headX);
      case "overRen":
        return shotOver(r.headX, r.headY, k.headX);
      case "foot":
        return shotFoot(k.frontFootX);
      case "clash":
        return shotMedium((this.ren.x + this.kai.x) * 0.5, 1.25);
      case "leap":
        return shotLeap((this.ren.x + this.kai.x) * 0.5, Math.max(this.ren.y, this.kai.y) + 1.4);
      default:
        return shotWide();
    }
  }

  private stepDuel(dt: number) {
    const ai = this.kai;
    const pl = this.ren;

    if (this.t < 1.5) {
      this.cam.pushTo(shotWide());
      return;
    }

    if (!pl.busy()) {
      const pressed = (k: keyof InputState) => this.input[k] && !this.prevInput[k];
      if (pressed("slash")) {
        pl.play("slash");
        this.audio.whoosh(1);
      } else if (pressed("leap") && !pl.airborne) {
        pl.play("leap");
        this.audio.whoosh(1.2);
      } else if (pressed("parry")) {
        pl.play("parry");
      } else if (this.input.left || this.input.right) {
        const dir = this.input.right ? 1 : -1;
        pl.facing = dir;
        pl.x += dir * 3.4 * dt;
        pl.play("dash", false);
        if (this.t - this.lastStepAt > 0.28) {
          this.audio.step();
          this.lastStepAt = this.t;
          this.fx.dust(pl.x, 0.02);
        }
      } else {
        pl.play("ready", false);
      }
    }

    this.stepAi(dt);

    this.resolveCombat();

    const mid = (pl.x + ai.x) * 0.5;
    this.cam.pushTo(shotDuel(mid, Math.max(pl.y, ai.y), Math.abs(pl.x - ai.x)));
  }

  private stepAi(dt: number) {
    const ai = this.kai;
    const pl = this.ren;
    const gap = Math.abs(ai.x - pl.x);
    ai.facing = ai.x < pl.x ? 1 : -1;
    if (ai.busy()) return;

    const roll = Math.sin(this.t * 3.7) * 0.5 + 0.5;
    if (pl.attacking && gap < 2.4 && roll > 0.35) {
      ai.play("parry");
      return;
    }
    if (gap > 4.2) {
      ai.play("dash");
      return;
    }
    if (gap < 1.15 && roll > 0.7) {
      ai.play("leap");
      this.audio.whoosh(1);
      return;
    }
    if (gap < 2.6 && roll > 0.45) {
      const atk: ActionName = roll > 0.78 ? "thrust" : roll > 0.6 ? "slashLow" : "slash";
      ai.play(atk);
      this.audio.whoosh(0.9);
      return;
    }
    if (gap < 3.4) {
      ai.x += -ai.facing * 1.1 * dt;
      ai.play("ready", false);
    } else {
      ai.play("ready", false);
    }
  }

  private resolveCombat() {
    const a = this.ren;
    const b = this.kai;
    this.tryHit(a, b);
    this.tryHit(b, a);
  }

  private tryHit(atk: Samurai, def: Samurai) {
    if (!atk.attacking || def.invuln > 0) return;
    const ja = atk.joints;
    const jd = def.joints;
    const bladeHit = segIntersect(ja.guardX, ja.guardY, ja.bladeX, ja.bladeY, jd.hipX, jd.hipY, jd.headX, jd.headY);
    const close = dist(ja.bladeX, ja.bladeY, jd.hipX, jd.hipY) < 0.55;
    if (!bladeHit && !close) return;

    if (def.parrying) {
      this.doClash();
      atk.play("stagger");
      def.play("stagger");
      return;
    }

    def.invuln = 0.7;
    def.hpFlash = 0.35;
    def.play("stagger");
    atk.x += atk.facing * 0.2;
    def.x += atk.facing * 1.15;
    this.doClash(1.15);
    this.fx.spawnSlashLine(ja.guardX, ja.guardY, ja.bladeX, ja.bladeY);
    const victim = def.id;
    useDuel.getState().registerHit(victim);
  }

  private doClash(intensity = 1) {
    const x = (this.ren.joints.bladeX + this.kai.joints.bladeX) * 0.5;
    const y = (this.ren.joints.bladeY + this.kai.joints.bladeY) * 0.5;
    this.fx.spawnClash(x, y, intensity);
    this.cam.addTrauma(0.42 * intensity);
    this.cam.addPunch(0.35 * intensity);
    this.hitstop = 0.07 * intensity;
    this.audio.clash(intensity);
    useDuel.getState().registerClash();
  }

  private faceEachOther(always: boolean) {
    if (!always) {
      if (Math.abs(this.ren.x - this.kai.x) > 0.4) {
        if (!this.ren.busy()) this.ren.facing = this.ren.x < this.kai.x ? 1 : -1;
        if (!this.kai.busy()) this.kai.facing = this.kai.x < this.ren.x ? 1 : -1;
      }
      return;
    }
    if (!this.ren.busy() && !this.input.left && !this.input.right) {
      this.ren.facing = this.ren.x < this.kai.x ? 1 : -1;
    }
    if (!this.kai.busy()) this.kai.facing = this.kai.x < this.ren.x ? 1 : -1;
  }

  private keepOnBeam(duel: boolean) {
    for (const s of [this.ren, this.kai]) {
      if (Math.abs(s.x) > BEAM_HALF - 0.15) {
        if (duel && !s.airborne && s.y <= 0.01) {
          s.airborne = true;
          s.vy = 1.2;
          s.x = clamp(s.x, -BEAM_HALF - 0.4, BEAM_HALF + 0.4);
        } else if (!duel) {
          s.x = clamp(s.x, -BEAM_HALF + 0.4, BEAM_HALF - 0.4);
        }
      }
      if (s.y < -0.8) {
        this.fx.splash(s.x, -0.2);
        this.audio.splash();
        s.y = 0;
        s.vy = 0;
        s.airborne = false;
        s.x = s.id === "ren" ? -4 : 4;
        s.play("stagger");
        if (duel) useDuel.getState().registerHit(s.id);
      }
    }
  }

  private recordTrails() {
    const moving = (s: Samurai) => s.attacking || s.action === "leap" || s.action === "airSlash";
    this.fx.pushTrail(0, this.ren.joints.bladeX, this.ren.joints.bladeY, moving(this.ren));
    this.fx.pushTrail(1, this.kai.joints.bladeX, this.kai.joints.bladeY, moving(this.kai));
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const cam = this.cam.view();
    if (cam.rot) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(cam.rot);
      ctx.translate(-w / 2, -h / 2);
    }
    const toScreen = (x: number, y: number) => this.world.worldToScreen(x, y, cam, w, h);

    this.world.drawSky(ctx, w, h, cam, this.t);
    this.world.drawClouds(ctx, w, h, cam, this.t);
    this.world.drawMountains(ctx, w, h, cam, this.t);
    this.world.drawWater(ctx, w, h, cam, this.t);
    this.drawBirds(ctx, w, h, cam);

    this.ren.draw(ctx, cam, w, h, this.wind, toScreen, true);
    this.kai.draw(ctx, cam, w, h, this.wind, toScreen, true);

    this.world.drawBeam(ctx, w, h, cam);

    if (this.ren.x < this.kai.x) {
      this.ren.draw(ctx, cam, w, h, this.wind, toScreen);
      this.kai.draw(ctx, cam, w, h, this.wind, toScreen);
    } else {
      this.kai.draw(ctx, cam, w, h, this.wind, toScreen);
      this.ren.draw(ctx, cam, w, h, this.wind, toScreen);
    }

    this.fx.draw(ctx, w, h, cam, toScreen);
    this.world.drawForeground(ctx, w, h, cam);
    this.world.drawVignette(ctx, w, h, cam.letterbox);

    if (cam.rot) ctx.restore();
  }

  private drawBirds(ctx: CanvasRenderingContext2D, w: number, h: number, cam: ReturnType<DirectorCam["view"]>) {
    ctx.save();
    ctx.strokeStyle = "rgba(20,20,22,0.55)";
    ctx.lineWidth = 1.1;
    for (const b of this.world.birds) {
      const x = ((b.x + this.t * b.s * 0.35 + 30) % 60) - 30;
      const y = b.y + Math.sin(this.t * 1.3 + b.p) * 0.25;
      const p = this.world.worldToScreen(x, y, cam, w, h);
      const s = 3 + b.s * 2;
      const flap = Math.sin(this.t * 6 + b.p);
      ctx.beginPath();
      ctx.moveTo(p.x - s, p.y + flap);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x + s, p.y + flap);
      ctx.stroke();
    }
    ctx.restore();
  }
}
