import * as THREE from "three";
import type { Rig } from "./mesh";
import { buildSpriteRig } from "./sprite-rig";
import type { AnimName, CharacterDef, CharId, InputFrame, PowerKind } from "./types";

let nid = 1;

export class Fighter {
  id: string;
  def: CharacterDef;
  team: 0 | 1;
  rig: Rig;
  x = 0;
  z = 0;
  y = 0;
  yaw = 0;
  vx = 0;
  vz = 0;
  hp: number;
  maxHp: number;
  atk: number;
  defn: number;
  spd: number;
  range: number;
  anim: AnimName = "idle";
  animT = 0;
  atkCd = 0;
  parryT = 0;
  powerCd = 0;
  foldT = 0;
  foldCd = 0;
  hurtT = 0;
  dead = false;
  iFrames = 0;
  slow = 0;
  reflect = 0;
  stun = 0;
  ember = 0;
  radius: number;
  isPlayer = false;
  unbeatable: boolean;
  aiTimer = 0;
  wantSlash = false;
  wantParry = false;
  wantLeap = false;
  wantPower = false;
  wantFold = false;
  aiMx = 0;
  aiMz = 0;
  slashHits = 0;
  hitLanded = false;
  swingFx = false;

  constructor(def: CharacterDef, team: 0 | 1, x: number, z: number, yaw: number, mul?: { hp: number; atk: number; spd: number }) {
    this.id = `f${nid++}`;
    this.def = def;
    this.team = team;
    this.rig = buildSpriteRig(def);
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.maxHp = Math.round(def.hp * (mul?.hp ?? 1));
    this.hp = this.maxHp;
    this.atk = def.atk * (mul?.atk ?? 1);
    this.defn = def.def;
    this.spd = def.spd * (mul?.spd ?? 1);
    this.range = def.range;
    this.radius = 0.42 * Math.min(def.kit.scale, 1.35);
    this.unbeatable = def.unbeatable;
    this.place();
  }

  place() {
    this.rig.root.position.set(this.x, this.y, this.z);
    this.rig.root.rotation.y = this.yaw;
  }

  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  get beast() {
    return this.def.kit.body === "beast";
  }

  beginAnim(name: AnimName) {
    this.anim = name;
    this.animT = 0;
    this.hitLanded = false;
    this.slashHits = 0;
  }

  applyInput(inp: InputFrame, camYaw: number, dt: number) {
    if (this.dead || this.stun > 0 || this.anim === "die") return;
    if (this.anim === "slash" || this.anim === "parry" || this.anim === "special" || this.anim === "hurt") return;
    const s = Math.sin(camYaw);
    const c = Math.cos(camYaw);
    const wx = inp.mx * c + inp.mz * s;
    const wz = -inp.mx * s + inp.mz * c;
    const mag = Math.hypot(wx, wz);
    const speed = 4.2 * this.spd * (this.foldT > 0 ? 1.15 : 1) * (this.slow > 0 ? 0.45 : 1) * (this.beast ? 1.12 : 1);
    if (mag > 0.08) {
      this.vx = (wx / mag) * speed;
      this.vz = (wz / mag) * speed;
      const desired = Math.atan2(-wx, -wz);
      let d = desired - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, (this.beast ? 14 : 10) * dt);
      if (this.anim !== "leap") this.beginWalk();
    } else {
      this.vx *= Math.exp(-10 * dt);
      this.vz *= Math.exp(-10 * dt);
      if (this.anim === "walk") this.beginAnim("idle");
    }
    if (inp.slash && this.atkCd <= 0) this.startSlash();
    if (inp.parry) this.startParry();
    if (inp.leap && this.y <= 0.01) this.startLeap();
    if (inp.power && this.powerCd <= 0) this.startPower();
    if (inp.fold && this.foldCd <= 0 && this.foldT <= 0) this.startFold();
  }

  private beginWalk() {
    if (this.anim === "idle" || this.anim === "walk") this.anim = "walk";
  }

  startSlash() {
    this.beginAnim("slash");
    this.atkCd = (this.beast ? 0.5 : 0.42) / this.spd;
    this.swingFx = false;
    this.slashHits = 0;
    if (this.beast) {
      const f = this.forward();
      this.vx += f.x * 4.4;
      this.vz += f.z * 4.4;
    }
  }
  startParry() {
    this.beginAnim("parry");
    this.parryT = 0.38;
  }
  startLeap() {
    this.beginAnim("leap");
    const f = this.forward();
    const burst = this.beast ? 9.2 : 6;
    this.vx += f.x * burst;
    this.vz += f.z * burst;
    this.y = 0.02;
    this.vy = this.beast ? 7.5 : 6.2;
  }
  startPower() {
    this.beginAnim("special");
    this.powerCd = this.def.power.cd;
  }
  startFold() {
    this.beginAnim("fold");
    this.foldT = 3.1;
    this.foldCd = 9.5;
  }

  vy = 0;

  stepKinematics(dt: number, arenaR: number) {
    if (this.dead) {
      this.animT += dt;
      this.rig.setAnim("die", this.animT, 1, 1);
      this.place();
      return;
    }
    if (this.y > 0 || this.vy > 0) {
      this.vy -= 18 * dt;
      this.y += this.vy * dt;
      if (this.y < 0) {
        this.y = 0;
        this.vy = 0;
        if (this.anim === "leap") this.beginAnim("idle");
      }
    }
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const r = Math.hypot(this.x, this.z);
    if (r > arenaR - this.radius) {
      const k = (arenaR - this.radius) / r;
      this.x *= k;
      this.z *= k;
    }
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.parryT = Math.max(0, this.parryT - dt);
    this.powerCd = Math.max(0, this.powerCd - dt);
    this.foldT = Math.max(0, this.foldT - dt);
    this.foldCd = Math.max(0, this.foldCd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.slow = Math.max(0, this.slow - dt);
    this.reflect = Math.max(0, this.reflect - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.ember = Math.max(0, this.ember - dt);
    this.animT += dt;
    const slashLen = this.beast ? 0.44 : 0.34;
    if (this.anim === "slash" && this.animT > slashLen) this.beginAnim("idle");
    if (this.anim === "parry" && this.animT > 0.4) this.beginAnim("idle");
    if (this.anim === "special" && this.animT > 0.5) this.beginAnim("idle");
    if (this.anim === "fold" && this.animT > 0.45) this.beginAnim("idle");
    if (this.anim === "hurt" && this.animT > 0.28) this.beginAnim("idle");
    const speed = Math.hypot(this.vx, this.vz);
    this.rig.setAnim(this.anim, this.animT, 1 + speed * 0.08, 1);
    this.rig.setFolding(this.foldT > 0);
    this.place();
  }

  faceToward(tx: number, tz: number) {
    this.yaw = Math.atan2(-(tx - this.x), -(tz - this.z));
  }

  slashActive() {
    if (this.anim !== "slash") return false;
    if (this.beast) {
      if (this.slashHits < 1 && this.animT > 0.09 && this.animT < 0.18) return true;
      if (this.slashHits < 2 && this.animT > 0.24 && this.animT < 0.36) return true;
      return false;
    }
    return this.animT > 0.1 && this.animT < 0.26 && !this.hitLanded;
  }

  parrying() {
    return this.parryT > 0 && this.anim === "parry";
  }

  folding() {
    return this.foldT > 0;
  }

  takeHit(amount: number, from: Fighter, foldingHit: boolean): "hit" | "parry" | "immune" | "dead" {
    if (this.dead || this.iFrames > 0) return "immune";
    if (this.parrying()) return "parry";
    if (this.unbeatable && !foldingHit) return "immune";
    if (this.reflect > 0) {
      from.takeHit(amount * 0.7, this, this.folding());
      this.reflect = 0;
      this.hp = Math.min(this.maxHp, this.hp + 12);
      return "parry";
    }
    const dmg = Math.max(2, amount - this.defn * 0.35);
    this.hp -= dmg;
    this.hurtT = 0.25;
    this.iFrames = 0.18;
    this.beginAnim("hurt");
    this.rig.flash(0.8);
    const f = from.forward();
    this.vx += f.x * 3.5;
    this.vz += f.z * 3.5;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.beginAnim("die");
      return "dead";
    }
    return "hit";
  }

  powerKind(): PowerKind {
    return this.def.power.kind;
  }

  snap() {
    return {
      id: this.id,
      charId: this.def.id as CharId,
      hp: this.hp,
      maxHp: this.maxHp,
      x: this.x,
      z: this.z,
      yaw: this.yaw,
      folding: this.folding(),
      team: this.team,
      dead: this.dead,
    };
  }

  dispose() {
    this.rig.dispose();
  }
}
