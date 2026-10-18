import React from 'react';
import {C} from '../../lib/palette';
import {clamp, mixHex, smoothPath} from '../../lib/anim';
import {n1} from './kit';

/**
 * His ARMS for the S12 standing mid-shot (owner: home). HeroHead's torso has no arms, so in a
 * waist-up shot we add cel-shaded tubes (bare arm + tee sleeve) graded like the hero kit's 'dim'
 * lighting (key light from screen-right, deep blue shadow, cool rim). World-space points.
 */

const dimShade = (lit: string, shade: string, rim: string, deep: string) => ({
  lit: mixHex(mixHex(lit, C.lampGlow, 0.2), C.duskTop, 0.12),
  shade: mixHex(shade, C.roomNight, 0.5),
  rim: mixHex(rim, C.duskTop, 0.5),
  deep: mixHex(deep, C.roomNight, 0.55),
});

export const armColours = (dry: number) => {
  const ill = clamp(0.6 * dry);
  const skin = dimShade(
    mixHex(mixHex(C.skin, C.skinPale, 0.85 * ill), C.skinDry, 0.5 * clamp(dry)),
    mixHex(C.skinShade, mixHex(C.skinPale, C.underEye, 0.45), 0.6 * ill),
    mixHex(C.skinLight, C.skinPale, 0.5 * ill),
    mixHex(C.skinDeep, C.underEye, 0.4 * ill),
  );
  const tee = dimShade(C.tee, C.teeShade, C.teeLight, mixHex(C.teeShade, C.inkSoft, 0.3));
  return {skin, tee};
};

type Pt = [number, number];
/** Closed outline of a tube through pts with half-widths ws (rounded ends). */
const tubeD = (pts: Pt[], ws: number[], capStart = true) => {
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    L.push([pts[i][0] + nx * ws[i], pts[i][1] + ny * ws[i]]);
    R.push([pts[i][0] - nx * ws[i], pts[i][1] - ny * ws[i]]);
  }
  const s0 = pts[0], s1 = pts[1];
  const dl = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) || 1;
  const back: Pt = [s0[0] - ((s1[0] - s0[0]) / dl) * ws[0] * 0.6, s0[1] - ((s1[1] - s0[1]) / dl) * ws[0] * 0.6];
  const ring: Pt[] = [...L, ...[...R].reverse(), ...(capStart ? [back] : [])];
  return smoothPath(ring, true);
};

const LD: Pt = [0.88, -0.3];

export const CelTube: React.FC<{id: string; pts: Pt[]; ws: number[]; sh: {lit: string; shade: string; rim: string}; k?: number; r?: number; inkW?: number; children?: React.ReactNode}> = ({
  id, pts, ws, sh, k = 26, r = 8, inkW = 4.5, children,
}) => {
  const d = tubeD(pts, ws);
  return (
    <g>
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <path d={d} fill={sh.rim} />
        <path d={d} fill={sh.shade} transform={`translate(${n1(LD[0] * r)},${n1(LD[1] * r)})`} />
        <path d={d} fill={sh.lit} transform={`translate(${n1(LD[0] * k)},${n1(LD[1] * k)})`} />
        {children}
      </g>
      <path d={d} fill="none" stroke={C.ink} strokeWidth={inkW} strokeLinejoin="round" />
    </g>
  );
};

/** One arm: shoulder S -> elbow E -> wrist W (world). sleeve covers the upper arm to `hem` (0..1
 *  along S->E). s = character scale. showForearm=false stops at the elbow (HeroHand draws the rest). */
export const Arm: React.FC<{id: string; S: Pt; E: Pt; W: Pt; s: number; dry: number; hem?: number; showForearm?: boolean; sleeveClip?: string}> = ({
  id, S, E, W, s, dry, hem = 0.55, showForearm = true, sleeveClip,
}) => {
  const col = armColours(dry);
  const thin = 1 - 0.08 * clamp(dry);
  const lerpP = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const H = lerpP(S, E, hem);
  const armPts: Pt[] = showForearm ? [S, lerpP(S, E, 0.5), E, lerpP(E, W, 0.5), W] : [S, lerpP(S, E, 0.5), lerpP(E, W, 0.06)];
  const armWs = (showForearm ? [70, 60, 50, 52, 42] : [70, 60, 50]).map((w) => w * s * thin);
  const sleevePts: Pt[] = [lerpP(S, E, -0.12), lerpP(S, E, hem * 0.5), H];
  const sleeveWs = [80, 90, 86].map((w) => w * s);
  return (
    <g>
      <CelTube id={`${id}-sk`} pts={armPts} ws={armWs} sh={col.skin} k={30 * s} r={9 * s} inkW={4.5}>
        {/* elbow crease */}
        <path d={`M${n1(E[0] - 14 * s)},${n1(E[1] - 4 * s)} q${n1(12 * s)},${n1(8 * s)} ${n1(26 * s)},${n1(2 * s)}`} fill="none" stroke={col.skin.shade} strokeWidth={5 * s} strokeLinecap="round" />
      </CelTube>
      <g clipPath={sleeveClip ? `url(#${sleeveClip})` : undefined}>
      <CelTube id={`${id}-sl`} pts={sleevePts} ws={sleeveWs} sh={col.tee} k={40 * s} r={10 * s} inkW={4.5}>
        {(() => {
          const ux = E[0] - S[0], uy = E[1] - S[1];
          const ul = Math.hypot(ux, uy) || 1;
          const px = -uy / ul, py = ux / ul;
          const bx = H[0] - (ux / ul) * 22 * s, by = H[1] - (uy / ul) * 22 * s;
          return <path d={`M${n1(bx - px * 90 * s)},${n1(by - py * 90 * s)} L${n1(bx + px * 90 * s)},${n1(by + py * 90 * s)}`} stroke={col.tee.shade} strokeWidth={9 * s} opacity={0.55} />;
        })()}
      </CelTube>
      </g>
    </g>
  );
};
