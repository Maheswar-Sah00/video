import React, {useMemo} from 'react';
import {C} from './palette';
import {clamp, lerp, rgba, rng} from './anim';
import {EV} from './sync';

const fx = (n: number) => n.toFixed(1);

/** Dark navy medical backdrop: radial depth gradient, drifting faint grid (slow layer), drifting
 *  particles in two depth layers (mid + near, faster), soft breathing glow pools. Full 1080×1920. */
export const MedBg: React.FC<{f: number; id: string; seed?: number; tint?: string; glow?: [number, number, string][]; drift?: number; xray?: boolean}> = ({
  f,
  id,
  seed = 1,
  tint = C.medBgLight,
  glow = [],
  drift = 1,
  xray = false,
}) => {
  const parts = useMemo(() => {
    const r = rng(seed * 97 + 3);
    return Array.from({length: 70}, (_, i) => ({x: r() * 1080, y: r() * 1920, s: 0.6 + r() * 2.2, v: 0.25 + r() * 0.8, ph: r() * 6.28, near: i % 5 === 0}));
  }, [seed]);
  const gy = (f * 0.35 * drift) % 60;
  const gx = (f * 0.12 * drift) % 60;
  let far = '';
  let near = '';
  for (const p of parts) {
    const yy = (((p.y - f * p.v * drift * (p.near ? 2.2 : 1)) % 1920) + 1920) % 1920;
    const xx = p.x + Math.sin(f * 0.02 + p.ph) * 12;
    const r = p.near ? p.s * 2.2 : p.s;
    const seg = `M${fx(xx - r)},${fx(yy)} a${fx(r)},${fx(r)} 0 1,0 ${fx(2 * r)},0 a${fx(r)},${fx(r)} 0 1,0 ${fx(-2 * r)},0 `;
    if (p.near) near += seg;
    else far += seg;
  }
  let grid = '';
  for (let x = -60; x <= 1140; x += 60) grid += `M${fx(x + gx)},0 L${fx(x + gx)},1920 `;
  for (let y = -60; y <= 1980; y += 60) grid += `M0,${fx(y + gy)} L1080,${fx(y + gy)} `;
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor={tint} />
          <stop offset="65%" stopColor={C.medBg} />
          <stop offset="100%" stopColor={C.navyDeep} />
        </radialGradient>
        {glow.map(([, , col], i) => (
          <radialGradient key={i} id={`${id}-pool${i}`}>
            <stop offset="0%" stopColor={col} stopOpacity={0.22} />
            <stop offset="55%" stopColor={col} stopOpacity={0.08} />
            <stop offset="100%" stopColor={col} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>
      <rect width={1080} height={1920} fill={`url(#${id}-bg)`} />
      <path d={grid} stroke={rgba(C.medGrid, xray ? 0.22 : 0.14)} strokeWidth={1} />
      {glow.map(([gx2, gy2], i) => (
        <circle key={i} cx={gx2} cy={gy2} r={460 + 50 * Math.sin(f * 0.05 + i)} fill={`url(#${id}-pool${i})`} opacity={0.8 + 0.2 * Math.sin(f * 0.07 + i * 2)} />
      ))}
      <path d={far} fill={rgba(C.bodyGhostLight, 0.28)} />
      <path d={near} fill={rgba(C.bodyGhostLight, 0.14)} />
    </g>
  );
};

/** ECG / bedside-monitor trace driven by EV.beats (the heartbeats: S08 S15 S16): a sweeping monitor line across the frame. abs = absolute frame. */
export const Ecg: React.FC<{abs: number; y: number; h?: number; x0?: number; x1?: number; color?: string; span?: number; opacity?: number; plate?: boolean}> = ({
  abs,
  y,
  h = 70,
  x0 = 40,
  x1 = 1040,
  color = C.bloodLight,
  span = 75,
  opacity = 1,
  plate = true,
}) => {
  const n = 160;
  const pts: string[] = [];
  const beats = EV.beats.map((b) => ({f: b, amp: 1}));
  const val = (t: number) => {
    let v = 0;
    for (const b of beats) {
      const d = t - b.f;
      if (d < -6 || d > 10) continue;
      const a = 0.35 + 0.65 * b.amp;
      v += a * (-0.18 * Math.exp(-Math.pow((d + 1.2) / 0.5, 2)) + 1.0 * Math.exp(-Math.pow(d / 0.45, 2)) - 0.3 * Math.exp(-Math.pow((d - 0.9) / 0.5, 2)) + 0.22 * Math.exp(-Math.pow((d - 5) / 1.6, 2)));
    }
    return v;
  };
  for (let i = 0; i <= n; i++) {
    const t = abs - span + (span * i) / n;
    const xx = lerp(x0, x1, i / n);
    pts.push(`${i ? 'L' : 'M'}${fx(xx)},${fx(y - val(t) * h)}`);
  }
  const d = pts.join(' ');
  return (
    <g opacity={opacity}>
      {plate && <rect x={x0 - 20} y={y - h * 1.35} width={x1 - x0 + 40} height={h * 1.9} rx={14} fill={rgba(C.navyDeep, 0.55)} stroke={rgba(C.medGrid, 0.6)} strokeWidth={1.5} />}
      <path d={`M${x0},${y} L${x1},${y}`} stroke={rgba(C.medGrid, 0.5)} strokeWidth={1} strokeDasharray="4 8" />
      <path d={d} fill="none" stroke={rgba(color, 0.3)} strokeWidth={9} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={x1} cy={y - val(abs) * h} r={7} fill="#fff" />
      <circle cx={x1} cy={y - val(abs) * h} r={16} fill={rgba(color, 0.35)} />
    </g>
  );
};

/** Camera: maps world point `focus` to screen point `to` at scale s (rotate deg about it). */
export const camTf = (focus: [number, number], to: [number, number], s: number, rot = 0) =>
  `translate(${fx(to[0])},${fx(to[1])}) rotate(${fx(rot)}) scale(${fx(s)}) translate(${fx(-focus[0])},${fx(-focus[1])})`;

/** Damped spring response (0 before t0): overshoot + settle. */
export const spring = (t: number, freq = 0.3, decay = 12) => (t < 0 ? 0 : 1 - Math.exp(-t / decay) * Math.cos(t * freq));
/** Damped oscillation impulse (0 at t0, swings then settles to 0). */
export const wobble = (t: number, freq = 0.3, decay = 12) => (t < 0 ? 0 : Math.exp(-t / decay) * Math.sin(t * freq));

export const clamp01 = clamp;

/** Where a world point lands on screen under camTf(focus, to, s, rot) (for screen-space labels). */
export const camPt = (p: {x: number; y: number}, focus: [number, number], to: [number, number], s: number, rot = 0) => {
  const a = (rot * Math.PI) / 180;
  const dx = (p.x - focus[0]) * s, dy = (p.y - focus[1]) * s;
  return {x: to[0] + dx * Math.cos(a) - dy * Math.sin(a), y: to[1] + dx * Math.sin(a) + dy * Math.cos(a)};
};
