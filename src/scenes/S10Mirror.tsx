import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, handheld, keys, lerp, mixHex, ramp, wander} from '../lib/anim';
import {dryAt} from '../lib/sync';
import {Label} from '../lib/Label';
import {BoilDefs} from '../lib/Boil';
import {HeroHead, heroHeadPoints} from '../characters/HeroHead';
import type {HeroHeadProps} from '../characters/HeroHead';
import {HeroHand, heroHandPoints} from '../characters/HeroHand';
import type {HeroHandProps} from '../characters/HeroHand';
import {Motes, layerPt, layerTf, n1} from '../parts/day/kit';
import {BathWall, MIR, MirrorFrame, MirrorGlass, MirrorShadow, ReflectedRoom, Sink, SkinTent} from '../parts/day/BathSet';

/**
 * S10 Mirror (owner: day) — abs 1087–1185. Bathroom ('bath'): his REFLECTION face-on in the mirror.
 * "Your skin@1103 loses its bounce@1126": in the foreground his right hand pinches the skin on the
 * back of his left hand, lets go — the fold stays tented and sinks back slowly (Label NO BOUNCE) ·
 * "Your eyes@1154 sink@1161": push in to the reflection (sunken eyes, cracked lips) · ends: he
 * turns away (whip).
 */
export const S10Mirror: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const dry = dryAt(abs);

  // ------------------------------------------------------------- beats
  const inL = ramp(abs, 1087, 1101, ease.outBack);
  const inR = ramp(abs, 1092, 1105, ease.outBack);
  const close = ramp(abs, 1103, 1109, ease.outQuad) * (1 - ramp(abs, 1119, 1123, ease.outQuad));
  const lift = ramp(abs, 1109, 1118, ease.inOutSine) * (1 - ramp(abs, 1119, 1124, ease.outQuad));
  const away = ramp(abs, 1120, 1133, ease.outBack);
  const tent = keys(abs, [[1106, 0], [1110, 0.2], [1118, 1], [1121, 0.97], [1136, 0.9], [1164, 0.1], [1174, 0]]);
  const out = ramp(abs, 1145, 1162, ease.inCubic);
  const lookUp = ramp(abs, 1144, 1156, ease.outBack);
  const push = ramp(abs, 1147, 1178, ease.inOutCubic);
  const turnAway = ramp(abs, 1171, 1186, ease.inOutCubic);
  const whip = ramp(abs, 1177, 1186, ease.inQuad);

  // ------------------------------------------------------------- camera
  const hh = handheld(abs, 5, 0.025, 13);
  const drift: [number, number] = [hh.x - 120 * whip, hh.y];
  const s0 = lerp(1.0, 1.045, ramp(abs, 1087, 1150, ease.inOutSine));
  const s = lerp(s0, 1.62, push);
  const F: [number, number] = [540, lerp(960, 832, push)];
  const T: [number, number] = [540, lerp(960, 880, push)];
  const tf = (k: number) => layerTf(F, T, s, k, drift);
  const sp = (p: {x: number; y: number}, k: number) => layerPt(p, F, T, s, k, drift);
  const KM = 0.82; // mirror plane

  // ------------------------------------------------------------- the reflection
  const head: HeroHeadProps = {
    f: abs,
    id: 's10h',
    x: 540 + wander(abs * 0.03, 4) * 5 - 30 * turnAway,
    y: 836 + wander(abs * 0.025, 6) * 4 + (1 - lookUp) * 10,
    scale: 0.98,
    rot: wander(abs * 0.02, 8) * 1.2 - 3 * turnAway,
    turn: lerp(0.04, -0.82, turnAway),
    bodyTurn: lerp(0.0, -0.32, turnAway),
    tilt: lerp(-0.34, 0.02, lookUp),
    look: [lerp(0.05, 0, lookUp) - 0.4 * turnAway, lerp(0.75, 0.0, lookUp)],
    expression: 'tired',
    blendTo: 'worried',
    blend: 0.75 * ramp(abs, 1152, 1166, ease.inOutSine),
    eyeOpen: 0.85,
    dry,
    outfit: 'tee',
    shoulders: true,
    hairFlow: 0.25,
    hairDir: [0.9 * Math.sin(Math.PI * turnAway) + 0.5 * turnAway, 0],
    lighting: 'bath',
    rim: 0.6,
  };
  const P = heroHeadPoints(head);
  const refl = `translate(${n1(-drift[0] * 0.18)},${n1(-drift[1] * 0.18)})`;

  // ------------------------------------------------------------- the hands (foreground)
  // both hands low in front of the sink, forearms entering from the left edge / bottom-right corner:
  // his LEFT hand back-up (the hero's `tent` fold), his RIGHT hand in the side-view 'pinch'
  const wristL = {x: 150 + wander(abs * 0.03, 21) * 4 - (1 - inL) * 260 - out * 120, y: 1505 + (1 - inL) * 260 + out * 560 + Math.sin(abs * 0.06) * 2};
  const LH: HeroHandProps = {
    f: abs,
    id: 's10lh',
    x: wristL.x,
    y: wristL.y,
    scale: 1.75,
    rot: 74 + wander(abs * 0.02, 22) * 1.5 - 4 * lift,
    mirror: true,
    pose: 'open',
    poseTo: 'relaxed',
    poseMix: 0.4,
    palm: false,
    sleeve: 'tee',
    armLen: 470,
    fidget: 0.12,
    tent,
    dry,
    lighting: 'bath',
  };
  const LP = heroHandPoints(LH);
  const pr = -50 + 10 * away - 4 * lift;
  const prs = 1.7;
  const ga = (pr * Math.PI) / 180;
  const pOff = {x: 214 * Math.sin(ga) * prs, y: -214 * Math.cos(ga) * prs}; // wrist -> pinch point
  const approach = 1 - close;
  const target = {x: LP.tent.x + 4, y: LP.tent.y - 16 * tent};
  const wristR = {
    x: target.x - pOff.x + 60 * approach * (1 - away) + 240 * away + (1 - inR) * 300 + out * 260,
    y: target.y - pOff.y + 50 * approach * (1 - away) + 330 * away + (1 - inR) * 420 + out * 520,
  };
  const RH: HeroHandProps = {
    f: abs,
    id: 's10rh',
    x: wristR.x,
    y: wristR.y,
    scale: prs,
    rot: pr,
    pose: 'relaxed',
    poseTo: 'pinch',
    poseMix: clamp(0.25 + 0.75 * close),
    palm: false,
    sleeve: 'tee',
    armLen: 470,
    fidget: 0.1,
    dry,
    lighting: 'bath',
  };
  const tentS = sp({x: LP.tent.x, y: LP.tent.y - 40 * tent}, 1.3);
  // the readable fold (a pale ridge + shadow) laid along the back of the hand
  const skinC = mixHex(mixHex(C.skin, C.skinDry, clamp(dry * 1.1)), C.bathLight, 0.12);
  const shadeC = mixHex(mixHex(C.skinShade, C.skinDry, dry * 0.4), C.bathTileShade, 0.2);
  const lightC = mixHex(skinC, '#ffffff', 0.6);
  const eyeS = sp(P.eyeR, KM);

  return (
    <AbsoluteFill style={{background: C.bathTile}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <defs>
          <BoilDefs id="s10boil" f={abs} scale={2.2} />
          <clipPath id="s10mir">
            <rect x={MIR.x} y={MIR.y} width={MIR.w} height={MIR.h} rx={MIR.r} />
          </clipPath>
        </defs>
        <g transform={tf(KM)}>
          <BathWall id="s10w" f={abs} />
          <MirrorShadow />
          <g clipPath="url(#s10mir)">
            <g transform={refl}>
              <ReflectedRoom id="s10r" f={abs} />
              <HeroHead {...head} />
            </g>
            <MirrorGlass id="s10g" f={abs} slide={-drift[0] * 0.6 - push * 120} />
          </g>
          <MirrorFrame id="s10mf" f={abs} />
          <Motes f={abs} seed={77} n={34} x={120} y={260} w={840} h={1100} r={[1.2, 3]} vx={0.1} vy={-0.3} color={C.bathLight} opacity={0.7} />
        </g>
        <g transform={tf(1)}>
          <Sink id="s10s" f={abs} />
        </g>
        {/* foreground hands: the skin-turgor pinch test */}
        {out < 0.999 && (
          <g transform={tf(1.3)} filter="url(#s10boil)">
            <HeroHand {...LH} />
            <g transform={`translate(${n1(LP.tent.x)},${n1(LP.tent.y)}) rotate(${n1((LH.rot ?? 0) - 90)}) scale(1.25)`}>
              <SkinTent x={0} y={0} h={tent} skin={skinC} shade={shadeC} light={lightC} />
            </g>
            {inR > 0 && away < 0.999 && <HeroHand {...RH} />}
          </g>
        )}
        <Label f={abs} from={1117} to={1156} ax={tentS.x} ay={tentS.y} x={560} y={1230} text="NO BOUNCE" size={40} speed={0.8} accent={C.skinDry} sub="skin stays tented" />
        <Label f={abs} from={1153} to={1181} ax={eyeS.x} ay={eyeS.y} x={1000} y={1090} align="right" text="SUNKEN EYES" size={34} speed={0.8} accent={C.eyeSunk} />
      </svg>
    </AbsoluteFill>
  );
};
