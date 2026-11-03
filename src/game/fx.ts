import * as THREE from "three";

type Spark = {
  m: THREE.Mesh;
  v: THREE.Vector3;
  life: number;
  max: number;
};

type Ghost = {
  m: THREE.Mesh;
  life: number;
  max: number;
};

export class FX {
  group = new THREE.Group();
  private pool: Spark[] = [];
  private ghosts: Ghost[] = [];
  private geo = new THREE.SphereGeometry(1, 6, 4);
  private ghostGeo = new THREE.CapsuleGeometry(0.22, 1.15, 4, 8);
  private mats: THREE.MeshBasicMaterial[] = [];
  private ring: THREE.Mesh;
  private ringLife = 0;
  private slashMesh: THREE.Mesh;
  private slashLife = 0;

  constructor() {
    for (let i = 0; i < 90; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: "#efece4", transparent: true, opacity: 0 });
      const m = new THREE.Mesh(this.geo, mat);
      m.visible = false;
      m.scale.setScalar(0.04);
      this.group.add(m);
      this.pool.push({ m, v: new THREE.Vector3(), life: 0, max: 1 });
      this.mats.push(mat);
    }
    const gMat = new THREE.MeshBasicMaterial({
      color: "#efece4",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(this.ghostGeo, gMat.clone());
      m.visible = false;
      this.group.add(m);
      this.ghosts.push({ m, life: 0, max: 0.45 });
      this.mats.push(m.material as THREE.MeshBasicMaterial);
    }
    const ringMat = new THREE.MeshBasicMaterial({
      color: "#efece4",
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 32), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.group.add(this.ring);
    this.mats.push(ringMat);

    const slashMat = new THREE.MeshBasicMaterial({
      color: "#efece4",
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.slashMesh = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.15, 18, 1, 0, Math.PI * 0.7), slashMat);
    this.slashMesh.visible = false;
    this.group.add(this.slashMesh);
    this.mats.push(slashMat);
  }

  burst(x: number, y: number, z: number, n: number, color: string, speed = 4) {
    let used = 0;
    for (const s of this.pool) {
      if (used >= n) break;
      if (s.life > 0) continue;
      s.life = s.max = 0.35 + Math.random() * 0.25;
      s.m.visible = true;
      s.m.position.set(x, y, z);
      (s.m.material as THREE.MeshBasicMaterial).color.set(color);
      (s.m.material as THREE.MeshBasicMaterial).opacity = 1;
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * speed;
      s.v.set(Math.cos(a) * e, 1 + Math.random() * speed, Math.sin(a) * e);
      used++;
    }
  }

  slashArc(x: number, y: number, z: number, yaw: number) {
    this.burst(x + -Math.sin(yaw) * 0.85, y + 1.15, z + -Math.cos(yaw) * 0.85, 12, "#efece4", 3.4);
    this.slashLife = 0.18;
    this.slashMesh.visible = true;
    this.slashMesh.position.set(x, y + 1.15, z);
    this.slashMesh.rotation.set(-0.4, yaw, 0.2);
    (this.slashMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
  }

  foldRing(x: number, z: number) {
    this.ringLife = 0.55;
    this.ring.visible = true;
    this.ring.position.set(x, 0.08, z);
    this.ring.scale.setScalar(1);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.9;
  }

  afterimage(x: number, y: number, z: number, yaw: number) {
    for (const g of this.ghosts) {
      if (g.life > 0) continue;
      g.life = g.max;
      g.m.visible = true;
      g.m.position.set(x, y + 0.95, z);
      g.m.rotation.y = yaw;
      (g.m.material as THREE.MeshBasicMaterial).opacity = 0.35;
      return;
    }
  }

  step(dt: number) {
    for (const s of this.pool) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.v.y -= 6 * dt;
      s.m.position.addScaledVector(s.v, dt);
      const k = Math.max(0, s.life / s.max);
      (s.m.material as THREE.MeshBasicMaterial).opacity = k;
      s.m.scale.setScalar(0.03 + (1 - k) * 0.08);
      if (s.life <= 0) s.m.visible = false;
    }
    for (const g of this.ghosts) {
      if (g.life <= 0) continue;
      g.life -= dt;
      const k = Math.max(0, g.life / g.max);
      (g.m.material as THREE.MeshBasicMaterial).opacity = k * 0.35;
      g.m.scale.setScalar(1 + (1 - k) * 0.15);
      if (g.life <= 0) g.m.visible = false;
    }
    if (this.ringLife > 0) {
      this.ringLife -= dt;
      const k = Math.max(0, this.ringLife / 0.55);
      this.ring.scale.setScalar(1 + (1 - k) * 6);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = k * 0.7;
      if (this.ringLife <= 0) this.ring.visible = false;
    }
    if (this.slashLife > 0) {
      this.slashLife -= dt;
      (this.slashMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, this.slashLife / 0.18);
      if (this.slashLife <= 0) this.slashMesh.visible = false;
    }
  }

  dispose() {
    this.geo.dispose();
    this.ghostGeo.dispose();
    for (const m of this.mats) m.dispose();
  }
}
