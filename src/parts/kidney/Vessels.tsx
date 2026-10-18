import React from 'react';
import {C} from '../../lib/palette';
import {clamp, ease, hash, mixHex, rgba} from '../../lib/anim';
import {Toxin} from '../../lib/Cells';
import {pathAt, pathD, V, V_ORDER, type Vessel} from './geom';

// Glossy glass vessels (aorta, IVC, iliacs, renal arteries + veins) with flowing red cells drawn as
// combined paths (cheap), aqua water specks, and — when the kidneys fail — olive TOXIN blobs and an
// olive haze clouding the blood. World coords.

const fx = (n: number) => n.toFixed(1);
const ellD = (cx: number, cy: number, rx: number, ry: number, a: number) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const deg = ((a * 180) / Math.PI).toFixed(1);
  const x1 = cx + rx * c;
  const y1 = cy + rx * s;
  const x2 = cx - rx * c;
  const y2 = cy - rx * s;
  return `M${fx(x1)},${fx(y1)}A${fx(rx)},${fx(ry)} ${deg} 1 0 ${fx(x2)},${fx(y2)}A${fx(rx)},${fx(ry)} ${deg} 1 0 ${fx(x1)},${fx(y1)}Z`;
};
const dot = (cx: number, cy: number, r: number) => `M${fx(cx - r)},${fx(cy)}a${fx(r)},${fx(r)} 0 1 0 ${fx(2 * r)},0a${fx(r)},${fx(r)} 0 1 0 ${fx(-2 * r)},0`;

const SEED: Record<string, number> = {ivL: 11, ivR: 12, raL: 13, ivc: 14, rvL: 15, aorta: 16, iaL: 17, iaR: 18, raR: 19, rvR: 20};

export type ToxinSpec = {start: number; dur: number; n: number};
/** toxins: which vessel + where they start + how fast they creep (deterministic table) */
const TOX_N = 54;
const TOX_TABLE = (() => {
  const pool: [string, number, number, number][] = [
    // vessel, phase0, phase1, speed (px/frame)
    ['rvL', 0.05, 0.75, 0.9],
    ['rvR', 0.05, 0.8, 1.0],
    ['ivc', 0.12, 0.62, 2.2],
    ['ivc', 0.3, 0.8, 2.2],
    ['aorta', 0.3, 0.75, 2.6],
    ['rvR', 0.1, 0.85, 1.0],
    ['ivc', 0.15, 0.55, 2.0],
    ['rvL', 0.05, 0.7, 0.9],
    ['iaL', 0.05, 0.5, 2.0],
    ['ivR', 0.4, 0.95, 1.8],
    ['raR', 0.1, 0.8, 1.2],
    ['iaR', 0.05, 0.5, 2.0],
    ['ivL', 0.4, 0.95, 1.8],
    ['raL', 0.1, 0.8, 1.2],
  ];
  return Array.from({length: TOX_N}, (_, i) => {
    const p = pool[i % pool.length];
    return {v: p[0], ph: p[1] + (p[2] - p[1]) * hash(i, 71), sp: p[3] * (0.7 + 0.6 * hash(i, 72)), off: hash(i, 73) * 2 - 1, r: 14 + 7 * hash(i, 74), seed: i + 3, t: (i + 0.6 * hash(i, 75)) / TOX_N};
  });
})();

export const Vessels: React.FC<{
  id: string;
  abs: number;
  flowT: number; // integrated blood-flow time (frames at normal speed)
  sat?: number;
  crenate?: number;
  thick?: number; // 0..1 more crowded (concentrated blood)
  water?: number; // 0..1 aqua water specks in all vessels
  veinWater?: number; // 0..1 extra water returning in the renal veins + IVC (ADH hoarding)
  haze?: number; // 0..1 olive toxin haze
  tox?: ToxinSpec | null;
  cull?: [number, number]; // world y range worth drawing cells in
}> = ({id, abs, flowT, sat = 1, crenate = 0, thick = 0, water = 0.6, veinWater = 0, haze = 0, tox = null, cull = [-400, 2300]}) => {
  const layers = V_ORDER.map((ves) => {
    const art = ves.kind === 'art';
    const wall = art ? C.vessel : C.bloodPoor;
    const wallDeep = art ? C.vesselDeep : C.bloodPoorDeep;
    let lumen = mixHex(art ? C.bloodDeep : C.bloodPoorDeep, C.navyDeep, 0.42);
    lumen = mixHex(lumen, C.toxinDeep, 0.42 * haze);
    const d = pathD(ves.P);
    const r = ves.r;
    // ---- red cells ----
    const rc = ves.renal ? 6.2 : r > 25 ? 9.6 : 8;
    const n = Math.round((ves.P.len * (r + 8)) / (ves.renal ? 330 : 470) * (1 + 0.5 * thick));
    const seed = SEED[ves.key] ?? 1;
    let body = '';
    let dimple = '';
    let hi = '';
    const travel = flowT * ves.v;
    for (let j = 0; j < n; j++) {
      const dd = (((hash(j, seed) * ves.P.len + travel * (0.85 + 0.3 * hash(j, seed + 5))) % ves.P.len) + ves.P.len) % ves.P.len;
      const [x0, y0, a0] = pathAt(ves.P, dd);
      if (y0 < cull[0] || y0 > cull[1]) continue;
      const lat = (hash(j, seed + 9) * 2 - 1) * (r - rc * 0.9);
      const x = x0 - Math.sin(a0) * lat;
      const y = y0 + Math.cos(a0) * lat;
      const rr = rc * (0.8 + 0.4 * hash(j, seed + 13));
      const tumble = Math.abs(Math.sin(hash(j, seed + 17) * 6.28 + flowT * 0.06 * (0.5 + hash(j, seed + 19))));
      const ry = rr * (0.32 + 0.62 * tumble);
      const ang = a0 + Math.PI / 2 + (hash(j, seed + 23) - 0.5) * 1.2;
      body += ellD(x, y, rr, ry, ang);
      if (tumble > 0.45) dimple += ellD(x + 0.6, y + 0.6, rr * 0.48, ry * 0.42, ang);
      hi += ellD(x - rr * 0.32, y - ry * 0.35, rr * 0.28, Math.max(0.8, ry * 0.16), ang);
    }
    // ---- water specks ----
    const wAmt = water + (ves.kind === 'vein' && (ves.renal || ves.key === 'ivc') ? veinWater * 1.6 : 0);
    const nw = Math.round((ves.P.len / 48) * clamp(wAmt, 0, 2.2));
    let wd = '';
    let wh = '';
    for (let j = 0; j < nw; j++) {
      const dd = (((hash(j, seed + 40) * ves.P.len + travel * 1.05) % ves.P.len) + ves.P.len) % ves.P.len;
      const [x0, y0, a0] = pathAt(ves.P, dd);
      if (y0 < cull[0] || y0 > cull[1]) continue;
      const lat = (hash(j, seed + 41) * 2 - 1) * (r - 5);
      const x = x0 - Math.sin(a0) * lat;
      const y = y0 + Math.cos(a0) * lat;
      const rw = ves.renal ? 3.4 : 4.2;
      wd += dot(x, y, rw);
      wh += dot(x - rw * 0.35, y - rw * 0.35, rw * 0.35);
    }
    return {ves, d, r, wall, wallDeep, lumen, body, dimple, hi, wd, wh};
  });

  // toxins per vessel
  const toxBy: Record<string, React.ReactNode[]> = {};
  if (tox && abs >= tox.start) {
    TOX_TABLE.forEach((t, i) => {
      if (i >= tox.n) return;
      const appear = tox.start + t.t * tox.dur;
      const age = abs - appear;
      if (age < 0) return;
      const ves = (V as Record<string, Vessel>)[t.v];
      const s = ease.outBack(clamp(age / 9));
      const dd = (t.ph * ves.P.len + age * t.sp) % ves.P.len;
      const [x0, y0, a0] = pathAt(ves.P, dd);
      const rr = Math.min(t.r, ves.r * 1.05);
      const lat = t.off * Math.max(0, ves.r - rr * 0.7);
      const x = x0 - Math.sin(a0) * lat;
      const y = y0 + Math.cos(a0) * lat;
      (toxBy[t.v] ??= []).push(<Toxin key={i} x={x} y={y} r={rr * s} seed={t.seed} f={abs} rot={t.seed * 37} />);
    });
  }

  const sh = 0.5 + 0.5 * Math.sin(flowT * 0.08);
  return (
    <g>
      {layers.map((L) => {
        const glowC = L.ves.kind === 'art' ? C.blood : C.bloodPoorLight;
        return (
          <g key={L.ves.key}>
            <path d={L.d} fill="none" stroke={rgba(glowC, 0.1 + 0.03 * sh)} strokeWidth={L.r * 2 + 26} strokeLinecap="round" strokeLinejoin="round" />
            <path d={L.d} fill="none" stroke={rgba(C.ink, 0.75)} strokeWidth={L.r * 2 + 9} strokeLinecap="round" strokeLinejoin="round" />
            <path d={L.d} fill="none" stroke={L.wallDeep} strokeWidth={L.r * 2 + 5} strokeLinecap="round" strokeLinejoin="round" />
            <path d={L.d} fill="none" stroke={L.wall} strokeWidth={L.r * 2 - 1} strokeLinecap="round" strokeLinejoin="round" />
            <path d={L.d} fill="none" stroke={L.lumen} strokeWidth={L.r * 2 - 9} strokeLinecap="round" strokeLinejoin="round" />
            <path d={L.d} fill="none" stroke={rgba(L.ves.kind === 'art' ? C.bloodLight : C.bloodPoorLight, 0.12)} strokeWidth={L.r} strokeLinecap="round" />
            {L.body && (
              <>
                <path d={L.body} fill={mixHex(L.ves.kind === 'art' ? C.blood : mixHex(C.blood, C.bloodPoor, 0.55), C.bloodPoor, 1 - sat)} stroke={rgba(C.ink, 0.6)} strokeWidth={1} />
                {L.dimple && <path d={L.dimple} fill={rgba(C.bloodDeep, 0.55)} />}
                <path d={L.hi} fill={rgba('#ffffff', 0.45 * (1 - 0.5 * crenate))} />
              </>
            )}
            {L.wd && (
              <>
                <path d={L.wd} fill={C.water} stroke={rgba(C.waterGlow, 0.35)} strokeWidth={4} />
                <path d={L.wh} fill="#ffffff" opacity={0.85} />
              </>
            )}
            {haze > 0.01 && <path d={L.d} fill="none" stroke={rgba(C.toxin, 0.16 * haze)} strokeWidth={L.r * 2 - 10} strokeLinecap="round" />}
            {toxBy[L.ves.key]}
            <path d={L.d} fill="none" stroke={rgba('#ffffff', 0.26)} strokeWidth={Math.max(2, L.r * 0.26)} strokeLinecap="round" transform={`translate(${L.ves.hl[0]},${L.ves.hl[1]})`} />
            <path d={L.d} fill="none" stroke={rgba(C.bodyGhostLight, 0.25)} strokeWidth={1.5} transform={`translate(${-L.ves.hl[0] * 1.9},${-L.ves.hl[1] * 1.9})`} />
          </g>
        );
      })}
    </g>
  );
};
