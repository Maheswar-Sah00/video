import React from 'react';
import {C} from '../../lib/palette';
import {blob, clamp, hash, lerp, mixHex, rgba, wander} from '../../lib/anim';

/**
 * The MORNING KITCHEN (owner: hero) — S01 Hook, S02 LastDrop (macro), S20 Closing (brighter).
 * Anime-cel: warm cream wall, a tall window top-left with the low sun + swaying foliage outside,
 * plants on the sill, a sheer curtain, wooden upper cabinets top-right, white-mint tiles, the back
 * counter with a chrome gooseneck tap (under the window) + kettle, a stone island in the foreground.
 * World coordinates = the S01 framing at zoom 1 (1080×1920). Use `camTf` for parallax layers.
 */

const n1 = (v: number) => v.toFixed(1);
const ink = (o = 0.9) => rgba(C.ink, o);

/** Camera: world point (fx,fy) lands on screen (540,960)·… zoom z, orbit px ox. k = layer depth
 *  (1 = his plane, < 1 farther = moves/zooms less, > 1 nearer = more). */
export type Cam = {fx: number; fy: number; z: number; ox: number; oy?: number};
export const camTf = (c: Cam, k: number) => {
  const z = 1 + (c.z - 1) * k;
  const fx = 540 + (c.fx - 540) * k, fy = 960 + (c.fy - 960) * k;
  return `translate(${n1(540 + c.ox * (k - 1))},${n1(960 + (c.oy ?? 0) * (k - 1))}) scale(${z.toFixed(4)}) translate(${n1(-fx)},${n1(-fy)})`;
};
/** world -> screen for a layer of depth k */
export const camPt = (c: Cam, k: number, x: number, y: number) => {
  const z = 1 + (c.z - 1) * k;
  const fx = 540 + (c.fx - 540) * k, fy = 960 + (c.fy - 960) * k;
  return {x: 540 + c.ox * (k - 1) + (x - fx) * z, y: 960 + (c.oy ?? 0) * (k - 1) + (y - fy) * z};
};

export const WIN = {x: 30, y: 90, w: 470, h: 710};
export const BACK_TOP = 1290; // back counter top (world y)

/** A leafy potted plant; sway in px at the leaf tips. */
export const Plant: React.FC<{f: number; x: number; y: number; s: number; seed: number; pot?: string; kind?: 'bush' | 'tall'}> = ({f, x, y, s, seed, pot = mixHex(C.awning, C.wood, 0.45), kind = 'bush'}) => {
  const leaves: React.ReactNode[] = [];
  const n = kind === 'tall' ? 9 : 11;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (hash(i, seed) - 0.5) * (kind === 'tall' ? 1.6 : 2.6);
    const len = (kind === 'tall' ? 120 : 70) * (0.6 + 0.5 * hash(i, seed + 1));
    const sw = wander(f * 0.03 + i * 0.7, seed + 3) * 0.12 + Math.sin(f * 0.07 + i) * 0.03;
    const aa = a + sw;
    const tx = Math.cos(aa) * len, ty = Math.sin(aa) * len;
    const w = (kind === 'tall' ? 16 : 22) * (0.7 + 0.4 * hash(i, seed + 2));
    const px = -Math.sin(aa) * w, py = Math.cos(aa) * w;
    const d = `M0,-30 Q${n1(tx * 0.5 + px)},${n1(-30 + ty * 0.5 + py)} ${n1(tx)},${n1(-30 + ty)} Q${n1(tx * 0.5 - px)},${n1(-30 + ty * 0.5 - py)} 0,-30 Z`;
    const col = i % 3 === 0 ? C.plantDeep : i % 3 === 1 ? C.plant : mixHex(C.plant, C.leafLight, 0.5);
    leaves.push(<path key={i} d={d} fill={col} stroke={ink(0.85)} strokeWidth={2.4} strokeLinejoin="round" />);
    if (i % 2 === 0) leaves.push(<path key={`v${i}`} d={`M0,-30 Q${n1(tx * 0.5)},${n1(-30 + ty * 0.5)} ${n1(tx * 0.9)},${n1(-30 + ty * 0.9)}`} fill="none" stroke={rgba(C.leafLight, 0.6)} strokeWidth={2} />);
  }
  return (
    <g transform={`translate(${n1(x)},${n1(y)}) scale(${s})`}>
      {leaves}
      <path d="M-46,-34 L46,-34 L36,40 L-36,40 Z" fill={pot} stroke={ink()} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-50,-44 L50,-44 L48,-30 L-48,-30 Z" fill={mixHex(pot, C.cream, 0.18)} stroke={ink()} strokeWidth={3} strokeLinejoin="round" />
      <path d="M14,-28 L8,36" stroke={rgba(C.ink, 0.25)} strokeWidth={10} />
      <path d="M-34,-26 L-28,30" stroke={rgba('#ffffff', 0.25)} strokeWidth={6} strokeLinecap="round" />
    </g>
  );
};

/** Chrome gooseneck tap. Origin = base on the counter; at s=1 ~300 px tall, the spout mouth at
 *  (170,-232). handle 0..1 = lever open angle. */
export const TAP_MOUTH = {x: 172, y: -228};
export const Tap: React.FC<{id: string; x: number; y: number; s: number; handle?: number; lit?: number}> = ({id, x, y, s, handle = 0, lit = 1}) => {
  const neck = 'M0,0 L0,-250 C0,-340 170,-340 172,-250 L172,-236';
  const lv = -20 - handle * 50;
  return (
    <g transform={`translate(${n1(x)},${n1(y)}) scale(${s})`}>
      <defs>
        <linearGradient id={`${id}-cr`} x1={0} y1={0} x2={1} y2={0}>
          <stop offset={0} stopColor={C.chromeShade} />
          <stop offset={0.35} stopColor={C.chrome} />
          <stop offset={0.55} stopColor="#ffffff" />
          <stop offset={1} stopColor={C.chromeShade} />
        </linearGradient>
      </defs>
      <ellipse cx={0} cy={2} rx={48} ry={12} fill={C.chromeShade} stroke={ink()} strokeWidth={3} />
      <path d={neck} fill="none" stroke={C.ink} strokeWidth={40} strokeLinecap="round" />
      <path d={neck} fill="none" stroke={C.chrome} strokeWidth={33} strokeLinecap="round" />
      <path d={neck} fill="none" stroke={C.chromeShade} strokeWidth={12} strokeLinecap="round" transform="translate(9,4)" />
      <path d={neck} fill="none" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" transform="translate(-8,-2)" opacity={0.9 * lit} />
      <path d="M-6,-90 L-6,-210" stroke={rgba(C.morning, 0.9)} strokeWidth={7} strokeLinecap="round" opacity={lit} />
      {/* aerator */}
      <rect x={154} y={-246} width={36} height={22} rx={5} fill={`url(#${id}-cr)`} stroke={ink()} strokeWidth={3} />
      <ellipse cx={172} cy={-224} rx={15} ry={4.5} fill={C.inkSoft} stroke={ink()} strokeWidth={2} />
      {/* lever handle */}
      <g transform={`rotate(${n1(lv)} 0 -96)`}>
        <path d="M0,-96 L-96,-118" stroke={C.ink} strokeWidth={22} strokeLinecap="round" />
        <path d="M0,-96 L-96,-118" stroke={C.chrome} strokeWidth={15} strokeLinecap="round" />
        <path d="M-10,-101 L-88,-119" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
      </g>
      <circle cx={0} cy={-96} r={22} fill={`url(#${id}-cr)`} stroke={ink()} strokeWidth={3} />
    </g>
  );
};

/** Juice carton (orange). Origin = base centre. */
export const Carton: React.FC<{x: number; y: number; s: number; rot?: number}> = ({x, y, s, rot = 0}) => (
  <g transform={`translate(${n1(x)},${n1(y)}) rotate(${n1(rot)}) scale(${s})`}>
    <path d="M-50,0 L-50,-190 L50,-190 L50,0 Z" fill={mixHex(C.nutrient, C.awning, 0.35)} stroke={ink()} strokeWidth={3.5} strokeLinejoin="round" />
    <path d="M18,0 L18,-190 L50,-190 L50,0 Z" fill={mixHex(C.nutrientDeep, C.awning, 0.4)} />
    <path d="M-50,-190 L-36,-232 L36,-232 L50,-190 Z" fill={C.cream} stroke={ink()} strokeWidth={3.5} strokeLinejoin="round" />
    <path d="M-36,-232 L-30,-246 L30,-246 L36,-232" fill={C.cream} stroke={ink()} strokeWidth={3} strokeLinejoin="round" />
    <circle cx={-14} cy={-100} r={30} fill={C.nutrientLight} stroke={ink()} strokeWidth={3} />
    <path d="M-14,-130 q10,-14 22,-12" fill="none" stroke={C.leafDeep} strokeWidth={5} strokeLinecap="round" />
    <rect x={-42} y={-58} width={56} height={12} rx={3} fill={C.cream} opacity={0.85} />
    <path d="M-44,-182 L-44,-10" stroke="#ffffff" strokeWidth={5} opacity={0.4} strokeLinecap="round" />
  </g>
);

/** The far kitchen: wall, window (sky, sun, foliage, birds), curtain, sill plants, cabinets, tiles,
 *  back counter with the tap + kettle. `bright` 0..1 (S20 brighter sun). `clock` = wall clock
 *  {x,y,r, t: seconds angle 0..1}. `tap` = false hides the tap (S02 draws its own big one). */
export const KitchenBack: React.FC<{f: number; id: string; bright?: number; tap?: boolean; handle?: number; clock?: {x: number; y: number; r: number; sec: number}}> = ({f, id, bright = 0, tap = true, handle = 0, clock}) => {
  const {x: wx, y: wy, w: ww, h: wh} = WIN;
  // foliage outside
  const fol: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const cx = wx + (i / 8) * ww + (hash(i, 5) - 0.5) * 40 + wander(f * 0.02 + i, 9) * 8;
    const cy = wy + wh * (0.62 + 0.25 * hash(i, 6)) + wander(f * 0.025 + i * 2, 10) * 5;
    const r = 70 + 50 * hash(i, 7);
    fol.push(<path key={i} d={blob(cx, cy, r, 40 + i, 0.18, 9, f * 0.01)} fill={mixHex(i % 2 ? C.leaf : C.leafLight, C.skyLow, 0.45 - bright * 0.1)} />);
  }
  const fol2: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const cx = wx + ww * (0.1 + 0.22 * i) + wander(f * 0.03 + i, 19) * 12;
    const cy = wy + wh * 0.9 + wander(f * 0.035 + i, 20) * 6;
    fol2.push(<path key={i} d={blob(cx, cy, 90 + 30 * hash(i, 21), 60 + i, 0.2, 9, f * 0.012)} fill={mixHex(C.leafDeep, C.skyLow, 0.3)} />);
  }
  const birds = [0, 1].map((i) => {
    const t = ((f * (0.9 + i * 0.3) + i * 140) % 520) / 520;
    const bx = wx - 40 + t * (ww + 80), by = wy + 140 + i * 60 + Math.sin(t * 9 + i) * 12;
    const fl = Math.sin(f * 0.5 + i * 2) * 6;
    return <path key={i} d={`M${n1(bx - 12)},${n1(by - fl)} Q${n1(bx - 5)},${n1(by - 4)} ${n1(bx)},${n1(by)} Q${n1(bx + 5)},${n1(by - 4)} ${n1(bx + 12)},${n1(by - fl)}`} fill="none" stroke={rgba(C.inkSoft, 0.6)} strokeWidth={3} strokeLinecap="round" />;
  });
  // tiles
  let grout = '';
  for (let x = -240; x <= 1320; x += 92) grout += `M${x},${wy + wh + 30} L${x},${BACK_TOP} `;
  for (let y = wy + wh + 30; y <= BACK_TOP; y += 70) grout += `M-240,${y} L1320,${y} `;
  const cur = wander(f * 0.02, 33);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-wall`} x1={0} y1={0} x2={1} y2={1}>
          <stop offset={0} stopColor={mixHex(C.kitchenWall, C.morning, 0.5 + 0.3 * bright)} />
          <stop offset={0.6} stopColor={C.kitchenWall} />
          <stop offset={1} stopColor={mixHex(C.kitchenWall, C.kitchenWallShade, 0.7)} />
        </linearGradient>
        <linearGradient id={`${id}-sky`} x1={0} y1={0} x2={0.4} y2={1}>
          <stop offset={0} stopColor={mixHex(C.morning, '#ffffff', 0.3 + 0.3 * bright)} />
          <stop offset={0.45} stopColor={mixHex(C.skyLow, C.morning, 0.3)} />
          <stop offset={1} stopColor={mixHex(C.sky, C.skyLow, 0.5)} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset={0} stopColor="#ffffff" stopOpacity={1} />
          <stop offset={0.25} stopColor={C.sun} stopOpacity={0.9} />
          <stop offset={1} stopColor={C.sunGlow} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-tile`} x1={0} y1={0} x2={1} y2={0.3}>
          <stop offset={0} stopColor={mixHex(C.tile, C.morning, 0.45 + 0.2 * bright)} />
          <stop offset={1} stopColor={mixHex(C.tile, C.tileShade, 0.35)} />
        </linearGradient>
        <clipPath id={`${id}-win`}>
          <rect x={wx} y={wy} width={ww} height={wh} />
        </clipPath>
      </defs>
      <rect x={-300} y={-300} width={1680} height={2520} fill={`url(#${id}-wall)`} />
      {/* sunlit patch thrown on the wall by the window */}
      <path d={`M${wx + ww + 40},${wy + 120} L${wx + ww + 420},${wy + 300} L${wx + ww + 420},${wy + wh + 260} L${wx + ww + 40},${wy + wh + 60} Z`} fill={rgba(C.morningGlow, 0.18 + 0.1 * bright)} />
      {/* tiles */}
      <rect x={-300} y={wy + wh + 30} width={1680} height={BACK_TOP - wy - wh - 30} fill={`url(#${id}-tile)`} />
      <path d={grout} stroke={rgba(C.tileShade, 0.9)} strokeWidth={3} />
      <path d={`M-300,${wy + wh + 30} L1380,${wy + wh + 30}`} stroke={ink(0.5)} strokeWidth={3} />
      {/* window */}
      <g clipPath={`url(#${id}-win)`}>
        <rect x={wx} y={wy} width={ww} height={wh} fill={`url(#${id}-sky)`} />
        <circle cx={wx + 120} cy={wy + 150} r={260 + 30 * bright} fill={`url(#${id}-sun)`} opacity={0.95} />
        <circle cx={wx + 120} cy={wy + 150} r={44} fill="#ffffff" opacity={0.95} />
        {birds}
        {fol}
        {fol2}
        <path d={`M${wx + 60},${wy + wh} L${wx + 260},${wy} L${wx + 330},${wy} L${wx + 130},${wy + wh} Z`} fill="#ffffff" opacity={0.12} />
      </g>
      <rect x={wx} y={wy} width={ww} height={wh} fill="none" stroke={mixHex(C.cream, C.woodLight, 0.35)} strokeWidth={26} />
      <path d={`M${wx + ww / 2},${wy} L${wx + ww / 2},${wy + wh} M${wx},${wy + wh * 0.42} L${wx + ww},${wy + wh * 0.42}`} stroke={mixHex(C.cream, C.woodLight, 0.35)} strokeWidth={14} />
      <rect x={wx - 13} y={wy - 13} width={ww + 26} height={wh + 26} fill="none" stroke={ink(0.8)} strokeWidth={3.5} />
      {/* sheer curtain on the right of the window */}
      <path
        d={`M${wx + ww - 40},${wy - 30} C${wx + ww - 10 + cur * 12},${wy + 200} ${wx + ww - 70 + cur * 20},${wy + 420} ${wx + ww - 30 + cur * 26},${wy + wh + 10} L${wx + ww + 70 + cur * 18},${wy + wh + 20} C${wx + ww + 60},${wy + 400} ${wx + ww + 90},${wy + 200} ${wx + ww + 60},${wy - 30} Z`}
        fill={rgba(C.cream, 0.72)}
        stroke={ink(0.45)}
        strokeWidth={2.5}
      />
      <path d={`M${wx + ww - 6 + cur * 8},${wy + 40} C${wx + ww - 20 + cur * 14},${wy + 260} ${wx + ww - 4 + cur * 20},${wy + 460} ${wx + ww + 10 + cur * 24},${wy + wh}`} fill="none" stroke={rgba(C.kitchenWallShade, 0.6)} strokeWidth={4} />
      <rect x={wx - 60} y={wy - 46} width={ww + 200} height={14} rx={7} fill={C.woodShade} stroke={ink()} strokeWidth={3} />
      {/* sill + plants */}
      <rect x={wx - 40} y={wy + wh + 8} width={ww + 80} height={26} fill={mixHex(C.cream, C.woodLight, 0.25)} stroke={ink()} strokeWidth={3} />
      <Plant f={f} x={wx + 80} y={wy + wh - 32} s={0.9} seed={3} />
      <Plant f={f} x={wx + 250} y={wy + wh - 30} s={0.8} seed={8} kind="tall" pot={C.tile} />
      <Plant f={f} x={wx + 400} y={wy + wh - 32} s={0.75} seed={13} />
      {/* upper cabinets */}
      <g>
        <rect x={620} y={-60} width={520} height={600} fill={C.wood} stroke={ink()} strokeWidth={4} />
        <rect x={620} y={500} width={520} height={40} fill={C.woodShade} stroke={ink()} strokeWidth={4} />
        {[0, 1].map((i) => (
          <g key={i}>
            <rect x={650 + i * 250} y={-30} width={220} height={510} rx={6} fill={mixHex(C.wood, C.woodLight, 0.25)} stroke={ink(0.85)} strokeWidth={3} />
            <rect x={675 + i * 250} y={0} width={170} height={450} rx={4} fill="none" stroke={C.woodShade} strokeWidth={6} />
            <rect x={(i ? 920 : 820)} y={360} width={12} height={70} rx={6} fill={C.chrome} stroke={ink()} strokeWidth={2.5} />
          </g>
        ))}
        <path d="M620,-60 L620,540" stroke={rgba(C.morning, 0.6)} strokeWidth={8} />
        {/* under-cabinet warm light on the tiles */}
        <path d="M630,540 L1130,540 L1180,760 L580,760 Z" fill={rgba(C.morningGlow, 0.16)} />
      </g>
      {clock && (
        <g transform={`translate(${clock.x},${clock.y})`}>
          <circle r={clock.r + 10} fill={C.woodShade} stroke={ink()} strokeWidth={3} />
          <circle r={clock.r} fill={C.cream} stroke={ink(0.6)} strokeWidth={2} />
          {Array.from({length: 12}, (_, i) => (
            <path key={i} d={`M0,${-clock.r + 6} L0,${-clock.r + (i % 3 ? 14 : 22)}`} stroke={C.inkSoft} strokeWidth={i % 3 ? 3 : 5} transform={`rotate(${i * 30})`} />
          ))}
          <path d={`M0,0 L0,${-clock.r * 0.5}`} stroke={C.ink} strokeWidth={7} strokeLinecap="round" transform="rotate(250)" />
          <path d={`M0,0 L0,${-clock.r * 0.75}`} stroke={C.ink} strokeWidth={5} strokeLinecap="round" transform="rotate(58)" />
          <path d={`M0,${clock.r * 0.15} L0,${-clock.r * 0.85}`} stroke={C.hudBad} strokeWidth={2.5} strokeLinecap="round" transform={`rotate(${n1(clock.sec * 360)})`} />
          <circle r={6} fill={C.ink} />
          <path d={`M${-clock.r * 0.6},${-clock.r * 0.55} A${clock.r},${clock.r} 0 0 1 ${clock.r * 0.4},${-clock.r * 0.8}`} fill="none" stroke="#ffffff" strokeWidth={5} opacity={0.6} />
        </g>
      )}
      {/* back counter */}
      <rect x={-300} y={BACK_TOP} width={1680} height={40} fill={mixHex(C.counter, C.morning, 0.2)} stroke={ink()} strokeWidth={3.5} />
      <path d={`M-300,${BACK_TOP + 3} L1380,${BACK_TOP + 3}`} stroke={rgba('#ffffff', 0.6)} strokeWidth={4} />
      <rect x={-300} y={BACK_TOP + 40} width={1680} height={800} fill={C.woodShade} stroke={ink()} strokeWidth={3.5} />
      {[-200, 100, 400, 700, 1000].map((x, i) => (
        <g key={i}>
          <rect x={x} y={BACK_TOP + 64} width={270} height={600} rx={5} fill={mixHex(C.wood, C.woodShade, 0.4)} stroke={ink(0.7)} strokeWidth={3} />
          <rect x={x + 120} y={BACK_TOP + 90} width={30} height={10} rx={5} fill={C.chrome} stroke={ink()} strokeWidth={2} />
        </g>
      ))}
      {tap && <Tap id={`${id}-tap`} x={170} y={BACK_TOP + 4} s={0.62} handle={handle} />}
      {/* kettle */}
      <g transform={`translate(830,${BACK_TOP + 2})`}>
        <path d="M-70,0 Q-80,-110 -40,-140 L40,-140 Q80,-110 70,0 Z" fill={C.steel} stroke={ink()} strokeWidth={3.5} />
        <path d="M-40,-140 Q0,-170 40,-140" fill={C.steelDark} stroke={ink()} strokeWidth={3} />
        <path d="M-30,-150 Q0,-210 30,-150" fill="none" stroke={C.ink} strokeWidth={14} />
        <path d="M-30,-150 Q0,-210 30,-150" fill="none" stroke={C.woodShade} strokeWidth={8} />
        <path d="M70,-40 L118,-96" stroke={C.ink} strokeWidth={20} strokeLinecap="round" />
        <path d="M70,-40 L118,-96" stroke={C.steel} strokeWidth={13} strokeLinecap="round" />
        <path d="M-52,-20 Q-60,-90 -30,-124" fill="none" stroke="#ffffff" strokeWidth={8} opacity={0.6} strokeLinecap="round" />
      </g>
      {/* utensil jar */}
      <g transform={`translate(990,${BACK_TOP + 2})`}>
        <path d="M-14,-90 L-30,-190 M2,-90 L4,-200 M14,-90 L34,-180" stroke={C.woodShade} strokeWidth={9} strokeLinecap="round" />
        <ellipse cx={-30} cy={-196} rx={12} ry={18} fill={C.wood} stroke={ink()} strokeWidth={2.5} />
        <rect x={-36} y={-96} width={72} height={96} rx={10} fill={C.tile} stroke={ink()} strokeWidth={3} />
      </g>
    </g>
  );
};

/** Sun shafts from the window toward the lower right + dust motes inside them (overlay layer). */
export const Shafts: React.FC<{f: number; id: string; bright?: number; motes?: number}> = ({f, id, bright = 0, motes = 34}) => {
  const {x: wx, y: wy, w: ww, h: wh} = WIN;
  const beams = [
    {a: [wx + 60, wy], b: [wx + 220, wy], spread: 1, o: 0.17},
    {a: [wx + 260, wy + 20], b: [wx + 420, wy + 40], spread: 1.1, o: 0.13},
    {a: [wx + 40, wy + 300], b: [wx + 200, wy + 330], spread: 0.9, o: 0.1},
  ];
  const dir = [0.62, 0.78];
  const L = 1900;
  let md = '';
  let md2 = '';
  for (let i = 0; i < motes; i++) {
    const t = hash(i, 71);
    const bi = i % 3;
    const bm = beams[bi];
    const ox = lerp(bm.a[0], bm.b[0], hash(i, 72)), oy = lerp(bm.a[1], bm.b[1], hash(i, 72));
    const dd = (t * 0.7 + ((f * 0.0012 * (0.5 + hash(i, 73))) % 0.7)) % 0.7;
    const x = ox + dir[0] * L * dd + wander(f * 0.01 + i, 74) * 30;
    const y = oy + dir[1] * L * dd + wander(f * 0.012 + i, 75) * 30 - f * 0.08 * hash(i, 76);
    const r = 1.6 + 3 * hash(i, 77);
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(f * 0.06 + i * 1.7));
    const seg = `M${n1(x - r)},${n1(y)} a${n1(r)},${n1(r)} 0 1,0 ${n1(2 * r)},0 a${n1(r)},${n1(r)} 0 1,0 ${n1(-2 * r)},0 `;
    if (tw > 0.7) md += seg;
    else md2 += seg;
  }
  return (
    <g style={{mixBlendMode: 'screen'}}>
      <defs>
        <linearGradient id={`${id}-sh`} x1={0} y1={0} x2={dir[0]} y2={dir[1]}>
          <stop offset={0} stopColor={C.morning} stopOpacity={1} />
          <stop offset={0.7} stopColor={C.morningGlow} stopOpacity={0.35} />
          <stop offset={1} stopColor={C.morningGlow} stopOpacity={0} />
        </linearGradient>
      </defs>
      {beams.map((bm, i) => {
        const o = bm.o * (1 + 0.6 * bright) * (0.75 + 0.25 * wander(f * 0.02 + i * 3, 80));
        const w0 = Math.hypot(bm.b[0] - bm.a[0], bm.b[1] - bm.a[1]) * bm.spread * 1.6;
        const ex = bm.a[0] + dir[0] * L, ey = bm.a[1] + dir[1] * L;
        const px = -dir[1], py = dir[0];
        return <path key={i} d={`M${bm.a[0]},${bm.a[1]} L${bm.b[0]},${bm.b[1]} L${n1(ex + px * -w0 * 0.2 + (bm.b[0] - bm.a[0]))},${n1(ey + py * -w0 * 0.2 + (bm.b[1] - bm.a[1]))} L${n1(ex - px * w0 * 0.2)},${n1(ey - py * w0 * 0.2)} Z`} fill={`url(#${id}-sh)`} opacity={o} />;
      })}
      <path d={md} fill={C.sun} opacity={0.85} />
      <path d={md2} fill={C.morning} opacity={0.45} />
      <circle cx={wx + 120} cy={wy + 150} r={10} fill="none" />
      {void ww}
      {void wh}
    </g>
  );
};

/** Foreground stone island: far edge at y0, fills down past the frame bottom. Items: fruit bowl
 *  (left), herb pot (right). */
export const Island: React.FC<{f: number; id: string; y0: number; items?: boolean; bright?: number}> = ({f, id, y0, items = true, bright = 0}) => (
  <g>
    <defs>
      <linearGradient id={`${id}-isl`} x1={0} y1={0} x2={0} y2={1}>
        <stop offset={0} stopColor={mixHex(C.counter, C.counterShade, 0.25)} />
        <stop offset={0.5} stopColor={mixHex(C.counter, C.morning, 0.25 + 0.15 * bright)} />
        <stop offset={1} stopColor={C.counter} />
      </linearGradient>
    </defs>
    <rect x={-300} y={y0} width={1680} height={190} fill={`url(#${id}-isl)`} stroke={ink()} strokeWidth={4} />
    {/* stone speckle + sun streak */}
    <path d={`M-300,${y0 + 6} L1380,${y0 + 6}`} stroke={rgba(C.counterShade, 0.5)} strokeWidth={5} />
    <path d={`M120,${y0 + 40} L560,${y0 + 40} L640,${y0 + 150} L60,${y0 + 150} Z`} fill={rgba(C.morning, 0.25 + 0.15 * bright)} />
    {Array.from({length: 26}, (_, i) => (
      <circle key={i} cx={n1(-200 + hash(i, 91) * 1500)} cy={n1(y0 + 20 + hash(i, 92) * 160)} r={n1(1.5 + 2.5 * hash(i, 93))} fill={rgba(i % 2 ? C.counterShade : '#ffffff', 0.5)} />
    ))}
    <rect x={-300} y={y0 + 190} width={1680} height={34} fill={mixHex(C.counter, C.morning, 0.35)} stroke={ink()} strokeWidth={4} />
    <rect x={-300} y={y0 + 224} width={1680} height={500} fill={C.woodShade} stroke={ink()} strokeWidth={4} />
    {[-160, 200, 560, 920].map((x, i) => (
      <rect key={i} x={x} y={y0 + 250} width={330} height={400} rx={6} fill={mixHex(C.wood, C.woodShade, 0.3)} stroke={ink(0.7)} strokeWidth={3} />
    ))}
    {items && (
      <g>
        {/* fruit bowl, left */}
        <g transform={`translate(70,${y0 + 70})`}>
          {[[-60, -40, C.nutrient], [0, -66, C.awning], [52, -42, C.leafLight], [-20, -30, C.nutrientDeep]].map(([x, y, c], i) => (
            <g key={i}>
              <circle cx={x as number} cy={y as number} r={42} fill={c as string} stroke={ink()} strokeWidth={3} />
              <circle cx={(x as number) - 14} cy={(y as number) - 14} r={10} fill="#ffffff" opacity={0.45} />
            </g>
          ))}
          <path d="M-130,-30 Q0,90 130,-30 Z" fill={C.tile} stroke={ink()} strokeWidth={3.5} />
          <path d="M-110,-14 Q0,60 110,-14" fill="none" stroke={C.tileShade} strokeWidth={6} />
        </g>
        <Plant f={f} x={1000} y={y0 + 60} s={1.15} seed={21} kind="tall" pot={mixHex(C.awning, C.wood, 0.5)} />
      </g>
    )}
  </g>
);
