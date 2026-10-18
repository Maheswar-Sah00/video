// Pseudo-3D head model for HIM (owner: hero). Pure math, no React.
//
// Head-local coordinates at scale 1: x right, y down, z toward the camera (front view). Origin = the
// bridge of the nose. The head is a stack of horizontal cross-sections (rows by y); each row is a
// super-ellipse with half-width A(y), front depth ZF(y), back depth ZB(y) around a centre ZC(y),
// plus a narrow "bump" profile down the middle (brow, nose, lips, chin). A point on the surface is
// addressed by (th, y): th = angle around the vertical axis (0 = front centre line, + = screen-right
// in front view, ±PI = back). The head is pitched (tilt) about a pivot near the top of the neck and
// then yawed (turn), and projected orthographically.

import {clamp, lerp} from '../../../lib/anim';

export type Tab = [number, number][];
export const pw = (t: Tab, y: number) => {
  if (y <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (y <= t[i][0]) return lerp(t[i - 1][1], t[i][1], (y - t[i - 1][0]) / (t[i][0] - t[i - 1][0]));
  return t[t.length - 1][1];
};
const sgnpow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);

export const TOP = -268;
export const BOT = 196;
// half width
const A: Tab = [[-268, 0], [-260, 52], [-246, 92], [-222, 122], [-186, 143], [-140, 154], [-80, 157], [-20, 155], [30, 151], [70, 146], [100, 137], [124, 125], [148, 106], [166, 84], [180, 60], [190, 36], [196, 0]];
// front z (absolute)
const ZF: Tab = [[-268, 0], [-258, 58], [-240, 98], [-210, 124], [-170, 140], [-120, 150], [-70, 153], [-40, 150], [0, 142], [40, 145], [80, 150], [110, 150], [140, 146], [165, 138], [182, 127], [191, 113], [196, 98]];
// back z (absolute, negative)
const ZB: Tab = [[-268, 0], [-258, -84], [-240, -142], [-210, -182], [-170, -204], [-120, -214], [-60, -210], [0, -196], [40, -176], [80, -142], [100, -114], [128, -50], [156, -6], [178, 18], [196, 42]];
// cross-section centre z
const ZC: Tab = [[-268, 0], [100, 0], [140, 6], [170, 18], [196, 34]];
// centre-line relief (added at th≈0): brow ridge, nose, lips, chin
const BUMP: Tab = [[-70, 0], [-44, 5], [-20, 2], [6, 6], [30, 18], [52, 34], [66, 44], [74, 40], [82, 18], [90, 4], [100, 2], [112, 9], [124, 12], [134, 5], [146, 2], [160, 6], [178, 12], [192, 6]];

/** lowest row of the head surface at angle th: the jaw line in front, the nape behind */
export const jawY = (th: number) => pw([[0, 194], [0.5, 190], [0.9, 181], [1.2, 170], [1.4, 158], [1.53, 138], [1.62, 112], [1.8, 106], [2.2, 118], [Math.PI + 0.01, 124]], Math.abs(th));

export type Geo = ReturnType<typeof makeGeo>;
export type P3 = {x: number; y: number; z: number; n: number};

/**
 * yawDeg: + = face turns toward screen-right. pitchDeg: + = looking up. thin: 0..1 (illness:
 * hollower cheeks / narrower jaw). mouthDrop: px the jaw drops (mouth open).
 */
export const makeGeo = (yawDeg: number, pitchDeg: number, thin = 0, mouthDrop = 0) => {
  const Y = (yawDeg * Math.PI) / 180;
  const P = (pitchDeg * Math.PI) / 180;
  const cY = Math.cos(Y), sY = Math.sin(Y);
  const cP = Math.cos(P), sP = Math.sin(P);
  const PY = 60, PZ = -20; // pitch pivot (top of the neck)
  const thinK = (y: number) => 1 - thin * 0.09 * Math.exp(-Math.pow((y - 110) / 60, 2));
  const jy = (y: number) => y + mouthDrop * clamp((y - 118) / 40);

  /** rotate a head-local point (x,y,z) to view space */
  const rot = (x: number, y: number, z: number) => {
    const y1 = PY + (y - PY) * cP - (z - PZ) * sP;
    const z1 = PZ + (y - PY) * sP + (z - PZ) * cP;
    return {x: x * cY + z1 * sY, y: y1, z: -x * sY + z1 * cY};
  };
  const rotN = (x: number, y: number, z: number) => {
    const y1 = y * cP - z * sP;
    const z1 = y * sP + z * cP;
    return {x: x * cY + z1 * sY, y: y1, z: -x * sY + z1 * cY};
  };
  /** local (unrotated) surface point */
  const local = (th: number, y: number, dz = 0) => {
    const a = pw(A, y) * thinK(y) + dz;
    const zc = pw(ZC, y);
    const zf = pw(ZF, y) + dz, zb = pw(ZB, y) - dz;
    const c = Math.cos(th), s = Math.sin(th);
    const front = c >= 0;
    const x = a * (front ? sgnpow(s, 0.9) : s);
    let z = front ? zc + (zf - zc) * sgnpow(c, 0.78) : zc + (zc - zb) * c;
    const bw = Math.exp(-Math.pow(th / 0.2, 2));
    if (front && bw > 0.01) z += pw(BUMP, y) * bw;
    // normal ~ ellipse normal
    const D = front ? zf - zc : zc - zb;
    let nx = s * Math.max(1, D), nz = c * Math.max(1, a);
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    return {x, y: jy(y), z, nx, nz};
  };
  /** projected surface point; n = facing (normal z in view space, >0 faces camera) */
  const surf = (th: number, y: number, dz = 0): P3 => {
    const q = local(th, y, dz);
    const r = rot(q.x, q.y, q.z);
    const nrm = rotN(q.nx, 0, q.nz);
    return {x: r.x, y: r.y, z: r.z, n: nrm.z};
  };
  /** project an arbitrary head-local point */
  const proj = (x: number, y: number, z: number) => rot(x, y, z);

  /** radial outline of a point cloud around centre c: returns smooth-able polygon points */
  const outline = (pts: {x: number; y: number}[], c: {x: number; y: number}, bins = 150, empty = 40) => {
    const r = new Float64Array(bins).fill(-1);
    for (const p of pts) {
      const dx = p.x - c.x, dy = p.y - c.y;
      const a = Math.atan2(dy, dx);
      const b = Math.floor(((a + Math.PI) / (2 * Math.PI)) * bins) % bins;
      const d = Math.hypot(dx, dy);
      if (d > r[b]) r[b] = d;
    }
    // fill gaps by interpolation (or `empty`)
    const out: [number, number][] = [];
    for (let i = 0; i < bins; i++) {
      let ri = r[i];
      if (ri < 0) {
        let a = -1, b = -1;
        for (let k = 1; k < bins / 6; k++) {
          if (a < 0 && r[(i - k + bins) % bins] >= 0) a = k;
          if (b < 0 && r[(i + k) % bins] >= 0) b = k;
        }
        ri = a > 0 && b > 0 ? lerp(r[(i - a + bins) % bins], r[(i + b) % bins], a / (a + b)) : empty;
      }
      const ang = -Math.PI + ((i + 0.5) / bins) * 2 * Math.PI;
      out.push([c.x + Math.cos(ang) * ri, c.y + Math.sin(ang) * ri]);
    }
    return out;
  };

  const centre = rot(0, -40, -20);

  // silhouette of the skin surface
  const silPts: {x: number; y: number}[] = [];
  const ths: number[] = [];
  for (let i = 0; i < 64; i++) ths.push(-Math.PI + (i / 64) * Math.PI * 2);
  ths.push(-0.1, -0.05, 0.05, 0.1);
  for (const th of ths) {
    const yEnd = jawY(th);
    for (let y = TOP; y < yEnd; y += 8) silPts.push(surf(th, y));
    silPts.push(surf(th, yEnd));
  }
  // dense jaw / nape boundary so the outline is smooth there
  for (let i = 0; i < 240; i++) {
    const th = -Math.PI + (i / 240) * Math.PI * 2;
    const yEnd = jawY(th);
    silPts.push(surf(th, yEnd));
    silPts.push(surf(th, yEnd - 5));
  }
  const sil = outline(silPts, centre, 180);

  return {Y, P, cY, sY, cP, sP, surf, proj, local, outline, centre, sil, jy};
};
