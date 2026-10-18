import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, hash, keys, ramp, rgba, wander} from '../lib/anim';
import {EV, alarmPulse} from '../lib/sync';
import {MedBg, camPt, camTf, spring, wobble} from '../lib/MedKit';
import {ADH, BodyCell, RBC, Ring, Salt, WaterMolecule} from '../lib/Cells';
import {Label} from '../lib/Label';
import {Brain, Cavity, HeadBody, SkullGlass, heartbeat} from '../parts/brain/HeadKit';
import {ADH_TRACK, CAROTID, HYPO, NERVE_MOUTH, NERVE_THROAT, NERVE_TONGUE, PIT, P, Track, polyD} from '../parts/brain/geom';
import {Loupe} from '../parts/brain/Loupe';
import {Bokeh} from '../parts/brain/Bokeh';

const fx = (n: number) => n.toFixed(1);

// the carotid point the loupe magnifies (world)
const VESSEL_PT: P = (() => {
  let best: P = [0, 0];
  for (let t = 0; t <= 1; t += 0.002) {
    const [x, y] = CAROTID.at(t);
    if (Math.abs(y - 1300) < Math.abs(best[1] - 1300)) best = [x, y];
  }
  return best;
})();

/** Loupe A: plasma in the carotid getting saltier (water molecules thin out, salt crowds in). */
const Plasma: React.FC<{abs: number; flow: number; s: number}> = ({abs, flow, s}) => {
  const R = 210;
  const wrap = (v: number) => ((((v + R + 70) % (2 * R + 140)) + 2 * R + 140) % (2 * R + 140)) - R - 70;
  return (
    <g>
      <defs>
        <radialGradient id="s05-plasma" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#7a2a3e" />
          <stop offset="100%" stopColor="#2a0f22" />
        </radialGradient>
      </defs>
      <circle r={R + 10} fill="url(#s05-plasma)" />
      {/* the vessel walls at the lens edges */}
      {[-1, 1].map((side) => (
        <g key={side}>
          <rect x={side < 0 ? -R - 20 : R - 46} y={-R - 20} width={66} height={2 * R + 40} fill={C.vesselDeep} />
          <rect x={side < 0 ? -R + 30 : R - 50} y={-R - 20} width={20} height={2 * R + 40} fill={C.vessel} opacity={0.8} />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <ellipse key={k} cx={side * (R - 18)} cy={wrap(k * 80 - flow * 1.6)} rx={14} ry={30} fill={C.vesselLight} opacity={0.35} />
          ))}
        </g>
      ))}
      {/* far blurry red cells */}
      {[0, 1, 2].map((i) => (
        <RBC key={`b${i}`} x={-90 + i * 95} y={wrap(i * 160 - flow * 1.4)} r={64} tilt={0.3} opacity={0.28} rot={i * 50} />
      ))}
      {/* red cells drifting up */}
      {[0, 1, 2, 3].map((i) => (
        <RBC key={i} x={-110 + i * 72 + wander(flow * 0.02 + i, 3) * 20} y={wrap(i * 115 + 40 - flow * 3.2)} r={40} tilt={0.25 + 0.4 * Math.abs(Math.sin(flow * 0.04 + i))} rot={i * 40 + flow * 0.6} />
      ))}
      {/* water molecules: thinning out as the blood gets saltier */}
      {Array.from({length: 16}, (_, i) => {
        const th = i < 4 ? 2 : 0.08 + 0.84 * hash(i, 51);
        const gone = ramp(s, th - 0.05, th + 0.08);
        if (gone >= 1) return null;
        const a0 = hash(i, 52) * Math.PI * 2;
        const d0 = 40 + 140 * Math.sqrt(hash(i, 53));
        const ang = a0 + flow * 0.004 * (hash(i, 54) - 0.5);
        const x = Math.cos(ang) * d0 * (1 + gone * 0.9) + wander(flow * 0.03 + i, 61) * 14;
        const y = wrap(Math.sin(ang) * d0 - flow * (1.2 + hash(i, 55))) * (1 + gone * 0.3);
        return <WaterMolecule key={`w${i}`} x={x} y={y} r={17 * (1 - gone * 0.6)} rot={flow * 1.5 * (hash(i, 56) - 0.5) + i * 40} opacity={1 - gone} glow={0.8} />;
      })}
      {/* salt crowding in */}
      {Array.from({length: 20}, (_, i) => {
        const u = i < 4 ? -1 : 0.04 + 0.86 * hash(i, 71);
        const k = spring((s - u) * 40, 0.35, 5);
        if (k <= 0.01) return null;
        const a0 = hash(i, 72) * Math.PI * 2;
        const d0 = 25 + 160 * Math.sqrt(hash(i, 73));
        const x = Math.cos(a0) * d0 + wander(flow * 0.04 + i, 81) * 10;
        const y = wrap(Math.sin(a0) * d0 - flow * (0.9 + 0.5 * hash(i, 74)));
        return <Salt key={`s${i}`} x={x} y={y} r={12.5 * k} rot={abs * 2 * (hash(i, 75) - 0.5) + i * 30} />;
      })}
    </g>
  );
};

/** Loupe B: osmoreceptor cells in the hypothalamus shrink as water leaves them; they fire. */
const Sensors: React.FC<{abs: number; flow: number}> = ({abs, flow}) => {
  const cells: [number, number, number][] = [
    [-78, -52, 0],
    [84, -40, 4],
    [4, 82, 8],
  ];
  const fire = alarmPulse(abs);
  return (
    <g>
      <defs>
        <radialGradient id="s05-tissue" cx="45%" cy="40%" r="70%">
          <stop offset="0%" stopColor={C.brainLight} />
          <stop offset="60%" stopColor={C.brain} />
          <stop offset="100%" stopColor={C.brainDeep} />
        </radialGradient>
      </defs>
      <circle r={230} fill="url(#s05-tissue)" />
      {/* fine fibres */}
      {Array.from({length: 9}, (_, i) => (
        <path
          key={i}
          d={`M${-230 + i * 20},${-230} C${-80 + i * 25},${-60 + wander(flow * 0.01 + i, 5) * 20} ${-40 + i * 20},${60} ${80 + i * 22},${230}`}
          fill="none"
          stroke={rgba(C.brainDeep, 0.45)}
          strokeWidth={2.4}
        />
      ))}
      {/* salt outside the cells (the salty blood) */}
      {Array.from({length: 10}, (_, i) => {
        const a = hash(i, 91) * Math.PI * 2;
        const d = 130 + 60 * hash(i, 92);
        return <Salt key={i} x={Math.cos(a) * d + wander(flow * 0.03 + i, 9) * 10} y={Math.sin(a) * d + wander(flow * 0.03 + i, 19) * 10} r={10} rot={abs * 1.5 + i * 25} />;
      })}
      {cells.map(([x, y, lag], i) => {
        const w = 1 - 0.68 * ramp(abs, 572 + lag, 594 + lag, ease.inOutSine);
        const jx = wander(flow * 0.05 + i, 31) * 3;
        return (
          <g key={i}>
            {/* dendrites */}
            {[0, 1, 2, 3].map((k) => {
              const a = k * 1.6 + i;
              return (
                <path
                  key={k}
                  d={`M${fx(x + Math.cos(a) * 40)},${fx(y + Math.sin(a) * 40)} q${fx(Math.cos(a + 0.4) * 40)},${fx(Math.sin(a + 0.4) * 40)} ${fx(Math.cos(a) * 85)},${fx(Math.sin(a) * 85)}`}
                  fill="none"
                  stroke={fire > 0.05 ? C.alarm : C.neuronLight}
                  strokeWidth={4 + 3 * fire}
                  strokeLinecap="round"
                  opacity={0.75}
                />
              );
            })}
            <BodyCell x={x + jx} y={y} r={62} seed={i + 5} f={flow} water={w} />
            {fire > 0.05 && <Ring x={x + jx} y={y} r={50 + 50 * (1 - fire)} width={4} opacity={fire} />}
            {/* water leaving the cell (osmosis) */}
            {[0, 1, 2, 3].map((k) => {
              const t = ramp(abs, 572 + lag + k * 4, 590 + lag + k * 4, ease.outQuad);
              if (t <= 0 || t >= 1) return null;
              const a = k * 1.57 + i * 0.7 + 0.4;
              const d = 30 + 110 * t;
              return <WaterMolecule key={k} x={x + Math.cos(a) * d} y={y + Math.sin(a) * d} r={12} rot={a * 57} opacity={Math.sin(t * Math.PI)} />;
            })}
          </g>
        );
      })}
    </g>
  );
};

/** Time-lapse streaks: light rushing upward while the hours fly by (screen space). */
const Streaks: React.FC<{abs: number; amt: number}> = ({abs, amt}) => {
  let d = '';
  let d2 = '';
  for (let i = 0; i < 34; i++) {
    const x = hash(i, 401) * 1080;
    const L = 90 + 220 * hash(i, 402);
    const v = 45 + 60 * hash(i, 403);
    const y = ((((hash(i, 404) * 2400 - abs * v) % 2400) + 2400) % 2400) - 240;
    const seg = `M${fx(x)},${fx(y)} L${fx(x)},${fx(y + L)} `;
    if (i % 3 === 0) d2 += seg;
    else d += seg;
  }
  return (
    <g opacity={amt}>
      <path d={d} stroke={rgba(C.bodyGhostLight, 0.28)} strokeWidth={2.5} strokeLinecap="round" />
      <path d={d2} stroke={rgba(C.waterGlow, 0.3)} strokeWidth={6} strokeLinecap="round" />
    </g>
  );
};

export const S05Thirst: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;

  // "A few hours in": a time-lapse warp of the motion clock
  const tl = ramp(abs, 496, 522, ease.inOutSine);
  const flow = abs + 72 * tl;
  const beat = heartbeat(flow, 24);
  const saltS = ramp(abs, 532, 566, ease.inOutSine);

  // ---- camera ----
  let camS = keys(abs, [[482, 0.95], [522, 1.02], [560, 1.05], [586, 1.15], [606, 1.05], [624, 1.06], [642, 1.1]]);
  let cfx = keys(abs, [[482, 545], [522, 540], [560, 545], [586, 535], [606, 520], [642, 520]]);
  let cfy = keys(abs, [[482, 880], [522, 905], [560, 960], [586, 930], [606, 975], [622, 990], [642, 1270]]);
  const rot = wander(abs * 0.02, 5) * 0.8;
  for (const e of EV.alarms) {
    const w = wobble(abs - e, 1.1, 5);
    cfx += w * 6;
    cfy += w * 4;
    camS += Math.max(0, w) * 0.006;
  }
  // settle with a small overshoot on the hypothalamus push
  camS += wobble(abs - 586, 0.3, 7) * 0.02;
  const focus: [number, number] = [cfx, cfy];
  const to: [number, number] = [540, 960];
  const cam = camTf(focus, to, camS, rot);
  const S = (p: P) => {
    const q = camPt({x: p[0], y: p[1]}, focus, to, camS, rot);
    return [q.x, q.y] as [number, number];
  };

  // ---- brain states ----
  const hypo = ramp(abs, 566, 578, ease.outCubic) * (1 - ramp(abs, 628, 640)) + 0.6 * alarmPulse(abs);
  const alarmWash = Math.max(alarmPulse(abs), 0.3 * ramp(abs, 591, 600) * (1 - ramp(abs, 624, 638)));
  const pit = ramp(abs, 615, 624) * (0.8 + 0.2 * Math.sin(abs * 0.5));

  // ---- alarm rings (world) ----
  const rings: React.ReactNode[] = [];
  EV.alarms.forEach((e, ei) => {
    for (let k = 0; k < 3; k++) {
      const age = abs - e - k * 4;
      if (age < 0 || age > 30) continue;
      const t = age / 30;
      rings.push(
        <Ring key={`${ei}-${k}`} x={HYPO[0]} y={HYPO[1]} r={30 + 600 * ease.outCubic(t)} width={9 - 5 * t} opacity={Math.pow(1 - t, 1.3) * (k === 0 ? 1 : 0.55)} />,
      );
    }
  });

  // ---- nerve sparks to the mouth / throat (world) ----
  const sparks: React.ReactNode[] = [];
  const nerves: [Track, number][] = [
    [NERVE_MOUTH, 0],
    [NERVE_THROAT, 2],
    [NERVE_TONGUE, 4],
  ];
  EV.alarms.forEach((e, ei) => {
    nerves.forEach(([tr, delay], ni) => {
      const age = abs - e - delay;
      if (age < 0 || age > 26) return;
      const t = ease.outQuad(clamp(age / 13));
      const t0 = Math.max(0, t - 0.32);
      const seedF = Math.floor(abs / 2);
      const pts: P[] = [];
      for (let k = 0; k <= 10; k++) {
        const [x, y, a] = tr.at(t0 + ((t - t0) * k) / 10);
        const j = k === 0 || k === 10 ? 0 : (hash(k + ni * 13, seedF + ei * 7) - 0.5) * 16;
        pts.push([x - Math.sin(a) * j, y + Math.cos(a) * j]);
      }
      const fade = 1 - ramp(age, 14, 26);
      const [hx, hy] = tr.at(t);
      sparks.push(
        <g key={`${ei}-${ni}`} opacity={fade}>
          <path d={polyD(pts)} fill="none" stroke={rgba(C.alarm, 0.35)} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
          <path d={polyD(pts)} fill="none" stroke={C.alarmLight} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={hx} cy={hy} r={22} fill={rgba(C.alarm, 0.4)} />
          <circle cx={hx} cy={hy} r={8} fill="#fff" />
          {age > 12 && <Ring x={hx} y={hy} r={14 + (age - 12) * 4} width={3} opacity={1 - (age - 12) / 14} />}
        </g>,
      );
    });
  });
  // the nerve paths glow faintly once the alarm is on
  const nerveGlow = ramp(abs, 588, 594) * (1 - ramp(abs, 628, 640));

  // ---- ADH capsules leaving the pituitary, falling down the jugular (world) ----
  const adh: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const b = 617 + i * 2.4;
    const age = abs - b;
    if (age < 0) continue;
    const d = 5 * age + 0.75 * age * age;
    if (d > ADH_TRACK.total) continue;
    const [x, y, a] = ADH_TRACK.atD(d);
    const lat = (hash(i, 301) - 0.5) * 30;
    const pop = Math.min(1, spring(age, 0.55, 4));
    adh.push(
      <ADH
        key={i}
        x={x - Math.sin(a) * lat}
        y={y + Math.cos(a) * lat}
        r={23 * pop}
        rot={(a * 180) / Math.PI + 90 + Math.sin(age * 0.3 + i) * 30}
        glow={0.9}
      />,
    );
  }

  // ---- loupe ----
  const open = spring(abs - 524, 0.32, 6) * (1 - ramp(abs, 600, 609, ease.inQuad)) + wobble(abs - 600, 0.6, 3) * 0.05;
  const toB = ramp(abs, 564, 578, ease.inOutCubic);
  const tgtW: P = [VESSEL_PT[0] + (HYPO[0] - VESSEL_PT[0]) * toB, VESSEL_PT[1] + (HYPO[1] - VESSEL_PT[1]) * toB];
  const tgt = S(tgtW);
  const L = {x: 712, y: 1336, r: 206};

  // ---- time-lapse sheen sweeps ----
  const sheen = tl > 0 && tl < 1 ? (tl * 3) % 1 : 0;

  return (
    <AbsoluteFill style={{background: C.medBg}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <MedBg f={flow} id="s05bg" seed={5} xray glow={[[560, 760, C.bodyGhost], [520, 1500, C.waterDeep]]} />
        <g transform={cam}>
          <HeadBody f={flow} id="s05h" flow={flow} beat={beat} salt={0.2 + 0.8 * saltS} />
          <Cavity f={flow} id="s05c" />
          {nerveGlow > 0 &&
            [NERVE_MOUTH, NERVE_THROAT, NERVE_TONGUE].map((tr, i) => (
              <path key={i} d={polyD(tr.pts)} fill="none" stroke={rgba(C.alarm, 0.25 * nerveGlow)} strokeWidth={5} strokeDasharray="2 9" strokeLinecap="round" />
            ))}
          <Brain f={flow} id="s05b" flow={flow} beat={beat} alarm={alarmWash} hypo={hypo} pit={pit} />
          <SkullGlass f={flow} id="s05s" sheen={sheen} />
          {rings}
          {sparks}
          {adh}
          {pit > 0 && <Ring x={PIT[0]} y={PIT[1]} r={24 + ((abs * 2.2) % 40)} color={C.adh} width={3} opacity={pit * (1 - ((abs * 2.2) % 40) / 40)} />}
        </g>
        {tl > 0 && tl < 1 && <Streaks abs={abs} amt={Math.sin(tl * Math.PI)} />}
        <Bokeh f={flow} id="s05k" seed={5} dy={-(cfy - 900) * 0.5} />
        <Loupe id="s05l" f={abs} x={L.x} y={L.y} r={L.r} open={open} target={tgt} targetR={36 * camS} tint={toB < 0.5 ? C.bodyGhostLight : C.brainLight}>
          {toB < 1 && (
            <g opacity={1 - toB} transform={`rotate(${fx(-toB * 40)})`}>
              <Plasma abs={abs} flow={flow} s={saltS} />
            </g>
          )}
          {toB > 0 && (
            <g opacity={toB} transform={`rotate(${fx((1 - toB) * 40)})`}>
              <Sensors abs={abs} flow={flow} />
            </g>
          )}
        </Loupe>
        <Label f={abs} from={539} to={570} text="SALTIER BLOOD" sub="more salt, less water" x={712} y={1078} align="center" size={36} speed={0.9} />
        <Label f={abs} from={571} to={604} text="HYPOTHALAMUS" sub="the salt sensor" x={712} y={1078} align="center" size={36} color={C.brainLight} speed={0.9} />
        <Label f={abs} from={615} to={646} text="THIRST" sub="the alarm" x={540} y={1440} align="center" size={88} color={C.alarm} speed={0.8} />
      </svg>
    </AbsoluteFill>
  );
};
