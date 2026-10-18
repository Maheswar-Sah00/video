import {registerRoot} from 'remotion';
import {makeLab} from './makeLab';
import {S18Rewind} from '../scenes/S18Rewind';

registerRoot(makeLab({S18: S18Rewind}));
