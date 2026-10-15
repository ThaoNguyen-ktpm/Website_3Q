/**
 * Reconstruction data for a Birkin 25 in genuine matte alligator leather (Bleu Paon, gold hardware), measured in cm
 * from the front, side, back and bottom reference photos (see ./ref). Units are centimetres, +Y up, +Z = front.
 */
export const BIRKIN_SPEC = {
  body: {
    frontHeight: 17.7,
    halfWidth: 12.5,
    widthTaper: 0.7, // silhouette-checked: mouth ~22.8 cm wide (front/back photos)
    halfDepth: 6.5,
    depthTaper: 4.9, // the side profile closes from 13 cm at the base to ~3.2 cm at the mouth
    depthPower: 1.05, // straight, slim trapezoid side profile (estimated from the ¾ photo)
    bottomRadius: 0.7,
    superellipse: 8, // squared section, slightly softened corners
    backRise: 0.45,
    backArch: 0.55, // back/flap top 18.7 cm (+rim ≈ 19 cm body height); handles not included
    crease: 3.4, // the side gusset folds inward as a V, deepest at the mouth (estimated)
    creaseWidth: 1,
    creasePower: 1.0,
    panelBulge: 0.15, // just enough leather tension to avoid a flat box; more reads as a fat bag
  },
  strap: { y: 14.9, width: 1.45, thickness: 0.26, lift: 0.05, halfSpan: 10.1, backFrom: 6.6, backTo: 10.0 },
  keeperX: 7.0,
  handle: { legX: 3.75, radius: 0.54, archCenterY: 23.5, baseY: 15.9, topZ: 0.9 },
  tab: { y: 15.5, width: 1.9 },
  clochette: { x: 6.4, y: 9.6, tilt: 0.58 },
  cadena: { x: 4.65, y: 7.8 },
  feet: { x: 9.5, z: 4.7 },
} as const;

export const ATLAS_H = BIRKIN_SPEC.body.frontHeight + BIRKIN_SPEC.body.backRise + BIRKIN_SPEC.body.backArch + 0.3;
export const STRAP_TEX_LEN = 22;
