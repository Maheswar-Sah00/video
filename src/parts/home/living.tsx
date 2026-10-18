import React from 'react';
import {C} from '../../lib/palette';
import {blob, clamp, hash, lerp, mixHex, rgba, wander} from '../../lib/anim';
import {BookRow, CelRect, CurtainPanel, INK, Motes, TrailingPlant, ink, n1} from './kit';

/**
 * S12 evening LIVING ROOM (owner: home). World coordinates = screen coordinates at rest; the scene
 * applies the camera. Light: low warm sun through a window on the RIGHT side wall (lighting 'dim'),
 * deep blue-violet shadows. Layers: LRBack (ceiling, walls, window, light patch, shelves),
 * LRSofa (sofa, throw, blanket, side-table lamp), LRFront (rug, coffee table, foreground leaves),
 * LRAir (light shafts + dust, drawn over him).
 */

export const LR = {
  wall: mixHex(C.cityDuskLight, C.roomNightLight, 0.42),
  wallDeep: mixHex(C.roomNight, C.cityDusk, 0.4),
  wallLit: mixHex(C.duskLow, C.kitchenWall, 0.25),
  side: mixHex(C.cityDuskLight, C.roomNightLight, 0.66),
  ceil: mixHex(C.roomNight, C.cityDusk, 0.45),
  wood: mixHex(C.wood, C.roomNight, 0.38),
  woodShade: mixHex(C.woodShade, C.roomNight, 0.5),
  woodLit: mixHex(C.woodLight, C.duskLow, 0.45),
  sofa: mixHex(C.sofa, C.cityDuskLight, 0.18),
  sofaShade: mixHex(C.sofaShade, C.roomNight, 0.35),
  sofaLit: mixHex(C.sofa, C.duskLow, 0.32),
  tint: mixHex(C.roomNight, C.cityDusk, 0.5),
};

// window quad on the right side wall (perspective: the near/right edge is taller)
const WIN = {tl: [850, -60], tr: [1300, -230], br: [1300, 1200], bl: [850, 1060]} as const;
const wq = (u: number, v: number): [number, number] => {
  const top = [lerp(WIN.tl[0], WIN.tr[0], u), lerp(WIN.tl[1], WIN.tr[1], u)];
  const bot = [lerp(WIN.bl[0], WIN.br[0], u), lerp(WIN.bl[1], WIN.br[1], u)];
  return [lerp(top[0], bot[0], v), lerp(top[1], bot[1], v)];
};
const quad = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) =>
  `M${n1(a[0])},${n1(a[1])} L${n1(b[0])},${n1(b[1])} L${n1(c[0])},${n1(c[1])} L${n1(d[0])},${n1(d[1])} Z`;

/** Background: ceiling, back wall + light patch, side wall + window + curtain, shelves, bookcase. */
export const LRBack: React.FC<{f: number; id: string; shake?: number}> = ({f, id, shake = 0}) => {
  const winD = quad(wq(0, 0), wq(1, 0), wq(1, 1), wq(0, 1));
  // light patch (window projected onto the back wall), skewed, with the mullion cross in shadow
  const lp = (u: number, v: number): [number, number] => {
    const x0 = lerp(150, 640, u) + v * 70;
    const y0 = lerp(70, -10, u) + v * lerp(1180, 1210, u);
    return [x0, y0];
  };
  const pane = (u0: number, u1: number, v0: number, v1: number) => quad(lp(u0, v0), lp(u1, v0), lp(u1, v1), lp(u0, v1));
  const shimmer = 0.9 + 0.1 * wander(f * 0.05, 4);
  // leaf dapples drifting across the patch (a tree outside)
  const dapples: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const cx = lerp(140, 700, hash(i, 11)) + wander(f * 0.018 + i, 12) * 40;
    const cy = lerp(60, 1150, hash(i, 13)) + wander(f * 0.015 + i * 2, 14) * 30;
    dapples.push(<path key={i} d={blob(cx, cy, 40 + 50 * hash(i, 15), i + 3, 0.3, 8, f * 0.02)} fill={LR.wall} opacity={0.55} />);
  }
  // clouds + skyline seen through the window
  const sky: React.ReactNode[] = [];
  for (let i = 0; i < 4; i++) {
    const cx = 850 + ((hash(i, 21) * 520 + f * (0.35 + 0.15 * i)) % 600) - 40;
    const cy = 120 + i * 120 + 30 * hash(i, 22);
    sky.push(<ellipse key={`c${i}`} cx={n1(cx)} cy={n1(cy)} rx={n1(110 + 60 * hash(i, 23))} ry={n1(14 + 8 * hash(i, 24))} fill={mixHex(C.duskMid, C.cream, 0.25 + 0.15 * i)} opacity={0.7} />);
  }
  let lit = '';
  const towers: React.ReactNode[] = [];
  for (let i = 0; i < 8; i++) {
    const tx = 840 + i * 60 + 20 * hash(i, 31);
    const th = 120 + 200 * hash(i, 32);
    const ty = 1060 + i * 18 - th;
    towers.push(<rect key={`t${i}`} x={n1(tx)} y={n1(ty)} width={n1(56 + 20 * hash(i, 33))} height={n1(th + 300)} fill={mixHex(C.cityDusk, C.duskTop, 0.3 + 0.2 * hash(i, 34))} />);
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 3; c++) if (hash(i * 50 + r * 7 + c, 35) > 0.6) lit += `M${n1(tx + 8 + c * 16)},${n1(ty + 14 + r * 26)} h7 v10 h-7 Z `;
  }
  // tree silhouette at the window's left edge, swaying
  const tree: React.ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const sw = wander(f * 0.03 + i * 0.5, 41) * 12;
    tree.push(<path key={i} d={blob(860 + 70 * hash(i, 42) + sw, 380 + i * 95, 70 + 30 * hash(i, 43), i + 50, 0.28, 9, f * 0.015)} fill={mixHex(C.cityDusk, C.ink, 0.45)} />);
  }
  const mull = (u: number) => `M${n1(wq(u, 0)[0])},${n1(wq(u, 0)[1])} L${n1(wq(u, 1)[0])},${n1(wq(u, 1)[1])}`;
  const tran = (v: number) => `M${n1(wq(0, v)[0])},${n1(wq(0, v)[1])} L${n1(wq(1, v)[0])},${n1(wq(1, v)[1])}`;
  const jig = (i: number) => shake * Math.sin(f * 1.3 + i) * 3;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-wall`} x1={0} y1={0} x2={1} y2={0}>
          <stop offset={0} stopColor={LR.wallDeep} />
          <stop offset={0.75} stopColor={LR.wall} />
          <stop offset={1} stopColor={mixHex(LR.wall, C.duskMid, 0.15)} />
        </linearGradient>
        <linearGradient id={`${id}-sky`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={C.duskTop} />
          <stop offset={0.45} stopColor={C.duskMid} />
          <stop offset={0.8} stopColor={C.duskLow} />
          <stop offset={1} stopColor={C.duskSun} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset={0} stopColor={C.duskSun} stopOpacity={1} />
          <stop offset={0.3} stopColor={C.duskLow} stopOpacity={0.7} />
          <stop offset={1} stopColor={C.duskLow} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-patch`} x1={1} y1={0} x2={0} y2={0.3}>
          <stop offset={0} stopColor={LR.wallLit} stopOpacity={0.95} />
          <stop offset={1} stopColor={C.duskMid} stopOpacity={0.45} />
        </linearGradient>
        <clipPath id={`${id}-win`}>
          <path d={winD} />
        </clipPath>
        <clipPath id={`${id}-patchc`}>
          <path d={pane(0, 1, 0, 1)} />
        </clipPath>
      </defs>
      {/* ceiling + side wall + back wall */}
      <rect x={-600} y={-900} width={2400} height={780} fill={LR.ceil} />
      <path d="M-600,-150 L800,-150 L1700,-560 L1700,-900 L-600,-900 Z" fill={LR.ceil} />
      <rect x={-600} y={-150} width={1400} height={1500} fill={`url(#${id}-wall)`} />
      <path d="M800,-150 L1700,-560 L1700,1600 L800,1270 Z" fill={LR.side} />
      {/* the light patch on the back wall */}
      <g opacity={shimmer}>
        <path d={pane(0, 0.47, 0, 0.42)} fill={`url(#${id}-patch)`} />
        <path d={pane(0.53, 1, 0, 0.42)} fill={`url(#${id}-patch)`} />
        <path d={pane(0, 0.47, 0.47, 1)} fill={`url(#${id}-patch)`} />
        <path d={pane(0.53, 1, 0.47, 1)} fill={`url(#${id}-patch)`} />
        <g clipPath={`url(#${id}-patchc)`}>{dapples}</g>
      </g>
      {/* crown moulding + corner */}
      <path d="M-600,-150 L800,-150 L1700,-560" fill="none" stroke={mixHex(LR.wallLit, LR.wall, 0.5)} strokeWidth={22} />
      <path d="M-600,-162 L800,-162 L1700,-572" fill="none" stroke={ink()} strokeWidth={INK} />
      <path d="M-600,-139 L800,-139 L1700,-549" fill="none" stroke={ink(0.6)} strokeWidth={3} />
      <path d="M800,-150 L800,1270" stroke={mixHex(LR.wallDeep, C.ink, 0.3)} strokeWidth={5} />
      {/* window: sky, sun, clouds, skyline, tree */}
      <g clipPath={`url(#${id}-win)`}>
        <rect x={830} y={-260} width={500} height={1480} fill={`url(#${id}-sky)`} />
        <circle cx={1150} cy={900} r={420} fill={`url(#${id}-sun)`} />
        <circle cx={1150} cy={905} r={48} fill={C.duskSun} />
        {sky}
        {towers}
        <path d={lit} fill={C.lamp} opacity={0.8} />
        {tree}
        <path d={`M900,1200 L1060,-200 L1120,-200 L960,1200 Z`} fill="#ffffff" opacity={0.07} />
        <path d={`M1000,1200 L1160,-200 L1180,-200 L1020,1200 Z`} fill="#ffffff" opacity={0.06} />
      </g>
      {/* window frame */}
      <path d={winD} fill="none" stroke={LR.woodShade} strokeWidth={34} strokeLinejoin="round" />
      <path d={mull(0.5)} stroke={LR.woodShade} strokeWidth={18} />
      <path d={tran(0.4)} stroke={LR.woodShade} strokeWidth={16} />
      <path d={mull(0.5)} stroke={LR.woodLit} strokeWidth={4} transform="translate(-7,0)" opacity={0.9} />
      <path d={tran(0.4)} stroke={LR.woodLit} strokeWidth={3} transform="translate(0,-6)" opacity={0.8} />
      <path d={winD} fill="none" stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
      <path d={`M${n1(wq(0, 1)[0] - 30)},${n1(wq(0, 1)[1] + 10)} L${n1(wq(1, 1)[0] + 20)},${n1(wq(1, 1)[1] + 26)} L${n1(wq(1, 1)[0] + 20)},${n1(wq(1, 1)[1] + 56)} L${n1(wq(0, 1)[0] - 30)},${n1(wq(0, 1)[1] + 34)} Z`} fill={LR.woodLit} stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
      {/* floating shelf (back wall) + its shadow */}
      <rect x={256} y={252} width={430} height={22} fill={LR.wallDeep} opacity={0.5} />
      <g transform={`translate(${n1(jig(1) * 0.4)},0)`}>
        <BookRow x={290} y={230} w={230} seed={7} tint={LR.tint} hMax={130} />
        <g transform="translate(560,230) rotate(-8)">
          <rect x={-2} y={-110} width={78} height={110} fill={LR.woodShade} stroke={ink()} strokeWidth={3.5} />
          <rect x={8} y={-100} width={58} height={90} fill={mixHex(C.duskMid, C.cream, 0.3)} />
          <circle cx={37} cy={-62} r={14} fill={mixHex(C.skin, LR.tint, 0.3)} />
          <path d="M14,-12 Q37,-44 60,-12 Z" fill={mixHex(C.jeans, LR.tint, 0.2)} />
        </g>
        <TrailingPlant f={f} x={660} y={230} s={0.9} tint={LR.tint} seed={3} sway={1 + shake * 2} />
      </g>
      <CelRect x={270} y={230} w={440} h={22} rx={3} fill={LR.wood} shade={LR.woodShade} lit={LR.woodLit} band={0.2} topLit={3} />
      {/* framed print */}
      <g transform={`translate(80,0) rotate(${n1(shake * Math.sin(f * 0.9) * 1.5)} 330 470)`}>
        <rect x={232} y={482} width={200} height={260} fill={LR.wallDeep} opacity={0.45} />
        <rect x={218} y={470} width={200} height={260} rx={3} fill={LR.woodShade} stroke={ink()} strokeWidth={INK} />
        <rect x={236} y={488} width={164} height={224} fill={mixHex(C.cream, LR.tint, 0.3)} />
        <rect x={254} y={506} width={128} height={188} fill={mixHex(C.duskTop, LR.tint, 0.2)} />
        <circle cx={330} cy={590} r={30} fill={mixHex(C.duskLow, C.cream, 0.3)} />
        <path d="M254,694 L254,640 L300,600 L336,632 L360,610 L382,640 L382,694 Z" fill={mixHex(C.cityDusk, LR.tint, 0.2)} />
        <rect x={410} y={474} width={5} height={252} fill={LR.woodLit} opacity={0.85} />
      </g>
      {/* tall bookcase on the left */}
      <g>
        <rect x={-460} y={-150} width={700} height={1960} fill={LR.wallDeep} />
        {[30, 330, 630, 930, 1230, 1530].map((sy, i) => (
          <g key={i} transform={`translate(${n1(jig(i + 3))},0)`}>
            <BookRow x={-420} y={sy + 270} w={610} seed={20 + i} tint={LR.tint} tintK={0.5} hMax={210} />
          </g>
        ))}
        {[30, 330, 630, 930, 1230, 1530, 1830].map((sy, i) => (
          <CelRect key={i} x={-460} y={sy + 262} w={680} h={26} rx={2} fill={LR.wood} shade={LR.woodShade} lit={LR.woodLit} band={0.1} topLit={3} />
        ))}
        <CelRect x={190} y={-150} w={52} h={1960} rx={2} fill={LR.wood} shade={LR.woodShade} lit={LR.woodLit} band={0.35} />
        <rect x={230} y={-150} width={9} height={1960} fill={LR.woodLit} opacity={0.75} />
      </g>
    </g>
  );
};

/** Curtain at the window's far edge (drawn after the back so it can overlap the frame). */
export const LRCurtain: React.FC<{f: number; id: string; wind?: number}> = ({f, id, wind = 1}) => (
  <g>
    <path d="M740,-176 L1500,-500" stroke={LR.woodShade} strokeWidth={14} strokeLinecap="round" />
    <path d="M740,-176 L1500,-500" stroke={ink()} strokeWidth={3} fill="none" />
    <CurtainPanel id={`${id}-cur`} f={f} x={758} y={-176} w={140} h={1440} seed={7} wind={wind} fill={mixHex(C.duskMid, C.roomNight, 0.5)} shade={mixHex(C.duskMid, C.roomNight, 0.72)} glow={C.duskLow} glowK={0.55} />
  </g>
);

/** Sofa (back cushions across the frame), throw pillow, knitted blanket, side table + lamp. */
export const LRSofa: React.FC<{f: number; id: string; press?: number}> = ({f, id, press = 0}) => {
  const lampFl = 0.94 + 0.06 * wander(f * 0.2, 61);
  const cush = (x: number, w: number, k: number) => {
    const dip = press * (k === 1 ? 14 : 4);
    const y0 = 1218 + dip;
    return (
      <g key={k}>
        <rect x={x} y={y0} width={w} height={1640 - y0} rx={48} fill={LR.sofa} />
        <path d={`M${x + 4},${y0 + 60} Q${x + w * 0.25},${y0 + 30} ${x + w * 0.2},${1640} L${x + 30},1640 Q${x},1640 ${x},1600 Z`} fill={LR.sofaShade} />
        <path d={`M${x + 20},1600 Q${x + w / 2},1560 ${x + w - 20},1600 L${x + w - 20},1640 L${x + 20},1640 Z`} fill={LR.sofaShade} opacity={0.9} />
        <path d={`M${x + 40},${y0 + 8} Q${x + w / 2},${y0 - 4} ${x + w - 30},${y0 + 10}`} fill="none" stroke={LR.sofaLit} strokeWidth={9} strokeLinecap="round" />
        <path d={`M${x + w - 12},${y0 + 40} L${x + w - 12},1560`} stroke={LR.sofaLit} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
        <path d={`M${x + w * 0.3},${y0 + 120} q8,10 0,22 M${x + w * 0.62},${y0 + 150} q8,10 0,22`} stroke={LR.sofaShade} strokeWidth={4} fill="none" strokeLinecap="round" />
        <rect x={x} y={y0} width={w} height={1640 - y0} rx={48} fill="none" stroke={ink()} strokeWidth={INK} />
      </g>
    );
  };
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-lampg`}>
          <stop offset={0} stopColor={C.lampGlow} stopOpacity={0.55} />
          <stop offset={0.45} stopColor={C.lampGlow} stopOpacity={0.18} />
          <stop offset={1} stopColor={C.lampGlow} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* side table + table lamp (right, in front of the window) */}
      <circle cx={1010} cy={1200} r={330 * lampFl} fill={`url(#${id}-lampg)`} />
      <rect x={900} y={1360} width={260} height={30} rx={4} fill={LR.wood} stroke={ink()} strokeWidth={INK} />
      <rect x={920} y={1390} width={20} height={420} fill={LR.woodShade} stroke={ink()} strokeWidth={3} />
      <path d="M990,1360 L1000,1290 L1030,1290 L1040,1360 Z" fill={mixHex(C.cream, LR.tint, 0.35)} stroke={ink()} strokeWidth={3.5} />
      <path d="M940,1290 L1090,1290 L1060,1150 L970,1150 Z" fill={mixHex(C.lamp, C.duskLow, 0.3)} stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
      <path d="M948,1282 L1082,1282" stroke={C.cream} strokeWidth={7} opacity={lampFl} />
      <path d="M975,1160 L958,1280" stroke={C.lampGlow} strokeWidth={10} opacity={0.6} />
      {/* sofa frame + back cushions */}
      <rect x={20} y={1190} width={1500} height={620} rx={40} fill={LR.sofaShade} stroke={ink()} strokeWidth={INK} />
      {cush(60, 440, 0)}
      {cush(500, 440, 1)}
      {cush(940, 480, 2)}
      {/* throw pillow (left) */}
      <g transform={`rotate(${n1(-9 + wander(f * 0.02, 70) * 1.5)} 260 1440)`}>
        <rect x={140} y={1320} width={240} height={230} rx={40} fill={mixHex(C.rug, LR.tint, 0.3)} />
        <rect x={140} y={1320} width={80} height={230} rx={36} fill={mixHex(C.rug, LR.tint, 0.6)} />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M160,${1370 + i * 60} L360,${1360 + i * 60}`} stroke={mixHex(C.cream, LR.tint, 0.35)} strokeWidth={8} opacity={0.75} />
        ))}
        <path d="M372,1340 L372,1530" stroke={C.duskLow} strokeWidth={5} opacity={0.8} />
        <rect x={140} y={1320} width={240} height={230} rx={40} fill="none" stroke={ink()} strokeWidth={INK} />
      </g>
      {/* knitted blanket draped over the back (right) */}
      <g>
        <path d={`M860,1206 Q1000,1180 1190,1200 L1200,1260 Q1186,1420 ${n1(1180 + wander(f * 0.03, 72) * 5)},1560 L1150,1530 L1120,1566 L1090,1532 L1060,1568 L1030,1534 L1000,1566 L970,1532 L940,1566 L914,1530 Q890,1400 872,1260 Z`} fill={mixHex(C.cream, C.duskMid, 0.4)} stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
        <path d="M872,1260 Q890,1400 914,1530 L960,1530 Q930,1400 920,1250 Z" fill={mixHex(C.duskMid, LR.tint, 0.4)} opacity={0.8} />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${940 + i * 50},1230 Q${946 + i * 50},1380 ${940 + i * 52},1520`} fill="none" stroke={mixHex(C.duskMid, LR.tint, 0.3)} strokeWidth={5} strokeDasharray="10 8" />
        ))}
        <path d="M880,1208 Q1000,1186 1186,1204" fill="none" stroke={C.duskLow} strokeWidth={6} opacity={0.85} />
      </g>
      {/* left arm */}
      <rect x={10} y={1330} width={210} height={480} rx={70} fill={LR.sofa} />
      <rect x={10} y={1330} width={80} height={480} rx={60} fill={LR.sofaShade} />
      <path d="M60,1338 Q130,1326 200,1350" stroke={LR.sofaLit} strokeWidth={9} fill="none" strokeLinecap="round" />
      <rect x={10} y={1330} width={210} height={480} rx={70} fill="none" stroke={ink()} strokeWidth={INK} />
      {/* seat front */}
      <rect x={30} y={1640} width={1500} height={170} rx={30} fill={mixHex(LR.sofaShade, C.ink, 0.15)} stroke={ink()} strokeWidth={INK} />
      <path d="M60,1650 L1500,1650" stroke={LR.sofa} strokeWidth={8} opacity={0.6} />
    </g>
  );
};

/** Floor, rug, coffee table edge, big soft foreground leaves (parallax layer). */
export const LRFront: React.FC<{f: number; id: string}> = ({f, id}) => {
  const leaves: React.ReactNode[] = [];
  for (let i = 0; i < 4; i++) {
    const a = -40 + i * 26 + wander(f * 0.025 + i, 80) * 5;
    leaves.push(
      <g key={i} transform={`translate(${n1(1100 + i * 30)},${n1(2150 - i * 40)}) rotate(${n1(a - 40)})`}>
        <path d="M0,0 C-60,-120 -40,-300 0,-420 C40,-300 60,-120 0,0 Z" fill={mixHex(C.plantDeep, C.ink, 0.62)} stroke={rgba(C.duskLow, 0.25)} strokeWidth={5} />
        <path d="M0,-20 L0,-400" stroke={mixHex(C.plantDeep, C.ink, 0.4)} strokeWidth={6} />
      </g>,
    );
  }
  return (
    <g>
      <rect x={-600} y={1800} width={2400} height={900} fill={mixHex(C.woodShade, C.roomNight, 0.55)} />
      <path d="M-400,1830 L1200,1830 L1500,2700 L-600,2700 Z" fill={mixHex(C.rug, LR.tint, 0.45)} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M-400,${1860 + i * 46} L${1220 + i * 20},${1860 + i * 46}`} stroke={mixHex(C.cream, LR.tint, 0.45)} strokeWidth={6} opacity={0.4} strokeDasharray="22 14" />
      ))}
      {/* coffee table edge (foreground, bottom) */}
      <g>
        <path d="M300,1900 L1500,1900 L1500,1960 L300,1960 Z" fill={mixHex(C.wood, LR.tint, 0.5)} stroke={ink()} strokeWidth={INK} />
        <path d="M300,1960 L1500,1960 L1500,2060 L300,2060 Z" fill={LR.woodShade} stroke={ink()} strokeWidth={INK} />
        <path d="M310,1906 L1490,1906" stroke={C.duskLow} strokeWidth={4} opacity={0.6} />
        <rect x={420} y={1862} width={230} height={40} rx={4} fill={mixHex(C.jeans, LR.tint, 0.2)} stroke={ink()} strokeWidth={3.5} />
        <rect x={428} y={1866} width={214} height={10} fill={mixHex(C.cream, LR.tint, 0.3)} />
        <rect x={720} y={1880} width={120} height={20} rx={6} fill={C.ink} stroke={ink()} strokeWidth={3} />
        <rect x={728} y={1883} width={104} height={12} rx={4} fill={C.screenGlow} opacity={0.25 + 0.1 * Math.sin(f * 0.1)} />
      </g>
      {leaves}
      <rect x={-600} y={1790} width={2400} height={12} fill={mixHex(C.ink, LR.tint, 0.3)} opacity={0.5} id={`${id}-base`} />
    </g>
  );
};

/** Volumetric window light shafts + dust motes (drawn OVER him, additive-looking). */
export const LRAir: React.FC<{f: number; id: string; k?: number}> = ({f, id, k = 1}) => {
  const beams = [
    {x0: 850, y0: 80, x1: 870, y1: 560, dx: -700, dy: 520, o: 0.13},
    {x0: 860, y0: 600, x1: 880, y1: 1040, dx: -760, dy: 560, o: 0.11},
    {x0: 1000, y0: 300, x1: 1020, y1: 760, dx: -900, dy: 640, o: 0.08},
  ];
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-beam`} x1={1} y1={0} x2={0} y2={0.6}>
          <stop offset={0} stopColor={C.duskLow} stopOpacity={1} />
          <stop offset={1} stopColor={C.duskLow} stopOpacity={0} />
        </linearGradient>
      </defs>
      {beams.map((b, i) => {
        const o = b.o * k * (0.8 + 0.2 * Math.sin(f * 0.04 + i * 2));
        return <path key={i} d={`M${b.x0},${b.y0} L${b.x1},${b.y1} L${b.x1 + b.dx},${b.y1 + b.dy} L${b.x0 + b.dx},${b.y0 + b.dy} Z`} fill={`url(#${id}-beam)`} opacity={o} />;
      })}
      <Motes f={f} x={150} y={300} w={760} h={1100} n={46} seed={9} color={mixHex(C.duskLow, C.cream, 0.5)} opacity={0.75 * k} />
    </g>
  );
};

export const lrClamp = clamp;
