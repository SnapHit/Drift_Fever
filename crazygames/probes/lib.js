/* SHARED BY THE PROBES. Opens the shipped page (or the original) the way
   the parity test does: a real browser, the frame loop stubbed so only the
   probe advances the world, Math.random seeded, the clock pinned to a day,
   and the parity tapes and probe injected so a drive here is the same
   drive the parity test makes. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveOriginal } from '../parity/browser.js';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
process.env.TZ = process.env.PARITY_TZ || 'Australia/Sydney';

function findChromium() {
  if (process.env.PARITY_CHROMIUM) return process.env.PARITY_CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'chrome-linux', 'chrome'); if (d.startsWith('chromium-') && fs.existsSync(p)) return p; }
  return undefined;
}
const INIT = `(function () {
  window.requestAnimationFrame = function () { return 0; };
  window.cancelAnimationFrame = function () {};
  let a = 1;
  window.__seedRandom = function (k) { a = k >>> 0; };
  Math.random = function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();`;
const ADAPTER = `(function () {
  const g = new Map(), s = new Map();
  window.__S = {
    get: function (n) { let f = g.get(n); if (!f) { f = new Function('return ' + n); g.set(n, f); } return f(); },
    set: function (n, v) { let f = s.get(n); if (!f) { f = new Function('v', n + ' = v'); s.set(n, f); } f(v); },
    fn: new Proxy({}, { get: function (t, n) { try { return (0, eval)(n); } catch (e) { return undefined; } } }),
    seedRandom: function (k) { window.__seedRandom(k); }
  };
  window.__frame = frame; frame = function () {};
  window.__S.fn.__frame = window.__frame;
})();`;

export async function start(opts) {
  const { server, url } = await serveOriginal();
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true, args: opts && opts.args || [] });
  return { server, url, browser, close: async () => { await browser.close(); server.close(); } };
}

export function dayDate(day) { return new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100, 12, 0, 0, 0); }

/* One page, one side, one viewport. Returns the page with the parity
   probe and tapes injected and window.__S live. */
export async function openSide(env, side, viewport, day, extraInit) {
  const context = await env.browser.newContext({ viewport, timezoneId: process.env.TZ, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.clock.setFixedTime(dayDate(day));
  await page.addInitScript(INIT);
  if (extraInit) await page.addInitScript(extraInit);
  if (side === 'original') await page.goto(env.url, { waitUntil: 'load' });
  else { await page.goto(env.url + 'page/' + (side === 'page-webgl2' ? '?renderer=webgl2' : ''), { waitUntil: 'load', timeout: 120000 }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }); }
  if (side === 'original') await page.evaluate(ADAPTER);
  await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'parity', 'tapes.cjs'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'parity', 'probe.cjs'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(here, 'drive-inpage.js'), 'utf8') });
  return { page, context, errors, close: () => context.close() };
}

export function pct(sorted, p) { if (!sorted.length) return null; const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p))); return sorted[i]; }
export function writeJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 1)); }
