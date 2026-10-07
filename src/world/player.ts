import * as THREE from 'three';
import { audio } from '../audio/audio';
import { toon } from '../render/materials';
import { block } from './props';

const SPEED = 4.5;
const RUN_SPEED = 9;
export const PLAYER_RADIUS = 0.35;
const CYCLE = 0.64;
const QUARTER = Math.PI / 2;

interface Pose {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  /** 0 stands tall. 1 is the shortest, widest body. */
  squat: number;
}

/** One stride per foot. Equal 0.40 rad steps, second half mirrors the first. Held, not blended. */
function stride(legL: number, squat: number): Pose {
  const legR = -legL;
  return { legL, legR, armL: -0.75 * legL, armR: -0.75 * legR, squat };
}

const POSES: Pose[] = [
  stride(0.6, 0.55),
  stride(0.2, 1),
  stride(-0.2, 0),
  stride(-0.6, 0.55),
  stride(-0.2, 1),
  stride(0.2, 0),
];

const STAND: Pose = { legL: 0, legR: 0, armL: 0, armR: 0, squat: 0 };
/** Hips rest on a log. Both legs bend forward; arms hang. */
const SIT: Pose = { legL: 1.35, legR: 1.35, armL: 0.25, armR: 0.25, squat: 0 };
const SEAT_LIFT = 0.12;

interface FoxPose {
  fl: number;
  fr: number;
  bl: number;
  br: number;
}

/** Diagonal trot. Held, not blended. */
const FOX_POSES: FoxPose[] = [
  { fl: 0.7, fr: -0.7, bl: -0.7, br: 0.7 },
  { fl: 0.25, fr: -0.25, bl: -0.25, br: 0.25 },
  { fl: -0.7, fr: 0.7, bl: 0.7, br: -0.7 },
  { fl: -0.25, fr: 0.25, bl: 0.25, br: -0.25 },
];
const FOX_STAND: FoxPose = { fl: 0, fr: 0, bl: 0, br: 0 };
/** Low crouch: all four legs tuck. */
const FOX_SIT: FoxPose = { fl: 1.15, fr: 1.15, bl: 1.15, br: 1.15 };
const FOX_SEAT_LIFT = 0.04;

/** Town player. Starts as a fox and can change into the kid in the yukata. */
export class Player {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly fox = new THREE.Group();
  private readonly legL: THREE.Group;
  private readonly legR: THREE.Group;
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private readonly foxFl: THREE.Group;
  private readonly foxFr: THREE.Group;
  private readonly foxBl: THREE.Group;
  private readonly foxBr: THREE.Group;
  private walkTime = 0;
  private poseIndex = -1;
  private facing = Math.PI;
  private seated = false;
  private foxForm = true;

  constructor() {
    const robe = toon(0x5f78ad);
    const skin = toon(0xf3e6c8);
    const ink = toon(0x07081a);
    this.legL = this.limb(this.body, toon(0x2b1a18), [0.16, 0.36, 0.18], [-0.12, 0.36, 0]);
    this.legR = this.limb(this.body, toon(0x2b1a18), [0.16, 0.36, 0.18], [0.12, 0.36, 0]);
    this.armL = this.limb(this.body, robe, [0.14, 0.34, 0.16], [-0.35, 0.78, 0]);
    this.armR = this.limb(this.body, robe, [0.14, 0.34, 0.16], [0.35, 0.78, 0]);
    block(this.body, robe, [0.56, 0.5, 0.38], [0, 0.32, 0]);
    block(this.body, toon(0xe8642c), [0.58, 0.1, 0.4], [0, 0.5, 0]);
    block(this.body, skin, [0.5, 0.46, 0.44], [0, 0.82, 0]);
    block(this.body, ink, [0.54, 0.16, 0.48], [0, 1.2, -0.02]);
    block(this.body, ink, [0.54, 0.22, 0.12], [0, 1.0, -0.2]);
    block(this.body, ink, [0.08, 0.08, 0.04], [-0.11, 0.94, 0.22]);
    block(this.body, ink, [0.08, 0.08, 0.04], [0.11, 0.94, 0.22]);
    block(this.body, toon(0xf3e6c8), [0.1, 0.34, 0.3], [0.3, 0.84, 0.02]);
    block(this.body, toon(0xc23a30), [0.11, 0.06, 0.2], [0.31, 0.9, 0.04]);
    block(this.body, toon(0xf3e6c8), [0.08, 0.12, 0.08], [0.31, 1.06, -0.06]);
    this.body.visible = false;
    this.group.add(this.body);

    const fur = toon(0xe8642c);
    const cream = toon(0xf3e6c8);
    const tip = toon(0xffffff);
    this.foxFl = this.limb(this.fox, fur, [0.12, 0.28, 0.12], [-0.12, 0.28, 0.22]);
    this.foxFr = this.limb(this.fox, fur, [0.12, 0.28, 0.12], [0.12, 0.28, 0.22]);
    this.foxBl = this.limb(this.fox, fur, [0.12, 0.28, 0.12], [-0.12, 0.28, -0.2]);
    this.foxBr = this.limb(this.fox, fur, [0.12, 0.28, 0.12], [0.12, 0.28, -0.2]);
    block(this.fox, fur, [0.34, 0.22, 0.62], [0, 0.26, 0]);
    block(this.fox, cream, [0.2, 0.1, 0.16], [0, 0.28, 0.34]);
    block(this.fox, fur, [0.3, 0.24, 0.28], [0, 0.36, 0.4]);
    block(this.fox, cream, [0.16, 0.1, 0.14], [0, 0.38, 0.54]);
    block(this.fox, ink, [0.06, 0.05, 0.04], [0, 0.42, 0.62]);
    block(this.fox, ink, [0.06, 0.05, 0.04], [-0.08, 0.5, 0.56]);
    block(this.fox, ink, [0.06, 0.05, 0.04], [0.08, 0.5, 0.56]);
    block(this.fox, fur, [0.08, 0.14, 0.06], [-0.08, 0.58, 0.4]);
    block(this.fox, fur, [0.08, 0.14, 0.06], [0.08, 0.58, 0.4]);
    block(this.fox, toon(0xc23a30), [0.04, 0.06, 0.02], [-0.08, 0.58, 0.44]);
    block(this.fox, toon(0xc23a30), [0.04, 0.06, 0.02], [0.08, 0.58, 0.44]);
    block(this.fox, fur, [0.12, 0.12, 0.36], [0, 0.38, -0.52]);
    block(this.fox, tip, [0.1, 0.1, 0.14], [0, 0.4, -0.76]);
    this.group.add(this.fox);

    this.applyFox(FOX_STAND);
    this.group.rotation.y = this.facing;
  }

  private limb(
    parent: THREE.Object3D,
    material: THREE.Material,
    size: [number, number, number],
    at: [number, number, number],
  ): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(at[0], at[1], at[2]);
    block(pivot, material, size, [0, -size[1], 0]);
    parent.add(pivot);
    return pivot;
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  get isSeated(): boolean {
    return this.seated;
  }

  get isFox(): boolean {
    return this.foxForm;
  }

  /** Swap fox and human. Standing up first avoids leaving a fox in the human sit. */
  henshin(): void {
    if (this.seated) this.stand();
    this.foxForm = !this.foxForm;
    this.fox.visible = this.foxForm;
    this.body.visible = !this.foxForm;
    this.walkTime = 0;
    this.poseIndex = -1;
    this.poseStand();
  }

  /** Hold the sit pose, facing `yaw`, with the hips lifted onto a bench. */
  sit(yaw: number): void {
    this.seated = true;
    this.walkTime = 0;
    this.poseIndex = -1;
    this.facing = yaw;
    this.group.rotation.y = yaw;
    this.position.y = this.foxForm ? FOX_SEAT_LIFT : SEAT_LIFT;
    if (this.foxForm) this.applyFox(FOX_SIT);
    else this.apply(SIT);
  }

  stand(): void {
    this.seated = false;
    this.walkTime = 0;
    this.poseIndex = -1;
    this.position.y = 0;
    this.poseStand();
  }

  /** `move` is a world-space ground direction with length 0..1. `sprint` doubles speed. */
  update(dt: number, move: THREE.Vector3, sprint = false): void {
    if (this.seated) return;
    const amount = move.length();
    if (amount > 0.01) {
      const running = sprint;
      this.position.addScaledVector(move, (running ? RUN_SPEED : SPEED) * dt);
      this.facing = Math.round(Math.atan2(move.x, move.z) / QUARTER) * QUARTER;
      this.group.rotation.y = this.facing;
      this.walkTime += dt;
      const count = this.foxForm ? FOX_POSES.length : POSES.length;
      const cycle = running ? CYCLE / 2 : CYCLE;
      const index = Math.floor(this.walkTime / (cycle / count)) % count;
      if (index !== this.poseIndex) {
        const step = this.foxForm ? index === 0 || index === 2 : index === 0 || index === 3;
        if (step) audio.step();
        this.poseIndex = index;
      }
      if (this.foxForm) this.applyFox(FOX_POSES[index]);
      else this.apply(POSES[index]);
    } else {
      this.walkTime = 0;
      this.poseIndex = -1;
      this.poseStand();
    }
  }

  private poseStand(): void {
    if (this.foxForm) this.applyFox(FOX_STAND);
    else this.apply(STAND);
  }

  private apply(pose: Pose): void {
    this.legL.rotation.x = pose.legL;
    this.legR.rotation.x = pose.legR;
    this.armL.rotation.x = pose.armL;
    this.armR.rotation.x = pose.armR;
    const scaleY = 1 - 0.18 * pose.squat;
    const scaleXZ = 1 / Math.sqrt(scaleY);
    this.body.scale.set(scaleXZ, scaleY, scaleXZ);
  }

  private applyFox(pose: FoxPose): void {
    this.foxFl.rotation.x = pose.fl;
    this.foxFr.rotation.x = pose.fr;
    this.foxBl.rotation.x = pose.bl;
    this.foxBr.rotation.x = pose.br;
  }
}
