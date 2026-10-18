import React from 'react';
import {C} from '../../lib/palette';
import {MONO} from '../../lib/fonts';
import {clamp, ease, hash, lerp, mixHex, ramp, rgba, wander} from '../../lib/anim';
import {ADH, RBC, Salt, WaterMolecule} from '../../lib/Cells';
import {spring} from '../../lib/MedKit';

// MAGNIFIER on a COLLECTING DUCT deep in the kidney (S06): left = the duct (urine flowing DOWN,
// walled by coral body cells), middle = the salty medulla, right = a capillary (blood flowing UP).
// ADH capsules dock on the blood side of the duct cells -> little GATES (aquaporins) open ->
// water molecules are pulled back THROUGH the wall into the blood; less water continues down, the
// urine left behind turns darker. Screen space; content is drawn for R = 280 and scaled.

const R0 = 280;
const fx = (n: number) => n.toFixed(1);
const GATE_Y = [-195, -117, -39, 39, 117, 195];
const CELL_Y = [-273, -195, -117, -39, 39, 117, 195, 273];
const LUMEN: [number, number] = [-160, -62];
const WALL_R: [number, number] = [-62, 2];
const WALL_L: [number, number] = [-224, -160];
const CAP: [number, number] = [118, 214];
const CAPX = (CAP[0] + CAP[1]) / 2;

type Opts = {tGate: number; tAdh: number};
const gateT = (o: Opts, g: number) => o.tGate + [0, 2, 4, 1, 3, 5][g] * 2.2;
const gateOpen = (o: Opts, abs: number, g: number) => clamp(ease.outBack(clamp((abs - gateT(o, g)) / 8)), 0, 1.15);

/** where water molecule n is at abs (null = gone). It flows down the duct; at each gate it passes
 *  it may be pulled through (only once the gate is open), else it continues down. */
const DT = 3;
const molecule = (o: Opts, n: number, abs: number) => {
  const ts = n * DT;
  const age = abs - ts;
  if (age < 0) return null;
  const x0 = -146 + 64 * hash(n, 1);
  const v = 5.4 + 2 * hash(n, 2);
  // each molecule heads for a preferred gate (spread over the whole wall); it is pulled through
  // the first OPEN gate at or below it — before ADH opens the gates, everything flows on down
  let gate = -1;
  const gp = Math.floor(hash(n, 4) * 6);
  if (hash(n, 3) < 0.95)
    for (let g = gp; g < 6; g++) {
      const tp = ts + (GATE_Y[g] + 310) / v;
      if (tp >= gateT(o, g) + 3) {
        gate = g;
        break;
      }
    }
  const rot = hash(n, 5) * 360 + age * (hash(n, 6) - 0.5) * 6;
  const wob = (a: number) => x0 + 6 * Math.sin(a * 0.1 + n);
  if (gate < 0) {
    const y = -310 + v * age;
    if (y > 330) return null;
    return {x: wob(age), y, rot, a: 1 - ramp(y, 240, 320), pulled: false};
  }
  const gy = GATE_Y[gate] - 9;
  const ag = (GATE_Y[gate] + 310) / v - 4;
  if (age < ag) return {x: wob(age), y: -310 + v * age, rot, a: 1, pulled: false};
  const a2 = age - ag;
  const ya = -310 + v * ag;
  const xa = wob(ag);
  const mouth = WALL_R[0] - 10;
  const exit = WALL_R[1] + 12;
  if (a2 < 6) {
    const t = ease.inOutSine(a2 / 6);
    return {x: lerp(xa, mouth, t), y: lerp(ya, gy, t), rot, a: 1, pulled: true};
  }
  if (a2 < 14) {
    const t = ease.inOutSine((a2 - 6) / 8);
    return {x: lerp(mouth, exit, t), y: gy, rot, a: 1, pulled: true};
  }
  const xc = CAPX - 26 + 52 * hash(n, 7);
  if (a2 < 26) {
    const t = ease.inOutSine((a2 - 14) / 12);
    return {x: lerp(exit, xc, t), y: gy - 54 * t * t, rot, a: 1, pulled: true};
  }
  const y = gy - 54 - (a2 - 26) * 3.8;
  if (y < -330) return null;
  return {x: xc + 6 * Math.sin(a2 * 0.12 + n), y, rot, a: 1 - ramp(y, -250, -320), pulled: true};
};

export const NephronLens: React.FC<{
  id: string;
  abs: number;
  cx: number;
  cy: number;
  open: number; // 0..1 (overshoots allowed)
  sx: number; // source point on the kidney (screen)
  sy: number;
  tGate: number; // abs frame the gates start opening ("hoarding")
  tAdh: number; // abs frame ADH starts docking in the lens
  conc?: number; // 0..1 urine concentration (darkening)
}> = ({id, abs, cx, cy, open, sx, sy, tGate, tAdh, conc = 0}) => {
  if (open <= 0.01) return null;
  const o: Opts = {tGate, tAdh};
  const rr = R0 * Math.max(0, open);
  const t = clamp(open);
  const lx = lerp(sx, cx, ease.outCubic(t));
  const ly = lerp(sy, cy, ease.outCubic(t));
  const k = rr / R0;
  // cone from the kidney to the lens
  const dx = sx - lx;
  const dy = sy - ly;
  const d = Math.hypot(dx, dy);
  let cone: string | null = null;
  if (d > rr + 4) {
    const th = Math.atan2(dy, dx);
    const b = Math.acos(rr / d);
    const t1: [number, number] = [lx + rr * Math.cos(th + b), ly + rr * Math.sin(th + b)];
    const t2: [number, number] = [lx + rr * Math.cos(th - b), ly + rr * Math.sin(th - b)];
    cone = `M${fx(sx)},${fx(sy)}L${fx(t1[0])},${fx(t1[1])}L${fx(t2[0])},${fx(t2[1])}Z`;
  }
  const drx = wander(abs * 0.015, 3) * 10;
  const dry = wander(abs * 0.015, 8) * 8;
  const drot = Math.sin(abs * 0.03) * 1.5;

  // ---- molecules ----
  const mols: React.ReactNode[] = [];
  const nNow = Math.floor(abs / DT);
  for (let n = nNow - 52; n <= nNow; n++) {
    const m = molecule(o, n, abs);
    if (!m || m.a <= 0.02) continue;
    mols.push(<WaterMolecule key={n} x={m.x} y={m.y} r={10} rot={m.rot} opacity={m.a} glow={m.pulled ? 0.9 : 0.4} />);
  }
  // ---- RBCs in the capillary (flowing up) ----
  const rbcs = Array.from({length: 7}, (_, i) => {
    const y = ((((hash(i, 31) * 660 - abs * 4.3) % 660) + 660) % 660) - 330;
    const x = CAPX + 12 * Math.sin(abs * 0.05 + i * 1.7);
    return <RBC key={i} x={x} y={y} r={20} rot={80 + 25 * Math.sin(abs * 0.04 + i)} tilt={0.2 + 0.55 * hash(i, 32)} />;
  });
  // ---- salt in the interstitium (the salty medulla pulls water) ----
  const salts = Array.from({length: 9}, (_, i) => (
    <Salt key={i} x={26 + 70 * hash(i, 41) + 6 * Math.sin(abs * 0.03 + i)} y={-250 + 520 * ((i + hash(i, 42)) / 9) + 5 * Math.cos(abs * 0.025 + i * 2)} r={7} rot={abs * 0.4 + i * 40} opacity={0.85} />
  ));
  // ---- ADH docking on the blood side of the wall ----
  const adhs = [0, 2, 3, 5].map((g, j) => {
    const td = tAdh + j * 2.5;
    const ty = GATE_Y[g] + 28;
    const p = abs - (td - 12);
    if (p < 0) return null;
    const s = spring(p, 0.35, 4);
    const x = lerp(CAPX, WALL_R[1] + 20, clamp(s, 0, 1.1));
    const y = lerp(ty + 110, ty, clamp(s, 0, 1.1));
    const docked = abs >= td;
    return (
      <g key={g}>
        {docked && abs - td < 14 && <circle cx={WALL_R[1] + 20} cy={ty} r={12 + (abs - td) * 3.2} fill="none" stroke={rgba(C.adhLight, 0.8 * (1 - (abs - td) / 14))} strokeWidth={3} />}
        <ADH x={x + (docked ? Math.sin(abs * 0.2 + g) * 1.2 : 0)} y={y} r={17} rot={docked ? 0 : 60 * (1 - clamp(s))} glow={docked ? 0.7 + 0.3 * Math.sin(abs * 0.3 + g) : 0.5} opacity={clamp(p / 4)} />
      </g>
    );
  });
  // ---- arrows: water out of the duct into the blood ----
  const arrows = [1, 3, 5].map((g, j) => {
    const a0 = tGate + 4 + j * 3;
    const prog = ramp(abs, a0, a0 + 12, ease.outCubic);
    if (prog <= 0) return null;
    const y = GATE_Y[g] - 9;
    const dd = `M${-112},${y + 2} C${-50},${y - 8} ${40},${y - 6} ${130},${y - 52}`;
    const L = 260;
    const pul = 0.75 + 0.25 * Math.sin(abs * 0.3 - j);
    const ang = Math.atan2(-46, 90) - 0.12;
    return (
      <g key={g} opacity={pul}>
        <path d={dd} fill="none" stroke={rgba(C.navyDeep, 0.6)} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${L * prog} ${L}`} />
        <path d={dd} fill="none" stroke={C.waterLight} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${L * prog} ${L}`} />
        {prog > 0.85 && (
          <g transform={`translate(130,${y - 52}) rotate(${(ang * 180) / Math.PI})`}>
            <path d="M6,0 L-14,-11 L-9,0 L-14,11 Z" fill={C.waterLight} stroke={rgba(C.navyDeep, 0.6)} strokeWidth={2} />
          </g>
        )}
      </g>
    );
  });

  const uriBottom = mixHex(C.urine0, C.urine3, conc);
  const cellRect = (x0: number, x1: number, y: number, key: string, gate: boolean) => (
    <g key={key}>
      <rect x={x0 + 1} y={y - 37} width={x1 - x0 - 2} height={74} rx={16} fill={C.cellDeep} stroke={rgba(C.ink, 0.6)} strokeWidth={2} />
      <rect x={x0 + 4} y={y - 34} width={x1 - x0 - 12} height={64} rx={13} fill={C.cell} />
      <ellipse cx={x0 + 16} cy={y - 22} rx={9} ry={5} fill={C.cellLight} opacity={0.7} />
      <ellipse cx={(x0 + x1) / 2 + 2} cy={y + (gate ? 16 : 2)} rx={13} ry={11} fill={C.cellNucleus} stroke={rgba(C.ink, 0.4)} strokeWidth={1.5} />
      <circle cx={(x0 + x1) / 2 - 2} cy={y + (gate ? 12 : -2)} r={4.5} fill={C.cellNucleusLight} opacity={0.7} />
    </g>
  );
  const gates = GATE_Y.map((gy, g) => {
    const op = gateOpen(o, abs, g);
    const y = gy - 9;
    const sep = 5.5 * op;
    const door = 58 * op;
    return (
      <g key={g}>
        <rect x={WALL_R[0] - 2} y={y - 9 - sep} width={WALL_R[1] - WALL_R[0] + 4} height={18 + 2 * sep} fill={rgba(C.navyDeep, 0.7)} />
        <rect x={WALL_R[0] - 2} y={y - 6} width={WALL_R[1] - WALL_R[0] + 4} height={12} fill={rgba(C.water, 0.85 * clamp(op))} />
        <rect x={WALL_R[0] - 2} y={y - 6} width={WALL_R[1] - WALL_R[0] + 4} height={12} fill={rgba(C.waterGlow, 0.25 * clamp(op))} transform={`translate(0,0) scale(1,1)`} />
        <rect x={WALL_R[0] + 2} y={y - 17 - sep} width={WALL_R[1] - WALL_R[0] - 4} height={10} rx={5} fill={C.cream} stroke={rgba(C.ink, 0.75)} strokeWidth={1.8} />
        <rect x={WALL_R[0] + 2} y={y + 7 + sep} width={WALL_R[1] - WALL_R[0] - 4} height={10} rx={5} fill={C.cream} stroke={rgba(C.ink, 0.75)} strokeWidth={1.8} />
        <g transform={`translate(${WALL_R[0]},${y - 7}) rotate(${-door})`}>
          <rect x={-18} y={-3} width={18} height={6} rx={3} fill={C.cream} stroke={rgba(C.ink, 0.75)} strokeWidth={1.5} />
        </g>
        <g transform={`translate(${WALL_R[0]},${y + 7}) rotate(${door})`}>
          <rect x={-18} y={-3} width={18} height={6} rx={3} fill={C.cream} stroke={rgba(C.ink, 0.75)} strokeWidth={1.5} />
        </g>
        {/* ADH receptor cup on the blood side */}
        <path d={`M${WALL_R[1] + 1},${gy + 18} q12,0 12,10 q0,10 -12,10`} fill="none" stroke={rgba(C.adhLight, 0.7)} strokeWidth={3} strokeLinecap="round" />
      </g>
    );
  });

  return (
    <g>
      <defs>
        <clipPath id={`${id}-lc`}>
          <circle cx={0} cy={0} r={R0} />
        </clipPath>
        <radialGradient id={`${id}-lbg`} cx="45%" cy="40%" r="70%">
          <stop offset="0%" stopColor={mixHex(C.tissueDeep, C.medBg, 0.3)} />
          <stop offset="100%" stopColor={mixHex(C.tissueDark, C.navyDeep, 0.45)} />
        </radialGradient>
        <linearGradient id={`${id}-lum`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.urine0} stopOpacity={0.3} />
          <stop offset="1" stopColor={uriBottom} stopOpacity={0.45 + 0.35 * conc} />
        </linearGradient>
        <radialGradient id={`${id}-glare`} cx="30%" cy="25%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.16} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
      </defs>
      {cone && (
        <>
          <path d={cone} fill={rgba(C.bodyGhostLight, 0.08 * t)} />
          <path d={cone} fill="none" stroke={rgba(C.bodyGhostLight, 0.5 * t)} strokeWidth={2} strokeDasharray="6 8" />
        </>
      )}
      <circle cx={sx} cy={sy} r={22 + 4 * Math.sin(abs * 0.2)} fill="none" stroke={rgba(C.bodyGhostLight, 0.85 * t)} strokeWidth={3} />
      <g transform={`translate(${fx(lx)},${fx(ly)}) scale(${k.toFixed(4)})`}>
        <circle r={R0 + 22} fill={rgba(C.navyDeep, 0.55)} transform="translate(10,14)" />
        <g clipPath={`url(#${id}-lc)`}>
          <circle r={R0 + 2} fill={`url(#${id}-lbg)`} />
          <g transform={`translate(${fx(drx)},${fx(dry)}) rotate(${drot.toFixed(2)})`}>
            {/* fibres */}
            {[0, 1, 2, 3].map((i) => (
              <path key={i} d={`M8,${-300 + i * 170} C44,${-250 + i * 170} 70,${-330 + i * 170} 116,${-270 + i * 170}`} fill="none" stroke={rgba(C.fibre, 0.14)} strokeWidth={3} />
            ))}
            {salts}
            {/* capillary */}
            <rect x={CAP[0]} y={-340} width={CAP[1] - CAP[0]} height={680} fill={rgba(C.bloodDeep, 0.42)} />
            {rbcs}
            <path d={`M${CAP[0]},-340 V340 M${CAP[1]},-340 V340`} stroke={rgba(C.ink, 0.7)} strokeWidth={9} />
            <path d={`M${CAP[0]},-340 V340 M${CAP[1]},-340 V340`} stroke={C.vessel} strokeWidth={5} />
            {[-260, -130, 0, 130, 260].map((y, i) => (
              <ellipse key={i} cx={i % 2 ? CAP[1] : CAP[0]} cy={y + (i % 2) * 50} rx={4} ry={18} fill={C.vesselLight} opacity={0.7} />
            ))}
            {/* collecting duct */}
            <rect x={LUMEN[0]} y={-340} width={LUMEN[1] - LUMEN[0]} height={680} fill={`url(#${id}-lum)`} />
            {CELL_Y.map((y, i) => cellRect(WALL_L[0], WALL_L[1], y, `l${i}`, false))}
            {CELL_Y.map((y, i) => cellRect(WALL_R[0], WALL_R[1], y, `r${i}`, i > 0 && i < 7))}
            {gates}
            {adhs}
            {mols}
            {arrows}
            {/* tags */}
            <g fontFamily={MONO} fontWeight={600} fontSize={22} letterSpacing={1.5} textAnchor="middle">
              <rect x={-152} y={-232} width={82} height={30} rx={6} fill={rgba(C.navyDeep, 0.8)} />
              <text x={-111} y={-210} fill={C.urine1}>
                URINE
              </text>
              <rect x={CAPX - 41} y={-182} width={82} height={30} rx={6} fill={rgba(C.navyDeep, 0.8)} />
              <text x={CAPX} y={-160} fill={C.bloodLight}>
                BLOOD
              </text>
            </g>
          </g>
          <circle r={R0} fill={`url(#${id}-glare)`} />
        </g>
        {/* rim */}
        <circle r={R0 + 9} fill="none" stroke={rgba(C.ink, 0.85)} strokeWidth={20} />
        <circle r={R0 + 9} fill="none" stroke={C.chromeShade} strokeWidth={13} />
        <circle r={R0 + 7} fill="none" stroke={C.chrome} strokeWidth={5} />
        <path d={`M${fx(-R0 * 0.82)},${fx(-R0 * 0.5)} A${R0 + 9},${R0 + 9} 0 0 1 ${fx(-R0 * 0.2)},${fx(-R0 * 0.98)}`} fill="none" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
        <circle r={R0 - 2} fill="none" stroke={rgba(C.bodyGhostLight, 0.35)} strokeWidth={3} />
      </g>
    </g>
  );
};
