import React from 'react';
import {C} from '../../lib/palette';
import {clamp, hash, mixHex, rgba, wander} from '../../lib/anim';

/** Small drawing kit shared by the home scenes (S12 living room, S16 bedroom). Owner: home. */

export const n1 = (v: number) => v.toFixed(1);
export const ink = (o = 0.9) => rgba(C.ink, o);
export const INK = 4;

/** Cel box: flat fill + a hard shadow band on one side + a lit edge on the other + ink outline. */
export const CelRect: React.FC<{
  x: number; y: number; w: number; h: number; rx?: number;
  fill: string; shade: string; lit?: string; side?: 1 | -1; band?: number; inkW?: number; topLit?: number;
}> = ({x, y, w, h, rx = 6, fill, shade, lit, side = 1, band = 0.32, inkW = INK, topLit = 0}) => {
  const bw = w * band;
  const sx = side > 0 ? x : x + w - bw; // shadow on the side AWAY from the light (light from `side`)
  return (
    <g>
      <rect x={n1(x)} y={n1(y)} width={n1(w)} height={n1(h)} rx={rx} fill={fill} />
      <rect x={n1(sx)} y={n1(y)} width={n1(bw)} height={n1(h)} rx={rx} fill={shade} />
      {lit && <rect x={n1(side > 0 ? x + w - 7 : x + 2)} y={n1(y + 4)} width={5} height={n1(h - 8)} rx={2} fill={lit} />}
      {topLit > 0 && lit && <rect x={n1(x + 4)} y={n1(y + 2)} width={n1(w - 8)} height={n1(topLit)} rx={2} fill={lit} opacity={0.8} />}
      <rect x={n1(x)} y={n1(y)} width={n1(w)} height={n1(h)} rx={rx} fill="none" stroke={ink()} strokeWidth={inkW} strokeLinejoin="round" />
    </g>
  );
};

/** A row of book spines standing on a shelf (x,y = bottom-left), lit from the right. */
export const BookRow: React.FC<{x: number; y: number; w: number; seed: number; tint: string; tintK?: number; lit?: string; hMax?: number}> = ({
  x, y, w, seed, tint, tintK = 0.45, lit = C.duskLow, hMax = 150,
}) => {
  const cols = [C.jeans, C.wardTealDeep, C.duskMid, C.painDeep, C.leafDeep, C.cream, C.hoodieLight, C.wood, C.adhDeep];
  const out: React.ReactNode[] = [];
  let xx = x;
  let i = 0;
  while (xx < x + w - 16 && i < 40) {
    const bw = 18 + 20 * hash(i, seed);
    const bh = hMax * (0.62 + 0.38 * hash(i, seed + 1));
    const lean = hash(i, seed + 2) > 0.86 && xx + bw + 30 < x + w ? 8 + 6 * hash(i, seed + 3) : 0;
    const c = mixHex(cols[Math.floor(hash(i, seed + 4) * cols.length)], tint, tintK);
    const sh = mixHex(c, C.ink, 0.4);
    out.push(
      <g key={i} transform={lean ? `rotate(${n1(lean)} ${n1(xx + bw)} ${n1(y)})` : undefined}>
        <rect x={n1(xx)} y={n1(y - bh)} width={n1(bw)} height={n1(bh)} rx={2} fill={c} />
        <rect x={n1(xx)} y={n1(y - bh)} width={n1(bw * 0.38)} height={n1(bh)} rx={2} fill={sh} opacity={0.75} />
        <rect x={n1(xx + bw - 4)} y={n1(y - bh + 3)} width={3} height={n1(bh - 6)} fill={lit} opacity={0.55} />
        {hash(i, seed + 5) > 0.45 && <rect x={n1(xx + 3)} y={n1(y - bh * 0.72)} width={n1(bw - 6)} height={5} fill={mixHex(C.cream, tint, 0.4)} opacity={0.7} />}
        <rect x={n1(xx)} y={n1(y - bh)} width={n1(bw)} height={n1(bh)} rx={2} fill="none" stroke={ink()} strokeWidth={3} />
      </g>,
    );
    xx += bw + (lean ? 18 : 1);
    i++;
  }
  return <g>{out}</g>;
};

/** Trailing houseplant (pothos) in a pot; vines sway with lag. (x,y) = pot bottom centre. */
export const TrailingPlant: React.FC<{f: number; x: number; y: number; s?: number; tint: string; seed?: number; sway?: number; droop?: number}> = ({
  f, x, y, s = 1, tint, seed = 1, sway = 1, droop = 0,
}) => {
  const leaf = mixHex(C.plant, tint, 0.4);
  const leafD = mixHex(C.plantDeep, tint, 0.45);
  const vines: React.ReactNode[] = [];
  for (let v = 0; v < 4; v++) {
    const vx0 = x + (v - 1.5) * 22 * s;
    const len = (150 + 110 * hash(v, seed)) * s;
    let d = `M${n1(vx0)},${n1(y - 70 * s)}`;
    const pts: [number, number][] = [];
    for (let k = 1; k <= 7; k++) {
      const t = k / 7;
      const sw = wander(f * 0.025 - t * 0.9 + v * 3.1, seed + v) * 24 * s * t * sway;
      const px = vx0 + (v - 1.5) * 26 * s * t + sw;
      const py = y - 70 * s + len * t;
      pts.push([px, py]);
      d += ` L${n1(px)},${n1(py)}`;
    }
    vines.push(<path key={`v${v}`} d={d} fill="none" stroke={leafD} strokeWidth={4 * s} strokeLinecap="round" />);
    pts.forEach(([px, py], k) => {
      if (k % 2 === 0 && k > 0) return;
      const a = (k % 2 ? 1 : -1) * (40 + 20 * hash(k, v + seed)) + wander(f * 0.04 + k + v, 9) * 12 + droop * 25;
      vines.push(
        <g key={`l${v}-${k}`} transform={`translate(${n1(px)},${n1(py)}) rotate(${n1(a)}) scale(${s})`}>
          <path d="M0,0 C10,-6 22,-4 26,6 C20,16 6,16 0,0 Z" fill={leaf} stroke={ink()} strokeWidth={2.4} />
          <path d="M2,2 C10,2 18,4 24,6" fill="none" stroke={leafD} strokeWidth={2} />
        </g>,
      );
    });
  }
  // top bushy leaves
  const tops: React.ReactNode[] = [];
  for (let k = 0; k < 7; k++) {
    const a = -150 + k * 20 + wander(f * 0.03 + k, seed + 30) * 6;
    tops.push(
      <g key={k} transform={`translate(${n1(x + (k - 3) * 9 * s)},${n1(y - 76 * s)}) rotate(${n1(a + 90)}) scale(${s * 1.15})`}>
        <path d="M0,0 C10,-8 26,-6 32,6 C22,18 6,16 0,0 Z" fill={k % 2 ? leaf : leafD} stroke={ink()} strokeWidth={2.4} />
      </g>,
    );
  }
  return (
    <g>
      {vines}
      {tops}
      <path d={`M${n1(x - 42 * s)},${n1(y - 78 * s)} L${n1(x + 42 * s)},${n1(y - 78 * s)} L${n1(x + 32 * s)},${n1(y)} L${n1(x - 32 * s)},${n1(y)} Z`} fill={mixHex(C.cream, tint, 0.45)} stroke={ink()} strokeWidth={3.5} strokeLinejoin="round" />
      <path d={`M${n1(x - 42 * s)},${n1(y - 78 * s)} L${n1(x - 20 * s)},${n1(y - 78 * s)} L${n1(x - 16 * s)},${n1(y)} L${n1(x - 32 * s)},${n1(y)} Z`} fill={mixHex(C.cream, tint, 0.7)} />
      <path d={`M${n1(x + 30 * s)},${n1(y - 74 * s)} L${n1(x + 24 * s)},${n1(y - 4 * s)}`} stroke={C.duskLow} strokeWidth={4 * s} opacity={0.6} />
    </g>
  );
};

/** Floating dust motes inside a light beam: one path of tiny dots, drifting. */
export const Motes: React.FC<{f: number; x: number; y: number; w: number; h: number; n?: number; seed?: number; color: string; opacity?: number}> = ({
  f, x, y, w, h, n = 40, seed = 5, color, opacity = 0.7,
}) => {
  let d = '';
  let dBig = '';
  for (let i = 0; i < n; i++) {
    const px = x + ((hash(i, seed) * w + f * (0.25 + 0.4 * hash(i, seed + 1)) + wander(f * 0.02 + i, seed) * 30) % w + w) % w;
    const py = y + ((hash(i, seed + 2) * h - f * (0.15 + 0.3 * hash(i, seed + 3)) + wander(f * 0.017 + i * 3, seed + 7) * 26) % h + h) % h;
    const r = 1.4 + 2.2 * hash(i, seed + 4);
    const tw = 0.5 + 0.5 * Math.sin(f * 0.08 + i * 1.7);
    if (tw < 0.25) continue;
    const seg = `M${n1(px - r)},${n1(py)} a${n1(r)},${n1(r)} 0 1,0 ${n1(2 * r)},0 a${n1(r)},${n1(r)} 0 1,0 ${n1(-2 * r)},0 `;
    if (r > 2.8) dBig += seg;
    else d += seg;
  }
  return (
    <g opacity={clamp(opacity)}>
      <path d={d} fill={color} opacity={0.7} />
      <path d={dBig} fill={color} opacity={0.95} />
    </g>
  );
};

/** Curtain panel hanging from (x,y) w wide, h long; folds sway (wind from the window). */
export const CurtainPanel: React.FC<{id: string; f: number; x: number; y: number; w: number; h: number; seed: number; fill: string; shade: string; glow: string; glowK?: number; wind?: number}> = ({
  id, f, x, y, w, h, seed, fill, shade, glow, glowK = 0.5, wind = 1,
}) => {
  const folds = 4;
  const sw = (t: number) => (wander(f * 0.022 - t * 1.4, seed) * 26 + Math.sin(f * 0.05 - t * 2.2 + seed) * 8) * wind * t;
  const N = 10;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    left.push([x + sw(t), y + h * t]);
    right.push([x + w + sw(t) * 1.15 + Math.sin(t * 3 + seed) * 4, y + h * t]);
  }
  // bottom hem: wavy
  const hem: string[] = [];
  for (let k = 0; k <= folds * 2; k++) {
    const t = k / (folds * 2);
    const bx = right[N][0] + (left[N][0] - right[N][0]) * t;
    hem.push(`L${n1(bx)},${n1(y + h + (k % 2 ? 14 : 0) + Math.sin(f * 0.06 + k) * 3 * wind)}`);
  }
  const d = `M${n1(left[0][0])},${n1(left[0][1])} ` + right.map(([a, b]) => `L${n1(a)},${n1(b)}`).join(' ') + ' ' + hem.join(' ') + ' ' + [...left].reverse().map(([a, b]) => `L${n1(a)},${n1(b)}`).join(' ') + ' Z';
  const foldLines: React.ReactNode[] = [];
  for (let k = 0; k < folds; k++) {
    const u = (k + 0.5) / folds;
    const pts = left.map(([a, b], i) => [a + (right[i][0] - a) * u + Math.sin(i * 0.8 + k * 2 + f * 0.03) * 3, b] as [number, number]);
    const dd = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${n1(a)},${n1(b)}`).join(' ');
    foldLines.push(<path key={`s${k}`} d={dd} fill="none" stroke={shade} strokeWidth={w / folds * 0.42} strokeLinecap="round" opacity={0.85} />);
    foldLines.push(<path key={`g${k}`} d={dd} fill="none" stroke={glow} strokeWidth={4} transform="translate(9,0)" opacity={glowK} />);
  }
  return (
    <g>
      <clipPath id={`${id}-cc`}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={fill} />
      <g clipPath={`url(#${id}-cc)`}>{foldLines}</g>
      <path d={d} fill="none" stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
    </g>
  );
};
