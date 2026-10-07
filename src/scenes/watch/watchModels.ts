import * as THREE from 'three';
import { glow, toon } from '../../render/materials';
import { block, mesh } from '../../world/props';
import type { GuardianId, SpiritDef } from './watchData';

const tube = new THREE.CylinderGeometry(0.16, 0.2, 0.9, 6);
const drum = new THREE.CylinderGeometry(0.42, 0.42, 0.5, 8);
const drumTop = new THREE.CylinderGeometry(0.36, 0.36, 0.04, 8);
const flameGeometry: [THREE.ConeGeometry, number, number][] = [
  [new THREE.ConeGeometry(0.5, 1.2, 5), 1.2, 0xe8642c],
  [new THREE.ConeGeometry(0.32, 0.9, 5), 0.9, 0xf59a3a],
  [new THREE.ConeGeometry(0.16, 0.55, 5), 0.55, 0xffcf5c],
];

export function guardian(id: GuardianId, level: number): THREE.Group {
  const g = new THREE.Group();
  const gold = level > 1;
  if (id === 'firework') {
    block(g, toon(0x4a2c22), [0.7, 0.25, 0.7], [0, 0, 0]);
    for (const x of [-0.15, 0.15]) mesh(g, tube, toon(0xc23a30, 0.2), [x, 0.65, 0]);
    block(g, glow(gold ? 0xffcf5c : 0xf3e6c8), [0.6, 0.08, 0.2], [0, 0.55, 0]);
    if (gold) block(g, glow(0xffcf5c), [0.16, 0.16, 0.16], [0, 1.15, 0]);
  } else if (id === 'taiko') {
    for (const x of [-0.32, 0.32]) block(g, toon(0x2b1a18), [0.08, 0.5, 0.5], [x, 0, 0]);
    const body = mesh(g, drum, toon(0x8f1d2c, 0.15), [0, 0.6, 0]);
    body.rotation.x = Math.PI / 2;
    for (const z of [-0.26, 0.26]) {
      const top = mesh(g, drumTop, toon(0xf3e6c8, 0.2), [0, 0.6, z]);
      top.rotation.x = Math.PI / 2;
    }
    block(g, glow(gold ? 0xffcf5c : 0xf59a3a), [0.86, 0.06, 0.06], [0, 0.57, 0]);
  } else {
    block(g, toon(0x2b1a18), [0.12, 1.3, 0.12], [0, 0, 0]);
    block(g, toon(0x2b1a18), [0.5, 0.06, 0.06], [0, 1.3, 0]);
    block(g, glow(gold ? 0xffcf5c : 0xe8642c), [0.42, 0.55, 0.42], [0, 0.72, 0]);
    block(g, toon(0x2b1a18), [0.46, 0.06, 0.46], [0, 1.27, 0]);
  }
  return g;
}

export interface SpiritModel {
  group: THREE.Group;
  body: THREE.Group;
  hpBar: THREE.Mesh;
}

/** A cloaked spirit with a glowing festival mask on its +z side (toward the camera). */
export function spirit(def: SpiritDef): SpiritModel {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(def.size);
  group.add(body);
  const cloak = toon(def.cloak, 0.15);
  block(body, cloak, [0.7, 0.75, 0.6], [0, 0, 0]);
  block(body, cloak, [0.5, 0.25, 0.45], [0, 0.75, 0]);
  block(body, glow(def.mask), [0.5, 0.44, 0.1], [0, 0.5, 0.3]);
  const eye = toon(0x07081a);
  for (const x of [-0.12, 0.12]) block(body, eye, [0.09, 0.11, 0.04], [x, 0.66, 0.35]);
  block(body, glow(0xc23a30), [0.2, 0.05, 0.04], [0, 0.56, 0.35]);
  if (def.id === 'oni' || def.id === 'boss') {
    const horn = glow(0xf3e6c8);
    for (const x of [-0.18, 0.18]) block(body, horn, [0.08, 0.2, 0.08], [x, 1.0, 0.15]);
  }
  const barY = def.size * 1.15 + 0.2;
  block(group, toon(0x07081a), [0.72, 0.09, 0.08], [0, barY - 0.01, 0]);
  const hpBar = block(group, glow(0x86ad5c), [0.66, 0.07, 0.1], [0, barY, 0.01]);
  return { group, body, hpBar };
}

export interface CampfireModel {
  group: THREE.Group;
  flames: THREE.Mesh[];
  light: THREE.PointLight;
}

export function campfire(): CampfireModel {
  const group = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const yaw = Math.round(-a / (Math.PI / 2)) * (Math.PI / 2);
    block(group, toon(0x777d94), [0.32, 0.22, 0.28], [Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85], yaw);
  }
  for (let i = 0; i < 3; i++) {
    block(group, toon(0x6e4430), [0.16, 0.16, 1.2], [0, 0.02 + i * 0.14, 0], i % 2 === 0 ? 0 : Math.PI / 2);
  }
  const flames = flameGeometry.map(([geo, h, color]) => {
    const f = mesh(group, geo, glow(color), [0, 0.2 + h / 2, 0]);
    f.userData.h = h;
    return f;
  });
  const light = new THREE.PointLight(0xff9a3a, 14, 12, 1.3);
  light.position.set(0, 1.4, 0);
  group.add(light);
  return { group, flames, light };
}

const pineLower = new THREE.ConeGeometry(0.8, 1.2, 6);
const pineUpper = new THREE.ConeGeometry(0.55, 0.9, 6);

export function pine(parent: THREE.Object3D, x: number, z: number, s: number, color: number): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  parent.add(g);
  block(g, toon(0x2b1a18), [0.25, 0.5, 0.25], [0, 0, 0]);
  mesh(g, pineLower, toon(color), [0, 1.0, 0]);
  mesh(g, pineUpper, toon(color), [0, 1.65, 0]);
}
