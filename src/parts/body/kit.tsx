import React, {useMemo} from 'react';
import {C} from '../../lib/palette';
import {clamp, ease, ramp, rgba, rng} from '../../lib/anim';
import {MONO, TITLE} from '../../lib/fonts';
import {WaterMolecule} from '../../lib/Cells';

const fx = (n: number) => n.toFixed(1);

/** Holographic floor under the x-ray figure: perspective grid + glowing rings (screen coords). */
export const HoloFloor: React.FC<{f: number; id: string; cx: number; cy: number; w?: number; glow?: number; color?: string}> = ({f, id, cx, cy, w = 520, glow = 1, color = C.water}) => {
  const rings = [0, 1, 2].map((i) => ((f * 0.012 + i / 3) % 1));
  let grid = '';
  for (let i = -8; i <= 8; i++) grid += `M${fx(cx + i * w * 0.09)},${fx(cy)} L${fx(cx + i * w * 0.2)},${fx(cy + 260)} `;
  for (let j = 0; j < 6; j++) {
    const yy = cy + Math.pow(j / 5, 1.6) * 260 + ((f * 0.6) % 12) * (j / 5);
    const ww = w * (0.8 + 0.9 * (j / 5));
    grid += `M${fx(cx - ww)},${fx(yy)} L${fx(cx + ww)},${fx(yy)} `;
  }
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-fl`}>
          <stop offset="0%" stopColor={color} stopOpacity={0.45 * glow} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-flg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id={`${id}-flm`} maskUnits="userSpaceOnUse" x={0} y={cy - 20} width={1080} height={320}>
          <rect x={0} y={cy - 20} width={1080} height={320} fill={`url(#${id}-flg)`} />
        </mask>
      </defs>
      <ellipse cx={cx} cy={cy + 10} rx={w} ry={w * 0.22} fill={`url(#${id}-fl)`} />
      <path d={grid} stroke={rgba(C.bodyGhostLight, 0.18)} strokeWidth={1.3} mask={`url(#${id}-flm)`} />
      {rings.map((t, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={w * (0.2 + 0.8 * t)} ry={w * 0.06 * (0.2 + 0.8 * t)} fill="none" stroke={rgba(C.waterLight, 0.5 * (1 - t) * glow)} strokeWidth={2} />
      ))}
      <ellipse cx={cx} cy={cy} rx={w * 0.34} ry={w * 0.05} fill="none" stroke={rgba(C.waterLight, 0.75 * glow)} strokeWidth={3} />
    </g>
  );
};

/** Big out-of-focus foreground water molecules drifting past (the near depth layer). */
export const FgMolecules: React.FC<{f: number; id: string; seed?: number; n?: number; speed?: number; opacity?: number; blur?: number}> = ({
  f,
  id,
  seed = 3,
  n = 5,
  speed = 1,
  opacity = 0.45,
  blur = 5,
}) => {
  const ms = useMemo(() => {
    const r = rng(seed * 31 + 7);
    return Array.from({length: n}, (_, i) => ({
      x: i % 2 === 0 ? 30 + r() * 180 : 880 + r() * 180,
      y: r() * 1920,
      r: 26 + r() * 26,
      v: 0.9 + r() * 1.2,
      ph: r() * 6.28,
      s: r() < 0.5 ? -1 : 1,
    }));
  }, [seed, n]);
  return (
    <g opacity={opacity}>
      <defs>
        <filter id={`${id}-fgb`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={blur} />
        </filter>
      </defs>
      <g filter={`url(#${id}-fgb)`}>
        {ms.map((m, i) => {
          const yy = ((((m.y - f * m.v * 2.2 * speed) % 2100) + 2100) % 2100) - 90;
          return <WaterMolecule key={i} x={m.x + 30 * Math.sin(f * 0.02 + m.ph)} y={yy} r={m.r} rot={f * 0.6 * m.s + m.ph * 40} glow={0.4} />;
        })}
      </g>
    </g>
  );
};

/** Mid-depth small molecules + glints drifting (sharper, slower). */
export const MidMolecules: React.FC<{f: number; seed?: number; n?: number; opacity?: number; region?: [number, number, number, number]}> = ({
  f,
  seed = 5,
  n = 10,
  opacity = 0.7,
  region = [0, 0, 1080, 1920],
}) => {
  const ms = useMemo(() => {
    const r = rng(seed * 13 + 1);
    return Array.from({length: n}, () => ({x: r(), y: r(), r: 7 + r() * 7, v: 0.3 + r() * 0.6, ph: r() * 6.28, s: r() < 0.5 ? -1 : 1}));
  }, [seed, n]);
  const [x0, y0, w, h] = region;
  return (
    <g opacity={opacity}>
      {ms.map((m, i) => {
        const yy = y0 + ((((m.y * h - f * m.v) % h) + h) % h);
        const xx = x0 + m.x * w + 14 * Math.sin(f * 0.025 + m.ph);
        return <WaterMolecule key={i} x={xx} y={yy} r={m.r} rot={f * 0.9 * m.s + m.ph * 50} glow={0.5} />;
      })}
    </g>
  );
};

/** Vertical measuring scale (screen coords): ticks every 5 %, numbers every 20 %. */
export const Ruler: React.FC<{x: number; y0: number; y1: number; f: number; opacity?: number; hi?: number; side?: 1 | -1; labels?: boolean}> = ({x, y0, y1, f, opacity = 1, hi, side = 1, labels = true}) => {
  let ticks = '';
  for (let i = 0; i <= 20; i++) {
    const yy = y0 + (y1 - y0) * (i / 20);
    const L = i % 4 === 0 ? 26 : i % 2 === 0 ? 16 : 9;
    ticks += `M${fx(x)},${fx(yy)} L${fx(x + side * L)},${fx(yy)} `;
  }
  return (
    <g opacity={opacity}>
      <line x1={x} y1={y0} x2={x} y2={y1} stroke={rgba(C.bodyGhostLight, 0.45)} strokeWidth={2} />
      <path d={ticks} stroke={rgba(C.bodyGhostLight, 0.55)} strokeWidth={2} />
      {(!labels ? [] : hi !== undefined ? [0, 20, 40, 80, 100] : [0, 20, 40, 60, 80, 100]).map((v) => {
        const yy = y0 + (y1 - y0) * (v / 100);
        return (
          <text key={v} x={x + side * 34} y={yy + 8} textAnchor={side > 0 ? 'start' : 'end'} fontFamily={MONO} fontWeight={500} fontSize={22} fill={rgba(C.bodyGhostLight, v === 60 && hi ? 0.5 + 0.5 * hi : 0.55)}>
            {v}
          </text>
        );
      })}
      <circle cx={x} cy={y0 + (y1 - y0) * ((f * 0.004) % 1)} r={3} fill={C.waterLight} />
    </g>
  );
};

/** Pill tag with a leader dot (one combined tag system for S04): pops with overshoot. */
export const Tag: React.FC<{
  f: number;
  from: number;
  to: number;
  ax: number;
  ay: number;
  x: number;
  y: number;
  text: string;
  sub?: string;
  color?: string;
  align?: 'left' | 'right';
  size?: number;
}> = ({f, from, to, ax, ay, x, y, text, sub, color = C.waterLight, align = 'left', size = 40}) => {
  if (f < from - 1 || f > to + 1) return null;
  const t = f - from;
  const pop = ease.outBack(clamp(t / 9));
  const line = ease.outCubic(clamp((t - 2) / 9));
  const out = 1 - ramp(f, to - 8, to, ease.inQuad);
  const tw = text.length * size * 0.56 + 36;
  const sw = sub ? sub.length * size * 0.36 + 36 : 0;
  const w = Math.max(tw, sw);
  const h = size * 1.35 + (sub ? size * 0.7 : 0);
  const left = align === 'left' ? x : x - w;
  const lx = align === 'left' ? left : left + w;
  const ly = y + h / 2;
  return (
    <g opacity={out}>
      <line x1={ax} y1={ay} x2={fx(ax + (lx - ax) * line)} y2={fx(ay + (ly - ay) * line)} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <circle cx={ax} cy={ay} r={14 * pop} fill="none" stroke={color} strokeWidth={3} />
      <circle cx={ax} cy={ay} r={5 * pop} fill={color} />
      <g transform={`translate(${fx(lx)},${fx(ly)}) scale(${fx(pop)}) translate(${fx(-lx)},${fx(-ly)})`}>
        <rect x={left} y={y} width={w} height={h} rx={h * 0.3} fill={rgba(C.navyDeep, 0.78)} stroke={color} strokeWidth={2.5} />
        <text x={left + 18} y={y + size * 1.02} fontFamily={TITLE} fontWeight={700} fontSize={size} letterSpacing={2} fill={C.cream}>
          {text}
        </text>
        {sub && (
          <text x={left + 18} y={y + size * 1.02 + size * 0.68} fontFamily={MONO} fontWeight={600} fontSize={size * 0.5} fill={color}>
            {sub}
          </text>
        )}
      </g>
    </g>
  );
};
