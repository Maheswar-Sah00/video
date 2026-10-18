import React from 'react';
import {AbsoluteFill, Composition} from 'remotion';
import {ReelCore} from '../ReelCore';
import {rangeOf} from '../lib/timing';
import {TL} from '../lib/sync';
import type {SceneProps} from '../lib/scene';
import {Grain, Vignette} from '../lib/Overlays';

/**
 * Lab root for one builder's scenes (isolated bundle: only imports what it is given).
 *  - "<ID>"     : the scene alone, LOCAL frames 0..len-1, with grain + vignette.
 *  - "Group"    : the full reel timeline (ABSOLUTE frames) with transitions, HUD and overlays,
 *                 only these scenes filled in (others black), no audio.
 */
export const makeLab = (scenes: Record<string, React.FC<SceneProps>>) => {
  const LabRoot: React.FC = () => (
    <>
      {Object.entries(scenes).map(([id, Comp]) => {
        const r = rangeOf(id);
        const Wrapped: React.FC = () => (
          <AbsoluteFill style={{background: '#000'}}>
            <Comp start={r.start} len={r.len} />
            <Vignette />
            <Grain />
          </AbsoluteFill>
        );
        return <Composition key={id} id={id} component={Wrapped} durationInFrames={r.len} fps={TL.fps} width={1080} height={1920} />;
      })}
      <Composition
        id="Group"
        component={() => <ReelCore scenes={scenes} audio={false} />}
        durationInFrames={TL.total}
        fps={TL.fps}
        width={1080}
        height={1920}
      />
    </>
  );
  return LabRoot;
};
