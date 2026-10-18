import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, keys, lerp, mixHex, ramp, rgba, wander} from '../lib/anim';
import {dryAt} from '../lib/sync';
import {Label} from '../lib/Label';
import {BoilDefs} from '../lib/Boil';
import {HeroHead} from '../characters/HeroHead';
import {HeroHand} from '../characters/HeroHand';
import {LRAir, LRBack, LRCurtain, LRFront, LRSofa} from '../parts/home/living';
import {n1} from '../parts/home/kit';

/**
 * S12 Dizzy (owner: home) — head rush. Evening living room ('dim'), mid-shot: he sits slumped on the
 * sofa; on "Stand up" (1262) he leans forward (anticipation) and rises up through the frame, the
 * camera tilting up after him (lagging, settling); on "the whole room spins" (1288–1326) the room
 * swirls around him — a smooth camera roll ±12°, the background layers orbit with parallax, a
 * double-vision ghost, tunnel darkening at the edges; his hand slaps onto the bookcase edge (1301)
 * to steady himself. Label "BLOOD PRESSURE DROPS". Ends pushing in on his head at (540,820) for
 * the zoomIn into his brain (S13).
 */
export const S12Dizzy: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const dry = dryAt(abs);

  // ---------------------------------------------------------------- him: sit -> anticipation -> rise
  const antic = keys(abs, [[1256, 0], [1264, 1], [1268, 0.85], [1276, 0]], ease.inOutSine); // lean forward + down
  const rise = ramp(abs, 1265, 1284, ease.inOutCubic);
  const settle = abs > 1282 ? Math.exp(-(abs - 1282) / 6) * Math.sin((abs - 1282) * 0.45) : 0; // overshoot up then settle
  const spin = ramp(abs, 1286, 1302, ease.inOutSine); // the dizziness envelope
  const ph = (abs - 1286) * ((2 * Math.PI) / 42); // swirl phase (~1.4 s per turn — slow, smooth)
  const calm = 1 - ramp(abs, 1308, 1320, ease.inOutSine); // he steadies for the dive into his head
  const breathe = 0.5 + 0.5 * Math.sin(abs * 0.09);
  const sway = spin * (0.55 + 0.45 * calm);

  const headX = 540 + antic * -8 + Math.sin(ph + 0.7) * 22 * sway;
  const headY = 1150 + breathe * 5 + antic * 50 - rise * 750 - settle * 22 + Math.cos(ph * 2 + 0.3) * 6 * sway;
  const sc = 1.3 + antic * 0.03 + rise * 0.1;
  const headRot = antic * -3 + Math.sin(ph + 1.2) * 5 * sway;
  const tilt = -0.18 - antic * 0.25 + rise * 0.24 + Math.sin(ph) * 0.08 * sway;
  const turn = 0.18 + Math.sin(ph * 0.8) * 0.12 * sway;
  const vy = rise > 0 && rise < 1 ? -1 : 0;
  const hairDir: [number, number] = [-Math.cos(ph + 0.7) * 0.8 * sway, clamp(-vy * 0.9 * (rise > 0.1 && rise < 0.95 ? 1 : 0) - settle * 0.8 + antic * 0.3, -1, 1)];
  const lookCircle: [number, number] = [Math.sin(ph * 1.3) * 0.45 * sway, Math.cos(ph * 1.3) * 0.3 * sway + (1 - rise) * 0.25];
  const lids = keys(abs, [[1252, 0.25], [1262, 0.15], [1270, 0], [1288, 0], [1296, 0.55], [1300, 0.25], [1308, 0.65], [1314, 0.35], [1333, 0.4]]);

  // ---------------------------------------------------------------- camera
  const camY = keys(abs, [[1252, 0], [1268, -8], [1280, 250], [1290, 440], [1298, 405], [1306, 420]], ease.inOutSine);
  const zoom = keys(abs, [[1252, 1.05], [1266, 1.07], [1282, 1.0], [1300, 1.03], [1333, 1.2]], ease.inOutSine);
  const roll = Math.sin(ph) * 12 * spin;
  const drift = wander(abs * 0.03, 4) * 6;
  // the room orbits around him (parallax swirl): far layers move more
  const orbit = (k: number): [number, number] => [Math.cos(ph) * 34 * k * spin, Math.sin(ph) * 22 * k * spin];
  const [ob0x, ob0y] = orbit(1);
  const [ob1x, ob1y] = orbit(0.6);
  const [ob2x, ob2y] = orbit(1.5);
  const press = antic; // the sofa cushion squashes as he pushes off

  // ---------------------------------------------------------------- the hand on the bookcase

  const grabHit = abs >= 1302 ? Math.exp(-(abs - 1302) / 5) * Math.sin((abs - 1302) * 0.9) : 0;
  const shake = abs >= 1302 ? Math.exp(-(abs - 1302) / 9) : 0;
  // his hand enters from the frame's left edge and grips the bookcase edge on 1302 (back-layer coords)
  const reach = ramp(abs, 1293, 1302, ease.outCubic);
  const handX = lerp(-330, 128, reach) + grabHit * 6;
  const handY = lerp(1130, 945, reach) + grabHit * 10;
  const handRot = lerp(72, 34, reach) + grabHit * 6;
  const curl = keys(abs, [[1299, 0], [1304, 1], [1308, 0.74], [1313, 0.9]], ease.inOutSine); // fingers curl, overshoot, settle

  // ---------------------------------------------------------------- torso light (cel shadow + window stripes)
  const bodyRot = headRot * 0.4;
  const bodyTurn = turn * 0.35;
  const bxL = bodyTurn * 70;
  const shY = 400 - breathe * 7;
  const Wl = 430 * (1 - Math.max(0, bodyTurn) * 0.22);
  const Wr = 430 * (1 - Math.max(0, -bodyTurn) * 0.22);
  const torsoD = [
    `M${n1(bxL - Wl - 20)},1560`,
    `L${n1(bxL - Wl + 4)},${n1(shY + 200)}`,
    `C${n1(bxL - Wl + 6)},${n1(shY + 70)} ${n1(bxL - Wl * 0.86)},${n1(shY + 6)} ${n1(bxL - Wl * 0.62)},${n1(shY - 18)}`,
    `L${n1(bxL)},${n1(shY - 60)}`,
    `L${n1(bxL + Wr * 0.62)},${n1(shY - 18)}`,
    `C${n1(bxL + Wr * 0.86)},${n1(shY + 6)} ${n1(bxL + Wr - 6)},${n1(shY + 70)} ${n1(bxL + Wr - 4)},${n1(shY + 200)}`,
    `L${n1(bxL + Wr + 20)},1560 Z`,
  ].join(' ');
  const lightSlide = -camY * 0.25 + Math.sin(ph) * 30 * spin;

  const camT = `translate(540,820) rotate(${n1(roll)}) scale(${zoom.toFixed(4)}) translate(${n1(-540 + drift)},${n1(-820 + camY)})`;
  const bloom = 1 - ramp(abs, 1252, 1270, ease.outQuad);
  const tunnel = spin * (0.75 + 0.25 * Math.sin(ph * 2));
  const ghostA = 0.34 * spin * (0.7 + 0.3 * Math.sin(ph * 1.7));
  const gx = Math.sin(ph * 1.3 + 0.5) * 34 * spin;
  const gy = Math.cos(ph * 1.1) * 14 * spin;

  return (
    <AbsoluteFill style={{background: C.roomNight}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <defs>
          <BoilDefs id="s12boil" f={abs} scale={2} />
          <radialGradient id="s12-tunnel" cx={0.5} cy={820 / 1920} r={0.62}>
            <stop offset={0.42} stopColor={C.navyDeep} stopOpacity={0} />
            <stop offset={0.78} stopColor={C.navyDeep} stopOpacity={0.55} />
            <stop offset={1} stopColor={C.navyDeep} stopOpacity={0.92} />
          </radialGradient>
          <radialGradient id="s12-bloom" cx={0.7} cy={0.45} r={0.8}>
            <stop offset={0} stopColor={C.duskSun} stopOpacity={0.8} />
            <stop offset={1} stopColor={C.duskLow} stopOpacity={0.2} />
          </radialGradient>
        </defs>
        <g id="s12-world">
          <g transform={camT}>
            {/* far: walls, window, shelves (parallax 0.8 on the tilt, full orbit) */}
            <g transform={`translate(${n1(ob0x)},${n1(-camY * 0.2 + ob0y)})`}>
              <LRBack f={abs} id="s12b" shake={shake} />
              <LRCurtain f={abs} id="s12c" wind={1 + spin * 0.6} />
            </g>
            {/* mid: sofa */}
            <g transform={`translate(${n1(ob1x)},${n1(ob1y)})`}>
              <LRSofa f={abs} id="s12s" press={press} />
            </g>
            {/* him */}
            <g filter="url(#s12boil)">
              <HeroHead
                f={abs}
                id="s12hero"
                x={headX}
                y={headY}
                scale={sc}
                rot={headRot}
                bodyRot={headRot * 0.4}
                turn={turn}
                tilt={tilt}
                expression="tired"
                blendTo={abs < 1286 ? 'worried' : 'pain'}
                blend={abs < 1286 ? antic * 0.5 + rise * 0.3 : 0.35 * spin + 0.1}
                blink={lids}
                look={lookCircle}
                mouthOpen={0.06 + 0.12 * spin + antic * 0.08}
                breath={breathe}
                dry={dry}
                outfit="tee"
                shoulders
                chestTo={1500}
                hairDir={hairDir}
                hairFlow={0.35 + 0.4 * spin}
                lighting="dim"
                rim={1}
              />
              <g transform={`translate(${n1(headX)},${n1(headY)}) rotate(${n1(headRot)}) scale(${sc.toFixed(4)})`}>
                <g transform={`rotate(${n1(bodyRot - headRot)} ${n1(bxL)} 330)`}>
                  <clipPath id="s12-torso">
                    <path d={torsoD} />
                  </clipPath>
                  <g clipPath="url(#s12-torso)">
                    {/* hard cel shadow on the side away from the window + the window's warm light stripe */}
                    <path d={`M${n1(bxL - 520)},${n1(shY + 120)} C${n1(bxL - 200)},${n1(shY + 160)} ${n1(bxL - 120)},${n1(shY + 500)} ${n1(bxL - 60)},1700 L${n1(bxL - 600)},1700 Z`} fill={C.roomNight} opacity={0.32} />
                    <path d={`M${n1(bxL - 140 + lightSlide)},1700 L${n1(bxL + 120 + lightSlide)},${n1(shY - 60)} L${n1(bxL + 300 + lightSlide)},${n1(shY - 60)} L${n1(bxL + 40 + lightSlide)},1700 Z`} fill={C.duskLow} opacity={0.2} />
                    <path d={`M${n1(bxL + 340 + lightSlide)},1700 L${n1(bxL + 420 + lightSlide)},${n1(shY - 60)} L${n1(bxL + 520 + lightSlide)},${n1(shY - 60)} L${n1(bxL + 440 + lightSlide)},1700 Z`} fill={C.duskLow} opacity={0.16} />
                  </g>
                </g>
              </g>
            </g>
            {/* near: rug, coffee table, foreground leaves */}
            <g transform={`translate(${n1(ob2x)},${n1(camY * 0.35 + ob2y)})`}>
              <LRFront f={abs} id="s12f" />
            </g>
            <g transform={`translate(${n1(ob0x * 0.5)},${n1(ob0y * 0.5)})`}>
              <LRAir f={abs} id="s12a" k={1 - spin * 0.3} />
            </g>
          </g>
        </g>
        {/* double vision: a drifting ghost of the whole picture */}
        {ghostA > 0.01 && <use href="#s12-world" transform={`translate(${n1(gx)},${n1(gy)})`} opacity={ghostA} />}
        {/* his steadying hand (kept out of the ghost so it reads solid): in from the left edge, grips the bookcase */}
        {abs >= 1293 && (
          <g transform={camT}>
            <g transform={`translate(${n1(ob0x)},${n1(-camY * 0.2 + ob0y)})`}>
              <HeroHand f={abs} id="s12hand" x={handX} y={handY} scale={1.5} rot={handRot} pose="open" poseTo="grip" poseMix={curl} palm={false} sleeve="tee" dry={dry} lighting="dim" armLen={420} armAng={-4} fidget={0.1} />
            </g>
          </g>
        )}
        {/* swirl streaks (soft motion arcs around his head) */}
        {spin > 0.01 &&
          [0, 1, 2].map((i) => {
            const r = 360 + i * 120;
            const a0 = ph * 1.4 + i * 2.1;
            const a1 = a0 + 0.9;
            const p0 = [540 + Math.cos(a0) * r, 820 + Math.sin(a0) * r * 1.25];
            const p1 = [540 + Math.cos(a1) * r, 820 + Math.sin(a1) * r * 1.25];
            return (
              <path
                key={i}
                d={`M${n1(p0[0])},${n1(p0[1])} A${r},${n1(r * 1.25)} 0 0 1 ${n1(p1[0])},${n1(p1[1])}`}
                fill="none"
                stroke={mixHex(C.cream, C.duskLow, 0.4)}
                strokeWidth={14 - i * 3}
                strokeLinecap="round"
                opacity={0.13 * spin}
              />
            );
          })}
        {/* tunnel vision (soft, breathing slowly) */}
        <rect x={0} y={0} width={1080} height={1920} fill="url(#s12-tunnel)" opacity={tunnel} />
        {/* warm haze carried over from the street, clearing */}
        {bloom > 0.01 && <rect x={0} y={0} width={1080} height={1920} fill="url(#s12-bloom)" opacity={bloom * 0.45} style={{mixBlendMode: 'screen'}} />}
        <Label
          f={abs}
          from={1270}
          to={1318}
          x={540}
          y={1500}
          align="center"
          text="BLOOD PRESSURE DROPS"
          sub="less blood reaches the brain"
          size={36}
          speed={0.6}
          color={C.label}
          accent={C.heat}
        />
        
      </svg>
    </AbsoluteFill>
  );
};
