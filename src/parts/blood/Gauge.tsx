import React from 'react';
import {C} from '../../lib/palette';
import {TITLE, MONO} from '../../lib/fonts';
import {clamp, rgba} from '../../lib/anim';
import {fx} from './util';

/** Blood-pressure dial (gauge) 40–180 mmHg over a 270° sweep; red zone below 90. `value` = the
 *  systolic pressure the needle shows; `danger` 0..1 = red-zone glow; `pop` 0..1 scale-in. */
export const angOf = (v: number) => ((135 + ((clamp(v, 30, 190) - 40) / 140) * 270) * Math.PI) / 180;

export const Gauge: React.FC<{x: number; y: number; r: number; value: number; danger: number; pop?: number; f: number}> = ({x, y, r, value, danger, pop = 1, f}) => {
  if (pop <= 0.001) return null;
  const arc = (v0: number, v1: number, rr: number) => {
    const a0 = angOf(v0);
    const a1 = angOf(v1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${fx(Math.cos(a0) * rr)},${fx(Math.sin(a0) * rr)} A${fx(rr)},${fx(rr)} 0 ${large} 1 ${fx(Math.cos(a1) * rr)},${fx(Math.sin(a1) * rr)}`;
  };
  const ar = r - 24;
  let ticks = '';
  for (let v = 40; v <= 180; v += 10) {
    const a = angOf(v);
    const r0 = v % 40 === 0 ? r - 50 : r - 42;
    ticks += `M${fx(Math.cos(a) * r0)},${fx(Math.sin(a) * r0)} L${fx(Math.cos(a) * (r - 34))},${fx(Math.sin(a) * (r - 34))} `;
  }
  const na = angOf(value);
  const nl = r - 30;
  const tone = value < 90 ? C.hudBad : value < 105 ? C.hudWarn : C.hud;
  return (
    <g transform={`translate(${fx(x)},${fx(y)}) scale(${pop.toFixed(4)})`}>
      <circle r={r + 30} fill={rgba(C.hudBad, 0.18 * danger)} />
      <circle r={r + 8} fill={rgba(C.navyDeep, 0.5)} stroke={rgba(C.chromeShade, 0.8)} strokeWidth={10} />
      <circle r={r + 8} fill="none" stroke={rgba(C.chrome, 0.75)} strokeWidth={3} />
      <circle r={r} fill={rgba(C.navyDeep, 0.85)} stroke={rgba(C.bodyGhostLight, 0.5)} strokeWidth={2} />
      <path d={arc(40, 90, ar)} fill="none" stroke={C.hudBad} strokeWidth={14} opacity={0.75 + 0.25 * danger} />
      <path d={arc(90, 140, ar)} fill="none" stroke={rgba(C.hud, 0.55)} strokeWidth={14} />
      <path d={arc(140, 180, ar)} fill="none" stroke={C.hudWarn} strokeWidth={14} opacity={0.8} />
      <path d={ticks} stroke={rgba(C.hud, 0.75)} strokeWidth={2.5} />
      {[40, 80, 120, 160].map((v) => {
        const a = angOf(v);
        return (
          <text key={v} x={fx(Math.cos(a) * (r - 68))} y={fx(Math.sin(a) * (r - 68) + 7)} textAnchor="middle" fontFamily={MONO} fontSize={19} fill={rgba(C.hud, 0.8)}>
            {v}
          </text>
        );
      })}
      <text y={r * 0.42} textAnchor="middle" fontFamily={MONO} fontSize={17} fill={rgba(C.hudDim, 0.9)} letterSpacing={1.5}>
        mmHg
      </text>
      <text y={r * 0.72} textAnchor="middle" fontFamily={TITLE} fontWeight={700} fontSize={40} fill={tone}>
        {Math.round(value)}/{Math.round(value * 0.62)}
      </text>
      {/* needle */}
      <g transform={`rotate(${fx((na * 180) / Math.PI)})`}>
        <path d={`M-18,-6 L${nl},-1.5 L${nl},1.5 L-18,6 Z`} fill={rgba(C.ink, 0.6)} transform="translate(3,4)" />
        <path d={`M-18,-6 L${nl},-1.5 L${nl},1.5 L-18,6 Z`} fill={C.cream} stroke={rgba(C.ink, 0.8)} strokeWidth={1.5} />
        <path d={`M${nl - 26},-3 L${nl},-1.5 L${nl},1.5 L${nl - 26},3 Z`} fill={C.hudBad} />
      </g>
      <circle r={13} fill={C.chromeShade} stroke={rgba(C.ink, 0.8)} strokeWidth={2} />
      <circle r={6} cx={-3} cy={-3} fill={C.chrome} />
      {/* glass gloss */}
      <path d={`M${-r * 0.78},${-r * 0.3} A${r * 0.85},${r * 0.85} 0 0 1 ${r * 0.3},${-r * 0.8}`} fill="none" stroke={rgba('#ffffff', 0.22 + 0.05 * Math.sin(f * 0.05))} strokeWidth={9} strokeLinecap="round" />
    </g>
  );
};
