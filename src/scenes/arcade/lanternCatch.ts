import * as THREE from 'three';
import { keyLight } from '../../render/keyLight';
import { glow, toon } from '../../render/materials';
import { range } from '../../util/random';
import { block, mesh } from '../../world/props';
import type { SceneContext } from '../types';
import { Minigame } from './minigame';

const HALF_WIDTH = 4.3;
const BASKET_SPEED = 9;
const DROP_Y = 7.6;

type Kind = 'lantern' | 'gold' | 'dud';
const POINTS: Record<Kind, number> = { lantern: 1, gold: 5, dud: -3 };

interface Drop {
  mesh: THREE.Group;
  kind: Kind;
  speed: number;
}

const dudGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 6);

function makeDrop(kind: Kind): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'dud') {
    const body = mesh(g, dudGeometry, glow(0xaab0c4), [0, 0, 0]);
    body.rotation.z = 0.3;
    block(g, toon(0x07081a), [0.44, 0.1, 0.44], [0, -0.08, 0]).rotation.z = 0.3;
    const spark = block(g, glow(0xfff0a8), [0.1, 0.1, 0.1], [-0.12, 0.34, 0]);
    spark.name = 'spark';
  } else {
    const s = kind === 'gold' ? 1.25 : 1;
    block(g, toon(0x2b1a18), [0.3 * s, 0.08, 0.3 * s], [0, 0.3 * s, 0]);
    block(g, glow(kind === 'gold' ? 0xffcf5c : 0xc23a30), [0.46 * s, 0.56 * s, 0.46 * s], [0, -0.27 * s, 0]);
    block(g, toon(0x2b1a18), [0.3 * s, 0.08, 0.3 * s], [0, -0.35 * s, 0]);
  }
  return g;
}

/** 接灯笼: move the basket, catch lanterns (+1, gold +5), avoid duds (−3). */
export class LanternCatch extends Minigame {
  private readonly basket = new THREE.Group();
  private drops: Drop[] = [];
  private spawnTimer = 0;
  private wobble = 0;

  constructor(ctx: SceneContext) {
    super(ctx, 'catch', 12, { joystick: true });
    this.scene.background = new THREE.Color(0x141a3c);
    this.scene.add(new THREE.HemisphereLight(0x8090c8, 0x2a1a2a, 1.8));
    this.scene.add(keyLight(0xb8c4ff, 1.2));

    block(this.scene, toon(0x335c3a), [16, 0.3, 4], [0, -0.3, 0]);
    for (let i = 0; i < 9; i++) {
      const x = -6 + i * 1.5;
      const h = 1.2 + ((i * 37) % 5) * 0.35;
      block(this.scene, toon(0x1a2348), [1.3, h, 0.8], [x, 0, -3]);
      block(this.scene, toon(0x2b1a18), [1.5, 0.15, 1], [x, h, -3]);
      block(this.scene, glow(0xffcf5c), [0.2, 0.2, 0.05], [x + 0.3, h * 0.5, -2.58]);
    }
    for (let i = 0; i < 12; i++) {
      const x = -5.5 + i;
      block(this.scene, glow(i % 3 ? 0xc23a30 : 0xffcf5c), [0.14, 0.14, 0.14], [x, 6.8 - Math.cos((i / 11) * Math.PI * 2) * 0.25, -2]);
    }

    const b = this.basket;
    block(b, toon(0x99653f, 0.15), [1.5, 0.5, 0.7], [0, 0, 0]);
    block(b, toon(0x6e4430), [1.6, 0.1, 0.8], [0, 0.5, 0]);
    for (let i = 0; i < 4; i++) block(b, toon(0x6e4430), [0.06, 0.5, 0.72], [-0.55 + i * 0.37, 0, 0.01]);
    this.scene.add(b);
    this.focus.set(0, 3.4, 0);
  }

  resize(lowWidth: number, lowHeight: number): void {
    this.rig.setPixelsPerUnit(Math.min(lowWidth / 10.5, lowHeight / 9));
    this.rig.resize(lowWidth, lowHeight);
  }

  protected reset(): void {
    for (const d of this.drops) this.scene.remove(d.mesh);
    this.drops = [];
    this.spawnTimer = 0.4;
    this.basket.position.set(0, 0, 0);
  }

  protected play(dt: number): void {
    const progress = Math.min(1, this.elapsed / 30);
    const bx = THREE.MathUtils.clamp(this.basket.position.x + this.ctx.move().x * BASKET_SPEED * dt, -HALF_WIDTH, HALF_WIDTH);
    this.basket.position.x = bx;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = THREE.MathUtils.lerp(0.65, 0.34, progress);
      const r = Math.random();
      const kind: Kind = r < 0.1 ? 'gold' : r < 0.1 + 0.16 + 0.14 * progress ? 'dud' : 'lantern';
      const m = makeDrop(kind);
      m.position.set(range(Math.random, -HALF_WIDTH, HALF_WIDTH), DROP_Y, 0);
      this.scene.add(m);
      this.drops.push({ mesh: m, kind, speed: range(Math.random, 3, 3.6) + progress * 2 });
    }

    for (const d of [...this.drops]) {
      d.mesh.position.y -= d.speed * dt;
      const y = d.mesh.position.y;
      if (y < 0.95 && y > 0.25 && Math.abs(d.mesh.position.x - bx) < 0.85) {
        this.addScore(POINTS[d.kind]);
        if (d.kind !== 'lantern') this.ctx.overlay.flash(d.kind === 'gold' ? '+5' : '−3', 500);
        if (d.kind === 'dud') this.wobble = 0.4;
        this.remove(d);
      } else if (y < -0.6) this.remove(d);
    }
  }

  protected animate(dt: number, time: number): void {
    this.wobble = Math.max(0, this.wobble - dt);
    this.basket.rotation.z = this.wobble > 0 ? Math.sin(this.wobble * 40) * 0.2 : 0;
    for (const d of this.drops) {
      d.mesh.rotation.z = Math.sin(time * 4 + d.mesh.position.x) * 0.15;
      const spark = d.mesh.getObjectByName('spark');
      if (spark) spark.visible = Math.sin(time * 30) > 0;
    }
  }

  private remove(d: Drop): void {
    this.scene.remove(d.mesh);
    this.drops = this.drops.filter((x) => x !== d);
  }
}
