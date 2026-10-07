import * as THREE from 'three';
import { CameraRig } from '../../render/cameraRig';
import { glow, toon } from '../../render/materials';
import { block, mesh } from '../../world/props';
import type { GameScene, SceneContext } from '../types';
import { ARCADE_GAMES, loadHighScores } from './arcadeData';

const CABINET_X = [-2.6, 0, 2.6];

function cabinet(screen: number, icon: (g: THREE.Group) => void): { group: THREE.Group; screen: THREE.Mesh } {
  const g = new THREE.Group();
  const shell = toon(0x5c2c6b, 0.1);
  block(g, shell, [1.3, 1.0, 0.9], [0, 0, 0]);
  block(g, shell, [1.3, 1.3, 0.6], [0, 1.0, -0.15]);
  block(g, toon(0x1a2348), [1.36, 0.1, 1.0], [0, 0.95, 0.02]);
  const s = block(g, toon(screen, 0.35), [1.0, 0.8, 0.05], [0, 1.25, 0.16]);
  block(g, glow(screen), [1.36, 0.3, 0.66], [0, 2.3, -0.15]);
  block(g, toon(0x07081a), [0.12, 0.25, 0.12], [-0.3, 1.0, 0.3]);
  block(g, glow(0xc23a30), [0.16, 0.08, 0.16], [-0.3, 1.25, 0.3]);
  for (const x of [0.15, 0.4]) block(g, glow(0xffcf5c), [0.14, 0.05, 0.14], [x, 1.0, 0.32]);
  const iconGroup = new THREE.Group();
  iconGroup.position.set(0, 1.65, 0.2);
  g.add(iconGroup);
  icon(iconGroup);
  return { group: g, screen: s };
}

const ICONS: ((g: THREE.Group) => void)[] = [
  (g) => {
    block(g, toon(0x07081a), [0.22, 0.3, 0.04], [0, -0.3, 0]);
    block(g, glow(0xc23a30), [0.26, 0.06, 0.05], [0, -0.12, 0.01]);
    block(g, glow(0xffffff), [0.6, 0.08, 0.04], [0, -0.38, -0.01]);
  },
  (g) => {
    block(g, glow(0x2b1a18), [0.12, 0.28, 0.04], [0, -0.4, 0]);
    const head = mesh(g, new THREE.ConeGeometry(0.2, 0.2, 3), glow(0x2b1a18), [0, -0.05, 0]);
    head.scale.z = 0.2;
  },
  (g) => {
    for (const [x, y] of [[-0.25, -0.2], [0.2, -0.35], [0, -0.05]] as const) {
      block(g, glow(0xc23a30), [0.16, 0.2, 0.04], [x, y, 0]);
    }
  },
];

/** A handheld-console mascot with legs. */
function pixelPal(): THREE.Group {
  const g = new THREE.Group();
  block(g, toon(0xf3e6c8, 0.15), [0.75, 1.0, 0.3], [0, 0.35, 0]);
  block(g, toon(0x9adbc8, 0.45), [0.55, 0.42, 0.04], [0, 0.82, 0.15]);
  for (const x of [-0.12, 0.12]) block(g, toon(0x07081a), [0.07, 0.1, 0.02], [x, 1.0, 0.18]);
  block(g, toon(0x07081a), [0.16, 0.04, 0.02], [0, 0.9, 0.18]);
  block(g, glow(0xc23a30), [0.12, 0.12, 0.04], [0.2, 0.52, 0.16]);
  block(g, toon(0x1a2348), [0.2, 0.06, 0.04], [-0.18, 0.55, 0.16]);
  block(g, toon(0x1a2348), [0.06, 0.2, 0.04], [-0.18, 0.55, 0.16]);
  for (const x of [-0.2, 0.2]) block(g, toon(0x1a2348), [0.1, 0.35, 0.1], [x, 0, 0]);
  return g;
}

/** 掌机仔街机厅: pick one of three cabinets. */
export class ArcadeHall implements GameScene {
  readonly scene = new THREE.Scene();
  readonly zoneId = 'arcade';
  private readonly rig = new CameraRig(28, 18);
  private readonly focus = new THREE.Vector3(0.3, 1.5, 0);
  private readonly screens: THREE.Mesh[] = [];
  private readonly marker: THREE.Mesh;
  private readonly pal = pixelPal();
  private selected = 0;
  private stickArmed = true;
  private introShown = false;

  constructor(private readonly ctx: SceneContext) {
    this.scene.background = new THREE.Color(0x120c24);
    this.scene.add(new THREE.HemisphereLight(0x8a6cc8, 0x1a1030, 1.6));
    const neon = new THREE.PointLight(0xf08fb0, 9, 18, 0.8);
    neon.position.set(0, 6, 3);
    this.scene.add(neon);

    for (let x = -5; x < 5; x++) {
      for (let z = -2; z < 3; z++) {
        block(this.scene, toon((x + z) % 2 ? 0x5c2c6b : 0x5c2c6b), [1, 0.2, 1], [x + 0.5, -0.2, z + 0.5]);
      }
    }
    block(this.scene, toon(0x1a2348), [10, 4, 0.3], [0, -0.2, -2.2]);
    block(this.scene, glow(0xf08fb0), [9, 0.08, 0.05], [0, 3.1, -2.02]);
    block(this.scene, glow(0x9adbc8), [9, 0.08, 0.05], [0, 2.9, -2.02]);
    for (const [i, x] of CABINET_X.entries()) {
      const c = cabinet(ARCADE_GAMES[i].screen, ICONS[i]);
      c.group.position.set(x, 0, -1);
      this.scene.add(c.group);
      this.screens.push(c.screen);
    }
    this.marker = mesh(this.scene, new THREE.ConeGeometry(0.22, 0.36, 4), glow(0xffcf5c), [0, 3.1, -1]);
    this.marker.rotation.x = Math.PI;
    this.marker.rotation.y = Math.PI / 4;
    this.pal.position.set(4.1, 0, 0.6);
    this.pal.rotation.y = -Math.PI / 2;
    this.scene.add(this.pal);
  }

  get camera(): THREE.Camera {
    return this.rig.camera;
  }

  resize(lowWidth: number, lowHeight: number): void {
    this.rig.setPixelsPerUnit(Math.min(lowWidth / 11, lowHeight / 7.8));
    this.rig.resize(lowWidth, lowHeight);
  }

  enter(): void {
    this.ctx.overlay.setHud({
      title: '掌机仔街机厅',
      hint: { desktop: '← → 选择 · 空格 开始 · Esc 返回', touch: '摇杆选择 · 点街机开始' },
      buttons: [
        { label: '开始', onClick: () => this.start() },
        { label: '返回小镇', onClick: () => this.onBack() },
      ],
      joystick: true,
      action: { label: '开始' },
    });
    this.ctx.overlay.setActionReady(true);
    this.select(this.selected);
    this.ctx.canvas.addEventListener('pointerdown', this.onPointerDown);
    if (!this.introShown && Object.values(loadHighScores()).every((v) => v === 0)) {
      this.introShown = true;
      this.ctx.overlay.openDialog('掌机仔', [
        '哔哔！欢迎来到街机厅！我是掌机仔。',
        '每台街机都是 30 秒的小游戏，破纪录我会帮你记下来。',
      ]);
    }
  }

  exit(): void {
    this.ctx.canvas.removeEventListener('pointerdown', this.onPointerDown);
  }

  onAction(): void {
    this.start();
  }

  onBack(): void {
    this.ctx.go('town');
  }

  update(dt: number, time: number): void {
    if (!this.ctx.isBusy()) {
      const x = this.ctx.move().x;
      if (Math.abs(x) < 0.3) this.stickArmed = true;
      else if (this.stickArmed && Math.abs(x) > 0.6) {
        this.stickArmed = false;
        this.select(this.selected + Math.sign(x));
      }
    }
    this.marker.position.x = THREE.MathUtils.damp(this.marker.position.x, CABINET_X[this.selected], 12, dt);
    const step = Math.floor(time * 4) % 4;
    this.marker.position.y = 3.1 + [0, 0.08, 0.15, 0.08][step];
    this.pal.position.y = [0, 0.04, 0.08, 0.04][step];
    this.rig.update(dt, this.focus);
  }

  private select(i: number): void {
    this.selected = (i + ARCADE_GAMES.length) % ARCADE_GAMES.length;
    this.screens.forEach((s, k) => {
      s.material = k === this.selected ? glow(ARCADE_GAMES[k].screen) : toon(ARCADE_GAMES[k].screen, 0.35);
    });
    const info = ARCADE_GAMES[this.selected];
    this.ctx.overlay.setStats(`▶ ${info.name}：${info.blurb}`, `最高分 ${loadHighScores()[info.id]}`);
  }

  private start(): void {
    if (this.ctx.isBusy()) return;
    this.ctx.go(ARCADE_GAMES[this.selected].id);
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.ctx.isBusy()) return;
    const hit = this.ctx.pick(e, this.rig.camera, 0);
    if (!hit || hit.z < -7 || hit.z > 2.5) return;
    const i = CABINET_X.findIndex((x) => Math.abs(hit.x - x) < 1.2);
    if (i < 0) return;
    if (i === this.selected) this.start();
    else this.select(i);
  };
}
