// The brain builder's private glossy x-ray HEAD + BRAIN kit (side view, he faces screen-LEFT).
// Used by S05 Thirst and S13 BrainShrink so both scenes match. World coords = 1080×1920 at
// camera scale 1 (see geom.ts). Layers, back to front:
//   <HeadBody/>   glass skin silhouette + ghost hair, neck: airway, spine + cord, clavicle,
//                 carotid (blood UP) + jugular (blood DOWN) with flowing red cells
//   <Cavity/>     the cranial cavity: cerebrospinal fluid (aqua) around the brain
//   <Brain/>      cerebellum, brainstem, glossy pink cerebrum with gyri, surface arteries,
//                 bridging veins, hypothalamus + pituitary (shrink / dull / alarm props)
//   <SkullGlass/> the clean translucent pale-blue glass skull (vault + base) and the skin outline
import React from 'react';
import {C} from '../../lib/palette';
import {RBC} from '../../lib/Cells';
import {clamp, hash, mixHex, rgba, wander} from '../../lib/anim';
import {
  AIRWAY_D, ARTERIES_D, BASE_BACK_D, BASE_FRONT_D, BRAIN_ANCHOR, BRAIN_D, BRAINSTEM_D, BRIDGES, CAROTID, CAVITY_D, CEREBELLUM_D,
  CLAVICLE_D, CORD_D, FACE_ARTERY_D, FOLIA_D, GYRI_D, HAIR_CTRL, HAIR_OUTER_N, HYPO, JUGULAR, P, PIT, PONS_D, SHOULDER_D, SINUS_D,
  SKIN_D, SKULL_BAND_D, SKULL_IN_D, SKULL_OUT, SKULL_OUT_D, STALK_D, SULCI_D, SYLV_D, TONGUE_D, Track, VERTEBRAE, offsetPoly, polyD,
} from './geom';
import {smoothPath} from '../../lib/anim';

const fx = (n: number) => n.toFixed(1);

/** Brain scale for a given shrink amount (0..1) — shared so overlays can follow the brain. */
export const brainScale = (shrink: number) => 1 - 0.075 * shrink;
/** Where a brain-local point lands after shrinking. */
export const brainPt = (p: P, shrink: number): P => {
  const k = brainScale(shrink);
  return [BRAIN_ANCHOR[0] + (p[0] - BRAIN_ANCHOR[0]) * k, BRAIN_ANCHOR[1] + (p[1] - BRAIN_ANCHOR[1]) * k];
};
export const brainTf = (shrink: number) => {
  const k = brainScale(shrink);
  const [ax, ay] = BRAIN_ANCHOR;
  return `translate(${fx(ax)},${fx(ay)}) scale(${k.toFixed(4)}) translate(${fx(-ax)},${fx(-ay)})`;
};

/** A smooth heartbeat envelope (≈75 bpm at beatLen 24). */
export const heartbeat = (t: number, beatLen = 24) => {
  const ph = (((t / beatLen) % 1) + 1) % 1;
  return Math.exp(-Math.pow((ph - 0.12) / 0.08, 2)) + 0.45 * Math.exp(-Math.pow((ph - 0.36) / 0.08, 2));
};

// ---------------------------------------------------------------------------------------------

const TubeEdges: React.FC<{d: string; w: number; wall: string; lumen: string; alpha?: number}> = ({d, w, wall, lumen, alpha = 1}) => (
  <g opacity={alpha}>
    <path d={d} fill="none" stroke={rgba(wall, 0.28)} strokeWidth={w + 18} strokeLinecap="round" />
    <path d={d} fill="none" stroke={wall} strokeWidth={w + 6} strokeLinecap="round" />
    <path d={d} fill="none" stroke={lumen} strokeWidth={w} strokeLinecap="round" />
  </g>
);

const flowCells = (tr: Track, flow: number, speed: number, spacing: number, w: number, sat: number, seed: number, crowd = 1) => {
  const out: React.ReactNode[] = [];
  const sp = spacing / crowd;
  const n = Math.ceil(tr.total / sp) + 1;
  for (let i = 0; i < n; i++) {
    const d0 = i * sp + (hash(i, seed) - 0.5) * sp * 0.5;
    const d = (((d0 + flow * speed) % tr.total) + tr.total) % tr.total;
    const [x, y, a] = tr.atD(d);
    if (y < 900 && seed === 2) continue;
    const lat = (hash(i, seed + 5) - 0.5) * w * 0.42 + Math.sin(flow * 0.05 + i) * w * 0.05;
    const nx = -Math.sin(a), ny = Math.cos(a);
    out.push(
      <RBC
        key={i}
        x={x + nx * lat}
        y={y + ny * lat}
        r={w * (0.34 + 0.06 * hash(i, seed + 9))}
        rot={(a * 180) / Math.PI + 90 + (hash(i, seed + 3) - 0.5) * 60 + flow * (hash(i, seed + 4) - 0.5) * 2}
        tilt={0.2 + 0.6 * (0.5 + 0.5 * Math.sin(flow * 0.06 + i * 1.7))}
        sat={sat}
      />,
    );
  }
  return out;
};

/** Glass skin + hair + the neck's anatomy and blood vessels. */
export const HeadBody: React.FC<{
  f: number; // drives idle motion (hair, shimmer)
  id: string;
  flow: number; // blood-flow clock (frames; warp it for a time-lapse)
  beat?: number; // 0..1 heartbeat envelope (vessels swell)
  bloodSat?: number;
  bloodCrowd?: number; // >1 = thicker blood (more cells)
  flowSpeed?: number; // px per flow-frame
  salt?: number; // 0..1 salt sparkles in the arterial blood
  hairSway?: number;
}> = ({f, id, flow, beat = 0, bloodSat = 1, bloodCrowd = 1, flowSpeed = 5.2, salt = 0, hairSway = 1}) => {
  // ghost hair: outer locks sway
  const hair = HAIR_CTRL.map((p, i) => {
    if (i >= HAIR_OUTER_N) return p;
    const s = hairSway * (i < 6 ? 7 : 4);
    return [p[0] + wander(f * 0.03 + i * 0.7, 11) * s, p[1] + wander(f * 0.025 + i * 0.9, 23) * s * 0.7] as P;
  });
  const hairD = smoothPath(hair, true);
  const cw = 40 + 3 * beat;
  const jw = 50;
  // salt sparkles riding up the carotid
  let saltD = '';
  const nSalt = Math.round(salt * 30);
  for (let i = 0; i < nSalt; i++) {
    const d = (((i * 53 + flow * flowSpeed * 1.05) % CAROTID.total) + CAROTID.total) % CAROTID.total;
    const [x, y, a] = CAROTID.atD(d);
    if (y < 1060) continue;
    const lat = (hash(i, 77) - 0.5) * cw * 0.7;
    const sx = x - Math.sin(a) * lat, sy = y + Math.cos(a) * lat;
    const s = 3.2 + 1.6 * hash(i, 78);
    saltD += `M${fx(sx)},${fx(sy - s)}L${fx(sx + s)},${fx(sy)}L${fx(sx)},${fx(sy + s)}L${fx(sx - s)},${fx(sy)}Z`;
  }
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-skin`} cx="52%" cy="42%" r="62%">
          <stop offset="0%" stopColor={C.bodyGhost} stopOpacity={0.03} />
          <stop offset="70%" stopColor={C.bodyGhost} stopOpacity={0.07} />
          <stop offset="100%" stopColor={C.bodyGhostLight} stopOpacity={0.16} />
        </radialGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.bodyGhostLight} stopOpacity={0.16} />
          <stop offset="100%" stopColor={C.bodyGhost} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {/* hair ghost (behind the scalp line) */}
      <path d={hairD} fill={`url(#${id}-hair)`} />
      <path d={smoothPath(hair.slice(0, HAIR_OUTER_N))} fill="none" stroke={rgba(C.bodyGhostLight, 0.32)} strokeWidth={2} strokeLinejoin="round" />
      {[0, 1, 2, 3, 4].map((k) => {
        // a few inner hair strands
        const a = hair[3 + k * 3], b = hair[4 + k * 3];
        const m: P = [(a[0] + b[0]) / 2 + 30, (a[1] + b[1]) / 2 + 60];
        return <path key={k} d={smoothPath([a, m, [m[0] + 40, m[1] + 40]])} fill="none" stroke={rgba(C.bodyGhostLight, 0.14)} strokeWidth={1.6} />;
      })}
      {/* glass skin volume */}
      <path d={SKIN_D} fill={`url(#${id}-skin)`} />
      {/* shoulder + clavicle */}
      <path d={SHOULDER_D} fill={rgba(C.bodyGhost, 0.05)} stroke={rgba(C.bodyGhostLight, 0.28)} strokeWidth={2} />
      <path d={CLAVICLE_D} fill="none" stroke={rgba(C.bodyGhostLight, 0.5)} strokeWidth={28} strokeLinecap="round" />
      <path d={CLAVICLE_D} fill="none" stroke={C.medBg} strokeWidth={23} strokeLinecap="round" opacity={0.78} />
      <path d={CLAVICLE_D} fill="none" stroke={rgba(C.bodyGhostLight, 0.22)} strokeWidth={6} strokeLinecap="round" transform="translate(-2,-5)" />
      {/* airway + tongue */}
      <path d={TONGUE_D} fill={rgba(C.tissue, 0.16)} stroke={rgba(C.tissueLight, 0.32)} strokeWidth={2} />
      <path d={AIRWAY_D} fill="none" stroke={rgba(C.airway, 0.3)} strokeWidth={58} strokeLinecap="round" />
      <path d={AIRWAY_D} fill="none" stroke={C.medBg} strokeWidth={52} strokeLinecap="round" opacity={0.72} />
      <path d={AIRWAY_D} fill="none" stroke={rgba(C.airway, 0.22)} strokeWidth={46} strokeDasharray="5 17" />
      {/* spine: vertebral bodies + spinous processes (glass) */}
      {VERTEBRAE.map((v, i) => (
        <g key={i} transform={`translate(${fx(v.x)},${fx(v.y)}) rotate(${fx(v.rot)})`}>
          <rect x={-v.w / 2} y={-v.h / 2} width={v.w} height={v.h} rx={14} fill={rgba(C.bodyGhost, 0.14)} stroke={rgba(C.bodyGhostLight, 0.55)} strokeWidth={2} />
          <rect x={-v.w / 2 + 7} y={-v.h / 2 + 6} width={v.w * 0.42} height={6} rx={3} fill={rgba(C.bodyGhostLight, 0.3)} />
          <path
            d={`M${v.w / 2 + 52},${-10} L${v.w / 2 + 122},${12} Q${v.w / 2 + 132},${24} ${v.w / 2 + 118},${28} L${v.w / 2 + 50},${12} Z`}
            fill={rgba(C.bodyGhost, 0.12)}
            stroke={rgba(C.bodyGhostLight, 0.45)}
            strokeWidth={1.8}
          />
        </g>
      ))}
      {/* spinal cord */}
      <path d={CORD_D} fill="none" stroke={rgba(C.brainDeep, 0.8)} strokeWidth={34} strokeLinecap="round" />
      <path d={CORD_D} fill="none" stroke={mixHex(C.brain, C.brainDeep, 0.35)} strokeWidth={27} opacity={0.9} strokeLinecap="round" />
      <path d={CORD_D} fill="none" stroke={rgba(C.brainLight, 0.55)} strokeWidth={6} strokeLinecap="round" transform="translate(-6,0)" />
      {/* face artery (branch of the carotid) */}
      <path d={FACE_ARTERY_D} fill="none" stroke={rgba(C.vessel, 0.7)} strokeWidth={6} strokeLinecap="round" />
      <path d={FACE_ARTERY_D} fill="none" stroke={rgba(C.bloodLight, 0.8)} strokeWidth={3} strokeDasharray="4 20" strokeDashoffset={fx(-flow * 2.4)} strokeLinecap="round" />
      {/* jugular vein (blood flowing DOWN, darker) */}
      <TubeEdges d={polyD(JUGULAR.pts)} w={jw} wall={C.bloodPoor} lumen={rgba(C.bloodPoorDeep, 0.9)} />
      <path d={polyD(offsetPoly(JUGULAR.pts, -jw * 0.3))} fill="none" stroke={rgba(C.bloodPoorLight, 0.35)} strokeWidth={4} />
      {flowCells(JUGULAR, flow, flowSpeed * 0.8, 62, jw, Math.min(bloodSat, 0.45), 3, bloodCrowd)}
      {/* carotid artery (blood flowing UP into the head) */}
      <TubeEdges d={polyD(CAROTID.pts)} w={cw} wall={C.vessel} lumen={rgba(C.bloodDeep, 0.92)} />
      <path d={polyD(offsetPoly(CAROTID.pts, cw * 0.3))} fill="none" stroke={rgba(C.vesselLight, 0.4)} strokeWidth={4} />
      {flowCells(CAROTID, flow, flowSpeed, 56, cw, bloodSat, 2, bloodCrowd)}
      {saltD && <path d={saltD} fill={C.salt} stroke={rgba(C.saltDeep, 0.8)} strokeWidth={0.8} />}
    </g>
  );
};

/** Cerebrospinal fluid filling the cranial cavity (shows as the gap around the brain). */
export const Cavity: React.FC<{f: number; id: string; dark?: number}> = ({f, id, dark = 0}) => {
  const a = 1 - 0.65 * dark;
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-csf`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={mixHex(C.waterDeep, C.navyDeep, dark * 0.7)} stopOpacity={0.35 * a + 0.2} />
          <stop offset="85%" stopColor={mixHex(C.water, C.waterDark, dark)} stopOpacity={0.38 * a + 0.12} />
          <stop offset="100%" stopColor={mixHex(C.waterGlow, C.waterDeep, dark)} stopOpacity={0.6 * a + 0.1} />
        </radialGradient>
      </defs>
      <path d={CAVITY_D} fill={`url(#${id}-csf)`} />
      {/* faint caustic shimmer in the fluid */}
      <path
        d={CAVITY_D}
        fill="none"
        stroke={rgba(C.waterLight, 0.35 * a)}
        strokeWidth={3}
        strokeDasharray="30 50 12 70"
        strokeDashoffset={fx(-f * 1.6)}
      />
    </g>
  );
};

/** The glossy brain + its base structures. Children are drawn in BRAIN-LOCAL coords (they shrink with it). */
export const Brain: React.FC<{
  f: number;
  id: string;
  flow: number;
  shrink?: number; // 0..1 (S13: brain pulls away from the skull)
  dull?: number; // 0..1 duller, greyer, sulci wider
  alarm?: number; // 0..1 electric-yellow wash from the hypothalamus
  hypo?: number; // 0..1 hypothalamus highlight
  pit?: number; // 0..1 pituitary glowing violet (releasing ADH)
  beat?: number;
  children?: React.ReactNode;
}> = ({f, id, flow, shrink = 0, dull = 0, alarm = 0, hypo = 0, pit = 0, beat = 0, children}) => {
  const grey = '#9c8c98';
  const bL = mixHex(C.brainLight, grey, dull * 0.35);
  const bM = mixHex(C.brain, grey, dull * 0.4);
  const bD = mixHex(C.brainDeep, '#6a5260', dull * 0.45);
  const bDD = mixHex(C.brainDeep, C.ink, 0.35 + dull * 0.15);
  const widen = dull * 2.2;
  const gw = 31 - 8 * dull; // gyrus thickness (thinner = wider sulci when dehydrated)
  const tf = brainTf(shrink + beat * 0.012);
  const hp = clamp(hypo);
  return (
    <g>
      <defs>
        <clipPath id={`${id}-bclip`}>
          <path d={BRAIN_D} />
        </clipPath>
        <clipPath id={`${id}-cclip`}>
          <path d={CEREBELLUM_D} />
        </clipPath>
        <clipPath id={`${id}-spec`}>
          <ellipse cx={420} cy={520} rx={260} ry={150} transform="rotate(-18 420 520)" />
        </clipPath>
        <radialGradient id={`${id}-bgrad`} cx="40%" cy="28%" r="78%">
          <stop offset="0%" stopColor={bL} />
          <stop offset="42%" stopColor={bM} />
          <stop offset="100%" stopColor={bD} />
        </radialGradient>
        <radialGradient id={`${id}-cgrad`} cx="45%" cy="30%" r="80%">
          <stop offset="0%" stopColor={mixHex(bL, bM, 0.4)} />
          <stop offset="100%" stopColor={bD} />
        </radialGradient>
        <linearGradient id={`${id}-sgrad`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={bD} />
          <stop offset="45%" stopColor={bM} />
          <stop offset="100%" stopColor={bD} />
        </linearGradient>
        <radialGradient id={`${id}-alarm`} gradientUnits="userSpaceOnUse" cx={HYPO[0]} cy={HYPO[1]} r={620}>
          <stop offset="0%" stopColor={C.alarm} stopOpacity={0.9} />
          <stop offset="40%" stopColor={C.alarm} stopOpacity={0.42} />
          <stop offset="100%" stopColor={C.alarm} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="40%" stopColor={C.brainLight} stopOpacity={0.45} />
          <stop offset="100%" stopColor={C.brainLight} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-yglow`}>
          <stop offset="0%" stopColor={C.alarmLight} stopOpacity={1} />
          <stop offset="40%" stopColor={C.alarm} stopOpacity={0.5} />
          <stop offset="100%" stopColor={C.alarm} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-vglow`}>
          <stop offset="0%" stopColor={C.adhLight} stopOpacity={1} />
          <stop offset="45%" stopColor={C.adh} stopOpacity={0.45} />
          <stop offset="100%" stopColor={C.adh} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* sagittal sinus + bridging veins (skull side fixed, brain side follows the shrink) */}
      <path d={SINUS_D} fill="none" stroke={rgba(C.bloodPoor, 0.75)} strokeWidth={9} strokeLinecap="round" />
      <path d={SINUS_D} fill="none" stroke={rgba(C.bloodPoorLight, 0.5)} strokeWidth={2.5} strokeLinecap="round" />
      {BRIDGES.map((br, i) => {
        const b = brainPt(br.b, shrink);
        const len = Math.hypot(b[0] - br.a[0], b[1] - br.a[1]);
        const taut = clamp((len - 16) / 40);
        const mx = (br.a[0] + b[0]) / 2 + (1 - taut) * 6 * Math.sin(i * 2.1) + taut * 1.2 * Math.sin(f * 0.9 + i);
        const my = (br.a[1] + b[1]) / 2 + (1 - taut) * 6 * Math.cos(i * 1.3);
        return (
          <g key={i}>
            <path d={`M${fx(br.a[0])},${fx(br.a[1])} Q${fx(mx)},${fx(my)} ${fx(b[0])},${fx(b[1])}`} fill="none" stroke={rgba(C.bloodPoor, 0.95)} strokeWidth={6.5 - 2.5 * taut} strokeLinecap="round" />
            <path d={`M${fx(br.a[0])},${fx(br.a[1])} Q${fx(mx)},${fx(my)} ${fx(b[0])},${fx(b[1])}`} fill="none" stroke={rgba(C.bloodLight, 0.55 + 0.35 * taut)} strokeWidth={2} strokeLinecap="round" />
          </g>
        );
      })}

      {/* brainstem (does not shrink with the cerebrum) */}
      <path d={BRAINSTEM_D} fill={`url(#${id}-sgrad)`} stroke={rgba(C.ink, 0.5)} strokeWidth={2} />
      <path d={PONS_D} fill="none" stroke={rgba(bDD, 0.55)} strokeWidth={2} />
      <path d={PONS_D} fill="none" stroke={rgba(bL, 0.45)} strokeWidth={1.4} transform="translate(-1,-3)" />

      <g transform={tf}>
        {/* cerebellum */}
        <path d={CEREBELLUM_D} fill={`url(#${id}-cgrad)`} />
        <g clipPath={`url(#${id}-cclip)`}>
          <path d={FOLIA_D} fill="none" stroke={rgba(bDD, 0.7)} strokeWidth={2.2 + widen * 0.5} />
          <path d={FOLIA_D} fill="none" stroke={rgba(bL, 0.55)} strokeWidth={1.6} transform="translate(0,-4)" />
          <path d={CEREBELLUM_D} fill="none" stroke={rgba(bD, 0.6)} strokeWidth={20} />
        </g>
        <path d={CEREBELLUM_D} fill="none" stroke={rgba(C.ink, 0.5)} strokeWidth={2.2} />

        {/* cerebrum */}
        <path d={BRAIN_D} fill={rgba(bL, 0.16)} stroke={rgba(bL, 0.22)} strokeWidth={14} />
        <g clipPath={`url(#${id}-bclip)`}>
          {/* dark base = the sulci; gyri = fat rounded tubes on top (glossy) */}
          <path d={BRAIN_D} fill={bD} />
          <path d={GYRI_D} fill="none" stroke={rgba(bDD, 0.55)} strokeWidth={gw + 4} strokeLinecap="round" strokeLinejoin="round" transform="translate(3,5)" />
          <path d={GYRI_D} fill="none" stroke={`url(#${id}-bgrad)`} strokeWidth={gw} strokeLinecap="round" strokeLinejoin="round" />
          <path d={GYRI_D} fill="none" stroke={rgba(bL, 0.42)} strokeWidth={gw * 0.3} strokeLinecap="round" strokeLinejoin="round" transform="translate(-5,-6)" />
          {/* glossy specular crests (upper-left) */}
          <g clipPath={`url(#${id}-spec)`}>
            <path d={GYRI_D} fill="none" stroke={rgba('#ffffff', 0.45 - dull * 0.25)} strokeWidth={2.6} strokeLinecap="round" transform="translate(-8,-9)" />
          </g>
          <path d={SULCI_D} fill="none" stroke={rgba(bL, 0.45)} strokeWidth={4} strokeLinecap="round" transform="translate(-4,-5)" />
          <path d={SULCI_D} fill="none" stroke={rgba(bDD, 0.6)} strokeWidth={12 + widen} strokeLinecap="round" />
          <path d={SULCI_D} fill="none" stroke={bDD} strokeWidth={5 + widen} strokeLinecap="round" />
          <path d={SYLV_D} fill="none" stroke={bDD} strokeWidth={10 + widen} strokeLinecap="round" />
          <ellipse cx={400} cy={500} rx={210} ry={70} fill={rgba('#ffffff', 0.1 - dull * 0.05)} transform="rotate(-24 400 500)" />
          {/* inner rim shade at the base */}
          <path d={BRAIN_D} fill="none" stroke={rgba(bD, 0.55)} strokeWidth={36} />
          {/* surface arteries with flowing blood */}
          <path d={ARTERIES_D} fill="none" stroke={rgba(C.vesselDeep, 0.8)} strokeWidth={5.6} strokeLinecap="round" />
          <path d={ARTERIES_D} fill="none" stroke={C.vessel} strokeWidth={3.4} strokeLinecap="round" />
          <path d={ARTERIES_D} fill="none" stroke={rgba(C.bloodLight, 0.95)} strokeWidth={2} strokeDasharray="5 24" strokeDashoffset={fx(-flow * 2.2)} strokeLinecap="round" />
          {alarm > 0 && <path d={BRAIN_D} fill={`url(#${id}-alarm)`} opacity={clamp(alarm)} />}
        </g>
        <path d={BRAIN_D} fill="none" stroke={rgba(C.ink, 0.55)} strokeWidth={2.6} />
        <path d={BRAIN_D} fill="none" stroke={rgba(bL, 0.85)} strokeWidth={2} strokeDasharray="420 2000" strokeDashoffset={-260} transform="translate(2,3)" />
        {children}
      </g>

      {/* hypothalamus (salt sensor) + pituitary on its stalk */}
      {hp > 0 && <circle cx={HYPO[0]} cy={HYPO[1]} r={40 + 70 * Math.min(hp, 1.6)} fill={`url(#${id}-${alarm > 0.05 ? 'yglow' : 'glow'})`} opacity={Math.min(1, hp)} />}
      <ellipse
        cx={HYPO[0]}
        cy={HYPO[1]}
        rx={30}
        ry={19}
        transform={`rotate(-14 ${HYPO[0]} ${HYPO[1]})`}
        fill={mixHex(mixHex(bM, bD, 0.2), C.alarm, clamp(alarm * 1.2))}
        stroke={rgba(C.ink, 0.45)}
        strokeWidth={2}
      />
      <ellipse cx={HYPO[0] - 6} cy={HYPO[1] - 6} rx={14} ry={6} fill={rgba('#ffffff', 0.45)} transform={`rotate(-14 ${HYPO[0]} ${HYPO[1]})`} />
      <path d={STALK_D} fill="none" stroke={rgba(C.ink, 0.45)} strokeWidth={10} strokeLinecap="round" />
      <path d={STALK_D} fill="none" stroke={mixHex(mixHex(bM, bD, 0.2), C.adh, 0.35 * pit)} strokeWidth={7} strokeLinecap="round" />
      {pit > 0 && <circle cx={PIT[0] + 9} cy={PIT[1]} r={34 + 40 * pit} fill={`url(#${id}-vglow)`} opacity={clamp(pit)} />}
      {/* anterior lobe (front) + posterior lobe (back — the one that releases ADH) */}
      <ellipse cx={PIT[0] - 6} cy={PIT[1] + 2} rx={16} ry={13} fill={mixHex(bM, '#e0a0b0', 0.3)} stroke={rgba(C.ink, 0.55)} strokeWidth={2} />
      <ellipse cx={PIT[0] + 11} cy={PIT[1]} rx={11} ry={11} fill={mixHex(mixHex(bD, '#c890c0', 0.3), C.adh, 0.85 * pit)} stroke={rgba(C.ink, 0.55)} strokeWidth={2} />
      <ellipse cx={PIT[0] - 10} cy={PIT[1] - 4} rx={6} ry={3.5} fill="#fff" opacity={0.6} />
      <circle cx={PIT[0] + 8} cy={PIT[1] - 4} r={2.5} fill="#fff" opacity={0.6 + 0.4 * pit} />
    </g>
  );
};

/** Clean translucent glass skull (vault + base, no face bones) + the glowing glass skin outline. */
export const SkullGlass: React.FC<{f: number; id: string; sheen?: number}> = ({f, id, sheen = 0}) => {
  // specular streak travelling slowly over the vault
  const n = SKULL_OUT.length;
  const a = Math.floor(n * (0.12 + 0.05 * Math.sin(f * 0.02)));
  const specPts = offsetPoly(SKULL_OUT, 6).slice(a, a + Math.floor(n * 0.22));
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-skull`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={C.bodyGhostLight} stopOpacity={0.42} />
          <stop offset="60%" stopColor={C.bodyGhost} stopOpacity={0.22} />
          <stop offset="100%" stopColor={C.bodyGhost} stopOpacity={0.14} />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="50%" stopColor="#fff" stopOpacity={0.38} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <clipPath id={`${id}-skinclip`}>
          <path d={SKIN_D} />
        </clipPath>
      </defs>
      {/* skull base (floor) */}
      {[BASE_FRONT_D, BASE_BACK_D].map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke={rgba(C.bodyGhost, 0.2)} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} fill="none" stroke={rgba(C.bodyGhostLight, 0.7)} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {/* vault */}
      <path d={SKULL_BAND_D} fill={`url(#${id}-skull)`} />
      <path d={SKULL_OUT_D} fill="none" stroke={rgba(C.bodyGhost, 0.28)} strokeWidth={14} strokeLinecap="round" />
      <path d={SKULL_OUT_D} fill="none" stroke={C.bodyGhostLight} strokeWidth={2.8} strokeLinecap="round" />
      <path d={SKULL_IN_D} fill="none" stroke={rgba(C.bodyGhostLight, 0.6)} strokeWidth={1.6} strokeLinecap="round" />
      <path d={polyD(specPts)} fill="none" stroke={rgba('#ffffff', 0.6)} strokeWidth={4.5} strokeLinecap="round" />
      {/* glass skin outline (layered glow) */}
      <path d={SKIN_D} fill="none" stroke={rgba(C.bodyGhost, 0.1)} strokeWidth={30} />
      <path d={SKIN_D} fill="none" stroke={rgba(C.bodyGhost, 0.3)} strokeWidth={9} />
      <path d={SKIN_D} fill="none" stroke={C.bodyGhostLight} strokeWidth={2.4} />
      {/* profile details: brow, closed-soft eye line, nostril, lips */}
      <g fill="none" stroke={rgba(C.bodyGhostLight, 0.6)} strokeWidth={2.2} strokeLinecap="round">
        <path d="M132,902 Q160,890 196,898" />
        <path d="M142,936 Q166,924 192,932" strokeWidth={3} />
        <path d="M146,944 Q166,950 186,942" opacity={0.6} />
        <path d="M96,1116 Q110,1110 118,1120" opacity={0.7} />
        <path d="M104,1212 Q130,1214 152,1210" opacity={0.7} />
      </g>
      {/* time-lapse / idle sheen sweeping across the glass */}
      {sheen > 0 && (
        <g clipPath={`url(#${id}-skinclip)`}>
          <rect x={-400 + sheen * 1900} y={200} width={420} height={1900} fill={`url(#${id}-sheen)`} transform={`rotate(14 ${fx(-190 + sheen * 1900)} 1100)`} />
        </g>
      )}
    </g>
  );
};

export {HYPO, PIT};
