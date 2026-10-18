import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {BodyCell, RBC, Salt, WaterMolecule} from '../lib/Cells';
import {clamp, ease, hash, lerp, mixHex, ramp, rgba, rng, smoothPath} from '../lib/anim';
import {camPt, camTf, wobble} from '../lib/MedKit';
import {DrawArrow, Label} from '../lib/Label';
import {P, atLen, fx, sampled} from '../parts/blood/util';

/**
 * S09 Shrivel (blood) — DAY 2. Tissue of packed plump body cells in depth (dim far layer, sharp
 * mid layer, huge soft foreground cells off the edges) with a capillary of red cells + salt running
 * the full height. "pulls water out of your cells" 1005–1050: water molecules stream OUT of the
 * cells into the salty blood (osmosis arrows); "and they shrivel" 1068–1096: the cells shrink and
 * wrinkle (water 1 → 0.25, staggered), gaps open. Ends on the zoomOut with shrivelled cells centred.
 */

const CAP: P[] = [[330, -160], [352, 240], [300, 620], [348, 1000], [306, 1380], [342, 1760], [320, 2100]];
const CAP_W = 120;
const HERO: P = [552, 968];

export const S09Shrivel: React.FC<SceneProps> = ({start, len}) => {
  const f = useCurrentFrame();
  const abs = start + f;

  const g = useMemo(() => {
    const sp = sampled(CAP, 16);
    const capX = (y: number) => {
      let best = sp.s[0];
      for (const q of sp.s) if (Math.abs(q[1] - y) < Math.abs(best[1] - y)) best = q;
      return best[0];
    };
    const r = rng(909);
    // mid layer: hex-packed plump cells, one exactly at HERO
    const mid: {x: number; y: number; r: number; seed: number; sq: number; rot: number; dCap: number; d2: number}[] = [];
    for (let row = -6; row <= 6; row++)
      for (let col = -4; col <= 3; col++) {
        const x = HERO[0] + col * 214 + (Math.abs(row) % 2) * 107 + (row === 0 && col === 0 ? 0 : (r() - 0.5) * 30);
        const y = HERO[1] + row * 184 + (row === 0 && col === 0 ? 0 : (r() - 0.5) * 26);
        const rr = 96 + r() * 14;
        const dCap = Math.abs(x - capX(y));
        if (dCap < CAP_W / 2 + rr * 0.92) continue;
        if (x < -130 || x > 1210 || y < -150 || y > 2070) continue;
        mid.push({x, y, r: rr, seed: Math.floor(r() * 997), sq: 0.9 + r() * 0.2, rot: r() * 360, dCap, d2: r()});
      }
    const far: {x: number; y: number; r: number; seed: number}[] = [];
    for (let row = 0; row < 18; row++)
      for (let col = 0; col < 9; col++) {
        const x = -40 + col * 140 + (row % 2) * 70 + (r() - 0.5) * 30;
        const y = -80 + row * 120 + (r() - 0.5) * 30;
        if (Math.abs(x - capX(y)) < 90) continue;
        far.push({x, y, r: 44 + r() * 12, seed: Math.floor(r() * 997)});
      }
    const near = [
      {x: 40, y: 150, r: 270, seed: 11},
      {x: 1100, y: 620, r: 250, seed: 23},
      {x: -30, y: 1560, r: 280, seed: 37},
      {x: 1010, y: 1880, r: 300, seed: 41},
      {x: 1060, y: -90, r: 230, seed: 53},
    ];
    // water molecules leaving cells near the capillary
    const src = mid.filter((c) => c.dCap < 520);
    const water = Array.from({length: 62}, (_, i) => {
      const c = src[Math.floor(r() * src.length)];
      const a = r() * Math.PI * 2;
      const sx = c.x + Math.cos(a) * c.r * 0.35;
      const sy = c.y + Math.sin(a) * c.r * 0.35;
      // nearest point on the capillary
      let bi = 0;
      let bd = 1e9;
      sp.s.forEach((q, k) => {
        const d = Math.hypot(q[0] - sx, q[1] - sy);
        if (d < bd) {
          bd = d;
          bi = k;
        }
      });
      return {sx, sy, dArr: sp.L[bi] + (r() - 0.5) * 30, t0: 1001 + r() * 44 + (c.dCap / 520) * 6, dur: 22 + r() * 10, bend: (r() - 0.5) * 120, r: r() > 0.6 ? 26 : 19, i};
    });
    return {sp, capX, mid, far, near, water, dCap: smoothPath(CAP)};
  }, []);

  // ---- camera: push in toward the hero cell (centred at the end for the zoomOut), parallax
  const push = ease.inOutSine(ramp(f, 0, len));
  const s = 1.0 + 0.13 * push;
  const focus: [number, number] = [lerp(500, HERO[0], push), lerp(1010, HERO[1], push)];
  const roll = lerp(-1.6, 0.4, push) + 0.4 * Math.sin(f * 0.03);
  const cam = camTf(focus, [540, 960], s, roll);
  const camFar = camTf([lerp(520, HERO[0], push * 0.6), lerp(990, HERO[1], push * 0.6)], [540, 960], 1 + (s - 1) * 0.5, roll * 0.6);
  const camNear = camTf([lerp(470, HERO[0] - 30, push * 1.4), lerp(1040, HERO[1] + 30, push * 1.4)], [540, 960], 1 + (s - 1) * 1.6, roll * 1.3);

  // ---- osmosis + shrivel
  const pull = ramp(abs, 1004, 1050);
  const waterOf = (dCap: number, d2: number) => {
    const s1 = ease.inOutSine(ramp(abs, 1008 + (dCap / 600) * 14, 1050 + (dCap / 600) * 8));
    const s2 = ease.inOutCubic(ramp(abs, 1066 + d2 * 9, 1088 + d2 * 9));
    return 1 - 0.16 * s1 - 0.59 * s2;
  };
  const crumple = (d2: number) => wobble(abs - (1074 + d2 * 9), 0.55, 7);

  const flowSpeed = 5.2;
  const rbcs: React.ReactNode[] = [];
  for (let i = 0; i < 20; i++) {
    const d = (((i * 118 + abs * flowSpeed + hash(i, 4) * 30) % g.sp.len) + g.sp.len) % g.sp.len;
    const [x, y, ang] = atLen(g.sp, d);
    const off = (hash(i, 9) - 0.5) * 22;
    rbcs.push(
      <RBC
        key={i}
        x={x - Math.sin(ang) * off}
        y={y + Math.cos(ang) * off}
        r={44}
        rot={(ang * 180) / Math.PI + 90 + 14 * Math.sin(abs * 0.05 + i)}
        tilt={0.45 + 0.2 * Math.sin(abs * 0.04 + i * 1.3)}
        sat={0.95}
        crenate={0.25 * ramp(abs, 1060, 1090)}
      />,
    );
  }
  const salts: React.ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    const d = (((i * 91 + 40 + abs * flowSpeed * 0.92) % g.sp.len) + g.sp.len) % g.sp.len;
    const [x, y, ang] = atLen(g.sp, d);
    const off = (hash(i, 17) - 0.5) * 74;
    salts.push(<Salt key={i} x={x - Math.sin(ang) * off} y={y + Math.cos(ang) * off} r={10 + 3 * hash(i, 3)} rot={abs * (i % 2 ? 2 : -1.6) + i * 20} opacity={0.95} />);
  }

  // water molecules: emerge from a cell, travel to the capillary, then get carried away
  const mols: React.ReactNode[] = [];
  const trails: string[] = [];
  for (const w of g.water) {
    const t = abs - w.t0;
    if (t < 0) continue;
    const u = ease.inOutSine(clamp(t / w.dur));
    const [ex, ey] = atLen(g.sp, w.dArr);
    const posAt = (uu: number) => {
      const mx = (w.sx + ex) / 2 + w.bend * 0.3;
      const my = (w.sy + ey) / 2 + w.bend;
      const a = (1 - uu) * (1 - uu);
      const b = 2 * (1 - uu) * uu;
      const c = uu * uu;
      return [a * w.sx + b * mx + c * ex, a * w.sy + b * my + c * ey] as P;
    };
    let x: number;
    let y: number;
    let op = ramp(t, 0, 5);
    if (t <= w.dur) {
      [x, y] = posAt(u);
      const [px, py] = posAt(ease.inOutSine(clamp((t - 5) / w.dur)));
      trails.push(`M${fx(px)},${fx(py)} L${fx(x)},${fx(y)}`);
    } else {
      const dd = w.dArr + (t - w.dur) * flowSpeed;
      [x, y] = atLen(g.sp, dd);
      op *= 1 - ramp(t - w.dur, 18, 34);
    }
    if (op <= 0.01) continue;
    mols.push(<WaterMolecule key={w.i} x={x} y={y} r={w.r} rot={abs * 3 + w.i * 40} opacity={op} glow={0.9} />);
  }

  // osmosis arrows (world coords, cells → capillary)
  const arrows = [
    {y: 560, side: 1, x0: 640},
    {y: 900, side: 1, x0: 660},
    {y: 1240, side: 1, x0: 640},
    {y: 1080, side: -1, x0: 90},
    {y: 400, side: -1, x0: 110},
  ].map((a, i) => {
    const cx = g.capX(a.y + 20) + a.side * (CAP_W / 2 + 22);
    const d = `M${a.x0},${a.y} Q${(a.x0 + cx) / 2},${a.y - 46} ${cx},${a.y + 20}`;
    const ang = Math.atan2(a.y + 20 - (a.y - 46), cx - (a.x0 + cx) / 2);
    return <DrawArrow key={i} f={abs} from={1012 + i * 4} dur={16} to={1060 + i * 2} d={d} length={Math.abs(cx - a.x0) * 1.15} end={[cx, a.y + 20, ang]} color={C.waterLight} width={7} />;
  });

  const capScreen = camPt({x: g.capX(820), y: 820}, focus, [540, 960], s, roll);
  const heroScreen = camPt({x: HERO[0], y: HERO[1]}, focus, [540, 960], s, roll);
  const saltGlow = Math.sin(pull * Math.PI);

  return (
    <AbsoluteFill style={{background: C.navyDeep}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <defs>
          <radialGradient id="s09-bg" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor={mixHex(C.tissueDark, C.waterDark, 0.35)} />
            <stop offset="100%" stopColor={mixHex(C.navyDeep, C.tissueDark, 0.3)} />
          </radialGradient>
          <filter id="s09-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={9} />
          </filter>
          <filter id="s09-far" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={2} />
          </filter>
        </defs>
        <rect width={1080} height={1920} fill="url(#s09-bg)" />
        {/* far layer: small dim cells, slower */}
        <g transform={camFar} opacity={0.5}>
          {g.far.map((c, i) => (
            <BodyCell key={i} x={c.x} y={c.y} r={c.r} seed={c.seed} f={abs} water={waterOf(300, hash(i, 2))} detail={0} rot={c.seed} />
          ))}
          <rect x={-200} y={-200} width={1480} height={2320} fill={rgba(C.navyDeep, 0.35)} />
        </g>
        {/* interstitial fluid glow (water between the cells) */}
        <rect width={1080} height={1920} fill={rgba(C.water, 0.05 + 0.03 * Math.sin(f * 0.05))} />
        <g transform={cam}>
          {/* capillary: wall, salty plasma, red cells, salt */}
          <path d={g.dCap} fill="none" stroke={rgba(C.blood, 0.12)} strokeWidth={CAP_W + 90} strokeLinecap="round" />
          <path d={g.dCap} fill="none" stroke={rgba(C.ink, 0.85)} strokeWidth={CAP_W + 30} strokeLinecap="round" />
          <path d={g.dCap} fill="none" stroke={C.tissueLight} strokeWidth={CAP_W + 24} strokeLinecap="round" />
          <path d={g.dCap} fill="none" stroke={mixHex(C.bloodDeep, C.tissueDark, 0.4)} strokeWidth={CAP_W} strokeLinecap="round" />
          <path d={g.dCap} fill="none" stroke={rgba(C.bloodLight, 0.18)} strokeWidth={CAP_W * 0.5} strokeLinecap="round" transform="translate(-12,-4)" />
          {rbcs}
          <g>
            {saltGlow > 0.01 && <path d={g.dCap} fill="none" stroke={rgba(C.salt, 0.12 * saltGlow)} strokeWidth={CAP_W} strokeLinecap="round" />}
            {salts}
          </g>
          {/* endothelial nuclei on the capillary wall */}
          {Array.from({length: 18}, (_, i) => {
            const [x, y, ang] = atLen(g.sp, 60 + i * 128);
            const side = i % 2 ? 1 : -1;
            const o = side * (CAP_W / 2 + 6);
            return <ellipse key={i} cx={x - Math.sin(ang) * o} cy={y + Math.cos(ang) * o} rx={22} ry={7} fill={C.cellNucleus} opacity={0.8} transform={`rotate(${fx((ang * 180) / Math.PI)} ${fx(x - Math.sin(ang) * o)} ${fx(y + Math.cos(ang) * o)})`} />;
          })}
          {/* mid layer: plump body cells */}
          {g.mid.map((c, i) => {
            const w = waterOf(c.dCap, c.d2);
            return (
              <BodyCell
                key={i}
                x={c.x}
                y={c.y + 4 * Math.sin(abs * 0.04 + i)}
                r={c.r}
                seed={c.seed}
                f={abs}
                water={w}
                squash={c.sq}
                rot={c.rot + 8 * crumple(c.d2)}
              />
            );
          })}
          {/* water leaving the cells */}
          <path d={trails.join(' ')} stroke={rgba(C.waterLight, 0.55)} strokeWidth={7} strokeLinecap="round" fill="none" />
          {mols}
          {arrows}
        </g>
        {/* huge soft foreground cells */}
        <g transform={camNear}>
          {g.near.map((c, i) => (
            <g key={i} filter="url(#s09-soft)" opacity={0.78}>
              <BodyCell x={c.x} y={c.y} r={c.r} seed={c.seed} f={abs} water={waterOf(500, 0.4 + 0.1 * i)} detail={0} rot={c.seed * 3} />
            </g>
          ))}
        </g>
        <Label f={abs} from={1014} to={1064} text="OSMOSIS" sub="salty blood pulls water" x={560} y={720} size={38} speed={0.8} ax={capScreen.x + 50} ay={capScreen.y} accent={C.water} />
        <Label f={abs} from={1064} to={1103} text="CELLS SHRIVEL" sub="water pulled out" x={470} y={1250} size={38} speed={0.55} ax={heroScreen.x + 30} ay={heroScreen.y + 50} accent={C.cell} />
      </svg>
    </AbsoluteFill>
  );
};
