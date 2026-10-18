import React from 'react';
import {C} from '../../lib/palette';
import {blob, clamp, hash, lerp, mixHex, noise1, rgba, wander} from '../../lib/anim';
import {Beams, BookRow, Cel, Glow, Motes, PottedPlant, ink, n1} from './kit';

/** S07 set: his desk by the window on a DAY-ONE morning ('day' light: sun from the upper-left). */

export const DESK_Y = 1370; // back edge of the desk top
const L: [number, number] = [-0.62, -0.78];

// ------------------------------------------------------------------------------------------ wall
export const DeskWall: React.FC<{id: string; f: number}> = ({id, f}) => {
  const wx = 34, wy = 70, ww = 440, wh = 840;
  // outside: buildings + a tree branch
  const blds: React.ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const bx = wx - 20 + i * 72 + 20 * hash(i, 4);
    const bh = 160 + 200 * hash(i, 5);
    const by = wy + wh - bh;
    const col = mixHex(C.buildingLight, C.skyLow, 0.35 + 0.3 * hash(i, 6));
    blds.push(
      <g key={i}>
        <rect x={n1(bx)} y={n1(by)} width={64 + 30 * hash(i, 7)} height={bh + 10} fill={col} />
        <path
          d={Array.from({length: Math.floor(bh / 34)}, (_, r) => `M${n1(bx + 10)},${n1(by + 18 + r * 34)} h${n1(44 + 20 * hash(i, 7))}`).join(' ')}
          stroke={mixHex(col, C.building, 0.5)}
          strokeWidth={7}
          strokeDasharray="10 7"
          opacity={0.6}
        />
      </g>,
    );
  }
  const sway = wander(f * 0.02, 31) * 3 + Math.sin(f * 0.045) * 1.5;
  const leafs: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const cx = wx - 30 + t * 250 + 30 * hash(i, 11);
    const cy = wy + 40 + Math.sin(t * 3) * 90 + 50 * hash(i, 12);
    const r = 44 + 26 * hash(i, 13);
    const jig = noise1(f * 0.05 + i * 0.7, 14) * 5;
    const bd = blob(cx + jig, cy + jig * 0.6, r, 40 + i, 0.2, 11, f * 0.01);
    leafs.push(
      <g key={i} opacity={0.92}>
        <path d={bd} fill={C.leafDeep} />
        <path d={blob(cx + jig - r * 0.12, cy + jig * 0.6 - r * 0.14, r * 0.86, 50 + i, 0.22, 10, f * 0.012)} fill={i % 2 ? C.leaf : mixHex(C.leaf, C.leafLight, 0.5)} />
        <path d={blob(cx + jig - r * 0.3, cy + jig * 0.6 - r * 0.32, r * 0.42, 60 + i, 0.25, 8)} fill={C.leafLight} opacity={0.8} />
        <path d={bd} fill="none" stroke={rgba(C.leafDark, 0.55)} strokeWidth={3} />
      </g>,
    );
  }
  const frameCol = mixHex(C.cream, C.kitchenWall, 0.25);
  const curtainSw = wander(f * 0.025, 44) * 14 + Math.sin(f * 0.06) * 5;
  const curtain = (() => {
    const x0 = wx + ww - 40, y0 = wy - 30, w = 150, h = wh + 120;
    let d = `M${n1(x0)},${n1(y0)} L${n1(x0 + w)},${n1(y0)} `;
    const pts: string[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(`L${n1(x0 + w - t * w + curtainSw * (0.4 + t * 0.6) + (i % 2 ? 10 : -4))},${n1(y0 + h + (i % 2 ? 14 : 0))}`);
    }
    d += pts.join(' ') + ' Z';
    return d;
  })();
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-wall`} x1={0} y1={0} x2={1} y2={0.4}>
          <stop offset={0} stopColor={mixHex(C.kitchenWall, C.morning, 0.6)} />
          <stop offset={0.5} stopColor={C.kitchenWall} />
          <stop offset={1} stopColor={mixHex(C.kitchenWallShade, C.kitchenWall, 0.35)} />
        </linearGradient>
        <linearGradient id={`${id}-sky`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={C.sky} />
          <stop offset={0.65} stopColor={C.skyLow} />
          <stop offset={1} stopColor={mixHex(C.skyLow, C.morning, 0.6)} />
        </linearGradient>
        <clipPath id={`${id}-win`}>
          <rect x={wx} y={wy} width={ww} height={wh} />
        </clipPath>
      </defs>
      <rect x={-200} y={-200} width={1480} height={2400} fill={`url(#${id}-wall)`} />
      {/* soft wash of morning light on the wall behind him */}
      <Glow id={`${id}-wash`} x={560} y={700} r={520} color={C.morning} a={0.55} />
      {/* window */}
      <g clipPath={`url(#${id}-win)`}>
        <rect x={wx} y={wy} width={ww} height={wh} fill={`url(#${id}-sky)`} />
        <Glow id={`${id}-sun`} x={wx + 30} y={wy + 20} r={420} color={C.sun} a={1} />
        {blds}
        <g transform={`rotate(${n1(sway)},${wx - 40},${wy + 120})`}>
          <path d={`M${wx - 40},${wy + 140} Q${wx + 120},${wy + 90} ${wx + 260},${wy + 150}`} fill="none" stroke={C.trunk} strokeWidth={14} strokeLinecap="round" />
          {leafs}
        </g>
        <path d={`M${wx + 40},${wy + wh} L${wx + 230},${wy} L${wx + 300},${wy} L${wx + 110},${wy + wh} Z`} fill="#fff" opacity={0.13} />
        <path d={`M${wx + 160},${wy + wh} L${wx + 330},${wy} L${wx + 350},${wy} L${wx + 180},${wy + wh} Z`} fill="#fff" opacity={0.1} />
      </g>
      <rect x={wx} y={wy} width={ww} height={wh} fill="none" stroke={frameCol} strokeWidth={28} />
      <rect x={wx - 14} y={wy - 14} width={ww + 28} height={wh + 28} fill="none" stroke={ink()} strokeWidth={4} />
      <rect x={wx + 14} y={wy + 14} width={ww - 28} height={wh - 28} fill="none" stroke={ink(0.7)} strokeWidth={3} />
      <path d={`M${wx + ww / 2},${wy} V${wy + wh} M${wx},${wy + wh * 0.42} H${wx + ww}`} stroke={frameCol} strokeWidth={16} />
      <path d={`M${wx + ww / 2},${wy} V${wy + wh} M${wx},${wy + wh * 0.42} H${wx + ww}`} stroke={ink(0.5)} strokeWidth={2} />
      {/* sill */}
      <rect x={wx - 36} y={wy + wh + 10} width={ww + 72} height={28} rx={4} fill={frameCol} stroke={ink()} strokeWidth={4} />
      <rect x={wx - 36} y={wy + wh + 32} width={ww + 72} height={14} fill={C.kitchenWallShade} opacity={0.6} />
      {/* sheer curtain, stirring */}
      <path d={curtain} fill={rgba(C.cream, 0.72)} stroke={ink(0.75)} strokeWidth={3.5} strokeLinejoin="round" />
      {[0.25, 0.5, 0.75].map((t, i) => (
        <path
          key={i}
          d={`M${n1(wx + ww - 40 + 150 * t)},${wy - 10} Q${n1(wx + ww - 40 + 150 * t + curtainSw * 0.4)},${n1(wy + wh * 0.5)} ${n1(wx + ww - 40 + 150 * t + curtainSw * 0.9 - 6)},${n1(wy + wh + 80)}`}
          fill="none"
          stroke={C.kitchenWallShade}
          strokeWidth={7}
          opacity={0.55}
        />
      ))}
      <rect x={wx - 60} y={wy - 46} width={ww + 260} height={14} rx={7} fill={C.woodShade} stroke={ink()} strokeWidth={3} />
      {/* shelves (right wall) */}
      {[
        [150, 610],
        [440, 590],
      ].map(([sy, sx], i) => (
        <g key={i}>
          <rect x={sx} y={sy + 22} width={1080 - sx + 40} height={34} fill={C.kitchenWallShade} opacity={0.45} />
          <BookRow x={sx + 18} y={sy} w={i === 0 ? 300 : 250} seed={7 + i * 5} tilt={i ? -14 : 0} />
          <rect x={sx} y={sy} width={1080 - sx + 40} height={22} fill={C.woodLight} stroke={ink()} strokeWidth={4} />
          <rect x={sx} y={sy + 14} width={1080 - sx + 40} height={8} fill={C.woodShade} />
          <path d={`M${sx + 60},${sy + 22} l0,40 l30,-40 M${sx + 380},${sy + 22} l0,40 l30,-40`} stroke={C.woodShade} strokeWidth={8} fill="none" />
        </g>
      ))}
      {/* shelf props: a small trailing plant + a box + a framed photo */}
      <g>
        <PottedPlant id={`${id}-sp`} f={f} x={950} y={440} s={0.62} seed={5} leaves={7} potCol={C.cream} L={L} />
        {[0, 1, 2, 3].map((i) => {
          const sw = noise1(f * 0.03 + i, 61 + i) * 8;
          return (
            <path
              key={i}
              d={`M${930 + i * 14},${440} C${930 + i * 14 + sw},${520 + i * 18} ${915 + i * 18 - sw},${560 + i * 26} ${925 + i * 12 + sw * 1.5},${600 + i * 34}`}
              fill="none"
              stroke={i % 2 ? C.plant : C.plantDeep}
              strokeWidth={7}
              strokeLinecap="round"
            />
          );
        })}
        <rect x={880} y={60} width={110} height={90} rx={4} fill={C.wardTeal} stroke={ink()} strokeWidth={4} />
        <rect x={895} y={74} width={80} height={62} fill={C.skyLow} />
        <path d="M895,136 l30,-34 l20,18 l14,-12 l16,28 Z" fill={C.leaf} opacity={0.8} />
      </g>
      {/* wall clock, ~8:10, second hand ticking */}
      <WallClock f={f} x={870} y={670} r={54} />
      {/* power socket + cable */}
      <rect x={96} y={1120} width={56} height={70} rx={8} fill={C.cream} stroke={ink()} strokeWidth={3.5} />
      <path d={`M124,1160 C${n1(124 + sway * 3)},1260 200,1300 210,${DESK_Y + 10}`} fill="none" stroke={C.inkSoft} strokeWidth={7} />
    </g>
  );
};

const WallClock: React.FC<{f: number; x: number; y: number; r: number}> = ({f, x, y, r}) => {
  const ticks = Math.floor(f / 30);
  const since = f - ticks * 30;
  const settle = since < 7 ? Math.exp(-since / 2) * Math.sin(since * 1.8) * 4 : 0;
  const sec = 160 + ticks * 6 + settle;
  const min = 60 + f * 0.0033;
  const hr = 245;
  const hand = (a: number, len: number, w: number, col: string) => (
    <path d={`M${x},${y} L${n1(x + Math.sin((a * Math.PI) / 180) * len)},${n1(y - Math.cos((a * Math.PI) / 180) * len)}`} stroke={col} strokeWidth={w} strokeLinecap="round" />
  );
  return (
    <g>
      <circle cx={x + 6} cy={y + 8} r={r + 10} fill={C.kitchenWallShade} opacity={0.6} />
      <circle cx={x} cy={y} r={r + 10} fill={C.woodShade} stroke={ink()} strokeWidth={4} />
      <circle cx={x} cy={y} r={r} fill={C.cream} />
      {Array.from({length: 12}, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <path key={i} d={`M${n1(x + Math.sin(a) * r * 0.78)},${n1(y - Math.cos(a) * r * 0.78)} L${n1(x + Math.sin(a) * r * 0.9)},${n1(y - Math.cos(a) * r * 0.9)}`} stroke={C.inkSoft} strokeWidth={i % 3 ? 2.5 : 5} />;
      })}
      {hand(hr, r * 0.48, 7, C.ink)}
      {hand(min, r * 0.72, 5, C.ink)}
      {hand(sec, r * 0.82, 2.5, C.painDeep)}
      <circle cx={x} cy={y} r={5} fill={C.ink} />
      <path d={`M${x - r * 0.8},${y - r * 0.3} A${r * 0.85},${r * 0.85} 0 0 1 ${x - r * 0.1},${y - r * 0.82}`} fill="none" stroke="#fff" strokeWidth={5} opacity={0.6} />
    </g>
  );
};

// --------------------------------------------------------------------------------- sun + dust
export const DeskSun: React.FC<{id: string; f: number}> = ({id, f}) => (
  <g style={{mixBlendMode: 'screen'}}>
    <Beams
      id={id}
      f={f}
      ox={60}
      oy={120}
      ang={58}
      len={1900}
      color={C.morningGlow}
      beams={[
        [-60, 80, 260, 0.42],
        [70, 60, 210, 0.34],
        [190, 110, 340, 0.4],
        [330, 50, 180, 0.28],
      ]}
    />
  </g>
);
export const DeskDust: React.FC<{f: number}> = ({f}) => (
  <Motes f={f} seed={21} n={70} x={0} y={120} w={1080} h={1500} r={[1.4, 3.8]} vx={0.35} vy={-0.22} color={C.morning} opacity={0.85} />
);

// ----------------------------------------------------------------------------------- the chair
export const DeskChair: React.FC<{id: string; f: number}> = ({id, f}) => {
  const d = 'M560,1000 C560,930 600,905 700,905 C800,905 850,930 852,1000 L862,1420 L552,1420 Z';
  return (
    <g>
      <Cel id={`${id}-ch`} d={d} lit={mixHex(C.hoodieLight, C.inkSoft, 0.55)} shade={C.inkSoft} L={L} k={22} inkW={5}>
        <path d="M600,960 C640,940 760,940 805,962" fill="none" stroke={C.hoodieLight} strokeWidth={6} opacity={0.6} />
        <path d="M612,1000 L618,1400 M796,1000 L802,1400" stroke={C.ink} strokeWidth={3} opacity={0.35} />
      </Cel>
      <path d="M592,930 C640,912 700,910 760,912" fill="none" stroke={C.morning} strokeWidth={4} opacity={0.5 + 0.1 * Math.sin(f * 0.05)} />
    </g>
  );
};

// ------------------------------------------------------------------------------------ the desk
/** Laptop screen geometry (a parallelogram): content space 0..SW × 0..SH mapped onto it. */
export const SCR = {T1: [130, 1020] as [number, number], T2: [492, 1082] as [number, number], H1: [98, 1392] as [number, number], H2: [462, 1452] as [number, number]};
export const SW = 360, SH = 370;
export const scrMatrix = () => {
  const {T1, T2, H1} = SCR;
  return `matrix(${((T2[0] - T1[0]) / SW).toFixed(4)},${((T2[1] - T1[1]) / SW).toFixed(4)},${((H1[0] - T1[0]) / SH).toFixed(4)},${((H1[1] - T1[1]) / SH).toFixed(4)},${T1[0]},${T1[1]})`;
};
export const scrPt = (u: number, v: number) => {
  const {T1, T2, H1} = SCR;
  return {x: T1[0] + (T2[0] - T1[0]) * u + (H1[0] - T1[0]) * v, y: T1[1] + (T2[1] - T1[1]) * u + (H1[1] - T1[1]) * v};
};

/** The laptop: lid + screen content (blur/double = can't focus) + keyboard deck. */
export const Laptop: React.FC<{id: string; f: number; blur: number; dbl: number; scroll: number}> = ({id, f, blur, dbl, scroll}) => {
  const {T1, T2, H1, H2} = SCR;
  const F1: [number, number] = [34, 1560], F2: [number, number] = [432, 1636];
  const q = (a: number[][]) => a.map((p, i) => `${i ? 'L' : 'M'}${n1(p[0])},${n1(p[1])}`).join(' ') + ' Z';
  // keyboard rows
  const keys: string[] = [];
  for (let r = 1; r <= 5; r++) {
    const t = 0.12 + r * 0.13;
    const a = [lerp(H1[0], F1[0], t), lerp(H1[1], F1[1], t)], b = [lerp(H2[0], F2[0], t), lerp(H2[1], F2[1], t)];
    keys.push(`M${n1(a[0] + 18)},${n1(a[1])} L${n1(b[0] - 18)},${n1(b[1])}`);
  }
  for (let c = 1; c <= 12; c++) {
    const u = c / 13;
    const a = [lerp(H1[0], H2[0], u), lerp(H1[1], H2[1], u)], b = [lerp(F1[0], F2[0], u), lerp(F1[1], F2[1], u)];
    keys.push(`M${n1(lerp(a[0], b[0], 0.2))},${n1(lerp(a[1], b[1], 0.2))} L${n1(lerp(a[0], b[0], 0.78))},${n1(lerp(a[1], b[1], 0.78))}`);
  }
  // document lines (content space)
  const lines: [number, number, number][] = [];
  let yy = 70 - scroll;
  for (let i = 0; i < 18; i++) {
    const para = i % 5 === 4;
    if (!para) lines.push([24, yy, 24 + 300 * (0.55 + 0.45 * hash(i, 77))]);
    yy += para ? 30 : 22;
  }
  const docD = lines.map(([a, y, b]) => `M${a},${n1(y)} L${n1(b)},${n1(y)}`).join(' ');
  const cursorOn = Math.floor(f / 15) % 2 === 0;
  const dblX = dbl * (10 + 4 * Math.sin(f * 0.21)), dblY = dbl * 3 * Math.sin(f * 0.13);
  return (
    <g>
      <defs>
        <clipPath id={`${id}-scr`}>
          <rect x={10} y={10} width={SW - 20} height={SH - 22} />
        </clipPath>
        <filter id={`${id}-blur`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={n1(0.01 + blur * 3.2)} />
        </filter>
        <linearGradient id={`${id}-disp`} x1={0} y1={0} x2={1} y2={1}>
          <stop offset={0} stopColor="#f6fbff" />
          <stop offset={1} stopColor={mixHex(C.screenGlow, '#ffffff', 0.55)} />
        </linearGradient>
      </defs>
      {/* shadow on the desk */}
      <path d={q([[F1[0] + 40, F1[1] + 26], [F2[0] + 60, F2[1] + 26], [H2[0] + 90, H2[1] + 10], [H1[0] + 60, H1[1]]])} fill={rgba(C.deskShade, 0.35)} />
      {/* keyboard deck */}
      <path d={q([H1, H2, F2, F1])} fill={mixHex(C.steel, C.chrome, 0.4)} stroke={ink()} strokeWidth={4.5} strokeLinejoin="round" />
      <path d={q([[F1[0], F1[1]], [F2[0], F2[1]], [F2[0], F2[1] + 14], [F1[0], F1[1] + 12]])} fill={C.steelDark} stroke={ink()} strokeWidth={3.5} strokeLinejoin="round" />
      <path d={keys.join(' ')} stroke={C.steelDark} strokeWidth={3} opacity={0.7} />
      <path d={`M${n1(lerp(F1[0], F2[0], 0.36))},${n1(lerp(F1[1], F2[1], 0.36) - 22)} L${n1(lerp(F1[0], F2[0], 0.64))},${n1(lerp(F1[1], F2[1], 0.64) - 22)}`} stroke={C.steelDark} strokeWidth={4} opacity={0.5} />
      <path d={`M${n1(H1[0] + 30)},${n1(H1[1] + 12)} L${n1(H2[0] - 40)},${n1(H2[1] + 10)}`} stroke="#fff" strokeWidth={4} opacity={0.5} />
      {/* lid */}
      <path d={q([[T1[0] - 14, T1[1] - 10], [T2[0] + 12, T2[1] - 8], [H2[0] + 10, H2[1] + 4], [H1[0] - 12, H1[1] + 2]])} fill={C.steelDark} stroke={ink()} strokeWidth={5} strokeLinejoin="round" />
      <path d={q([T1, T2, H2, H1])} fill={C.inkSoft} />
      {/* display content */}
      <g transform={scrMatrix()}>
        <rect x={10} y={10} width={SW - 20} height={SH - 22} fill={`url(#${id}-disp)`} />
        <g clipPath={`url(#${id}-scr)`}>
          <rect x={10} y={10} width={SW - 20} height={30} fill={mixHex(C.screenGlow, C.jeansLight, 0.4)} />
          <circle cx={26} cy={25} r={5} fill={C.hudBad} opacity={0.7} />
          <circle cx={42} cy={25} r={5} fill={C.lampGlow} opacity={0.7} />
          <g filter={blur > 0.02 ? `url(#${id}-blur)` : undefined}>
            {dbl > 0.01 && <path d={docD} transform={`translate(${n1(dblX)},${n1(dblY)})`} stroke={C.jeansLight} strokeWidth={8} strokeLinecap="round" opacity={0.45 * dbl} />}
            <path d={docD} stroke={C.jeans} strokeWidth={8} strokeLinecap="round" opacity={0.75} />
            <path d={`M24,${n1(46 - scroll)} L210,${n1(46 - scroll)}`} stroke={C.ink} strokeWidth={14} strokeLinecap="round" opacity={0.8} />
          </g>
          {cursorOn && <rect x={n1(24 + 300 * 0.62)} y={n1(70 - scroll + 22 * 6 - 9)} width={4} height={18} fill={C.ink} />}
        </g>
      </g>
      {/* glass glare */}
      <path d={q([scrPt(0.62, 0), scrPt(0.8, 0), scrPt(0.42, 1), scrPt(0.25, 1)].map((p) => [p.x, p.y]))} fill="#fff" opacity={0.08 + 0.03 * Math.sin(f * 0.04)} />
      <path d={q([T1, T2, H2, H1])} fill="none" stroke={C.ink} strokeWidth={3} />
      {/* camera dot */}
      <circle cx={n1(lerp(T1[0], T2[0], 0.5) - 3)} cy={n1(lerp(T1[1], T2[1], 0.5) - 1)} r={3} fill={C.ink} />
    </g>
  );
};

export const DeskTop: React.FC<{id: string; f: number}> = ({id, f}) => {
  const grain: string[] = [];
  for (let i = 0; i < 9; i++) {
    const y0 = DESK_Y + 30 + i * 46 + 10 * hash(i, 3);
    grain.push(`M-20,${n1(y0)} C300,${n1(y0 - 12 + 20 * hash(i, 4))} 700,${n1(y0 + 16 - 20 * hash(i, 5))} 1100,${n1(y0 + 4)}`);
  }
  const shimmer = 0.85 + 0.15 * noise1(f * 0.04, 9);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-top`} x1={0} y1={0} x2={1} y2={0.3}>
          <stop offset={0} stopColor={C.woodLight} />
          <stop offset={0.55} stopColor={C.wood} />
          <stop offset={1} stopColor={mixHex(C.wood, C.woodShade, 0.6)} />
        </linearGradient>
        <linearGradient id={`${id}-patch`} x1={0} y1={0} x2={1} y2={0}>
          <stop offset={0} stopColor={C.morning} stopOpacity={0.55} />
          <stop offset={1} stopColor={C.morning} stopOpacity={0.1} />
        </linearGradient>
      </defs>
      <rect x={-200} y={DESK_Y} width={1480} height={470} fill={`url(#${id}-top)`} />
      <path d={grain.join(' ')} fill="none" stroke={C.woodShade} strokeWidth={3} opacity={0.3} />
      {/* his shadow on the back of the desk */}
      <path d={`M240,${DESK_Y} C380,${DESK_Y + 60} 820,${DESK_Y + 70} 980,${DESK_Y}`} fill={rgba(C.deskShade, 0.32)} />
      {/* sun patch through the window */}
      <path d={`M-40,${DESK_Y + 40} L460,${DESK_Y + 40} L760,1800 L120,1800 Z`} fill={`url(#${id}-patch)`} opacity={shimmer} />
      <path d={`M${DESK_Y > 0 ? 210 : 0},${DESK_Y + 40} L250,${DESK_Y + 40} L470,1800 L420,1800 Z`} fill={rgba(C.wood, 0.25)} />
      <path d={`M-20,${DESK_Y} H1100`} stroke={ink()} strokeWidth={5} />
      <path d={`M-20,${DESK_Y + 6} H1100`} stroke={C.woodLight} strokeWidth={4} opacity={0.6} />
      {/* front lip + drawer */}
      <rect x={-20} y={1800} width={1120} height={44} fill={C.woodShade} stroke={ink()} strokeWidth={5} />
      <path d="M-20,1806 H1100" stroke={C.woodLight} strokeWidth={5} opacity={0.7} />
      <rect x={-20} y={1844} width={1120} height={120} fill={mixHex(C.woodShade, C.ink, 0.35)} />
      <rect x={300} y={1858} width={480} height={90} rx={6} fill={mixHex(C.woodShade, C.ink, 0.2)} stroke={ink()} strokeWidth={4} />
      <rect x={480} y={1880} width={120} height={14} rx={7} fill={C.chrome} stroke={ink()} strokeWidth={3} />
      {/* the dry ring stain where a glass used to stand */}
      <g transform="translate(560,1700)">
        <ellipse cx={0} cy={0} rx={58} ry={20} fill="none" stroke={rgba(C.woodShade, 0.6)} strokeWidth={5} strokeDasharray="150 14 60 8" />
        <ellipse cx={3} cy={1} rx={50} ry={16} fill="none" stroke={rgba(C.woodShade, 0.25)} strokeWidth={3} />
      </g>
    </g>
  );
};

/** Papers, pen, phone, sticky notes on the desk. */
export const DeskClutter: React.FC<{id: string; f: number}> = ({id, f}) => (
  <g>
    {/* phone face-down */}
    <g transform="translate(250,1730) rotate(-10)">
      <rect x={-60} y={-24} width={128} height={56} rx={12} fill={rgba(C.deskShade, 0.4)} transform="translate(8,8)" />
      <rect x={-64} y={-28} width={128} height={56} rx={12} fill={C.hoodie} stroke={ink()} strokeWidth={4} />
      <rect x={30} y={-18} width={22} height={22} rx={6} fill={C.inkSoft} />
      <path d="M-50,-18 L10,-18" stroke={C.hoodieLight} strokeWidth={4} opacity={0.7} />
    </g>
    {/* sticky notes */}
    <g transform="translate(96,1720) rotate(8)">
      <path d="M-46,-30 L46,-30 L50,34 L-44,30 Z" fill={C.alarmLight} stroke={ink()} strokeWidth={3.5} />
      <path d="M-30,-10 h50 M-30,6 h40" stroke={C.alarmDeep} strokeWidth={4} opacity={0.6} />
    </g>
    {/* papers (sunlit), corners lifting in the draught */}
    {[0, 1, 2].map((i) => {
      const a = -16 + i * 12 + Math.sin(f * 0.03 + i) * 0.6;
      const lift = 6 + 5 * Math.sin(f * 0.07 + i * 1.7);
      return (
        <g key={i} transform={`translate(${700 + i * 36},${1600 + i * 26}) rotate(${n1(a)}) scale(1,0.5)`}>
          <rect x={-130} y={-170} width={260} height={340} fill={rgba(C.deskShade, 0.25)} transform="translate(10,16)" />
          <path d={`M-130,-170 L130,-170 L130,${n1(170 - lift)} L${n1(110 - lift)},170 L-130,170 Z`} fill={mixHex(C.cream, C.morning, 0.4)} stroke={ink()} strokeWidth={6} strokeLinejoin="round" />
          <path d={`M130,${n1(170 - lift)} L${n1(110 - lift)},170 L${n1(108 - lift * 0.3)},${n1(150 - lift * 0.8)} Z`} fill={C.paper} stroke={ink()} strokeWidth={4} />
          {[0, 1, 2, 3, 4, 5, 6].map((k) => (
            <path key={k} d={`M-100,${-120 + k * 38} L${n1(40 + 60 * hash(k, i + 3))},${-120 + k * 38}`} stroke={C.jeansLight} strokeWidth={10} opacity={0.45} />
          ))}
        </g>
      );
    })}
    {/* pen */}
    <g transform={`translate(660,1770) rotate(${n1(-24 + Math.sin(f * 0.02) * 0.5)})`}>
      <rect x={-90} y={-7} width={180} height={14} rx={7} fill={C.jeans} stroke={ink()} strokeWidth={3.5} />
      <path d="M90,-7 L112,0 L90,7 Z" fill={C.cream} stroke={ink()} strokeWidth={3} />
      <path d="M-80,-3 H60" stroke={C.jeansLight} strokeWidth={3} />
    </g>
  </g>
);

/** Desk lamp at the right (off, it's morning — chrome glints). */
export const DeskLamp: React.FC<{id: string; f: number}> = ({id, f}) => {
  const bx = 975, by = 1440;
  const ex = 1040, ey = 1220;
  const hx = 905, hy = 1110;
  const glint = 0.55 + 0.25 * Math.sin(f * 0.05);
  return (
    <g>
      <ellipse cx={bx + 14} cy={by + 12} rx={84} ry={20} fill={rgba(C.deskShade, 0.35)} />
      <ellipse cx={bx} cy={by} rx={74} ry={22} fill={C.hoodie} stroke={ink()} strokeWidth={4} />
      <ellipse cx={bx - 10} cy={by - 6} rx={46} ry={9} fill={C.hoodieLight} opacity={0.6} />
      <path d={`M${bx},${by - 12} L${ex},${ey} L${hx},${hy}`} fill="none" stroke={C.ink} strokeWidth={20} strokeLinejoin="round" />
      <path d={`M${bx},${by - 12} L${ex},${ey} L${hx},${hy}`} fill="none" stroke={C.hoodieLight} strokeWidth={10} strokeLinejoin="round" />
      <circle cx={ex} cy={ey} r={13} fill={C.inkSoft} stroke={ink()} strokeWidth={3} />
      <g transform={`translate(${hx},${hy}) rotate(-38)`}>
        <path d="M-44,-14 L44,-14 L86,74 L-86,74 Z" fill={C.hoodie} stroke={ink()} strokeWidth={4.5} strokeLinejoin="round" />
        <path d="M-30,-8 L-60,62" stroke={C.morning} strokeWidth={6} opacity={glint} />
        <ellipse cx={0} cy={76} rx={78} ry={12} fill={C.steel} stroke={ink()} strokeWidth={3} />
      </g>
    </g>
  );
};

export const FgPlant: React.FC<{id: string; f: number}> = ({id, f}) => <PottedPlant id={id} f={f} x={1010} y={1960} s={1.25} seed={9} leaves={10} potCol={C.awning} L={L} />;

export const clamp01 = clamp;
