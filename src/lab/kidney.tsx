import {registerRoot} from 'remotion';
import {makeLab} from './makeLab';
import {S06Kidneys} from '../scenes/S06Kidneys';
import {S14KidneysFail} from '../scenes/S14KidneysFail';

registerRoot(makeLab({S06: S06Kidneys, S14: S14KidneysFail}));
