import React from 'react';
import {C} from '../../lib/palette';
import {blob, clamp, hash, lerp, mixHex, rgba, wander} from '../../lib/anim';
import {BookRow, CelRect, CurtainPanel, INK, Motes, ink, n1} from './kit';

/**
 * S16 BEDROOM in the last evening light (owner: home). World coords = screen at rest. `p` 0..1 =
 * how far the light has sunk (0 = orange dusk, 1 = deep blue). Single bed along the back wall,
 * head end on the LEFT (nightstand + empty glass beside it), the window above the bed top-right.
 * Layers: BRBack (wall, window, curtains, poster, shelf, nightstand), BRBed (headboard, mattress,
 * pillow), BRDuvet (the duvet over him, drawn after his head), BRFloor (floor corner, slippers),
 * BRLight (window light on the bed, the light shaft + dust).
 */

export const brCols = (p: number) => {
  const t = clamp(p);
  return {
    wall: mixHex(mixHex(C.cityDuskLight, C.duskMid, 0.22), mixHex(C.roomNightLight, C.duskTop, 0.25), t),
    wallDeep: mixHex(mixHex(C.cityDusk, C.roomNight, 0.3), C.roomNight, t),
    tint: mixHex(mixHex(C.cityDusk, C.duskMid, 0.15), C.duskTop, t),
    warm: mixHex(C.duskLow, C.duskMid, t * 0.8),
    wood: mixHex(mixHex(C.wood, C.cityDusk, 0.35), mixHex(C.wood, C.roomNight, 0.6), t),
    woodShade: mixHex(mixHex(C.woodShade, C.roomNight, 0.45), mixHex(C.woodShade, C.roomNight, 0.7), t),
    woodLit: mixHex(mixHex(C.woodLight, C.duskLow, 0.5), mixHex(C.woodLight, C.duskTop, 0.5), t),
    sheet: mixHex(mixHex(C.bedSheet, C.duskMid, 0.12), mixHex(C.bedSheet, C.duskTop, 0.45), t),
    sheetShade: mixHex(mixHex(C.bedSheetShade, C.cityDusk, 0.3), mixHex(C.bedSheetShade, C.roomNight, 0.55), t),
    duvet: mixHex(mixHex(C.duvet, C.duskMid, 0.12), mixHex(C.duvet, C.duskTop, 0.4), t),
    duvetShade: mixHex(mixHex(C.duvetShade, C.cityDusk, 0.3), mixHex(C.duvetShade, C.roomNight, 0.55), t),
    duvetLit: mixHex(mixHex(C.duvet, C.duskLow, 0.4), mixHex(C.duvet, C.duskTop, 0.2), t),
  };
};

const WX0 = 560, WX1 = 1010, WY0 = 110, WY1 = 760;

/** Back wall, window (dusk sky darkening), curtains, poster, shelf with a drooping plant, nightstand. */
export const BRBack: React.FC<{f: number; id: string; p: number; wind: number}> = ({f, id, p, wind}) => {
  const c = brCols(p);
  const skyTop = mixHex(mixHex(C.duskTop, C.cityDusk, 0.2), C.navyDeep, p);
  const skyMid = mixHex(C.duskMid, mixHex(C.duskTop, C.navyDeep, 0.3), p);
  const skyLow = mixHex(C.duskLow, mixHex(C.duskMid, C.duskTop, 0.55), Math.pow(p, 0.8));
  const glowO = 1 - p * 0.85;
  const star = clamp((p - 0.45) / 0.3) * (0.75 + 0.25 * Math.sin(f * 0.07));
  const roofs: React.ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const rx = WX0 - 20 + i * 72 + 18 * hash(i, 3);
    const rh = 60 + 90 * hash(i, 4);
    roofs.push(<path key={i} d={`M${n1(rx)},${WY1} L${n1(rx)},${n1(WY1 - rh)} L${n1(rx + 36)},${n1(WY1 - rh - 26 * hash(i, 5))} L${n1(rx + 74)},${n1(WY1 - rh)} L${n1(rx + 74)},${WY1} Z`} fill={mixHex(mixHex(C.cityDusk, C.ink, 0.3), C.navyDeep, p * 0.6)} />);
  }
  let litW = '';
  for (let i = 0; i < 14; i++) if (hash(i, 8) > 0.35 && p > hash(i, 9) * 0.6) litW += `M${n1(WX0 + 20 + hash(i, 10) * 420)},${n1(WY1 - 20 - hash(i, 11) * 90)} h8 v10 h-8 Z `;
  const leaves: React.ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const sw = wander(f * 0.025 + i * 0.6, 31) * 10 * wind;
    leaves.push(<path key={i} d={blob(WX1 - 60 - 60 * hash(i, 32) + sw, WY0 + 120 + i * 70, 60 + 26 * hash(i, 33), i + 40, 0.3, 9, f * 0.012)} fill={mixHex(mixHex(C.cityDusk, C.ink, 0.5), C.navyDeep, p * 0.5)} />);
  }
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-sky`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={skyTop} />
          <stop offset={0.55} stopColor={skyMid} />
          <stop offset={0.92} stopColor={skyLow} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx={0.5} cy={1} r={0.7}>
          <stop offset={0} stopColor={C.duskSun} stopOpacity={0.9} />
          <stop offset={0.5} stopColor={C.duskLow} stopOpacity={0.35} />
          <stop offset={1} stopColor={C.duskLow} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-wall`} x1={0} y1={0} x2={1} y2={0.4}>
          <stop offset={0} stopColor={c.wallDeep} />
          <stop offset={1} stopColor={c.wall} />
        </linearGradient>
        <clipPath id={`${id}-win`}>
          <rect x={WX0} y={WY0} width={WX1 - WX0} height={WY1 - WY0} />
        </clipPath>
      </defs>
      <rect x={-500} y={-500} width={2100} height={1560} fill={`url(#${id}-wall)`} />
      {/* ceiling corner */}
      <path d="M-500,-60 L1600,-60 L1600,-500 L-500,-500 Z" fill={mixHex(c.wallDeep, C.ink, 0.25)} />
      <path d="M-500,-60 L1600,-60" stroke={mixHex(c.wall, c.warm, 0.25)} strokeWidth={16} />
      <path d="M-500,-70 L1600,-70" stroke={ink()} strokeWidth={INK} />
      {/* window */}
      <g clipPath={`url(#${id}-win)`}>
        <rect x={WX0} y={WY0} width={WX1 - WX0} height={WY1 - WY0} fill={`url(#${id}-sky)`} />
        <ellipse cx={(WX0 + WX1) / 2 + 60} cy={WY1} rx={420} ry={260} fill={`url(#${id}-glow)`} opacity={glowO} />
        {[0, 1, 2].map((i) => (
          <ellipse key={i} cx={n1(WX0 + ((hash(i, 21) * 500 + f * (0.25 + 0.1 * i)) % 560) - 40)} cy={n1(WY0 + 140 + i * 110)} rx={n1(120 + 40 * hash(i, 22))} ry={12} fill={mixHex(mixHex(C.duskMid, C.cream, 0.3), C.duskTop, p)} opacity={0.6} />
        ))}
        <circle cx={WX0 + 120} cy={WY0 + 110} r={20} fill={C.cream} opacity={0.25 + 0.6 * p} />
        <circle cx={WX0 + 130} cy={WY0 + 104} r={18} fill={skyTop} opacity={0.95} />
        <path d={`M${WX1 - 110},${WY0 + 90} l4,-14 l4,14 l14,4 l-14,4 l-4,14 l-4,-14 l-14,-4 Z`} fill={C.cream} opacity={star} />
        <circle cx={WX0 + 300} cy={WY0 + 60} r={2.5} fill={C.cream} opacity={star * 0.8} />
        {leaves}
        {roofs}
        <path d={litW} fill={C.lamp} opacity={0.85} />
        <path d={`M${WX0 + 60},${WY1} L${WX0 + 230},${WY0} L${WX0 + 290},${WY0} L${WX0 + 120},${WY1} Z`} fill="#fff" opacity={0.06} />
      </g>
      <rect x={WX0} y={WY0} width={WX1 - WX0} height={WY1 - WY0} fill="none" stroke={c.woodShade} strokeWidth={30} />
      <path d={`M${(WX0 + WX1) / 2},${WY0} L${(WX0 + WX1) / 2},${WY1} M${WX0},${WY0 + 260} L${WX1},${WY0 + 260}`} stroke={c.woodShade} strokeWidth={16} />
      <path d={`M${(WX0 + WX1) / 2 - 7},${WY0 + 10} L${(WX0 + WX1) / 2 - 7},${WY1 - 10}`} stroke={c.woodLit} strokeWidth={3} opacity={0.8 * (1 - p * 0.6)} />
      <rect x={WX0 - 15} y={WY0 - 15} width={WX1 - WX0 + 30} height={WY1 - WY0 + 30} fill="none" stroke={ink()} strokeWidth={INK} />
      <rect x={WX0 + 15} y={WY0 + 15} width={WX1 - WX0 - 30} height={WY1 - WY0 - 30} fill="none" stroke={ink(0.7)} strokeWidth={3} />
      <rect x={WX0 - 40} y={WY1 + 14} width={WX1 - WX0 + 80} height={26} rx={3} fill={c.woodLit} stroke={ink()} strokeWidth={INK} />
      {/* curtains + rod */}
      <path d={`M${WX0 - 120},${WY0 - 52} L${WX1 + 160},${WY0 - 52}`} stroke={c.woodShade} strokeWidth={12} strokeLinecap="round" />
      <CurtainPanel id={`${id}-cl`} f={f} x={WX0 - 110} y={WY0 - 52} w={150} h={980} seed={3} wind={wind} fill={mixHex(c.tint, C.duskMid, 0.35 * (1 - p))} shade={mixHex(c.tint, C.ink, 0.35)} glow={c.warm} glowK={0.5 * (1 - p)} />
      <CurtainPanel id={`${id}-cr`} f={f} x={WX1 - 30} y={WY0 - 52} w={150} h={980} seed={9} wind={wind * 0.8} fill={mixHex(c.tint, C.duskMid, 0.35 * (1 - p))} shade={mixHex(c.tint, C.ink, 0.35)} glow={c.warm} glowK={0.4 * (1 - p)} />
      {/* poster */}
      <g transform="rotate(-2 210 320)">
        <rect x={96} y={176} width={240} height={300} fill={c.wallDeep} opacity={0.5} />
        <rect x={84} y={160} width={240} height={300} rx={3} fill={mixHex(C.cream, c.tint, 0.4)} stroke={ink()} strokeWidth={INK} />
        <rect x={104} y={180} width={200} height={220} fill={mixHex(C.duskTop, c.tint, 0.3)} />
        <circle cx={204} cy={270} r={44} fill={mixHex(C.duskLow, c.tint, 0.35)} />
        <path d="M104,400 L104,330 L160,290 L200,326 L240,280 L304,340 L304,400 Z" fill={mixHex(C.cityDusk, c.tint, 0.3)} />
        <rect x={120} y={414} width={160} height={10} fill={mixHex(C.ink, c.tint, 0.4)} opacity={0.6} />
        <rect x={140} y={432} width={120} height={7} fill={mixHex(C.ink, c.tint, 0.4)} opacity={0.4} />
      </g>
      {/* small shelf with books + a drooping plant */}
      <rect x={50} y={590} width={360} height={20} fill={c.wallDeep} opacity={0.45} />
      <BookRow x={70} y={566} w={170} seed={41} tint={c.tint} tintK={0.5} hMax={120} lit={c.warm} />
      <g>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = -150 + i * 40 + wander(f * 0.02 + i, 51) * 4;
          return (
            <g key={i} transform={`translate(${320 + (i - 2) * 6},${494}) rotate(${a + 90})`}>
              <path d="M0,0 C8,10 10,34 4,62 C-6,40 -6,16 0,0 Z" fill={mixHex(mixHex(C.plant, C.paper, 0.3), c.tint, 0.45)} stroke={ink()} strokeWidth={2.4} transform={`rotate(${i % 2 ? 50 : -50})`} />
            </g>
          );
        })}
        <path d="M290,500 L350,500 L342,566 L298,566 Z" fill={mixHex(C.paper, c.tint, 0.4)} stroke={ink()} strokeWidth={3.5} />
      </g>
      <CelRect x={50} y={566} w={360} h={20} rx={3} fill={c.wood} shade={c.woodShade} lit={c.woodLit} band={0.15} topLit={3} />
      {/* nightstand (beside the head end) */}
      <g>
        <path d="M-40,880 L280,880 L300,912 L-40,912 Z" fill={c.woodLit} stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
        <rect x={-40} y={912} width={340} height={330} fill={c.wood} stroke={ink()} strokeWidth={INK} />
        <rect x={-40} y={912} width={120} height={330} fill={c.woodShade} opacity={0.7} />
        <rect x={0} y={946} width={260} height={110} rx={6} fill="none" stroke={ink(0.8)} strokeWidth={3.5} />
        <circle cx={130} cy={1001} r={9} fill={c.woodLit} stroke={ink()} strokeWidth={3} />
        <rect x={0} y={1080} width={260} height={130} rx={6} fill="none" stroke={ink(0.8)} strokeWidth={3.5} />
        <rect x={290} y={918} width={8} height={320} fill={c.woodLit} opacity={0.7 * (1 - p)} />
        {/* phone, face down */}
        <path d="M20,868 L104,862 L110,878 L24,884 Z" fill={mixHex(C.ink, c.tint, 0.3)} stroke={ink()} strokeWidth={3} />
      </g>
    </g>
  );
};

/** Headboard, mattress + sheet, the pillow (his head goes on it). */
export const BRBed: React.FC<{f: number; id: string; p: number; px: number; py: number}> = ({f, id, p, px, py}) => {
  const c = brCols(p);
  const pil = mixHex(mixHex(C.pillow, C.duskLow, 0.18), mixHex(C.pillow, C.duskTop, 0.5), p);
  const pilSh = mixHex(mixHex(C.sheetShade, C.cityDusk, 0.3), mixHex(C.sheetShade, C.roomNight, 0.5), p);
  const pillowD = `M${px - 230},${py - 70} C${px - 240},${py - 150} ${px - 120},${py - 160} ${px},${py - 150} C${px + 130},${py - 150} ${px + 230},${py - 140} ${px + 236},${py - 60} C${px + 250},${py + 30} ${px + 240},${py + 120} ${px + 200},${py + 150} C${px + 80},${py + 170} ${px - 120},${py + 170} ${px - 210},${py + 140} C${px - 260},${py + 80} ${px - 250},${py + 10} ${px - 230},${py - 70} Z`;
  return (
    <g>
      <defs>
        <clipPath id={`${id}-pil`}>
          <path d={pillowD} />
        </clipPath>
      </defs>
      {/* mattress + bottom sheet (bed runs off to the right) */}
      <path d="M250,960 L1600,960 L1600,1760 L210,1760 Z" fill={c.sheet} stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
      <path d="M250,960 L1600,960 L1600,1010 L246,1010 Z" fill={c.sheetShade} opacity={0.8} />
      {/* rumpled bottom sheet: cel shadow under the pillow + soft wrinkles */}
      <path d="M210,1300 C330,1330 520,1340 700,1310 L700,1760 L210,1760 Z" fill={c.sheetShade} opacity={0.55} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${260 + i * 90},${1380 + i * 40} q${50 + i * 8},${-16} ${110 + i * 10},${10}`} fill="none" stroke={c.sheetShade} strokeWidth={9} strokeLinecap="round" opacity={0.8} />
      ))}
      {/* headboard (left end) */}
      <path d="M200,760 Q250,730 300,770 L300,1330 L200,1380 Z" fill={c.wood} stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
      <path d="M200,760 Q220,748 240,752 L240,1360 L200,1380 Z" fill={c.woodShade} />
      <path d="M292,776 L292,1320" stroke={c.woodLit} strokeWidth={6} opacity={0.85 * (1 - p * 0.7)} />
      {/* pillow */}
      <path d={pillowD} fill={pil} />
      <g clipPath={`url(#${id}-pil)`}>
        <path d={pillowD} fill={pilSh} transform="translate(-30,40)" opacity={0.0} />
        <path d={`M${px - 260},${py + 40} C${px - 120},${py + 80} ${px + 60},${py + 90} ${px + 260},${py + 60} L${px + 260},${py + 200} L${px - 260},${py + 200} Z`} fill={pilSh} />
        <path d={`M${px - 260},${py - 160} L${px - 180},${py - 160} C${px - 210},${py - 60} ${px - 210},${py + 40} ${px - 160},${py + 200} L${px - 260},${py + 200} Z`} fill={pilSh} opacity={0.8} />
        <path d={`M${px - 120},${py - 40} q30,-20 60,0 M${px + 90},${py + 10} q24,-14 50,4`} stroke={pilSh} strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d={`M${px - 150},${py - 138} C${px - 40},${py - 150} ${px + 120},${py - 142} ${px + 210},${py - 110}`} stroke={mixHex(pil, C.duskSun, 0.5 * (1 - p))} strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.9} />
      </g>
      <path d={pillowD} fill="none" stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
      <path d={`M${px + 236},${py - 60} l14,-14 M${px - 230},${py - 70} l-14,-10`} stroke={ink()} strokeWidth={3.5} strokeLinecap="round" />
      {void f}
    </g>
  );
};

/** Floor corner under the nightstand (bottom-left): floorboards, a rug, slippers. */
export const BRFloor: React.FC<{f: number; id: string; p: number}> = ({p}) => {
  const c = brCols(p);
  const floor = mixHex(mixHex(C.woodShade, C.cityDusk, 0.35), mixHex(C.woodShade, C.roomNight, 0.65), p);
  return (
    <g>
      <rect x={-500} y={1240} width={900} height={1000} fill={floor} />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M-500,${1300 + i * 120} L400,${1290 + i * 120}`} stroke={mixHex(floor, C.ink, 0.35)} strokeWidth={3} />
      ))}
      <ellipse cx={60} cy={1720} rx={360} ry={150} fill={mixHex(C.rug, c.tint, 0.5)} stroke={ink()} strokeWidth={INK} />
      <ellipse cx={60} cy={1720} rx={300} ry={110} fill="none" stroke={mixHex(C.cream, c.tint, 0.5)} strokeWidth={6} strokeDasharray="20 12" opacity={0.6} />
      {/* slippers */}
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${-20 + i * 120},${1640 + i * 40}) rotate(${-14 + i * 10})`}>
          <ellipse cx={0} cy={0} rx={52} ry={26} fill={mixHex(C.jeans, c.tint, 0.3)} stroke={ink()} strokeWidth={3.5} />
          <path d="M-10,-24 Q30,-30 50,-4 Q30,14 -10,18 Z" fill={mixHex(C.jeansLight, c.tint, 0.3)} stroke={ink()} strokeWidth={3} />
        </g>
      ))}
    </g>
  );
};

/** Warm window light falling on the bed (fading + sliding as the sun sinks) + a shaft with dust. */
export const BRLight: React.FC<{f: number; id: string; p: number}> = ({f, id, p}) => {
  const k = Math.pow(clamp(1 - p), 1.3);
  if (k < 0.01) return null;
  const sx = p * 120, sy = -p * 90;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-shaft`} x1={1} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={C.duskLow} stopOpacity={0.9} />
          <stop offset={1} stopColor={C.duskLow} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`M${WX0 + 40},${WY0 + 40} L${WX1 - 40},${WY0 + 40} L${WX1 - 300 + sx},${1500 + sy} L${WX0 - 420 + sx},${1500 + sy} Z`} fill={`url(#${id}-shaft)`} opacity={0.08 * k} />
      <Motes f={f} x={300} y={500} w={700} h={900} n={34} seed={21} color={mixHex(C.duskLow, C.cream, 0.5)} opacity={0.7 * k} />
    </g>
  );
};

export const brLerp = lerp;
export const brRgba = rgba;
