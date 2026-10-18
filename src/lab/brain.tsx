import {registerRoot} from 'remotion';
import {makeLab} from './makeLab';
import {S05Thirst} from '../scenes/S05Thirst';
import {S13BrainShrink} from '../scenes/S13BrainShrink';

registerRoot(makeLab({S05: S05Thirst, S13: S13BrainShrink}));
