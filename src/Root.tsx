import React from 'react';
import {Composition} from 'remotion';
import {Reel} from './Reel';
import {TL} from './lib/sync';

export const Root: React.FC = () => (
  <>
    <Composition id="Reel" component={Reel} durationInFrames={TL.total} fps={TL.fps} width={1080} height={1920} defaultProps={{audio: true, overlays: true}} />
    <Composition id="ReelSilent" component={Reel} durationInFrames={TL.total} fps={TL.fps} width={1080} height={1920} defaultProps={{audio: false, overlays: true}} />
  </>
);
