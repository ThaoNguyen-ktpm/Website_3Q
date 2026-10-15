import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { BirkinModel } from './createBirkinModel';

export interface BirkinSceneOptions {
  /** Starting view angle around the bag, in degrees (0 = straight front). */
  azimuth?: number;
  shadowMapSize?: number;
}

export interface BirkinScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  /** Fits the bag to a viewport of the given size; `fill` < 1 leaves more margin. */
  frame(width: number, height: number, fill?: number): void;
  dispose(): void;
}

function contactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Studio lighting, soft ground shadow and camera framing shared by the live viewer and still renders. */
export function setupBirkinScene(
  renderer: THREE.WebGLRenderer,
  model: BirkinModel,
  { azimuth = 28, shadowMapSize = 1024 }: BirkinSceneOptions = {},
): BirkinScene {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.5; // low fill: lit and shaded sides separate clearly

  const key = new THREE.DirectionalLight(0xfff4e6, 2.8);
  key.position.set(-20, 80, 35);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  key.shadow.camera.left = -25;
  key.shadow.camera.right = 25;
  key.shadow.camera.top = 35;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 4;
  scene.add(key);
  // Glint light from the viewer's side: picks out the polished scale tops (gloss contrast).
  const glint = new THREE.DirectionalLight(0xffffff, 1.8);
  glint.position.set(35, 45, 70);
  scene.add(glint);
  // Soft back light so the bag stays readable as it turns away from the key.
  const rim = new THREE.DirectionalLight(0xdcecff, 1.5);
  rim.position.set(25, 40, -45);
  scene.add(rim);

  scene.add(model.group);
  key.target = model.group;

  const shadowTex = contactShadowTexture();
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 20),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -0.3;
  scene.add(blob);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.25;
  ground.receiveShadow = true;
  scene.add(ground);

  const target = new THREE.Vector3(0, model.height * 0.47, 0);
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 400);
  const az = THREE.MathUtils.degToRad(azimuth);
  const elevation = 0.2;
  camera.position
    .set(Math.sin(az) * Math.cos(elevation), Math.sin(elevation), Math.cos(az) * Math.cos(elevation))
    .add(target);
  camera.lookAt(target);

  const radius = 21;
  return {
    scene,
    camera,
    target,
    frame(width, height, fill = 1) {
      camera.aspect = width / height;
      const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const dist = (radius / Math.sin(Math.min(vHalf, hHalf))) * (0.92 / fill);
      const dir = camera.position.clone().sub(target).normalize();
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    },
    dispose() {
      model.dispose();
      blob.geometry.dispose();
      (blob.material as THREE.Material).dispose();
      shadowTex.dispose();
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      envTarget.dispose();
      pmrem.dispose();
    },
  };
}
