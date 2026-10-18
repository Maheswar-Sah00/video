import {TL} from './sync';

export type Range = {id: string; name: string; at: number; next: number; start: number; len: number; inDur: number; outDur: number};

/** Each scene's Sequence range: [at - half of incoming transition, next + half of outgoing]. */
export const RANGES: Range[] = TL.scenes.map((s, i) => {
  const prev = i > 0 ? TL.scenes[i - 1].into : null;
  const out = s.into;
  const next = i < TL.scenes.length - 1 ? TL.scenes[i + 1].at : TL.total;
  const inDur = prev ? prev.dur : 0;
  const outDur = out && i < TL.scenes.length - 1 ? out.dur : 0;
  const start = s.at - Math.ceil(inDur / 2);
  const end = next + Math.floor(outDur / 2);
  return {id: s.id, name: s.name, at: s.at, next, start, len: end - start, inDur, outDur};
});

export const rangeOf = (id: string) => RANGES.find((r) => r.id === id)!;

/** Which scene owns absolute frame f (by nominal boundaries). */
export const sceneIndexAt = (f: number) => {
  let idx = 0;
  for (let i = 0; i < TL.scenes.length; i++) if (f >= TL.scenes[i].at) idx = i;
  return idx;
};
