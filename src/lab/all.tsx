import {registerRoot} from 'remotion';
import {makeLab} from './makeLab';
import {SCENES} from '../scenes';
registerRoot(makeLab(SCENES));
