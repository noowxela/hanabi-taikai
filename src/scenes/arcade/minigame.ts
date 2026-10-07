import * as THREE from 'three';
import { audio } from '../../audio/audio';
import type { Direction } from '../../input';
import { CameraRig } from '../../render/cameraRig';
import { el } from '../../ui/overlay';
import type { GameScene, SceneContext } from '../types';
import { ARCADE_GAMES, ROUND_SECONDS, loadHighScores, recordScore, type ArcadeGame } from './arcadeData';

type Phase = 'countdown' | 'play' | 'over';

/** Shared 3-2-1 countdown, 30 s timer, HUD and result panel for arcade minigames. */
export abstract class Minigame implements GameScene {
  readonly scene = new THREE.Scene();
  protected readonly rig: CameraRig;
  protected readonly focus = new THREE.Vector3();
  protected phase: Phase = 'over';
  protected timeLeft = ROUND_SECONDS;
  protected score = 0;
  private countdown = 0;
  private lastShown = '';
  private lastStats = '';
  private round = 0;
  private high = 0;

  protected constructor(
    protected readonly ctx: SceneContext,
    protected readonly game: ArcadeGame,
    pitch: number,
    private readonly controls: { joystick?: boolean; dpad?: boolean },
  ) {
    this.rig = new CameraRig(pitch, 16);
  }

  get camera(): THREE.Camera {
    return this.rig.camera;
  }

  /** Seconds since the round started (0 during the countdown). */
  protected get elapsed(): number {
    return ROUND_SECONDS - this.timeLeft;
  }

  protected get playing(): boolean {
    return this.phase === 'play' && !this.ctx.isBusy();
  }

  abstract resize(lowWidth: number, lowHeight: number): void;
  /** Reset per-round state and objects. */
  protected abstract reset(): void;
  /** Gameplay step; only called while playing. */
  protected abstract play(dt: number, time: number): void;
  /** Always-on animation (idle bobbing etc.). */
  protected animate(_dt: number, _time: number): void {}
  protected statsLine(): string {
    return `分数 ${this.score}`;
  }

  /** Positive points play the score sound. Penalties only change the number. */
  protected addScore(points: number): void {
    if (points > 0) {
      this.score += points;
      audio.score();
    } else {
      this.score = Math.max(0, this.score + points);
    }
  }

  enter(): void {
    const info = ARCADE_GAMES.find((g) => g.id === this.game)!;
    this.ctx.overlay.setHud({
      title: info.name,
      hint: info.hint,
      buttons: [{ label: '返回街机厅', onClick: () => this.onBack() }],
      joystick: this.controls.joystick,
      dpad: this.controls.dpad,
    });
    this.startRound();
  }

  exit(): void {
    this.phase = 'over';
    this.round++;
  }

  onBack(): void {
    this.ctx.go('arcade');
  }

  onDirection(_direction: Direction): void {}

  update(dt: number, time: number): void {
    if (!this.ctx.isBusy()) {
      if (this.phase === 'countdown') {
        this.countdown -= dt;
        const n = Math.ceil(this.countdown);
        if (n > 0 && String(n) !== this.lastShown) {
          this.lastShown = String(n);
          this.ctx.overlay.flash(String(n), 700);
        }
        if (this.countdown <= 0) {
          this.phase = 'play';
          this.ctx.overlay.flash('开始！', 700);
        }
      } else if (this.phase === 'play') {
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        this.play(dt, time);
        if (this.timeLeft <= 0) this.finish();
      }
    }
    this.animate(dt, time);
    this.publishStats();
    this.rig.update(dt, this.focus);
  }

  protected startRound(): void {
    this.round++;
    this.reset();
    this.score = 0;
    this.high = loadHighScores()[this.game];
    this.timeLeft = ROUND_SECONDS;
    this.countdown = 3;
    this.lastShown = '';
    this.lastStats = '';
    this.phase = 'countdown';
  }

  private publishStats(): void {
    const time = this.phase === 'countdown' ? ROUND_SECONDS : Math.ceil(this.timeLeft);
    const main = `${this.statsLine()} · 剩余 ${time} 秒`;
    const sub = `最高分 ${this.high}`;
    if (main + sub === this.lastStats) return;
    this.lastStats = main + sub;
    this.ctx.overlay.setStats(main, sub);
  }

  private finish(): void {
    this.phase = 'over';
    this.ctx.overlay.flash('时间到！', 900);
    const record = recordScore(this.game, this.score);
    if (record) this.high = this.score;
    const round = this.round;
    const body = el('div', '');
    el('div', 'result-stars', body, String(this.score));
    el('div', 'panel-text', body, record ? '新纪录！' : `最高分 ${this.high}`);
    window.setTimeout(() => {
      if (round !== this.round || this.phase !== 'over') return;
      this.ctx.overlay.showPanel(
        '时间到！',
        body,
        [
          { label: '再来一次', primary: true, onClick: () => this.startRound() },
          { label: '返回街机厅', onClick: () => this.onBack() },
        ],
        false,
      );
    }, 900);
  }
}
