import React from 'react';
import {C} from '../../lib/palette';
import {rgba} from '../../lib/anim';
import {fx} from './util';

/** Circular magnifier inset (glass rim + gloss). Children are clipped to the circle and drawn in
 *  the lens' own coords (0,0 = lens centre). `pop` 0..1 scales it in. */
export const Lens: React.FC<{id: string; x: number; y: number; r: number; pop: number; f: number; children: React.ReactNode; tint?: string}> = ({
  id,
  x,
  y,
  r,
  pop,
  f,
  children,
  tint = C.navyDeep,
}) => {
  if (pop <= 0.001) return null;
  return (
    <g transform={`translate(${fx(x)},${fx(y)}) scale(${pop.toFixed(4)})`}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle r={r} />
        </clipPath>
        <radialGradient id={`${id}-vig`}>
          <stop offset="70%" stopColor={tint} stopOpacity={0} />
          <stop offset="100%" stopColor={tint} stopOpacity={0.75} />
        </radialGradient>
      </defs>
      <circle r={r + 26} fill={rgba(C.navyDeep, 0.45)} />
      <g clipPath={`url(#${id}-clip)`}>
        <circle r={r} fill={tint} />
        {children}
        <circle r={r} fill={`url(#${id}-vig)`} />
      </g>
      <circle r={r + 7} fill="none" stroke={rgba(C.chromeShade, 0.9)} strokeWidth={13} />
      <circle r={r + 7} fill="none" stroke={rgba(C.chrome, 0.8)} strokeWidth={3} transform="translate(-1.5,-1.5)" />
      <circle r={r} fill="none" stroke={rgba(C.ink, 0.8)} strokeWidth={3} />
      <path
        d={`M${fx(-r * 0.8)},${fx(-r * 0.32)} A${fx(r * 0.86)},${fx(r * 0.86)} 0 0 1 ${fx(-r * 0.2)},${fx(-r * 0.84)}`}
        fill="none"
        stroke={rgba('#ffffff', 0.32 + 0.06 * Math.sin(f * 0.05))}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <circle cx={fx(r * 0.62)} cy={fx(r * 0.6)} r={5} fill={rgba('#ffffff', 0.4)} />
    </g>
  );
};
