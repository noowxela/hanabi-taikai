import type { SceneId } from '../scenes/types';
import { isRecord, loadJson, saveJson } from '../save';
import { LOOPS, loopSeconds, type LoopId } from './loops';

export type { LoopId };

const SAVE_KEY = 'audio.v1';
const LOOKAHEAD = 0.3;

interface AudioSave {
  muted: boolean;
}

interface Voice {
  id: LoopId;
  gain: GainNode;
  alive: boolean;
  nextAt: number;
  /** When the copy now playing was scheduled. */
  startedAt: number;
  duration: number;
}

function isSave(value: unknown): value is AudioSave {
  return isRecord(value) && typeof value.muted === 'boolean';
}

export function loopFor(id: SceneId): LoopId {
  if (id === 'slide' || id === 'keys' || id === 'catch') return 'arcade';
  if (id === 'pond' || id === 'train' || id === 'watch' || id === 'arcade') return id;
  return 'town';
}

/** Generated loops and the six named effects. Silent until the first gesture. */
export class GameAudio {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private voice: Voice | null = null;
  private wanted: LoopId = 'town';
  private notes = 0;
  private effects = 0;

  constructor() {
    this.muted = loadJson(SAVE_KEY, { muted: false }, isSave).muted;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /** Which loop is current, or the one that will start on the first gesture. */
  get loop(): LoopId {
    return this.voice?.alive ? this.voice.id : this.wanted;
  }

  get noteCount(): number {
    return this.notes;
  }

  get effectCount(): number {
    return this.effects;
  }

  /** Start time of the scheduled copy and when the next copy begins. */
  get loopSpan(): { startedAt: number; nextAt: number; duration: number } | null {
    if (!this.voice) return null;
    return { startedAt: this.voice.startedAt, nextAt: this.voice.nextAt, duration: this.voice.duration };
  }

  /** Remember the loop for this scene. Starts it once the context exists. */
  play(id: LoopId, fadeSeconds = 0.32): void {
    this.wanted = id;
    if (!this.ctx || !this.musicBus) return;
    if (this.voice?.alive && this.voice.id === id) return;
    this.crossfade(id, fadeSeconds);
  }

  /**
   * Schedule further copies out to `until` (AudioContext time).
   * The game lookahead uses a short horizon; tests can pass a farther one.
   */
  fillUntil(until: number): number[] {
    if (!this.ctx || !this.voice?.alive) return [];
    const starts: number[] = [];
    while (this.voice.nextAt < until) {
      starts.push(this.voice.nextAt);
      this.schedule(this.voice, this.voice.nextAt);
      this.voice.startedAt = this.voice.nextAt;
      this.voice.nextAt += this.voice.duration;
    }
    return starts;
  }

  toggleMuted(): void {
    const turningOff = !this.muted;
    if (turningOff) this.click();
    this.muted = !this.muted;
    saveJson(SAVE_KEY, { muted: this.muted });
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    if (turningOff) {
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 0.06);
    } else {
      this.master.gain.setValueAtTime(1, now);
      this.click();
    }
  }

  step(): void {
    this.blip(180, 0.05, 'square', 0.12);
  }

  click(): void {
    this.blip(988, 0.04, 'square', 0.1);
  }

  feed(): void {
    this.blip(659, 0.07, 'triangle', 0.12);
    this.blip(880, 0.09, 'triangle', 0.1, 0.07);
  }

  depart(): void {
    this.blip(440, 0.06, 'square', 0.1);
    this.blip(660, 0.1, 'square', 0.1, 0.06);
  }

  hit(): void {
    this.blip(98, 0.09, 'square', 0.16);
  }

  score(): void {
    this.blip(1046, 0.06, 'triangle', 0.12);
    this.blip(1318, 0.08, 'triangle', 0.1, 0.05);
  }

  private unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(ctx.destination);
      window.setInterval(() => this.pump(), 80);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (!this.voice?.alive) this.crossfade(this.wanted, 0.05);
  }

  private pump(): void {
    if (!this.ctx || !this.voice?.alive) return;
    this.fillUntil(this.ctx.currentTime + LOOKAHEAD);
  }

  private crossfade(id: LoopId, fadeSeconds: number): void {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime;
    const previous = this.voice;
    if (previous) {
      previous.alive = false;
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueAtTime(previous.gain.gain.value, now);
      previous.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
      const old = previous.gain;
      window.setTimeout(() => old.disconnect(), fadeSeconds * 1000 + 50);
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fadeSeconds);
    gain.connect(this.musicBus);
    const start = now + 0.02;
    this.voice = {
      id,
      gain,
      alive: true,
      nextAt: start,
      startedAt: start,
      duration: loopSeconds(LOOPS[id].bpm),
    };
    this.fillUntil(now + LOOKAHEAD);
  }

  private schedule(voice: Voice, when: number): void {
    if (!this.ctx) return;
    const def = LOOPS[voice.id];
    const beat = 60 / def.bpm;
    def.melody.forEach((midi, i) => {
      const at = when + i * beat;
      if (midi > 0) this.note(voice.gain, midi, at, beat * 0.45, 'triangle', 0.08);
      this.note(voice.gain, 91, at, Math.min(0.05, beat * 0.12), 'square', 0.03);
    });
    for (let bar = 0; bar < 8; bar++) {
      this.note(voice.gain, def.bass, when + bar * 4 * beat, beat * 1.4, 'square', 0.045);
      this.note(voice.gain, def.bass + 7, when + (bar * 4 + 2) * beat, beat * 1.1, 'square', 0.035);
    }
  }

  private note(
    dest: AudioNode,
    midi: number,
    when: number,
    dur: number,
    wave: OscillatorType,
    peak: number,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    const end = when + dur;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.35), end);
    gain.gain.linearRampToValueAtTime(0.0001, end + 0.03);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(when);
    osc.stop(end + 0.04);
    this.notes++;
  }

  private blip(freq: number, dur: number, wave: OscillatorType, peak: number, delay = 0): void {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const when = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(when);
    osc.stop(when + dur + 0.02);
    this.effects++;
  }
}

export const audio = new GameAudio();
