import {C} from '../../lib/palette';
import {clamp, mixHex} from '../../lib/anim';

/** Keyframes with smooth (Catmull-Rom / Hermite) interpolation: continuous velocity through the
 *  keys, so camera moves glide instead of stopping at every key. ks sorted by frame. */
export const smoothKeys = (f: number, ks: [number, number][]) => {
  if (f <= ks[0][0]) return ks[0][1];
  const n = ks.length;
  if (f >= ks[n - 1][0]) return ks[n - 1][1];
  let i = 0;
  while (i < n - 2 && f > ks[i + 1][0]) i++;
  const [t0, v0] = ks[i];
  const [t1, v1] = ks[i + 1];
  const h = t1 - t0;
  const slope = (a: number, b: number) => (ks[b][1] - ks[a][1]) / Math.max(1e-6, ks[b][0] - ks[a][0]);
  // tangents (zero at the ends)
  const m0 = i === 0 ? 0 : slope(i - 1, i + 1);
  const m1 = i + 1 === n - 1 ? 0 : slope(i, i + 2);
  const t = (f - t0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * h * m1;
};

/** Integrate a per-frame speed from frame a to frame b (sum, unit steps + fractional tail). */
export const integ = (speed: (f: number) => number, a: number, b: number) => {
  let s = 0;
  let f = a;
  for (; f + 1 <= b; f++) s += speed(f + 0.5);
  if (b > f) s += speed((f + b) / 2) * (b - f);
  return s;
};

const SW = [C.urine0, C.urine1, C.urine2, C.urine3, C.urine4];
/** Urine colour at a continuous chart level (0 pale straw … 4 brown). */
export const urineAt = (level: number) => {
  const l = clamp(level, 0, 4);
  const i = Math.min(3, Math.floor(l));
  return mixHex(SW[i], SW[i + 1], l - i);
};
