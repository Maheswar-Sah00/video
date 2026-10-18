import React from 'react';
import {catmull, clamp, ease, smoothPath} from '../../lib/anim';
import {EV} from '../../lib/sync';

export type P = [number, number];
export const fx = (n: number) => n.toFixed(1);

/** Extend a polyline by `ext` px past its last point (same direction as the last segment). */
export const extend = (pts: P[], ext: number): P[] => {
  if (ext <= 0 || pts.length < 2) return pts;
  const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [...pts, [b[0] + ((b[0] - a[0]) / l) * ext, b[1] + ((b[1] - a[1]) / l) * ext]];
};

/** Dense polyline + its cumulative lengths (for placing things along a vessel). */
export const sampled = (pts: P[], n = 12) => {
  const s = catmull(pts, n) as P[];
  const L: number[] = [0];
  for (let i = 1; i < s.length; i++) L.push(L[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
  return {s, L, len: L[L.length - 1]};
};
/** Point + direction (radians) at distance d along a sampled polyline. */
export const atLen = (sp: ReturnType<typeof sampled>, d: number): [number, number, number] => {
  const {s, L} = sp;
  const t = clamp(d, 0, sp.len);
  let i = 1;
  while (i < L.length - 1 && L[i] < t) i++;
  const k = (t - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
  const [x0, y0] = s[i - 1];
  const [x1, y1] = s[i];
  return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, Math.atan2(y1 - y0, x1 - x0)];
};

/** Heart mechanics from EV.beats: v = ventricular squeeze (snap in, hold, release with an
 *  overshoot below 0), a = atrial kick just before, p = arterial pressure wave just after. */
export const heartPhase = (abs: number, beats: number[] = EV.beats) => {
  let v = 0;
  let a = 0;
  let p = 0;
  for (const b of beats) {
    const t = abs - b;
    if (t < -7 || t > 28) continue;
    if (t >= 0) v += t < 3 ? ease.outCubic(t / 3) : t < 4.5 ? 1 : Math.exp(-(t - 4.5) / 4.5) * Math.cos((t - 4.5) * 0.34);
    a += Math.exp(-Math.pow((t + 2.6) / 1.5, 2));
    if (t >= 0) p += Math.exp(-Math.pow((t - 3) / 3.2, 2));
  }
  return {v: clamp(v, -0.35, 1.08), a: clamp(a), p: clamp(p)};
};

/** Monotonic "surge" distance: each beat pushes the blood forward one smooth step. */
export const surge = (abs: number, beats: number[] = EV.beats, len = 9) => {
  let s = 0;
  for (const b of beats) {
    if (abs < b) break;
    s += ease.outCubic(clamp((abs - b) / len));
  }
  return s;
};

/** Glossy tube (vessel) drawn as layered strokes; light from the upper-left. */
export const Tube: React.FC<{
  pts: P[];
  w: number;
  base: string;
  deep: string;
  light: string;
  ink?: string;
  inkW?: number;
  gloss?: number;
  opacity?: number;
  cap?: 'round' | 'butt';
}> = ({pts, w, base, deep, light, ink = 'rgba(16,18,26,0.85)', inkW = 2.5, gloss = 1, opacity = 1, cap = 'round'}) => {
  const d = smoothPath(pts);
  const common = {fill: 'none', strokeLinecap: cap, strokeLinejoin: 'round' as const};
  return (
    <g opacity={opacity}>
      <path d={d} stroke={ink} strokeWidth={w + inkW * 2} {...common} />
      <path d={d} stroke={deep} strokeWidth={w} {...common} />
      <path d={d} stroke={base} strokeWidth={w * 0.68} transform={`translate(${fx(-w * 0.1)},${fx(-w * 0.08)})`} {...common} />
      <path d={d} stroke={light} strokeWidth={w * 0.26} transform={`translate(${fx(-w * 0.19)},${fx(-w * 0.15)})`} opacity={0.75 * gloss} {...common} />
      <path d={d} stroke="#ffffff" strokeWidth={Math.max(1, w * 0.07)} transform={`translate(${fx(-w * 0.23)},${fx(-w * 0.19)})`} opacity={0.6 * gloss} {...common} />
    </g>
  );
};

/** Many small circles as ONE path. */
export const dots = (list: {x: number; y: number; r: number}[]) =>
  list.map((p) => `M${fx(p.x - p.r)},${fx(p.y)}a${fx(p.r)},${fx(p.r)} 0 1,0 ${fx(2 * p.r)},0a${fx(p.r)},${fx(p.r)} 0 1,0 ${fx(-2 * p.r)},0`).join('');
