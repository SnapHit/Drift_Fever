/* REFERENCE PICTURES OF THE TOP CAR for the cover art (15 November
   2026): the drift build in amber on tri-blades with the violet glow, as
   the author runs it, standing in the garage's showroom at four angles.
   They are what an illustrator, or an image model, is shown so that the
   car on the cover is this game's car and no real one.
   node game/test/brand/reference.js   writes brand/reference/studio-<angle>.png */
import path from 'node:path'; import fs from 'node:fs';
import * as R from '../garage/lib.js';
const out = path.join(R.root, 'brand', 'reference'); fs.mkdirSync(out, { recursive: true });
const env = await R.start();
const context = await env.browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.addInitScript(`(function () { window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {}; })();`);
await page.goto(env.url + '?renderer=webgl2&tier=high&adapt=0&title=1', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.evaluate(() => {
  try { localStorage.clear(); } catch (e) {}
  const L = window.__loop, S = L.save; S.reset(); S.setOnboarded();
  S.state.cars.driftbuild = { paint: 'amber', up: { power: 3, grip: 3, steer: 3 }, wheels: 'blades', glow: 'violet', smoke: 'standard', own: { wheels: ['blades'], glow: ['violet'], smoke: [] } };
  S.state.car = 'driftbuild';
  L.action('garage');
});
await R.runFrames(page, 5);
const ANGLES = { 'front-three-quarter': Math.PI * 0.82, 'side': Math.PI * 0.5, 'rear-three-quarter': Math.PI * 0.18, 'front': Math.PI * 1.0, 'front-other-side': Math.PI * 1.18 };
for (const [name, a] of Object.entries(ANGLES)) {
  await page.evaluate(a => { const s = window.__loop.showroom.state; s.angle = a; s.vel = 0; s.hold = 1e9; document.getElementById('ui').style.visibility = 'hidden'; }, a);
  await R.runFrames(page, 3);
  await page.waitForTimeout(400);
  const box = await page.evaluate(() => { const st = window.__loop.showroom.state.stage; return st ? { x: st.x || st.left || 0, y: st.y || st.top || 0, w: st.w || st.width, h: st.h || st.height } : null; });
  const file = path.join(out, 'studio-' + name + '.png');
  await page.screenshot(box && box.w ? { path: file, clip: { x: box.x, y: box.y, width: box.w, height: box.h } } : { path: file });
  console.log('wrote ' + path.relative(R.root, file) + ' ' + JSON.stringify(box));
}
await env.close();
