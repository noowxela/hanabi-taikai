import * as THREE from 'three';
import { audio } from '../../audio/audio';
import { CameraRig } from '../../render/cameraRig';
import { keyLight } from '../../render/keyLight';
import { glow, toon } from '../../render/materials';
import { finiteOr, isRecord, loadJson, saveJson } from '../../save';
import { el, starText } from '../../ui/overlay';
import { mulberry32, range } from '../../util/random';
import { block, mesh } from '../../world/props';
import type { GameScene, SceneContext } from '../types';
import {
  CAMPFIRE,
  FIRE_HP,
  GUARDIANS,
  PADS,
  PATH,
  SPIRITS,
  START_EMBERS,
  UPGRADE_DAMAGE,
  WAVES,
  starsForHp,
  waveBonus,
  type GuardianDef,
  type GuardianId,
  type SpiritDef,
} from './watchData';
import { campfire, guardian, pine, spirit, type CampfireModel, type SpiritModel } from './watchModels';

const SAVE_KEY = 'watch.v1';
const PAD_PICK_RADIUS = 1.0;
const SHOT_SPEED = 11;
const SPAWN_GAP = 0.9;
const BIG_SPAWN_GAP = 1.6;

interface WatchSave {
  bestStars: number;
  bestWave: number;
}

function loadSave(): WatchSave {
  const raw = loadJson(SAVE_KEY, null, isRecord);
  return {
    bestStars: Math.max(0, Math.min(3, Math.floor(finiteOr(raw?.bestStars, 0)))),
    bestWave: Math.max(0, Math.min(WAVES.length, Math.floor(finiteOr(raw?.bestWave, 0)))),
  };
}

interface Spirit {
  def: SpiritDef;
  model: SpiritModel;
  s: number;
  hp: number;
}

interface Guardian {
  def: GuardianDef;
  level: number;
  spent: number;
  model: THREE.Group;
  cooldown: number;
}

interface Shot {
  mesh: THREE.Mesh;
  target: Spirit;
  damage: number;
}

interface Fx {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  kind: 'pulse' | 'ember';
  scale: number;
}

type Phase = 'idle' | 'wave' | 'won' | 'lost';

const segments = PATH.slice(1).map(([x, z], i) => {
  const [px, pz] = PATH[i];
  return { x0: px, z0: pz, dx: x - px, dz: z - pz, len: Math.hypot(x - px, z - pz) };
});
const PATH_LENGTH = segments.reduce((sum, s) => sum + s.len, 0);

/** Point at distance `s` along the path. */
function pathAt(s: number, out: THREE.Vector3): THREE.Vector3 {
  let left = Math.max(0, s);
  for (const seg of segments) {
    if (left <= seg.len) return out.set(seg.x0 + (seg.dx * left) / seg.len, 0, seg.z0 + (seg.dz * left) / seg.len);
    left -= seg.len;
  }
  const last = segments[segments.length - 1];
  return out.set(last.x0 + last.dx, 0, last.z0 + last.dz);
}

function distanceToPath(x: number, z: number): number {
  let best = Infinity;
  for (const s of segments) {
    const t = Math.max(0, Math.min(1, ((x - s.x0) * s.dx + (z - s.z0) * s.dz) / (s.len * s.len)));
    best = Math.min(best, Math.hypot(x - (s.x0 + s.dx * t), z - (s.z0 + s.dz * t)));
  }
  return best;
}

const ONE = new THREE.Vector3(1, 1, 1);
const ringGeometry = new THREE.RingGeometry(0.92, 1, 28);
const shotGeometry = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const emberGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);

export class WatchScene implements GameScene {
  readonly scene = new THREE.Scene();
  readonly zoneId = 'watch';
  private readonly rig = new CameraRig(50, 14);
  private readonly save = loadSave();
  private readonly focus = new THREE.Vector3(-1.3, 0, -0.4);
  private readonly tmp = new THREE.Vector3();
  private readonly fire: CampfireModel;
  private readonly hoverRing: THREE.Mesh;
  private readonly rangeRing: THREE.Mesh;
  private readonly auras = new Map<number, THREE.Mesh>();

  private phase: Phase = 'idle';
  private wave = 0;
  private hp = FIRE_HP;
  private embers = START_EMBERS;
  private speed = 1;
  private queue: SpiritDef[] = [];
  private spawnTimer = 0;
  private auraVoice = 0;
  private spirits: Spirit[] = [];
  private guardians: (Guardian | null)[] = PADS.map(() => null);
  private shots: Shot[] = [];
  private fx: Fx[] = [];
  private statsDirty = true;
  private active = false;
  private introShown = false;

  constructor(private readonly ctx: SceneContext) {
    this.scene.background = new THREE.Color(0x0b1028);
    this.scene.add(new THREE.HemisphereLight(0x6a80b8, 0x14291f, 1.9));
    this.scene.add(keyLight(0xb8c4ff, 1.5));
    this.buildMap();
    this.fire = campfire();
    this.fire.group.position.set(CAMPFIRE[0], 0, CAMPFIRE[1]);
    this.scene.add(this.fire.group);

    const ringMat = (color: number, opacity: number) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.72, 16), ringMat(0xffcf5c, 0.9));
    this.hoverRing.rotation.x = -Math.PI / 2;
    this.hoverRing.visible = false;
    this.rangeRing = new THREE.Mesh(ringGeometry, ringMat(0xffcf5c, 0.55));
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeRing.visible = false;
    this.scene.add(this.hoverRing, this.rangeRing);
  }

  get camera(): THREE.Camera {
    return this.rig.camera;
  }

  resize(lowWidth: number, lowHeight: number): void {
    const portrait = lowHeight > lowWidth * 1.2;
    this.rig.setQuarterTurns(portrait ? 1 : 0);
    this.rig.setPixelsPerUnit(
      portrait ? Math.min(lowWidth / 13.5, lowHeight / 19) : Math.min(lowWidth / 20, lowHeight / 14.5),
    );
    this.rig.resize(lowWidth, lowHeight);
  }

  enter(): void {
    this.active = true;
    this.ctx.overlay.setHud({
      title: '守夜塔',
      hint: {
        desktop: '点石台放守护者 · 空格 开始下一波 · Esc 返回',
        touch: '点石台放守护者',
      },
    });
    this.refreshButtons();
    this.statsDirty = true;
    this.ctx.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.ctx.canvas.addEventListener('pointermove', this.onPointerMove);
    if (!this.introShown && this.save.bestWave === 0) {
      this.introShown = true;
      this.ctx.overlay.openDialog('守夜猫头鹰', [
        '咕咕…今晚面具妖怪会从森林里出来，想扑灭营火。',
        '点路边的石台放守护者：烟花筒打单体，太鼓震一圈，灯笼让妖怪变慢。',
        '打倒妖怪能拿火种。守住 5 波，营火越旺星星越多！',
      ]);
    }
  }

  exit(): void {
    this.active = false;
    this.ctx.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.ctx.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.hoverRing.visible = false;
    this.rangeRing.visible = false;
  }

  onAction(): void {
    this.startWave();
  }

  onBack(): void {
    this.ctx.go('town');
  }

  update(dt: number, time: number): void {
    this.auraVoice = Math.max(0, this.auraVoice - dt);
    if (!this.ctx.isBusy() && this.phase === 'wave') this.simulate(dt * this.speed);
    this.animateFx(dt);
    this.animateFire(time);
    for (const sp of this.spirits) sp.model.body.position.y = Math.abs(Math.sin(time * 6 + sp.s)) * 0.08;
    if (this.statsDirty && this.active) this.publishStats();
    this.rig.update(dt, this.focus);
  }

  private simulate(dt: number): void {
    this.spawnTimer -= dt;
    if (this.queue.length > 0 && this.spawnTimer <= 0) {
      const def = this.queue.shift()!;
      this.spawn(def);
      this.spawnTimer = def.id === 'big' || def.id === 'boss' ? BIG_SPAWN_GAP : SPAWN_GAP;
    }

    for (const sp of [...this.spirits]) {
      pathAt(sp.s, this.tmp);
      let slow = 0;
      for (const [i, g] of this.guardians.entries()) {
        if (!g || g.def.id !== 'lantern') continue;
        if (Math.hypot(this.tmp.x - PADS[i][0], this.tmp.z - PADS[i][1]) > g.def.range) continue;
        slow = Math.max(slow, g.def.slow + (g.level > 1 ? 0.15 : 0));
        const ping = this.auraVoice <= 0;
        this.damage(sp, this.damageOf(g) * dt, ping);
        if (ping) this.auraVoice = 0.45;
      }
      if (sp.hp <= 0) continue;
      sp.s += sp.def.speed * (1 - slow) * dt;
      if (sp.s >= PATH_LENGTH) {
        this.removeSpirit(sp);
        this.hp = Math.max(0, this.hp - sp.def.harm);
        this.statsDirty = true;
        this.ctx.overlay.toast(`营火被扑到了！-${sp.def.harm}`);
        if (this.hp <= 0) {
          this.finish(false);
          return;
        }
        continue;
      }
      pathAt(sp.s, this.tmp);
      sp.model.group.position.copy(this.tmp);
    }

    for (const [i, g] of this.guardians.entries()) {
      if (!g || g.def.interval === 0) continue;
      g.cooldown -= dt;
      if (g.cooldown > 0) continue;
      const [px, pz] = PADS[i];
      const inRange = this.spirits.filter(
        (sp) => Math.hypot(sp.model.group.position.x - px, sp.model.group.position.z - pz) <= g.def.range,
      );
      if (inRange.length === 0) continue;
      g.cooldown = g.def.interval;
      if (g.def.id === 'firework') {
        const target = inRange.reduce((a, b) => (b.s > a.s ? b : a));
        const m = mesh(this.scene, shotGeometry, glow(g.level > 1 ? 0xffcf5c : 0xe8642c), [px, 1.1, pz]);
        this.shots.push({ mesh: m, target, damage: this.damageOf(g) });
      } else {
        for (const sp of inRange) this.damage(sp, this.damageOf(g), true);
        this.addFx('pulse', px, 0.05, pz, 0.5, g.def.range);
        g.model.scale.set(1.12, 0.88, 1.12);
      }
    }

    for (const shot of [...this.shots]) {
      const t = shot.target;
      if (t.hp <= 0 || !this.spirits.includes(t)) {
        this.removeShot(shot);
        continue;
      }
      this.tmp.copy(t.model.group.position).setY(0.5 * t.def.size);
      const to = this.tmp.sub(shot.mesh.position);
      const d = to.length();
      if (d < 0.3) {
        this.damage(t, shot.damage, true);
        this.removeShot(shot);
      } else shot.mesh.position.addScaledVector(to, Math.min(1, (SHOT_SPEED * dt) / d));
    }

    for (const g of this.guardians) g?.model.scale.lerp(ONE, Math.min(1, dt * 8));

    if (this.queue.length === 0 && this.spirits.length === 0) this.endWave();
  }

  private damageOf(g: Guardian): number {
    return g.def.damage * (g.level > 1 ? UPGRADE_DAMAGE : 1);
  }

  private damage(sp: Spirit, amount: number, hitSound: boolean): void {
    if (sp.hp <= 0) return;
    sp.hp -= amount;
    if (hitSound) audio.hit();
    const frac = Math.max(0, sp.hp / sp.def.hp);
    sp.model.hpBar.scale.x = 0.66 * frac;
    sp.model.hpBar.position.x = -0.33 * (1 - frac);
    if (sp.hp > 0) return;
    this.embers += sp.def.embers;
    this.statsDirty = true;
    const p = sp.model.group.position;
    for (let i = 0; i < Math.min(6, sp.def.embers + 1); i++) {
      this.addFx('ember', p.x + range(Math.random, -0.3, 0.3), 0.5, p.z + range(Math.random, -0.3, 0.3), 0.7, 1);
    }
    this.removeSpirit(sp);
  }

  private spawn(def: SpiritDef): void {
    const model = spirit(def);
    this.scene.add(model.group);
    pathAt(0, this.tmp);
    model.group.position.copy(this.tmp);
    this.spirits.push({ def, model, s: 0, hp: def.hp });
  }

  private removeSpirit(sp: Spirit): void {
    this.scene.remove(sp.model.group);
    this.spirits = this.spirits.filter((s) => s !== sp);
  }

  private removeShot(shot: Shot): void {
    this.scene.remove(shot.mesh);
    this.shots = this.shots.filter((s) => s !== shot);
  }

  private addFx(kind: Fx['kind'], x: number, y: number, z: number, life: number, scale: number): void {
    const m =
      kind === 'pulse'
        ? new THREE.Mesh(
            ringGeometry,
            new THREE.MeshBasicMaterial({ color: 0xffcf5c, transparent: true, opacity: 0.9, depthWrite: false }),
          )
        : new THREE.Mesh(emberGeometry, glow(0xffcf5c));
    if (kind === 'pulse') m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    this.scene.add(m);
    this.fx.push({ mesh: m, age: 0, life, kind, scale });
  }

  private animateFx(dt: number): void {
    for (const f of [...this.fx]) {
      f.age += dt;
      const t = f.age / f.life;
      if (f.kind === 'pulse') {
        f.mesh.scale.setScalar(f.scale * (0.3 + 0.7 * t));
        (f.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      } else {
        f.mesh.position.y += dt * 1.6;
      }
      if (t >= 1) {
        this.scene.remove(f.mesh);
        if (f.kind === 'pulse') (f.mesh.material as THREE.Material).dispose();
        this.fx = this.fx.filter((x) => x !== f);
      }
    }
  }

  private animateFire(time: number): void {
    const strength = 0.3 + 0.7 * (this.hp / FIRE_HP);
    const n = Math.sin(time * 13) * 0.5 + Math.sin(time * 7.3) * 0.3 + Math.sin(time * 23.1) * 0.2;
    this.fire.light.intensity = 14 * strength * (0.85 + 0.15 * n);
    for (const [i, f] of this.fire.flames.entries()) {
      const sy = (1 + Math.sin(time * (9 + i * 3) + i) * 0.12) * strength;
      f.scale.set(strength, sy, strength);
      f.position.y = 0.2 + (f.userData.h * sy) / 2;
    }
  }

  private startWave(): void {
    if (this.phase !== 'idle' || this.ctx.isBusy()) return;
    this.phase = 'wave';
    this.queue = WAVES[this.wave].map((id) => SPIRITS[id]);
    this.spawnTimer = 0;
    this.ctx.overlay.flash(`第 ${this.wave + 1} 波！`);
    this.refreshButtons();
    this.statsDirty = true;
  }

  private endWave(): void {
    this.wave++;
    this.save.bestWave = Math.max(this.save.bestWave, this.wave);
    saveJson(SAVE_KEY, this.save);
    for (const s of this.shots) this.scene.remove(s.mesh);
    this.shots = [];
    if (this.wave >= WAVES.length) {
      this.finish(true);
      return;
    }
    const bonus = waveBonus(this.wave);
    this.embers += bonus;
    this.phase = 'idle';
    this.ctx.overlay.toast(`第 ${this.wave} 波守住了！火种 +${bonus}`);
    this.refreshButtons();
    this.statsDirty = true;
  }

  private finish(won: boolean): void {
    this.phase = won ? 'won' : 'lost';
    this.refreshButtons();
    this.statsDirty = true;
    const stars = won ? starsForHp(this.hp) : 0;
    if (stars > this.save.bestStars) this.save.bestStars = stars;
    saveJson(SAVE_KEY, this.save);
    const body = el('div', '');
    if (won) el('div', 'result-stars', body, starText(stars));
    el(
      'div',
      'panel-text',
      body,
      won
        ? `营火还剩 ${this.hp}/${FIRE_HP}。${stars < 3 ? '\n营火剩 8 以上能拿 ★★★！' : '\n一只妖怪都没靠近，太厉害了！'}`
        : `撑到了第 ${this.wave + 1} 波。多放几个守护者再试试吧！`,
    );
    const phase = this.phase;
    window.setTimeout(() => {
      if (this.phase !== phase || !this.active) return;
      this.ctx.overlay.showPanel(
        won ? '守住营火了！' : '营火熄灭了…',
        body,
        [
          { label: '再来一次', primary: true, onClick: () => this.restart() },
          { label: '返回小镇', onClick: () => this.onBack() },
        ],
        false,
      );
    }, 500);
  }

  private restart(): void {
    for (const sp of this.spirits) this.scene.remove(sp.model.group);
    for (const s of this.shots) this.scene.remove(s.mesh);
    for (const f of this.fx) this.scene.remove(f.mesh);
    for (const g of this.guardians) if (g) this.scene.remove(g.model);
    for (const a of this.auras.values()) this.scene.remove(a);
    this.auras.clear();
    this.spirits = [];
    this.shots = [];
    this.fx = [];
    this.guardians = PADS.map(() => null);
    this.queue = [];
    this.phase = 'idle';
    this.wave = 0;
    this.hp = FIRE_HP;
    this.embers = START_EMBERS;
    this.refreshButtons();
    this.statsDirty = true;
  }

  private refreshButtons(): void {
    if (!this.active) return;
    const label =
      this.phase === 'wave'
        ? `第 ${this.wave + 1} 波进行中`
        : this.phase === 'idle'
          ? `开始第 ${this.wave + 1} 波`
          : '已结束';
    this.ctx.overlay.setButtons([
      { label, disabled: this.phase !== 'idle', onClick: () => this.startWave() },
      {
        label: `速度 ×${this.speed}`,
        onClick: () => {
          this.speed = this.speed === 1 ? 2 : 1;
          this.refreshButtons();
        },
      },
      { label: '重新开始', onClick: () => this.restart() },
      { label: '返回小镇', onClick: () => this.onBack() },
    ]);
  }

  private publishStats(): void {
    this.statsDirty = false;
    const best = this.save.bestStars ? ` · 最佳 ${starText(this.save.bestStars)}` : '';
    this.ctx.overlay.setStats(
      `营火 ${this.hp}/${FIRE_HP} · 火种 ${this.embers} · 第 ${Math.min(this.wave + 1, WAVES.length)}/${WAVES.length} 波`,
      this.phase === 'wave' ? `剩余妖怪 ${this.queue.length + this.spirits.length}${best}` : `点石台放守护者${best}`,
    );
  }

  private padAt(e: PointerEvent): number | null {
    const hit = this.ctx.pick(e, this.rig.camera, 0);
    if (!hit) return null;
    let best: number | null = null;
    let bestD = PAD_PICK_RADIUS;
    PADS.forEach(([x, z], i) => {
      const d = Math.hypot(hit.x - x, hit.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || this.ctx.isBusy()) return;
    const i = this.padAt(e);
    this.showRings(i);
  };

  private showRings(i: number | null): void {
    this.hoverRing.visible = i !== null;
    const g = i === null ? null : this.guardians[i];
    this.rangeRing.visible = !!g;
    if (i === null) return;
    this.hoverRing.position.set(PADS[i][0], 0.2, PADS[i][1]);
    if (g) {
      this.rangeRing.position.set(PADS[i][0], 0.06, PADS[i][1]);
      this.rangeRing.scale.setScalar(g.def.range);
    }
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.ctx.isBusy() || this.phase === 'won' || this.phase === 'lost') return;
    const i = this.padAt(e);
    if (i !== null) this.openPad(i);
  };

  /** Build / upgrade menu for one stone pad. */
  openPad(i: number): void {
    this.showRings(i);
    const g = this.guardians[i];
    if (!g) {
      const grid = el('div', 'card-grid');
      for (const def of Object.values(GUARDIANS)) {
        const afford = this.embers >= def.cost;
        const card = el('button', `card${afford ? '' : ' locked'}`, grid);
        card.disabled = !afford;
        el('div', 'card-name', card, def.name);
        el('div', 'card-hint', card, def.blurb);
        el('div', 'result-stars small', card, `火种 ${def.cost}`);
        card.addEventListener('click', () => {
          this.ctx.overlay.hidePanel();
          this.build(i, def.id);
        });
      }
      this.ctx.overlay.showPanel(`放守护者 · 火种 ${this.embers}`, grid, [{ label: '取消' }]);
      return;
    }
    const refund = Math.floor(g.spent / 2);
    const canUpgrade = g.level === 1 && this.embers >= g.def.upgradeCost;
    this.ctx.overlay.showPanel(
      `${g.def.name}${g.level > 1 ? ' ★' : ''}`,
      `${g.def.blurb}\n威力 ${this.damageOf(g).toFixed(1)} · 范围 ${g.def.range}${g.level > 1 ? '\n已经是最高级了。' : `\n升级后威力 ×${UPGRADE_DAMAGE}`}`,
      [
        ...(g.level === 1
          ? [{ label: `升级（火种 ${g.def.upgradeCost}）`, primary: true, disabled: !canUpgrade, onClick: () => this.upgrade(i) }]
          : []),
        { label: `拆除（退 ${refund}）`, onClick: () => this.demolish(i) },
        { label: '关闭' },
      ],
    );
  }

  /** Places a guardian if affordable. Returns false otherwise. */
  build(i: number, id: GuardianId): boolean {
    const def = GUARDIANS[id];
    if (this.guardians[i] || this.embers < def.cost) return false;
    this.embers -= def.cost;
    const model = guardian(id, 1);
    model.position.set(PADS[i][0], 0.18, PADS[i][1]);
    this.scene.add(model);
    this.guardians[i] = { def, level: 1, spent: def.cost, model, cooldown: 0 };
    if (id === 'lantern') this.addAura(i, def.range);
    this.statsDirty = true;
    this.showRings(i);
    return true;
  }

  private upgrade(i: number): void {
    const g = this.guardians[i];
    if (!g || g.level > 1 || this.embers < g.def.upgradeCost) return;
    this.embers -= g.def.upgradeCost;
    g.spent += g.def.upgradeCost;
    g.level = 2;
    this.scene.remove(g.model);
    g.model = guardian(g.def.id, 2);
    g.model.position.set(PADS[i][0], 0.18, PADS[i][1]);
    this.scene.add(g.model);
    this.statsDirty = true;
    this.ctx.overlay.toast(`${g.def.name} 升级了！`);
  }

  private demolish(i: number): void {
    const g = this.guardians[i];
    if (!g) return;
    this.embers += Math.floor(g.spent / 2);
    this.scene.remove(g.model);
    this.guardians[i] = null;
    const aura = this.auras.get(i);
    if (aura) this.scene.remove(aura);
    this.auras.delete(i);
    this.statsDirty = true;
    this.showRings(null);
  }

  private addAura(i: number, r: number): void {
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.1, r, 28),
      new THREE.MeshBasicMaterial({ color: 0xe8642c, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.set(PADS[i][0], 0.04, PADS[i][1]);
    this.scene.add(aura);
    this.auras.set(i, aura);
  }

  private buildMap(): void {
    const s = this.scene;
    block(s, toon(0x335c3a), [44, 0.2, 36], [-1, -0.2, 0]);
    const dirt = toon(0x4a2c22);
    for (const seg of segments) {
      const len = seg.len + 1.2;
      block(s, dirt, [1.2, 0.03, len], [seg.x0 + seg.dx / 2, 0, seg.z0 + seg.dz / 2], Math.atan2(seg.dx, seg.dz));
    }
    const padGeo = new THREE.CylinderGeometry(0.62, 0.68, 0.18, 8);
    for (const [x, z] of PADS) mesh(s, padGeo, toon(0x777d94), [x, 0.09, z]);
    const rand = mulberry32(20261006);
    let placed = 0;
    for (let tries = 0; placed < 46 && tries < 600; tries++) {
      const x = range(rand, -13, 10);
      const z = range(rand, -8.5, 7.5);
      if (distanceToPath(x, z) < 1.5) continue;
      if (PADS.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.4)) continue;
      if (Math.hypot(CAMPFIRE[0] - x, CAMPFIRE[1] - z) < 2) continue;
      const inner = x > -9 && x < 7.5 && z > -6 && z < 5.5;
      if (inner && rand() < 0.8) continue;
      pine(s, x, z, range(rand, 0.7, 1.15), rand() < 0.5 ? 0x1f3f2c : 0x335c3a);
      placed++;
    }
    const torii = toon(0xc23a30, 0.2);
    for (const z of [-4.6, -2.4]) block(s, torii, [0.18, 1.6, 0.18], [-9.3, 0, z]);
    block(s, torii, [0.24, 0.14, 2.8], [-9.3, 1.6, -3.5]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      block(s, glow(0xffcf5c), [0.1, 0.1, 0.1], [CAMPFIRE[0] + Math.cos(a) * 1.4, 0.02, CAMPFIRE[1] + Math.sin(a) * 1.4]);
    }
  }
}
