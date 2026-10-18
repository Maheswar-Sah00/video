import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {ease, handheld, mixHex, ramp} from '../lib/anim';
import {wordAt} from '../lib/sync';
import {Label} from '../lib/Label';
import {KidneyRig, toScreen, dockPos, type AdhSpec, type Cam, type RigState} from '../parts/kidney/Rig';
import {NephronLens} from '../parts/kidney/Lens';
import {UrineChart} from '../parts/kidney/UrineChart';
import {integ, smoothKeys, urineAt} from '../parts/kidney/util';
import {kpt, pyrMid, BLADDER} from '../parts/kidney/geom';

/**
 * S06 Kidneys (kidney builder) — "Your kidneys start hoarding every drop. Your pee turns dark."
 * Opens from S05's slideUp (camera still tilting DOWN the body, violet ADH capsules streaming down
 * the aorta from the brain) -> ADH docks on both kidneys on "kidneys" (641) -> push into his right
 * kidney, a magnifier on a collecting duct: gates open and water is pulled BACK into the blood
 * ("hoarding" 660, "every drop" 675) -> pull back, the urine chart slides in and its marker slides
 * pale straw -> dark amber ("dark" 719), the bladder glows amber -> clock wipe at 744.
 */

const ADH_SPEC: AdhSpec = {dock0: 641, dockStep: 1.7, pass0: 604, passStep: 9, passN: 15};

export const camS06 = (abs: number): Cam => {
  const h = handheld(abs, 3, 0.03, 61);
  return {
    cx: smoothKeys(abs, [
      [626, 540],
      [652, 530],
      [678, 461],
      [696, 474],
      [718, 636],
      [752, 646],
    ]) + h.x,
    cy: smoothKeys(abs, [
      [626, 700],
      [652, 940],
      [678, 1037],
      [696, 1032],
      [718, 1012],
      [752, 1030],
    ]) + h.y,
    s: smoothKeys(abs, [
      [626, 1.08],
      [652, 1.18],
      [678, 1.3],
      [696, 1.34],
      [718, 1.15],
      [752, 1.18],
    ]),
    rot: smoothKeys(abs, [
      [626, 0.8],
      [660, 0],
      [724, 0],
      [752, -0.9],
    ]) + h.r,
  };
};

export const urineLevelS06 = (abs: number) =>
  smoothKeys(abs, [
    [626, 0.15],
    [708, 0.15],
    [719, 2.7],
    [727, 3.18],
    [736, 2.96],
    [752, 3.0],
  ]);

export const S06Kidneys: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const tKid = wordAt('n07', 'kidneys'); // 641
  const tHoard = wordAt('n07', 'hoarding'); // 660
  const tDark = wordAt('n07', 'dark'); // 719
  const cam = camS06(abs);
  const level = urineLevelS06(abs);
  const urine = urineAt(level);
  const hoard = ramp(abs, tHoard - 2, tHoard + 26, ease.inOutSine);
  const adhPulse = ramp(abs, tKid - 2, tKid + 10) * (1 - 0.7 * ramp(abs, tKid + 14, tKid + 50));
  const uSpeed = (t: number) => 1 - 0.5 * ramp(t, tHoard, tHoard + 30);
  const darkGlow = ramp(abs, tDark - 12, tDark + 10, ease.inOutSine);

  const st: RigState = {
    abs,
    cam,
    flowT: abs,
    uflowT: integ(uSpeed, 600, abs),
    actT: abs,
    sat: 1,
    thick: 0.15,
    water: 0.75,
    veinWater: hoard,
    glow: 0.5 + 0.35 * adhPulse + 0.2 * hoard,
    glowColor: mixHex(C.kidney, C.water, 0.4 * hoard),
    dull: 0,
    act: 1,
    adhTint: adhPulse,
    urine,
    pelvis: 0.75,
    ureterFlow: 1 - 0.5 * hoard,
    drain: 0,
    bladderFill: 0.55 + 0.04 * Math.sin(abs * 0.04),
    bladderGlow: 0.35 + 0.65 * darkGlow,
    arrows: 0.9,
    arrowGrey: 0,
    adh: ADH_SPEC,
    breath: 5,
  };

  // lens: source = the pyramid on his right kidney where the first capsule docked
  const bob = Math.sin(abs * 0.075) * 5;
  const pm = pyrMid(1);
  const srcW = kpt('L', pm[0], pm[1], bob);
  const src = toScreen(cam, srcW[0], srcW[1]);
  const lensOpen = ease.outBack(ramp(abs, 653, 668)) * (1 - ease.inCubic(ramp(abs, 693, 705)));
  const conc = ramp(abs, tHoard + 2, tHoard + 40, ease.inOutSine);

  // label anchors
  const dk = dockPos('L', 0, bob);
  const dkS = toScreen(cam, dk[0], dk[1]);
  const blS = toScreen(cam, BLADDER.x, BLADDER.y - 70);

  const chartSlide = ease.outBack(ramp(abs, 703, 717));

  return (
    <KidneyRig id="s06" st={st}>
      <NephronLens id="s06-lens" abs={abs} cx={706} cy={1146} open={lensOpen} sx={src.x} sy={src.y} tGate={tHoard} tAdh={tHoard - 9} conc={conc} />
      <UrineChart f={abs} x={838} y={496} slide={chartSlide} level={level} />
      <Label f={abs} from={tKid} to={692} ax={dkS.x} ay={dkS.y} x={150} y={560} text="ADH" sub="save water!" size={46} color={C.adhLight} accent={C.adh} />
      <Label f={abs} from={tHoard + 4} to={699} x={706} y={1492} align="center" text="WATER PULLED BACK" sub="into the blood" size={34} color={C.waterLight} speed={0.7} />
      <Label f={abs} from={tDark} to={760} ax={blS.x} ay={blS.y} x={382} y={1478} align="right" text="DARK URINE" size={38} color={C.urine1} accent={C.urine3} speed={0.7} />
    </KidneyRig>
  );
};
