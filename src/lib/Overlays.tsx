import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {C} from './palette';
import {MONO, TITLE} from './fonts';
import {clamp, ease, lerp, mixHex, ramp, rgba} from './anim';
import {EV, TL, dayAt, hoursAt, hudVis, lastEvent, lostAt, stampPulse} from './sync';

/** Fine film grain (+ a whisper of paper fibre), cycled on twos so the picture "breathes". */
export const Grain: React.FC<{strength?: number}> = ({strength = 1}) => {
  const f = useCurrentFrame();
  const i = Math.floor(f / 2) % 4;
  const dx = ((Math.floor(f / 2) * 37) % 9) - 4;
  const dy = ((Math.floor(f / 2) * 53) % 9) - 4;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <Img
        src={staticFile('tex/paper.png')}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'soft-light', opacity: 0.22 * strength}}
      />
      <Img
        src={staticFile(`tex/grain${i}.png`)}
        style={{
          position: 'absolute',
          left: -8 + dx,
          top: -8 + dy,
          width: 1096,
          height: 1936,
          mixBlendMode: 'overlay',
          opacity: 0.3 * strength,
          imageRendering: 'auto',
        }}
      />
    </AbsoluteFill>
  );
};

/** LIGHT vignette only (full-frame rule: never dark bands top + bottom). */
export const Vignette: React.FC<{amount?: number}> = ({amount = 0.2}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 90% 75% at 50% 50%, rgba(0,0,0,0) 62%, rgba(4,6,14,${amount}) 100%)`,
    }}
  />
);

const small: React.CSSProperties = {fontFamily: MONO, fontWeight: 500, fontSize: 18, letterSpacing: 3, color: C.hudDim, lineHeight: 1};

const Panel: React.FC<{left?: number; right?: number; top: number; width: number; children: React.ReactNode; tone: string; glow?: number}> = ({
  left,
  right,
  top,
  width,
  children,
  tone,
  glow = 0,
}) => (
  <div
    style={{
      position: 'absolute',
      left,
      right,
      top,
      width,
      height: 112,
      boxSizing: 'border-box',
      background: 'rgba(6,14,30,0.66)',
      border: `2px solid ${rgba(tone, 0.4 + 0.5 * glow)}`,
      borderRadius: 10,
      padding: '10px 16px',
      boxShadow: `0 6px 18px rgba(0,0,0,0.4), inset 0 0 ${(16 * glow).toFixed(1)}px ${rgba(tone, 0.45)}`,
    }}
  >
    {children}
  </div>
);

/** Colour of the danger level for a % lost (aqua -> amber -> red). Handy for scene accents too. */
export const lostTone = (lost: number) =>
  lost < 4
    ? mixHex(C.water, C.hudWarn, clamp(lost / 4) * 0.35)
    : lost < 9
      ? mixHex(C.water, C.hudWarn, 0.35 + 0.65 * clamp((lost - 4) / 5))
      : mixHex(C.hudWarn, C.hudBad, clamp((lost - 9) / 4));

/** A water-drop icon (outline) whose aqua fill drains as `fill` goes 1 -> 0. */
const DropIcon: React.FC<{fill: number; tone: string; size?: number}> = ({fill, tone, size = 60}) => {
  const d = 'M30 4 C30 4 8 30 8 44 C8 56 18 64 30 64 C42 64 52 56 52 44 C52 30 30 4 30 4 Z';
  const y = 64 - 58 * clamp(fill);
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 60 68" style={{display: 'block'}}>
      <defs>
        <clipPath id="hudDrop">
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill="rgba(255,255,255,0.06)" />
      <g clipPath="url(#hudDrop)">
        <rect x={0} y={y} width={60} height={70} fill={C.water} opacity={0.9} />
        <path d={`M0 ${y.toFixed(1)} Q15 ${(y - 3).toFixed(1)} 30 ${y.toFixed(1)} T60 ${y.toFixed(1)}`} fill="none" stroke={C.waterLight} strokeWidth={2} />
        <ellipse cx={22} cy={36} rx={4} ry={9} fill="#fff" opacity={0.5} />
      </g>
      <path d={d} fill="none" stroke={tone} strokeWidth={3.5} strokeLinejoin="round" />
    </svg>
  );
};

/**
 * Countdown HUD (top of frame, y 196–308 — keep your labels and key content below y 350):
 *  left  = "TIME WITHOUT WATER" stopwatch HH:MM (minutes spin while time races) + a DAY badge that
 *          pops on "Day one / two / three" (EV.stamps).
 *  right = "WATER LOST" % of body weight + a draining drop + a danger bar (aqua -> amber -> red).
 *  Visible from "how long would you last" until his body stops (fades out ~1762), and again during
 *  the S18 rewind, where both run backwards to zero.
 */
export const Hud: React.FC = () => {
  const f = useCurrentFrame();
  const vis = hudVis(f);
  if (vis <= 0) return null;
  const h = hoursAt(f);
  const hh = Math.floor(h + 1e-6);
  const mm = Math.min(59, Math.floor((h - hh) * 60 + 1e-6));
  const day = dayAt(f);
  const lost = lostAt(f);
  const tone = lostTone(lost);
  const racing = Math.abs(hoursAt(f) - hoursAt(f - 3)) > 0.25 ? 1 : 0;
  const stamp = stampPulse(f);
  const lastStamp = lastEvent(EV.stamps, f);
  const pop = lastStamp.i >= 0 && lastStamp.since < 20 ? ramp(lastStamp.since, 0, 9, ease.outBack) : 1;
  const rewinding = hoursAt(f) < hoursAt(f - 1) - 1e-4;
  const timeTone = rewinding ? C.waterLight : C.hud;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: vis}}>
      <Panel left={46} top={196} width={420} tone={rewinding ? C.water : C.hudDim} glow={Math.max(stamp, racing * 0.4)}>
        <div style={small}>{rewinding ? '<< REWINDING' : 'TIME WITHOUT WATER'}</div>
        <div style={{marginTop: 8, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap'}}>
          <span style={{fontFamily: MONO, fontWeight: 600, fontSize: 54, lineHeight: 1, color: timeTone, letterSpacing: 1}}>
            {String(hh).padStart(2, '0')}
            <span style={{opacity: f % 30 < 15 || racing ? 1 : 0.35}}>:</span>
            {String(mm).padStart(2, '0')}
          </span>
          <span style={{fontFamily: MONO, fontWeight: 500, fontSize: 22, color: C.hudDim, marginLeft: 6, alignSelf: 'flex-end', marginBottom: 6}}>H</span>
          {day >= 1 && (
            <span
              style={{
                marginLeft: 18,
                padding: '4px 12px 2px',
                borderRadius: 8,
                background: rgba(tone, 0.22 + 0.5 * stamp),
                border: `2px solid ${tone}`,
                fontFamily: TITLE,
                fontWeight: 700,
                fontSize: 34,
                letterSpacing: 2,
                color: C.hud,
                display: 'inline-block',
                transform: `scale(${lerp(0.6, 1, pop).toFixed(3)})`,
                transformOrigin: '0% 50%',
                boxShadow: `0 0 ${(18 * stamp).toFixed(1)}px ${tone}`,
              }}
            >
              DAY {day}
            </span>
          )}
        </div>
      </Panel>
      <Panel right={46} top={196} width={400} tone={tone} glow={clamp((lost - 9) / 6) * (0.6 + 0.4 * Math.sin(f * 0.25))}>
        <div style={{display: 'flex', alignItems: 'center'}}>
          <div style={{flex: 1}}>
            <div style={small}>WATER LOST</div>
            <div style={{marginTop: 6, display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap'}}>
              <span style={{fontFamily: MONO, fontWeight: 600, fontSize: 46, lineHeight: 1, color: tone}}>{lost.toFixed(1)}</span>
              <span style={{fontFamily: MONO, fontWeight: 600, fontSize: 28, color: tone, marginLeft: 2}}>%</span>
              <span style={{fontFamily: MONO, fontWeight: 500, fontSize: 15, color: C.hudDim, marginLeft: 10, letterSpacing: 1}}>OF BODY WT</span>
            </div>
            <div style={{marginTop: 8, height: 8, width: 262, borderRadius: 4, background: 'rgba(255,255,255,0.12)', overflow: 'hidden'}}>
              <div style={{height: 8, width: `${(clamp(lost / 15) * 100).toFixed(1)}%`, borderRadius: 4, background: `linear-gradient(90deg, ${C.water}, ${tone})`}} />
            </div>
          </div>
          <div style={{marginLeft: 8, marginTop: -4}}>
            <DropIcon fill={1 - clamp(lost / 15)} tone={tone} size={62} />
          </div>
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

/** Opening hook title over S01–S02 (abs titleIn–titleOut, y≈240–760): "WHAT IF YOU STOPPED /
 *  DRINKING WATER?" + "FOR THE REST OF YOUR LIFE". */
export const TitleCard: React.FC<{from: number; to: number}> = ({from, to}) => {
  const f = useCurrentFrame();
  if (f < from || f > to) return null;
  const out = 1 - ramp(f, to - 12, to, ease.inQuad);
  const t1 = ramp(f, from, from + 14, ease.outCubic);
  const t2 = ramp(f, from + 10, from + 26, ease.outBack);
  const t3 = ramp(f, from + 30, from + 44, ease.outCubic);
  const beat = f > from + 26 ? 1 + 0.03 * Math.max(0, Math.sin((f - from - 26) * 0.2)) : 1;
  // a drip keeps falling off the "?"
  const dripT = (((f - from - 30) % 50) + 50) % 50 / 50;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: out}}>
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 0,
          right: 0,
          height: 520,
          background: 'linear-gradient(180deg, rgba(6,14,30,0) 0%, rgba(6,14,30,0.42) 26%, rgba(6,14,30,0.42) 74%, rgba(6,14,30,0) 100%)',
        }}
      />
      <div style={{position: 'absolute', top: 330, left: 30, right: 30, textAlign: 'center'}}>
        <div
          style={{
            fontFamily: TITLE,
            fontWeight: 700,
            fontSize: 88,
            lineHeight: 1,
            letterSpacing: 2,
            color: C.cream,
            opacity: t1,
            transform: `translateY(${(1 - t1) * 30}px)`,
            textShadow: '0 6px 18px rgba(0,0,0,0.7)',
          }}
        >
          WHAT IF YOU STOPPED
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: TITLE,
            fontWeight: 700,
            fontSize: 128,
            lineHeight: 1,
            letterSpacing: 3,
            color: C.water,
            opacity: clamp(t2 * 1.4),
            transform: `translateY(${(1 - t2) * 60}px) scale(${(lerp(0.8, 1, t2) * beat).toFixed(3)})`,
            textShadow: `0 0 28px ${rgba(C.water, 0.55)}, 0 8px 20px rgba(0,0,0,0.75)`,
            position: 'relative',
          }}
        >
          DRINKING WATER?
          {f > from + 30 && (
            <span
              style={{
                position: 'absolute',
                right: 62,
                top: 112 + ease.inQuad(dripT) * 190,
                width: 16,
                height: 22,
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                background: C.waterLight,
                opacity: 0.9 * (1 - ramp(dripT, 0.75, 1)),
                boxShadow: `0 0 10px ${C.water}`,
              }}
            />
          )}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: MONO,
            fontWeight: 600,
            fontSize: 30,
            letterSpacing: 5,
            color: C.cream,
            opacity: t3 * 0.92,
            textShadow: '0 3px 10px rgba(0,0,0,0.8)',
          }}
        >
          FOR THE REST OF YOUR LIFE
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Final fade to black (timeline mark endFadeBlack). */
export const EndFade: React.FC = () => {
  const f = useCurrentFrame();
  const [a, b] = TL.marks.endFadeBlack as number[];
  if (f < a) return null;
  return <AbsoluteFill style={{background: '#000', opacity: ramp(f, a, b - 6, ease.inOutSine), pointerEvents: 'none'}} />;
};
