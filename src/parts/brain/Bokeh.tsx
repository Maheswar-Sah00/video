import React, {useMemo} from 'react';
import {C} from '../../lib/palette';
import {rng, wander} from '../../lib/anim';

/** Big soft out-of-focus foreground glints (screen space, fastest parallax layer). */
export const Bokeh: React.FC<{f: number; id: string; seed?: number; dy?: number; dx?: number; tint?: string; amount?: number}> = ({
  f,
  id,
  seed = 1,
  dy = 0,
  dx = 0,
  tint = C.bodyGhostLight,
  amount = 1,
}) => {
  const items = useMemo(() => {
    const r = rng(seed * 31 + 7);
    return Array.from({length: 9}, (_, i) => ({
      x: i % 2 === 0 ? r() * 260 - 60 : 820 + r() * 300,
      y: r() * 2300,
      s: 50 + r() * 110,
      v: 1.2 + r() * 2.2,
      w: i % 3 === 0,
    }));
  }, [seed]);
  return (
    <g opacity={amount}>
      <defs>
        <radialGradient id={`${id}-bk`}>
          <stop offset="0%" stopColor={tint} stopOpacity={0.16} />
          <stop offset="70%" stopColor={tint} stopOpacity={0.1} />
          <stop offset="92%" stopColor={tint} stopOpacity={0.16} />
          <stop offset="100%" stopColor={tint} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-bw`}>
          <stop offset="0%" stopColor={C.waterGlow} stopOpacity={0.18} />
          <stop offset="80%" stopColor={C.water} stopOpacity={0.08} />
          <stop offset="100%" stopColor={C.water} stopOpacity={0} />
        </radialGradient>
      </defs>
      {items.map((b, i) => {
        const y = ((((b.y - f * b.v + dy * (1 + b.s / 160)) % 2300) + 2300) % 2300) - 190;
        const x = b.x + wander(f * 0.01 + i, seed + i) * 30 + dx * (1 + b.s / 160);
        return <circle key={i} cx={x} cy={y} r={b.s} fill={`url(#${id}-${b.w ? 'bw' : 'bk'})`} />;
      })}
    </g>
  );
};
