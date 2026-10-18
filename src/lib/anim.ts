// Shared animation math. Pure functions only — safe to import from any scene.

export const FPS = 30;
export const W = 1080;
export const H = 1920;

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => (b === a ? 0 : (x - a) / (b - a));

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
};
export type EaseFn = (t: number) => number;

/** 0..1 progress of frame f between a and b (clamped), optionally eased. */
export const ramp = (f: number, a: number, b: number, e: EaseFn = ease.linear) =>
  e(clamp(invLerp(a, b, f)));

/** Fade-in over [a,a+inLen], hold, fade-out over [b-outLen,b]. */
export const window01 = (f: number, a: number, b: number, inLen = 8, outLen = 8) =>
  Math.min(ramp(f, a, a + inLen, ease.outQuad), 1 - ramp(f, b - outLen, b, ease.inQuad));

/** Piecewise keyframes: keys = [[frame, value], ...] sorted by frame. */
export const keys = (f: number, ks: [number, number][], e: EaseFn = ease.inOutSine) => {
  if (f <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (f <= ks[i][0]) {
      const [f0, v0] = ks[i - 1];
      const [f1, v1] = ks[i];
      return lerp(v0, v1, e(invLerp(f0, f1, f)));
    }
  }
  return ks[ks.length - 1][1];
};

// ---------- deterministic randomness ----------
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Hash of an integer (+seed) to [0,1). */
export const hash = (n: number, seed = 0) => {
  let x = Math.imul((n | 0) ^ Math.imul(seed | 0, 0x27d4eb2d), 0x9e3779b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
};
/** Smooth 1D value noise in [-1,1]. */
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const t = x - i;
  const s = t * t * (3 - 2 * t);
  return lerp(hash(i, seed), hash(i + 1, seed), s) * 2 - 1;
};
/** Two-octave wander, handy for organic drift. */
export const wander = (x: number, seed = 0) => 0.7 * noise1(x, seed) + 0.3 * noise1(x * 2.3 + 17, seed + 9);

// ---------- colour ----------
const parseHex = (h: string): [number, number, number] => {
  let s = h.replace('#', '');
  if (s.length === 3 || s.length === 4) s = s.slice(0, 3).split('').map((c) => c + c).join('');
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
/** Mix two hex colours (3- or 6-digit). t=0 -> a, t=1 -> b. */
export const mixHex = (a: string, b: string, t: number) => {
  const A = parseHex(a), B = parseHex(b);
  return toHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
};
export const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${clamp(alpha)})`;
};

// ---------- geometry ----------
/** Evaluate a cubic bezier at t. */
export const bez = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};
/** Point along a polyline (array of [x,y]) at fraction t, by arc length. */
export const along = (pts: [number, number][], t: number): [number, number, number] => {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let target = clamp(t) * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const k = seg[i] === 0 ? 0 : target / seg[i];
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      return [lerp(x0, x1, k), lerp(y0, y1, k), Math.atan2(y1 - y0, x1 - x0)];
    }
    target -= seg[i];
  }
  const l = pts[pts.length - 1];
  return [l[0], l[1], 0];
};
/** Sample a smooth path through points (Catmull-Rom) into a dense polyline. */
export const catmull = (pts: [number, number][], samplesPerSeg = 16): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};
/** SVG path "d" from points, smoothed with Catmull-Rom -> cubic beziers. */
export const smoothPath = (pts: [number, number][], closed = false) => {
  if (pts.length < 2) return '';
  const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${P[1][0].toFixed(1)},${P[1][1].toFixed(1)}`;
  for (let i = 1; i < P.length - 2; i++) {
    const [x0, y0] = P[i - 1], [x1, y1] = P[i], [x2, y2] = P[i + 1], [x3, y3] = P[i + 2];
    const c1x = x1 + (x2 - x0) / 6, c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6, c2y = y2 - (y3 - y1) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  return closed ? d + ' Z' : d;
};
/** Wobbly closed blob around (cx,cy): organic cell outlines. */
export const blob = (cx: number, cy: number, r: number, seed: number, amt = 0.12, n = 9, phase = 0) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + amt * noise1(i * 1.7 + phase, seed);
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
  }
  return smoothPath(pts, true);
};

/** Hand-held camera drift in px, deterministic. */
export const handheld = (f: number, amp = 6, speed = 0.02, seed = 1) => ({
  x: wander(f * speed, seed) * amp,
  y: wander(f * speed, seed + 50) * amp,
  r: wander(f * speed * 0.7, seed + 99) * amp * 0.04,
});
