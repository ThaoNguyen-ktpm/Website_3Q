// Worker-safe helpers for turning product photos into leather maps: decode, de-light, sample.

export interface Photo {
  w: number;
  h: number;
  rgb: Float32Array; // sRGB 0..1, 3 floats per pixel
}

export async function loadPhoto(url: string): Promise<Photo> {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const { width: w, height: h } = bitmap;
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = ctx.getImageData(0, 0, w, h).data;
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = data[i * 4] / 255;
    rgb[i * 3 + 1] = data[i * 4 + 1] / 255;
    rgb[i * 3 + 2] = data[i * 4 + 2] / 255;
  }
  return { w, h, rgb };
}

export const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Three passes of a separable box blur (≈ Gaussian), clamped at the borders. */
export function blur(src: Float32Array, w: number, h: number, r: number, wrapX = false, wrapY = false) {
  const a = Float32Array.from(src);
  const b = new Float32Array(src.length);
  const pass = (from: Float32Array, to: Float32Array, n: number, lines: number, stride: number, step: number, wrap: boolean) => {
    const norm = 1 / (2 * r + 1);
    for (let l = 0; l < lines; l++) {
      const base = l * stride;
      const at = (k: number) => from[base + (wrap ? ((k % n) + n) % n : Math.min(n - 1, Math.max(0, k))) * step];
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += at(k);
      for (let k = 0; k < n; k++) {
        to[base + k * step] = sum * norm;
        sum += at(k + r + 1) - at(k - r);
      }
    }
  };
  for (let i = 0; i < 3; i++) {
    pass(a, b, w, h, w, 1, wrapX);
    pass(b, a, h, w, 1, w, wrapY);
  }
  return a;
}

/**
 * Removes the photo's broad studio shading so the 3D lights can shade the leather instead: each
 * pixel is divided by the local mean luminance of the bag (white background excluded).
 */
export function delight(p: Photo, radiusPx: number, strength: number): Photo {
  const n = p.w * p.h;
  const lum = new Float32Array(n);
  const mask = new Float32Array(n);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const r = p.rgb[i * 3];
    const g = p.rgb[i * 3 + 1];
    const b = p.rgb[i * 3 + 2];
    const l = luminance(r, g, b);
    const m = l < 0.8 || Math.max(r, g, b) - Math.min(r, g, b) > 0.12 ? 1 : 0;
    lum[i] = l * m;
    mask[i] = m;
    sum += l * m;
    count += m;
  }
  const mean = sum / Math.max(1, count);
  const bl = blur(lum, p.w, p.h, radiusPx);
  const bm = blur(mask, p.w, p.h, radiusPx);
  const rgb = Float32Array.from(p.rgb);
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const local = bl[i] / Math.max(bm[i], 1e-3);
    const gain = Math.min(2.2, Math.max(0.45, Math.pow(mean / Math.max(local, 0.02), strength)));
    rgb[i * 3] *= gain;
    rgb[i * 3 + 1] *= gain;
    rgb[i * 3 + 2] *= gain;
  }
  return { w: p.w, h: p.h, rgb };
}

/** Unsharp mask on luminance only (no colour fringing): adds back `amount` × the fine detail. */
export function sharpen(p: Photo, radiusPx: number, amount: number): Photo {
  const n = p.w * p.h;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = luminance(p.rgb[i * 3], p.rgb[i * 3 + 1], p.rgb[i * 3 + 2]);
  const soft = blur(lum, p.w, p.h, radiusPx);
  const rgb = Float32Array.from(p.rgb);
  for (let i = 0; i < n; i++) {
    const d = (lum[i] - soft[i]) * amount;
    rgb[i * 3] += d;
    rgb[i * 3 + 1] += d;
    rgb[i * 3 + 2] += d;
  }
  return { w: p.w, h: p.h, rgb };
}

/** Mean colour of the pixels inside a rectangle. */
export function meanColor(p: Photo, x0: number, y0: number, x1: number, y1: number): [number, number, number] {
  const acc = [0, 0, 0];
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * p.w + x) * 3;
      acc[0] += p.rgb[i];
      acc[1] += p.rgb[i + 1];
      acc[2] += p.rgb[i + 2];
      n++;
    }
  }
  return [acc[0] / n, acc[1] / n, acc[2] / n];
}

/** Bilinear sample in pixel coordinates, clamped to the image. Writes rgb into `out`. */
export function sample(p: Photo, x: number, y: number, out: number[]) {
  const fx = Math.min(p.w - 1.001, Math.max(0, x - 0.5));
  const fy = Math.min(p.h - 1.001, Math.max(0, y - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const i00 = (y0 * p.w + x0) * 3;
  const i10 = i00 + 3;
  const i01 = i00 + p.w * 3;
  const i11 = i01 + 3;
  for (let c = 0; c < 3; c++) {
    const top = p.rgb[i00 + c] + (p.rgb[i10 + c] - p.rgb[i00 + c]) * tx;
    const bottom = p.rgb[i01 + c] + (p.rgb[i11 + c] - p.rgb[i01 + c]) * tx;
    out[c] = top + (bottom - top) * ty;
  }
  return out;
}

/** Folds a coordinate into [0, len) with mirrored repeats, so tiled patches have no hard seams. */
export function mirrorRepeat(v: number, len: number) {
  const k = Math.floor(v / len);
  const f = v - k * len;
  return k % 2 === 0 ? f : len - f;
}
