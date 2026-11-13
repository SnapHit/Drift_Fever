/* CRAZYGAMES READINESS, the SDK adapter (14 November 2026).
   1. As the preview ships it (host web): not one request leaves the
      page's origin through a run and its results, their script is never
      asked for, and the adapter is off.
   2. As their package (host crazygames, their script answered here by a
      stand-in SDK that records its calls): gameplayStart when a run begins, gameplayStop at
      its results, gameplayStart again on the rematch, nothing twice. The
      one outside request is their script. This is also the known answer
      for 1: the same watch does see a request when one is made.
   3. Their SDK reporting "disabled", every call throwing: nothing is
      called and the game plays.
   4. Their script blocked: the adapter reads failed and the game plays.
   5. The package tool writes host crazygames and leaves the greybox out.
   node game/test/ready/sdk.js   (after npm run build) */
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as R from '../ladder/lib.js';
const URL_SDK = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const env = await R.start();
let fails = 0;
const ok = (name, pass, detail) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + name + ': ' + detail); };
const FAKE = envName => `window.__cg = [];
  window.CrazyGames = { SDK: { environment: '${envName}', init: () => new Promise(r => setTimeout(r, 50)),
    game: Object.fromEntries(['loadingStart', 'loadingStop', 'gameplayStart', 'gameplayStop'].map(n => [n, () => { if ('${envName}' === 'disabled') throw { code: 'sdkDisabled' }; window.__cg.push(n); }])) } };`;
async function open(host, script) {
  const context = await env.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage(), outside = [], errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (!r.url().startsWith(env.url) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) outside.push(r.url()); });
  await page.route(URL_SDK, r => script === null ? r.abort() : r.fulfill({ contentType: 'application/javascript', body: script }));
  await page.addInitScript(`window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {};` + (host ? `window.__sdkHost = '${host}';` : ''));
  await page.goto(env.url + '?renderer=webgl2&title=1', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const S = window.__loop.save; S.reset(); S.setOnboarded(); window.__loop.action('title'); window.__feel.draw = false; });
  await R.runFrames(page, 5);
  const log = [];
  const snap = async what => log.push(what + ': ' + (await page.evaluate(() => (window.__cg || []).join(' ')) || '-'));
  await snap('title');
  await page.evaluate(() => { const L = window.__loop; L.startRun(L.battleSpec('r1')); });
  await R.runFrames(page, 10); await snap('run');
  await page.evaluate(() => { window.__loop.skipCountdown(); }); await R.runFrames(page, 60);
  await page.evaluate(() => window.__loop.finishNow()); await R.runFrames(page, 40); await snap('results');
  await page.evaluate(() => window.__loop.action('again')); await R.runFrames(page, 10); await snap('rematch');
  await page.evaluate(() => window.__loop.action('title')); await R.runFrames(page, 10); await snap('menu');
  const st = await page.evaluate(() => ({ ...window.__feel.sdk.state }));
  const playing = await page.evaluate(() => window.__loop.app.state);
  await context.close();
  return { outside, errors, log, st, playing };
}
const web = await open(null, FAKE('crazygames'));
ok('the preview build makes no outside request and never asks for their script', web.outside.length === 0 && web.st.state === 'off' && web.errors.length === 0, 'outside ' + web.outside.length + ', adapter ' + web.st.state + ', errors ' + web.errors.length);
const cg = await open('crazygames', FAKE('crazygames'));
const want = ['title: -', 'run: gameplayStart', 'results: gameplayStart gameplayStop', 'rematch: gameplayStart gameplayStop gameplayStart', 'menu: gameplayStart gameplayStop gameplayStart gameplayStop'];
ok('as their package: gameplay start and stop with each run, nothing twice', JSON.stringify(cg.log) === JSON.stringify(want) && cg.st.state === 'ready' && cg.errors.length === 0, cg.log[cg.log.length - 1] + '; adapter ' + cg.st.state + ' in ' + cg.st.environment);
ok('as their package the one outside request is their script (and the watch can see one: the known answer for the first check)', cg.outside.length === 1 && cg.outside[0] === URL_SDK, cg.outside.join(' ') || 'none');
const off = await open('crazygames', FAKE('disabled'));
ok('their SDK disabled and throwing: nothing called, the game plays', off.log.every(l => l.endsWith('-')) && off.st.state === 'disabled' && off.errors.length === 0 && off.playing === 'title', 'adapter ' + off.st.state + ', errors ' + off.errors.length + ', ' + off.log[2]);
const blocked = await open('crazygames', null);
ok('their script blocked: the adapter reads failed, the game plays', blocked.st.state === 'failed' && blocked.errors.length === 0 && blocked.playing === 'title', 'adapter ' + blocked.st.state + ' (' + blocked.st.error + '), errors ' + blocked.errors.length);
await env.close();
/* the package */
try {
  const said = execFileSync('node', [path.join(R.root, 'tools', 'package-crazygames.js')], { encoding: 'utf8' }).trim();
  const out = path.join(R.root, 'dist-crazygames'), host = fs.readFileSync(path.join(out, 'src', 'sdk', 'host.js'), 'utf8'), src = fs.readFileSync(path.join(R.root, 'game', 'src', 'sdk', 'host.js'), 'utf8');
  ok('the package says host crazygames, the source still says web, and the greybox, status and lab pages are left out', /HOST = 'crazygames'/.test(host) && /HOST = 'web'/.test(src) && !fs.existsSync(path.join(out, 'greybox')) && !fs.existsSync(path.join(out, 'status')) && !fs.existsSync(path.join(out, 'lab')) && fs.existsSync(path.join(out, 'index.html')), said);
} catch (e) { ok('the package tool runs', false, String(e.message).slice(0, 200)); }
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
