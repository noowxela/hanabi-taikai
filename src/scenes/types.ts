import type * as THREE from 'three';
import type { Direction, Vec2 } from '../input';
import type { Overlay } from '../ui/overlay';

export type SceneId = 'town' | 'pond' | 'train' | 'watch' | 'arcade' | 'slide' | 'keys' | 'catch';

export interface GameScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  /** Town zone to return to when this scene goes back to the town. */
  readonly zoneId?: string;
  update(dt: number, time: number): void;
  resize(lowWidth: number, lowHeight: number): void;
  enter(): void;
  exit(): void;
  onAction?(): void;
  onBack?(): void;
  onRotate?(direction: -1 | 1): void;
  onDirection?(direction: Direction): void;
  onHenshin?(): void;
}

/** What every scene can use from the app. */
export interface SceneContext {
  readonly canvas: HTMLCanvasElement;
  readonly overlay: Overlay;
  move(): Vec2;
  isBusy(): boolean;
  go(id: SceneId): void;
  /** Re-frame every scene after the saved pixel-detail flag changes. */
  applyPixelDetail(): void;
  sprinting(): boolean;
  setTouchSprint(down: boolean): void;
  /** Point on the horizontal plane `y = planeY` under the pointer, or null. */
  pick(e: PointerEvent, camera: THREE.Camera, planeY?: number): THREE.Vector3 | null;
}
