import * as THREE from 'three';
import { audio } from '../../audio/audio';
import { CameraRig } from '../../render/cameraRig';
import { keyLight } from '../../render/keyLight';
import { toon } from '../../render/materials';
import { finiteOr, isRecord, loadJson, saveJson } from '../../save';
import { el, starText } from '../../ui/overlay';
import { block } from '../../world/props';
import type { GameScene, SceneContext } from '../types';
import {
  LEVELS,
  PIECES,
  budgetFor,
  buildable,
  opposite,
  parseLevel,
  pieceJoining,
  simulate,
  starsFor,
  type Board,
  type Dir,
  type Outcome,
  type Step,
} from './levels';
import {
  TILE,
  car,
  gate,
  lanternPole,
  locomotive,
  passenger,
  passengerHead,
  stall,
  station,
  tileFrame,
  trackPiece,
  trackPoint,
  tree,
} from './trainModels';

const SAVE_KEY = 'train.v1';
const PITCH = 48;
const SPEED = 2.6;
const CAR_GAP = 1.05;
const LOCO_START = 1.15;
/** How far into the gate tile the train rolls before stopping. */
const GATE_STOP = 0.42;

interface TrainSave {
  stars: number[];
}

function loadSave(): TrainSave {
  const raw = loadJson(SAVE_KEY, null, isRecord);
  const list: unknown[] = Array.isArray(raw?.stars) ? raw.stars : [];
  return { stars: LEVELS.map((_, i) => Math.max(0, Math.min(3, Math.floor(finiteOr(list[i], 0))))) };
}

const FAIL_TEXT: Record<Exclude<Outcome, 'clear'>, string> = {
  derail: '脱轨了！轨道没接上',
  missing: '还有客人没上车！',
  wrongSide: '要从夜市大门正面进站',
  loop: '火车一直在兜圈子…',
};

function stepLength(s: Step): number {
  return s.enter === opposite(s.exit) ? TILE : (Math.PI * TILE) / 4;
}

type Mode = 'build' | 'running' | 'done';

export class TrainScene implements GameScene {
  readonly scene = new THREE.Scene();
  readonly zoneId = 'train';
  private readonly rig = new CameraRig(PITCH, 16);
  private readonly save = loadSave();
  private level = 0;
  private board!: Board;
  private pieces: number[] = [];
  private mode: Mode = 'build';
  private active = false;
  private introShown = false;

  private boardGroup = new THREE.Group();
  private readonly pieceMeshes = new Map<number, THREE.Group>();
  private readonly passengerMeshes = new Map<number, THREE.Group>();
  private readonly loco = locomotive();
  private readonly wagon = car();
  private readonly hover = tileFrame();
  private readonly focus = new THREE.Vector3(0, 0.3, -0.5);
  private readonly tmp = new THREE.Vector2();
  private lowWidth = 1;
  private lowHeight = 1;

  private route: THREE.Vector2[] = [];
  private routeDist: number[] = [];
  private distance = LOCO_START;
  private outcome: Outcome = 'clear';
  private boardAt: { tile: number; at: number }[] = [];
  private boarded = 0;
  private tilt = 0;

  constructor(private readonly ctx: SceneContext) {
    this.scene.background = new THREE.Color(0x0f1430);
    this.scene.add(new THREE.HemisphereLight(0x5f78ad, 0x14291f, 1.7));
    this.scene.add(keyLight(0xb8c4ff, 1.5));
    block(this.scene, toon(0x14291f), [60, 0.1, 60], [0, -0.5, 0]);
    this.scene.add(this.loco, this.wagon.group, this.hover);
    this.hover.visible = false;
    const firstUncleared = this.save.stars.findIndex((s) => s === 0);
    this.loadLevel(firstUncleared < 0 ? 0 : firstUncleared);
  }

  get camera(): THREE.Camera {
    return this.rig.camera;
  }

  resize(lowWidth: number, lowHeight: number): void {
    this.lowWidth = lowWidth;
    this.lowHeight = lowHeight;
    this.fitCamera();
  }

  enter(): void {
    this.active = true;
    this.applyHud();
    this.ctx.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.ctx.canvas.addEventListener('pointermove', this.onPointerMove);
    this.ctx.canvas.addEventListener('contextmenu', this.onContextMenu);
    if (!this.introShown && this.save.stars[0] === 0) {
      this.introShown = true;
      this.ctx.overlay.openDialog('站长猫', [
        '喵～欢迎来到夜市火车站！今晚的客人都在等小火车。',
        '点格子放一段轨道，再点一次换个形状。',
        '把每位客人都接上，再从正门开进夜市。零件用得越少，星星越多！',
      ]);
    }
  }

  exit(): void {
    this.active = false;
    this.ctx.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.ctx.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.ctx.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.hover.visible = false;
  }

  onAction(): void {
    this.depart();
  }

  onBack(): void {
    this.ctx.go('town');
  }

  update(dt: number, time: number): void {
    if (this.mode === 'running') {
      const end = this.routeDist[this.routeDist.length - 1];
      this.distance = Math.min(end, this.distance + SPEED * dt);
      this.placeTrain();
      while (this.boarded < this.boardAt.length && this.distance >= this.boardAt[this.boarded].at) {
        this.boardPassenger(this.boardAt[this.boarded].tile);
      }
      if (this.distance >= end) this.finishRun();
    } else if (this.mode === 'done' && this.outcome !== 'clear' && this.tilt < 1) {
      this.tilt = Math.min(1, this.tilt + dt * 4);
      this.loco.rotation.z = (this.outcome === 'derail' ? 0.35 : 0.08) * this.tilt;
    }
    for (const [i, p] of this.passengerMeshes) p.position.y = Math.abs(Math.sin(time * 3 + i)) * 0.12;
    this.rig.update(dt, this.focus);
  }

  /** Test hook: place the solver's pieces. */
  setPieces(pieces: number[]): void {
    pieces.forEach((p, i) => {
      if (buildable(this.board, i)) this.setPiece(i, p);
    });
    this.publishStats();
  }

  private loadLevel(index: number): void {
    this.level = index;
    this.board = parseLevel(LEVELS[index]);
    this.pieces = new Array(this.board.width * this.board.height).fill(0);
    this.scene.remove(this.boardGroup);
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);
    this.pieceMeshes.clear();
    this.passengerMeshes.clear();
    this.buildBoard();
    this.resetTrain();
    this.fitCamera();
    if (this.active) this.applyHud();
  }

  private applyHud(): void {
    this.ctx.overlay.setHud({
      title: `夜市火车站 · 第 ${this.level + 1} 关「${LEVELS[this.level].name}」`,
      hint: {
        desktop: '点格子铺轨道（右键反向切换）· 空格 发车 · Esc 返回',
        touch: '点格子铺轨道 · 再点一次换形状',
      },
      buttons: [
        { label: '发车', onClick: () => this.depart() },
        { label: '重来', onClick: () => this.clearTrack() },
        { label: '关卡', onClick: () => this.showLevels() },
        { label: '返回小镇', onClick: () => this.onBack() },
      ],
    });
    this.publishStats();
  }

  private publishStats(): void {
    if (!this.active) return;
    const def = LEVELS[this.level];
    const best = this.save.stars[this.level];
    this.ctx.overlay.setStats(
      `零件 ${this.used()}/${budgetFor(def)} · 客人 ${this.boarded}/${this.board.passengers.length}`,
      `${def.par} 个零件以内得 ★★★${best ? ` · 最佳 ${starText(best)}` : ''}`,
    );
  }

  private used(): number {
    return this.pieces.filter((p) => p > 0).length;
  }

  private tileCenter(i: number, out = new THREE.Vector3()): THREE.Vector3 {
    const { width, height } = this.board;
    return out.set((i % width - (width - 1) / 2) * TILE, 0, (Math.floor(i / width) - (height - 1) / 2) * TILE);
  }

  private buildBoard(): void {
    const { width, height, tiles, chars, startDir, goalDir } = this.board;
    const g = this.boardGroup;
    block(g, toon(0x2b1a18), [width * TILE + 0.5, 0.3, height * TILE + 0.5], [0, -0.45, 0]);
    let passengerIndex = 0;
    for (let i = 0; i < tiles.length; i++) {
      const c = this.tileCenter(i);
      const checker = (i % width + Math.floor(i / width)) % 2;
      const tile = tiles[i];
      const color =
        tile === 'blocked' ? 0x14291f : tile === 'start' || tile === 'goal' ? 0x4a4e63 : checker ? 0x335c3a : 0x1f3f2c;
      block(g, toon(color), [TILE * 0.97, 0.3, TILE * 0.97], [c.x, -0.3, c.z]);
      const prop = new THREE.Group();
      prop.position.copy(c);
      g.add(prop);
      const ch = chars[i];
      if (ch === '#') stall(prop, i);
      else if (ch === 'T') tree(prop, i);
      else if (ch === 'L') lanternPole(prop);
      else if (tile === 'start') {
        station(prop, startDir);
        prop.add(trackPiece(pieceJoining(opposite(startDir), startDir), true));
      } else if (tile === 'goal') {
        gate(prop, goalDir);
        const light = new THREE.PointLight(0xffb060, 6, 4, 1.4);
        light.position.set(c.x, 1.6, c.z);
        g.add(light);
      } else if (tile === 'passenger') {
        const p = passenger(passengerIndex++);
        prop.add(p);
        this.passengerMeshes.set(i, p);
      } else if (tile === 'fixed') {
        prop.add(trackPiece(this.board.fixed.get(i) ?? 0, true));
      }
    }
  }

  private fitCamera(): void {
    if (!this.board) return;
    const portrait = this.lowHeight > this.lowWidth * 1.2;
    const across = (portrait ? this.board.height : this.board.width) * TILE + 1.6;
    const deep = (portrait ? this.board.width : this.board.height) * TILE;
    const h = deep * Math.sin(THREE.MathUtils.degToRad(PITCH)) + 3.4;
    this.rig.setQuarterTurns(portrait ? 1 : 0);
    this.focus.set(portrait ? -0.5 : 0, 0.3, portrait ? 0 : -0.5);
    this.rig.setPixelsPerUnit(Math.min(this.lowWidth / across, this.lowHeight / h));
    this.rig.resize(this.lowWidth, this.lowHeight);
  }

  private tileAt(e: PointerEvent): number | null {
    const hit = this.ctx.pick(e, this.rig.camera, 0);
    if (!hit) return null;
    const { width, height } = this.board;
    const x = Math.floor(hit.x / TILE + width / 2);
    const y = Math.floor(hit.z / TILE + height / 2);
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    return y * width + x;
  }

  private readonly onContextMenu = (e: Event): void => e.preventDefault();

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    const i = this.tileAt(e);
    const show = i !== null && buildable(this.board, i) && this.mode !== 'running';
    this.hover.visible = show;
    if (i !== null && show) this.tileCenter(i, this.hover.position).setY(0.01);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.ctx.isBusy() || this.mode === 'running') return;
    const i = this.tileAt(e);
    if (i === null) return;
    if (!buildable(this.board, i)) {
      if (this.board.tiles[i] === 'fixed') this.ctx.overlay.toast('这段旧轨道不能动');
      return;
    }
    this.cycle(i, e.button === 2 ? -1 : 1);
  };

  private cycle(i: number, step: 1 | -1): void {
    if (this.mode === 'done') this.resetTrain();
    const current = this.pieces[i];
    const next = (current + step + PIECES.length) % PIECES.length;
    if (current === 0 && this.used() >= budgetFor(LEVELS[this.level])) {
      this.ctx.overlay.toast('零件用完了，先拆掉一些吧');
      return;
    }
    this.setPiece(i, next);
    this.publishStats();
  }

  private setPiece(i: number, piece: number): void {
    this.pieces[i] = piece;
    const old = this.pieceMeshes.get(i);
    if (old) this.boardGroup.remove(old);
    this.pieceMeshes.delete(i);
    if (piece === 0) return;
    const m = trackPiece(piece, false);
    this.tileCenter(i, m.position);
    this.boardGroup.add(m);
    this.pieceMeshes.set(i, m);
  }

  private clearTrack(): void {
    if (this.mode === 'running') return;
    for (let i = 0; i < this.pieces.length; i++) if (this.pieces[i]) this.setPiece(i, 0);
    this.resetTrain();
    this.publishStats();
  }

  private resetTrain(): void {
    this.mode = 'build';
    this.boarded = 0;
    this.tilt = 0;
    this.loco.rotation.z = 0;
    for (const p of this.passengerMeshes.values()) p.visible = true;
    this.wagon.seats.clear();
    this.buildRoute([], null);
    this.distance = LOCO_START;
    this.placeTrain();
  }

  /** Polyline through the station, every track step, and (optionally) into the gate. */
  private buildRoute(steps: Step[], gateEnter: Dir | null): void {
    const pts: THREE.Vector2[] = [];
    const p = new THREE.Vector2();
    const c = new THREE.Vector3();
    const push = (tile: number, enter: Dir, exit: Dir, to: number, n: number) => {
      this.tileCenter(tile, c);
      for (let k = 0; k <= n; k++) {
        trackPoint(enter, exit, (to * k) / n, p);
        const q = new THREE.Vector2(c.x + p.x, c.z + p.y);
        if (pts.length === 0 || q.distanceToSquared(pts[pts.length - 1]) > 1e-6) pts.push(q);
      }
    };
    const startDir = this.board.startDir;
    push(this.board.start, opposite(startDir), startDir, 1, 2);
    for (const s of steps) push(s.tile, s.enter, s.exit, 1, s.enter === opposite(s.exit) ? 2 : 8);
    if (gateEnter !== null) push(this.board.goal, gateEnter, opposite(gateEnter), GATE_STOP, 2);
    this.route = pts;
    this.routeDist = [0];
    for (let k = 1; k < pts.length; k++) this.routeDist.push(this.routeDist[k - 1] + pts[k].distanceTo(pts[k - 1]));
  }

  /** Position at route distance `d`; returns the heading there. */
  private sample(d: number, out: THREE.Vector2): number {
    const r = this.route;
    const dist = this.routeDist;
    const clamped = Math.max(0, Math.min(dist[dist.length - 1], d));
    let k = 1;
    while (k < r.length - 1 && dist[k] < clamped) k++;
    const t = (clamped - dist[k - 1]) / (dist[k] - dist[k - 1] || 1);
    out.lerpVectors(r[k - 1], r[k], t);
    return Math.atan2(r[k].x - r[k - 1].x, r[k].y - r[k - 1].y);
  }

  private placeTrain(): void {
    this.loco.rotation.y = this.sample(this.distance, this.tmp);
    this.loco.position.set(this.tmp.x, 0.05, this.tmp.y);
    this.wagon.group.rotation.y = this.sample(this.distance - CAR_GAP, this.tmp);
    this.wagon.group.position.set(this.tmp.x, 0.05, this.tmp.y);
  }

  private depart(): void {
    if (this.ctx.isBusy() || this.mode === 'running') return;
    const result = simulate(this.board, this.pieces);
    this.resetTrain();
    const reachedGate = result.outcome !== 'derail' && result.outcome !== 'loop';
    this.buildRoute(result.steps, reachedGate ? opposite(result.endDir) : null);
    this.outcome = result.outcome;
    this.boardAt = [];
    let along = TILE;
    for (const s of result.steps) {
      const len = stepLength(s);
      if (this.board.tiles[s.tile] === 'passenger' && !this.boardAt.some((b) => b.tile === s.tile)) {
        this.boardAt.push({ tile: s.tile, at: along + len / 2 });
      }
      along += len;
    }
    this.mode = 'running';
    this.hover.visible = false;
    audio.depart();
  }

  private boardPassenger(tile: number): void {
    const p = this.passengerMeshes.get(tile);
    if (p) p.visible = false;
    const seat = this.boarded;
    const head = passengerHead([...this.passengerMeshes.keys()].indexOf(tile));
    head.position.set(seat % 2 ? 0.14 : -0.14, 0, 0.22 - Math.floor(seat / 2) * 0.3);
    this.wagon.seats.add(head);
    this.boarded++;
    this.publishStats();
  }

  private finishRun(): void {
    this.mode = 'done';
    this.publishStats();
    if (this.outcome !== 'clear') {
      this.ctx.overlay.toast(FAIL_TEXT[this.outcome]);
      return;
    }
    const def = LEVELS[this.level];
    const used = this.used();
    const stars = starsFor(used, def.par);
    if (stars > this.save.stars[this.level]) {
      this.save.stars[this.level] = stars;
      saveJson(SAVE_KEY, this.save);
    }
    this.publishStats();
    const last = this.level === LEVELS.length - 1;
    const body = el('div', '');
    el('div', 'result-stars', body, starText(stars));
    const lines = [`用了 ${used} 个零件（最少 ${def.par} 个）。`];
    if (stars < 3) lines.push(`少用 ${used - def.par} 个就能拿 ★★★！`);
    if (last) lines.push('所有客人都到夜市啦，谢谢你！');
    el('div', 'panel-text', body, lines.join('\n'));
    const level = this.level;
    window.setTimeout(() => {
      if (this.mode !== 'done' || this.level !== level || !this.active) return;
      this.ctx.overlay.showPanel(
        last ? '全部通关！' : '到站啦！',
        body,
        [
          ...(last ? [] : [{ label: '下一关', primary: true, onClick: () => this.loadLevel(this.level + 1) }]),
          { label: '再玩一次', primary: last, onClick: () => this.clearTrack() },
          { label: '关卡', onClick: () => this.showLevels() },
        ],
        false,
      );
    }, 450);
  }

  private showLevels(): void {
    if (this.mode === 'running') return;
    const grid = el('div', 'card-grid');
    LEVELS.forEach((def, i) => {
      const open = i === 0 || this.save.stars[i - 1] > 0;
      const card = el('button', `card${open ? '' : ' locked'}${i === this.level ? ' selected' : ''}`, grid);
      card.disabled = !open;
      el('div', 'card-name', card, `第 ${i + 1} 关`);
      el('div', 'card-hint', card, open ? def.name : '通关上一关解锁');
      el('div', 'result-stars small', card, open ? starText(this.save.stars[i]) : '未解锁');
      card.addEventListener('click', () => {
        this.ctx.overlay.hidePanel();
        this.loadLevel(i);
      });
    });
    this.ctx.overlay.showPanel('选择关卡', grid);
  }
}
