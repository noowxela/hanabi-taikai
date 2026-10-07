import * as THREE from 'three';

export interface Zone {
  id: string;
  label: string;
  position: THREE.Vector2;
  radius: number;
  prompt: string;
  onEnter?(): void;
  onInteract(): void;
}

export class ZoneSystem {
  active: Zone | null = null;
  private readonly point = new THREE.Vector2();

  constructor(readonly zones: Zone[]) {}

  /** Returns true when the active zone changed. */
  update(x: number, z: number): boolean {
    this.point.set(x, z);
    let nearest: Zone | null = null;
    let nearestDist = Infinity;
    for (const zone of this.zones) {
      const d = zone.position.distanceTo(this.point);
      if (d <= zone.radius && d < nearestDist) {
        nearest = zone;
        nearestDist = d;
      }
    }
    if (nearest === this.active) return false;
    this.active = nearest;
    nearest?.onEnter?.();
    return true;
  }

  get(id: string): Zone {
    const zone = this.zones.find((z) => z.id === id);
    if (!zone) throw new Error(`Unknown zone ${id}`);
    return zone;
  }
}
