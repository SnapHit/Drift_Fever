/* SCREENSHOTS OF THE LAB. Opens game/lab/tracks.html in headless
   Chromium (forced WebGL 2 on SwiftShader, as the feel probes do) and
   saves each track from above and in 3D, landscape, into
   review/tracks/shots/. Also checks the page reported a valid track and
   no errors; a page that fails to draw fails the run.

   node game/test/tracks/shots.js [kind:seed ...] */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { serveGame } from '../feel/serve.js';
import { reviewDir, findChromium } from './lib.js';

const SHOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['circuit:today', 'sprint:today', 'circuit:7', 'circuit:2026', 'sprint:42', 'sprint:1031'];
const out = path.join(reviewDir, 'shots');
fs.mkdirSync(out, { recursive: true });
const { server, url } = await serveGame();
const browser = await chromium.launch({ executablePath: findChromium(), headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
let failed = 0;
try {
  for (const spec of SHOTS) {
    const [kind, seedS, dS] = spec.split(':');
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const q = 'renderer=webgl2&kind=' + kind + (seedS && seedS !== 'today' ? '&seed=' + seedS : '') + (dS ? '&d=' + dS : '');
    await page.goto(url + 'lab/tracks.html?' + q, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__lab && window.__lab.ready, null, { timeout: 120000 });
    await page.evaluate(() => window.__lab.frame({ mode: 'orbit', yaw: 0.7, pitch: 0.8 }));
    const info = await page.evaluate(() => ({ seed: window.__lab.track.seed, kind: window.__lab.track.kind, length: window.__lab.track.length, valid: window.__lab.valid.ok, failed: window.__lab.valid.failed, fail: document.getElementById('fail').hidden ? null : document.getElementById('fail').textContent, stats: document.getElementById('stats').textContent }));
    const file = path.join(out, kind + '-' + info.seed + '.png');
    await page.screenshot({ path: file });
    await page.evaluate(() => window.__lab.frame({ mode: 'ride', s: 60 }));
    const rideFile = path.join(out, kind + '-' + info.seed + '-ride.png');
    await page.screenshot({ path: rideFile });
    const ok = info.valid && !info.fail && errors.length === 0;
    if (!ok) failed++;
    results.push({ spec, ...info, errors, file: path.relative(reviewDir, file), ride: path.relative(reviewDir, rideFile), ok });
    console.log((ok ? 'ok   ' : 'FAIL ') + spec + ' -> ' + info.kind + ' ' + info.seed + ', ' + info.length + ' m' + (errors.length ? ', errors: ' + errors.join(' | ') : '') + (info.fail ? ', ' + info.fail : ''));
    await page.context().close();
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(reviewDir, 'shots.json'), JSON.stringify(results, null, 1));
if (failed) { console.log(failed + ' shot(s) failed'); process.exit(1); }
