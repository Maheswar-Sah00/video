import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {TITLE, MONO} from '../lib/fonts';
import {clamp, ease, handheld, keys, lerp, ramp, rgba, wander} from '../lib/anim';
import {mark, wordAt} from '../lib/sync';
import {BoilDefs} from '../lib/Boil';
import {HeroHead, heroHeadPoints} from '../characters/HeroHead';
import type {HeroHeadProps} from '../characters/HeroHead';
import {HeroHand} from '../characters/HeroHand';
import {Glass} from '../characters/Glass';
import {Glint} from '../parts/hero/kit/cel';
import {camTf, Island, KitchenBack, Shafts} from '../parts/hero/kitchen';
import type {Cam} from '../parts/hero/kitchen';

/**
 * S20 Closing (owner: hero) — abs 2118–2310. The same morning kitchen as S01, the sun brighter. HIM
 * (dry 0, healthy) finishing a big drink: the glass at his lips under the xrayUp reveal, lowered
 * ~2128–2140 with a contented "ahh" (~2140), a smile to camera on "favour" (2147), then he raises
 * the glass toward the camera — cheers — (clink ~2165, sparkle burst), sunlight sparkling through
 * the water. In-scene closing text (TITLE font, y≈420–780): "GO DRINK" (Go 2170 / drink 2173),
 * "A GLASS OF WATER." (glass 2181 / water 2194, aqua, a drip sliding off the last letter), then
 * "YOUR BODY WILL THANK YOU" (mono, ~2215). Slow push in; alive under the global fade 2274–2310.
 */

const n1 = (v: number) => v.toFixed(1);
const ISL = 1660;
const HEAD = {x: 420, y: 1090, s: 1.1};

export const S20Closing: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;

  // ---------------------------------------------------------------- camera: slow push in
  const hh = handheld(abs, 3, 0.03, 21);
  const clink = 2165;
  const bump = Math.exp(-Math.max(0, abs - clink) / 4) * (abs >= clink ? 1 : 0);
  const cam: Cam = {
    fx: 540 + hh.x,
    fy: lerp(990, 1040, ramp(abs, 2118, 2310, ease.inOutSine)) + hh.y + bump * 6,
    z: lerp(1.0, 1.12, ramp(abs, 2118, 2310, ease.inOutSine)) + bump * 0.012,
    ox: lerp(24, -24, ramp(abs, 2118, 2310, ease.inOutSine)),
  };

  // ---------------------------------------------------------------- his head
  const ahh = 2140;
  const tilt = keys(abs, [[2118, 0.32], [2128, 0.3], [2140, 0.02], [2150, 0.06], [2165, 0.0], [2310, 0.04]]);
  const turn = keys(abs, [[2118, 0.32], [2140, 0.34], [2150, 0.16], [2310, 0.12]]);
  const blink = keys(abs, [[2118, 0.85], [2128, 0.85], [2133, 0], [2196, 0], [2198, 1], [2201, 0], [2252, 0], [2254, 1], [2257, 0]]);
  const smileB = keys(abs, [[2118, 0], [2134, 0.2], [2142, 0.7], [2150, 0.9], [2310, 1]]);
  const mouthOpen = keys(abs, [[2118, 0.12], [2128, 0.12], [2134, 0.06], [2140, 0.36], [2147, 0.2], [2152, 0]]);
  const look: [number, number] = [keys(abs, [[2118, 0], [2140, 0.3], [2150, 0], [2310, 0]]), keys(abs, [[2118, -0.1], [2140, 0.4], [2150, 0], [2310, 0]])];
  const breath = clamp(keys(abs, [[2118, 0.3], [2132, 0.3], [2142, 1], [2156, 0.45]]) + 0.07 * Math.sin(abs * 0.1));
  const dT = keys(abs + 2, [[2118, 0.32], [2128, 0.3], [2140, 0.02], [2150, 0.06], [2165, 0.0], [2310, 0.04]]) - tilt;
  const headP: HeroHeadProps = {
    f: abs,
    id: 's20h',
    x: HEAD.x,
    y: HEAD.y + 5 * Math.sin(abs * 0.07),
    scale: HEAD.s,
    turn,
    tilt,
    expression: 'content',
    blendTo: 'smile',
    blend: smileB,
    mouthOpen,
    blink,
    look,
    breath,
    dry: 0,
    outfit: 'tee',
    shoulders: true,
    chestTo: 820,
    hairFlow: 0.45,
    hairDir: [clamp(-dT * 6, -1, 1) * 0.6, clamp(-dT * 10, -1, 1)],
    swallow: ramp(abs, 2118, 2128) < 1 ? ramp(abs, 2117, 2129) : 0,
    lighting: 'day',
    rim: 1.2,
  };
  const mouth = heroHeadPoints(headP).mouth;

  // ---------------------------------------------------------------- glass: lips -> chest -> raised to the camera
  const raise = ramp(abs, 2153, 2166, ease.outBack);
  const rot = keys(abs, [[2118, -66], [2128, -62], [2138, -8], [2142, 4], [2146, 0], [2153, 0], [2160, 10], [2166, 4], [2310, 3]]);
  const gs = lerp(1.2, 2.0, ramp(abs, 2152, 2166, ease.inOutCubic));
  const ra = (rot * Math.PI) / 180;
  const rimOff = {x: 260 * gs * Math.sin(ra), y: -260 * gs * Math.cos(ra)};
  const rimDX = keys(abs, [[2118, 16], [2128, 16], [2140, 170], [2153, 176]]);
  const rimDY = keys(abs, [[2118, -4], [2128, -4], [2140, 120], [2146, 108], [2153, 116]]);
  const atLips = {x: mouth.x + rimDX - rimOff.x, y: mouth.y + rimDY - rimOff.y};
  const sway = {x: wander(abs * 0.03, 77) * 10, y: wander(abs * 0.03, 78) * 8};
  const raised = {x: 760 + sway.x, y: 1590 + sway.y};
  const base = {x: lerp(atLips.x, raised.x, raise), y: lerp(atLips.y, raised.y, raise)};
  const level = 0.62 - 0.27 * ramp(abs, 2118, 2127, ease.outQuad);
  const slosh = clamp(Math.max(0.2, 1 - ramp(abs, 2142, 2160), (abs >= clink ? 1 - ramp(abs, clink, clink + 24) : 0)));
  const hs = gs;
  const wr = {x: base.x - (64 * hs * Math.cos(ra) - 62 * hs * Math.sin(ra)), y: base.y - (64 * hs * Math.sin(ra) + 62 * hs * Math.cos(ra))};
  const elbow = {x: lerp(60, 120, raise), y: lerp(1760, 2200, raise)};
  const dx = elbow.x - wr.x, dy = elbow.y - wr.y;
  const lx = dx * Math.cos(-ra) - dy * Math.sin(-ra), ly = dx * Math.sin(-ra) + dy * Math.cos(-ra);
  const armAng = (Math.atan2(-lx, ly) * 180) / Math.PI;
  const armLen = Math.hypot(dx, dy) / hs + 80;
  const handP = {f: abs, id: 's20hand', x: wr.x, y: wr.y, scale: hs, rot, pose: 'holdGlass' as const, sleeve: 'tee' as const, armAng, armLen, lighting: 'day' as const, fidget: 0.4};
  const glassP = {f: abs, id: 's20g', x: base.x, y: base.y, scale: hs, rot, level, slosh, condensation: 0.7, lighting: 'day' as const, sparkle: 0.6 + 0.4 * raise};
  const gc = {x: base.x + 130 * hs * Math.sin(ra), y: base.y - 130 * hs * Math.cos(ra)};
  const caus = (1 - ramp(abs, 2126, 2134)) * 1;
  const ck = heroHeadPoints(headP).cheek;

  // ---------------------------------------------------------------- closing text
  const wGo = wordAt('n21', 'Go'), wDrink = wordAt('n21', 'drink'), wGlass = wordAt('n21', 'glass'), wWater = wordAt('n21', 'water');
  const pop = (w: number) => ramp(abs, w - 2, w + 8, ease.outBack);
  const fadeIn = (w: number) => ramp(abs, w - 2, w + 4);
  const thank = ramp(abs, 2215, 2235, ease.outCubic);
  const thankChars = Math.ceil(clamp((abs - 2215) / 22) * 24);
  // the drip sliding off the last letter of "WATER."
  const dripT = ((((abs - wWater - 10) % 46) + 46) % 46) / 46;
  const dripOn = abs > wWater + 10;
  const textY1 = 560, textY2 = 690;
  const DX = 912; // under the end of 'WATER.' (line 2 is end-anchored at x 935)
  const word = (txt: string, x: number, y: number, size: number, w: number, fill: string, anchor: 'start' | 'middle' | 'end' = 'middle') => {
    const p = pop(w);
    if (p <= 0) return null;
    return (
      <g transform={`translate(${x},${y}) scale(${n1(0.6 + 0.4 * p)}) translate(0,${n1((1 - fadeIn(w)) * 30)})`} opacity={fadeIn(w)}>
        <text x={0} y={0} textAnchor={anchor} fontFamily={TITLE} fontWeight={700} fontSize={size} letterSpacing={2} fill={fill} stroke={C.ink} strokeWidth={size * 0.11} strokeLinejoin="round" style={{paintOrder: 'stroke'}}>
          {txt}
        </text>
      </g>
    );
  };
  void mark;
  void word;
  /** one line, words revealed on their narration frames (tspans keep the natural spacing); the line
   *  pops in with the first word, each later word fades + rises in */
  const line = (y: number, size: number, x: number, anchor: 'middle' | 'end', words: [string, number, string][]) => {
    const p0 = pop(words[0][1]);
    if (p0 <= 0) return null;
    return (
      <g transform={`translate(${x},${y}) scale(${n1(0.7 + 0.3 * p0)})`}>
        <text x={0} y={0} textAnchor={anchor} fontFamily={TITLE} fontWeight={700} fontSize={size} letterSpacing={3} stroke={C.ink} strokeWidth={size * 0.11} strokeLinejoin="round" style={{paintOrder: 'stroke'}}>
          {words.map(([t, w, col], i) => (
            <tspan key={i} fill={col} opacity={fadeIn(w)} stroke={fadeIn(w) > 0.02 ? C.ink : 'none'}>
              {t}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  const himTf = camTf(cam, 1);
  return (
    <AbsoluteFill style={{background: C.kitchenWall}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <defs>
          <BoilDefs id="s20boil" f={abs} scale={2} />
          <radialGradient id="s20bloom" cx="0.12" cy="0.1" r="0.8">
            <stop offset={0} stopColor={C.morning} stopOpacity={0.7} />
            <stop offset={0.5} stopColor={C.morningGlow} stopOpacity={0.15} />
            <stop offset={1} stopColor={C.morningGlow} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="s20caus">
            <stop offset={0} stopColor="#ffffff" stopOpacity={0.9} />
            <stop offset={0.6} stopColor={C.waterLight} stopOpacity={0.4} />
            <stop offset={1} stopColor={C.waterLight} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="s20band" x1={0} y1={0} x2={0} y2={1}>
            <stop offset={0} stopColor={C.navyDeep} stopOpacity={0} />
            <stop offset={0.3} stopColor={C.navyDeep} stopOpacity={0.28} />
            <stop offset={0.75} stopColor={C.navyDeep} stopOpacity={0.28} />
            <stop offset={1} stopColor={C.navyDeep} stopOpacity={0} />
          </linearGradient>
          <clipPath id="s20isl">
            <rect x={-400} y={ISL - 8} width={1900} height={1200} />
          </clipPath>
        </defs>
        <g transform={camTf(cam, 0.35)}>
          <KitchenBack f={abs} id="s20k" bright={1} />
        </g>
        <g transform={camTf(cam, 0.6)}>
          <Shafts f={abs} id="s20s" bright={1} motes={30} />
        </g>
        <g transform={himTf}>
          <g filter="url(#s20boil)">
            <HeroHead {...headP} />
          </g>
          {raise < 0.5 && (
            <g>
              <HeroHand {...handP} layer="back" />
              <Glass {...glassP} />
              <HeroHand {...handP} layer="front" />
            </g>
          )}
          {caus > 0.01 &&
            [0, 1, 2].map((i) => (
              <ellipse key={i} cx={ck.x + 30 + i * 24 + wander(abs * 0.2 + i, 41 + i) * 18} cy={ck.y + 30 + (i % 2) * 40 + wander(abs * 0.18 + i * 3, 51 + i) * 14} rx={20} ry={10} fill="url(#s20caus)" opacity={caus * (0.55 + 0.45 * Math.sin(abs * 0.5 + i * 2))} style={{mixBlendMode: 'screen'}} />
            ))}
          <Island f={abs} id="s20i" y0={ISL} bright={1} />
        </g>
        {/* raised toward the camera: in front of everything */}
        {raise >= 0.5 && (
          <g transform={himTf}>
            <HeroHand {...handP} layer="back" />
            <Glass {...glassP} />
            <HeroHand {...handP} layer="front" />
            {/* sunlight sparkling through the water */}
            {[0, 1, 2, 3].map((k) => {
              const tw = Math.max(0, Math.sin(abs * 0.21 + k * 1.9));
              return <Glint key={k} x={gc.x - 50 * hs + k * 34 * hs * 0.8} y={gc.y + 20 * hs + (k % 2) * 30 * hs} r={(10 + 10 * tw) * hs * 0.6} o={tw} col="#ffffff" />;
            })}
            {abs >= clink && abs < clink + 14 && <Glint x={base.x - 70 * hs + 260 * hs * Math.sin(ra)} y={base.y - 262 * hs * Math.cos(ra)} r={70 * (1 - (abs - clink) / 14)} o={1 - (abs - clink) / 14} col="#ffffff" />}
          </g>
        )}
        <g transform={camTf(cam, 1.35)}>
          <Shafts f={abs + 500} id="s20s2" bright={1} motes={14} />
        </g>
        <rect width={1080} height={1920} fill="url(#s20bloom)" style={{mixBlendMode: 'screen'}} />
        {/* ---------------- closing text (screen space, y ≈ 420–780) */}
        <rect x={0} y={400} width={1080} height={420} fill="url(#s20band)" opacity={ramp(abs, wGo - 4, wGo + 8)} />
        <g>
          {line(textY1, 150, 540, 'middle', [['GO', wGo, C.cream], [' DRINK', wDrink, C.cream]])}
          {line(textY2, 104, 935, 'end', [['A GLASS', wGlass, C.water], [' OF WATER.', wWater, C.water]])}
          {dripOn && (
            <g opacity={1 - ramp(dripT, 0.8, 1)}>
              <path d={`M${n1(DX - 4)},${n1(textY2 - 6)} L${n1(DX)},${n1(textY2 - 2 + dripT * 150)}`} stroke={rgba(C.water, 0.7)} strokeWidth={6} strokeLinecap="round" />
              <path d={`M${n1(DX)},${n1(textY2 + 2 + dripT * 150 - 12)} C${n1(DX + 6)},${n1(textY2 + dripT * 150 - 2)} ${n1(DX + 10)},${n1(textY2 + dripT * 150 + 6)} ${n1(DX + 10)},${n1(textY2 + dripT * 150 + 10)} A10,10 0 0 1 ${n1(DX - 10)},${n1(textY2 + dripT * 150 + 10)} C${n1(DX - 10)},${n1(textY2 + dripT * 150 + 6)} ${n1(DX - 6)},${n1(textY2 + dripT * 150 - 2)} ${n1(DX)},${n1(textY2 + 2 + dripT * 150 - 12)} Z`} fill={C.water} stroke={C.ink} strokeWidth={3} />
              <circle cx={DX - 4} cy={n1(textY2 + dripT * 150 + 6)} r={3} fill="#fff" />
            </g>
          )}
          {thank > 0 && (
            <text x={540} y={790} textAnchor="middle" fontFamily={MONO} fontWeight={600} fontSize={38} letterSpacing={5} fill={C.cream} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" style={{paintOrder: 'stroke'}} opacity={thank}>
              {'YOUR BODY WILL THANK YOU'.slice(0, thankChars)}
            </text>
          )}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
