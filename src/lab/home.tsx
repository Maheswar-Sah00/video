import {registerRoot} from 'remotion';
import {makeLab} from './makeLab';
import {S12Dizzy} from '../scenes/S12Dizzy';
import {S16Fade} from '../scenes/S16Fade';

registerRoot(makeLab({S12: S12Dizzy, S16: S16Fade}));
