import {registerRoot} from 'remotion';
import {makeLab} from './makeLab';
import {S03BodyWater} from '../scenes/S03BodyWater';
import {S04Leaking} from '../scenes/S04Leaking';
import {S17Lifetime} from '../scenes/S17Lifetime';
import {S19Refill} from '../scenes/S19Refill';

registerRoot(makeLab({S03: S03BodyWater, S04: S04Leaking, S17: S17Lifetime, S19: S19Refill}));
