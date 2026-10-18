import React from 'react';
import {AbsoluteFill, Freeze, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {rangeOf} from '../lib/timing';
import {clamp, ease, hash, lerp, ramp} from '../lib/anim';
import {C} from '../lib/palette';
import {MONO} from '../lib/fonts';
// scene files imported directly (not ../scenes/index) to avoid an import cycle
import {S01Hook} from './S01Hook';
import {S02LastDrop} from './S02LastDrop';
import {S03BodyWater} from './S03BodyWater';
import {S05Thirst} from './S05Thirst';
import {S07DayOne} from './S07DayOne';
import {S09Shrivel} from './S09Shrivel';
import {S10Mirror} from './S10Mirror';
import {S11Overheat} from './S11Overheat';
import {S12Dizzy} from './S12Dizzy';
import {S14KidneysFail} from './S14KidneysFail';
import {S15Heart} from './S15Heart';
import {S16Fade} from './S16Fade';
import {S17Lifetime} from './S17Lifetime';

/**
 * S18 Rewind (lead). "Now rewind." — the reel spools backwards like a tape: the "≈ 3 DAYS" card
 * pauses with tracking wobble, then S16 → S01 replay in reverse (each scene frozen frame-by-frame
 * at decreasing local frames), faster and faster, then easing out on the morning kitchen with the
 * full glass at his lips. The global HUD clock runs back with it (timeline.json "hours" follows
 * REWIND_SEGMENTS: the clock shows the time of whichever scene is replaying).
 */

type Seg = {id: string; C: React.FC<SceneProps>; a: number; b: number; l0: number; l1: number; e?: (t: number) => number};

// absolute frames [a, b) of this scene; the source plays its LOCAL frames l0 -> l1 (backwards)
export const REWIND_SEGMENTS: Seg[] = [
  {id: 'S16', C: S16Fade, a: 1900, b: 1908, l0: 120, l1: 30},
  {id: 'S15', C: S15Heart, a: 1908, b: 1914, l0: 110, l1: 20},
  {id: 'S14', C: S14KidneysFail, a: 1914, b: 1919, l0: 110, l1: 25},
  {id: 'S12', C: S12Dizzy, a: 1919, b: 1924, l0: 70, l1: 10},
  {id: 'S11', C: S11Overheat, a: 1924, b: 1929, l0: 80, l1: 12},
  {id: 'S10', C: S10Mirror, a: 1929, b: 1934, l0: 88, l1: 15},
  {id: 'S09', C: S09Shrivel, a: 1934, b: 1940, l0: 125, l1: 30},
  {id: 'S07', C: S07DayOne, a: 1940, b: 1946, l0: 130, l1: 20},
  {id: 'S05', C: S05Thirst, a: 1946, b: 1952, l0: 140, l1: 25},
  {id: 'S03', C: S03BodyWater, a: 1952, b: 1958, l0: 110, l1: 30},
  {id: 'S02', C: S02LastDrop, a: 1958, b: 1970, l0: 100, l1: 22},
  {id: 'S01', C: S01Hook, a: 1970, b: 1995, l0: 86, l1: 6, e: ease.outCubic},
];

const PAUSE_END = 1900;

export const S18Rewind: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;

  // ---- which picture is showing
  let content: React.ReactNode;
  let segT = 0;
  let cutAge = 99;
  if (abs < PAUSE_END) {
    const r = rangeOf('S17');
    content = (
      <Freeze frame={r.len - 1}>
        <S17Lifetime start={r.start} len={r.len} />
      </Freeze>
    );
    cutAge = abs - 1888;
  } else {
    const seg = REWIND_SEGMENTS.find((s) => abs >= s.a && abs < s.b) ?? REWIND_SEGMENTS[REWIND_SEGMENTS.length - 1];
    const r = rangeOf(seg.id);
    segT = clamp((abs - seg.a) / Math.max(1, seg.b - seg.a - 1));
    const lf = Math.round(lerp(seg.l0, seg.l1, (seg.e ?? ((t: number) => t))(segT)));
    const Comp = seg.C;
    content = (
      <Freeze frame={Math.max(0, Math.min(r.len - 1, lf))}>
        <Comp start={r.start} len={r.len} />
      </Freeze>
    );
    cutAge = abs - seg.a;
  }

  // ---- tape look: speed envelope (0 = paused/normal, 1 = full rewind)
  const speed = abs < PAUSE_END ? 0.25 : Math.min(ramp(abs, 1900, 1912, ease.outQuad), 1 - ramp(abs, 1976, 1990, ease.inOutSine));
  const jitterX = (hash(abs, 3) - 0.5) * 14 * speed + (abs < PAUSE_END ? (hash(abs, 9) - 0.5) * 4 : 0);
  const jitterY = (hash(abs, 5) - 0.5) * 6 * speed;
  const skew = (hash(abs, 7) - 0.5) * 2.2 * speed;
  // big tracking band rolling down the frame (+ one at every cut)
  const bandY = ((abs * 47) % 2300) - 200;
  const cutBandY = 1920 * (1 - clamp(cutAge / 4));
  const iconIn = ramp(abs, 1889, 1896, ease.outBack);
  const iconOut = 1 - ramp(abs, 1908, 1916, ease.inQuad);
  const icon = Math.min(iconIn, iconOut);

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: `translate(${jitterX.toFixed(1)}px, ${jitterY.toFixed(1)}px) skewX(${skew.toFixed(2)}deg) scale(${(1 + 0.03 * speed).toFixed(3)})`,
          filter: `saturate(${(1 - 0.35 * speed).toFixed(3)}) contrast(${(1 + 0.12 * speed).toFixed(3)}) brightness(${(1 + 0.06 * speed).toFixed(3)})`,
        }}
      >
        {content}
      </AbsoluteFill>
      {/* cool tape tint + scanlines */}
      <AbsoluteFill style={{background: `rgba(60,200,255,${(0.1 * speed).toFixed(3)})`, mixBlendMode: 'screen', pointerEvents: 'none'}} />
      <AbsoluteFill
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)',
          opacity: 0.35 + 0.45 * speed,
          pointerEvents: 'none',
        }}
      />
      {/* tracking bands */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <g opacity={(0.25 + 0.6 * speed).toFixed(3)}>
          <rect x={0} y={bandY} width={1080} height={70} fill="rgba(235,248,255,0.16)" />
          {Array.from({length: 16}, (_, i) => (
            <rect
              key={i}
              x={hash(i + abs * 3, 11) * 1080 - 60}
              y={bandY + hash(i + abs, 13) * 70}
              width={60 + hash(i, abs) * 260}
              height={2 + hash(i, 17) * 3}
              fill="rgba(255,255,255,0.55)"
            />
          ))}
        </g>
        {cutAge < 4 && <rect x={0} y={cutBandY - 60} width={1080} height={120} fill="rgba(235,248,255,0.14)" />}
        {cutAge < 4 &&
          Array.from({length: 22}, (_, i) => (
            <rect
              key={`c${i}`}
              x={hash(i + abs * 5, 21) * 1080 - 80}
              y={cutBandY - 60 + hash(i + abs, 23) * 120}
              width={80 + hash(i, 27 + abs) * 340}
              height={2 + hash(i, 29) * 4}
              fill="rgba(255,255,255,0.7)"
            />
          ))}
        {/* the big rewind icon */}
        {icon > 0.01 && (
          <g transform={`translate(540,960) scale(${(0.6 + 0.4 * iconIn).toFixed(3)})`} opacity={icon.toFixed(3)}>
            <rect x={-230} y={-130} width={460} height={260} rx={36} fill="rgba(6,14,30,0.55)" stroke={C.waterLight} strokeWidth={5} />
            <path d="M-20,-70 L-150,0 L-20,70 Z" fill={C.cream} />
            <path d="M130,-70 L0,0 L130,70 Z" fill={C.cream} />
          </g>
        )}
      </svg>
      {icon > 0.01 && (
        <div
          style={{
            position: 'absolute',
            top: 1112,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: MONO,
            fontWeight: 600,
            fontSize: 44,
            letterSpacing: 12,
            color: C.cream,
            opacity: icon,
            textShadow: '0 3px 12px rgba(0,0,0,0.8)',
          }}
        >
          REWIND
        </div>
      )}
    </AbsoluteFill>
  );
};
