import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, hash, keys, noise1, ramp, rgba, wander, window01} from '../lib/anim';
import {MedBg, camTf, spring, wobble} from '../lib/MedKit';
import {Ring} from '../lib/Cells';
import {Label} from '../lib/Label';
import {Brain, Cavity, HeadBody, SkullGlass, brainPt, heartbeat} from '../parts/brain/HeadKit';
import {BRIDGES, P, PATHWAYS, polyD} from '../parts/brain/geom';
import {Bokeh} from '../parts/brain/Bokeh';

const fx = (n: number) => n.toFixed(1);
const FOG_START = 1370;

/** Speed of a neural spark: steady before the fog, then sputtering (stops, starts) after. */
const sparkSpeed = (k: number, i: number) => {
  const base = 0.032 + 0.008 * hash(i, 5);
  if (k < FOG_START) return base;
  const n = noise1(k * 0.13 + i * 7.3, 41);
  const fog = ramp(k, FOG_START, FOG_START + 20);
  return base * (1 - fog) + base * fog * clamp(0.15 + n * 1.4, 0, 1.2);
};

/** Neural sparks running along cortical pathways (brain-local coords — they shrink with it). */
const Sparks: React.FC<{abs: number; start: number}> = ({abs, start}) => {
  const fog = ramp(abs, FOG_START, FOG_START + 24);
  const out: React.ReactNode[] = [];
  PATHWAYS.forEach((tr, pi) => {
    // the pathway itself (faint nerve fibre)
    out.push(<path key={`p${pi}`} d={polyD(tr.pts)} fill="none" stroke={rgba(C.neuronLight, 0.32 - 0.12 * fog)} strokeWidth={3} strokeLinecap="round" strokeDasharray={fog > 0 ? '14 10' : undefined} />);
    for (let j = 0; j < 3; j++) {
      const i = pi * 3 + j;
      // integrate the (sputtering) speed from the scene start
      let ph = hash(i, 9) + j * 0.42;
      for (let k = start; k < abs; k++) ph += sparkSpeed(k, i);
      const cyc = Math.floor(ph / 1.25);
      const t = ph - cyc * 1.25;
      if (t > 1) continue;
      // after the fog arrives some sparks misfire: they die mid-way
      const dies = fog > 0 && hash(cyc * 13 + i, 77) < 0.55 * fog;
      const dieAt = 0.25 + 0.5 * hash(cyc * 7 + i, 78);
      if (dies && t > dieAt + 0.18) continue;
      const dying = dies ? ramp(t, dieAt, dieAt + 0.18) : 0;
      const [x, y, a] = tr.at(dies ? Math.min(t, dieAt + 0.04 * dying) : t);
      const tail: P[] = [];
      for (let q = 0; q <= 8; q++) {
        const [tx, ty] = tr.at(Math.max(0, (dies ? Math.min(t, dieAt) : t) - 0.016 * q));
        tail.push([tx, ty]);
      }
      const flick = fog > 0 ? 0.55 + 0.45 * noise1(abs * 0.22 + i * 3, 43) : 1;
      const bright = (1 - dying) * flick;
      const col = fog > 0.5 && flick < 0.4 ? C.alarmDeep : C.alarm;
      out.push(
        <g key={`s${i}`} opacity={clamp(bright)}>
          <path d={polyD(tail)} fill="none" stroke={rgba(col, 0.3)} strokeWidth={16} strokeLinecap="round" />
          <path d={polyD(tail)} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round" />
          <circle cx={x} cy={y} r={24} fill={rgba(C.alarm, 0.3)} />
          <circle cx={x} cy={y} r={9} fill={C.alarmLight} />
          <circle cx={x} cy={y} r={4} fill="#fff" />
        </g>,
      );
      // misfire: a short zigzag fizzle off the pathway
      if (dies && dying > 0 && dying < 1) {
        const pts: P[] = [];
        const dir = a + (hash(i + cyc, 79) < 0.5 ? 1.2 : -1.2);
        let px = x, py = y;
        for (let q = 0; q < 5; q++) {
          pts.push([px, py]);
          px += Math.cos(dir + (q % 2 ? 0.7 : -0.7)) * 12;
          py += Math.sin(dir + (q % 2 ? 0.7 : -0.7)) * 12;
        }
        out.push(
          <g key={`m${i}`} opacity={Math.sin(dying * Math.PI)}>
            <path d={polyD(pts)} fill="none" stroke={C.alarmLight} strokeWidth={2.5} strokeLinejoin="round" />
            <Ring x={x} y={y} r={8 + 22 * dying} width={2} color={C.alarmDeep} opacity={1 - dying} />
          </g>,
        );
      }
    }
  });
  return <g>{out}</g>;
};

/** Grey fog drifting through (screen space, 3 depth layers). */
const Fog: React.FC<{abs: number; amt: number}> = ({abs, amt}) => {
  if (amt <= 0) return null;
  const blobs = Array.from({length: 13}, (_, i) => {
    const layer = i % 3; // 0 far, 1 mid, 2 near
    const sp = [0.8, 1.6, 2.8][layer];
    const r = [190, 260, 360][layer] * (0.8 + 0.4 * hash(i, 3));
    const x0 = hash(i, 1) * 1500 - 210;
    const x = ((((x0 + abs * sp * (hash(i, 4) < 0.5 ? 1 : -1)) % 1500) + 1500) % 1500) - 210;
    const y = 380 + hash(i, 2) * 1100 + wander(abs * 0.01 + i, 7) * 50;
    const appear = ramp(abs, FOG_START + i * 1.6, FOG_START + 14 + i * 1.6, ease.outQuad);
    return {x, y, r, layer, a: appear};
  });
  return (
    <g opacity={amt}>
      <defs>
        <radialGradient id="s13-fog">
          <stop offset="0%" stopColor={C.steel} stopOpacity={0.5} />
          <stop offset="55%" stopColor={C.steel} stopOpacity={0.22} />
          <stop offset="100%" stopColor={C.steel} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill={rgba(C.steelDark, 0.16)} />
      {blobs.map((b, i) => (
        <ellipse key={i} cx={b.x} cy={b.y} rx={b.r * 1.5} ry={b.r * 0.8} fill="url(#s13-fog)" opacity={b.a * [0.7, 0.85, 0.6][b.layer]} />
      ))}
    </g>
  );
};

export const S13BrainShrink: React.FC<SceneProps> = ({start}) => {
  const f = useCurrentFrame();
  const abs = start + f;

  // ---- shrink (on "Even your brain@1338 shrinks@1345") with overshoot + settle ----
  const sh = ramp(abs, 1337, 1362, ease.inOutCubic) + wobble(abs - 1362, 0.42, 6) * 0.07;
  const fog = ramp(abs, FOG_START, 1400, ease.inOutSine);
  const dull = 0.45 + 0.35 * ramp(abs, 1336, 1400);
  const flow = abs * 0.75;
  const beat = heartbeat(abs, 17);

  // ---- camera: slow push, slight roll; a small push toward the gap as it opens ----
  const camS = keys(abs, [[1319, 1.08], [1338, 1.13], [1362, 1.18], [1428, 1.24]]) + wobble(abs - 1345, 0.35, 8) * 0.012;
  const cfx = keys(abs, [[1319, 560], [1362, 568], [1428, 575]]);
  const cfy = keys(abs, [[1319, 770], [1362, 735], [1428, 760]]);
  const rot = wander(abs * 0.015, 13) * 1.2 + fog * Math.sin(abs * 0.05) * 0.8;
  const focus: [number, number] = [cfx, cfy];
  const to: [number, number] = [540, 880];
  const cam = camTf(focus, to, camS, rot);

  // gap measure arrows between skull and the shrinking brain
  const gapA = window01(abs, 1342, 1392, 8, 10);
  const gaps = [2, 4, 6].map((k) => {
    const br = BRIDGES[k];
    const b = brainPt(br.b, sh);
    return {a: br.a, b};
  });

  return (
    <AbsoluteFill style={{background: C.medBg}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <MedBg f={abs} id="s13bg" seed={13} xray glow={[[560, 760, C.bodyGhost], [520, 1500, C.waterDeep]]} />
        <g transform={cam}>
          <HeadBody f={abs} id="s13h" flow={flow} beat={beat} bloodSat={0.85} bloodCrowd={1.3} flowSpeed={3.4} hairSway={0.7} />
          <Cavity f={abs} id="s13c" dark={0.25 + 0.6 * clamp(sh)} />
          <Brain f={abs} id="s13b" flow={flow} beat={beat} shrink={sh} dull={dull}>
            <Sparks abs={abs} start={start} />
          </Brain>
          <SkullGlass f={abs} id="s13s" />
          {gapA > 0 &&
            gaps.map((g, i) => {
              const dx = g.b[0] - g.a[0], dy = g.b[1] - g.a[1];
              const L = Math.hypot(dx, dy);
              if (L < 6) return null;
              const ux = dx / L, uy = dy / L;
              const pop = Math.min(1, spring(abs - 1342 - i * 3, 0.5, 4));
              const head = (x: number, y: number, s: number) =>
                `M${fx(x)},${fx(y)} L${fx(x - s * ux * 10 - uy * 7)},${fx(y - s * uy * 10 + ux * 7)} M${fx(x)},${fx(y)} L${fx(x - s * ux * 10 + uy * 7)},${fx(y - s * uy * 10 - ux * 7)}`;
              return (
                <g key={i} opacity={gapA * pop} stroke={C.cream} strokeWidth={3} strokeLinecap="round" fill="none">
                  <path d={`M${fx(g.a[0] + ux * 3)},${fx(g.a[1] + uy * 3)} L${fx(g.b[0] - ux * 3)},${fx(g.b[1] - uy * 3)}`} />
                  <path d={head(g.a[0] + ux * 3, g.a[1] + uy * 3, -1)} />
                  <path d={head(g.b[0] - ux * 3, g.b[1] - uy * 3, 1)} />
                  <path d={`M${fx(g.a[0] - uy * 14)},${fx(g.a[1] + ux * 14)} L${fx(g.a[0] + uy * 14)},${fx(g.a[1] - ux * 14)}`} opacity={0.6} />
                </g>
              );
            })}
        </g>
        <Fog abs={abs} amt={fog} />
        <Bokeh f={abs} id="s13k" seed={13} dy={-(cfy - 760) * 0.6} tint={fog > 0.3 ? C.steel : C.bodyGhostLight} />
        <Label f={abs} from={1345} to={1390} text="BRAIN SHRINKS" sub="pulls away from skull" x={540} y={1440} align="center" size={50} />
        <Label f={abs} from={1393} to={1432} text="CONFUSION" sub="foggy thinking" x={540} y={1440} align="center" size={56} color={C.cream} />
      </svg>
    </AbsoluteFill>
  );
};

