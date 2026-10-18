import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/scene';
import {C} from '../lib/palette';
import {clamp, ease, handheld, lerp, ramp, rgba, rng, smoothPath} from '../lib/anim';
import {camTf, wobble} from '../lib/MedKit';
import {MONO, TITLE} from '../lib/fonts';
import {Drop, WaterMolecule} from '../lib/Cells';

type P = [number, number];
const fx = (n: number) => n.toFixed(1);
const CX = 540;
const NECK = 962;
// right-side profile of the glass (x offset from the centre line, y), top cap → neck → bottom cap
const UP: P[] = [[246, 282], [298, 340], [318, 430], [306, 560], [258, 700], [172, 820], [84, 904], [26, 948], [13, NECK]];
const LO: P[] = UP.map(([x, y]) => [x, 2 * NECK - y] as P).reverse();
const bulb = (pts: P[]) => smoothPath([...pts.map(([x, y]) => [CX + x, y] as P), ...pts.map(([x, y]) => [CX - x, y] as P).reverse()], true);
const UPPER = bulb(UP);
const LOWER = bulb(LO);
const TOP_Y = 282;
const BOT_Y = 2 * NECK - 282; // 1642
const POOL = 1452;
const G = 2.2;
// drops leaving the neck (slowing down); the LAST one lands ≈ 1878
const RELEASES = [1742, 1748, 1754, 1760, 1766, 1772, 1779, 1786, 1794, 1803, 1812, 1822, 1833, 1845, 1858];
const FALL_T = Math.sqrt((2 * (POOL - NECK)) / G);

const Column: React.FC<{x: number; f: number}> = ({x}) => (
  <g>
    <rect x={x - 10} y={TOP_Y - 6} width={20} height={BOT_Y - TOP_Y + 12} rx={8} fill={C.steelDark} />
    <rect x={x - 10} y={TOP_Y - 6} width={7} height={BOT_Y - TOP_Y + 12} rx={3} fill={rgba(C.chrome, 0.55)} />
    <rect x={x + 4} y={TOP_Y - 6} width={4} height={BOT_Y - TOP_Y + 12} rx={2} fill={rgba(C.navyDeep, 0.6)} />
    {[TOP_Y + 40, 700, NECK, 1224, BOT_Y - 40].map((yy, i) => (
      <g key={i}>
        <ellipse cx={x} cy={yy} rx={17} ry={10} fill={C.steelDark} stroke={rgba(C.chrome, 0.7)} strokeWidth={2} />
        <ellipse cx={x - 5} cy={yy - 3} rx={6} ry={3} fill={rgba('#fff', 0.6)} />
      </g>
    ))}
  </g>
);

const Cap: React.FC<{y: number; flip?: boolean; id: string}> = ({y, flip, id}) => {
  const s = flip ? -1 : 1;
  return (
    <g transform={`translate(0,${y}) scale(1,${s})`}>
      <defs>
        <linearGradient id={`${id}-cap`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.navyDeep} />
          <stop offset="0.25" stopColor={C.steelDark} />
          <stop offset="0.42" stopColor={C.chrome} />
          <stop offset="0.6" stopColor={C.steelDark} />
          <stop offset="1" stopColor={C.navyDeep} />
        </linearGradient>
      </defs>
      <rect x={150} y={-44} width={780} height={40} rx={14} fill={`url(#${id}-cap)`} stroke={rgba(C.bodyGhostLight, 0.6)} strokeWidth={2} />
      <rect x={196} y={-70} width={688} height={28} rx={12} fill={`url(#${id}-cap)`} stroke={rgba(C.bodyGhostLight, 0.5)} strokeWidth={2} />
      <rect x={160} y={-40} width={760} height={6} rx={3} fill={rgba('#fff', 0.35)} />
      {[180, 900].map((xx) => (
        <g key={xx}>
          <circle cx={xx} cy={-86} r={18} fill={C.steelDark} stroke={rgba(C.chrome, 0.8)} strokeWidth={2.5} />
          <circle cx={xx - 6} cy={-92} r={6} fill={rgba('#fff', 0.6)} />
        </g>
      ))}
      <path d="M380,-70 Q540,-110 700,-70" fill="none" stroke={rgba(C.bodyGhostLight, 0.35)} strokeWidth={3} />
    </g>
  );
};

export const S17Lifetime: React.FC<SceneProps> = ({start, len}) => {
  const f = useCurrentFrame();
  const abs = start + f;
  const t = f / (len - 1);
  const hh = handheld(abs, 4, 0.03, 17);
  const stamp = abs - 1852;
  const shake = 6 * wobble(stamp, 0.9, 5);
  const cs = lerp(1.0, 1.085, ease.inOutSine(t)) + 0.012 * Math.max(0, wobble(stamp, 0.5, 6));
  const cam = camTf([540 + hh.x, 1000 + hh.y + shake], [540, 960], cs, hh.r * 0.8 + 0.5 * Math.sin(f * 0.02));
  const expo = ramp(f, 12, 40, ease.inOutSine);

  // background caustics + particles
  const bg = useMemo(() => {
    const r = rng(1717);
    return Array.from({length: 60}, (_, i) => ({x: r() * 1080, y: r() * 1920, s: 0.8 + r() * 2.4, v: 0.2 + r() * 0.7, ph: r() * 6.28, near: i % 6 === 0}));
  }, []);
  let caus = '';
  for (let j = 0; j < 16; j++) {
    const y0 = -60 + j * 130;
    let d = '';
    for (let x = -40; x <= 1120; x += 40) {
      const yy = y0 + 26 * Math.sin(x * 0.006 + f * 0.025 + j * 1.7) + 14 * Math.sin(x * 0.017 - f * 0.04 + j);
      d += `${x === -40 ? 'M' : 'L'}${x},${fx(yy)} `;
    }
    caus += d;
  }
  let far = '';
  let near = '';
  for (const p of bg) {
    const yy = (((p.y - abs * p.v * (p.near ? 2 : 1)) % 1920) + 1920) % 1920;
    const xx = p.x + Math.sin(abs * 0.02 + p.ph) * 14;
    const rr = p.near ? p.s * 2.4 : p.s;
    const seg = `M${fx(xx - rr)},${fx(yy)} a${fx(rr)},${fx(rr)} 0 1,0 ${fx(2 * rr)},0 a${fx(rr)},${fx(rr)} 0 1,0 ${fx(-2 * rr)},0 `;
    if (p.near) near += seg;
    else far += seg;
  }

  // water
  const upLevel = lerp(872, NECK - 2, ease.inQuad(ramp(abs, 1740, 1860)));
  const upSurf = (x: number) => upLevel + 2.5 * Math.sin(x * 0.05 + f * 0.2);
  let upD = '';
  for (let x = 200; x <= 880; x += 20) upD += `${x === 200 ? 'M' : 'L'}${x},${fx(upSurf(x))} `;
  const upRegion = `${upD} L880,${NECK + 4} L200,${NECK + 4} Z`;
  const drops = RELEASES.map((r) => ({r, a: abs - r}));
  const landings = RELEASES.map((r) => r + FALL_T);
  let kick = 0;
  for (const L of landings) kick += Math.max(0, wobble(abs - L, 0.35, 12)) * 0.6;
  kick += Math.abs(wobble(stamp, 0.3, 14)) * 1.5;
  const poolSurf = (x: number) => {
    let y = POOL + 3 * Math.sin(x * 0.03 + f * 0.13) + 2 * Math.sin(x * 0.07 - f * 0.19);
    for (const L of landings) {
      const a = abs - L;
      if (a < 0 || a > 40) continue;
      const dx = Math.abs(x - CX);
      y += 7 * Math.exp(-a / 14) * Math.sin(dx * 0.06 - a * 0.7) * Math.exp(-dx / 260);
    }
    return y + kick * 4 * Math.sin(x * 0.02 + f * 0.3);
  };
  let poolD = '';
  for (let x = 200; x <= 880; x += 12) poolD += `${x === 200 ? 'M' : 'L'}${x},${fx(poolSurf(x))} `;
  const poolRegion = `${poolD} L880,${BOT_Y + 10} L200,${BOT_Y + 10} Z`;
  let pcaus = '';
  for (let yy = POOL + 30; yy < BOT_Y; yy += 40) {
    let d = '';
    for (let x = 220; x <= 860; x += 20) {
      const yv = yy + 7 * Math.sin(x * 0.04 + f * 0.1 + yy) + 4 * Math.sin(x * 0.09 - f * 0.14);
      d += `${x === 220 ? 'M' : 'L'}${x},${fx(yv)} `;
    }
    pcaus += d;
  }
  // the hanging drop at the neck swells before each release
  const nextR = RELEASES.find((r) => r > abs);
  const prevR = [...RELEASES].reverse().find((r) => r <= abs) ?? RELEASES[0] - 8;
  const swell = nextR ? clamp((abs - prevR) / Math.max(1, nextR - prevR)) : 0;

  // text
  const t1 = ramp(abs, 1786, 1802, ease.outCubic);
  const t2 = ramp(abs, 1814, 1830, ease.outCubic);
  const st = clamp(stamp / 9);
  const stampS = stamp < 0 ? 0 : lerp(2.3, 1, ease.outBack(st));
  const stampO = clamp(stamp / 3);
  const t4 = ramp(abs, 1863, 1874);

  return (
    <AbsoluteFill style={{background: C.navyDeep}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <defs>
          <radialGradient id="s17bg" cx="50%" cy="48%" r="75%">
            <stop offset="0%" stopColor={C.medBgLight} />
            <stop offset="60%" stopColor={C.medBg} />
            <stop offset="100%" stopColor={C.navyDeep} />
          </radialGradient>
          <linearGradient id="s17ray" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.waterLight} stopOpacity={0.16} />
            <stop offset="1" stopColor={C.waterLight} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="s17pool" x1="0" y1={POOL} x2="0" y2={BOT_Y} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={C.waterGlow} stopOpacity={0.9} />
            <stop offset="0.3" stopColor={C.water} stopOpacity={0.75} />
            <stop offset="1" stopColor={C.waterDeep} stopOpacity={0.85} />
          </linearGradient>
          <radialGradient id="s17glow">
            <stop offset="0%" stopColor={C.water} stopOpacity={0.35} />
            <stop offset="100%" stopColor={C.water} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="s17shade">
            <stop offset="0%" stopColor={C.navyDeep} stopOpacity={0.7} />
            <stop offset="100%" stopColor={C.navyDeep} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="s17floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.medBgLight} stopOpacity={0.9} />
            <stop offset="1" stopColor={C.navyDeep} stopOpacity={1} />
          </linearGradient>
          <clipPath id="s17up">
            <path d={UPPER} />
          </clipPath>
          <clipPath id="s17lo">
            <path d={LOWER} />
          </clipPath>
          <clipPath id="s17upW">
            <path d={upRegion} />
          </clipPath>
          <clipPath id="s17poolW">
            <path d={poolRegion} />
          </clipPath>
        </defs>
        <g opacity={0.35 + 0.65 * expo}>
          <rect width={1080} height={1920} fill="url(#s17bg)" />
          <path d={caus} fill="none" stroke={rgba(C.waterLight, 0.07)} strokeWidth={10} />
          <path d={caus} fill="none" stroke={rgba(C.waterLight, 0.09)} strokeWidth={2} />
          {[0, 1, 2, 3].map((i) => {
            const x0 = 160 + i * 250 + 40 * Math.sin(f * 0.012 + i * 2);
            return <path key={i} d={`M${fx(x0 - 40)},-20 L${fx(x0 + 40)},-20 L${fx(x0 + 200)},1500 L${fx(x0 - 120)},1500 Z`} fill="url(#s17ray)" opacity={0.6 + 0.4 * Math.sin(f * 0.03 + i)} />;
          })}
          <path d={far} fill={rgba(C.bodyGhostLight, 0.3)} />
        </g>

        <g transform={cam}>
          {/* floor + reflection */}
          <rect x={-200} y={1712} width={1480} height={400} fill="url(#s17floor)" />
          <line x1={-200} y1={1712} x2={1280} y2={1712} stroke={rgba(C.bodyGhostLight, 0.35)} strokeWidth={2} />
          <g transform={`translate(0,${2 * 1712}) scale(1,-1)`} opacity={0.2}>
            <path d={LOWER} fill={rgba(C.water, 0.4)} />
            <Cap y={BOT_Y + 44} id="s17capR" flip />
          </g>
          {[0, 1, 2].map((i) => {
            const q = ((f * 0.01 + i / 3) % 1);
            return <ellipse key={i} cx={CX} cy={1790} rx={200 + 520 * q} ry={30 + 70 * q} fill="none" stroke={rgba(C.waterLight, 0.35 * (1 - q))} strokeWidth={2} />;
          })}
          <ellipse cx={CX} cy={1300} rx={560} ry={700} fill="url(#s17glow)" opacity={0.8 + 0.2 * Math.sin(f * 0.07)} />

          {/* back columns (dim) */}
          <g opacity={0.45}>
            <Column x={CX - 250} f={f} />
            <Column x={CX + 250} f={f} />
          </g>
          {/* glass bulbs */}
          {[UPPER, LOWER].map((d, i) => (
            <g key={i}>
              <path d={d} fill={rgba(C.bodyGhost, 0.07)} />
              <path d={d} fill="none" stroke={rgba(C.bodyGhost, 0.12)} strokeWidth={34} />
              <path d={d} fill="none" stroke={rgba(C.bodyGhostLight, 0.18)} strokeWidth={12} />
            </g>
          ))}
          {/* upper water (nearly gone) */}
          <g clipPath="url(#s17up)">
            <g clipPath="url(#s17upW)">
              <rect x={200} y={upLevel - 10} width={680} height={200} fill="url(#s17pool)" />
            </g>
            {upLevel < NECK - 4 && <path d={upD} fill="none" stroke={C.waterLight} strokeWidth={2.5} />}
          </g>
          {/* lower pool */}
          <g clipPath="url(#s17lo)">
            <g clipPath="url(#s17poolW)">
              <rect x={200} y={POOL - 30} width={680} height={300} fill="url(#s17pool)" />
              <path d={pcaus} fill="none" stroke={rgba(C.waterLight, 0.35)} strokeWidth={2.2} />
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const mx = CX - 220 + i * 88 + 16 * Math.sin(f * 0.03 + i);
                const my = POOL + 90 + (i % 3) * 50 + 10 * Math.cos(f * 0.025 + i * 2);
                return <WaterMolecule key={i} x={mx} y={my} r={11 - (i % 3) * 2} rot={f * (i % 2 ? 1 : -1) + i * 40} opacity={0.75} />;
              })}
              {Array.from({length: 14}, (_, i) => {
                const range = BOT_Y - POOL;
                const yy = BOT_Y - ((f * (1.2 + (i % 4) * 0.4) + i * 37) % range);
                return <circle key={i} cx={CX - 200 + ((i * 97) % 400) + 4 * Math.sin(f * 0.1 + i)} cy={yy} r={2 + (i % 3)} fill="none" stroke={rgba('#fff', 0.6)} strokeWidth={1.2} />;
              })}
            </g>
            <path d={poolD} fill="none" stroke={rgba(C.waterGlow, 0.4)} strokeWidth={12} />
            <path d={poolD} fill="none" stroke={C.waterLight} strokeWidth={3} />
          </g>
          {/* falling drops + neck drip */}
          {nextR && <Drop x={CX} y={NECK + 6 + 6 * swell} r={3 + 4 * swell} stretch={1 + swell * 0.5} />}
          {drops.map(({r, a}) => {
            if (a < 0 || a > FALL_T + 30) return null;
            if (a <= FALL_T) {
              const yy = NECK + 12 + 0.5 * G * a * a;
              return <Drop key={r} x={CX} y={yy} r={7} stretch={1 + Math.min(1.4, a * 0.08)} />;
            }
            const q = (a - FALL_T) / 30;
            const last = r === RELEASES[RELEASES.length - 1];
            return (
              <g key={r} opacity={1 - q}>
                <ellipse cx={CX} cy={poolSurf(CX)} rx={12 + (last ? 160 : 90) * ease.outCubic(q)} ry={3 + (last ? 26 : 16) * ease.outCubic(q)} fill="none" stroke={C.waterLight} strokeWidth={last ? 3.5 : 2.5} />
                {q < 0.4 &&
                  [-2, -1, 0, 1, 2].map((s) => (
                    <circle key={s} cx={CX + s * 14 * q * 10} cy={poolSurf(CX) - 40 * Math.sin(q * Math.PI * 2.5) * (1 - Math.abs(s) * 0.2)} r={3} fill={C.waterLight} />
                  ))}
              </g>
            );
          })}
          {/* glass rim + speculars */}
          {[UPPER, LOWER].map((d, i) => (
            <path key={i} d={d} fill="none" stroke={rgba(C.bodyGhostLight, 0.9)} strokeWidth={3} />
          ))}
          <path d={`M${CX - 270},380 Q${CX - 300},470 ${CX - 270},590`} fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" opacity={0.35} />
          <path d={`M${CX - 270},1330 Q${CX - 300},1450 ${CX - 270},1560`} fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" opacity={0.3} />
          <path d={`M${CX + 230},420 Q${CX + 262},520 ${CX + 240},610`} fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.2} />
          {/* glint sweep */}
          <path d={UPPER} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="60 2200" strokeDashoffset={fx(-((f * 14) % 2260))} opacity={0.6} />
          <path d={LOWER} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="60 2200" strokeDashoffset={fx(-((f * 14 + 900) % 2260))} opacity={0.6} />
          {/* caps + front columns */}
          <Cap y={TOP_Y} id="s17capT" />
          <Cap y={BOT_Y} id="s17capB" flip />
          <Column x={CX - 360} f={f} />
          <Column x={CX + 360} f={f} />
        </g>

        <path d={near} fill={rgba(C.bodyGhostLight, 0.16)} />

        {/* TEXT (screen space, inside y 380–1500) */}
        <ellipse cx={540} cy={640} rx={480} ry={190} fill="url(#s17shade)" opacity={Math.max(t1, t2)} />
        {t1 > 0 && (
          <text x={540} y={606 + 40 * (1 - t1)} textAnchor="middle" fontFamily={TITLE} fontWeight={700} fontSize={118} letterSpacing={lerp(30, 6, t1)} fill={C.cream} opacity={t1} stroke={C.navyDeep} strokeWidth={8} paintOrder="stroke">
            YOUR LIFETIME
          </text>
        )}
        {t2 > 0 && (
          <g opacity={t2}>
            <text x={540} y={738 + 40 * (1 - t2)} textAnchor="middle" fontFamily={TITLE} fontWeight={700} fontSize={118} letterSpacing={lerp(30, 6, t2)} fill="none" stroke={rgba(C.water, 0.35)} strokeWidth={18}>
              WITHOUT WATER
            </text>
            <text x={540} y={738 + 40 * (1 - t2)} textAnchor="middle" fontFamily={TITLE} fontWeight={700} fontSize={118} letterSpacing={lerp(30, 6, t2)} fill={C.waterLight} stroke={C.navyDeep} strokeWidth={5} paintOrder="stroke">
              WITHOUT WATER
            </text>
          </g>
        )}
        {stamp >= 0 && (
          <g>
            <ellipse cx={540} cy={1215} rx={500} ry={170} fill="url(#s17shade)" opacity={stampO} />
            {[0, 1, 2].map((i) => {
              const q = clamp((stamp - i * 5) / 26);
              if (q <= 0 || q >= 1) return null;
              return <ellipse key={i} cx={540} cy={1215} rx={260 + 420 * ease.outCubic(q)} ry={80 + 150 * ease.outCubic(q)} fill="none" stroke={rgba(C.waterLight, 0.7 * (1 - q))} strokeWidth={4} />;
            })}
            <g transform={`translate(540,1215) scale(${fx(stampS)}) translate(-540,-1215)`} opacity={stampO}>
              <text x={540} y={1293} textAnchor="middle" fontFamily={TITLE} fontWeight={700} fontSize={236} letterSpacing={4} fill={C.cream} stroke={C.navyDeep} strokeWidth={10} paintOrder="stroke">
                <tspan fill={C.waterLight}>≈ </tspan>3 DAYS
              </text>
            </g>
          </g>
        )}
        {t4 > 0 && (
          <text x={540} y={1378} textAnchor="middle" fontFamily={MONO} fontWeight={600} fontSize={37} fill={rgba(C.cream, 0.9)} opacity={t4} stroke={C.navyDeep} strokeWidth={6} paintOrder="stroke">
            {'2–7 days, depending on heat & activity'.slice(0, Math.ceil(t4 * 39))}
          </text>
        )}
      </svg>
    </AbsoluteFill>
  );
};
