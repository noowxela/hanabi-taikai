import * as THREE from 'three';

/** Up, from −X and +Z. Every directional light uses this so shadows agree. */
const KEY_DIRECTION = [-8, 20, 6] as const;

export function keyLight(color: number, intensity: number): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(KEY_DIRECTION[0], KEY_DIRECTION[1], KEY_DIRECTION[2]);
  return light;
}
