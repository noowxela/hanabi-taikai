import * as THREE from 'three';
import { audio } from '../audio/audio';
import { CameraRig } from '../render/cameraRig';
import { keyLight } from '../render/keyLight';
import { glow, toon } from '../render/materials';
import { drawKoiSprite } from '../ui/koiSprite';
import { el } from '../ui/overlay';
import { range } from '../util/random';
import { block, mesh } from '../world/props';
import {
  KOI_PATTERNS,
  loadKoiSave,
  nextPattern,
  saveKoiSave,
  unlockedPatterns,
  type KoiPattern,
  type KoiSave,
} from './koiPatterns';
import type { GameScene, SceneContext } from './types';

const POND_RADIUS = 5.2;
const SWIM_RADIUS = 4.4;
const MAX_PELLETS = 30;
const PELLET_LIFETIME = 25;
const EXTRA_KOHAKU = 2;
const FISH_GLOW = 0.75;

const bodyGeometry = new THREE.SphereGeometry(0.5, 8, 5);
const spotGeometry = new THREE.SphereGeometry(0.5, 6, 4);
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const pelletGeometry = new THREE.BoxGeometry(0.11, 0.08, 0.11);

interface Pellet {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  age: number;
}

interface Ripple {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
}

class Koi {
  readonly group = new THREE.Group();
  private readonly tail = new THREE.Group();
  heading: number;
  x: number;
  z: number;
  private speed = 0.6;
  private depth = -0.08;
  private wanderHeading: number;
  private wanderTimer = 0;
  private readonly phase = Math.random() * 10;
  readonly scale: number;

  constructor(pattern: KoiPattern) {
    this.scale = range(Math.random, 1.1, 1.45);
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * SWIM_RADIUS * 0.8;
    this.x = Math.cos(a) * r;
    this.z = Math.sin(a) * r;
    this.heading = Math.random() * Math.PI * 2;
    this.wanderHeading = this.heading;

    const body = new THREE.Mesh(bodyGeometry, toon(pattern.base, FISH_GLOW));
    body.scale.set(0.36, 0.22, 1);
    this.group.add(body);
    for (const spot of pattern.spots) {
      const s = new THREE.Mesh(spotGeometry, glow(spot.color));
      const along = spot.z * 0.42;
      s.position.set(spot.x * 0.13, 0.085 * (1 - (along / 0.5) ** 2) + 0.01, along);
      s.scale.set(spot.size * 0.36, 0.06, spot.size * 0.6);
      this.group.add(s);
    }
    const fin = toon(pattern.fin, FISH_GLOW);
    this.tail.position.z = -0.42;
    const tailFin = new THREE.Mesh(boxGeometry, fin);
    tailFin.scale.set(0.34, 0.03, 0.3);
    tailFin.position.z = -0.14;
    this.tail.add(tailFin);
    this.group.add(this.tail);
    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(boxGeometry, fin);
      pec.scale.set(0.2, 0.02, 0.12);
      pec.position.set(side * 0.2, -0.03, 0.18);
      pec.rotation.y = side * (Math.PI / 2);
      this.group.add(pec);
    }
    this.group.scale.setScalar(this.scale);
  }

  mouth(out: THREE.Vector2): THREE.Vector2 {
    const reach = 0.5 * this.scale;
    return out.set(this.x + Math.sin(this.heading) * reach, this.z + Math.cos(this.heading) * reach);
  }

  update(dt: number, time: number, target: Pellet | null): void {
    let desired: number;
    let wantSpeed: number;
    let wantDepth = -0.08;
    if (target) {
      desired = Math.atan2(target.x - this.x, target.z - this.z);
      wantSpeed = 1.9;
      if (Math.hypot(target.x - this.x, target.z - this.z) < 1.5) wantDepth = -0.06;
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderHeading = this.heading + range(Math.random, -1.3, 1.3);
        this.wanderTimer = range(Math.random, 1.5, 3.5);
      }
      desired = this.wanderHeading;
      wantSpeed = 0.6;
    }
    if (Math.hypot(this.x, this.z) > SWIM_RADIUS) {
      desired = Math.atan2(-this.x, -this.z);
      this.wanderHeading = desired;
    }

    let diff = desired - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turn = (target ? 3.4 : 1.4) * dt;
    this.heading += Math.max(-turn, Math.min(turn, diff));
    this.speed = THREE.MathUtils.damp(this.speed, wantSpeed, 3, dt);
    this.depth = THREE.MathUtils.damp(this.depth, wantDepth, 4, dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;

    this.group.position.set(this.x, this.depth, this.z);
    this.group.rotation.y = this.heading;
    this.tail.rotation.y = Math.sin(time * (4 + this.speed * 5) + this.phase) * 0.55;
  }
}

export class KoiPondScene implements GameScene {
  readonly scene = new THREE.Scene();
  readonly zoneId = 'koi';
  private readonly rig = new CameraRig(58, 18);
  private readonly fish: Koi[] = [];
  private readonly pellets: Pellet[] = [];
  private readonly ripples: Ripple[] = [];
  private readonly save: KoiSave = loadKoiSave();
  private readonly mouth = new THREE.Vector2();
  private readonly focus = new THREE.Vector3(0, 0, 0.4);
  private fireflies!: THREE.Points;
  private readonly fireflyBase: THREE.Vector3[] = [];

  constructor(private readonly ctx: SceneContext) {
    this.scene.background = new THREE.Color(0x0f1430);
    this.buildEnvironment();
    for (const pattern of unlockedPatterns(this.save.eaten)) this.addFish(pattern);
    for (let i = 0; i < EXTRA_KOHAKU; i++) this.addFish(KOI_PATTERNS[0]);
  }

  get camera(): THREE.Camera {
    return this.rig.camera;
  }

  resize(lowWidth: number, lowHeight: number): void {
    this.rig.setPixelsPerUnit(Math.min(lowWidth / 13.5, lowHeight / 11.5));
    this.rig.resize(lowWidth, lowHeight);
  }

  enter(): void {
    this.ctx.overlay.setHud({
      title: '锦鲤池',
      hint: { desktop: '点击水面撒饲料 · Esc 返回', touch: '点水面撒饲料' },
      buttons: [
        { label: '图鉴', onClick: () => this.showCollection() },
        { label: '返回小镇', onClick: () => this.onBack() },
      ],
    });
    this.ctx.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.publishStats();
  }

  exit(): void {
    this.ctx.canvas.removeEventListener('pointerdown', this.onPointerDown);
  }

  onBack(): void {
    this.ctx.go('town');
  }

  showCollection(): void {
    const grid = el('div', 'card-grid');
    for (const p of KOI_PATTERNS) {
      const unlocked = this.save.eaten >= p.unlockAt;
      const card = el('div', `card${unlocked ? '' : ' locked'}`, grid);
      card.appendChild(drawKoiSprite(p, unlocked));
      el('div', 'card-name', card, unlocked ? p.name : '？？？');
      el('div', 'card-hint', card, unlocked ? p.english : `喂 ${p.unlockAt} 粒解锁`);
    }
    const count = unlockedPatterns(this.save.eaten).length;
    this.ctx.overlay.showPanel(`锦鲤图鉴 ${count}/${KOI_PATTERNS.length}`, grid);
  }

  /** Drops food at a world-space point on the water. Returns false if the point is off the water. */
  feedAt(x: number, z: number): boolean {
    if (Math.hypot(x, z) > POND_RADIUS - 0.3) return false;
    for (let i = 0; i < 3 && this.pellets.length < MAX_PELLETS; i++) {
      const px = x + range(Math.random, -0.35, 0.35);
      const pz = z + range(Math.random, -0.35, 0.35);
      const m = mesh(this.scene, pelletGeometry, toon(0xc4915c), [px, 0.03, pz]);
      this.pellets.push({ mesh: m, x: px, z: pz, age: 0 });
    }
    this.addRipple(x, z);
    audio.feed();
    return true;
  }

  update(dt: number, time: number): void {
    for (const koi of this.fish) {
      koi.mouth(this.mouth);
      let nearest: Pellet | null = null;
      let best = Infinity;
      for (const p of this.pellets) {
        const d = Math.hypot(p.x - this.mouth.x, p.z - this.mouth.y);
        if (d < best) {
          best = d;
          nearest = p;
        }
      }
      koi.update(dt, time, nearest);
      if (nearest && best < 0.3) this.eat(nearest);
    }
    this.separateFish();

    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      p.age += dt;
      p.mesh.position.y = 0.03 + Math.sin(time * 3 + i) * 0.015;
      if (p.age > PELLET_LIFETIME) this.removePellet(p);
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      const t = r.age / 1.1;
      r.mesh.scale.setScalar(1 + t * 9);
      r.mesh.material.opacity = Math.max(0, 0.8 * (1 - t));
      if (t >= 1) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        this.ripples.splice(i, 1);
      }
    }

    const pos = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
    for (const [i, base] of this.fireflyBase.entries()) {
      pos.setXYZ(
        i,
        base.x + Math.sin(time * 0.6 + i * 1.7) * 0.6,
        base.y + Math.sin(time * 1.1 + i) * 0.25,
        base.z + Math.cos(time * 0.5 + i * 2.3) * 0.6,
      );
    }
    pos.needsUpdate = true;
    (this.fireflies.material as THREE.PointsMaterial).opacity = 0.6 + Math.sin(time * 2.4) * 0.4;

    this.rig.update(dt, this.focus);
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.ctx.isBusy()) return;
    const hit = this.ctx.pick(e, this.rig.camera);
    if (hit) this.feedAt(hit.x, hit.z);
  };

  private eat(pellet: Pellet): void {
    this.removePellet(pellet);
    this.save.eaten += 1;
    saveKoiSave(this.save);
    const unlocked = KOI_PATTERNS.find((p) => p.unlockAt === this.save.eaten);
    if (unlocked) {
      this.addFish(unlocked);
      this.ctx.overlay.toast(`解锁新花纹：${unlocked.name}！`);
    }
    this.publishStats();
  }

  private removePellet(pellet: Pellet): void {
    const i = this.pellets.indexOf(pellet);
    if (i >= 0) this.pellets.splice(i, 1);
    this.scene.remove(pellet.mesh);
  }

  private publishStats(): void {
    const next = nextPattern(this.save.eaten);
    this.ctx.overlay.setStats(
      `已喂 ${this.save.eaten} 粒 · 图鉴 ${unlockedPatterns(this.save.eaten).length}/${KOI_PATTERNS.length}`,
      next ? `再喂 ${next.unlockAt - this.save.eaten} 粒解锁新花纹 · 点水面撒饲料` : '图鉴已集齐！点水面撒饲料',
    );
  }

  private addFish(pattern: KoiPattern): void {
    const koi = new Koi(pattern);
    this.fish.push(koi);
    this.scene.add(koi.group);
  }

  private addRipple(x: number, z: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.13, 14),
      new THREE.MeshBasicMaterial({ color: 0x9adbc8, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.02, z);
    this.scene.add(ring);
    this.ripples.push({ mesh: ring, age: 0 });
  }

  private separateFish(): void {
    for (let i = 0; i < this.fish.length; i++) {
      for (let j = i + 1; j < this.fish.length; j++) {
        const a = this.fish[i];
        const b = this.fish[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= 0.7 || d < 1e-6) continue;
        const push = (0.7 - d) / 2 / d;
        a.x -= dx * push;
        a.z -= dz * push;
        b.x += dx * push;
        b.z += dz * push;
      }
    }
  }

  private buildEnvironment(): void {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x5f78ad, 0x14291f, 1.5));
    s.add(keyLight(0xb8c4ff, 1.6));
    const lanternLight = new THREE.PointLight(0xffb060, 22, 10, 1.2);
    lanternLight.position.set(6.2, 1.6, -2.4);
    s.add(lanternLight);

    const groundShape = new THREE.Shape().moveTo(-20, -20).lineTo(20, -20).lineTo(20, 20).lineTo(-20, 20);
    groundShape.holes.push(new THREE.Path().absarc(0, 0, POND_RADIUS, 0, Math.PI * 2, true));
    const ground = mesh(s, new THREE.ShapeGeometry(groundShape, 20), toon(0x1f3f2c), [0, 0, 0]);
    ground.rotation.x = -Math.PI / 2;
    const bottom = mesh(s, new THREE.CylinderGeometry(POND_RADIUS, POND_RADIUS, 0.05, 20), toon(0x15424f), [0, -0.92, 0]);
    bottom.renderOrder = -1;
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(POND_RADIUS, POND_RADIUS, 0.95, 20, 1, true),
      new THREE.MeshToonMaterial({ color: 0x15424f, side: THREE.BackSide }),
    );
    wall.position.y = -0.47;
    s.add(wall);
    mesh(s, new THREE.CircleGeometry(0.6, 10), glow(0xf3e6c8), [-2.2, 0.012, -2.6]).rotation.x = -Math.PI / 2;
    const water = mesh(
      s,
      new THREE.CircleGeometry(POND_RADIUS, 20),
      new THREE.MeshBasicMaterial({ color: 0x24707a, transparent: true, opacity: 0.3, depthWrite: false }),
      [0, 0, 0],
    );
    water.rotation.x = -Math.PI / 2;

    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.1;
      const r = POND_RADIUS + 0.25 + Math.random() * 0.25;
      block(
        s,
        toon(i % 3 ? 0x4a4e63 : 0x777d94),
        [range(Math.random, 0.6, 1.0), range(Math.random, 0.2, 0.45), range(Math.random, 0.5, 0.8)],
        [Math.cos(a) * r, -0.05, Math.sin(a) * r],
        -a,
      );
    }

    const pad = new THREE.CylinderGeometry(0.5, 0.5, 0.04, 8);
    for (const [px, pz, sc, flower] of [
      [-2.8, 1.6, 1.0, true],
      [2.6, 2.4, 0.8, false],
      [3.3, -1.2, 1.1, true],
      [-1.2, -3.6, 0.7, false],
      [0.8, 3.8, 0.9, false],
    ] as const) {
      const p = mesh(s, pad, toon(0x527f48), [px, 0.03, pz]);
      p.scale.set(sc, 1, sc);
      if (flower) block(s, toon(0xf08fb0), [0.22, 0.14, 0.22], [px + 0.1, 0.05, pz]);
    }

    const tx = 6.2;
    const tz = -2.4;
    const stone = toon(0x777d94);
    block(s, stone, [0.9, 0.25, 0.9], [tx, 0, tz]);
    block(s, stone, [0.35, 0.8, 0.35], [tx, 0.25, tz]);
    block(s, glow(0xffcf5c), [0.6, 0.45, 0.6], [tx, 1.05, tz]);
    const roof = mesh(s, new THREE.ConeGeometry(0.75, 0.45, 4), toon(0x4a4e63), [tx, 1.72, tz]);
    roof.rotation.y = Math.PI / 4;

    block(s, toon(0x2b1a18), [0.3, 1.4, 0.3], [-6.4, 0, -3.4]);
    const leaf = new THREE.IcosahedronGeometry(1, 0);
    for (const [dx, y, dz, r, c] of [
      [0, 2.1, 0, 1.2, 0xc23a30],
      [0.8, 1.7, 0.4, 0.8, 0xe8642c],
      [-0.7, 1.8, 0.5, 0.8, 0x8f1d2c],
    ] as const) {
      mesh(s, leaf, toon(c), [-6.4 + dx, y, -3.4 + dz]).scale.setScalar(r);
    }
    for (const [i, [lx, lz]] of ([[-4.8, 3.6], [5.0, 3.2], [-1.0, 5.9], [2.5, -5.6]] as const).entries()) {
      block(s, toon(0xc23a30), [0.3, 0.04, 0.2], [lx, 0.01, lz], i % 2 === 0 ? 0 : Math.PI / 2);
    }

    const count = 14;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = range(Math.random, 2, 7);
      this.fireflyBase.push(new THREE.Vector3(Math.cos(a) * r, range(Math.random, 0.6, 2.2), Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fireflies = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xfff0a8, size: 1, sizeAttenuation: false, transparent: true, depthWrite: false }),
    );
    this.fireflies.frustumCulled = false;
    s.add(this.fireflies);
  }
}
