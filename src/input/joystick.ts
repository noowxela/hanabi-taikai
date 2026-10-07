import type { Vec2 } from './types';

const DEAD_ZONE = 0.15;

export class Joystick {
  readonly element: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private pointerId: number | null = null;
  private value: Vec2 = { x: 0, y: 0 };

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'joystick';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.element.appendChild(this.knob);
    parent.appendChild(this.element);

    this.element.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null) return;
      this.pointerId = e.pointerId;
      this.track(e);
      this.element.setPointerCapture(e.pointerId);
    });
    this.element.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.pointerId) this.track(e);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.value = { x: 0, y: 0 };
      this.knob.style.transform = '';
    };
    this.element.addEventListener('pointerup', release);
    this.element.addEventListener('pointercancel', release);
  }

  vector(): Vec2 {
    return this.value;
  }

  private track(e: PointerEvent): void {
    const rect = this.element.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = (e.clientX - (rect.left + radius)) / radius;
    let dy = (e.clientY - (rect.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.knob.style.transform = `translate(${dx * radius * 0.55}px, ${dy * radius * 0.55}px)`;
    this.value = len < DEAD_ZONE ? { x: 0, y: 0 } : { x: dx, y: -dy };
  }
}
