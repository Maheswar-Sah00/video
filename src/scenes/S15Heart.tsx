import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {TITLE, MONO} from '../lib/fonts';
import {clamp, ease, mixHex, noise1, ramp, rgba} from '../lib/anim';
import {EV, beatPulse, lastEvent} from '../lib/sync';
import {Ecg, MedBg, camPt, camTf, wobble} from '../lib/MedKit';
import {Label} from '../lib/Label';
import {Heart} from '../parts/blood/Heart';
import {ChestBack, ChestFront} from '../parts/blood/Chest';
import {Gauge, angOf} from '../parts/blood/Gauge';
import {heartPhase} from '../parts/blood/util';

/**
 * S15 Heart (blood) — the crash. Glossy heart in the x-ray glass chest; blood pressure dial drops
 * into the red on "crashes" 1557 while the vessels narrow; the heart races on EV.beats (~140 bpm),
 * then stumbles (1619, 1625 double, gap, 1640) and quivers; ECG low in the frame. Dip to black.
 */
export const S15Heart: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;

  // ---- camera: settles after the tilt up the body, slow push toward the heart, tiny beat bump
  const tilt = 1 - ease.outCubic(ramp(f, 0, 42));
  const push = ease.inOutSine(ramp(f, 14, 131));
  const stumble = ramp(abs, 1615, 1622);
  const s = 1.0 + 0.085 * push + 0.006 * beatPulse(abs) + 0.02 * ease.inOutSine(ramp(abs, 1612, 1650));
  const focus: [number, number] = [540 + 30 * push, 980 + 170 * tilt - 20 * push];
  const roll = 0.8 * Math.sin(f * 0.021) - 0.6 * tilt;
  const camW = camTf(focus, [540, 960], s, roll);
  // parallax: the back (spine, lungs, posterior ribs) moves less
  const sB = 1 + (s - 1) * 0.6;
  const camB = camTf([540 + 18 * push, 980 + 120 * tilt - 12 * push], [540, 960], sB, roll * 0.7);
  const sF = 1 + (s - 1) * 1.35;
  const camF = camTf([540 + 40 * push, 980 + 220 * tilt - 26 * push], [540, 960], sF, roll * 1.2);

  // ---- story values
  const crash = ease.inOutCubic(ramp(abs, 1551, 1568));
  const bp = 121 - 3 * ramp(abs, 1527, 1550) - 50 * crash + 9 * wobble(abs - 1568, 0.5, 6) + 1.6 * noise1(abs * 0.4, 3) * crash;
  const narrow = ease.inOutSine(ramp(abs, 1553, 1585));
  const danger = clamp((95 - bp) / 20);
  const quiver = stumble * (1 - ramp(abs, 1650, 1658)) * (0.65 + 0.35 * noise1(abs * 0.3, 8));
  const ph = heartPhase(abs);
  const breath = 0.5 + 0.5 * Math.sin(f * 0.075);

  const heartAt = {x: 590, y: 1000};
  const heartScale = 1.18;
  const dialPop = ease.outBack(ramp(abs, 1534, 1546));
  const dial = {x: 252, y: 612, r: 138};
  const ecgIn = ramp(abs, 1530, 1542, ease.outCubic);
  const ecgCol = mixHex(C.bloodLight, C.hudWarn, stumble);

  // HR tag: racing rate, then "IRREG" on the stumble
  const lb = lastEvent(EV.beats, abs);
  const hrPop = lb.i >= 0 ? Math.exp(-lb.since / 5) : 0;

  // screen positions for label anchors
  const lvScreen = camPt({x: heartAt.x + 150 * heartScale, y: heartAt.y + 120 * heartScale}, focus, [540, 960], s, roll);
  const na = angOf(bp);

  return (
    <AbsoluteFill style={{background: C.medBg}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <MedBg f={abs} id="s15bg" seed={15} xray glow={[[580, 1000, C.heart], [260, 1700, C.bodyGhost]]} />
        <g transform={camB}>
          <ChestBack f={abs} breath={breath} />
        </g>
        <g transform={camW}>
          <Heart
            f={abs}
            id="s15h"
            x={heartAt.x}
            y={heartAt.y}
            scale={heartScale}
            rot={-4}
            phase={ph}
            quiver={quiver}
            narrow={narrow}
            pale={0.55 * narrow}
            flow={1 - 0.5 * narrow}
            ext={460}
            halo={1.1 - 0.35 * narrow}
          />
        </g>
        <g transform={camF}>
          <ChestFront opacity={0.9} />
        </g>

        {/* blood-pressure dial */}
        <g transform={`translate(${(4 * Math.sin(f * 0.04)).toFixed(1)},${(5 * Math.sin(f * 0.033 + 1)).toFixed(1)})`}>
          <Gauge x={dial.x} y={dial.y} r={dial.r} value={bp} danger={danger} pop={dialPop} f={abs} />
          {dialPop > 0.5 && (
            <text x={dial.x} y={dial.y - dial.r - 26} textAnchor="middle" fontFamily={MONO} fontWeight={600} fontSize={22} letterSpacing={3} fill={rgba(C.hud, 0.85 * ramp(abs, 1540, 1548))}>
              BLOOD PRESSURE
            </text>
          )}
        </g>
        <Label
          f={abs}
          from={1550}
          to={1604}
          speed={0.6}
          text="BLOOD PRESSURE CRASHES"
          x={74}
          y={846}
          size={30}
          ax={dial.x + Math.cos(na) * (dial.r - 40)}
          ay={dial.y + Math.sin(na) * (dial.r - 40)}
          color={C.label}
          accent={C.hudBad}
        />
        <Label f={abs} from={1617} to={1654} speed={0.7} text="IRREGULAR BEAT" x={552} y={1290} size={32} ax={lvScreen.x} ay={lvScreen.y} accent={C.hudWarn} />

        {/* ECG strip + heart-rate tag */}
        <g opacity={ecgIn} transform={`translate(0,${(30 * (1 - ecgIn)).toFixed(1)})`}>
          <Ecg abs={abs} y={1478} h={58} x0={92} x1={990} span={80} color={ecgCol} />
          <g transform="translate(110,1376)">
            <rect x={-14} y={-38} width={stumble > 0.5 ? 172 : 214} height={50} rx={8} fill={rgba(C.navyDeep, 0.7)} stroke={rgba(ecgCol, 0.5)} strokeWidth={1.5} />
            <path
              d="M0,-12 C0,-24 16,-26 18,-14 C20,-26 36,-24 36,-12 C36,0 18,8 18,8 C18,8 0,0 0,-12 Z"
              fill={ecgCol}
              transform={`translate(18,-4) scale(${(1 + 0.25 * hrPop).toFixed(3)}) translate(-18,4)`}
            />
            <text x={50} y={0} fontFamily={TITLE} fontWeight={700} fontSize={38} fill={ecgCol} letterSpacing={1}>
              {stumble > 0.5 ? 'IRREG' : '140'}
            </text>
            {stumble <= 0.5 && (
              <text x={130} y={-2} fontFamily={MONO} fontWeight={600} fontSize={18} fill={rgba(C.hud, 0.8)}>
                BPM
              </text>
            )}
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
