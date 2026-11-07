/* SCREENSHOTS OF THE LAB. Opens game/lab/tracks.html in headless
   Chromium (forced WebGL 2 on SwiftShader, as the feel probes do) and
   saves each track from above and in 3D, landscape, into
   review/tracks/shots/ (or TRACKS_REVIEW_DIR/shots), riding up to a
   bridge or into a banked corner where the track has one, with a close
   orbit of the bridge. Also checks the page reported a valid track and
   no errors; a page that fails to draw fails the run.

   node game/test/tracks/shots.js [kind:seed[:difficulty[:length]] ...] */
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
    const [kind, seedS, dS, lenS] = spec.split(':');
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const q = 'renderer=webgl2&kind=' + kind + (seedS && seedS !== 'today' ? '&seed=' + seedS : '') + (dS ? '&d=' + dS : '') + (lenS ? '&len=' + lenS : '');
    await page.goto(url + 'lab/tracks.html?' + q, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__lab && window.__lab.ready, null, { timeout: 120000 });
    await page.evaluate(() => window.__lab.frame({ mode: 'orbit', yaw: 0.7, pitch: 0.8 }));
    const info = await page.evaluate(() => ({ seed: window.__lab.track.seed, kind: window.__lab.track.kind, length: window.__lab.track.length, valid: window.__lab.valid.ok, failed: window.__lab.valid.failed, fail: document.getElementById('fail').hidden ? null : document.getElementById('fail').textContent, stats: document.getElementById('stats').textContent }));
    const file = path.join(out, kind + '-' + info.seed + '.png');
    await page.screenshot({ path: file });
    /* the ride: approaching a crossover's deck up its ramp if the track
       has one, else into its most banked corner, else 60 m in; and a
       close orbit of the bridge */
    const pick = await page.evaluate(() => {
      const t = window.__lab.track;
      const b = t.bridges && t.bridges[0];
      if (b) return { s: b.along - 45, what: 'the ramp up to the bridge at ' + Math.round(b.along) + ' m', bridge: b.along };
      let best = null;
      for (const c of t.corners) if (c.bank > 0 && (!best || c.bank > best.bank)) best = c;
      if (best) return { s: best.apex - 25, what: best.type + ' banked ' + Math.round(best.bank) + ' degrees at ' + best.apex + ' m' };
      return { s: 60, what: '60 m in' };
    });
    await page.evaluate(s => window.__lab.frame({ mode: 'ride', s }), pick.s);
    const rideFile = path.join(out, kind + '-' + info.seed + '-ride.png');
    await page.screenshot({ path: rideFile });
    let bridgeFile = null;
    if (pick.bridge !== undefined) {
      await page.evaluate(at => window.__lab.frame({ mode: 'orbit', yaw: 2.2, pitch: 0.35, dist: 90, at }), pick.bridge);
      bridgeFile = path.join(out, kind + '-' + info.seed + '-bridge.png');
      await page.screenshot({ path: bridgeFile });
    }
    const ok = info.valid && !info.fail && errors.length === 0;
    if (!ok) failed++;
    results.push({ spec, ...info, errors, file: path.relative(reviewDir, file), ride: path.relative(reviewDir, rideFile), rideAt: pick, bridge: bridgeFile && path.relative(reviewDir, bridgeFile), ok });
    console.log((ok ? 'ok   ' : 'FAIL ') + spec + ' -> ' + info.kind + ' ' + info.seed + ', ' + info.length + ' m, ride ' + pick.what + (errors.length ? ', errors: ' + errors.join(' | ') : '') + (info.fail ? ', ' + info.fail : ''));
    await page.context().close();
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(reviewDir, 'shots.json'), JSON.stringify(results, null, 1));
if (failed) { console.log(failed + ' shot(s) failed'); process.exit(1); }
