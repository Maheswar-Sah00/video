import React from 'react';
import {C} from '../../lib/palette';
import {hash, mixHex, noise1, rgba, wander} from '../../lib/anim';
import {Glow, ink, n1} from './kit';

/** S10 set: a bathroom mirror ('bath': cool white vanity light from above-front). */

export const MIR = {x: 150, y: 400, w: 780, h: 930, r: 34};

const tileGrid = (x0: number, y0: number, x1: number, y1: number, t: number, ox = 0, oy = 0) => {
  let d = '';
  for (let x = x0 + (ox % t); x <= x1; x += t) d += `M${n1(x)},${y0} V${y1} `;
  for (let y = y0 + (oy % t); y <= y1; y += t) d += `M${x0},${n1(y)} H${x1} `;
  return d;
};

/** Wall tiles, upper cabinet, vanity light bar (the far wall around the mirror). */
export const BathWall: React.FC<{id: string; f: number}> = ({id, f}) => {
  const hum = 0.92 + 0.05 * noise1(f * 0.08, 3) + 0.03 * Math.sin(f * 0.5);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-wall`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={mixHex(C.bathTile, C.bathLight, 0.5)} />
          <stop offset={0.5} stopColor={C.bathTile} />
          <stop offset={1} stopColor={mixHex(C.bathTile, C.bathTileShade, 0.6)} />
        </linearGradient>
      </defs>
      <rect x={-200} y={-200} width={1480} height={2400} fill={`url(#${id}-wall)`} />
      <path d={tileGrid(-200, 240, 1280, 2100, 96, 30, 12)} stroke={C.bathTileShade} strokeWidth={4} opacity={0.75} />
      <path d={tileGrid(-200, 240, 1280, 2100, 96, 33, 15)} stroke="#fff" strokeWidth={2} opacity={0.5} />
      {/* a row of accent tiles */}
      <rect x={-200} y={1188} width={1480} height={30} fill={mixHex(C.wardTeal, C.bathTile, 0.45)} opacity={0.75} />
      {/* ceiling + cabinet */}
      <rect x={-200} y={-200} width={1480} height={280} fill={mixHex(C.bathLight, C.bathTile, 0.3)} />
      <path d="M-200,80 H1280" stroke={ink(0.6)} strokeWidth={4} />
      <g>
        <rect x={150} y={60} width={780} height={196} rx={10} fill={mixHex(C.cream, C.bathTile, 0.35)} stroke={ink()} strokeWidth={5} />
        <rect x={150} y={226} width={780} height={30} fill={C.bathTileShade} opacity={0.6} />
        <path d="M540,70 V226" stroke={ink(0.8)} strokeWidth={4} />
        <rect x={170} y={78} width={350} height={140} rx={6} fill="none" stroke={C.bathTileShade} strokeWidth={4} />
        <rect x={560} y={78} width={350} height={140} rx={6} fill="none" stroke={C.bathTileShade} strokeWidth={4} />
        <rect x={505} y={140} width={10} height={44} rx={5} fill={C.chrome} stroke={ink()} strokeWidth={2.5} />
        <rect x={565} y={140} width={10} height={44} rx={5} fill={C.chrome} stroke={ink()} strokeWidth={2.5} />
        <path d="M190,96 L250,96" stroke="#fff" strokeWidth={6} opacity={0.6} />
      </g>
      {/* vanity light bar (gentle fluorescent hum, no flicker) */}
      <Glow id={`${id}-vglow`} x={540} y={330} r={520} rx={620} ry={300} color={C.bathLight} a={0.85 * hum} />
      <rect x={250} y={300} width={580} height={30} rx={15} fill={C.chrome} stroke={ink()} strokeWidth={4} />
      {[340, 540, 740].map((bx, i) => (
        <g key={i}>
          <Glow id={`${id}-b${i}`} x={bx} y={350} r={110} color={C.bathLight} a={hum} />
          <circle cx={bx} cy={350} r={36} fill={mixHex(C.bathLight, '#ffffff', 0.6)} stroke={ink(0.8)} strokeWidth={3.5} />
          <circle cx={bx - 10} cy={340} r={12} fill="#fff" />
        </g>
      ))}
    </g>
  );
};

/** The reflected room behind him (inside the mirror): darker tiles, a doorway, a towel. */
export const ReflectedRoom: React.FC<{id: string; f: number}> = ({id, f}) => {
  const sw = wander(f * 0.03, 12) * 4;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-rr`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={mixHex(C.bathTileShade, C.jeansLight, 0.35)} />
          <stop offset={1} stopColor={mixHex(C.jeansLight, C.jeans, 0.6)} />
        </linearGradient>
      </defs>
      <rect x={0} y={250} width={1080} height={1300} fill={`url(#${id}-rr)`} />
      <path d={tileGrid(0, 250, 1080, 1550, 70, 10, 30)} stroke={mixHex(C.bathTileShade, C.jeans, 0.25)} strokeWidth={3} opacity={0.6} />
      {/* doorway, right */}
      <rect x={760} y={420} width={260} height={1100} fill={mixHex(C.jeans, C.bathTileShade, 0.5)} stroke={ink(0.7)} strokeWidth={4} />
      <rect x={740} y={400} width={300} height={24} fill={C.cream} stroke={ink(0.7)} strokeWidth={3} opacity={0.8} />
      <path d="M790,520 L990,470 L990,1500 L790,1500 Z" fill={C.lamp} opacity={0.12} />
      {/* towel on a hook, left */}
      <g transform={`rotate(${n1(sw * 0.4)},250,560)`}>
        <circle cx={250} cy={560} r={9} fill={C.chrome} stroke={ink(0.7)} strokeWidth={3} />
        <path d={`M180,570 Q250,552 320,570 L${n1(330 + sw)},900 Q250,${n1(924 + sw)} ${n1(170 + sw)},900 Z`} fill={C.wardTeal} stroke={ink(0.7)} strokeWidth={4} strokeLinejoin="round" />
        <path d={`M200,600 L${n1(194 + sw)},880 M300,600 L${n1(306 + sw)},880`} stroke={C.wardTealDeep} strokeWidth={8} opacity={0.6} />
        <path d={`M${n1(176 + sw)},850 H${n1(326 + sw)}`} stroke={C.cream} strokeWidth={10} opacity={0.7} />
      </g>
      {/* shower curtain sliver, far left */}
      <path d={`M0,300 L120,300 Q${n1(110 + sw * 2)},900 ${n1(130 + sw * 3)},1500 L0,1500 Z`} fill={mixHex(C.bathLight, C.mirrorGlass, 0.4)} opacity={0.85} />
      {[20, 60, 100].map((x, i) => (
        <path key={i} d={`M${x},300 Q${n1(x - 6 + sw * 2)},900 ${n1(x + 6 + sw * 3)},1500`} stroke={C.mirrorGlass} strokeWidth={8} fill="none" opacity={0.7} />
      ))}
      {/* the vanity light, seen behind his head in the mirror */}
      <Glow id={`${id}-rl`} x={540} y={330} r={360} color={C.bathLight} a={0.5} />
    </g>
  );
};

/** Mirror glass overlay (inside the mirror clip): tint, sliding streaks, edge falloff. */
export const MirrorGlass: React.FC<{id: string; f: number; slide: number}> = ({id, f, slide}) => {
  const {x, y, w, h} = MIR;
  const o = slide;
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-edge`} cx="50%" cy="45%" r="70%">
          <stop offset={0.6} stopColor={C.mirrorGlass} stopOpacity={0} />
          <stop offset={1} stopColor={C.jeans} stopOpacity={0.28} />
        </radialGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={C.mirrorGlass} opacity={0.05} />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id}-edge)`} />
      <path d={`M${n1(x + 60 + o)},${y + h} L${n1(x + 360 + o)},${y} L${n1(x + 450 + o)},${y} L${n1(x + 150 + o)},${y + h} Z`} fill="#fff" opacity={0.09} />
      <path d={`M${n1(x + 200 + o * 1.3)},${y + h} L${n1(x + 500 + o * 1.3)},${y} L${n1(x + 520 + o * 1.3)},${y} L${n1(x + 220 + o * 1.3)},${y + h} Z`} fill="#fff" opacity={0.08} />
      {/* dried water spots */}
      {Array.from({length: 9}, (_, i) => (
        <circle key={i} cx={n1(x + 60 + hash(i, 5) * (w - 120))} cy={n1(y + h * 0.6 + hash(i, 6) * h * 0.36)} r={n1(3 + 5 * hash(i, 7))} fill="none" stroke="#fff" strokeWidth={2} opacity={0.25 + 0.1 * Math.sin(f * 0.05 + i)} />
      ))}
    </g>
  );
};

/** Soft drop shadow of the mirror on the tiles (draw BEFORE the mirror). */
export const MirrorShadow: React.FC = () => {
  const {x, y, w, h, r} = MIR;
  return <rect x={x - 6} y={y + 12} width={w + 30} height={h + 24} rx={r + 10} fill={C.bathTileShade} opacity={0.55} />;
};

export const MirrorFrame: React.FC<{id: string; f: number}> = ({id, f}) => {
  const {x, y, w, h, r} = MIR;
  const gl = 0.5 + 0.3 * Math.sin(f * 0.04);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={C.chromeShade} strokeWidth={26} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={C.chrome} strokeWidth={16} />
      <rect x={x - 13} y={y - 13} width={w + 26} height={h + 26} rx={r + 12} fill="none" stroke={ink()} strokeWidth={4.5} />
      <rect x={x + 13} y={y + 13} width={w - 26} height={h - 26} rx={r - 10} fill="none" stroke={ink(0.8)} strokeWidth={3} />
      <path d={`M${x + 40},${y - 4} H${x + 300}`} stroke="#fff" strokeWidth={5} opacity={gl} strokeLinecap="round" />
      <path d={`M${x - 4},${y + 60} V${y + 260}`} stroke="#fff" strokeWidth={5} opacity={gl * 0.7} strokeLinecap="round" />
    </g>
  );
};

/** Counter, basin, the DRY tap, toothbrush cup, soap; cabinet below. */
export const Sink: React.FC<{id: string; f: number}> = ({id, f}) => {
  const top = 1420;
  const gl = 0.6 + 0.3 * Math.sin(f * 0.06);
  const counter = mixHex(C.cream, C.bathTile, 0.4);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-ct`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={mixHex(counter, C.bathTileShade, 0.25)} />
          <stop offset={1} stopColor={counter} />
        </linearGradient>
        <radialGradient id={`${id}-bs`} cx="50%" cy="35%" r="65%">
          <stop offset={0} stopColor={C.bathTileShade} />
          <stop offset={0.7} stopColor={mixHex(C.bathTile, '#ffffff', 0.4)} />
          <stop offset={1} stopColor="#ffffff" />
        </radialGradient>
      </defs>
      {/* backsplash lip */}
      <rect x={-200} y={top - 30} width={1480} height={34} fill={counter} stroke={ink()} strokeWidth={4} />
      {/* counter top */}
      <path d={`M-200,${top} H1280 V1760 H-200 Z`} fill={`url(#${id}-ct)`} />
      <path d={`M-200,${top} H1280`} stroke={ink()} strokeWidth={4} />
      {/* basin */}
      <ellipse cx={540} cy={1600} rx={300} ry={100} fill={mixHex(counter, C.bathTileShade, 0.3)} stroke={ink()} strokeWidth={5} />
      <ellipse cx={540} cy={1608} rx={278} ry={86} fill={`url(#${id}-bs)`} />
      <ellipse cx={540} cy={1640} rx={30} ry={11} fill={C.chromeShade} stroke={ink(0.8)} strokeWidth={3} />
      <path d="M300,1580 Q420,1520 620,1530" fill="none" stroke="#fff" strokeWidth={8} opacity={0.6} strokeLinecap="round" />
      {/* the tap — bone dry */}
      <g>
        <rect x={500} y={top - 10} width={80} height={40} rx={10} fill={C.chromeShade} stroke={ink()} strokeWidth={4} />
        <path d="M540,1420 C540,1330 560,1300 610,1300 C660,1300 680,1330 680,1370 L680,1420" fill="none" stroke={C.ink} strokeWidth={36} strokeLinecap="round" />
        <path d="M540,1420 C540,1330 560,1300 610,1300 C660,1300 680,1330 680,1370 L680,1420" fill="none" stroke={C.chrome} strokeWidth={26} strokeLinecap="round" />
        <path d="M552,1390 C552,1340 568,1316 610,1314" fill="none" stroke="#fff" strokeWidth={6} opacity={gl} strokeLinecap="round" />
        <ellipse cx={680} cy={1426} rx={15} ry={6} fill={C.ink} />
        {/* handles */}
        {[420, 660].map((hx, i) => (
          <g key={i}>
            <rect x={hx - 30} y={top - 4} width={60} height={26} rx={8} fill={C.chromeShade} stroke={ink()} strokeWidth={3.5} />
            <rect x={hx - 40} y={top - 22} width={80} height={22} rx={10} fill={C.chrome} stroke={ink()} strokeWidth={3.5} />
            <circle cx={hx} cy={top - 11} r={5} fill={i ? C.hudBad : C.waterDeep} />
          </g>
        ))}
        {/* a dry mineral ring where water used to drip */}
        <ellipse cx={690} cy={1612} rx={22} ry={7} fill="none" stroke={C.bathTileShade} strokeWidth={3} />
      </g>
      {/* toothbrush cup (right) + soap (left) */}
      <g>
        <path d="M842,1400 L884,1420 L926,1290" fill="none" stroke={C.ink} strokeWidth={14} strokeLinecap="round" />
        <path d="M842,1400 L884,1420 L926,1290" fill="none" stroke={C.wardTeal} strokeWidth={8} strokeLinecap="round" />
        <path d="M876,1400 L930,1280" fill="none" stroke={C.ink} strokeWidth={14} strokeLinecap="round" />
        <path d="M876,1400 L930,1280" fill="none" stroke={C.awning} strokeWidth={8} strokeLinecap="round" />
        <path d="M830,1360 L930,1360 L920,1470 L840,1470 Z" fill={mixHex(C.mirrorGlass, '#ffffff', 0.3)} stroke={ink()} strokeWidth={4} strokeLinejoin="round" />
        <path d="M846,1372 L852,1458" stroke="#fff" strokeWidth={6} opacity={0.7} />
      </g>
      <g>
        <rect x={150} y={1330} width={100} height={140} rx={18} fill={C.duskMid} stroke={ink()} strokeWidth={4} />
        <rect x={180} y={1290} width={40} height={42} fill={C.chrome} stroke={ink()} strokeWidth={3.5} />
        <path d="M200,1294 L200,1272 L248,1272" fill="none" stroke={C.ink} strokeWidth={12} strokeLinecap="round" />
        <path d="M200,1294 L200,1272 L248,1272" fill="none" stroke={C.chrome} strokeWidth={6} strokeLinecap="round" />
        <path d="M166,1350 L168,1450" stroke="#fff" strokeWidth={7} opacity={0.5} />
      </g>
      {/* counter front + cabinet doors */}
      <rect x={-200} y={1760} width={1480} height={40} fill={counter} stroke={ink()} strokeWidth={4} />
      <rect x={-200} y={1800} width={1480} height={200} fill={mixHex(C.wood, C.bathTileShade, 0.35)} />
      <path d="M540,1800 V2000" stroke={ink()} strokeWidth={4} />
      <rect x={490} y={1830} width={12} height={60} rx={6} fill={C.chrome} stroke={ink()} strokeWidth={3} />
      <rect x={578} y={1830} width={12} height={60} rx={6} fill={C.chrome} stroke={ink()} strokeWidth={3} />
      <path d="M-200,1806 H1280" stroke={rgba(C.ink, 0.35)} strokeWidth={10} />
    </g>
  );
};

/** The skin tent on the back of his (foreshortened, lying-flat) hand: a pinched fold rising as a
 *  ridge (screen-up) that stays up and sinks back slowly. (x,y) = base centre on the skin, h 0..1. */
export const SkinTent: React.FC<{x: number; y: number; h: number; len?: number; skin: string; shade: string; light: string}> = ({x, y, h, len = 124, skin, shade, light}) => {
  if (h < 0.02) return null;
  const a = len / 2;
  const up = 80 * h;
  const ridge = `M${-a - 14},6 C${n1(-a * 0.55)},4 ${n1(-a * 0.3)},${n1(-up * 0.96)} 0,${n1(-up)} C${n1(a * 0.3)},${n1(-up * 0.96)} ${n1(a * 0.55)},4 ${a + 14},6 C${n1(a * 0.5)},${n1(12 + 6 * h)} ${n1(-a * 0.5)},${n1(12 + 6 * h)} ${-a - 14},6 Z`;
  return (
    <g transform={`translate(${n1(x)},${n1(y)})`}>
      {/* stretched skin lines converging on the fold */}
      <path d={`M${-a - 46},${n1(-2)} Q${n1(-a * 0.5)},${n1(-6 - 6 * h)} ${n1(-a * 0.2)},${n1(-up * 0.5)} M${a + 46},${n1(-2)} Q${n1(a * 0.5)},${n1(-6 - 6 * h)} ${n1(a * 0.2)},${n1(-up * 0.5)}`} fill="none" stroke={shade} strokeWidth={3.5} opacity={0.75 * h} strokeLinecap="round" />
      {/* soft shadow the fold casts on the hand */}
      <ellipse cx={12} cy={n1(12 + 4 * h)} rx={a + 20} ry={n1(9 + 9 * h)} fill={C.inkSoft} opacity={0.35 * h} />
      <path d={ridge} fill={skin} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
      {/* shaded far half + lit crest */}
      <path d={`M0,${n1(-up)} C${n1(a * 0.3)},${n1(-up * 0.96)} ${n1(a * 0.55)},4 ${a + 14},6 C${n1(a * 0.5)},${n1(12 + 6 * h)} ${n1(a * 0.1)},${n1(14 + 6 * h)} ${n1(a * 0.1)},${n1(10)} C${n1(a * 0.12)},${n1(-up * 0.4)} ${n1(a * 0.05)},${n1(-up * 0.8)} 0,${n1(-up)} Z`} fill={shade} opacity={0.75} />
      <path d={`M${n1(-a * 0.42)},${n1(-up * 0.42)} C${n1(-a * 0.24)},${n1(-up * 0.88)} ${n1(-a * 0.08)},${n1(-up * 0.95)} 0,${n1(-up * 0.98)}`} fill="none" stroke={light} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
      <path d={`M${n1(-a * 0.6)},10 Q0,${n1(18 + 4 * h)} ${n1(a * 0.6)},10`} fill="none" stroke={shade} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
    </g>
  );
};
