import React from 'react';
import type {SceneProps} from '../lib/scene';
import {S01Hook} from './S01Hook';
import {S02LastDrop} from './S02LastDrop';
import {S03BodyWater} from './S03BodyWater';
import {S04Leaking} from './S04Leaking';
import {S05Thirst} from './S05Thirst';
import {S06Kidneys} from './S06Kidneys';
import {S07DayOne} from './S07DayOne';
import {S08ThickBlood} from './S08ThickBlood';
import {S09Shrivel} from './S09Shrivel';
import {S10Mirror} from './S10Mirror';
import {S11Overheat} from './S11Overheat';
import {S12Dizzy} from './S12Dizzy';
import {S13BrainShrink} from './S13BrainShrink';
import {S14KidneysFail} from './S14KidneysFail';
import {S15Heart} from './S15Heart';
import {S16Fade} from './S16Fade';
import {S17Lifetime} from './S17Lifetime';
import {S18Rewind} from './S18Rewind';
import {S19Refill} from './S19Refill';
import {S20Closing} from './S20Closing';

export const SCENES: Record<string, React.FC<SceneProps>> = {
  S01: S01Hook,
  S02: S02LastDrop,
  S03: S03BodyWater,
  S04: S04Leaking,
  S05: S05Thirst,
  S06: S06Kidneys,
  S07: S07DayOne,
  S08: S08ThickBlood,
  S09: S09Shrivel,
  S10: S10Mirror,
  S11: S11Overheat,
  S12: S12Dizzy,
  S13: S13BrainShrink,
  S14: S14KidneysFail,
  S15: S15Heart,
  S16: S16Fade,
  S17: S17Lifetime,
  S18: S18Rewind,
  S19: S19Refill,
  S20: S20Closing,
};
