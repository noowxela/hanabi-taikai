import * as THREE from 'three';
import { CAMERA_FAR, CAMERA_NEAR } from './cameraRig';
import { PALETTE_HEX, paletteOklab, paletteSrgb } from './palette';

/** World-space depth jump (units) that counts as a silhouette edge. */
const OUTLINE_DEPTH = 0.5;
/** Linear-light multiplier applied to outline pixels before palette matching. */
const OUTLINE_DARKEN = 0.22;

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tDepth;
  uniform vec2 uLowRes;
  uniform float uScale;
  uniform float uDepthRange;
  uniform float uOutlineDepth;
  uniform float uOutlineDarken;
  uniform vec3 uPalette[PALETTE_SIZE];
  uniform vec3 uPaletteLab[PALETTE_SIZE];

  vec3 linearToOklab(vec3 c) {
    float l = pow(dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)), 1.0 / 3.0);
    float m = pow(dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)), 1.0 / 3.0);
    float s = pow(dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005)), 1.0 / 3.0);
    return vec3(
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    );
  }

  float depthAt(vec2 texel) {
    vec2 t = clamp(texel, vec2(0.0), uLowRes - 1.0);
    return texture2D(tDepth, (t + 0.5) / uLowRes).x;
  }

  void main() {
    vec2 texel = floor(gl_FragCoord.xy / uScale);
    vec3 color = clamp(texture2D(tScene, (texel + 0.5) / uLowRes).rgb, 0.0, 1.0);

    float d = depthAt(texel);
    float nearest = min(
      min(depthAt(texel + vec2(1.0, 0.0)), depthAt(texel - vec2(1.0, 0.0))),
      min(depthAt(texel + vec2(0.0, 1.0)), depthAt(texel - vec2(0.0, 1.0)))
    );
    if ((d - nearest) * uDepthRange > uOutlineDepth) color *= uOutlineDarken;

    vec3 lab = linearToOklab(color);
    vec3 best = uPalette[0];
    float bestDist = 1e9;
    for (int i = 0; i < PALETTE_SIZE; i++) {
      vec3 diff = lab - uPaletteLab[i];
      float dist = dot(diff, diff);
      if (dist < bestDist) {
        bestDist = dist;
        best = uPalette[i];
      }
    }
    gl_FragColor = vec4(best, 1.0);
  }
`;

export class PixelPipeline {
  readonly renderer: THREE.WebGLRenderer;
  lowWidth = 1;
  lowHeight = 1;
  scale = 1;

  private shortSide: number;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly postScene = new THREE.Scene();
  private readonly postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private readonly drawSize = new THREE.Vector2();

  constructor(canvas: HTMLCanvasElement, shortSide: number) {
    this.shortSide = shortSide;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(1, 1),
    });
    this.material = new THREE.ShaderMaterial({
      defines: { PALETTE_SIZE: PALETTE_HEX.length },
      uniforms: {
        tScene: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uLowRes: { value: new THREE.Vector2(1, 1) },
        uScale: { value: 1 },
        uDepthRange: { value: CAMERA_FAR - CAMERA_NEAR },
        uOutlineDepth: { value: OUTLINE_DEPTH },
        uOutlineDarken: { value: OUTLINE_DARKEN },
        uPalette: { value: paletteSrgb() },
        uPaletteLab: { value: paletteOklab() },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.postScene.add(quad);
    this.resize();
  }

  setShortSide(shortSide: number): void {
    this.shortSide = shortSide;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.getDrawingBufferSize(this.drawSize);

    this.scale = Math.max(2, Math.round(Math.min(this.drawSize.x, this.drawSize.y) / this.shortSide));
    this.lowWidth = Math.ceil(this.drawSize.x / this.scale);
    this.lowHeight = Math.ceil(this.drawSize.y / this.scale);
    this.target.setSize(this.lowWidth, this.lowHeight);
    this.material.uniforms.uLowRes.value.set(this.lowWidth, this.lowHeight);
    this.material.uniforms.uScale.value = this.scale;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }

  /** Maps a CSS-pixel client position to NDC of the low-res camera (the low-res image overhangs the canvas top/right). */
  clientToNdc(clientX: number, clientY: number, out = new THREE.Vector2()): THREE.Vector2 {
    const dpr = this.renderer.getPixelRatio();
    const fromBottom = this.drawSize.y - clientY * dpr;
    return out.set(
      ((clientX * dpr) / (this.lowWidth * this.scale)) * 2 - 1,
      (fromBottom / (this.lowHeight * this.scale)) * 2 - 1,
    );
  }
}
