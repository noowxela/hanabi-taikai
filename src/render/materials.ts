import * as THREE from 'three';

const gradientMap = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const toonCache = new Map<string, THREE.MeshToonMaterial>();
const glowCache = new Map<number, THREE.MeshBasicMaterial>();

/** `selfLit` (0..1) adds emissive so a surface keeps its colour in dark scenes. */
export function toon(color: number, selfLit = 0): THREE.MeshToonMaterial {
  const key = `${color}:${selfLit}`;
  let mat = toonCache.get(key);
  if (!mat) {
    mat = new THREE.MeshToonMaterial({ color, gradientMap, emissive: color, emissiveIntensity: selfLit });
    toonCache.set(key, mat);
  }
  return mat;
}

/** Unlit material for lanterns, fire, and signs. */
export function glow(color: number): THREE.MeshBasicMaterial {
  let mat = glowCache.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color });
    glowCache.set(color, mat);
  }
  return mat;
}
