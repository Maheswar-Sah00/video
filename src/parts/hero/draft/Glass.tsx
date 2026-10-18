import React from 'react';
import {C} from '../../../lib/palette';
import {clamp, hash, lerp, mixHex, rgba} from '../../../lib/anim';
import type {Lighting} from '../../../lib/scene';
import {Glint} from '../kit/cel';

/**
 * A clear drinking GLASS of water (owner: hero). Anime-cel: crisp ink silhouette, clear glass with
 * Fresnel-dark walls, a window-reflection highlight on the lit side, a thick lens-like base with a
 * bright caustic crescent; aqua WATER with a level surface ellipse, bright meniscus, caustic
 * ripples at the bottom, rising micro-bubbles; cold condensation beads (+ the odd running drip)
 * below the water line.
 *
 * Origin (x,y) = the centre of the glass's BASE (where it touches the counter). At scale 1 the
 * glass is ~150 px wide at the rim, ~126 px at the base, ~260 px tall (rim at y-260). Seen from
 * slightly above (the rim is an ellipse ~22 px tall).
 * `rot` tilts it about the base centre (deg, + = clockwise) — the water surface stays LEVEL and
 * keeps a plausible volume (the surface passes through the axis at the fill height, as for a
 * tilted cylinder); tilt far enough and the water reaches the rim (drinking).
 *
 *   level         0..1 how full (0 = empty)
 *   slosh         0..1 surface wobble (after a sip / set down) — rocks the surface + ripples
 *   condensation  0..1 cold beads on the outside (below the water line)
 *   lighting      lib/scene Lighting (tints the highlights)
 *   detail        0..1 (< 0.4 = simple, for small glasses)
 * ADDED optional props:
 *   ground    0..1 draw a soft contact shadow + the bright CAUSTIC the water throws on the surface
 *             it stands on (toward screen-right/back for the 'day' key light). Default 0.
 *   sparkle   0..1 twinkling star glints on the rim + water surface (sunlit). Default 0.35.
 *   light     [dx, dy] direction TOWARD the key light (default from `lighting`: upper-left for day)
 * ADDED export: glassSurfaceY(level, rot) -> local y of the water surface on the axis (for drips).
 */
export type GlassProps = {
  f: number;
  id: string;
  x: number;
  y: number;
  scale?: number;
  rot?: number;
  level?: number;
  slosh?: number;
  condensation?: number;
  lighting?: Lighting;
  detail?: number;
  opacity?: number;
  ground?: number;
  sparkle?: number;
  light?: [number, number];
};

const n1 = (v: number) => v.toFixed(1);
const RIM = 260;
const RRX = 75; // rim half width
const BRX = 63; // base half width
const RY = 0.15; // ellipse ratio (view from slightly above)
const IN_TOP = -258;
const IN_BOT = -20; // inner bottom (thick base below)
const hwIn = (y: number) => lerp(57.5, 69, clamp((IN_BOT - y) / (IN_BOT - IN_TOP)));

/** local y (along the axis) of the water surface for a fill level */
export const glassSurfaceY = (level: number, rot = 0) => {
  const ly = IN_BOT - clamp(level) * (IN_BOT - IN_TOP - 4);
  return ly * Math.cos((rot * Math.PI) / 180);
};

const OUTER = `M${-RRX},${-RIM} A${RRX},${RRX * RY} 0 0 1 ${RRX},${-RIM} L${BRX + 0.5},-8 Q${BRX - 1},4 40,6 Q0,9 -40,6 Q${-BRX + 1},4 ${-BRX - 0.5},-8 Z`;
const INNER = `M-69,${IN_TOP} L-57.5,${IN_BOT} Q-55,${IN_BOT + 6} -40,${IN_BOT + 7} Q0,${IN_BOT + 9} 40,${IN_BOT + 7} Q55,${IN_BOT + 6} 57.5,${IN_BOT} L69,${IN_TOP} Z`;

export const Glass: React.FC<GlassProps> = ({f, id, x, y, scale = 1, rot = 0, level = 0.8, slosh = 0, condensation = 0.3, lighting = 'day', detail = 1, opacity = 1, ground = 0, sparkle = 0.35, light}) => {
  const a = (rot * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  const lv = clamp(level);
  const sl = clamp(slosh);
  const hl = mixHex(lighting === 'night' || lighting === 'dim' ? C.lampGlow : lighting === 'bath' ? C.bathLight : lighting === 'hot' ? C.hotSun : C.morning, '#ffffff', 0.45);
  const hlWarm = lighting === 'night' || lighting === 'dim' ? C.lampGlow : lighting === 'bath' ? C.bathLight : C.sunGlow;
  // light direction (toward the light) in the glass's local frame -> which side is lit
  const Ld: [number, number] = light ?? (lighting === 'dim' ? [0.9, -0.3] : lighting === 'night' ? [-0.86, 0.5] : lighting === 'bath' || lighting === 'ward' ? [0.05, -1] : lighting === 'hot' ? [-0.2, -1] : [-0.62, -0.78]);
  const lsx = Ld[0] * ca + Ld[1] * sa; // local x component
  const litSide = lsx <= 0 ? -1 : 1;

  // ---- water surface (world-level): passes through the axis at the fill height
  const ly = IN_BOT - lv * (IN_BOT - IN_TOP - 4);
  const axX = -ly * sa, axY = ly * ca; // axis point at the fill height, rotated
  const hwS = hwIn(ly) / Math.max(0.25, Math.abs(ca)) + 3;
  const ryS = Math.max(4, hwIn(ly) * RY * (0.85 + 0.15 * Math.abs(ca)));
  const rock = sl * 5 * Math.sin(f * 0.31) + sl * 2 * Math.sin(f * 0.53 + 1);
  const tr = Math.tan((rock * Math.PI) / 180);
  const N = 36;
  const ell: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const cx = Math.cos(t), sy = Math.sin(t);
    const wave = (1.2 + 5 * sl) * (Math.sin(3 * t + f * 0.42) * 0.6 + Math.sin(5 * t - f * 0.61) * 0.4) * (0.4 + 0.6 * Math.abs(sy));
    ell.push([axX + hwS * cx, axY + ryS * sy + hwS * cx * tr + wave]);
  }
  const ellD = 'M' + ell.map(([px, py]) => `${n1(px)},${n1(py)}`).join(' L') + ' Z';
  // back arc (t from PI..2PI: the upper half) closing down to below the glass = the whole water body
  const back = ell.slice(N / 2).concat([ell[0]]);
  const bodyD = `M${n1(back[0][0])},${n1(back[0][1])} ` + back.slice(1).map(([px, py]) => `L${n1(px)},${n1(py)}`).join(' ') + ` L${n1(axX + hwS + 300)},${n1(axY + 400)} L${n1(axX - hwS - 300)},${n1(axY + 400)} Z`;
  const front = ell.slice(0, N / 2 + 1);
  const frontD = 'M' + front.map(([px, py]) => `${n1(px)},${n1(py)}`).join(' L');
  const backD = 'M' + back.map(([px, py]) => `${n1(px)},${n1(py)}`).join(' L');
  const hasWater = lv > 0.005;
  // world y of the inner bottom centre (for caustics / bubbles)
  const botX = -(IN_BOT + 4) * sa, botY = (IN_BOT + 4) * ca;
  const depth = Math.max(0, botY - axY);

  // ---- condensation beads (glass-local, below the water line on the outside)
  const beads: React.ReactNode[] = [];
  const nB = detail > 0.4 ? Math.round(46 * clamp(condensation)) : 0;
  const wl = lerp(IN_BOT, ly, 1) - 4; // local water line
  let beadD = '', beadShade = '', beadHi = '';
  for (let i = 0; i < nB; i++) {
    const u = hash(i, 11) * 2 - 1;
    const yy = lerp(-14, Math.max(wl, -240), hash(i, 12));
    if (yy < wl - 2 && lv > 0.05) continue;
    const half = lerp(BRX, RRX, -yy / RIM) - 6;
    const px = u * half * 0.94;
    const edge = Math.abs(u);
    const r = (1.6 + 2.6 * hash(i, 13) * hash(i, 14)) * (1 - edge * 0.35);
    const rx = r * (1 - edge * 0.5);
    beadD += `M${n1(px - rx)},${n1(yy)} a${n1(rx)},${n1(r)} 0 1,0 ${n1(2 * rx)},0 a${n1(rx)},${n1(r)} 0 1,0 ${n1(-2 * rx)},0 `;
    beadShade += `M${n1(px - rx * 0.8)},${n1(yy + r * 0.3)} a${n1(rx * 0.8)},${n1(r * 0.7)} 0 0,0 ${n1(rx * 1.6)},0 `;
    if (r > 2.2) beadHi += `M${n1(px - rx * 0.35)},${n1(yy - r * 0.35)} l0.1,0 `;
  }
  if (nB > 0)
    beads.push(
      <g key="beads">
        <path d={beadD} fill={rgba('#ffffff', 0.2)} stroke={rgba(C.waterDeep, 0.28)} strokeWidth={0.8} />
        <path d={beadShade} fill="none" stroke={rgba(C.waterDark, 0.35)} strokeWidth={1.2} />
        <path d={beadHi} stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" opacity={0.95} />
      </g>,
    );
  // running drips (slow, deterministic)
  if (detail > 0.5 && condensation > 0.45) {
    for (let k = 0; k < 2; k++) {
      const per = 150 + 40 * k;
      const t = (((f + k * 77) % per) + per) % per / per;
      const px = (k ? 1 : -1) * (28 + 14 * k) * (litSide > 0 ? -1 : 1);
      const y0 = -170 + k * 30;
      const yy = lerp(y0, -16, Math.pow(t, 1.6));
      const op = clamp(t * 8) * clamp((1 - t) * 6) * clamp((condensation - 0.45) * 3);
      beads.push(
        <g key={`drip${k}`} opacity={op}>
          <path d={`M${px},${y0} L${px + 1},${n1(yy - 4)}`} stroke={rgba('#ffffff', 0.35)} strokeWidth={2.4} strokeLinecap="round" />
          <ellipse cx={px + 1} cy={n1(yy)} rx={3.2} ry={4.4} fill={rgba('#ffffff', 0.35)} stroke={rgba(C.waterDeep, 0.45)} strokeWidth={0.9} />
          <circle cx={px} cy={n1(yy - 1.5)} r={1.1} fill="#fff" />
        </g>,
      );
    }
  }

  // ---- caustic ripple lines at the bottom of the water (world space)
  let caus = '';
  if (hasWater && detail > 0.4) {
    for (let i = 0; i < 4; i++) {
      const yy = botY - 6 - i * Math.min(14, depth / 6);
      const w = hwIn(IN_BOT) * (0.9 - i * 0.08);
      let d = '';
      for (let k = 0; k <= 10; k++) {
        const xx = botX - w + (2 * w * k) / 10;
        const ww = Math.sin(xx * 0.09 + f * 0.16 + i * 1.7) * 2.6 + Math.sin(xx * 0.21 - f * 0.11 + i) * 1.4;
        d += `${k ? 'L' : 'M'}${n1(xx)},${n1(yy + ww)} `;
      }
      caus += d;
    }
  }
  // rising micro-bubbles
  let bub = '';
  if (hasWater && detail > 0.4 && depth > 20) {
    for (let i = 0; i < 7; i++) {
      const sp = 0.9 + hash(i, 31) * 1.1;
      const tt = ((f * sp + hash(i, 32) * 400) % Math.max(20, depth)) / Math.max(20, depth);
      const bx = botX + (hash(i, 33) * 2 - 1) * 40 + Math.sin(f * 0.1 + i) * 3;
      const by = botY - 6 - tt * (depth - 8);
      const r = 1.4 + hash(i, 34) * 1.8;
      bub += `M${n1(bx - r)},${n1(by)} a${n1(r)},${n1(r)} 0 1,0 ${n1(2 * r)},0 a${n1(r)},${n1(r)} 0 1,0 ${n1(-2 * r)},0 `;
    }
  }

  const tw = (k: number) => 0.5 + 0.5 * Math.sin(f * 0.22 + k * 2.1);
  const sp = clamp(sparkle);
  // the rim ellipse
  const rimBack = `M${-RRX},${-RIM} A${RRX},${RRX * RY} 0 0 1 ${RRX},${-RIM}`;
  const rimFront = `M${-RRX},${-RIM} A${RRX},${RRX * RY} 0 0 0 ${RRX},${-RIM}`;
  const lx = litSide * 1; // lit wall side (local)

  return (
    <g transform={`translate(${n1(x)},${n1(y)}) scale(${scale})`} opacity={opacity}>
      <defs>
        <clipPath id={`${id}-in`}>
          <path d={INNER} transform={`rotate(${n1(rot)})`} />
        </clipPath>
        <clipPath id={`${id}-wb`}>
          <path d={bodyD} />
        </clipPath>
        <linearGradient id={`${id}-wg`} x1={0} y1={n1(Math.min(axY - ryS, botY - 30))} x2={0} y2={n1(botY + 10)} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={C.waterLight} stopOpacity={0.5} />
          <stop offset={0.35} stopColor={C.water} stopOpacity={0.48} />
          <stop offset={1} stopColor={C.waterDeep} stopOpacity={0.62} />
        </linearGradient>
        <linearGradient id={`${id}-gl`} x1={lx < 0 ? 0 : 1} y1={0} x2={lx < 0 ? 1 : 0} y2={0}>
          <stop offset={0} stopColor="#ffffff" stopOpacity={0.24} />
          <stop offset={0.45} stopColor="#ffffff" stopOpacity={0.06} />
          <stop offset={1} stopColor={C.waterDark} stopOpacity={0.1} />
        </linearGradient>
        {ground > 0 && (
          <radialGradient id={`${id}-cg`}>
            <stop offset={0} stopColor={C.waterLight} stopOpacity={0.9} />
            <stop offset={0.5} stopColor={C.waterGlow} stopOpacity={0.35} />
            <stop offset={1} stopColor={C.waterGlow} stopOpacity={0} />
          </radialGradient>
        )}
      </defs>

      {/* ---- on the ground: contact shadow + the water's caustic */}
      {ground > 0 && (
        <g opacity={clamp(ground)}>
          <ellipse cx={n1(-lx * 30)} cy={2} rx={110} ry={16} fill={rgba(C.ink, 0.16)} />
          <ellipse cx={n1(-lx * 6)} cy={1} rx={70} ry={9} fill={rgba(C.ink, 0.22)} />
          {hasWater && (
            <g>
              <ellipse cx={n1(-lx * 92)} cy={-2} rx={78} ry={15} fill={`url(#${id}-cg)`} opacity={0.75 * clamp(lv * 2)} />
              <path
                d={`M${n1(-lx * 92 - 50)},${n1(-2 + Math.sin(f * 0.2) * 2)} q25,${n1(-6 + 3 * Math.sin(f * 0.17))} 50,0 t50,0 M${n1(-lx * 92 - 34)},${n1(4 + Math.sin(f * 0.23 + 1) * 2)} q17,${n1(-4 + 2 * Math.sin(f * 0.19))} 34,0 t34,0`}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2.4}
                strokeLinecap="round"
                opacity={0.7 * clamp(lv * 2)}
              />
            </g>
          )}
        </g>
      )}

      {/* ---- glass body (back wall + faint fill) */}
      <g transform={`rotate(${n1(rot)})`}>
        <path d={OUTER} fill={`url(#${id}-gl)`} />
        <path d={rimBack} fill="none" stroke={rgba('#ffffff', 0.45)} strokeWidth={2.5} transform="translate(0,4)" />
      </g>

      {/* ---- the water */}
      {hasWater && (
        <g clipPath={`url(#${id}-in)`}>
          <g clipPath={`url(#${id}-wb)`}>
            <path d={bodyD} fill={`url(#${id}-wg)`} />
            {/* darker refraction bands along the walls */}
            <g transform={`rotate(${n1(rot)})`}>
              <path d={`M${-lx * 66},-250 L${-lx * 55},-14`} stroke={rgba(C.waterDeep, 0.45)} strokeWidth={22} />
              <path d={`M${lx * 64},-250 L${lx * 54},-14`} stroke={rgba(C.waterDark, 0.22)} strokeWidth={12} />
              <path d={`M${lx * 46},-240 L${lx * 40},-24`} stroke={rgba(C.waterLight, 0.35)} strokeWidth={10} />
            </g>
            {/* bottom glow + caustic ripples */}
            <ellipse cx={n1(botX)} cy={n1(botY - 4)} rx={58} ry={14} fill={rgba(C.waterLight, 0.45)} />
            {caus && <path d={caus} fill="none" stroke={rgba('#ffffff', 0.55)} strokeWidth={2.2} strokeLinecap="round" />}
            {bub && <path d={bub} fill={rgba('#ffffff', 0.25)} stroke={rgba('#ffffff', 0.75)} strokeWidth={0.9} />}
          </g>
          {/* the surface: lighter ellipse, bright meniscus at the front edge, soft back edge */}
          <path d={ellD} fill={rgba(mixHex(C.waterLight, hl, 0.3), 0.55)} />
          <path d={ellD} fill={rgba(C.waterGlow, 0.25)} transform={`translate(${n1(-lx * 10)},3)`} />
          <path d={backD} fill="none" stroke={rgba(C.waterDeep, 0.5)} strokeWidth={2} />
          <path d={frontD} fill="none" stroke={rgba('#ffffff', 0.95)} strokeWidth={3.2} strokeLinecap="round" />
          <path d={frontD} fill="none" stroke={rgba(C.waterGlow, 0.6)} strokeWidth={7} strokeLinecap="round" transform="translate(0,5)" />
          {/* sun glint on the surface */}
          <ellipse cx={n1(axX + lx * hwS * 0.38)} cy={n1(axY - ryS * 0.15)} rx={n1(hwS * 0.22)} ry={n1(ryS * 0.28)} fill={rgba(hl, 0.85)} />
        </g>
      )}

      {/* ---- glass front: walls, highlights, base, rim, beads, ink */}
      <g transform={`rotate(${n1(rot)})`}>
        {/* Fresnel-dark wall edges */}
        <path d={`M${-RRX + 4},${-RIM + 6} L${-BRX + 3},-10`} stroke={rgba(C.inkSoft, 0.28)} strokeWidth={6} strokeLinecap="round" />
        <path d={`M${RRX - 4},${-RIM + 6} L${BRX - 3},-10`} stroke={rgba(C.inkSoft, 0.28)} strokeWidth={6} strokeLinecap="round" />
        {/* thick base: a lens with a bright caustic crescent */}
        <path d={`M${-BRX + 2},-12 Q0,${IN_BOT + 2} ${BRX - 2},-12 Q${BRX - 4},3 0,5 Q${-BRX + 4},3 ${-BRX + 2},-12 Z`} fill={rgba(hasWater ? C.waterLight : '#ffffff', hasWater ? 0.35 : 0.22)} />
        <path d={`M${-BRX + 10},-4 Q0,6 ${BRX - 10},-4`} fill="none" stroke={rgba('#ffffff', 0.85)} strokeWidth={2.6} strokeLinecap="round" />
        <path d={`M${lx * 18},-9 Q${lx * 40},-6 ${lx * 52},-14`} fill="none" stroke={rgba(hlWarm, 0.95)} strokeWidth={4} strokeLinecap="round" />
        <path d={`M${-BRX + 4},${IN_BOT + 4} Q0,${IN_BOT + 12} ${BRX - 4},${IN_BOT + 4}`} fill="none" stroke={rgba(C.inkSoft, 0.3)} strokeWidth={2} />
        {/* the lit side: a tall window reflection (two panes) + a soft band; a thin specular on the far side */}
        <path d={`M${lx * 58},-238 L${lx * 49},-34`} stroke={rgba('#ffffff', 0.28)} strokeWidth={18} strokeLinecap="round" />
        <path d={`M${lx * 60},-240 L${lx * 55},-140`} stroke={rgba(hl, 0.95)} strokeWidth={6} strokeLinecap="round" />
        <path d={`M${lx * 54},-126 L${lx * 50},-50`} stroke={rgba(hl, 0.9)} strokeWidth={6} strokeLinecap="round" />
        <path d={`M${lx * 42},-236 L${lx * 39},-186`} stroke={rgba('#ffffff', 0.6)} strokeWidth={3} strokeLinecap="round" />
        <path d={`M${-lx * 62},-226 L${-lx * 54},-60`} stroke={rgba('#ffffff', 0.32)} strokeWidth={3.5} strokeLinecap="round" />
        {beads}
        {/* rim: front arc bright, thickness, ink */}
        <path d={rimFront} fill="none" stroke={rgba('#ffffff', 0.9)} strokeWidth={3} />
        <path d={rimFront} fill="none" stroke={rgba(C.waterLight, 0.5)} strokeWidth={2} transform="translate(0,4)" />
        <path d={OUTER} fill="none" stroke={rgba(C.ink, 0.88)} strokeWidth={3.6} strokeLinejoin="round" />
        <path d={rimFront} fill="none" stroke={rgba(C.ink, 0.55)} strokeWidth={1.8} />
        {/* sparkles */}
        {sp > 0.02 && detail > 0.4 && (
          <g>
            <Glint x={lx * 60} y={-RIM + 4} r={14 * sp * (0.6 + 0.4 * tw(0))} o={sp * (0.5 + 0.5 * tw(0))} col={hl} />
            <Glint x={lx * 50} y={-60} r={10 * sp * (0.5 + 0.5 * tw(1))} o={sp * tw(1)} col="#ffffff" />
            {hasWater && <Glint x={axX * ca + axY * sa + lx * 20} y={-axX * sa + axY * ca + 2} r={12 * sp * tw(2)} o={sp * tw(2)} col="#ffffff" />}
          </g>
        )}
      </g>
    </g>
  );
};
