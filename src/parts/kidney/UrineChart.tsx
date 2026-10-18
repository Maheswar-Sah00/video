import React from 'react';
import {C} from '../../lib/palette';
import {MONO, TITLE} from '../../lib/fonts';
import {clamp, ramp, rgba} from '../../lib/anim';
import {spring} from '../../lib/MedKit';

// A doctor's URINE COLOUR CHART (vertical, 5 swatches C.urine0..4, pale straw -> brown) with a
// sliding marker. Screen space. `level` is a continuous swatch index (0 = pale straw … 4 = brown).
// `drop` 0..1 = the marker falls off the bottom (no urine at all); `stamp` 0..1 = "NO URINE".

const SW = [C.urine0, C.urine1, C.urine2, C.urine3, C.urine4];
export const CHART_W = 150;
export const SW_H = 86;
export const SW_GAP = 12;
export const SW_TOP = 88;
export const swatchY = (y: number, level: number) => y + SW_TOP + level * (SW_H + SW_GAP) + SW_H / 2;

export const UrineChart: React.FC<{
  f: number;
  x: number;
  y: number;
  slide?: number;
  level: number;
  drop?: number;
  stamp?: number; // frames since the stamp (<0 = none)
  dim?: number;
}> = ({f, x, y, slide = 1, level, drop = 0, stamp = -1, dim = 0}) => {
  if (slide <= 0.001) return null;
  const tx = (1 - slide) * 320;
  const h = SW_TOP + 5 * (SW_H + SW_GAP) + 18;
  const my = swatchY(y, level);
  const pulse = 0.5 + 0.5 * Math.sin(f * 0.25);
  const dropY = 1300 * drop * drop;
  const markerA = 1 - ramp(drop, 0.55, 1);
  const st = stamp >= 0 ? spring(stamp, 0.45, 5) : 0;
  const stS = stamp >= 0 ? 1.6 - 0.6 * spring(stamp, 0.45, 5) : 0;
  return (
    <g transform={`translate(${tx.toFixed(1)},0)`}>
      {/* card */}
      <rect x={x + 6} y={y + 10} width={CHART_W} height={h} rx={18} fill={rgba(C.navyDeep, 0.45)} />
      <rect x={x} y={y} width={CHART_W} height={h} rx={18} fill={rgba(C.navyDeep, 0.82)} stroke={rgba(C.bodyGhostLight, 0.55)} strokeWidth={2} />
      <text x={x + CHART_W / 2} y={y + 46} textAnchor="middle" fontFamily={TITLE} fontWeight={700} fontSize={36} letterSpacing={2} fill={C.cream}>
        URINE
      </text>
      <text x={x + CHART_W / 2} y={y + 70} textAnchor="middle" fontFamily={MONO} fontWeight={600} fontSize={14} letterSpacing={1.5} fill={rgba(C.hudDim, 0.95)}>
        COLOUR CHART
      </text>
      {SW.map((c, i) => {
        const sy = y + SW_TOP + i * (SW_H + SW_GAP);
        const near = clamp(1 - Math.abs(level - i)) * markerA;
        return (
          <g key={i} opacity={1 - 0.45 * dim}>
            <rect x={x + 40} y={sy} width={92} height={SW_H} rx={12} fill={c} stroke={rgba(C.ink, 0.85)} strokeWidth={2.5} />
            <rect x={x + 48} y={sy + 7} width={30} height={SW_H * 0.42} rx={8} fill="#ffffff" opacity={0.28 + 0.15 * near} />
            <text x={x + 21} y={sy + SW_H / 2 + 7} textAnchor="middle" fontFamily={MONO} fontWeight={600} fontSize={19} fill={rgba(C.hud, 0.55 + 0.45 * near)}>
              {i + 1}
            </text>
          </g>
        );
      })}
      {/* marker */}
      <g opacity={markerA} transform={`translate(0,${dropY.toFixed(1)}) rotate(${(drop * 160).toFixed(1)} ${x + 86} ${my.toFixed(1)})`}>
        <rect x={x + 32} y={my - SW_H / 2 - 8} width={108} height={SW_H + 16} rx={16} fill="none" stroke={rgba(C.cream, 0.22 + 0.15 * pulse)} strokeWidth={12} />
        <rect x={x + 32} y={my - SW_H / 2 - 8} width={108} height={SW_H + 16} rx={16} fill="none" stroke={C.cream} strokeWidth={4} />
        <path d={`M${x - 10},${(my - 16).toFixed(1)} L${x + 24},${my.toFixed(1)} L${x - 10},${(my + 16).toFixed(1)} Z`} fill={C.cream} stroke={rgba(C.ink, 0.8)} strokeWidth={2} strokeLinejoin="round" />
      </g>
      {/* NO URINE stamp */}
      {stamp >= 0 && (
        <g transform={`translate(${x + CHART_W / 2},${y + h * 0.56}) rotate(-14) scale(${stS.toFixed(3)})`} opacity={clamp(st * 1.4)}>
          <rect x={-112} y={-40} width={224} height={74} rx={10} fill={rgba(C.navyDeep, 0.92)} stroke={C.urine3} strokeWidth={5} />
          <rect x={-104} y={-32} width={208} height={58} rx={6} fill="none" stroke={rgba(C.urine3, 0.6)} strokeWidth={2} />
          <text x={0} y={16} textAnchor="middle" fontFamily={TITLE} fontWeight={700} fontSize={46} letterSpacing={3} fill={C.cream}>
            NO URINE
          </text>
        </g>
      )}
    </g>
  );
};
