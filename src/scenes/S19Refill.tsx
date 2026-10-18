import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, handheld, lerp, ramp, rgba, rng} from '../lib/anim';
import {EV} from '../lib/sync';
import {MedBg, wobble} from '../lib/MedKit';
import {Label} from '../lib/Label';
import {BodyCell, WaterMolecule} from '../lib/Cells';
import {XrayBody, gulpLandDelay, levelY} from '../parts/body/XrayBody';
import {FgMolecules, MidMolecules} from '../parts/body/kit';
import {BODY_S, BODY_X, BODY_Y, CamKey, camAt, camRig} from '../parts/body/stage';

const L0 = 0.47;
const STEP = (0.6 - L0) / 5;
const LANDS = EV.gulps.map((g, i) => g + gulpLandDelay(levelY(L0 + STEP * i)));
/** body water level: each gulp lands (cascade hits the surface) and the level steps up with overshoot */
const levelAt = (abs: number) => {
  let l = L0;
  for (const t0 of LANDS) {
    const t = abs - t0;
    if (t >= 0) l += STEP * (1 - Math.exp(-t / 5) * Math.cos(t * 0.32));
  }
  return l;
};

const KEYS: CamKey[] = [
  {at: 1982, a: [0, 30], s: [540, 930], z: 1.46},
  {at: 2056, a: [0, 60], s: [548, 930], z: 1.38},
  {at: 2134, a: [0, 130], s: [540, 960], z: 1.2},
];

const LENS = {x: 300, y: 1330, r: 172};

/** magnified tissue inside the lens: shrivelled cells plump back up as water flows in */
const Lens: React.FC<{abs: number; pop: number; plump: number; glow: number}> = ({abs, pop, plump, glow}) => {
  const cells = useMemo(() => {
    const r = rng(1919);
    const pts = [
      [0, 0, 62], [-112, -62, 50], [104, -74, 52], [-96, 86, 54], [110, 80, 50], [6, -140, 44], [-10, 142, 46], [-160, 20, 40], [168, 4, 42],
    ];
    return pts.map(([x, y, rr], i) => ({x, y, r: rr, seed: 5 + i * 3, d: r() * 0.35, rot: r() * 360}));
  }, []);
  const mols = useMemo(() => {
    const r = rng(77);
    return Array.from({length: 12}, () => ({a: r() * Math.PI * 2, sp: 0.7 + r() * 0.6, ph: r(), tgt: Math.floor(r() * 9)}));
  }, []);
  const {x, y, r} = LENS;
  return (
    <g transform={`translate(${x},${y}) scale(${pop.toFixed(3)})`}>
      <defs>
        <clipPath id="s19lens">
          <circle r={r} />
        </clipPath>
        <radialGradient id="s19lensBg" cx="45%" cy="40%" r="70%">
          <stop offset="0%" stopColor={C.medBgLight} />
          <stop offset="100%" stopColor={C.navyDeep} />
        </radialGradient>
        <radialGradient id="s19mint">
          <stop offset="0%" stopColor={C.treat} stopOpacity={0.45} />
          <stop offset="100%" stopColor={C.treat} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle r={r + 26} fill={rgba(C.navyDeep, 0.55)} />
      <g clipPath="url(#s19lens)">
        <circle r={r} fill="url(#s19lensBg)" />
        <circle r={r} fill={rgba(C.water, 0.12 + 0.18 * plump)} />
        <circle r={r * 1.1} fill="url(#s19mint)" opacity={glow} />
        {cells.map((c, i) => {
          const w = lerp(0.3, 1, ease.inOutSine(clamp((plump - c.d) / 0.65)));
          return <BodyCell key={i} x={c.x + 3 * Math.sin(abs * 0.05 + i)} y={c.y + 3 * Math.cos(abs * 0.045 + i)} r={c.r} rot={c.rot + abs * 0.2} seed={c.seed} f={abs} water={w} />;
        })}
        {mols.map((m, i) => {
          const c = cells[m.tgt];
          const q = ((abs * 0.022 * m.sp + m.ph) % 1);
          const R = r * 1.05 * (1 - q);
          const mx = c.x * q + Math.cos(m.a) * R;
          const my = c.y * q + Math.sin(m.a) * R;
          return <WaterMolecule key={i} x={mx} y={my} r={10} rot={abs * 3 + i * 30} opacity={Math.sin(q * Math.PI) * clamp(plump * 4) * (plump < 0.98 ? 1 : 0.5)} glow={0.8} />;
        })}
        <ellipse cx={-r * 0.35} cy={-r * 0.5} rx={r * 0.5} ry={r * 0.22} fill={rgba('#fff', 0.1)} transform={`rotate(-30 ${-r * 0.35} ${-r * 0.5})`} />
      </g>
      <circle r={r} fill="none" stroke={rgba(C.treat, 0.3 + 0.5 * glow)} strokeWidth={16} />
      <circle r={r} fill="none" stroke={C.bodyGhostLight} strokeWidth={4} />
      <circle r={r + 12} fill="none" stroke={rgba(C.bodyGhostLight, 0.5)} strokeWidth={2} strokeDasharray="6 10" strokeDashoffset={(-abs * 0.6).toFixed(1)} />
    </g>
  );
};

export const S19Refill: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const hh = handheld(abs, 5, 0.03, 19);
  const cam = camAt(KEYS, abs, ease.inOutSine);
  const rig = camRig(cam, hh.x, hh.y, hh.r);
  const {scr} = rig;

  const level = levelAt(abs);
  const prog = clamp((level - L0) / (0.6 - L0));
  const gulps = EV.gulps.map((g) => abs - g);
  let kick = 0;
  for (const t0 of LANDS) kick += Math.abs(wobble(abs - t0, 0.3, 10));
  const glassFill = lerp(0.95, 0.12, ease.inOutSine(ramp(abs, 1990, 2068)));
  const glassTip = ramp(abs, 1985, 2075, ease.inOutSine);
  const lensPop = ease.outBack(ramp(abs, 2052, 2064));
  const lensOut = 1 - ramp(abs, 2122, 2134);
  const plump = ramp(abs, 2064, 2110);
  const recover = clamp(0.2 * prog + 0.7 * ramp(abs, 2062, 2104, ease.inOutSine));
  const flash = 1 - ramp(f, 3, 15, ease.outQuad);
  const anchor = scr(-118, 560);
  const lensEdge = {x: LENS.x + LENS.r * 0.62 * lensPop, y: LENS.y - LENS.r * 0.78 * lensPop};

  return (
    <AbsoluteFill style={{background: C.medBg}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <MedBg f={abs} id="s19bg" seed={9} glow={[[540, 1300, C.water], [540, 600, C.treat]]} drift={0.9} xray />
        <g transform={rig.tf}>
          <MidMolecules f={abs} seed={12} n={10} opacity={0.45} region={[-80, 150, 1240, 1800]} />
          <XrayBody
            f={abs}
            id="s19b"
            x={BODY_X}
            y={BODY_Y}
            scale={BODY_S}
            pose="drink"
            headBack={0.85 + 0.08 * Math.sin(f * 0.06)}
            glassFill={glassFill}
            glassTip={glassTip}
            gulps={gulps}
            level={level}
            slosh={0.25 + 0.6 * kick}
            tilt={0.02 * Math.sin(f * 0.06)}
            waterGlow={0.75 + 0.25 * prog}
            organs={0.62 + 0.45 * prog}
            mark={0.5 * ramp(abs, 2040, 2070)}
            markLevel={0.6}
            recover={recover}
            bladder={0.45}
            pulse={Math.pow(Math.max(0, Math.sin(f * 0.27)), 6)}
            seep={0.15}
          />
        </g>
        {/* lens inset */}
        {lensPop > 0.01 && (
          <g opacity={lensOut}>
            <line x1={anchor.x} y1={anchor.y} x2={lensEdge.x} y2={lensEdge.y} stroke={C.bodyGhostLight} strokeWidth={3} opacity={clamp(lensPop)} />
            <circle cx={anchor.x} cy={anchor.y} r={16} fill="none" stroke={C.bodyGhostLight} strokeWidth={3} opacity={clamp(lensPop)} />
            <Lens abs={abs} pop={lensPop} plump={plump} glow={recover} />
          </g>
        )}
        <Label f={abs} from={2004} to={2054} x={1000} y={560} align="right" text="≈ 2.5 L A DAY" sub="lost — and replaced" size={46} color={C.waterLight} />
        <Label f={abs} from={2090} to={2132} x={130} y={1112} text="REFILLED" sub="cells plump up" size={46} color={C.treat} />
        <FgMolecules f={abs} id="s19fg" seed={21} n={5} opacity={0.4} speed={1.2} />
        {/* the flash landing */}
        {flash > 0 && <rect width={1080} height={1920} fill={rgba('#e8fbff', 0.85 * flash)} />}
      </svg>
    </AbsoluteFill>
  );
};
