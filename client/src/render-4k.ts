// Dev-only: renders the bag to a transparent PNG (long side >= 3840 px) and saves it via the
// endpoint in vite.render.config.ts. /render-4k.html?az=28&name=birkin-25-4k.png
import * as THREE from 'three';
import { setupBirkinScene } from './three/birkinScene';
import { createBirkinModel } from './three/createBirkinModel';

const SIZE = 4096;
const params = new URLSearchParams(location.search);
const azimuth = Number(params.get('az') ?? 28);
const name = params.get('name') ?? `birkin-25-az${azimuth}-4k.png`;
const status = document.getElementById('status')!;

async function run() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  const model = await createBirkinModel({ maxAnisotropy: renderer.capabilities.getMaxAnisotropy() });
  const view = setupBirkinScene(renderer, model, { azimuth, shadowMapSize: 4096 });
  view.frame(SIZE, SIZE, 1.12);
  renderer.render(view.scene, view.camera);

  // Crop to the visible pixels (bag + soft shadow) with a small margin.
  const full = document.createElement('canvas');
  full.width = full.height = SIZE;
  const ctx = full.getContext('2d')!;
  ctx.drawImage(renderer.domElement, 0, 0);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  let x0 = SIZE, y0 = SIZE, x1 = 0, y1 = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (data[(y * SIZE + x) * 4 + 3] > 3) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const pad = Math.round(SIZE * 0.015);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(SIZE - 1, x1 + pad);
  y1 = Math.min(SIZE - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(full, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  const save = async (canvas: HTMLCanvasElement, file: string, type: string, quality?: number) => {
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), type, quality));
    const res = await fetch(`/__save-render?name=${encodeURIComponent(file)}`, { method: 'POST', body: blob });
    return `${await res.text()} (${canvas.width}×${canvas.height}, ${Math.round(blob.size / 1024)} KB)`;
  };
  // Web-sized copy for the login page: a 1600 px tall WebP keeps transparency at a fraction of the size.
  const web = document.createElement('canvas');
  web.height = 1600;
  web.width = Math.round((out.width / out.height) * 1600);
  const wctx = web.getContext('2d')!;
  wctx.imageSmoothingQuality = 'high';
  wctx.drawImage(out, 0, 0, web.width, web.height);
  const base = name.replace(/\.png$/, '');
  status.textContent = [
    await save(out, name, 'image/png'),
    await save(out, `${base}.webp`, 'image/webp', 0.92),
    await save(web, `${base}-1600.webp`, 'image/webp', 0.9),
  ].join(' | ');
  out.style.cssText = 'max-width:100%;max-height:80vh;display:block;margin:0 auto';
  document.body.append(out);
  view.dispose();
  renderer.dispose();
}

run().catch((err) => {
  status.textContent = `Lỗi: ${err}`;
});
