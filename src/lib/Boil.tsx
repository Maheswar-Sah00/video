import React from 'react';

/**
 * Hand-drawn "line boil": put <BoilDefs id="boil" f={frame}/> inside your <svg><defs>, then
 * wrap line-art groups with filter="url(#boil)". The displacement seed steps every `every`
 * frames (on twos/threes like cel animation). Keep scale 1.5–3.5. It costs render time on very
 * large areas — apply to characters/foreground line art, not to full-screen fills.
 */
export const BoilDefs: React.FC<{id: string; f: number; scale?: number; every?: number; freq?: number}> = ({
  id,
  f,
  scale = 2.5,
  every = 3,
  freq = 0.035,
}) => {
  const seed = Math.floor(f / every) % 64;
  return (
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={1} seed={seed} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
};
