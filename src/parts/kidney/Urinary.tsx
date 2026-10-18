import React from 'react';
import {C} from '../../lib/palette';
import {mixHex, rgba, smoothPath} from '../../lib/anim';
import {BLADDER, BLADDER_SHAPE, pathAt, pathD, URETER_L, URETER_R, type PathT} from './geom';

// Ureters (glass tubes carrying urine down in peristaltic pulses, with little flow chevrons) and
// the glowing glass BLADDER in the pelvis. Urine is shown ONLY as colour (no streams, no toilets).

const fx = (n: number) => n.toFixed(1);

export const Urinary: React.FC<{
  id: string;
  f: number; // abs frame (slosh)
  uflowT: number; // integrated urine flow time (frames at normal speed)
  urine: string;
  flow?: number; // 0..1 visible peristaltic pulses
  drain?: number; // 0..1 ureters emptied from the top (run dry)
  fill?: number; // 0..1 bladder level
  glow?: number; // 0..1 bladder glow
  arrows?: number; // 0..1 chevron opacity
  arrowGrey?: number; // 0..1 chevrons turn grey (frozen)
}> = ({id, f, uflowT, urine, flow = 1, drain = 0, fill = 0.6, glow = 0.5, arrows = 1, arrowGrey = 0}) => {
  const urLight = mixHex(urine, '#ffffff', 0.35);
  const tube = (P: PathT, k: string) => {
    const d = pathD(P);
    const len = P.len;
    let chev = '';
    for (let i = 0; i < 6; i++) {
      const dd = (((i * len) / 6 + uflowT * 3.2) % len + len) % len;
      if (dd < 30 || dd > len - 30) continue;
      const [x, y, a] = pathAt(P, dd);
      const c = Math.cos(a);
      const s = Math.sin(a);
      const pt = (px: number, py: number) => `${fx(x + px * c - py * s)},${fx(y + px * s + py * c)}`;
      chev += `M${pt(-7, -9)}L${pt(4, 0)}L${pt(-7, 9)}`;
    }
    return (
      <g key={k}>
        <path d={d} fill="none" stroke={rgba(C.ink, 0.6)} strokeWidth={18} strokeLinecap="round" />
        <path d={d} fill="none" stroke={rgba(C.bodyGhost, 0.3)} strokeWidth={14} strokeLinecap="round" />
        {drain < 0.999 && (
          <path
            d={d}
            fill="none"
            stroke={rgba(urine, 0.72)}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${fx(len * (1 - drain))} ${fx(len * 2)}`}
            strokeDashoffset={fx(-len * drain)}
          />
        )}
        {flow > 0.01 && (
          <path
            d={d}
            fill="none"
            stroke={rgba(urLight, 0.85 * flow * (1 - drain))}
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray="22 120"
            strokeDashoffset={fx(-uflowT * 3.2)}
          />
        )}
        {arrows > 0.01 && chev && (
          <path d={chev} fill="none" stroke={rgba(mixHex(C.cream, C.saltDeep, arrowGrey), 0.85 * arrows)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
        <path d={d} fill="none" stroke={rgba('#ffffff', 0.35)} strokeWidth={2} transform="translate(-4,-1)" />
      </g>
    );
  };

  // bladder
  const sz = 0.8 + 0.2 * fill;
  const bw = BLADDER.w * sz;
  const bh = BLADDER.h * sz;
  const bx = BLADDER.x;
  const by = BLADDER.y + (1 - sz) * BLADDER.h * 0.9;
  const shape = smoothPath(
    BLADDER_SHAPE.map(([x, y]) => [bx + x * bw, by + y * bh]),
    true,
  );
  const level = by + bh * 0.98 - fill * bh * 1.85;
  const wav = 4 * Math.sin(f * 0.13);
  const surf = `M${fx(bx - bw - 10)},${fx(level + wav)} Q${fx(bx - bw / 2)},${fx(level - 6 - wav)} ${fx(bx)},${fx(level)} T${fx(bx + bw + 10)},${fx(level - wav)} L${fx(bx + bw + 10)},${fx(by + bh + 20)} L${fx(bx - bw - 10)},${fx(by + bh + 20)} Z`;
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bglow`}>
          <stop offset="0%" stopColor={urine} stopOpacity={0.6} />
          <stop offset="45%" stopColor={urine} stopOpacity={0.2} />
          <stop offset="100%" stopColor={urine} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-uri`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={urLight} />
          <stop offset="1" stopColor={mixHex(urine, C.ink, 0.22)} />
        </linearGradient>
        <clipPath id={`${id}-bclip`}>
          <path d={shape} />
        </clipPath>
      </defs>
      {tube(URETER_L, 'uL')}
      {tube(URETER_R, 'uR')}
      {glow > 0.01 && <ellipse cx={bx} cy={by + 10} rx={300} ry={240} fill={`url(#${id}-bglow)`} opacity={glow} />}
      <path d={shape} fill={rgba(C.navyDeep, 0.45)} transform="translate(8,12)" />
      <path d={shape} fill={rgba(C.bodyGhost, 0.1)} />
      {fill > 0.01 && (
        <g clipPath={`url(#${id}-bclip)`}>
          <path d={surf} fill={`url(#${id}-uri)`} opacity={0.92} />
          <path d={`M${fx(bx - bw)},${fx(level + wav)} Q${fx(bx - bw / 2)},${fx(level - 6 - wav)} ${fx(bx)},${fx(level)} T${fx(bx + bw)},${fx(level - wav)}`} fill="none" stroke={rgba('#ffffff', 0.6)} strokeWidth={2.5} />
          <ellipse cx={bx + bw * 0.15} cy={by + bh * 0.45} rx={bw * 0.55} ry={bh * 0.35} fill={rgba(urLight, 0.25 * glow)} />
        </g>
      )}
      <path d={shape} fill="none" stroke={rgba(C.bodyGhostLight, 0.75)} strokeWidth={3.5} />
      <path d={shape} fill="none" stroke={rgba(C.ink, 0.55)} strokeWidth={1.5} transform="translate(1.5,2)" />
      <path
        d={`M${fx(bx - bw * 0.78)},${fx(by - bh * 0.35)} Q${fx(bx - bw * 0.62)},${fx(by - bh * 0.78)} ${fx(bx - bw * 0.2)},${fx(by - bh * 0.84)}`}
        fill="none"
        stroke={rgba('#ffffff', 0.55)}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </g>
  );
};
