// Picture side of the shared sync events (scripts/events.py -> src/sync-events.json).
// All functions take ABSOLUTE frames (scene `start` + local frame).
import ev from '../sync-events.json';
import tl from '../timeline.json';
import {clamp, lerp} from './anim';

type Curve = [number, number][];
export const EV = ev as unknown as {
  fps: number;
  total: number;
  sips: number[];
  drips: number[];
  alarms: number[];
  throbs: number[];
  beats: number[];
  stamps: number[];
  shutdown: number[];
  gulps: number[];
  hours: Curve;
  lostPerHour: number;
  hud: [number, number][];
  marks: Record<string, number | number[]>;
  words: Record<string, {w: string; f: number}[]>;
};
export const TL = tl as unknown as {
  fps: number;
  total: number;
  scenes: {id: string; name: string; at: number; into: null | {type: string; dur: number; fx?: number; fy?: number; color?: string}}[];
  marks: Record<string, number | number[]>;
};
export const mark = (k: string) => EV.marks[k] as number;
export const marks = (k: string) => EV.marks[k] as number[];

/** Absolute frame at which narration line `id` ('n01'..'n21') speaks `word` (case-insensitive,
 *  punctuation ignored; nth = which occurrence, 0-based). Throws if absent — so typos fail loudly. */
export const wordAt = (id: string, word: string, nth = 0) => {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, '');
  const hits = (EV.words[id] ?? []).filter((w) => norm(w.w) === norm(word));
  if (!hits[nth]) throw new Error(`wordAt: "${word}" not in ${id}`);
  return hits[nth].f;
};

/** Generic event envelope: 0..1, rises over `attack` frames to each event frame, decays over
 *  `decay` frames after it (max over overlapping events). */
export const pulseAt = (events: number[], f: number, attack = 2, decay = 12) => {
  let v = 0;
  for (const e of events) {
    const d = f - e;
    if (d < -attack || d > decay) continue;
    const x = d < 0 ? 1 + d / Math.max(1, attack) : Math.pow(1 - d / decay, 2);
    v = Math.max(v, x);
  }
  return clamp(v);
};

/** Index of the last event at or before f (-1 if none) + frames since it. */
export const lastEvent = (events: number[], f: number) => {
  let i = -1;
  for (let k = 0; k < events.length; k++) if (events[k] <= f) i = k;
  return {i, since: i >= 0 ? f - events[i] : Infinity};
};

/** Events at or before f within the last `within` frames, with their index and age. */
export const recent = (events: number[], f: number, within = 24) => {
  const out: {i: number; age: number}[] = [];
  events.forEach((p, i) => {
    const a = f - p;
    if (a >= 0 && a < within) out.push({i, age: a});
  });
  return out;
};

// ---------------------------------------------------------------------------------------------
// The countdown: hours without water, % of body weight lost as water, how dehydrated he looks

const curveAt = (c: Curve, f: number) => {
  if (f <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (f <= c[i][0]) {
      const t = (f - c[i - 1][0]) / Math.max(1, c[i][0] - c[i - 1][0]);
      return lerp(c[i - 1][1], c[i][1], t);
    }
  }
  return c[c.length - 1][1];
};
/** Hours since the last sip (0 before the clock starts; 24 on "Day one", 48 on "Day two", 72 on
 *  "Day three"; freezes at ~81 when his body stops; during the S18 rewind it shows the time of
 *  whichever scene is replaying backwards, down to 0). */
export const hoursAt = (f: number) => curveAt(EV.hours, f);
/** % of body weight lost as water (≈ 0.185 % per hour: 1 % thirst … 4 % day 1 … 9 % day 2 …
 *  13 % day 3 … 15 % at the end). */
export const lostAt = (f: number) => hoursAt(f) * EV.lostPerHour;
/** 0..1 how dehydrated he LOOKS (0 = fresh, 1 = the end) — drive the Hero's `dry` prop with it
 *  so every scene shows the same stage: dryAt(abs). Rewind (S18) brings it back to 0. */
export const dryAt = (f: number) => clamp(hoursAt(f) / 81);
/** Day number shown on the HUD (0 before 24 h, 1, 2, 3). */
export const dayAt = (f: number) => Math.floor(hoursAt(f) / 24 + 1e-6);
/** Is the HUD visible (with a 0..1 fade)? */
export const hudVis = (f: number) => {
  let v = 0;
  for (const [a, b] of EV.hud) v = Math.max(v, Math.min(clamp((f - a) / 10), clamp((b - f) / 10)));
  return clamp(v);
};

// ---------------------------------------------------------------------------------------------
// pulses (0..1 envelopes so picture beats exactly with the sound)

/** S01: a gulp (throat bob, the water level steps down). */
export const sipPulse = (f: number) => pulseAt(EV.sips, f, 3, 10);
/** S02: a drip landing (splash ring). The last one = EV.drips[2]. */
export const dripPulse = (f: number) => pulseAt(EV.drips, f, 1, 10);
/** S05: the thirst alarm ringing in the brain. */
export const alarmPulse = (f: number) => pulseAt(EV.alarms, f, 2, 10);
/** S07: a headache throb at his temple. */
export const throbPulse = (f: number) => pulseAt(EV.throbs, f, 2, 9);
/** S08 / S15 / S16: a heartbeat (contract on the beat, relax over ~8 frames). */
export const beatPulse = (f: number) => pulseAt(EV.beats, f, 1, 8);
/** The DAY 1/2/3 stamps (clock-wipe transitions + HUD flip). */
export const stampPulse = (f: number) => pulseAt(EV.stamps, f, 2, 16);
/** S14: the kidneys shutting down. */
export const shutdownPulse = (f: number) => pulseAt(EV.shutdown, f, 2, 20);
/** S19: a gulp of water pouring down and refilling the body. */
export const gulpPulse = (f: number) => pulseAt(EV.gulps, f, 2, 12);

export const sceneAt = (id: string) => TL.scenes.find((s) => s.id === id)!.at;
