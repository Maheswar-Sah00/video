import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {TITLE, MONO} from '../lib/fonts';
import {BodyCell, RBC, WaterMolecule} from '../lib/Cells';
import {clamp, ease, hash, lerp, mixHex, noise1, ramp, rgba, rng, smoothPath} from '../lib/anim';
import {EV, beatPulse, lastEvent} from '../lib/sync';
import {Ecg, camTf} from '../lib/MedKit';
import {Label} from '../lib/Label';
import {Heart} from '../parts/blood/Heart';
import {Lens} from '../parts/blood/Lens';
import {P, Tube, fx, heartPhase} from '../parts/blood/util';

/**
 * S08 ThickBlood (blood) — inside a big blood vessel running diagonally the full height (front wall
 * cut away: back wall lined with endothelial cells, the cut wall's layers on both sides, connective
 * tissue + little vasa vasorum outside). RBCs stream in 3 depth layers through aqua-tinted plasma
 * with water molecules; "Your blood thickens" 885–915: the water leaves, the plasma darkens, red
 * cells crowd, jostle, slow, a few crenate. The flow surges and a pulse wave bulges the wall on
 * every heartbeat (EV.beats 874 … 979). From 917 a lens with the glossy heart beating faster,
 * a ticking BPM tag and an ECG strip. Ends under the clock wipe.
 */

const ANG = 22; // vessel axis: local +Y (downstream) points down-left on screen
const R0 = 372; // lumen half-width (local px)
const WALL = 112;
const LY = 2800; // wrap length for flowing things
const travelAt = (f: number) => f * 1.6 + 30 * ease.inOutSine(clamp(f / 113));

export const S08ThickBlood: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const thick = ease.inOutSine(ramp(abs, 884, 920));
  const ph = heartPhase(abs);

  // integrated flow distance (pure: summed from the scene start)
  let D = 0;
  for (let k = start - 30; k <= abs; k++) {
    const t = ease.inOutSine(ramp(k, 884, 920));
    D += lerp(10.5, 4.2, t) * (1 + 1.5 * heartPhase(k).p);
  }
  const travel = travelAt(f);

  // pulse wave travelling down the vessel on each beat (wall bulge)
  const waves = EV.beats.filter((b) => abs - b >= 0 && abs - b < 40).map((b) => -1500 + (abs - b) * 95 - travel * 0);
  const bulge = (y: number) => {
    let v = 0;
    for (const w of waves) v += Math.exp(-Math.pow((y - w) / 260, 2));
    return 11 * Math.min(1, v);
  };

  const pools = useMemo(() => {
    const r = rng(808);
    const mk = (n: number, rMin: number, rMax: number, layer: number) =>
      Array.from({length: n}, (_, i) => ({
        x: (r() * 2 - 1) * (R0 - rMax * 0.6),
        y: r() * LY,
        r: rMin + r() * (rMax - rMin),
        h: r(),
        rot: r() * 360,
        spin: (r() - 0.5) * 2,
        ph: r() * 6.28,
        cren: r(),
        layer,
        i,
      }));
    const water = Array.from({length: 40}, (_, i) => ({
      x: (r() * 2 - 1) * (R0 - 40),
      y: r() * LY,
      r: i % 3 === 0 ? 25 : 16,
      t: 884 + r() * 30,
      stay: r() > 0.8,
      rot: r() * 360,
      i,
    }));
    const tissue: {x: number; y: number; r: number; s: number}[] = [];
    for (const side of [-1, 1])
      for (let k = 0; k < 15; k++) tissue.push({x: side * (R0 + WALL + 70 + r() * 330), y: -1400 + k * 200 + r() * 120, r: 46 + r() * 26, s: Math.floor(r() * 99)});
    // endothelial mosaic on the back wall (cylindrical projection)
    let cells = '';
    let nuc = '';
    const cols = 13;
    for (let c = 0; c < cols; c++) {
      const phi = lerp(-1.32, 1.32, (c + 0.5) / cols);
      const dphi = 2.64 / cols;
      const cx = R0 * 0.98 * Math.sin(phi);
      const rx = Math.max(4, ((R0 * dphi) / 2) * Math.cos(phi) * 0.92);
      for (let k = 0; k < 26; k++) {
        const cy = -1500 + k * 124 + (c % 2) * 62 + (r() - 0.5) * 20;
        const ry = 56 + r() * 10;
        cells += `M${fx(cx - rx)},${fx(cy)}a${fx(rx)},${fx(ry)} 0 1,0 ${fx(2 * rx)},0a${fx(rx)},${fx(ry)} 0 1,0 ${fx(-2 * rx)},0`;
        const nrx = rx * 0.32;
        nuc += `M${fx(cx - nrx)},${fx(cy)}a${fx(nrx)},${fx(15)} 0 1,0 ${fx(2 * nrx)},0a${fx(nrx)},${fx(15)} 0 1,0 ${fx(-2 * nrx)},0`;
      }
    }
    // vasa vasorum (tiny vessels on the outside of the wall)
    const vv: P[][] = [];
    for (const side of [-1, 1])
      for (let k = 0; k < 2; k++) {
        const pts: P[] = [];
        for (let y = -1500; y <= 1700; y += 160) pts.push([side * (R0 + WALL + 40 + k * 150 + 40 * Math.sin(y * 0.004 + k * 2)), y]);
        vv.push(pts);
      }
    return {rbc: [...mk(76, 22, 29, 0), ...mk(68, 40, 52, 1)], near: mk(7, 100, 132, 2), water, tissue, cells, nuc, vv};
  }, []);

  // ---- camera: the dive continues — slow push, drift, slight roll + a beat nudge
  const push = ease.inOutSine(ramp(f, 0, 113));
  const s = 1.02 + 0.1 * push + 0.008 * beatPulse(abs);
  const roll = 1.2 * Math.sin(f * 0.02) - 0.8 * push;
  const cam = camTf([540 + 14 * Math.sin(f * 0.017), 960 - 10 * push], [540, 960], s, roll);
  const vesselTf = `translate(540,960) rotate(${ANG})`;

  // wall edges (per frame: the pulse wave bulges them)
  const ys: number[] = [];
  for (let y = -1500; y <= 1700; y += 50) ys.push(y);
  const edge = (side: number, off: number, wob = 0) =>
    ys.map((y) => [side * (R0 + bulge(y + travel) + off + wob * Math.sin((y + travel) * 0.05)), y] as P);
  const band = (side: number, a: number, b: number) => {
    const A = edge(side, a);
    const B = edge(side, b).reverse();
    return smoothPath(A) + ' L' + B.map((p) => `${fx(p[0])},${fx(p[1])}`).join(' L') + ' Z';
  };

  const visDensity = lerp(0.36, 1, thick);
  const wrapY = (y: number) => ((((y % LY) + LY) % LY) - LY / 2);
  const prof = (x: number) => 1 - 0.55 * Math.pow(x / R0, 2);

  const drawRBC = (c: (typeof pools.rbc)[number]) => {
    const vis = clamp((visDensity - c.h) / 0.07);
    if (vis <= 0) return null;
    const spd = c.layer === 0 ? 0.72 : c.layer === 1 ? 1 : 1.45;
    const y = wrapY(c.y + D * spd * prof(c.x) - travel * (c.layer === 2 ? 0.4 : 0));
    if (y < -1250 || y > 1250) return null;
    const jx = thick * 16 * noise1(D * 0.012 + c.i * 3.1, c.layer * 7 + c.i);
    const x = c.x * (1 + bulge(y + travel) / R0) + jx;
    const rot = c.rot + D * 0.12 * c.spin + thick * 16 * noise1(D * 0.01 + c.i, 5);
    const tilt = 0.32 + 0.3 * Math.sin(c.ph + D * 0.006 * (1 + c.spin));
    const cren = c.cren < 0.26 ? thick * (0.55 + 0.45 * (c.cren / 0.26)) : 0;
    const sat = lerp(1, 0.86, thick) * (c.layer === 0 ? 0.78 : 1);
    return <RBC key={`${c.layer}-${c.i}`} x={x} y={y} r={c.r} rot={rot} tilt={tilt} sat={sat} crenate={cren} opacity={vis * (c.layer === 0 ? 0.62 : 1)} />;
  };

  // water molecules: drift with the plasma, then leave (rise toward us + fade) 884–914
  const waterEls = pools.water.map((w) => {
    const u = w.stay ? 0 : ease.inQuad(ramp(abs, w.t, w.t + 16));
    if (u >= 1) return null;
    const y = wrapY(w.y + D * 0.95 * prof(w.x) - travel * 0.1) - u * 40;
    if (y < -1250 || y > 1250) return null;
    const x = w.x + Math.sign(w.x || 1) * u * 70 + 8 * Math.sin(abs * 0.07 + w.i);
    const glow = 0.5 + 0.5 * (1 - u);
    return <WaterMolecule key={`w${w.i}`} x={x} y={y} r={w.r * (1 + 0.6 * u)} rot={w.rot + abs * (w.i % 2 ? 1.4 : -1.1)} opacity={(1 - u) * (w.r > 20 ? 1 : 0.7)} glow={glow} />;
  });

  // caustic shimmer on the back wall (water) — fades as the plasma thickens
  const caus: string[] = [];
  for (let k = 0; k < 6; k++) {
    const pts: P[] = [];
    const x0 = lerp(-R0 * 0.75, R0 * 0.75, k / 5);
    for (let y = -1300; y <= 1300; y += 130) pts.push([x0 + 30 * Math.sin(y * 0.006 + abs * 0.06 + k * 1.7), y]);
    caus.push(smoothPath(pts));
  }

  const heartIn = ease.outBack(ramp(abs, 914, 926));
  const ecgIn = ramp(abs, 906, 918, ease.outCubic);
  const bpm = Math.round(lerp(75, 118, ease.inOutSine(ramp(abs, 920, 972))));
  const lb = lastEvent(EV.beats, abs);
  const pop = lb.i >= 0 ? Math.exp(-lb.since / 5) : 0;
  const lens = {x: 752, y: 606, r: 186};

  return (
    <AbsoluteFill style={{background: C.tissueDark}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <defs>
          <linearGradient id="s08-out" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={C.navyDeep} />
            <stop offset="0.5" stopColor={mixHex(C.tissueDark, C.navyDeep, 0.45)} />
            <stop offset="1" stopColor={C.navyDeep} />
          </linearGradient>
          <linearGradient id="s08-back" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={mixHex(C.tissueDark, C.ink, 0.5)} />
            <stop offset="0.22" stopColor={C.tissueDark} />
            <stop offset="0.5" stopColor={mixHex(C.tissueDeep, C.tissueDark, 0.35)} />
            <stop offset="0.78" stopColor={C.tissueDark} />
            <stop offset="1" stopColor={mixHex(C.tissueDark, C.ink, 0.5)} />
          </linearGradient>
          <linearGradient id="s08-plasma" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={C.waterDeep} stopOpacity={0.42} />
            <stop offset="0.3" stopColor={C.water} stopOpacity={0.42} />
            <stop offset="0.5" stopColor={C.waterGlow} stopOpacity={0.52} />
            <stop offset="0.7" stopColor={C.water} stopOpacity={0.42} />
            <stop offset="1" stopColor={C.waterDeep} stopOpacity={0.42} />
          </linearGradient>
          <filter id="s08-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={5} />
          </filter>
          <linearGradient id="s08-media" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={C.muscleLight} />
            <stop offset="1" stopColor={C.muscle} />
          </linearGradient>
        </defs>
        <rect width={1080} height={1920} fill={C.navyDeep} />
        <g transform={cam}>
          <g transform={vesselTf}>
            {/* outside: connective tissue + dim cells + vasa vasorum */}
            <rect x={-1100} y={-1500} width={2200} height={3200} fill="url(#s08-out)" />
            <g transform={`translate(0,${fx(-travel)})`}>
              {pools.tissue.map((t, i) => (
                <BodyCell key={i} x={t.x} y={t.y} r={t.r} seed={t.s} f={abs} water={1 - 0.25 * thick} detail={0} opacity={0.32} rot={t.s * 7} />
              ))}
              {pools.vv.map((q, i) => (
                <Tube key={i} pts={q} w={9} base={C.vessel} deep={C.vesselDeep} light={C.vesselLight} inkW={1.5} opacity={0.55} />
              ))}
            </g>
            {/* back wall (inside surface) + endothelial mosaic */}
            <rect x={-R0 - 20} y={-1500} width={2 * R0 + 40} height={3200} fill="url(#s08-back)" />
            <g transform={`translate(0,${fx(-(travel % 124))})`}>
              <path d={pools.cells} fill={rgba(C.tissueLight, 0.13)} stroke={rgba(C.tissueDark, 0.75)} strokeWidth={3} />
              <path d={pools.nuc} fill={rgba(C.cellNucleus, 0.42)} />
            </g>
            {/* plasma: aqua (water) → darker, thicker */}
            <rect x={-R0 - 20} y={-1500} width={2 * R0 + 40} height={3200} fill="url(#s08-plasma)" opacity={1 - 0.85 * thick} />
            <rect x={-R0 - 20} y={-1500} width={2 * R0 + 40} height={3200} fill={C.bloodPoorDeep} opacity={0.4 * thick} />
            {caus.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={rgba(C.waterLight, 0.22 * (1 - thick))} strokeWidth={5 + (i % 3) * 3} />
            ))}
            {/* far + mid red cells, water molecules */}
            {pools.rbc.filter((c) => c.layer === 0).map(drawRBC)}
            {waterEls.filter((_, i) => pools.water[i].r < 20)}
            {pools.rbc.filter((c) => c.layer === 1).map(drawRBC)}
            {waterEls.filter((_, i) => pools.water[i].r >= 20)}
            {/* the cut wall on both sides: endothelium · media (smooth muscle) · adventitia */}
            {[-1, 1].map((side) => (
              <g key={side}>
                <path d={band(side, -6, 8)} fill={C.fibre} />
                <path d={band(side, 8, 76)} fill="url(#s08-media)" />
                <path d={band(side, 76, WALL)} fill={mixHex(C.fibre, C.tissue, 0.35)} />
                <path d={smoothPath(edge(side, 12, 3))} fill="none" stroke={rgba(C.fibre, 0.8)} strokeWidth={2.5} />
                <path d={smoothPath(edge(side, 72, 3))} fill="none" stroke={rgba(C.fibre, 0.7)} strokeWidth={2.5} />
                <path d={smoothPath(edge(side, 92, 6))} fill="none" stroke={rgba(C.tissueDeep, 0.5)} strokeWidth={2} />
                <path
                  d={ys
                    .filter((_, i) => i % 1 === 0)
                    .map((y, i) => {
                      const b = bulge(y + travel);
                      const x0 = side * (R0 + b + 26 + (i % 2) * 14);
                      return `M${fx(x0)},${fx(y + 8)} L${fx(x0 + side * 22)},${fx(y + 4)} M${fx(x0 + side * 6)},${fx(y + 33)} L${fx(x0 + side * 28)},${fx(y + 30)}`;
                    })
                    .join(' ')}
                  stroke={rgba(C.vesselDeep, 0.55)}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                <path d={smoothPath(edge(side, -6))} fill="none" stroke={rgba(C.ink, 0.85)} strokeWidth={3.5} />
                <path d={smoothPath(edge(side, WALL))} fill="none" stroke={rgba(C.ink, 0.85)} strokeWidth={3.5} />
                <path d={smoothPath(edge(side, 1))} fill="none" stroke={rgba('#ffffff', 0.35)} strokeWidth={3} />
              </g>
            ))}
            {/* near cells: big, soft, fast */}
            {pools.near.map((c) => (
              <g key={c.i} filter="url(#s08-soft)" opacity={0.85}>
                {drawRBC(c)}
              </g>
            ))}
          </g>
        </g>

        {/* heart lens + BPM */}
        <Lens id="s08lens" x={lens.x} y={lens.y} r={lens.r} pop={heartIn} f={abs}>
          {[0, 1, 2, 3].map((k) => (
            <path key={k} d={`M-260,${-120 + k * 70} C-120,${-170 + k * 70} 120,${-170 + k * 70} 260,${-120 + k * 70}`} fill="none" stroke={rgba(C.bodyGhost, 0.22)} strokeWidth={12} />
          ))}
          <ellipse cx={-150} cy={30} rx={90} ry={170} fill={rgba(C.lung, 0.08)} stroke={rgba(C.lungLight, 0.25)} strokeWidth={2} />
          <ellipse cx={160} cy={30} rx={90} ry={170} fill={rgba(C.lung, 0.08)} stroke={rgba(C.lungLight, 0.25)} strokeWidth={2} />
          <Heart f={abs} id="s08h" x={-14} y={44} scale={0.42} phase={ph} halo={1} />
        </Lens>
        {heartIn > 0.02 && (
          <g transform={`translate(${lens.x},${lens.y + lens.r + 62}) scale(${(heartIn * (1 + 0.06 * pop)).toFixed(4)})`}>
            <rect x={-130} y={-44} width={260} height={74} rx={12} fill={rgba(C.navyDeep, 0.78)} stroke={rgba(C.bloodLight, 0.6)} strokeWidth={2} />
            <path d="M0,-12 C0,-24 16,-26 18,-14 C20,-26 36,-24 36,-12 C36,0 18,8 18,8 C18,8 0,0 0,-12 Z" fill={C.bloodLight} transform={`translate(-108,-4) scale(${(1.15 + 0.3 * pop).toFixed(3)})`} />
            <text x={-50} y={13} fontFamily={TITLE} fontWeight={700} fontSize={54} fill={mixHex(C.cream, C.hudWarn, ramp(bpm, 90, 118))} textAnchor="start">
              {bpm}
            </text>
            <text x={44} y={-6} fontFamily={MONO} fontWeight={600} fontSize={20} fill={rgba(C.hud, 0.85)}>
              BPM
            </text>
            <path d="M58,22 L72,4 L86,22 Z" fill={C.hudWarn} opacity={ramp(abs, 926, 934)} transform={`translate(0,${fx(-3 * pop)})`} />
          </g>
        )}
        <Label f={abs} from={895} to={952} speed={0.8} text="THICKER BLOOD" sub="less water, more cells" x={70} y={470} size={36} accent={C.blood} />
        <g opacity={ecgIn} transform={`translate(0,${fx(30 * (1 - ecgIn))})`}>
          <Ecg abs={abs} y={1476} h={54} x0={84} x1={996} span={70} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
