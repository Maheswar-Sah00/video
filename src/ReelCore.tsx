import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import type {SceneProps} from './lib/scene';
import {RANGES} from './lib/timing';
import {TL} from './lib/sync';
import {FlashLayer, TransitionWrap} from './Transition';
import {EndFade, Grain, Hud, TitleCard, Vignette} from './lib/Overlays';
import narration from './narration.json';
import audioManifest from './audio-manifest.json';

const FPS = TL.fps;

const Missing: React.FC<SceneProps> = () => <AbsoluteFill style={{background: '#111'}} />;

/** The whole reel. `scenes` maps scene id -> component (missing ids render black). */
export const ReelCore: React.FC<{scenes: Record<string, React.FC<SceneProps>>; audio?: boolean; overlays?: boolean}> = ({
  scenes,
  audio = true,
  overlays = true,
}) => {
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {RANGES.map((r, i) => {
        const Scene = scenes[r.id] ?? Missing;
        const inT = i > 0 ? TL.scenes[i - 1].into : null;
        const outT = TL.scenes[i].into;
        return (
          <Sequence key={r.id} from={r.start} durationInFrames={r.len} name={`${r.id} ${r.name}`}>
            <TransitionWrap len={r.len} inT={inT} outT={i < RANGES.length - 1 ? outT : null}>
              <Scene start={r.start} len={r.len} />
            </TransitionWrap>
          </Sequence>
        );
      })}
      {overlays && (
        <>
          <Vignette />
          {TL.scenes.map((s, i) =>
            s.into?.type === 'flash' && i < TL.scenes.length - 1 ? (
              <FlashLayer key={`fl${i}`} at={TL.scenes[i + 1].at} dur={s.into.dur} color={s.into.color ?? '#fff'} />
            ) : null,
          )}
          <Hud />
          <TitleCard from={TL.marks.titleIn as number} to={TL.marks.titleOut as number} />
          <Grain />
        </>
      )}
      <EndFade />
      {audio &&
        narration.map((n) => (
          <Sequence key={n.id} from={Math.round(n.start * FPS)} durationInFrames={Math.ceil((n.dur + 0.2) * FPS)} name={`VO ${n.id}`}>
            <Audio src={staticFile(`audio/narr/${n.id}.wav`)} volume={1} />
          </Sequence>
        ))}
      {audio &&
        (audioManifest as {file: string; volume: number}[]).map((a) => (
          <Audio key={a.file} src={staticFile(a.file)} volume={a.volume} />
        ))}
    </AbsoluteFill>
  );
};
