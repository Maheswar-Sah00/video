import React from 'react';
import {AbsoluteFill, Composition, registerRoot, useCurrentFrame} from 'remotion';
import {C} from '../lib/palette';
import {MONO} from '../lib/fonts';
import {HeroHead} from '../characters/HeroHead';
import {HeroHand, heroHandGlass, heroHandPoints} from '../characters/HeroHand';
import {Hero} from '../characters/Hero';
import {Glass} from '../characters/Glass';

/** hero builder's private asset sheets (absolute f = local f + 300 so idle motion runs). */
const Bg: React.FC<{c?: string}> = ({c = '#d9cdb8'}) => <rect width={1080} height={1920} fill={c} />;
const T: React.FC<{x: number; y: number; t: string; c?: string}> = ({x, y, t, c = C.ink}) => (
  <text x={x} y={y} fontFamily={MONO} fontSize={28} fill={c} textAnchor="middle">
    {t}
  </text>
);

const Heads: React.FC = () => {
  const f = useCurrentFrame() + 300;
  const dr = [0, 0.33, 0.67, 1];
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <Bg c={C.kitchenWall} />
        {dr.map((d, i) => {
          const x = 280 + (i % 2) * 520, y = 420 + Math.floor(i / 2) * 900;
          return (
            <g key={i}>
              <HeroHead f={f} id={`h${i}`} x={x} y={y} scale={0.8} turn={0.32} dry={d} shoulders outfit="tee" expression={d > 0.5 ? 'tired' : 'content'} lighting="day" blink={0} />
              <T x={x} y={y - 300} t={`dry ${d}`} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

const HeadsLight: React.FC = () => {
  const f = useCurrentFrame() + 300;
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <rect width={1080} height={960} fill={C.hotSkyLow} />
        <rect y={960} width={1080} height={960} fill={C.bathTile} />
        <HeroHead f={f} id="hh" x={280} y={420} scale={0.75} turn={0.3} dry={0.7} shoulders outfit="tee" expression="tired" lighting="hot" blink={0} />
        <T x={280} y={110} t="hot dry .7" />
        <HeroHead f={f} id="hs" x={800} y={420} scale={0.75} turn={-0.2} tilt={0.35} swallow={0.5} shoulders outfit="tee" expression="content" lighting="day" blink={0} />
        <T x={800} y={110} t="swallow .5 tilt" />
        <HeroHead f={f} id="hb" x={280} y={1380} scale={0.75} turn={0.05} dry={0.67} shoulders outfit="tee" expression="worried" lighting="bath" blink={0} />
        <T x={280} y={1070} t="bath dry .67" />
        <HeroHead f={f} id="hb2" x={800} y={1380} scale={0.75} turn={-0.4} dry={0} shoulders outfit="tee" expression="smile" lighting="bath" blink={0} />
        <T x={800} y={1070} t="bath dry 0" />
      </svg>
    </AbsoluteFill>
  );
};

const Hands: React.FC = () => {
  const f = useCurrentFrame() + 300;
  const h1 = {f, id: 'hg', x: 200, y: 560, rot: 0, pose: 'holdGlass' as const, sleeve: 'tee' as const, armAng: 30};
  const h2 = {f, id: 'hg2', x: 640, y: 600, rot: -60, pose: 'holdGlass' as const, sleeve: 'tee' as const, armAng: 20, dry: 0.7};
  const back = {f, id: 'hb', x: 640, y: 1500, rot: -90, pose: 'relaxed' as const, palm: false, sleeve: 'tee' as const, tent: 1, dry: 0.67, mirror: true};
  const tp = heroHandPoints(back).tent;
  const pin = {f, id: 'hp', x: 0, y: 0, rot: 180, pose: 'pinch' as const, sleeve: 'tee' as const, dry: 0.67};
  const pp = heroHandPoints({...pin, x: 0, y: 0});
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <Bg c={C.tile} />
        <HeroHand {...h1} layer="back" />
        <Glass f={f} id="g1" {...heroHandGlass(h1)} level={0.75} condensation={0.6} />
        <HeroHand {...h1} layer="front" />
        <T x={260} y={120} t="holdGlass" />
        <HeroHand {...h2} layer="back" />
        <Glass f={f} id="g2" {...heroHandGlass(h2)} level={0.6} slosh={0.6} condensation={0.4} />
        <HeroHand {...h2} layer="front" />
        <T x={760} y={120} t="tilt -60 dry .7" />
        <HeroHand f={f} id="ht" x={240} y={1150} pose="temple" sleeve="tee" />
        <T x={240} y={830} t="temple" />
        <HeroHand f={f} id="ho" x={480} y={1150} pose="onHead" sleeve="tee" />
        <HeroHand {...back} />
        <HeroHand {...pin} x={tp.x - pp.pinch.x} y={tp.y - pp.pinch.y} />
        <T x={760} y={1700} t="pinch + tent" />
      </svg>
    </AbsoluteFill>
  );
};

const Figures: React.FC = () => {
  const f = useCurrentFrame() + 300;
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <Bg c={C.kitchenWall} />
        <rect y={860} width={1080} height={20} fill={C.sofa} />
        <Hero f={f} id="s1" x={180} y={800} scale={0.6} pose="sitSofa" outfit="tee" anchor="feet" dry={0.77} lighting="dim" />
        <Hero f={f} id="s2" x={540} y={800} scale={0.6} pose="sitSofa" poseTo="stand" poseMix={0.5} outfit="tee" anchor="feet" dry={0.77} lighting="dim" view="threeQuarter" />
        <Hero f={f} id="s3" x={880} y={800} scale={0.6} pose="sitSofa" outfit="tee" anchor="feet" view="threeQuarter" lighting="dim" />
        <Hero f={f} id="w1" x={200} y={1800} scale={0.6} pose="walk" outfit="tee" anchor="feet" dry={0.7} lighting="hot" walkPhase={0.25} />
        <Hero f={f} id="w2" x={460} y={1800} scale={0.6} pose="walk" outfit="tee" anchor="feet" dry={0.7} lighting="hot" walkPhase={0.5} />
        <Hero f={f} id="w3" x={760} y={1800} scale={0.6} pose="walk" outfit="tee" anchor="feet" dry={0.7} lighting="hot" view="threeQuarter" walkPhase={0.25} />
        <T x={540} y={60} t="sitSofa / mid stand-up / 3q ; walk front .25 .5 / 3q" />
      </svg>
    </AbsoluteFill>
  );
};

const Glasses: React.FC = () => {
  const f = useCurrentFrame() + 300;
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <rect width={1080} height={1920} fill={C.tile} />
        <rect y={700} width={1080} height={300} fill={C.counter} />
        <rect y={1500} width={1080} height={420} fill={C.counter} />
        <Glass f={f} id="a" x={220} y={760} scale={1.5} level={0.9} condensation={0.8} ground={1} />
        <Glass f={f} id="b" x={600} y={760} scale={1.5} level={0.5} slosh={0.8} rot={25} ground={0.6} />
        <Glass f={f} id="c" x={900} y={760} scale={1.1} level={0} condensation={0} ground={1} lighting="dim" />
        <Glass f={f} id="d" x={300} y={1560} scale={1.8} level={0.3} rot={-70} />
        <Glass f={f} id="e" x={820} y={1560} scale={1.8} level={0.08} ground={1} sparkle={1} />
      </svg>
    </AbsoluteFill>
  );
};

const Root: React.FC = () => (
  <>
    {(
      [
        ['Heads', Heads],
        ['HeadsLight', HeadsLight],
        ['Hands', Hands],
        ['Figures', Figures],
        ['Glasses', Glasses],
      ] as [string, React.FC][]
    ).map(([k, Comp]) => (
      <Composition key={k} id={k} component={Comp} durationInFrames={120} fps={30} width={1080} height={1920} />
    ))}
  </>
);
registerRoot(Root);
