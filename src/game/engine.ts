import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { AudioBus } from "./audio";
import { Fighter } from "./fighter";
import { FX } from "./fx";
import { readInput, setInjectedKeys } from "./input";
import { follow, motion, prefersReducedMotion } from "./motion";
import { getLevel } from "./levels";
import { setFighterEnvironment } from "./rig-kit";
import { getChar } from "./roster";
import { useGame } from "./store";
import type { CharId, HudSnap, PlayKind } from "./types";
import { ARENA_R, Arena } from "./world";

const STEP = 1 / 60;

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(48, 1, 0.1, 90);
  arena = new Arena();
  fx = new FX();
  audio = new AudioBus();
  fighters: Fighter[] = [];
  player: Fighter | null = null;
  kind: PlayKind = "watch";
  acc = 0;
  t = 0;
  camYaw = 0;
  camPitch = 0.34;
  camDist = 8.6;
  trauma = 0;
  combo = 0;
  comboT = 0;
  hint = "";
  hintT = 0;
  over = false;
  foldingWorld = false;
  remoteById = new Map<string, Fighter>();
  private camPos = new THREE.Vector3();
  private disposed = false;
  private lastHud = 0;
  private hitstop = 0;
  private ghostT = 0;
  private lastFold = false;
  /** Smoothed point the camera looks at (docs/MOTION.md: the camera never snaps). */
  private lookPos = new THREE.Vector3();
  private lookWant = new THREE.Vector3();
  private lookReady = false;
  /** 0 → 1 blend into Fold's view, eased (see `foldEase`). */
  private foldMix = 0;
  private foldEase = 0;
  /** Render clock for shake noise; keeps running through hit-stop. */
  private rt = 0;
  private shakeOff = new THREE.Vector3();
  /** Look-development view (QA hook `__ganryu.studio`): one fighter, orbiting camera. */
  private studio: { yaw: number; dist: number; pitch: number; height: number; orbit: number; walk: number; clean: boolean } | null = null;
  /** Adaptive resolution: frame-time samples and the ratio we started from. */
  private perf = { t: 0, n: 0, sum: 0, warm: 3 };
  /** Studio reflection map for the fighters (see rig-kit.ts). */
  private envTex: THREE.Texture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const wide = (typeof window !== "undefined" ? window.innerWidth : 800) > 700;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: wide,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, wide ? 1.7 : 1.35));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene.fog = new THREE.FogExp2(0x9a9aa4, 0.028);
    this.scene.background = new THREE.Color(0x9a9aa4);
    this.scene.add(this.arena.group);
    this.scene.add(this.fx.group);
    this.camera.position.set(0, 5.5, 11);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    setFighterEnvironment(this.envTex);
    this.bootWatch();
    this.installProbe();
  }

  resize(w: number, h: number) {
    if (w < 1 || h < 1) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  unlock() {
    this.audio.unlock();
    this.audio.setMuted(useGame.getState().muted);
  }

  clearFighters() {
    for (const f of this.fighters) {
      this.scene.remove(f.rig.root);
      f.dispose();
    }
    this.fighters = [];
    this.player = null;
    this.remoteById.clear();
    this.over = false;
    this.combo = 0;
    this.hitstop = 0;
    this.lookReady = false;
    this.studio = null;
    this.arena.group.visible = true;
  }

  bootWatch() {
    this.clearFighters();
    this.kind = "watch";
    this.arena.apply("mist");
    this.syncFog();
    const a = getChar("kairo");
    const b = getChar("nethrak");
    const fa = new Fighter(a, 0, -3.1, 0, -Math.PI / 2);
    const fb = new Fighter(b, 1, 3.1, 0, Math.PI / 2);
    this.add(fa);
    this.add(fb);
    this.hint = "";
    this.camDist = 10.4;
    this.camPitch = 0.36;
  }

  /** One fighter on a turntable, for checking looks and motion. */
  startStudio(id: CharId, o: { dist?: number; pitch?: number; height?: number; orbit?: number; walk?: number; clean?: boolean; yaw?: number } = {}) {
    this.clearFighters();
    this.kind = "watch";
    this.arena.apply("mist");
    this.syncFog();
    const f = new Fighter(getChar(id), 0, 0, 0, 0);
    this.add(f);
    this.studio = { yaw: o.yaw ?? 0.6, dist: o.dist ?? 3.4, pitch: o.pitch ?? 0.16, height: o.height ?? 1.0, orbit: o.orbit ?? 0, walk: o.walk ?? 0, clean: o.clean ?? false };
    this.arena.group.visible = !this.studio.clean;
    if (this.studio.clean) {
      (this.scene.background as THREE.Color).set(0xe9e6e1);
      (this.scene.fog as THREE.FogExp2).color.set(0xe9e6e1);
    }
    this.lookReady = false;
  }

  startCampaign(hero: CharId, level: number) {
    this.clearFighters();
    this.kind = "campaign";
    const L = getLevel(level);
    this.arena.apply(L.arena);
    this.syncFog();
    const p = new Fighter(getChar(hero), 0, 0, 4.2, 0);
    p.isPlayer = true;
    this.add(p);
    this.player = p;
    const spots = [
      [0, -4.2],
      [3.2, -3.4],
      [-3.2, -3.4],
    ];
    L.enemies.forEach((id, i) => {
      const [x, z] = spots[i] ?? [i * 2.4 - 2.4, -4];
      const e = new Fighter(getChar(id), 1, x, z, Math.PI, { hp: L.hpMul, atk: L.atkMul, spd: L.spdMul });
      this.add(e);
    });
    this.hint =
      L.id === 1
          ? "WASD move · J slash · L parry · K leap · Q art · F fold"
          : L.blurb;
    this.hintT = 5.5;
    this.t = 0;
    this.audio.draw();
    this.camDist = 8.6;
    this.camPitch = 0.34;
    useGame.getState().setPlay(level);
  }

  startDuel(hero: CharId, foe: CharId) {
    this.clearFighters();
    this.kind = "duel";
    this.arena.apply("blood");
    this.syncFog();
    const p = new Fighter(getChar(hero), 0, 0, 4.5, 0);
    p.isPlayer = true;
    this.add(p);
    this.player = p;
    const e = new Fighter(getChar(foe), 1, 0, -4.5, Math.PI);
    this.add(e);
    this.hint = "Duel — first to fall loses.";
    this.audio.draw();
    this.hintT = 3;
    this.camDist = 8.8;
    useGame.getState().setPlay(useGame.getState().level);
  }

  startCoop(hero: CharId, level: number) {
    this.startCampaign(hero, level);
    this.kind = "coop";
  }

  add(f: Fighter) {
    this.fighters.push(f);
    this.scene.add(f.rig.root);
  }

  private syncFog() {
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(this.arena.fogColor);
    (this.scene.background as THREE.Color).copy(this.arena.fogColor);
  }

  step(dt: number) {
    const cap = Math.min(dt, 0.1);
    this.rt += cap;
    this.adaptResolution(dt);
    if (this.hitstop > 0) {
      this.hitstop -= cap;
      this.fx.step(cap);
      this.drawCam(cap);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.acc += cap;
    let n = 0;
    while (this.acc >= STEP && n < 5) {
      this.fixed(STEP);
      this.acc -= STEP;
      n++;
    }
    this.arena.step(cap);
    this.fx.step(cap);
    this.drawCam(cap);
    this.renderer.render(this.scene, this.camera);
    this.lastHud += cap;
    if (this.lastHud > 0.07) {
      this.lastHud = 0;
      this.pushHud();
    }
  }

  private fixed(dt: number) {
    this.t += dt;
    this.audio.tick(this.t);
    this.sfxTick();
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    this.hintT = Math.max(0, this.hintT - dt);
    if (this.hintT <= 0) this.hint = "";
    this.trauma = Math.max(0, this.trauma - dt * motion.shake.decay);

    const p = this.player;
    const folding = !!p && p.folding();
    this.foldingWorld = folding;
    this.arena.pulseFold(folding);
    // Fold's view blends in and out over `fold.blend` instead of switching in one frame.
    const step = motion.fold.blend > 0 ? dt / motion.fold.blend : 1;
    this.foldMix = folding ? Math.min(1, this.foldMix + step) : Math.max(0, this.foldMix - step);
    const e = this.foldMix * this.foldMix * (3 - 2 * this.foldMix);
    this.foldEase = e;
    (this.scene.fog as THREE.FogExp2).density = 0.028 + (0.048 - 0.028) * e;
    this.renderer.toneMappingExposure = 1.12 + (0.78 - 1.12) * e;
    // Reduced motion keeps the fog and light change but not the zoom.
    const fov = prefersReducedMotion() ? 48 : 48 + (42 - 48) * e;
    if (Math.abs(this.camera.fov - fov) > 1e-4) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (p) p.rig.setFolding(folding);
    if (folding && !this.lastFold) {
      this.fx.foldRing(p!.x, p!.z);
      this.audio.fold();
    }
    this.lastFold = folding;
    if (folding && p) {
      this.ghostT -= dt;
      if (this.ghostT <= 0) {
        this.ghostT = 0.08;
        this.fx.afterimage(p.x, p.y, p.z, p.yaw);
      }
    }

    const camYaw = this.camYaw;
    if (p && (this.kind === "campaign" || this.kind === "duel" || this.kind === "coop") && !this.over) {
      const inp = readInput();
      const nearest = this.nearestFoe(p);
      if (nearest && (inp.slash || inp.power || p.anim === "slash")) p.faceToward(nearest.x, nearest.z);
      p.applyInput(inp, camYaw, dt);
    }

    if (this.studio) {
      const f = this.fighters[0];
      if (f && !f.dead) {
        const s = this.studio;
        // Walk a circle of radius 2.4 at `walk` (0–1 of full speed); stand otherwise.
        const a = Math.atan2(f.z, f.x) + Math.PI / 2;
        const inward = s.walk > 0 ? (Math.hypot(f.x, f.z) - 2.4) * 0.6 : 0;
        const mx = s.walk > 0 ? (Math.cos(a) - (f.x / (Math.hypot(f.x, f.z) || 1)) * inward) * s.walk : 0;
        const mz = s.walk > 0 ? (Math.sin(a) - (f.z / (Math.hypot(f.x, f.z) || 1)) * inward) * s.walk : 0;
        f.applyInput({ mx, mz, slash: f.wantSlash, parry: f.wantParry, leap: f.wantLeap, power: f.wantPower, fold: f.wantFold }, 0, dt);
        f.wantSlash = f.wantParry = f.wantLeap = f.wantPower = f.wantFold = false;
        f.stepKinematics(dt, ARENA_R);
      }
      return;
    }

    for (const f of this.fighters) {
      if (f === p) continue;
      if (f.dead) continue;
      const aiDt = folding ? dt * 0.22 : dt;
      if (f.team === 1) this.thinkAi(f, aiDt);
      else if (!f.isPlayer) this.thinkAi(f, aiDt);
      const dummy = {
        mx: f.aiMx,
        mz: f.aiMz,
        slash: f.wantSlash,
        parry: f.wantParry,
        leap: f.wantLeap,
        power: f.wantPower,
        fold: f.wantFold,
      };
      const target = this.nearestFoe(f);
      if (target && (f.wantSlash || f.anim === "slash")) f.faceToward(target.x, target.z);
      f.applyInput(dummy, 0, aiDt);
      f.wantSlash = f.wantParry = f.wantLeap = f.wantPower = f.wantFold = false;
    }

    for (const f of this.fighters) {
      const local = f === p || f.team === 0 ? dt : folding ? dt * 0.22 : dt;
      f.stepKinematics(local, ARENA_R);
    }
    this.separate();
    this.resolveCombat();
    this.checkEnd();
  }

  private thinkAi(f: Fighter, dt: number) {
    f.aiTimer -= dt;
    const foe = this.nearestFoe(f);
    if (!foe) {
      f.aiMx = 0;
      f.aiMz = 0;
      return;
    }
    const dx = foe.x - f.x;
    const dz = foe.z - f.z;
    const dist = Math.hypot(dx, dz);
    const level = this.kind === "watch" ? 8 : useGame.getState().level;
    const aggro = 0.6 + level * 0.045;
    if (dist > f.range * 1.15) {
      f.aiMx = dx / (dist || 1);
      f.aiMz = dz / (dist || 1);
    } else if (dist < f.range * 0.55) {
      f.aiMx = -dx / (dist || 1);
      f.aiMz = -dz / (dist || 1);
    } else {
      const px = -dz;
      const pz = dx;
      const pm = Math.hypot(px, pz) || 1;
      f.aiMx = px / pm;
      f.aiMz = pz / pm;
    }
    if (f.aiTimer <= 0) {
      f.aiTimer = 0.4 + Math.random() * (1.05 - aggro * 0.35);
      const r = Math.random();
      if (dist < f.range * 1.3 && r < aggro) f.wantSlash = true;
      else if (r < 0.12 + aggro * 0.08) f.wantParry = true;
      else if (r < 0.2) f.wantLeap = true;
      else if (r < 0.3 && f.powerCd <= 0) f.wantPower = true;
    }
    if (foe.anim === "slash" && dist < f.range * 1.2 && Math.random() < 0.38 * aggro) f.wantParry = true;
  }

  private nearestFoe(f: Fighter): Fighter | null {
    let best: Fighter | null = null;
    let bd = 1e9;
    for (const o of this.fighters) {
      if (o === f || o.dead || o.team === f.team) continue;
      const d = (o.x - f.x) ** 2 + (o.z - f.z) ** 2;
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  private separate() {
    for (let i = 0; i < this.fighters.length; i++) {
      for (let j = i + 1; j < this.fighters.length; j++) {
        const a = this.fighters[i];
        const b = this.fighters[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = a.radius + b.radius;
        if (d < min && d > 0.0001) {
          const push = (min - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
        }
      }
    }
  }

  private resolveCombat() {
    for (const a of this.fighters) {
      if (a.dead) continue;
      if (a.slashActive()) {
        const f = a.forward();
        const hx = a.x + f.x * a.range * 0.7;
        const hz = a.z + f.z * a.range * 0.7;
        for (const b of this.fighters) {
          if (b === a || b.dead || b.team === a.team) continue;
          const d = Math.hypot(b.x - hx, b.z - hz);
          if (d < b.radius + 0.55) {
            a.slashHits += 1;
            a.hitLanded = true;
            const dmg = a.folding() ? a.atk * 1.55 : a.atk;
            this.strike(a, b, dmg);
          }
        }
        if (!a.swingFx) {
          a.swingFx = true;
          this.fx.slashArc(a.x, 1, a.z, a.yaw);
          this.audio.slash(this.pan(a));
        }
      }
      if (a.anim === "special" && a.animT > 0.08 && a.animT < 0.2 && !a.hitLanded) {
        a.hitLanded = true;
        this.castPower(a);
      }
      if (a.ember > 0) {
        for (const b of this.fighters) {
          if (b === a || b.dead || b.team === a.team) continue;
          if (Math.hypot(b.x - a.x, b.z - a.z) < 1.4) b.takeHit(6 * (1 / 60) * 8, a, a.folding());
        }
      }
    }
  }

  private prevAnim = new WeakMap<Fighter, string>();
  private panVec = new THREE.Vector3();

  /** Left/right pan for a fighter from its on-screen position. */
  private pan(f: Fighter) {
    this.panVec.set(f.x, 1, f.z).project(this.camera);
    return Math.max(-0.8, Math.min(0.8, this.panVec.x * 0.7));
  }

  /** Movement sounds driven by animation changes (leap, arts) and stride. */
  private sfxTick() {
    if (this.kind === "watch") return;
    for (const f of this.fighters) {
      const prev = this.prevAnim.get(f);
      if (f.anim !== prev) {
        if (f.anim === "leap") this.audio.leap(this.pan(f));
        if (f.anim === "special") this.audio.power(this.pan(f));
        this.prevAnim.set(f, f.anim);
      }
      if (f.isPlayer && !f.dead && f.y <= 0.01) {
        const speed = Math.hypot(f.vx, f.vz);
        if (speed > 1.2 && (f.anim === "idle" || f.anim === "walk")) this.audio.step(this.t, this.pan(f), speed / 4);
      }
    }
  }

  private strike(a: Fighter, b: Fighter, dmg: number) {
    const res = b.takeHit(dmg, a, a.folding());
    if (res === "parry") {
      this.audio.parry(this.pan(b));
      this.fx.burst(b.x, 1.2, b.z, 10, "#efece4", 3.2);
      a.stun = 0.25;
      this.trauma = Math.min(1, this.trauma + motion.shake.parry);
      this.hitstop = motion.hitstop.parry;
      return;
    }
    if (res === "immune") {
      this.fx.burst(b.x, 1.3, b.z, 7, "#8a8a90", 2);
      if (b.unbeatable) {
        this.hint = "The Uncut — fold the Fourth (F) to wound them.";
        this.hintT = 2.2;
      }
      this.audio.clash(this.pan(b));
      return;
    }
    if (res === "hit" || res === "dead") {
      this.audio.hit(this.pan(b));
      this.fx.burst(b.x, 1.2, b.z, 16, a.folding() ? "#efece4" : "#b4232a", 5.2);
      this.trauma = Math.min(1, this.trauma + (res === "dead" ? motion.shake.kill : motion.shake.hit));
      this.hitstop = res === "dead" ? motion.hitstop.kill : motion.hitstop.hit;
      if (a.isPlayer) {
        this.combo += 1;
        this.comboT = 2.2;
      }
    }
  }

  private castPower(a: Fighter) {
    const kind = a.powerKind();
    const foe = this.nearestFoe(a);
    this.audio.fold();
    this.fx.burst(a.x, 1.2, a.z, 18, a.def.kit.accent, 5.5);
    this.fx.foldRing(a.x, a.z);
    if (kind === "dash") {
      const f = a.forward();
      const sx = a.x;
      const sz = a.z;
      a.x += f.x * 3.2;
      a.z += f.z * 3.2;
      this.trail(a, sx, sz);
      a.iFrames = 0.35;
      if (foe && Math.hypot(foe.x - a.x, foe.z - a.z) < 2) this.strike(a, foe, a.atk * 1.2);
    } else if (kind === "aoe") {
      for (const b of this.fighters) {
        if (b === a || b.dead || b.team === a.team) continue;
        if (Math.hypot(b.x - a.x, b.z - a.z) < 3.2) this.strike(a, b, a.atk * 1.15);
      }
    } else if (kind === "dot") {
      a.ember = 3.5;
    } else if (kind === "reflect") {
      a.reflect = 2.4;
      a.hp = Math.min(a.maxHp, a.hp + 10);
    } else if (kind === "burst") {
      if (foe) this.strike(a, foe, a.atk * 1.8);
    } else if (kind === "slow") {
      if (foe) foe.slow = 2.6;
    } else if (kind === "ranged" || kind === "homing") {
      if (foe) this.strike(a, foe, a.atk * 1.25);
      this.fx.burst(foe?.x ?? a.x, 1.4, foe?.z ?? a.z, 10, "#efece4", 4);
    } else if (kind === "charge") {
      const f = a.forward();
      a.vx += f.x * 10;
      a.vz += f.z * 10;
      if (foe) this.strike(a, foe, a.atk * 1.4);
    } else if (kind === "teleport") {
      if (foe) {
        const f = foe.forward();
        const sx = a.x;
        const sz = a.z;
        a.x = foe.x - f.x * 1.4;
        a.z = foe.z - f.z * 1.4;
        this.trail(a, sx, sz);
        a.faceToward(foe.x, foe.z);
        this.strike(a, foe, a.atk);
      }
    } else if (kind === "stun") {
      if (foe) {
        foe.stun = 1.1;
        this.strike(a, foe, a.atk * 0.7);
      }
    } else if (kind === "iaido") {
      if (foe) this.strike(a, foe, a.atk * 2.1);
    }
  }

  /**
   * If frames average slower than 45 fps over two seconds, render at a lower
   * pixel ratio (never below 1). Shading cost scales with pixels, so this keeps
   * weaker phones smooth. The first seconds (shader compilation) are ignored.
   */
  private adaptResolution(dt: number) {
    const p = this.perf;
    if (p.warm > 0) {
      p.warm -= dt;
      return;
    }
    p.t += dt;
    p.n += 1;
    p.sum += dt;
    if (p.t < 2) return;
    const avg = p.sum / p.n;
    p.t = p.n = p.sum = 0;
    const ratio = this.renderer.getPixelRatio();
    if (avg > 1 / 45 && ratio > 1.001) this.renderer.setPixelRatio(Math.max(1, ratio - 0.15));
  }

  /** Afterimages from where a fighter was to where they appeared, faint to strong. */
  private trail(a: Fighter, sx: number, sz: number) {
    const n = Math.max(0, Math.round(motion.dash.ghosts));
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0 : i / (n - 1);
      this.fx.afterimage(sx + (a.x - sx) * k * 0.85, a.y, sz + (a.z - sz) * k * 0.85, a.yaw, 0.35 + 0.65 * k);
    }
  }

  /** Smooth shake from trauma², sum-of-sines noise (per-frame random reads as jitter). */
  private shake(): THREE.Vector3 {
    const amount = prefersReducedMotion() ? 0 : motion.shake.amount;
    const s = this.trauma * this.trauma * amount;
    if (s < 0.002) return this.shakeOff.set(0, 0, 0);
    const w = this.rt * motion.shake.freq * Math.PI * 2;
    const n = (o: number) => (Math.sin(w + o) * 0.6 + Math.sin(w * 1.71 + o * 2.3) * 0.3 + Math.sin(w * 2.93 + o * 4.1) * 0.1) * 0.5;
    return this.shakeOff.set(n(0.0) * s * 0.55, n(11.3) * s * 0.28, n(23.7) * s * 0.35);
  }

  /** Ease the look point toward `lookWant`, snapping only on the first frame of a fight. */
  private aim(dt: number) {
    if (!this.lookReady) {
      this.lookPos.copy(this.lookWant);
      this.lookReady = true;
    } else this.lookPos.lerp(this.lookWant, follow(motion.camera.look, dt));
    this.camera.lookAt(this.lookPos);
  }

  private checkEnd() {
    if (this.over) return;
    if (this.kind === "watch") return;
    const p = this.player;
    if (p && p.dead) {
      this.over = true;
      this.audio.lose();
      useGame.getState().finish("lose");
      return;
    }
    const foes = this.fighters.filter((f) => f.team === 1);
    if (foes.length && foes.every((f) => f.dead)) {
      this.over = true;
      this.audio.win();
      useGame.getState().finish("win");
    }
  }

  private drawCam(dt: number) {
    if (this.studio) {
      const s = this.studio;
      const f = this.fighters[0];
      if (!f) return;
      const yaw = s.yaw + this.t * s.orbit;
      this.camera.position.set(f.x + Math.sin(yaw) * s.dist, s.height + Math.sin(s.pitch) * s.dist, f.z + Math.cos(yaw) * s.dist);
      this.camera.lookAt(f.x, s.height, f.z);
      return;
    }
    const p = this.player;
    const target = p ?? this.fighters[0];
    if (!target) return;
    // Side-on fighting-game framing: look across the line between the player
    // and the nearest living foe, so both read in profile.
    const foe = p
      ? this.fighters
          .filter((f) => f.team !== p.team && !f.dead)
          .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]
      : this.fighters.length > 1
        ? this.fighters[1]
        : undefined;
    const lead = p ?? this.fighters[0];
    if (lead && foe) {
      const dx = foe.x - lead.x;
      const dz = foe.z - lead.z;
      const sep = Math.hypot(dx, dz) || 1;
      // candidate camera sides: perpendicular to the fighters' line
      const nx = -dz / sep;
      const nz = dx / sep;
      const curX = Math.sin(this.camYaw);
      const curZ = Math.cos(this.camYaw);
      const sgn = nx * curX + nz * curZ >= 0 ? 1 : -1;
      const want = Math.atan2(nx * sgn, nz * sgn);
      const dyaw = ((want - this.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.camYaw += dyaw * follow(motion.camera.yaw, dt);
      const midX = (lead.x + foe.x) / 2;
      const midZ = (lead.z + foe.z) / 2;
      // fit both fighters plus a margin inside the horizontal field of view
      const halfW = Math.tan(((this.camera.fov / 2) * Math.PI) / 180) * Math.max(0.3, this.camera.aspect);
      const wantDist = Math.min(14, Math.max(4.8, (sep / 2 + 1.35) / halfW));
      this.camDist += (wantDist - this.camDist) * follow(motion.camera.zoom, dt);
      this.camPitch += (0.16 - this.camPitch) * follow(2, dt);
      this.frameSide(midX, midZ, dt);
      return;
    }
    if (p) {
      const dyaw = ((p.yaw - this.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.camYaw += dyaw * follow(3.4, dt);
    } else {
      this.camYaw = this.t * 0.16;
      this.camDist = 10.2 + Math.sin(this.t * 0.28) * 1.1;
      this.camPitch = 0.34 + Math.sin(this.t * 0.19) * 0.06;
    }
    const dist = this.camDist + 1.1 * this.foldEase;
    const fx = -Math.sin(this.camYaw);
    const fz = -Math.cos(this.camYaw);
    const lookY = 1.28 + 0.25 * this.foldEase;
    const leadX = p ? p.vx * 0.12 : 0;
    const leadZ = p ? p.vz * 0.12 : 0;
    const sh = this.shake();
    this.camPos.set(target.x + leadX - fx * dist + sh.x, lookY + Math.sin(this.camPitch) * dist * 0.95 + sh.y, target.z + leadZ - fz * dist + sh.z);
    this.camera.position.lerp(this.camPos, follow(4.8, dt));
    this.lookWant.set(target.x + leadX, lookY, target.z + leadZ);
    this.aim(dt);
  }

  private frameSide(midX: number, midZ: number, dt: number) {
    const dist = this.camDist + 1.1 * this.foldEase;
    const fx = -Math.sin(this.camYaw);
    const fz = -Math.cos(this.camYaw);
    const lookY = 1.15 + 0.2 * this.foldEase;
    const sh = this.shake();
    this.camPos.set(midX - fx * dist + sh.x, lookY + Math.sin(this.camPitch) * dist * 0.95 + sh.y, midZ - fz * dist + sh.z);
    this.camera.position.lerp(this.camPos, follow(motion.camera.follow, dt));
    this.lookWant.set(midX, lookY, midZ);
    this.aim(dt);
  }

  hud(): HudSnap {
    const p = this.player;
    return {
      player: p ? p.snap() : null,
      allies: this.fighters.filter((f) => f.team === 0 && f !== p).map((f) => f.snap()),
      enemies: this.fighters.filter((f) => f.team === 1).map((f) => f.snap()),
      fold: p ? p.foldT : 0,
      foldMax: 3.1,
      power: p ? Math.max(0, p.def.power.cd - p.powerCd) : 0,
      powerMax: p ? p.def.power.cd : 1,
      combo: this.combo,
      hint: this.hint,
      clock: this.t,
    };
  }

  private pushHud() {
    useGame.getState().setHud(this.hud());
  }

  private installProbe() {
    const self = this;
    window.__controlsTest = {
      getYaw: () => self.player?.yaw ?? 0,
      getSpeed: () => {
        const p = self.player;
        if (!p) return 0;
        return Math.hypot(p.vx, p.vz);
      },
      setKeys: (codes: string[]) => setInjectedKeys(codes),
      setSteer: (v: number) => {
        if (v > 0.2) setInjectedKeys(["KeyW", "KeyA"]);
        else if (v < -0.2) setInjectedKeys(["KeyW", "KeyD"]);
        else setInjectedKeys(["KeyW"]);
      },
    };
    window.__ganryu = {
      duel: (a, b) => self.startDuel(a, b),
      campaign: (hero, level) => self.startCampaign(hero, level),
      studio: (id, o) => self.startStudio(id, o),
      rig: () => self.fighters[0]?.rig ?? null,
      info: () => ({ ...self.renderer.info.render, programs: self.renderer.info.programs?.length ?? 0 }),
      act: (name) => {
        const f = self.fighters[0];
        if (!f) return;
        if (name === "slash") f.wantSlash = true;
        else if (name === "parry") f.wantParry = true;
        else if (name === "leap") f.wantLeap = true;
        else if (name === "power") f.wantPower = true;
        else if (name === "fold") f.wantFold = true;
      },
      cam: (d, p) => {
        self.camDist = d;
        if (p !== undefined) self.camPitch = p;
      },
      pose: (name) => {
        const p = self.player;
        if (p) p.beginAnim(name);
      },
      ids: () => self.fighters.map((f) => f.def.id),
      state: () => ({
        cam: self.camera.position.toArray(),
        look: self.camera.getWorldDirection(new THREE.Vector3()).toArray(),
        fov: self.camera.fov,
        camYaw: self.camYaw,
        camDist: self.camDist,
        fighters: self.fighters.map((f) => ({ id: f.def.id, x: f.x, z: f.z, dead: f.dead, anim: f.anim, animT: f.animT })),
      }),
      freeze: () => {
        for (const f of self.fighters) {
          if (f.isPlayer) continue;
          f.stun = 30;
          f.vx = 0;
          f.vz = 0;
          if (!f.dead) f.beginAnim("idle");
        }
      },
      foeAnim: (name) => {
        const e = self.fighters.find((f) => !f.isPlayer);
        if (!e) return;
        e.stun = 0;
        if (name === "slash") e.startSlash();
        else if (name === "leap") e.startLeap();
        else e.beginAnim(name);
      },
      lookAtFoe: (dist = 3.4) => {
        const p = self.player;
        const e = self.fighters.find((f) => f !== p);
        if (!p || !e) return;
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        p.x = e.x - (dx / len) * dist;
        p.z = e.z - (dz / len) * dist;
        p.vx = 0;
        p.vz = 0;
        p.faceToward(e.x, e.z);
        e.stun = 30;
        e.vx = 0;
        e.vz = 0;
        if (!e.dead) e.beginAnim("idle");
        self.camYaw = p.yaw;
        self.camDist = 4.4;
        self.camPitch = 0.16;
      },
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearFighters();
    this.fx.dispose();
    setFighterEnvironment(null);
    this.envTex?.dispose();
    this.renderer.dispose();
    window.__controlsTest = undefined;
    window.__ganryu = undefined;
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
    __ganryu?: {
      duel: (a: CharId, b: CharId) => void;
      campaign: (hero: CharId, level: number) => void;
      studio: (id: CharId, o?: { dist?: number; pitch?: number; height?: number; orbit?: number; walk?: number; clean?: boolean; yaw?: number }) => void;
      act: (name: "slash" | "parry" | "leap" | "power" | "fold") => void;
      rig: () => import("./mesh").Rig | null;
      info: () => { calls: number; triangles: number; programs: number };
      cam: (d: number, p?: number) => void;
      pose: (name: import("./types").AnimName) => void;
      ids: () => string[];
      state: () => {
        cam: number[];
        look: number[];
        fov: number;
        camYaw: number;
        camDist: number;
        fighters: { id: string; x: number; z: number; dead: boolean; anim: string; animT: number }[];
      };
      freeze: () => void;
      foeAnim: (name: import("./types").AnimName) => void;
      lookAtFoe: (dist?: number) => void;
    };
  }
}
