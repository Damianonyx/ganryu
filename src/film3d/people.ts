import * as THREE from "three";
import type { Rig } from "@/game/mesh";
import { motion } from "@/game/motion";
import { HUMAN, R, SAMURAI, buildHumanoid, type Body, type Extras, type Proportions, type Temper } from "@/game/rig-humanoid";
import { G, Spring, fixed, joint, part, withBlend } from "@/game/rig-kit";
import { addKatana } from "@/game/rig-samurai";
import { getChar } from "@/game/roster";
import type { AnimName } from "@/game/types";

/**
 * The people of the village, who exist only in the film: Kairo as a boy, his
 * father and mother, and the villagers. They stand on the same body as the
 * fighters (rig-humanoid.ts) in plain clothes: kimono, hakama, obi, straw sandals.
 */

export type Look = {
  skin: string;
  hair: string;
  kimono: string;
  /** the white under-collar */
  collar: string;
  obi: string;
  /** a pleated hakama over the legs; without one the kimono falls to the knee (men) or ankle (long) */
  hakama?: string;
  long?: boolean;
  sleeves: "wide" | "tied";
  style: "topknot" | "boy" | "bun" | "band" | "scarf";
  /** the head is larger in proportion on a child */
  headScale?: number;
  /** soot and ash on cloth and skin after the fire, 0–1 */
  soot?: number;
  scale: number;
  temper?: Partial<Temper>;
  prop?: Partial<Proportions>;
  /** bare feet (training in the snow) instead of straw sandals */
  barefoot?: boolean;
  /** what the hand can hold (each hidden until shown) */
  props?: ("bokken" | "katana" | "charm")[];
};

/** Face controls for close-ups: brows (rotate/raise), and the mouth's three shapes. */
export type Face = { brows: THREE.Mesh[]; smile: THREE.Mesh; flat: THREE.Mesh; open: THREE.Mesh; mood: (m: "smile" | "flat" | "open", brow?: number) => void };

export type Person = Rig & { props: Record<string, THREE.Object3D>; body2: Body; face: Face };

/** A pleated cloth tube hanging down from its top (y = 0) to y = -len, flaring from r0 to r1. */
const pleatCache = new Map<string, THREE.BufferGeometry>();
function pleated(len: number, r0: number, r1: number, pleats = 7) {
  const key = `${len},${r0},${r1},${pleats}`;
  let g = pleatCache.get(key);
  if (g) return g;
  const seg = 28;
  const rows = 6;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const r = r0 + (r1 - r0) * Math.sqrt(v);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const pr = r * (1 + Math.abs(Math.sin(a * pleats * 0.5)) * 0.08 * v);
      pos.push(Math.sin(a) * pr, -v * len, Math.cos(a) * pr);
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  pleatCache.set(key, g);
  return g;
}

const dirty = (c: string, soot = 0) => new THREE.Color(c).lerp(new THREE.Color("#141210"), soot * 0.55).getStyle();

export function buildPerson(look: Look): Person {
  const base = getChar("akari");
  const def = { ...base, kit: { ...base.kit, scale: look.scale, body: "human" as const } };
  let body2!: Body;
  const props: Record<string, THREE.Object3D> = {};
  const face = {} as Face;
  const rig = buildHumanoid(def, {
    prop: { ...HUMAN, ...look.prop },
    temper: { ...SAMURAI, ...look.temper },
    stance: "sword",
    dress: (b) => {
      body2 = b;
      return dress(b, look, props, face);
    },
  });
  const both = (n: AnimName) => n === "idle" || n === "walk";
  rig.setAnim = withBlend(rig.body, rig.setAnim, () => motion.pose, (a, b) => both(a) && both(b));
  for (const p of Object.values(props)) p.visible = false;
  face.mood("flat", 0);
  return Object.assign(rig, { props, body2, face });
}

function dress(b: Body, o: Look, props: Record<string, THREE.Object3D>, face: Face): Extras {
  const { M, prop: P, pelvis, skirt, spine, chest, neck, head, legs, arms } = b;
  const soot = o.soot ?? 0;
  const skin = M.skin(dirty(o.skin, soot * 0.6));
  const kimono = M.cloth(dirty(o.kimono, soot));
  const kimonoDark = M.cloth(dirty(new THREE.Color(o.kimono).lerp(new THREE.Color("#000"), 0.3).getStyle(), soot));
  const collar = M.cloth(dirty(o.collar, soot));
  const obi = M.cloth(dirty(o.obi, soot));
  const hair = M.flesh(o.hair, 0.5);
  const straw = M.cloth("#8a7650");
  const hakama = o.hakama ? M.cloth(dirty(o.hakama, soot)) : null;

  // ── Torso: kimono, crossed collar (left over right), obi ──────────────────
  part(spine, G.sphere(1, 14, 10), kimono, [0, 0.11, 0.0], [0, 0, 0], [0.14, 0.17, 0.105]);
  part(chest, G.sphere(1, 16, 12), kimono, [0, 0.0, 0], [0, 0, 0], [0.18, 0.18, 0.12]);
  part(chest, G.sphere(1, 16, 10), kimono, [0, 0.1, -0.005], [0, 0, 0], [0.285, 0.085, 0.118]); // the shoulder line, sloping over the arms
  // the lapels cross in a V; the white collar shows inside it
  for (const s of [-1, 1]) {
    part(chest, G.rbox(0.03, 0.27, 0.014, 0.4), collar, [0.03 * s, 0.03, 0.112], [0.18, 0, 0.42 * s]);
    part(chest, G.rbox(0.05, 0.3, 0.016, 0.4), kimonoDark, [0.055 * s, 0.0, 0.108], [0.16, 0, 0.42 * s]);
  }
  const obiH = o.long ? 0.15 : 0.085;
  part(spine, G.cyl(0.152, 0.148, obiH, 20), obi, [0, 0.0, 0], [0, 0, 0], [1, 1, 0.78]);
  if (o.long) part(spine, G.rbox(0.2, 0.12, 0.08, 0.4), obi, [0, 0.01, -0.14]); // the bow at the back
  else part(spine, G.rbox(0.05, 0.05, 0.03, 0.4), obi, [R * 0.06, 0, 0.12]); // the knot

  // ── Legs: hakama, a kimono skirt, bare shins, straw sandals ──────────────
  for (const leg of legs) {
    if (hakama) {
      // wide pleated legs: a tube from the hip that flares to the knee, and on to the ankle
      part(leg.hip, pleated(P.thigh + 0.06, 0.105, 0.145), hakama, [0, 0.03, 0]);
      part(leg.knee, G.sphere(1, 12, 10), hakama, [0, 0, 0], [0, 0, 0], [0.142, 0.1, 0.142]);
      part(leg.knee, pleated(P.shin * 0.86, 0.142, 0.172), hakama, [0, 0, 0]);
    } else {
      part(leg.hip, G.limb(P.thigh, 0.075, 0.055), skin);
    }
    part(leg.knee, G.limb(P.shin, 0.052, 0.036, 0.3), skin);
    part(leg.ankle, G.rbox(0.08, 0.05, 0.2, 0.4), skin, [0, -0.035, 0.045]);
    if (o.barefoot) {
      part(leg.ankle, G.rbox(0.085, 0.03, 0.12, 0.5), skin, [0, -0.05, 0.1]); // the ball of the foot and toes
      for (let i = 0; i < 4; i++) part(leg.ankle, G.sphere(0.012, 8, 6), skin, [(i - 1.5) * 0.018 * -leg.side * R, -0.055, 0.165 - Math.abs(i - 1) * 0.008]);
    } else {
      part(leg.ankle, G.rbox(0.09, 0.018, 0.23, 0.3), straw, [0, -0.062, 0.045]); // waraji
      part(leg.ankle, G.rbox(0.07, 0.012, 0.012), M.cloth("#e8e0cc"), [0, -0.025, 0.08], [0, 0, 0]);
    }
  }
  if (hakama) {
    part(pelvis, G.cyl(0.17, 0.2, 0.2, 18), hakama, [0, -0.06, 0], [0, 0, 0], [1, 1, 0.8]);
    part(pelvis, G.rbox(0.2, 0.24, 0.03, 0.3), hakama, [0, -0.1, 0.16], [0.08, 0, 0]); // front panel
  } else {
    const h = o.long ? 0.86 : 0.5;
    const sk = fixed(skirt, [0, 0, 0]);
    part(sk, G.skirt(0.165, o.long ? 0.24 : 0.25, h, 10, 0.01), kimono, [0, -h / 2, 0]);
    part(sk, G.rbox(0.02, h * 0.96, 0.012), kimonoDark, [R * -0.07, -h / 2, o.long ? 0.205 : 0.215], [o.long ? -0.06 : -0.08, 0, 0]); // the overlap seam
  }

  // ── Arms: sleeves (wide, or tied back with a cord), bare forearms, hands ──
  const tamoto: THREE.Group[] = [];
  for (const a of arms) {
    part(a.shoulder, G.sphere(0.064), kimono);
    part(a.shoulder, G.cyl(0.072, o.sleeves === "wide" ? 0.09 : 0.068, 0.27, 12), kimono, [0, -0.13, 0]);
    if (o.sleeves === "wide") {
      const t = joint(a.shoulder, [0, -0.12, 0]);
      part(t, G.rbox(0.045, o.long ? 0.36 : 0.28, 0.2, 0.35), kimono, [0, -0.12, -0.02]);
      tamoto.push(t);
      part(a.elbow, G.cyl(0.085, 0.1, 0.12, 12), kimono, [0, -0.04, 0]);
    } else {
      // sleeves tied back: a cord bunches the cloth above the elbow
      part(a.shoulder, G.cyl(0.074, 0.074, 0.025, 12), M.cloth("#cfc6b0"), [0, -0.235, 0]);
    }
    part(a.elbow, G.limb(P.foreArm, 0.043, 0.032, 0.3), skin);
    part(a.wrist, G.rbox(0.058, 0.075, 0.07, 0.45), skin, [0, -0.04, 0.008]);
    part(a.wrist, G.capsule(0.014, 0.03), skin, [0.03 * -a.side * R, -0.03, 0.03], [0.6, 0, 0.4 * a.side]); // thumb
  }

  // ── Head: a face, ears, and the hair ─────────────────────────────────────
  part(neck, G.cyl(0.045, 0.05, 0.1), skin, [0, 0.02, 0]);
  const hs = o.headScale ?? 1;
  const H = fixed(head, [0, 0, 0]);
  H.scale.setScalar(hs);
  const child = hs > 1.1;
  part(H, G.sphere(1, 18, 14), skin, [0, 0.11, 0.005], [0, 0, 0], child ? [0.11, 0.118, 0.112] : [0.106, 0.122, 0.114]);
  part(H, G.sphere(1, 12, 10), skin, [0, 0.05, 0.05], [0, 0, 0], child ? [0.07, 0.045, 0.06] : [0.07, 0.055, 0.065]); // jaw and chin
  for (const s of [-1, 1]) part(H, G.sphere(1, 8, 6), skin, [0.105 * s, 0.105, 0.0], [0, 0, 0], [0.018, 0.032, 0.024]); // ears
  // nose: a soft bridge, a rounded tip, and nostril wings
  part(H, G.sphere(1, 10, 8), skin, [0, 0.112, 0.112], [-0.3, 0, 0], [0.0095, 0.026, 0.012]);
  part(H, G.sphere(1, 10, 8), skin, [0, 0.093, 0.124], [0, 0, 0], [0.0125, 0.011, 0.012]);
  for (const s of [-1, 1]) part(H, G.sphere(1, 8, 6), skin, [0.0105 * s, 0.09, 0.117], [0, 0, 0], [0.007, 0.0065, 0.008]);
  // cheeks, a little flushed
  const blush = M.skin(new THREE.Color(o.skin).lerp(new THREE.Color("#c86a5a"), 0.07).getStyle());
  for (const s of [-1, 1]) part(H, G.sphere(1, 10, 8), blush, [0.05 * s, 0.092, 0.08], [0, 0, 0], [0.032, 0.026, 0.024]);
  const eye = M.lacquer("#0a0808");
  const white = M.cloth("#e8e2d6");
  for (const s of [-1, 1]) {
    part(H, G.sphere(1, 12, 10), white, [0.039 * s, 0.128, 0.102], [0, 0, 0], [0.019, 0.0115, 0.009]);
    part(H, G.sphere(1, 12, 10), M.lacquer("#3a2416"), [0.038 * s, 0.1275, 0.1075], [0, 0, 0], [0.0098, 0.0098, 0.0052]); // iris
    part(H, G.sphere(1, 10, 8), eye, [0.038 * s, 0.1275, 0.1105], [0, 0, 0], [0.0052, 0.0052, 0.003]); // pupil
    part(H, G.sphere(0.0018, 6, 4), white, [0.038 * s + 0.0035, 0.131, 0.1128]); // the light in the eye
    part(H, G.rbox(0.04, 0.006, 0.01, 0.5), M.flesh("#1a1210", 0.6), [0.039 * s, 0.1385, 0.1065], [0.25, 0, -0.06 * s]); // upper lid and lashes
  }
  // brows and mouth stay separate meshes so a close-up can change the expression
  face.brows = [-1, 1].map((s) => {
    const m = part(H, G.rbox(0.038, 0.009, 0.01, 0.4), hair, [0.04 * s, 0.152, 0.108], [0, 0, 0]);
    m.userData.keep = true;
    m.userData.side = s;
    return m;
  });
  const lip = M.skin(new THREE.Color(o.skin).lerp(new THREE.Color("#6a2a24"), 0.4).getStyle());
  face.flat = part(H, G.rbox(0.034, 0.006, 0.008, 0.4), lip, [0, 0.064, 0.113]);
  face.smile = part(H, G.torusArc(0.022, 0.0035, 2.0), lip, [0, 0.078, 0.111], [0, 0, Math.PI + (Math.PI - 2.0) / 2 + 1.0 - 1.0]);
  face.open = part(H, G.sphere(1, 10, 8), M.flesh("#3a1414", 0.7), [0, 0.06, 0.108], [0, 0, 0], [0.016, 0.013, 0.008]);
  for (const m of [face.flat, face.smile, face.open]) m.userData.keep = true;
  const browY = face.brows[0].position.y;
  /** brow: -1 worried (inner ends up), 0 calm, 1 stern (inner ends down) */
  face.mood = (m, brow = 0) => {
    face.flat.visible = m === "flat";
    face.smile.visible = m === "smile";
    face.open.visible = m === "open";
    for (const b2 of face.brows) {
      const sd = b2.userData.side as number;
      b2.rotation.z = (child ? 0.05 : 0.12) * -sd + brow * 0.32 * sd;
      b2.position.y = browY + (brow < 0 ? -brow * 0.008 : -brow * 0.004);
    }
  };

  // hair over the back of the head, below the crown
  if (o.style !== "scarf") part(H, G.sphere(1, 14, 10), hair, [0, 0.1, -0.035], [0, 0, 0], [0.112, 0.1, 0.098]);
  if (o.style === "topknot" || o.style === "band") {
    part(H, G.dome(0.121, 0.86), hair, [0, 0.135, -0.014]);
    part(H, G.rbox(0.2, 0.04, 0.05, 0.5), hair, [0, 0.19, 0.075], [0.5, 0, 0]); // hairline
    part(H, G.capsule(0.019, 0.075), hair, [0, 0.262, -0.01], [Math.PI / 2 - 0.35, 0, 0]); // the topknot laid forward
    part(H, G.cyl(0.024, 0.024, 0.02, 10), M.cloth("#e8e0cc"), [0, 0.252, -0.05], [Math.PI / 2 - 0.35, 0, 0]);
    if (o.style === "band") part(H, G.torusArc(0.123, 0.014, Math.PI * 2), M.cloth("#d8d0bc"), [0, 0.165, 0.0], [Math.PI / 2 + 0.12, 0, 0]);
  } else if (o.style === "boy") {
    part(H, G.dome(0.122, 0.92), hair, [0, 0.13, -0.01]);
    part(H, G.rbox(0.17, 0.05, 0.05, 0.6), hair, [0, 0.185, 0.085], [0.6, 0, 0]); // fringe
    part(H, G.sphere(0.04, 10, 8), hair, [0, 0.245, -0.05]); // the small knot of a child's tied hair
    part(H, G.cyl(0.03, 0.03, 0.016, 10), M.cord("#a82a24", 0.1), [0, 0.225, -0.05]);
  } else if (o.style === "bun") {
    part(H, G.dome(0.124, 0.9), hair, [0, 0.13, -0.012]);
    part(H, G.rbox(0.2, 0.05, 0.05, 0.6), hair, [0, 0.188, 0.078], [0.55, 0, 0]);
    for (const s of [-1, 1]) part(H, G.sphere(1, 12, 10), hair, [0.1 * s, 0.13, -0.02], [0, 0, 0], [0.04, 0.07, 0.07]); // side wings
    part(H, G.sphere(1, 14, 12), hair, [0, 0.235, -0.085], [0.4, 0, 0], [0.075, 0.06, 0.06]); // the bun
    part(H, G.rbox(0.2, 0.012, 0.012, 0.4), M.lacquer("#8a1a1a"), [0, 0.24, -0.08], [0, 0, 0.15]); // kanzashi
  } else if (o.style === "scarf") {
    part(H, G.dome(0.13, 0.95), M.cloth(dirty("#5a6a7a", soot)), [0, 0.125, -0.01]);
    part(H, G.rbox(0.1, 0.12, 0.03, 0.4), M.cloth(dirty("#5a6a7a", soot)), [0, 0.06, -0.12], [-0.3, 0, 0]);
  }

  // ── What the hand can hold ───────────────────────────────────────────────
  const wood = M.lacquer("#7a5a3a");
  if (o.props?.includes("bokken")) {
    const g = joint(b.weapon);
    const s = fixed(g);
    s.rotation.x = Math.PI / 2; // along the hand's +Z, as the swords are
    part(s, G.cyl(0.016, 0.018, 0.24, 10), wood, [0, 0.02, 0]);
    part(s, G.cyl(0.03, 0.03, 0.01, 12), M.lacquer("#2a1e14"), [0, 0.14, 0]);
    part(s, G.blade(0.62, 0.03, 0.035), wood, [0, 0.15, 0]);
    props.bokken = g;
  }
  if (o.props?.includes("katana")) {
    const g = joint(b.weapon);
    const holder = { ...b, weapon: g, pelvis: fixed(b.pelvis) } as Body;
    addKatana(holder, { blade: M.metal("#d8dce4", 0.12), wrap: M.cloth("#1a1418"), tsuba: M.metal("#2a2a2e", 0.4), fittings: M.metal("#8a6a3a", 0.3), scabbards: 0 });
    props.katana = g;
  }
  if (o.props?.includes("charm")) {
    // the wooden charm on its red cord
    const g = joint(b.arms[1].hand, [0, 0.0, 0.02]);
    part(g, G.rbox(0.035, 0.05, 0.012, 0.4), M.lacquer("#9a7448"), [0, -0.01, 0]);
    part(g, G.torusArc(0.02, 0.003, Math.PI * 2), M.cord("#b0201c", 0.15), [0, 0.03, 0]);
    props.charm = g;
  }

  // ── Secondary motion: sleeves hang, the skirt follows the thighs ──────────
  const sway = new Spring(40, 7);
  const sleeveS = tamoto.map(() => new Spring(30, 5));
  return {
    update: (c) => {
      const thighs = (legs[0].hip.rotation.x + legs[1].hip.rotation.x) / 2;
      skirt.rotation.x = sway.step(Math.min(0, thighs) * (o.long ? 0.55 : 0.75) + c.jolt * -0.1, c.dt);
      tamoto.forEach((t, i) => {
        const sh = arms[i].shoulder.rotation;
        // keep the sleeve pouch hanging under the arm, with a little lag
        t.rotation.x = sleeveS[i].step(-sh.x * 0.85 + c.drag * 0.25, c.dt);
        t.rotation.z = -sh.z * 0.8;
      });
    },
  };
}

// ── The cast ────────────────────────────────────────────────────────────────

const SKIN = "#d2a882";

export const PEOPLE = {
  /** Kairo at seven: a short kimono over hakama, sleeves tied back for practice */
  boy: (soot = 0): Look => ({
    skin: "#dcb08a",
    hair: "#141010",
    kimono: "#3a4a62",
    collar: "#e8e0cc",
    obi: "#7a2a22",
    hakama: "#4a4038",
    sleeves: "tied",
    style: "boy",
    headScale: 1.32,
    scale: 0.64,
    soot,
    temper: { bob: 1.3, lift: 1.2 },
    props: ["bokken", "charm"],
  }),
  /** Kairo at about fifteen, training alone */
  youth: (season: "rain" | "autumn" | "snow" | "summer" | "spring"): Look => ({
    skin: SKIN,
    hair: "#141010",
    kimono: season === "snow" ? "#3a3a44" : season === "spring" ? "#2e3442" : "#3a4a62",
    collar: "#d8d0bc",
    obi: "#5a2a22",
    hakama: "#3a342e",
    sleeves: "tied",
    style: season === "spring" ? "topknot" : "boy",
    headScale: season === "spring" ? 1.02 : 1.12,
    scale: season === "spring" ? 0.97 : season === "summer" ? 0.88 : 0.82,
    barefoot: season === "snow",
    props: ["bokken", "charm"],
  }),
  father: (): Look => ({
    skin: "#c89a72",
    hair: "#1a1410",
    kimono: "#2e3442",
    collar: "#ddd4c0",
    obi: "#3a2a1e",
    hakama: "#5a5046",
    sleeves: "tied",
    style: "topknot",
    scale: 1.02,
    props: ["katana"],
  }),
  mother: (): Look => ({
    skin: "#e0b898",
    hair: "#100c0c",
    kimono: "#5a3a4a",
    collar: "#efe6d4",
    obi: "#a8742a",
    long: true,
    sleeves: "wide",
    style: "bun",
    scale: 0.95,
    temper: { stride: 0.8, lift: 0.7 },
    props: ["charm"],
  }),
  villager: (i: number): Look => {
    const k = ["#5a4a3a", "#3e4a46", "#6a5a44", "#4a3e48"][i % 4];
    const woman = i % 2 === 1;
    return {
      skin: ["#c89a72", "#d8ae8a", "#b88a64"][i % 3],
      hair: "#141010",
      kimono: k,
      collar: "#cfc6b0",
      obi: ["#3a2a1e", "#6a3a2a", "#2a3038"][i % 3],
      long: woman,
      sleeves: woman ? "wide" : "tied",
      style: woman ? (i % 4 === 1 ? "bun" : "scarf") : i % 3 === 0 ? "band" : "topknot",
      scale: woman ? 0.94 : 0.99,
    };
  },
};
