import * as THREE from 'three';
import type { Direction } from '../../input';
import { glow, toon } from '../../render/materials';
import { block, mesh } from '../../world/props';
import type { SceneContext } from '../types';
import { Minigame } from './minigame';

const DIRS: Direction[] = ['up', 'right', 'down', 'left'];
const ROTATION: Record<Direction, number> = { up: 0, right: -Math.PI / 2, down: Math.PI, left: Math.PI / 2 };
const COLOR: Record<Direction, number> = { up: 0xffcf5c, right: 0x9adbc8, down: 0xf08fb0, left: 0xf59a3a };
const KEY_X: Record<Direction, number> = { left: -1.05, down: -0.35, up: 0.35, right: 1.05 };
const MISS_PAUSE = 0.35;

const headGeometry = new THREE.ConeGeometry(0.62, 0.62, 3);

function arrow(color: number): THREE.Group {
  const g = new THREE.Group();
  const m = glow(color);
  block(g, m, [0.34, 0.75, 0.1], [0, -0.6, 0]);
  const head = mesh(g, headGeometry, m, [0, 0.4, 0]);
  head.scale.z = 0.16;
  return g;
}

/** 快打键: press the shown arrow before it times out. Combos multiply points. */
export class QuickKeys extends Minigame {
  private readonly arrows = new Map<Direction, THREE.Group>();
  private readonly keys = new Map<Direction, THREE.Mesh>();
  private readonly timerBar: THREE.Mesh;
  private readonly paper = new THREE.Group();
  private readonly typist = new THREE.Group();
  private current: Direction = 'up';
  private window = 1.6;
  private left = 0;
  private pause = 0;
  private combo = 0;
  private pop = 0;
  private shake = 0;
  private readonly keyFlash = new Map<Direction, number>();

  constructor(ctx: SceneContext) {
    super(ctx, 'keys', 14, { dpad: true });
    this.scene.background = new THREE.Color(0x2b1a28);
    this.scene.add(new THREE.HemisphereLight(0xffd8b0, 0x2a1a2a, 2));
    const lamp = new THREE.PointLight(0xffb060, 10, 20, 0.6);
    lamp.position.set(-2.5, 6, 5);
    this.scene.add(lamp);

    block(this.scene, toon(0x6e4430), [9, 0.3, 4], [0, -0.3, 0]);
    block(this.scene, toon(0x4a2c22), [12, 8, 0.2], [0, -0.3, -2.2]);
    for (const x of [-4.4, 4.4]) block(this.scene, glow(0xffcf5c), [0.3, 0.4, 0.3], [x, 3.2, -2]);

    const t = this.typist;
    this.scene.add(t);
    block(t, toon(0xffcf5c, 0.15), [3, 0.9, 1.8], [0, 0, 0]);
    block(t, toon(0x2b1a18), [3.1, 0.12, 1.9], [0, 0.9, 0]);
    block(t, toon(0x1a2348), [2.7, 0.2, 0.6], [0, 0.95, -0.55]);
    for (const x of [-0.7, 0.7]) block(t, toon(0x07081a), [0.22, 0.26, 0.05], [x, 0.4, 0.92]);
    block(t, toon(0xf08fb0, 0.3), [0.5, 0.08, 0.05], [0, 0.2, 0.92]);
    for (const dir of DIRS) {
      const key = block(t, toon(0xf3e6c8, 0.2), [0.55, 0.22, 0.55], [KEY_X[dir], 1.02, 0.4]);
      this.keys.set(dir, key);
      const label = arrow(COLOR[dir]);
      label.scale.setScalar(0.22);
      label.rotation.set(-Math.PI / 2, 0, 0);
      const holder = new THREE.Group();
      holder.position.set(KEY_X[dir], 1.26, 0.4);
      holder.rotation.y = ROTATION[dir];
      holder.add(label);
      t.add(holder);
    }

    this.paper.position.set(0, 1.2, -0.7);
    t.add(this.paper);
    block(this.paper, toon(0xf3e6c8, 0.3), [2.3, 2.8, 0.05], [0, -0.1, -0.03]);
    block(this.paper, toon(0x1a2348), [2.1, 2.6, 0.06], [0, 0, 0]);
    for (const dir of DIRS) {
      const a = arrow(COLOR[dir]);
      a.position.set(0, 1.45, 0.08);
      a.rotation.z = ROTATION[dir];
      a.visible = false;
      this.paper.add(a);
      this.arrows.set(dir, a);
    }
    block(this.paper, toon(0x07081a), [1.7, 0.16, 0.05], [0, 0.25, 0.05]);
    this.timerBar = block(this.paper, glow(0x86ad5c), [1.6, 0.1, 0.06], [0, 0.28, 0.06]);
    this.focus.set(0, 1.8, 0);
  }

  resize(lowWidth: number, lowHeight: number): void {
    this.rig.setPixelsPerUnit(Math.min(lowWidth / 7, lowHeight / 6.2));
    this.rig.resize(lowWidth, lowHeight);
  }

  protected statsLine(): string {
    return `分数 ${this.score} · 连击 ${this.combo}（×${this.multiplier}）`;
  }

  private get multiplier(): number {
    return Math.min(5, 1 + Math.floor(this.combo / 5));
  }

  protected reset(): void {
    this.combo = 0;
    this.pause = 0;
    this.nextArrow();
  }

  onDirection(direction: Direction): void {
    this.keyFlash.set(direction, 0.15);
    if (!this.playing || this.pause > 0) return;
    if (direction === this.current) {
      this.addScore(this.multiplier);
      this.combo++;
      this.nextArrow();
    } else this.miss();
  }

  protected play(dt: number): void {
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause <= 0) this.nextArrow();
      return;
    }
    this.left -= dt;
    if (this.left <= 0) this.miss();
  }

  protected animate(dt: number, time: number): void {
    const frac = this.phase === 'play' ? Math.max(0, this.left / this.window) : 1;
    this.timerBar.scale.x = 1.6 * frac;
    this.timerBar.position.x = -0.8 * (1 - frac);
    this.pop = Math.max(0, this.pop - dt * 6);
    this.shake = Math.max(0, this.shake - dt);
    const a = this.arrows.get(this.current)!;
    a.scale.setScalar(1 + this.pop * 0.35);
    this.paper.position.x = this.shake > 0 ? Math.sin(this.shake * 60) * 0.12 : 0;
    this.typist.position.y = Math.abs(Math.sin(time * 4)) * 0.04;
    for (const dir of DIRS) {
      const f = Math.max(0, (this.keyFlash.get(dir) ?? 0) - dt);
      this.keyFlash.set(dir, f);
      this.keys.get(dir)!.position.y = 1.02 - (f > 0 ? 0.1 : 0);
    }
  }

  private nextArrow(): void {
    const options = DIRS.filter((d) => d !== this.current);
    this.current = options[Math.floor(Math.random() * options.length)];
    for (const [dir, a] of this.arrows) a.visible = dir === this.current;
    this.window = THREE.MathUtils.lerp(1.6, 0.7, Math.min(1, this.elapsed / 30));
    this.left = this.window;
    this.pop = 1;
  }

  private miss(): void {
    this.combo = 0;
    this.shake = 0.3;
    this.pause = MISS_PAUSE;
    for (const a of this.arrows.values()) a.visible = false;
  }
}
