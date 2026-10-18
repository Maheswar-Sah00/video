import {registerRoot} from 'remotion';
import {makeLab} from './makeLab';
import {S07DayOne} from '../scenes/S07DayOne';
import {S10Mirror} from '../scenes/S10Mirror';
import {S11Overheat} from '../scenes/S11Overheat';

registerRoot(makeLab({S07: S07DayOne, S10: S10Mirror, S11: S11Overheat}));
