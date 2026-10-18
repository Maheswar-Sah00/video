import {camPt, camTf} from '../../lib/MedKit';
import {clamp, ease, lerp} from '../../lib/anim';

/** Where the x-ray body stands in WORLD coords for S03/S04 (head-top ≈ y 320, feet ≈ y 1900). */
export const BODY_S = 0.958;
export const BODY_X = 540;
export const BODY_Y = 770;
export const wp = (bx: number, by: number, s = BODY_S, x0 = BODY_X, y0 = BODY_Y) => ({x: x0 + bx * s, y: y0 + by * s});

/** Camera key: body point `a` (body units) appears at screen point `s` with zoom `z`. */
export type CamKey = {at: number; a: [number, number]; s: [number, number]; z: number};
export type Cam = {a: [number, number]; s: [number, number]; z: number};

export const camAt = (keys: CamKey[], f: number, e: (t: number) => number = ease.inOutCubic): Cam => {
  if (f <= keys[0].at) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i].at) {
      const k0 = keys[i - 1], k1 = keys[i];
      const t = e(clamp((f - k0.at) / Math.max(1, k1.at - k0.at)));
      return {
        a: [lerp(k0.a[0], k1.a[0], t), lerp(k0.a[1], k1.a[1], t)],
        s: [lerp(k0.s[0], k1.s[0], t), lerp(k0.s[1], k1.s[1], t)],
        z: lerp(k0.z, k1.z, t),
      };
    }
  }
  return keys[keys.length - 1];
};

/** world transform + body->screen mapper for a camera state (plus optional handheld offset/roll) */
export const camRig = (c: Cam, hx = 0, hy = 0, rot = 0, s = BODY_S, x0 = BODY_X, y0 = BODY_Y) => {
  const fw = wp(c.a[0], c.a[1], s, x0, y0);
  const focus: [number, number] = [fw.x + hx, fw.y + hy];
  const to: [number, number] = [c.s[0], c.s[1]];
  return {
    tf: camTf(focus, to, c.z, rot),
    scr: (bx: number, by: number) => camPt(wp(bx, by, s, x0, y0), focus, to, c.z, rot),
    world: (wx: number, wy: number) => camPt({x: wx, y: wy}, focus, to, c.z, rot),
  };
};
