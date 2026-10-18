import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {ease, handheld, lerp, ramp, wander} from '../lib/anim';
import {dryAt} from '../lib/sync';
import {Label} from '../lib/Label';
import {BoilDefs} from '../lib/Boil';
import {Hero, heroPoints} from '../characters/Hero';
import type {HeroProps} from '../characters/Hero';
import {Glow, layerPt, layerTf, n1} from '../parts/day/kit';
import {HeatShimmer, NoSweatInset, StreetFacades, StreetFar, StreetGround, StreetSky, StreetWires, Thermo} from '../parts/day/StreetSet';

/**
 * S11 Overheat (owner: day) — abs 1174–1265. A blazing midday street ('hot'): white-hot sky + sun
 * glare at the top, facades with awnings, heat haze off the asphalt + a zebra crossing at the
 * bottom. He walks slowly toward camera (Hero 'walk', 'tee', dry ≈ 0.7), squinting, skin dry.
 * "You stop sweating@1187–1194": NO SWEAT magnifier · "you start to overheat@1233": heat glow
 * creeps up over him, thermometer 37.0 → 39.5 °C, Label OVERHEATING · ends in heat-haze blur (rack).
 */
export const S11Overheat: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const dry = dryAt(abs);

  const prog = ramp(abs, 1174, 1266, ease.inOutSine);
  const insetT = ramp(abs, 1185, 1195, ease.outBack) * (1 - ramp(abs, 1213, 1221, ease.inQuad));
  const thermoPop = ramp(abs, 1209, 1219, ease.outBack);
  const heatT = ramp(abs, 1214, 1252, ease.inOutSine);
  const temp = 37 + 2.5 * heatT;
  const glow = ramp(abs, 1216, 1256, ease.inOutSine);
  const haze = 0.45 + 0.35 * glow + 0.6 * ramp(abs, 1248, 1266, ease.inQuad);

  // camera: slow dolly back as he approaches, hand-held shimmer
  const hh = handheld(abs, 4, 0.03, 23);
  const drift: [number, number] = [hh.x, hh.y + wander(abs * 0.05, 31) * 1.5];
  const s = lerp(1.1, 1.0, prog);
  const F: [number, number] = [540, 1040];
  const T: [number, number] = [540, 1000];
  const tf = (k: number) => layerTf(F, T, s, k, drift);
  const sp = (p: {x: number; y: number}, k = 1) => layerPt(p, F, T, s, k, drift);

  // him
  const hero: HeroProps = {
    f: abs,
    id: 's11h',
    x: 540 + wander(abs * 0.02, 5) * 10,
    y: lerp(1560, 1660, prog),
    anchor: 'feet',
    scale: lerp(0.96, 1.12, prog),
    pose: 'walk',
    walkPhase: ((abs - 1174) / 46) % 1,
    view: 'front',
    outfit: 'tee',
    expression: 'tired',
    blendTo: 'pain',
    blend: 0.32 + 0.3 * glow,
    dry,
    lighting: 'hot',
    rim: 0.9,
  };
  const HP = heroPoints(hero);
  const headS = sp(HP.head);
  const chestS = sp(HP.chest);
  const feetY = hero.y;

  return (
    <AbsoluteFill style={{background: C.hotSkyLow}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <defs>
          <BoilDefs id="s11boil" f={abs} scale={2} />
        </defs>
        <g transform={tf(0.35)}>
          <StreetSky id="s11sky" f={abs} />
        </g>
        <g transform={tf(0.55)}>
          <StreetFar id="s11far" f={abs} haze={haze} />
        </g>
        <g transform={tf(1)}>
          <StreetGround id="s11g" f={abs} />
        </g>
        <g transform={tf(0.82)}>
          <StreetFacades id="s11fa" f={abs} />
          <StreetWires f={abs} />
        </g>
        <g transform={tf(1)}>
          <HeatShimmer f={abs} amt={0.7 + 0.5 * haze} y0={900} y1={1500} seed={3} />
          {/* harsh, short noon shadow */}
          <ellipse cx={n1(hero.x + 30)} cy={n1(feetY + 8)} rx={n1(150 * (hero.scale ?? 1))} ry={n1(26 * (hero.scale ?? 1))} fill={C.ink} opacity={0.42} />
          {/* heat glow creeping up over him */}
          <g style={{mixBlendMode: 'screen'}}>
            <Glow id="s11hg" x={hero.x} y={lerp(feetY, HP.chest.y, glow)} r={420} rx={360 + 140 * glow} ry={560} color={C.heat} a={0.12 + 0.6 * glow} />
          </g>
          <g filter="url(#s11boil)">
            <Hero {...hero} />
          </g>
          <g style={{mixBlendMode: 'multiply'}} opacity={glow}>
            <Glow id="s11hg2" x={hero.x} y={lerp(feetY, HP.chest.y, glow)} r={300} rx={300} ry={620} color={C.heat} a={0.55} />
          </g>
          {/* heat rising off his head + shoulders */}
          <HeatShimmer f={abs + 40} amt={glow * 1.4} y0={HP.head.y - 260} y1={HP.chest.y} seed={9} />
        </g>
        <g transform={tf(1.15)}>
          <HeatShimmer f={abs + 17} amt={0.5 + 0.6 * haze} y0={1450} y1={1960} seed={5} />
        </g>
        {/* global heat grade: warmer as he overheats */}
        <rect width={1080} height={1920} fill={C.heat} opacity={0.04 + 0.12 * glow} style={{mixBlendMode: 'multiply'}} />
        <rect width={1080} height={1920} fill={C.heatLight} opacity={0.02 + 0.03 * glow} />
        {/* tags */}
        <NoSweatInset id="s11ns" f={abs} x={812} y={620} r={118} t={insetT} />
        <Label f={abs} from={1186} to={1220} ax={headS.x + 26} ay={headS.y - 40} x={700} y={820} text="NO SWEAT" size={38} accent={C.water} speed={0.9} />
        <Thermo x={130} y={1060} t={heatT} temp={temp} pop={thermoPop} f={abs} />
        <Label f={abs} from={1229} to={1263} ax={chestS.x + 40} ay={chestS.y} x={640} y={1150} text="OVERHEATING" size={40} color={C.cream} accent={C.heat} speed={0.8} />
      </svg>
    </AbsoluteFill>
  );
};
