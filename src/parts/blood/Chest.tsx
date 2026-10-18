import React, {useMemo} from 'react';
import {C} from '../../lib/palette';
import {rgba, smoothPath} from '../../lib/anim';
import {P, fx} from './util';

/**
 * X-ray glass chest (world coords = 1080×1920 frame): torso outline, faint spine, glass ribs
 * (posterior arcs behind, anterior arcs + sternum in front), clavicles, translucent lungs with a
 * bronchial tree, the diaphragm domes and a faint liver / stomach below. `breath` 0..1 inflates
 * the lungs. Split into <ChestBack/> (behind the heart) and <ChestFront/> (in front, faint).
 */

const ribs = (() => {
  const out: {post: P[]; ant: P[]; side: number}[] = [];
  for (let i = 0; i < 9; i++) {
    const y0 = 468 + i * 92;
    const wid = 300 + Math.min(i, 5) * 22 - Math.max(0, i - 6) * 10;
    for (const side of [-1, 1]) {
      const sx = (dx: number) => 540 + side * dx;
      out.push({
        side,
        post: [[sx(34), y0], [sx(150), y0 - 26], [sx(wid * 0.78), y0 - 4], [sx(wid + 40), y0 + 60], [sx(wid + 52), y0 + 130]],
        ant: [[sx(wid + 52), y0 + 130], [sx(wid + 20), y0 + 200], [sx(wid * 0.72), y0 + 236], [sx(140 + i * 6), y0 + 210 + i * 14], [sx(64), y0 + 160 + i * 20]],
      });
    }
  }
  return out;
})();

const glass = (d: string, w: number, a = 1, key?: string | number) => (
  <g key={key} opacity={a}>
    <path d={d} fill="none" stroke={rgba(C.bodyGhost, 0.32)} strokeWidth={w + 8} strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} fill="none" stroke={rgba(C.navyDeep, 0.55)} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} fill="none" stroke={rgba(C.bone, 0.1)} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} fill="none" stroke={rgba(C.bodyGhostLight, 0.4)} strokeWidth={2} strokeLinecap="round" transform={`translate(${fx(-w * 0.18)},${fx(-w * 0.22)})`} />
  </g>
);

const LUNG_L: P[] = [[470, 520], [420, 470], [330, 500], [230, 620], [170, 820], [150, 1040], [160, 1260], [210, 1350], [330, 1330], [440, 1290], [480, 1150], [470, 900], [480, 700]];
const LUNG_R: P[] = [[610, 520], [660, 470], [750, 500], [850, 620], [910, 820], [930, 1040], [920, 1260], [870, 1350], [770, 1330], [700, 1250], [640, 1180], [620, 1000], [610, 760]];
const BRONCHI: P[][] = [
  [[540, -40], [540, 300], [540, 560]],
  [[540, 560], [470, 640], [400, 760], [330, 900]],
  [[540, 560], [610, 640], [690, 760], [760, 900]],
  [[440, 700], [340, 690], [260, 760]],
  [[400, 760], [380, 980], [330, 1160]],
  [[640, 700], [740, 690], [820, 760]],
  [[690, 760], [720, 980], [780, 1160]],
  [[330, 900], [250, 1000], [230, 1120]],
  [[760, 900], [840, 1000], [860, 1120]],
];
const BODY_L: P[] = [[436, -40], [430, 230], [330, 330], [150, 372], [40, 430], [-20, 520]];
const BODY_L2: P[] = [[96, 620], [104, 900], [120, 1250], [150, 1600], [170, 1980]];
const BODY_R: P[] = BODY_L.map(([x, y]) => [1080 - x, y]);
const BODY_R2: P[] = BODY_L2.map(([x, y]) => [1080 - x, y]);

export const ChestBack: React.FC<{f: number; breath: number}> = ({f, breath}) => {
  const g = useMemo(
    () => ({
      post: ribs.map((r) => smoothPath(r.post)),
      lungL: smoothPath(LUNG_L, true),
      lungR: smoothPath(LUNG_R, true),
      br: BRONCHI.map((b) => smoothPath(b)),
      body: [BODY_L, BODY_L2, BODY_R, BODY_R2].map((b) => smoothPath(b)),
    }),
    [],
  );
  const ls = 1 + 0.022 * breath;
  let spine = '';
  for (let y = -40; y < 1980; y += 74) spine += `M${fx(506)},${fx(y)} h68 a8,8 0 0 1 8,8 v46 a8,8 0 0 1 -8,8 h-68 a8,8 0 0 1 -8,-8 v-46 a8,8 0 0 1 8,-8 Z `;
  return (
    <g>
      {/* torso outline (x-ray glass) */}
      {g.body.map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke={rgba(C.bodyGhost, 0.18)} strokeWidth={26} strokeLinecap="round" />
          <path d={d} fill="none" stroke={rgba(C.bodyGhostLight, 0.6)} strokeWidth={3} strokeLinecap="round" />
        </g>
      ))}
      {/* spine */}
      <path d={spine} fill={rgba(C.bone, 0.06)} stroke={rgba(C.bodyGhostLight, 0.22)} strokeWidth={2} />
      {/* lungs */}
      <g transform={`translate(540,900) scale(${ls.toFixed(4)}) translate(-540,-900)`}>
        {[g.lungL, g.lungR].map((d, i) => (
          <g key={i}>
            <path d={d} fill={rgba(C.lung, 0.13)} stroke={rgba(C.lungLight, 0.45)} strokeWidth={3} />
            <path d={d} fill="none" stroke={rgba(C.lung, 0.12)} strokeWidth={30} />
          </g>
        ))}
        {g.br.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={rgba(C.airway, 0.22)} strokeWidth={i === 0 ? 34 : 14 - Math.min(i, 4)} strokeLinecap="round" />
        ))}
      </g>
      {/* diaphragm + liver / stomach below */}
      <path d="M60,1420 C200,1300 420,1300 520,1400 C640,1320 860,1320 1020,1440 L1080,1980 L0,1980 Z" fill={rgba(C.medBg, 0.5)} />
      <path d="M90,1440 C200,1330 380,1320 500,1420 L520,1600 C400,1680 200,1700 110,1640 Z" fill={rgba(C.liver, 0.16)} stroke={rgba(C.liverLight, 0.35)} strokeWidth={2.5} />
      <path d="M620,1400 C720,1350 860,1370 920,1450 C930,1560 860,1640 760,1640 C680,1620 640,1520 620,1400 Z" fill={rgba(C.gut, 0.1)} stroke={rgba(C.gut, 0.35)} strokeWidth={2.5} />
      <path d="M60,1420 C200,1300 420,1300 520,1400 C640,1320 860,1320 1020,1440" fill="none" stroke={rgba(C.bodyGhostLight, 0.5)} strokeWidth={3} />
      <path d="M60,1420 C200,1300 420,1300 520,1400 C640,1320 860,1320 1020,1440" fill="none" stroke={rgba(C.bodyGhost, 0.15)} strokeWidth={22} />
      {/* posterior ribs */}
      {g.post.map((d, i) => glass(d, 18, 0.75, i))}
      {/* a few drifting glints along the ribs */}
      <circle cx={540 + 380 * Math.sin(f * 0.013)} cy={700 + 300 * Math.cos(f * 0.011)} r={2.5} fill={rgba(C.bodyGhostLight, 0.6)} />
    </g>
  );
};

export const ChestFront: React.FC<{opacity?: number}> = ({opacity = 1}) => {
  const g = useMemo(
    () => ({
      ant: ribs.slice(0, 14).map((r) => smoothPath(r.ant)),
      clavL: smoothPath([[500, 432], [400, 410], [300, 380], [160, 372]]),
      clavR: smoothPath([[580, 432], [680, 410], [780, 380], [920, 372]]),
    }),
    [],
  );
  return (
    <g opacity={opacity}>
      {g.ant.map((d, i) => glass(d, 14, 0.42, i))}
      {glass(g.clavL, 26, 0.6)}
      {glass(g.clavR, 26, 0.6)}
      {/* sternum */}
      <path d="M512,440 L568,440 L572,700 L560,1010 L540,1060 L520,1010 L508,700 Z" fill={rgba(C.bone, 0.06)} stroke={rgba(C.bodyGhostLight, 0.32)} strokeWidth={2.5} strokeLinejoin="round" />
    </g>
  );
};
