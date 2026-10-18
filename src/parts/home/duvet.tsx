import React from 'react';
import {C} from '../../lib/palette';
import {clamp, mixHex, smoothPath, wander} from '../../lib/anim';
import {brCols} from './bedroom';
import {INK, ink, n1} from './kit';

/**
 * S16: the DUVET over him (owner: home) — soft fabric draped over his body, seen from above at the
 * bedside: his body runs to screen-right under it (shoulder / chest / hip mounds along a ridge, the
 * arm a long bump on the near side), a soft turned-down top edge across his chest just below the
 * collar that curls back toward the near-left corner of the bed, curved cel folds, the drape over
 * the bed's near edge at the bottom, and a soft warm light pool from the window that fades with p.
 *   rise = chest rise (px) from his breathing / heartbeats.
 */

type P = [number, number];
const sp = (pts: P[], closed = false) => smoothPath(pts, closed);

export const BRDuvet2: React.FC<{f: number; id: string; p: number; rise: number}> = ({f, id, p, rise}) => {
  const c = brCols(p);
  const r = rise;
  const ch = (x: number, y: number, k = 1): P => [x - r * 0.25 * k, y - r * 0.55 * k]; // chest lifts
  // turned-down top edge: pulled up to his chin, across his chest from the far side to the near shoulder
  const hem: P[] = [[800, 850], ch(735, 960, 0.6), ch(668, 1090), ch(628, 1230), ch(604, 1370, 0.7), [575, 1500]];
  // the duvet's plain side edge continuing down to the bed's near edge
  const side: P[] = [[575, 1500], [470, 1590], [310, 1670], [130, 1740], [-60, 1790]];
  // inner edge of the turned-down band (fabric thickness varies, a soft roll)
  const band: P[] = hem.map(([x, y], i) => {
    const w = 74 + 12 * Math.sin(i * 1.9 + 0.5) + wander(f * 0.01 + i, 71) * 2 - (i === hem.length - 1 ? 40 : 0);
    return [x + w * 0.97, y + w * 0.22];
  });
  const outer: P[] = [[-200, 1800], [-200, 2100], [1700, 2100], [1700, 860]];
  const duvetD = sp([...hem, ...side.slice(1)]) + ' ' + outer.map(([x, y]) => `L${x},${y}`).join(' ') + ' Z';
  const bandSmooth = `${sp(hem)} L${n1(band[band.length - 1][0])},${n1(band[band.length - 1][1])} ${sp([...band].reverse()).replace(/^M/, 'L')} Z`;

  // body ridge (centre line of his body under the duvet) with shoulder/chest + hip mounds
  const ridgeY = (x: number) => 1215 - r * 0.6 * clamp(1 - Math.abs(x - 830) / 260) + (x - 700) * 0.06 - 26 * Math.exp(-(((x - 1060) / 110) ** 2));
  const ridge: P[] = [];
  for (let x = 700; x <= 1720; x += 40) ridge.push([x, ridgeY(x)]);
  // near edge of the body (where the near slope meets the flat mattress)
  const nearY = (x: number) => 1545 - r * 0.3 * clamp(1 - Math.abs(x - 800) / 300) + (x - 700) * 0.05 - 20 * Math.exp(-(((x - 1060) / 120) ** 2));
  const near: P[] = [];
  for (let x = 560; x <= 1720; x += 40) near.push([x, nearY(x)]);
  // far edge of the body
  const farY = (x: number) => 905 - r * 0.2 + (x - 800) * 0.06;

  // shadow on the near slope (hard cel edge at the ridge, softer toward the near edge)
  const shadeD = `${sp(ridge)} L1720,${n1(nearY(1720) - 30)} ${sp([...near].reverse().map(([x, y]) => [x, y - 30] as P)).replace(/^M/, 'L')} Z`;
  // lit far slope
  const litD = `${sp(ridge)} L1720,${n1(farY(1720) + 20)} L700,${n1(farY(700) + 20)} Z`;

  // curved folds: from the mounds down the near side into the drape, and up the far side
  const folds: React.ReactNode[] = [];
  const foldSet = [
    {x: 780, w: 16, k: 1}, {x: 900, w: 20, k: 1.2}, {x: 1010, w: 14, k: 0.9}, {x: 1140, w: 22, k: 1.1}, {x: 1260, w: 15, k: 1},
  ];
  foldSet.forEach((fd, i) => {
    const sw = wander(f * 0.008 + i * 3, 80 + i) * 6;
    const x0 = fd.x, y0 = nearY(x0) - 10;
    const d = `M${n1(x0 + 10)},${n1(ridgeY(x0) + 60)} C${n1(x0 - 20 + sw)},${n1(y0 - 80)} ${n1(x0 - 40 + sw)},${n1(y0 + 40)} ${n1(x0 - 90 * fd.k + sw)},${n1(1745)}`;
    folds.push(<path key={`n${i}`} d={d} fill="none" stroke={c.duvetShade} strokeWidth={fd.w} strokeLinecap="round" opacity={0.75} />);
    folds.push(<path key={`h${i}`} d={d} fill="none" stroke={c.duvetLit} strokeWidth={5} strokeLinecap="round" opacity={0.25} transform="translate(13,-4)" />);
  });
  [820, 980, 1180].forEach((x0, i) => {
    const d = `M${n1(x0)},${n1(ridgeY(x0) - 50)} C${n1(x0 + 30)},${n1(ridgeY(x0) - 160)} ${n1(x0 + 60)},${n1(farY(x0) + 60)} ${n1(x0 + 110)},${n1(farY(x0) - 10)}`;
    folds.push(<path key={`f${i}`} d={d} fill="none" stroke={c.duvetShade} strokeWidth={12} strokeLinecap="round" opacity={0.45} />);
  });
  // flat part folds near the turned-down corner (fabric bunching)
  [[420, 1700], [600, 1640], [250, 1770]].forEach(([x0, y0], i) => {
    folds.push(<path key={`b${i}`} d={`M${x0},${y0} q${30 + i * 10},${40} ${10 + i * 6},${120}`} fill="none" stroke={c.duvetShade} strokeWidth={14} strokeLinecap="round" opacity={0.6} />);
  });

  // the arm under the duvet: a long soft bump along the near side
  const armD = `M${n1(630)},${n1(1470)} C${n1(720)},${n1(1490 - r * 0.2)} ${n1(820)},${n1(1505)} ${n1(940)},${n1(1520)}`;
  // the drape over the bed's near edge
  const drapes: React.ReactNode[] = [];
  [470, 650, 880, 1010, 1240].forEach((x0, i) => {
    const sw = Math.sin(f * 0.015 + i) * 3;
    const w = [30, 18, 34, 14, 24][i];
    drapes.push(<path key={i} d={`M${n1(x0)},1785 C${n1(x0 - 20 + sw)},1840 ${n1(x0 + 24 + sw)},1900 ${n1(x0 - 10 + sw)},2000`} fill="none" stroke={c.duvetShade} strokeWidth={w} strokeLinecap="round" opacity={0.75} />);
    drapes.push(<path key={`l${i}`} d={`M${n1(x0 + w * 0.7)},1790 C${n1(x0 - 8 + sw + w * 0.7)},1845 ${n1(x0 + 30 + sw + w * 0.7)},1905 ${n1(x0 + sw + w * 0.7)},2000`} fill="none" stroke={c.duvetLit} strokeWidth={4} strokeLinecap="round" opacity={0.5} />);
  });
  const k = Math.pow(clamp(1 - p), 1.2);
  const poolX = 980 + p * 140, poolY = 1080 - p * 60;
  return (
    <g>
      <defs>
        <clipPath id={`${id}-dv`}>
          <path d={duvetD} />
        </clipPath>
        <radialGradient id={`${id}-pool`}>
          <stop offset={0} stopColor={C.duskLow} stopOpacity={0.85} />
          <stop offset={0.55} stopColor={C.duskLow} stopOpacity={0.3} />
          <stop offset={1} stopColor={C.duskLow} stopOpacity={0} />
        </radialGradient>
      </defs>
      <path d={duvetD} fill={c.duvet} />
      <g clipPath={`url(#${id}-dv)`}>
        <path d={litD} fill={c.duvetLit} opacity={1} />
        {/* soft shadow just beyond the far edge of his body */}
        <path d={`M680,${n1(farY(680) + 30)} C900,${n1(farY(900) + 10)} 1300,${n1(farY(1300) + 10)} 1720,${n1(farY(1720) + 20)}`} fill="none" stroke={c.duvetShade} strokeWidth={30} strokeLinecap="round" opacity={0.45} />
        <path d={shadeD} fill={c.duvetShade} opacity={0.85} />
        {/* a cooler, deeper occlusion right under the body's near edge */}
        <path d={sp(near.map(([x, y]) => [x, y + 6] as P))} fill="none" stroke={mixHex(c.duvetShade, C.ink, 0.25)} strokeWidth={22} strokeLinecap="round" opacity={0.55} />
        {folds}
        <path d={armD} fill="none" stroke={c.duvetShade} strokeWidth={28} strokeLinecap="round" opacity={0.55} transform="translate(0,22)" />
        <path d={armD} fill="none" stroke={c.duvetLit} strokeWidth={10} strokeLinecap="round" opacity={0.7} />
        {/* the ridge catching the light */}
        <path d={sp(ridge.map(([x, y]) => [x, y - 6] as P))} fill="none" stroke={mixHex(c.duvetLit, C.duskSun, 0.45 * (1 - p))} strokeWidth={7} strokeLinecap="round" opacity={0.85} />
        {/* the bed's near edge + drape */}
        <path d="M-200,1752 C300,1735 900,1745 1720,1725" fill="none" stroke={c.duvetShade} strokeWidth={40} opacity={0.75} />
        <path d="M-200,1772 C300,1755 900,1765 1720,1745" fill="none" stroke={ink(0.55)} strokeWidth={3.5} />
        <rect x={-200} y={1775} width={1920} height={400} fill={c.duvetShade} opacity={0.35} />
        {drapes}
        {/* warm window light pool on the fabric (soft, follows the mounds, fades as the sun sinks) */}
        {k > 0.01 && (
          <g style={{mixBlendMode: 'screen'}} opacity={0.55 * k}>
            <ellipse cx={n1(poolX)} cy={n1(poolY)} rx={340} ry={170} fill={`url(#${id}-pool)`} transform={`rotate(-8 ${n1(poolX)} ${n1(poolY)})`} />
            <ellipse cx={n1(poolX - 210)} cy={n1(poolY + 60)} rx={200} ry={110} fill={`url(#${id}-pool)`} opacity={0.7} />
            <ellipse cx={n1(poolX + 160)} cy={n1(poolY + 220)} rx={230} ry={90} fill={`url(#${id}-pool)`} opacity={0.4} />
          </g>
        )}
      </g>
      <path d={duvetD} fill="none" stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
      <path d={sp(side.map(([x, y]) => [x + 16, y + 4] as P))} fill="none" stroke={c.duvetLit} strokeWidth={8} strokeLinecap="round" opacity={0.7} />
      {/* shadow cast by the turned-down edge onto the duvet */}
      <path d={sp(band.map(([x, y]) => [x + 10, y + 12] as P))} fill="none" stroke={c.duvetShade} strokeWidth={18} strokeLinecap="round" opacity={0.7} />
      {/* the turned-down top edge: soft fabric roll in the sheet colour */}
      <path d={bandSmooth} fill={c.sheet} />
      <path d={sp(band)} fill="none" stroke={c.sheetShade} strokeWidth={16} strokeLinecap="round" opacity={0.85} />
      <path d={sp(hem.map(([x, y]) => [x + 5, y + 3] as P))} fill="none" stroke={mixHex(c.sheet, C.duskSun, 0.35 * (1 - p))} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
      {[1, 3, 4].map((i) => (
        <path key={i} d={`M${n1(hem[i][0] + 4)},${n1(hem[i][1] + 2)} Q${n1((hem[i][0] + band[i][0]) / 2 + 10)},${n1((hem[i][1] + band[i][1]) / 2 - 6)} ${n1(band[i][0] - 2)},${n1(band[i][1] - 2)}`} fill="none" stroke={c.sheetShade} strokeWidth={4} strokeLinecap="round" />
      ))}
      <path d={bandSmooth} fill="none" stroke={ink()} strokeWidth={INK} strokeLinejoin="round" />
    </g>
  );
};
