/* THE BENCH (game/src/bench.js), 22 November 2026: ?bench=1 measures a
   heavy race on both tiers and shows the result; it must never write the
   save, show the first run's prompts or reach the race's line.
   Known answer: the same bench with 45 ms of extra work forced into every
   frame must report a frame rate well under the plain one, so the
   numbers measure the frames and not something else.
   The sandbox draws in software, so its own frame rates mean nothing
   about a real device; only the behaviour is checked here.
   node game/test/bench/check.js   writes review/bench/check.json */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../feel/lib.js';
const dir = path.join(R.root, 'review', 'bench'); fs.mkdirSync(dir, { recursive: true });
const env = await R.start(), out = {};
let fails = 0;
const ok = (name, pass, detail) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + name + ': ' + detail); };
const VP = { width: 640, height: 360 };

async function bench(label, busyMs) {
  const pg = await R.openPage(env, VP, 'bench=1&adapt=0', { liveLoop: true });
  const page = pg.page;
  if (busyMs) await page.evaluate(ms => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => raf(t => { const e = performance.now() + ms; while (performance.now() < e) {} cb(t); }); }, busyMs);
  const before = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  const early = await page.evaluate(() => ({ state: window.__loop.app.state, mode: window.__loop.app.spec && window.__loop.app.spec.mode, onboard: window.__loop.onboard.active, overlay: !!document.getElementById('bench') }));
  await page.waitForFunction(() => window.__bench && window.__bench.done, null, { timeout: 300000, polling: 1000 });
  const res = await page.evaluate(() => ({ bench: window.__bench, state: window.__loop.app.state, onboard: window.__loop.onboard.active, finished: !!(window.__loop.app.results), text: document.getElementById('bench').innerText, button: !!document.querySelector('#bench button') }));
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  await page.screenshot({ path: path.join(dir, label + '.png') });
  out[label] = { early, res, errors: pg.errors.slice(0, 5), saveUnchanged: before === after };
  await pg.context.close();
  return out[label];
}

const plain = await bench('plain', 0);
const t = plain.res.bench.tiers;
ok('the bench starts a race at once with no prompts', plain.early.mode === 'battle' && !plain.early.onboard && plain.early.overlay, JSON.stringify(plain.early));
ok('it measures both tiers, each with frames and a frame rate', t.length === 2 && t[0].tier !== t[1].tier && t.every(x => x.frames > 10 && x.fps > 0 && x.low1 > 0), t.map(x => x.tier + ' ' + x.backend + ' ' + x.frames + ' frames ' + x.fps + ' fps, 1% low ' + x.low1 + ', work ' + x.workMs + ' ms').join('; '));
ok('it ends stopped, short of the line, with the result and a copy button on screen', plain.res.state === 'bench' && !plain.res.finished && /fps/.test(plain.res.text) && plain.res.button, plain.res.state + ', finished ' + plain.res.finished);
ok('the save is not written', plain.saveUnchanged, 'localStorage before and after the bench ' + (plain.saveUnchanged ? 'identical' : 'DIFFERENT'));
ok('no page errors', plain.errors.length === 0, plain.errors.join(' | ') || 'none');
const busy = await bench('busy', 45);
const fp = plain.res.bench.tiers[0].fps, fb = busy.res.bench.tiers[0].fps;
ok('known answer: 45 ms forced into every frame shows as a lower frame rate', fb > 0 && fb <= Math.min(22, fp * 0.8), 'plain ' + fp + ' fps, busy ' + fb + ' fps on the ' + busy.res.bench.tiers[0].tier + ' tier');
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(fails ? fails + ' failed' : 'all passed');
