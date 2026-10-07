import * as THREE from 'three';
import { keyLight } from '../../render/keyLight';
import { glow, toon } from '../../render/materials';
import { range } from '../../util/random';
import { block, mesh } from '../../world/props';
import type { SceneContext } from '../types';
import { Minigame } from './minigame';

const LANES = [-1.5, 0, 1.5];
const PLAYER_Z = 3;
const SPAWN_Z = -26;
const ROW_GAP = 3.4;
const HIT_PENALTY = 3;

interface Thing {
  mesh: THREE.Object3D;
  lane: number;
  kind: 'snow' | 'fish';
}

const snowGeometry = new THREE.IcosahedronGeometry(0.55, 0);
const bodyGeometry = new THREE.SphereGeometry(0.42, 8, 6);

function penguin(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(g, bodyGeometry, toon(0x1a2348, 0.15), [0, 0.5, 0]);
  body.scale.set(1, 1.25, 0.9);
  const belly = mesh(g, bodyGeometry, toon(0xf3e6c8, 0.25), [0, 0.45, 0.12]);
  belly.scale.set(0.7, 1, 0.7);
  block(g, toon(0xe8642c, 0.3), [0.18, 0.08, 0.2], [0, 0.72, 0.38]);
  block(g, glow(0xc23a30), [0.7, 0.14, 0.6], [0, 0.82, 0]);
  block(g, glow(0xc23a30), [0.14, 0.4, 0.08], [0.2, 0.5, -0.36]);
  for (const x of [-0.18, 0.18]) block(g, toon(0xe8642c, 0.3), [0.18, 0.06, 0.26], [x, 0, 0.06]);
  return g;
}

function snowPile(): THREE.Group {
  const g = new THREE.Group();
  const a = mesh(g, snowGeometry, toon(0xffffff, 0.2), [0, 0.2, 0]);
  a.scale.set(1.1, 0.7, 0.9);
  const b = mesh(g, snowGeometry, toon(0xaab0c4, 0.2), [0.25, 0.45, 0.05]);
  b.scale.setScalar(0.55);
  return g;
}

function fish(): THREE.Group {
  const g = new THREE.Group();
  block(g, glow(0xf59a3a), [0.25, 0.28, 0.6], [0, 0.45, 0]);
  block(g, glow(0xffcf5c), [0.08, 0.36, 0.24], [0, 0.4, -0.38]);
  block(g, toon(0x07081a), [0.27, 0.06, 0.06], [0, 0.6, 0.18]);
  return g;
}

/** 企鹅滑冰: 3-lane runner. Score = fish eaten; hitting snow costs 3 seconds. */
export class IceSlide extends Minigame {
  private readonly player = penguin();
  private readonly world = new THREE.Group();
  private readonly posts: THREE.Group[] = [];
  private things: Thing[] = [];
  private lane = 1;
  private stickArmed = true;
  private travelled = 0;
  private nextRow = 0;
  private hurt = 0;

  constructor(ctx: SceneContext) {
    super(ctx, 'slide', 30, { joystick: true });
    this.scene.background = new THREE.Color(0x1a2550);
    this.scene.add(new THREE.HemisphereLight(0xb8c4ff, 0x2a3a5c, 2.2));
    this.scene.add(keyLight(0xffffff, 1.2));
    block(this.scene, toon(0x283766), [30, 0.2, 80], [0, -0.3, -20]);
    block(this.scene, toon(0xffffff, 0.1), [4.8, 0.1, 80], [0, -0.1, -20]);
    for (const x of [-0.75, 0.75]) block(this.scene, toon(0x9adbc8, 0.2), [0.06, 0.02, 80], [x, 0, -20]);
    for (const x of [-2.55, 2.55]) block(this.scene, toon(0xaab0c4), [0.3, 0.35, 80], [x, -0.1, -20]);
    const pine = new THREE.ConeGeometry(0.7, 1.6, 6);
    for (let i = 0; i < 20; i++) {
      const tree = mesh(this.scene, pine, toon(0x1f3f2c), [(i % 2 ? 1 : -1) * range(Math.random, 4.6, 7), 0.8, 6 - i * 2]);
      tree.scale.setScalar(range(Math.random, 0.8, 1.2));
    }
    this.scene.add(this.world, this.player);
    for (let i = 0; i < 16; i++) {
      const post = new THREE.Group();
      const x = i % 2 ? 3.2 : -3.2;
      block(post, toon(0x2b1a18), [0.1, 1.1, 0.1], [0, 0, 0]);
      block(post, glow(i % 4 < 2 ? 0xc23a30 : 0xffcf5c), [0.26, 0.32, 0.26], [0, 1.1, 0]);
      post.position.set(x, 0, 6 - Math.floor(i / 2) * 4);
      this.scene.add(post);
      this.posts.push(post);
    }
    this.player.position.set(0, 0, PLAYER_Z);
    this.player.rotation.y = Math.PI;
    this.focus.set(0, 0, -2.5);
  }

  resize(lowWidth: number, lowHeight: number): void {
    this.rig.setPixelsPerUnit(Math.min(lowWidth / 7.5, lowHeight / 9.5));
    this.rig.resize(lowWidth, lowHeight);
  }

  protected statsLine(): string {
    return `小鱼 ${this.score}`;
  }

  protected reset(): void {
    for (const t of this.things) this.world.remove(t.mesh);
    this.things = [];
    this.lane = 1;
    this.travelled = 0;
    this.nextRow = ROW_GAP;
    this.hurt = 0;
    this.player.position.x = LANES[1];
    this.player.rotation.z = 0;
  }

  protected play(dt: number): void {
    const x = this.ctx.move().x;
    if (Math.abs(x) < 0.3) this.stickArmed = true;
    else if (this.stickArmed && Math.abs(x) > 0.5) {
      this.stickArmed = false;
      this.lane = Math.max(0, Math.min(2, this.lane + Math.sign(x)));
    }

    const speed = 7 + this.elapsed * 0.16;
    const step = speed * dt;
    this.travelled += step;
    if (this.travelled >= this.nextRow) {
      this.nextRow += ROW_GAP;
      this.spawnRow();
    }
    for (const p of this.posts) {
      p.position.z += step;
      if (p.position.z > 8) p.position.z -= 32;
    }
    this.hurt = Math.max(0, this.hurt - dt);
    for (const t of [...this.things]) {
      t.mesh.position.z += step;
      if (t.mesh.position.z > 7) {
        this.remove(t);
        continue;
      }
      const near = Math.abs(t.mesh.position.z - PLAYER_Z) < 0.55;
      const sameLane = Math.abs(LANES[t.lane] - this.player.position.x) < 0.65;
      if (!near || !sameLane) continue;
      if (t.kind === 'fish') {
        this.addScore(1);
        this.remove(t);
      } else if (this.hurt <= 0) {
        this.timeLeft = Math.max(0, this.timeLeft - HIT_PENALTY);
        this.hurt = 0.7;
        this.ctx.overlay.flash(`−${HIT_PENALTY} 秒`, 600);
        this.remove(t);
      }
    }
  }

  protected animate(dt: number, time: number): void {
    this.player.position.x = THREE.MathUtils.damp(this.player.position.x, LANES[this.lane], 14, dt);
    this.player.rotation.z = this.hurt > 0 ? Math.sin(this.hurt * 30) * 0.4 : Math.sin(time * 8) * 0.05;
    const flip = Math.floor(time / 0.16) % 2 === 0 ? 1 : -1;
    for (const t of this.things) if (t.kind === 'fish') t.mesh.scale.x = flip;
  }

  private spawnRow(): void {
    const late = this.elapsed > 12;
    const snowLanes = new Set<number>();
    snowLanes.add(Math.floor(Math.random() * 3));
    if (late && Math.random() < 0.35) snowLanes.add(Math.floor(Math.random() * 3));
    if (snowLanes.size === 3) snowLanes.delete(0);
    for (const lane of snowLanes) this.add('snow', lane);
    const free = [0, 1, 2].filter((l) => !snowLanes.has(l));
    if (Math.random() < 0.65) this.add('fish', free[Math.floor(Math.random() * free.length)]);
  }

  private add(kind: Thing['kind'], lane: number): void {
    const m = kind === 'snow' ? snowPile() : fish();
    m.position.set(LANES[lane], 0, SPAWN_Z + range(Math.random, -0.4, 0.4));
    this.world.add(m);
    this.things.push({ mesh: m, lane, kind });
  }

  private remove(t: Thing): void {
    this.world.remove(t.mesh);
    this.things = this.things.filter((x) => x !== t);
  }
}
