import * as THREE from 'three';
import { audio } from '../audio/audio';
import { CameraRig } from '../render/cameraRig';
import { pixelDetail, setPixelDetail, townPixelsPerUnit } from '../render/pixelDetail';
import { keyLight } from '../render/keyLight';
import { glow, toon } from '../render/materials';
import type { GameScene, SceneContext, SceneId } from '../scenes/types';
import { mulberry32, range } from '../util/random';
import { box, circle, resolveCollisions, type Bounds, type Collider } from './collision';
import { PLAYER_RADIUS, Player } from './player';
import { block, mesh } from './props';
import { ZoneSystem, type Zone } from './zones';

const BOUNDS: Bounds = { minX: -19.5, maxX: 19.5, minZ: -19.5, maxZ: 19.5 };
const SPAWN = new THREE.Vector3(0, 0, 13);
const FIRE_INTENSITY = 16;
const BENCH_R = 3.1;
const STAND_R = 2.25;
const SEAT_REACH = 0.9;
/** World units across the long side of the opening shot. Reaches the tree ring. */
const OVERVIEW_SPAN = 46;
const POND_X = -15;
const POND_Z = 3;
const SMOKE_S = 0.45;
const ZOOM_S = 0.7;

interface Seat {
  x: number;
  z: number;
  standX: number;
  standZ: number;
  yaw: number;
}

const COLORS = {
  grass: 0x1f3f2c,
  grassTuft: 0x527f48,
  dirt: 0x4a2c22,
  stone: 0x4a4e63,
  stoneLight: 0x777d94,
  plaza: 0x4a4e63,
  wood: 0x4a2c22,
  woodLight: 0x6e4430,
  darkWood: 0x2b1a18,
  red: 0xc23a30,
  orange: 0xe8642c,
  amber: 0xf59a3a,
  yellow: 0xffcf5c,
  paper: 0xf3e6c8,
  pine: 0x14291f,
  pineLight: 0x335c3a,
  water: 0x24707a,
};

const LANTERN_COLORS = [COLORS.red, COLORS.amber, COLORS.paper];

interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

const ENTRANCES = {
  koi: new THREE.Vector2(-10.6, 3),
  train: new THREE.Vector2(11.8, 3),
  arcade: new THREE.Vector2(-10, -9.6),
  watch: new THREE.Vector2(10, -10.2),
};

const PATHS: Segment[] = [
  { ax: 0, az: 0, bx: ENTRANCES.koi.x - 1, bz: ENTRANCES.koi.y },
  { ax: 0, az: 0, bx: ENTRANCES.train.x + 0.8, bz: ENTRANCES.train.y },
  { ax: 0, az: 0, bx: ENTRANCES.arcade.x, bz: ENTRANCES.arcade.y - 0.8 },
  { ax: 0, az: 0, bx: ENTRANCES.watch.x, bz: ENTRANCES.watch.y - 0.8 },
  { ax: 0, az: 0, bx: 0, bz: 20 },
];

function distToSegment(x: number, z: number, s: Segment): number {
  const vx = s.bx - s.ax;
  const vz = s.bz - s.az;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * vx + (z - s.az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - (s.ax + vx * t), z - (s.az + vz * t));
}

export class TownScene implements GameScene {
  readonly scene = new THREE.Scene();
  readonly player = new Player();
  readonly zones: ZoneSystem;

  private readonly rig = new CameraRig(42, 16);
  private readonly colliders: Collider[] = [];
  private readonly rand = mulberry32(20261106);
  private readonly moveVec = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();

  private fireLight!: THREE.PointLight;
  private readonly flames: THREE.Mesh[] = [];
  private sparks!: THREE.Points;
  private readonly sparkState: { vx: number; vy: number; vz: number; life: number }[] = [];
  private readonly markers: THREE.Mesh[] = [];
  private tanuki!: THREE.Group;
  private readonly seats: Seat[] = [];
  private occupied: Seat | null = null;
  private promptKey = '';
  /** Wide on each page load, then a click zooms in for the rest of the visit. */
  private intro: 'wide' | 'zoom' | 'play' = 'wide';
  private zoomT = 0;
  private lowW = 1;
  private lowH = 1;
  private readonly smokeGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  private readonly puffs: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[] = [];
  private readonly pondFish: { group: THREE.Group; tail: THREE.Group; angle: number; speed: number; radius: number }[] = [];

  constructor(private readonly ctx: SceneContext) {
    this.scene.background = new THREE.Color(0x0f1430);
    this.buildLights();
    this.buildGround();
    this.buildPlaza();
    this.buildTorii();
    this.buildKoiPond();
    this.buildTrainStation();
    this.buildArcade();
    this.buildWatchtower();
    this.buildTanuki();
    this.buildTrees();

    this.player.position.copy(SPAWN);
    this.scene.add(this.player.group);

    this.zones = new ZoneSystem(this.createZones());
    for (const zone of this.zones.zones) {
      if (zone.id === 'tanuki') continue;
      const marker = mesh(
        this.scene,
        new THREE.OctahedronGeometry(0.28, 0),
        glow(COLORS.yellow),
        [zone.position.x, 2.4, zone.position.y],
      );
      marker.userData.baseY = 2.4;
      this.markers.push(marker);
    }

    this.ctx.canvas.addEventListener('pointerdown', (e) => {
      if (this.intro !== 'wide' || e.target !== this.ctx.canvas) return;
      this.intro = 'zoom';
      this.zoomT = 0;
    });
  }

  get camera(): THREE.Camera {
    return this.rig.camera;
  }

  resize(lowWidth: number, lowHeight: number): void {
    this.lowW = lowWidth;
    this.lowH = lowHeight;
    this.frameCamera();
    this.rig.resize(lowWidth, lowHeight);
  }

  enter(): void {
    this.ctx.setTouchSprint(false);
    this.ctx.overlay.setHud({
      title: '营火会小镇',
      hint: {
        desktop: 'WASD 移动 · Shift 跑 · F 变身 · Q/E 转视角 · 空格 互动',
        touch: '摇杆移动 · 按住跑 · 点变身 · 双指旋转视角',
      },
      buttons: [
        {
          label: pixelDetail() ? '普通' : '64',
          onClick: () => {
            setPixelDetail(!pixelDetail());
            this.ctx.applyPixelDetail();
            this.enter();
          },
        },
        { label: '变', onClick: () => this.swapForm() },
        { label: '跑', touchOnly: true, onHold: (down) => this.ctx.setTouchSprint(down) },
        { label: '⟲', touchOnly: true, onClick: () => this.onRotate(-1) },
        { label: '⟳', touchOnly: true, onClick: () => this.onRotate(1) },
      ],
      joystick: true,
      action: {},
    });
    this.refreshPrompt();
  }

  exit(): void {
    this.promptKey = '';
    this.ctx.overlay.setPrompt(null);
  }

  onHenshin(): void {
    audio.click();
    this.swapForm();
  }

  private swapForm(): void {
    this.player.henshin();
    this.burstSmoke();
  }

  onAction(): void {
    if (this.intro !== 'play') return;
    if (this.occupied) {
      this.standUp();
      return;
    }
    if (!this.zones.active) {
      const seat = this.nearestSeat();
      if (seat) {
        this.sitOn(seat);
        return;
      }
    }
    this.zones.active?.onInteract();
  }

  onRotate(direction: -1 | 1): void {
    this.rig.rotate(direction);
  }

  /** Puts the player back at a zone entrance, slightly towards the plaza. */
  placeAtZone(id: string): void {
    const zone = this.zones.get(id);
    const toCenter = zone.position.clone().negate().normalize().multiplyScalar(0.6);
    this.occupied = null;
    this.player.stand();
    this.player.position.set(zone.position.x + toCenter.x, 0, zone.position.y + toCenter.y);
  }

  update(dt: number, time: number): void {
    const playing = this.intro === 'play';
    if (playing && !this.ctx.isBusy()) {
      if (!this.occupied) {
        const input = this.ctx.move();
        this.rig.groundAxes(this.forward, this.right);
        this.moveVec.set(0, 0, 0).addScaledVector(this.right, input.x).addScaledVector(this.forward, input.y);
        this.player.update(dt, this.moveVec, this.ctx.sprinting());
        resolveCollisions(this.player.position, PLAYER_RADIUS, this.colliders, BOUNDS);
        this.zones.update(this.player.position.x, this.player.position.z);
      }
      this.refreshPrompt();
    } else if (!this.occupied) {
      this.moveVec.set(0, 0, 0);
      this.player.update(dt, this.moveVec, false);
      if (!playing && this.promptKey) {
        this.promptKey = '';
        this.ctx.overlay.setPrompt(null);
      }
    }

    this.animateFire(dt, time);
    for (const [i, m] of this.markers.entries()) {
      const step = Math.floor(time * 4 + i) % 4;
      m.position.y = m.userData.baseY + [0, 0.08, 0.15, 0.08][step];
    }
    const bob = Math.floor(time * 4) % 4;
    this.tanuki.position.y = [0, 0.02, 0.04, 0.02][bob];
    this.swimPond(dt, time);
    this.driftSmoke(dt);

    if (this.intro === 'zoom') {
      this.zoomT += dt;
      if (this.zoomT >= ZOOM_S) this.intro = 'play';
    }
    const blend = this.cameraBlend();
    this.focus.set(this.player.position.x * blend, 0.6, this.player.position.z * blend);
    this.frameCamera();
    this.rig.update(dt, this.focus);
  }

  private burstSmoke(): void {
    for (const puff of this.puffs) {
      this.scene.remove(puff.mesh);
      (puff.mesh.material as THREE.Material).dispose();
    }
    this.puffs.length = 0;
    const y = this.player.isFox ? 0.45 : 0.75;
    const colors = [0x07081a, 0x4a4e63, 0x777d94];
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(
        this.smokeGeo,
        new THREE.MeshBasicMaterial({ color: colors[i % 3], transparent: true, opacity: 0.92, depthWrite: false }),
      );
      mesh.scale.setScalar(0.65 + (i % 4) * 0.18);
      mesh.position.set(this.player.position.x, y, this.player.position.z);
      const angle = (i / 14) * Math.PI * 2;
      const speed = 1.5 + (i % 3) * 0.45;
      this.scene.add(mesh);
      this.puffs.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 0.7 + (i % 4) * 0.35,
        vz: Math.sin(angle) * speed,
        life: SMOKE_S,
      });
    }
  }

  private driftSmoke(dt: number): void {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i];
      puff.life -= dt;
      if (puff.life <= 0) {
        this.scene.remove(puff.mesh);
        (puff.mesh.material as THREE.Material).dispose();
        this.puffs.splice(i, 1);
        continue;
      }
      puff.mesh.position.x += puff.vx * dt;
      puff.mesh.position.y += puff.vy * dt;
      puff.mesh.position.z += puff.vz * dt;
      (puff.mesh.material as THREE.MeshBasicMaterial).opacity = (puff.life / SMOKE_S) * 0.92;
    }
  }

  private swimPond(dt: number, time: number): void {
    for (const fish of this.pondFish) {
      fish.angle += fish.speed * dt;
      const dirX = -Math.sin(fish.angle);
      const dirZ = Math.cos(fish.angle);
      fish.group.position.set(POND_X + Math.cos(fish.angle) * fish.radius, 0, POND_Z + Math.sin(fish.angle) * fish.radius);
      fish.group.rotation.y = Math.atan2(dirX, dirZ);
      fish.tail.rotation.y = Math.sin(time * 8 + fish.angle) * 0.45;
    }
  }

  /** 0 is the whole town. 1 is the normal follow camera. */
  private cameraBlend(): number {
    if (this.intro === 'play') return 1;
    if (this.intro === 'wide') return 0;
    const x = Math.min(1, this.zoomT / ZOOM_S);
    return x * x * (3 - 2 * x);
  }

  private frameCamera(): void {
    const wide = Math.max(this.lowW, this.lowH) / OVERVIEW_SPAN;
    const play = townPixelsPerUnit();
    const t = this.cameraBlend();
    this.rig.setPixelsPerUnit(wide + (play - wide) * t);
  }

  private nearestSeat(): Seat | null {
    const x = this.player.position.x;
    const z = this.player.position.z;
    let best: Seat | null = null;
    let bestD = SEAT_REACH;
    for (const seat of this.seats) {
      const d = Math.hypot(x - seat.standX, z - seat.standZ);
      if (d <= bestD) {
        best = seat;
        bestD = d;
      }
    }
    return best;
  }

  private sitOn(seat: Seat): void {
    this.occupied = seat;
    this.player.position.set(seat.x, 0, seat.z);
    this.player.sit(seat.yaw);
    this.refreshPrompt();
  }

  private standUp(): void {
    const seat = this.occupied;
    if (!seat) return;
    this.occupied = null;
    this.player.stand();
    this.player.position.set(seat.standX, 0, seat.standZ);
    this.zones.update(this.player.position.x, this.player.position.z);
    this.refreshPrompt();
  }

  private refreshPrompt(): void {
    let key = '';
    let label: string | null = null;
    let detail: string | undefined;
    if (this.occupied) {
      key = 'seat-up';
      label = '圆木凳';
      detail = '起来';
    } else if (this.zones.active) {
      key = `zone:${this.zones.active.id}`;
      label = this.zones.active.label;
      detail = this.zones.active.prompt;
    } else {
      const seat = this.nearestSeat();
      if (seat) {
        key = `seat:${seat.x.toFixed(2)}`;
        label = '圆木凳';
        detail = '坐下';
      }
    }
    if (key === this.promptKey) return;
    this.promptKey = key;
    if (label) this.ctx.overlay.setPrompt(label, detail);
    else this.ctx.overlay.setPrompt(null);
  }

  private createZones(): Zone[] {
    const location = (id: keyof typeof ENTRANCES, scene: SceneId, label: string): Zone => ({
      id,
      label,
      position: ENTRANCES[id],
      radius: id === 'koi' ? 2.2 : 2,
      prompt: '进入',
      onInteract: () => this.ctx.go(scene),
    });
    return [
      location('koi', 'pond', '锦鲤池'),
      location('train', 'train', '夜市火车站'),
      location('arcade', 'arcade', '掌机仔街机厅'),
      location('watch', 'watch', '守夜塔'),
      {
        id: 'tanuki',
        label: '狸爷爷',
        position: new THREE.Vector2(-3.4, -1.8),
        radius: 1.6,
        prompt: '说话',
        onInteract: () =>
          this.ctx.overlay.openDialog('狸爷爷', [
            '哦？是新面孔。欢迎来到营火会！',
            '西边的锦鲤池可以喂鱼，东边的小火车要你帮忙铺轨道。',
            '东北的守夜塔今晚要守住营火，西北的街机厅能玩小游戏。四处走走吧！',
          ]),
      },
    ];
  }

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight(0x5f78ad, 0x14291f, 1.6));
    this.scene.add(keyLight(0xb8c4ff, 1.4));
    this.fireLight = new THREE.PointLight(0xff9a3a, FIRE_INTENSITY, 16, 1.3);
    this.fireLight.position.set(0, 1.4, 0);
    this.scene.add(this.fireLight);
  }

  private keepOut(x: number, z: number, margin: number): boolean {
    if (Math.hypot(x, z) < 6 + margin) return true;
    if (PATHS.some((p) => distToSegment(x, z, p) < 1.6 + margin)) return true;
    const sites = [
      [-15, 3, 5],
      [15.5, 3, 5],
      [-10, -13, 5],
      [10, -13, 4],
      [0, 8, 3],
    ];
    return sites.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r + margin);
  }

  private buildGround(): void {
    block(this.scene, toon(COLORS.grass), [60, 0.2, 60], [0, -0.2, 0]);

    for (const p of PATHS) this.layPath(p.ax, p.az, p.bx, p.bz);

    const onGround = (g: THREE.BoxGeometry) => g.translate(0, g.parameters.height / 2, 0);
    const tufts = new THREE.InstancedMesh(onGround(new THREE.BoxGeometry(0.7, 0.02, 0.36)), toon(COLORS.grassTuft), 90);
    const rocks = new THREE.InstancedMesh(onGround(new THREE.BoxGeometry(1, 1, 1)), toon(COLORS.stone), 40);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const v = new THREE.Vector3();
    const place = (target: THREE.InstancedMesh, count: number, scale: () => THREE.Vector3) => {
      let n = 0;
      for (let tries = 0; n < count && tries < count * 20; tries++) {
        const x = range(this.rand, -22, 22);
        const z = range(this.rand, -22, 22);
        if (this.keepOut(x, z, 0)) continue;
        q.setFromAxisAngle(v.set(0, 1, 0), Math.floor(this.rand() * 4) * (Math.PI / 2));
        const sc = scale();
        m.compose(v.set(x, 0, z), q, sc);
        target.setMatrixAt(n++, m);
      }
      target.count = n;
      this.scene.add(target);
    };
    place(tufts, 90, () => s.set(range(this.rand, 0.7, 1.4), 1, range(this.rand, 0.7, 1.4)));
    place(rocks, 40, () => s.set(range(this.rand, 0.2, 0.5), range(this.rand, 0.12, 0.3), range(this.rand, 0.2, 0.45)));
  }

  private buildPlaza(): void {
    mesh(this.scene, new THREE.CylinderGeometry(4.8, 4.8, 0.04, 14), toon(COLORS.plaza), [0, 0.02, 0]);

    const fire = new THREE.Group();
    this.scene.add(fire);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const yaw = Math.round(-a / (Math.PI / 2)) * (Math.PI / 2);
      block(fire, toon(COLORS.stoneLight), [0.34, 0.24, 0.3], [Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95], yaw);
    }
    for (let i = 0; i < 3; i++) {
      block(fire, toon(COLORS.woodLight), [0.18, 0.18, 1.3], [0, 0.02 + i * 0.16, 0], i % 2 === 0 ? 0 : Math.PI / 2);
    }
    const flameSpecs: [number, number, number][] = [
      [0.5, 1.2, COLORS.orange],
      [0.32, 0.9, COLORS.amber],
      [0.16, 0.55, COLORS.yellow],
    ];
    for (const [r, h, color] of flameSpecs) {
      const flame = mesh(fire, new THREE.ConeGeometry(r, h, 5), glow(color), [0, 0.2 + h / 2, 0]);
      flame.userData.h = h;
      this.flames.push(flame);
    }
    this.colliders.push(circle(0, 0, 1.15));

    const count = 14;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.sparkState.push({ vx: 0, vy: 0, vz: 0, life: this.rand() * 2 });
      positions[i * 3 + 1] = -10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: COLORS.yellow, size: 1, sizeAttenuation: false, depthWrite: false }),
    );
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);

    for (const deg of [45, 135, 225, 315]) {
      const a = THREE.MathUtils.degToRad(deg);
      const x = Math.cos(a) * BENCH_R;
      const z = Math.sin(a) * BENCH_R;
      const bench = mesh(this.scene, new THREE.CylinderGeometry(0.24, 0.24, 1.6, 6), toon(COLORS.woodLight), [x, 0.24, z]);
      bench.rotation.set(0, -(a + Math.PI / 2), Math.PI / 2);
      const tx = -Math.sin(a) * 0.45;
      const tz = Math.cos(a) * 0.45;
      this.colliders.push(circle(x + tx, z + tz, 0.35), circle(x - tx, z - tz, 0.35));
      const towardX = -Math.cos(a);
      const towardZ = -Math.sin(a);
      this.seats.push({
        x,
        z,
        standX: Math.cos(a) * STAND_R,
        standZ: Math.sin(a) * STAND_R,
        yaw: Math.round(Math.atan2(towardX, towardZ) / (Math.PI / 2)) * (Math.PI / 2),
      });
    }

    const poleAngles = [50, 125, 192, 250, 290, 345].map((d) => THREE.MathUtils.degToRad(d));
    const tops = poleAngles.map((a) => {
      const x = Math.cos(a) * 5.4;
      const z = Math.sin(a) * 5.4;
      block(this.scene, toon(COLORS.darkWood), [0.14, 2.6, 0.14], [x, 0, z]);
      this.colliders.push(circle(x, z, 0.15));
      return new THREE.Vector3(x, 2.55, z);
    });
    for (let i = 0; i < tops.length; i++) this.lanternString(tops[i], tops[(i + 1) % tops.length]);
  }

  private lanternString(a: THREE.Vector3, b: THREE.Vector3): void {
    const steps = 12;
    const sag = a.distanceTo(b) * 0.12;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      points.push(p);
    }
    this.scene.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x07081a, depthWrite: false })),
    );
    for (let i = 2; i < steps - 1; i += 2) {
      const p = points[i];
      block(this.scene, glow(LANTERN_COLORS[(i / 2) % LANTERN_COLORS.length]), [0.2, 0.28, 0.2], [p.x, p.y - 0.34, p.z]);
    }
  }

  private standingLantern(x: number, z: number, color = COLORS.red): void {
    block(this.scene, toon(COLORS.darkWood), [0.1, 1.1, 0.1], [x, 0, z]);
    block(this.scene, glow(color), [0.3, 0.4, 0.3], [x, 1.1, z]);
    block(this.scene, toon(COLORS.darkWood), [0.36, 0.06, 0.36], [x, 1.5, z]);
    this.colliders.push(circle(x, z, 0.2));
  }

  private buildTorii(): void {
    const z = 8;
    const red = toon(COLORS.red);
    block(this.scene, red, [0.3, 2.7, 0.3], [-1.5, 0, z]);
    block(this.scene, red, [0.3, 2.7, 0.3], [1.5, 0, z]);
    block(this.scene, red, [3.4, 0.2, 0.22], [0, 2.1, z]);
    block(this.scene, toon(COLORS.darkWood), [4.2, 0.26, 0.4], [0, 2.7, z]);
    block(this.scene, red, [0.3, 0.5, 0.12], [0, 2.25, z]);
    this.colliders.push(circle(-1.5, z, 0.3), circle(1.5, z, 0.3));
    this.standingLantern(-1.6, 12.5);
    this.standingLantern(1.6, 12.5);
  }

  private buildKoiPond(): void {
    const cx = POND_X;
    const cz = POND_Z;
    mesh(this.scene, new THREE.CylinderGeometry(3.3, 3.3, 0.06, 12), toon(COLORS.water), [cx, 0.03, cz]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + this.rand() * 0.2;
      const r = 3.45 + this.rand() * 0.2;
      block(
        this.scene,
        toon(i % 3 ? COLORS.stone : COLORS.stoneLight),
        [range(this.rand, 0.4, 0.7), range(this.rand, 0.18, 0.34), range(this.rand, 0.35, 0.55)],
        [cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r],
        -a,
      );
    }
    const pad = new THREE.CylinderGeometry(0.35, 0.35, 0.04, 7);
    for (const [px, pz] of [[-1.2, 0.8], [0.9, -1.3], [1.5, 1.1]]) {
      mesh(this.scene, pad, toon(0x527f48), [cx + px, 0.07, cz + pz]);
    }
    const coats = [0xe8642c, 0xf3e6c8, 0xffffff];
    for (let i = 0; i < 3; i++) {
      const group = new THREE.Group();
      const tail = new THREE.Group();
      block(group, toon(coats[i]), [0.22, 0.1, 0.42], [0, 0.08, 0]);
      block(tail, toon(i === 2 ? 0xe8642c : 0xffffff), [0.16, 0.05, 0.16], [0, 0.02, -0.08]);
      tail.position.set(0, 0.08, -0.28);
      group.add(tail);
      this.scene.add(group);
      this.pondFish.push({
        group,
        tail,
        angle: (i / 3) * Math.PI * 2,
        speed: 0.55 + i * 0.18,
        radius: 1.35 + i * 0.5,
      });
    }
    this.colliders.push(circle(cx, cz, 3.6));
    this.maple(cx - 2.5, cz - 4.5, 1.2);
    this.standingLantern(ENTRANCES.koi.x + 0.4, ENTRANCES.koi.y - 1.8, COLORS.yellow);
    this.standingLantern(ENTRANCES.koi.x + 0.4, ENTRANCES.koi.y + 1.8, COLORS.yellow);
  }

  private buildTrainStation(): void {
    const railX = 16.6;
    block(this.scene, toon(COLORS.stone), [2.2, 0.4, 7], [14.3, 0, 3]);
    for (let z = -6; z <= 12; z += 0.8) block(this.scene, toon(COLORS.wood), [1.4, 0.06, 0.24], [railX, 0, z]);
    block(this.scene, toon(COLORS.stoneLight), [0.08, 0.1, 18.5], [railX - 0.45, 0.06, 3]);
    block(this.scene, toon(COLORS.stoneLight), [0.08, 0.1, 18.5], [railX + 0.45, 0.06, 3]);

    block(this.scene, toon(COLORS.red), [1.5, 1.3, 3.6], [railX, 0.25, 2.4]);
    block(this.scene, toon(COLORS.darkWood), [1.62, 0.18, 3.7], [railX, 1.55, 2.4]);
    for (const dz of [-1, 0, 1]) {
      block(this.scene, glow(COLORS.yellow), [1.54, 0.4, 0.6], [railX, 0.85, 2.4 + dz * 1.05]);
    }
    block(this.scene, toon(0x283766), [1.5, 1.5, 2.4], [railX, 0.25, 5.6]);
    mesh(this.scene, new THREE.CylinderGeometry(0.2, 0.26, 0.6, 6), toon(COLORS.darkWood), [railX, 2.05, 6.2]);
    block(this.scene, glow(COLORS.paper), [0.4, 0.3, 0.06], [railX, 0.9, 6.82]);

    for (const [dx, dz] of [[-0.9, -0.2], [0.9, -0.2], [-0.9, 6.2], [0.9, 6.2]]) {
      block(this.scene, toon(COLORS.darkWood), [0.14, 2.2, 0.14], [14.3 + dx, 0.4, dz]);
    }
    block(this.scene, toon(COLORS.darkWood), [2.6, 0.16, 7], [14.3, 2.6, 3]);
    block(this.scene, glow(COLORS.paper), [0.08, 0.5, 1.6], [13.08, 2.0, 3]);
    this.colliders.push(box(15.5, 3, 4.4, 19));
    this.standingLantern(ENTRANCES.train.x + 0.2, ENTRANCES.train.y - 2);
    this.standingLantern(ENTRANCES.train.x + 0.2, ENTRANCES.train.y + 2);
  }

  private buildArcade(): void {
    const cx = -10;
    const cz = -13;
    block(this.scene, toon(0x5c2c6b), [5, 3, 4], [cx, 0, cz]);
    block(this.scene, toon(0x1a2348), [5.6, 0.3, 4.6], [cx, 3, cz]);
    block(this.scene, glow(0xf08fb0), [3.2, 0.6, 0.1], [cx, 2.2, cz + 2.02]);
    block(this.scene, glow(0x9adbc8), [2.4, 0.12, 0.12], [cx, 2.05, cz + 2.06]);
    block(this.scene, glow(0x4fa8a4), [1.2, 1.7, 0.08], [cx, 0, cz + 2.02]);
    for (const dx of [-1.9, 1.9]) {
      block(this.scene, toon(0x283766), [0.7, 1.3, 0.55], [cx + dx, 0, cz + 2.4]);
      block(this.scene, glow(0x86ad5c), [0.5, 0.36, 0.06], [cx + dx, 0.8, cz + 2.69]);
      this.colliders.push(box(cx + dx, cz + 2.4, 0.7, 0.55));
    }
    this.colliders.push(box(cx, cz, 5, 4));
  }

  private buildWatchtower(): void {
    const cx = 10;
    const cz = -13;
    const wood = toon(COLORS.woodLight);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) block(this.scene, wood, [0.2, 4, 0.2], [cx + dx, 0, cz + dz]);
    block(this.scene, toon(COLORS.wood), [2.8, 0.2, 2.8], [cx, 4, cz]);
    block(this.scene, wood, [2.8, 0.5, 0.1], [cx, 4.2, cz + 1.35]);
    block(this.scene, wood, [2.8, 0.5, 0.1], [cx, 4.2, cz - 1.35]);
    const roof = mesh(this.scene, new THREE.ConeGeometry(2.3, 1.3, 4), toon(COLORS.darkWood), [cx, 6.1, cz]);
    roof.rotation.y = Math.PI / 4;
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
      block(this.scene, toon(COLORS.darkWood), [0.12, 1.3, 0.12], [cx + dx, 4.2, cz + dz]);
    }
    block(this.scene, glow(COLORS.orange), [0.6, 0.5, 0.6], [cx, 4.2, cz]);
    for (let y = 0.4; y < 4; y += 0.5) block(this.scene, toon(COLORS.wood), [0.8, 0.08, 0.08], [cx, y, cz + 1.15]);
    block(this.scene, toon(COLORS.red), [0.9, 0.9, 0.9], [cx + 1.9, 0, cz + 0.6]);
    block(this.scene, toon(COLORS.paper), [0.92, 0.12, 0.92], [cx + 1.9, 0.9, cz + 0.6]);
    this.colliders.push(box(cx, cz, 2.4, 2.4), box(cx + 1.9, cz + 0.6, 0.9, 0.9));
    this.standingLantern(ENTRANCES.watch.x - 1.7, ENTRANCES.watch.y - 0.6);
    this.standingLantern(ENTRANCES.watch.x + 1.7, ENTRANCES.watch.y - 0.6);
  }

  private buildTanuki(): void {
    const t = new THREE.Group();
    const brown = toon(COLORS.woodLight);
    block(t, brown, [0.7, 0.62, 0.56], [0, 0, 0]);
    block(t, toon(COLORS.paper), [0.44, 0.4, 0.06], [0, 0.08, 0.28]);
    block(t, brown, [0.62, 0.5, 0.52], [0, 0.62, 0]);
    block(t, toon(COLORS.darkWood), [0.64, 0.14, 0.4], [0, 0.82, 0.08]);
    block(t, toon(COLORS.paper), [0.24, 0.12, 0.08], [0, 0.66, 0.27]);
    block(t, toon(COLORS.darkWood), [0.14, 0.16, 0.1], [-0.22, 1.1, 0]);
    block(t, toon(COLORS.darkWood), [0.14, 0.16, 0.1], [0.22, 1.1, 0]);
    block(t, brown, [0.22, 0.22, 0.5], [0, 0.08, -0.48]);
    block(t, toon(COLORS.darkWood), [0.24, 0.24, 0.12], [0, 0.07, -0.68]);
    mesh(t, new THREE.ConeGeometry(0.62, 0.32, 8), toon(COLORS.amber), [0, 1.3, 0]);
    t.rotation.y = Math.PI / 2;
    const holder = new THREE.Group();
    holder.position.set(-3.4, 0, -1.8);
    holder.add(t);
    this.scene.add(holder);
    this.tanuki = t;
    this.colliders.push(circle(-3.4, -1.8, 0.45));
  }

  private pine(x: number, z: number, s: number): void {
    block(this.scene, toon(COLORS.darkWood), [0.25 * s, 0.6 * s, 0.25 * s], [x, 0, z]);
    const geo = new THREE.ConeGeometry(1, 1, 6);
    for (const [y, r, h, c] of [
      [0.5, 1.0, 1.3, COLORS.pine],
      [1.3, 0.78, 1.1, COLORS.pineLight],
      [2.0, 0.5, 0.9, COLORS.pine],
    ] as const) {
      const cone = mesh(this.scene, geo, toon(c), [x, (y + h / 2) * s, z]);
      cone.scale.set(r * s, h * s, r * s);
    }
  }

  private maple(x: number, z: number, s: number): void {
    block(this.scene, toon(COLORS.darkWood), [0.25 * s, 1.1 * s, 0.25 * s], [x, 0, z]);
    const geo = new THREE.IcosahedronGeometry(1, 0);
    for (const [dx, y, dz, r, c] of [
      [0, 1.6, 0, 0.9, COLORS.red],
      [0.5, 1.3, 0.3, 0.6, COLORS.orange],
      [-0.45, 1.4, -0.2, 0.6, 0x8f1d2c],
    ] as const) {
      const blob = mesh(this.scene, geo, toon(c), [x + dx * s, y * s, z + dz * s]);
      blob.scale.setScalar(r * s);
    }
  }

  private buildTrees(): void {
    for (let v = -23; v <= 23; v += 2.3) {
      for (const [x, z] of [[v, -21.5], [v, 21.5], [-21.5, v], [21.5, v]]) {
        if (Math.abs(x) < 2.5 && z > 0) continue;
        const jx = x + range(this.rand, -0.6, 0.6);
        const jz = z + range(this.rand, -0.6, 0.6);
        if (this.rand() < 0.75) this.pine(jx, jz, range(this.rand, 1.1, 1.6));
        else this.maple(jx, jz, range(this.rand, 1.0, 1.4));
      }
    }
    let placed = 0;
    for (let tries = 0; placed < 30 && tries < 600; tries++) {
      const x = range(this.rand, -19, 19);
      const z = range(this.rand, -19, 19);
      if (this.keepOut(x, z, 1.2)) continue;
      const s = range(this.rand, 0.8, 1.3);
      if (this.rand() < 0.6) this.pine(x, z, s);
      else this.maple(x, z, s);
      this.colliders.push(circle(x, z, 0.35 * s));
      placed++;
    }
  }

  private layPath(ax: number, az: number, bx: number, bz: number): void {
    const tile = 1.6;
    let x = Math.round(ax / tile);
    let z = Math.round(az / tile);
    const x1 = Math.round(bx / tile);
    const z1 = Math.round(bz / tile);
    const dx = Math.abs(x1 - x);
    const dz = Math.abs(z1 - z);
    const sx = x < x1 ? 1 : -1;
    const sz = z < z1 ? 1 : -1;
    let err = dx - dz;
    const dirt = toon(COLORS.dirt);
    for (;;) {
      block(this.scene, dirt, [tile, 0.02, tile], [x * tile, 0, z * tile]);
      if (x === x1 && z === z1) break;
      const e2 = 2 * err;
      if (e2 > -dz) {
        err -= dz;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        z += sz;
      }
    }
  }

  private animateFire(dt: number, time: number): void {
    const step = Math.floor(time * 6) % 4;
    this.fireLight.intensity = FIRE_INTENSITY * [0.85, 1, 0.92, 1][step];
    for (const [i, flame] of this.flames.entries()) {
      const squat = [0, 0.35, 1, 0.35][(step + i) % 4];
      const sy = 1 - 0.22 * squat;
      const sx = 1 / Math.sqrt(sy);
      flame.scale.set(sx, sy, sx);
      flame.position.y = 0.2 + (flame.userData.h * sy) / 2;
    }

    const pos = this.sparks.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.sparkState.length; i++) {
      const s = this.sparkState[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.life = range(this.rand, 1.0, 2.2);
        s.vx = range(this.rand, -0.6, 0.6);
        s.vy = range(this.rand, 1.0, 2.0);
        s.vz = range(this.rand, -0.6, 0.6);
        pos.setXYZ(i, range(this.rand, -0.3, 0.3), 0.9, range(this.rand, -0.3, 0.3));
      }
      pos.setXYZ(
        i,
        pos.getX(i) + (s.vx + Math.sin(time * 3 + i) * 0.4) * dt,
        pos.getY(i) + s.vy * dt,
        pos.getZ(i) + s.vz * dt,
      );
    }
    pos.needsUpdate = true;
  }
}
