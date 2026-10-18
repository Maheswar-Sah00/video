import React, {useMemo} from 'react';
import {C} from '../../lib/palette';
import {along, clamp, ease, hash, lerp, mixHex, rgba, rng, smoothPath} from '../../lib/anim';
import {Drop, WaterMolecule} from '../../lib/Cells';

/**
 * XrayBody (owner: body — private to S03 S04 S19). HIS full figure as translucent x-ray GLASS,
 * front view, standing: pale-blue glass outline + rim glow, faint skeleton, glossy organs (brain,
 * lungs, heart, liver, stomach, kidneys, bladder), glowing aqua WATER inside up to `level`.
 *
 * Origin (x,y) = the STERNUM. Body units: head-top -422 (hair -446), mouth -212, chin -164,
 * shoulders ±226 at -92, navel 250, crotch 426, feet 1182 (≈1630 tall: scale 0.95 ≈ 1550 px).
 * HIS right = SCREEN-LEFT. `level` 0..1 = fraction of the height (feet → head-top) filled:
 * 0.6 = the 60 % line (body y ≈ 220, just above the navel). levelY(l) gives the body y.
 *
 * Leak hooks: puffs (breath vapour ages) · sweat/sweatRoll (beads form, then roll) · seep (tiny
 * drops through the skin) · bladder/bladderGlow/drips (straw glow + schematic drips).
 * Drinking: pose 'drink' (his right arm raised, an x-ray glass tipped at the lips, head tilted
 * back by `headBack`), glassFill, glassTip, gulps (ages → glowing bolus down the oesophagus into
 * the stomach, cascade to the water surface + splash). recover = mint-teal recovery glow.
 */
export type XrayBodyProps = {
  f: number;
  id: string;
  x: number;
  y: number;
  scale?: number;
  rot?: number;
  level?: number;
  slosh?: number;
  tilt?: number;
  waterGlow?: number;
  markLevel?: number;
  mark?: number;
  organs?: number;
  bones?: number;
  ghost?: number;
  reveal?: number;
  pulse?: number;
  pose?: 'stand' | 'drink';
  headBack?: number;
  glassFill?: number;
  glassTip?: number;
  gulps?: number[];
  puffs?: number[];
  sweat?: number;
  sweatRoll?: number;
  seep?: number;
  bladder?: number;
  bladderGlow?: number;
  drips?: number[];
  recover?: number;
  opacity?: number;
};

type P = [number, number];
const fx = (n: number) => n.toFixed(1);
const mirror = (pts: P[]): P[] => pts.map(([x, y]) => [-x, y] as P);

export const FEET = 1182;
export const HEAD_TOP = -422;
export const levelY = (l: number) => FEET - l * (FEET - HEAD_TOP);
/** gravity of falling drops inside the body (units / frame²) */
const G = 4;
/** frames from a gulp event until the cascade hits the water surface at body-y `ls` */
export const gulpLandDelay = (ls: number) => 13 + Math.sqrt((2 * Math.max(0, ls - 262)) / G);

/** named anatomy points (body units) */
export const BP: Record<string, P> = {
  brain: [0, -328],
  forehead: [0, -372],
  eyes: [0, -292],
  mouth: [0, -212],
  chin: [0, -168],
  throat: [0, -146],
  heart: [30, 70],
  lungR: [-104, 40],
  lungL: [108, 40],
  liver: [-90, 200],
  stomach: [100, 212],
  kidneyR: [-88, 265],
  kidneyL: [88, 268],
  bladder: [0, 388],
  armL: [252, 200],
  armR: [-248, 200],
  shoulderL: [200, -100],
  navel: [0, 250],
  kneeL: [86, 770],
  feet: [0, 1182],
};
export const bodyToScreen = (p: {x: number; y: number; scale?: number}, bx: number, by: number) => ({
  x: p.x + bx * (p.scale ?? 1),
  y: p.y + by * (p.scale ?? 1),
});

// =============================================================================================
// STATIC GEOMETRY

const SIL_R: P[] = [
  [0, -422], [52, -414], [86, -384], [100, -336], [100, -290], [96, -252], [86, -214], [70, -184],
  [50, -164], [46, -136], [70, -124], [120, -118], [190, -112], [226, -92], [242, -40], [248, 60],
  [252, 190], [260, 320], [268, 440], [284, 492], [278, 540], [256, 566], [234, 540], [230, 450],
  [220, 330], [208, 200], [198, 60], [182, -20], [178, 50], [164, 140], [156, 220], [162, 290],
  [170, 350], [166, 460], [154, 600], [142, 760], [144, 880], [124, 1020], [112, 1110], [140, 1150],
  [158, 1180], [70, 1182], [68, 1110], [60, 960], [50, 760], [30, 560], [12, 440], [0, 426],
];
const SIL_R_NOARM: P[] = [...SIL_R.slice(0, 13), [214, -86], [206, -52], [190, -24], ...SIL_R.slice(28)];
const headSquash = (pts: P[], hb: number): P[] => pts.map(([x, y]) => (y < -150 ? [x, -300 + (y + 300) * (1 - 0.08 * hb)] : [x, y]) as P);
const buildSil = (right: P[], left: P[]) => smoothPath([...right.slice(0, -1), ...mirror(left).slice(1, -1).reverse()], true);
const SIL_STAND = buildSil(SIL_R, SIL_R);

// hair (his messy, thick, slightly wavy black hair)
type Lock = [number, number, number, number, number, number, number];
const lockGeom = ([x0, y0, ang, len, w, curl, wave]: Lock) => {
  const D = Math.PI / 180;
  const N = 9;
  const left: P[] = [], right: P[] = [], mid: P[] = [];
  let x = x0, y = y0, a = ang * D;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const hw = w * (0.14 + 0.86 * Math.pow(1 - t, 0.75)) * (t < 0.2 ? 0.75 + 1.25 * t : 1);
    const nx = -Math.sin(a), ny = Math.cos(a);
    left.push([x + nx * hw, y + ny * hw]);
    right.push([x - nx * hw, y - ny * hw]);
    mid.push([x, y]);
    a += (curl * D) / N + ((wave * D) / N) * Math.cos(t * Math.PI * 1.6);
    x += (Math.cos(a) * len) / N;
    y += (Math.sin(a) * len) / N;
  }
  return {d: smoothPath([...left, ...right.reverse()], true), strand: smoothPath(mid.slice(2, N - 1))};
};
const HAIR_LOCKS: Lock[] = [
  [-24, -440, 186, 100, 24, -62, 30], [-60, -420, 166, 88, 22, -50, 26], [-90, -392, 146, 72, 18, -38, 22], [-106, -350, 122, 50, 13, -22, 16],
  [16, -442, -4, 96, 24, 60, -30], [54, -424, 16, 86, 22, 48, -24], [88, -396, 36, 70, 18, 40, -20], [106, -352, 60, 48, 13, 24, -14],
  [-8, -440, -96, 26, 14, -64, 0], [30, -438, -66, 22, 12, 64, 0],
  [80, -384, 130, 60, 19, 30, 16], [44, -398, 110, 72, 22, 30, -14], [2, -400, 120, 60, 19, 20, 18], [-30, -394, 106, 70, 20, 34, -10], [-70, -378, 136, 44, 15, 16, 10],
  [-110, -322, 100, 36, 10, 44, 0], [112, -324, 82, 32, 10, -46, 0],
];
const HAIR_CAP = smoothPath(
  [[-104, -292], [-114, -340], [-102, -394], [-64, -432], [0, -446], [64, -432], [102, -394], [114, -340], [104, -292], [90, -332], [50, -356], [0, -362], [-50, -356], [-90, -332]],
  true,
);
const HAIR = (() => {
  const L = HAIR_LOCKS.map(lockGeom);
  return {locks: L.map((l) => l.d), d: L.map((l) => l.d).join(' '), strands: L.map((l) => l.strand).join(' ')};
})();

// lungs
const LUNG_R = smoothPath([[-62, -108], [-40, -80], [-30, -20], [-34, 40], [-40, 110], [-50, 160], [-100, 172], [-150, 166], [-176, 140], [-182, 60], [-172, -20], [-140, -78], [-100, -108]], true);
const LUNG_L = smoothPath([[62, -108], [40, -80], [32, -20], [44, 30], [76, 60], [86, 110], [70, 150], [104, 174], [152, 166], [178, 138], [184, 60], [174, -20], [142, -78], [102, -108]], true);
const bronchTree = (side: 1 | -1, seed: number) => {
  const r = rng(seed);
  let d = '';
  const grow = (x: number, y: number, ang: number, len: number, depth: number) => {
    if (depth > 4) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    d += `M${fx(x)},${fx(y)} L${fx(x2)},${fx(y2)} `;
    const sp = 0.42 + r() * 0.25;
    grow(x2, y2, ang - sp, len * (0.68 + r() * 0.12), depth + 1);
    grow(x2, y2, ang + sp, len * (0.68 + r() * 0.12), depth + 1);
  };
  const dirs = side === -1 ? [-2.4, -3.0, 2.2] : [-0.75, -0.1, 0.95];
  dirs.forEach((a) => grow(side * 52, 30, a, 42, 1));
  return d;
};
const BRONCH = bronchTree(-1, 11) + bronchTree(1, 23);
// heart
const HEART_C: P = [30, 70];
const HEART = smoothPath(
  ([[-30, 14], [-6, -4], [30, -6], [62, 14], [86, 52], [92, 92], [78, 124], [54, 122], [18, 104], [-14, 84], [-32, 52]] as P[]).map(([x, y]) => [30 + (x - 30) * 0.86, 70 + (y - 58) * 0.86] as P),
  true,
);
// abdomen
const LIVER = smoothPath([[-170, 150], [-110, 136], [-40, 140], [30, 160], [70, 182], [26, 210], [-50, 246], [-120, 262], [-164, 240], [-178, 196]], true);
const STOMACH = smoothPath([[58, 168], [96, 154], [140, 170], [152, 210], [134, 254], [96, 268], [58, 252], [44, 226], [72, 214], [84, 190]], true);
const KIDNEY_R = smoothPath([[-66, 232], [-98, 224], [-114, 262], [-100, 302], [-68, 296], [-78, 264]], true);
const KIDNEY_L = smoothPath([[66, 236], [98, 228], [114, 266], [100, 306], [68, 300], [78, 268]], true);
const URETERS = [smoothPath([[-74, 272], [-62, 310], [-40, 344], [-26, 364]]), smoothPath([[74, 276], [62, 312], [40, 344], [26, 364]])];
const SMALL_INT = (() => {
  const pts: P[] = [];
  for (let row = 0; row < 4; row++) {
    const y = 300 + row * 20;
    const dir = row % 2 === 0 ? 1 : -1;
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push([dir * (-80 + 160 * t), y + Math.sin(t * Math.PI * 3 + row) * 7]);
    }
  }
  return smoothPath(pts);
})();
const ESO: P[] = [[2, -206], [0, -170], [-2, -120], [-6, -40], [-2, 40], [14, 110], [50, 160], [92, 200]];
const ESO_D = smoothPath(ESO);
// vessels (faint)
const ART = [
  [[22, 15], [18, -30], [30, -58], [50, -48], [40, -10], [22, 40], [16, 150], [14, 250], [12, 322]],
  [[12, 322], [-30, 362], [-70, 420], [-84, 560], [-88, 760], [-86, 950], [-90, 1110]],
  [[12, 322], [52, 362], [76, 420], [88, 560], [90, 760], [88, 950], [92, 1110]],
  [[44, -52], [90, -100], [160, -106], [214, -78], [230, 40], [238, 190], [248, 330], [256, 440]],
  [[-26, -102], [-32, -150], [-40, -200], [-46, -250], [-36, -300]],
  [[32, -56], [34, -110], [38, -160], [44, -200], [48, -250], [36, -300]],
].map((p) => smoothPath(p as P[]));
const ART_ARM_R = smoothPath([[22, -52], [2, -78], [-26, -102], [-90, -110], [-160, -106], [-214, -78], [-230, 40], [-238, 190], [-248, 330], [-256, 440]]);
// bones
const RIBS = (() => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const y0 = -104 + i * 25;
    const w = 112 + 66 * Math.sin(Math.min(1, (i + 2) / 8) * Math.PI * 0.5) - (i > 7 ? (i - 7) * 10 : 0);
    for (const s of [1, -1]) {
      d += `M${fx(s * 16)},${fx(y0)} C${fx(s * w * 0.55)},${fx(y0 - 26)} ${fx(s * w)},${fx(y0 - 8)} ${fx(s * w)},${fx(y0 + 30)} `;
      const ex = i < 7 ? 22 : 40 + (i - 7) * 24;
      const ey = i < 7 ? y0 + 56 + i * 7 : y0 + 60;
      d += `M${fx(s * w)},${fx(y0 + 30)} C${fx(s * w * 0.98)},${fx(y0 + 62)} ${fx(s * w * 0.55)},${fx(ey + 8)} ${fx(s * ex)},${fx(ey)} `;
    }
  }
  return d;
})();
const CLAV = smoothPath([[-18, -124], [-80, -132], [-140, -120], [-198, -114]]) + ' ' + smoothPath([[18, -124], [80, -132], [140, -120], [198, -114]]);
const VERTS = (() => {
  const out: {y: number; w: number; h: number}[] = [];
  for (let i = 0; i < 5; i++) out.push({y: -176 + i * 12, w: 22, h: 9});
  for (let i = 0; i < 12; i++) out.push({y: -118 + i * 26, w: 26, h: 20});
  for (let i = 0; i < 5; i++) out.push({y: 198 + i * 28, w: 36, h: 23});
  return out;
})();
const VERTS_D = VERTS.map((v) => `M${fx(-v.w / 2 + 4)},${fx(v.y - v.h / 2)} h${fx(v.w - 8)} q4,0 4,4 v${fx(v.h - 8)} q0,4 -4,4 h${fx(-(v.w - 8))} q-4,0 -4,-4 v${fx(-(v.h - 8))} q0,-4 4,-4 Z`).join(' ');
const PELVIS_PTS: P[] = [[28, 326], [80, 292], [146, 298], [154, 332], [124, 382], [104, 412], [92, 452], [56, 456], [14, 434], [22, 404], [46, 390], [34, 360]];
const PELVIS = smoothPath(mirror(PELVIS_PTS), true) + ' ' + smoothPath(PELVIS_PTS, true);
const SACRUM = smoothPath([[-34, 336], [34, 336], [20, 400], [0, 418], [-20, 400]], true);
const LIMB_DEFS: {pts: P[]; w: number; armR?: boolean}[] = [
  {pts: [[-216, -86], [-228, 60], [-238, 192]], w: 13, armR: true},
  {pts: [[216, -86], [228, 60], [238, 192]], w: 13},
  {pts: [[-236, 204], [-248, 320], [-258, 440]], w: 8, armR: true},
  {pts: [[-250, 204], [-262, 320], [-270, 440]], w: 7, armR: true},
  {pts: [[236, 204], [248, 320], [258, 440]], w: 8},
  {pts: [[250, 204], [262, 320], [270, 440]], w: 7},
  {pts: [[-104, 412], [-96, 580], [-88, 750]], w: 16},
  {pts: [[104, 412], [96, 580], [88, 750]], w: 16},
  {pts: [[-84, 784], [-82, 950], [-82, 1110]], w: 12},
  {pts: [[84, 784], [82, 950], [82, 1110]], w: 12},
  {pts: [[-104, 796], [-106, 950], [-100, 1104]], w: 6},
  {pts: [[104, 796], [106, 950], [100, 1104]], w: 6},
  {pts: [[-84, 1124], [-110, 1150], [-140, 1172]], w: 9},
  {pts: [[84, 1124], [110, 1150], [140, 1172]], w: 9},
];
const LIMBS = LIMB_DEFS.map((l) => ({d: smoothPath(l.pts), w: l.w, armR: !!l.armR}));
const HANDS_D = (side: number) => {
  let d = '';
  for (let k = 0; k < 4; k++) d += `M${fx(side * (256 + k * 5))},452 L${fx(side * (252 + k * 9))},${fx(530 + (k === 1 || k === 2 ? 14 : 0))} `;
  return d;
};
const SKULL = smoothPath([[0, -408], [56, -398], [88, -360], [94, -310], [86, -268], [74, -236], [-74, -236], [-86, -268], [-94, -310], [-88, -360], [-56, -398]], true);
const MANDIBLE = smoothPath([[-74, -262], [-72, -222], [-52, -182], [0, -164], [52, -182], [72, -222], [74, -262]]);
// brain (front)
const BRAIN_PTS: P[] = [[0, -396], [44, -394], [78, -370], [88, -330], [84, -284], [64, -256], [30, -250], [0, -262], [-30, -250], [-64, -256], [-84, -284], [-88, -330], [-78, -370], [-44, -394]];
const BRAIN = smoothPath(BRAIN_PTS, true);
const GYRI = (() => {
  const r = rng(31);
  let d = '';
  for (let i = 0; i < 30; i++) {
    let x = -78 + r() * 156, y = -388 + r() * 128;
    let a = r() * Math.PI * 2;
    const line: P[] = [[x, y]];
    for (let k = 0; k < 5; k++) {
      a += (r() - 0.5) * 2.2;
      x += Math.cos(a) * 10;
      y += Math.sin(a) * 10;
      line.push([x, y]);
    }
    d += smoothPath(line) + ' ';
  }
  return d;
})();

// water furniture
type Bub = {x: number; y0: number; y1: number; r: number; v: number; ph: number; arm: number};
const BUBBLES: Bub[] = (() => {
  const r = rng(404);
  const out: Bub[] = [];
  for (let i = 0; i < 44; i++) {
    const k = r();
    const s = r() < 0.5 ? -1 : 1;
    if (k < 0.36) out.push({x: (r() - 0.5) * 240, y0: 440, y1: -110, r: 2 + r() * 5, v: 1.3 + r() * 2.2, ph: r(), arm: 0});
    else if (k < 0.8) out.push({x: s * (74 + r() * 46), y0: 1130, y1: 430, r: 2 + r() * 4.5, v: 1.6 + r() * 2.4, ph: r(), arm: 0});
    else out.push({x: s * (228 + r() * 16), y0: 500, y1: -40, r: 1.8 + r() * 3.5, v: 1.2 + r() * 1.8, ph: r(), arm: s});
  }
  return out;
})();
const MOLS = (() => {
  const r = rng(77);
  const out: {x: number; y: number; r: number; ph: number; s: number}[] = [];
  for (let i = 0; i < 14; i++) {
    if (i < 7) out.push({x: (r() - 0.5) * 230, y: 170 + r() * 250, r: 8 + r() * 5, ph: r() * 6.28, s: r() < 0.5 ? -1 : 1});
    else {
      const s = r() < 0.5 ? -1 : 1;
      out.push({x: s * (80 + r() * 36), y: 480 + r() * 600, r: 7 + r() * 4, ph: r() * 6.28, s});
    }
  }
  return out;
})();
const SWEAT_PTS: P[] = [
  [-42, -372], [12, -382], [52, -366], [-74, -346], [-94, -318], [96, -316], [-88, -262], [90, -256],
  [244, 30], [250, 140], [256, 250], [262, 360], [-244, 50], [-250, 170], [-258, 290],
  [-130, -60], [138, -40], [-60, 30], [150, 120], [-150, 150],
];
const SEEP_PTS: P[] = [
  [-100, -300], [100, -296], [-60, -436], [54, -432], [-236, 0], [244, 40], [-252, 250], [256, 260], [-268, 430], [270, 450],
  [-170, 100], [166, 150], [-162, 330], [168, 360], [-150, 700], [148, 700], [-128, 1000], [130, 1000], [-150, 520], [152, 540],
];

// raised arm (pose 'drink', HIS right = screen-left)
const SHOULDER: P = [-200, -96];
const ELBOW: P = [-170, 56];
const capsule = (a: P, b: P, ra: number, rb: number) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  return `M${fx(a[0] + nx * ra)},${fx(a[1] + ny * ra)} L${fx(b[0] + nx * rb)},${fx(b[1] + ny * rb)} A${fx(rb)},${fx(rb)} 0 0,0 ${fx(b[0] - nx * rb)},${fx(b[1] - ny * rb)} L${fx(a[0] - nx * ra)},${fx(a[1] - ny * ra)} A${fx(ra)},${fx(ra)} 0 0,0 ${fx(a[0] + nx * ra)},${fx(a[1] + ny * ra)} Z`;
};
const rotP = (p: P, deg: number, o: P): P => {
  const a = (deg * Math.PI) / 180;
  return [o[0] + p[0] * Math.cos(a) - p[1] * Math.sin(a), o[1] + p[0] * Math.sin(a) + p[1] * Math.cos(a)];
};

// =============================================================================================

export const XrayBody: React.FC<XrayBodyProps> = (p) => {
  const {
    f,
    id,
    x,
    y,
    scale = 1,
    rot = 0,
    level = 0.6,
    slosh = 0,
    tilt = 0,
    waterGlow = 1,
    markLevel = 0.6,
    mark = 0,
    organs = 1,
    bones = 1,
    ghost = 1,
    reveal = -1,
    pulse = 0,
    pose = 'stand',
    headBack = 0,
    glassFill = 0.5,
    glassTip = 0,
    gulps = [],
    puffs = [],
    sweat = 0,
    sweatRoll = -1,
    seep = 0,
    bladder = 0.7,
    bladderGlow = 0,
    drips = [],
    recover = 0,
    opacity = 1,
  } = p;
  const k = (s: string) => `${id}-${s}`;
  const drink = pose === 'drink';
  const hb = drink ? clamp(headBack) : 0;
  const hbQ = Math.round(hb * 40) / 40;
  const sil = useMemo(
    () => (drink ? buildSil(headSquash(SIL_R, hbQ), headSquash(SIL_R_NOARM, hbQ)) : SIL_STAND),
    [drink, hbQ],
  );
  const headTf = hb > 0 ? `translate(0,-300) scale(1,${fx(1 - 0.08 * hb)}) translate(0,300)` : undefined;
  const hy = (yy: number) => (yy < -150 ? -300 + (yy + 300) * (1 - 0.08 * hb) : yy);
  const og = clamp(organs, 0, 1.4);

  // ---- the drinking arm + glass ----
  const tipDeg = lerp(-80, -56, clamp(glassTip));
  const rim: P = [4, hy(-212) - 2];
  const gAxis: P = [Math.sin((tipDeg * Math.PI) / 180), -Math.cos((tipDeg * Math.PI) / 180)]; // rim -> base direction
  const gCentre: P = [rim[0] + gAxis[0] * 76, rim[1] + gAxis[1] * 76];
  const gPerp: P = [-gAxis[1], gAxis[0]];
  const hand: P = [gCentre[0] + gPerp[0] * 6 - 4, gCentre[1] + gPerp[1] * 6 + 18];
  const wrist: P = [hand[0] - 12, hand[1] + 34];
  const armD = drink ? [capsule(SHOULDER, ELBOW, 36, 25), capsule(ELBOW, wrist, 25, 16)] : [];
  const handD = drink ? smoothPath([[hand[0] - 30, hand[1] + 6], [hand[0] - 22, hand[1] - 22], [hand[0] + 4, hand[1] - 32], [hand[0] + 28, hand[1] - 18], [hand[0] + 30, hand[1] + 10], [hand[0] + 8, hand[1] + 30], [hand[0] - 20, hand[1] + 26]], true) : '';

  // ---- water ----
  const Ls = levelY(clamp(level, 0, 1.05));
  const amp = 2.2 + 15 * slosh;
  const surf = (xx: number) =>
    Ls + amp * (0.6 * Math.sin(xx * 0.021 + f * 0.17) + 0.32 * Math.sin(xx * 0.053 - f * 0.23 + 1.3) + 0.35 * Math.sin(xx * 0.008 + f * 0.07)) + tilt * xx;
  let surfLine = '';
  for (let xx = -330; xx <= 330; xx += 15) surfLine += `${xx === -330 ? 'M' : 'L'}${xx},${fx(surf(xx))} `;
  const waterRegion = `${surfLine} L330,1260 L-330,1260 Z`;
  const hasWater = level > 0.002;

  let caus = '';
  if (hasWater) {
    for (let yy = Ls + 26; yy < 1200; yy += 58) {
      let d = '';
      for (let xx = -320; xx <= 320; xx += 20) {
        const yv = yy + 9 * Math.sin(xx * 0.034 + f * 0.09 + yy * 0.05) + 6 * Math.sin(xx * 0.081 - f * 0.12 + yy * 0.11);
        d += `${xx === -320 ? 'M' : 'L'}${xx},${fx(yv)} `;
      }
      caus += d;
    }
    for (let xx = -300; xx <= 300; xx += 46) {
      let d = '';
      for (let yy = Math.max(Ls + 10, -440); yy <= 1200; yy += 26) {
        const xv = xx + 8 * Math.sin(yy * 0.03 + f * 0.08 + xx * 0.07) + 5 * Math.sin(yy * 0.077 - f * 0.1 + xx);
        d += `${d ? 'L' : 'M'}${fx(xv)},${yy.toFixed(0)} `;
      }
      caus += d;
    }
  }
  let bubRing = '';
  let bubHi = '';
  for (const b of BUBBLES) {
    if (drink && b.arm < 0) continue;
    const range = b.y0 - b.y1;
    const yy = b.y0 - ((f * b.v + b.ph * range) % range);
    if (yy < Ls + 3) continue;
    const xx = b.x + 3 * Math.sin(f * 0.12 + b.ph * 9);
    bubRing += `M${fx(xx - b.r)},${fx(yy)} a${fx(b.r)},${fx(b.r)} 0 1,0 ${fx(2 * b.r)},0 a${fx(b.r)},${fx(b.r)} 0 1,0 ${fx(-2 * b.r)},0 `;
    const hr = b.r * 0.35;
    bubHi += `M${fx(xx - b.r * 0.35 - hr)},${fx(yy - b.r * 0.35)} a${fx(hr)},${fx(hr)} 0 1,0 ${fx(2 * hr)},0 a${fx(hr)},${fx(hr)} 0 1,0 ${fx(-2 * hr)},0 `;
  }

  // ---- organs ----
  const breathe = Math.sin(f * 0.11);
  const ls = 1 + breathe * 0.012;
  const hs = 1 - 0.09 * pulse + 0.01 * Math.sin(f * 0.21);
  const dull = (c: string) => mixHex(C.medBgLight, c, clamp(0.45 + 0.55 * og));
  const bl = clamp(bladder);
  const blRx = 22 + 26 * bl;
  const blRy = 16 + 22 * bl;
  const blCy = 404 - blRy * 0.75;

  const boneLine = (d: string, w: number, key: string, o = 1) => (
    <g key={key} opacity={o}>
      <path d={d} fill="none" stroke={rgba(C.bodyGhostLight, 0.14)} strokeWidth={w + 8} strokeLinecap="round" />
      <path d={d} fill="none" stroke={rgba(C.bone, 0.55)} strokeWidth={w} strokeLinecap="round" />
      <path d={d} fill="none" stroke={rgba('#ffffff', 0.45)} strokeWidth={Math.max(1, w * 0.22)} strokeLinecap="round" />
    </g>
  );

  const skeletonEl = (
    <g opacity={0.62 * bones}>
      <path d="M0,-180 L0,340" stroke={rgba(C.bodyGhostLight, 0.1)} strokeWidth={42} strokeLinecap="round" />
      <path d={VERTS_D} fill={rgba(C.bone, 0.38)} stroke={rgba('#ffffff', 0.4)} strokeWidth={1.2} />
      <path d={SACRUM} fill={rgba(C.bone, 0.28)} stroke={rgba('#ffffff', 0.4)} strokeWidth={1.4} />
      <path d={RIBS} fill="none" stroke={rgba(C.bodyGhostLight, 0.12)} strokeWidth={12} strokeLinecap="round" />
      <path d={RIBS} fill="none" stroke={rgba(C.bone, 0.5)} strokeWidth={4.5} strokeLinecap="round" />
      <path d={RIBS} fill="none" stroke={rgba('#ffffff', 0.3)} strokeWidth={1.2} strokeLinecap="round" />
      {boneLine('M0,-118 L0,96', 15, 'st')}
      {boneLine(CLAV, 8, 'cl')}
      <path d={PELVIS} fill={rgba(C.bone, 0.1)} stroke={rgba(C.bone, 0.6)} strokeWidth={3} />
      {LIMBS.map((l, i) => (drink && l.armR ? null : boneLine(l.d, l.w, `l${i}`)))}
      <path d={HANDS_D(1) + (drink ? '' : HANDS_D(-1))} stroke={rgba(C.bone, 0.6)} strokeWidth={3} strokeLinecap="round" fill="none" />
      {drink && (
        <>
          {boneLine(`M${SHOULDER[0] + 6},${SHOULDER[1] + 8} L${ELBOW[0]},${ELBOW[1] - 8}`, 13, 'hum')}
          {boneLine(`M${ELBOW[0] + 6},${ELBOW[1] - 6} L${fx(wrist[0] + 4)},${fx(wrist[1] + 4)}`, 7, 'rad')}
          {boneLine(`M${ELBOW[0] - 6},${ELBOW[1] - 2} L${fx(wrist[0] - 6)},${fx(wrist[1] + 6)}`, 6, 'uln')}
        </>
      )}
      {[-1, 1].map((s) => (
        <g key={`j${s}`}>
          <circle cx={s * 100} cy={414} r={15} fill={rgba(C.bone, 0.55)} />
          <circle cx={s * 86} cy={770} r={12} fill={rgba(C.bone, 0.5)} />
          {!(drink && s < 0) && <circle cx={s * 216} cy={-88} r={15} fill={rgba(C.bone, 0.5)} />}
        </g>
      ))}
      <g transform={headTf}>
        <path d={SKULL} fill={rgba(C.bodyGhostLight, 0.06)} stroke={rgba(C.bodyGhostLight, 0.2)} strokeWidth={12} />
        <path d={SKULL} fill="none" stroke={rgba(C.bone, 0.75)} strokeWidth={3.5} />
        {[-36, 36].map((ox) => (
          <ellipse key={ox} cx={ox} cy={-292} rx={22} ry={17} fill={rgba(C.medBg, 0.3)} stroke={rgba(C.bone, 0.5)} strokeWidth={2.4} />
        ))}
        <path d={MANDIBLE} fill="none" stroke={rgba(C.bone, 0.7)} strokeWidth={5} strokeLinecap="round" />
        <path d="M-40,-232 L40,-232" stroke={rgba(C.bone, 0.6)} strokeWidth={5} strokeDasharray="5 3" />
      </g>
    </g>
  );

  const vesselsEl = (
    <g opacity={0.5 * clamp(og)}>
      {[...ART, ...(drink ? [] : [ART_ARM_R])].map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke={rgba(C.blood, 0.25)} strokeWidth={13} strokeLinecap="round" />
          <path d={d} fill="none" stroke={C.vessel} strokeWidth={i === 0 ? 9 : 5} strokeLinecap="round" />
          <path d={d} fill="none" stroke={rgba('#ffffff', 0.55)} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="4 22" strokeDashoffset={fx(-((f * 2.4 + i * 7) % 26))} />
        </g>
      ))}
    </g>
  );

  const brainEl = (
    <g transform={headTf}>
     <g transform="translate(0,-352) scale(0.93,0.84) translate(0,323)">
      <circle cx={0} cy={-326} r={150} fill={`url(#${k('brainGlow')})`} opacity={0.35 + 0.5 * clamp(og)} />
      <path d={BRAIN} fill={`url(#${k('brainG')})`} stroke={C.brainLight} strokeWidth={2.4} />
      <path d={GYRI} fill="none" stroke={rgba(C.brainDeep, 0.85)} strokeWidth={3} strokeLinecap="round" />
      <path d={GYRI} fill="none" stroke={rgba(C.brainLight, 0.55)} strokeWidth={1.1} strokeLinecap="round" transform="translate(-1.5,-1.5)" />
      <path d="M0,-394 L0,-262" stroke={rgba(C.brainDeep, 0.9)} strokeWidth={3} />
      <ellipse cx={-40} cy={-372} rx={30} ry={11} fill={rgba('#ffffff', 0.4)} transform="rotate(-20 -40 -372)" />
     </g>
    </g>
  );

  const organsEl = (
    <g>
      {/* lungs */}
      <g transform={`translate(0,40) scale(${fx(ls)}) translate(0,-40)`}>
        {[LUNG_R, LUNG_L].map((d, i) => (
          <g key={i}>
            <path d={d} fill={rgba(C.lung, 0.16)} stroke={rgba(C.lungLight, 0.16)} strokeWidth={20} />
            <path d={d} fill={`url(#${k('lungG')})`} stroke={dull(C.lungLight)} strokeWidth={2.2} opacity={0.82} />
          </g>
        ))}
        <path d={BRONCH} fill="none" stroke={rgba(C.airway, 0.55)} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M0,-148 L0,-30 M0,-32 L-52,30 M0,-32 L52,30" stroke={rgba(C.airway, 0.6)} strokeWidth={10} strokeLinecap="round" fill="none" />
        <ellipse cx={-136} cy={-20} rx={22} ry={52} fill={rgba('#ffffff', 0.16)} transform="rotate(-14 -136 -20)" />
        <ellipse cx={74} cy={-30} rx={16} ry={40} fill={rgba('#ffffff', 0.14)} transform="rotate(-14 74 -30)" />
      </g>
      {/* heart */}
      <g transform={`translate(${HEART_C[0]},${HEART_C[1]}) scale(${fx(hs)}) translate(${-HEART_C[0]},${-HEART_C[1]})`}>
        <circle cx={HEART_C[0]} cy={HEART_C[1]} r={100 + 20 * pulse} fill={`url(#${k('heartGlow')})`} opacity={0.5 + 0.4 * pulse} />
        <path d={HEART} fill={`url(#${k('heartG')})`} stroke={dull(C.heartLight)} strokeWidth={2.4} />
        <path d="M30,22 Q36,52 46,88 T62,120" fill="none" stroke={rgba(C.heartDeep, 0.8)} strokeWidth={3} />
        <ellipse cx={14} cy={42} rx={15} ry={7} fill={rgba('#ffffff', 0.5)} transform="rotate(-25 14 42)" />
      </g>
      {/* liver, stomach */}
      <path d={LIVER} fill={rgba(C.liver, 0.2)} stroke={rgba(C.liverLight, 0.18)} strokeWidth={14} />
      <path d={LIVER} fill={`url(#${k('liverG')})`} stroke={dull(C.liverLight)} strokeWidth={2.2} opacity={0.9} />
      <path d="M-150,200 Q-80,176 10,178" fill="none" stroke={rgba(C.liverDeep, 0.6)} strokeWidth={2} />
      <ellipse cx={-120} cy={166} rx={34} ry={10} fill={rgba('#ffffff', 0.32)} transform="rotate(-12 -120 166)" />
      <path d={STOMACH} fill={`url(#${k('stomachG')})`} stroke={dull(C.tissueLight)} strokeWidth={2} opacity={0.9} />
      <ellipse cx={86} cy={178} rx={18} ry={7} fill={rgba('#ffffff', 0.35)} transform="rotate(-20 86 178)" />
      <path d={SMALL_INT} fill="none" stroke={rgba(C.gut, 0.35)} strokeWidth={14} strokeLinecap="round" />
      <path d={SMALL_INT} fill="none" stroke={rgba(C.tissueLight, 0.4)} strokeWidth={2} />
      {/* kidneys + ureters + bladder */}
      {[KIDNEY_R, KIDNEY_L].map((d, i) => (
        <g key={`k${i}`}>
          <path d={d} fill={rgba(C.kidney, 0.25)} stroke={rgba(C.tissueLight, 0.2)} strokeWidth={14} />
          <path d={d} fill={`url(#${k('kidneyG')})`} stroke={dull(C.tissueLight)} strokeWidth={2} />
          <ellipse cx={i ? 92 : -92} cy={i ? 252 : 248} rx={8} ry={14} fill={rgba('#ffffff', 0.35)} transform={`rotate(${i ? 20 : -20} ${i ? 92 : -92} ${i ? 252 : 248})`} />
        </g>
      ))}
      {URETERS.map((d, i) => (
        <g key={`u${i}`}>
          <path d={d} fill="none" stroke={rgba(C.urine1, 0.35)} strokeWidth={5} strokeLinecap="round" />
          <path d={d} fill="none" stroke={rgba(C.urine0, 0.8)} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="3 12" strokeDashoffset={fx(-((f * 0.8) % 15))} />
        </g>
      ))}
      <g>
        <ellipse cx={0} cy={blCy} rx={blRx * 2.6} ry={blRy * 2.6} fill={`url(#${k('bladderGlow')})`} opacity={0.35 + 0.65 * bladderGlow} />
        <ellipse cx={0} cy={blCy} rx={blRx} ry={blRy} fill={`url(#${k('bladderG')})`} opacity={0.62 + 0.38 * bladderGlow} stroke={mixHex(C.urine0, '#ffffff', 0.3 * bladderGlow)} strokeWidth={2 + 1.5 * bladderGlow} />
        <ellipse cx={-blRx * 0.35} cy={blCy - blRy * 0.42} rx={blRx * 0.34} ry={blRy * 0.18} fill={rgba('#ffffff', 0.55)} />
      </g>
    </g>
  );

  // ---- water layers (inside the silhouette clip) ----
  const waterBack = hasWater && (
    <g clipPath={`url(#${k('wclip')})`}>
      <rect x={-340} y={Ls - 30} width={680} height={1300} fill={`url(#${k('water')})`} opacity={0.62 + 0.3 * waterGlow} />
    </g>
  );
  const waterFront = hasWater && (
    <g clipPath={`url(#${k('wclip')})`}>
      <rect x={-340} y={Ls - 30} width={680} height={1300} fill={rgba(C.water, 0.1 + 0.06 * waterGlow)} />
      <rect x={-340} y={Ls - 30} width={680} height={150} fill={`url(#${k('wtop')})`} />
      <path d={caus} fill="none" stroke={rgba(C.waterLight, 0.2 + 0.12 * waterGlow)} strokeWidth={2.4} strokeLinejoin="round" />
      <path d={caus} fill="none" stroke={rgba('#ffffff', 0.12)} strokeWidth={0.9} />
      <path d={bubRing} fill={rgba(C.waterLight, 0.12)} stroke={rgba('#ffffff', 0.7)} strokeWidth={1.3} />
      <path d={bubHi} fill="#ffffff" opacity={0.8} />
      {MOLS.map((m, i) => {
        const mx = m.x + 16 * Math.sin(f * 0.021 + m.ph);
        const my = m.y + 12 * Math.cos(f * 0.017 + m.ph * 1.3) - ((f * 0.25) % 40) * 0;
        if (my < Ls + m.r * 2) return null;
        return <WaterMolecule key={i} x={mx} y={my} r={m.r} rot={f * 0.8 * m.s + m.ph * 50} opacity={clamp((my - Ls - m.r * 2) / 30) * 0.9} glow={0.6} />;
      })}
    </g>
  );
  const surfaceEl = hasWater && (
    <g clipPath={`url(#${k('sil')})`}>
      <path d={surfLine} fill="none" stroke={rgba(C.waterGlow, 0.35)} strokeWidth={16} />
      <path d={surfLine} fill="none" stroke={C.waterLight} strokeWidth={3.5} />
      <path d={surfLine} fill="none" stroke="#ffffff" strokeWidth={1.4} strokeDasharray="40 90" strokeDashoffset={fx(-f * 3)} opacity={0.85} />
    </g>
  );

  // ---- gulps: bolus down the oesophagus -> stomach -> cascade to the surface ----
  const gulpEls = drink &&
    gulps.map((a, gi) => {
      if (a < -2 || a > 60) return null;
      const t = clamp(a / 12);
      const [bx, by, ang] = along(ESO, ease.inOutSine(t));
      const els: React.ReactNode[] = [];
      if (a <= 13) {
        const trail = 0.26;
        els.push(
          <path key="tr" d={ESO_D} fill="none" stroke={rgba(C.waterGlow, 0.5)} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${fx(560 * trail)} 900`} strokeDashoffset={fx(-560 * (ease.inOutSine(t) - trail))} />,
          <circle key="gl" cx={fx(bx)} cy={fx(by)} r={30} fill={`url(#${k('aquaGlow')})`} />,
          <ellipse key="bo" cx={fx(bx)} cy={fx(by)} rx={10} ry={17} fill={C.water} stroke={C.waterLight} strokeWidth={2} transform={`rotate(${fx((ang * 180) / Math.PI - 90)} ${fx(bx)} ${fx(by)})`} />,
          <circle key="bh" cx={fx(bx - 3)} cy={fx(by - 5)} r={3.5} fill="#fff" />,
        );
      }
      const sg = clamp(1 - Math.abs(a - 14) / 12);
      if (sg > 0) els.push(<circle key="sg" cx={100} cy={212} r={70} fill={`url(#${k('aquaGlow')})`} opacity={sg} />);
      // cascade
      const fall = Ls - 262;
      if (fall > 8) {
        for (let q = 0; q < 4; q++) {
          const ta = a - 13 - q * 2.5;
          if (ta < 0) continue;
          const dy = 0.5 * G * ta * ta;
          if (dy > fall) continue;
          els.push(<Drop key={`d${q}`} x={100 + (q - 1.5) * 7} y={262 + dy} r={7 - q} rot={180} stretch={1 + Math.min(1.2, ta * 0.12)} opacity={0.95} />);
        }
      }
      const hitA = a - gulpLandDelay(Ls);
      if (hitA >= 0 && hitA < 28) {
        const sx = fall > 8 ? 100 : 100;
        const sy = fall > 8 ? surf(100) : 236;
        const e = ease.outCubic(hitA / 28);
        els.push(
          <ellipse key="r1" cx={sx} cy={sy} rx={14 + 90 * e} ry={4 + 20 * e} fill="none" stroke={rgba(C.waterLight, 0.9 * (1 - e))} strokeWidth={3} />,
          <ellipse key="r2" cx={sx} cy={sy} rx={8 + 50 * e} ry={3 + 11 * e} fill="none" stroke={rgba('#ffffff', 0.7 * (1 - e))} strokeWidth={2} />,
        );
        if (hitA < 14) {
          for (let q = 0; q < 6; q++) {
            const aa = -Math.PI / 2 + (q - 2.5) * 0.42;
            const sp = 5.5 + (q % 2) * 1.6;
            const px = sx + Math.cos(aa) * sp * hitA;
            const py = sy + Math.sin(aa) * sp * hitA + 0.5 * 1.1 * hitA * hitA;
            els.push(<circle key={`s${q}`} cx={fx(px)} cy={fx(py)} r={3.4} fill={C.waterLight} opacity={1 - hitA / 14} />);
          }
        }
      }
      return <g key={`g${gi}`}>{els}</g>;
    });

  // ---- breath puffs (water vapour leaving with each exhale) ----
  const mouthY = hy(-212);
  const puffEls = puffs.map((a, pi) => {
    if (a < 0 || a > 56) return null;
    const t = a / 56;
    const o = Math.min(1, a / 5) * (1 - ease.inQuad(t));
    let wisp = '';
    for (let j = 0; j < 4; j++) {
      const s = j % 2 ? 1 : -1;
      const lane = j < 2 ? 0 : 1;
      const pts: P[] = [];
      for (let q = 0; q <= 6; q++) {
        const u = (q / 6) * Math.min(1, a / 10);
        const reach = 30 + a * 2.4;
        pts.push([s * (16 + u * reach), mouthY + 4 + lane * 10 - u * (8 + lane * 14) + 8 * Math.sin(u * 6 + j + a * 0.2) * u]);
      }
      wisp += smoothPath(pts) + ' ';
    }
    return (
      <g key={`p${pi}`} opacity={o}>
        {[-1, 1, -1, 1].map((s, j) => {
          const cx = s * (22 + a * (j < 2 ? 2.4 : 1.4));
          const cy = mouthY + 2 - a * (j < 2 ? 0.5 : 1.1) - 4 * Math.sin(a * 0.12 + j);
          const r = 16 + a * (j < 2 ? 1.5 : 1.1);
          return <circle key={j} cx={fx(cx)} cy={fx(cy)} r={fx(r)} fill={`url(#${k('mist')})`} />;
        })}
        <path d={wisp} fill="none" stroke={rgba(C.waterLight, 0.6)} strokeWidth={3.5} strokeLinecap="round" />
        <path d={wisp} fill="none" stroke="#ffffff" strokeWidth={1.2} strokeLinecap="round" opacity={0.6} />
        {[0, 1, 2, 3, 4, 5].map((j) => {
          const s = j % 2 ? 1 : -1;
          const mx = s * (18 + a * (1.9 + j * 0.4));
          const my = mouthY - 2 - a * (0.25 + j * 0.18) - 8 * Math.sin(a * 0.1 + j);
          return <WaterMolecule key={`m${j}`} x={mx} y={my} r={8.5 - j * 0.6} rot={a * 6 * s + j * 40} opacity={clamp(a / 6)} glow={0.9} />;
        })}
      </g>
    );
  });

  // ---- sweat beads ----
  const sweatEls =
    sweat > 0 &&
    SWEAT_PTS.map(([sx, sy0], i) => {
      if (drink && sx < -200) return null;
      const grow = ease.outBack(clamp(sweat * 1.7 - (i % 7) * 0.09));
      if (grow <= 0.02) return null;
      const delay = hash(i, 5) * 14;
      const rt = sweatRoll >= 0 ? Math.max(0, sweatRoll - delay) : 0;
      const roll = (sy0 < -150 && Math.abs(sx) < 110 ? 0.4 : 1) * 0.045 * Math.pow(rt, 1.9) * (0.7 + 0.6 * hash(i, 9));
      const sy = sy0 < -150 ? hy(sy0) : sy0;
      const face = sy0 < -150 && Math.abs(sx) < 110;
      // face beads (forehead/temples) only slide a little and evaporate: never read as tears
      const fade = face ? 1 - clamp((rt - 10) / 16) : 1 - clamp((roll - 90) / 50);
      if (fade <= 0) return null;
      const r = (6 + 3 * hash(i, 3)) * grow;
      return (
        <g key={`sw${i}`} opacity={fade}>
          {roll > 4 && <path d={`M${sx},${fx(sy)} L${sx + 1},${fx(sy + roll)}`} stroke={rgba(C.waterLight, 0.45)} strokeWidth={r * 0.7} strokeLinecap="round" />}
          <Drop x={sx + 1} y={sy + roll} r={r} stretch={1 + Math.min(0.6, rt * 0.04)} opacity={0.95} />
        </g>
      );
    });

  // ---- seeping: tiny drops + vapour through the skin ----
  const seepEls =
    seep > 0 &&
    SEEP_PTS.map(([sx, sy0], i) => {
      const ph = ((f * 0.022 + hash(i, 12)) % 1 + 1) % 1;
      const on = clamp(seep * 1.5 - hash(i, 4) * 0.6);
      if (on <= 0) return null;
      const dir = Math.sign(sx) || (i % 2 ? 1 : -1);
      const sy = sy0 < -150 ? hy(sy0) : sy0;
      const px = sx + dir * (4 + ph * 34);
      const py = sy - ph * 18 + (sy0 > 300 ? ph * 10 : 0);
      return <Drop key={`se${i}`} x={px} y={py} r={3.4 + 1.6 * hash(i, 7)} rot={dir * 70} stretch={1.2} opacity={on * Math.sin(ph * Math.PI) * 0.9} />;
    });

  // ---- urine drips (schematic straw drops leaving the bladder) ----
  const dripEls = drips.map((a, di) => {
    if (a < 0 || a > 34) return null;
    const yy = 418 + 0.5 * 1.3 * a * a;
    const o = 1 - clamp((a - 22) / 12);
    const r = 7;
    const d = `M0,${-r * 2.1} C${r * 0.4},${-r * 1.1} ${r},${-r * 0.4} ${r},0 A${r},${r} 0 1 1 ${-r},0 C${-r},${-r * 0.4} ${-r * 0.4},${-r * 1.1} 0,${-r * 2.1} Z`;
    return (
      <g key={`dr${di}`} transform={`translate(0,${fx(yy)}) scale(1,${fx(1 + Math.min(0.5, a * 0.03))})`} opacity={o}>
        <circle r={20} fill={`url(#${k('bladderGlow')})`} />
        <path d={d} fill={C.urine1} stroke={rgba(C.urine3, 0.9)} strokeWidth={1.5} />
        <circle cx={-2.5} cy={-2.5} r={2} fill="#fff" />
      </g>
    );
  });

  // ---- x-ray drinking glass at the lips ----
  const glassEl = drink && (() => {
    const loc = (px: number, py: number) => rotP([px, py], tipDeg, rim);
    const inner: P[] = [loc(-35, -2), loc(35, -2), loc(27, -146), loc(-27, -146)];
    const ys = inner.map((q) => q[1]);
    const yLow = Math.max(...ys);
    const yHigh = Math.min(...ys);
    const yw = yLow - (yLow - yHigh) * clamp(glassFill) * 0.55;
    const innerD = `M${inner.map((q) => `${fx(q[0])},${fx(q[1])}`).join(' L')} Z`;
    const outer = [loc(-40, 0), loc(-31, -152), loc(31, -152), loc(40, 0)];
    const outerD = `M${outer.map((q) => `${fx(q[0])},${fx(q[1])}`).join(' L')}`;
    const baseD = `M${[loc(-31, -150), loc(31, -150), loc(30, -164), loc(-30, -164)].map((q) => `${fx(q[0])},${fx(q[1])}`).join(' L')} Z`;
    const hiA = loc(-26, -12), hiB = loc(-20, -136);
    const rimA = loc(-40, 0), rimB = loc(40, 0);
    return (
      <g>
        <clipPath id={k('gclip')}>
          <path d={innerD} />
        </clipPath>
        <path d={innerD} fill={rgba(C.bodyGhostLight, 0.07)} />
        <g clipPath={`url(#${k('gclip')})`}>
          <rect x={-400} y={yw} width={800} height={400} fill={rgba(C.water, 0.75)} />
          <rect x={-400} y={yw} width={800} height={14} fill={rgba(C.waterLight, 0.8)} />
          <line x1={-400} y1={yw} x2={400} y2={yw} stroke="#fff" strokeWidth={2} opacity={0.8} />
        </g>
        <path d={outerD} fill="none" stroke={rgba(C.bodyGhost, 0.3)} strokeWidth={10} strokeLinejoin="round" />
        <path d={outerD} fill="none" stroke={C.bodyGhostLight} strokeWidth={2.6} strokeLinejoin="round" />
        <path d={baseD} fill={rgba(C.bodyGhostLight, 0.3)} stroke={C.bodyGhostLight} strokeWidth={2} />
        <line x1={fx(rimA[0])} y1={fx(rimA[1])} x2={fx(rimB[0])} y2={fx(rimB[1])} stroke={C.bodyGhostLight} strokeWidth={3} strokeLinecap="round" />
        <line x1={fx(hiA[0])} y1={fx(hiA[1])} x2={fx(hiB[0])} y2={fx(hiB[1])} stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.55} />
      </g>
    );
  })();

  // ---- face (faint x-ray features) ----
  const faceEl = (
    <g transform={headTf} opacity={ghost * 0.6} fill="none" stroke={rgba(C.bodyGhostLight, 0.55)} strokeWidth={2}>
      <path d="M-56,-292 Q-38,-304 -18,-292 Q-38,-284 -56,-292" />
      <path d="M18,-292 Q38,-304 56,-292 Q38,-284 18,-292" />
      <path d="M-58,-312 L-18,-316 M18,-316 L58,-312" strokeWidth={3} />
      <path d="M0,-286 L-6,-248 L6,-246" strokeWidth={1.5} />
      {drink ? <ellipse cx={0} cy={-212} rx={14} ry={9} /> : <path d="M-18,-214 Q0,-208 18,-214" />}
      {drink && <path d="M-60,-176 Q0,-140 60,-176" strokeWidth={1.6} opacity={0.7} />}
    </g>
  );
  const sway = Math.sin(f * 0.05) * 0.8 + Math.sin(f * 0.13 + 1) * 0.3;
  const hairEl = (
    <g transform={headTf}>
      <g transform={`rotate(${fx(sway)} 0 -300)`}>
        <g opacity={ghost * 0.32}>
          <path d={HAIR_CAP} fill={C.hair} />
          {HAIR.locks.map((d, i) => (
            <path key={i} d={d} fill={i % 3 === 1 ? C.hairShade : C.hair} stroke={C.hairLight} strokeWidth={1.2} strokeLinejoin="round" />
          ))}
        </g>
        <path d={HAIR.strands} fill="none" stroke={rgba(C.bodyGhostLight, 0.45)} strokeWidth={1.6} strokeLinecap="round" opacity={ghost} />
        <path d={HAIR.d} fill="none" stroke={rgba(C.bodyGhostLight, 0.28)} strokeWidth={1.2} opacity={ghost} />
      </g>
    </g>
  );
  const throatBob = drink ? 6 * Math.max(0, ...gulps.map((a) => (a >= -2 && a < 10 ? Math.sin(((a + 2) / 12) * Math.PI) : 0))) : 0;

  // reveal scan band + glint sweep
  const bandY = lerp(-500, 1250, clamp(reveal));
  const glintX = ((f * 7) % 1600) - 800;

  const allSil = (
    <>
      <path d={sil} />
      {armD.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {drink && <path d={handD} />}
    </>
  );
  const rimStroke = (w: number, col: string) => (
    <g fill="none" stroke={col} strokeWidth={w} strokeLinejoin="round">
      <path d={sil} />
      {armD.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {drink && <path d={handD} />}
    </g>
  );

  return (
    <g transform={`translate(${fx(x)},${fx(y)}) rotate(${fx(rot)}) scale(${fx(scale)})`} opacity={opacity}>
      <defs>
        <clipPath id={k('sil')}>{allSil}</clipPath>
        <clipPath id={k('wclip')}>
          <path d={waterRegion} />
        </clipPath>
        <radialGradient id={k('glass')} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={C.bodyGhost} stopOpacity={0.05} />
          <stop offset="70%" stopColor={C.bodyGhost} stopOpacity={0.12} />
          <stop offset="100%" stopColor={C.bodyGhostLight} stopOpacity={0.3} />
        </radialGradient>
        <linearGradient id={k('water')} gradientUnits="userSpaceOnUse" x1="0" y1={fx(Ls)} x2="0" y2={FEET}>
          <stop offset="0" stopColor={C.waterGlow} stopOpacity={0.75} />
          <stop offset="0.25" stopColor={C.water} stopOpacity={0.55} />
          <stop offset="1" stopColor={C.waterDeep} stopOpacity={0.62} />
        </linearGradient>
        <linearGradient id={k('wtop')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.waterLight} stopOpacity={0.45} />
          <stop offset="1" stopColor={C.waterLight} stopOpacity={0} />
        </linearGradient>
        <radialGradient id={k('lungG')} cx="45%" cy="30%" r="80%">
          <stop offset="0%" stopColor={dull(C.lungLight)} stopOpacity={0.9} />
          <stop offset="60%" stopColor={dull(C.lung)} stopOpacity={0.75} />
          <stop offset="100%" stopColor={dull(C.lungDeep)} stopOpacity={0.85} />
        </radialGradient>
        <radialGradient id={k('heartG')} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={dull(C.heartLight)} />
          <stop offset="60%" stopColor={dull(C.heart)} />
          <stop offset="100%" stopColor={dull(C.heartDeep)} />
        </radialGradient>
        <radialGradient id={k('heartGlow')}>
          <stop offset="0%" stopColor={C.bloodLight} stopOpacity={0.5} />
          <stop offset="100%" stopColor={C.blood} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={k('liverG')} cx="32%" cy="28%" r="85%">
          <stop offset="0%" stopColor={dull(C.liverLight)} stopOpacity={0.95} />
          <stop offset="55%" stopColor={dull(C.liver)} stopOpacity={0.88} />
          <stop offset="100%" stopColor={dull(C.liverDeep)} stopOpacity={0.9} />
        </radialGradient>
        <radialGradient id={k('stomachG')} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={dull(C.tissueLight)} stopOpacity={0.85} />
          <stop offset="100%" stopColor={dull(C.tissueDeep)} stopOpacity={0.8} />
        </radialGradient>
        <radialGradient id={k('kidneyG')} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={dull(C.tissueLight)} />
          <stop offset="55%" stopColor={dull(C.kidney)} />
          <stop offset="100%" stopColor={dull(C.tissueDark)} />
        </radialGradient>
        <radialGradient id={k('bladderG')} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor={C.urine0} stopOpacity={0.9} />
          <stop offset="60%" stopColor={mixHex(C.urine0, C.urine1, 0.6)} stopOpacity={0.75} />
          <stop offset="100%" stopColor={C.urine2} stopOpacity={0.8} />
        </radialGradient>
        <radialGradient id={k('bladderGlow')}>
          <stop offset="0%" stopColor={C.urine1} stopOpacity={0.55} />
          <stop offset="100%" stopColor={C.urine1} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={k('brainG')} cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor={dull(C.brainLight)} stopOpacity={0.95} />
          <stop offset="60%" stopColor={dull(C.brain)} stopOpacity={0.88} />
          <stop offset="100%" stopColor={dull(C.brainDeep)} stopOpacity={0.9} />
        </radialGradient>
        <radialGradient id={k('brainGlow')}>
          <stop offset="0%" stopColor={C.brainLight} stopOpacity={0.45} />
          <stop offset="100%" stopColor={C.brain} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={k('aquaGlow')}>
          <stop offset="0%" stopColor={C.waterLight} stopOpacity={0.85} />
          <stop offset="45%" stopColor={C.water} stopOpacity={0.35} />
          <stop offset="100%" stopColor={C.water} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={k('mist')}>
          <stop offset="0%" stopColor={C.waterLight} stopOpacity={0.8} />
          <stop offset="55%" stopColor={C.waterGlow} stopOpacity={0.3} />
          <stop offset="100%" stopColor={C.waterGlow} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={k('aura')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.water} stopOpacity={0.22} />
          <stop offset="100%" stopColor={C.water} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={k('treatAura')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.treat} stopOpacity={0.3} />
          <stop offset="100%" stopColor={C.treat} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={k('band')} gradientUnits="userSpaceOnUse" x1="0" y1={fx(bandY - 90)} x2="0" y2={fx(bandY + 20)}>
          <stop offset="0" stopColor={C.bodyGhostLight} stopOpacity={0} />
          <stop offset="0.7" stopColor={C.bodyGhostLight} stopOpacity={0.22} />
          <stop offset="1" stopColor={C.bodyGhostLight} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={k('glint')} gradientUnits="userSpaceOnUse" x1={fx(glintX - 120)} y1="-400" x2={fx(glintX + 120)} y2="-200">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.13} />
          <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* water light spilling onto the backdrop */}
      {hasWater && <ellipse cx={0} cy={fx((Ls + FEET) / 2)} rx={470} ry={fx(Math.max(200, (FEET - Ls) * 0.75))} fill={`url(#${k('aura')})`} opacity={0.6 + 0.4 * waterGlow} />}
      {recover > 0 && <ellipse cx={0} cy={300} rx={560} ry={1000} fill={`url(#${k('treatAura')})`} opacity={recover} />}

      {/* outer glow (layered strokes) */}
      <g opacity={ghost}>
        {rimStroke(46, rgba(C.bodyGhost, 0.05))}
        {rimStroke(24, rgba(C.bodyGhost, 0.1))}
        {rimStroke(10, rgba(C.bodyGhostLight, 0.14))}
      </g>
      {/* glass volume */}
      <g opacity={ghost} clipPath={`url(#${k('sil')})`}>
        <rect x={-400} y={-500} width={800} height={1760} fill={`url(#${k('glass')})`} />
        {rimStroke(36, rgba(C.bodyGhostLight, 0.1))}
        {rimStroke(14, rgba(C.bodyGhostLight, 0.12))}
      </g>

      <g clipPath={`url(#${k('sil')})`}>
        {skeletonEl}
        {waterBack}
        {vesselsEl}
        {organsEl}
        {waterFront}
        {reveal >= 0 && reveal <= 1 && <rect x={-400} y={fx(bandY - 90)} width={800} height={110} fill={`url(#${k('band')})`} />}
        <rect x={-400} y={-500} width={800} height={1760} fill={`url(#${k('glint')})`} />
      </g>
      {brainEl}
      {surfaceEl}
      {/* target line (e.g. the 60 % mark) */}
      {mark > 0 && (
        <g opacity={mark}>
          <line x1={-300} y1={fx(levelY(markLevel))} x2={300} y2={fx(levelY(markLevel))} stroke={C.waterLight} strokeWidth={2.4} strokeDasharray="14 10" strokeDashoffset={fx(-f * 0.8)} />
        </g>
      )}
      {hairEl}
      {faceEl}
      {drink && (
        <g opacity={0.9}>
          <path d={ESO_D} fill="none" stroke={rgba(C.waterLight, 0.18)} strokeWidth={9} strokeLinecap="round" />
          <path d={`M-10,${fx(-150 - throatBob)} Q0,${fx(-158 - throatBob)} 10,${fx(-150 - throatBob)}`} fill="none" stroke={rgba(C.bodyGhostLight, 0.7)} strokeWidth={2.4} />
        </g>
      )}
      {gulpEls}
      {/* rim + specular */}
      <g opacity={ghost}>
        {rimStroke(2.6, rgba(C.bodyGhostLight, 0.9))}
        {recover > 0 && rimStroke(5, rgba(C.treat, 0.55 * recover))}
        <g fill="none" stroke="#ffffff" strokeLinecap="round">
          <path d="M-70,-388 Q-40,-414 0,-416" strokeWidth={6} opacity={0.4} transform={headTf} />
          <path d="M-210,-96 Q-160,-114 -110,-116" strokeWidth={6} opacity={0.32} />
          {!drink && <path d="M-236,-20 L-242,160" strokeWidth={5} opacity={0.2} />}
          <path d="M-168,40 Q-160,120 -144,200" strokeWidth={8} opacity={0.12} />
          <path d="M-134,600 Q-126,700 -122,800" strokeWidth={6} opacity={0.14} />
          <path d="M70,640 Q66,720 62,820" strokeWidth={4} opacity={0.1} />
        </g>
      </g>
      {glassEl}
      {drink && (
        <g>
          <path d={handD} fill={rgba(C.bodyGhost, 0.16)} stroke={C.bodyGhostLight} strokeWidth={2.4} />
          {[0, 1, 2, 3].map((q) => {
            const a: P = [hand[0] - 22 + q * 13, hand[1] - 20 + q * 5];
            return <path key={q} d={`M${fx(a[0])},${fx(a[1])} q10,6 8,18`} fill="none" stroke={rgba(C.bodyGhostLight, 0.6)} strokeWidth={2} strokeLinecap="round" />;
          })}
        </g>
      )}
      {puffEls}
      {sweatEls}
      {seepEls}
      {dripEls}
    </g>
  );
};
