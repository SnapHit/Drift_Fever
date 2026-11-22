/* THE BENCH WITH THE LOOK (briefs/COVER-LOOK.md, "When done": the author
   is asked to run ?bench=1&adapt=0&look=2 and ?bench=1&adapt=0 on his
   desktop and his phone). The bench must run to its end with the look
   on: both tiers measured (a tier change rebuilds the world, its
   environment and the look's post pass), the save untouched, no error
   on the page. Its frame rates here mean nothing (software drawing);
   the draw calls and the game's own work per frame it shows are read,
   beside the same bench without the switch.

   node game/test/look/bench.js   writes review/look/bench.json */
import path from 'node:path';
import * as L from './lib.js';

const VP = { width: 640, height: 360 };
async function bench(env, query) {
  const pg = await L.openPage(env, VP, 'bench=1&adapt=0' + query, { liveLoop: true });
  const page = pg.page;
  const before = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  await page.waitForFunction(() => window.__bench && window.__bench.done, null, { timeout: 560000, polling: 1000 });
  const res = await page.evaluate(() => ({ bench: window.__bench, text: document.getElementById('bench').innerText }));
  const after = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  await page.screenshot({ path: path.join(L.lookShots, 'bench' + (query ? '-look' : '') + '.png') });
  const out = { tiers: res.bench.tiers.map(t => ({ tier: t.tier, drawCalls: t.drawCalls, triangles: t.triangles, workMs: t.workMs, fps: t.fps, frames: t.frames })), saveUnchanged: before === after, errors: pg.errors.slice(0, 5) };
  await pg.close();
  return out;
}
const env = await L.start();
const look = await bench(env, '&look=2'), main = await bench(env, '');
L.say(look.tiers.length === 2 && look.saveUnchanged && !look.errors.length, 'the bench with ?look=2 ran to its end: ' + look.tiers.map(t => t.tier).join(' and ') + ' measured, the save ' + (look.saveUnchanged ? 'untouched' : 'CHANGED') + ', ' + look.errors.length + ' page errors' + (look.errors.length ? ': ' + look.errors[0] : ''));
for (const t of look.tiers) { const m = main.tiers.find(x => x.tier === t.tier) || {}; console.log('INFO ' + t.tier + ' tier: draw calls ' + m.drawCalls + ' without the switch, ' + t.drawCalls + ' with it; the game\'s work ' + m.workMs + ' and ' + t.workMs + ' ms a frame (software drawing: the frame rates mean nothing here)'); }
L.writeJson(path.join(L.lookDir, 'bench.json'), { look, main });
await env.close();
console.log(L.failed() ? L.failed() + ' failed' : 'all passed');
process.exit(L.failed() ? 1 : 0);
