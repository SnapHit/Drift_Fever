/* SHARED BY THE FEEL PROBES. Opens the game in headless Chromium through
   the dev server with the frame loop stubbed, so a probe advances the
   game by calling window.__feel.frame(t) with its own clock: two physics
   steps per 60 Hz frame, every time. The forced WebGL 2 path is the
   default here because the sandbox has no GPU; software rasterisation
   draws the frames, slowly, which is fine for everything but the frame
   time, and the perf probe says so. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveGame } from './serve.js';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..', '..', '..');
export const reviewDir = path.join(root, 'review', 'feel');

function findChromium() {
  if (process.env.FEEL_CHROMIUM) return process.env.FEEL_CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'chrome-linux', 'chrome'); if (d.startsWith('chromium-') && fs.existsSync(p)) return p; }
  return undefined;
}
const INIT = `(function () {
  window.requestAnimationFrame = function () { return 0; };
  window.cancelAnimationFrame = function () {};
})();`;

export async function start(opts) {
  const { server, url } = await serveGame();
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(opts && opts.args || [])] });
  return { server, url, browser, close: async () => { await browser.close(); server.close(); } };
}

export const PORTRAIT = { width: 390, height: 844 };
export const LANDSCAPE = { width: 1280, height: 720 };

/* One page. query: the query string without the ?, e.g. 'ground=track&renderer=webgl2'. */
export async function openPage(env, viewport, query, opts) {
  const context = await env.browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!(opts && opts.touch) });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (!(opts && opts.liveLoop)) await page.addInitScript(INIT);
  const q = 'renderer=webgl2' + (query ? '&' + query : '');
  await page.goto(env.url + '?' + q, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__ready === true || (document.getElementById('fail') && !document.getElementById('fail').hidden), null, { timeout: 120000 });
  const failed = await page.evaluate(() => { const f = document.getElementById('fail'); return f && !f.hidden ? f.textContent : null; });
  if (failed) throw new Error('page failed: ' + failed);
  return { page, context, errors, close: () => context.close() };
}

/* Advance n frames at 60 Hz from the page's clock, returning what fn
   collected per frame (fn runs in the page). */
export async function runFrames(page, n, fnSource, extra) {
  return page.evaluate(({ n, fnSource, extra }) => {
    const F = window.__feel;
    const fn = fnSource ? new Function('F', 'i', 'extra', fnSource) : null;
    if (window.__clock === undefined) window.__clock = 1000;
    const out = [];
    for (let i = 0; i < n; i++) {
      window.__clock += 1000 / 60;
      F.frame(window.__clock);
      if (fn) { const r = fn(F, i, extra); if (r !== undefined) out.push(r); }
    }
    return out;
  }, { n, fnSource: fnSource || null, extra: extra || null });
}

export function stat(values) {
  const s = values.slice().sort((a, b) => a - b);
  const p = q => s[Math.min(s.length - 1, Math.floor(s.length * q))];
  return { n: s.length, p50: +p(0.5).toFixed(2), p95: +p(0.95).toFixed(2), p99: +p(0.99).toFixed(2), worst: +s[s.length - 1].toFixed(2), mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2) };
}
export function writeJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 1)); }
