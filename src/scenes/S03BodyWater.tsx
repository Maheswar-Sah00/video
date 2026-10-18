import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, handheld, lerp, ramp, rgba} from '../lib/anim';
import {MedBg, camPt, camTf, wobble} from '../lib/MedKit';
import {Label} from '../lib/Label';
import {TITLE, MONO} from '../lib/fonts';
import {XrayBody, levelY} from '../parts/body/XrayBody';
import {FgMolecules, HoloFloor, MidMolecules, Ruler} from '../parts/body/kit';
import {BODY_S, BODY_X, BODY_Y, wp} from '../parts/body/stage';

/** S03 water level (abs frame): a puddle in the feet, rises to 60 % on "sixty percent water"
 *  (286–318) with overshoot + settle, trembles while it starts "leaking out" (344–364). */
export const s03Level = (abs: number) => {
  const rise = ease.inOutSine(clamp((abs - 284) / 34));
  return lerp(0.035, 0.6, rise) + 0.03 * wobble(abs - 312, 0.21, 9) - 0.004 * ramp(abs, 344, 372);
};

export const S03BodyWater: React.FC<SceneProps> = ({start, len}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const t = f / (len - 1);
  const hh = handheld(abs, 5, 0.03, 31);
  const cs = lerp(1.0, 1.075, ease.inOutSine(t));
  const focus: [number, number] = [540 + hh.x * 0.6, lerp(972, 922, ease.inOutSine(t)) + hh.y * 0.6];
  const rot = hh.r * 0.6;
  const cam = camTf(focus, [540, 960], cs, rot);
  const scr = (bx: number, by: number) => camPt(wp(bx, by), focus, [540, 960], cs, rot);

  const level = s03Level(abs);
  const rising = ramp(abs, 284, 300) * (1 - ramp(abs, 318, 345));
  const leak = ramp(abs, 342, 360);
  const slosh = 0.55 * rising + 0.5 * Math.abs(wobble(abs - 318, 0.2, 14)) + leak * (0.22 + 0.12 * Math.sin(abs * 0.9));
  const tilt = 0.035 * wobble(abs - 316, 0.17, 16) + 0.01 * Math.sin(f * 0.05);
  const reveal = ramp(abs, 248, 286, ease.inOutSine);
  const puffs = [350 - abs, 364 - abs].map((v) => -v);

  // read-out
  const surfS = scr(-300, levelY(level));
  const pct = Math.min(60, Math.round(level * 100));
  const numIn = ramp(abs, 279, 287, ease.outBack);
  const numPop = 1 + 0.18 * Math.max(0, wobble(abs - 318, 0.3, 8));
  const markOn = ramp(abs, 300, 316);
  const feetS = scr(0, 1182);
  const topS = scr(0, -422);
  const lbl = scr(40, 330);

  return (
    <AbsoluteFill style={{background: C.medBg}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <MedBg f={abs} id="s03bg" seed={3} glow={[[540, 1150, C.water], [540, 420, C.bodyGhost]]} drift={0.8} xray />
        <g transform={cam}>
          <MidMolecules f={abs} seed={4} n={9} opacity={0.4} region={[-60, 200, 1200, 1800]} />
          <HoloFloor f={abs} id="s03fl" cx={540} cy={1902} w={460} glow={0.6 + 0.4 * ramp(abs, 286, 320)} />
          <XrayBody
            f={abs}
            id="s03b"
            x={BODY_X}
            y={BODY_Y}
            scale={BODY_S}
            level={level}
            slosh={slosh}
            tilt={tilt}
            waterGlow={0.75 + 0.25 * Math.sin(f * 0.08)}
            mark={markOn}
            markLevel={0.6}
            reveal={reveal > 0 && reveal < 1 ? reveal : -1}
            organs={0.8 + 0.2 * ramp(abs, 250, 290)}
            seep={leak}
            puffs={puffs}
            pulse={Math.pow(Math.max(0, Math.sin(f * 0.27)), 6)}
          />
        </g>
        {/* measuring scale, feet = 0 %, head-top = 100 % */}
        <Ruler x={44} y0={feetS.y} y1={topS.y} f={abs} opacity={0.5 + 0.5 * ramp(abs, 262, 290)} hi={markOn} />
        <Ruler x={1036} y0={feetS.y} y1={topS.y} f={f + 40} opacity={0.35} side={-1} labels={false} />
        <line x1={44} y1={surfS.y} x2={surfS.x} y2={surfS.y} stroke={rgba(C.waterLight, 0.7 * numIn)} strokeWidth={2} strokeDasharray="6 8" />
        {numIn > 0 && (
          <g transform={`translate(70,${(surfS.y - 22).toFixed(1)}) scale(${(numIn * numPop).toFixed(3)})`}>
            <text x={0} y={0} fontFamily={TITLE} fontWeight={700} fontSize={112} fill={C.waterLight} stroke={C.navyDeep} strokeWidth={6} paintOrder="stroke">
              {pct}
              <tspan fontSize={64}>%</tspan>
            </text>
            <text x={4} y={40} fontFamily={MONO} fontWeight={600} fontSize={26} letterSpacing={3} fill={rgba(C.cream, 0.85)}>
              WATER
            </text>
          </g>
        )}
        <Label f={abs} from={300} to={356} ax={lbl.x} ay={lbl.y} x={690} y={lbl.y + 150} text="60% WATER" sub="≈ 42 litres" size={40} color={C.waterLight} />
        <FgMolecules f={abs} id="s03fg" seed={7} n={5} opacity={0.4} />
      </svg>
    </AbsoluteFill>
  );
};
