import React from 'react';
import {AbsoluteFill, Composition, registerRoot, useCurrentFrame} from 'remotion';
import {C} from '../lib/palette';
import {MONO} from '../lib/fonts';
import {ADH, BodyCell, Drop, RBC, Ring, Salt, Toxin, WaterMolecule} from '../lib/Cells';
import {Glass} from '../characters/Glass';
import {HeroHead} from '../characters/HeroHead';

const T: React.FC<{x: number; y: number; t: string}> = ({x, y, t}) => (
  <text x={x} y={y} fill={C.hudDim} fontFamily={MONO} fontSize={20} textAnchor="middle">
    {t}
  </text>
);

const Sheet: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: C.medBg}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        {[1, 0.66, 0.33, 0].map((w, i) => (
          <g key={i}>
            <BodyCell x={140 + i * 260} y={180} r={95} seed={i + 2} f={f} water={w} />
            <T x={140 + i * 260} y={310} t={`BodyCell water ${w}`} />
          </g>
        ))}
        {[0, 0.5, 1].map((c, i) => (
          <g key={i}>
            <RBC x={160 + i * 200} y={420} r={60} tilt={0.2} crenate={c} />
            <T x={160 + i * 200} y={510} t={`RBC crenate ${c}`} />
          </g>
        ))}
        <WaterMolecule x={780} y={420} r={34} />
        <T x={780} y={510} t="WaterMolecule" />
        <Drop x={940} y={430} r={30} />
        <T x={940} y={510} t="Drop" />
        <Salt x={140} y={600} r={30} />
        <T x={140} y={670} t="Salt" />
        <ADH x={360} y={600} r={50} />
        <T x={360} y={670} t="ADH" />
        <Toxin x={580} y={600} r={36} seed={3} f={f} />
        <T x={580} y={670} t="Toxin" />
        <Ring x={800} y={600} r={40 + (f % 30)} opacity={1 - (f % 30) / 30} />
        <T x={800} y={670} t="Ring" />
        {[1, 0.6, 0.15, 0].map((lv, i) => (
          <Glass key={i} f={f} id={`g${i}`} x={160 + i * 250} y={1000} level={lv} rot={i === 2 ? 50 : 0} slosh={i === 1 ? 1 : 0} />
        ))}
        {[0, 0.5, 1].map((d, i) => (
          <g key={i}>
            <HeroHead f={f} id={`h${i}`} x={190 + i * 350} y={1300} scale={0.55} dry={d} lighting={(['day', 'hot', 'bath'] as const)[i]} outfit="tee" shoulders />
            <T x={190 + i * 350} y={1720} t={`dry ${d}`} />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

registerRoot(() => <Composition id="Cells" component={Sheet} durationInFrames={60} fps={30} width={1080} height={1920} />);
