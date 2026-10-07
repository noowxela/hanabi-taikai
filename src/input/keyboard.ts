import type { Direction, InputHandlers, Vec2 } from './types';

const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const ACTION = ['Space', 'Enter', 'NumpadEnter'];

const DIRECTIONS: [string[], Direction][] = [
  [UP, 'up'],
  [DOWN, 'down'],
  [LEFT, 'left'],
  [RIGHT, 'right'],
];

export class Keyboard {
  private readonly down = new Set<string>();

  constructor(handlers: InputHandlers) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        if (ACTION.includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
        return;
      }
      this.down.add(e.code);
      const dir = DIRECTIONS.find(([codes]) => codes.includes(e.code));
      if (dir) {
        if (e.code.startsWith('Arrow')) e.preventDefault();
        handlers.direction(dir[1]);
      } else if (ACTION.includes(e.code)) {
        e.preventDefault();
        handlers.action();
      } else if (e.code === 'KeyQ') handlers.rotate(-1);
      else if (e.code === 'KeyE') handlers.rotate(1);
      else if (e.code === 'KeyF') handlers.henshin();
      else if (e.code === 'Escape') handlers.back();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  sprint(): boolean {
    return this.down.has('ShiftLeft') || this.down.has('ShiftRight');
  }

  vector(): Vec2 {
    const any = (codes: string[]) => codes.some((c) => this.down.has(c));
    return {
      x: (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0),
      y: (any(UP) ? 1 : 0) - (any(DOWN) ? 1 : 0),
    };
  }
}
