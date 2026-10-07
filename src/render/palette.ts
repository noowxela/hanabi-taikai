import * as THREE from 'three';

// Night-festival palette. Every on-screen pixel is snapped to one of these (sRGB).
export const PALETTE_HEX = [
  // night blues
  0x07081a, 0x0f1430, 0x1a2348, 0x283766, 0x3c5288, 0x5f78ad,
  // greys
  0x4a4e63, 0x777d94, 0xaab0c4,
  // greens
  0x14291f, 0x1f3f2c, 0x335c3a, 0x527f48, 0x86ad5c,
  // wood / earth
  0x2b1a18, 0x4a2c22, 0x6e4430, 0x99653f, 0xc4915c,
  // warm lights
  0x8f1d2c, 0xc23a30, 0xe8642c, 0xf59a3a, 0xffcf5c, 0xfff0a8,
  // water
  0x15424f, 0x24707a, 0x4fa8a4, 0x9adbc8,
  // festival accents
  0x5c2c6b, 0xb04f8a, 0xf08fb0,
  // paper / white
  0xf3e6c8, 0xffffff,
];

function channels(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** OKLab from linear sRGB; must match `linearToOklab` in the post shader. */
function linearToOklab(r: number, g: number, b: number): THREE.Vector3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return new THREE.Vector3(
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  );
}

/** Output colours (sRGB 0..1). */
export function paletteSrgb(): THREE.Vector3[] {
  return PALETTE_HEX.map((hex) => new THREE.Vector3(...channels(hex)));
}

/** Matching colours (OKLab). */
export function paletteOklab(): THREE.Vector3[] {
  return PALETTE_HEX.map((hex) => {
    const [r, g, b] = channels(hex).map(srgbToLinear);
    return linearToOklab(r, g, b);
  });
}
