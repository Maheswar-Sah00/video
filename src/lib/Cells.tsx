import React from 'react';
import {C} from './palette';
import {blob, clamp, hash, mixHex, rgba} from './anim';

/**
 * Shared micro vocabulary (SVG <g> elements) so every scene draws the SAME things in the SAME
 * reserved colours (see the palette header). All sizes in px; (x,y) = centre; `f` = any frame
 * counter (absolute or local — it only drives the idle wobble). Glossy medical-illustration look:
 * 2–3 flat tones + a specular highlight + a thin dark rim. Deterministic (seeded), no
 * gradients/defs, so they are cheap to draw many times. Rendered sheet: out/stills/lead-cells-f0000.png
 *
 *   <BodyCell x y r rot seed f water opacity detail/>   one of HIS BODY CELLS: soft round coral-peach,
 *            lilac nucleus, a few granules. `water` 1 = plump + glossy (hydrated) … 0 = shrivelled:
 *            ~70 % size, wrinkled/crenated outline, darker + duller, creases (dehydrated). Animate
 *            `water` to show water leaving a cell (osmosis) — pair it with <WaterMolecule/>s
 *            streaming OUT of the cell.
 *   <RBC x y r rot tilt sat crenate opacity/>          RED BLOOD CELL disc (tilt 0 face-on, 1 edge-on;
 *            sat 1 = bright red; crenate 0..1 = little bumps round the rim, a dehydrated red cell).
 *   <WaterMolecule x y r rot opacity glow/>              WATER (H2O): a glossy aqua oxygen sphere + two
 *            small pale hydrogens (Mickey-ears, 105°). r = the oxygen radius.
 *   <Drop x y r rot stretch opacity/>                    WATER drop: glossy aqua teardrop pointing UP
 *            (rot to aim it), `stretch` > 1 = falling / elongated. r = the round part's radius.
 *   <Salt x y r rot opacity/>                            SALT (sodium): a small white-silver crystal cube
 *            with a faint cool glow. Many of them = "saltier blood".
 *   <ADH x y r rot opacity glow/>                        the hormone ADH: a violet-magenta glowing capsule
 *            (r = half its length) — the brain's "save water!" message to the kidneys.
 *   <Toxin x y r rot seed f opacity/>                    TOXIN / waste (urea, potassium…): a murky
 *            olive-green spiky blob. They pile up when the kidneys fail.
 *   <Ring x y r color width opacity/>                    a thin expanding signal ring (alarm / pulse).
 */

const fx = (n: number) => n.toFixed(1);

// ---------------------------------------------------------------------------------------------

/** Crenated (wrinkled) outline: a blob whose radius gets small sharp bumps as `wr` rises. */
const crenPath = (r: number, seed: number, wr: number, ph: number, n = 28) => {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const smooth = 0.05 * Math.sin(a * 3 + seed * 1.3 + ph) + 0.04 * Math.sin(a * 5 + seed * 2.1 - ph * 0.7);
    const spike = (i % 2 === 0 ? 1 : -1) * wr * (0.07 + 0.05 * hash(i, seed));
    const rr = r * (1 + smooth + spike);
    pts.push(`${i ? 'L' : 'M'}${fx(Math.cos(a) * rr)},${fx(Math.sin(a) * rr)}`);
  }
  return pts.join('') + 'Z';
};

export const BodyCell: React.FC<{
  x: number;
  y: number;
  r: number;
  rot?: number;
  seed?: number;
  f?: number;
  water?: number; // 1 plump/hydrated .. 0 shrivelled
  squash?: number; // x scale (packed tissue cells)
  opacity?: number;
  detail?: number; // 0 = flat simple (far away), 1 = full
}> = ({x, y, r, rot = 0, seed = 1, f = 0, water = 1, squash = 1, opacity = 1, detail = 1}) => {
  if (r < 0.5) return null;
  const w = clamp(water);
  const dry = 1 - w;
  const rr = r * (0.7 + 0.3 * w);
  const ph = f * 0.035 + seed * 1.7;
  const k = (c: string) => (dry > 0 ? mixHex(c, '#8a5a64', dry * 0.45) : c);
  const outer = dry > 0.05 ? crenPath(rr, seed, dry, ph) : blob(0, 0, rr, seed, 0.06, 8, ph);
  const inner = dry > 0.05 ? crenPath(rr * 0.86, seed + 3, dry * 0.8, ph) : blob(-rr * 0.07, -rr * 0.08, rr * 0.86, seed + 3, 0.06, 8, ph);
  const nx = rr * 0.08 * Math.sin(seed * 2.1);
  const ny = rr * 0.06 * Math.cos(seed * 1.3);
  return (
    <g transform={`translate(${fx(x)},${fx(y)}) rotate(${fx(rot)}) scale(${fx(squash)},1)`} opacity={opacity}>
      <path d={outer} fill={k(C.cellDeep)} stroke={rgba(C.ink, 0.55)} strokeWidth={Math.max(0.8, r * 0.035)} strokeLinejoin="round" />
      <path d={inner} fill={k(C.cell)} transform={`translate(${fx(-rr * 0.05)},${fx(-rr * 0.06)})`} />
      <ellipse
        cx={fx(-rr * 0.3)}
        cy={fx(-rr * 0.34)}
        rx={fx(rr * 0.36)}
        ry={fx(rr * 0.24)}
        fill={C.cellLight}
        opacity={0.55 * (0.35 + 0.65 * w)}
        transform={`rotate(-30 ${fx(-rr * 0.3)} ${fx(-rr * 0.34)})`}
      />
      {detail > 0.5 &&
        [0, 1, 2, 3, 4, 5].map((i) => {
          const a = hash(i, seed) * Math.PI * 2;
          const d = rr * (0.45 + 0.3 * hash(i + 9, seed));
          return <circle key={i} cx={fx(Math.cos(a) * d)} cy={fx(Math.sin(a) * d)} r={fx(rr * 0.045)} fill={k(C.cellDeep)} opacity={0.55} />;
        })}
      {detail > 0.5 &&
        dry > 0.25 &&
        [0, 1, 2].map((i) => {
          // creases of a shrivelled cell
          const a = hash(i + 20, seed) * Math.PI * 2;
          const d0 = rr * 0.45;
          const d1 = rr * 0.85;
          const bend = rr * 0.12 * (hash(i + 30, seed) - 0.5);
          return (
            <path
              key={`c${i}`}
              d={`M${fx(Math.cos(a) * d0)},${fx(Math.sin(a) * d0)} Q${fx(Math.cos(a + 0.25) * (d0 + d1) * 0.5 + bend)},${fx(Math.sin(a + 0.25) * (d0 + d1) * 0.5)} ${fx(Math.cos(a) * d1)},${fx(Math.sin(a) * d1)}`}
              fill="none"
              stroke={rgba(C.cellDeep, 0.8)}
              strokeWidth={Math.max(0.8, rr * 0.035)}
              strokeLinecap="round"
              opacity={clamp((dry - 0.25) / 0.4)}
            />
          );
        })}
      <circle cx={fx(nx)} cy={fx(ny)} r={fx(rr * 0.33)} fill={k(C.cellNucleus)} stroke={rgba(C.ink, 0.4)} strokeWidth={Math.max(0.6, r * 0.025)} />
      <circle cx={fx(nx - rr * 0.08)} cy={fx(ny - rr * 0.09)} r={fx(rr * 0.17)} fill={k(C.cellNucleusLight)} opacity={0.6} />
      <circle cx={fx(nx + rr * 0.07)} cy={fx(ny + rr * 0.05)} r={fx(rr * 0.07)} fill={rgba(C.ink, 0.45)} />
      <ellipse
        cx={fx(-rr * 0.42)}
        cy={fx(-rr * 0.46)}
        rx={fx(rr * 0.13)}
        ry={fx(rr * 0.07)}
        fill="#fff"
        opacity={0.7 * (0.3 + 0.7 * w)}
        transform={`rotate(-35 ${fx(-rr * 0.42)} ${fx(-rr * 0.46)})`}
      />
    </g>
  );
};

// ---------------------------------------------------------------------------------------------

export const RBC: React.FC<{x: number; y: number; r: number; rot?: number; tilt?: number; sat?: number; crenate?: number; opacity?: number}> = ({
  x,
  y,
  r,
  rot = 0,
  tilt = 0.25,
  sat = 1,
  crenate = 0,
  opacity = 1,
}) => {
  const ry = r * (1 - 0.68 * clamp(tilt));
  const body = mixHex(C.bloodPoor, C.blood, clamp(sat));
  const deep = mixHex(C.bloodPoorDeep, C.bloodDeep, clamp(sat));
  const light = mixHex(C.bloodPoorLight, C.bloodLight, clamp(sat));
  const dimple = (1 - clamp(tilt) * 0.85) * (1 - 0.5 * clamp(crenate));
  const cr = clamp(crenate);
  const outline =
    cr > 0.05 ? (
      <path
        d={(() => {
          const n = 22;
          let d = '';
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const k = 1 + (i % 2 === 0 ? 0.09 : -0.03) * cr;
            d += `${i ? 'L' : 'M'}${fx(Math.cos(a) * r * k)},${fx(Math.sin(a) * ry * k)}`;
          }
          return d + 'Z';
        })()}
        fill={body}
        stroke={rgba(C.ink, 0.85)}
        strokeWidth={Math.max(0.8, r * 0.06)}
        strokeLinejoin="round"
      />
    ) : (
      <ellipse rx={fx(r)} ry={fx(ry)} fill={body} stroke={rgba(C.ink, 0.85)} strokeWidth={Math.max(0.8, r * 0.06)} />
    );
  return (
    <g transform={`translate(${fx(x)},${fx(y)}) rotate(${fx(rot)})`} opacity={opacity}>
      {outline}
      <ellipse rx={fx(r * 0.86)} ry={fx(ry * 0.86)} fill="none" stroke={deep} strokeWidth={fx(r * 0.12)} opacity={0.55} />
      <ellipse rx={fx(r * 0.5)} ry={fx(ry * 0.5 * dimple + 0.4)} cy={fx(ry * 0.06)} fill={deep} opacity={0.5 * dimple} />
      <ellipse rx={fx(r * 0.42)} ry={fx(ry * 0.36 * dimple + 0.3)} cx={fx(-r * 0.05)} cy={fx(-ry * 0.02)} fill={light} opacity={0.35 * dimple} />
      <ellipse
        cx={fx(-r * 0.45)}
        cy={fx(-ry * 0.5)}
        rx={fx(r * 0.22)}
        ry={fx(ry * 0.14 + 0.4)}
        fill={rgba('#ffffff', 0.55)}
        transform={`rotate(-20 ${fx(-r * 0.45)} ${fx(-ry * 0.5)})`}
      />
    </g>
  );
};

// ---------------------------------------------------------------------------------------------

export const WaterMolecule: React.FC<{x: number; y: number; r: number; rot?: number; opacity?: number; glow?: number}> = ({
  x,
  y,
  r,
  rot = 0,
  opacity = 1,
  glow = 0.5,
}) => {
  const h = r * 0.58;
  const d = r * 0.98;
  const a1 = (-90 - 52) * (Math.PI / 180);
  const a2 = (-90 + 52) * (Math.PI / 180);
  return (
    <g transform={`translate(${fx(x)},${fx(y)}) rotate(${fx(rot)})`} opacity={opacity}>
      {glow > 0 && <circle r={fx(r * 2)} fill={rgba(C.water, 0.14 * glow)} />}
      {[a1, a2].map((a, i) => (
        <g key={i} transform={`translate(${fx(Math.cos(a) * d)},${fx(Math.sin(a) * d)})`}>
          <circle r={fx(h)} fill={C.salt} stroke={rgba(C.ink, 0.7)} strokeWidth={Math.max(0.6, r * 0.07)} />
          <circle cx={fx(-h * 0.3)} cy={fx(-h * 0.3)} r={fx(h * 0.32)} fill="#fff" opacity={0.9} />
        </g>
      ))}
      <circle r={fx(r)} fill={C.water} stroke={rgba(C.ink, 0.75)} strokeWidth={Math.max(0.7, r * 0.08)} />
      <circle r={fx(r * 0.72)} cx={fx(r * 0.12)} cy={fx(r * 0.14)} fill={C.waterDeep} opacity={0.45} />
      <circle cx={fx(-r * 0.32)} cy={fx(-r * 0.34)} r={fx(r * 0.3)} fill={C.waterLight} opacity={0.9} />
      <circle cx={fx(-r * 0.38)} cy={fx(-r * 0.4)} r={fx(r * 0.12)} fill="#fff" />
    </g>
  );
};

export const Drop: React.FC<{x: number; y: number; r: number; rot?: number; stretch?: number; opacity?: number}> = ({
  x,
  y,
  r,
  rot = 0,
  stretch = 1,
  opacity = 1,
}) => {
  const t = r * (1.5 + 0.9 * (stretch - 1)); // tip height above the centre
  const d = `M0,${fx(-t)} C${fx(r * 0.35)},${fx(-t * 0.55)} ${fx(r)},${fx(-r * 0.35)} ${fx(r)},0 A${fx(r)},${fx(r)} 0 1 1 ${fx(-r)},0 C${fx(-r)},${fx(-r * 0.35)} ${fx(-r * 0.35)},${fx(-t * 0.55)} 0,${fx(-t)} Z`;
  return (
    <g transform={`translate(${fx(x)},${fx(y)}) rotate(${fx(rot)})`} opacity={opacity}>
      <path d={d} fill={C.water} stroke={rgba(C.waterDark, 0.85)} strokeWidth={Math.max(0.7, r * 0.09)} strokeLinejoin="round" />
      <ellipse cx={fx(r * 0.15)} cy={fx(r * 0.25)} rx={fx(r * 0.7)} ry={fx(r * 0.55)} fill={C.waterDeep} opacity={0.35} />
      <ellipse cx={fx(-r * 0.38)} cy={fx(-r * 0.15)} rx={fx(r * 0.2)} ry={fx(r * 0.42)} fill={C.waterLight} opacity={0.85} transform={`rotate(18 ${fx(-r * 0.38)} ${fx(-r * 0.15)})`} />
      <circle cx={fx(-r * 0.42)} cy={fx(-r * 0.42)} r={fx(r * 0.12)} fill="#fff" />
    </g>
  );
};

export const Salt: React.FC<{x: number; y: number; r: number; rot?: number; opacity?: number}> = ({x, y, r, rot = 0, opacity = 1}) => {
  // a small isometric cube: top (light), left (mid), right (shade)
  const s = r;
  const top = `M0,${fx(-s)} L${fx(s * 0.87)},${fx(-s * 0.5)} L0,0 L${fx(-s * 0.87)},${fx(-s * 0.5)} Z`;
  const left = `M${fx(-s * 0.87)},${fx(-s * 0.5)} L0,0 L0,${fx(s)} L${fx(-s * 0.87)},${fx(s * 0.5)} Z`;
  const right = `M0,0 L${fx(s * 0.87)},${fx(-s * 0.5)} L${fx(s * 0.87)},${fx(s * 0.5)} L0,${fx(s)} Z`;
  return (
    <g transform={`translate(${fx(x)},${fx(y)}) rotate(${fx(rot)})`} opacity={opacity}>
      <circle r={fx(s * 1.8)} fill={rgba(C.salt, 0.12)} />
      <path d={left} fill={C.saltShade} />
      <path d={right} fill={C.saltDeep} />
      <path d={top} fill={C.salt} />
      <path
        d={`M0,${fx(-s)} L${fx(s * 0.87)},${fx(-s * 0.5)} L${fx(s * 0.87)},${fx(s * 0.5)} L0,${fx(s)} L${fx(-s * 0.87)},${fx(s * 0.5)} L${fx(-s * 0.87)},${fx(-s * 0.5)} Z`}
        fill="none"
        stroke={rgba(C.ink, 0.7)}
        strokeWidth={Math.max(0.6, s * 0.1)}
        strokeLinejoin="round"
      />
      <circle cx={fx(-s * 0.2)} cy={fx(-s * 0.55)} r={fx(s * 0.14)} fill="#fff" />
    </g>
  );
};

export const ADH: React.FC<{x: number; y: number; r: number; rot?: number; opacity?: number; glow?: number}> = ({x, y, r, rot = 0, opacity = 1, glow = 0.6}) => {
  const w = r * 0.55;
  return (
    <g transform={`translate(${fx(x)},${fx(y)}) rotate(${fx(rot)})`} opacity={opacity}>
      {glow > 0 && <ellipse rx={fx(r * 1.7)} ry={fx(w * 2.2)} fill={rgba(C.adh, 0.2 * glow)} />}
      <rect x={fx(-r)} y={fx(-w)} width={fx(r * 2)} height={fx(w * 2)} rx={fx(w)} fill={C.adh} stroke={rgba(C.ink, 0.75)} strokeWidth={Math.max(0.7, r * 0.07)} />
      <rect x={fx(-r * 0.05)} y={fx(-w)} width={fx(r * 1.05)} height={fx(w * 2)} rx={fx(w)} fill={C.adhDeep} opacity={0.55} />
      {[-0.5, 0, 0.5].map((t, i) => (
        <circle key={i} cx={fx(t * r)} cy={0} r={fx(w * 0.28)} fill={C.adhLight} opacity={0.85} />
      ))}
      <rect x={fx(-r * 0.8)} y={fx(-w * 0.72)} width={fx(r * 0.9)} height={fx(w * 0.36)} rx={fx(w * 0.18)} fill="#fff" opacity={0.55} />
    </g>
  );
};

export const Toxin: React.FC<{x: number; y: number; r: number; rot?: number; seed?: number; f?: number; opacity?: number}> = ({
  x,
  y,
  r,
  rot = 0,
  seed = 1,
  f = 0,
  opacity = 1,
}) => {
  const n = 9;
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.sin(f * 0.05 + seed) * 0.08;
    const rr = i % 2 === 0 ? r * (1.05 + 0.15 * hash(i, seed)) : r * 0.66;
    d += `${i ? 'L' : 'M'}${fx(Math.cos(a) * rr)},${fx(Math.sin(a) * rr)}`;
  }
  return (
    <g transform={`translate(${fx(x)},${fx(y)}) rotate(${fx(rot + f * 0.6 * (hash(seed, 3) - 0.5))})`} opacity={opacity}>
      <path d={d + 'Z'} fill={C.toxin} stroke={rgba(C.ink, 0.8)} strokeWidth={Math.max(0.7, r * 0.08)} strokeLinejoin="round" />
      <circle r={fx(r * 0.45)} fill={C.toxinDeep} opacity={0.7} />
      <circle cx={fx(-r * 0.25)} cy={fx(-r * 0.25)} r={fx(r * 0.18)} fill={C.toxinLight} opacity={0.8} />
    </g>
  );
};

export const Ring: React.FC<{x: number; y: number; r: number; color?: string; width?: number; opacity?: number}> = ({
  x,
  y,
  r,
  color = C.alarm,
  width = 6,
  opacity = 1,
}) =>
  r < 0.5 ? null : (
    <g opacity={opacity}>
      <circle cx={fx(x)} cy={fx(y)} r={fx(r)} fill="none" stroke={rgba(color, 0.35)} strokeWidth={width * 3} />
      <circle cx={fx(x)} cy={fx(y)} r={fx(r)} fill="none" stroke={color} strokeWidth={width} />
    </g>
  );
