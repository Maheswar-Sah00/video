import React from 'react';
import {C} from '../lib/palette';
import {clamp, lerp, mixHex, rgba, smoothPath} from '../lib/anim';
import type {Lighting} from '../lib/scene';
import type {HeroOutfit} from './Hero';
import {CelPath, CelStrokes, localShade, shadeFor} from '../parts/hero/kit/cel';
import type {Seg} from '../parts/hero/kit/cel';

/**
 * HIS hand (+ forearm with sleeve) for close shots (owner: hero). Anime-cel.
 *
 * Origin (x,y) = the WRIST. At scale 1 the hand points UP (-y), ~210 px from wrist to fingertip,
 * ~115 px wide; the forearm + sleeve run DOWN from the wrist (~420 px, cut off; `armLen`). `rot`
 * rotates about the wrist. `mirror` = his LEFT hand (default right hand: thumb on screen-left when
 * the palm faces the camera; palm=false shows the back of the hand, thumb on screen-right).
 *
 *   pose     'relaxed' | 'open' | 'grip' (holding a tablet/phone edge: fingers curled toward the
 *            palm, thumb in front) | 'fist' | 'point' | 'onHead' (fingers splayed as if pressed
 *            into the hair — S14 head-in-hand) | 'cough' (loose fist held at the mouth)
 *   palm     true = palm toward camera, false = back of the hand (nails + knuckles)
 *   sleeve   outfit whose sleeve covers the forearm ('hoodie' charcoal sleeve + ribbed cuff,
 *            'tee'/'patient' bare forearm), or 'none' (hand only)
 *   health   1..0 (paler, thinner, knuckles/tendons show when ill) ; ivLine: an IV cannula taped on
 *            the back of the hand, its clear line running down the forearm
 *
 * ADDED optional props: poseTo + poseMix (blend two poses) · armLen · armAng (forearm direction in
 * deg relative to straight down — a bend at the wrist) · inkScale · frameRot (parent rotation so
 * the key light stays screen-fixed) · fidget 0..1 (idle finger motion, default 0.3).
 *
 * THIS REEL (no-water) — added:
 *   dry      0..1 dehydration (dryAt(abs)): duller greyer skin, thinner hand, tendons + fine dry
 *            creases on the back of the hand
 *   pose 'holdGlass'  the hand wrapped round a glass (~140 px wide at the grip), seen from the
 *            OUTSIDE: the back of the hand on screen-left of the glass, the four fingers wrapping
 *            across the FRONT of the glass (index on top), the thumb behind the glass. `palm` is
 *            ignored. PLACE THE GLASS with `heroHandGlass(handProps)` -> {x, y, rot, scale} (glass
 *            base = wrist + (64, 62) in hand units, rotated by `rot`, mirrored with `mirror`;
 *            Glass rot = hand rot). Draw order for a perfect wrap:
 *              <HeroHand {...h} layer="back"/>  <Glass {...heroHandGlass(h)} .../>  <HeroHand {...h} layer="front"/>
 *            (layer "all" = default: one call, the thumb is drawn as if seen through the glass).
 *   pose 'pinch'      side view (thumb side to camera): thumb + index tips meeting at the PINCH
 *            point (local (0,-214)), the other fingers curled. `palm` ignored. heroHandPoints(h).pinch
 *            = that point in scene space — put it on the skin you pinch (S10: rot ≈ 180, pinching
 *            down onto the back of the other hand, whose `tent` fold sits at heroHandPoints(other).tent).
 *   pose 'temple'     index + middle extended together (fingertips pressed to the temple), ring +
 *            pinky curled. Put heroHandPoints(h).tip on heroHeadPoints(head).temple. ('onHead' =
 *            fingers splayed into the hair, head-in-hand.)
 *   tent     0..1 a pinched skin fold standing up on the BACK of the hand (palm=false) that stays
 *            tented (skin-turgor test, S10): ramp it 0→1 while pinched, then let it sink back slowly.
 *   layer    'all' | 'back' | 'front' (holdGlass: back = the thumb behind the glass, front = the rest)
 * ADDED exports: heroHandPoints(props) -> scene-space {wrist knuckles tip tipIndex tipThumb pinch
 * tent glass}; heroHandGlass(props) -> Glass placement {x y rot scale} for 'holdGlass'.
 */

export type HeroHandPose = 'relaxed' | 'open' | 'grip' | 'fist' | 'point' | 'onHead' | 'cough' | 'holdGlass' | 'pinch' | 'temple';
export type HeroHandProps = {
  f: number;
  id: string;
  x: number;
  y: number;
  scale?: number;
  rot?: number;
  mirror?: boolean;
  pose?: HeroHandPose;
  palm?: boolean;
  sleeve?: HeroOutfit | 'none';
  health?: number;
  /** 0..1 dehydration look (this reel; drive with dryAt(abs)): duller greyer skin, thinner, dry creases */
  dry?: number;
  ivLine?: boolean;
  lighting?: Lighting;
  detail?: number;
  opacity?: number;
  // ---- added (optional) ----
  /** blend to a second pose (0..1) */
  poseTo?: HeroHandPose;
  poseMix?: number;
  /** forearm length below the wrist (default 420) */
  armLen?: number;
  /** forearm direction, deg relative to straight down (bend at the wrist) */
  armAng?: number;
  /** outline multiplier */
  inkScale?: number;
  /** rotation of parent groups (deg) so the key light stays screen-fixed */
  frameRot?: number;
  /** finger fidget amount (0..1, default 0.3) */
  fidget?: number;
  /** 'grip' seen from the back (palm=false): the held edge runs through the hand at this angle (deg,
   *  relative to the hand's up axis; + = clockwise) — e.g. tablet rotation minus hand rotation */
  gripEdge?: number;
  /** 'grip' (palm=false): x offset of the held edge from the wrist centre, hand units (default -22,
   *  i.e. on the thumb side). The fingers disappear behind the edge, the thumb crosses in front. */
  gripX?: number;
  /** 0..1 pinched skin fold tented on the back of the hand (palm=false) */
  tent?: number;
  /** draw only the parts behind ('back') / in front of ('front') the held glass; default 'all' */
  layer?: 'all' | 'back' | 'front';
};

// per finger: [MCP fold, PIP fold, DIP fold] in deg (fold toward the palm), splay (deg), thumb: [abduct, fold1, fold2]
type HP = {f: [number, number, number][]; splay: number; th: [number, number, number]};
const POSE: Record<HeroHandPose, HP> = {
  relaxed: {f: [[12, 22, 12], [16, 26, 14], [20, 30, 16], [26, 34, 18]], splay: 0.35, th: [26, 14, 10]},
  open: {f: [[0, 4, 2], [0, 3, 2], [2, 4, 2], [4, 6, 3]], splay: 1, th: [52, 4, 4]},
  grip: {f: [[40, 70, 40], [42, 74, 42], [44, 76, 44], [48, 78, 44]], splay: 0.15, th: [30, 20, 20]},
  fist: {f: [[84, 96, 60], [86, 98, 62], [88, 98, 62], [90, 98, 60]], splay: 0, th: [16, 40, 30]},
  point: {f: [[2, 4, 2], [84, 96, 60], [88, 98, 60], [90, 98, 60]], splay: 0.2, th: [18, 36, 26]},
  onHead: {f: [[34, 46, 26], [32, 44, 26], [34, 46, 28], [38, 48, 28]], splay: 0.7, th: [36, 18, 12]},
  cough: {f: [[58, 70, 44], [60, 72, 46], [62, 74, 46], [66, 74, 44]], splay: 0.1, th: [24, 30, 20]},
  holdGlass: {f: [[40, 70, 40], [42, 74, 42], [44, 76, 44], [48, 78, 44]], splay: 0.15, th: [30, 20, 20]},
  pinch: {f: [[50, 60, 30], [78, 92, 56], [82, 94, 58], [86, 94, 56]], splay: 0.1, th: [10, 24, 20]},
  temple: {f: [[16, 20, 10], [14, 18, 10], [70, 90, 52], [74, 92, 52]], splay: -0.28, th: [14, 40, 30]},
};

/** 'holdGlass' geometry (hand units): glass axis x, glass base y (below the wrist), radius at the grip */
const HG = {gx: 64, base: 62, R: 70};
/** 'pinch' point (hand units) */
const PINCH = {x: 0, y: -214};
/** centre of the tented fold on the back of the hand (hand units, palm=false) */
const TENT = {x: 4, y: -62};

/** Glass placement for pose 'holdGlass': pass straight into <Glass {...heroHandGlass(h)} .../>. */
export const heroHandGlass = (p: {x: number; y: number; scale?: number; rot?: number; mirror?: boolean}) => {
  const s = p.scale ?? 1;
  const r = ((p.rot ?? 0) * Math.PI) / 180;
  const fx = p.mirror ? -1 : 1;
  const lx = HG.gx * fx * s, ly = HG.base * s;
  return {x: p.x + lx * Math.cos(r) - ly * Math.sin(r), y: p.y + lx * Math.sin(r) + ly * Math.cos(r), rot: p.rot ?? 0, scale: s};
};
const mixHP = (a: HP, b: HP, t: number): HP => ({
  f: a.f.map((q, i) => q.map((v, k) => lerp(v, b.f[i][k], t)) as [number, number, number]),
  splay: lerp(a.splay, b.splay, t),
  th: a.th.map((v, k) => lerp(v, b.th[k], t)) as [number, number, number],
});

const n1 = (v: number) => v.toFixed(1);
type Pt = {x: number; y: number};

/** finger + thumb chains for the standard (palm-view authored) poses */
const handChains = (hp: HP, wx: number, f: number, fid: number) => {
  const chains: Pt[][] = [];
  const folded: boolean[] = [];
  FINGERS.forEach((fg, i) => {
    const fold = hp.f[i].map((v, k) => v + fid * 6 * Math.sin(f * 0.05 + i * 1.3 + k)) as [number, number, number];
    const spl = ((fg.splay * (0.4 + hp.splay * 1.4)) * Math.PI) / 180;
    let cx = fg.bx * wx, cy = fg.by;
    const pts: Pt[] = [{x: cx, y: cy + 10}];
    let cum = 0;
    for (let k = 0; k < 3; k++) {
      cum += fold[k];
      const L = fg.len[k] * Math.cos((Math.min(cum, 179) * Math.PI) / 180);
      cx += Math.sin(spl) * Math.abs(L) * (L >= 0 ? 1 : 0.4);
      cy -= L * Math.cos(spl);
      pts.push({x: cx, y: cy});
    }
    chains.push(pts);
    folded.push(fold[0] + fold[1] > 90);
  });
  const rd = (d: number) => (d * Math.PI) / 180;
  const thA = rd(-(18 + hp.th[0]));
  const tb = {x: -30 * wx, y: -22};
  const t1 = {x: tb.x + Math.sin(thA) * 46, y: tb.y - Math.cos(thA) * 46};
  const thB = thA + rd(hp.th[1] * 0.9);
  const l2 = 38 * Math.cos(rd(hp.th[1] * 0.6));
  const t2 = {x: t1.x + Math.sin(thB) * l2, y: t1.y - Math.cos(thB) * l2};
  const thC = thB + rd(hp.th[2]);
  const l3 = 30 * Math.cos(rd(hp.th[2] * 0.5));
  const t3 = {x: t2.x + Math.sin(thC) * l3, y: t2.y - Math.cos(thC) * l3};
  return {chains, folded, thumb: [tb, t1, t2, t3]};
};

const modeOf = (p: {pose?: HeroHandPose; poseTo?: HeroHandPose; poseMix?: number}) => {
  const k = (p.poseTo && (p.poseMix ?? 0) >= 0.5 ? p.poseTo : p.pose) ?? 'relaxed';
  return k === 'holdGlass' || k === 'pinch' ? k : null;
};

/** Named points of the hand in SCENE coordinates (same transform as the drawing). */
export const heroHandPoints = (p: HeroHandProps) => {
  const s = p.scale ?? 1;
  const r = ((p.rot ?? 0) * Math.PI) / 180;
  const mode = modeOf(p);
  const flipX = (p.mirror ? -1 : 1) * (mode ? 1 : (p.palm ?? true) ? 1 : -1);
  const at = (q: Pt) => {
    const lx = q.x * flipX * s, ly = q.y * s;
    return {x: p.x + lx * Math.cos(r) - ly * Math.sin(r), y: p.y + lx * Math.sin(r) + ly * Math.cos(r)};
  };
  const health = clamp(p.health ?? 1);
  const wx = 1.1 - clamp(1 - health + clamp(p.dry ?? 0) * 0.7) * 0.08;
  let hp = POSE[p.pose ?? 'relaxed'];
  if (p.poseTo) hp = mixHP(hp, POSE[p.poseTo], clamp(p.poseMix ?? 0));
  const ch = handChains(hp, wx, p.f, 0);
  const tipI = ch.chains[0][3], tipM = ch.chains[1][3];
  return {
    wrist: at({x: 0, y: 0}),
    knuckles: at({x: 0, y: -116}),
    /** fingertip contact point: 'temple' = index+middle tips; 'pinch' = the pinch point */
    tip: mode === 'pinch' ? at(PINCH) : at({x: (tipI.x + tipM.x) / 2, y: (tipI.y + tipM.y) / 2 - 6}),
    tipIndex: mode === 'pinch' ? at({x: PINCH.x + 6, y: PINCH.y}) : at(tipI),
    tipThumb: mode === 'pinch' ? at({x: PINCH.x - 6, y: PINCH.y + 4}) : at(ch.thumb[3]),
    pinch: at(PINCH),
    tent: at(TENT),
    glass: at({x: HG.gx, y: HG.base}),
  };
};
const line = (pts: Pt[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${n1(q.x)},${n1(q.y)}`).join(' ');
const rad = (d: number) => (d * Math.PI) / 180;

// knuckle bases (palm view, thumb on screen-left = -x), lengths of the 3 phalanges, widths
const FINGERS = [
  {bx: -36, by: -112, len: [46, 28, 22], w: 28, splay: -9},
  {bx: -12, by: -120, len: [50, 31, 23], w: 29, splay: -2},
  {bx: 13, by: -116, len: [47, 29, 22], w: 27.5, splay: 5},
  {bx: 35, by: -102, len: [37, 23, 19], w: 24, splay: 12},
];

export const HeroHand: React.FC<HeroHandProps> = (p) => {
  const f = p.f;
  const id = p.id;
  const s = p.scale ?? 1;
  const mirror = p.mirror ?? false;
  const palm = p.palm ?? true;
  const detail = clamp(p.detail ?? 1);
  const inkS = p.inkScale ?? 1;
  const ink = 4 * inkS;
  const dry = clamp(p.dry ?? 0);
  const health = clamp(p.health ?? 1);
  const thin = clamp(1 - health + dry * 0.7);
  const lighting = p.lighting ?? 'day';
  const mode = modeOf(p);
  const layer = p.layer ?? 'all';
  const flipX = (mirror ? -1 : 1) * (mode ? 1 : palm ? 1 : -1); // drawing is authored palm view, right hand
  const rot = p.rot ?? 0;
  const fr = p.frameRot ?? rot;
  const sk = localShade(shadeFor('skin', {lighting, health, dry}), fr, flipX);
  const slv = p.sleeve ?? 'hoodie';
  const slSh = localShade(shadeFor(slv === 'hoodie' ? 'sleeve' : slv === 'patient' ? 'patient' : 'tee', {lighting}), fr, flipX);
  let hp = POSE[p.pose ?? 'relaxed'];
  if (p.poseTo) hp = mixHP(hp, POSE[p.poseTo], clamp(p.poseMix ?? 0));
  const fid = clamp(p.fidget ?? 0.3);
  const wx = 1.1 - thin * 0.08;

  // ---- fingers (2D projection of folding toward the palm side)
  const fingerSegs: Seg[][] = [];
  const tips: Pt[] = [];
  const folded: boolean[] = [];
  FINGERS.forEach((fg, i) => {
    const fold = hp.f[i].map((v, k) => v + fid * 6 * Math.sin(f * 0.05 + i * 1.3 + k)) as [number, number, number];
    const spl = rad(fg.splay * (0.4 + hp.splay * 1.4));
    let cx = fg.bx * wx, cy = fg.by;
    const pts: Pt[] = [{x: cx, y: cy + 10}];
    let cum = 0;
    for (let k = 0; k < 3; k++) {
      cum += fold[k];
      const L = fg.len[k] * Math.cos(rad(Math.min(cum, 179)));
      cx += Math.sin(spl) * Math.abs(L) * (L >= 0 ? 1 : 0.4);
      cy -= L * Math.cos(spl);
      pts.push({x: cx, y: cy});
    }
    tips.push(pts[3]);
    folded.push(fold[0] + fold[1] > 90);
    fingerSegs.push([{d: line(pts), w: fg.w * wx}]);
  });
  // thumb (palm-side, from the lower thumb side of the palm)
  const thA = rad(-(18 + hp.th[0])); // abduction: swings out to screen-left
  const tb = {x: -30 * wx, y: -22};
  const t1 = {x: tb.x + Math.sin(thA) * 46, y: tb.y - Math.cos(thA) * 46};
  const thB = thA + rad(hp.th[1] * 0.9);
  const l2 = 38 * Math.cos(rad(hp.th[1] * 0.6));
  const t2 = {x: t1.x + Math.sin(thB) * l2, y: t1.y - Math.cos(thB) * l2};
  const thC = thB + rad(hp.th[2]);
  const l3 = 30 * Math.cos(rad(hp.th[2] * 0.5));
  const t3 = {x: t2.x + Math.sin(thC) * l3, y: t2.y - Math.cos(thC) * l3};
  const thumbSeg: Seg[] = [{d: line([tb, t1]), w: 40 * wx}, {d: line([t1, t2, t3]), w: 30 * wx}];

  // palm shape
  const palmD = smoothPath(
    [
      [-42 * wx, -2],
      [-54 * wx, -46],
      [-50 * wx, -96],
      [-38 * wx, -122],
      [-10 * wx, -130],
      [16 * wx, -126],
      [40 * wx, -112],
      [50 * wx, -80],
      [48 * wx, -30],
      [38 * wx, -2],
      [0, 6],
    ],
    true,
  );

  // ---- forearm / sleeve
  const armLen = p.armLen ?? 420;
  const aa = rad(p.armAng ?? 0);
  const ad = {x: -Math.sin(aa), y: Math.cos(aa)};
  const aw0 = 76 * wx, aw1 = 100 * wx;
  const armEnd = {x: ad.x * armLen, y: ad.y * armLen};
  const px = {x: ad.y, y: -ad.x}; // perpendicular
  const AP = (t: number, side: number, w: number) => ({x: ad.x * armLen * t + px.x * side * w, y: ad.y * armLen * t + px.y * side * w});
  const armD = `M${n1(AP(0, -1, aw0 / 2).x)},${n1(AP(0, -1, aw0 / 2).y)} Q${n1(AP(0.45, -1, aw1 / 2 + 6).x)},${n1(AP(0.45, -1, aw1 / 2 + 6).y)} ${n1(AP(1, -1, aw1 / 2).x)},${n1(AP(1, -1, aw1 / 2).y)} L${n1(AP(1.3, -1, aw1 / 2).x)},${n1(AP(1.3, -1, aw1 / 2).y)} L${n1(AP(1.3, 1, aw1 / 2).x)},${n1(AP(1.3, 1, aw1 / 2).y)} L${n1(AP(1, 1, aw1 / 2).x)},${n1(AP(1, 1, aw1 / 2).y)} Q${n1(AP(0.45, 1, aw1 / 2 + 2).x)},${n1(AP(0.45, 1, aw1 / 2 + 2).y)} ${n1(AP(0, 1, aw0 / 2).x)},${n1(AP(0, 1, aw0 / 2).y)} Z`;
  const sleeveEls: React.ReactNode[] = [];
  if (slv !== 'none') {
    sleeveEls.push(
      <CelPath key="arm" id={`${id}-arm`} d={armD} sh={sk} k={24} r={7} inkW={ink} flat={detail < 0.3}>
        {detail > 0.5 && slv !== 'hoodie' && <path d={line([AP(0.15, 0.2, 0), AP(0.6, 0.25, 0)])} stroke={sk.shade} strokeWidth={5 * inkS} strokeLinecap="round" opacity={0.35} transform={`translate(${n1(px.x * 18)},${n1(px.y * 18)})`} />}
      </CelPath>,
    );
    if (slv === 'hoodie') {
      const SW0 = 116 * wx, SW1 = 150 * wx;
      const SP2 = (t: number, side: number, w: number, o = 0) => ({x: ad.x * (o + armLen * t) + px.x * side * w, y: ad.y * (o + armLen * t) + px.y * side * w});
      const slvD = `M${n1(SP2(0, -1, SW0 / 2, 60).x)},${n1(SP2(0, -1, SW0 / 2, 60).y)} Q${n1(SP2(0.4, -1, SW1 / 2 + 10, 60).x)},${n1(SP2(0.4, -1, SW1 / 2 + 10, 60).y)} ${n1(SP2(1.4, -1, SW1 / 2, 60).x)},${n1(SP2(1.4, -1, SW1 / 2, 60).y)} L${n1(SP2(1.4, 1, SW1 / 2, 60).x)},${n1(SP2(1.4, 1, SW1 / 2, 60).y)} Q${n1(SP2(0.4, 1, SW1 / 2 + 4, 60).x)},${n1(SP2(0.4, 1, SW1 / 2 + 4, 60).y)} ${n1(SP2(0, 1, SW0 / 2, 60).x)},${n1(SP2(0, 1, SW0 / 2, 60).y)} Z`;
      sleeveEls.push(
        <CelPath key="sl" id={`${id}-sl`} d={slvD} sh={slSh} k={36} r={9} inkW={ink} flat={detail < 0.3}>
          {detail > 0.45 && (
            <g fill="none" stroke={slSh.shade} strokeWidth={6 * inkS} strokeLinecap="round" opacity={0.9}>
              <path d={line([SP2(0, -0.3, SW0 / 2, 90), SP2(0.25, 0.1, SW1 / 2, 90)])} />
              <path d={line([SP2(0.15, 0.5, SW1 / 2, 90), SP2(0.45, 0.2, SW1 / 2, 90)])} />
            </g>
          )}
        </CelPath>,
      );
      // ribbed cuff (a band hugging the wrist)
      const cw = 98 * wx;
      const cuffD = `M${n1(SP2(0, -1, cw / 2, 18).x)},${n1(SP2(0, -1, cw / 2, 18).y)} L${n1(SP2(0, -1, cw / 2 + 4, 68).x)},${n1(SP2(0, -1, cw / 2 + 4, 68).y)} L${n1(SP2(0, 1, cw / 2 + 4, 68).x)},${n1(SP2(0, 1, cw / 2 + 4, 68).y)} L${n1(SP2(0, 1, cw / 2, 18).x)},${n1(SP2(0, 1, cw / 2, 18).y)} Z`;
      sleeveEls.push(
        <CelPath key="cuff" id={`${id}-cuff`} d={cuffD} sh={{...slSh, lit: mixHex(slSh.lit, slSh.shade, 0.25)}} k={14} r={5} inkW={ink}>
          {detail > 0.5 &&
            [-0.7, -0.42, -0.14, 0.14, 0.42, 0.7].map((o, i) => <path key={i} d={line([SP2(0, o, cw / 2, 22), SP2(0, o, cw / 2, 64)])} stroke={slSh.shade} strokeWidth={3 * inkS} opacity={0.8} />)}
        </CelPath>,
      );
    }
  }

  const fingersNodes = fingerSegs.map((sg, i) => (
    <CelStrokes key={`f${i}`} id={`${id}-f${i}`} segs={sg} sh={sk} inkW={ink * 0.8} kPx={9} rPx={3.5} flat={detail < 0.35}>
      {detail > 0.55 && !palm && !folded[i] && (
        // nail
        <ellipse cx={n1(tips[i].x)} cy={n1(tips[i].y + 8)} rx={n1(FINGERS[i].w * 0.3)} ry={n1(FINGERS[i].w * 0.38)} fill={mixHex(sk.lit, C.skinLight, 0.6)} stroke={sk.shade} strokeWidth={2} />
      )}
    </CelStrokes>
  ));
  // which fingers lie over the palm (palm view, folded) vs behind (back view, folded)
  const fingersFront = fingersNodes.filter((_, i) => folded[i] === palm);
  const fingersBack = fingersNodes.filter((_, i) => folded[i] !== palm);
  const thumbNode = <CelStrokes key="th" id={`${id}-th`} segs={thumbSeg} sh={sk} inkW={ink * 0.8} kPx={10} rPx={4} flat={detail < 0.35} />;

  const palmNode = (
    <CelPath key="palm" id={`${id}-palm`} d={palmD} sh={sk} k={18} r={6} inkW={ink} flat={detail < 0.3}>
      {detail > 0.45 &&
        (palm ? (
          <g fill="none" stroke={sk.shade} strokeLinecap="round" strokeWidth={4 * inkS} opacity={0.75}>
            <path d="M-44,-92 Q-6,-80 40,-104" />
            <path d="M-46,-70 Q-12,-60 18,-84" opacity={0.7} />
            <path d="M-30,-20 Q-30,-60 -12,-104" />
            <ellipse cx={-30} cy={-40} rx={18} ry={26} fill={rgba(sk.lit, 0.25)} stroke="none" />
          </g>
        ) : (
          <g fill="none" stroke={sk.shade} strokeLinecap="round" strokeWidth={4 * inkS} opacity={0.6 + thin * 0.3}>
            {[-36, -12, 13, 35].map((x, i) => (
              <path key={i} d={`M${n1(x * wx * 0.6)},-30 L${n1(x * wx * 0.95)},-104`} opacity={0.5 + thin * 0.4} />
            ))}
            {[-36, -12, 13, 35].map((x, i) => (
              <path key={`k${i}`} d={`M${n1(x * wx - 7)},${n1(FINGERS[i].by + 4)} q7,-6 14,0`} />
            ))}
            {dry > 0.25 && (
              // fine dry creases (dehydrated skin)
              <path d="M-40,-46 q9,-4 16,1 M-18,-36 q10,-5 18,0 M8,-44 q9,-4 17,1 M-30,-14 q12,-5 22,0 M2,-18 q10,-4 20,1 M22,-70 q8,-3 14,1" strokeWidth={2.4 * inkS} opacity={0.75 * clamp((dry - 0.25) * 2.2)} />
            )}
          </g>
        ))}
    </CelPath>
  );
  const tent = clamp(p.tent ?? 0);
  const tentNode =
    !palm && tent > 0.01 ? (
      (() => {
        // the pinched fold: a raised ridge along the hand axis, lit on top, shadowed below, with
        // tension creases fanning out from its ends
        const h = 16 + 34 * tent, L = 46 + 16 * tent;
        const pale = mixHex(sk.lit, C.skinLight, 0.5);
        const tx = TENT.x, ty = TENT.y;
        const ridge = `M${n1(tx - L)},${n1(ty + 6)} C${n1(tx - L * 0.5)},${n1(ty - h)} ${n1(tx + L * 0.5)},${n1(ty - h)} ${n1(tx + L)},${n1(ty + 6)} C${n1(tx + L * 0.4)},${n1(ty + 4 + h * 0.5)} ${n1(tx - L * 0.4)},${n1(ty + 4 + h * 0.5)} ${n1(tx - L)},${n1(ty + 6)} Z`;
        return (
          <g opacity={clamp(tent * 3)}>
            <g fill="none" stroke={sk.deep} strokeWidth={2.6 * inkS} strokeLinecap="round" opacity={0.7 * tent}>
              <path d={`M${n1(tx - L - 2)},${n1(ty + 4)} l-24,-10 M${n1(tx - L - 2)},${n1(ty + 8)} l-24,10 M${n1(tx + L + 2)},${n1(ty + 4)} l24,-10 M${n1(tx + L + 2)},${n1(ty + 8)} l24,10 M${n1(tx - L * 0.5)},${n1(ty + 10 + h * 0.4)} l-6,14 M${n1(tx + L * 0.5)},${n1(ty + 10 + h * 0.4)} l6,14`} />
            </g>
            {/* cast shadow of the fold on the hand */}
            <path d={ridge} fill={rgba(C.ink, 0.28)} transform={`translate(${n1(8 + 6 * tent)},${n1(10 + 8 * tent)})`} />
            <path d={ridge} fill={sk.shade} transform="translate(0,5)" opacity={0.85} />
            <path d={ridge} fill={pale} stroke={C.ink} strokeWidth={ink * 0.8} strokeLinejoin="round" />
            <path d={`M${n1(tx - L * 0.6)},${n1(ty - h * 0.35)} Q${n1(tx)},${n1(ty - h * 0.85)} ${n1(tx + L * 0.6)},${n1(ty - h * 0.35)}`} fill="none" stroke={C.skinLight} strokeWidth={3.5 * inkS} strokeLinecap="round" opacity={0.75} />
            <path d={`M${n1(tx - L * 0.7)},${n1(ty + 6)} Q${n1(tx)},${n1(ty + 2 + h * 0.4)} ${n1(tx + L * 0.7)},${n1(ty + 6)}`} fill="none" stroke={sk.deep} strokeWidth={3 * inkS} strokeLinecap="round" opacity={0.7} />
          </g>
        );
      })()
    ) : null;

  // IV cannula taped on the back of the hand + its line running down the forearm
  const ivEls: React.ReactNode[] = [];
  if (p.ivLine) {
    const vis = !palm;
    if (vis) {
      ivEls.push(
        <g key="iv">
          <path d={`M4,-60 C10,-10 30,40 ${n1(ad.x * 260 + 40)},${n1(ad.y * 260)}`} fill="none" stroke={rgba(C.ink, 0.6)} strokeWidth={10 * inkS} strokeLinecap="round" />
          <path d={`M4,-60 C10,-10 30,40 ${n1(ad.x * 260 + 40)},${n1(ad.y * 260)}`} fill="none" stroke={C.ivFluid} strokeWidth={6 * inkS} strokeLinecap="round" />
          <rect x={-30} y={-84} width={62} height={44} rx={6} fill={rgba(C.pillow, 0.92)} stroke={rgba(C.ink, 0.6)} strokeWidth={2.5 * inkS} transform="rotate(-8 0 -62)" />
          <rect x={-10} y={-74} width={22} height={18} rx={4} fill={C.wardTeal} stroke={C.ink} strokeWidth={2 * inkS} transform="rotate(-8 0 -62)" />
        </g>,
      );
    } else {
      ivEls.push(<path key="ivt" d={`M-40,-50 C-30,0 -20,40 ${n1(ad.x * 260 - 30)},${n1(ad.y * 260)}`} fill="none" stroke={C.ivFluid} strokeWidth={6 * inkS} strokeLinecap="round" opacity={0.85} />);
    }
  }

  const tf = `translate(${n1(p.x)},${n1(p.y)}) rotate(${n1(rot)}) scale(${(flipX * s).toFixed(4)},${s.toFixed(4)})`;
  if (mode === 'holdGlass') {
    // ---- wrapped round a glass: hand back on the left, fingers across the glass front, thumb behind
    const sq = fid * 1.5 * Math.sin(f * 0.06);
    const {gx, R} = HG;
    const ys = [-146, -116, -87, -60];
    const ws = [27, 28, 26, 22].map((w) => w * wx);
    const ends = [72, 76, 72, 62];
    const fingerPts = ys.map((y0, i) => {
      const th0 = Math.asin(clamp((18 - gx) / (R + 10), -1, 1));
      return [0, 0.36, 0.7, 1].map((t) => {
        const th = lerp(th0, (ends[i] * Math.PI) / 180, t);
        const rr = R + ws[i] * 0.42;
        return {x: gx + rr * Math.sin(th), y: y0 + sq * (i % 2 ? 1 : -1) + 8 * Math.cos(th) + 4 * t * t};
      });
    });
    const backD = smoothPath(
      [[-36 * wx, 4], [-44 * wx, -56], [-42 * wx, -112], [-30 * wx, -152], [-6, -166], [16, -160], [26, -124], [24, -84], [18, -48], [30 * wx, 4]],
      true,
    );
    const thumbPts: Pt[] = [{x: -16, y: -146}, {x: 10, y: -176}, {x: 44, y: -188}, {x: 74, y: -182}];
    const thumbNode = (op: number) => (
      <g opacity={op}>
        <CelStrokes id={`${id}-hgt`} segs={[{d: line(thumbPts.slice(0, 2)), w: 36 * wx}, {d: line(thumbPts.slice(1)), w: 30 * wx}]} sh={sk} inkW={ink * 0.8} kPx={9} rPx={3.5} flat={detail < 0.35} />
        {op < 1 && <path d={line(thumbPts)} fill="none" stroke={rgba(C.waterLight, 0.35)} strokeWidth={26} strokeLinecap="round" />}
      </g>
    );
    const front = (
      <g key="front">
        {sleeveEls}
        <CelPath id={`${id}-hgb`} d={backD} sh={sk} k={16} r={6} inkW={ink} flat={detail < 0.3}>
          {detail > 0.45 && (
            <g fill="none" stroke={sk.shade} strokeLinecap="round" strokeWidth={4 * inkS} opacity={0.55 + thin * 0.35}>
              <path d="M-20,-24 Q-10,-80 4,-140" />
              <path d="M2,-20 Q12,-60 16,-98" opacity={0.7} />
              {dry > 0.25 && <path d="M-34,-40 q8,-4 15,1 M-30,-80 q9,-4 16,1 M-24,-110 q8,-3 14,1" strokeWidth={2.4 * inkS} opacity={clamp((dry - 0.25) * 2.2)} />}
            </g>
          )}
        </CelPath>
        {[3, 2, 1, 0].map((i) => {
          const pts = fingerPts[i];
          const tip = pts[3], pre = pts[2];
          const na = (Math.atan2(tip.y - pre.y, tip.x - pre.x) * 180) / Math.PI;
          return (
            <g key={i}>
              {/* the finger's shadow / contact on the glass */}
              <path d={smoothPath(pts.map((q) => [q.x, q.y + ws[i] * 0.45] as [number, number]))} fill="none" stroke={rgba(C.ink, 0.22)} strokeWidth={8} strokeLinecap="round" />
              <CelStrokes id={`${id}-hgf${i}`} segs={[{d: smoothPath(pts.map((q) => [q.x, q.y] as [number, number])), w: ws[i]}]} sh={sk} inkW={ink * 0.8} kPx={8} rPx={3} flat={detail < 0.35}>
                {detail > 0.5 && (
                  <path d={`M${n1(pts[1].x)},${n1(pts[1].y - ws[i] * 0.4)} q-4,${n1(ws[i] * 0.4)} 0,${n1(ws[i] * 0.8)} M${n1(pts[2].x)},${n1(pts[2].y - ws[i] * 0.38)} q-3,${n1(ws[i] * 0.38)} 0,${n1(ws[i] * 0.76)}`} fill="none" stroke={sk.shade} strokeWidth={2.6 * inkS} strokeLinecap="round" />
                )}
                {detail > 0.55 && <ellipse cx={n1(tip.x - 3)} cy={n1(tip.y)} rx={6} ry={n1(ws[i] * 0.3)} fill={mixHex(sk.lit, C.skinLight, 0.6)} stroke={sk.shade} strokeWidth={2} transform={`rotate(${n1(na)} ${n1(tip.x - 3)} ${n1(tip.y)})`} />}
              </CelStrokes>
            </g>
          );
        })}
      </g>
    );
    return (
      <g transform={tf} opacity={p.opacity ?? 1}>
        {layer !== 'front' && thumbNode(layer === 'back' ? 1 : 0.55)}
        {layer !== 'back' && front}
      </g>
    );
  }
  if (mode === 'pinch') {
    if (layer === 'back') return null;
    // ---- side view (thumb side to camera): thumb + index tips meet at PINCH, others curled
    const sq = fid * 2 * Math.sin(f * 0.07);
    const massD = smoothPath([[-34 * wx, 4], [-42 * wx, -50], [-40 * wx, -96], [-22, -128], [6, -138], [34 * wx, -124], [44 * wx, -86], [40 * wx, -40], [32 * wx, 4]], true);
    const curled = [0, 1, 2].map((i) => [{x: 26, y: -116 + i * 24}, {x: 52 * wx, y: -104 + i * 24}, {x: 46 * wx, y: -86 + i * 24}, {x: 30, y: -84 + i * 24}]);
    const idx: Pt[] = [{x: 10, y: -126}, {x: 26, y: -166}, {x: 20 + sq * 0.3, y: -198}, {x: PINCH.x + 6, y: PINCH.y + 2}];
    const thb: Pt[] = [{x: -28, y: -66}, {x: -42, y: -128}, {x: -28 - sq * 0.3, y: -176}, {x: PINCH.x - 6, y: PINCH.y + 6}];
    return (
      <g transform={tf} opacity={p.opacity ?? 1}>
        {sleeveEls}
        {curled.map((c, i) => (
          <CelStrokes key={i} id={`${id}-pc${i}`} segs={[{d: smoothPath(c.map((q) => [q.x, q.y] as [number, number])), w: 24 * wx}]} sh={{...sk, lit: mixHex(sk.lit, sk.shade, 0.3)}} inkW={ink * 0.8} kPx={7} rPx={3} flat={detail < 0.35} />
        ))}
        <CelPath id={`${id}-pm`} d={massD} sh={sk} k={16} r={6} inkW={ink} flat={detail < 0.3}>
          {detail > 0.45 && <path d="M-26,-30 Q-30,-80 -14,-116" fill="none" stroke={sk.shade} strokeWidth={4 * inkS} strokeLinecap="round" opacity={0.6} />}
        </CelPath>
        <CelStrokes id={`${id}-pi`} segs={[{d: smoothPath(idx.map((q) => [q.x, q.y] as [number, number])), w: 26 * wx}]} sh={sk} inkW={ink * 0.8} kPx={8} rPx={3} flat={detail < 0.35}>
          {detail > 0.5 && <path d={`M${n1(idx[1].x - 12)},${n1(idx[1].y + 4)} q8,-6 16,-2`} fill="none" stroke={sk.shade} strokeWidth={2.6 * inkS} strokeLinecap="round" />}
          {detail > 0.55 && <ellipse cx={n1(idx[3].x + 8)} cy={n1(idx[3].y + 10)} rx={6} ry={9} fill={mixHex(sk.lit, C.skinLight, 0.6)} stroke={sk.shade} strokeWidth={2} transform={`rotate(-30 ${n1(idx[3].x + 8)} ${n1(idx[3].y + 10)})`} />}
        </CelStrokes>
        <CelStrokes id={`${id}-pt`} segs={[{d: line(thb.slice(0, 2)), w: 34 * wx}, {d: smoothPath(thb.slice(1).map((q) => [q.x, q.y] as [number, number])), w: 29 * wx}]} sh={sk} inkW={ink * 0.8} kPx={9} rPx={3.5} flat={detail < 0.35}>
          {detail > 0.55 && <ellipse cx={n1(thb[3].x - 9)} cy={n1(thb[3].y + 12)} rx={7} ry={11} fill={mixHex(sk.lit, C.skinLight, 0.6)} stroke={sk.shade} strokeWidth={2} transform={`rotate(25 ${n1(thb[3].x - 9)} ${n1(thb[3].y + 12)})`} />}
        </CelStrokes>
      </g>
    );
  }
  if (layer === 'back') return null;

  const gripMode = !palm && ((p.pose === 'grip' && (!p.poseTo || (p.poseMix ?? 0) < 0.5)) || (p.poseTo === 'grip' && (p.poseMix ?? 0) >= 0.5));
  if (gripMode) {
    const ge = p.gripEdge ?? 0;
    const gx = p.gripX ?? -22;
    const er = (ge * Math.PI) / 180;
    // edge line through (gx, 0) at angle ge (from the hand's up axis)
    const ex = (y: number) => gx - y * Math.tan(er); // x of the edge at height y (y negative = up)
    const clipId = `${id}-gclip`;
    const clipD = `M${n1(ex(60))},60 L${n1(ex(-260))},-260 L300,-260 L300,60 Z`;
    const fid2 = fid * Math.sin(f * 0.07) * 2;
    const handD = smoothPath(
      [
        [ex(0) + 6, 4],
        [ex(-60) + 2, -60],
        [ex(-150), -150],
        [ex(-176) + 14, -182],
        [34 * wx, -176],
        [58 * wx, -138],
        [60 * wx, -80],
        [50 * wx, -26],
        [38 * wx, 6],
      ],
      true,
    );
    const fingers: Seg[][] = [0, 1, 2, 3].map((i) => {
      const y = -158 + i * 33 + (i === 3 ? 4 : 0);
      const xr = (52 - i * 3) * wx + fid2 * (i % 2 ? 1 : -1);
      return [{d: line([{x: xr, y: y + 2}, {x: ex(y) - 30, y: y - 4}]), w: (30 - i * 2) * wx}];
    });
    const tb = {x: ex(-30) + 16, y: -30};
    const tm = {x: ex(-70) - 14, y: -78};
    const tt = {x: ex(-98) - 44, y: -100 + fid2};
    return (
      <g transform={`translate(${n1(p.x)},${n1(p.y)}) rotate(${n1(rot)}) scale(${(flipX * s).toFixed(4)},${s.toFixed(4)})`} opacity={p.opacity ?? 1}>
        {sleeveEls}
        <clipPath id={clipId}>
          <path d={clipD} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <CelPath id={`${id}-gh`} d={handD} sh={sk} k={18} r={6} inkW={ink} flat={detail < 0.3}>
            {detail > 0.45 && <path d={`M${n1(40 * wx)},-24 Q${n1(54 * wx)},-90 ${n1(36 * wx)},-150`} fill="none" stroke={sk.shade} strokeWidth={5 * inkS} strokeLinecap="round" opacity={0.6} />}
          </CelPath>
          {fingers.map((sg, i) => (
            <CelStrokes key={i} id={`${id}-gf${i}`} segs={sg} sh={sk} inkW={ink * 0.8} kPx={8} rPx={3} flat={detail < 0.35} />
          ))}
          {/* contact shadow along the held edge */}
          <path d={`M${n1(ex(20))},20 L${n1(ex(-220))},-220`} stroke={rgba(C.ink, 0.55)} strokeWidth={10} />
        </g>
        {/* the thumb crosses in front of the edge */}
        <CelStrokes id={`${id}-gt`} segs={[{d: line([tb, tm]), w: 36 * wx}, {d: line([tm, tt]), w: 31 * wx}]} sh={sk} inkW={ink * 0.85} kPx={10} rPx={4} flat={detail < 0.35}>
          {detail > 0.5 && <ellipse cx={n1(tt.x + 6)} cy={n1(tt.y + 2)} rx={11} ry={8} fill={mixHex(sk.lit, C.skinLight, 0.6)} stroke={sk.shade} strokeWidth={2} transform={`rotate(${n1((Math.atan2(tt.y - tm.y, tt.x - tm.x) * 180) / Math.PI)} ${n1(tt.x + 6)} ${n1(tt.y + 2)})`} />}
        </CelStrokes>
        {ivEls}
      </g>
    );
  }

  return (
    <g transform={`translate(${n1(p.x)},${n1(p.y)}) rotate(${n1(rot)}) scale(${(flipX * s).toFixed(4)},${s.toFixed(4)})`} opacity={p.opacity ?? 1}>
      {sleeveEls}
      {palm ? null : thumbNode}
      {fingersBack}
      {palmNode}
      {tentNode}
      {fingersFront}
      {palm ? thumbNode : null}
      {ivEls}
    </g>
  );
};
