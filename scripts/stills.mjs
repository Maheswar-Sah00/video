// Render review stills (and optionally a contact sheet) from any entry/composition.
//
//   node scripts/stills.mjs --entry=src/lab/micro1.tsx --comp=Group --frames=300,330,360-420:20 --name=micro1 --sheet
//   node scripts/stills.mjs --comp=Reel --frames=0-2399:60 --name=reel --sheet          (default entry src/index.ts)
//
// Frames: comma list; "a-b:step" ranges. Output: out/stills/<name>-fNNNN.png (+ out/stills/<name>.png sheet).
// --scale=0.5 (default) renders at half size; --scale=1 for full-res detail checks.
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

// C: is nearly full: keep webpack bundles + Chrome temp files on B:
fs.mkdirSync('B:/insta_reels/_tmp', {recursive: true});
process.env.TEMP = process.env.TMP = 'B:/insta_reels/_tmp';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const entry = path.resolve(root, args.entry ?? 'src/index.ts');
const comp = args.comp ?? 'Reel';
const name = args.name ?? comp;
const scale = Number(args.scale ?? 0.5);
const outDir = path.join(root, 'out', 'stills');
fs.mkdirSync(outDir, {recursive: true});

const frames = [];
for (const part of String(args.frames ?? '0').split(',')) {
  const m = part.match(/^(\d+)-(\d+)(?::(\d+))?$/);
  if (m) {
    const [a, b, s] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 10)];
    for (let f = a; f <= b; f += s) frames.push(f);
  } else if (part.trim() !== '') frames.push(Number(part));
}

const t0 = Date.now();
const serveUrl = await bundle({entryPoint: entry, publicDir: path.join(root, 'public'), webpackOverride: (c) => c});
const browser = await openBrowser('chrome', {chromiumOptions: {gl: 'angle'}});
const composition = await selectComposition({serveUrl, id: comp, inputProps: {}, puppeteerInstance: browser});
const files = [];
const queue = frames.filter((f) => f < composition.durationInFrames);
const worker = async () => {
  while (queue.length) {
    const f = queue.shift();
    const out = path.join(outDir, `${name}-f${String(f).padStart(4, '0')}.png`);
    await renderStill({composition, serveUrl, frame: f, output: out, scale, imageFormat: 'png', puppeteerInstance: browser, inputProps: {}, overwrite: true});
    files.push([f, out]);
  }
};
await Promise.all(Array.from({length: Math.min(Number(args.workers ?? 3), queue.length)}, worker));
await browser.close({silent: true});
try { fs.rmSync(serveUrl, {recursive: true, force: true}); } catch {}
files.sort((a, b) => a[0] - b[0]);
for (const [, f] of files) console.log(path.relative(root, f));
if (args.sheet && files.length) {
  const sheet = path.join(outDir, `${name}.png`);
  execFileSync('python', [path.join(root, 'scripts', 'sheet.py'), sheet, ...files.map(([, f]) => f)], {stdio: 'inherit'});
  console.log('sheet:', path.relative(root, sheet));
}
console.log(`done ${files.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
