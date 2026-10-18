// Private geometry for the kidney builder's x-ray torso (S06 + S14 share it so they match).
// WORLD coordinates = screen coordinates at the camera's rest pose (1080×1920). Front view of his
// trunk: lower ribs at the top, kidneys mid-frame, pelvis + bladder at the bottom. Screen-left =
// HIS right side (patient's right kidney sits a little lower, the IVC is on his right, the aorta
// on his left).
import {catmull, clamp} from '../../lib/anim';

export type Pt = [number, number];
export type Side = 'L' | 'R';

/** Kidney placements. Local kidney frame: hilum faces +x, half-size KW × KH. */
export const KID: Record<Side, {x: number; y: number; rot: number; mir: number}> = {
  L: {x: 300, y: 965, rot: 12, mir: 1}, // screen-left = his RIGHT kidney (lower, under the liver)
  R: {x: 785, y: 900, rot: -12, mir: -1}, // screen-right = his LEFT kidney
};
export const KW = 100;
export const KH = 172;

/** kidney-local -> world (bob = breathing offset in y). */
export const kpt = (side: Side, lx: number, ly: number, bob = 0): Pt => {
  const k = KID[side];
  const a = (k.rot * Math.PI) / 180;
  const x = lx * k.mir;
  return [k.x + x * Math.cos(a) - ly * Math.sin(a), k.y + bob + x * Math.sin(a) + ly * Math.cos(a)];
};
export const kTf = (side: Side, bob = 0, s = 1) => {
  const k = KID[side];
  return `translate(${k.x},${(k.y + bob).toFixed(2)}) rotate(${k.rot}) scale(${(k.mir * s).toFixed(4)},${s.toFixed(4)})`;
};

/** Bean outline (normalised; hilum notch on +x). */
export const BEAN: Pt[] = [
  [0.06, -1.0],
  [0.5, -0.9],
  [0.8, -0.63],
  [0.76, -0.3],
  [0.5, -0.13],
  [0.45, 0.07],
  [0.57, 0.3],
  [0.84, 0.6],
  [0.62, 0.9],
  [0.1, 1.0],
  [-0.45, 0.9],
  [-0.85, 0.55],
  [-1.0, 0.02],
  [-0.88, -0.5],
  [-0.5, -0.88],
];
export const beanPts = (s = 1, ox = 0, oy = 0): Pt[] => BEAN.map(([x, y]) => [ox + x * KW * s, oy + y * KH * s]);

// ---- renal sinus + pyramids (kidney-local) ----
export const SINUS: Pt = [26, 2];
const EA = 95;
const EB = 166;
/** distance from the sinus centre to the (ellipse-approximated) capsule along angle th (rad). */
export const rayT = (th: number) => {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const A = (c * c) / (EA * EA) + (s * s) / (EB * EB);
  const B = (2 * SINUS[0] * c) / (EA * EA) + (2 * SINUS[1] * s) / (EB * EB);
  const Cc = (SINUS[0] * SINUS[0]) / (EA * EA) + (SINUS[1] * SINUS[1]) / (EB * EB) - 1;
  return (-B + Math.sqrt(B * B - 4 * A * Cc)) / (2 * A);
};
export const ray = (th: number, k: number): Pt => {
  const t = rayT(th) * k;
  return [SINUS[0] + Math.cos(th) * t, SINUS[1] + Math.sin(th) * t];
};
export const PYR_DEG = [68, 104, 140, 180, 220, 256, 292];
export const PYR = PYR_DEG.map((d) => (d * Math.PI) / 180);
/** mid-point of pyramid i (where collecting ducts run) — ADH docks here. */
export const pyrMid = (i: number): Pt => ray(PYR[i], 0.6);

// ---- paths with arc length ----
export type PathT = {pts: Pt[]; cum: number[]; len: number};
export const mkPath = (ctrl: Pt[], seg = 10): PathT => {
  const pts = catmull(ctrl, seg);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return {pts, cum, len: cum[cum.length - 1]};
};
export const pathAt = (P: PathT, d: number): [number, number, number] => {
  const dd = clamp(d, 0, P.len);
  let lo = 0;
  let hi = P.cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (P.cum[m] <= dd) lo = m;
    else hi = m;
  }
  const seg = P.cum[hi] - P.cum[lo] || 1;
  const t = (dd - P.cum[lo]) / seg;
  const [x0, y0] = P.pts[lo];
  const [x1, y1] = P.pts[hi];
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.atan2(y1 - y0, x1 - x0)];
};
export const pathD = (P: PathT) => 'M' + P.pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');

// ---- the great vessels + renal vessels (flow direction = polyline order) ----
export type VKind = 'art' | 'vein';
export type Vessel = {key: string; kind: VKind; r: number; P: PathT; v: number; hl: Pt; renal?: boolean};

const AORTA: Pt[] = [
  [590, -760],
  [589, -200],
  [588, 300],
  [586, 700],
  [585, 1000],
  [584, 1300],
];
const IVC: Pt[] = [
  [480, 1325],
  [481, 1000],
  [482, 700],
  [484, 300],
  [486, -200],
  [488, -760],
];
const RA_R: Pt[] = [
  [592, 880],
  [650, 870],
  [700, 882],
  [733, 893],
];
const RA_L: Pt[] = [
  [580, 905],
  [520, 916],
  [440, 936],
  [395, 948],
  [354, 958],
];
const RV_R: Pt[] = [
  [737, 915],
  [690, 921],
  [620, 926],
  [560, 931],
  [492, 936],
];
const RV_L: Pt[] = [
  [349, 980],
  [400, 970],
  [440, 961],
  [474, 956],
];
const IA_L: Pt[] = [
  [584, 1300],
  [545, 1360],
  [478, 1480],
  [430, 1640],
  [398, 1780],
  [372, 2010],
];
const IA_R: Pt[] = [
  [584, 1300],
  [628, 1360],
  [690, 1480],
  [728, 1640],
  [758, 1780],
  [784, 2010],
];
const IV_L: Pt[] = [
  [318, 2010],
  [340, 1780],
  [372, 1630],
  [420, 1480],
  [462, 1370],
  [480, 1322],
];
const IV_R: Pt[] = [
  [700, 2010],
  [690, 1780],
  [655, 1640],
  [600, 1500],
  [530, 1380],
  [482, 1325],
];

export const V = {
  ivL: {key: 'ivL', kind: 'vein', r: 23, P: mkPath(IV_L), v: 5, hl: [-7, 0]} as Vessel,
  ivR: {key: 'ivR', kind: 'vein', r: 23, P: mkPath(IV_R), v: 5, hl: [-7, 0]} as Vessel,
  raL: {key: 'raL', kind: 'art', r: 13, P: mkPath(RA_L), v: 6, hl: [0, -5], renal: true} as Vessel,
  ivc: {key: 'ivc', kind: 'vein', r: 36, P: mkPath(IVC), v: 5, hl: [-12, 0]} as Vessel,
  rvL: {key: 'rvL', kind: 'vein', r: 16, P: mkPath(RV_L), v: 5, hl: [0, -6], renal: true} as Vessel,
  aorta: {key: 'aorta', kind: 'art', r: 30, P: mkPath(AORTA), v: 8, hl: [-10, 0]} as Vessel,
  iaL: {key: 'iaL', kind: 'art', r: 20, P: mkPath(IA_L), v: 7, hl: [-7, 0]} as Vessel,
  iaR: {key: 'iaR', kind: 'art', r: 20, P: mkPath(IA_R), v: 7, hl: [-7, 0]} as Vessel,
  raR: {key: 'raR', kind: 'art', r: 13, P: mkPath(RA_R), v: 6, hl: [0, -5], renal: true} as Vessel,
  rvR: {key: 'rvR', kind: 'vein', r: 16, P: mkPath(RV_R), v: 5, hl: [0, -6], renal: true} as Vessel,
};
/** back-to-front draw order */
export const V_ORDER: Vessel[] = [V.ivL, V.ivR, V.raL, V.ivc, V.rvL, V.aorta, V.iaL, V.iaR, V.raR, V.rvR];

// ---- urinary tract ----
export const URETER_L = mkPath([
  [346, 1004],
  [372, 1062],
  [392, 1160],
  [404, 1300],
  [414, 1440],
  [426, 1560],
  [452, 1652],
]);
export const URETER_R = mkPath([
  [739, 940],
  [712, 1002],
  [690, 1120],
  [675, 1300],
  [664, 1440],
  [652, 1560],
  [628, 1652],
]);
export const BLADDER = {x: 540, y: 1708, w: 122, h: 96};
export const BLADDER_SHAPE: Pt[] = [
  [0, -0.92],
  [0.62, -0.92],
  [0.97, -0.55],
  [1.0, 0.05],
  [0.72, 0.62],
  [0.22, 0.98],
  [-0.22, 0.98],
  [-0.72, 0.62],
  [-1.0, 0.05],
  [-0.97, -0.55],
  [-0.62, -0.92],
];

// ---- ADH routes: aorta top -> renal artery -> hilum -> dock on a pyramid ----
export const DOCK_PYR = [1, 3, 5, 0, 2, 6]; // pyramid order the capsules fill
const aortaTo = (y: number): Pt[] => AORTA.filter((p) => p[1] < y - 40);
export const adhRoute = (side: Side, j: number): PathT => {
  const pm = pyrMid(DOCK_PYR[j % DOCK_PYR.length]);
  const dock = kpt(side, pm[0], pm[1]);
  const hil = kpt(side, 40, -10);
  const ra = side === 'R' ? RA_R : RA_L;
  const pre = aortaTo(ra[0][1]);
  return mkPath([[590, -520], ...pre.filter((p) => p[1] > -500), ...ra, hil, dock], 8);
};
export const ADH_ROUTES: Record<Side, PathT[]> = {
  L: DOCK_PYR.map((_, j) => adhRoute('L', j)),
  R: DOCK_PYR.map((_, j) => adhRoute('R', j)),
};
export const ADH_PASS: PathT[] = [
  mkPath([[590, -520], ...AORTA.filter((p) => p[1] > -500), ...IA_L.slice(1)], 8),
  mkPath([[590, -520], ...AORTA.filter((p) => p[1] > -500), ...IA_R.slice(1)], 8),
];
