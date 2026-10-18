import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, handheld, lerp, ramp} from '../lib/anim';
import {MedBg, wobble} from '../lib/MedKit';
import {Label} from '../lib/Label';
import {XrayBody} from '../parts/body/XrayBody';
import {FgMolecules, HoloFloor, MidMolecules, Ruler, Tag} from '../parts/body/kit';
import {BODY_S, BODY_X, BODY_Y, CamKey, camAt, camRig} from '../parts/body/stage';

// camera: S03's end framing → the mouth (breath 384) → head + arm (sweat 411–421) → the bladder
// (bathroom 466) → whoosh up to his HEAD at (540,640) for the zoomIn into the brain (S05).
const KEYS: CamKey[] = [
  {at: 361, a: [0, 157], s: [540, 960], z: 1.075},
  {at: 381, a: [0, -212], s: [540, 820], z: 1.72},
  {at: 400, a: [0, -212], s: [532, 808], z: 1.78},
  {at: 416, a: [70, -60], s: [540, 900], z: 1.55},
  {at: 440, a: [70, -50], s: [548, 905], z: 1.6},
  {at: 458, a: [0, 388], s: [540, 1060], z: 1.5},
  {at: 470, a: [0, 388], s: [540, 1040], z: 1.55},
  {at: 484, a: [0, -330], s: [540, 640], z: 1.6},
  {at: 498, a: [0, -330], s: [540, 640], z: 1.7},
];

export const S04Leaking: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const hh = handheld(abs, 5, 0.03, 31);
  const cam = camAt(KEYS, abs);
  const settle = abs > 484 ? 0.3 : 1;
  const rig = camRig(cam, hh.x * settle, hh.y * settle, hh.r * settle);
  const {scr} = rig;

  // water drops a hair with each exit
  const level = 0.596 - 0.004 * ramp(abs, 384, 400) - 0.004 * ramp(abs, 421, 440) - 0.008 * ramp(abs, 466, 490, ease.inOutSine);
  const camMove = Math.abs(camAt(KEYS, abs + 1).a[1] - cam.a[1]);
  const slosh = 0.18 + 0.5 * clamp(camMove / 20) + 0.3 * Math.abs(wobble(abs - 466, 0.25, 12));
  const tilt = 0.02 * Math.sin(f * 0.07) + 0.03 * wobble(abs - 470, 0.2, 10);
  const puffs = [384, 428, 472].map((e) => abs - e);
  const sweat = ramp(abs, 398, 420, ease.inOutSine) * (1 - ramp(abs, 458, 474, ease.inOutSine));
  const sweatRoll = abs >= 421 ? abs - 421 : -1;
  const bladder = lerp(0.85, 0.3, ramp(abs, 466, 494, ease.inOutSine));
  const bladderGlow = ramp(abs, 448, 464, ease.inOutSine) * (1 - ramp(abs, 486, 498));
  const drips = [466, 473, 480, 488].map((e) => abs - e);

  const mouth = scr(0, -212);
  const puffPt = scr(64, -250);
  const beadPt = scr(250, 140);
  const browPt = scr(52, -366);
  const blPt = scr(0, 380);
  const feetS = scr(0, 1182);
  const topS = scr(0, -422);

  return (
    <AbsoluteFill style={{background: C.medBg}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <MedBg f={abs} id="s04bg" seed={3} glow={[[540, 1150, C.water], [540, 420, C.bodyGhost]]} drift={0.8} xray />
        <g transform={rig.tf}>
          <MidMolecules f={abs} seed={4} n={9} opacity={0.4} region={[-60, 200, 1200, 1800]} />
          <HoloFloor f={abs} id="s04fl" cx={540} cy={1902} w={460} />
          <XrayBody
            f={abs}
            id="s04b"
            x={BODY_X}
            y={BODY_Y}
            scale={BODY_S}
            level={level}
            slosh={slosh}
            tilt={tilt}
            waterGlow={0.8 + 0.2 * Math.sin(f * 0.08)}
            mark={0.7 * (1 - ramp(abs, 361, 380))}
            puffs={puffs}
            sweat={sweat}
            sweatRoll={sweatRoll}
            seep={0.35}
            bladder={bladder}
            bladderGlow={bladderGlow}
            drips={drips}
            pulse={Math.pow(Math.max(0, Math.sin(f * 0.27)), 6)}
          />
        </g>
        <Ruler x={44} y0={feetS.y} y1={topS.y} f={abs} opacity={0.6 * (1 - ramp(abs, 470, 484))} hi={1} />
        {/* one tag system: the three exits, then the daily total */}
        <Tag f={abs} from={384} to={412} ax={puffPt.x} ay={puffPt.y} x={700} y={mouth.y - 40} text="BREATH" sub="≈ 0.4 L / day" />
        <Tag f={abs} from={419} to={452} ax={beadPt.x} ay={beadPt.y} x={600} y={beadPt.y + 150} text="SWEAT" sub="≈ 0.5 L / day" />
        <Tag f={abs} from={464} to={484} ax={blPt.x} ay={blPt.y} x={650} y={blPt.y - 210} text="URINE" sub="≈ 1.5 L / day" color={C.urine1} />
        <Label f={abs} from={468} to={492} x={540} y={1360} text="−2.5 L A DAY" align="center" size={62} color={C.waterLight} speed={0.9} />
        {/* sweat on the brow gets a tiny glint ring when it forms */}
        {abs >= 405 && abs < 425 && <circle cx={browPt.x} cy={browPt.y} r={10 + (abs - 405) * 2.4} fill="none" stroke={C.waterLight} strokeWidth={2} opacity={1 - (abs - 405) / 20} />}
        <FgMolecules f={abs} id="s04fg" seed={7} n={5} opacity={0.4} speed={1.4} />
      </svg>
    </AbsoluteFill>
  );
};
