import React from 'react';
import {AbsoluteFill, Composition, registerRoot, useCurrentFrame} from 'remotion';
import {HeroHead} from '../characters/HeroHead';
import {HeroHand} from '../characters/HeroHand';

/** day builder: private preview of the shared character assets in my scenes' conditions. */
const Sheet: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: '#7a8ea0'}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <HeroHead f={1160} id="a" x={290} y={430} scale={0.6} turn={0.04} outfit="tee" shoulders expression="tired" dry={0.67} lighting="bath" />
        <HeroHead f={1160} id="b" x={790} y={430} scale={0.6} turn={0.04} outfit="tee" shoulders expression="tired" dry={0.67} lighting="day" />
        <HeroHand f={f} id="h" x={200} y={1500} scale={2} rot={74} mirror pose="open" poseTo="relaxed" poseMix={0.4} palm={false} sleeve="tee" tent={1} dry={0.67} lighting="bath" />
        <HeroHead f={1220} id="c" x={790} y={1300} scale={0.6} turn={0.1} outfit="tee" shoulders expression="tired" dry={0.7} lighting="hot" />
      </svg>
    </AbsoluteFill>
  );
};

registerRoot(() => <Composition id="A" component={Sheet} durationInFrames={60} fps={30} width={1080} height={1920} />);
