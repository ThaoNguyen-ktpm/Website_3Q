// Analytic body surface shared by the mesh builder and the texture worker, so UVs and the
// photo projection always agree. Only depends on three's Vector3.
import { Vector3 } from 'three';
import { BIRKIN_SPEC } from './birkinSpec';

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const B = BIRKIN_SPEC.body;
export type Side = 'front' | 'back';

const spow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

export function halfExtents(y: number) {
  const t = Math.min(Math.max(y / B.frontHeight, 0), 1.15);
  const td = Math.min(t, 1);
  let w = B.halfWidth - B.widthTaper * t * t;
  let d = B.halfDepth - B.depthTaper * Math.pow(td, B.depthPower);
  if (y < B.bottomRadius) {
    const k = B.bottomRadius - y;
    const inset = B.bottomRadius - Math.sqrt(Math.max(0, B.bottomRadius ** 2 - k * k));
    w -= inset;
    d -= inset;
  }
  return { w, d, t: td };
}

export function bodyPoint(theta: number, y: number, out = new Vector3()) {
  const { w, d, t } = halfExtents(y);
  const e = 2 / B.superellipse;
  let x = w * spow(Math.cos(theta), e);
  let z = d * spow(Math.sin(theta), e);
  const k = Math.max(0, 1 - Math.abs(z) / (B.creaseWidth * d));
  // Linear in |z|: two flat gusset faces meeting at the centre pleat.
  if (k > 0) x -= Math.sign(x) * B.crease * Math.pow(t, B.creasePower) * k;
  // Leather tension: front/back panels swell slightly between the side seams and base/mouth.
  const panel = smoothstep(0.55, 0.85, Math.abs(Math.sin(theta)));
  if (panel > 0) {
    const across = 1 - Math.min(1, (x / w) ** 2);
    z += Math.sign(z) * B.panelBulge * panel * across * Math.sin(Math.PI * Math.min(1, y / B.frontHeight));
  }
  return out.set(x, y, z);
}

export function topHeight(theta: number) {
  const back = smoothstep(0.15, -0.55, Math.sin(theta));
  const c = Math.cos(theta);
  return B.frontHeight + back * (B.backRise + B.backArch * (1 - c * c));
}

export function thetaForX(x: number, y: number, side: Side) {
  let lo = side === 'front' ? 0 : Math.PI;
  let hi = side === 'front' ? Math.PI : Math.PI * 2;
  const p = new Vector3();
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    bodyPoint(mid, y, p);
    const goHigher = side === 'front' ? p.x > x : p.x < x;
    if (goHigher) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function normalAt(theta: number, y: number, out = new Vector3()) {
  const e = 1e-3;
  const a = bodyPoint(theta + e, y);
  const b = bodyPoint(theta - e, y);
  const c = bodyPoint(theta, y + e);
  const d = bodyPoint(theta, y - e);
  const tTheta = a.sub(b);
  const tY = c.sub(d);
  return out.crossVectors(tY, tTheta).normalize();
}

export const BODY_SEGMENTS = 200;

/** Normalised arc length around the mid-height ring; the body atlas u is `1 - frac`. */
export function arcFractions() {
  const yMid = B.frontHeight * 0.5;
  const frac = new Float32Array(BODY_SEGMENTS + 1);
  const a = bodyPoint(0, yMid);
  const b = new Vector3();
  let perimeter = 0;
  for (let i = 1; i <= BODY_SEGMENTS; i++) {
    bodyPoint((i / BODY_SEGMENTS) * Math.PI * 2, yMid, b);
    perimeter += a.distanceTo(b);
    frac[i] = perimeter;
    a.copy(b);
  }
  for (let i = 0; i <= BODY_SEGMENTS; i++) frac[i] /= perimeter;
  return { frac, perimeter };
}
