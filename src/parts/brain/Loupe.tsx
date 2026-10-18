import React from 'react';
import {C} from '../../lib/palette';
import {rgba} from '../../lib/anim';

const fx = (n: number) => n.toFixed(1);

/** External tangent points between a small target circle (c1,r1) and the loupe (c2,r2). */
export const tangents = (c1: [number, number], r1: number, c2: [number, number], r2: number) => {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(r2 - r1) + 1) return [];
  const th = Math.atan2(dy, dx);
  const phi = Math.acos((r1 - r2) / d);
  return [th + phi, th - phi].map((a) => ({
    a: [c1[0] + r1 * Math.cos(a), c1[1] + r1 * Math.sin(a)] as [number, number],
    b: [c2[0] + r2 * Math.cos(a), c2[1] + r2 * Math.sin(a)] as [number, number],
  }));
};

/** A glass magnifier lens (screen space): circular window with a glossy rim, content clipped
 *  inside in LOCAL coords (0,0 = centre), optional callout lines to a target circle. */
export const Loupe: React.FC<{
  id: string;
  f: number;
  x: number;
  y: number;
  r: number;
  open: number; // 0..1+ (overshoot ok)
  target?: [number, number];
  targetR?: number;
  tint?: string;
  children: React.ReactNode;
}> = ({id, f, x, y, r, open, target, targetR = 34, tint = C.bodyGhostLight, children}) => {
  if (open <= 0.01) return null;
  const R = r * open;
  const tl = target ? tangents(target, targetR, [x, y], R) : [];
  return (
    <g>
      <defs>
        <clipPath id={`${id}-lclip`}>
          <circle cx={x} cy={y} r={R} />
        </clipPath>
        <radialGradient id={`${id}-lvig`} cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor={C.navyDeep} stopOpacity={0} />
          <stop offset="100%" stopColor={C.navyDeep} stopOpacity={0.55} />
        </radialGradient>
        <linearGradient id={`${id}-lrim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
          <stop offset="45%" stopColor={tint} stopOpacity={0.55} />
          <stop offset="100%" stopColor={C.bodyGhost} stopOpacity={0.9} />
        </linearGradient>
      </defs>
      {target && (
        <g opacity={Math.min(1, open)}>
          {tl.map((t, i) => (
            <line key={i} x1={t.a[0]} y1={t.a[1]} x2={t.b[0]} y2={t.b[1]} stroke={rgba(tint, 0.55)} strokeWidth={2} strokeDasharray="7 7" strokeDashoffset={fx(-f * 0.8)} />
          ))}
          <circle cx={target[0]} cy={target[1]} r={targetR} fill={rgba(tint, 0.08)} stroke={rgba(tint, 0.9)} strokeWidth={2.5} />
          <circle cx={target[0]} cy={target[1]} r={targetR + 8} fill="none" stroke={rgba(tint, 0.3)} strokeWidth={6} />
        </g>
      )}
      {/* drop shadow + backing */}
      <circle cx={x + 6} cy={y + 10} r={R + 14} fill={rgba(C.navyDeep, 0.45)} />
      <g clipPath={`url(#${id}-lclip)`}>
        <g transform={`translate(${fx(x)},${fx(y)}) scale(${fx(Math.max(0.01, open))})`}>{children}</g>
        <circle cx={x} cy={y} r={R} fill={`url(#${id}-lvig)`} />
        {/* glass glare */}
        <ellipse cx={x - R * 0.35} cy={y - R * 0.5} rx={R * 0.5} ry={R * 0.2} fill={rgba('#ffffff', 0.14)} transform={`rotate(-30 ${fx(x - R * 0.35)} ${fx(y - R * 0.5)})`} />
      </g>
      <circle cx={x} cy={y} r={R + 6} fill="none" stroke={rgba(C.navyDeep, 0.8)} strokeWidth={16} />
      <circle cx={x} cy={y} r={R + 6} fill="none" stroke={`url(#${id}-lrim)`} strokeWidth={9} />
      <circle cx={x} cy={y} r={R + 1} fill="none" stroke={rgba('#ffffff', 0.35)} strokeWidth={1.5} />
      <path
        d={`M${fx(x - (R + 6) * Math.cos(0.5))},${fx(y - (R + 6) * Math.sin(0.5))} A${fx(R + 6)},${fx(R + 6)} 0 0 1 ${fx(x - (R + 6) * Math.cos(1.6))},${fx(y - (R + 6) * Math.sin(1.6))}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.85}
      />
    </g>
  );
};
