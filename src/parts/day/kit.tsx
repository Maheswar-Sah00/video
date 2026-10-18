import React from 'react';
import {C} from '../../lib/palette';
import {clamp, hash, noise1, rgba} from '../../lib/anim';

/** day builder's private drawing kit (S07 desk, S10 bathroom, S11 street). */

export const n1 = (v: number) => v.toFixed(1);
export const ink = (o = 0.92) => rgba(C.ink, o);

/** A cel-shaded shape: hard shadow tone everywhere, the lit tone = the shape shifted toward the
 *  key light (so a hard shadow band sits on the far side), optional rim band, bold ink outline. */
export const Cel: React.FC<{
  id: string;
  d: string;
  lit: string;
  shade: string;
  rim?: string;
  L?: [number, number]; // direction toward the light (unit)
  k?: number; // band width px
  inkW?: number;
  inkCol?: string;
  children?: React.ReactNode;
  opacity?: number;
}> = ({id, d, lit, shade, rim, L = [-0.62, -0.78], k = 14, inkW = 4, inkCol, children, opacity = 1}) => (
  <g opacity={opacity}>
    <defs>
      <clipPath id={`${id}-c`}>
        <path d={d} />
      </clipPath>
    </defs>
    <g clipPath={`url(#${id}-c)`}>
      <path d={d} fill={shade} />
      <path d={d} fill={lit} transform={`translate(${n1(L[0] * k)},${n1(L[1] * k)})`} />
      {rim && <path d={d} fill="none" stroke={rim} strokeWidth={k * 0.7} transform={`translate(${n1(-L[0] * k * 0.3)},${n1(-L[1] * k * 0.3)})`} opacity={0.55} />}
      {children}
    </g>
    {inkW > 0 && <path d={d} fill="none" stroke={inkCol ?? ink()} strokeWidth={inkW} strokeLinejoin="round" strokeLinecap="round" />}
  </g>
);

/** Drifting, twinkling motes (dust in sunbeams, heat specks) as three paths (opacity buckets). */
export const Motes: React.FC<{
  f: number;
  seed: number;
  n: number;
  x: number;
  y: number;
  w: number;
  h: number;
  r?: [number, number];
  vx?: number;
  vy?: number;
  color: string;
  opacity?: number;
}> = ({f, seed, n, x, y, w, h, r = [1.2, 3.4], vx = 0.25, vy = -0.18, color, opacity = 0.8}) => {
  const d = ['', '', ''];
  for (let i = 0; i < n; i++) {
    const sp = 0.5 + hash(i, seed + 3);
    const px = x + ((((hash(i, seed) * w + f * vx * sp + noise1(f * 0.02 + i, seed) * 26) % w) + w) % w);
    const py = y + ((((hash(i, seed + 1) * h + f * vy * sp + noise1(f * 0.017 + i * 1.3, seed + 7) * 22) % h) + h) % h);
    const rr = r[0] + (r[1] - r[0]) * hash(i, seed + 2);
    const b = Math.floor(hash(i, seed + 5) * 3 + f * 0.02 * (0.5 + hash(i, seed + 6))) % 3;
    d[b] += `M${n1(px - rr)},${n1(py)} a${n1(rr)},${n1(rr)} 0 1,0 ${n1(2 * rr)},0 a${n1(rr)},${n1(rr)} 0 1,0 ${n1(-2 * rr)},0 `;
  }
  return (
    <g>
      <path d={d[0]} fill={color} opacity={opacity} />
      <path d={d[1]} fill={color} opacity={opacity * 0.55} />
      <path d={d[2]} fill={color} opacity={opacity * 0.25} />
    </g>
  );
};

/** Soft light beams from an origin (sun through a window): widening quads fading along their length. */
export const Beams: React.FC<{
  id: string;
  f: number;
  ox: number;
  oy: number;
  ang: number; // deg, direction of travel (0 = right, 90 = down)
  len: number;
  beams: [number, number, number, number][]; // [offset across, width at start, width at end, alpha]
  color: string;
  seed?: number;
}> = ({id, f, ox, oy, ang, len, beams, color, seed = 1}) => {
  const a = (ang * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const px = -dy, py = dx;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-bm`} gradientUnits="userSpaceOnUse" x1={ox} y1={oy} x2={ox + dx * len} y2={oy + dy * len}>
          <stop offset={0} stopColor={color} stopOpacity={0.9} />
          <stop offset={0.55} stopColor={color} stopOpacity={0.35} />
          <stop offset={1} stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {beams.map(([o, w0, w1, al], i) => {
        const sh = clamp(al * (0.75 + 0.25 * noise1(f * 0.03 + i * 3.1, seed + i)) , 0, 1);
        const sx = ox + px * o, sy = oy + py * o;
        const ex = sx + dx * len, ey = sy + dy * len;
        const d = `M${n1(sx - px * w0 / 2)},${n1(sy - py * w0 / 2)} L${n1(sx + px * w0 / 2)},${n1(sy + py * w0 / 2)} L${n1(ex + px * w1 / 2)},${n1(ey + py * w1 / 2)} L${n1(ex - px * w1 / 2)},${n1(ey - py * w1 / 2)} Z`;
        return <path key={i} d={d} fill={`url(#${id}-bm)`} opacity={sh} />;
      })}
    </g>
  );
};

/** Soft radial glow (no blur filter). */
export const Glow: React.FC<{id: string; x: number; y: number; r: number; color: string; a?: number; rx?: number; ry?: number}> = ({id, x, y, r, color, a = 1, rx, ry}) => (
  <g>
    <defs>
      <radialGradient id={`${id}-g`}>
        <stop offset={0} stopColor={color} stopOpacity={a} />
        <stop offset={0.45} stopColor={color} stopOpacity={a * 0.38} />
        <stop offset={1} stopColor={color} stopOpacity={0} />
      </radialGradient>
    </defs>
    <ellipse cx={x} cy={y} rx={rx ?? r} ry={ry ?? r} fill={`url(#${id}-g)`} />
  </g>
);

/** Layered parallax camera: same focus/screen point, scale + drift attenuated by depth k. */
export const layerTf = (F: [number, number], T: [number, number], s: number, k: number, drift: [number, number] = [0, 0], rot = 0) => {
  const sk = 1 + (s - 1) * k;
  const tx = T[0] + drift[0] * k, ty = T[1] + drift[1] * k;
  return `translate(${n1(tx)},${n1(ty)}) rotate(${n1(rot * k)}) scale(${sk.toFixed(4)}) translate(${n1(-F[0])},${n1(-F[1])})`;
};
/** Where world point p (on a layer of depth k) lands on screen. */
export const layerPt = (p: {x: number; y: number}, F: [number, number], T: [number, number], s: number, k: number, drift: [number, number] = [0, 0]) => {
  const sk = 1 + (s - 1) * k;
  return {x: T[0] + drift[0] * k + (p.x - F[0]) * sk, y: T[1] + drift[1] * k + (p.y - F[1]) * sk};
};

/** Leafy potted plant (leaves sway with lag per leaf). (x,y) = bottom centre of the pot. */
export const PottedPlant: React.FC<{id: string; f: number; x: number; y: number; s?: number; seed?: number; leaves?: number; potCol?: string; L?: [number, number]}> = ({
  id,
  f,
  x,
  y,
  s = 1,
  seed = 1,
  leaves = 9,
  potCol = C.awning,
  L = [-0.62, -0.78],
}) => {
  const els: React.ReactNode[] = [];
  for (let i = 0; i < leaves; i++) {
    const t = i / Math.max(1, leaves - 1);
    const base = -70 + 140 * t + (hash(i, seed) - 0.5) * 18;
    const sway = noise1(f * 0.035 - i * 0.25, seed + i) * 6 + Math.sin(f * 0.05 + i) * 2;
    const len = (150 + 90 * hash(i, seed + 1)) * (1 - Math.abs(t - 0.5) * 0.5);
    const ang = base + sway;
    const col = i % 3 === 0 ? C.plantDeep : i % 3 === 1 ? C.plant : C.leafLight;
    const w = 34 + 14 * hash(i, seed + 2);
    const d = `M0,0 C${n1(-w)},${n1(-len * 0.3)} ${n1(-w * 0.8)},${n1(-len * 0.8)} 0,${n1(-len)} C${n1(w * 0.8)},${n1(-len * 0.8)} ${n1(w)},${n1(-len * 0.3)} 0,0 Z`;
    els.push(
      <g key={i} transform={`rotate(${n1(ang)})`}>
        <path d={d} fill={col} stroke={ink()} strokeWidth={3.5 / s} strokeLinejoin="round" />
        <path d={`M0,-6 Q${n1(w * 0.12)},${n1(-len * 0.5)} 0,${n1(-len * 0.92)}`} fill="none" stroke={C.plantDeep} strokeWidth={3 / s} opacity={0.7} />
        <path d={`M${n1(-w * 0.55)},${n1(-len * 0.4)} Q${n1(-w * 0.5)},${n1(-len * 0.7)} ${n1(-w * 0.15)},${n1(-len * 0.88)}`} fill="none" stroke={C.leafLight} strokeWidth={4 / s} opacity={0.5} />
      </g>,
    );
  }
  const pot = `M-74,-110 L74,-110 L60,0 L-60,0 Z`;
  return (
    <g transform={`translate(${n1(x)},${n1(y)}) scale(${s})`}>
      <g transform="translate(0,-104)">{els}</g>
      <Cel id={`${id}-pot`} d={pot} lit={potCol} shade={C.painDeep} L={L} k={16} inkW={4 / s} />
      <rect x={-82} y={-124} width={164} height={24} rx={6} fill={potCol} stroke={ink()} strokeWidth={4 / s} />
    </g>
  );
};

/** Row of book spines standing on a shelf (x,y = bottom-left on the board). */
export const BookRow: React.FC<{x: number; y: number; w: number; seed: number; tilt?: number}> = ({x, y, w, seed, tilt = 0}) => {
  const cols = [C.jeans, C.painDeep, C.wardTeal, C.lampGlow, C.leafDeep, C.cream, C.duskMid, C.hoodieLight];
  const out: React.ReactNode[] = [];
  let xx = x;
  let i = 0;
  while (xx < x + w - 20) {
    const bw = 22 + 22 * hash(i, seed);
    const bh = 110 + 60 * hash(i, seed + 1);
    const col = cols[Math.floor(hash(i, seed + 2) * cols.length)];
    const lean = i === 3 && tilt ? tilt : 0;
    out.push(
      <g key={i} transform={lean ? `rotate(${lean},${n1(xx + bw)},${y})` : undefined}>
        <rect x={n1(xx)} y={n1(y - bh)} width={n1(bw)} height={n1(bh)} rx={3} fill={col} stroke={ink()} strokeWidth={3.5} />
        <rect x={n1(xx + bw * 0.62)} y={n1(y - bh + 4)} width={n1(bw * 0.3)} height={n1(bh - 8)} fill="#000" opacity={0.16} />
        <path d={`M${n1(xx + 4)},${n1(y - bh * 0.78)} h${n1(bw - 8)} M${n1(xx + 4)},${n1(y - bh * 0.22)} h${n1(bw - 8)}`} stroke={C.cream} strokeWidth={3} opacity={0.55} />
      </g>,
    );
    xx += bw + 2 + (lean ? 8 : 0);
    i++;
  }
  return <g>{out}</g>;
};
