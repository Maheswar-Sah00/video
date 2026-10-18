import React from 'react';
import {C} from '../../lib/palette';
import {blob, clamp, hash, lerp, mixHex, rgba, wander} from '../../lib/anim';

/** Night bedroom kit for S14 (owner: hero). Anime-cel, cool blue darkness + warm lamp + screen glow. */

const n1 = (v: number) => v.toFixed(1);
const ink = (o = 0.85) => rgba(C.ink, o);

/** Window with the night city: sky gradient, moon + drifting clouds, skyline with twinkling windows. */
export const NightWindow: React.FC<{id: string; f: number; x: number; y: number; w: number; h: number}> = ({id, f, x, y, w, h}) => {
  const towers: React.ReactNode[] = [];
  let lit = '';
  let litWarm = '';
  const N = 11;
  for (let i = 0; i < N; i++) {
    const tw = w / N + 30 * hash(i, 3);
    const tx = x - 20 + (i / N) * (w + 40) + (hash(i, 4) - 0.5) * 20;
    const th = h * (0.25 + 0.45 * hash(i, 5)) * (i % 3 === 1 ? 1.25 : 1);
    const ty = y + h - th;
    const near = i % 2 === 0;
    towers.push(<rect key={i} x={n1(tx)} y={n1(ty)} width={n1(tw)} height={n1(th + 4)} fill={near ? mixHex(C.roomNight, C.navyDeep, 0.3) : mixHex(C.roomNightLight, C.roomNight, 0.4)} />);
    const cols = Math.max(2, Math.floor(tw / 18)), rows = Math.floor(th / 26);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const k = i * 1000 + r * 31 + c;
        const on = hash(k, 7) > 0.55 !== (hash(k, 8) > 0.985 && Math.floor(f / 20 + hash(k, 9) * 10) % 2 === 0);
        if (!on) continue;
        const wx = tx + 6 + c * (tw - 10) / cols, wy = ty + 10 + r * 26;
        const seg = `M${n1(wx)},${n1(wy)} h7 v10 h-7 Z `;
        if (hash(k, 10) > 0.7) litWarm += seg;
        else lit += seg;
      }
  }
  const mx = x + w * 0.72 + f * 0.05, my = y + h * 0.2;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-nsky`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={C.navyDeep} />
          <stop offset={0.7} stopColor={C.roomNightLight} />
          <stop offset={1} stopColor={mixHex(C.roomNightLight, C.lampGlow, 0.18)} />
        </linearGradient>
        <radialGradient id={`${id}-moon`}>
          <stop offset={0} stopColor={C.cream} stopOpacity={0.5} />
          <stop offset={1} stopColor={C.cream} stopOpacity={0} />
        </radialGradient>
        <clipPath id={`${id}-wclip`}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-wclip)`}>
        <rect x={x} y={y} width={w} height={h} fill={`url(#${id}-nsky)`} />
        <circle cx={n1(mx)} cy={n1(my)} r={120} fill={`url(#${id}-moon)`} />
        <circle cx={n1(mx)} cy={n1(my)} r={34} fill={C.cream} opacity={0.92} />
        <circle cx={n1(mx + 10)} cy={n1(my - 6)} r={28} fill={mixHex(C.cream, C.roomNightLight, 0.25)} opacity={0.5} />
        {[0, 1, 2].map((i) => {
          const cx = x + ((hash(i, 21) * w + f * (0.6 + 0.3 * i)) % (w + 400)) - 200;
          return <path key={i} d={blob(cx, y + h * (0.12 + 0.12 * i), 70 + 20 * i, 30 + i, 0.25, 9, f * 0.01)} fill={C.roomNightLight} opacity={0.55} transform={`translate(0,0) scale(1,0.45) translate(0,${n1((y + h * (0.12 + 0.12 * i)) * (1 / 0.45 - 1))})`} />;
        })}
        {towers}
        <path d={lit} fill={C.lamp} opacity={0.75} />
        <path d={litWarm} fill={C.screenGlow} opacity={0.6} />
        {/* aircraft warning light */}
        <circle cx={n1(x + w * 0.38)} cy={n1(y + h * 0.42)} r={5} fill={C.hudBad} opacity={0.3 + 0.7 * Math.max(0, Math.sin(f * 0.12))} />
        {/* glass reflection */}
        <path d={`M${n1(x + w * 0.08)},${n1(y + h)} L${n1(x + w * 0.42)},${n1(y)} L${n1(x + w * 0.52)},${n1(y)} L${n1(x + w * 0.18)},${n1(y + h)} Z`} fill={C.screenGlow} opacity={0.05} />
      </g>
      {/* frame + mullions */}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={mixHex(C.roomNightLight, C.desk, 0.3)} strokeWidth={26} />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={ink()} strokeWidth={4} />
      <path d={`M${n1(x + w / 2)},${y} L${n1(x + w / 2)},${n1(y + h)} M${x},${n1(y + h * 0.55)} L${n1(x + w)},${n1(y + h * 0.55)}`} stroke={mixHex(C.roomNightLight, C.desk, 0.3)} strokeWidth={14} />
      <rect x={x - 30} y={y + h} width={w + 60} height={26} fill={mixHex(C.roomNightLight, C.desk, 0.35)} stroke={ink()} strokeWidth={4} />
    </g>
  );
};

/** Curtain hanging from a rail, slowly swaying. side -1 = left panel, 1 = right. */
export const Curtain: React.FC<{f: number; x: number; y: number; w: number; h: number; side: number}> = ({f, x, y, w, h, side}) => {
  const folds = 5;
  const sw = wander(f * 0.02, side + 3) * 10;
  let d = `M${n1(x)},${n1(y)} L${n1(x + w)},${n1(y)} `;
  const pts: string[] = [];
  for (let i = 0; i <= folds * 2; i++) {
    const t = i / (folds * 2);
    const px = x + w - t * w + (i % 2 ? 12 : -6) + sw * (1 - t * 0.3);
    pts.push(`${n1(px)},${n1(y + h + (i % 2 ? 18 : 0))}`);
  }
  d += `L${pts[0]} ` + pts.slice(1).map((q) => `L${q}`).join(' ') + ' Z';
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < folds * 2; i += 2) {
    const t = i / (folds * 2);
    const lx = x + w - t * w;
    lines.push(<path key={i} d={`M${n1(lx)},${n1(y + 20)} Q${n1(lx + sw * 0.5 + 6)},${n1(y + h * 0.5)} ${n1(lx + sw + 10)},${n1(y + h)}`} fill="none" stroke={mixHex(C.roomNight, C.ink, 0.4)} strokeWidth={10} opacity={0.7} />);
  }
  return (
    <g>
      <path d={d} fill={mixHex(C.roomNightLight, C.wardTealDeep, 0.25)} stroke={ink()} strokeWidth={4} strokeLinejoin="round" />
      {lines}
      <path d={`M${n1(x + (side < 0 ? w - 12 : 12))},${n1(y + 10)} L${n1(x + (side < 0 ? w - 14 : 14) + sw)},${n1(y + h)}`} stroke={C.screenGlow} strokeWidth={4} opacity={0.25} />
    </g>
  );
};

/** Wall clock with a ticking second hand (ticks every 30 frames from `tick0`). */
export const WallClock: React.FC<{f: number; x: number; y: number; r: number; tick0?: number}> = ({f, x, y, r, tick0 = 0}) => {
  const ticks = Math.floor((f - tick0) / 30);
  const since = f - tick0 - ticks * 30;
  const settle = since < 6 ? Math.exp(-since / 2) * Math.sin(since * 1.8) * 3 : 0;
  const sec = ticks * 6 + settle; // deg
  const min = 312 + (f / 1800) * 6;
  const hr = 25 + (f / 21600) * 30;
  const hand = (a: number, len: number, w: number, col: string) => (
    <path d={`M${n1(x)},${n1(y)} L${n1(x + Math.sin((a * Math.PI) / 180) * len)},${n1(y - Math.cos((a * Math.PI) / 180) * len)}`} stroke={col} strokeWidth={w} strokeLinecap="round" />
  );
  const marks: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    marks.push(<path key={i} d={`M${n1(x + Math.sin(a) * r * 0.8)},${n1(y - Math.cos(a) * r * 0.8)} L${n1(x + Math.sin(a) * r * 0.9)},${n1(y - Math.cos(a) * r * 0.9)}`} stroke={C.roomNight} strokeWidth={i % 3 ? 3 : 6} />);
  }
  return (
    <g>
      <circle cx={x} cy={y} r={r + 8} fill={mixHex(C.roomNightLight, C.desk, 0.4)} stroke={ink()} strokeWidth={4} />
      <circle cx={x} cy={y} r={r} fill={mixHex(C.cream, C.roomNightLight, 0.45)} />
      <path d={`M${n1(x - r * 0.9)},${n1(y + r * 0.2)} A${r * 0.9},${r * 0.9} 0 0 0 ${n1(x + r * 0.5)},${n1(y + r * 0.75)}`} fill="none" stroke={C.lampGlow} strokeWidth={5} opacity={0.35} />
      {marks}
      {hand(hr, r * 0.5, 7, C.roomNight)}
      {hand(min, r * 0.75, 5, C.roomNight)}
      {hand(sec, r * 0.82, 2.5, C.painDeep)}
      <circle cx={x} cy={y} r={5} fill={C.roomNight} />
    </g>
  );
};

/** Desk lamp (base on the desk at bx,by; head aims down-right). Returns art; light pool is separate. */
export const DeskLamp: React.FC<{f: number; bx: number; by: number; hx: number; hy: number}> = ({f, bx, by, hx, hy}) => {
  const ex = lerp(bx, hx, 0.35) - 60, ey = lerp(by, hy, 0.5) - 40;
  const flick = 0.95 + 0.05 * Math.sin(f * 0.9) * Math.sin(f * 0.37);
  return (
    <g>
      <ellipse cx={bx} cy={by} rx={70} ry={18} fill={C.deskShade} stroke={ink()} strokeWidth={4} />
      <path d={`M${bx},${by - 10} L${n1(ex)},${n1(ey)} L${n1(hx)},${n1(hy)}`} fill="none" stroke={C.ink} strokeWidth={18} strokeLinejoin="round" />
      <path d={`M${bx},${by - 10} L${n1(ex)},${n1(ey)} L${n1(hx)},${n1(hy)}`} fill="none" stroke={mixHex(C.roomNightLight, C.ink, 0.2)} strokeWidth={10} strokeLinejoin="round" />
      <circle cx={n1(ex)} cy={n1(ey)} r={10} fill={C.inkSoft} stroke={ink()} strokeWidth={3} />
      <g transform={`translate(${n1(hx)},${n1(hy)}) rotate(38)`}>
        <path d="M-40,-10 L40,-10 L80,70 L-80,70 Z" fill={mixHex(C.roomNightLight, C.ink, 0.15)} stroke={ink()} strokeWidth={4} strokeLinejoin="round" />
        <path d="M-80,70 L80,70" stroke={C.lamp} strokeWidth={8} />
        <ellipse cx={0} cy={74} rx={70} ry={12} fill={C.lamp} opacity={flick} />
        <path d="M-30,-6 L-56,60" stroke={C.lampGlow} strokeWidth={5} opacity={0.4} />
      </g>
    </g>
  );
};

/** Mug with rising steam. */
export const Mug: React.FC<{f: number; x: number; y: number; s?: number}> = ({f, x, y, s = 1}) => {
  const steam: React.ReactNode[] = [];
  for (let i = 0; i < 3; i++) {
    const ph = (f * 0.012 + i / 3) % 1;
    const sx = x + wander(f * 0.03 + i * 2, 70 + i) * 14 * s;
    const sy = y - 70 * s - ph * 160 * s;
    steam.push(<path key={i} d={`M${n1(sx)},${n1(sy + 30 * s)} q${n1(14 * s)},${n1(-15 * s)} 0,${n1(-30 * s)} q${n1(-14 * s)},${n1(-15 * s)} 0,${n1(-30 * s)}`} fill="none" stroke={C.cream} strokeWidth={6 * s} strokeLinecap="round" opacity={0.35 * Math.sin(Math.PI * ph)} />);
  }
  return (
    <g>
      {steam}
      <path d={`M${n1(x + 40 * s)},${n1(y - 50 * s)} q${n1(34 * s)},${n1(6 * s)} ${n1(26 * s)},${n1(36 * s)} q${n1(-6 * s)},${n1(16 * s)} ${n1(-26 * s)},${n1(12 * s)}`} fill="none" stroke={C.ink} strokeWidth={14 * s} />
      <path d={`M${n1(x + 40 * s)},${n1(y - 50 * s)} q${n1(34 * s)},${n1(6 * s)} ${n1(26 * s)},${n1(36 * s)} q${n1(-6 * s)},${n1(16 * s)} ${n1(-26 * s)},${n1(12 * s)}`} fill="none" stroke={C.wardTeal} strokeWidth={7 * s} />
      <path d={`M${n1(x - 42 * s)},${n1(y - 76 * s)} L${n1(x + 42 * s)},${n1(y - 76 * s)} L${n1(x + 38 * s)},${n1(y)} Q${n1(x)},${n1(y + 12 * s)} ${n1(x - 38 * s)},${n1(y)} Z`} fill={C.wardTeal} stroke={ink()} strokeWidth={4} />
      <path d={`M${n1(x - 30 * s)},${n1(y - 70 * s)} L${n1(x - 28 * s)},${n1(y - 8 * s)}`} stroke={C.lamp} strokeWidth={8 * s} opacity={0.5} />
      <ellipse cx={x} cy={y - 76 * s} rx={42 * s} ry={9 * s} fill={C.wardTealDeep} stroke={ink()} strokeWidth={3} />
      <ellipse cx={x} cy={y - 74 * s} rx={34 * s} ry={6 * s} fill={C.deskShade} />
    </g>
  );
};

/** Stack of books (x,y = bottom-left on the desk). */
export const Books: React.FC<{x: number; y: number; s?: number; seed?: number}> = ({x, y, s = 1, seed = 1}) => {
  const cols = [C.wardTealDeep, C.painDeep, C.jeans, C.lampGlow, C.leafDeep];
  const out: React.ReactNode[] = [];
  let yy = y;
  for (let i = 0; i < 4; i++) {
    const h = (26 + 10 * hash(i, seed)) * s;
    const w = (190 + 40 * hash(i, seed + 1)) * s;
    const dx = (hash(i, seed + 2) - 0.5) * 30 * s;
    out.push(
      <g key={i}>
        <rect x={n1(x + dx)} y={n1(yy - h)} width={n1(w)} height={n1(h)} rx={4} fill={cols[(i + seed) % cols.length]} stroke={ink()} strokeWidth={4} />
        <rect x={n1(x + dx + w - 18 * s)} y={n1(yy - h + 4)} width={n1(12 * s)} height={n1(h - 8)} fill={C.cream} opacity={0.75} />
        <path d={`M${n1(x + dx + 10)},${n1(yy - h * 0.5)} L${n1(x + dx + w * 0.5)},${n1(yy - h * 0.5)}`} stroke={C.cream} strokeWidth={3} opacity={0.4} />
      </g>,
    );
    yy -= h;
  }
  return <g>{out}</g>;
};

/** Open laptop seen from behind-side (its screen faces him): lid + keyboard edge + glow. */
export const LaptopBack: React.FC<{f: number; x: number; y: number; s?: number}> = ({f, x, y, s = 1}) => {
  const flick = 0.9 + 0.1 * Math.sin(f * 0.21) * Math.sin(f * 0.05);
  return (
    <g>
      <path d={`M${n1(x - 230 * s)},${n1(y)} L${n1(x + 230 * s)},${n1(y)} L${n1(x + 250 * s)},${n1(y + 22 * s)} L${n1(x - 250 * s)},${n1(y + 22 * s)} Z`} fill={C.steelDark} stroke={ink()} strokeWidth={4} />
      <path d={`M${n1(x - 220 * s)},${n1(y)} L${n1(x - 200 * s)},${n1(y - 300 * s)} L${n1(x + 200 * s)},${n1(y - 300 * s)} L${n1(x + 220 * s)},${n1(y)} Z`} fill={mixHex(C.steelDark, C.roomNight, 0.4)} stroke={ink()} strokeWidth={5} />
      <path d={`M${n1(x - 200 * s)},${n1(y - 300 * s)} L${n1(x + 200 * s)},${n1(y - 300 * s)}`} stroke={C.screenGlow} strokeWidth={6 * s} opacity={0.8 * flick} />
      <circle cx={x} cy={n1(y - 160 * s)} r={18 * s} fill={C.steel} opacity={0.4} />
      <path d={`M${n1(x + 120 * s)},${n1(y - 280 * s)} L${n1(x + 200 * s)},${n1(y - 40 * s)}`} stroke={C.lampGlow} strokeWidth={6} opacity={0.25} />
    </g>
  );
};

/** Loose papers on the desk. */
export const Papers: React.FC<{f: number; x: number; y: number; s?: number}> = ({f, x, y, s = 1}) => (
  <g>
    {[0, 1, 2].map((i) => {
      const a = -14 + i * 11 + Math.sin(f * 0.02 + i) * 0.4;
      return (
        <g key={i} transform={`translate(${n1(x + i * 40 * s)},${n1(y + i * 8 * s)}) rotate(${n1(a)}) scale(${s},${s * 0.42})`}>
          <rect x={-120} y={-160} width={240} height={320} fill={mixHex(C.cream, C.lamp, 0.25)} stroke={ink()} strokeWidth={6} />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <path key={k} d={`M-90,${-110 + k * 40} L${50 + 30 * hash(k, i)},${-110 + k * 40}`} stroke={C.roomNightLight} strokeWidth={9} opacity={0.4} />
          ))}
        </g>
      );
    })}
  </g>
);

/** Pill bottle (small, on the desk). */
export const PillBottle: React.FC<{x: number; y: number; s?: number}> = ({x, y, s = 1}) => (
  <g>
    <rect x={n1(x - 24 * s)} y={n1(y - 70 * s)} width={n1(48 * s)} height={n1(70 * s)} rx={8} fill={C.lampGlow} opacity={0.85} stroke={ink()} strokeWidth={4} />
    <rect x={n1(x - 28 * s)} y={n1(y - 90 * s)} width={n1(56 * s)} height={n1(22 * s)} rx={5} fill={C.cream} stroke={ink()} strokeWidth={4} />
    <rect x={n1(x - 18 * s)} y={n1(y - 52 * s)} width={n1(36 * s)} height={n1(30 * s)} fill={C.cream} />
  </g>
);

export const clampN = clamp;
