import {Config} from '@remotion/cli/config';
import fs from 'node:fs';

// C: is nearly full: keep bundles + Chrome temp files on B:
fs.mkdirSync('B:/insta_reels/_tmp', {recursive: true});
process.env.TEMP = process.env.TMP = 'B:/insta_reels/_tmp';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
