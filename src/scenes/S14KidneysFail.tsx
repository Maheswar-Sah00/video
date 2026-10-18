import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, handheld, mixHex, ramp} from '../lib/anim';
import {beatPulse, EV, pulseAt, wordAt} from '../lib/sync';
import {Label} from '../lib/Label';
import {wobble} from '../lib/MedKit';
import {KidneyRig, toScreen, type Cam, type RigState} from '../parts/kidney/Rig';
import {UrineChart} from '../parts/kidney/UrineChart';
import {integ, smoothKeys, urineAt} from '../parts/kidney/util';
import {kpt} from '../parts/kidney/geom';

/**
 * S14 KidneysFail (kidney builder) — "Day three. Your kidneys shut down. Poisons build up in your
 * blood." The SAME x-ray torso + kidneys as S06, now dull. Opens from the DAY 3 clock wipe; the
 * kidneys glow in weaker and weaker pulses, then on `shutdownPulse` (1465) filtering STOPS: a grey
 * shock ring, the glow dies, they turn grey-brown, the flow chevrons freeze, the ureters run dry,
 * the chart marker drops off the bottom -> "NO URINE". "Poisons" (1486) … "blood" (1515): olive
 * toxins pile up in the renal veins and the great vessels, clouding the blood. Ends tilting UP the
 * body toward the heart (slideDown into S15).
 */

const SHUT = EV.shutdown[0] ?? 1465;
const WEAK = [1428, 1440, 1451, 1459];
const WEAK_A = [0.5, 0.38, 0.27, 0.18];

export const camS14 = (abs: number): Cam => {
  const h = handheld(abs, 3.5, 0.03, 141);
  const jolt = wobble(abs - SHUT, 0.55, 7);
  const tilt = ease.inCubic(ramp(abs, 1516, 1542));
  return {
    cx:
      smoothKeys(abs, [
        [1410, 652],
        [1450, 640],
        [1482, 630],
        [1506, 560],
        [1542, 540],
      ]) + h.x,
    cy:
      smoothKeys(abs, [
        [1410, 1050],
        [1450, 1020],
        [1482, 990],
        [1506, 930],
        [1542, 900],
      ]) +
      h.y +
      9 * jolt -
      380 * tilt,
    s:
      smoothKeys(abs, [
        [1410, 1.15],
        [1450, 1.18],
        [1482, 1.2],
        [1506, 1.26],
        [1542, 1.22],
      ]) +
      0.02 * jolt,
    rot: smoothKeys(abs, [
      [1410, -0.6],
      [1465, 0.3],
      [1542, 1.0],
    ]) + h.r,
  };
};

export const S14KidneysFail: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const tKid = wordAt('n15', 'kidneys'); // 1450
  const tPoison = wordAt('n15', 'Poisons'); // 1486
  const tBlood = wordAt('n15', 'blood'); // 1515
  const cam = camS14(abs);

  const dead = ease.outCubic(ramp(abs, SHUT, SHUT + 14));
  let weak = 0;
  WEAK.forEach((e, i) => {
    weak = Math.max(weak, WEAK_A[i] * pulseAt([e], abs, 3, 11));
  });
  const flare = 0.45 * pulseAt([SHUT], abs, 2, 12);
  const preShut = 1 - ramp(abs, 1410, SHUT, ease.inQuad);
  // speeds: everything grinds to a halt on the shutdown
  const actSpeed = (t: number) => 0.6 * (1 - ramp(t, 1440, SHUT, ease.inQuad));
  const uSpeed = (t: number) => 0.55 * (1 - ramp(t, 1445, SHUT, ease.inQuad));
  const bSpeed = (t: number) => 0.62 - 0.18 * ramp(t, SHUT, SHUT + 30);
  const level = 3.85 + 0.55 * ramp(abs, 1456, SHUT, ease.inQuad);
  const urine = urineAt(level);
  const haze = ramp(abs, tPoison, tBlood + 18, ease.inOutSine);
  const heart = ramp(abs, 1514, 1536) * (0.45 + 0.55 * beatPulse(abs));

  const st: RigState = {
    abs,
    cam,
    flowT: 1300 + integ(bSpeed, 1400, abs),
    uflowT: integ(uSpeed, 1400, abs),
    actT: integ(actSpeed, 1400, abs),
    sat: 0.82,
    crenate: 0.4,
    thick: 0.65,
    water: 0.14,
    veinWater: 0,
    haze,
    tox: {start: tPoison - 1, dur: tBlood + 16 - tPoison, n: 54},
    glow: (0.18 + weak) * (1 - dead) + flare,
    glowColor: mixHex(C.kidney, C.saltDeep, 0.35 + 0.5 * dead),
    dull: 0.42 + 0.53 * dead,
    act: 0.55 * preShut * (1 - dead),
    adhTint: 0,
    urine: mixHex(urine, C.toxinDeep, 0.25 * dead),
    pelvis: 0.55 - 0.45 * ramp(abs, SHUT, SHUT + 24),
    ureterFlow: 0.45 * (1 - ramp(abs, 1446, SHUT)),
    drain: ease.inOutSine(ramp(abs, SHUT + 1, SHUT + 28)),
    bladderFill: 0.2 - 0.14 * ramp(abs, SHUT, SHUT + 30),
    bladderGlow: 0.3 * (1 - dead),
    arrows: 0.85 - 0.5 * ramp(abs, SHUT + 8, SHUT + 30),
    arrowGrey: ramp(abs, SHUT, SHUT + 6),
    adh: null,
    breath: 3,
    heart,
    shock: abs >= SHUT ? abs - SHUT : -1,
    bgDrift: 0.7,
  };

  // chart: already showing brown; the marker slips past the bottom and falls off on the shutdown
  const drop = ease.inQuad(ramp(abs, SHUT + 1, SHUT + 13));
  const stamp = abs >= SHUT + 9 ? abs - (SHUT + 9) : -1;
  const chartSlide = 1 - ease.inCubic(ramp(abs, 1496, 1508));

  const bob = Math.sin(abs * 0.075) * 3;
  const kl = kpt('L', -20, -60, bob);
  const klS = toScreen(cam, kl[0], kl[1]);
  const ivS = toScreen(cam, 484, 860);

  return (
    <KidneyRig id="s14" st={st}>
      <UrineChart f={abs} x={838} y={496} slide={chartSlide} level={Math.min(level, 4.4)} drop={drop} stamp={stamp} dim={ramp(abs, SHUT, SHUT + 10)} />
      <Label f={abs} from={tKid + 1} to={1502} ax={klS.x} ay={klS.y} x={120} y={560} text="KIDNEYS FAIL" size={38} color={C.cream} accent={mixHex(C.kidney, C.saltDeep, 0.5)} speed={0.9} />
      <Label
        f={abs}
        from={1500}
        to={1546}
        ax={ivS.x}
        ay={ivS.y}
        x={618}
        y={640}
        text="TOXINS BUILD UP"
        sub="urea + potassium"
        size={34}
        color={C.toxinLight}
        accent={C.toxin}
        speed={0.8}
      />
      {/* a faint olive cloud gathering over the vessels */}
      <rect width={1080} height={1920} fill={C.toxinDeep} opacity={clamp(0.07 * haze)} />
    </KidneyRig>
  );
};
