export interface Vec2 {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface InputHandlers {
  action(): void;
  rotate(direction: -1 | 1): void;
  back(): void;
  direction(direction: Direction): void;
  henshin(): void;
}
