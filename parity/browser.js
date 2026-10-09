/* THE ORIGINAL, in a real browser. Serves vendor/original over http so
   localStorage behaves, loads one page per worker with the frame loop
   disarmed (requestAnimationFrame is a no-op before the script runs, so
   the probe is the only thing that ever advances the world), Math.random
   replaced by the same seeded generator the module gets, and the clock
   pinned to the job's day with Playwright's clock. The probe then drives
   the game's own top level functions and variables by name. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function findChromium() {
  if (process.env.PARITY_CHROMIUM) return process.env.PARITY_CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) {
    for (const d of fs.readdirSync(base)) {
      const p = path.join(base, d, 'chrome-linux', 'chrome');
      if (d.startsWith('chromium-') && fs.existsSync(p)) return p;
    }
  }
  return undefined;   // playwright's own download
}

export async function serveOriginal() {
  const files = {
    '/': [path.join(root, 'vendor', 'original', 'index.html'), 'text/html; charset=utf-8'],
    '/module/': [path.join(here, 'module-page.html'), 'text/html; charset=utf-8'],
    '/sim/drift-fever-sim.js': [path.join(root, 'sim', 'drift-fever-sim.js'), 'text/javascript; charset=utf-8'],
  };
  const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const f = files[u === '/index.html' ? '/' : u];
    if (!f) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': f[1], 'cache-control': 'no-store' });
    res.end(fs.readFileSync(f[0]));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, url: 'http://127.0.0.1:' + server.address().port + '/' };
}

const INIT = `
(function () {
  window.requestAnimationFrame = function () { return 0; };
  window.cancelAnimationFrame = function () {};
  let a = 1;
  window.__seedRandom = function (k) { a = k >>> 0; };
  Math.random = function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

const ADAPTER = `
(function () {
  const g = new Map(), s = new Map();
  window.__S = {
    get: function (n) { let f = g.get(n); if (!f) { f = new Function('return ' + n); g.set(n, f); } return f(); },
    set: function (n, v) { let f = s.get(n); if (!f) { f = new Function('v', n + ' = v'); s.set(n, f); } f(v); },
    fn: new Proxy({}, { get: function (t, n) { try { return (0, eval)(n); } catch (e) { return undefined; } } }),
    seedRandom: function (k) { window.__seedRandom(k); }
  };
  /* The frame loop is rebound to nothing. requestAnimationFrame was stubbed
     before the script ran, but Playwright's clock installs its own, so the
     loop has to be cut at the function as well. The callback already in
     flight resolves the global name and finds this. */
  frame = function () {};
})();`;

export async function openBrowser(opts) {
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
  return browser;
}

/* One worker: a fresh context (fresh storage), one page, the probe injected,
   its jobs run day by day with the clock pinned to each. */
export async function runWorkerJobs(browser, url, jobs, opts) {
  const original = opts.side !== 'module';
  const context = await browser.newContext({ viewport: opts.viewport, timezoneId: opts.timezoneId, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('console: ' + m.text()); });
  const setDay = original
    ? async day => { const y = Math.floor(day / 10000), m = Math.floor(day / 100) % 100, d = day % 100; await page.clock.setFixedTime(new Date(y, m - 1, d, 12, 0, 0, 0)); }
    : async day => { await page.evaluate(d => window.__setDay(d), day); };
  if (original) {
    /* The clock first, then the stub: Playwright's clock installs its own
       requestAnimationFrame as an init script of its own, and the stub has
       to land after it or the first frames run before the probe gets in. */
    await setDay(jobs[0].day);
    await page.addInitScript(INIT);
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(ADAPTER);
  } else {
    await page.goto(url + 'module/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true);
    await setDay(jobs[0].day);
  }
  await page.addScriptTag({ content: fs.readFileSync(path.join(here, 'tapes.cjs'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(here, 'probe.cjs'), 'utf8') });
  const info = await page.evaluate(() => ({ ua: navigator.userAgent, w: innerWidth, h: innerHeight,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone, probe: window.parityProbe.VERSION, state: window.__S.get('state'),
    commit: window.__commit || null }));
  if (original) {
    /* The loop must be dead: the probe is the only thing that may advance
       the world. titleTime is the one clock that runs on the title screen. */
    const t0 = await page.evaluate(() => window.__S.get('titleTime'));
    await page.waitForTimeout(250);
    const t1 = await page.evaluate(() => window.__S.get('titleTime'));
    info.frameLoopStopped = t0 === t1 && t1 === 0;
    info.titleTimeAtStart = t1;
  }
  const results = [];
  let day = null;
  for (const job of jobs) {
    if (job.day !== day) { await setDay(job.day); day = job.day; }
    const r = await page.evaluate(j => window.parityProbe.runJob(window.__S, j), job);
    results.push(r);
  }
  const extra = {};
  if (!original) { extra.hookCalls = await page.evaluate(() => window.__hookCalls); extra.names = await page.evaluate(() => window.__names); }
  if (opts.auditNames) extra.present = await page.evaluate(names => names.filter(n => { try { window.__S.get(n); return true; } catch (e) { return false; } }), opts.auditNames);
  await context.close();
  return { results, errors, info, ...extra };
}
