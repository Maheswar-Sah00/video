import {loadFont as loadOswald} from '@remotion/google-fonts/Oswald';
import {loadFont as loadMono} from '@remotion/google-fonts/IBMPlexMono';
import {loadFont as loadSerif} from '@remotion/google-fonts/LibreBaskerville';

// Titles: bold condensed. Labels: mono small caps. Latin names / textbook captions: serif italic.
export const TITLE = loadOswald('normal', {weights: ['500', '700'], subsets: ['latin']}).fontFamily;
export const MONO = loadMono('normal', {weights: ['500', '600'], subsets: ['latin']}).fontFamily;
export const SERIF = loadSerif('italic', {weights: ['400'], subsets: ['latin']}).fontFamily;
