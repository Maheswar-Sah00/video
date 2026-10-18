import React from 'react';
import {C} from '../../lib/palette';
import {blob, clamp, hash, mixHex, rgba, wander} from '../../lib/anim';

/** Sunny city-park kit for S01 (owner: hero). Anime-cel: flat fills, 2–3 tones, ink outlines. */

const n1 = (v: number) => v.toFixed(1);

export const SkyDay: React.FC<{id: string; f: number; sunX: number; sunY: number; glare?: number}> = ({id, f, sunX, sunY, glare = 1}) => (
  <g>
    <defs>
      <linearGradient id={`${id}-sky`} x1={0} y1={0} x2={0} y2={1}>
        <stop offset={0} stopColor={C.skyTop} />
        <stop offset={0.45} stopColor={C.sky} />
        <stop offset={0.8} stopColor={C.skyLow} />
        <stop offset={1} stopColor={mixHex(C.skyLow, C.sunGlow, 0.3)} />
      </linearGradient>
      <radialGradient id={`${id}-sun`} cx={sunX} cy={sunY} r={900} gradientUnits="userSpaceOnUse">
        <stop offset={0} stopColor={C.sun} stopOpacity={1} />
        <stop offset={0.08} stopColor={C.sun} stopOpacity={0.95} />
        <stop offset={0.22} stopColor={C.sunGlow} stopOpacity={0.55} />
        <stop offset={0.55} stopColor={C.sunGlow} stopOpacity={0.12} />
        <stop offset={1} stopColor={C.sunGlow} stopOpacity={0} />
      </radialGradient>
    </defs>
    <rect x={-400} y={-400} width={1880} height={2720} fill={`url(#${id}-sky)`} />
    <rect x={-400} y={-400} width={1880} height={2720} fill={`url(#${id}-sun)`} opacity={glare * (0.92 + 0.08 * Math.sin(f * 0.07))} />
  </g>
);

/** Sun rays fanning from the sun (soft wedges), slowly rotating. */
export const SunRays: React.FC<{f: number; x: number; y: number; o?: number}> = ({f, x, y, o = 1}) => {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const a = 0.15 + i * 0.19 + Math.sin(f * 0.01 + i) * 0.03 + f * 0.0015;
    const w = 0.035 + 0.03 * hash(i, 3);
    const L = 1500 + 400 * hash(i, 5);
    const x1 = x + Math.cos(a - w) * L, y1 = y + Math.sin(a - w) * L;
    const x2 = x + Math.cos(a + w) * L, y2 = y + Math.sin(a + w) * L;
    out.push(<path key={i} d={`M${n1(x)},${n1(y)} L${n1(x1)},${n1(y1)} L${n1(x2)},${n1(y2)} Z`} fill={C.sun} opacity={o * (0.05 + 0.05 * (0.5 + 0.5 * Math.sin(f * 0.05 + i * 1.7)))} />);
  }
  return <g>{out}</g>;
};

export const Cloud: React.FC<{x: number; y: number; s: number; seed: number; f: number; o?: number}> = ({x, y, s, seed, f, o = 1}) => {
  const puffs: [number, number, number][] = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const px = (t - 0.5) * 360;
    const py = -Math.sin(Math.PI * t) * 60 * (0.7 + 0.6 * hash(i, seed)) + 10;
    puffs.push([px, py, 60 + 50 * Math.sin(Math.PI * t) * (0.6 + 0.6 * hash(i, seed + 1))]);
  }
  const body = puffs.map(([px, py, r], i) => blob(px, py, r, seed * 13 + i, 0.08, 9, f * 0.004));
  return (
    <g transform={`translate(${n1(x)},${n1(y)}) scale(${s})`} opacity={o}>
      {body.map((d, i) => (
        <path key={`s${i}`} d={d} fill={C.cloudShade} transform="translate(10,16)" />
      ))}
      {body.map((d, i) => (
        <path key={`b${i}`} d={d} fill={C.cloud} />
      ))}
      <path d={`M-170,40 Q0,70 170,40`} fill="none" stroke={C.cloudShade} strokeWidth={10} opacity={0.6} />
    </g>
  );
};

/** A glass tower: flat cel faces, window grid, sky reflection streak. (x = left, base y = bottom) */
export const Tower: React.FC<{x: number; base: number; w: number; h: number; side?: number; haze?: number; seed?: number; f?: number}> = ({x, base, w, h, side = 0.28, haze = 0, seed = 1, f = 0}) => {
  const top = base - h;
  const sw = w * side;
  const face = mixHex(C.building, C.skyLow, haze);
  const faceL = mixHex(C.buildingLight, C.skyLow, haze);
  const faceS = mixHex(C.buildingShade, C.sky, haze * 0.8);
  let win = '';
  const cols = Math.max(3, Math.round(w / 34));
  const rows = Math.max(6, Math.round(h / 40));
  for (let c = 1; c < cols; c++) win += `M${n1(x + (w * c) / cols)},${n1(top + 18)} L${n1(x + (w * c) / cols)},${n1(base)} `;
  for (let r = 1; r < rows; r++) win += `M${n1(x)},${n1(top + 18 + ((h - 18) * r) / rows)} L${n1(x + w)},${n1(top + 18 + ((h - 18) * r) / rows)} `;
  const glint = 0.5 + 0.5 * Math.sin(f * 0.03 + seed);
  return (
    <g>
      <path d={`M${n1(x + w)},${n1(top + 10)} L${n1(x + w + sw)},${n1(top + 26)} L${n1(x + w + sw)},${n1(base)} L${n1(x + w)},${n1(base)} Z`} fill={faceS} stroke={rgba(C.ink, 0.5 * (1 - haze))} strokeWidth={2.5} />
      <rect x={x} y={top} width={w} height={h} fill={face} stroke={rgba(C.ink, 0.55 * (1 - haze))} strokeWidth={3} />
      <path d={win} stroke={mixHex(faceS, face, 0.4)} strokeWidth={2} opacity={0.75} />
      <path d={`M${n1(x + w * 0.1)},${n1(base)} L${n1(x + w * 0.62)},${n1(top)} L${n1(x + w * 0.86)},${n1(top)} L${n1(x + w * 0.34)},${n1(base)} Z`} fill={faceL} opacity={0.35 + 0.15 * glint} />
      <rect x={x - 6} y={top - 14} width={w + 12} height={16} fill={faceS} stroke={rgba(C.ink, 0.5 * (1 - haze))} strokeWidth={2.5} />
      <path d={`M${n1(x + w * 0.5)},${n1(top - 14)} L${n1(x + w * 0.5)},${n1(top - 90)}`} stroke={faceS} strokeWidth={5} />
    </g>
  );
};

type Clump = {x: number; y: number; r: number; seed: number};
/** Leafy canopy: clumps around (x,y), swaying about the trunk base. Cel: deep / mid / light. */
export const Canopy: React.FC<{f: number; x: number; y: number; s: number; clumps: Clump[]; sway?: number; seed?: number; trunk?: [number, number, number, number]; light?: [number, number]; dim?: number}> = ({
  f,
  x,
  y,
  s,
  clumps,
  sway = 1,
  seed = 1,
  trunk,
  light = [-0.6, -0.8],
  dim = 0,
}) => {
  const k = (c: string) => (dim > 0 ? mixHex(c, C.skyLow, dim) : c);
  return (
    <g transform={`translate(${n1(x)},${n1(y)}) scale(${s})`}>
      {trunk && (
        <path d={`M${trunk[0] - 18},${trunk[3]} Q${trunk[0] - 8},${(trunk[1] + trunk[3]) / 2} ${trunk[2] - 10},${trunk[1]} L${trunk[2] + 10},${trunk[1]} Q${trunk[0] + 10},${(trunk[1] + trunk[3]) / 2} ${trunk[0] + 18},${trunk[3]} Z`} fill={k(C.trunk)} stroke={rgba(C.ink, 0.7 * (1 - dim))} strokeWidth={3} />
      )}
      {clumps.map((c, i) => {
        const sw = sway * (wander(f * 0.03 + i * 0.7, seed + i) * 6 + Math.sin(f * 0.06 + i) * 3);
        const cx = c.x + sw * (1 + Math.abs(c.y) / 300), cy = c.y + sw * 0.2;
        const d = blob(cx, cy, c.r, c.seed, 0.16, 11, f * 0.01);
        const d2 = blob(cx + light[0] * c.r * 0.22, cy + light[1] * c.r * 0.22, c.r * 0.8, c.seed + 3, 0.18, 10, f * 0.012);
        const d3 = blob(cx + light[0] * c.r * 0.42, cy + light[1] * c.r * 0.42, c.r * 0.42, c.seed + 7, 0.22, 9, f * 0.015);
        return (
          <g key={i}>
            <path d={d} fill={k(C.leafDeep)} stroke={rgba(C.ink, 0.65 * (1 - dim))} strokeWidth={3} />
            <path d={d2} fill={k(C.leaf)} />
            <path d={d3} fill={k(C.leafLight)} opacity={0.9} />
            <path d={blob(cx - light[0] * c.r * 0.3, cy - light[1] * c.r * 0.3, c.r * 0.5, c.seed + 11, 0.2, 8, 0)} fill={k(C.leafDark)} opacity={0.35} />
          </g>
        );
      })}
    </g>
  );
};

/** Falling / drifting leaves at several depths (depth z: 0.5 far .. 2 near). */
export const DriftLeaves: React.FC<{f: number; n?: number; seed?: number; zMin?: number; zMax?: number; wind?: number; camX?: number; camY?: number}> = ({f, n = 12, seed = 1, zMin = 0.6, zMax = 2, wind = 1, camX = 0, camY = 0}) => {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const z = zMin + hash(i, seed) * (zMax - zMin);
    const vx = (1.6 + 1.2 * hash(i, seed + 1)) * wind * z;
    const vy = (0.7 + 0.6 * hash(i, seed + 2)) * z;
    const W = 1400;
    const x = ((((hash(i, seed + 3) * W + vx * f + camX * z + wander(f * 0.02 + i, seed + 4) * 60 * z) % W) + W) % W) - 160;
    const y = ((((hash(i, seed + 5) * 2100 + vy * f + camY * z) % 2100) + 2100) % 2100) - 90;
    const r = 9 * z;
    const rot = f * (2 + 4 * hash(i, seed + 6)) * (i % 2 ? 1 : -1) + i * 50;
    const flip = Math.cos(f * 0.1 + i);
    const near = z > 1.5;
    out.push(
      <g key={i} transform={`translate(${n1(x)},${n1(y)}) rotate(${n1(rot)}) scale(${n1(Math.max(0.15, Math.abs(flip)))},1)`} opacity={near ? 0.55 : 0.9}>
        <path d={`M${-r * 1.6},0 Q0,${-r} ${r * 1.6},0 Q0,${r} ${-r * 1.6},0 Z`} fill={i % 3 === 0 ? C.leafLight : i % 3 === 1 ? C.leaf : mixHex(C.leafLight, C.sunGlow, 0.4)} stroke={near ? 'none' : rgba(C.ink, 0.6)} strokeWidth={2} />
        <path d={`M${-r * 1.4},0 L${r * 1.4},0`} stroke={C.leafDeep} strokeWidth={1.5} opacity={0.7} />
      </g>,
    );
  }
  return <g>{out}</g>;
};

/** Sunlit dust / pollen motes. */
export const Motes: React.FC<{f: number; n?: number; seed?: number; x0?: number; y0?: number; w?: number; h?: number; o?: number}> = ({f, n = 30, seed = 3, x0 = 0, y0 = 0, w = 1080, h = 1920, o = 1}) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + ((hash(i, seed) * w + f * (0.4 + hash(i, seed + 1)) + wander(f * 0.02 + i, seed) * 30) % w);
    const y = y0 + ((hash(i, seed + 2) * h - f * (0.3 + 0.4 * hash(i, seed + 3)) + h * 10) % h);
    const r = 1.5 + 2.5 * hash(i, seed + 4);
    d += `M${n1(x - r)},${n1(y)} a${n1(r)},${n1(r)} 0 1,0 ${n1(2 * r)},0 a${n1(r)},${n1(r)} 0 1,0 ${n1(-2 * r)},0 `;
  }
  return <path d={d} fill={C.sun} opacity={o * clamp(0.55 + 0.25 * Math.sin(f * 0.08))} />;
};
