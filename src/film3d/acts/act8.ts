import * as THREE from "three";
import { END_CARD } from "@/cinematic/script";
import { getChar } from "@/game/roster";
import { camera, face, keys } from "../direct";
import { charm } from "../hands";
import { rng, type Actor, type FilmStage, type Pose, type Shot } from "../lab";
import { V, fbm, lerp, noise2, ridges, sky, soft, span, std } from "../sets";

/**
 * Act 8, the hunt begins (70–76 s):
 *   8a  the man secures the wooden charm beneath his armor
 *   8b  across the valley the enemy fortress rises above the clouds; he draws his blade
 *   8c  black
 *   8d  the tagline
 *   8e  the title
 */

/** The joint at the end of an arm (shoulder → elbow → wrist → hand). */
function handOf(shoulder: THREE.Object3D) {
  let g: THREE.Object3D = shoulder;
  for (let i = 0; i < 3; i++) g = g.children.find((c) => c.type === "Group") ?? g;
  return g;
}

/** A sea of cloud below the cliffs: a wide plane shaded with drifting noise, lit by the low sun. */
function cloudSea(s: FilmStage, y: number, color: string, lit: string, dir: THREE.Vector3) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { t: { value: 0 }, c: { value: new THREE.Color(color) }, l: { value: new THREE.Color(lit) }, d: { value: dir.clone().normalize() } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform float t; uniform vec3 c; uniform vec3 l; uniform vec3 d; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fb(vec2 p){ float a = 0.0; float s = 0.5; for (int i = 0; i < 6; i++){ a += vn(p) * s; p *= 2.03; s *= 0.5; } return a; }
      void main(){
        vec2 p = vW.xz * 0.035 + vec2(t * 0.02, t * 0.01);
        float h = fb(p);
        float h2 = fb(p + vec2(0.04, 0.03));
        float shade = clamp(0.5 + (h - h2) * 6.0, 0.0, 1.0);
        float dist = length(vW.xz);
        float a = smoothstep(0.32, 0.6, h) * (1.0 - smoothstep(150.0, 260.0, dist));
        vec2 dd = normalize(d.xz);
        float sun = pow(max(dot(normalize(vW.xz), dd), 0.0), 3.0);
        vec3 col = mix(c, l, shade * 0.6 + sun * 0.5);
        gl_FragColor = vec4(col, a * 0.95);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  s.add(m);
  // a second, higher, thinner layer for depth
  const m2 = m.clone();
  m2.material = mat.clone();
  (m2.material as THREE.ShaderMaterial).uniforms.t = mat.uniforms.t;
  m2.position.y = y + 3;
  m2.scale.setScalar(0.9);
  s.add(m2);
  s.ticks.push(({ dt }) => (mat.uniforms.t.value += dt));
}

/** A rocky crag: a lumpy, tall cone. */
function crag(s: FilmStage, at: THREE.Vector3, r: number, h: number, seed: number, color = "#2a2626") {
  const g = new THREE.ConeGeometry(r, h, 24, 16);
  const n = noise2(seed);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const k = 1 + (fbm(n, a * 2 + 5, v.y * 0.25, 4) - 0.5) * 0.7;
    v.x *= k;
    v.z *= k;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, std(color, 0.95));
  m.position.copy(at).add(V(0, h / 2, 0));
  m.castShadow = m.receiveShadow = true;
  s.add(m);
  return m;
}

/** The enemy's fortress: a keep of stacked tiers with flared roofs on battered stone walls, lit red from within. */
function fortress(s: FilmStage, at: THREE.Vector3, k = 1) {
  const g = new THREE.Group();
  g.position.copy(at);
  g.scale.setScalar(k);
  s.add(g);
  const stone = std("#2a2624", 0.95);
  const wall = std("#1a1616", 0.9);
  const roof = std("#0e0c0e", 0.7, 0.2);
  const glow = new THREE.MeshBasicMaterial({ color: 0xff3a1a });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, p: THREE.Vector3, ry = 0) => {
    const x = new THREE.Mesh(geo, m);
    x.position.copy(p);
    x.rotation.y = ry;
    x.castShadow = x.receiveShadow = true;
    g.add(x);
    return x;
  };
  // battered stone base
  add(new THREE.CylinderGeometry(7, 9.5, 6, 4, 1), stone, V(0, 3, 0), Math.PI / 4);
  // tiers of the keep, each with a flared hipped roof and a row of lit windows
  let y = 6;
  const tiers = [8, 6.6, 5.2, 3.8, 2.6];
  tiers.forEach((w, i) => {
    const h = i === 0 ? 3.2 : 2.4;
    add(new THREE.BoxGeometry(w, h, w * 0.85), wall, V(0, y + h / 2, 0));
    for (let j = 0; j < Math.max(2, Math.round(w / 1.6)); j++) {
      const wx = -w / 2 + (j + 0.5) * (w / Math.max(2, Math.round(w / 1.6)));
      add(new THREE.PlaneGeometry(0.5, 0.6), glow, V(wx, y + h * 0.55, (w * 0.85) / 2 + 0.01));
    }
    const rf = new THREE.ConeGeometry(w * 0.95, 1.6, 4, 1, true);
    add(rf, roof, V(0, y + h + 0.55, 0), Math.PI / 4).scale.set(1, 1, 0.88);
    // the upturned eaves
    for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.25, 0.9, 5), roof, V((sx * w * 0.66) / 1, y + h, 0)).rotation.z = sx * 1.2;
    y += h + 0.9;
  });
  // the crowning roof and its golden fish
  add(new THREE.ConeGeometry(2.0, 2.4, 4), roof, V(0, y + 0.8, 0), Math.PI / 4);
  for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.18, 0.7, 6), std("#8a6a2a", 0.4, 0.8), V(sx * 0.9, y + 1.9, 0)).rotation.z = sx * 0.5;
  // side turrets on the walls
  for (const [x, z] of [
    [-8.5, 3],
    [8.5, 2],
    [-6, -6],
  ]) {
    add(new THREE.BoxGeometry(2.4, 2.2, 2.2), wall, V(x, 7.1, z));
    add(new THREE.ConeGeometry(2.2, 1.4, 4), roof, V(x, 8.9, z), Math.PI / 4);
    add(new THREE.PlaneGeometry(0.5, 0.5), glow, V(x, 7.3, z + 1.11));
  }
  // the red glow it casts into the cloud and smoke around it
  const l = new THREE.PointLight(0xff3a1a, 400, 70, 1.6);
  l.position.set(0, 12, 6);
  g.add(l);
  return g;
}

/** A card of text in front of the camera, crisp (not tone-mapped). */
function card(s: FilmStage, w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthTest: false, fog: false });
  // fill the frame at distance 1
  const fov = (s.camera.fov * Math.PI) / 180;
  const hh = 2 * Math.tan(fov / 2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(hh * (w / h), hh), mat);
  m.position.z = -1;
  m.renderOrder = 10;
  s.camera.add(m);
  s.add(s.camera);
  return { mesh: m, mat };
}

const SERIF = '"Cormorant Garamond", "Noto Serif JP", "Liberation Serif", "DejaVu Serif", serif';
const JP = '"Noto Serif JP", "IPAPMincho", "IPAMincho", "IPAGothic", "WenQuanYi Zen Hei", serif';

/** The cliff above the clouds at dusk, the fortress across the valley. Used by 8a and 8b. */
function cliff(s: FilmStage) {
  s.scene.fog = new THREE.FogExp2(0x3a2230, 0.0045);
  s.scene.background = new THREE.Color(0x3a2230);
  const dir = V(-0.15, 0, -1);
  sky(s, "#120c1e", "#b84a32", "#ff7a3a", dir, { clouds: "#5a2a3a", cloudAmt: 0.55, glowPow: 5 });
  ridges(s, [
    { dist: 140, height: 18, color: "#2a1a26", haze: "#6a2e2e", seed: 5 },
    { dist: 120, height: 10, color: "#1e141c", haze: "#4a2226", seed: 9 },
  ], V(0, -14, 0), dir);
  cloudSea(s, -12, "#3a2a3e", "#e88a5a", dir);
  // his outcrop, and the far crag the fortress stands on
  crag(s, V(0, -40, 0.5), 5, 40.2, 3, "#2a2224");
  crag(s, V(-9, -40, -72), 45, 62, 7, "#1a1418");
  crag(s, V(18, -40, -150), 12, 38, 11, "#1a1418");
  fortress(s, V(-9, 10.2, -72), 1.15);
  s.add(new THREE.HemisphereLight(0x6a5a8a, 0x1a1012, 0.55));
  const sun = new THREE.DirectionalLight(0xff8a50, 2.4);
  sun.position.set(-6, 8, -30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 60 });
  s.add(sun, sun.target);
  const rim = new THREE.SpotLight(0xffa070, 30, 12, 0.5, 0.6, 1.5);
  rim.position.set(-1.5, 2.5, -4);
  rim.target.position.set(0, 1.3, 0);
  s.add(rim, rim.target);
  // embers carried up from below
  const r = rng(8);
  const embers = Array.from({ length: 60 }, () => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: 0xff7a3a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    m.scale.setScalar(0.03 + r() * 0.04);
    m.position.set((r() - 0.5) * 8, -1 + r() * 5, (r() - 0.5) * 8 - 2);
    s.add(m);
    return { m, v: 0.3 + r() * 0.5, ph: r() * 6 };
  });
  s.ticks.push(({ t, dt }) => {
    for (const e of embers) {
      e.m.position.y += e.v * dt;
      e.m.position.x += Math.sin(t + e.ph) * 0.2 * dt;
      if (e.m.position.y > 4) e.m.position.y -= 5;
    }
  });
  s.renderer.toneMappingExposure = 1.15;
}

function kairo(s: FilmStage, path: (t: number) => Pose): Actor {
  const a = s.actor(getChar("kairo"), path);
  return a;
}

export const ACT8: Shot[] = [
  {
    id: "8a",
    title: "He secures the wooden charm beneath his armor",
    dur: 1.3,
    build: (s) => {
      cliff(s);
      const chest = new THREE.Vector3();
      let man: Actor | null = null;
      man = kairo(s, (t): Pose => {
        if (man) man.rig.torso.getWorldPosition(chest);
        const tuck = span(t, 0.6, 1.15);
        const at: [number, number, number] = [chest.x - 0.04, chest.y + lerp(-0.02, 0.06, tuck), chest.z + lerp(0.36, 0.17, tuck)];
        return { x: 0, z: 0, yaw: face(0.25, 1), act: { relax: 1, headPitch: 0.45, reach: man ? { l: at, r: [at[0] - 0.08, at[1] - 0.06, at[2] + 0.02], w: 1 } : undefined } };
      });
      const m = man;
      m.rig.weapon.visible = false;
      const c = charm(2.0);
      const glow = new THREE.PointLight(0xffd0a0, 0.12, 1.0, 1.5);
      s.add(glow);
      s.add(c);
      const hand = handOf(m.rig.lArm);
      return {
        dof: { focus: 0.8, aperture: 0.012, maxblur: 0.008 },
        update: ({ stage, t }) => {
          hand.getWorldPosition(c.position);
          c.position.y += 0.01;
          c.rotation.set(0.2, 0.6 + Math.sin(t * 2) * 0.1, 0.1);
          // slipped under the plate
          c.visible = t < 1.12;
          glow.position.copy(c.position).add(V(-0.1, 0.08, 0.2));
          m.rig.torso.getWorldPosition(chest);
          camera(stage, t, [
            [0, { pos: [chest.x - 0.3, chest.y + 0.1, chest.z + 0.95], look: [chest.x - 0.03, chest.y + 0.02, chest.z + 0.2], fov: 32 }],
            [1.3, { pos: [chest.x - 0.28, chest.y + 0.1, chest.z + 0.88], look: [chest.x - 0.03, chest.y + 0.04, chest.z + 0.15], fov: 31 }],
          ], { hand: 0.003 });
        },
      };
    },
  },
  {
    id: "8b",
    title: "Across the valley the enemy fortress rises above the clouds; he draws his blade",
    dur: 1.7,
    build: (s) => {
      cliff(s);
      const DRAW = 0.9;
      const hip = new THREE.Vector3();
      let man: Actor | null = null;
      man = kairo(s, (t): Pose => {
        const drawn = span(t, DRAW, DRAW + 0.18);
        if (man) {
          man.rig.lLeg.getWorldPosition(hip);
        }
        return {
          x: 0,
          z: 0,
          yaw: face(-0.12, -1),
          act: {
            relax: 1 - drawn,
            headPitch: -0.05,
            // before the draw: right hand on the hilt at the left hip, left hand on the scabbard
            reach: man && drawn < 1 ? { r: [hip.x - 0.05, hip.y + 0.12, hip.z - 0.22], l: [hip.x + 0.02, hip.y + 0.02, hip.z - 0.15], w: 1 - drawn } : undefined,
          },
        };
      });
      const m = man;
      const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
      s.add(glint);
      return {
        update: ({ stage, t }) => {
          m.rig.weapon.visible = t > DRAW + 0.04;
          m.rig.weapon.getWorldPosition(glint.position);
          glint.position.add(V(-0.2, 0.25, -0.35));
          const g = t > DRAW + 0.12 ? Math.exp(-(t - DRAW - 0.12) * 9) : 0;
          glint.scale.setScalar(0.05 + g * 0.6);
          glint.material.opacity = g;
          camera(stage, t, [
            [0, { pos: [1.5, 1.15, 3.0], look: [-3.2, 5.5, -40], fov: 42 }],
            [1.7, { pos: [1.3, 1.2, 2.6], look: [-3.6, 6.0, -40], fov: 40 }],
          ], { hand: 0.008, ease: (u) => u });
        },
      };
    },
  },
  {
    id: "8c",
    title: "Black",
    dur: 0.3,
    build: (s) => {
      s.scene.background = new THREE.Color(0x000000);
      return { update: () => {} };
    },
  },
  {
    id: "8d",
    title: "The tagline",
    dur: 1.5,
    build: (s) => {
      s.scene.background = new THREE.Color(0x000000);
      const { mat, mesh } = card(s, 1920, 1080, (x, w, h) => {
        x.fillStyle = "#e8e2d6";
        x.font = `500 84px ${SERIF}`;
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillText(END_CARD.tagline, w / 2, h / 2);
        x.fillStyle = "rgba(200,40,44,0.85)";
        x.fillRect(w / 2 - 70, h / 2 + 76, 140, 4);
      });
      return {
        update: ({ t }) => {
          mat.opacity = keys(t, [[0, 0], [0.45, 1], [1.2, 1], [1.5, 0]]);
          mesh.scale.setScalar(1 + t * 0.012);
        },
      };
    },
  },
  {
    id: "8e",
    title: "The title",
    dur: 1.2,
    build: (s) => {
      s.scene.background = new THREE.Color(0x000000);
      const { mat, mesh } = card(s, 1920, 1080, (x, w, h) => {
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillStyle = "#f2ece0";
        x.font = `600 200px ${SERIF}`;
        // letter-spaced title
        const letters = [...END_CARD.title];
        const sp = 150;
        letters.forEach((ch, i) => x.fillText(ch, w / 2 + (i - (letters.length - 1) / 2) * sp, h / 2 - 40));
        x.fillStyle = "#b8232b";
        x.fillRect(w / 2 - 330, h / 2 + 90, 660, 6);
        x.fillStyle = "#cfc6b6";
        x.font = `500 64px ${JP}`;
        x.fillText(END_CARD.subtitle, w / 2, h / 2 + 175);
      });
      // embers burst as the title lands (the taiko hit at 0.05 s)
      const r = rng(12);
      const sparks = Array.from({ length: 50 }, () => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: 0xff6a2a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
        sp.scale.setScalar(0.006 + r() * 0.01);
        sp.position.set((r() - 0.5) * 0.9, -0.2 + (r() - 0.5) * 0.2, -0.9);
        s.camera.add(sp);
        return { sp, v: V((r() - 0.5) * 0.2, 0.15 + r() * 0.35, 0) };
      });
      return {
        update: ({ t, dt }) => {
          mat.opacity = keys(t, [[0, 0], [0.12, 1], [1.2, 1]]);
          mesh.scale.setScalar(lerp(1.06, 1.0, Math.min(1, t / 0.3)));
          for (const p of sparks) {
            p.sp.position.addScaledVector(p.v, dt);
            p.sp.material.opacity = Math.max(0, 1 - t / 1.1);
          }
        },
      };
    },
  },
];
