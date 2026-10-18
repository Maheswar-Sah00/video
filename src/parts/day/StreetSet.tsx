import React from 'react';
import {C} from '../../lib/palette';
import {clamp, hash, lerp, mixHex, noise1, rgba, wander} from '../../lib/anim';
import {MONO} from '../../lib/fonts';
import {Glow, ink, n1} from './kit';

/** S11 set: a blazing midday street ('hot'), one-point perspective toward VP. */

export const VP = {x: 540, y: 860};
type Pt = {x: number; y: number};
const toward = (p: Pt, t: number): Pt => ({x: lerp(p.x, VP.x, t), y: lerp(p.y, VP.y, t)});
const q = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${n1(p.x)},${n1(p.y)}`).join(' ') + ' Z';

// ------------------------------------------------------------------------------- sky + sun
export const StreetSky: React.FC<{id: string; f: number}> = ({id, f}) => {
  const rays: string[] = [];
  const sx = 230, sy = 150;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + f * 0.004;
    const w = 0.05 + 0.03 * hash(i, 3);
    const r = 900 + 300 * hash(i, 4);
    rays.push(`M${sx},${sy} L${n1(sx + Math.cos(a - w) * r)},${n1(sy + Math.sin(a - w) * r)} L${n1(sx + Math.cos(a + w) * r)},${n1(sy + Math.sin(a + w) * r)} Z`);
  }
  const pulse = 0.92 + 0.08 * noise1(f * 0.05, 2);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-sky`} x1={0} y1={0} x2={0.3} y2={1}>
          <stop offset={0} stopColor={mixHex(C.hotSky, C.hotSun, 0.25)} />
          <stop offset={0.55} stopColor={mixHex(C.hotSky, C.hotSkyLow, 0.5)} />
          <stop offset={1} stopColor={C.hotSkyLow} />
        </linearGradient>
        <radialGradient id={`${id}-ray`} cx={sx} cy={sy} r={1100} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={C.hotSun} stopOpacity={0.5} />
          <stop offset={1} stopColor={C.hotSun} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={-300} y={-300} width={1680} height={1400} fill={`url(#${id}-sky)`} />
      <path d={rays.join(' ')} fill={`url(#${id}-ray)`} opacity={pulse} />
      <Glow id={`${id}-sun2`} x={sx} y={sy} r={760} color={C.sunGlow} a={0.55 * pulse} />
      <Glow id={`${id}-sun`} x={sx} y={sy} r={330} color={C.hotSun} a={1} />
      <circle cx={sx} cy={sy} r={70} fill="#ffffff" />
    </g>
  );
};

/** Far end of the street around the vanishing point (gets the heat-haze displacement). */
export const StreetFar: React.FC<{id: string; f: number; haze: number}> = ({id, f, haze}) => {
  const blds: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const x0 = 330 + i * 46 + 10 * hash(i, 2);
    const h = 70 + 120 * hash(i, 3);
    blds.push(<rect key={i} x={n1(x0)} y={n1(VP.y + 6 - h)} width={50} height={n1(h)} fill={mixHex(C.buildingLight, C.hotSkyLow, 0.45 + 0.2 * hash(i, 4))} />);
  }
  const carX = 280 + ((f * 3.2) % 620);
  return (
    <g filter={`url(#${id}-haze)`}>
      <defs>
        <filter id={`${id}-haze`} filterUnits="userSpaceOnUse" x={200} y={620} width={680} height={340}>
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.09" numOctaves={1} seed={Math.floor(f / 2) % 40} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={n1(10 + 22 * haze)} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      {blds}
      <rect x={250} y={VP.y} width={580} height={40} fill={mixHex(C.asphaltLight, C.hotSkyLow, 0.5)} />
      {/* a car crossing far away */}
      <g transform={`translate(${n1(carX)},${VP.y + 2})`}>
        <rect x={-26} y={-16} width={52} height={14} rx={5} fill={C.awning} />
        <rect x={-16} y={-24} width={30} height={10} rx={4} fill={mixHex(C.awning, C.hotSun, 0.3)} />
        <rect x={-20} y={-14} width={10} height={6} fill={C.window} />
      </g>
      {/* mirage: a shimmering pale strip reflecting the sky */}
      <path d={`M240,${VP.y + 18} Q${n1(400 + wander(f * 0.05, 4) * 30)},${VP.y + 10} 540,${VP.y + 18} T840,${VP.y + 18} L840,${VP.y + 40} L240,${VP.y + 40} Z`} fill={C.hotSkyLow} opacity={0.85} />
    </g>
  );
};

// --------------------------------------------------------------------------------- facades
type Side = {sgn: -1 | 1; gNear: Pt; rNear: Pt; cuts: number[]; cols: string[]; heights: number[]; seed: number};
const SIDES: Side[] = [
  {sgn: -1, gNear: {x: -60, y: 1520}, rNear: {x: -60, y: 40}, cuts: [0, 0.34, 0.55, 0.67, 0.75, 0.81], cols: [C.concrete, mixHex(C.awning, C.concrete, 0.72), C.buildingLight, mixHex(C.lampGlow, C.concrete, 0.6), C.concreteShade], heights: [1, 0.86, 1.08, 0.8, 0.95], seed: 3},
  {sgn: 1, gNear: {x: 1140, y: 1520}, rNear: {x: 1140, y: 0}, cuts: [0, 0.3, 0.5, 0.63, 0.72, 0.8], cols: [mixHex(C.lampGlow, C.concrete, 0.55), C.concrete, mixHex(C.duskMid, C.concrete, 0.7), C.buildingLight, C.concreteShade], heights: [1, 0.92, 0.82, 1.05, 0.9], seed: 9},
];

export const StreetFacades: React.FC<{id: string; f: number}> = ({id, f}) => {
  const out: React.ReactNode[] = [];
  SIDES.forEach((S, si) => {
    for (let b = 0; b < S.cuts.length - 1; b++) {
      const t0 = S.cuts[b], t1 = S.cuts[b + 1];
      const hf = S.heights[b];
      const g0 = toward(S.gNear, t0), g1 = toward(S.gNear, t1);
      const r0f = toward(S.rNear, t0), r1f = toward(S.rNear, t1);
      const r0 = {x: r0f.x, y: lerp(g0.y, r0f.y, hf)}, r1 = {x: r1f.x, y: lerp(g1.y, r1f.y, hf)};
      const col = S.cols[b % S.cols.length];
      // facade lit by the high sun (left side faces right = sunlit; right side in its own shade)
      const lit = S.sgn < 0 ? mixHex(col, C.hotSun, 0.18) : mixHex(col, C.concreteShade, 0.35);
      const at = (u: number, v: number): Pt => {
        const gx = lerp(g0.x, g1.x, u), gy = lerp(g0.y, g1.y, u);
        const rx = lerp(r0.x, r1.x, u), ry = lerp(r0.y, r1.y, u);
        return {x: lerp(gx, rx, v), y: lerp(gy, ry, v)};
      };
      out.push(<path key={`f${si}${b}`} d={q([g0, g1, r1, r0])} fill={lit} stroke={ink(0.85)} strokeWidth={4} strokeLinejoin="round" />);
      // windows (rows above the shop level)
      const cols = Math.max(2, Math.round((t1 - t0) * 14));
      let wins = '';
      let glare = '';
      for (let r = 0; r < 5; r++) {
        const v0 = 0.3 + r * 0.13, v1 = v0 + 0.07;
        if (v1 > 0.95) break;
        for (let c = 0; c < cols; c++) {
          const u0 = (c + 0.22) / cols, u1 = (c + 0.78) / cols;
          const pts = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
          const d = q(pts);
          if (hash(b * 100 + r * 10 + c, S.seed) > 0.8) glare += d + ' ';
          else wins += d + ' ';
        }
      }
      out.push(<path key={`w${si}${b}`} d={wins} fill={mixHex(C.building, C.buildingShade, 0.35)} stroke={ink(0.6)} strokeWidth={2.5} />);
      out.push(<path key={`g${si}${b}`} d={glare} fill={C.hotSun} stroke={ink(0.6)} strokeWidth={2.5} />);
      // shop window band + awning
      out.push(<path key={`s${si}${b}`} d={q([at(0.06, 0.03), at(0.94, 0.03), at(0.94, 0.2), at(0.06, 0.2)])} fill={mixHex(C.buildingShade, C.ink, 0.35)} stroke={ink(0.8)} strokeWidth={3} />);
      if ((b + si) % 2 === 0) {
        const flap = Math.sin(f * 0.11 + b * 1.7) * 0.012 + wander(f * 0.03, b + si * 7) * 0.01;
        const a0 = at(0.04, 0.24), a1 = at(0.96, 0.24);
        const push = (p: Pt, k: number): Pt => ({x: p.x + (VP.x - p.x) * k, y: p.y + (VP.y - p.y) * (k * 0.25) + 20});
        const k = 0.16 + flap;
        const o0 = push(at(0.04, 0.16), k), o1 = push(at(0.96, 0.16), k);
        const stripes: string[] = [];
        for (let i = 0; i < 8; i += 2) {
          const s0 = i / 8, s1 = (i + 1) / 8;
          stripes.push(q([{x: lerp(a0.x, a1.x, s0), y: lerp(a0.y, a1.y, s0)}, {x: lerp(a0.x, a1.x, s1), y: lerp(a0.y, a1.y, s1)}, {x: lerp(o0.x, o1.x, s1), y: lerp(o0.y, o1.y, s1)}, {x: lerp(o0.x, o1.x, s0), y: lerp(o0.y, o1.y, s0)}]));
        }
        out.push(
          <g key={`a${si}${b}`}>
            <path d={q([a0, a1, o1, o0])} fill={C.cream} stroke={ink()} strokeWidth={3.5} strokeLinejoin="round" />
            <path d={stripes.join(' ')} fill={b % 4 === 0 ? C.awning : C.wardTeal} />
            <path d={`M${n1(o0.x)},${n1(o0.y)} L${n1(o1.x)},${n1(o1.y)}`} stroke={ink()} strokeWidth={4} />
          </g>,
        );
      }
    }
  });
  return <g>{out}</g>;
};

// ---------------------------------------------------------------------------------- ground
export const StreetGround: React.FC<{id: string; f: number}> = ({id, f}) => {
  const curbL = {x: -380, y: 1920}, curbR = {x: 1460, y: 1920};
  const facL = {x: -60, y: 1520}, facR = {x: 1140, y: 1520};
  const ext = (p: Pt, y: number): Pt => ({x: VP.x + (p.x - VP.x) * (y - VP.y) / (p.y - VP.y), y});
  // zebra crossing (near), stripes running toward the VP
  const zb: string[] = [];
  for (let i = -5; i <= 5; i++) {
    const nx = 540 + i * 170;
    const a = {x: nx - 50, y: 1920}, b = {x: nx + 50, y: 1920};
    const yTop = 1560, yBot = 1940;
    const pa = ext(a, yTop), pb = ext(b, yTop), qa = ext(a, yBot), qb = ext(b, yBot);
    zb.push(q([pa, pb, qb, qa]));
  }
  const cracks = 'M120,1700 l40,-20 l30,10 l50,-30 M820,1480 l-30,30 l10,40 M300,1300 l60,8 l20,-14';
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-asp`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={mixHex(C.asphaltLight, C.hotSkyLow, 0.5)} />
          <stop offset={0.3} stopColor={C.asphaltLight} />
          <stop offset={1} stopColor={C.asphalt} />
        </linearGradient>
      </defs>
      <path d={q([{x: -400, y: 1960}, {x: 1480, y: 1960}, VP])} fill={`url(#${id}-asp)`} />
      {/* sidewalks */}
      <path d={q([ext(facL, 1960), ext(curbL, 1960), VP])} fill={mixHex(C.concrete, C.hotSun, 0.2)} />
      <path d={q([ext(curbR, 1960), ext(facR, 1960), VP])} fill={mixHex(C.concrete, C.concreteShade, 0.4)} />
      <path d={`M${n1(ext(curbL, 1960).x)},1960 L${VP.x},${VP.y} L${n1(ext(curbR, 1960).x)},1960`} fill="none" stroke={ink()} strokeWidth={5} />
      <path d={`M${n1(ext(curbL, 1960).x + 30)},1960 L${VP.x},${VP.y} L${n1(ext(curbR, 1960).x - 30)},1960`} fill="none" stroke={C.concreteShade} strokeWidth={10} opacity={0.6} />
      {/* faded centre line */}
      {Array.from({length: 7}, (_, i) => {
        const t0 = 1 - Math.pow(0.62, i), t1 = 1 - Math.pow(0.62, i + 0.45);
        const y0 = lerp(1540, VP.y, t0), y1 = lerp(1540, VP.y, t1);
        const w0 = lerp(12, 1, t0), w1 = lerp(12, 1, t1);
        return <path key={i} d={q([{x: 540 - w0, y: y0}, {x: 540 + w0, y: y0}, {x: 540 + w1, y: y1}, {x: 540 - w1, y: y1}])} fill={C.alarmLight} opacity={0.6} />;
      })}
      <path d={zb.join(' ')} fill={mixHex(C.cream, C.hotSkyLow, 0.3)} opacity={0.9} />
      <path d={zb.join(' ')} fill="none" stroke={ink(0.35)} strokeWidth={3} />
      <path d={cracks} fill="none" stroke={C.asphalt} strokeWidth={4} opacity={0.7} />
      {/* manhole cover */}
      <ellipse cx={860} cy={1380} rx={70} ry={20} fill={C.asphalt} stroke={ink(0.8)} strokeWidth={3} />
      <ellipse cx={860} cy={1378} rx={52} ry={13} fill="none" stroke={C.asphaltLight} strokeWidth={3} opacity={0.7} />
      {/* sun glare on the asphalt */}
      <ellipse cx={420} cy={1180} rx={260} ry={40} fill={C.hotSkyLow} opacity={0.18 + 0.06 * Math.sin(f * 0.07)} />
    </g>
  );
};

/** Street furniture at the top: power lines + a hanging traffic light (sway). */
export const StreetWires: React.FC<{f: number}> = ({f}) => {
  const sw = wander(f * 0.02, 66) * 10;
  return (
    <g>
      <path d={`M-40,260 Q540,${n1(380 + sw)} 1120,230`} fill="none" stroke={C.ink} strokeWidth={4} opacity={0.8} />
      <path d={`M-40,330 Q540,${n1(470 + sw * 1.2)} 1120,300`} fill="none" stroke={C.ink} strokeWidth={3} opacity={0.7} />
      <g transform={`translate(${n1(700 + sw * 0.4)},${n1(372 + sw * 0.8)}) rotate(${n1(sw * 0.4)})`}>
        <path d="M0,-40 V0" stroke={C.ink} strokeWidth={4} />
        <rect x={-34} y={0} width={68} height={170} rx={10} fill={C.hoodie} stroke={ink()} strokeWidth={4} />
        <circle cx={0} cy={34} r={20} fill={mixHex(C.hudBad, C.ink, 0.5)} />
        <circle cx={0} cy={85} r={20} fill={C.lampGlow} />
        <circle cx={0} cy={136} r={20} fill={mixHex(C.pathGood, C.ink, 0.5)} />
        <path d="M-24,2 L-24,160" stroke={C.hoodieLight} strokeWidth={4} opacity={0.6} />
      </g>
    </g>
  );
};

/** Rising heat shimmer: wavy translucent ribbons drifting up over the asphalt (+ over him). */
export const HeatShimmer: React.FC<{f: number; amt: number; y0?: number; y1?: number; seed?: number}> = ({f, amt, y0 = 980, y1 = 1960, seed = 1}) => {
  const els: React.ReactNode[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const sp = 0.6 + hash(i, seed) * 0.8;
    const span = y1 - y0;
    const yy = y1 - ((((hash(i, seed + 1) * span + f * 2.2 * sp) % span) + span) % span);
    const depth = (yy - VP.y) / (1920 - VP.y);
    const w = 160 + 520 * depth;
    const cx = 540 + (hash(i, seed + 2) - 0.5) * 900 * depth;
    let d = '';
    for (let k = 0; k <= 10; k++) {
      const x = cx - w / 2 + (w * k) / 10;
      const y = yy + Math.sin(k * 1.3 + f * 0.25 + i) * (3 + 7 * depth);
      d += `${k ? 'L' : 'M'}${n1(x)},${n1(y)} `;
    }
    const life = Math.sin(Math.PI * clamp((yy - y0) / span));
    els.push(<path key={i} d={d} fill="none" stroke={i % 3 ? C.hotSkyLow : C.heatLight} strokeWidth={2 + 5 * depth} strokeLinecap="round" opacity={amt * life * (0.25 + 0.2 * hash(i, seed + 3))} />);
  }
  return <g>{els}</g>;
};

/** "NO SWEAT" magnifier: dry skin, open pores, no droplets (a ghost drop that isn't there). */
export const NoSweatInset: React.FC<{id: string; f: number; x: number; y: number; r: number; t: number}> = ({id, f, x, y, r, t}) => {
  if (t <= 0.01) return null;
  const sc = t;
  const cracks: string[] = [];
  for (let i = 0; i < 9; i++) {
    const ax = -r + hash(i, 5) * 2 * r, ay = -r + hash(i, 6) * 2 * r;
    cracks.push(`M${n1(ax)},${n1(ay)} l${n1(30 + 30 * hash(i, 7))},${n1(-10 + 20 * hash(i, 8))} l${n1(20 * hash(i, 9))},${n1(16 + 10 * hash(i, 10))}`);
  }
  const pores = [
    [-40, -30],
    [36, 10],
    [-10, 44],
    [52, -50],
  ];
  const ghost = 0.35 + 0.25 * Math.sin(f * 0.2);
  return (
    <g transform={`translate(${n1(x)},${n1(y)}) scale(${n1(sc)})`}>
      <defs>
        <clipPath id={`${id}-c`}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r + 10} fill={C.navyDeep} opacity={0.6} />
      <g clipPath={`url(#${id}-c)`}>
        <rect x={-r} y={-r} width={2 * r} height={2 * r} fill={mixHex(C.skinDry, C.heatLight, 0.15)} />
        <path d={cracks.join(' ')} fill="none" stroke={C.skinShade} strokeWidth={3} opacity={0.8} />
        {pores.map(([px, py], i) => (
          <g key={i}>
            <ellipse cx={px} cy={py} rx={9} ry={6} fill={C.skinDeep} />
            <ellipse cx={px} cy={py - 1} rx={5} ry={3} fill={C.ink} opacity={0.7} />
          </g>
        ))}
        {/* the drop that should be there — absent (dashed ghost, crossed) */}
        <g transform={`translate(26,-6)`} opacity={ghost}>
          <path d="M0,-34 C14,-14 20,-2 20,8 A20,20 0 0 1 -20,8 C-20,-2 -14,-14 0,-34 Z" fill="none" stroke={C.water} strokeWidth={4} strokeDasharray="7 6" />
        </g>
        <path d="M-6,-44 L60,30" stroke={C.heat} strokeWidth={8} strokeLinecap="round" opacity={0.9} />
        <Glow id={`${id}-hot`} x={0} y={0} r={r} color={C.heat} a={0.25} />
      </g>
      <circle r={r} fill="none" stroke={C.cream} strokeWidth={6} />
      <circle r={r + 6} fill="none" stroke={ink()} strokeWidth={3} />
    </g>
  );
};

/** Thermometer tag: a glass tube whose heat-coloured column rises 37.0 → 39.5 °C, mono read-out. */
export const Thermo: React.FC<{x: number; y: number; t: number; temp: number; pop: number; f: number}> = ({x, y, t, temp, pop, f}) => {
  if (pop <= 0.01) return null;
  const H = 300;
  const col = mixHex(mixHex(C.heatLight, C.heat, clamp(t * 1.6)), C.heatDeep, clamp(t * 2 - 1));
  const lvl = lerp(0.42, 0.9, t);
  const wob = Math.sin(f * 0.3) * 2 * t;
  return (
    <g transform={`translate(${n1(x)},${n1(y)}) scale(${n1(pop)})`}>
      <rect x={-62} y={-H - 70} width={262} height={H + 160} rx={18} fill={rgba(C.navyDeep, 0.62)} stroke={rgba(C.heatLight, 0.5)} strokeWidth={2} />
      <Glow id="s11thg" x={0} y={30} r={90 + 30 * t} color={col} a={0.35 + 0.4 * t} />
      <rect x={-16} y={-H} width={32} height={H + 20} rx={16} fill={C.cream} stroke={ink()} strokeWidth={4} />
      <rect x={-8} y={n1(-H * lvl + wob)} width={16} height={n1(H * lvl + 20 - wob)} fill={col} />
      <circle cx={0} cy={30} r={32} fill={col} stroke={ink()} strokeWidth={4} />
      <circle cx={-10} cy={20} r={8} fill="#fff" opacity={0.6} />
      {Array.from({length: 7}, (_, i) => (
        <path key={i} d={`M18,${n1(-H * 0.2 - i * H * 0.12)} h${i % 2 ? 10 : 18}`} stroke={C.cream} strokeWidth={3} />
      ))}
      <text x={50} y={-H * 0.5} fontFamily={MONO} fontWeight={600} fontSize={52} fill={mixHex(col, C.cream, 0.45)} letterSpacing={1}>
        {temp.toFixed(1)}
      </text>
      <text x={56} y={-H * 0.5 + 48} fontFamily={MONO} fontWeight={600} fontSize={34} fill={C.cream}>
        °C
      </text>
      <text x={56} y={-H * 0.5 + 100} fontFamily={MONO} fontWeight={500} fontSize={20} fill={rgba(C.cream, 0.75)}>
        BODY
      </text>
    </g>
  );
};
