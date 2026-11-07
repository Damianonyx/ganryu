import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { buildRig, type Rig } from "@/game/mesh";
import { setFighterEnvironment } from "@/game/rig-kit";
import { getChar } from "@/game/roster";
import type { AnimName, CharacterDef } from "@/game/types";

/**
 * The 3D film lab: stages the opening film's shots with the game's own
 * fighters, in sets built in code, and renders them offline frame by frame
 * (deterministic: everything advances only through `step`).
 */

// ── Deterministic randomness ──────────────────────────────────────────────

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Textures made in code ─────────────────────────────────────────────────

function radial(stops: [number, string][], size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let flameTex: THREE.Texture | null = null;
let smokeTex: THREE.Texture | null = null;
let glowTex: THREE.Texture | null = null;
const tex = {
  flame: () =>
    (flameTex ??= radial([
      [0, "rgba(255,250,220,1)"],
      [0.25, "rgba(255,190,90,0.9)"],
      [0.55, "rgba(230,80,20,0.45)"],
      [1, "rgba(120,20,0,0)"],
    ])),
  smoke: () =>
    (smokeTex ??= radial([
      [0, "rgba(60,52,50,0.55)"],
      [0.6, "rgba(40,34,34,0.25)"],
      [1, "rgba(20,18,18,0)"],
    ])),
  glow: () =>
    (glowTex ??= radial([
      [0, "rgba(255,255,255,1)"],
      [0.35, "rgba(255,255,255,0.35)"],
      [1, "rgba(255,255,255,0)"],
    ])),
};

// ── Fire, embers, smoke ───────────────────────────────────────────────────

type Particle = { s: THREE.Sprite; life: number; max: number; vx: number; vy: number; vz: number; size: number };

/** A fire: flame sprites rising and fading, embers, smoke, and a flickering light. */
export class Fire {
  readonly group = new THREE.Group();
  readonly light: THREE.PointLight;
  private flames: Particle[] = [];
  private embers: Particle[] = [];
  private smoke: Particle[] = [];
  private r: () => number;
  private acc = 0;
  private t = 0;
  constructor(
    private at: THREE.Vector3,
    private o: { size: number; rate: number; light?: number; smoke?: number; embers?: number; spread?: number; seed?: number },
  ) {
    this.r = rng(o.seed ?? 7);
    this.light = new THREE.PointLight(0xff8a3a, o.light ?? 3, 9 * o.size + 4, 1.6);
    this.light.position.copy(at).add(new THREE.Vector3(0, 0.6 * o.size, 0));
    this.group.add(this.light);
    const mk = (map: THREE.Texture, blending: THREE.Blending, color: number) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, blending, color, transparent: true, depthWrite: false, fog: true }));
      s.visible = false;
      this.group.add(s);
      return s;
    };
    for (let i = 0; i < Math.round(40 * o.rate); i++) this.flames.push({ s: mk(tex.flame(), THREE.AdditiveBlending, 0xffffff), life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 });
    for (let i = 0; i < (o.embers ?? 24); i++) this.embers.push({ s: mk(tex.glow(), THREE.AdditiveBlending, 0xffa040), life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 });
    for (let i = 0; i < (o.smoke ?? 10); i++) this.smoke.push({ s: mk(tex.smoke(), THREE.NormalBlending, 0xffffff), life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 });
  }
  move(p: THREE.Vector3) {
    this.at.copy(p);
    this.light.position.copy(p).add(new THREE.Vector3(0, 0.6 * this.o.size, 0));
  }
  private spawn(list: Particle[], f: (p: Particle) => void) {
    const p = list.find((q) => q.life <= 0);
    if (!p) return;
    f(p);
    p.life = p.max;
    p.s.visible = true;
  }
  step(dt: number) {
    const { size, spread = 0.35 } = this.o;
    this.t += dt;
    this.acc += dt * 60 * this.o.rate;
    const r = this.r;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.spawn(this.flames, (p) => {
        p.s.position.set(this.at.x + (r() - 0.5) * spread * size, this.at.y + r() * 0.1, this.at.z + (r() - 0.5) * spread * size);
        p.vx = (r() - 0.5) * 0.3;
        p.vy = (1.1 + r() * 0.9) * size;
        p.vz = (r() - 0.5) * 0.3;
        p.max = 0.45 + r() * 0.35;
        p.size = (0.45 + r() * 0.4) * size;
      });
      if (r() < 0.25) this.spawn(this.embers, (p) => {
        p.s.position.copy(this.at).add(new THREE.Vector3((r() - 0.5) * size * 0.6, size * 0.6, (r() - 0.5) * size * 0.6));
        p.vx = (r() - 0.5) * 1.2;
        p.vy = 1.5 + r() * 2.5;
        p.vz = (r() - 0.5) * 1.2;
        p.max = 1.5 + r() * 2;
        p.size = 0.03 + r() * 0.04;
      });
      if (r() < 0.12) this.spawn(this.smoke, (p) => {
        p.s.position.copy(this.at).add(new THREE.Vector3((r() - 0.5) * size, size * 1.1, (r() - 0.5) * size));
        p.vx = 0.2 + r() * 0.3;
        p.vy = 0.8 + r() * 0.5;
        p.vz = (r() - 0.5) * 0.3;
        p.max = 3 + r() * 2;
        p.size = size * (1.2 + r());
      });
    }
    for (const p of this.flames) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      p.s.scale.setScalar(p.size * (0.4 + k * 0.8));
      (p.s.material as THREE.SpriteMaterial).opacity = Math.min(1, k * 1.6);
      (p.s.material as THREE.SpriteMaterial).color.setRGB(1, 0.55 + k * 0.45, 0.25 + k * 0.6);
      if (p.life <= 0) p.s.visible = false;
    }
    for (const p of this.embers) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      p.vx += Math.sin(this.t * 3 + p.max * 10) * dt * 0.8;
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      p.s.scale.setScalar(p.size * (0.6 + 0.4 * Math.sin(this.t * 20 + p.max * 7)));
      (p.s.material as THREE.SpriteMaterial).opacity = k;
      if (p.life <= 0) p.s.visible = false;
    }
    for (const p of this.smoke) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      p.s.scale.setScalar(p.size * (1.8 - k));
      (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.55;
      if (p.life <= 0) p.s.visible = false;
    }
    const f = 0.75 + 0.25 * Math.sin(this.t * 17) * Math.sin(this.t * 7.3 + 1) + (this.r() - 0.5) * 0.15;
    this.light.intensity = (this.o.light ?? 3) * f;
  }
}

// ── Actors: game fighters driven along scripted paths ─────────────────────

export type Pose = { x: number; z: number; y?: number; yaw?: number; anim?: AnimName };

export class Actor {
  readonly rig: Rig;
  x = 0;
  z = 0;
  y = 0;
  yaw = 0;
  anim: AnimName = "idle";
  animT = 0;
  constructor(
    def: CharacterDef,
    public path: (t: number) => Pose,
  ) {
    this.rig = buildRig(def);
    const p = path(0);
    this.x = p.x;
    this.z = p.z;
    this.yaw = p.yaw ?? 0;
  }
  step(t: number, dt: number) {
    const p = this.path(t);
    const vx = (p.x - this.x) / dt;
    const vz = (p.z - this.z) / dt;
    const moving = Math.hypot(vx, vz) > 0.15;
    const yaw = p.yaw ?? (moving ? Math.atan2(-vx, -vz) : this.yaw);
    let d = yaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, 10 * dt);
    this.x = p.x;
    this.z = p.z;
    this.y = p.y ?? 0;
    const anim = p.anim ?? (moving ? "walk" : "idle");
    if (anim !== this.anim) {
      this.anim = anim;
      this.animT = 0;
    }
    this.animT += dt;
    this.rig.drive?.(dt, vx, vz, this.yaw, this.y, this.x, this.z);
    this.rig.setAnim(this.anim, this.animT, 1, 1);
    this.rig.root.position.set(this.x, this.y, this.z);
    this.rig.root.rotation.y = this.yaw;
  }
}

/** A fighter's sheet with some colors or scale changed (villagers, the rank and file). */
export function variant(id: string, kit: Partial<CharacterDef["kit"]>, name = id): CharacterDef {
  const base = getChar(id as CharacterDef["id"]);
  return { ...base, id: base.id, name, kit: { ...base.kit, ...kit } };
}

// ── Stage ─────────────────────────────────────────────────────────────────

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.42 }, grain: { value: 0.035 }, time: { value: 0 }, lift: { value: new THREE.Vector3(0.012, 0.01, 0.022) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette; uniform float grain; uniform float time; uniform vec3 lift; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5; d.x *= 1.25;
      float v = smoothstep(0.85, 0.2, length(d));
      c.rgb *= mix(1.0 - vignette, 1.0, v);
      c.rgb = c.rgb + lift * (1.0 - c.rgb);           // lifted, cool shadows
      c.rgb += (h(vUv * 1000.0) - 0.5) * grain;        // film grain
      gl_FragColor = c;
    }`,
};

export type ShotCtx = { stage: FilmStage; t: number; dt: number };
export type Shot = {
  id: string;
  title: string;
  dur: number;
  build: (s: FilmStage) => {
    update: (c: ShotCtx) => void;
    /** Shallow depth of field: focus distance from the camera (m), aperture, and blur cap. */
    dof?: { focus: number; aperture: number; maxblur: number };
  };
};

export class FilmStage {
  readonly renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 200);
  composer!: EffectComposer;
  actors: Actor[] = [];
  fires: Fire[] = [];
  private grade!: ShaderPass;
  private env: THREE.Texture;
  private sceneEnv: THREE.Texture | null = null;
  private pmrem: THREE.PMREMGenerator;
  private bokeh: BokehPass | null = null;
  private shot: ReturnType<Shot["build"]> | null = null;
  t = 0;

  constructor(
    canvas: HTMLCanvasElement,
    readonly w: number,
    readonly h: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    setFighterEnvironment(this.env);
  }

  load(shot: Shot) {
    this.scene = new THREE.Scene();
    this.camera.clear(); // shot-specific lens dressing (e.g. the floor gap)
    this.actors = [];
    this.fires = [];
    this.t = 0;
    this.shot = shot.build(this);
    // settle ropes, springs, and fire before the first frame
    for (let i = 0; i < 45; i++) this.advance(1 / 60, true);
    // Reflections come from the shot's own world (night sky, moon, fires), not a white studio.
    // The actors are hidden while it is captured so they do not reflect themselves.
    for (const a of this.actors) a.rig.root.visible = false;
    this.sceneEnv?.dispose();
    this.sceneEnv = this.pmrem.fromScene(this.scene, 0.02, 0.1, 160).texture;
    for (const a of this.actors) a.rig.root.visible = true;
    setFighterEnvironment(this.sceneEnv);
    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(this.w, this.h);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const ao = new GTAOPass(this.scene, this.camera, this.w, this.h);
    ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.2, thickness: 1.2, scale: 1.1, samples: 16 });
    ao.blendIntensity = 0.85;
    this.composer.addPass(ao);
    // bloom only the real light sources (fire, glowing eyes, embers), not shiny highlights
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(this.w, this.h), 0.62, 0.5, 0.86));
    const dof = this.shot.dof;
    this.bokeh = dof ? new BokehPass(this.scene, this.camera, { focus: dof.focus, aperture: dof.aperture, maxblur: dof.maxblur }) : null;
    if (this.bokeh) this.composer.addPass(this.bokeh);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new SMAAPass());
    this.t = 0;
  }

  add<T extends THREE.Object3D>(o: T, ...more: THREE.Object3D[]) {
    this.scene.add(o, ...more);
    return o;
  }
  actor(def: CharacterDef, path: (t: number) => Pose) {
    const a = new Actor(def, path);
    this.scene.add(a.rig.root);
    this.actors.push(a);
    return a;
  }
  fire(at: THREE.Vector3, o: ConstructorParameters<typeof Fire>[1]) {
    const f = new Fire(at.clone(), o);
    this.scene.add(f.group);
    this.fires.push(f);
    return f;
  }

  private advance(dt: number, warm = false) {
    const t = warm ? 0 : this.t;
    for (const a of this.actors) a.step(t, dt);
    for (const f of this.fires) f.step(dt);
    this.shot?.update({ stage: this, t, dt });
  }

  /** Advance the shot by dt and render one frame. */
  step(dt: number) {
    this.t += dt;
    this.advance(dt);
    this.grade.uniforms.time.value = this.t;
    this.composer.render();
  }
}
