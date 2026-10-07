import type { KoiPattern } from '../scenes/koiPatterns';

// Side view, head to the right. b = back/flank, B = belly, f = fin, e = eye.
const MASK = [
  '................................',
  '............ff..................',
  '...........fffff................',
  '.ff.......bbbbbbbbbbbb..........',
  '.fff....bbbbbbbbbbbbbbbbbb......',
  '..fff.bbbbbbbbbbbbbbbbbbbbbb....',
  '...ffbbbbbbbbbbbbbbbbbbbbbebbb..',
  '...ffbbbbbbbbbbbbbbbbbbbbbbbbbb.',
  '..fffbBBBBBBBBBBBBBBBBBBBBBBBBb.',
  '.fff...BBBBBBBBBBBBBBBBBBBBBBB..',
  '.ff......BBBBBBBBBBBBBBBBBBB....',
  '...........ff......fff..........',
  '............f.......ff..........',
  '................................',
];

export const KOI_SPRITE_WIDTH = MASK[0].length;
export const KOI_SPRITE_HEIGHT = MASK.length;

const INK = 0x07081a;
const LOCKED = 0x283766;
const BODY_X0 = 6;
const BODY_X1 = 29;
const BACK_Y = 3.5;

type Rgb = [number, number, number];

function rgb(hex: number): Rgb {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function shade([r, g, b]: Rgb, k: number): Rgb {
  return [Math.round(r * k), Math.round(g * k), Math.round(b * k)];
}

function at(x: number, y: number): string {
  return MASK[y]?.[x] ?? '.';
}

/** Draws one koi pattern (or a locked silhouette) as a pixel-art side view. */
export function drawKoiSprite(pattern: KoiPattern, unlocked: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = KOI_SPRITE_WIDTH;
  canvas.height = KOI_SPRITE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const image = ctx.createImageData(KOI_SPRITE_WIDTH, KOI_SPRITE_HEIGHT);

  const base = rgb(pattern.base);
  const fin = rgb(pattern.fin);
  const spots = pattern.spots.map((s) => ({
    cx: BODY_X0 + ((s.z + 1) / 2) * (BODY_X1 - BODY_X0),
    cy: BACK_Y + (s.x + 1) * 1.4,
    rx: 2 + s.size * 6,
    ry: 1.2 + s.size * 3,
    color: rgb(s.color),
  }));

  for (let y = 0; y < KOI_SPRITE_HEIGHT; y++) {
    for (let x = 0; x < KOI_SPRITE_WIDTH; x++) {
      const cell = at(x, y);
      let color: Rgb | null = null;
      if (cell === '.') {
        const touches = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].some((c) => c !== '.');
        if (touches) color = rgb(INK);
      } else if (!unlocked) {
        color = cell === 'e' ? rgb(INK) : rgb(LOCKED);
      } else if (cell === 'e') {
        color = rgb(INK);
      } else if (cell === 'f') {
        color = shade(fin, 0.9);
      } else {
        color = cell === 'B' ? shade(base, 0.82) : base;
        if (cell === 'b') {
          for (const s of spots) {
            const dx = (x + 0.5 - s.cx) / s.rx;
            const dy = (y + 0.5 - s.cy) / s.ry;
            if (dx * dx + dy * dy <= 1) color = s.color;
          }
        }
      }
      if (!color) continue;
      const i = (y * KOI_SPRITE_WIDTH + x) * 4;
      image.data.set([color[0], color[1], color[2], 255], i);
    }
  }
  ctx.putImageData(image, 0, 0);
  canvas.className = 'koi-sprite';
  return canvas;
}
