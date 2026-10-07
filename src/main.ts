import * as THREE from 'three';
import { audio, loopFor } from './audio/audio';
import { Input, type InputHandlers } from './input';
import { shortSideTarget } from './render/pixelDetail';
import { PixelPipeline } from './render/pixelPipeline';
import { ArcadeHall } from './scenes/arcade/arcadeHall';
import { IceSlide } from './scenes/arcade/iceSlide';
import { LanternCatch } from './scenes/arcade/lanternCatch';
import { QuickKeys } from './scenes/arcade/quickKeys';
import { KoiPondScene } from './scenes/koiPond';
import { TrainScene } from './scenes/train/trainScene';
import { WatchScene } from './scenes/watch/watchScene';
import type { GameScene, SceneContext, SceneId } from './scenes/types';
import { FADE_MS, Overlay } from './ui/overlay';
import { TownScene } from './world/town';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const pipeline = new PixelPipeline(canvas, shortSideTarget());
let current: GameScene;
let switching = false;

const handlers: InputHandlers = {
  action() {
    if (switching) return;
    if (overlay.panelOpen) overlay.activatePanel();
    else if (overlay.dialogOpen) overlay.advanceDialog();
    else current.onAction?.();
  },
  rotate(direction) {
    if (!switching && !overlay.busy) current.onRotate?.(direction);
  },
  back() {
    if (switching) return;
    if (overlay.panelOpen) {
      if (!overlay.dismissPanel()) current.onBack?.();
    } else if (overlay.dialogOpen) overlay.closeDialog();
    else current.onBack?.();
  },
  direction(direction) {
    if (!switching && !overlay.busy) current.onDirection?.(direction);
  },
  henshin() {
    if (switching || overlay.busy) return;
    current.onHenshin?.();
  },
};

const overlay = new Overlay(uiRoot, handlers);
const input = new Input(canvas, uiRoot, handlers);

const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const ctx: SceneContext = {
  canvas,
  overlay,
  move: () => input.move(),
  isBusy: () => switching || overlay.busy,
  go: (id) => void go(id),
  applyPixelDetail() {
    pipeline.setShortSide(shortSideTarget());
    resize();
  },
  sprinting: () => input.sprint(),
  setTouchSprint: (down) => input.setTouchSprint(down),
  pick(e, camera, planeY = 0) {
    raycaster.setFromCamera(pipeline.clientToNdc(e.clientX, e.clientY), camera);
    plane.constant = -planeY;
    return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  },
};

const town = new TownScene(ctx);
const scenes: Partial<Record<SceneId, GameScene>> = {
  town,
  pond: new KoiPondScene(ctx),
  train: new TrainScene(ctx),
  watch: new WatchScene(ctx),
  arcade: new ArcadeHall(ctx),
  slide: new IceSlide(ctx),
  keys: new QuickKeys(ctx),
  catch: new LanternCatch(ctx),
};

async function go(id: SceneId): Promise<void> {
  const next = scenes[id];
  if (!next) {
    overlay.toast('即将开放');
    return;
  }
  if (switching || next === current) return;
  audio.play(loopFor(id), FADE_MS / 1000);
  switching = true;
  const previous = current;
  await overlay.fade(() => {
    previous.exit();
    overlay.hidePanel();
    overlay.closeDialog();
    if (next === town && previous.zoneId) town.placeAtZone(previous.zoneId);
    current = next;
    current.enter();
  });
  switching = false;
}

function resize(): void {
  pipeline.resize();
  for (const scene of Object.values(scenes)) scene.resize(pipeline.lowWidth, pipeline.lowHeight);
}

window.addEventListener('resize', resize);
resize();

current = town;
current.enter();

let last = performance.now();
let clock = last / 1000;
function tick(dt: number): void {
  clock += dt;
  current.update(dt, clock);
  pipeline.render(current.scene, current.camera);
}

function frame(now: number): void {
  tick(Math.min((now - last) / 1000, 0.05));
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  /** Advances the game without rAF (background tabs pause it). */
  const step = (seconds: number, dt = 1 / 60) => {
    for (let t = 0; t < seconds; t += dt) tick(dt);
  };
  Object.assign(window, {
    __game: {
      scenes,
      go,
      step,
      pipeline,
      overlay,
      audio,
      get current() {
        return current;
      },
    },
  });
}
