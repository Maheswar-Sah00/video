import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, handheld, lerp, ramp, wander} from '../lib/anim';
import {dryAt, EV, recent, throbPulse, beatPulse} from '../lib/sync';
import {Label} from '../lib/Label';
import {BoilDefs} from '../lib/Boil';
import {HeroHead, heroHeadPoints, autoBlink} from '../characters/HeroHead';
import type {HeroHeadProps} from '../characters/HeroHead';
import {HeroHand, heroHandPoints} from '../characters/HeroHand';
import type {HeroHandProps} from '../characters/HeroHand';
import {Glow, layerPt, layerTf, n1} from '../parts/day/kit';
import {DeskChair, DeskClutter, DeskDust, DeskLamp, DeskSun, DeskTop, DeskWall, FgPlant, Laptop, scrPt} from '../parts/day/DeskSet';

/**
 * S07 DayOne (owner: day) — abs 735–884. Day-one morning at his desk by the window ('day').
 * Dry mouth + swallow (773–800, tag DRY MOUTH) · headache throbs on throbPulse 815 829 843, hand
 * pressed to the temple · "can't think straight" 844–875: laptop text blurs/doubles, eyes unfocus,
 * Label CAN'T FOCUS · ends pushing onto his NECK at (560,1000) for the zoomIn into a blood vessel.
 */
export const S07DayOne: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const dry = dryAt(abs);

  // ---------------------------------------------------------------- beats
  const throb = throbPulse(abs);
  const bob = ramp(abs, 777, 783, ease.outQuad) * (1 - ramp(abs, 784, 793, ease.inOutSine)); // swallow
  const lick = ramp(abs, 789, 794) * (1 - ramp(abs, 799, 805));
  const handIn = ramp(abs, 798, 812, ease.outBack);
  const handOut = ramp(abs, 847, 861, ease.inCubic);
  const handUp = handIn * (1 - handOut);
  const pain = clamp(ramp(abs, 805, 815, ease.outQuad) * (0.5 + 0.5 * throb)) * (1 - ramp(abs, 846, 858));
  const fog = ramp(abs, 845, 860, ease.inOutSine) * (1 - ramp(abs, 878, 886));
  const push = ramp(abs, 854, 884, ease.inOutCubic);

  // ---------------------------------------------------------------- him
  const swayT = abs * 0.03;
  const head: HeroHeadProps = {
    f: abs,
    id: 's07h',
    x: 600 + wander(swayT, 3) * 6 - 10 * pain,
    y: 800 + wander(swayT, 5) * 4 + 6 * bob + 4 * throb,
    scale: 0.82,
    rot: -1.5 + 2.2 * throb - 3 * pain + wander(abs * 0.02, 9) * 1.2 + fog * Math.sin(abs * 0.07) * 1.8,
    turn: -0.36 + wander(swayT, 7) * 0.03 + 0.06 * pain + fog * (0.1 + 0.05 * Math.sin(abs * 0.05)),
    tilt: -0.2 - 0.1 * bob - 0.08 * pain + 0.12 * fog,
    expression: 'tired',
    blendTo: 'pain',
    blend: pain,
    mouthOpen: 0.13 * lick,
    swallow: ramp(abs, 776, 794),
    blink: Math.max(autoBlink(abs, 41), ramp(abs, 862, 866) * (1 - ramp(abs, 868, 874))),
    eyeOpen: lerp(1, 0.6, fog),
    look: [lerp(-0.4, 0.08 + 0.18 * Math.sin(abs * 0.09), fog), lerp(0.32, 0.02, fog)],
    dry,
    outfit: 'hoodie',
    shoulders: true,
    chestTo: 760,
    hairFlow: 0.3,
    hairDir: [-0.5 * throb, 0.3 * throb],
    lighting: 'day',
    rim: 0.8,
  };
  const P = heroHeadPoints(head);

  // ---------------------------------------------------------------- camera
  const hh = handheld(abs, 5, 0.022, 7);
  const shake = throb * 3.5;
  const drift: [number, number] = [hh.x + shake * Math.sin(abs * 2.1), hh.y + shake * Math.cos(abs * 1.7)];
  const s0 = lerp(1.0, 1.085, ramp(abs, 735, 858, ease.inOutSine));
  const F: [number, number] = [lerp(575, P.throat.x, push), lerp(950, P.throat.y, push)];
  const T: [number, number] = [lerp(540, 560, push), lerp(960, 1000, push)];
  const s = lerp(s0, 1.34, push);
  const dk = (k: number): [number, number] => [drift[0] * (1 - push), drift[1] * (1 - push)].map((v) => v * k) as [number, number];
  const tf = (k: number) => layerTf(F, T, s, k, dk(1));

  // hand at the temple: his LEFT hand (camera side = screen-right, he faces screen-left), back of the
  // hand toward us, index + middle fingertips pressed to the temple ('temple' pose), up from the lower right
  const hRot = lerp(-52, -24, handIn) + 3 * throb;
  const handBase: HeroHandProps = {
    f: abs,
    id: 's07lh',
    x: 0,
    y: 0,
    scale: 1.1,
    rot: hRot,
    mirror: true,
    pose: 'relaxed',
    poseTo: 'temple',
    poseMix: clamp(handIn * 1.1) * (1 - handOut),
    palm: false,
    sleeve: 'hoodie',
    armLen: 760,
    dry,
    lighting: 'day',
  };
  const tip0 = heroHandPoints(handBase).tip;
  const press = 5 * throb;
  const wT = {x: P.temple.x - tip0.x + press, y: P.temple.y - tip0.y + press * 0.4};
  const wS = {x: wT.x + 190, y: 1700};
  const hand: HeroHandProps = {...handBase, x: lerp(wS.x, wT.x, handUp), y: lerp(wS.y, wT.y, handUp)};

  // screen-space anchors for labels
  const sp = (p: {x: number; y: number}, k = 1) => layerPt(p, F, T, s, k, dk(1));
  const mouthS = sp(P.mouth);
  const screenS = sp(scrPt(0.45, 0.42), 1.12);

  const throbs = recent(EV.throbs, abs, 16);
  const neckBeat = beatPulse(abs) * ramp(abs, 862, 874);

  return (
    <AbsoluteFill style={{background: C.kitchenWall}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <defs>
          <BoilDefs id="s07boil" f={abs} scale={2.2} />
        </defs>
        {/* wall, window, shelves (far) */}
        <g transform={tf(0.55)}>
          <DeskWall id="s07w" f={abs} />
        </g>
        <g transform={tf(0.6)}>
          <DeskSun id="s07sun" f={abs} />
        </g>
        <g transform={tf(0.8)}>
          <DeskChair id="s07c" f={abs} />
        </g>
        {/* him */}
        <g transform={tf(1)}>
          <HeroHead {...head} />
          {/* the big neck artery, faintly pulsing as we dive in */}
          {push > 0.2 && (
            <g opacity={push * 0.8}>
              <Glow id="s07neck" x={P.throat.x + 6} y={P.throat.y - 4} r={60 + 26 * neckBeat} rx={40 + 14 * neckBeat} ry={88 + 26 * neckBeat} color={C.bloodLight} a={0.18 + 0.4 * neckBeat} />
            </g>
          )}
          {handUp > 0.01 && (
            <g filter="url(#s07boil)">
              <HeroHand {...hand} />
            </g>
          )}
          {/* the headache throbs at his temple */}
          {pain > 0.01 && (
            <g style={{mixBlendMode: 'screen'}}>
              <Glow id="s07thr" x={P.temple.x} y={P.temple.y} r={70 + 70 * throb} color={C.pain} a={(0.25 + 0.75 * throb) * pain} />
            </g>
          )}
          {throbs.map(({i, age}) => (
            <g key={i} opacity={(1 - age / 16) * 0.9}>
              <circle cx={P.temple.x} cy={P.temple.y} r={34 + age * 8} fill="none" stroke={C.heat} strokeWidth={7 - age * 0.35} />
              <circle cx={P.temple.x} cy={P.temple.y} r={20 + age * 12} fill="none" stroke={C.painLight} strokeWidth={3} opacity={0.6} />
            </g>
          ))}
        </g>
        {/* dust motes drifting in front of him */}
        <g transform={tf(0.9)}>
          <DeskDust f={abs} />
        </g>
        {/* desk (near) */}
        <g transform={tf(1.12)}>
          <DeskTop id="s07d" f={abs} />
          <DeskClutter id="s07dc" f={abs} />
          <Laptop id="s07lap" f={abs} blur={fog} dbl={fog} scroll={ramp(abs, 735, 884) * 40} />
          <HeroHand
            f={abs}
            id="s07rh"
            x={930}
            y={1640 + Math.sin(abs * 0.05) * 2}
            scale={1.12}
            rot={-70}
            pose="relaxed"
            palm={false}
            sleeve="hoodie"
            fidget={0.6}
            dry={dry}
            lighting="day"
          />
          <DeskLamp id="s07lamp" f={abs} />
        </g>
        <g transform={tf(1.3)}>
          <FgPlant id="s07fp" f={abs} />
        </g>
        {/* the throbs tint the frame a touch */}
        <rect width={1080} height={1920} fill={C.pain} opacity={0.06 * throb * pain} />
        {/* labels (screen space) */}
        <Label f={abs} from={775} to={806} ax={mouthS.x} ay={mouthS.y} x={70} y={850} text="DRY MOUTH" size={34} accent={C.lipDry} />
        <Label f={abs} from={840} to={876} ax={screenS.x} ay={screenS.y} x={70} y={930} text="CAN'T FOCUS" size={38} speed={0.8} accent={C.alarm} />
      </svg>
    </AbsoluteFill>
  );
};
