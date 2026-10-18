import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, handheld, keys, lerp, ramp, rgba, wander} from '../lib/anim';
import {EV} from '../lib/sync';
import {BoilDefs} from '../lib/Boil';
import {HeroHead, heroHeadPoints} from '../characters/HeroHead';
import type {HeroHeadProps} from '../characters/HeroHead';
import {HeroHand} from '../characters/HeroHand';
import {Glass} from '../characters/Glass';
import {camTf, Island, KitchenBack, Shafts} from '../parts/hero/kitchen';
import type {Cam} from '../parts/hero/kitchen';

/**
 * S01 Hook (owner: hero) — abs 0–95. Bright morning kitchen; mid close-up of HIM (three-quarter,
 * tee, dry 0) drinking the LAST SIP: the glass tilts at his lips (lastSip 20–45), his throat bobs on
 * each EV.sips gulp (24, 40) while the level steps down and caustics flicker on his cheek; ~46–62 he
 * lowers the glass with a satisfied "ahh" (a droplet on his lip), looks at it, a little wistful; 74–88
 * he sets it down toward the camera on the island — the glass's water ends at (540,1180) for the
 * zoomIn. Camera: slow push + slight orbit, tilting down to the glass at the end. Face stays below
 * y≈800 (title y 240–760).
 */

const ISL = 1660; // island far edge (world y)
const GS0 = 1.2; // glass + hand scale in his hand
const GS1 = 2.6; // set down near the camera
const HEAD = {x: 430, y: 1090, s: 1.1};

const sipEnv = (f: number) => {
  let v = 0;
  for (const e of EV.sips) if (f >= e - 1 && f <= e + 12) v = Math.max(v, ramp(f, e - 1, e + 12));
  return v;
};

export const S01Hook: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const [s1, s2] = EV.sips;

  // ---------------------------------------------------------------- camera
  const hh = handheld(f, 3, 0.03, 7);
  const end = ramp(f, 66, 86, ease.inOutCubic);
  const cam: Cam = {
    fx: 540 + hh.x,
    fy: lerp(lerp(975, 1000, ramp(f, 0, 70, ease.inOutSine)), 1150, end) + hh.y,
    z: lerp(lerp(1.0, 1.07, ramp(f, 0, 70, ease.inOutSine)), 1.15, end),
    ox: lerp(-26, 24, ramp(f, 0, 95, ease.inOutSine)),
  };

  // ---------------------------------------------------------------- his head
  const tilt = keys(f, [[0, 0.04], [16, 0.22], [44, 0.34], [55, 0.02], [66, -0.12], [80, -0.26], [95, -0.24]]);
  const turn = keys(f, [[0, 0.38], [44, 0.3], [64, 0.36], [95, 0.3]]);
  const lean = ramp(f, 70, 86, ease.inOutCubic);
  const headY = HEAD.y + 6 * Math.sin(f * 0.07) + lean * 26 - ramp(f, 46, 54, ease.outQuad) * 6 * (1 - ramp(f, 56, 66));
  const blink = keys(f, [[0, 0], [17, 0], [23, 0.86], [43, 0.86], [49, 0], [68, 0], [70, 1], [73, 0]]);
  const smileB = keys(f, [[46, 0], [56, 0.5], [64, 0.6], [67, 0.3], [68, 0]]);
  const worryB = ramp(f, 68, 78, ease.inOutSine) * 0.32;
  const mouthOpen = keys(f, [[16, 0], [20, 0.12], [44, 0.12], [50, 0.08], [60, 0.3], [65, 0.34], [69, 0]]);
  const look: [number, number] = [keys(f, [[0, 0.1], [44, 0], [60, 0.4], [95, 0.15]]), keys(f, [[0, 0.1], [44, -0.1], [60, 0.75], [80, 0.9]])];
  const breath = clamp(keys(f, [[0, 0.45], [44, 0.3], [62, 1], [72, 0.45], [95, 0.55]]) + 0.06 * Math.sin(f * 0.12));
  const dTilt = keys(f + 2, [[0, 0.04], [16, 0.22], [44, 0.34], [55, 0.02], [66, -0.12], [80, -0.26], [95, -0.24]]) - tilt;
  const headP: HeroHeadProps = {
    f: abs,
    id: 's01h',
    x: HEAD.x,
    y: headY,
    scale: HEAD.s,
    turn,
    tilt,
    expression: 'content',
    blendTo: f < 68 ? 'smile' : 'worried',
    blend: f < 68 ? smileB : worryB,
    mouthOpen,
    blink,
    look,
    breath,
    dry: 0,
    outfit: 'tee',
    shoulders: true,
    chestTo: 820,
    hairFlow: 0.4,
    hairDir: [clamp(-dTilt * 6, -1, 1) * 0.6, clamp(-dTilt * 10, -1, 1)],
    swallow: sipEnv(abs),
    lighting: 'day',
  };
  const hp = heroHeadPoints(headP);
  const mouth = hp.mouth;

  // ---------------------------------------------------------------- the glass (rim follows the mouth, then set down)
  const rot = keys(f, [[0, -22], [18, -56], [30, -64], [44, -76], [52, -30], [58, 6], [63, -2], [66, 0], [72, 0], [80, -4], [84, 1], [88, 0]], ease.inOutSine);
  const gsLow = lerp(GS0, GS1, ramp(f, 72, 84, ease.inOutCubic));
  const rimDX = keys(f, [[0, 70], [18, 18], [44, 14], [60, 170], [72, 176]]);
  const rimDY = keys(f, [[0, 110], [18, -2], [44, -4], [58, 128], [62, 114], [72, 120]], ease.inOutSine);
  const ra = (rot * Math.PI) / 180;
  const rimOff = {x: 260 * gsLow * Math.sin(ra), y: -260 * gsLow * Math.cos(ra)};
  const baseHand = {x: mouth.x + rimDX - rimOff.x, y: mouth.y + rimDY - rimOff.y};
  const setT = ramp(f, 72, 84, ease.inOutCubic);
  const setBase = {x: 540, y: ISL + 20};
  const base = {x: lerp(baseHand.x, setBase.x, setT), y: lerp(baseHand.y, setBase.y, setT) - Math.sin(Math.PI * setT) * 60};
  const level = 0.92 - 0.37 * ramp(f, s1, s1 + 8, ease.outQuad) - 0.37 * ramp(f, s2, s2 + 8, ease.outQuad);
  const slosh = clamp(Math.max(0.25, 1 - ((f - s1 + 100) % 100) / 30, ramp(f, 56, 58) * (1 - ramp(f, 58, 76)), ramp(f, 83, 85) * (1 - ramp(f, 85, 95)) * 0.8));
  // the hand (wrist from the glass base), forearm toward his elbow (behind the island / lower left)
  const hs = gsLow;
  // he lets go once the glass stands on the island: the hand slides away down-left
  const away = ramp(f, 84, 91, ease.inOutQuad);
  const wr = {x: base.x - (64 * hs * Math.cos(ra) - 62 * hs * Math.sin(ra)) - away * 640, y: base.y - (64 * hs * Math.sin(ra) + 62 * hs * Math.cos(ra)) + away * 420};
  const elbow = {x: lerp(70, -60, setT), y: lerp(1760, 2150, setT)};
  const dx = elbow.x - wr.x, dy = elbow.y - wr.y;
  const lx = dx * Math.cos(-ra) - dy * Math.sin(-ra), ly = dx * Math.sin(-ra) + dy * Math.cos(-ra);
  const armAng = (Math.atan2(-lx, ly) * 180) / Math.PI;
  const armLen = Math.hypot(dx, dy) / hs + 80;
  const handP = {f: abs, id: 's01hand', x: wr.x, y: wr.y, scale: hs, rot, pose: 'holdGlass' as const, sleeve: 'tee' as const, armAng, armLen, lighting: 'day' as const, fidget: 0.4};
  const glassP = {f: abs, id: 's01g', x: base.x, y: base.y, scale: hs, rot: rot * (1 - away) + away * 0, level, slosh, condensation: 0.65, lighting: 'day' as const, sparkle: 0.5 + 0.4 * setT};

  // caustics thrown on his cheek while the glass is at his lips
  const caus = ramp(f, 16, 22) * (1 - ramp(f, 44, 52));
  const ck = hp.cheek;
  const drop = ramp(f, 49, 53) * (1 - ramp(f, 84, 92));
  const dropY = ramp(f, 53, 90, ease.inQuad) * 16;

  const himTf = camTf(cam, 1);
  return (
    <AbsoluteFill style={{background: C.kitchenWall}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <defs>
          <BoilDefs id="s01boil" f={abs} scale={2} />
          <clipPath id="s01isl">
            <rect x={-400} y={ISL - 8} width={1900} height={1200} />
          </clipPath>
          <radialGradient id="s01bloom" cx="0.12" cy="0.12" r="0.75">
            <stop offset={0} stopColor={C.morning} stopOpacity={0.55} />
            <stop offset={0.5} stopColor={C.morningGlow} stopOpacity={0.12} />
            <stop offset={1} stopColor={C.morningGlow} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="s01caus">
            <stop offset={0} stopColor="#ffffff" stopOpacity={0.9} />
            <stop offset={0.6} stopColor={C.waterLight} stopOpacity={0.4} />
            <stop offset={1} stopColor={C.waterLight} stopOpacity={0} />
          </radialGradient>
        </defs>
        <g transform={camTf(cam, 0.35)}>
          <KitchenBack f={abs} id="s01k" />
        </g>
        <g transform={camTf(cam, 0.6)}>
          <Shafts f={abs} id="s01s" motes={26} />
        </g>
        <g transform={himTf}>
          <g filter="url(#s01boil)">
            <HeroHead {...headP} />
          </g>
          <HeroHand {...handP} layer="back" />
          <Glass {...glassP} />
          <HeroHand {...handP} layer="front" />
          {/* caustic light dancing on his cheek + chin */}
          {caus > 0.01 &&
            [0, 1, 2, 3].map((i) => (
              <ellipse
                key={i}
                cx={ck.x + 30 + i * 22 + wander(abs * 0.2 + i, 41 + i) * 18}
                cy={ck.y + 30 + (i % 2) * 40 + wander(abs * 0.18 + i * 3, 51 + i) * 14}
                rx={18 + 10 * Math.abs(Math.sin(abs * 0.3 + i))}
                ry={9 + 5 * Math.abs(Math.cos(abs * 0.27 + i))}
                fill="url(#s01caus)"
                opacity={caus * (0.55 + 0.45 * Math.sin(abs * 0.5 + i * 2))}
                style={{mixBlendMode: 'screen'}}
              />
            ))}
          {/* a droplet on his lip after the drink */}
          {drop > 0.01 && (
            <g opacity={drop} transform={`translate(${mouth.x + 36 * HEAD.s},${mouth.y + 14 + dropY})`}>
              <path d="M0,-9 C5,-2 8,3 8,7 A8,8 0 0 1 -8,7 C-8,3 -5,-2 0,-9 Z" fill={rgba(C.waterLight, 0.85)} stroke={rgba(C.waterDeep, 0.8)} strokeWidth={1.6} />
              <circle cx={-2.5} cy={4} r={2.2} fill="#fff" />
            </g>
          )}
        </g>
        <g transform={himTf}>
          <Island f={abs} id="s01i" y0={ISL} />
        </g>
        {/* set down: the glass + hand stand ON the island */}
        {setT > 0 && (
          <g transform={himTf} clipPath="url(#s01isl)">
            <HeroHand {...handP} id="s01hand2" layer="back" />
            <Glass {...glassP} id="s01g2" ground={setT} />
            <HeroHand {...handP} id="s01hand3" layer="front" />
          </g>
        )}
        <g transform={camTf(cam, 1.35)}>
          <Shafts f={abs + 500} id="s01s2" motes={14} />
        </g>
        <rect width={1080} height={1920} fill="url(#s01bloom)" style={{mixBlendMode: 'screen'}} />
      </svg>
    </AbsoluteFill>
  );
};
