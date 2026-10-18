import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, keys, mixHex, ramp, wander, window01} from '../lib/anim';
import {beatPulse, dryAt} from '../lib/sync';
import {BoilDefs} from '../lib/Boil';
import {HeroHead} from '../characters/HeroHead';
import {Glass} from '../characters/Glass';
import {BRBack, BRBed, BRFloor, BRLight} from '../parts/home/bedroom';
import {BRDuvet2} from '../parts/home/duvet';
import {n1} from '../parts/home/kit';

/**
 * S16 Fade (owner: home) — he drifts off. His bedroom in the last evening light, slowly sinking to
 * dusk-blue. He lies on his pillow (HeroHead `pillow`, rot ≈ -74°), the duvet over him, an EMPTY
 * glass on the nightstand catching the last light. "You drift in and out" (1649–1695): long
 * blinks — close… open a little (he looks toward the window)… close — the room swims softly;
 * faint heartbeats 1660 1690 1722 lift his chest. "until your body simply stops" (1698–1748): the
 * eyes close for good, the breathing slows to one long breath out (~1735) and stills, the light
 * sinks, the glass's glint fades, the camera drifts slowly back. Dip to black 1763–1793.
 */
export const S16Fade: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const dry = dryAt(abs);
  const p = ramp(abs, 1648, 1770, ease.inOutSine); // the light sinking
  const wind = 1 - 0.6 * p;

  // ---------------------------------------------------------------- breathing (slows, then stills)
  const breathK: [number, number][] = [[1634, 0.55], [1646, 0.3], [1660, 0.85], [1676, 0.25], [1692, 0.8], [1709, 0.25], [1724, 0.7], [1731, 0.72], [1748, 0.04], [1793, 0]];
  const beat = beatPulse(abs);
  const breath = clamp(keys(abs, breathK) + beat * 0.15);
  const rise = breath * 7 + beat * 3; // chest under the duvet

  // ---------------------------------------------------------------- eyes: long blinks, then closed
  const lids = keys(abs, [[1634, 0.42], [1652, 0.45], [1664, 1], [1673, 1], [1682, 0.52], [1691, 0.56], [1701, 1], [1707, 0.86], [1711, 0.8], [1717, 1], [1793, 1]]);
  const sleep = ramp(abs, 1700, 1735, ease.inOutSine);
  const glance = window01(abs, 1678, 1700, 6, 8); // looks toward the window light when they open
  const headRot = -75 + ramp(abs, 1722, 1756, ease.inOutSine) * 3.5 + wander(abs * 0.02, 5) * 0.4 * (1 - sleep);
  const exhale = window01(abs, 1730, 1752, 6, 12);

  // ---------------------------------------------------------------- camera: slow drift back + swim
  const swim = window01(abs, 1646, 1712, 12, 24);
  const zoom = keys(abs, [[1634, 1.16], [1793, 1.0]], ease.outQuad) * (1 + 0.007 * Math.sin(abs * 0.08) * swim);
  const camX = wander(abs * 0.01, 3) * 12 + ramp(abs, 1634, 1793) * 14;
  const camY = wander(abs * 0.012, 8) * 8 - ramp(abs, 1634, 1793, ease.inOutSine) * 24;
  const roll = wander(abs * 0.008, 11) * 0.8 + Math.sin(abs * 0.05) * 0.5 * swim;
  const PX = 520, PY = 1160;
  const camT = `translate(${PX},${PY}) rotate(${n1(roll)}) scale(${zoom.toFixed(4)}) translate(${n1(-PX + camX)},${n1(-PY + camY)})`;

  const glint = (1 - ramp(abs, 1696, 1746, ease.inOutSine)) * (0.8 + 0.2 * Math.sin(abs * 0.11));
  const multiply = mixHex('#ffffff', mixHex(C.duskTop, C.roomNight, 0.3), 0.75);

  return (
    <AbsoluteFill style={{background: C.roomNight}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <defs>
          <BoilDefs id="s16boil" f={abs} scale={1.6} every={4} />
          <radialGradient id="s16-glint">
            <stop offset={0} stopColor={C.duskSun} stopOpacity={0.9} />
            <stop offset={1} stopColor={C.duskLow} stopOpacity={0} />
          </radialGradient>
        </defs>
        <g id="s16-world">
          <g transform={camT}>
            {/* far: wall, window, curtains, decor, nightstand (slower) */}
            <g transform={`translate(${n1(-camX * 0.3)},${n1(-camY * 0.3)})`}>
              <BRBack f={abs} id="s16b" p={p} wind={wind} />
              {/* the EMPTY glass on the nightstand, catching the last light */}
              <Glass f={abs} id="s16glass" x={112} y={896} scale={0.66} level={0} condensation={0} lighting="dim" />
              <g opacity={glint}>
                <circle cx={140} cy={800} r={80} fill="url(#s16-glint)" opacity={0.6} />
                <path d="M158,740 L150,880" stroke={C.duskSun} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
                <path d={`M150,${n1(727)} l5,-17 l5,17 l17,5 l-17,5 l-5,17 l-5,-17 l-17,-5 Z`} fill={C.duskSun} transform={`rotate(${n1(abs * 0.6)} 155 732)`} />
                <ellipse cx={112} cy={900} rx={64} ry={10} fill={C.duskLow} opacity={0.45} />
              </g>
            </g>
            <BRFloor f={abs} id="s16fl" p={p} />
            <BRBed f={abs} id="s16bed" p={p} px={420} py={1150} />
            <g filter="url(#s16boil)">
              <HeroHead
                f={abs}
                id="s16hero"
                x={452}
                y={1122}
                scale={0.74}
                rot={headRot}
                turn={0.24}
                tilt={0}
                pillow
                expression="tired"
                blendTo="sleep"
                blend={sleep}
                blink={lids}
                look={[0.55 * glance, -0.35 * glance]}
                mouthOpen={0.05 + 0.1 * exhale}
                breath={breath}
                dry={dry}
                outfit="tee"
                shoulders
                hairFlow={0.18 * wind}
                lighting="dim"
                rim={1 - p * 0.5}
              />
            </g>
            <BRDuvet2 f={abs} id="s16dv" p={p} rise={rise} />
            <BRLight f={abs} id="s16l" p={p} />
          </g>
        </g>
        {/* the room swims softly: a faint drifting soft-focus double */}
        {swim > 0.01 && <use href="#s16-world" transform={`translate(${PX},${PY}) scale(${(1.018 + 0.006 * Math.sin(abs * 0.06)).toFixed(4)}) translate(${-PX},${-PY})`} opacity={0.2 * swim} />}
        {/* the light sinks to dusk-blue */}
        <rect x={0} y={0} width={1080} height={1920} fill={multiply} opacity={0.15 + 0.6 * p} style={{mixBlendMode: 'multiply'}} />
        <rect x={0} y={0} width={1080} height={1920} fill={C.navyDeep} opacity={ramp(abs, 1735, 1778, ease.inQuad) * 0.3} />
      </svg>
    </AbsoluteFill>
  );
};
