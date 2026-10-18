import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {clamp, ease, lerp, ramp} from './lib/anim';
import {H, W} from './lib/anim';

export type TDef = {type: string; dur: number; fx?: number; fy?: number; color?: string} | null;

const R_FULL = Math.hypot(W, H);

/**
 * Wraps one scene inside its Sequence and applies the incoming transition (first inT.dur
 * frames) and the outgoing transition (last outT.dur frames). Local frame 0 = Sequence start.
 */
export const TransitionWrap: React.FC<{
  len: number;
  inT: TDef;
  outT: TDef;
  children: React.ReactNode;
}> = ({len, inT, outT, children}) => {
  const f = useCurrentFrame();
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let opacity = 1;
  let blur = 0;
  let origin = '50% 50%';
  let clip: string | undefined;
  let mask: string | undefined;
  const overlays: React.ReactNode[] = [];
  const free: React.ReactNode[] = []; // drawn above the scene, NOT clipped by it
  let filter2 = '';

  if (inT && f < inT.dur) {
    const p = clamp(f / inT.dur);
    switch (inT.type) {
      case 'zoomIn': {
        // grows out of the focal point through a soft ellipse that stays inside the scene's own
        // (scaled) bounds until it covers the frame, so no rectangular edge ever shows
        const s = lerp(0.7, 1, ease.outCubic(p));
        scale *= s;
        opacity *= ramp(p, 0, 0.3);
        blur += 6 * (1 - ease.outQuad(p));
        const k = p < 0.6 ? lerp(0.25, 1, ease.outQuad(p / 0.6)) : lerp(1, 1.7, ease.inQuad((p - 0.6) / 0.4));
        if (p < 0.97) mask = `radial-gradient(ellipse ${(540 * s * k).toFixed(0)}px ${(960 * s * k).toFixed(0)}px at 50% 50%, #000 62%, transparent 100%)`;
        break;
      }
      case 'zoomOut':
        // starts larger than the frame (always covers it) and settles; quick fade so little black shows
        scale *= lerp(2.1, 1, ease.outCubic(p));
        opacity *= ramp(p, 0, 0.45, ease.outQuad);
        blur += 6 * (1 - ease.outQuad(p));
        break;
      case 'fade':
        opacity *= ease.inOutSine(p);
        break;
      case 'flash':
        opacity *= ramp(p, 0.35, 0.6);
        break;
      case 'dip':
        // dip through black: the new scene fades up out of black in the second half
        opacity *= ramp(p, 0.5, 1, ease.inOutSine);
        break;
      case 'fill': {
        const q = ramp(p, 0.5, 1, ease.inOutCubic);
        clip = `circle(${(q * R_FULL * 0.62).toFixed(1)}px at 50% 50%)`;
        if (q <= 0) opacity = 0;
        break;
      }
      case 'slideUp':
        ty += lerp(H * 0.75, 0, ease.inOutCubic(p));
        blur += 4 * Math.sin(p * Math.PI);
        break;
      case 'slideDown':
        ty += lerp(-H * 0.75, 0, ease.inOutCubic(p));
        blur += 4 * Math.sin(p * Math.PI);
        break;
      case 'xray':
      case 'xrayUp': {
        // an x-ray scan line sweeps down (xray) / up (xrayUp) the frame; the incoming scene is
        // revealed behind it, a cool glowing band rides the edge
        const q = ease.inOutSine(p);
        const edge = inT.type === 'xray' ? q * (H + 80) - 40 : H + 40 - q * (H + 80);
        clip = inT.type === 'xray' ? `inset(0px 0px ${Math.max(0, H - edge).toFixed(1)}px 0px)` : `inset(${Math.max(0, edge).toFixed(1)}px 0px 0px 0px)`;
        free.push(<ScanBand key="scan" y={edge} up={inT.type === 'xrayUp'} a={Math.sin(p * Math.PI) * 0.6 + 0.4 * (p < 0.98 ? 1 : 0)} />);
        break;
      }
      case 'whip': {
        // whip pan: the new scene arrives from the right, motion-blurred
        const e = ease.inOutCubic(p);
        tx += W * 0.985 * (1 - e);
        blur += 14 * Math.sin(p * Math.PI);
        break;
      }
      case 'rack':
        // rack focus: the incoming scene sharpens out of a soft blur as it fades up
        opacity *= ease.inOutSine(p);
        blur += 12 * (1 - ease.outQuad(p));
        scale *= lerp(1.04, 1, ease.outCubic(p));
        break;
      case 'clock': {
        // time jump: the incoming scene is revealed by a clock hand sweeping once round the frame
        // (12 o'clock, clockwise) with a faint dial — used on "Day one / two / three"
        const q = ease.inOutSine(p);
        const deg = q * 360;
        if (p < 0.985) mask = `conic-gradient(from 0deg at 50% 50%, #000 ${deg.toFixed(2)}deg, transparent ${(deg + 0.8).toFixed(2)}deg)`;
        free.push(<ClockHand key="clock" deg={deg} p={p} />);
        break;
      }
      case 'page': {
        // journal page turn: the new page is uncovered right -> left behind a tilted, curling edge
        const e = ease.inOutCubic(p);
        const xTop = lerp(W + 40, -560, e);
        const xBot = xTop + 520;
        clip = `polygon(${xTop.toFixed(1)}px 0px, ${W + 600}px 0px, ${W + 600}px ${H}px, ${xBot.toFixed(1)}px ${H}px)`;
        free.push(<PageCurl key="page" xTop={xTop} xBot={xBot} p={p} />);
        break;
      }
    }
  }

  if (outT && f >= len - outT.dur) {
    const p = clamp((f - (len - outT.dur)) / outT.dur);
    const fx = outT.fx ?? W / 2;
    const fy = outT.fy ?? H / 2;
    switch (outT.type) {
      case 'zoomIn':
        // stays opaque underneath the incoming scene (scale > 1 always covers the frame)
        origin = `${fx}px ${fy}px`;
        scale *= lerp(1, 2.6, ease.inCubic(p));
        blur += 8 * ease.inQuad(p);
        break;
      case 'zoomOut': {
        // shrinks into a soft ellipse instead of showing a hard rectangle
        origin = `${fx}px ${fy}px`;
        scale *= lerp(1, 0.45, ease.inCubic(p));
        opacity *= 1 - ramp(p, 0.5, 1);
        blur += 4 * ease.inQuad(p);
        const k = lerp(1.7, 0.7, ease.outQuad(p));
        mask = `radial-gradient(ellipse ${(540 * k).toFixed(0)}px ${(960 * k).toFixed(0)}px at ${fx}px ${fy}px, #000 60%, transparent 100%)`;
        break;
      }
      case 'fill': {
        const q = ramp(p, 0, 0.5, ease.inOutCubic);
        overlays.push(
          <AbsoluteFill
            key="fill"
            style={{background: outT.color ?? '#000', clipPath: `circle(${(q * R_FULL * 0.62).toFixed(1)}px at ${fx}px ${fy}px)`}}
          />,
        );
        scale *= lerp(1, 1.25, ease.inQuad(p));
        origin = `${fx}px ${fy}px`;
        break;
      }
      case 'slideUp':
        ty += lerp(0, -H * 0.75, ease.inOutCubic(p));
        blur += 4 * Math.sin(p * Math.PI);
        break;
      case 'slideDown':
        ty += lerp(0, H * 0.75, ease.inOutCubic(p));
        blur += 4 * Math.sin(p * Math.PI);
        break;
      case 'flash':
        scale *= lerp(1, 1.06, p);
        break;
      case 'whip': {
        const e = ease.inOutCubic(p);
        tx -= W * 0.985 * e;
        blur += 14 * Math.sin(p * Math.PI);
        break;
      }
      case 'rack':
        blur += 12 * ease.inQuad(p);
        scale *= lerp(1, 1.03, p);
        break;
      case 'xray':
      case 'xrayUp':
        // the outgoing picture gets a faint cool x-ray cast as the scan passes
        filter2 = `saturate(${(1 - 0.5 * p).toFixed(3)}) hue-rotate(${(-18 * p).toFixed(1)}deg)`;
        break;
      case 'dip':
        // dip through black: the old scene fades to black in the first half (and stays black)
        overlays.push(<AbsoluteFill key="dip" style={{background: '#000', opacity: ramp(p, 0, 0.5, ease.inOutSine)}} />);
        break;
      case 'clock':
        // the old scene dims a touch as time sweeps past it
        filter2 = `brightness(${(1 - 0.3 * Math.sin(p * Math.PI)).toFixed(3)})`;
        break;
      case 'page':
        // the old page darkens a touch as it is turned away
        filter2 = `brightness(${(1 - 0.25 * ease.inQuad(p)).toFixed(3)})`;
        break;
      default:
        break;
    }
  }

  const filt = [blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : '', filter2].filter(Boolean).join(' ');
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{opacity, clipPath: clip, maskImage: mask, WebkitMaskImage: mask}}>
        <AbsoluteFill
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: origin,
            filter: filt || undefined,
          }}
        >
          {children}
        </AbsoluteFill>
        {overlays}
      </AbsoluteFill>
      {free}
    </AbsoluteFill>
  );
};

/** The glowing x-ray scan line (pale cyan-white, soft falloff toward the revealed side). */
const ScanBand: React.FC<{y: number; up: boolean; a: number}> = ({y, up, a}) => {
  const h = 150;
  const top = up ? y : y - h;
  const grad = up
    ? 'linear-gradient(180deg, rgba(220,245,255,0.95) 0%, rgba(160,220,240,0.35) 6%, rgba(120,200,230,0.12) 40%, rgba(120,200,230,0) 100%)'
    : 'linear-gradient(0deg, rgba(220,245,255,0.95) 0%, rgba(160,220,240,0.35) 6%, rgba(120,200,230,0.12) 40%, rgba(120,200,230,0) 100%)';
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, height: h, background: grad, opacity: clamp(a), pointerEvents: 'none', mixBlendMode: 'screen'}}>
      <div style={{position: 'absolute', left: 0, right: 0, [up ? 'top' : 'bottom']: -2, height: 4, background: 'rgba(240,252,255,0.95)', boxShadow: '0 0 18px rgba(170,230,255,0.9)'}} />
    </div>
  );
};

/** The curling paper edge of a turning journal page (cream back of the page + a soft shadow). */
const PageCurl: React.FC<{xTop: number; xBot: number; p: number}> = ({xTop, xBot, p}) => {
  const w = 90 * Math.sin(Math.min(1, p * 1.15) * Math.PI) + 8;
  if (p >= 0.99) return null;
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <defs>
        <linearGradient id="curlG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9c99c" />
          <stop offset="0.55" stopColor="#f3e9cf" />
          <stop offset="1" stopColor="#b9a676" />
        </linearGradient>
        <linearGradient id="curlS" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <polygon points={`${xTop - 70},0 ${xTop},0 ${xBot},${H} ${xBot - 70},${H}`} fill="url(#curlS)" />
      <polygon points={`${xTop},0 ${xTop + w},0 ${xBot + w * 0.7},${H} ${xBot},${H}`} fill="url(#curlG)" stroke="#6b5a3a" strokeWidth={2} />
    </svg>
  );
};

/** The sweeping clock hand + a faint 12-tick dial for 'clock' boundaries. */
const ClockHand: React.FC<{deg: number; p: number}> = ({deg, p}) => {
  if (p >= 0.995) return null;
  const a = Math.sin(Math.min(1, p) * Math.PI);
  const th = (deg * Math.PI) / 180;
  const cx = W / 2;
  const cy = H / 2;
  const L = 1150;
  const hx = cx + Math.sin(th) * L;
  const hy = cy - Math.cos(th) * L;
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <g opacity={(0.55 * a).toFixed(3)}>
        <circle cx={cx} cy={cy} r={430} fill="none" stroke="rgba(230,248,255,0.7)" strokeWidth={4} />
        {Array.from({length: 12}, (_, i) => {
          const t = (i / 12) * Math.PI * 2;
          const r0 = i % 3 === 0 ? 380 : 400;
          return (
            <line
              key={i}
              x1={cx + Math.sin(t) * r0}
              y1={cy - Math.cos(t) * r0}
              x2={cx + Math.sin(t) * 430}
              y2={cy - Math.cos(t) * 430}
              stroke="rgba(230,248,255,0.9)"
              strokeWidth={i % 3 === 0 ? 8 : 4}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <g opacity={(0.25 + 0.75 * a).toFixed(3)}>
        <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="rgba(120,220,255,0.35)" strokeWidth={26} strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="rgba(240,252,255,0.95)" strokeWidth={6} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={18} fill="rgba(240,252,255,0.95)" />
        <circle cx={cx} cy={cy} r={34} fill="none" stroke="rgba(120,220,255,0.6)" strokeWidth={4} />
      </g>
    </svg>
  );
};

/** Screen flash for 'flash' boundaries (drawn above both scenes). */
export const FlashLayer: React.FC<{at: number; dur: number; color: string}> = ({at, dur, color}) => {
  const f = useCurrentFrame();
  const d = f - at;
  const half = dur / 2;
  if (Math.abs(d) > half + 1) return null;
  const v = d < 0 ? ramp(d, -half, 0, ease.inQuad) : 1 - ramp(d, 0, half * 1.6, ease.outQuad);
  return <AbsoluteFill style={{background: color, opacity: clamp(v) * 0.92, pointerEvents: 'none'}} />;
};
