import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, handheld, hash, keys, lerp, ramp, rgba, wander} from '../lib/anim';
import {EV, dryAt} from '../lib/sync';
import {BoilDefs} from '../lib/Boil';
import {HeroHead} from '../characters/HeroHead';
import {HeroHand} from '../characters/HeroHand';
import {Glass} from '../characters/Glass';
import {Glint} from '../parts/hero/kit/cel';
import {Carton, camTf, Island, KitchenBack, Plant, Shafts, Tap, TAP_MOUTH} from '../parts/hero/kitchen';
import type {Cam} from '../parts/hero/kitchen';

/**
 * S02 LastDrop (owner: hero) — abs 81–258. MACRO at counter level: the glass (a last sip left) on
 * the stone counter, the chrome tap arching in from the top, the kitchen soft behind. noWater
 * 91–110: his hand pushes the tap lever shut (abs ~96), the thin stream breaks into drips (EV.drips
 * 112, 140); juice 118–140: a juice carton in the soft background is pushed out of frame; singleDrop
 * 147–175: THE LAST DROP swells at the tap's mouth, stretches, falls in slow motion and lands on 161
 * (EV.drips[2]) in a crown splash with sparkles, a rebound jet, ripples. everAgain 176–194: the
 * camera tilts up to HIM (worried, swallowing ~186); howLong 205–240: he glances at the camera, the
 * wall clock starts ticking at 214 (HUD clock start). Ends under the xray scan (242–258).
 */

const n1 = (v: number) => v.toFixed(1);
const TAP = {x: 240, y: 1290, s: 3.2};
const MOUTH = {x: TAP.x + TAP_MOUTH.x * TAP.s, y: TAP.y + TAP_MOUTH.y * TAP.s + 6};
const LAND = {x: MOUTH.x, y: 1530};
const GLASS = {x: 430, y: 1560, s: 2.15};

/** crown splash: t = frames since impact (slow motion), s = scale */
const Splash: React.FC<{t: number; x: number; y: number; s: number; f: number}> = ({t, x, y, s, f}) => {
  if (t < 0 || t > 60) return null;
  const T = 18; // crown life (frames)
  const u = clamp(t / T);
  const R = 34 + 120 * (1 - Math.pow(1 - u, 2.2)); // crown radius
  const H = 120 * Math.sin(Math.PI * Math.min(1, u * 0.95)) * (1 - 0.3 * u); // crown wall height
  const fade = 1 - ramp(t, 24, 40);
  const ry = 0.22;
  const N = 14;
  // crown wall: from the base ellipse up to the rim with spikes
  const rim: string[] = [];
  const base: string[] = [];
  const back: string[] = [];
  const tips: [number, number, number][] = [];
  const M = 84;
  for (let i = 0; i <= M; i++) {
    const a = (i / M) * Math.PI * 2;
    // flared sheet: the rim is much wider than the base; sharp spikes (fingers) around the rim
    const cs = Math.cos(a * N * 0.5);
    const spike = Math.pow(Math.max(0, cs), 10) * (30 + 14 * hash(Math.round((a * N) / (2 * Math.PI)), 9)) * Math.min(1, u * 2.2) - Math.pow(Math.max(0, -cs), 2) * 10 * u;
    const rr = R * (1.3 + 0.12 * u);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * ry;
    const h = H * (0.86 + 0.14 * Math.cos(a * 3 + 1)) + spike;
    const pt = `${n1(x + px * s)},${n1(y + (py - h) * s)}`;
    if (Math.sin(a) >= 0) rim.push(pt);
    else back.push(pt);
    base.push(`${n1(x + Math.cos(a) * R * 0.7 * s)},${n1(y + Math.sin(a) * R * 0.7 * ry * s)}`);
    if (cs > 0.999 && u < 0.75) tips.push([x + px * s, y + (py - h) * s, Math.sin(a)]);
  }
  // droplets thrown off the crown tips (ballistic, slow-mo)
  let drops = '';
  let dropHi = '';
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.2;
    const td = t - 6 - 2 * hash(i, 3);
    if (td < 0) continue;
    const v = 7.5 + 3.5 * hash(i, 4);
    const out = R + td * v * 0.55;
    const up = 120 + td * (6 + 3 * hash(i, 5)) - 0.22 * td * td;
    if (up < -10) continue;
    const r = 6 + 6 * hash(i, 6);
    const px = x + Math.cos(a) * out * s, py = y + (Math.sin(a) * out * ry - up) * s;
    drops += `M${n1(px - r * s)},${n1(py)} a${n1(r * s)},${n1(r * s * 1.15)} 0 1,0 ${n1(2 * r * s)},0 a${n1(r * s)},${n1(r * s * 1.15)} 0 1,0 ${n1(-2 * r * s)},0 `;
    dropHi += `M${n1(px - r * s * 0.35)},${n1(py - r * s * 0.4)} l0.1,0 `;
  }
  // rebound jet (Worthington) rising from the centre
  const tj = t - 9;
  const jetH = tj > 0 ? 170 * Math.sin(Math.PI * clamp(tj / 26)) : 0;
  const jetTop = tj > 15 ? 170 * Math.sin(Math.PI * clamp(15 / 26)) + (tj - 15) * 3 - 0.15 * (tj - 15) * (tj - 15) : jetH;
  const pinched = tj > 15;
  // ripples
  const rip = [0, 1, 2].map((k) => {
    const tr = t - k * 7;
    if (tr < 0) return null;
    const rr = 60 + tr * 9;
    return <ellipse key={k} cx={x} cy={y} rx={n1(rr * s)} ry={n1(rr * ry * s)} fill="none" stroke={rgba('#ffffff', 0.6 * (1 - clamp(tr / 34)))} strokeWidth={3} />;
  });
  return (
    <g opacity={fade}>
      {rip}
      {/* flash of light at the impact */}
      <ellipse cx={x} cy={y - 20 * s} rx={n1(260 * s)} ry={n1(120 * s)} fill="url(#s02flash)" opacity={1 - ramp(t, 0, 12)} />
      <Glint x={x} y={y - 14 * s} r={(70 - 30 * clamp(t / 8)) * s} o={1 - ramp(t, 2, 12)} col="#ffffff" />
      {/* the flattened drop at the moment of impact */}
      {t < 3 && <ellipse cx={x} cy={y - 8 * s} rx={n1((26 + t * 10) * s)} ry={n1((14 - t * 3) * s)} fill={rgba(C.waterLight, 0.9)} stroke={rgba(C.waterDeep, 0.8)} strokeWidth={2} />}
      {u < 1 && (
        <g>
          {/* back half of the crown (dimmer), then the front half */}
          <path d={`M${back.join(' L')}`} fill="none" stroke={rgba(C.waterDeep, 0.6)} strokeWidth={7 * s} strokeLinejoin="round" opacity={1 - u * 0.6} />
          <path d={`M${back.join(' L')}`} fill="none" stroke={rgba(C.waterLight, 0.9)} strokeWidth={3.5 * s} strokeLinejoin="round" opacity={1 - u * 0.6} />
          <path d={`M${base.slice(0, M / 2 + 1).join(' L')} L${[...rim].reverse().join(' L')} Z`} fill={rgba(C.water, 0.42)} stroke={rgba(C.waterDeep, 0.85)} strokeWidth={2.5 * s} strokeLinejoin="round" opacity={1 - u * 0.6} />
          <path d={`M${rim.slice(4, rim.length - 4).join(' L')}`} fill="none" stroke={rgba(C.waterLight, 0.85)} strokeWidth={14 * s} opacity={0.8 - u * 0.5} transform={`translate(0,${n1(16 * s)})`} />
          {tips.map(([tx, ty, sn], i) => (
            <g key={i} opacity={1 - u}>
              <circle cx={n1(tx)} cy={n1(ty - 4 * s)} r={n1((6 + 3 * sn) * s)} fill={rgba(C.waterLight, 0.95)} stroke={rgba(C.waterDeep, 0.9)} strokeWidth={2.5} />
              <circle cx={n1(tx - 2 * s)} cy={n1(ty - 7 * s)} r={n1(2 * s)} fill="#ffffff" />
            </g>
          ))}
          <path d={`M${rim.join(' L')}`} fill="none" stroke="#ffffff" strokeWidth={5 * s} strokeLinejoin="round" opacity={0.95 - u * 0.5} />
          <path d={`M${rim.join(' L')}`} fill="none" stroke={rgba(C.waterGlow, 0.7)} strokeWidth={12 * s} strokeLinejoin="round" opacity={0.7 - u * 0.5} transform={`translate(0,${n1(9 * s)})`} />
        </g>
      )}
      {jetH > 1 && (
        <g>
          <path d={`M${n1(x - 13 * s)},${n1(y)} Q${n1(x - 7 * s)},${n1(y - jetH * 0.6 * s)} ${n1(x)},${n1(y - jetH * s)} Q${n1(x + 7 * s)},${n1(y - jetH * 0.6 * s)} ${n1(x + 13 * s)},${n1(y)} Z`} fill={rgba(C.waterLight, 0.88)} stroke={rgba(C.waterDeep, 0.9)} strokeWidth={3} />
          <path d={`M${n1(x - 4 * s)},${n1(y - 10 * s)} L${n1(x - 2 * s)},${n1(y - jetH * 0.8 * s)}`} stroke="#fff" strokeWidth={3 * s} strokeLinecap="round" opacity={0.8} />
        </g>
      )}
      {pinched && jetTop > -20 && (
        <g>
          <circle cx={x} cy={n1(y - (jetTop + 18) * s)} r={n1(15 * s)} fill={rgba(C.waterLight, 0.92)} stroke={rgba(C.waterDeep, 0.9)} strokeWidth={3} />
          <circle cx={n1(x - 5 * s)} cy={n1(y - (jetTop + 24) * s)} r={n1(4 * s)} fill="#fff" />
        </g>
      )}
      <path d={drops} fill={rgba(C.waterLight, 0.92)} stroke={rgba(C.waterDeep, 0.9)} strokeWidth={3} />
      <path d={dropHi} stroke="#ffffff" strokeWidth={4 * s} strokeLinecap="round" />
      {/* sparkles catching the sun */}
      {[0, 1, 2, 3, 4].map((k) => {
        const a = k * 1.3 + 0.4;
        const tw = Math.max(0, Math.sin(f * 0.35 + k * 2.2));
        return <Glint key={k} x={x + Math.cos(a) * R * s * 0.9} y={y + (Math.sin(a) * R * ry - H * 0.9) * s} r={(16 + 10 * tw) * s * (1 - u * 0.5)} o={tw * (1 - ramp(t, 14, 30))} col="#ffffff" />;
      })}
    </g>
  );
};

/** one hanging / falling drop. phase: 'swell' (r grows at the mouth), 'fall' (y from mouth to land). */
const DropShape: React.FC<{x: number; y: number; r: number; stretch: number; neck?: number}> = ({x, y, r, stretch, neck = 0}) => {
  const h = r * (1.25 + stretch);
  return (
    <g>
      {neck > 0 && <path d={`M${n1(x - 7)},${n1(y - h - neck)} Q${n1(x - 3)},${n1(y - h * 0.6)} ${n1(x - r * 0.8)},${n1(y - h * 0.4)} L${n1(x + r * 0.8)},${n1(y - h * 0.4)} Q${n1(x + 3)},${n1(y - h * 0.6)} ${n1(x + 7)},${n1(y - h - neck)} Z`} fill={rgba(C.waterLight, 0.75)} stroke={rgba(C.waterDeep, 0.7)} strokeWidth={2} />}
      <path d={`M${n1(x)},${n1(y - h)} C${n1(x + r * 0.5)},${n1(y - h * 0.55)} ${n1(x + r)},${n1(y - r * 0.6)} ${n1(x + r)},${n1(y)} A${n1(r)},${n1(r)} 0 0 1 ${n1(x - r)},${n1(y)} C${n1(x - r)},${n1(y - r * 0.6)} ${n1(x - r * 0.5)},${n1(y - h * 0.55)} ${n1(x)},${n1(y - h)} Z`} fill={rgba(C.waterLight, 0.82)} stroke={rgba(C.waterDeep, 0.85)} strokeWidth={2.4} />
      <path d={`M${n1(x + r * 0.55)},${n1(y - r * 0.1)} A${n1(r * 0.7)},${n1(r * 0.7)} 0 0 1 ${n1(x - r * 0.2)},${n1(y + r * 0.62)}`} fill="none" stroke={rgba(C.waterDeep, 0.5)} strokeWidth={3} />
      <ellipse cx={n1(x - r * 0.35)} cy={n1(y - r * 0.25)} rx={n1(r * 0.22)} ry={n1(r * 0.32)} fill="#ffffff" />
      <circle cx={n1(x + r * 0.35)} cy={n1(y + r * 0.4)} r={n1(r * 0.12)} fill="#ffffff" opacity={0.8} />
    </g>
  );
};

export const S02LastDrop: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const [d1, d2, d3] = EV.drips;

  // ======================================================== shot A — the macro
  const pan = ramp(abs, 176, 194, ease.inOutCubic); // tilt up to his face
  const blurPx = 9 * Math.sin(Math.PI * pan);
  const slow = ramp(abs, 150, 158) * (1 - ramp(abs, 172, 180)); // slow-motion feel
  const hh = handheld(abs, 4, 0.025, 3);
  // follow the last drop down from the tap's mouth and push in hard on the splash
  const dive = ramp(abs, 148, 161, ease.inOutSine);
  const camA: Cam = {
    fx: lerp(lerp(540, 700, ramp(abs, 98, 146, ease.inOutSine)), 777, dive) + hh.x * (1 - dive * 0.6),
    fy: lerp(lerp(1040, 1110, ramp(abs, 81, 146, ease.inOutSine)), 1407, dive) + hh.y * (1 - dive * 0.6),
    z: lerp(lerp(1.0, 1.12, ramp(abs, 81, 146)), 1.55, dive) + 0.1 * ramp(abs, 161, 178, ease.outQuad),
    ox: lerp(-20, 30, ramp(abs, 81, 176)),
  };

  // tap lever: open (thin stream) until his hand pushes it shut ~96–102
  const handle = 1 - ramp(abs, 95, 102, ease.inOutCubic);
  const lv = ((-20 - handle * 50) * Math.PI) / 180;
  const lvEnd = (() => {
    const lx = -96, ly = -118 + 96; // relative to the pivot (0,-96)
    const rx = lx * Math.cos(lv) - ly * Math.sin(lv), ry = lx * Math.sin(lv) + ly * Math.cos(lv);
    return {x: TAP.x + rx * TAP.s, y: TAP.y + (-96 + ry) * TAP.s};
  })();
  const handIn = ramp(abs, 86, 95, ease.outCubic) * (1 - ramp(abs, 104, 116, ease.inCubic));
  const handA = {x: lerp(-260, lvEnd.x - 30, handIn), y: lerp(lvEnd.y + 260, lvEnd.y + 70, handIn)};
  // stream thins and breaks after the lever closes
  const stream = 1 - ramp(abs, 99, 106);
  // drips: swell at the mouth, fall to the counter, land on the event frame
  const dripState = () => {
    // returns the drop currently hanging/falling
    const ev = [
      {e: d1, sw: d1 - 26, fall: 6},
      {e: d2, sw: d2 - 26, fall: 6},
      {e: d3, sw: d2 + 2, fall: 9}, // THE last drop: swells right after the previous, slow fall
    ];
    for (const q of ev) {
      if (abs >= q.sw && abs < q.e) {
        const det = q.e - q.fall;
        if (abs < det) {
          const t = ramp(abs, q.sw, det, ease.outQuad);
          const r = lerp(4, q.e === d3 ? 25 : 16, t);
          return {x: MOUTH.x, y: MOUTH.y + r * 0.9 + t * (q.e === d3 ? 26 : 12), r, stretch: t * (q.e === d3 ? 0.9 : 0.5), neck: t > 0.6 ? (t - 0.6) * (q.e === d3 ? 50 : 24) : 0, last: q.e === d3};
        }
        const tf = ramp(abs, det, q.e, ease.inQuad);
        const r = q.e === d3 ? 24 : 15;
        return {x: MOUTH.x, y: lerp(MOUTH.y + r + (q.e === d3 ? 30 : 14), LAND.y - r, tf), r, stretch: 0.25 + 0.3 * tf, neck: 0, last: q.e === d3};
      }
    }
    return null;
  };
  const drip = dripState();
  const lastSince = abs - d3;
  const smallSplash = (e: number) => {
    const t = abs - e;
    if (t < 0 || t > 14) return null;
    return (
      <g key={e} opacity={1 - t / 14}>
        <ellipse cx={LAND.x} cy={LAND.y} rx={20 + t * 7} ry={(20 + t * 7) * 0.22} fill="none" stroke="#ffffff" strokeWidth={3} />
        {[-1, 1, -0.4, 0.5].map((k, i) => (
          <circle key={i} cx={n1(LAND.x + k * (10 + t * 6))} cy={n1(LAND.y - 30 * Math.sin(Math.PI * clamp(t / 10)) * (1 - Math.abs(k) * 0.3))} r={5} fill={rgba(C.waterLight, 0.85)} stroke={rgba(C.waterDeep, 0.7)} strokeWidth={1.5} />
        ))}
      </g>
    );
  };
  const wet = ramp(abs, 84, 106) * 0.8 + 0.2 * ramp(abs, d3, d3 + 10);
  // juice carton pushed out of frame (soft background)
  const push = ramp(abs, 120, 137, ease.inOutCubic);
  const handJ = ramp(abs, 112, 121, ease.outCubic) * (1 - ramp(abs, 137, 146, ease.inCubic));

  // ======================================================== shot B — his face
  const camB: Cam = {fx: 520 + handheld(abs, 3, 0.03, 9).x, fy: 1020 + handheld(abs, 3, 0.03, 9).y, z: lerp(1.04, 1.16, ramp(abs, 180, 258, ease.inOutSine)), ox: lerp(20, -20, ramp(abs, 180, 258))};
  const glance = ramp(abs, 208, 220, ease.inOutCubic);
  const tick = abs < 214 ? 0 : Math.floor((abs - 214) / 30) + ease.outBack(clamp(((abs - 214) % 30) / 5));
  const swallow = ramp(abs, 184, 198);
  const headB = {
    f: abs,
    id: 's02h',
    x: 430,
    y: 1090 + 4 * Math.sin(abs * 0.07) - 10 * glance,
    scale: 1.1,
    turn: lerp(0.42, 0.14, glance),
    tilt: lerp(-0.3, -0.04, ramp(abs, 186, 222, ease.inOutSine)),
    expression: 'content' as const,
    blendTo: 'worried' as const,
    blend: 0.25 + 0.55 * ramp(abs, 176, 200),
    look: [lerp(0.4, 0, glance), lerp(0.8, 0, glance)] as [number, number],
    dry: dryAt(abs),
    outfit: 'tee' as const,
    shoulders: true,
    chestTo: 820,
    swallow,
    hairFlow: 0.38,
    hairDir: [-0.4 * Math.sin(Math.PI * glance), 0] as [number, number],
    lighting: 'day' as const,
  };

  const yA = pan * 1920;
  const yB = (pan - 1) * 1920;
  return (
    <AbsoluteFill style={{background: C.kitchenWall}}>
      {/* ---------------- shot A: soft background (blurred) */}
      {pan < 1 && (
        <AbsoluteFill style={{transform: `translateY(${n1(yA)}px)`, filter: `blur(${n1(7 + blurPx)}px)`}}>
          <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
            <defs>
              <linearGradient id="s02bgw" x1={0} y1={0} x2={1} y2={1}>
                <stop offset={0} stopColor={C.morning} />
                <stop offset={0.5} stopColor={C.tile} />
                <stop offset={1} stopColor={C.tileShade} />
              </linearGradient>
              <radialGradient id="s02bok">
                <stop offset={0} stopColor="#ffffff" stopOpacity={0.95} />
                <stop offset={0.7} stopColor={C.morning} stopOpacity={0.5} />
                <stop offset={1} stopColor={C.morning} stopOpacity={0} />
              </radialGradient>
            </defs>
            <g transform={camTf(camA, 0.4)}>
              <rect x={-400} y={-400} width={1900} height={2000} fill="url(#s02bgw)" />
              {/* big macro tiles */}
              {Array.from({length: 9}, (_, i) => <path key={i} d={`M${-400 + i * 260},-400 L${-400 + i * 260},1300`} stroke={C.tileShade} strokeWidth={6} />)}
              {Array.from({length: 8}, (_, i) => <path key={`h${i}`} d={`M-400,${-300 + i * 220} L1500,${-300 + i * 220}`} stroke={C.tileShade} strokeWidth={6} />)}
              {/* window glow + bokeh (top-left) */}
              <rect x={-400} y={-400} width={760} height={900} fill={C.morning} opacity={0.85} />
              <rect x={-120} y={-400} width={40} height={900} fill={C.cream} />
              <path d={`M-400,180 L360,180`} stroke={C.cream} strokeWidth={30} />
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <circle key={i} cx={-200 + hash(i, 3) * 640 + wander(abs * 0.01 + i, 4) * 20} cy={-260 + hash(i, 5) * 640} r={50 + 70 * hash(i, 6)} fill="url(#s02bok)" opacity={0.5 + 0.4 * Math.sin(abs * 0.04 + i)} />
              ))}
              <Plant f={abs} x={-60} y={560} s={2.2} seed={3} />
              <Plant f={abs} x={260} y={600} s={1.8} seed={8} kind="tall" pot={C.tile} />
              {/* cabinets top-right */}
              <rect x={760} y={-400} width={900} height={760} fill={C.wood} />
              <rect x={800} y={-360} width={340} height={660} rx={10} fill={C.woodLight} opacity={0.6} />
              <rect x={1180} y={-360} width={340} height={660} rx={10} fill={C.woodLight} opacity={0.6} />
              <rect x={760} y={360} width={900} height={60} fill={C.woodShade} />
              {/* the back counter edge */}
              <rect x={-400} y={1240} width={1900} height={60} fill={C.counter} />
            </g>
            {/* juice carton on the back counter, pushed out of frame by his (soft) hand */}
            <g transform={camTf(camA, 0.6)}>
              <Carton x={930 + push * 620} y={1270} s={1.9} rot={push * 14 * (1 - push)} />
              {handJ > 0 && <HeroHand f={abs} id="s02hj" x={lerp(1260, 790 + push * 620, handJ)} y={lerp(560, 860, handJ)} rot={-118} scale={1.7} pose="open" palm={false} sleeve="tee" armAng={-10} detail={0.6} lighting="day" />}
            </g>
          </svg>
        </AbsoluteFill>
      )}
      {/* ---------------- shot A: sharp macro (counter, glass, tap, drops) */}
      {pan < 1 && (
        <AbsoluteFill style={{transform: `translateY(${n1(yA)}px)`, filter: blurPx > 0.3 ? `blur(${n1(blurPx)}px)` : undefined}}>
          <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
            <defs>
              <linearGradient id="s02ct" x1={0} y1={0} x2={0} y2={1}>
                <stop offset={0} stopColor={C.counterShade} />
                <stop offset={0.18} stopColor={C.counter} />
                <stop offset={0.6} stopColor={mixWarm(C.counter)} />
                <stop offset={1} stopColor={C.counterShade} />
              </linearGradient>
              <radialGradient id="s02flash">
                <stop offset={0} stopColor="#ffffff" stopOpacity={0.9} />
                <stop offset={0.4} stopColor={C.waterLight} stopOpacity={0.45} />
                <stop offset={1} stopColor={C.waterLight} stopOpacity={0} />
              </radialGradient>
              <radialGradient id="s02wet">
                <stop offset={0} stopColor={C.waterLight} stopOpacity={0.55} />
                <stop offset={0.8} stopColor={C.water} stopOpacity={0.22} />
                <stop offset={1} stopColor={C.water} stopOpacity={0} />
              </radialGradient>
            </defs>
            <g transform={camTf(camA, 1)}>
              {/* counter top (stone) running off the bottom */}
              <rect x={-300} y={1300} width={1700} height={900} fill="url(#s02ct)" />
              <path d="M-300,1300 L1400,1300" stroke={rgba(C.ink, 0.6)} strokeWidth={4} />
              <path d="M-300,1306 L1400,1306" stroke={rgba('#ffffff', 0.5)} strokeWidth={3} />
              {Array.from({length: 60}, (_, i) => (
                <ellipse key={i} cx={n1(-250 + hash(i, 11) * 1600)} cy={n1(1320 + Math.pow(hash(i, 12), 0.7) * 700)} rx={n1((2 + 5 * hash(i, 13)) * (1 + hash(i, 12)))} ry={n1(1.5 + 2 * hash(i, 13))} fill={rgba(i % 3 ? C.counterShade : '#ffffff', 0.55)} />
              ))}
              {/* sun streak across the stone */}
              <path d="M-300,1420 L1400,1340 L1400,1470 L-300,1600 Z" fill={rgba(C.morning, 0.3)} />
              {/* wet patch where the stream / drips land */}
              <ellipse cx={LAND.x} cy={LAND.y} rx={150} ry={34} fill="url(#s02wet)" opacity={wet} />
              <ellipse cx={LAND.x - 30} cy={LAND.y - 4} rx={40} ry={6} fill="#ffffff" opacity={0.35 * wet} />
              {/* the glass (a last sip left) + its reflection in the polished stone */}
              <g transform={`translate(0,${n1(2 * GLASS.y)}) scale(1,-1)`} opacity={0.18}>
                <Glass f={abs} id="s02gr" x={GLASS.x} y={GLASS.y} scale={GLASS.s} level={0.18} condensation={0} detail={0.3} sparkle={0} />
              </g>
              <Glass f={abs} id="s02g" x={GLASS.x} y={GLASS.y} scale={GLASS.s} level={0.18} slosh={0.15 + 0.5 * (1 - ramp(abs, 81, 100))} condensation={0.75} ground={1} sparkle={0.7} />
              {/* the tap arching in from the top */}
              <Tap id="s02tap" x={TAP.x} y={TAP.y} s={TAP.s} handle={handle} />
              <Glint x={TAP.x - 16} y={TAP.y - 700 + 140 * Math.sin(abs * 0.03)} r={22} o={0.6 + 0.4 * Math.sin(abs * 0.2)} col="#ffffff" />
              <Glint x={TAP.x + 60 * TAP.s} y={TAP.y - 318 * TAP.s + 10} r={26} o={0.5 + 0.5 * Math.sin(abs * 0.17 + 1)} col="#ffffff" />
              {/* the running stream (until the tap is shut) */}
              {stream > 0.01 && (
                <g>
                  <path d={`M${MOUTH.x - 10 * stream},${MOUTH.y} L${MOUTH.x - 6 * stream},${LAND.y} L${MOUTH.x + 6 * stream},${LAND.y} L${MOUTH.x + 10 * stream},${MOUTH.y} Z`} fill={rgba(C.waterLight, 0.7)} stroke={rgba(C.waterDeep, 0.6)} strokeWidth={2} />
                  <path d={`M${MOUTH.x - 3 * stream},${MOUTH.y + 10} L${MOUTH.x - 2 * stream},${LAND.y - 10}`} stroke="#ffffff" strokeWidth={3 * stream + 0.5} />
                  {[0, 1, 2, 3, 4].map((i) => {
                    const yy = MOUTH.y + (((abs * 40 + i * 190) % 950));
                    return <ellipse key={i} cx={MOUTH.x} cy={yy} rx={9 * stream} ry={4} fill="#ffffff" opacity={0.6} />;
                  })}
                  <ellipse cx={LAND.x} cy={LAND.y} rx={40 * stream} ry={9 * stream} fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.8} />
                </g>
              )}
              {/* breaking stream: a couple of loose drops */}
              {abs >= 101 && abs < 110 && [0, 1].map((i) => {
                const t = ramp(abs, 101 + i * 3, 106 + i * 3, ease.inQuad);
                if (t <= 0 || t >= 1) return null;
                return <DropShape key={i} x={MOUTH.x} y={lerp(MOUTH.y + 20, LAND.y - 10, t)} r={8 - i * 2} stretch={0.5} />;
              })}
              {smallSplash(106)}
              {smallSplash(d1)}
              {smallSplash(d2)}
              {/* the hanging / falling drop */}
              {drip && (
                <g>
                  {drip.last && abs >= d3 - 9 && (
                    // slow-motion trail behind the last drop
                    <path d={`M${drip.x},${n1(drip.y - drip.r * 2.2)} L${drip.x},${n1(Math.max(MOUTH.y + 30, drip.y - 220))}`} stroke={rgba(C.waterLight, 0.35)} strokeWidth={drip.r * 0.9} strokeLinecap="round" />
                  )}
                  <DropShape x={drip.x} y={drip.y} r={drip.r} stretch={drip.stretch} neck={drip.neck} />
                  {drip.last && <Glint x={drip.x - drip.r * 0.3} y={drip.y - drip.r * 0.3} r={drip.r * 1.3} o={0.7 + 0.3 * Math.sin(abs * 0.6)} col="#ffffff" />}
                </g>
              )}
              <Splash t={lastSince * (1 - 0.45 * slow)} x={LAND.x} y={LAND.y} s={1.75} f={abs} />
              {/* his hand pushing the lever shut */}
              {handIn > 0.01 && <HeroHand f={abs} id="s02ha" x={handA.x} y={handA.y} rot={58} scale={1.75} pose="grip" poseTo="relaxed" poseMix={1 - ramp(abs, 92, 97)} palm={false} sleeve="tee" armAng={-20} lighting="day" />}
            </g>
            {/* slow-motion: a soft vignette + light bloom while the last drop falls */}
            <rect width={1080} height={1920} fill="url(#s02flash)" opacity={0.0} />
          </svg>
        </AbsoluteFill>
      )}
      {/* ---------------- shot A: foreground dust motes (slow in the slow-mo) */}
      {pan < 1 && (
        <AbsoluteFill style={{transform: `translateY(${n1(yA * 1.2)}px)`}}>
          <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
            <g transform={camTf(camA, 1.4)}>
              <Shafts f={abs - 40 * slow} id="s02sh" motes={22} />
            </g>
          </svg>
        </AbsoluteFill>
      )}
      {/* ---------------- shot B: his face in the kitchen */}
      {pan > 0 && (
        <AbsoluteFill style={{transform: `translateY(${n1(yB)}px)`, filter: blurPx > 0.3 ? `blur(${n1(blurPx)}px)` : undefined}}>
          <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
            <defs>
              <BoilDefs id="s02boil" f={abs} scale={2} />
              <radialGradient id="s02bloom" cx="0.12" cy="0.12" r="0.75">
                <stop offset={0} stopColor={C.morning} stopOpacity={0.5} />
                <stop offset={1} stopColor={C.morningGlow} stopOpacity={0} />
              </radialGradient>
            </defs>
            <g transform={camTf(camB, 0.35)}>
              <KitchenBack f={abs} id="s02k" clock={{x: 880, y: 900, r: 62, sec: tick / 60 + 0.05}} />
            </g>
            <g transform={camTf(camB, 0.6)}>
              <Shafts f={abs} id="s02s" motes={22} />
            </g>
            <g transform={camTf(camB, 1)}>
              <g filter="url(#s02boil)">
                <HeroHead {...headB} />
              </g>
              <Island f={abs} id="s02i" y0={1660} />
              <Glass f={abs} id="s02g3" x={600} y={1700} scale={1.25} level={0.18} condensation={0.6} ground={1} sparkle={0.5} />
            </g>
            <rect width={1080} height={1920} fill="url(#s02bloom)" style={{mixBlendMode: 'screen'}} />
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const mixWarm = (c: string) => c; // (kept simple: the counter colour; warmth comes from the sun streak)
