import * as THREE from 'three';

const QUARTER = Math.PI / 2;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 200;

export class CameraRig {
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA_NEAR, CAMERA_FAR);
  pixelsPerUnit: number;
  yaw = 0;

  private targetYaw = 0;
  private readonly pitch: number;
  private readonly distance = 60;
  private lowWidth = 1;
  private lowHeight = 1;
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly back = new THREE.Vector3();

  constructor(pitchDegrees: number, pixelsPerUnit: number) {
    this.pitch = THREE.MathUtils.degToRad(pitchDegrees);
    this.pixelsPerUnit = pixelsPerUnit;
  }

  resize(lowWidth: number, lowHeight: number): void {
    this.lowWidth = lowWidth;
    this.lowHeight = lowHeight;
    this.applyProjection();
  }

  setPixelsPerUnit(ppu: number): void {
    this.pixelsPerUnit = ppu;
    this.applyProjection();
  }

  rotate(direction: -1 | 1): void {
    this.targetYaw += direction * QUARTER;
  }

  /** Jumps (no animation) to `turns` quarter turns of yaw. */
  setQuarterTurns(turns: number): void {
    this.targetYaw = this.yaw = turns * QUARTER;
  }

  get isRotating(): boolean {
    return Math.abs(this.targetYaw - this.yaw) > 1e-3;
  }

  /** Ground-plane basis for camera-relative movement. */
  groundAxes(forward: THREE.Vector3, right: THREE.Vector3): void {
    forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  update(dt: number, focus: THREE.Vector3): void {
    this.yaw = this.isRotating
      ? THREE.MathUtils.damp(this.yaw, this.targetYaw, 10, dt)
      : this.targetYaw;

    this.camera.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateMatrix();
    this.right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.back.set(0, 0, 1).applyQuaternion(this.camera.quaternion);

    let a = focus.dot(this.right);
    let b = focus.dot(this.up);
    const c = focus.dot(this.back) + this.distance;
    if (!this.isRotating) {
      a = Math.round(a * this.pixelsPerUnit) / this.pixelsPerUnit;
      b = Math.round(b * this.pixelsPerUnit) / this.pixelsPerUnit;
    }
    this.camera.position
      .copy(this.right)
      .multiplyScalar(a)
      .addScaledVector(this.up, b)
      .addScaledVector(this.back, c);
    this.camera.updateMatrixWorld();
  }

  private applyProjection(): void {
    const halfW = this.lowWidth / 2 / this.pixelsPerUnit;
    const halfH = this.lowHeight / 2 / this.pixelsPerUnit;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }
}
