import { isRecord, loadJson, saveJson } from '../save';

const SAVE_KEY = 'pixel.v1';

/** Art-pixel short side. 441 / 47 matches the current 150 / 16 framing. */
export const SHORT_SIDE = { current: 150, detail: 441 } as const;
/** Town camera. 47 draws the 1.36-unit player at about 64 art pixels. */
export const TOWN_PPU = { current: 16, detail: 47 } as const;

interface PixelSave {
  detail: boolean;
}

function isSave(value: unknown): value is PixelSave {
  return isRecord(value) && typeof value.detail === 'boolean';
}

let detail = loadJson(SAVE_KEY, { detail: false }, isSave).detail;

export function pixelDetail(): boolean {
  return detail;
}

export function setPixelDetail(next: boolean): void {
  detail = next;
  saveJson(SAVE_KEY, { detail });
}

export function shortSideTarget(): number {
  return detail ? SHORT_SIDE.detail : SHORT_SIDE.current;
}

export function townPixelsPerUnit(): number {
  return detail ? TOWN_PPU.detail : TOWN_PPU.current;
}
