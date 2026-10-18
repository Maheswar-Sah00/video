import React from 'react';
import {MONO} from './fonts';
import {C} from './palette';
import {clamp, ease, ramp, rgba} from './anim';

/**
 * Scientific label for use INSIDE an <svg viewBox="0 0 1080 1920">.
 * A dot pops at the anchor, the leader line draws itself to the text, the text types on,
 * then everything fades at `to`. 1–4 words, uppercase.
 *
 *   <Label f={frame} from={30} to={110} ax={520} ay={900} x={760} y={760} text="VENOM" />
 *
 * (ax,ay) = the structure being pointed at. (x,y) = where the text sits (left edge of the text
 * when align='left', right edge when align='right'). Omit ax/ay for a free-standing tag.
 */
export const Label: React.FC<{
  f: number;
  from: number;
  to: number;
  text: string;
  x: number;
  y: number;
  ax?: number;
  ay?: number;
  align?: 'left' | 'right' | 'center';
  size?: number;
  color?: string; // text + line colour
  accent?: string; // dot colour
  plate?: boolean; // dark backing plate for legibility on busy art
  sub?: string; // optional small second line
  speed?: number; // type-on frames per character (default 1.3; 0 = instant)
}> = ({f, from, to, text, x, y, ax, ay, align = 'left', size = 34, color = C.label, accent, plate = true, sub, speed = 1.3}) => {
  if (f < from - 1 || f > to + 1) return null;
  const local = f - from;
  const out = 1 - ramp(f, to - 8, to, ease.inQuad);
  const hasLeader = ax !== undefined && ay !== undefined;
  const dot = ramp(local, 0, 6, ease.outBack);
  const line = hasLeader ? ramp(local, 3, 13, ease.outCubic) : 1;
  const lead = hasLeader ? Math.min(9, 4 + speed * 4) : 0;
  const typeT = speed <= 0 ? (local >= lead ? 1 : 0) : ramp(local, lead, lead + Math.max(3, text.length * speed));
  const shown = text.slice(0, Math.ceil(typeT * text.length));
  const subT = sub ? ramp(local, 16, 16 + sub.length * 0.9) : 0;
  const charW = size * 0.6 + size * 0.08; // IBM Plex Mono advance + letter spacing
  const tw = text.length * charW;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  // the plate grows from the text's anchor side, matching the type-on
  const subW = sub ? sub.length * (size * 0.55 * 0.6 + size * 0.05) : 0;
  const plateW = Math.max(tw * clamp(typeT * 1.05), subW * clamp(subT * 1.05));
  const left = align === 'left' ? x : align === 'right' ? x - plateW : x - plateW / 2;
  // leader ends at the text's near edge, vertically centred on the text
  const lx = align === 'left' ? x - 14 : align === 'right' ? x + 14 : x;
  const ly = align === 'center' ? y + size * 0.55 : y - size * 0.33;
  const len = hasLeader ? Math.hypot(lx - ax!, ly - ay!) : 0;
  return (
    <g opacity={out}>
      {hasLeader && (
        <>
          <line
            x1={ax}
            y1={ay}
            x2={lx}
            y2={ly}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${len * line} ${len}`}
            opacity={0.9}
          />
          <circle cx={ax} cy={ay} r={9 * dot} fill="none" stroke={accent ?? color} strokeWidth={2.5} />
          <circle cx={ax} cy={ay} r={3.6 * dot} fill={accent ?? color} />
        </>
      )}
      {plate && typeT > 0 && (
        <rect
          x={left - 14}
          y={y - size * 0.92}
          width={plateW + 26}
          height={size * 1.3 + (sub ? size * 0.8 : 0)}
          rx={6}
          fill={rgba(C.navyDeep, 0.62)}
          stroke={rgba(color, 0.35)}
          strokeWidth={1.5}
        />
      )}
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        fontFamily={MONO}
        fontWeight={600}
        fontSize={size}
        letterSpacing={size * 0.08}
        fill={color}
      >
        {shown}
      </text>
      {sub && subT > 0 && (
        <text
          x={x}
          y={y + size * 0.85}
          textAnchor={anchor}
          fontFamily={MONO}
          fontWeight={500}
          fontSize={size * 0.55}
          letterSpacing={size * 0.05}
          fill={rgba(color, 0.8)}
        >
          {sub.slice(0, Math.ceil(subT * sub.length))}
        </text>
      )}
    </g>
  );
};

/** Animated arrow that draws itself along a path (SVG). Arrowhead appears at the end. */
export const DrawArrow: React.FC<{
  f: number;
  from: number;
  dur?: number;
  to?: number;
  d: string; // path
  length: number; // approximate path length (px)
  end: [number, number, number]; // arrowhead x, y, angle(rad)
  color?: string;
  width?: number;
}> = ({f, from, dur = 14, to = 1e9, d, length, end, color = C.label, width = 4}) => {
  if (f < from) return null;
  const t = ramp(f, from, from + dur, ease.outCubic);
  const out = 1 - ramp(f, to - 8, to);
  const [ex, ey, ang] = end;
  const head = ramp(f, from + dur * 0.8, from + dur + 3, ease.outBack);
  return (
    <g opacity={out}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${length * t} ${length}`} />
      <g transform={`translate(${ex},${ey}) rotate(${(ang * 180) / Math.PI}) scale(${head})`}>
        <path d="M0,0 L-18,-10 L-14,0 L-18,10 Z" fill={color} />
      </g>
    </g>
  );
};
