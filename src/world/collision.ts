import type * as THREE from 'three';

export type Collider =
  | { kind: 'circle'; x: number; z: number; r: number }
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number };

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function circle(x: number, z: number, r: number): Collider {
  return { kind: 'circle', x, z, r };
}

/** Axis-aligned box from a centre and full size. */
export function box(x: number, z: number, width: number, depth: number): Collider {
  return { kind: 'box', minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
}

export function resolveCollisions(pos: THREE.Vector3, radius: number, colliders: Collider[], bounds: Bounds): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      if (c.kind === 'circle') {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const min = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-6;
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      } else {
        const cx = Math.min(Math.max(pos.x, c.minX), c.maxX);
        const cz = Math.min(Math.max(pos.z, c.minZ), c.maxZ);
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          const pushes = [
            { axis: 'x', value: c.minX - radius, dist: pos.x - c.minX },
            { axis: 'x', value: c.maxX + radius, dist: c.maxX - pos.x },
            { axis: 'z', value: c.minZ - radius, dist: pos.z - c.minZ },
            { axis: 'z', value: c.maxZ + radius, dist: c.maxZ - pos.z },
          ].sort((a, b) => a.dist - b.dist);
          if (pushes[0].axis === 'x') pos.x = pushes[0].value;
          else pos.z = pushes[0].value;
        }
      }
    }
  }
  pos.x = Math.min(Math.max(pos.x, bounds.minX), bounds.maxX);
  pos.z = Math.min(Math.max(pos.z, bounds.minZ), bounds.maxZ);
}
