import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Hands for close-up inserts (the charm, the wrapped wrist): a palm with
 * jointed fingers and a thumb, nails, and the end of a sleeve. The hand
 * points along +Y with the palm facing +Z. `side` 1 is a right hand.
 */

export type HandPose = {
  /** curl of thumb, index, middle, ring, little finger: 0 open, 1 a fist */
  curl: [number, number, number, number, number];
  /** fingers spread apart, 0–1 */
  spread?: number;
  /** thumb across the palm (opposition), 0–1 */
  thumbIn?: number;
};

export class Hand {
  readonly group = new THREE.Group();
  readonly palm: THREE.Mesh;
  private fingers: THREE.Group[][] = [];
  private bases: THREE.Group[] = [];
  private thumbBase: THREE.Group;
  /** a point between thumb and index tips, for holding small things */
  readonly grip = new THREE.Group();

  constructor(o: { side: 1 | -1; scale?: number; skin: string; sleeve?: string; cuff?: string }) {
    const k = o.scale ?? 1;
    const S = o.side;
    const skin = new THREE.MeshPhysicalMaterial({ color: o.skin, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color("#ff9a80"), sheenRoughness: 0.6 });
    const nail = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.skin).lerp(new THREE.Color("#ffd0c8"), 0.5), roughness: 0.3 });
    this.group.scale.setScalar(k);
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, p: [number, number, number], sc?: [number, number, number]) => {
      const x = new THREE.Mesh(g, m);
      x.position.set(...p);
      if (sc) x.scale.set(...sc);
      x.castShadow = x.receiveShadow = true;
      parent.add(x);
      return x;
    };
    // palm: a rounded slab, a little thicker at the heel and the thumb's mound
    this.palm = mesh(new RoundedBoxGeometry(0.084, 0.095, 0.03, 4, 0.012), skin, this.group, [0, 0.05, 0]);
    mesh(new THREE.SphereGeometry(1, 14, 10), skin, this.group, [0.024 * S, 0.03, 0.008], [0.022, 0.032, 0.014]); // thenar
    mesh(new THREE.SphereGeometry(1, 12, 8), skin, this.group, [0, 0.004, 0.0], [0.034, 0.018, 0.016]); // heel
    // wrist and sleeve
    mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.08, 14), skin, this.group, [0, -0.035, 0], [1.3, 1, 0.75]);
    if (o.sleeve) {
      const sl = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 18, 1, true), new THREE.MeshStandardMaterial({ color: o.sleeve, roughness: 0.85, side: THREE.DoubleSide }), this.group, [0, -0.13, 0]);
      sl.scale.set(1, 1, 0.85);
      if (o.cuff) mesh(new THREE.TorusGeometry(0.04, 0.005, 6, 18), new THREE.MeshStandardMaterial({ color: o.cuff, roughness: 0.8 }), this.group, [0, -0.052, 0], [1, 0.85, 1]).rotation.x = Math.PI / 2;
    }
    // fingers: index, middle, ring, little (from the thumb side outward)
    const lens = [0.074, 0.082, 0.077, 0.06];
    const rad = [0.0088, 0.009, 0.0085, 0.0075];
    const xs = [0.028, 0.0095, -0.0095, -0.027];
    lens.forEach((len, i) => {
      const base = new THREE.Group();
      base.position.set(xs[i] * S, 0.097 - Math.abs(i - 1.3) * 0.004, 0);
      this.group.add(base);
      this.bases.push(base);
      const segs: THREE.Group[] = [];
      let parent: THREE.Object3D = base;
      const pl = [0.45, 0.31, 0.24].map((f) => f * len);
      pl.forEach((l, j) => {
        const g = new THREE.Group();
        if (j > 0) g.position.y = pl[j - 1];
        parent.add(g);
        const r = rad[i] * (1 - j * 0.1);
        mesh(new THREE.CapsuleGeometry(r, l - r * 0.6, 4, 10), skin, g, [0, l / 2, 0], [1, 1, 0.88]);
        if (j === 2) mesh(new RoundedBoxGeometry(r * 1.5, l * 0.55, 0.003, 2, 0.0012), nail, g, [0, l * 0.62, -r * 0.82]);
        segs.push(g);
        parent = g;
      });
      this.fingers.push(segs);
    });
    // thumb: from the side of the palm, angled out
    this.thumbBase = new THREE.Group();
    this.thumbBase.position.set(0.034 * S, 0.02, 0.008);
    this.group.add(this.thumbBase);
    const tl = [0.04, 0.032, 0.027];
    let parent: THREE.Object3D = this.thumbBase;
    const tsegs: THREE.Group[] = [];
    tl.forEach((l, j) => {
      const g = new THREE.Group();
      if (j > 0) g.position.y = tl[j - 1];
      parent.add(g);
      const r = 0.0105 * (1 - j * 0.08);
      mesh(new THREE.CapsuleGeometry(r, l - r * 0.6, 4, 10), skin, g, [0, l / 2, 0], [1, 1, 0.9]);
      if (j === 2) mesh(new RoundedBoxGeometry(r * 1.5, l * 0.5, 0.003, 2, 0.0012), nail, g, [0, l * 0.6, -r * 0.85]);
      tsegs.push(g);
      parent = g;
    });
    this.fingers.unshift(tsegs);
    this.side = S;
    this.pose({ curl: [0.1, 0.1, 0.1, 0.1, 0.1] });
  }
  private side: number;

  pose(p: HandPose) {
    const S = this.side;
    const spread = p.spread ?? 0.2;
    // fingers curl toward the palm (+Z): positive rotation about X
    for (let i = 1; i < 5; i++) {
      const c = p.curl[i];
      const segs = this.fingers[i];
      segs[0].rotation.set(c * 1.35, 0, ((i - 2.5) * 0.09 * spread + (i === 4 ? -0.06 : 0)) * S);
      segs[1].rotation.x = c * 1.55;
      segs[2].rotation.x = c * 1.0;
    }
    const c = p.curl[0];
    const opp = p.thumbIn ?? c;
    // the thumb swings from beside the palm to across it
    this.thumbBase.rotation.set(0.12 + opp * 0.95, 0, (-0.7 + opp * 0.5) * S);
    this.fingers[0][1].rotation.x = c * 0.7;
    this.fingers[0][2].rotation.x = c * 0.9;
  }
}

/** The wooden charm on its red cord: a small plaque with a carved sign. */
export function charm(scale = 1) {
  const g = new THREE.Group();
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 192;
  const x = c.getContext("2d")!;
  const grd = x.createLinearGradient(0, 0, 128, 192);
  grd.addColorStop(0, "#b48a5a");
  grd.addColorStop(1, "#8a6238");
  x.fillStyle = grd;
  x.fillRect(0, 0, 128, 192);
  for (let i = 0; i < 40; i++) {
    x.strokeStyle = `rgba(70,40,20,${0.15 + Math.random() * 0.2})`;
    x.beginPath();
    const px = Math.random() * 128;
    x.moveTo(px, 0);
    x.bezierCurveTo(px + 6, 60, px - 6, 130, px + 3, 192);
    x.stroke();
  }
  x.fillStyle = "rgba(50,24,10,0.9)";
  x.font = "bold 92px serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("守", 64, 104);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const wood = new THREE.MeshStandardMaterial({ color: "#ffffff", map: t, roughness: 0.55 });
  const side = new THREE.MeshStandardMaterial({ color: "#8a6238", roughness: 0.6 });
  const plaque = new THREE.Mesh(new RoundedBoxGeometry(0.032, 0.048, 0.007, 3, 0.003), [side, side, side, side, wood, wood]);
  plaque.castShadow = true;
  g.add(plaque);
  const cord = new THREE.MeshStandardMaterial({ color: "#a81c18", roughness: 0.7, emissive: "#3a0606" });
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0018, 6, 18), cord);
  loop.position.y = 0.034;
  g.add(loop);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.06, 5), cord);
  tail.position.set(0.004, 0.06, 0);
  tail.rotation.z = 0.3;
  g.add(tail);
  g.scale.setScalar(scale);
  return g;
}
