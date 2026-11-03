import * as THREE from "three";
import type { LevelDef } from "./types";

export const ARENA_R = 11;

const PALETTE: Record<LevelDef["arena"], { fog: number; sky: number; ground: number; rim: number; hemi: number; water: number }> = {
  mist: { fog: 0x9a9aa4, sky: 0xc8c8ce, ground: 0x3a342e, rim: 0x6a645c, hemi: 0xc4c4cc, water: 0x4a5058 },
  ember: { fog: 0x4a2020, sky: 0x1a0808, ground: 0x2a1612, rim: 0x6a1818, hemi: 0x8a3030, water: 0x2a1014 },
  grove: { fog: 0x3a4038, sky: 0x1c221c, ground: 0x243024, rim: 0x3a4a38, hemi: 0x6a8060, water: 0x1a2820 },
  storm: { fog: 0x2a3038, sky: 0x10141a, ground: 0x1a1e24, rim: 0x3a4048, hemi: 0x506070, water: 0x121820 },
  void: { fog: 0x0c0c10, sky: 0x050508, ground: 0x161418, rim: 0x2a2a30, hemi: 0x4a4a55, water: 0x08080c },
  blood: { fog: 0x2a1014, sky: 0x14080a, ground: 0x1e1210, rim: 0x5a1820, hemi: 0x8a2830, water: 0x1a080c },
};

export class Arena {
  group = new THREE.Group();
  hemi: THREE.HemisphereLight;
  dir: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  fogColor = new THREE.Color();
  private lanterns: THREE.PointLight[] = [];
  private groundMat: THREE.MeshStandardMaterial;
  private ringMat: THREE.MeshStandardMaterial;
  private waterMat: THREE.MeshStandardMaterial;
  private plankMat: THREE.MeshStandardMaterial;
  private water: THREE.Mesh;
  private t = 0;

  constructor() {
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 0.9, metalness: 0.04 });
    this.groundMat = groundMat;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R, 64), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    const plankMat = new THREE.MeshStandardMaterial({ color: 0x2e2824, roughness: 0.88 });
    this.plankMat = plankMat;
    const plankG = new THREE.BoxGeometry(1.8, 0.07, 0.42);
    const dummy = new THREE.Object3D();
    const planks = new THREE.InstancedMesh(plankG, plankMat, 48);
    planks.receiveShadow = true;
    planks.castShadow = true;
    let n = 0;
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 4; j++) {
        const a = (i / 12) * Math.PI * 2 + j * 0.04;
        const r = 2.2 + j * 2.1;
        dummy.position.set(Math.cos(a) * r, 0.04, Math.sin(a) * r);
        dummy.rotation.set(0, a + Math.PI / 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        planks.setMatrixAt(n++, dummy.matrix);
      }
    }
    this.group.add(planks);

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x6a645c, roughness: 0.72, metalness: 0.12 });
    this.ringMat = ringMat;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R - 0.12, 0.14, 10, 72), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    this.group.add(ring);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x4a5058,
      roughness: 0.28,
      metalness: 0.55,
      transparent: true,
      opacity: 0.85,
    });
    this.waterMat = waterMat;
    const water = new THREE.Mesh(new THREE.CircleGeometry(28, 48), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.45;
    this.water = water;
    this.group.add(water);

    const posts = new THREE.CylinderGeometry(0.09, 0.12, 2.4, 8);
    const postM = new THREE.MeshStandardMaterial({ color: 0x241e1a, roughness: 0.9 });
    const capM = new THREE.MeshStandardMaterial({ color: 0xb4232a, emissive: 0x4a0a10, emissiveIntensity: 0.7 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const g = new THREE.Group();
      const post = new THREE.Mesh(posts, postM);
      post.position.y = 1.2;
      post.castShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.38), capM);
      cap.position.y = 2.42;
      g.add(post, cap);
      g.position.set(Math.cos(a) * (ARENA_R - 1.5), 0, Math.sin(a) * (ARENA_R - 1.5));
      this.group.add(g);
      const l = new THREE.PointLight(0xff8a62, 0.55, 9);
      l.position.set(g.position.x, 2.3, g.position.z);
      this.group.add(l);
      this.lanterns.push(l);
    }

    const mtM = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 1, flatShading: true });
    const mtG = new THREE.ConeGeometry(1, 1, 5);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const m = new THREE.Mesh(mtG, mtM);
      const s = 4 + (i % 3) * 2.2;
      m.scale.set(s * 1.4, s * 2.4, s * 1.4);
      m.position.set(Math.cos(a) * 22, s * 0.9 - 0.4, Math.sin(a) * 22);
      this.group.add(m);
    }

    this.hemi = new THREE.HemisphereLight(0xc4c4cc, 0x1a1614, 0.95);
    this.dir = new THREE.DirectionalLight(0xf4f0e6, 1.35);
    this.dir.position.set(7, 14, 5);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(1024, 1024);
    this.dir.shadow.camera.near = 1;
    this.dir.shadow.camera.far = 36;
    this.dir.shadow.camera.left = -14;
    this.dir.shadow.camera.right = 14;
    this.dir.shadow.camera.top = 14;
    this.dir.shadow.camera.bottom = -14;
    this.dir.shadow.bias = -0.0008;
    this.rim = new THREE.DirectionalLight(0xd8dce8, 0.55);
    this.rim.position.set(-8, 5, -7);
    this.group.add(this.hemi, this.dir, this.rim);
  }

  apply(arena: LevelDef["arena"]) {
    const p = PALETTE[arena];
    this.fogColor.setHex(p.fog);
    this.hemi.color.setHex(p.hemi);
    this.groundMat.color.setHex(p.ground);
    this.ringMat.color.setHex(p.rim);
    this.waterMat.color.setHex(p.water);
    this.plankMat.color.setHex(arena === "mist" ? 0x3a342e : p.ground);
    this.rim.color.setHex(arena === "mist" ? 0xe8ecf4 : p.hemi);
    for (const l of this.lanterns) {
      l.color.setHex(arena === "mist" ? 0xe8e4d8 : 0xff6a4a);
      l.intensity = arena === "void" ? 0.3 : 0.6;
    }
  }

  pulseFold(on: boolean) {
    this.hemi.intensity = on ? 0.4 : 0.95;
    this.dir.intensity = on ? 0.5 : 1.35;
    this.rim.intensity = on ? 0.15 : 0.55;
  }

  step(dt: number) {
    this.t += dt;
    this.water.position.y = -0.45 + Math.sin(this.t * 0.7) * 0.03;
  }
}
