import {registerRoot} from 'remotion';
import {makeLab} from './makeLab';
import {S08ThickBlood} from '../scenes/S08ThickBlood';
import {S09Shrivel} from '../scenes/S09Shrivel';
import {S15Heart} from '../scenes/S15Heart';

registerRoot(makeLab({S08: S08ThickBlood, S09: S09Shrivel, S15: S15Heart}));
