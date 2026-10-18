import React from 'react';
import {C} from '../../lib/palette';
import {rgba, smoothPath} from '../../lib/anim';
import type {Pt} from './geom';

// The x-ray glass TRUNK (front view) for S06 + S14: faint skeleton (spine, lower ribs, costal
// margin, pelvis, femoral heads), ghost organs (lung bases, diaphragm, liver, stomach, heart at the
// very top) and the translucent pale-blue glass skin. World coords (see geom.ts). Static geometry
// is built once at module load.

const fx = (n: number) => n.toFixed(1);
const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [1080 - x, y]);
const rrect = (cx: number, cy: number, w: number, h: number, r: number) => {
  const x = cx - w / 2;
  const y = cy - h / 2;
  return `M${fx(x + r)},${fx(y)}H${fx(x + w - r)}A${r},${r} 0 0 1 ${fx(x + w)},${fx(y + r)}V${fx(y + h - r)}A${r},${r} 0 0 1 ${fx(x + w - r)},${fx(y + h)}H${fx(x + r)}A${r},${r} 0 0 1 ${fx(x)},${fx(y + h - r)}V${fx(y + r)}A${r},${r} 0 0 1 ${fx(x + r)},${fx(y)}Z`;
};
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${fx(cx - rx)},${fx(cy)}A${fx(rx)},${fx(ry)} 0 1 0 ${fx(cx + rx)},${fx(cy)}A${fx(rx)},${fx(ry)} 0 1 0 ${fx(cx - rx)},${fx(cy)}Z`;

// ---- spine: vertebral levels (L5 at 1222, 96 px per level) ----
const LEVELS: number[] = [];
for (let y = 1222; y > -900; y -= 96) LEVELS.push(y);
const SPX = 536;
let vBodies = '';
let vProc = '';
let vEyes = '';
LEVELS.forEach((y, i) => {
  const lumbar = i < 5;
  const w = lumbar ? 132 - i * 4 : Math.max(92, 112 - (i - 5) * 2.2);
  const h = lumbar ? 74 : 64;
  vBodies += rrect(SPX, y, w, h, 18);
  const tw = lumbar ? 112 : 92;
  vProc += rrect(SPX - w / 2 - tw / 2 + 14, y - 6, tw, 16, 8) + rrect(SPX + w / 2 + tw / 2 - 14, y - 6, tw, 16, 8);
  vEyes += ell(SPX - w * 0.3, y - 8, 11, 15) + ell(SPX + w * 0.3, y - 8, 11, 15) + ell(SPX, y + 12, 8, 17);
});
// sacrum + coccyx
const SACRUM = smoothPath(
  [
    [462, 1288],
    [610, 1288],
    [648, 1360],
    [612, 1500],
    [566, 1630],
    [536, 1684],
    [506, 1630],
    [460, 1500],
    [424, 1360],
  ],
  true,
);
let sacFor = '';
[1350, 1420, 1490, 1560].forEach((y, i) => {
  const dx = 52 - i * 9;
  sacFor += ell(SPX - dx, y, 10 - i, 8 - i * 0.6) + ell(SPX + dx, y, 10 - i, 8 - i * 0.6);
});

// ---- ribs (posterior arcs) + anterior arcs + costal margin ----
const ribsBack: string[] = [];
const ribsFront: string[] = [];
const RIB_LEVELS = LEVELS.filter((y) => y < 760 && y > -620); // T12 … T4
RIB_LEVELS.forEach((y) => {
  const floating = y > 600;
  const L: Pt[] = floating
    ? y > 700
      ? [
          [440, y],
          [372, y + 26],
          [306, y + 76],
          [262, y + 130],
        ]
      : [
          [440, y],
          [340, y + 4],
          [240, y + 52],
          [176, y + 140],
        ]
    : [
        [440, y],
        [330, y - 22],
        [200, y + 18],
        [112, y + 130],
        [86, y + 290],
      ];
  ribsBack.push(smoothPath(L), smoothPath(mirror(L)));
  if (!floating && y < 520) {
    const A: Pt[] = [
      [90, y + 300],
      [150, y + 380],
      [250, y + 450],
      [370, y + 500],
    ];
    ribsFront.push(smoothPath(A), smoothPath(mirror(A)));
  }
});
const COSTAL: Pt[] = [
  [540, 300],
  [470, 372],
  [384, 466],
  [292, 566],
  [214, 652],
  [168, 712],
];
const costal = smoothPath(COSTAL) + smoothPath(mirror(COSTAL));
const STERNUM = smoothPath(
  [
    [512, -900],
    [506, -300],
    [514, 200],
    [540, 312],
    [566, 200],
    [574, -300],
    [568, -900],
  ],
  false,
);

// ---- pelvis + femurs ----
const ILIUM_L: Pt[] = [
  [470, 1330],
  [404, 1290],
  [300, 1262],
  [196, 1282],
  [132, 1340],
  [146, 1424],
  [206, 1522],
  [262, 1626],
  [292, 1694],
];
const BRIM_L: Pt[] = [
  [292, 1694],
  [352, 1640],
  [420, 1566],
  [462, 1460],
  [474, 1336],
];
const PUBIS_L: Pt[] = [
  [330, 1772],
  [420, 1792],
  [516, 1814],
];
const ISCH_L: Pt[] = [
  [516, 1858],
  [430, 1890],
  [340, 1880],
  [300, 1820],
];
const FEMUR_L: Pt[] = [
  [244, 1760],
  [196, 1792],
  [168, 1840],
  [176, 2000],
];
const FEMUR_L2: Pt[] = [
  [304, 1792],
  [266, 1838],
  [252, 1900],
  [250, 2000],
];
const pelvisLines =
  [ILIUM_L, BRIM_L, PUBIS_L, ISCH_L, FEMUR_L, FEMUR_L2].map((p) => smoothPath(p) + smoothPath(mirror(p))).join('') + ell(410, 1836, 56, 34) + ell(670, 1836, 56, 34);
const heads = ell(282, 1736, 54, 54) + ell(798, 1736, 54, 54);
const sockets = `M${fx(220)},${fx(1700)} A70,70 0 0 1 ${fx(346)},${fx(1704)} M${fx(860)},${fx(1700)} A70,70 0 0 0 ${fx(734)},${fx(1704)}`;

// ---- ghost organs ----
const DIAPH = smoothPath([
  [40, 150],
  [160, 10],
  [320, -70],
  [470, -10],
  [540, 40],
  [620, -30],
  [780, -110],
  [930, -20],
  [1050, 120],
]);
const LIVER = smoothPath(
  [
    [56, 160],
    [210, 40],
    [420, 30],
    [600, 120],
    [620, 230],
    [520, 330],
    [380, 430],
    [250, 560],
    [140, 640],
    [70, 560],
  ],
  true,
);
const STOMACH = smoothPath(
  [
    [660, 120],
    [780, 30],
    [900, 80],
    [950, 240],
    [910, 420],
    [800, 520],
    [680, 520],
    [640, 460],
    [720, 420],
    [800, 330],
    [790, 210],
    [690, 210],
  ],
  true,
);
const LUNGS =
  smoothPath(
    [
      [90, -900],
      [70, -300],
      [62, 120],
      [170, 0],
      [330, -90],
      [430, -400],
      [430, -900],
    ],
    false,
  ) +
  smoothPath(
    [
      [990, -900],
      [1012, -300],
      [1018, 110],
      [910, -20],
      [770, -120],
      [660, -420],
      [650, -900],
    ],
    false,
  );
const HEART = smoothPath(
  [
    [470, -470],
    [600, -560],
    [730, -500],
    [800, -360],
    [760, -210],
    [640, -90],
    [520, -120],
    [440, -230],
    [420, -360],
  ],
  true,
);

// ---- glass skin ----
const SIDE_L: Pt[] = [
  [22, -900],
  [30, -400],
  [46, 0],
  [76, 360],
  [112, 700],
  [124, 1000],
  [110, 1250],
  [76, 1480],
  [92, 1700],
  [150, 1900],
  [190, 2060],
];
const SKIN = (() => {
  const L = smoothPath(SIDE_L);
  const R = smoothPath(mirror(SIDE_L).slice().reverse()).replace(/^M/, 'L');
  return `${L} ${R} Z`;
})();
const SKIN_L = smoothPath(SIDE_L);
const SKIN_R = smoothPath(mirror(SIDE_L));
const CROTCH = smoothPath([
  [468, 2060],
  [540, 1962],
  [612, 2060],
]);

export const Skeleton: React.FC<{id: string; f: number; heart?: number; dim?: number}> = ({id, f, heart = 0, dim = 0}) => {
  const a = 1 - 0.35 * dim;
  const bone = C.bodyGhostLight;
  return (
    <g opacity={a}>
      <defs>
        <radialGradient id={`${id}-heart`}>
          <stop offset="0%" stopColor={C.heartLight} stopOpacity={0.35} />
          <stop offset="60%" stopColor={C.heart} stopOpacity={0.12} />
          <stop offset="100%" stopColor={C.heart} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* ghost organs (back) */}
      <path d={LUNGS} fill={rgba(C.bodyGhost, 0.05)} stroke={rgba(bone, 0.16)} strokeWidth={3} />
      <circle cx={610} cy={-330} r={320 * (1 + 0.04 * heart)} fill={`url(#${id}-heart)`} opacity={0.5 + 0.5 * heart} />
      <path d={HEART} fill={rgba(C.heart, 0.1 + 0.08 * heart)} stroke={rgba(C.heartLight, 0.35)} strokeWidth={3} transform={`translate(610,-330) scale(${(1 + 0.05 * heart).toFixed(3)}) translate(-610,330)`} />
      <path d={DIAPH} fill="none" stroke={rgba(bone, 0.22)} strokeWidth={4} />
      <path d={LIVER} fill={rgba(C.bodyGhost, 0.05)} stroke={rgba(bone, 0.18)} strokeWidth={3} />
      <path d={STOMACH} fill={rgba(C.bodyGhost, 0.04)} stroke={rgba(bone, 0.15)} strokeWidth={3} />
      {/* spine */}
      <path d={vBodies} fill={rgba(bone, 0.07)} stroke={rgba(bone, 0.3)} strokeWidth={2.5} />
      <path d={vProc} fill={rgba(bone, 0.05)} stroke={rgba(bone, 0.24)} strokeWidth={2} />
      <path d={vEyes} fill="none" stroke={rgba(bone, 0.22)} strokeWidth={2} />
      <path d={SACRUM} fill={rgba(bone, 0.07)} stroke={rgba(bone, 0.3)} strokeWidth={2.5} />
      <path d={sacFor} fill={rgba(C.navyDeep, 0.3)} stroke={rgba(bone, 0.22)} strokeWidth={1.5} />
      {/* ribs */}
      <path d={STERNUM} fill={rgba(bone, 0.04)} stroke={rgba(bone, 0.14)} strokeWidth={2} />
      <path d={ribsFront.join('')} fill="none" stroke={rgba(bone, 0.1)} strokeWidth={14} strokeLinecap="round" />
      <path d={ribsBack.join('')} fill="none" stroke={rgba(bone, 0.09)} strokeWidth={22} strokeLinecap="round" />
      <path d={ribsBack.join('')} fill="none" stroke={rgba(bone, 0.3)} strokeWidth={3} strokeLinecap="round" />
      <path d={costal} fill="none" stroke={rgba(bone, 0.22)} strokeWidth={8} strokeLinecap="round" />
      {/* pelvis */}
      <path d={pelvisLines} fill="none" stroke={rgba(bone, 0.12)} strokeWidth={18} strokeLinecap="round" />
      <path d={pelvisLines} fill="none" stroke={rgba(bone, 0.32)} strokeWidth={3} strokeLinecap="round" />
      <path d={heads} fill={rgba(bone, 0.08)} stroke={rgba(bone, 0.34)} strokeWidth={3} />
      <path d={sockets} fill="none" stroke={rgba(bone, 0.3)} strokeWidth={5} strokeLinecap="round" />
      {/* faint scan shimmer on the bones */}
      <rect x={0} y={((f * 9) % 2600) - 700} width={1080} height={70} fill={rgba(C.bodyGhostLight, 0.025)} />
    </g>
  );
};

/** The glass skin of the trunk (front layer): fresnel edges + rim glow. */
export const GlassSkin: React.FC<{id: string; f: number; dim?: number}> = ({id, f, dim = 0}) => {
  const a = 1 - 0.3 * dim;
  const sh = 0.5 + 0.5 * Math.sin(f * 0.05);
  return (
    <g opacity={a}>
      <defs>
        <linearGradient id={`${id}-fres`} gradientUnits="userSpaceOnUse" x1={20} y1={0} x2={1060} y2={0}>
          <stop offset="0" stopColor={C.bodyGhost} stopOpacity={0.2} />
          <stop offset="0.1" stopColor={C.bodyGhost} stopOpacity={0.08} />
          <stop offset="0.5" stopColor={C.bodyGhost} stopOpacity={0.02} />
          <stop offset="0.9" stopColor={C.bodyGhost} stopOpacity={0.08} />
          <stop offset="1" stopColor={C.bodyGhost} stopOpacity={0.2} />
        </linearGradient>
      </defs>
      <path d={SKIN} fill={`url(#${id}-fres)`} />
      <path d={SKIN_L + SKIN_R} fill="none" stroke={rgba(C.bodyGhost, 0.1)} strokeWidth={60} />
      <path d={SKIN_L + SKIN_R} fill="none" stroke={rgba(C.bodyGhost, 0.18 + 0.06 * sh)} strokeWidth={18} />
      <path d={SKIN_L + SKIN_R} fill="none" stroke={rgba(C.bodyGhostLight, 0.85)} strokeWidth={3.5} />
      <path d={CROTCH} fill="none" stroke={rgba(C.bodyGhostLight, 0.4)} strokeWidth={3} />
      {/* navel + linea alba */}
      <ellipse cx={540} cy={1236} rx={13} ry={18} fill="none" stroke={rgba(C.bodyGhostLight, 0.35)} strokeWidth={3} />
      <path d="M540,330 L540,1200 M540,1270 L540,1600" stroke={rgba(C.bodyGhostLight, 0.07)} strokeWidth={3} />
    </g>
  );
};
