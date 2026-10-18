import {registerRoot} from 'remotion';
import {makeLab} from './makeLab';
import {S01Hook} from '../scenes/S01Hook';
import {S02LastDrop} from '../scenes/S02LastDrop';
import {S20Closing} from '../scenes/S20Closing';

registerRoot(makeLab({S01: S01Hook, S02: S02LastDrop, S20: S20Closing}));
