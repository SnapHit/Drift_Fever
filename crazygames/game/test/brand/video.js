/* THE PREVIEW VIDEO'S FRAMES (15 November 2026): a race drawn by the
   game itself, frame by frame, as a player on a desktop sees it. The
   author's car, the drift build in amber on tri-blades with the violet
   glow and every upgrade, against Varsk on Upper deck at night, driven
   by the look-ahead driver with a player's hands. Nothing is forced:
   the score, the multiplier, the camera and the HUD are the game's own.
   CrazyGames asks for 15 to 20 s, 1080p in 16:9 and in 2:3, no sound
   (docs.crazygames.com/requirements/game-covers, read the same day).

   node game/test/brand/video.js scan                       prints the best window of the race
   node game/test/brand/video.js landscape <from> <frames>  writes brand/video/frames-landscape/00000.jpg ...
   node game/test/brand/video.js portrait <from> <frames>
   Frames are 1/60 s apart. ffmpeg joins them (see ../../../CLAUDE.md). */
import path from 'node:path'; import fs from 'node:fs';
import * as R from '../garage/lib.js';
const [mode = 'scan', from = '0', count = '60'] = process.argv.slice(2);
const SIZE = { landscape: [1920, 1080], portrait: [1080, 1620], scan: [1920, 1080] }[mode];
const env = await R.start();
const context = await env.browser.newContext({ viewport: { width: SIZE[0], height: SIZE[1] }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', e => console.log('ERR', String(e).slice(0, 300)));
await page.addInitScript(`(function () { window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {}; })();`);
await page.goto(env.url + '?renderer=webgl2&tier=high&adapt=0&title=1', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.evaluate(({ RIVAL, HANDS }) => {
  try { localStorage.clear(); } catch (e) {}
  const L = window.__loop, S = L.save; S.reset(); S.setOnboarded();
  S.state.cars.driftbuild = { paint: 'amber', up: { power: 3, grip: 3, steer: 3 }, wheels: 'blades', glow: 'violet', smoke: 'standard', own: { wheels: ['blades'], glow: ['violet'], smoke: [] } };
  S.state.car = 'driftbuild';
  S.state.rivals = { r1: { won: true, best: 1 }, r2: { won: true, best: 1 } };   // not a first race: no instructions panel
  window.__feel.draw = false;
  L.startRun({ ...L.battleSpec(RIVAL), preset: 'night' }); L.skipCountdown();
  window.__feel.setDriver({ player: 'slide', drive: L.RIVALS.find(r => r.id === HANDS).drive });
  window.__clock = 1000;
}, { RIVAL: process.env.RIVAL || 'r3', HANDS: process.env.HANDS || 'r6' });
await R.seedRandom(page, 7);
const step = (n, draw) => page.evaluate(({ n, draw }) => { const F = window.__feel; F.draw = draw; for (let i = 0; i < n; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); } }, { n, draw });
if (mode === 'scan') {
  const rows = await page.evaluate(() => {
    const F = window.__feel, L = window.__loop, out = [];
    for (let k = 0; k < 60 * 70; k++) {
      window.__clock += 1000 / 60; F.frame(window.__clock);
      if (L.app.state !== 'drive') { out.push(null); continue; }
      const c = F.world.car, r = L.rival() && L.rival().world.car;
      out.push([Math.abs(c.slip) * 57.3 > 20 && c.speed > 10 ? 1 : 0, r ? Math.hypot(r.x - c.x, r.z - c.z) : 99, F.world.touching ? 1 : 0, F.world.hits || 0]);
    }
    return out;
  });
  const N = 1080; let best = null;
  for (let s = 0; s + N <= rows.length; s += 30) {
    const w = rows.slice(s, s + N); if (w.some(x => !x)) continue;
    const slide = w.reduce((a, x) => a + x[0], 0) / N, near = w.filter(x => x[1] < 20).length / N, touch = w.reduce((a, x) => a + x[2], 0) / N, hits = w[N - 1][3] - w[0][3];
    const score = slide + near * 0.8 - touch * 3 - hits * 0.3;
    if (!best || score > best.score) best = { from: s + 1, score: +score.toFixed(3), slide: +slide.toFixed(2), near: +near.toFixed(2), touch: +touch.toFixed(3), hits };
  }
  console.log((process.env.RIVAL || 'r3') + ' hands ' + (process.env.HANDS || 'r6'), JSON.stringify(best), 'first drive frame', rows.findIndex(x => x) + 1, 'state at end', await page.evaluate(() => window.__loop.app.state));
} else {
  const dir = path.join(R.root, 'brand', 'video', 'frames-' + mode); fs.mkdirSync(dir, { recursive: true });
  const first = +from, n = +count, have = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length;   // carries on where an earlier run stopped
  await step(first - 1 + have, false);
  const t0 = Date.now();
  for (let i = have; i < n; i++) {
    await step(1, true);
    await page.screenshot({ path: path.join(dir, String(i).padStart(5, '0') + '.jpg'), quality: 95 });
    if (i % 60 === 0) console.log(mode + ' frame ' + i + ' of ' + n + ', ' + ((Date.now() - t0) / 1000 / Math.max(1, i - have + 1)).toFixed(2) + ' s a frame');
  }
  console.log('done ' + mode);
}
await env.close();
