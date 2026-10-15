import * as THREE from 'three';
import { fieldToCanvases, type ScaleCanvases } from './leatherMaps';
import { arcFractions, BODY_SEGMENTS, bodyPoint, normalAt, thetaForX, topHeight, type Side } from './birkinSurface';
import { ATLAS_H, BIRKIN_SPEC, STRAP_TEX_LEN } from './birkinSpec';
import { computeBirkinFields, type BirkinFieldRequest, type BirkinFields } from './birkinTextures';

export { BIRKIN_SPEC } from './birkinSpec';

const B = BIRKIN_SPEC.body;

/** Pendant dynamics (damped springs, exaggerated so the motion reads at small sizes). */
const SWING = {
  clochette: { stiffness: 26, damping: 2.4 },
  cadena: { stiffness: 38, damping: 2.8 },
  accel: 0.6, // swing per unit of spin acceleration
  drag: 0.8, // lag per unit of spin rate
  idle: 0.5, // gentle sway when the bag is still
  lift: 0.06, // outward swing from spin (centrifugal)
  maxLift: 0.45,
  maxAngle: 0.55,
};

/** Point + orientation on the leather surface, local +Z along the outward normal, local +Y up. */
function surfaceFrame(x: number, y: number, side: Side, offset = 0) {
  const theta = thetaForX(x, y, side);
  const n = normalAt(theta, y);
  const position = bodyPoint(theta, y).addScaledVector(n, offset);
  const xAxis = new THREE.Vector3(0, 1, 0).cross(n).normalize();
  const yAxis = new THREE.Vector3().crossVectors(n, xAxis);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, n));
  return { position, quaternion, normal: n };
}

function placeOnSurface(obj: THREE.Object3D, x: number, y: number, side: Side, offset: number) {
  const f = surfaceFrame(x, y, side, offset);
  obj.position.copy(f.position);
  obj.quaternion.copy(f.quaternion);
  return obj;
}

// ---------------------------------------------------------------- geometry

/** The leather shell. With `fromY`, builds only the inward-facing upper band (the folded flap). */
function buildBodyGeometry(fromY?: number, inset = 0) {
  const segU = BODY_SEGMENTS;
  const segB = fromY === undefined ? 8 : 0;
  const segUp = fromY === undefined ? 44 : 6;
  const { frac, perimeter } = arcFractions();

  const rows = segB + segUp + 1;
  const pos = new Float32Array(rows * (segU + 1) * 3);
  const uv = new Float32Array(rows * (segU + 1) * 2);
  const p = new THREE.Vector3();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i <= segU; i++) {
      const theta = ((i % segU) / segU) * Math.PI * 2;
      const y0 = fromY ?? B.bottomRadius;
      const y =
        j < segB
          ? B.bottomRadius * (1 - Math.cos((j / segB) * (Math.PI / 2)))
          : y0 + (topHeight(theta) - y0) * ((j - segB) / segUp);
      bodyPoint(theta, y, p);
      if (inset) p.addScaledVector(normalAt(theta, y), -inset);
      const v = j * (segU + 1) + i;
      pos.set([p.x, p.y, p.z], v * 3);
      uv.set([1 - frac[i], y / ATLAS_H], v * 2);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < segU; i++) {
      const va = j * (segU + 1) + i;
      const vb = va + 1;
      const vc = va + segU + 1;
      const vd = vc + 1;
      if (fromY === undefined) index.push(va, vc, vd, va, vd, vb);
      else index.push(va, vd, vc, va, vb, vd);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return { geometry: g, perimeter };
}

function buildBaseGeometry() {
  const seg = 200;
  const pos: number[] = [0, 0, 0];
  const uv: number[] = [0, 0];
  const p = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    bodyPoint((i / seg) * Math.PI * 2, 0, p);
    pos.push(p.x, 0, p.z);
    uv.push(p.x, p.z);
  }
  const index: number[] = [];
  for (let i = 1; i <= seg; i++) index.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A leather band that hugs the body: outer face is group 0, inner face + cut edges are group 1. */
function buildBandGeometry(side: Side, xa: number, xb: number, yc: number, width: number, texLen: number) {
  const S = BIRKIN_SPEC.strap;
  const ta = thetaForX(xa, yc, side);
  const tb = thetaForX(xb, yc, side);
  const N = 90;
  const M = 6;
  const thetas: number[] = [];
  const s: number[] = [0];
  let prev = bodyPoint(ta, yc);
  for (let i = 0; i <= N; i++) {
    const th = ta + ((tb - ta) * i) / N;
    thetas.push(th);
    if (i > 0) {
      const cur = bodyPoint(th, yc);
      s.push(s[i - 1] + cur.distanceTo(prev));
      prev = cur;
    }
  }
  const total = s[N];
  const r = width / 2;
  const pos: number[] = [];
  const uv: number[] = [];
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  const layer = (offset: number) => {
    for (let i = 0; i <= N; i++) {
      const d = Math.min(s[i], total - s[i]);
      const round = d >= r ? 1 : Math.sqrt(Math.max(0, 1 - ((r - d) / r) ** 2));
      for (let k = 0; k <= M; k++) {
        const v = -1 + (2 * k) / M;
        const y = yc + v * r * round;
        bodyPoint(thetas[i], y, p);
        normalAt(thetas[i], y, n);
        p.addScaledVector(n, offset);
        pos.push(p.x, p.y, p.z);
        uv.push(s[i] / texLen, 0.5 + (v * round) / 2);
      }
    }
  };
  layer(S.lift + S.thickness);
  layer(S.lift);
  const stride = M + 1;
  const inner = (N + 1) * stride;
  const outerIdx: number[] = [];
  const edgeIdx: number[] = [];
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < M; k++) {
      const va = i * stride + k;
      const vb = va + stride;
      const vc = va + 1;
      const vd = vb + 1;
      outerIdx.push(va, vc, vd, va, vd, vb);
      edgeIdx.push(inner + va, inner + vd, inner + vc, inner + va, inner + vb, inner + vd);
    }
    for (const k of [0, M]) {
      const oa = i * stride + k;
      const ob = oa + stride;
      edgeIdx.push(oa, ob, inner + ob, oa, inner + ob, inner + oa);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([...outerIdx, ...edgeIdx]);
  g.addGroup(0, outerIdx.length, 0);
  g.addGroup(outerIdx.length, edgeIdx.length, 1);
  g.computeVertexNormals();
  return g;
}

function handleCurve(side: Side) {
  const H = BIRKIN_SPEC.handle;
  const sign = side === 'front' ? 1 : -1;
  const topY = H.archCenterY + H.legX;
  const z0 = surfaceFrame(H.legX, H.baseY + 0.4, side, 0.2 + H.radius).position.z;
  const zAt = (y: number) => z0 + (sign * H.topZ - z0) * Math.min(1, Math.max(0, (y - H.baseY) / (topY - H.baseY)));
  const leg = (x: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 4; i++) {
      const y = H.baseY + 0.25 + ((H.archCenterY - H.baseY - 0.25) * i) / 4;
      pts.push(new THREE.Vector3(x, y, zAt(y)));
    }
    return pts;
  };
  const end = (x: number) => surfaceFrame(x, H.baseY - 0.3, side, 0.55).position;
  const arc: THREE.Vector3[] = [];
  for (let i = 1; i < 16; i++) {
    const phi = Math.PI - (Math.PI * i) / 16;
    const y = H.archCenterY + H.legX * Math.sin(phi);
    arc.push(new THREE.Vector3(H.legX * Math.cos(phi), y, zAt(y)));
  }
  const pts = [end(-H.legX), ...leg(-H.legX), ...arc, ...leg(H.legX).reverse(), end(H.legX)];
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function sanglePlateShape(outer: 1 | -1, withSlot: boolean) {
  const w = 2.3;
  const h = 1.45;
  const c = 0.32;
  const ox = (outer * w) / 2;
  const ix = (-outer * w) / 2;
  const s = new THREE.Shape();
  s.moveTo(ix, -h / 2);
  s.lineTo(ox - outer * c, -h / 2);
  s.lineTo(ox, -h / 2 + c);
  s.lineTo(ox, h / 2 - c);
  s.lineTo(ox - outer * c, h / 2);
  s.lineTo(ix, h / 2);
  s.closePath();
  if (withSlot) {
    const hole = roundedRect(1.05, 0.4, 0.08);
    const slot = new THREE.Path(hole.getPoints().map((pt) => new THREE.Vector2(pt.x + outer * 0.1, pt.y)));
    s.holes.push(slot);
  }
  return s;
}

const extrude = (shape: THREE.Shape, depth: number, bevel: number) =>
  new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });

// ---------------------------------------------------------------- textures

interface BirkinCanvases {
  body: ScaleCanvases;
  handle: ScaleCanvases;
  strap: ScaleCanvases;
  tile: ScaleCanvases;
  tileCm: [number, number];
}

let canvasesPromise: Promise<BirkinCanvases> | null = null;

/** Leather maps are computed once from the photos, off the main thread when workers are available. */
function loadFields(req: BirkinFieldRequest) {
  return new Promise<BirkinFields>((resolve, reject) => {
    const fallback = () => computeBirkinFields(req).then(resolve, reject);
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return fallback();
    const worker = new Worker(new URL('./birkin.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<BirkinFields>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      fallback();
    };
    worker.postMessage(req);
  });
}

function getCanvases(handleLength: number) {
  canvasesPromise ??= loadFields({ handleLength }).then((f) => ({
    body: fieldToCanvases(f.body),
    handle: fieldToCanvases(f.handle),
    strap: fieldToCanvases(f.strap),
    tile: fieldToCanvases(f.tile),
    tileCm: f.tileCm,
  }));
  return canvasesPromise;
}

// ---------------------------------------------------------------- assembly

export interface BirkinModelOptions {
  maxAnisotropy?: number;
  /** Grey blockout materials, no textures: for checking proportions against the references. */
  clay?: boolean;
}

export interface BirkinModel {
  group: THREE.Group;
  /** Steps the hanging clochette and cadena; `omega` is the bag's spin rate relative to the viewer (rad/s). */
  animate(dt: number, omega: number): void;
  /** Model height in cm (base to handle top), for camera framing. */
  height: number;
  dispose(): void;
}

export async function createBirkinModel(options: BirkinModelOptions = {}): Promise<BirkinModel> {
  const aniso = options.maxAnisotropy ?? 8;
  const S = BIRKIN_SPEC.strap;
  const H = BIRKIN_SPEC.handle;
  const textures: THREE.Texture[] = [];

  const { geometry: bodyGeometry } = buildBodyGeometry();
  const curves = { front: handleCurve('front'), back: handleCurve('back') };
  const canvases = options.clay ? null : await getCanvases(curves.front.getLength());

  const leatherMaterial = (set: ScaleCanvases, repeat?: [number, number], side: THREE.Side = THREE.FrontSide) => {
    const make = (c: HTMLCanvasElement, srgb: boolean) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = aniso;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      if (repeat) t.repeat.set(repeat[0], repeat[1]);
      textures.push(t);
      return t;
    };
    return new THREE.MeshPhysicalMaterial({
      map: make(set.albedo, true),
      normalMap: make(set.normal, false),
      roughnessMap: make(set.roughness, false),
      roughness: 1,
      metalness: 0,
      normalScale: new THREE.Vector2(0.8, 0.8),
      specularIntensity: 0.85,
      clearcoat: 0.18, // thin polished top layer so highlights read crisper
      clearcoatRoughness: 0.32,
      sheen: 0.05,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color(0x6f9aa6),
      side,
    });
  };

  const clay = (color: number, side: THREE.Side = THREE.FrontSide) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, side });
  const mats = {
    body: canvases ? leatherMaterial(canvases.body) : clay(0x9a9a9a),
    handle: canvases ? leatherMaterial(canvases.handle) : clay(0x8c8c8c),
    strap: canvases ? leatherMaterial(canvases.strap, undefined, THREE.DoubleSide) : clay(0x7d7d7d, THREE.DoubleSide),
    tile: canvases ? leatherMaterial(canvases.tile, [1 / canvases.tileCm[0], 1 / canvases.tileCm[1]]) : clay(0x8c8c8c),
    lining: new THREE.MeshStandardMaterial({ color: canvases ? 0x1d3a42 : 0x5a5a5a, roughness: 0.85, side: THREE.BackSide }),
    edge: new THREE.MeshStandardMaterial({ color: canvases ? 0x1b3a45 : 0x555555, roughness: 0.55, side: THREE.DoubleSide }),
    lanyard: new THREE.MeshStandardMaterial({ color: canvases ? 0x24525f : 0x6a6a6a, roughness: 0.7 }),
    gold: canvases ? new THREE.MeshPhysicalMaterial({ color: 0xe3b860, metalness: 1, roughness: 0.26 }) : clay(0xd0d0d0),
  };

  const group = new THREE.Group();
  group.name = 'birkin25';
  const add = (parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Body shell, lining and base.
  const body = new THREE.Group();
  body.name = 'body';
  group.add(body);
  add(body, 'body-shell', bodyGeometry, mats.body);
  add(body, 'body-lining', bodyGeometry, mats.lining).castShadow = false;
  // The flap is tucked inside: croc, not lining, shows above the front panel edge.
  add(body, 'flap-fold', buildBodyGeometry(B.frontHeight - 1.4, 0.05).geometry, mats.body).castShadow = false;
  const baseGeometry = buildBaseGeometry();
  add(body, 'base', baseGeometry, mats.tile);
  add(body, 'base-lining', baseGeometry, mats.lining).castShadow = false;

  // Painted edges: top rim and the base seam.
  const rimPts: THREE.Vector3[] = [];
  for (let i = 0; i < 200; i++) {
    const th = (i / 200) * Math.PI * 2;
    rimPts.push(bodyPoint(th, topHeight(th)));
  }
  add(body, 'rim-edge', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 320, 0.17, 8, true), mats.edge);
  const basePts: THREE.Vector3[] = [];
  for (let i = 0; i < 200; i++) basePts.push(bodyPoint((i / 200) * Math.PI * 2, 0.32));
  add(body, 'base-seam', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(basePts, true), 300, 0.13, 6, true), mats.edge);

  // Feet: four gold studs under the base.
  const footGeometry = new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const [i, [fx, fz]] of [[1, 1], [-1, 1], [1, -1], [-1, -1]].entries()) {
    const foot = add(body, `foot-${i}`, footGeometry, mats.gold);
    foot.position.set(fx * BIRKIN_SPEC.feet.x, 0.02, fz * BIRKIN_SPEC.feet.z);
    foot.rotation.x = Math.PI;
    foot.scale.y = 0.6;
  }

  // Straps (sangles): front strap plus the two short stubs on the back.
  const straps = new THREE.Group();
  straps.name = 'straps';
  group.add(straps);
  const strapMats = [mats.strap, mats.edge];
  add(straps, 'strap-front', buildBandGeometry('front', -S.halfSpan, S.halfSpan, S.y, S.width, STRAP_TEX_LEN), strapMats);
  add(straps, 'strap-back-left', buildBandGeometry('back', -S.backTo, -S.backFrom, S.y, S.width, STRAP_TEX_LEN), strapMats);
  add(straps, 'strap-back-right', buildBandGeometry('back', S.backFrom, S.backTo, S.y, S.width, STRAP_TEX_LEN), strapMats);

  // Handles with their leather tabs.
  const tabShape = new THREE.Shape();
  const tw = BIRKIN_SPEC.tab.width / 2;
  const tt = H.radius * 1.05; // the tab narrows to the handle roll above the strap
  tabShape.moveTo(-tt, 1.4);
  tabShape.lineTo(-tw, 0.2);
  tabShape.lineTo(-tw, -0.3);
  tabShape.lineTo(0, -1.75);
  tabShape.lineTo(tw, -0.3);
  tabShape.lineTo(tw, 0.2);
  tabShape.lineTo(tt, 1.4);
  tabShape.closePath();
  const tabGeometry = extrude(tabShape, 0.14, 0.04);
  const capGeometry = new THREE.SphereGeometry(H.radius, 16, 12);
  for (const side of ['front', 'back'] as const) {
    const handle = new THREE.Group();
    handle.name = `handle-${side}`;
    group.add(handle);
    const curve = curves[side];
    add(handle, `handle-${side}-roll`, new THREE.TubeGeometry(curve, 220, H.radius, 16), mats.handle);
    for (const [i, t] of [0, 1].entries()) {
      const cap = add(handle, `handle-${side}-cap-${i}`, capGeometry, mats.tile);
      cap.position.copy(curve.getPoint(t));
      cap.scale.setScalar(0.92);
      cap.userData.explodeWithParent = true;
    }
    for (const x of [-H.legX, H.legX]) {
      const tab = add(handle, `handle-${side}-tab-${x < 0 ? 'left' : 'right'}`, tabGeometry, [mats.tile, mats.edge]);
      placeOnSurface(tab, x, BIRKIN_SPEC.tab.y, side, 0.04);
    }
  }

  // Front hardware: touret plate, sangle plates, turn-lock and keepers.
  const hardware = new THREE.Group();
  hardware.name = 'hardware';
  group.add(hardware);
  const strapTop = S.lift + S.thickness;
  const lock = new THREE.Group();
  lock.name = 'turn-lock';
  placeOnSurface(lock, 0, S.y, 'front', strapTop);
  hardware.add(lock);
  const plate = add(lock, 'touret-plate', extrude(roundedRect(2.4, 2.7, 0.2), 0.08, 0.035), mats.gold);
  plate.position.set(0, -0.15, -strapTop + 0.05);
  add(lock, 'sangle-plate-left', extrude(sanglePlateShape(-1, true), 0.1, 0.035), mats.gold).position.set(-1.2, 0, 0.03);
  add(lock, 'sangle-plate-right', extrude(sanglePlateShape(1, false), 0.1, 0.035), mats.gold).position.set(1.3, 0, 0.03);
  const post = add(lock, 'touret-post', new THREE.CylinderGeometry(0.2, 0.22, 0.75, 16), mats.gold);
  post.rotation.x = Math.PI / 2;
  post.position.set(0, -0.05, 0.25);
  const bar = add(lock, 'touret-bar', new THREE.CapsuleGeometry(0.16, 1.0, 4, 12), mats.gold);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, -0.05, 0.62);
  add(lock, 'touret-hub', new THREE.SphereGeometry(0.23, 16, 12), mats.gold).position.set(0, -0.05, 0.62);
  const keeperGeometry = extrude(roundedRect(0.33, 1.9, 0.07), 0.08, 0.035);
  for (const x of [-BIRKIN_SPEC.keeperX, BIRKIN_SPEC.keeperX]) {
    placeOnSurface(add(hardware, `keeper-${x < 0 ? 'left' : 'right'}`, keeperGeometry, mats.gold), x, S.y, 'front', strapTop);
  }

  // Clochette + cadena hanging on a leather lanyard from the right front handle leg.
  const charms = new THREE.Group();
  charms.name = 'charms';
  group.add(charms);
  const C = BIRKIN_SPEC.clochette;
  const bell = new THREE.Shape();
  bell.moveTo(-0.65, 1.85);
  bell.quadraticCurveTo(0, 2.35, 0.65, 1.85);
  bell.lineTo(0.7, 0.75);
  bell.quadraticCurveTo(0.85, -0.6, 1.15, -1.3);
  bell.lineTo(1.1, -1.85);
  bell.lineTo(-1.1, -1.85);
  bell.lineTo(-1.15, -1.3);
  bell.quadraticCurveTo(-0.85, -0.6, -0.7, 0.75);
  bell.closePath();
  const clochettePivot = new THREE.Group();
  clochettePivot.name = 'clochette';
  placeOnSurface(clochettePivot, C.x, C.y, 'front', 0.3);
  charms.add(clochettePivot);
  add(clochettePivot, 'clochette-body', extrude(bell, 0.6, 0.1), [mats.tile, mats.edge]).rotation.z = C.tilt;

  const K = BIRKIN_SPEC.cadena;
  const cadena = new THREE.Group();
  cadena.name = 'cadena';
  placeOnSurface(cadena, K.x, K.y, 'front', 0.25);
  charms.add(cadena);
  add(cadena, 'cadena-body', extrude(roundedRect(1.9, 2.1, 0.35), 0.55, 0.1), [mats.tile, mats.edge]);
  const shackle = add(cadena, 'cadena-shackle', new THREE.TorusGeometry(0.5, 0.1, 10, 24, Math.PI), mats.gold);
  shackle.position.set(0, 1.4, 0.32);
  for (const sx of [-0.5, 0.5]) {
    const legMesh = add(cadena, `cadena-shackle-leg-${sx < 0 ? 'left' : 'right'}`, new THREE.CylinderGeometry(0.1, 0.1, 0.4, 10), mats.gold);
    legMesh.position.set(sx, 1.2, 0.32);
  }
  const lanyardPath = (pts: [number, number, number][]) =>
    new THREE.CatmullRomCurve3(pts.map(([x, y, off]) => surfaceFrame(x, y, 'front', off).position));
  const lanyardClochette = add(charms, 'lanyard-clochette', new THREE.TubeGeometry(lanyardPath([[4.1, 16.4, 1.1], [4.6, 14.2, 0.8], [5.1, 12.4, 0.6], [5.45, 11.3, 0.55]]), 40, 0.09, 6), mats.lanyard);
  const lanyardCadena = add(charms, 'lanyard-cadena', new THREE.TubeGeometry(lanyardPath([[4.1, 16.4, 1.1], [4.3, 13.6, 0.75], [4.6, 10.6, 0.6], [4.65, 9.75, 0.6]]), 40, 0.09, 6), mats.lanyard);

  // Each pendant (charm + its lanyard) swings rigidly about the lanyard knot on the handle leg:
  // an outer pivot holds the surface frame, an inner group carries the swing.
  const knot = surfaceFrame(4.1, 16.4, 'front', 1.1);
  group.updateMatrixWorld(true);
  const pendant = (name: string, parts: THREE.Object3D[], stiffness: number, damping: number, idleRate: number) => {
    const pivot = new THREE.Group();
    pivot.name = `${name}-pivot`;
    pivot.position.copy(knot.position);
    pivot.quaternion.copy(knot.quaternion);
    const swing = new THREE.Group();
    swing.name = `${name}-swing`;
    pivot.add(swing);
    charms.add(pivot);
    charms.updateMatrixWorld(true);
    parts.forEach((p) => swing.attach(p));
    return { swing, stiffness, damping, idleRate, angle: 0, angleV: 0, lift: 0, liftV: 0 };
  };
  const pendants = [
    pendant('clochette', [clochettePivot, lanyardClochette], SWING.clochette.stiffness, SWING.clochette.damping, 1.3),
    pendant('cadena', [cadena, lanyardCadena], SWING.cadena.stiffness, SWING.cadena.damping, 1.7),
  ];
  let time = 0;
  let lastOmega = 0;
  let accel = 0;

  return {
    group,
    height: H.archCenterY + H.legX + H.radius,
    animate(dt, omega) {
      if (dt <= 0) return;
      time += dt;
      accel += ((omega - lastOmega) / dt - accel) * Math.min(1, dt * 12);
      lastOmega = omega;
      const liftTarget = Math.min(SWING.maxLift, SWING.lift * omega * omega);
      for (const p of pendants) {
        const drive = -SWING.accel * accel - SWING.drag * omega + SWING.idle * Math.sin(time * p.idleRate);
        p.angleV += (-p.stiffness * p.angle - p.damping * p.angleV + drive) * dt;
        p.angle = THREE.MathUtils.clamp(p.angle + p.angleV * dt, -SWING.maxAngle, SWING.maxAngle);
        p.liftV += (-p.stiffness * (p.lift - liftTarget) - p.damping * p.liftV) * dt;
        p.lift = THREE.MathUtils.clamp(p.lift + p.liftV * dt, 0, SWING.maxLift); // never swings into the leather
        p.swing.rotation.set(-p.lift, 0, p.angle);
      }
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      Object.values(mats).forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
