import { hash, lerp, noise1, TAU } from "./math";
import type { Camera } from "./camera";

export const BEAM_HALF = 11.2;
export const BEAM_Y = 0;

type Cloud = {
  x: number;
  y: number;
  w: number;
  h: number;
  a: number;
  speed: number;
  dark: boolean;
  seed: number;
};

export class World {
  clouds: Cloud[] = [];
  birds: { x: number; y: number; s: number; p: number }[] = [];
  private grain: HTMLCanvasElement | null = null;

  constructor() {
    for (let i = 0; i < 18; i++) {
      this.clouds.push({
        x: hash(i * 3.1) * 80 - 40,
        y: 3.4 + hash(i * 7.7) * 6.5,
        w: 3.5 + hash(i * 2.2) * 8,
        h: 0.7 + hash(i * 5.5) * 1.6,
        a: 0.18 + hash(i * 9.1) * 0.45,
        speed: 0.12 + hash(i * 1.7) * 0.28,
        dark: hash(i * 4.4) > 0.62,
        seed: i * 17.13,
      });
    }
    for (let i = 0; i < 9; i++) {
      this.birds.push({
        x: hash(i * 11) * 40 - 20,
        y: 4 + hash(i * 13) * 5,
        s: 0.4 + hash(i * 3) * 0.8,
        p: hash(i * 8) * TAU,
      });
    }
  }

  ensureGrain() {
    if (this.grain) return this.grain;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d");
    if (!g) return c;
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 90 + Math.random() * 80;
      img.data[i] = n;
      img.data[i + 1] = n;
      img.data[i + 2] = n;
      img.data[i + 3] = 28 + Math.random() * 18;
    }
    g.putImageData(img, 0, 0);
    this.grain = c;
    return c;
  }

  drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera, t: number) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#9aa3ad");
    sky.addColorStop(0.28, "#c5ccd3");
    sky.addColorStop(0.55, "#dfe3e6");
    sky.addColorStop(0.72, "#cfd6dc");
    sky.addColorStop(1, "#8a929a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sun = this.worldToScreen(7.8, 1.55, cam, w, h);
    const glow = ctx.createRadialGradient(sun.x, sun.y, 8, sun.x, sun.y, h * 0.72);
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(0.08, "rgba(255,255,255,0.55)");
    glow.addColorStop(0.22, "rgba(255,255,255,0.16)");
    glow.addColorStop(0.5, "rgba(255,255,255,0.04)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  drawClouds(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera, t: number) {
    for (const c of this.clouds) {
      const x = ((c.x + t * c.speed + 50) % 100) - 50;
      const p = this.worldToScreen(x, c.y, cam, w, h);
      const sc = cam.scale;
      ctx.fillStyle = c.dark ? `rgba(70,76,84,${c.a * 0.55})` : `rgba(255,255,255,${c.a})`;
      this.puff(ctx, p.x, p.y, c.w * sc, c.h * sc, c.seed);
    }
  }

  private puff(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
    ctx.beginPath();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const ox = (hash(seed + i) - 0.5) * w * 0.7;
      const oy = (hash(seed + i + 9) - 0.5) * h * 0.45;
      const rw = w * (0.28 + hash(seed + i + 3) * 0.28);
      const rh = h * (0.55 + hash(seed + i + 4) * 0.5);
      ctx.ellipse(x + ox, y + oy, rw, rh, 0, 0, TAU);
    }
    ctx.fill();
  }

  drawMountains(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera, t: number) {
    this.mtnLayer(ctx, w, h, cam, -18, 2.2, 0.55, "#b7bec6", 1);
    this.mtnLayer(ctx, w, h, cam, -16.5, 1.4, 0.85, "#8b939c", 2);
    this.drawTrees(ctx, w, h, cam);
  }

  private mtnLayer(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cam: Camera,
    originX: number,
    baseY: number,
    height: number,
    color: string,
    seed: number,
  ) {
    ctx.beginPath();
    const start = this.worldToScreen(originX - 4, 0, cam, w, h);
    ctx.moveTo(start.x, h);
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const wx = originX + (i / steps) * 22;
      const ridge =
        height * (0.35 + noise1(i * 0.37 + seed) * 0.8) * Math.sin((i / steps) * Math.PI);
      const p = this.worldToScreen(wx, baseY + ridge, cam, w, h);
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  private drawTrees(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera) {
    ctx.fillStyle = "#4e555c";
    for (let i = 0; i < 22; i++) {
      const wx = -14.5 + i * 0.42 + hash(i * 2.2) * 0.2;
      const wy = 1.05 + hash(i) * 0.35;
      const p = this.worldToScreen(wx, wy, cam, w, h);
      const sc = cam.scale * (0.18 + hash(i * 3) * 0.12);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - sc * 0.45, p.y + sc * 1.4);
      ctx.lineTo(p.x + sc * 0.45, p.y + sc * 1.4);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawWater(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera, t: number) {
    const left = this.worldToScreen(-40, BEAM_Y, cam, w, h);
    const waterTop = left.y + cam.scale * 0.22;
    const grad = ctx.createLinearGradient(0, waterTop, w, waterTop);
    grad.addColorStop(0, "#6d757e");
    grad.addColorStop(0.45, "#8b949c");
    grad.addColorStop(0.72, "#c9d0d6");
    grad.addColorStop(0.86, "#f4f6f8");
    grad.addColorStop(1, "#d5dbe0");
    ctx.fillStyle = grad;
    ctx.fillRect(0, waterTop, w, h - waterTop);

    const sun = this.worldToScreen(7.8, 1.55, cam, w, h);
    const path = ctx.createRadialGradient(sun.x, waterTop + 8, 4, sun.x, waterTop + 40, h * 0.45);
    path.addColorStop(0, "rgba(255,255,255,0.7)");
    path.addColorStop(0.25, "rgba(255,255,255,0.18)");
    path.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = path;
    ctx.fillRect(0, waterTop, w, h - waterTop);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, waterTop, w, h - waterTop);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const wy = -0.4 - i * 0.55;
      ctx.beginPath();
      const samples = 36;
      for (let s = 0; s <= samples; s++) {
        const wx = -22 + (s / samples) * 48;
        const wave = Math.sin(wx * 0.9 + t * 1.4 + i) * 0.06 + Math.sin(wx * 0.21 + t * 0.5) * 0.1;
        const p = this.worldToScreen(wx, wy + wave, cam, w, h);
        if (s === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.globalAlpha = 0.12 + (i % 3) * 0.04;
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawBeam(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera) {
    const y = BEAM_Y;
    const x0 = -BEAM_HALF;
    const x1 = BEAM_HALF;
    const a = this.worldToScreen(x0, y, cam, w, h);
    const b = this.worldToScreen(x1, y, cam, w, h);
    const thick = cam.scale * 0.16;
    const depth = cam.scale * 0.11;

    ctx.fillStyle = "#1a1a1c";
    ctx.fillRect(a.x, a.y, b.x - a.x, depth + 2);

    ctx.fillStyle = "#2a2a2e";
    ctx.fillRect(a.x, a.y - thick * 0.35, b.x - a.x, thick);

    ctx.fillStyle = "#3e3e44";
    ctx.fillRect(a.x, a.y - thick * 0.35, b.x - a.x, thick * 0.22);

    const posts = [-BEAM_HALF + 0.15, -3.6, 3.6, BEAM_HALF - 0.15];
    for (const px of posts) {
      const p = this.worldToScreen(px, y, cam, w, h);
      const pw = cam.scale * 0.13;
      const ph = cam.scale * 0.42;
      ctx.fillStyle = "#161618";
      ctx.fillRect(p.x - pw * 0.5, p.y - ph + thick * 0.1, pw, ph);
      ctx.fillStyle = "#2c2c30";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - ph + thick * 0.1, pw * 0.62, pw * 0.38, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#1a1a1c";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - ph + thick * 0.1, pw * 0.38, pw * 0.22, 0, 0, TAU);
      ctx.fill();
    }

    const shadow = ctx.createLinearGradient(0, a.y, 0, a.y + cam.scale * 1.8);
    shadow.addColorStop(0, "rgba(0,0,0,0.35)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.fillRect(a.x, a.y + depth, b.x - a.x, cam.scale * 1.6);
  }

  drawForeground(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera) {
    const y = this.worldToScreen(0, -1.6, cam, w, h).y;
    const g = ctx.createLinearGradient(0, Math.min(y, h * 0.78), 0, h);
    g.addColorStop(0, "rgba(10,10,12,0)");
    g.addColorStop(0.25, "rgba(10,10,12,0.55)");
    g.addColorStop(1, "#0a0a0c");
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.min(y, h * 0.72), w, h);
  }

  drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, letterbox: number) {
    const v = ctx.createRadialGradient(w * 0.5, h * 0.42, h * 0.15, w * 0.5, h * 0.5, h * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);

    if (letterbox > 0) {
      const bar = h * letterbox;
      ctx.fillStyle = "#050506";
      ctx.fillRect(0, 0, w, bar);
      ctx.fillRect(0, h - bar, w, bar);
    }

    const grain = this.ensureGrain();
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.globalCompositeOperation = "overlay";
    const ox = (Date.now() * 0.03) % 128;
    ctx.drawImage(grain, -ox, -ox, w + 128, h + 128);
    ctx.restore();
  }

  worldToScreen(x: number, y: number, cam: Camera, w: number, h: number) {
    return {
      x: w * 0.5 + (x - cam.x) * cam.scale,
      y: h * 0.5 - (y - cam.y) * cam.scale,
    };
  }
}
