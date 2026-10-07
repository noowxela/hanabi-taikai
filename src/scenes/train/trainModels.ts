import * as THREE from 'three';
import { glow, toon } from '../../render/materials';
import { block, mesh } from '../../world/props';
import { DX, DY, PIECES, opposite, type Dir } from './levels';

export const TILE = 1.6;
const GAUGE = 0.3;

/** Point along a track piece in tile-local (x, z), entering from side `enter`. */
export function trackPoint(enter: Dir, exit: Dir, t: number, out: THREE.Vector2): THREE.Vector2 {
  const h = TILE / 2;
  const ax = DX[enter] * h;
  const az = DY[enter] * h;
  const bx = DX[exit] * h;
  const bz = DY[exit] * h;
  if (enter === opposite(exit)) return out.set(ax + (bx - ax) * t, az + (bz - az) * t);
  const cx = ax + bx;
  const cz = az + bz;
  const a0 = Math.atan2(az - cz, ax - cx);
  let da = Math.atan2(bz - cz, bx - cx) - a0;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  const a = a0 + da * t;
  return out.set(cx + Math.cos(a) * h, cz + Math.sin(a) * h);
}

export function trackPiece(piece: number, locked: boolean): THREE.Group {
  const group = new THREE.Group();
  const sides = PIECES[piece];
  if (!sides) return group;
  const [a, b] = sides;
  const rail = toon(locked ? 0xc4915c : 0xaab0c4, 0.2);
  const sleeper = toon(locked ? 0x4a2c22 : 0x6e4430);
  const p = new THREE.Vector2();
  const q = new THREE.Vector2();
  const segments = a === opposite(b) ? 1 : 5;
  for (let i = 0; i < segments; i++) {
    trackPoint(a, b, i / segments, p);
    trackPoint(a, b, (i + 1) / segments, q);
    const dx = q.x - p.x;
    const dz = q.y - p.y;
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    for (const side of [-1, 1]) {
      block(
        group,
        rail,
        [0.08, 0.07, len + 0.04],
        [(p.x + q.x) / 2 + nx * GAUGE * side, 0.05, (p.y + q.y) / 2 + nz * GAUGE * side],
        Math.atan2(dx, dz),
      );
    }
  }
  for (let k = 0; k < 4; k++) {
    trackPoint(a, b, (k + 0.5) / 4, p);
    trackPoint(a, b, (k + 0.5) / 4 + 0.01, q);
    block(group, sleeper, [GAUGE * 2 + 0.3, 0.05, 0.16], [p.x, 0, p.y], Math.atan2(q.x - p.x, q.y - p.y));
  }
  return group;
}

export function stall(parent: THREE.Object3D, seed: number): void {
  const awning = [0xc23a30, 0x24707a, 0xe8642c][seed % 3];
  block(parent, toon(0x6e4430), [1.1, 0.55, 0.7], [0, 0, 0.1]);
  for (const x of [-0.5, 0.5]) block(parent, toon(0x4a2c22), [0.08, 1.15, 0.08], [x, 0, -0.2]);
  for (let i = 0; i < 4; i++) {
    block(parent, toon(i % 2 ? 0xf3e6c8 : awning), [0.3, 0.12, 0.9], [-0.45 + i * 0.3, 1.15, 0]);
  }
  block(parent, glow(0xffcf5c), [0.16, 0.2, 0.16], [0.35, 0.75, 0.42]);
  block(parent, glow(0xe8642c), [0.16, 0.2, 0.16], [-0.35, 0.75, 0.42]);
}

const lowerCone = new THREE.ConeGeometry(0.6, 0.8, 6);
const upperCone = new THREE.ConeGeometry(0.45, 0.6, 6);

export function tree(parent: THREE.Object3D, seed: number): void {
  block(parent, toon(0x2b1a18), [0.22, 0.5, 0.22], [0, 0, 0]);
  const leaf = toon(seed % 2 ? 0x335c3a : 0x527f48);
  mesh(parent, lowerCone, leaf, [0, 0.85, 0]);
  mesh(parent, upperCone, leaf, [0, 1.3, 0]);
  block(parent, glow(0xfff0a8), [0.06, 0.06, 0.06], [0.25, 0.9, 0.3]);
}

export function lanternPole(parent: THREE.Object3D): void {
  block(parent, toon(0x2b1a18), [0.1, 1.3, 0.1], [0, 0, 0]);
  block(parent, toon(0x2b1a18), [0.5, 0.06, 0.06], [0.2, 1.25, 0]);
  block(parent, glow(0xc23a30), [0.24, 0.34, 0.24], [0.4, 0.88, 0]);
}

export function station(parent: THREE.Object3D, exit: Dir): void {
  const g = new THREE.Group();
  g.rotation.y = Math.atan2(DX[exit], DY[exit]);
  parent.add(g);
  block(g, toon(0x777d94), [0.36, 0.18, 1.4], [0.6, 0, 0]);
  for (const z of [-0.5, 0.5]) block(g, toon(0x4a2c22), [0.07, 0.95, 0.07], [0.68, 0.18, z]);
  block(g, toon(0xc23a30, 0.2), [0.42, 0.08, 1.4], [0.64, 1.12, 0]);
  block(g, glow(0xf3e6c8), [0.04, 0.2, 0.44], [0.46, 0.75, 0]);
}

export function gate(parent: THREE.Object3D, entry: Dir): void {
  const g = new THREE.Group();
  g.rotation.y = Math.atan2(DX[entry], DY[entry]);
  parent.add(g);
  const red = toon(0xc23a30, 0.3);
  for (const x of [-0.62, 0.62]) block(g, red, [0.16, 1.5, 0.16], [x, 0, 0.55]);
  block(g, red, [1.7, 0.14, 0.24], [0, 1.5, 0.55]);
  block(g, toon(0x2b1a18), [1.5, 0.1, 0.18], [0, 1.25, 0.55]);
  block(g, glow(0xffcf5c), [0.5, 0.26, 0.06], [0, 0.95, 0.6]);
  for (const x of [-0.4, 0.4]) block(g, glow(0xe8642c), [0.18, 0.22, 0.18], [x, 1.0, 0.7]);
  block(g, toon(0x6e4430), [0.9, 0.45, 0.6], [-0.2, 0, -0.35]);
  for (let i = 0; i < 3; i++) block(g, toon(i % 2 ? 0xf3e6c8 : 0xe8642c), [0.3, 0.1, 0.7], [-0.5 + i * 0.3, 0.95, -0.35]);
}

const PASSENGER_COLORS = [0xf08fb0, 0x9adbc8, 0xffcf5c, 0xb04f8a];

/** A small lantern spirit waiting for the train. */
export function passenger(index: number): THREE.Group {
  const g = new THREE.Group();
  const color = PASSENGER_COLORS[index % PASSENGER_COLORS.length];
  const body = mesh(g, new THREE.SphereGeometry(0.28, 8, 6), toon(color, 0.35), [0, 0.32, 0]);
  body.scale.set(1, 1.1, 1);
  mesh(g, new THREE.ConeGeometry(0.22, 0.26, 6), toon(0x2b1a18), [0, 0.7, 0]);
  for (const x of [-0.1, 0.1]) block(g, toon(0x07081a), [0.05, 0.07, 0.03], [x, 0.36, 0.26]);
  block(g, glow(0xffcf5c), [0.12, 0.16, 0.12], [0.3, 0.2, 0.1]);
  return g;
}

export function passengerHead(index: number): THREE.Mesh {
  const color = PASSENGER_COLORS[index % PASSENGER_COLORS.length];
  return new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), toon(color, 0.35));
}

/** Locomotive, facing +z. */
export function locomotive(): THREE.Group {
  const g = new THREE.Group();
  const red = toon(0xc23a30, 0.25);
  const dark = toon(0x1a2348);
  block(g, dark, [0.62, 0.14, 1.0], [0, 0.08, 0]);
  block(g, red, [0.52, 0.36, 0.6], [0, 0.22, 0.12]);
  block(g, red, [0.6, 0.55, 0.36], [0, 0.22, -0.26]);
  block(g, dark, [0.68, 0.08, 0.44], [0, 0.77, -0.26]);
  mesh(g, new THREE.CylinderGeometry(0.08, 0.1, 0.26, 6), dark, [0, 0.7, 0.3]);
  block(g, glow(0xfff0a8), [0.18, 0.14, 0.06], [0, 0.32, 0.43]);
  block(g, glow(0xffcf5c), [0.4, 0.14, 0.04], [0, 0.48, -0.08]);
  for (const x of [-0.33, 0.33]) for (const z of [-0.3, 0.25]) block(g, dark, [0.06, 0.18, 0.18], [x, 0.02, z]);
  return g;
}

/** Passenger car, facing +z. Heads are added under `seats`. */
export function car(): { group: THREE.Group; seats: THREE.Group } {
  const g = new THREE.Group();
  block(g, toon(0x1a2348), [0.6, 0.14, 0.86], [0, 0.08, 0]);
  block(g, toon(0x24707a, 0.2), [0.56, 0.28, 0.8], [0, 0.22, 0]);
  block(g, toon(0xf3e6c8), [0.6, 0.05, 0.84], [0, 0.5, 0]);
  for (const x of [-0.31, 0.31]) for (const z of [-0.25, 0.25]) block(g, toon(0x1a2348), [0.06, 0.18, 0.18], [x, 0.02, z]);
  const seats = new THREE.Group();
  seats.position.y = 0.66;
  g.add(seats);
  return { group: g, seats };
}

/** Thin square outline used for the hovered tile. */
export function tileFrame(): THREE.Group {
  const g = new THREE.Group();
  const m = glow(0xffcf5c);
  const s = TILE * 0.94;
  const w = 0.06;
  block(g, m, [s, 0.02, w], [0, 0, -s / 2]);
  block(g, m, [s, 0.02, w], [0, 0, s / 2]);
  block(g, m, [w, 0.02, s], [-s / 2, 0, 0]);
  block(g, m, [w, 0.02, s], [s / 2, 0, 0]);
  return g;
}
