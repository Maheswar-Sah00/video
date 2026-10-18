import React from 'react';
import {C} from '../../lib/palette';
import {hash, mixHex, rgba, smoothPath} from '../../lib/anim';
import {beanPts, BEAN, kTf, KH, KW, PYR, ray, type Pt, type Side} from './geom';

// One glossy KIDNEY (medical-illustration style): capsule with a soft radial sheen, lighter
// cortex speckled with glomeruli, darker striated medullary pyramids, interlobar/arcuate arteries,
// calyces + renal pelvis holding urine (its colour = how concentrated it is), an x-ray rim and
// specular highlights. `dull` 0..1 = failing (grey-brown, matte, no glow).

const fx = (n: number) => n.toFixed(1);
const P = (p: Pt) => `${fx(p[0])},${fx(p[1])}`;

const BEAN_D = smoothPath(beanPts(), true);
const BEAN_IN = smoothPath(beanPts(0.985), true);
const W = 0.2;
const PYR_D = PYR.map((th) => {
  const c1 = ray(th - W, 0.84);
  const c2 = ray(th + W, 0.84);
  const bc = ray(th, 0.93);
  const ap = ray(th, 0.4);
  const s2 = ray(th + W * 0.5, 0.6);
  const s1 = ray(th - W * 0.5, 0.6);
  return `M${P(c1)}Q${P(bc)} ${P(c2)}Q${P(s2)} ${P(ap)}Q${P(s1)} ${P(c1)}Z`;
}).join('');
const STRI_D = PYR.map((th) => [-1, -0.33, 0.33, 1].map((k) => `M${P(ray(th + k * W * 0.62, 0.8))}L${P(ray(th + k * W * 0.12, 0.47))}`).join('')).join('');
const ART_D = (() => {
  let d = '';
  for (let i = 0; i < PYR.length - 1; i++) {
    const m = (PYR[i] + PYR[i + 1]) / 2;
    d += `M${P(ray(m, 0.3))}Q${P(ray(m + 0.04, 0.6))} ${P(ray(m, 0.86))}`;
  }
  PYR.forEach((th) => {
    const pts: Pt[] = [];
    for (let k = -1.6; k <= 1.6; k += 0.4) pts.push(ray(th + k * W, 0.87));
    d += smoothPath(pts);
  });
  return d;
})();
const GLOM_D = (() => {
  let d = '';
  for (let i = 0; i < 70; i++) {
    const th = ((40 + 280 * hash(i, 5)) * Math.PI) / 180;
    const [x, y] = ray(th, 0.885 + 0.08 * hash(i, 6));
    const r = 2 + 1.4 * hash(i, 7);
    d += `M${fx(x - r)},${fx(y)}a${fx(r)},${fx(r)} 0 1 0 ${fx(2 * r)},0a${fx(r)},${fx(r)} 0 1 0 ${fx(-2 * r)},0`;
  }
  return d;
})();
const PELVIS_C: Pt = [38, 8];
const CALYX_D = PYR.map((th) => `M${P(ray(th, 0.36))}Q${P(ray(th, 0.22))} ${P(PELVIS_C)}`).join('');
const CUPS_D = PYR.map((th) => `M${P(ray(th - 0.24, 0.39))}Q${P(ray(th, 0.29))} ${P(ray(th + 0.24, 0.39))}`).join('');
const PELVIS_D = smoothPath(
  [
    [14, -30],
    [40, -38],
    [58, -10],
    [62, 22],
    [56, 46],
    [44, 40],
    [30, 26],
    [12, 10],
  ],
  true,
);
const SINUS_D = smoothPath(
  [
    [-12, -86],
    [30, -100],
    [62, -40],
    [60, 50],
    [30, 104],
    [-14, 86],
    [-24, 0],
  ],
  true,
);
const SHIM_D = PYR.map((th) => `M${P(ray(th, 0.88))}L${P(ray(th, 0.4))}`).join('');
const CRESC_D = smoothPath([
  [BEAN[11][0] * KW * 0.9, BEAN[11][1] * KH * 0.9 - 20],
  [BEAN[12][0] * KW * 0.9, BEAN[12][1] * KH * 0.9],
  [BEAN[13][0] * KW * 0.9, BEAN[13][1] * KH * 0.9],
  [BEAN[14][0] * KW * 0.9, BEAN[14][1] * KH * 0.9],
  [BEAN[0][0] * KW * 0.86, BEAN[0][1] * KH * 0.9],
]);
const ADRENAL_D = smoothPath(
  [
    [-26, -156],
    [2, -216],
    [46, -184],
    [36, -150],
    [6, -146],
  ],
  true,
);

const DULLC = mixHex(mixHex(C.kidney, C.urine4, 0.35), C.saltDeep, 0.45); // grey-brown (failing)

export const Kidney: React.FC<{
  id: string;
  side: Side;
  f: number; // absolute frame (idle shimmer)
  bob?: number;
  glow?: number; // 0..1 halo
  glowColor?: string;
  dull?: number; // 0..1 failing: grey-brown, matte
  act?: number; // 0..1 filtering activity (inward aqua shimmer)
  flowT?: number; // integrated activity time (drives the shimmer)
  urine?: string; // colour in the calyces / pelvis
  pelvis?: number; // 0..1 how much urine shows in the pelvis
  adh?: number; // 0..1 violet ADH wash
  scale?: number;
}> = ({id, side, f, bob = 0, glow = 0.6, glowColor = C.kidney, dull = 0, act = 1, flowT = 0, urine = C.urine1, pelvis = 0.8, adh = 0, scale = 1}) => {
  const u = `${id}-${side}`;
  const base = mixHex(C.kidney, DULLC, dull);
  const light = mixHex(mixHex(C.liverLight, C.tissueLight, 0.25), mixHex(DULLC, C.concrete, 0.18), dull);
  const deep = mixHex(C.liverDeep, mixHex(DULLC, C.inkSoft, 0.55), dull);
  const cortex = mixHex(mixHex(C.kidney, C.tissueLight, 0.22), mixHex(DULLC, C.concrete, 0.12), dull);
  const medA = mixHex(mixHex(C.kidney, C.liverDeep, 0.35), mixHex(DULLC, C.inkSoft, 0.25), dull);
  const medB = mixHex(mixHex(C.liverDeep, C.ink, 0.2), mixHex(DULLC, C.inkSoft, 0.6), dull);
  const art = mixHex(C.bloodLight, DULLC, dull * 0.85);
  const gloss = 1 - 0.75 * dull;
  const breathe = 1 + 0.006 * Math.sin(f * 0.11) * (1 - dull);
  const halo = mixHex(glowColor, C.adh, adh * 0.8);
  return (
    <g transform={kTf(side, bob, scale * breathe)}>
      <defs>
        <radialGradient id={`${u}-halo`}>
          <stop offset="0%" stopColor={halo} stopOpacity={0.55} />
          <stop offset="50%" stopColor={halo} stopOpacity={0.18} />
          <stop offset="100%" stopColor={halo} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${u}-body`} gradientUnits="userSpaceOnUse" cx={-38} cy={-74} r={250}>
          <stop offset="0%" stopColor={light} />
          <stop offset="42%" stopColor={base} />
          <stop offset="100%" stopColor={deep} />
        </radialGradient>
        <radialGradient id={`${u}-med`} gradientUnits="userSpaceOnUse" cx={30} cy={2} r={130}>
          <stop offset="0%" stopColor={medB} />
          <stop offset="100%" stopColor={medA} />
        </radialGradient>
        <clipPath id={`${u}-clip`}>
          <path d={BEAN_D} />
        </clipPath>
      </defs>
      {glow > 0.01 && <ellipse cx={-10} cy={0} rx={KW * 2.3} ry={KH * 1.5} fill={`url(#${u}-halo)`} opacity={glow} />}
      <path d={ADRENAL_D} fill={rgba(C.bodyGhostLight, 0.1)} stroke={rgba(C.bodyGhostLight, 0.45)} strokeWidth={2.5} />
      <path d={BEAN_D} fill={rgba(C.navyDeep, 0.5)} transform="translate(9,14)" />
      <path d={BEAN_D} fill={`url(#${u}-body)`} />
      <g clipPath={`url(#${u}-clip)`}>
        <path d={smoothPath(beanPts(0.9, -4, 0), true)} fill={cortex} opacity={0.5} />
        <path d={GLOM_D} fill={mixHex(C.bloodDeep, DULLC, dull)} opacity={0.55} />
        <path d={PYR_D} fill={`url(#${u}-med)`} stroke={rgba(C.ink, 0.35)} strokeWidth={1.5} />
        <path d={STRI_D} fill="none" stroke={rgba(mixHex(C.liverLight, DULLC, dull), 0.35)} strokeWidth={1.6} />
        <path d={SINUS_D} fill={rgba(mixHex(C.liverDeep, C.navyDeep, 0.5), 0.6)} />
        <path d={ART_D} fill="none" stroke={rgba(art, 0.75)} strokeWidth={2.4} strokeLinecap="round" />
        {act > 0.01 && (
          <path d={SHIM_D} fill="none" stroke={rgba(C.waterGlow, 0.75 * act)} strokeWidth={4} strokeLinecap="round" strokeDasharray="8 34" strokeDashoffset={-flowT * 1.6} />
        )}
        {/* calyces + pelvis: urine */}
        <path d={CALYX_D} fill="none" stroke={rgba(C.ink, 0.5)} strokeWidth={15} strokeLinecap="round" />
        <path d={CALYX_D} fill="none" stroke={rgba(urine, 0.35 + 0.6 * pelvis)} strokeWidth={11} strokeLinecap="round" />
        <path d={CUPS_D} fill="none" stroke={rgba(urine, 0.5 + 0.5 * pelvis)} strokeWidth={5} strokeLinecap="round" />
        <path d={PELVIS_D} fill={rgba(urine, 0.35 + 0.6 * pelvis)} stroke={rgba(C.ink, 0.55)} strokeWidth={2} />
        <path d="M22,-22 Q40,-30 50,-8" fill="none" stroke={rgba('#ffffff', 0.55 * gloss)} strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* gloss */}
      <path d={CRESC_D} fill="none" stroke={rgba('#ffffff', 0.32 * gloss)} strokeWidth={7} strokeLinecap="round" />
      <ellipse cx={-50} cy={-122} rx={20} ry={8} fill={rgba('#ffffff', 0.62 * gloss)} transform="rotate(-38 -50 -122)" />
      <ellipse cx={-70} cy={60} rx={6} ry={14} fill={rgba('#ffffff', 0.22 * gloss)} transform="rotate(10 -70 60)" />
      <path d={BEAN_IN} fill="none" stroke={rgba(C.bodyGhostLight, 0.4 + 0.15 * gloss)} strokeWidth={2.5} />
      <path d={BEAN_D} fill="none" stroke={rgba(C.ink, 0.8)} strokeWidth={3.5} strokeLinejoin="round" />
    </g>
  );
};
