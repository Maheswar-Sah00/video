import React, {useMemo} from 'react';
import {C} from '../../lib/palette';
import {clamp, hash, mixHex, noise1, rgba, smoothPath} from '../../lib/anim';
import {EV} from '../../lib/sync';
import {P, Tube, atLen, dots, fx, heartPhase, sampled, surge} from './util';

/**
 * Glossy anatomical HEART (anterior view, patient's right = screen left), medical-illustration look.
 * Local units: ~430 wide, apex at y≈+242, great vessels up to y≈-430 (+ `ext`). Origin = centre of
 * the ventricles. `f` = ABSOLUTE frame (drives the beat from EV.beats unless `phase` is given).
 *   ventricles squeeze toward the base on each beat (snap, hold, relax with an overshoot), the
 *   atria kick just before, the arteries swell with the pressure wave, blood dots surge in the
 *   great vessels. quiver 0..1 = trembling (the stumble), narrow 0..1 = vessels thin + paler
 *   (pressure crash), pale 0..1 = dusky.
 */

const V: P[] = [
  [-148, -62], [-168, 0], [-160, 70], [-120, 132], [-54, 182], [28, 222], [100, 254], [146, 274], [180, 266], [202, 226], [214, 150], [216, 70], [202, -8], [172, -62], [124, -100], [58, -112], [-20, -104], [-98, -88],
];
const RA: P[] = [[-228, -60], [-216, 14], [-168, 48], [-120, 28], [-102, -40], [-112, -124], [-154, -162], [-208, -142]];
const RAU: P[] = [[-132, -148], [-92, -184], [-48, -164], [-34, -124], [-62, -104], [-104, -110]];
const LAU: P[] = [[120, -102], [160, -128], [204, -110], [216, -72], [186, -56], [144, -70]];

const AORTA: P[] = [[-22, -40], [-34, -130], [-28, -210], [0, -262], [55, -290], [115, -272], [148, -222], [158, -150], [160, -60], [158, 60], [156, 200]];
const BRACH: P[] = [[-4, -256], [-22, -304], [-46, -362], [-64, -430]];
const LCC: P[] = [[44, -284], [46, -336], [48, -430]];
const LSUB: P[] = [[96, -276], [114, -326], [134, -382], [150, -430]];
const SVC: P[] = [[-134, -118], [-138, -200], [-134, -300], [-130, -430]];
const IVC: P[] = [[-150, 20], [-158, 120], [-152, 240], [-146, 400]];
const PT: P[] = [[18, -60], [24, -120], [44, -170], [78, -198]];
const LPA: P[] = [[72, -196], [120, -212], [175, -205], [244, -190]];
const RPA: P[] = [[70, -196], [20, -216], [-60, -214], [-150, -206], [-222, -198]];
const PV1: P[] = [[176, -70], [222, -82], [266, -92]];
const PV2: P[] = [[182, -40], [226, -38], [268, -34]];

const LAD: P[] = [[58, -100], [74, -30], [100, 80], [130, 180], [158, 264]];
const DIAG: P[] = [[86, 20], [126, 52], [166, 82], [208, 108]];
const RCA: P[] = [[-96, -96], [-140, -64], [-162, 6], [-152, 76], [-112, 132], [-48, 180], [24, 214]];
const RMARG: P[] = [[-154, 52], [-118, 84], [-90, 124], [-72, 166]];
const GCV: P[] = [[72, -102], [90, -30], [118, 80], [148, 180], [172, 258]];
const ACV: P[] = [[-70, 166], [-56, 100], [-44, 36], [-34, -34]];

// long versions for the full x-ray chest (heart placed at ~(590,1000) × 1.18 in S15)
const AORTA_X: P[] = [...AORTA, [132, 400], [74, 580], [36, 760], [24, 1000]];
const BRACH_X: P[] = [[-4, -256], [-24, -310], [-48, -372]];
const RCC_X: P[] = [[-48, -372], [-66, -450], [-80, -560], [-86, -700], [-88, -1000]];
const RSUB_X: P[] = [[-48, -372], [-110, -410], [-200, -450], [-330, -480], [-580, -500]];
const LCC_X: P[] = [[44, -284], [36, -360], [16, -460], [4, -600], [0, -1000]];
const LSUB_X: P[] = [[96, -276], [116, -340], [160, -400], [250, -450], [480, -500]];
const SVC_X: P[] = [[-134, -118], [-138, -200], [-140, -290], [-150, -350]];
const RIJ_X: P[] = [[-150, -350], [-132, -470], [-120, -620], [-118, -1000]];
const RSCV_X: P[] = [[-150, -350], [-230, -410], [-360, -450], [-580, -470]];
const LBCV_X: P[] = [[-142, -318], [-80, -350], [0, -380], [60, -405], [130, -428], [260, -460], [480, -480]];
const LIJ_X: P[] = [[60, -405], [42, -500], [34, -640], [32, -1000]];
const IVC_X: P[] = [[-150, 20], [-152, 160], [-128, 330], [-100, 520], [-90, 1000]];

const FIBRES: P[][] = Array.from({length: 9}, (_, k) => [
  [-200 + k * 42, -120],
  [-128 + k * 44, 10],
  [-72 + k * 46, 140],
  [4 + k * 46, 290],
]);

export type HeartProps = {
  f: number;
  id: string;
  x: number;
  y: number;
  scale?: number;
  rot?: number;
  phase?: {v: number; a: number; p: number};
  quiver?: number;
  narrow?: number;
  pale?: number;
  flow?: number; // 0..1 blood dots in the great vessels
  ext?: number; // > 0: long anatomical great vessels (carotids up the neck, subclavians to the shoulders,
  //               jugulars, aorta + IVC down to the spine) for a full chest shot (S15)
  halo?: number;
  opacity?: number;
};

export const Heart: React.FC<HeartProps> = ({f, id, x, y, scale = 1, rot = 0, phase, quiver = 0, narrow = 0, pale = 0, flow = 1, ext = 0, halo = 1, opacity = 1}) => {
  const ph = phase ?? heartPhase(f);
  const {v, a, p} = ph;
  const geo = useMemo(() => {
    const long = ext > 0;
    const art: P[][] = long ? [AORTA_X, RCC_X, RSUB_X, BRACH_X, LCC_X, LSUB_X] : [AORTA, BRACH, LCC, LSUB];
    const ven: P[][] = long ? [IVC_X, RSCV_X, LBCV_X, RIJ_X, LIJ_X, SVC_X] : [IVC, SVC];
    const artW = long ? [64, 20, 22, 28, 20, 25] : [64, 28, 20, 25];
    const venW = long ? [58, 26, 28, 30, 26, 54] : [58, 54];
    const flowArt = (long ? [AORTA_X, [...BRACH_X, ...RCC_X.slice(1)], [...BRACH_X, ...RSUB_X.slice(1)], LCC_X, LSUB_X] : [AORTA, BRACH, LCC, LSUB]).map((q) => sampled(q as P[]));
    const flowVen = (long ? [[...RIJ_X].reverse().concat(SVC_X.slice().reverse().slice(1)), [...IVC_X].reverse()] : [[...SVC].reverse(), [...IVC].reverse()]).map((q) => sampled(q as P[]));
    return {
      art,
      ven,
      artW,
      venW,
      flowArt,
      flowVen,
      pt: sampled([...PT, ...LPA.slice(1)]),
      dV: smoothPath(V, true),
      dRA: smoothPath(RA, true),
      dRAU: smoothPath(RAU, true),
      dLAU: smoothPath(LAU, true),
      fib: FIBRES.map((q) => smoothPath(q)),
      dLAD: smoothPath(LAD),
      dRCA: smoothPath(RCA),
    };
  }, [ext]);

  const k = (c: string) => (pale > 0 ? mixHex(c, '#6a4c60', pale * 0.4) : c);
  const nw = 1 - 0.24 * clamp(narrow);
  const sw = 1 + 0.07 * p; // arterial swell with the pressure wave

  // quiver: fast small trembling (smooth noise — motion only, no flashing)
  const qx = quiver * 4.5 * noise1(f * 1.9, 11);
  const qy = quiver * 2.4 * noise1(f * 2.3, 23);
  const qr = quiver * 2.2 * noise1(f * 1.7, 37);
  const vq = quiver * 0.05 * noise1(f * 2.6, 5);

  // ventricles squeeze toward the base (20,-95): narrower, the apex rises, a slight twist
  const sx = 1 - 0.075 * v + vq;
  const sy = 1 - 0.12 * v - vq * 0.6;
  const vTf = `translate(20,-95) rotate(${fx(-2.4 * v)}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(-20,95)`;
  const aS = 1 - 0.08 * a + 0.045 * Math.max(0, v);
  const aTf = `translate(-150,-60) scale(${aS.toFixed(4)}) translate(150,60)`;

  const red = {base: k(C.vessel), deep: k(C.vesselDeep), light: k(C.vesselLight)};
  const blue = {base: k(C.bloodPoor), deep: k(C.bloodPoorDeep), light: k(C.bloodPoorLight)};
  const raCol = k(mixHex(C.heart, C.bloodPoor, 0.38));

  // blood dots surging through the great vessels
  let dArt = '';
  let dVen = '';
  if (flow > 0) {
    const dist = f * 2.2 + surge(f) * 46;
    const put = (sp: ReturnType<typeof sampled>, n: number, w: number, seed: number, venous: boolean) => {
      const list: {x: number; y: number; r: number}[] = [];
      for (let i = 0; i < n; i++) {
        if (hash(i, seed + 7) > flow) continue;
        const dd = (((hash(i, seed) * sp.len + dist * (venous ? 0.6 : 1)) % sp.len) + sp.len) % sp.len;
        const [px, py, ang] = atLen(sp, dd);
        const off = (hash(i, seed + 3) - 0.5) * w * 0.55;
        list.push({x: px - Math.sin(ang) * off, y: py + Math.cos(ang) * off, r: 2.2 + 2.2 * hash(i, seed + 5)});
      }
      return dots(list);
    };
    const per = ext > 0 ? 2 : 1;
    dArt = geo.flowArt.map((sp, i) => put(sp, Math.round((i === 0 ? 26 : 8) * per), (i === 0 ? 60 : 22) * nw, i + 1, false)).join('');
    dVen = geo.flowVen.map((sp, i) => put(sp, Math.round(11 * per), 50 * nw, i + 11, true)).join('') + put(geo.pt, 12, 50 * nw, 8, false);
  }

  return (
    <g transform={`translate(${fx(x + qx)},${fx(y + qy)}) rotate(${fx(rot + qr)}) scale(${scale.toFixed(4)})`} opacity={opacity}>
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0%" stopColor={C.heart} stopOpacity={0.34} />
          <stop offset="55%" stopColor={C.heart} stopOpacity={0.1} />
          <stop offset="100%" stopColor={C.heart} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-vl`} cx="30%" cy="22%" r="85%">
          <stop offset="0%" stopColor={k(C.heartLight)} />
          <stop offset="38%" stopColor={k(C.heart)} />
          <stop offset="100%" stopColor={k(mixHex(C.heart, C.heartDeep, 0.6))} />
        </radialGradient>
        <radialGradient id={`${id}-vs`} cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor={k(mixHex(C.heart, C.heartDeep, 0.45))} />
          <stop offset="100%" stopColor={k(mixHex(C.heartDeep, C.ink, 0.25))} />
        </radialGradient>
        <radialGradient id={`${id}-ra`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={k(mixHex(raCol, '#ffffff', 0.25))} />
          <stop offset="50%" stopColor={raCol} />
          <stop offset="100%" stopColor={k(mixHex(raCol, C.ink, 0.45))} />
        </radialGradient>
        <radialGradient id={`${id}-spec`}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
        <clipPath id={`${id}-vc`} clipPathUnits="userSpaceOnUse">
          <path d={geo.dV} />
        </clipPath>
      </defs>
      {halo > 0 && <circle cx={10} cy={20} r={420} fill={`url(#${id}-halo)`} opacity={halo * (0.8 + 0.12 * p)} />}

      {/* ---- back: descending aorta, veins, right pulmonary artery, pulmonary veins ---- */}
      {geo.ven.map((q, i) => (
        <Tube key={`v${i}`} pts={q} w={geo.venW[i] * nw} {...blue} />
      ))}
      <Tube pts={RPA} w={40 * nw} {...blue} />
      <Tube pts={PV1} w={22 * nw} {...red} />
      <Tube pts={PV2} w={22 * nw} {...red} />
      {/* ---- aorta + arch branches ---- */}
      {geo.art
        .map((q, i) => ({q, i}))
        .reverse()
        .map(({q, i}) => (
          <Tube key={`a${i}`} pts={q} w={geo.artW[i] * nw * sw} {...red} />
        ))}
      {/* ---- pulmonary trunk + left pulmonary artery (in front of the aorta) ---- */}
      <Tube pts={LPA} w={42 * nw * sw} {...blue} />
      <Tube pts={PT} w={60 * nw * sw} {...blue} />
      {flow > 0 && <path d={dArt} fill={rgba(C.bloodLight, 0.75)} />}
      {flow > 0 && <path d={dVen} fill={rgba(C.bloodPoorLight, 0.7)} />}

      {/* ---- atria ---- */}
      <path d={geo.dLAU} fill={`url(#${id}-ra)`} stroke={rgba(C.ink, 0.85)} strokeWidth={3} transform={aTf} />
      <g transform={aTf}>
        <path d={geo.dRA} fill={`url(#${id}-ra)`} stroke={rgba(C.ink, 0.85)} strokeWidth={3.5} />
        <path d={geo.dRA} fill="none" stroke={rgba(C.bodyGhostLight, 0.35)} strokeWidth={6} transform="translate(6,5) scale(0.97)" />
        <path d={geo.dRAU} fill={`url(#${id}-ra)`} stroke={rgba(C.ink, 0.85)} strokeWidth={3} />
        <ellipse cx={-188} cy={-104} rx={26} ry={10} fill="#fff" opacity={0.5} transform="rotate(-50 -188 -104)" />
        <ellipse cx={-92} cy={-160} rx={14} ry={6} fill="#fff" opacity={0.45} transform="rotate(-20 -92 -160)" />
      </g>

      {/* ---- ventricles ---- */}
      <g transform={vTf}>
        <g clipPath={`url(#${id}-vc)`}>
          <path d={geo.dV} fill={`url(#${id}-vs)`} />
          <path d={geo.dV} fill={`url(#${id}-vl)`} transform="translate(-20,-24)" />
          {geo.fib.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={rgba(C.heartDeep, 0.16)} strokeWidth={2.4} />
          ))}
          <path d={geo.dV} fill="none" stroke={rgba(C.bodyGhostLight, 0.55)} strokeWidth={10} transform="translate(-9,-7)" />
        </g>
        {/* interventricular groove + coronary vessels on the surface */}
        <path d={geo.dLAD} fill="none" stroke={rgba(C.heartDeep, 0.45)} strokeWidth={26} strokeLinecap="round" />
        <path d={geo.dRCA} fill="none" stroke={rgba(C.heartDeep, 0.4)} strokeWidth={22} strokeLinecap="round" />
        <Tube pts={GCV} w={9} {...blue} inkW={1.4} gloss={0.7} />
        <Tube pts={ACV} w={7} {...blue} inkW={1.2} gloss={0.6} />
        <Tube pts={RCA} w={14} {...red} inkW={1.6} />
        <Tube pts={RMARG} w={8} {...red} inkW={1.2} gloss={0.7} />
        <Tube pts={LAD} w={14} {...red} inkW={1.6} />
        <Tube pts={DIAG} w={8} {...red} inkW={1.2} gloss={0.7} />
        <path d={geo.dV} fill="none" stroke={rgba(C.ink, 0.9)} strokeWidth={4} strokeLinejoin="round" />
        {/* gloss */}
        <ellipse cx={-50} cy={-14} rx={95} ry={58} fill={`url(#${id}-spec)`} transform="rotate(-38 -50 -14)" opacity={0.8 + 0.25 * Math.max(0, v)} />
        <ellipse cx={-78} cy={-40} rx={40} ry={12} fill="#fff" opacity={0.78} transform="rotate(-42 -78 -40)" />
        <ellipse cx={-26} cy={-70} rx={8} ry={5} fill="#fff" opacity={0.7} />
        <ellipse cx={172} cy={70} rx={10} ry={30} fill="#fff" opacity={0.28} transform="rotate(12 172 70)" />
      </g>
    </g>
  );
};
