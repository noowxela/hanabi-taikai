import { Joystick } from './joystick';
import { Keyboard } from './keyboard';
import type { InputHandlers, Vec2 } from './types';

export type { Direction, InputHandlers, Vec2 } from './types';

const TWIST_THRESHOLD = Math.PI / 5;

export class Input {
  readonly joystick: Joystick;
  private readonly keyboard: Keyboard;
  private touchSprint = false;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, handlers: InputHandlers) {
    this.keyboard = new Keyboard(handlers);
    this.joystick = new Joystick(uiRoot);
    watchTwist(canvas, handlers);
  }

  /** Held Shift, or the touch 跑 button. */
  sprint(): boolean {
    return this.touchSprint || this.keyboard.sprint();
  }

  setTouchSprint(down: boolean): void {
    this.touchSprint = down;
  }

  /** Screen-space movement: x right, y up. Length is at most 1. */
  move(): Vec2 {
    const k = this.keyboard.vector();
    const j = this.joystick.vector();
    const x = k.x + j.x;
    const y = k.y + j.y;
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }
}

/** Two-finger twist on the canvas rotates the camera by a quarter turn. */
function watchTwist(canvas: HTMLCanvasElement, handlers: InputHandlers): void {
  const touches = new Map<number, { x: number; y: number }>();
  let startAngle: number | null = null;

  const angle = () => {
    const [a, b] = [...touches.values()];
    return Math.atan2(b.y - a.y, b.x - a.x);
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startAngle = touches.size === 2 ? angle() : null;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size !== 2 || startAngle === null) return;
    let delta = angle() - startAngle;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    if (Math.abs(delta) > TWIST_THRESHOLD) {
      handlers.rotate(delta > 0 ? 1 : -1);
      startAngle = angle();
    }
  });
  const end = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    startAngle = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
