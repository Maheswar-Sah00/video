import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C} from '../../lib/palette';
import {clamp, hash, mixHex, rgba} from '../../lib/anim';
import {ADH, Ring} from '../../lib/Cells';
import {camPt, MedBg, spring} from '../../lib/MedKit';
import {ADH_PASS, ADH_ROUTES, KID, kpt, pathAt, pyrMid, DOCK_PYR, type Side} from './geom';
import {GlassSkin, Skeleton} from './Torso';
import {Vessels, type ToxinSpec} from './Vessels';
import {Kidney} from './Kidney';
import {Urinary} from './Urinary';

// The shared x-ray TORSO + KIDNEYS rig for S06 and S14: one camera (world point (cx,cy) at the
// screen centre, scale s, roll rot) applied to 4 parallax layers (skeleton slower, organs, glass
// skin faster, foreground bokeh fastest) over the navy MedBg. Scene-specific screen-space overlays
// (lens, chart, labels) come in as children.

export type Cam = {cx: number; cy: number; s: number; rot: number};
export const camK = (c: Cam, k: number) => {
  const cx = 540 + (c.cx - 540) * k;
  const cy = 960 + (c.cy - 960) * k;
  const s = Math.pow(c.s, k);
  return `translate(540,960) rotate(${(c.rot * k).toFixed(3)}) scale(${s.toFixed(4)}) translate(${(-cx).toFixed(2)},${(-cy).toFixed(2)})`;
};
export const toScreen = (c: Cam, x: number, y: number) => camPt({x, y}, [c.cx, c.cy], [540, 960], c.s, c.rot);

/** S06 ADH stream: 12 capsules dock on the pyramids, others pass on down the aorta. */
export type AdhSpec = {dock0: number; dockStep: number; pass0: number; passStep: number; passN: number};
const ADH_V = 30;
export const adhDocks = (spec: AdhSpec) =>
  Array.from({length: 12}, (_, i) => {
    const side: Side = i % 2 === 0 ? 'L' : 'R';
    const j = Math.floor(i / 2);
    const td = spec.dock0 + i * spec.dockStep + 0.8 * hash(i, 9);
    return {i, side, j, td};
  });
/** world position of the docked capsule (for labels) */
export const dockPos = (side: Side, j: number, bob: number) => {
  const pm = pyrMid(DOCK_PYR[j]);
  return kpt(side, pm[0], pm[1], bob);
};

export type RigState = {
  abs: number;
  cam: Cam;
  flowT: number; // blood flow time
  uflowT: number; // urine flow time
  actT: number; // kidney filtering time
  sat?: number;
  crenate?: number;
  thick?: number;
  water?: number;
  veinWater?: number;
  haze?: number;
  tox?: ToxinSpec | null;
  glow: number;
  glowColor?: string;
  dull: number;
  act: number;
  adhTint?: number;
  urine: string;
  pelvis: number;
  ureterFlow: number;
  drain: number;
  bladderFill: number;
  bladderGlow: number;
  arrows: number;
  arrowGrey: number;
  adh?: AdhSpec | null;
  breath?: number; // breathing bob amplitude (px)
  heart?: number; // ghost heart glow at the very top
  shock?: number; // frames since the shutdown (-1 = none)
  bgDrift?: number;
};

const Bokeh: React.FC<{id: string; abs: number}> = ({id, abs}) => {
  const items = Array.from({length: 8}, (_, i) => {
    const r = 70 + 90 * hash(i, 51);
    const y = ((((hash(i, 52) * 2600 - abs * (1.2 + 1.6 * hash(i, 53))) % 2600) + 2600) % 2600) - 340;
    const x = (i % 2 ? 980 : 100) + (hash(i, 54) - 0.5) * 260 + 30 * Math.sin(abs * 0.02 + i);
    return <circle key={i} cx={x} cy={y} r={r} fill={`url(#${id}-bok)`} opacity={0.5 + 0.5 * hash(i, 55)} />;
  });
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bok`}>
          <stop offset="0%" stopColor={C.bodyGhostLight} stopOpacity={0.16} />
          <stop offset="70%" stopColor={C.bodyGhostLight} stopOpacity={0.07} />
          <stop offset="100%" stopColor={C.bodyGhostLight} stopOpacity={0} />
        </radialGradient>
      </defs>
      {items}
    </g>
  );
};

export const KidneyRig: React.FC<{id: string; st: RigState; children?: React.ReactNode}> = ({id, st, children}) => {
  const {abs, cam} = st;
  const bob = Math.sin(abs * 0.075) * (st.breath ?? 5);
  const yTop = cam.cy - 1000 / cam.s - 80;
  const yBot = cam.cy + 1000 / cam.s + 80;

  // ---- ADH capsules (S06) ----
  const adhNodes: React.ReactNode[] = [];
  if (st.adh) {
    const spec = st.adh;
    for (let k = 0; k < spec.passN; k++) {
      const P = ADH_PASS[k % 2];
      const ts = spec.pass0 + k * spec.passStep;
      const dd = (abs - ts) * 26;
      if (dd < 0 || dd > P.len) continue;
      const [x, y, a] = pathAt(P, dd);
      if (y < yTop || y > yBot) continue;
      adhNodes.push(<ADH key={`p${k}`} x={x} y={y} r={15} rot={(a * 180) / Math.PI + 8 * Math.sin(abs * 0.2 + k)} glow={0.7} />);
    }
    for (const d of adhDocks(spec)) {
      const P = ADH_ROUTES[d.side][d.j];
      const travel = (P.len - 70) / ADH_V;
      const ts = d.td - travel - 10;
      const age = abs - ts;
      if (age < 0) continue;
      let dd: number;
      if (age < travel) dd = age * ADH_V;
      else dd = P.len - 70 + 70 * spring(age - travel, 0.3, 3.5);
      const [x, y, a] = pathAt(P, Math.min(dd, P.len + 6));
      const near = clamp((dd - (P.len - 140)) / 140);
      const yy = y + bob * near;
      if (yy < yTop) continue;
      const docked = abs >= d.td;
      const since = abs - d.td;
      const rot = (a * 180) / Math.PI + (docked ? 10 * Math.sin(abs * 0.07 + d.i) : 0);
      adhNodes.push(
        <g key={`d${d.i}`}>
          {docked && since < 16 && <Ring x={x} y={yy} r={10 + since * 3.4} color={C.adhLight} width={3} opacity={1 - since / 16} />}
          <ADH x={x} y={yy} r={docked ? 16 : 15} rot={rot} glow={docked ? 0.75 + 0.25 * Math.sin(abs * 0.25 + d.i) : 0.7} />
        </g>,
      );
    }
  }

  // ---- shutdown shock rings (S14) ----
  const shock = st.shock ?? -1;
  const shockNodes =
    shock >= 0 && shock < 26
      ? (['L', 'R'] as Side[]).map((s) => {
          const k = KID[s];
          return <Ring key={s} x={k.x} y={k.y + bob} r={90 + shock * 15} color={mixHex(C.saltDeep, C.toxinDeep, 0.3)} width={7} opacity={0.85 * (1 - shock / 26)} />;
        })
      : null;

  return (
    <AbsoluteFill style={{background: C.medBg}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <MedBg f={abs * (st.bgDrift ?? 1)} id={`${id}-bg`} seed={6} xray glow={[[540, 980, C.bodyGhost], [520, 1700, st.urine]]} />
        <g transform={camK(cam, 0.86)}>
          <Skeleton id={`${id}-sk`} f={abs} heart={st.heart ?? 0} dim={st.dull * 0.4} />
        </g>
        <g transform={camK(cam, 1)}>
          <Vessels
            id={`${id}-v`}
            abs={abs}
            flowT={st.flowT}
            sat={st.sat}
            crenate={st.crenate}
            thick={st.thick}
            water={st.water}
            veinWater={st.veinWater}
            haze={st.haze}
            tox={st.tox}
            cull={[yTop, yBot]}
          />
          <Urinary
            id={`${id}-u`}
            f={abs}
            uflowT={st.uflowT}
            urine={st.urine}
            flow={st.ureterFlow}
            drain={st.drain}
            fill={st.bladderFill}
            glow={st.bladderGlow}
            arrows={st.arrows}
            arrowGrey={st.arrowGrey}
          />
          {(['L', 'R'] as Side[]).map((s) => (
            <Kidney
              key={s}
              id={`${id}-k`}
              side={s}
              f={abs}
              bob={bob}
              glow={st.glow}
              glowColor={st.glowColor}
              dull={st.dull}
              act={st.act}
              flowT={st.actT}
              urine={st.urine}
              pelvis={st.pelvis}
              adh={st.adhTint ?? 0}
            />
          ))}
          {shockNodes}
          {adhNodes}
        </g>
        <g transform={camK(cam, 1.07)}>
          <GlassSkin id={`${id}-gs`} f={abs} dim={st.dull * 0.3} />
        </g>
        <g transform={camK(cam, 1.4)}>
          <Bokeh id={`${id}-bk`} abs={abs} />
        </g>
        {children}
        <rect width={1080} height={1920} fill={rgba(C.navyDeep, 0)} />
      </svg>
    </AbsoluteFill>
  );
};
