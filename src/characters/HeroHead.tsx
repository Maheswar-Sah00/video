import React from 'react';
import {C} from '../lib/palette';
import {clamp, hash, lerp, mixHex, rgba, smoothPath, wander} from '../lib/anim';
import type {Lighting} from '../lib/scene';
import type {HeroExpr, HeroOutfit} from './Hero';
import {CelPath, Glint, localShade, shadeFor} from '../parts/hero/kit/cel';
import type {Shade} from '../parts/hero/kit/cel';
import {makeGeo, pw, TOP} from '../parts/hero/kit/headGeom';
import type {Geo, P3} from '../parts/hero/kit/headGeom';

/**
 * HIS head + neck (+ optional shoulders / upper chest) for close-ups (owner: hero).
 * Anime-cel, pseudo-3D (the same head for any turn/tilt in between, so turns animate smoothly).
 *
 * Origin (x,y) = FACE CENTRE (the bridge of the nose, between the eyes). At scale 1: crown of the
 * messy hair at y-330, eyes at y-10, mouth y+120, chin y+190, ears at x±150; with `shoulders`
 * the neck runs down to the collar at y+300 and the shoulders span x±430 down to y+620 (cut off
 * there — compose so that edge is off-frame or behind something; `chestTo` extends it).
 *
 *   turn      -1 profile facing screen-LEFT .. 0 front .. 1 profile facing screen-RIGHT
 *             (0.35–0.6 = three-quarter). Default 0.42.
 *   tilt      -1 looking down .. 0 level .. 1 looking up (storyboard 1/20: looking up ~0.5)
 *   expression / blendTo / blend   'smile' | 'content' | 'tired' | 'pain' | 'worried' | 'calm' |
 *             'sleep' (eyes closed, slack) | 'hopeful'
 *   mouthOpen 0..1 (speech/cough/breath)   blink 0..1 (1 = closed)   eyeOpen 0..1 cap
 *   look      [dx, dy] gaze offset -1..1
 *   breath    0..1 (shoulders rise)
 *   health    1 healthy .. 0 very ill (paler/greyer skin, dark under-eyes, hollow cheeks, dry lips,
 *             duller hair, looser collar)
 *   outfit / backpack   what the shoulders wear (hoodie open over the grey tee + black backpack
 *             straps | grey tee | light-blue patient tee (V-neck))
 *   shoulders draw neck + shoulders + upper chest
 *   cannula   clear nasal oxygen tube under the nose, looping over the ears (path 2)
 *   pillow    lying on a pillow (head rotated by `rot`; hair splays back toward the pillow, no gravity
 *             on the face) — the scene draws the pillow itself
 *   hairFlow  0..1 breeze in the hair (default 0.35 = idle stir); also swings the hoodie strings
 *   lighting / rim / detail / opacity
 *
 * ADDED optional props: bodyTurn (shoulders' turn, default turn*0.35) · hairDir [dx,dy] (bias the
 * hair tips, e.g. opposite a head jerk, for follow-through) · chestTo (extend the chest to this
 * local y) · neck (default true) · inkScale (outline multiplier; raise when the head is small) ·
 * frameRot (rotation of parent groups in deg so the key light stays screen-fixed) · sweat 0..1 ·
 * cough 0..1 (shoulders hunch, chin tucks).
 * ADDED export: heroHeadPoints(props) -> scene-space {eyeL eyeR nose mouth chin cheek cheekL cheekR
 * temple ear crown throat adam chest} (cheek/temple/ear = the side turned toward the camera;
 * adam = the Adam's apple, moves with `swallow`).
 *
 * THIS REEL (no-water):
 *   dry       0..1 DEHYDRATION - pass dryAt(abs). Independent of `health`. 0.33 (day 1): lips dull
 *             and dry with first cracks, slight shadows under the eyes, a little duller skin;
 *             0.67 (day 2): grey-tan dull skin (C.skinDry), cracked lips (C.lipDry + C.lipCrack),
 *             sunken eye sockets (C.eyeSunk crescents above + below the eyes), heavier lids,
 *             hollow cheeks, messier duller hair with flyaway strands; 1 (the end): all of it at
 *             full strength. Idle motion (breath, hair stir) slows and calms; `sweat` is suppressed
 *             above dry ~0.6 (he has stopped sweating).
 *   swallow   0..1 a swallow: the Adam's apple rides up the throat and back down (peak at 0.5),
 *             the chin dips a touch. Drive with a 0->1 ramp over ~10-14 frames per gulp.
 */

export type HeroHeadProps = {
  f: number;
  id: string;
  x: number;
  y: number;
  scale?: number;
  rot?: number;
  turn?: number;
  tilt?: number;
  expression?: HeroExpr;
  blendTo?: HeroExpr;
  blend?: number;
  mouthOpen?: number;
  blink?: number;
  eyeOpen?: number;
  look?: [number, number];
  breath?: number;
  health?: number;
  /** 0..1 dehydration look (this reel; drive with dryAt(abs)): cracked lips, dull grey skin, sunken
   *  eyes, heavy lids, hollow cheeks, messy dull hair, calmer idle, no sweat above ~0.6 */
  dry?: number;
  outfit?: HeroOutfit;
  backpack?: boolean;
  shoulders?: boolean;
  cannula?: boolean;
  pillow?: boolean;
  hairFlow?: number;
  lighting?: Lighting;
  rim?: number;
  detail?: number;
  opacity?: number;
  // ---- added (optional) ----
  /** body (shoulders) turn, default turn * 0.35 */
  bodyTurn?: number;
  /** extra screen-space bias of the hair tips (follow-through), ~ -1..1 each: [dx, dy] */
  hairDir?: [number, number];
  /** extend the chest/shoulders down to this local y (default 620) */
  chestTo?: number;
  /** draw the neck (default true) */
  neck?: boolean;
  /** outline width multiplier (raise when drawing the head small) */
  inkScale?: number;
  /** total screen rotation of parent groups (deg) so the key light stays screen-fixed */
  frameRot?: number;
  /** 0..1 sweat sheen / glints on the skin (fever, pain) */
  sweat?: number;
  /** 0..1 cough: shoulders hunch, chin tucks a little (pair with mouthOpen) */
  cough?: number;
  /** screen rotation of the shoulders/torso in deg (default = rot); pivot = the collar */
  bodyRot?: number;
  /** the parent group is mirrored (scale(-1,1)) — keeps the key light screen-fixed */
  frameMirror?: boolean;
  /** explicit head yaw in degrees (-180..180; overrides turn; |yaw| > 90 = turned away, back of the head) */
  yaw?: number;
  /** 0..1 swallow: throat bob (Adam's apple up and back down, peak at 0.5) */
  swallow?: number;
};

type Ex = {open: number; squint: number; browY: number; browAng: number; knit: number; mouth: number; mouthW: number; curve: number; teeth: number; cheek: number; droop: number};
const EX: Record<HeroExpr, Ex> = {
  smile: {open: 0.8, squint: 0.42, browY: 5, browAng: -1, knit: 0, mouth: 0.26, mouthW: 1.1, curve: 1, teeth: 1, cheek: 1, droop: 0},
  content: {open: 0.84, squint: 0.24, browY: 2, browAng: 0, knit: 0, mouth: 0, mouthW: 0.96, curve: 0.6, teeth: 0, cheek: 0.55, droop: 0},
  tired: {open: 0.5, squint: 0.1, browY: -2, browAng: 7, knit: 2, mouth: 0.05, mouthW: 0.86, curve: -0.14, teeth: 0, cheek: 0, droop: 0.85},
  pain: {open: 0.06, squint: 1, browY: -7, browAng: 17, knit: 9, mouth: 0.3, mouthW: 1.04, curve: -0.5, teeth: 0.95, cheek: 0.35, droop: 0},
  worried: {open: 0.96, squint: 0.05, browY: 6, browAng: 15, knit: 4, mouth: 0.05, mouthW: 0.86, curve: -0.32, teeth: 0, cheek: 0, droop: 0},
  calm: {open: 0.72, squint: 0.12, browY: 0, browAng: 2, knit: 0, mouth: 0, mouthW: 0.9, curve: 0.14, teeth: 0, cheek: 0.12, droop: 0.35},
  sleep: {open: 0, squint: 0, browY: -2, browAng: 2, knit: 0, mouth: 0.07, mouthW: 0.8, curve: 0.04, teeth: 0, cheek: 0, droop: 0},
  hopeful: {open: 1, squint: 0.12, browY: 9, browAng: 5, knit: 0, mouth: 0.12, mouthW: 1, curve: 0.65, teeth: 0.6, cheek: 0.6, droop: 0},
};
const mixEx = (a: Ex, b: Ex, t: number): Ex => {
  const o = {} as Ex;
  (Object.keys(a) as (keyof Ex)[]).forEach((k) => (o[k] = lerp(a[k], b[k], t)));
  return o;
};

const n1 = (v: number) => v.toFixed(1);
type Pt = {x: number; y: number};
const SP = (pts: Pt[], closed = false) => smoothPath(pts.map((q) => [q.x, q.y] as [number, number]), closed);
const L = (pts: Pt[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${n1(q.x)},${n1(q.y)}`).join(' ');

/** Shared geometry for drawing + named points. */
export const heroHeadGeom = (p: HeroHeadProps) => {
  const turn = clamp(p.turn ?? 0.42, -1, 1);
  const tilt = clamp(p.tilt ?? 0, -1, 1);
  const base = EX[p.expression ?? 'content'];
  const ex = p.blendTo ? mixEx(base, EX[p.blendTo], clamp(p.blend ?? 0)) : {...base};
  if (p.mouthOpen !== undefined) ex.mouth = Math.max(ex.mouth * (1 - clamp(p.mouthOpen)), clamp(p.mouthOpen));
  const dry = clamp(p.dry ?? 0);
  const health = clamp(p.health ?? 1);
  // dehydrated: heavier lids, less cheek lift
  ex.open *= 1 - 0.3 * dry;
  ex.droop = Math.min(1, ex.droop + 0.75 * dry);
  ex.cheek *= 1 - 0.6 * dry;
  const thin = clamp((1 - health) * 1.1 + dry * 0.95);
  const drop = ex.mouth * 34;
  const cough = clamp(p.cough ?? 0);
  const sw = Math.sin(Math.PI * clamp(p.swallow ?? 0));
  const g = makeGeo(p.yaw ?? turn * 88, tilt * 38 - cough * 8 - sw * 3, thin, drop);
  return {g, ex, turn, tilt, health, thin, drop, cough, dry, sw};
};

/** Named points of the head in SCENE coordinates (same transform as the drawing). */
export const heroHeadPoints = (p: HeroHeadProps) => {
  const {g} = heroHeadGeom(p);
  const s = p.scale ?? 1;
  const r = ((p.rot ?? 0) * Math.PI) / 180;
  const at = (q: Pt) => ({x: p.x + (q.x * Math.cos(r) - q.y * Math.sin(r)) * s, y: p.y + (q.x * Math.sin(r) + q.y * Math.cos(r)) * s});
  const side = (g.sY >= 0 ? -1 : 1) as 1 | -1; // the cheek turned toward the camera
  return {
    eyeL: at(g.surf(-0.46, -10)),
    eyeR: at(g.surf(0.46, -10)),
    nose: at(g.surf(0, 68)),
    mouth: at(g.surf(0, 122)),
    chin: at(g.surf(0, 192)),
    /** the cheek facing the camera (the sunlit one in S01) */
    cheek: at(g.surf(side * 0.72, 60)),
    cheekL: at(g.surf(-0.72, 60)),
    cheekR: at(g.surf(0.72, 60)),
    /** temple on the camera side (where a hand props the head) */
    temple: at(g.surf(side * 1.12, -120, 20)),
    ear: at(g.surf(side * 1.57, 45)),
    crown: at(g.surf(0, -250, 30)),
    throat: at({x: g.proj(0, 230, 40).x, y: 250}),
    adam: at(adamPt(g, p)),
    chest: at({x: 0, y: 470}),
  };
};

/** Adam's apple (head-local px): rides up the throat with `swallow` */
const adamPt = (g: Geo, p: HeroHeadProps) => {
  const sw = Math.sin(Math.PI * clamp(p.swallow ?? 0));
  const bodyTurn = clamp(p.bodyTurn ?? clamp(p.turn ?? 0.42, -1, 1) * 0.35, -1, 1);
  const top = g.proj(0, 150, 42);
  const bot = {x: bodyTurn * 53, y: 350};
  const t = 0.5 - 0.26 * sw;
  return {x: lerp(top.x, bot.x, t), y: lerp(Math.min(top.y, 175), bot.y, t)};
};

const convexHull = (pts: Pt[]): Pt[] => {
  const P = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const p of P) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

/** natural blinking (every ~2.5–5 s, 7-frame blink), deterministic per seed */
export const autoBlink = (f: number, seed: number) => {
  let t = -160 - (seed % 60);
  let k = 0;
  let last = -1e9;
  while (t <= f && k < 400) {
    last = t;
    t += 75 + 75 * hash(k, seed);
    k++;
  }
  const d = f - last;
  return d < 0 ? 0 : d < 2 ? d / 2 : d < 4 ? 1 : d < 7 ? 1 - (d - 4) / 3 : 0;
};
const hashStr = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return h;
};

// ------------------------------------------------------------------------------------- hair spec
type Lock = {th: number; yr: number; tth: number; ty: number; w: number; dzm: number; curl: number};
const BANGS: Lock[] = [
  {th: -1.18, yr: -150, tth: -1.3, ty: 30, w: 0.31, dzm: 20, curl: -0.8},
  {th: -0.92, yr: -214, tth: -1.12, ty: -58, w: 0.44, dzm: 36, curl: -0.9},
  {th: -0.55, yr: -240, tth: -0.78, ty: -40, w: 0.52, dzm: 42, curl: -0.7},
  {th: -0.18, yr: -252, tth: -0.36, ty: -22, w: 0.49, dzm: 46, curl: 0.8},
  {th: 0.16, yr: -252, tth: 0.12, ty: -58, w: 0.47, dzm: 44, curl: -0.6},
  {th: 0.48, yr: -244, tth: 0.6, ty: -34, w: 0.49, dzm: 42, curl: 0.9},
  {th: 0.82, yr: -222, tth: 1.02, ty: -64, w: 0.42, dzm: 36, curl: 0.7},
  {th: 1.16, yr: -156, tth: 1.3, ty: 20, w: 0.31, dzm: 20, curl: 0.8},
];
const hairlineY = (th: number) => pw([[0, -152], [0.5, -146], [0.85, -128], [1.08, -86], [1.22, -20], [1.32, 44], [1.42, 52], [1.5, -14], [1.68, -26], [1.84, 70], [2.2, 112], [Math.PI + 0.01, 124]], Math.abs(th));
const hairBackLow = (th: number) => pw([[0, -110], [0.9, -80], [1.3, 0], [1.6, 40], [1.9, 104], [2.4, 134], [Math.PI + 0.01, 142]], Math.abs(th));

export const HeroHead: React.FC<HeroHeadProps> = (p) => {
  const f = p.f;
  const id = p.id;
  const s = p.scale ?? 1;
  const {g, ex, turn, tilt, health, thin, cough, dry, sw} = heroHeadGeom(p);
  const surf = g.surf;
  const detail = clamp(p.detail ?? 1);
  const inkS = p.inkScale ?? 1;
  const inkW = 5 * inkS;
  const lighting = p.lighting ?? 'day';
  const fr = p.frameRot ?? p.rot ?? 0;
  const fm = p.frameMirror ? -1 : 1;
  const skin = localShade(shadeFor('skin', {lighting, health, rim: p.rim, dry}), fr, fm);
  const hairSh0 = localShade(shadeFor('hair', {lighting, health, rim: p.rim, dry}), fr, fm);
  const hairSh: Shade = {...hairSh0, lit: mixHex(hairSh0.lit, C.hairLight, 0.16), shade: mixHex(hairSh0.shade, C.hair, 0.4)};
  const outfit = p.outfit ?? 'hoodie';
  const showShoulders = p.shoulders ?? false;
  const showNeck = p.neck ?? true;
  const pillow = p.pillow ?? false;
  const hairFlow = p.hairFlow ?? 0.35;
  const hd = p.hairDir ?? [0, 0];
  const blink = clamp(p.blink ?? autoBlink(f, hashStr(id)));
  const open = clamp((p.eyeOpen !== undefined ? Math.min(p.eyeOpen, ex.open + 0.2) : ex.open) * (1 - blink), 0, 1.1);
  const lk = p.look ?? [0, 0];
  // breathing slows when dehydrated (cross-fade to a slower oscillator: stable under any dry(t))
  const breath = clamp(p.breath ?? lerp(0.5 + 0.5 * Math.sin(f * 0.055 + hashStr(id)), 0.5 + 0.42 * Math.sin(f * 0.036 + hashStr(id)), dry));
  // no sweat once he is dehydrated past ~0.6
  const sweat = clamp(p.sweat ?? 0) * (1 - clamp((dry - 0.45) / 0.17));
  const ill = 1 - health;
  const lipCol = mixHex(mixHex(C.lip, C.lipDry, clamp(dry * 1.15)), C.lipPale, clamp(ill * 1.3));
  const [Lx, Ly] = skin.L;
  const faceSide = g.sY >= 0 ? -1 : 1; // side of the face turned toward the camera (his right when turned right)
  const sYa = Math.abs(g.sY);

  // ======================================================================= neck + shoulders
  const bodyTurn = clamp(p.bodyTurn ?? turn * 0.35, -1, 1);
  const bx = bodyTurn * 70; // chest centre shift
  const breathUp = -breath * 7 - cough * 14;
  const neckTop = g.proj(0, 150, -18);
  const nw = 88 - thin * 10;
  const neckEls: React.ReactNode[] = [];
  if (showNeck) {
    const tx = neckTop.x, ty = Math.min(neckTop.y, 170);
    const bx0 = bx * 0.5;
    const by = 360;
    // neck = hull of a ring under the jaw (head space) and a ring at the collar (body space)
    const ring: Pt[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const q = g.proj(Math.sin(a) * (nw - 4), 146, -26 + Math.cos(a) * 66);
      ring.push({x: q.x, y: q.y});
      ring.push({x: bx0 + Math.sin(a) * (nw + 22), y: by + Math.cos(a) * 16});
    }
    const hull = convexHull(ring);
    const d = SP(hull, true);
    const midY = lerp(ty, by, 0.45);
    const silD = smoothPath(g.sil, true);
    neckEls.push(
      <CelPath key="neck" id={`${id}-neck`} d={d} sh={skin} k={26} r={9} inkW={inkW} flat={detail < 0.3}>
        {/* the head's shadow on the neck */}
        <path d={silD} fill={skin.shade} transform={`translate(${n1(-Lx * 14)},${n1(44 - Ly * 10 + tilt * 30)})`} />
        <path d={silD} fill={rgba(skin.deep, 0.35)} transform={`translate(${n1(-Lx * 6)},${n1(16)})`} />
        {detail > 0.5 && (
          <g fill="none" stroke={skin.shade} strokeLinecap="round" strokeWidth={6 * inkS} opacity={0.55}>
            <path d={`M${n1(tx + (Lx < 0 ? 1 : -1) * nw * 0.5)},${n1(ty + 70)} Q${n1(lerp(tx, bx0, 0.5) + (Lx < 0 ? 1 : -1) * nw * 0.35)},${n1(lerp(ty, by, 0.55))} ${n1(bx0 + (Lx < 0 ? 1 : -1) * 22)},${n1(by - 24)}`} />
            {tilt > 0.1 && <path d={`M${n1(lerp(tx, bx0, 0.42) - 7)},${n1(lerp(ty, by, 0.4))} q7,-9 14,0`} opacity={tilt} />}
          </g>
        )}
        {detail > 0.4 && Math.abs(g.sY) < 0.94 && (() => {
          // Adam's apple: a soft bump (shade crescent away from the light + a highlight), rides up on a swallow
          const ad = adamPt(g, p);
          const sd = Lx < 0 ? 1 : -1;
          const k = 1 + 0.35 * sw;
          return (
            <g>
              <path d={`M${n1(ad.x + sd * 4)},${n1(ad.y - 20 * k)} q${n1(sd * 15 * k)},${n1(16 * k)} ${n1(sd * 2)},${n1(36 * k)}`} fill="none" stroke={skin.deep} strokeWidth={5 * inkS} strokeLinecap="round" opacity={0.42 + 0.35 * sw} />
              <ellipse cx={n1(ad.x - sd * 7)} cy={n1(ad.y - 2)} rx={n1(7 * k)} ry={n1(13 * k)} fill={C.skinLight} opacity={0.3 + 0.35 * sw} />
              {sw > 0.05 && <path d={`M${n1(ad.x - 22)},${n1(ad.y - 46)} q22,8 44,0`} fill="none" stroke={skin.shade} strokeWidth={4 * inkS} strokeLinecap="round" opacity={0.6 * sw} />}
            </g>
          );
        })()}
      </CelPath>,
    );
  }

  // ---- torso / outfit
  const torsoEls: React.ReactNode[] = [];
  const backEls: React.ReactNode[] = []; // behind the neck (hood)
  if (showShoulders) {
    const chestTo = p.chestTo ?? 620;
    const yb = Math.max(chestTo, 640) + 40;
    const top = (c: Shade) => c;
    void top;
    const Wl = 430 * (1 - Math.max(0, bodyTurn) * 0.22) * (1 + thin * 0.02);
    const Wr = 430 * (1 - Math.max(0, -bodyTurn) * 0.22) * (1 + thin * 0.02);
    const hy = breathUp;
    const nkY = 318 + hy * 0.4;
    const shY = 400 + hy;
    const cx = bx;
    const torsoD = [
      `M${n1(cx - Wl - 20)},${n1(yb)}`,
      `L${n1(cx - Wl + 4)},${n1(shY + 200)}`,
      `C${n1(cx - Wl + 6)},${n1(shY + 70)} ${n1(cx - Wl * 0.86)},${n1(shY + 6)} ${n1(cx - Wl * 0.62)},${n1(shY - 18)}`,
      `C${n1(cx - Wl * 0.42)},${n1(shY - 40)} ${n1(cx - 150)},${n1(nkY - 6)} ${n1(cx - 96)},${n1(nkY - 8)}`,
      `Q${n1(cx)},${n1(nkY + 38)} ${n1(cx + 96)},${n1(nkY - 8)}`,
      `C${n1(cx + 150)},${n1(nkY - 6)} ${n1(cx + Wr * 0.42)},${n1(shY - 40)} ${n1(cx + Wr * 0.62)},${n1(shY - 18)}`,
      `C${n1(cx + Wr * 0.86)},${n1(shY + 6)} ${n1(cx + Wr - 6)},${n1(shY + 70)} ${n1(cx + Wr - 4)},${n1(shY + 200)}`,
      `L${n1(cx + Wr + 20)},${n1(yb)} Z`,
    ].join(' ');
    const teeMat = outfit === 'patient' ? 'patient' : 'tee';
    const teeSh = localShade(shadeFor(teeMat, {lighting, rim: p.rim}), fr, fm);
    const hoodSh = localShade(shadeFor('hoodie', {lighting, rim: p.rim}), fr, fm);
    const packSh = localShade(shadeFor('backpack', {lighting, rim: p.rim}), fr, fm);
    const loose = thin * 1.0;
    // collar (crew neck rib)
    const colL = {x: cx - 100, y: nkY - 8}, colR = {x: cx + 100, y: nkY - 8};
    const colMid = {x: cx + bodyTurn * 6, y: nkY + 40 + loose * 10};
    const collarD = `M${n1(colL.x)},${n1(colL.y)} Q${n1(colMid.x)},${n1(colMid.y + 22)} ${n1(colR.x)},${n1(colR.y)}`;
    const vNeck = outfit === 'patient';
    const vD = `M${n1(colL.x + 4)},${n1(colL.y)} Q${n1(cx - 30)},${n1(nkY + 60)} ${n1(cx + bodyTurn * 6)},${n1(nkY + 92)} Q${n1(cx + 30)},${n1(nkY + 60)} ${n1(colR.x - 4)},${n1(colR.y)}`;
    torsoEls.push(
      <CelPath key="tee" id={`${id}-tee`} d={torsoD} sh={teeSh} k={46} r={12} inkW={inkW} flat={detail < 0.3}>
        {detail > 0.4 && (
          <g fill="none" stroke={teeSh.shade} strokeWidth={6 * inkS} strokeLinecap="round" opacity={0.85}>
            <path d={`M${n1(cx - Wl * 0.55)},${n1(shY + 110)} q${n1(30 + loose * 20)},${n1(70)} ${n1(14)},${n1(190)}`} />
            <path d={`M${n1(cx + Wr * 0.5)},${n1(shY + 120)} q${n1(-26 - loose * 20)},${n1(80)} ${n1(-10)},${n1(180)}`} />
            <path d={`M${n1(cx - 70)},${n1(nkY + 120)} q${n1(50)},${n1(26 + loose * 20)} ${n1(120)},${n1(6)}`} opacity={0.55 + loose * 0.4} />
            {loose > 0.2 && <path d={`M${n1(cx - 40)},${n1(nkY + 200)} q${n1(40)},${n1(30)} ${n1(90)},${n1(10)}`} opacity={loose} />}
          </g>
        )}
        {/* collarbones peeking above a crew neck when thin / tee */}
        {detail > 0.5 && outfit !== 'hoodie' && (
          <g fill="none" stroke={skin.shade} strokeWidth={5 * inkS} strokeLinecap="round" opacity={0.3 + thin * 0.5} />
        )}
      </CelPath>,
    );
    // neckline: skin inside the collar, then the rib band
    const neckHole = vNeck ? `${vD} Q${n1(cx)},${n1(nkY - 20)} ${n1(colL.x + 4)},${n1(colL.y)} Z` : `${collarD} Q${n1(cx)},${n1(nkY - 22)} ${n1(colL.x)},${n1(colL.y)} Z`;
    torsoEls.push(<path key="nh" d={neckHole} fill={mixHex(skin.shade, skin.deep, 0.3)} />);
    if (detail > 0.4 && (thin > 0.15 || vNeck))
      torsoEls.push(
        <g key="cb" fill="none" stroke={skin.deep} strokeWidth={4 * inkS} strokeLinecap="round" opacity={0.35 + thin * 0.4}>
          <path d={`M${n1(cx - 70)},${n1(nkY + 24)} q34,10 60,4`} />
          <path d={`M${n1(cx + 70)},${n1(nkY + 24)} q-34,10 -60,4`} />
        </g>,
      );
    torsoEls.push(
      <path key="col" d={vNeck ? vD : collarD} fill="none" stroke={C.ink} strokeWidth={22 + inkW} strokeLinecap="round" strokeLinejoin="round" />,
      <path key="col2" d={vNeck ? vD : collarD} fill="none" stroke={mixHex(teeSh.lit, teeSh.shade, 0.35)} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />,
      <path key="col3" d={vNeck ? vD : collarD} fill="none" stroke={teeSh.rim} strokeWidth={3} strokeLinecap="round" opacity={0.5} transform="translate(0,-5)" />,
    );
    if (outfit === 'hoodie') {
      // hood bunched behind the neck (drawn behind the neck)
      const hoodD = `M${n1(cx - 250)},${n1(nkY + 60)} C${n1(cx - 250)},${n1(nkY - 60)} ${n1(cx - 150)},${n1(nkY - 110 + hy * 0.5)} ${n1(cx - 40)},${n1(nkY - 118 + hy * 0.5)} C${n1(cx + 60)},${n1(nkY - 122 + hy * 0.5)} ${n1(cx + 170)},${n1(nkY - 96 + hy * 0.5)} ${n1(cx + 250)},${n1(nkY - 40)} L${n1(cx + 250)},${n1(nkY + 60)} Z`;
      backEls.push(
        <CelPath key="hood" id={`${id}-hood`} d={hoodD} sh={hoodSh} k={30} r={10} inkW={inkW} flat={detail < 0.3}>
          {detail > 0.4 && <path d={`M${n1(cx - 200)},${n1(nkY - 20)} C${n1(cx - 130)},${n1(nkY - 86)} ${n1(cx + 100)},${n1(nkY - 92)} ${n1(cx + 200)},${n1(nkY - 20)}`} fill="none" stroke={hoodSh.deep} strokeWidth={14 * inkS} opacity={0.8} />}
        </CelPath>,
      );
      // open front panels
      const panel = (sd: number) => {
        const W = sd < 0 ? Wl : Wr;
        const edgeTop = {x: cx + sd * 112, y: nkY - 4};
        const edgeBot = {x: cx + sd * (150 + 40 * Math.max(0, -sd * bodyTurn)), y: yb};
        const d = [
          `M${n1(edgeTop.x)},${n1(edgeTop.y)}`,
          `C${n1(cx + sd * 150)},${n1(nkY - 6)} ${n1(cx + sd * W * 0.42)},${n1(shY - 40)} ${n1(cx + sd * W * 0.62)},${n1(shY - 18)}`,
          `C${n1(cx + sd * W * 0.86)},${n1(shY + 6)} ${n1(cx + sd * (W - 6))},${n1(shY + 70)} ${n1(cx + sd * (W - 4))},${n1(shY + 200)}`,
          `L${n1(cx + sd * (W + 20))},${n1(yb)} L${n1(edgeBot.x)},${n1(yb)}`,
          `C${n1(edgeBot.x - sd * 6)},${n1(nkY + 300)} ${n1(edgeTop.x + sd * 30)},${n1(nkY + 120)} ${n1(edgeTop.x)},${n1(edgeTop.y)} Z`,
        ].join(' ');
        return {d, edge: `M${n1(edgeTop.x)},${n1(edgeTop.y + 6)} C${n1(edgeTop.x + sd * 30)},${n1(nkY + 120)} ${n1(edgeBot.x - sd * 6)},${n1(nkY + 300)} ${n1(edgeBot.x)},${n1(yb)}`};
      };
      for (const sd of [-1, 1]) {
        const pn = panel(sd);
        torsoEls.push(
          <CelPath key={`pan${sd}`} id={`${id}-pan${sd}`} d={pn.d} sh={hoodSh} k={44} r={12} inkW={inkW} flat={detail < 0.3}>
            {detail > 0.4 && (
              <g fill="none" strokeLinecap="round">
                <path d={pn.edge} stroke={hoodSh.rim} strokeWidth={5 * inkS} opacity={0.7} transform={`translate(${n1(sd * 12)},0)`} />
                <path d={`M${n1(cx + sd * (sd < 0 ? Wl : Wr) * 0.62)},${n1(shY + 40)} q${n1(-sd * 20)},${n1(90)} ${n1(sd * 6)},${n1(200)}`} stroke={hoodSh.deep} strokeWidth={7 * inkS} opacity={0.8} />
              </g>
            )}
          </CelPath>,
        );
        // zipper tape
        if (detail > 0.45) torsoEls.push(<path key={`zip${sd}`} d={pn.edge} fill="none" stroke={mixHex(hoodSh.lit, C.steelDark, 0.5)} strokeWidth={5 * inkS} strokeDasharray={`${3 * inkS} ${4 * inkS}`} transform={`translate(${n1(sd * 5)},0)`} />);
      }
      // drawstrings (swing with follow-through)
      if (detail > 0.35)
        for (const sd of [-1, 1]) {
          const sw = wander(f * 0.05 + sd * 3, 81) * 10 * (0.4 + hairFlow) + hd[0] * 18 - cough * 14 * sd;
          const top = {x: cx + sd * 92, y: nkY + 8};
          const end = {x: cx + sd * 84 + sw, y: nkY + 200 + Math.abs(sw) * -0.3};
          const mid = {x: (top.x + end.x) / 2 + sw * 0.4 + sd * 4, y: (top.y + end.y) / 2};
          const sd2 = `M${n1(top.x)},${n1(top.y)} Q${n1(mid.x)},${n1(mid.y)} ${n1(end.x)},${n1(end.y)}`;
          torsoEls.push(
            <g key={`str${sd}`}>
              <path d={sd2} fill="none" stroke={C.ink} strokeWidth={13 * inkS} strokeLinecap="round" />
              <path d={sd2} fill="none" stroke={mixHex(C.tee, C.hoodieLight, 0.4)} strokeWidth={7 * inkS} strokeLinecap="round" />
              <path d={`M${n1(end.x)},${n1(end.y - 4)} L${n1(end.x + sw * 0.05)},${n1(end.y + 22)}`} stroke={C.ink} strokeWidth={14 * inkS} strokeLinecap="round" />
              <path d={`M${n1(end.x)},${n1(end.y - 2)} L${n1(end.x + sw * 0.05)},${n1(end.y + 20)}`} stroke={C.steel} strokeWidth={7 * inkS} strokeLinecap="round" />
            </g>,
          );
        }
    }
    if (p.backpack && outfit !== 'patient') {
      for (const sd of [-1, 1]) {
        const W = sd < 0 ? Wl : Wr;
        const a = {x: cx + sd * 170, y: nkY + 10};
        const b = {x: cx + sd * W * 0.6, y: shY + 120};
        const c2 = {x: cx + sd * W * 0.62, y: yb};
        const strap = `M${n1(a.x)},${n1(a.y)} C${n1(cx + sd * W * 0.5)},${n1(shY - 30)} ${n1(b.x + sd * 14)},${n1(b.y - 60)} ${n1(b.x)},${n1(b.y)} L${n1(c2.x)},${n1(c2.y)}`;
        torsoEls.push(
          <g key={`bp${sd}`}>
            <path d={strap} fill="none" stroke={C.ink} strokeWidth={62 + inkW * 2} strokeLinejoin="round" />
            <path d={strap} fill="none" stroke={packSh.lit} strokeWidth={62} strokeLinejoin="round" />
            {detail > 0.4 && <path d={strap} fill="none" stroke={packSh.rim} strokeWidth={4} strokeDasharray="10 7" opacity={0.6} transform={`translate(${n1(-sd * 20)},0)`} />}
            {detail > 0.4 && <path d={strap} fill="none" stroke={packSh.shade} strokeWidth={16} opacity={0.9} transform={`translate(${n1(sd * 16)},4)`} />}
            {/* adjuster buckle */}
            {detail > 0.35 && <rect x={n1(b.x - 32 + sd * 4)} y={n1(b.y + 70)} width={64} height={22} rx={5} fill={C.steelDark} stroke={C.ink} strokeWidth={3 * inkS} />}
          </g>,
        );
      }
    }
  }

  // ======================================================================= hair (back mass)
  const flowA = hairFlow * (1 - 0.4 * dry);
  const hairPts: {x: number; y: number}[] = [];
  for (let i = 0; i < 48; i++) {
    const th = -Math.PI + (i / 48) * Math.PI * 2;
    const low = hairBackLow(th);
    for (let y = TOP; y <= low; y += 12) {
      const top = clamp((y - TOP) / 160);
      const dz = lerp(70, 32, top) + 8 * Math.sin(i * 1.7 + y * 0.05);
      hairPts.push(surf(th, y, pillow ? dz + 14 : dz));
    }
  }
  const HB = 120;
  const hairBase = g.outline(hairPts, g.centre, HB, 50);
  const crownRef = surf(0, -240, 40);
  let hairD = '';
  {
    const cxy = g.centre;
    let i = 0;
    let k = 0;
    const pts = hairBase;
    while (i < HB) {
      const span = 9 + Math.floor(hash(k, 7) * 5);
      const j = Math.min(HB, i + span);
      const a = pts[i % HB], b = pts[j % HB], m = pts[Math.floor((i + j) / 2) % HB];
      const ox0 = m[0] - cxy.x, oy0 = m[1] - cxy.y;
      const rad = Math.hypot(ox0, oy0) || 1;
      const ox = ox0 / rad, oy = oy0 / rad;
      // flow: away from the parting (crown-front) and down; pillow = splayed outward
      const sideF = m[0] < crownRef.x ? -1 : 1;
      let Fx = sideF * 0.85 + hd[0] * 0.6, Fy = 0.55 + hd[1] * 0.6;
      if (pillow) {
        Fx = ox;
        Fy = oy;
      }
      let tx = -oy, ty = ox;
      if (tx * Fx + ty * Fy < 0) {
        tx = -tx;
        ty = -ty;
      }
      const wob = flowA * (wander(f * 0.036 + k * 1.37, 17) * 0.6 + Math.sin(f * 0.19 + k * 1.1) * 0.18);
      const isHair = rad > 120;
      const upK = clamp(-oy * 1.4); // 1 on top of the head
      const len = isHair ? lerp(44 + 30 * hash(k, 3), 26 + 18 * hash(k, 3), upK) * (1 + 0.15 * flowA * wander(f * 0.045 + k, 5)) * (pillow ? 1.25 : 1) : 4;
      const lean = lerp(0.55, 0.95, upK) + 0.25 * hash(k, 13) + wob + dry * 0.45 * (hash(k, 43) - 0.5);
      const lenD = isHair ? len * (1 + dry * 0.6 * (hash(k, 41) - 0.3)) : len; // dry: uneven, messier tufts
      const tip = {x: m[0] + ox * lenD * lerp(0.75, 0.5, upK) + tx * lenD * lean, y: m[1] + oy * lenD * lerp(0.75, 0.5, upK) + ty * lenD * lean};
      // which end is the tuft leaning toward?
      const towardB = (b[0] - a[0]) * tx + (b[1] - a[1]) * ty > 0;
      const kA = towardB ? 0.55 : 0.02, kB = towardB ? 0.02 : 0.55;
      const c1 = {x: lerp(a[0], tip.x, 0.5) + ox * len * kA, y: lerp(a[1], tip.y, 0.5) + oy * len * kA};
      const c2 = {x: lerp(b[0], tip.x, 0.5) + ox * len * kB, y: lerp(b[1], tip.y, 0.5) + oy * len * kB};
      if (i === 0) hairD = `M${n1(a[0])},${n1(a[1])}`;
      hairD += ` Q${n1(c1.x)},${n1(c1.y)} ${n1(tip.x)},${n1(tip.y)} Q${n1(c2.x)},${n1(c2.y)} ${n1(b[0])},${n1(b[1])}`;
      i = j;
      k++;
    }
    hairD += ' Z';
  }
  // interior clump lines on the back mass (visible where the head is turned away)
  const clumpLines: React.ReactNode[] = [];
  if (detail > 0.45) {
    for (let k = 0; k < 7; k++) {
      const th = -Math.sign(g.sY || 1) * lerp(1.7, 2.9, k / 6);
      const a = surf(th * 0.7, -230, 50), b = surf(th, -120 + 30 * hash(k, 2), 44), c = surf(th * 1.04, -40 + 60 * hash(k, 5), 36);
      if (b.n < 0.1) continue;
      clumpLines.push(<path key={`cl${k}`} d={`M${n1(a.x)},${n1(a.y)} Q${n1(b.x)},${n1(b.y)} ${n1(c.x)},${n1(c.y)}`} fill="none" stroke={C.ink} strokeWidth={2.6 * inkS} strokeLinecap="round" opacity={0.5} />);
      clumpLines.push(<path key={`cs${k}`} d={`M${n1(a.x)},${n1(a.y + 8)} Q${n1(b.x + Lx * 8)},${n1(b.y)} ${n1(lerp(b.x, c.x, 0.5))},${n1(lerp(b.y, c.y, 0.5))}`} fill="none" stroke={lighting === 'dusk' ? mixHex(hairSh.lit, hairSh.rim, 0.3) : hairSh.rim} strokeWidth={3.5 * inkS} strokeLinecap="round" opacity={0.45 * (1 - ill * 0.5)} />);
    }
  }

  // ======================================================================= face pieces
  // hair cap (inside the face clip): everything above the visible hairline, closed outward
  const capPts: P3[] = [];
  for (let i = 0; i <= 120; i++) {
    const th = -Math.PI + (i / 120) * Math.PI * 2;
    const q = surf(th, hairlineY(th), 2);
    if (q.n > 0.02) capPts.push(q);
  }
  let capD = '';
  if (capPts.length > 2) {
    // the visible hairline is one run (or two runs wrapping through ±PI): rotate so it starts after the gap
    let gapAt = 0;
    let maxGap = -1;
    for (let i = 0; i < capPts.length; i++) {
      const a = capPts[i], b = capPts[(i + 1) % capPts.length];
      const gd = Math.hypot(a.x - b.x, a.y - b.y);
      if (gd > maxGap) {
        maxGap = gd;
        gapAt = i + 1;
      }
    }
    const run = [...capPts.slice(gapAt), ...capPts.slice(0, gapAt)];
    const a0 = run[0], a1 = run[run.length - 1];
    const dir = a1.x >= a0.x ? 1 : -1;
    capD = `${SP(run)} L${n1(a1.x + dir * 600)},${n1(a1.y)} L${n1(a1.x + dir * 600)},-700 L${n1(a0.x - dir * 600)},-700 L${n1(a0.x - dir * 600)},${n1(a0.y)} Z`;
  }

  // ears: a flap attached along the side of the head, sticking out and back
  const ear = (side: number) => {
    const N = 16;
    const rim: P3[] = [], inner: P3[] = [];
    const earPt = (u: number, y: number, out: number) => {
      const root = g.local(side * 1.5, y, 0);
      const ax = root.x + side * (4 + out * u);
      const az = root.z - 50 * u;
      return {...g.proj(ax, y, az), n: 0};
    };
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i / (N - 1)) * Math.PI; // top -> back -> lobe
      const u = 0.12 + 0.88 * Math.cos(a) * (a > 0.9 ? 0.75 : 1);
      const y = 40 + 56 * Math.sin(a) * (a < 0 ? 0.95 : 1);
      rim.push(earPt(u, y, 26));
      inner.push(earPt(0.2 + 0.5 * Math.cos(a), 44 + 30 * Math.sin(a), 18));
    }
    const rootTop = earPt(0, -8, 0), rootBot = earPt(0, 92, 0);
    const d = `M${n1(rootTop.x)},${n1(rootTop.y)} L${n1(rim[0].x)},${n1(rim[0].y)} ${SP(rim).replace(/^M[^C]*/, '')} L${n1(rootBot.x)},${n1(rootBot.y)} Z`;
    const nrm = g.local(side * 1.57, 40, 0);
    const facing = -nrm.nx * g.sY * 0 + (side < 0 ? g.sY : -g.sY); // >0 when this ear is turned toward the camera
    return {
      front: facing > 0.3,
      node: (
        <g key={`ear${side}`}>
          <path d={d} fill={skin.lit} stroke={C.ink} strokeWidth={inkW * 0.85} strokeLinejoin="round" />
          {detail > 0.3 && facing > -0.2 && <path d={SP(inner.slice(2, N - 2))} fill="none" stroke={skin.shade} strokeWidth={9 * inkS} strokeLinecap="round" />}
          {detail > 0.5 && facing > 0.2 && <path d={SP(inner.slice(5, N - 5).map((q) => ({x: lerp(q.x, rootTop.x, 0.25), y: q.y})))} fill="none" stroke={skin.deep} strokeWidth={4 * inkS} strokeLinecap="round" opacity={0.7} />}
        </g>
      ),
    };
  };
  const ears = [ear(-1), ear(1)];
  // ---- eyes
  const eyeNodes: React.ReactNode[] = [];
  const browNodes: React.ReactNode[] = [];
  const underEyeNodes: React.ReactNode[] = [];
  for (const side of [-1, 1]) {
    const thc = side * 0.47;
    const cc = surf(thc, -10, 3);
    if (cc.n < 0.08) continue;
    const fo = clamp(cc.n);
    const yc = -10;
    const N = 11;
    const up: Pt[] = [], lo: Pt[] = [], cl: Pt[] = [];
    const lowOpen = clamp(open * 2.4);
    for (let i = 0; i < N; i++) {
      const u = -1 + (2 * i) / (N - 1); // -1 inner .. +1 outer
      const th = side * (0.47 + 0.3 * u);
      const corner = lerp(6, -5, (u + 1) / 2);
      const shape = Math.pow(Math.max(0, 1 - u * u), 0.55) * (1 - 0.15 * u);
      const closedY = yc + corner + 12 * (1 - u * u);
      const openY = yc + corner - 47 * shape - ex.browY * 0.15;
      const lidY = lerp(closedY, openY, Math.min(1, open)) - Math.max(0, open - 1) * 16 * shape;
      const loOpen = yc + corner + (23 - ex.squint * 11 - ex.cheek * 2) * Math.pow(Math.max(0, 1 - u * u), 0.85);
      const loY = lerp(closedY + 1, loOpen, lowOpen);
      const qa = surf(th, lidY, 3), qb = surf(th, loY, 3), qc = surf(th, closedY, 3);
      up.push(qa);
      lo.push(qb);
      cl.push(qc);
    }
    const sclera = `${SP(up)} L${n1(lo[N - 1].x)},${n1(lo[N - 1].y)} ${SP([...lo].reverse()).replace(/^M/, 'L')} Z`;
    const cId = `${id}-eye${side}`;
    const ic = surf(thc + 0.13 * lk[0] - side * 0.015, yc + 4 + lk[1] * 9, 3);
    const irx = 26 * Math.max(0.35, fo), iry = 31;
    const outer = up[N - 1];
    const prev = up[N - 3];
    const fdx = outer.x - prev.x, fdy = outer.y - prev.y;
    const fl = Math.hypot(fdx, fdy) || 1;
    const tip = {x: outer.x + (fdx / fl) * 16, y: outer.y + (fdy / fl) * 16 + 6};
    const lashTop = up.map((q, i) => {
      const u = -1 + (2 * i) / (N - 1);
      const th = Math.max(0, 1 - u * u);
      return {x: q.x, y: q.y - (4 + 8 * th) * clamp(open * 3 + 0.5)};
    });
    if (open > 0.06) {
      const lashD = `${SP(up)} L${n1(tip.x)},${n1(tip.y)} ${SP([...lashTop].reverse()).replace(/^M/, 'L')} Z`;
      // catch-light toward the key light
      const cx0 = ic.x + Lx * irx * 0.42, cy0 = ic.y + Math.min(0, Ly) * iry * 0.4 - iry * 0.18;
      eyeNodes.push(
        <g key={`e${side}`}>
          <clipPath id={cId}>
            <path d={sclera} />
          </clipPath>
          <path d={sclera} fill={mixHex(C.sclera, skin.shade, 0.08 + ill * 0.12 + dry * 0.12)} />
          <g clipPath={`url(#${cId})`}>
            <ellipse cx={n1(ic.x)} cy={n1(ic.y)} rx={n1(irx)} ry={n1(iry)} fill={mixHex(C.iris, C.pupil, 0.1)} stroke={C.ink} strokeWidth={2.5 * inkS} />
            <ellipse cx={n1(ic.x)} cy={n1(ic.y - iry * 0.45)} rx={n1(irx * 1.02)} ry={n1(iry * 0.6)} fill={C.pupil} opacity={0.45} />
            {detail > 0.35 && <ellipse cx={n1(ic.x)} cy={n1(ic.y + iry * 0.38)} rx={n1(irx * 0.74)} ry={n1(iry * 0.44)} fill={C.irisLight} opacity={0.8 - ill * 0.3 - dry * 0.35} />}
            <ellipse cx={n1(ic.x)} cy={n1(ic.y + 1)} rx={n1(irx * 0.44)} ry={n1(iry * 0.46)} fill={C.pupil} />
            {/* upper-lid shadow on the eye */}
            <path d={SP(up)} fill="none" stroke={mixHex(C.sclera, C.inkSoft, 0.55)} strokeWidth={14 + 3 * dry} transform={`translate(0,${n1(7 + 1 * dry)})`} opacity={0.75} />
            <ellipse cx={n1(cx0)} cy={n1(cy0)} rx={n1(irx * 0.36)} ry={n1(iry * 0.3)} fill={C.eyeShine} opacity={1 - ill * 0.35} />
            {detail > 0.45 && <circle cx={n1(ic.x - Lx * irx * 0.42)} cy={n1(ic.y + iry * 0.42)} r={n1(Math.max(1.5, irx * 0.14))} fill={C.eyeShine} opacity={0.85 - ill * 0.4 - dry * 0.3} />}
          </g>
          <path d={sclera} fill="none" stroke={C.ink} strokeWidth={2 * inkS} opacity={0.5} />
          {detail > 0.3 && <path d={SP(lo.slice(3, N))} fill="none" stroke={mixHex(C.ink, skin.deep, 0.4)} strokeWidth={3 * inkS} strokeLinecap="round" />}
          <path d={lashD} fill={C.ink} stroke={C.ink} strokeWidth={1.5 * inkS} strokeLinejoin="round" />
          {/* double-eyelid crease */}
          {detail > 0.45 && <path d={SP(up.slice(2, N - 1).map((q) => ({x: q.x, y: q.y - 13 - 4 * ex.droop})))} fill="none" stroke={skin.deep} strokeWidth={(3 + 2 * ex.droop) * inkS} strokeLinecap="round" opacity={0.6 + 0.3 * ex.droop} />}
        </g>,
      );
    } else {
      eyeNodes.push(
        <g key={`e${side}`}>
          <path d={SP(cl)} fill="none" stroke={C.ink} strokeWidth={6.5 * inkS} strokeLinecap="round" />
          <path d={`M${n1(cl[N - 2].x)},${n1(cl[N - 2].y)} L${n1(tip.x)},${n1(tip.y + 6)}`} stroke={C.ink} strokeWidth={5 * inkS} strokeLinecap="round" />
          {detail > 0.4 && <path d={SP(cl.slice(2, N - 1).map((q) => ({x: q.x, y: q.y - 12})))} fill="none" stroke={skin.shade} strokeWidth={5 * inkS} strokeLinecap="round" opacity={0.8} />}
          {/* squeezed (pain): little tension lines */}
          {ex.squint > 0.7 && detail > 0.4 && <path d={`M${n1(tip.x + side * 4)},${n1(tip.y - 4)} l${n1(side * 12)},-4 M${n1(tip.x + side * 4)},${n1(tip.y + 6)} l${n1(side * 12)},4`} stroke={skin.deep} strokeWidth={3 * inkS} strokeLinecap="round" opacity={0.7} />}
        </g>,
      );
    }
    // under-eye shadow (tired / ill)
    const ue = clamp(ill * 1.1 + ex.droop * 0.35);
    if (ue > 0.04 && detail > 0.3) {
      const ueP = lo.slice(2, N).map((q) => ({x: q.x, y: q.y + 9}));
      underEyeNodes.push(<path key={`ue${side}`} d={SP(ueP)} fill="none" stroke={C.underEye} strokeWidth={10 * inkS} strokeLinecap="round" opacity={0.55 * ue} />);
      underEyeNodes.push(<path key={`ue2${side}`} d={SP(ueP.slice(1).map((q) => ({x: q.x, y: q.y + 6})))} fill="none" stroke={C.underEye} strokeWidth={5 * inkS} strokeLinecap="round" opacity={0.3 * ue} />);
    }
    // sunken eye sockets (dehydration): a dark crescent under the lower lid with a crease at the
    // orbital rim, a hollow band above the upper lid, a shadow at the inner corner
    if (dry > 0.04 && detail > 0.3) {
      const dk = clamp((dry - 0.05) * 1.25);
      const sunk = mixHex(C.eyeSunk, skin.shade, 0.35);
      const NL = lo.length;
      const upperE = lo.map((q) => ({x: q.x, y: q.y + 3}));
      const lowerE = lo.map((q, i) => {
        const u = -1 + (2 * i) / (NL - 1);
        return {x: q.x + side * u * 3, y: q.y + 4 + (8 + 18 * dk) * Math.pow(Math.max(0, 1 - u * u), 0.8) * (1 - 0.25 * u * side)};
      });
      const cres = `${SP(upperE)} ${SP([...lowerE].reverse()).replace(/^M/, 'L')} Z`;
      underEyeNodes.push(<path key={`sk${side}`} d={cres} fill={sunk} opacity={0.62 * dk} />);
      underEyeNodes.push(<path key={`sk2${side}`} d={SP(lowerE.slice(2, NL - 1))} fill="none" stroke={mixHex(C.eyeSunk, C.ink, 0.2)} strokeWidth={3.2 * inkS} strokeLinecap="round" opacity={0.55 * dk} />);
      // hollow above the lid: only the outer two-thirds, under the brow
      underEyeNodes.push(<path key={`sk3${side}`} d={SP(up.slice(3, N - 1).map((q) => ({x: q.x, y: q.y - 13})))} fill="none" stroke={sunk} strokeWidth={11 * inkS} strokeLinecap="round" opacity={0.3 * dk} />);
      const ic2 = surf(side * 0.17, 2, 2);
      if (ic2.n > 0.1) underEyeNodes.push(<ellipse key={`sk4${side}`} cx={n1(ic2.x)} cy={n1(ic2.y)} rx={n1(8 * clamp(ic2.n))} ry={15} fill={sunk} opacity={0.38 * dk} />);
    }
    // brow
    const bt: Pt[] = [], bb: Pt[] = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const th = side * (0.13 - ex.knit * 0.004 + 0.68 * u);
      const by = lerp(-60 - ex.browAng * 1.2, -70 + ex.browAng * 0.3, u) - ex.browY - 7 * Math.sin(Math.PI * u) * (1 - ex.browAng / 25);
      const thick = lerp(15, 7, u);
      const q1 = surf(th, by, 5), q2 = surf(th, by + thick, 5);
      if (q1.n < -0.05) continue;
      bt.push(q1);
      bb.push(q2);
    }
    if (bt.length > 2)
      browNodes.push(<path key={`b${side}`} d={`${SP(bt)} ${SP([...bb].reverse()).replace(/^M/, 'L')} Z`} fill={mixHex(C.brow, C.hairLight, 0.05)} stroke={C.brow} strokeWidth={2.5 * inkS} strokeLinejoin="round" />);
    // knit lines (pain / worry)
    if (side === 1 && ex.knit > 3 && detail > 0.4) {
      const k1 = surf(0.06, -66, 5), k2 = surf(-0.06, -66, 5);
      browNodes.push(<path key="knit" d={`M${n1(k1.x)},${n1(k1.y - 10)} l-2,18 M${n1(k2.x)},${n1(k2.y - 10)} l2,18`} stroke={skin.deep} strokeWidth={3 * inkS} strokeLinecap="round" opacity={clamp(ex.knit / 10) * 0.8} />);
    }
  }

  // ---- nose
  const noseNodes: React.ReactNode[] = [];
  if (surf(0, 60, 2).n > 0.05) {
    const tipP = surf(0, 70, 2);
    const baseSide = surf(-faceSide * 0.13, 84, 1);
    const bridge = surf(faceSide * -0.07, 6, 2);
    const nost = surf(faceSide * 0.12, 82, 2);
    // cast shadow of the nose (side away from the light)
    const shSide = Lx >= 0 ? -1 : 1;
    const sh1 = surf(shSide * 0.12, 30, 1), sh2 = surf(shSide * 0.16, 80, 1), sh3 = surf(0, 86, 1);
    if (detail > 0.3)
      noseNodes.push(<path key="nsh" d={`M${n1(sh1.x)},${n1(sh1.y)} Q${n1(sh2.x + shSide * 6)},${n1(sh2.y - 10)} ${n1(sh2.x)},${n1(sh2.y)} L${n1(sh3.x)},${n1(sh3.y)} Q${n1(lerp(sh1.x, tipP.x, 0.5))},${n1(lerp(sh1.y, tipP.y, 0.6))} ${n1(sh1.x)},${n1(sh1.y)} Z`} fill={skin.shade} opacity={0.85} />);
    noseNodes.push(
      <path key="n" d={`M${n1(bridge.x)},${n1(bridge.y + 30)} Q${n1(tipP.x + faceSide * -4)},${n1(tipP.y - 18)} ${n1(tipP.x)},${n1(tipP.y + 2)} Q${n1(lerp(tipP.x, baseSide.x, 0.5))},${n1(tipP.y + 14)} ${n1(baseSide.x)},${n1(baseSide.y)}`} fill="none" stroke={mixHex(C.ink, skin.deep, 0.35)} strokeWidth={3.4 * inkS} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />,
    );
    if (detail > 0.35) noseNodes.push(<path key="nos" d={`M${n1(nost.x - 7)},${n1(nost.y - 1)} q7,5 14,0`} fill="none" stroke={C.ink} strokeWidth={3 * inkS} strokeLinecap="round" opacity={0.75} />);
    if (detail > 0.45) noseNodes.push(<ellipse key="nhl" cx={n1(tipP.x + Lx * 8)} cy={n1(tipP.y - 8)} rx={7} ry={4.5} fill={C.skinLight} opacity={0.75 - ill * 0.3} />);
  }

  // ---- mouth
  const mouthNodes: React.ReactNode[] = [];
  {
    const W = 0.34 * ex.mouthW * (1 + ex.mouth * 0.15);
    const my = 120;
    const cornerY = my - ex.curve * 13;
    const Hm = ex.mouth * 46;
    const topPts: Pt[] = [], botPts: Pt[] = [];
    const NM = 9;
    for (let i = 0; i < NM; i++) {
      const u = -1 + (2 * i) / (NM - 1);
      const th = u * W;
      const yT = lerp(my + Math.max(0, ex.curve) * 4 - 2 - ex.mouth * 3, cornerY, Math.pow(Math.abs(u), 1.5)) - (ex.curve > 0 ? ex.curve * 2 * (1 - u * u) * ex.mouth : 0);
      const yB = yT + (Hm + (ex.curve > 0.5 && ex.mouth > 0.05 ? 6 : 0)) * Math.pow(Math.max(0, 1 - u * u), 0.75) * (ex.curve > 0 ? 1 : 0.85);
      const qT = surf(th, yT, 3), qB = surf(th, yB, 3);
      topPts.push(qT);
      botPts.push(qB);
    }
    const vis = topPts.filter((q) => (q as P3).n > -0.1).length > 3;
    if (vis) {
      if (ex.mouth < 0.035) {
        mouthNodes.push(<path key="m" d={SP(topPts)} fill="none" stroke={mixHex(C.ink, lipCol, 0.3)} strokeWidth={4 * inkS} strokeLinecap="round" />);
        if (detail > 0.4) {
          const lp = botPts.slice(2, NM - 2).map((q) => ({x: q.x, y: q.y + 16}));
          mouthNodes.push(<path key="ml" d={SP(lp)} fill="none" stroke={lipCol} strokeWidth={6 * inkS} strokeLinecap="round" opacity={0.55} />);
        }
      } else {
        const md = `${SP(topPts)} ${SP([...botPts].reverse()).replace(/^M/, 'L')} Z`;
        const mId = `${id}-mouth`;
        const teethH = clamp(Hm * 0.45, 0, 13) * ex.teeth;
        mouthNodes.push(
          <g key="m">
            <clipPath id={mId}>
              <path d={md} />
            </clipPath>
            <path d={md} fill={mixHex(C.ink, C.lip, 0.35)} />
            <g clipPath={`url(#${mId})`}>
              {detail > 0.3 && <ellipse cx={n1(botPts[4].x)} cy={n1(botPts[4].y)} rx={n1(Math.abs(topPts[NM - 1].x - topPts[0].x) * 0.32)} ry={n1(Hm * 0.35 + 5)} fill={mixHex(lipCol, C.blush, 0.4)} />}
              {teethH > 0.5 && <path d={SP(topPts)} fill="none" stroke={C.sclera} strokeWidth={n1(teethH * 2)} />}
            </g>
            <path d={md} fill="none" stroke={C.ink} strokeWidth={3.6 * inkS} strokeLinejoin="round" />
            {detail > 0.4 && <path d={SP(botPts.slice(2, NM - 2).map((q) => ({x: q.x, y: q.y + 10})))} fill="none" stroke={lipCol} strokeWidth={6 * inkS} strokeLinecap="round" opacity={0.55} />}
          </g>,
        );
      }
      // dehydrated lips: the lower lip turns dull and dry, then splits into cracks
      if (dry > 0.06 && detail > 0.3) {
        const dk = clamp(dry * 1.25);
        const LB = botPts.slice(1, NM - 1);
        const NB = LB.length;
        const upperL = LB.map((q) => ({x: q.x, y: q.y + 3}));
        const lowerL = LB.map((q, i) => {
          const u = -1 + (2 * i) / (NB - 1);
          return {x: q.x, y: q.y + 3 + 19 * Math.pow(Math.max(0, 1 - u * u), 0.7)};
        });
        const atL = (arr: Pt[], t: number) => {
          const x = clamp(t) * (arr.length - 1);
          const i = Math.min(arr.length - 2, Math.floor(x));
          return {x: lerp(arr[i].x, arr[i + 1].x, x - i), y: lerp(arr[i].y, arr[i + 1].y, x - i)};
        };
        mouthNodes.push(<path key="dlip" d={`${SP(upperL)} ${SP([...lowerL].reverse()).replace(/^M/, 'L')} Z`} fill={mixHex(C.lipDry, C.lipPale, 0.25)} opacity={0.8 * dk} />);
        mouthNodes.push(<path key="dlipH" d={SP(upperL.slice(2, NB - 2).map((q, i) => ({x: q.x, y: q.y + 6 + 2 * Math.sin((i / (NB - 5)) * Math.PI)})))} fill="none" stroke={mixHex(C.lipDry, C.skinLight, 0.55)} strokeWidth={3 * inkS} strokeLinecap="round" opacity={0.7 * dk} />);
        mouthNodes.push(<path key="dlipE" d={SP(lowerL.slice(1, NB - 1))} fill="none" stroke={mixHex(C.lipCrack, skin.shade, 0.35)} strokeWidth={2.6 * inkS} strokeLinecap="round" opacity={0.6 * dk} />);
        const crk = clamp((dry - 0.16) / 0.26);
        if (crk > 0) {
          // a few irregular splits on the lower lip (not evenly spaced: never a 'stitched' look)
          const TS = [0.3, 0.62, 0.46, 0.78, 0.2];
          const nC = Math.round(1 + 4 * dk);
          let cd = '';
          for (let c = 0; c < nC; c++) {
            const t = TS[c] + (hash(c, 71) - 0.5) * 0.06;
            const a = atL(upperL, t), b = atL(lowerL, t);
            const L0 = 0.15 + 0.15 * hash(c, 77), L2 = 0.6 + 0.3 * hash(c, 72);
            const sk = (hash(c, 73) - 0.5) * 9;
            cd += `M${n1(lerp(a.x, b.x, L0))},${n1(lerp(a.y, b.y, L0))} L${n1(lerp(a.x, b.x, (L0 + L2) / 2) + sk * 0.3)},${n1(lerp(a.y, b.y, (L0 + L2) / 2))} L${n1(lerp(a.x, b.x, L2) + sk)},${n1(lerp(a.y, b.y, L2))} `;
          }
          if (dry > 0.55) {
            const q = atL(topPts.slice(2, NM - 2), 0.4);
            cd += `M${n1(q.x)},${n1(q.y - 3)} L${n1(q.x + 2)},${n1(q.y - 10)} `;
          }
          mouthNodes.push(<path key="crk" d={cd} fill="none" stroke={C.lipCrack} strokeWidth={3.2 * inkS} strokeLinecap="round" opacity={0.9 * crk} />);
          // pale flaky edges along the cracks
          const fl1 = atL(upperL, 0.33), fl2 = atL(upperL, 0.62);
          mouthNodes.push(<path key="flk" d={`M${n1(fl1.x - 9)},${n1(fl1.y + 5)} l8,-2 M${n1(fl2.x - 6)},${n1(fl2.y + 6)} l9,1`} stroke={C.skinLight} strokeWidth={2.4 * inkS} strokeLinecap="round" opacity={0.6 * crk} />);
        }
      }
      // smile corners
      if (ex.curve > 0.35 && detail > 0.4)
        for (const k of [0, NM - 1]) {
          const q = topPts[k] as P3;
          if (q.n < 0.15) continue;
          const sd = k === 0 ? -1 : 1;
          mouthNodes.push(<path key={`sc${k}`} d={`M${n1(q.x + sd * 4)},${n1(q.y - 10)} q${n1(sd * 7)},8 ${n1(sd * 2)},18`} fill="none" stroke={skin.deep} strokeWidth={3 * inkS} strokeLinecap="round" opacity={0.65 * clamp(ex.curve)} />);
        }
    }
  }

  // ---- cheeks: blush, hollows, highlights, sweat
  const cheekNodes: React.ReactNode[] = [];
  if (detail > 0.25) {
    for (const side of [-1, 1]) {
      const c = surf(side * 0.74, 56, 2);
      if (c.n < 0.1) continue;
      const fo = clamp(c.n);
      const bl = (0.16 + 0.12 * ex.cheek) * (1 - ill * 0.9) * (1 - 0.85 * dry);
      cheekNodes.push(<ellipse key={`bl${side}`} cx={n1(c.x)} cy={n1(c.y + 6)} rx={n1(40 * fo)} ry={15} fill={C.blush} opacity={bl} />);
      if (detail > 0.5 && bl > 0.08)
        cheekNodes.push(
          <path key={`bh${side}`} d={`M${n1(c.x - 18 * fo)},${n1(c.y)} l${n1(7 * fo)},9 M${n1(c.x - 2 * fo)},${n1(c.y - 2)} l${n1(7 * fo)},9 M${n1(c.x + 14 * fo)},${n1(c.y)} l${n1(7 * fo)},9`} stroke={C.lip} strokeWidth={2.5 * inkS} opacity={bl * 0.9} />,
        );
      if (thin > 0.05 && detail > 0.4) {
        // hollow under the cheekbone: a soft crease + a faint shade wedge on the cheek
        const c1 = surf(side * 1.05, 92, 1), c2 = surf(side * 0.95, 126, 1), c3 = surf(side * 0.78, 152, 1);
        if (c2.n > 0.15)
          cheekNodes.push(
            <path key={`ho${side}`} d={`M${n1(c1.x)},${n1(c1.y)} Q${n1(c2.x - side * 8)},${n1(c2.y)} ${n1(c3.x)},${n1(c3.y)}`} fill="none" stroke={mixHex(skin.deep, C.eyeSunk, 0.4)} strokeWidth={16 * inkS} strokeLinecap="round" opacity={(0.1 + 0.12 * dry) * clamp(thin * 1.3)} />,
          );
        if (dry > 0.3 && c2.n > 0.15)
          cheekNodes.push(
            <path key={`ho2${side}`} d={`M${n1(c1.x + side * 6)},${n1(c1.y - 6)} Q${n1(c2.x - side * 2)},${n1(c2.y - 4)} ${n1(c3.x - side * 4)},${n1(c3.y - 8)}`} fill="none" stroke={skin.deep} strokeWidth={3 * inkS} strokeLinecap="round" opacity={0.45 * clamp((dry - 0.3) * 2.5)} />,
          );
      }
    }
    // cheekbone highlight on the lit side
    const hs = Lx >= 0 ? 1 : -1;
    const hc = surf(hs * 0.62, 40, 3);
    if (hc.n > 0.2 && detail > 0.45) cheekNodes.push(<ellipse key="chl" cx={n1(hc.x)} cy={n1(hc.y)} rx={16} ry={7} fill={C.skinLight} opacity={0.55 * (1 - ill * 0.6)} transform={`rotate(-20 ${n1(hc.x)} ${n1(hc.y)})`} />);
    if (sweat > 0.02 && detail > 0.4) {
      const sp: [number, number][] = [[0.2, -110], [-0.5, -96], [0.78, 20], [-0.8, 10], [0.4, -130]];
      sp.forEach(([th, yy], i) => {
        const q = surf(th, yy, 4);
        if (q.n > 0.2) cheekNodes.push(<Glint key={`sw${i}`} x={q.x} y={q.y} r={6 + 3 * hash(i, 3)} o={sweat * (0.5 + 0.4 * Math.sin(f * 0.15 + i * 2))} col={C.skinLight} />);
      });
    }
  }

  // ======================================================================= front hair (bangs)
  const bangNodes: React.ReactNode[] = [];
  const bangShadow: string[] = [];
  {
    const arr = BANGS.map((b, j) => {
      const mid = surf(lerp(b.th, b.tth, 0.5), lerp(b.yr, b.ty, 0.5), b.dzm);
      return {b, j, z: mid.z};
    }).sort((a, b) => a.z - b.z);
    const NS = 7;
    for (const {b, j} of arr) {
      const r0 = surf(b.th, b.yr, 50);
      if (r0.n < -0.3) continue;
      const fl = flowA * (wander(f * 0.045 + j * 1.9, 21) * 1.3 + Math.sin(f * 0.21 + j * 1.7) * 0.35);
      const fl2 = flowA * (wander(f * 0.05 + j * 2.7 + 9, 23) + Math.sin(f * 0.17 + j * 2.3) * 0.3);
      const pil = pillow ? 1 : 0;
      const tth = b.tth + fl * 0.13 + hd[0] * 0.12 + pil * (b.th - b.tth) * 0.5 + dry * 0.2 * (hash(j, 51) - 0.5);
      const ty = b.ty + fl2 * 12 + hd[1] * 14 - pil * (b.ty - b.yr) * 0.45 + dry * 30 * (hash(j, 52) - 0.35);
      const left: Pt[] = [], right: Pt[] = [], ctr: Pt[] = [];
      for (let i = 0; i <= NS; i++) {
        const t = i / NS;
        const wave = Math.sin(t * Math.PI * 1.3 + j) * 0.07 * (0.6 + 0.4 * hash(j, 4));
        const curlT = Math.pow(t, 3) * b.curl * 0.16;
        const th = lerp(b.th, tth, t) + wave + curlT;
        const y = lerp(b.yr, ty, Math.pow(t, 0.9)) - Math.pow(t, 4) * Math.abs(b.curl) * 16;
        const dz = lerp(54, 20, t) + Math.sin(Math.PI * t) * (b.dzm - 12);
        const hw = (b.w / 2) * Math.pow(1 - t, 0.75) + 0.004;
        left.push(surf(th - hw, y, dz));
        right.push(surf(th + hw, y, dz));
        ctr.push(surf(th + hw * 0.25 * Math.sign(Lx || 1), y, dz + 1));
      }
      const d = `${SP(left)} L${n1(right[NS].x)},${n1(right[NS].y)} ${SP([...right].reverse()).replace(/^M/, 'L')} Z`;
      bangShadow.push(d);
      bangNodes.push(<path key={`bg${j}`} d={d} fill={hairSh.lit} stroke={C.ink} strokeWidth={inkW * 0.72} strokeLinejoin="round" />);
      if (detail > 0.45) {
        bangNodes.push(<path key={`bs${j}`} d={SP(right.slice(1, NS - 1).map((q, i) => ({x: lerp(q.x, ctr[i + 1].x, 0.55), y: lerp(q.y, ctr[i + 1].y, 0.55)})))} fill="none" stroke={hairSh.shade} strokeWidth={6 * inkS} strokeLinecap="round" opacity={0.8} />);
        bangNodes.push(<path key={`bh${j}`} d={SP(ctr.slice(1, Math.ceil(NS * 0.6)))} fill="none" stroke={hairSh.rim} strokeWidth={4 * inkS} strokeLinecap="round" opacity={0.7 * (1 - ill * 0.5) * (1 - 0.55 * dry)} />);
      }
    }
  }
  // crown strands (texture on the cap/top) + a broken sheen band
  const strandNodes: React.ReactNode[] = [];
  if (detail > 0.45) {
    for (let k = 0; k < 9; k++) {
      const th = lerp(-1.5, 1.5, k / 8) + (hash(k, 4) - 0.5) * 0.25;
      const a = surf(th * 0.3, -266, 50), b = surf(th * 0.85, -200, 52);
      const c = surf(th * 1.08, -150 + 20 * hash(k, 9), 40);
      if (b.n < 0.05) continue;
      strandNodes.push(<path key={`st${k}`} d={`M${n1(a.x)},${n1(a.y)} Q${n1(b.x)},${n1(b.y)} ${n1(c.x)},${n1(c.y)}`} fill="none" stroke={C.ink} strokeWidth={2.4 * inkS} strokeLinecap="round" opacity={0.5} />);
    }
    for (let k = 0; k < 6; k++) {
      const th0 = lerp(-1.1, 1.1, k / 5) + (hash(k, 31) - 0.5) * 0.2;
      const y0 = -236 + 14 * hash(k, 32);
      const a = surf(th0 - 0.12, y0 - 8, 66), b = surf(th0, y0, 68), c = surf(th0 + 0.1, y0 + 14, 64);
      if (b.n < 0.1) continue;
      strandNodes.push(
        <path key={`sh${k}`} d={`M${n1(a.x)},${n1(a.y)} Q${n1(b.x)},${n1(b.y - 6)} ${n1(c.x)},${n1(c.y)}`} fill="none" stroke={mixHex(hairSh.rim, lighting === 'day' ? C.skyLow : C.hairLight, lighting === 'day' ? 0.25 : 0)} strokeWidth={7 * inkS} strokeLinecap="round" opacity={0.6 * (1 - ill * 0.6) * (1 - 0.65 * dry) * clamp(b.n * 2)} />,
      );
    }
  }

  // ---- flyaway strands (dehydrated: messier, duller hair)
  const flyNodes: React.ReactNode[] = [];
  if (dry > 0.12 && detail > 0.35) {
    const nFly = Math.round(4 + 10 * dry);
    const fo = clamp((dry - 0.12) * 3);
    let fd = '';
    for (let k = 0; k < nFly; k++) {
      const a = hairBase[Math.floor(hash(k, 61) * HB) % HB];
      const ox = a[0] - g.centre.x, oy = a[1] - g.centre.y;
      const r = Math.hypot(ox, oy) || 1;
      if (oy / r > 0.3 || r < 120) continue; // only the top + sides of the hair mass
      const len = (24 + 36 * hash(k, 62)) * (0.55 + 0.45 * dry);
      const ang = Math.atan2(oy, ox) + (hash(k, 63) - 0.5) * 1.3 + 0.1 * wander(f * 0.02 + k, 64);
      const tip = {x: a[0] + Math.cos(ang) * len, y: a[1] + Math.sin(ang) * len};
      const bend = (hash(k, 65) - 0.5) * 0.9 * len;
      const mid = {x: (a[0] + tip.x) / 2 - Math.sin(ang) * bend, y: (a[1] + tip.y) / 2 + Math.cos(ang) * bend};
      fd += `M${n1(a[0] - Math.cos(ang) * 8)},${n1(a[1] - Math.sin(ang) * 8)} Q${n1(mid.x)},${n1(mid.y)} ${n1(tip.x)},${n1(tip.y)} `;
    }
    flyNodes.push(<path key="fly" d={fd} fill="none" stroke={C.ink} strokeWidth={3.4 * inkS} strokeLinecap="round" opacity={0.85 * fo} />);
    flyNodes.push(<path key="fly2" d={fd} fill="none" stroke={hairSh.lit} strokeWidth={1.4 * inkS} strokeLinecap="round" opacity={0.7 * fo} />);
  }

  // ---- cannula
  const cannulaNodes: React.ReactNode[] = [];
  if (p.cannula) {
    const tube = (side: number) => {
      const pts = [surf(side * 0.1, 86, 6), surf(side * 0.42, 98, 8), surf(side * 0.9, 96, 10), surf(side * 1.36, 66, 12), surf(side * 1.55, -6, 16), surf(side * 1.74, 30, 12), surf(side * 1.7, 110, 10)];
      return pts;
    };
    for (const side of [-1, 1]) {
      const pts = tube(side);
      const vis = pts.filter((q) => q.n > 0);
      if (vis.length < 2) continue;
      const d = SP(pts.slice(0, 5));
      cannulaNodes.push(
        <g key={`cn${side}`}>
          <path d={d} fill="none" stroke={rgba(C.ink, 0.7)} strokeWidth={10 * inkS} strokeLinecap="round" />
          <path d={d} fill="none" stroke={C.cannula} strokeWidth={6.5 * inkS} strokeLinecap="round" />
          <path d={d} fill="none" stroke="#fff" strokeWidth={2 * inkS} strokeLinecap="round" opacity={0.8} transform="translate(0,-2)" />
        </g>,
      );
    }
    const pr = surf(0, 88, 8);
    cannulaNodes.push(<ellipse key="prong" cx={n1(pr.x)} cy={n1(pr.y)} rx={16} ry={6} fill={C.cannula} stroke={rgba(C.ink, 0.7)} strokeWidth={2.5 * inkS} />);
  }

  const silD = smoothPath(g.sil, true);
  const backEar = ears.map((q) => (q && !q.front ? q.node : null));
  const frontEar = ears.map((q) => (q && q.front ? q.node : null));

  return (
    <g transform={`translate(${n1(p.x)},${n1(p.y)}) rotate(${n1(p.rot ?? 0)}) scale(${s.toFixed(4)})`} opacity={p.opacity ?? 1}>
      {flyNodes}
      <CelPath id={`${id}-hairB`} d={hairD} sh={hairSh} k={34} r={11} inkW={inkW} flat={detail < 0.3} />
      <g transform={`rotate(${n1((p.bodyRot ?? p.rot ?? 0) - (p.rot ?? 0))} ${n1(bx)} 330)`}>{backEls}</g>
      {neckEls}
      <g transform={`rotate(${n1((p.bodyRot ?? p.rot ?? 0) - (p.rot ?? 0))} ${n1(bx)} 330)`}>{torsoEls}</g>
      {backEar}
      <CelPath id={`${id}-face`} d={silD} sh={{...skin, rim: mixHex(skin.shade, skin.rim, 0.45)}} k={58} r={4} inkW={inkW} flat={detail < 0.25}>
        {cheekNodes}
        {/* bangs' shadow on the forehead */}
        {detail > 0.3 && <g transform={`translate(${n1(-Lx * 8)},${n1(10 - Ly * 4)})`} fill={skin.shade} opacity={0.9}>{bangShadow.map((d, i) => <path key={i} d={d} />)}</g>}
        {capD && <path d={capD} fill={hairSh.lit} stroke={C.ink} strokeWidth={inkW * 0.6} strokeLinejoin="round" />}
      </CelPath>
      {frontEar}
      {underEyeNodes}
      {noseNodes}
      {mouthNodes}
      {eyeNodes}
      {browNodes}
      {clumpLines}
      {strandNodes}
      {bangNodes}
      {cannulaNodes}
    </g>
  );
};
