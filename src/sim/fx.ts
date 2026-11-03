import type { Camera } from "./camera";
import { rand, TAU } from "./math";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: "spark" | "ink" | "splash" | "dust";
};

type Trail = { x: number; y: number; a: number };

export class FX {
  particles: Particle[] = [];
  trails: { pts: Trail[] }[] = [{ pts: [] }, { pts: [] }];
  slashes: { x1: number; y1: number; x2: number; y2: number; life: number }[] = [];
  hitFlash = 0;

  spawnClash(x: number, y: number, intensity = 1) {
    const n = 14 + Math.floor(intensity * 10);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(2.2, 7.5) * intensity;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.18, 0.42),
        max: 0.42,
        size: rand(0.03, 0.08),
        kind: "spark",
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * rand(0.4, 1.6),
        vy: Math.sin(a) * rand(0.4, 1.6),
        life: rand(0.3, 0.7),
        max: 0.7,
        size: rand(0.06, 0.16),
        kind: "ink",
      });
    }
    this.hitFlash = Math.max(this.hitFlash, 0.18 * intensity);
    this.slashes.push({
      x1: x - rand(0.4, 1.2),
      y1: y + rand(-0.4, 0.5),
      x2: x + rand(0.4, 1.6),
      y2: y + rand(-0.6, 0.3),
      life: 0.16,
    });
  }

  spawnSlashLine(x1: number, y1: number, x2: number, y2: number) {
    this.slashes.push({ x1, y1, x2, y2, life: 0.14 });
  }

  splash(x: number, y: number) {
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        x,
        y,
        vx: rand(-2, 2),
        vy: rand(2, 6),
        life: rand(0.35, 0.8),
        max: 0.8,
        size: rand(0.04, 0.12),
        kind: "splash",
      });
    }
  }

  dust(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: x + rand(-0.1, 0.1),
        y,
        vx: rand(-0.6, 0.6),
        vy: rand(0.2, 0.8),
        life: rand(0.25, 0.5),
        max: 0.5,
        size: rand(0.05, 0.12),
        kind: "dust",
      });
    }
  }

  pushTrail(id: 0 | 1, x: number, y: number, moving: boolean) {
    const pts = this.trails[id].pts;
    if (moving) pts.push({ x, y, a: 1 });
    if (pts.length > 18) pts.shift();
  }

  fadeTrails() {
    for (const tr of this.trails) {
      for (const p of tr.pts) p.a *= 0.86;
      while (tr.pts.length && tr.pts[0].a < 0.04) tr.pts.shift();
    }
  }

  step(dt: number) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "spark") {
        p.vy -= 8 * dt;
        p.vx *= 0.98;
      } else if (p.kind === "splash") {
        p.vy -= 14 * dt;
      } else if (p.kind === "dust") {
        p.vy *= 0.96;
        p.vx *= 0.94;
      } else {
        p.vx *= 0.9;
        p.vy *= 0.9;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const s of this.slashes) s.life -= dt;
    this.slashes = this.slashes.filter((s) => s.life > 0);
    this.fadeTrails();
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera, toScreen: (x: number, y: number) => { x: number; y: number }) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const tr of this.trails) {
      if (tr.pts.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < tr.pts.length; i++) {
        const p = toScreen(tr.pts[i].x, tr.pts[i].y);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = Math.max(1.2, cam.scale * 0.018);
      ctx.globalAlpha = 0.7;
      ctx.stroke();
    }

    for (const s of this.slashes) {
      const a = toScreen(s.x1, s.y1);
      const b = toScreen(s.x2, s.y2);
      ctx.globalAlpha = Math.max(0, s.life / 0.16);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, cam.scale * 0.04);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.lineWidth = Math.max(5, cam.scale * 0.09);
      ctx.globalAlpha *= 0.25;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    for (const p of this.particles) {
      const s = toScreen(p.x, p.y);
      const k = p.life / p.max;
      const r = p.size * cam.scale;
      if (p.kind === "spark") {
        ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.8, r), 0, TAU);
        ctx.fill();
      } else if (p.kind === "ink") {
        ctx.fillStyle = `rgba(8,8,10,${0.7 * k})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(1, r * 1.6), 0, TAU);
        ctx.fill();
      } else if (p.kind === "splash") {
        ctx.fillStyle = `rgba(230,235,240,${0.8 * k})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.8, r), 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(40,40,44,${0.45 * k})`;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r * 1.6, r * 0.6, 0, 0, TAU);
        ctx.fill();
      }
    }

    if (this.hitFlash > 0) {
      ctx.globalAlpha = this.hitFlash * 1.4;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
}
