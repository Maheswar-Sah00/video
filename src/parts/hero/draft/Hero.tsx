import React from 'react';
import {C} from '../../../lib/palette';
import {clamp, lerp, mixHex, smoothPath, wander} from '../../../lib/anim';
import type {Lighting} from '../../../lib/scene';
import {CelPath, CelStrokes, localShade, shadeFor} from '../kit/cel';
import type {Seg, Shade} from '../kit/cel';
import {HeroHead as HeroHead} from './HeroHead';

/**
 * HIM, full figure (owner: hero). Anime-cel; the head is HeroHead (same design, scaled).
 *
 * Anime-cel 2D (storyboard): a young man ~20, slim, ~7.5 heads tall, messy black hair, warm tan
 * skin, dark-brown eyes. See docs/BUILD.md "Character lock".
 *
 * Origin (x,y) = his NAVEL. At scale 1 standing: head-top at y-470, chin y-330, shoulders ±150
 * at y-290, hips y+60, knees y+250, soles y+440 (≈ 910 px tall). Other poses keep the navel as
 * origin (sitDesk: seated, forearms on a desk top at y-60; lieBed: lying on his back, head toward
 * screen-LEFT, the body horizontal, navel at origin, the bed surface at y+60 (drawn in profile,
 * face up); sitLedge: seated on a ledge at y+60, legs dangling, hands on the ledge beside the hips).
 *
 *   pose      'stand' | 'walk' | 'lookUp' | 'sitDesk' | 'lieBed' | 'sitLedge' | 'holdTablet'
 *   poseTo / poseMix  blend to a second pose (0..1) for transitions inside a shot
 *   outfit    'hoodie' (charcoal zip hoodie open over the light-grey tee, jeans, white sneakers)
 *             | 'tee' (just the grey tee + jeans) | 'patient' (light-blue tee + light-blue trousers)
 *   backpack  draw the black backpack (straps over both shoulders; the full pack in back views)
 *   view      'front' | 'threeQuarter' | 'profile' | 'back' | 'backThreeQuarter'
 *   facing    1 = faces screen-RIGHT (his RIGHT side toward camera), -1 = screen-LEFT
 *   expression 'smile' | 'content' | 'tired' | 'pain' | 'worried' | 'calm' | 'sleep' | 'hopeful'
 *   blendTo / blend   blend to a second expression
 *   health    1 healthy .. 0 very ill (paler/greyer skin, dark under-eyes, thinner face, slower)
 *   breath    0..1 chest rise (default: an automatic slow breath)
 *   walkPhase  0..1 gait cycle for pose 'walk' (default: from f)
 *   cough     0..1 cough jolt (body hunches forward, head dips) — drive with coughPulse(abs)
 *   cannula   draw the clear nasal oxygen tube (path 2)
 *   lighting  see lib/scene.ts
 *   rim       0..1 coloured rim-light strength
 *   detail    0..1 (lower = fewer strokes; < 0.35 = flat fills — use for figures < ~200 px tall)
 * The head blinks by itself; hair stirs with f. ADDED export: heroPoints(props) -> scene-space
 * {head chest handL handR footL footR navel}.
 *
 * THIS REEL (no-water) — added:
 *   dry       0..1 dehydration (pass dryAt(abs)): the real dry look on the head (cracked lips, sunken
 *             eyes, dull grey skin, hollow cheeks, messy dull hair), duller skin on arms/hands,
 *             shoulders sag a little, the head hangs lower, idle sway and walk swing get smaller
 *             and heavier. Independent of `health`.
 *   pose 'sitSofa'  seated on a sofa seat: the seat surface at y+60 (= hip joints), thighs coming
 *             forward (end-on in 'front' view, horizontal in 'profile'; 'threeQuarter' in between),
 *             shins down to the floor (soles at ≈ y+300 front / y+320 profile), hands resting on
 *             the thighs near the knees. Blend to 'stand' with poseTo='stand' + poseMix 0→1 (S12):
 *             the blend adds the get-up motion (head + chest pitch forward, arms push off) at mid-way.
 *             Use `anchor="feet"` so the soles stay planted on the floor while he rises.
 *   anchor    'navel' (default: (x,y) = navel) | 'feet' ((x,y) = the floor under his soles in the
 *             CURRENT pose — handy for sit→stand and walking, the body bobs above the floor)
 *   'walk'    reads facing camera / three-quarter too: body bob (up at passing), the swing leg's
 *             foot lifts, the opposite arm swings forward (forearm foreshortens), hips sway, the
 *             shoulders counter-tilt. Drive the gait with walkPhase (or let f drive it: 34 f/cycle).
 */

export type HeroPose = 'stand' | 'walk' | 'lookUp' | 'sitDesk' | 'lieBed' | 'sitLedge' | 'holdTablet' | 'sitSofa';
export type HeroOutfit = 'hoodie' | 'tee' | 'patient';
export type HeroExpr = 'smile' | 'content' | 'tired' | 'pain' | 'worried' | 'calm' | 'sleep' | 'hopeful';
export type HeroView = 'front' | 'threeQuarter' | 'profile' | 'back' | 'backThreeQuarter';

export type HeroProps = {
  f: number;
  id: string;
  x: number;
  y: number;
  scale?: number;
  rot?: number;
  pose?: HeroPose;
  poseTo?: HeroPose;
  poseMix?: number;
  outfit?: HeroOutfit;
  backpack?: boolean;
  view?: HeroView;
  facing?: 1 | -1;
  expression?: HeroExpr;
  blendTo?: HeroExpr;
  blend?: number;
  health?: number;
  /** 0..1 dehydration look (this reel; drive with dryAt(abs)) — see the header */
  dry?: number;
  /** 'navel' (default) | 'feet': (x,y) = the floor under his soles */
  anchor?: 'navel' | 'feet';
  breath?: number;
  walkPhase?: number;
  cough?: number;
  cannula?: boolean;
  lighting?: Lighting;
  rim?: number;
  detail?: number;
  opacity?: number;
};

// ------------------------------------------------------------------ rig (navel origin, facing 1, scale 1)
const LU = 150, LF = 136, LT = 198, LS = 186;
const SHO = {x: 96, y: -280};
const HIP = {x: 52, y: 62};
const NECK = {x: 0, y: -314};
const HEAD_S = 0.315;

type PoseV = {
  spine: number; head: number; tilt: number; shrug: number;
  aLu: number; aLe: number; aLo: number; aLk: number; aLf: number;
  aRu: number; aRe: number; aRo: number; aRk: number; aRf: number;
  lLh: number; lLk: number; lLt: number; lLs: number;
  lRh: number; lRk: number; lRt: number; lRs: number;
};
// angles: 0 = pointing down, +90 = screen-right, ±180 = up; e/k = bend relative to the parent.
const base: PoseV = {spine: 0, head: 0, tilt: 0, shrug: 0, aLu: -9, aLe: 8, aLo: 0.35, aLk: 1, aLf: 1, aRu: 9, aRe: -8, aRo: 0.35, aRk: 1, aRf: 1, lLh: -3, lLk: 2, lLt: 1, lLs: 1, lRh: 3, lRk: -2, lRt: 1, lRs: 1};
// sitSofa: 'front' values (thighs end-on toward the camera) and 'profile' values (thighs horizontal);
// the view's yaw blends between them (see sofaPose)
const SOFA_FRONT: Partial<PoseV> = {spine: 0, head: 4, tilt: -0.06, shrug: -6, aLu: -7, aLe: 26, aLo: 0.3, aRu: 7, aRe: -26, aRo: 0.3, lLh: -9, lLk: 11, lLt: 0.12, lLs: 1.12, lRh: 9, lRk: -11, lRt: 0.12, lRs: 1.12};
const SOFA_SIDE: Partial<PoseV> = {spine: -9, head: -2, tilt: -0.08, shrug: -12, aLu: 10, aLe: 24, aLo: 0.3, aRu: 16, aRe: 18, aRo: 0.3, lLh: 86, lLk: -86, lLt: 0.8, lLs: 1.05, lRh: 90, lRk: -88, lRt: 0.76, lRs: 1.05};
const sofaPose = (view: HeroView): Partial<PoseV> => {
  const k = Math.min(1, Math.abs(Math.sin((VIEW_YAW[view] * Math.PI) / 180)) * 1.08);
  const o: Partial<PoseV> = {};
  (Object.keys(SOFA_FRONT) as (keyof PoseV)[]).forEach((q) => (o[q] = lerp((SOFA_FRONT[q] ?? base[q]) as number, (SOFA_SIDE[q] ?? base[q]) as number, k)));
  return o;
};
const POSES: Record<HeroPose, Partial<PoseV>> = {
  stand: {},
  sitSofa: SOFA_FRONT,
  walk: {},
  lookUp: {spine: -3, tilt: 0.55, head: -4, aLu: -6, aLe: 4, aRu: 6, aRe: -4},
  sitDesk: {spine: 10, head: 8, tilt: -0.25, shrug: -14, aLu: -26, aLe: 96, aLk: 0.72, aRu: 26, aRe: -96, aRk: 0.72, lLh: -14, lLk: 10, lLt: 0.38, lRh: 14, lRk: -10, lRt: 0.38},
  lieBed: {spine: 0, head: 0, aLu: -3, aLe: 2, aRu: 3, aRe: -2, lLh: -1, lLk: 1, lRh: 1, lRk: -1},
  sitLedge: {spine: 12, head: -2, tilt: 0.34, aLu: -16, aLe: 16, aLo: 0.5, aRu: 8, aRe: 34, aRo: 0.55, aRk: 0.95, lLh: 80, lLk: -84, lLt: 0.72, lRh: 86, lRk: -80, lRt: 0.66},
  holdTablet: {spine: 4, head: 6, tilt: -0.3, aLu: -14, aLe: 118, aLo: 0.6, aRu: 14, aRe: -118, aRo: 0.6},
};
const VIEW_YAW: Record<HeroView, number> = {front: 0, threeQuarter: 38, profile: 88, backThreeQuarter: 142, back: 180};
const VIEW_W: Record<HeroView, number> = {front: 1, threeQuarter: 0.84, profile: 0.6, backThreeQuarter: 0.86, back: 1};
const VIEW_SH: Record<HeroView, number> = {front: 1, threeQuarter: 0.72, profile: 0.22, backThreeQuarter: 0.7, back: 1};

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (a: number) => ({x: Math.sin(rad(a)), y: Math.cos(rad(a))});
type V = {x: number; y: number};
const add = (p: V, d: V, k: number) => ({x: p.x + d.x * k, y: p.y + d.y * k});
const rotAbout = (p: V, c: V, a: number) => {
  const r = rad(a), cs = Math.cos(r), sn = Math.sin(r);
  const dx = p.x - c.x, dy = p.y - c.y;
  return {x: c.x + dx * cs - dy * sn, y: c.y + dx * sn + dy * cs};
};
const n1 = (v: number) => v.toFixed(1);
const line = (pts: V[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${n1(q.x)},${n1(q.y)}`).join(' ');
const SPv = (pts: V[], closed = false) => smoothPath(pts.map((q) => [q.x, q.y] as [number, number]), closed);

const poseOf = (k: HeroPose, view: HeroView): Partial<PoseV> => (k === 'sitSofa' ? sofaPose(view) : POSES[k]);
const poseAt = (p: HeroProps, f: number): PoseV => {
  const k = p.pose ?? 'stand';
  const view0: HeroView = p.view ?? 'front';
  let v: PoseV = {...base, ...poseOf(k, view0)};
  if (p.poseTo) {
    const b: PoseV = {...base, ...poseOf(p.poseTo, view0)};
    const t = clamp(p.poseMix ?? 0);
    const o = {} as PoseV;
    (Object.keys(v) as (keyof PoseV)[]).forEach((q) => (o[q] = lerp(v[q], b[q], t)));
    v = o;
  }
  const o = {...v};
  const health = clamp(p.health ?? 1);
  const dry = clamp(p.dry ?? 0);
  const slow = 1 - (1 - health) * 0.5;
  // sit -> stand: the get-up motion peaks mid-blend (head + chest pitch forward, arms push off)
  if (p.poseTo && ((k === 'sitSofa' && p.poseTo !== 'sitSofa') || (p.poseTo === 'sitSofa' && k !== 'sitSofa'))) {
    const bump = Math.sin(Math.PI * clamp(p.poseMix ?? 0));
    const side = Math.min(1, Math.abs(Math.sin((VIEW_YAW[view0] * Math.PI) / 180)) * 1.08);
    o.head += 14 * bump;
    o.tilt -= 0.32 * bump;
    o.spine -= 22 * bump * side;
    o.shrug += 8 * bump;
    o.aLu -= 6 * bump * side;
    o.aRu -= 10 * bump * side;
    o.aLe -= 8 * bump;
    o.aRe += 4 * bump;
  }
  // dehydrated: shoulders sag, the head hangs a little
  o.shrug -= 7 * dry;
  o.head += 5 * dry;
  o.tilt -= 0.12 * dry;
  // idle life: tiny sway of the arms + head (smaller + heavier when dehydrated)
  const amp = (k === 'lieBed' ? 0.6 : 1.6) * (1 - 0.4 * dry);
  (['aLu', 'aRu', 'aLe', 'aRe', 'head'] as (keyof PoseV)[]).forEach((q, i) => (o[q] += wander(f * 0.02 * slow + i * 3.1, 300 + i) * amp));
  // walk cycle
  if (k === 'walk' || p.poseTo === 'walk') {
    const w = k === 'walk' ? 1 - clamp(p.poseMix ?? 0) * (p.poseTo ? 1 : 0) : clamp(p.poseMix ?? 0);
    const ph = (p.walkPhase ?? (f / 34) % 1) * Math.PI * 2;
    const view = p.view ?? 'front';
    const side = view === 'profile' ? 1 : view === 'threeQuarter' || view === 'backThreeQuarter' ? 0.8 : 0.22;
    const heavy = 1 - 0.3 * dry;
    const ws = w * side * heavy;
    o.aLu += ws * 22 * Math.sin(ph);
    o.aRu -= ws * 22 * Math.sin(ph);
    o.aLe += ws * 14 * Math.max(0, Math.sin(ph));
    o.aRe -= ws * 14 * Math.max(0, -Math.sin(ph));
    o.lLh -= ws * 24 * Math.sin(ph);
    o.lRh += ws * 24 * Math.sin(ph);
    o.lLk += ws * 34 * Math.max(0, Math.sin(ph + 1.2));
    o.lRk -= ws * 34 * Math.max(0, -Math.sin(ph + 1.2));
    // toward the camera: the swing leg lifts (foreshortens), the opposite arm swings forward (the
    // forearm foreshortens, the elbow bends), hips + shoulders counter-tilt
    const fr = w * (1 - side * 0.6) * heavy;
    const liftL = Math.max(0, Math.cos(ph)), liftR = Math.max(0, -Math.cos(ph));
    o.lLt *= 1 - fr * 0.2 * liftL;
    o.lLs *= 1 - fr * 0.3 * liftL;
    o.lRt *= 1 - fr * 0.2 * liftR;
    o.lRs *= 1 - fr * 0.3 * liftR;
    o.lLh -= fr * 7 * liftL;
    o.lLk += fr * 12 * liftL;
    o.lRh += fr * 7 * liftR;
    o.lRk -= fr * 12 * liftR;
    o.aLe += fr * 36 * liftR;
    o.aLf *= 1 - fr * 0.4 * liftR;
    o.aRe -= fr * 36 * liftL;
    o.aRf *= 1 - fr * 0.4 * liftL;
    o.aLu += fr * 5 * liftR;
    o.aRu -= fr * 5 * liftL;
    o.shrug += w * 3 * Math.cos(ph) * heavy;
    o.head += w * 1.5 * Math.sin(ph * 2);
  }
  const cough = clamp(p.cough ?? 0);
  o.spine += cough * 14;
  o.head += cough * 10;
  o.tilt -= cough * 0.4;
  o.shrug += cough * 16;
  return o;
};

export const heroRig = (p: HeroProps, f = p.f) => {
  const v = poseAt(p, f);
  const view: HeroView = (p.pose ?? 'stand') === 'lieBed' && !p.view ? 'profile' : p.view ?? 'front';
  const wsh = VIEW_SH[view];
  const breath = clamp(p.breath ?? 0.5 + 0.5 * Math.sin(f * 0.055));
  const pivot = {x: 0, y: -30};
  const chest = (q: V) => rotAbout(q, pivot, -v.spine);
  const shY = SHO.y - v.shrug - breath * 4;
  const shL = chest({x: -SHO.x * wsh, y: shY}), shR = chest({x: SHO.x * wsh, y: shY});
  const neck = chest(NECK);
  const hipL = {x: -HIP.x * VIEW_SH[view] * 0.9 - (view === 'profile' ? 4 : 0), y: HIP.y}, hipR = {x: HIP.x * VIEW_SH[view] * 0.9 + (view === 'profile' ? 4 : 0), y: HIP.y};
  const sp = -v.spine;
  const arm = (s: V, u: number, e: number, k: number, kf = 1) => {
    const el = add(s, dir(u + sp), LU * k);
    const wr = add(el, dir(u + e + sp), LF * kf);
    return {el, wr, ha: u + e + sp};
  };
  const leg = (h: V, a: number, k: number, kt: number, ks: number) => {
    const kn = add(h, dir(a), LT * kt);
    const ank = add(kn, dir(a + k), LS * ks);
    return {kn, ank, fa: a + k};
  };
  const aL = arm(shL, v.aLu, v.aLe, v.aLk, v.aLf);
  const aR = arm(shR, v.aRu, v.aRe, v.aRk, v.aRf);
  const lL = leg(hipL, v.lLh, v.lLk, v.lLt, v.lLs);
  const lR = leg(hipR, v.lRh, v.lRk, v.lRt, v.lRs);
  const headA = sp - v.head;
  const headC = add(neck, dir(180 + headA), 84);
  // walk: body bob (up at passing) + hip sway; anchor 'feet' shifts the origin to the floor
  let bob = {x: 0, y: 0};
  const k0 = p.pose ?? 'stand';
  if (k0 === 'walk' || p.poseTo === 'walk') {
    const w = k0 === 'walk' ? 1 - clamp(p.poseMix ?? 0) * (p.poseTo ? 1 : 0) : clamp(p.poseMix ?? 0);
    const ph = (p.walkPhase ?? (f / 34) % 1) * Math.PI * 2;
    bob = {x: w * 5 * Math.sin(ph), y: -w * 9 * (1 - Math.abs(Math.sin(ph))) * (1 - 0.3 * clamp(p.dry ?? 0))};
  }
  let anchorY = 0;
  if (p.anchor === 'feet') {
    const sole = view === 'front' || view === 'back' ? 26 : 24;
    anchorY = Math.max(lL.ank.y, lR.ank.y) + sole;
    bob = {x: bob.x, y: 0};
  }
  return {v, shL, shR, neck, hipL, hipR, aL, aR, lL, lR, headA, headC, chest, breath, wsh, bob, anchorY};
};

/** Named points in scene coordinates. */
export const heroPoints = (p: HeroProps) => {
  const rig = heroRig(p);
  const s = p.scale ?? 1;
  const fc = p.facing ?? 1;
  const lying = (p.pose ?? 'stand') === 'lieBed';
  const a = rad((p.rot ?? 0) + (lying ? -90 : 0));
  const at = (q: V) => {
    const X = (q.x + rig.bob.x) * fc * s, Y = (q.y + rig.bob.y - rig.anchorY) * s;
    return {x: p.x + X * Math.cos(a) - Y * Math.sin(a), y: p.y + X * Math.sin(a) + Y * Math.cos(a)};
  };
  return {
    head: at(rig.headC),
    chest: at(rig.chest({x: 0, y: -170})),
    handL: at(add(rig.aL.wr, dir(rig.aL.ha), 34)),
    handR: at(add(rig.aR.wr, dir(rig.aR.ha), 34)),
    footL: at(rig.lL.ank),
    footR: at(rig.lR.ank),
    navel: at({x: 0, y: 0}),
  };
};

const autoBlink = (f: number, seed: number) => {
  let t = -200 + seed * 37;
  let k = 0;
  let last = -1e9;
  while (t <= f && k < 200) {
    last = t;
    t += 70 + 80 * ((Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1;
    k++;
  }
  const d = f - last;
  return d < 0 ? 0 : d < 2 ? d / 2 : d < 4 ? 1 : d < 7 ? 1 - (d - 4) / 3 : 0;
};

export const Hero: React.FC<HeroProps> = (p) => {
  const s = p.scale ?? 1;
  const f = p.f;
  const id = p.id;
  const fc = p.facing ?? 1;
  const pose = p.pose ?? 'stand';
  const lying = pose === 'lieBed';
  const view: HeroView = lying && !p.view ? 'profile' : p.view ?? 'front';
  const rotT = (p.rot ?? 0) + (lying ? -90 : 0);
  const detail = clamp(p.detail ?? 1);
  const flat = detail < 0.35;
  const ink = 3.4;
  const outfit = p.outfit ?? 'hoodie';
  const health = clamp(p.health ?? 1);
  const dry = clamp(p.dry ?? 0);
  const lighting = p.lighting ?? 'day';
  const lk = {lighting, rim: p.rim};
  const L = (m: Parameters<typeof shadeFor>[0], h = 1) => localShade(shadeFor(m, {...lk, health: h}), rotT, fc);
  const skin = localShade(shadeFor('skin', {...lk, health, dry}), rotT, fc);
  const tee = L(outfit === 'patient' ? 'patient' : 'tee');
  const hood = L('hoodie');
  const trs: Shade = outfit === 'patient' ? {...L('patient'), lit: mixHex(C.patientTee, C.patientTeeShade, 0.45), shade: mixHex(C.patientTeeShade, C.jeansShade, 0.3)} : L('jeans');
  const shoe = L('shoe');
  const pack = L('backpack');
  const rig = heroRig(p);
  const {aL, aR, lL, lR, v} = rig;
  const wx = VIEW_W[view];
  const back = view === 'back' || view === 'backThreeQuarter';
  const thin = (1 - health) * 0.08 + dry * 0.04;

  // ---------- torso
  const tPt = (x: number, y: number) => (y < -30 ? rig.chest({x: x * wx * (1 - thin), y: y - (y < -200 ? v.shrug * 0.8 + rig.breath * 3 : 0)}) : {x: x * wx * (1 - thin), y});
  // softer, sloping shoulder line
  const half: [number, number][] = [[30, -320], [62, -311], [90, -296], [103, -266], [100, -196], [92, -120], [86, -40], [84, 30], [88, 84]];
  const shirtPts = [...half.map(([x, y]) => tPt(x, y)), tPt(40, 96), tPt(-40, 96), ...[...half].reverse().map(([x, y]) => tPt(-x, y))];
  const shirtD = SPv(shirtPts, true);
  const hoodHalf: [number, number][] = [[34, -326], [76, -312], [110, -288], [118, -246], [110, -184], [102, -118], [96, -40], [94, 40], [96, 104]];
  const hoodPts = [...hoodHalf.map(([x, y]) => tPt(x, y)), tPt(50, 114), tPt(-50, 114), ...[...hoodHalf].reverse().map(([x, y]) => tPt(-x, y))];
  const hoodD = SPv(hoodPts, true);
  const pelvisD = SPv([tPt(-86, 40), tPt(86, 40), tPt(94, 84), tPt(54, 116), tPt(0, 124), tPt(-54, 116), tPt(-94, 84)], true);

  // ---------- limbs
  const sleeveW = outfit === 'hoodie' ? 58 : 46;
  const armSegs = (a: typeof aL, sh: V): Seg[] => [
    {d: line([sh, a.el]), w: outfit === 'hoodie' ? 60 : 50},
    {d: line([a.el, add(a.wr, dir(a.ha), -6)]), w: outfit === 'hoodie' ? 54 : 42},
  ];
  // tapered legs: thigh 76 -> 64 at the knee, shin 58 -> 48 at the ankle
  const legSegs = (l: typeof lL, h: V): Seg[] => {
    const an = add(l.ank, dir(l.fa), -10);
    const km = lerpV(h, l.kn, 0.55), sm = lerpV(l.kn, an, 0.5);
    return [
      {d: line([h, km]), w: 76},
      {d: line([km, l.kn]), w: 64},
      {d: line([l.kn, sm]), w: 57},
      {d: line([sm, an]), w: 48},
    ];
  };
  void sleeveW;
  const hand = (key: string, w: V, a: number, open: number, side: number) => {
    const dA = dir(a), pp = {x: -dA.y, y: dA.x};
    const segs: Seg[] = [];
    const palm = add(w, dA, 22);
    for (let i = 0; i < 4; i++) {
      const t = i / 3 - 0.5;
      const b0 = add(add(w, dA, 36), pp, t * 26);
      const fa = a + t * (10 + 30 * open) + (1 - open) * 14 * side;
      const len = 26 + 14 * open - Math.abs(t) * 8;
      const mid = add(b0, dir(fa), len * 0.55);
      const tip = add(mid, dir(fa + (1 - open) * 46 * side), len * 0.5);
      segs.push({d: line([b0, mid, tip]), w: 12});
    }
    const tb = add(add(w, dA, 14), pp, -side * 16);
    const ta = a - side * (26 + 30 * open);
    const tm = add(tb, dir(ta), 17), tt = add(tm, dir(ta + side * 20), 14);
    segs.push({d: line([tb, tm, tt]), w: 14});
    segs.push({d: line([add(w, dA, 6), palm, add(palm, dA, 10)]), w: 40});
    return <CelStrokes key={key} id={`${id}-${key}`} segs={segs} sh={skin} inkW={ink * 0.75} flat={flat || detail < 0.6} />;
  };
  const armNode = (key: string, a: typeof aL, sh: V, side: number, dim: number) => {
    const slv = outfit === 'hoodie' ? hood : tee;
    const dk = (x: Shade): Shade => (dim > 0 ? {...x, lit: mixHex(x.lit, x.shade, dim), rim: mixHex(x.rim, x.shade, dim * 0.6)} : x);
    const segs = armSegs(a, sh);
    const sleeve =
      outfit === 'hoodie' ? (
        <CelStrokes id={`${id}-${key}s`} segs={segs} sh={dk(slv)} inkW={ink} flat={flat} />
      ) : (
        <>
          <CelStrokes id={`${id}-${key}s`} segs={segs} sh={dk(skin)} inkW={ink} flat={flat} />
          <CelStrokes id={`${id}-${key}t`} segs={[{d: line([sh, lerpV(sh, a.el, 0.5)]), w: 56}]} sh={dk(slv)} inkW={ink} flat={flat} />
        </>
      );
    const cuffA = add(a.wr, dir(a.ha), -26), cuffB = add(a.wr, dir(a.ha), -8);
    return (
      <g key={key}>
        {sleeve}
        {outfit === 'hoodie' && (
          <g>
            <path d={line([cuffA, cuffB])} stroke={C.ink} strokeWidth={50 + ink * 2} strokeLinecap="butt" />
            <path d={line([cuffA, cuffB])} stroke={mixHex(slv.lit, slv.shade, 0.35 + dim * 0.4)} strokeWidth={50} strokeLinecap="butt" />
          </g>
        )}
        {hand(`${key}h`, a.wr, a.ha, side < 0 ? v.aLo : v.aRo, side)}
      </g>
    );
  };
  const foot = (key: string, an: V, a: number, side: number, dim: number) => {
    const ang = view === 'front' || view === 'back' ? a : a - 90 * (view === 'backThreeQuarter' ? -0.6 : 1) * (view === 'threeQuarter' ? 0.6 : 1);
    const dA = dir(ang);
    const fl = view === 'front' || view === 'back' ? 40 : 82;
    const heel = add(an, dA, view === 'front' || view === 'back' ? 0 : -16), toe = add(an, dA, fl);
    const sw = view === 'front' || view === 'back' ? 58 : 46;
    const sh: Shade = dim > 0 ? {...shoe, lit: mixHex(shoe.lit, shoe.shade, dim)} : shoe;
    const solePts = [add(heel, {x: 0, y: 1}, sw * 0.42), add(toe, {x: 0, y: 1}, sw * 0.4)];
    return (
      <g key={key}>
        <CelStrokes id={`${id}-${key}`} segs={[{d: line([heel, toe]), w: sw}]} sh={sh} inkW={ink} flat={flat} />
        <path d={line(solePts)} stroke={C.ink} strokeWidth={14 + ink * 2} strokeLinecap="round" />
        <path d={line(solePts)} stroke={C.sole} strokeWidth={14} strokeLinecap="round" />
        {detail > 0.6 && <path d={line([add(an, dA, fl * 0.2), add(an, dA, fl * 0.6)])} stroke={C.shoeShade} strokeWidth={4} strokeDasharray="5 6" strokeLinecap="round" transform="translate(0,-8)" />}
        {void side}
      </g>
    );
  };
  const legNode = (key: string, l: typeof lL, h: V, side: number, dim: number) => {
    const sh: Shade = dim > 0 ? {...trs, lit: mixHex(trs.lit, trs.shade, dim), rim: mixHex(trs.rim, trs.shade, dim * 0.6)} : trs;
    return (
      <g key={key}>
        {foot(`${key}f`, l.ank, l.fa, side, dim)}
        <CelStrokes id={`${id}-${key}`} segs={legSegs(l, h)} sh={sh} inkW={ink} flat={flat}>
          {detail > 0.6 && <path d={line([add(l.kn, dir(l.fa), -18), add(l.kn, dir(l.fa), 20)])} stroke={sh.shade} strokeWidth={5} opacity={0.7} />}
        </CelStrokes>
        {/* jeans hem */}
        <path d={line([add(l.ank, dir(l.fa), -24), add(l.ank, dir(l.fa), -12)])} stroke={C.ink} strokeWidth={52 + ink * 2} strokeLinecap="butt" />
        <path d={line([add(l.ank, dir(l.fa), -24), add(l.ank, dir(l.fa), -12)])} stroke={mixHex(sh.lit, sh.shade, 0.4)} strokeWidth={52} strokeLinecap="butt" />
      </g>
    );
  };

  // ---------- head
  const yaw = VIEW_YAW[view];
  const blink = autoBlink(f, (id.length * 7) % 13);
  const headNode = (
    <g key="head">
      <path d={line([rig.neck, add(rig.neck, dir(180 + rig.headA), 40)])} stroke={C.ink} strokeWidth={58 + ink * 2} strokeLinecap="round" />
      <path d={line([rig.neck, add(rig.neck, dir(180 + rig.headA), 40)])} stroke={back || lighting === 'dusk' ? mixHex(skin.lit, skin.shade, 0.25) : skin.shade} strokeWidth={58} strokeLinecap="round" />
      <HeroHead
        f={f}
        id={`${id}-hd`}
        x={rig.headC.x}
        y={rig.headC.y}
        scale={HEAD_S}
        rot={rig.headA}
        yaw={yaw}
        tilt={v.tilt}
        expression={p.expression ?? (pose === 'lieBed' ? 'calm' : 'content')}
        blendTo={p.blendTo}
        blend={p.blend}
        blink={blink}
        health={health}
        dry={dry}
        cannula={p.cannula}
        shoulders={false}
        neck={false}
        hairFlow={0.3}
        lighting={lighting}
        rim={p.rim}
        detail={detail * 0.8}
        inkScale={(ink / 5 / HEAD_S) * 0.9}
        frameRot={rotT + rig.headA * fc}
        frameMirror={fc < 0}
      />
    </g>
  );

  // ---------- torso node (front or back details)
  const torsoNode = (
    <g key="torso">
      <CelPath id={`${id}-pel`} d={pelvisD} sh={trs} k={22} r={7} inkW={ink} flat={flat} />
      {outfit === 'hoodie' ? (
        <CelPath id={`${id}-hood`} d={hoodD} sh={hood} k={34} r={9} inkW={ink} flat={flat}>
          {!back && (
            // open front showing the tee
            <path
              d={SPv([tPt(-30, -318), tPt(-40, -200), tPt(-50, -60), tPt(-56, 110), tPt(56, 110), tPt(50, -60), tPt(40, -200), tPt(30, -318)], true)}
              fill={tee.lit}
              stroke={C.ink}
              strokeWidth={ink}
            />
          )}
          {!back && detail > 0.5 && <path d={line([tPt(-38, -180), tPt(-18, -150), tPt(10, -160)])} stroke={tee.shade} strokeWidth={4} fill="none" />}
          {back && (
            <path d={SPv([tPt(-92, -322), tPt(-84, -250), tPt(-40, -178), tPt(0, -160), tPt(40, -178), tPt(84, -250), tPt(92, -322), tPt(0, -334)], true)} fill={mixHex(hood.lit, hood.deep, 0.45)} stroke={C.ink} strokeWidth={ink} strokeLinejoin="round" />
          )}
          {back && detail > 0.4 && <path d={SPv([tPt(-70, -310), tPt(-50, -230), tPt(0, -186), tPt(50, -230), tPt(70, -310)])} fill="none" stroke={hood.deep} strokeWidth={7} opacity={0.8} />}
          {back && detail > 0.4 && <path d={SPv([tPt(80, -300), tPt(70, -236), tPt(36, -186)])} fill="none" stroke={hood.rim} strokeWidth={4} opacity={0.7} />}
          {back && detail > 0.4 && <path d={line([tPt(0, -160), tPt(0, 80)])} stroke={hood.deep} strokeWidth={4} opacity={0.5} />}
          {(pose === 'sitLedge' || pose === 'sitDesk') && detail > 0.4 && (
            <g fill="none" stroke={hood.deep} strokeWidth={5} strokeLinecap="round" opacity={0.85}>
              <path d={line([tPt(-80, 40), tPt(-30, 62), tPt(10, 54)])} />
              <path d={line([tPt(20, 70), tPt(70, 50)])} />
            </g>
          )}
          {detail > 0.4 && <path d={line([tPt(-60, 96), tPt(60, 96)])} stroke={hood.shade} strokeWidth={8} />}
        </CelPath>
      ) : (
        <CelPath id={`${id}-tee`} d={shirtD} sh={tee} k={30} r={8} inkW={ink} flat={flat}>
          {detail > 0.55 && (
            <g fill="none" stroke={tee.shade} strokeWidth={4.5} strokeLinecap="round">
              <path d={line([tPt(-40, -90), tPt(-10, -66), tPt(22, -78)])} />
              <path d={line([tPt(34, 10), tPt(54, 36)])} />
            </g>
          )}
        </CelPath>
      )}
      {/* collar / hood */}
      {outfit === 'hoodie' ? (
        <path d={SPv([tPt(-74, -300), tPt(-40, back ? -250 : -338), tPt(40, back ? -250 : -338), tPt(74, -300)])} fill="none" stroke={C.ink} strokeWidth={30 + ink * 2} strokeLinecap="round" />
      ) : (
        <path d={SPv([tPt(-30, -318), tPt(0, back ? -324 : -296), tPt(30, -318)])} fill="none" stroke={C.ink} strokeWidth={12 + ink * 2} strokeLinecap="round" />
      )}
      {outfit === 'hoodie' ? (
        <path d={SPv([tPt(-74, -300), tPt(-40, back ? -250 : -338), tPt(40, back ? -250 : -338), tPt(74, -300)])} fill="none" stroke={mixHex(hood.lit, hood.shade, 0.3)} strokeWidth={30} strokeLinecap="round" />
      ) : (
        <path d={SPv([tPt(-30, -318), tPt(0, back ? -324 : -296), tPt(30, -318)])} fill="none" stroke={mixHex(tee.lit, tee.shade, 0.3)} strokeWidth={12} strokeLinecap="round" />
      )}
    </g>
  );
  const packNode =
    p.backpack && outfit !== 'patient' ? (
      back ? (
        <g key="pack">
          <CelPath id={`${id}-pack`} d={SPv([tPt(-96, -270), tPt(96, -270), tPt(110, -150), tPt(104, -30), tPt(0, -10), tPt(-104, -30), tPt(-110, -150)], true)} sh={pack} k={30} r={9} inkW={ink} flat={flat}>
            {detail > 0.4 && <path d={SPv([tPt(-70, -130), tPt(70, -130), tPt(74, -50), tPt(-74, -50)], true)} fill={pack.shade} stroke={C.ink} strokeWidth={ink * 0.8} />}
            {detail > 0.5 && <path d={line([tPt(-80, -200), tPt(80, -200)])} stroke={C.steelDark} strokeWidth={4} strokeDasharray="6 4" />}
          </CelPath>
        </g>
      ) : (
        <g key="pack">
          {[-1, 1].map((sd) => (
            <path key={sd} d={line([tPt(sd * 70, -300), tPt(sd * 96, -230), tPt(sd * 92, -120)])} fill="none" stroke={C.ink} strokeWidth={26 + ink * 2} strokeLinejoin="round" />
          ))}
          {[-1, 1].map((sd) => (
            <path key={`i${sd}`} d={line([tPt(sd * 70, -300), tPt(sd * 96, -230), tPt(sd * 92, -120)])} fill="none" stroke={pack.lit} strokeWidth={26} strokeLinejoin="round" />
          ))}
        </g>
      )
    ) : null;
  const packBehind =
    p.backpack && outfit !== 'patient' && !back ? (
      <CelPath key="packB" id={`${id}-packB`} d={SPv([tPt(-118, -270), tPt(118, -270), tPt(126, -60), tPt(-126, -60)], true)} sh={pack} k={20} r={6} inkW={ink} flat={flat} />
    ) : null;

  // ---------- order (near / far limbs)
  const order: React.ReactNode[] = [];
  const sitK = pose === 'sitSofa' ? 1 - (p.poseTo ? clamp(p.poseMix ?? 0) : 0) : p.poseTo === 'sitSofa' ? clamp(p.poseMix ?? 0) : 0;
  const seatedFront = sitK > 0.5 && (view === 'front' || view === 'back');
  const farDim = view === 'front' || view === 'back' ? 0 : view === 'profile' ? 0.45 : 0.25;
  if (view === 'threeQuarter' || view === 'profile') {
    // near = screen-left limbs (his right side, facing screen-right)
    order.push(armNode('aR', aR, rig.shR, 1, farDim), legNode('lR', lR, rig.hipR, 1, farDim), packBehind, legNode('lL', lL, rig.hipL, -1, 0), torsoNode, packNode, headNode, armNode('aL', aL, rig.shL, -1, 0));
  } else if (view === 'backThreeQuarter') {
    // near = screen-right limbs (his right side, back to camera)
    order.push(armNode('aL', aL, rig.shL, -1, farDim), legNode('lL', lL, rig.hipL, -1, farDim), legNode('lR', lR, rig.hipR, 1, 0), torsoNode, headNode, packNode, armNode('aR', aR, rig.shR, 1, 0));
  } else if (view === 'back') {
    order.push(legNode('lL', lL, rig.hipL, -1, 0), legNode('lR', lR, rig.hipR, 1, 0), armNode('aL', aL, rig.shL, -1, 0), armNode('aR', aR, rig.shR, 1, 0), torsoNode, headNode, packNode);
  } else if (seatedFront) {
    // seated, front view: the knees come toward the camera, in front of the shirt hem
    order.push(packBehind, torsoNode, legNode('lL', lL, rig.hipL, -1, 0), legNode('lR', lR, rig.hipR, 1, 0), packNode, headNode, armNode('aL', aL, rig.shL, -1, 0), armNode('aR', aR, rig.shR, 1, 0));
  } else {
    order.push(packBehind, legNode('lL', lL, rig.hipL, -1, 0), legNode('lR', lR, rig.hipR, 1, 0), torsoNode, packNode, headNode, armNode('aL', aL, rig.shL, -1, 0), armNode('aR', aR, rig.shR, 1, 0));
  }

  return (
    <g transform={`translate(${n1(p.x)},${n1(p.y)}) rotate(${n1(rotT)}) scale(${(fc * s).toFixed(4)},${s.toFixed(4)}) translate(${n1(rig.bob.x)},${n1(rig.bob.y - rig.anchorY)})`} opacity={p.opacity ?? 1}>
      {order}
    </g>
  );
};

const lerpV = (a: V, b: V, t: number) => ({x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)});
