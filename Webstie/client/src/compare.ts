// Dev-only: grey blockout of the bag next to and over each reference photo, with the camera
// matched to that photo's measured scale. /compare.html (add ?leather=1 for textured materials)
import * as THREE from 'three';
import backUrl from './three/ref/birkin-back.jpg';
import frontUrl from './three/ref/birkin-front.jpg';
import threeQuarterUrl from './three/ref/birkin-three-quarter.jpg';
import { setupBirkinScene } from './three/birkinScene';
import { createBirkinModel } from './three/createBirkinModel';

interface View {
  label: string;
  photo?: string;
  azimuth: number; // degrees, 0 = front
  elevation: number; // degrees
  /** Ortho calibration: bag base-centre pixel and pixels per cm in the photo. */
  cal?: { cx: number; by: number; ppc: number };
}

const VIEWS: View[] = [
  { label: 'Chính diện (ảnh 9)', photo: frontUrl, azimuth: 0, elevation: 0, cal: { cx: 435, by: 1095, ppc: 23.2 } },
  { label: 'Mặt sau (ảnh 7)', photo: backUrl, azimuth: 180, elevation: 0, cal: { cx: 437, by: 1108, ppc: 23.8 } },
  { label: '¾ trái (ảnh 8, camera ước lượng)', photo: threeQuarterUrl, azimuth: -55, elevation: 14 },
  { label: 'Ngang phải (không có ảnh của bạn)', azimuth: 90, elevation: 0 },
];
const W = 853;
const H = 1280;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

async function run() {
  const leather = new URLSearchParams(location.search).get('leather') === '1';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const model = await createBirkinModel({ clay: !leather, maxAnisotropy: 8 });
  const view = setupBirkinScene(renderer, model);
  const host = document.getElementById('views')!;

  for (const v of VIEWS) {
    const az = THREE.MathUtils.degToRad(v.azimuth);
    const el = THREE.MathUtils.degToRad(v.elevation);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    let camera: THREE.Camera;
    if (v.cal) {
      const c = v.cal;
      const ortho = new THREE.OrthographicCamera(-c.cx / c.ppc, (W - c.cx) / c.ppc, c.by / c.ppc, -(H - c.by) / c.ppc, 1, 400);
      ortho.position.copy(dir).multiplyScalar(150);
      ortho.lookAt(0, 0, 0);
      camera = ortho;
    } else {
      const persp = new THREE.PerspectiveCamera(22, W / H, 1, 400);
      persp.position.copy(dir).multiplyScalar(105).add(view.target);
      persp.lookAt(view.target);
      camera = persp;
    }
    renderer.render(view.scene, camera);

    const row = document.createElement('div');
    row.innerHTML = `<b>${v.label}</b>`;
    const strip = document.createElement('div');
    strip.style.cssText = 'display:flex;gap:8px;margin-top:4px';
    const cell = (draw: (ctx: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      c.style.cssText = 'height:420px;border:1px solid #ddd';
      draw(c.getContext('2d')!);
      strip.append(c);
    };
    const photo = v.photo ? await loadImage(v.photo) : null;
    if (photo) cell((ctx) => ctx.drawImage(photo, 0, 0, W, H));
    cell((ctx) => ctx.drawImage(renderer.domElement, 0, 0));
    if (photo && v.cal) {
      cell((ctx) => {
        ctx.drawImage(photo, 0, 0, W, H);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(renderer.domElement, 0, 0);
      });
    }
    row.append(strip);
    host.append(row);
  }
  document.title = 'done';
}

run().catch((err) => {
  document.body.textContent = `Lỗi: ${err}`;
});
