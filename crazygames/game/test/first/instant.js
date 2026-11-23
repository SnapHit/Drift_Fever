/* RULE 4, INSTANT (briefs/FIRST-MINUTE.md): the first frame is no later
   than main's, and nothing is fetched before the first tap that main does
   not fetch. Main (out of git) and this branch with ?first=2, each loaded
   cold LOADS times in turn (a fresh browser context each, so nothing is
   cached), as a phone at 390x844, on WebGL 2 and on WebGPU (game/test/
   webgpu/lib.js). Timed in the page from the start of navigation: the
   title's first paint (the boot draws it before the renderer is ready)
   and the first 3D frame (the game's first frame runs just before it
   says it is ready). Every request the page makes before any tap is
   listed. The page's own frames run (no stubbed frame loop), so the
   boot is the one a visitor gets.
   Bars: this branch's median first 3D frame no more than SLACK later
   than main's (loads in software vary by more than that between two of
   main's own: both spreads are reported), the title's paint likewise,
   and no request main does not make but the game's own new code (its
   new modules under src/, part of the initial download, which npm run
   build counts), each listed.
   Known answers: a page told to spend 2 s more before its first frame
   reads as later; a request added before the first tap is caught.

   node game/test/first/instant.js [--loads 5] [--backends webgl2,webgpu]   writes review/first/instant.json */
import path from 'node:path';
import * as F from './lib.js';
import { ARGS } from '../webgpu/lib.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const LOADS = +arg('--loads', 5), BACKENDS = arg('--backends', 'webgl2,webgpu').split(',');
const SLACK = 0.1;   // share of main's median the branch may be later by and still count as no later (the sandbox's loads vary more than this)
const WATCH = `(function () {
  const b = window.__instant = { title: null, ready: null };
  const look = () => {
    if (b.title === null) { const t = document.querySelector('#screens.on .screen.title'); if (t && t.getClientRects().length) b.title = performance.now(); }
    if (window.__ready === true) { b.ready = performance.now(); clearInterval(id); }
  };
  const id = setInterval(look, 2);   // not the frame loop: the WebGPU stand-in stubs it
})();`;
const SLOW = `(function () { const real = HTMLCanvasElement.prototype.getContext; let done = false; HTMLCanvasElement.prototype.getContext = function (k, o) { if (!done && (k === 'webgl2' || k === 'webgpu')) { done = true; const t = performance.now(); while (performance.now() - t < 2000) {} } return real.call(this, k, o); }; })();`;   // 2 s spent as the renderer asks for its canvas, before its first frame, on either backend: more than the slack and the spread of a load in software (on WebGL 2 here a load takes 6 to 7.5 s, and 400 ms went unseen)
const EXTRA = `window.addEventListener('load', () => { fetch('./assets/brand/snaphit-lockup.svg?extra=1').catch(() => {}); });`;

async function load(env, backend, query, extra) {
  const ctx = await env.browser.newContext({ viewport: F.PHONE, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage(), urls = [];
  page.on('request', r => urls.push(r.url().replace(env.url, '/').replace(/\?.*$/, m => /extra/.test(m) ? m : '')));
  if (backend === 'webgpu') await page.addInitScript(W_FAKE);
  await page.addInitScript(WATCH);
  if (extra) await page.addInitScript(extra);
  await page.goto(env.url + '?' + (backend === 'webgl2' ? 'renderer=webgl2&' : '') + query, { waitUntil: 'load', timeout: 120000 });
  let b = null;
  for (const end = Date.now() + 90000; Date.now() < end; await new Promise(r => setTimeout(r, 100))) { b = await page.evaluate(() => window.__instant).catch(() => null); if (b && b.ready !== null) break; }
  const got = await page.evaluate(() => window.__feel && window.__feel.scene.info().backend).catch(() => null);
  await new Promise(r => setTimeout(r, 500));   // anything the title asks for once it stands
  await ctx.close();
  return { title: b && b.title !== null ? Math.round(b.title) : null, ready: b && b.ready !== null ? Math.round(b.ready) : null, backend: got, urls: [...new Set(urls)].sort() };
}
let W_FAKE = null;
{ const W = await import('../webgpu/lib.js'); W_FAKE = W.FAKE; }

const med = a => { const s = a.filter(x => x !== null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const out = { loads: LOADS, slack: SLACK, main: F.mainCommit(), backends: {} };
for (const backend of BACKENDS) {
  const sides = { main: await F.side('main'), branch: await F.side('branch') };
  const envs = { main: await sides.main.R.start(backend === 'webgpu' ? { args: ARGS } : undefined), branch: await sides.branch.R.start(backend === 'webgpu' ? { args: ARGS } : undefined) };
  const res = { main: [], branch: [] };
  try {
    for (let k = 0; k < LOADS; k++) for (const side of ['main', 'branch']) res[side].push(await load(envs[side], backend, side === 'branch' ? 'first=2' : ''));
    const known = await load(envs.branch, backend, 'first=2', SLOW), extra = await load(envs.branch, backend, 'first=2', EXTRA);
    const a = { title: med(res.main.map(r => r.title)), ready: med(res.main.map(r => r.ready)), spread: [Math.min(...res.main.map(r => r.ready)), Math.max(...res.main.map(r => r.ready))] };
    const b = { title: med(res.branch.map(r => r.title)), ready: med(res.branch.map(r => r.ready)), spread: [Math.min(...res.branch.map(r => r.ready)), Math.max(...res.branch.map(r => r.ready))] };
    const mainUrls = new Set(res.main.flatMap(r => r.urls)), newer = [...new Set(res.branch.flatMap(r => r.urls))].filter(u => !mainUrls.has(u));
    const code = newer.filter(u => /^\/src\/.*\.js$/.test(u)), more = newer.filter(u => !code.includes(u));
    out.backends[backend] = { main: a, branch: b, more, code, runs: res, known: { ready: known.ready }, extra: extra.urls.filter(u => !mainUrls.has(u) && !/^\/src\/.*\.js$/.test(u)) };   // judged as the bar judges: the new code aside
    const bad = res.branch.concat(res.main).filter(r => r.backend !== backend).length;
    F.say(bad === 0, backend + ': every load drew on ' + backend + ' (' + bad + ' did not)');
    F.say(b.ready <= a.ready * (1 + SLACK) && b.title <= a.title * (1 + SLACK), backend + ': the first 3D frame at ' + b.ready + ' ms with ?first=2 against main\'s ' + a.ready + ' (medians of ' + LOADS + '; main ' + a.spread.join(' to ') + ', this branch ' + b.spread.join(' to ') + '), the title painted at ' + b.title + ' against ' + a.title + ': no later');
    F.say(more.length === 0, backend + ': nothing fetched before the first tap that main does not fetch (' + (more.join(', ') || 'none') + '; main ' + mainUrls.size + ' addresses) but the game\'s own new code, in the initial download: ' + (code.join(', ') || 'none'));
    F.say(known.ready > b.ready * (1 + SLACK), 'known answer, ' + backend + ': a page told to spend 2 s more before its first frame reads as later: ' + known.ready + ' ms against ' + b.ready + ' (' + (known.ready > b.ready * (1 + SLACK) ? 'CAUGHT' : 'MISSED') + ')');
    F.say(out.backends[backend].extra.length > 0, 'known answer, ' + backend + ': a request added before the first tap is caught (' + out.backends[backend].extra.join(', ') + ')');
  } finally { await envs.main.close(); await envs.branch.close(); }
}
F.writeJson(path.join(F.dir, 'instant.json'), out);
console.log(F.failed() ? F.failed() + ' failed' : 'all passed');
process.exit(F.failed() ? 1 : 0);
