// Private geometry for the brain builder's x-ray HEAD + BRAIN kit (S05 Thirst, S13 BrainShrink).
// World space = the 1080×1920 frame at camera scale 1. Side view, he faces screen-LEFT.
// Everything here is computed once at module load (pure + deterministic).
import {catmull, rng, smoothPath} from '../../lib/anim';

export type P = [number, number];
const fx = (n: number) => n.toFixed(1);

/** Closed Catmull-Rom loop sampled into a dense polyline. */
export const catmullClosed = (pts: P[], per = 10): P[] => {
  const n = pts.length;
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
};

/** Offset a polyline along its (-dy, dx) normal (for our clockwise skull path: + = inward). */
export const offsetPoly = (pts: P[], d: number, closed = false): P[] => {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    return [p[0] + (d * -dy) / L, p[1] + (d * dx) / L] as P;
  });
};

/** Offset each point by a per-index amount along the normal (wiggle). */
export const offsetPolyVar = (pts: P[], d: (i: number) => number): P[] => {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const k = d(i);
    return [p[0] + (k * -dy) / L, p[1] + (k * dx) / L] as P;
  });
};

export const polyD = (pts: P[], closed = false) => 'M' + pts.map((p) => `${fx(p[0])},${fx(p[1])}`).join('L') + (closed ? 'Z' : '');

/** Arc-length parametrised polyline. at(t) → [x, y, angle]; atD(px) by distance. */
export class Track {
  cum: number[] = [0];
  total = 0;
  constructor(public pts: P[]) {
    for (let i = 1; i < pts.length; i++) {
      this.total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      this.cum.push(this.total);
    }
  }
  atD(d: number): [number, number, number] {
    const D = Math.max(0, Math.min(this.total, d));
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.cum[m] <= D) lo = m;
      else hi = m;
    }
    const seg = this.cum[hi] - this.cum[lo] || 1;
    const k = (D - this.cum[lo]) / seg;
    const a = this.pts[lo], b = this.pts[hi];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0])];
  }
  at(t: number) {
    return this.atD(t * this.total);
  }
}

const inPoly = (pts: P[], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

// ---------------------------------------------------------------------------------------------
// skin silhouette (glass body outline), clockwise from the top of the scalp

const SKIN_CTRL: P[] = [
  [560, 343], [722, 356], [852, 418], [948, 530], [998, 680], [1004, 830], [980, 962], [930, 1072], [874, 1160], [846, 1262],
  [836, 1400], [842, 1560], [866, 1680], [934, 1782], [1040, 1852], [1150, 1900], [1160, 2300], [1150, 2560], [40, 2560], [60, 2200], [148, 1925], [222, 1812],
  [282, 1722], [298, 1600], [292, 1470], [270, 1408], [210, 1376], [156, 1350], [134, 1316], [140, 1276], [124, 1254], [108, 1234],
  [113, 1212], [101, 1192], [112, 1168], [116, 1140], [84, 1124], [64, 1102], [84, 1052], [118, 980], [138, 930], [118, 884],
  [126, 800], [136, 680], [174, 546], [262, 436], [400, 366],
];
export const SKIN = catmullClosed(SKIN_CTRL, 8);
export const SKIN_D = polyD(SKIN, true);

/** Messy hair as a faint ghost cap (outer bumpy edge; the scene sways the points). */
export const HAIR_CTRL: P[] = [
  [146, 655], [176, 590], [160, 560], [204, 500], [196, 470], [252, 420], [262, 384], [336, 346], [372, 318], [452, 304], [506, 282],
  [586, 292], [644, 276], [716, 304], [790, 310], [846, 352], [904, 380], [942, 436], [992, 476], [1000, 540], [1030, 600], [1012, 660],
  [1030, 730], [1004, 800], [940, 760], [700, 520], [420, 470], [240, 600],
];
export const HAIR_OUTER_N = 24; // first N points are the visible outer edge

// ---------------------------------------------------------------------------------------------
// skull (clean translucent glass: vault + base only, no face bones)

const SKULL_CTRL: P[] = [
  [170, 900], [152, 770], [168, 635], [232, 505], [345, 412], [515, 368], [695, 378], [840, 438], [938, 552], [978, 705],
  [970, 858], [932, 992], [872, 1088],
];
export const SKULL_OUT = catmull(SKULL_CTRL, 14);
export const SKULL_T = 20; // bone thickness
export const SKULL_IN = offsetPoly(SKULL_OUT, SKULL_T);
export const SKULL_BAND_D = polyD([...SKULL_OUT, ...[...SKULL_IN].reverse()], true);
export const SKULL_OUT_D = polyD(SKULL_OUT);
export const SKULL_IN_D = polyD(SKULL_IN);

/** Skull base (floor of the cranial cavity) — front part ends at the foramen magnum. */
export const BASE_FRONT: P[] = catmull(
  [
    [172, 900], [240, 896], [305, 902], [345, 936], [395, 1000], [450, 1020], [488, 1022], [494, 1042], [515, 1052], [536, 1042],
    [542, 1018], [590, 1062], [655, 1108],
  ],
  8,
);
export const BASE_BACK: P[] = catmull([[722, 1112], [800, 1097], [850, 1094], [872, 1088]], 8);
export const BASE_FRONT_D = polyD(BASE_FRONT);
export const BASE_BACK_D = polyD(BASE_BACK);
/** The cranial cavity (filled with cerebrospinal fluid around the brain). */
export const CAVITY_D = polyD([...SKULL_IN, ...[...BASE_BACK].reverse(), [690, 1120], ...[...BASE_FRONT].reverse()], true);

// ---------------------------------------------------------------------------------------------
// brain (cerebrum): its dome follows the inner skull at a CSF gap of ~15 px

export const CSF_GAP = 15;
const TOP_ARC_FULL = offsetPoly(SKULL_OUT, SKULL_T + CSF_GAP);
const i0 = TOP_ARC_FULL.findIndex((p) => p[1] < 845);
let i1 = TOP_ARC_FULL.length - 1;
while (i1 > 0 && TOP_ARC_FULL[i1][1] > 815) i1--;
export const TOP_ARC_I0 = i0;
export const TOP_ARC = TOP_ARC_FULL.slice(i0, i1 + 1);
const BRAIN_BOTTOM: P[] = [
  [890, 866], [800, 892], [716, 910], [652, 958], [560, 998], [452, 990], [374, 954], [344, 910], [362, 879], [300, 872], [244, 858],
];
const BRAIN_CTRL: P[] = [...TOP_ARC.filter((_, i) => i % 6 === 0), ...BRAIN_BOTTOM];
export const BRAIN = catmullClosed(BRAIN_CTRL, 6);
export const BRAIN_D = polyD(BRAIN, true);
/** Shrink anchor (the brain hangs from the brainstem). */
export const BRAIN_ANCHOR: P = [600, 960];

export const CEREBELLUM = catmullClosed(
  [[690, 912], [790, 892], [874, 910], [904, 960], [878, 1024], [800, 1050], [712, 1036], [668, 980]],
  8,
);
export const CEREBELLUM_D = polyD(CEREBELLUM, true);
/** Folia: fine horizontal curved stripes. */
export const FOLIA_D = (() => {
  let d = '';
  for (let k = 0; k < 11; k++) {
    const y0 = 918 + k * 12.5;
    const pts: P[] = [];
    for (let x = 660; x <= 930; x += 18) pts.push([x, y0 + (x - 800) * (x - 800) * 0.0011 * (0.3 + k / 12) + 2.5 * Math.sin(x * 0.09 + k)]);
    d += smoothPath(pts) + ' ';
  }
  return d;
})();

export const BRAINSTEM_D = smoothPath(
  [[590, 930], [656, 926], [672, 985], [688, 1050], [700, 1110], [712, 1172], [668, 1174], [650, 1122], [606, 1088], [570, 1042], [568, 985]],
  true,
);
export const PONS_D = [0, 1, 2, 3].map((k) => smoothPath([[574, 1000 + k * 14], [620, 1004 + k * 14], [676, 1012 + k * 13]])).join(' ');
export const CORD = new Track(catmull([[690, 1160], [693, 1300], [700, 1450], [712, 1600], [730, 1760], [752, 1980], [780, 2300], [800, 2560]], 10));
export const CORD_D = polyD(CORD.pts);

export const HYPO: P = [528, 944];
export const PIT: P = [515, 1030];
export const STALK_D = smoothPath([[532, 958], [524, 990], [517, 1018]]);

// ---------------------------------------------------------------------------------------------
// gyri + sulci (generated): main fissures by hand + a jittered grid of meandering squiggles

const SYLV: P[] = [[356, 880], [440, 846], [530, 808], [610, 770], [652, 742], [676, 708]];
const CENTRAL: P[] = [[596, 410], [584, 470], [566, 540], [552, 610], [530, 680], [512, 745], [494, 800]];
const MAIN: P[][] = [
  SYLV,
  CENTRAL,
  [[530, 418], [520, 500], [492, 580], [478, 660], [452, 740], [434, 820]], // precentral
  [[668, 432], [652, 520], [636, 600], [612, 680], [588, 760]], // postcentral
  [[476, 520], [400, 528], [330, 560], [272, 620], [238, 690]], // superior frontal
  [[452, 690], [380, 706], [312, 740], [250, 790]], // inferior frontal
  [[386, 930], [470, 902], [560, 866], [650, 818], [730, 786], [800, 760]], // superior temporal
  [[440, 972], [540, 958], [630, 924], [700, 880]], // inferior temporal
  [[624, 610], [700, 618], [780, 640], [860, 690]], // intraparietal
  [[800, 500], [790, 560], [820, 600]],
  [[880, 760], [840, 800], [860, 840]],
];
export const SULCI_D = MAIN.map((m, j) => polyD(offsetPolyVar(catmull(m, 8), (i) => 5 * Math.sin(i * 0.6 + j * 1.9) + 1.2 * Math.sin(i * 1.5 + j)))).join(' ');
export const SYLV_D = smoothPath(SYLV);

const sylvY = (x: number) => 880 - (x - 356) * 0.46;
const centralX = (y: number) => 596 - (y - 410) * 0.27;

export const GYRI_D = (() => {
  const r = rng(4242);
  let d = '';
  const step = 47;
  for (let gy = 400; gy < 1010; gy += step) {
    for (let gx = 190; gx < 950; gx += step) {
      const x = gx + (r() - 0.5) * step * 0.8;
      const y = gy + (r() - 0.5) * step * 0.8;
      if (!inPoly(BRAIN, x, y)) continue;
      let th: number;
      if (x < 740 && y > sylvY(x) + 14) th = -0.43 + (r() - 0.5) * 0.5; // temporal: parallel to the fissure
      else if (Math.abs(x - centralX(y)) < 75) th = 1.84 + (r() - 0.5) * 0.4; // pre/post-central strip
      else if (x < centralX(y)) th = Math.atan2(y - 820, x - 600) + Math.PI / 2 + (r() - 0.5) * 0.7; // frontal arcs
      else th = Math.atan2(y - 760, x - 640) + Math.PI / 2 + (r() - 0.5) * 1.6; // parietal / occipital meander
      const L = 80 + r() * 60;
      const n = 6;
      const pts: P[] = [];
      let px = x - (Math.cos(th) * L) / 2, py = y - (Math.sin(th) * L) / 2;
      let a = th;
      for (let i = 0; i <= n; i++) {
        pts.push([px, py]);
        a += (r() - 0.5) * 1.15;
        px += (Math.cos(a) * L) / n;
        py += (Math.sin(a) * L) / n;
      }
      d += smoothPath(pts) + ' ';
      // a branchlet now and then
      if (r() < 0.25) {
        const k = 2 + Math.floor(r() * 3);
        const b = a + (r() < 0.5 ? 1 : -1) * (1.1 + r() * 0.5);
        const bl = 18 + r() * 16;
        d += `M${fx(pts[k][0])},${fx(pts[k][1])} q${fx(Math.cos(b) * bl * 0.6 + 3)},${fx(Math.sin(b) * bl * 0.6 - 3)} ${fx(Math.cos(b) * bl)},${fx(Math.sin(b) * bl)} `;
      }
    }
  }
  return d;
})();

// ---------------------------------------------------------------------------------------------
// vessels

/** Brain-surface arteries (middle cerebral artery fanning out of the Sylvian fissure etc.). */
export const ARTERIES_D = [
  [[360, 884], [450, 850], [540, 812], [610, 776], [660, 738]],
  [[430, 856], [404, 770], [360, 670], [330, 580], [340, 500]],
  [[492, 830], [500, 720], [474, 620], [462, 520], [480, 440]],
  [[566, 800], [600, 690], [612, 600], [636, 500]],
  [[628, 770], [700, 690], [748, 610], [790, 530]],
  [[660, 738], [756, 742], [840, 712], [900, 660]],
  [[600, 952], [690, 912], [780, 868], [880, 820]],
  [[404, 770], [330, 760], [262, 740]],
  [[612, 600], [700, 590], [780, 580]],
].map((p, j) => {
  const dense = catmull(p as P[], 6);
  const out = offsetPolyVar(dense, (i) => 3.5 * Math.sin(i * 0.9 + j * 2) + 2 * Math.sin(i * 2.3 + j));
  return polyD(out);
}).join(' ');

/** Neck: the carotid artery carries blood UP into the head, the jugular vein carries it DOWN. */
export const CAROTID = new Track(
  catmull([[414, 2560], [416, 2200], [418, 1990], [422, 1760], [434, 1540], [452, 1360], [476, 1222], [500, 1132], [522, 1080], [548, 1044], [562, 1004], [574, 968]], 10),
);
export const JUGULAR = new Track(catmull([[652, 1094], [616, 1152], [578, 1240], [550, 1360], [532, 1520], [520, 1700], [512, 1990], [508, 2250], [506, 2560]], 10));
export const FACE_ARTERY_D = smoothPath([[468, 1262], [400, 1222], [330, 1196], [262, 1150], [214, 1060], [190, 960]]);
/** Superior sagittal sinus (the big vein along the top, just under the skull). */
export const SINUS = offsetPoly(SKULL_OUT, SKULL_T + 5).slice(i0 + 8, i1 - 8);
export const SINUS_D = polyD(SINUS);
/** Bridging veins: skull-side point (fixed) + brain-side point (moves when the brain shrinks). */
export const BRIDGES: {a: P; b: P}[] = [0.1, 0.2, 0.31, 0.42, 0.52, 0.62, 0.72, 0.82, 0.9].map((t) => {
  const k = Math.round(t * (TOP_ARC.length - 1));
  const ki = i0 + k;
  return {a: offsetPoly(SKULL_OUT, SKULL_T + 2)[ki], b: TOP_ARC[k]};
});

/** Airway: mouth → throat → trachea down the front of the neck. */
export const AIRWAY = new Track(catmull([[120, 1196], [200, 1206], [280, 1226], [330, 1290], [348, 1420], [352, 1600], [346, 1800], [340, 1990], [330, 2560]], 10));
export const AIRWAY_D = polyD(AIRWAY.pts);
export const TONGUE_D = smoothPath([[130, 1214], [180, 1196], [250, 1194], [300, 1222], [312, 1262], [280, 1276], [200, 1250], [140, 1236]], true);

/** Vertebrae (glass): centres follow the cord, bodies in front (left) of it. */
export const VERTEBRAE = (() => {
  const out: {x: number; y: number; rot: number; h: number; w: number}[] = [];
  const ys = [1150, 1206, 1270, 1346, 1422, 1498, 1574, 1650, 1726, 1802, 1878, 1954, 2030, 2106, 2182, 2258];
  ys.forEach((y, i) => {
    const [cx, , ang] = CORD.atD(Math.max(0, y - 1160));
    const rot = (ang * 180) / Math.PI - 90;
    out.push({x: cx - 64, y, rot, h: i < 2 ? 34 : 54, w: i < 2 ? 56 : 74});
  });
  return out;
})();
export const CLAVICLE_D = smoothPath([[300, 1800], [400, 1772], [520, 1770], [620, 1748], [700, 1756]]);
export const SHOULDER_D = smoothPath([[300, 2560], [320, 2100], [380, 1840], [470, 1752], [590, 1730], [710, 1760], [790, 1850], [830, 2100], [840, 2560]]);

/** Nerve paths from the hypothalamus to the mouth / throat (S05 thirst sparks). */
export const NERVE_MOUTH = new Track(catmull([HYPO, [470, 1000], [390, 1076], [300, 1150], [214, 1200]], 10));
export const NERVE_THROAT = new Track(catmull([HYPO, [486, 1060], [420, 1170], [360, 1270], [340, 1380]], 10));
export const NERVE_TONGUE = new Track(catmull([HYPO, [450, 1030], [370, 1130], [290, 1230]], 10));
/** ADH route: pituitary → venous drainage → down the jugular. */
export const ADH_TRACK = new Track(catmull([PIT, [560, 1060], [604, 1112], [616, 1152], [578, 1240], [550, 1360], [532, 1520], [520, 1700], [512, 1990], [508, 2560]], 10));

/** Neural pathways on the cortex (S13 sparks) — in brain-local (unshrunk) coords. */
export const PATHWAYS: Track[] = [
  [[250, 700], [320, 610], [420, 560], [520, 520], [620, 500], [740, 520]],
  [[300, 800], [400, 760], [500, 700], [600, 640], [700, 600], [820, 620], [900, 700]],
  [[420, 940], [520, 900], [620, 850], [720, 820], [840, 800]],
  [[560, 460], [540, 560], [500, 660], [470, 760]],
  [[700, 470], [760, 560], [800, 660], [860, 760]],
  [[260, 610], [360, 680], [460, 640], [560, 700], [660, 720], [760, 700]],
  [[380, 480], [460, 450], [560, 440], [660, 460], [760, 500], [850, 580]],
].map((p) => new Track(catmull(p as P[], 10)));
