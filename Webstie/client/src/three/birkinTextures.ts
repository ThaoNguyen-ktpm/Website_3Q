// Worker-safe (no DOM): builds the leather maps from the real product photos. The front and back
// photos are de-lit and projected onto the body through the same analytic surface the mesh uses,
// so every scale lands where it is on the real bag. Small parts reuse clean patches of the photos.
import { Vector3 } from 'three';
import backUrl from './ref/birkin-back.jpg';
import frontUrl from './ref/birkin-front.jpg';
import { ATLAS_H, BIRKIN_SPEC, STRAP_TEX_LEN } from './birkinSpec';
import { arcFractions, BODY_SEGMENTS, bodyPoint, halfExtents, normalAt, smoothstep } from './birkinSurface';
import type { ScaleField } from './leatherMaps';
import { blur, delight, loadPhoto, luminance, meanColor, mirrorRepeat, sample, sharpen, type Photo } from './photoLeather';

/** Where the bag sits in each reference photo: bottom-centre pixel and pixels per cm. */
const FRONT = { cx: 435, by: 1095, ppc: 23.2 };
const BACK = { cx: 437, by: 1108, ppc: 23.8 };
/** Below the strap the front photo's right half (clochette, cadena) is replaced by the mirrored left half. */
const MIRROR_BELOW_CM = 14.3;
/** The photos already contain studio light; scale them down to an albedo the 3D lights can relight. */
const ALBEDO_GAIN = 0.46; // clearly darker than the photos, per the brief
const CREASE_CONTRAST = 0.55;
const SATURATION = 1.15;
const SHARPEN = 1.2; // unsharp-mask amount on the source photos
const GLOSS = { topRoughness: 0.36, midRoughness: 0.6, creaseRoughness: 0.9, contrast: 7 };

/** Clean patches, in photo pixels. */
const FLANK_PATCH = { x0: 175, x1: 290 }; // flank + outer belly along the front photo's left side
const STRAP_PATCH = { x0: 278, x1: 372, y0: 733, y1: 764 }; // strap between keeper and plate
const HANDLE_PATCH = { x0: 278, x1: 372, y0: 739, y1: 758 }; // middle rows of the strap: long tiles, no stitching
const TILE_PATCH = { x0: 178, x1: 240, y0: 880, y1: 1070 }; // back photo, lower-left flank

export interface BirkinFieldRequest {
  handleLength: number;
  urls?: { front: string; back: string };
}

export interface BirkinFields {
  body: ScaleField;
  handle: ScaleField;
  strap: ScaleField;
  tile: ScaleField;
  /** Physical size of the tile field in cm (for texture repeat). */
  tileCm: [number, number];
}

/** Albedo from `colorAt`, then normal + roughness derived from the albedo's fine luminance detail. */
function buildField(
  widthCm: number,
  heightCm: number,
  ppc: number,
  colorAt: (xCm: number, yCm: number, out: number[]) => void,
  wrapX: boolean,
  wrapY: boolean,
  normalStrength = 3.4,
): ScaleField {
  const W = Math.max(4, Math.round(widthCm * ppc));
  const H = Math.max(4, Math.round(heightCm * ppc));
  const rgb = new Float32Array(W * H * 3);
  const lum = new Float32Array(W * H);
  const c = [0, 0, 0];
  for (let py = 0; py < H; py++) {
    const y = heightCm - ((py + 0.5) / H) * heightCm;
    for (let px = 0; px < W; px++) {
      colorAt(((px + 0.5) / W) * widthCm, y, c);
      const i = py * W + px;
      rgb.set(c, i * 3);
      lum[i] = luminance(c[0], c[1], c[2]);
    }
  }
  // Matte alligator: the creases between scales photograph lighter than the domed scale tops.
  const fine = blur(lum, W, H, 1, wrapX, wrapY);
  const coarse = blur(lum, W, H, Math.max(2, Math.round(0.28 * (W / widthCm))), wrapX, wrapY);
  const height = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) height[i] = coarse[i] - fine[i];
  // The photos' pale crease lines read as chalk once relit; keep them but tone them down, and let
  // the normal map carry the relief instead. A little extra saturation keeps the darker teal rich.
  const albedo = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    // Floor the divisor: sharpening leaves a few near-black pixels that would otherwise blow up.
    const l = Math.max(lum[i], 0.06);
    const tamed = Math.max(0, coarse[i] + (l - coarse[i]) * CREASE_CONTRAST);
    const k = Math.min(2, tamed / l) * ALBEDO_GAIN;
    for (let ch = 0; ch < 3; ch++) {
      const v = Math.min(1, Math.max(0, rgb[i * 3 + ch]));
      albedo[i * 4 + ch] = Math.min(1, Math.max(0, l + (v - l) * SATURATION)) * k * 255;
    }
    albedo[i * 4 + 3] = 255;
  }
  const normal = new Uint8ClampedArray(W * H * 4);
  const roughness = new Uint8ClampedArray(W * H * 4);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const xl = wrapX ? (px - 1 + W) % W : Math.max(0, px - 1);
      const xr = wrapX ? (px + 1) % W : Math.min(W - 1, px + 1);
      const yu = wrapY ? (py - 1 + H) % H : Math.max(0, py - 1);
      const yd = wrapY ? (py + 1) % H : Math.min(H - 1, py + 1);
      const i = py * W + px;
      const nx = -(height[py * W + xr] - height[py * W + xl]) * 0.5 * normalStrength;
      const ny = -(height[yu * W + px] - height[yd * W + px]) * 0.5 * normalStrength;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      normal[i * 4] = (nx * inv * 0.5 + 0.5) * 255;
      normal[i * 4 + 1] = (ny * inv * 0.5 + 0.5) * 255;
      normal[i * 4 + 2] = (inv * 0.5 + 0.5) * 255;
      normal[i * 4 + 3] = 255;
      // Gloss contrast: domed scale tops polish up, creases stay matte.
      const r = Math.min(GLOSS.creaseRoughness, Math.max(GLOSS.topRoughness, GLOSS.midRoughness - height[i] * GLOSS.contrast)) * 255;
      roughness[i * 4] = r;
      roughness[i * 4 + 1] = r;
      roughness[i * 4 + 2] = r;
      roughness[i * 4 + 3] = 255;
    }
  }
  return { width: W, height: H, pxPerCm: W / widthCm, albedo, normal, roughness };
}

function scaleColors(p: Photo, gain: [number, number, number]) {
  for (let i = 0; i < p.w * p.h; i++) {
    p.rgb[i * 3] *= gain[0];
    p.rgb[i * 3 + 1] *= gain[1];
    p.rgb[i * 3 + 2] *= gain[2];
  }
}

export async function computeBirkinFields({ handleLength, urls }: BirkinFieldRequest): Promise<BirkinFields> {
  const [frontRaw, backRaw] = await Promise.all([loadPhoto(urls?.front ?? frontUrl), loadPhoto(urls?.back ?? backUrl)]);
  const front = sharpen(delight(frontRaw, Math.round(2.5 * FRONT.ppc), 0.8), 1, SHARPEN);
  const back = sharpen(delight(backRaw, Math.round(2.5 * BACK.ppc), 0.8), 1, SHARPEN);
  // Match the back photo's white balance to the front one on a clean belly area of each.
  const fm = meanColor(front, 220, 800, 420, 1060);
  const bm = meanColor(back, 240, 820, 640, 1080);
  scaleColors(back, [fm[0] / bm[0], fm[1] / bm[1], fm[2] / bm[2]]);

  // Keep samples inside each photo's silhouette: the panel edges turn away and show background.
  const inside = (x: number, y: number) => Math.sign(x) * Math.min(Math.abs(x), halfExtents(Math.min(y, 17.7)).w - 0.7);
  const frontAt = (x: number, y: number, out: number[]) => {
    const cx = inside(x, y);
    let mx = y < MIRROR_BELOW_CM ? -Math.abs(cx) : cx;
    // Above the strap the photo shows the handle legs and a dark tag; patch from clean leather to the right.
    if (y > 15.65 && Math.abs(mx) > 2.8 && Math.abs(mx) < 6.5) mx = Math.abs(mx) + 3.8;
    return sample(front, FRONT.cx + mx * FRONT.ppc, FRONT.by - Math.min(y, 19) * FRONT.ppc, out);
  };
  const backAt = (x: number, y: number, out: number[]) => {
    const cx = inside(x, y);
    const top = 18.5 - 0.7 * (cx / 12) ** 2;
    // Reflect (not clamp) past the photographed top edge, so no row is smeared.
    const ry = y > top ? top - (y - top) : y;
    return sample(back, BACK.cx - cx * BACK.ppc, BACK.by - ry * BACK.ppc, out);
  };
  const flankW = (FLANK_PATCH.x1 - FLANK_PATCH.x0) / FRONT.ppc;
  // The flank patch sits at the photo's edge where de-lighting over-brightens; match it to the belly.
  const flm = meanColor(front, FLANK_PATCH.x0, 780, FLANK_PATCH.x1, 1070);
  const flankGain = [fm[0] / flm[0], fm[1] / flm[1], fm[2] / flm[2]];
  const sideAt = (z: number, y: number, out: number[]) => {
    sample(
      front,
      FLANK_PATCH.x0 + mirrorRepeat(z + 7, flankW) * FRONT.ppc,
      FRONT.by - (0.8 + mirrorRepeat(Math.max(0, y - 0.8), 12.5)) * FRONT.ppc,
      out,
    );
    for (let c = 0; c < 3; c++) out[c] *= flankGain[c];
    return out;
  };

  // Body atlas: u runs around the perimeter (1 - arc fraction), v is height / ATLAS_H.
  const { frac, perimeter } = arcFractions();
  const thetaOf = (u: number) => {
    const f = 1 - u;
    let lo = 0;
    let hi = BODY_SEGMENTS;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (frac[mid] <= f) lo = mid;
      else hi = mid;
    }
    const t = (f - frac[lo]) / Math.max(1e-9, frac[hi] - frac[lo]);
    return ((lo + t) / BODY_SEGMENTS) * Math.PI * 2;
  };
  const p = new Vector3();
  const n = new Vector3();
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const s = [0, 0, 0];
  const body = buildField(
    perimeter,
    ATLAS_H,
    40,
    (xCm, y, out) => {
      const theta = thetaOf(xCm / perimeter);
      bodyPoint(theta, y, p);
      normalAt(theta, y, n);
      // Hand over to side leather before the photo samples reach the silhouette clamp.
      const edge = 1 - smoothstep(halfExtents(Math.min(y, 17.7)).w - 2.2, halfExtents(Math.min(y, 17.7)).w - 1.0, Math.abs(p.x));
      // Panels by position around the section (corners at 45°), so the folded gusset faces,
      // whose normals tilt forward/back, still get side leather.
      const st = Math.sin(theta);
      const wf = smoothstep(0.6, 0.75, st) * edge;
      const wb = smoothstep(0.6, 0.75, -st) * edge;
      const ws = 1 - wf - wb;
      if (wf > 0) frontAt(p.x, y, a);
      if (wb > 0) backAt(p.x, y, b);
      if (ws > 0) sideAt(p.z, y, s);
      for (let c = 0; c < 3; c++) out[c] = a[c] * wf + b[c] * wb + s[c] * ws;
    },
    true,
    false,
  );

  const strapLen = (STRAP_PATCH.x1 - STRAP_PATCH.x0) / FRONT.ppc;
  const strapW = BIRKIN_SPEC.strap.width;
  const strap = buildField(
    STRAP_TEX_LEN,
    strapW,
    46,
    (x, y, out) =>
      sample(
        front,
        STRAP_PATCH.x0 + mirrorRepeat(x, strapLen) * FRONT.ppc,
        STRAP_PATCH.y0 + ((strapW - y) / strapW) * (STRAP_PATCH.y1 - STRAP_PATCH.y0),
        out,
      ),
    false,
    false,
  );

  // Handle: the strap's long tiles wrapped round the roll (the photographed handle is too narrow to unwrap).
  const hp = HANDLE_PATCH;
  const circumference = Math.PI * 2 * BIRKIN_SPEC.handle.radius;
  const hpLen = (hp.x1 - hp.x0) / FRONT.ppc;
  const hpAround = (hp.y1 - hp.y0) / FRONT.ppc;
  const handle = buildField(
    handleLength,
    circumference,
    48,
    (x, y, out) => sample(front, hp.x0 + mirrorRepeat(x, hpLen) * FRONT.ppc, hp.y0 + mirrorRepeat(y, hpAround) * FRONT.ppc, out),
    false,
    true,
  );

  const tp = TILE_PATCH;
  const tileW = (tp.x1 - tp.x0) / BACK.ppc;
  const tileH = (tp.y1 - tp.y0) / BACK.ppc;
  const tile = buildField(
    tileW * 2,
    tileH * 2,
    46,
    (x, y, out) => sample(back, tp.x0 + mirrorRepeat(x, tileW) * BACK.ppc, tp.y0 + mirrorRepeat(y, tileH) * BACK.ppc, out),
    true,
    true,
  );

  return { body, handle, strap, tile, tileCm: [tileW * 2, tileH * 2] };
}
