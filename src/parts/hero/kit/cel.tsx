import React from 'react';
import {C} from '../../../lib/palette';
import {clamp, mixHex} from '../../../lib/anim';
import type {Lighting} from '../../../lib/scene';

/**
 * Cel-shading helpers for HIM (owner: hero). The look: a flat lit tone, a hard-edged shadow tone on
 * the side away from the key light, a thin coloured rim band on the far edge, a bold ink outline.
 * Implemented by drawing the shape three times inside its own clip/mask, each copy translated toward
 * the light (no blur filters). Ported from the previous reel's cel kit and re-graded for this reel's
 * lighting vocabulary (lib/scene Lighting: day / hot / bath / dim / night / ward / dusk) and the
 * dehydration grade (`dry` in LookOpts: duller, greyer skin + dull hair).
 */

export type Material = 'skin' | 'hair' | 'hoodie' | 'tee' | 'patient' | 'jeans' | 'backpack' | 'shoe' | 'sole' | 'sleeve';
export type Shade = {lit: string; shade: string; rim: string; L: [number, number]; ink: string; deep: string; k: number};

const BASE: Record<Material, {lit: string; shade: string; rim: string; deep: string}> = {
  skin: {lit: C.skin, shade: C.skinShade, rim: C.skinLight, deep: C.skinDeep},
  hair: {lit: C.hair, shade: C.hairShade, rim: C.hairLight, deep: C.hairShade},
  hoodie: {lit: C.hoodie, shade: C.hoodieShade, rim: C.hoodieLight, deep: mixHex(C.hoodieShade, C.ink, 0.4)},
  sleeve: {lit: C.hoodie, shade: C.hoodieShade, rim: C.hoodieLight, deep: mixHex(C.hoodieShade, C.ink, 0.4)},
  tee: {lit: C.tee, shade: C.teeShade, rim: C.teeLight, deep: mixHex(C.teeShade, C.inkSoft, 0.3)},
  patient: {lit: C.patientTee, shade: C.patientTeeShade, rim: C.patientTeeLight, deep: mixHex(C.patientTeeShade, C.ink, 0.3)},
  jeans: {lit: C.jeans, shade: C.jeansShade, rim: C.jeansLight, deep: mixHex(C.jeansShade, C.ink, 0.3)},
  backpack: {lit: C.backpack, shade: C.backpackShade, rim: C.backpackLight, deep: C.backpackShade},
  shoe: {lit: C.shoe, shade: C.shoeShade, rim: C.sole, deep: mixHex(C.shoeShade, C.inkSoft, 0.4)},
  sole: {lit: C.sole, shade: C.shoeShade, rim: C.sole, deep: C.shoeShade},
};

export type LookOpts = {
  lighting?: Lighting;
  health?: number; // 1 healthy .. 0 very ill (skin only)
  rim?: number; // 0..1 rim strength (band width multiplier, colour intensity)
  /** 0..1 dehydration (this reel): skin duller + greyer (C.skinDry), less glow; hair duller */
  dry?: number;
};

/** Direction TOWARD the key light, screen space (unit). */
export const lightDir = (lighting: Lighting = 'day'): [number, number] => {
  const base: Record<Lighting, [number, number]> = {
    day: [-0.62, -0.78], // sun upper-left
    night: [-0.86, 0.5], // desk lamp left-below
    ward: [0.12, -0.99], // overhead
    dusk: [-0.94, 0.34], // (inverted: low sun on the RIGHT, behind -> "lit" = shadow side, see shadeFor)
    dim: [0.88, -0.3], // window right
    hot: [-0.18, -0.98], // high midday sun, nearly overhead
    bath: [0.05, -0.99], // vanity light above-front
  };
  const a = base[lighting];
  const n = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / n, a[1] / n];
};

/** Shading band offsets per lighting (dusk = mostly shadow with a thin warm edge). */
const KMUL: Record<Lighting, number> = {day: 1, night: 1.1, ward: 0.85, dusk: 0.55, dim: 1.15, hot: 1.35, bath: 0.75};

export const shadeFor = (m: Material, o: LookOpts = {}): Shade => {
  const b = BASE[m];
  let lit = b.lit, shade = b.shade, rim = b.rim, deep = b.deep;
  const lighting = o.lighting ?? 'day';
  const h = clamp(o.health ?? 1);
  if (m === 'skin' && h < 1) {
    const ill = 1 - h;
    lit = mixHex(lit, C.skinPale, 0.85 * ill);
    shade = mixHex(shade, mixHex(C.skinPale, C.underEye, 0.45), 0.6 * ill);
    deep = mixHex(deep, C.underEye, 0.4 * ill);
    rim = mixHex(rim, C.skinPale, 0.5 * ill);
  }
  if (m === 'hair' && h < 1) {
    lit = mixHex(lit, C.hairLight, 0.12 * (1 - h));
    rim = mixHex(rim, C.inkSoft, 0.45 * (1 - h));
  }
  const dry = clamp(o.dry ?? 0);
  if (m === 'skin' && dry > 0) {
    // dehydrated: dull grey-tan, the warm glow drains out of the lit tone, cooler/greyer shadows
    lit = mixHex(lit, C.skinDry, 0.85 * dry);
    shade = mixHex(shade, mixHex(C.skinDry, C.eyeSunk, 0.42), 0.55 * dry);
    deep = mixHex(deep, C.eyeSunk, 0.35 * dry);
    rim = mixHex(rim, C.skinDry, 0.55 * dry);
  }
  if (m === 'hair' && dry > 0) {
    // dull, dusty: flatter lit tone, the blue sheen fades
    lit = mixHex(lit, mixHex(C.hairLight, C.inkSoft, 0.5), 0.22 * dry);
    rim = mixHex(rim, C.inkSoft, 0.5 * dry);
  }
  if (lighting === 'day') {
    lit = mixHex(lit, C.sunGlow, m === 'hair' ? 0.04 : 0.1);
    shade = mixHex(shade, C.skyTop, m === 'hair' ? 0.05 : 0.1);
    rim = mixHex(rim, C.skyLow, 0.35);
  } else if (lighting === 'night') {
    lit = mixHex(lit, C.lampGlow, m === 'hair' ? 0.1 : 0.26);
    shade = mixHex(shade, C.roomNight, 0.45);
    deep = mixHex(deep, C.roomNight, 0.5);
    rim = mixHex(C.screenGlow, rim, 0.25);
  } else if (lighting === 'ward') {
    lit = mixHex(lit, C.wardWall, m === 'hair' ? 0.05 : 0.08);
    shade = mixHex(shade, C.wardTealDeep, 0.12);
    rim = mixHex(rim, C.wardWall, 0.6);
  } else if (lighting === 'dusk') {
    // backlit by a low sun on screen-right: the body is mostly in violet shadow, a warm band + a hot
    // rim on the sun side (the band layout is inverted via lightDir pointing AWAY from the sun).
    const l0 = lit;
    lit = mixHex(mixHex(shade, C.duskTop, 0.3), C.cityDusk, 0.2);
    shade = mixHex(mixHex(l0, C.duskLow, 0.45), C.duskMid, 0.15);
    rim = mixHex(C.duskSun, C.duskLow, 0.25);
    deep = mixHex(deep, C.duskTop, 0.45);
  } else if (lighting === 'hot') {
    // harsh high midday sun: bleached, almost white-hot highlights on top, crisp deep shadows (the
    // shadow band is wide: light from straight above), a hot orange bounce off the asphalt on the
    // under-edges (the rim band sits on the side away from the light = the bottom edges)
    lit = mixHex(mixHex(lit, C.hotSun, m === 'hair' ? 0.1 : 0.24), C.heatLight, m === 'hair' ? 0 : 0.06);
    shade = mixHex(mixHex(shade, deep, m === 'hair' ? 0.1 : 0.28), C.heatDeep, m === 'hair' ? 0.03 : 0.1);
    deep = mixHex(deep, C.heatDeep, 0.16);
    rim = mixHex(mixHex(rim, C.heat, 0.4), C.heatLight, 0.35);
  } else if (lighting === 'bath') {
    // cool flat vanity light from above-front: clean, slightly clinical whites, cool blue-grey
    // shadows from the tiles, a pale tile-blue bounce on the edges; skin loses some warmth
    lit = mixHex(mixHex(lit, C.bathLight, m === 'hair' ? 0.06 : 0.16), C.mirrorGlass, m === 'hair' ? 0.04 : 0.05);
    shade = mixHex(shade, C.bathTileShade, m === 'hair' ? 0.08 : 0.26);
    deep = mixHex(deep, mixHex(C.bathTileShade, C.inkSoft, 0.4), 0.22);
    rim = mixHex(rim, C.bathTile, 0.65);
  } else if (lighting === 'dim') {
    lit = mixHex(mixHex(lit, C.lampGlow, m === 'hair' ? 0.06 : 0.2), C.duskTop, 0.12);
    shade = mixHex(shade, C.roomNight, 0.5);
    deep = mixHex(deep, C.roomNight, 0.55);
    rim = mixHex(rim, C.duskTop, 0.5);
  }
  const rk = clamp(o.rim ?? 1, 0, 1.5);
  if (rk < 1) rim = mixHex(shade, rim, rk);
  return {lit, shade, rim, L: lightDir(lighting), ink: C.ink, deep, k: KMUL[lighting] * (0.6 + 0.4 * Math.min(1, rk))};
};

const n1 = (v: number) => v.toFixed(1);

/** Closed shape with cel shading (clipPath). k = shadow-band offset px, r = rim-band px. */
export const CelPath: React.FC<{
  id: string;
  d: string;
  sh: Shade;
  k: number;
  r: number;
  inkW: number;
  flat?: boolean;
  children?: React.ReactNode;
  over?: React.ReactNode;
}> = ({id, d, sh, k, r, inkW, flat, children, over}) => {
  const [lx, ly] = sh.L;
  const kk = k * sh.k;
  return (
    <g>
      {flat ? (
        <path d={d} fill={sh.lit} />
      ) : (
        <>
          <clipPath id={id}>
            <path d={d} />
          </clipPath>
          <g clipPath={`url(#${id})`}>
            <path d={d} fill={sh.rim} />
            <path d={d} fill={sh.shade} transform={`translate(${n1(lx * r)},${n1(ly * r)})`} />
            <path d={d} fill={sh.lit} transform={`translate(${n1(lx * kk)},${n1(ly * kk)})`} />
            {children}
          </g>
        </>
      )}
      {flat && children && (
        <>
          <clipPath id={id}>
            <path d={d} />
          </clipPath>
          <g clipPath={`url(#${id})`}>{children}</g>
        </>
      )}
      {inkW > 0 && <path d={d} fill="none" stroke={sh.ink} strokeWidth={inkW} strokeLinejoin="round" />}
      {over}
    </g>
  );
};

export type Seg = {d: string; w: number};

/** Limb drawn as round-capped strokes (handles any bend cleanly), cel shaded through a mask. */
export const CelStrokes: React.FC<{id: string; segs: Seg[]; sh: Shade; inkW: number; flat?: boolean; children?: React.ReactNode; kPx?: number; rPx?: number}> = ({
  id,
  segs,
  sh,
  inkW,
  flat,
  children,
  kPx,
  rPx,
}) => {
  const [lx, ly] = sh.L;
  const wMax = Math.max(...segs.map((s) => s.w));
  const k = (kPx ?? wMax * 0.36) * sh.k, r = rPx ?? wMax * 0.13;
  const strokes = (col: string, extra = 0) =>
    segs.map((s, i) => <path key={i} d={s.d} fill="none" stroke={col} strokeWidth={n1(s.w + extra)} strokeLinecap="round" strokeLinejoin="round" />);
  return (
    <g>
      {inkW > 0 && strokes(sh.ink, inkW * 2)}
      {flat ? (
        strokes(sh.lit)
      ) : (
        <>
          <mask id={id} maskUnits="userSpaceOnUse" x={-6000} y={-6000} width={12000} height={12000}>
            {strokes('#fff')}
          </mask>
          <g mask={`url(#${id})`}>
            {strokes(sh.rim)}
            <g transform={`translate(${n1(lx * r)},${n1(ly * r)})`}>{strokes(sh.shade)}</g>
            <g transform={`translate(${n1(lx * k)},${n1(ly * k)})`}>{strokes(sh.lit)}</g>
            {children}
          </g>
        </>
      )}
    </g>
  );
};

/** Counter-rotate the screen-space key light into a rotated / mirrored local frame. */
export const localShade = (sh: Shade, rotDeg: number, mirror: number): Shade => {
  const r = (-rotDeg * Math.PI) / 180;
  const x = sh.L[0] * Math.cos(r) - sh.L[1] * Math.sin(r);
  const y = sh.L[0] * Math.sin(r) + sh.L[1] * Math.cos(r);
  return {...sh, L: [x * mirror, y]};
};

/** Little 4-point sparkle. */
export const Glint: React.FC<{x: number; y: number; r: number; o: number; col?: string}> = ({x, y, r, o, col = C.eyeShine}) => {
  if (o <= 0.01 || r <= 0.2) return null;
  const k = r * 0.22;
  return (
    <path
      d={`M${n1(x)},${n1(y - r)} Q${n1(x + k)},${n1(y - k)} ${n1(x + r)},${n1(y)} Q${n1(x + k)},${n1(y + k)} ${n1(x)},${n1(y + r)} Q${n1(x - k)},${n1(y + k)} ${n1(x - r)},${n1(y)} Q${n1(x - k)},${n1(y - k)} ${n1(x)},${n1(y - r)} Z`}
      fill={col}
      opacity={o}
    />
  );
};
