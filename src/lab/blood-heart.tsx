import React from 'react';
import {AbsoluteFill, Composition, registerRoot, useCurrentFrame} from 'remotion';
import {MedBg} from '../lib/MedKit';
import {Heart} from '../parts/blood/Heart';

// Private lab: the glossy heart alone. Frame = ABSOLUTE reel frame (beats from EV.beats).
const HeartLab: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <MedBg f={f} id="hl-bg" />
        <Heart f={f} id="hl" x={560} y={1000} scale={1.25} ext={300} />
        <Heart f={f} id="hl2" x={300} y={500} scale={0.45} />
      </svg>
    </AbsoluteFill>
  );
};

registerRoot(() => <Composition id="Heart" component={HeartLab} durationInFrames={2310} fps={30} width={1080} height={1920} />);
