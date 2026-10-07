import * as THREE from 'three';

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

/** Box whose bottom sits at `y`. */
export function block(
  parent: THREE.Object3D,
  material: THREE.Material,
  [w, h, d]: [number, number, number],
  [x, y, z]: [number, number, number],
  rotationY = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(boxGeometry, material);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = rotationY;
  parent.add(mesh);
  return mesh;
}

export function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  [x, y, z]: [number, number, number],
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
