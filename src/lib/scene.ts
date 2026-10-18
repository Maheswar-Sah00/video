// Contract every scene component follows.
//
//   export const S05Thirst: React.FC<SceneProps> = ({start, len}) => {
//     const f = useCurrentFrame();           // local: 0 .. len-1
//     const abs = start + f;                 // absolute reel frame (for lib/sync.ts helpers)
//     ...
//   };
//
// `len` already includes half of each neighbouring transition, so the first ~8 and last ~8
// frames are partly covered by the transition engine — keep things moving there.
export type SceneProps = {start: number; len: number};

/** Shared lighting vocabulary for HIM (the Hero assets grade themselves by it):
 *  'day'   warm MORNING/afternoon sun through a window on screen upper-LEFT, soft cream bounce
 *          (kitchen S01 S02 S20, desk S07)
 *  'hot'   harsh high midday sun (overhead, slightly left), bleached highlights, short hard
 *          shadows, warm orange bounce from the pavement (hot street S11)
 *  'bath'  cool white vanity light from above-front, pale tile bounce (bathroom mirror S10)
 *  'dim'   evening: low warm window light from screen RIGHT, deep blue shadows (living room S12,
 *          bedroom S16 as the light fades)
 *  'night' dark room, warm lamp key from screen LEFT-below, cool blue fill
 *  'ward' / 'dusk'  inherited (cool overhead / low sun behind on the right) — valid, rarely needed */
export type Lighting = 'day' | 'hot' | 'bath' | 'dim' | 'night' | 'ward' | 'dusk';
