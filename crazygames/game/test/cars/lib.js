/* SHARED BY THE CAR PROBES. Opens the lab page (game/lab/cars.html) in
   headless Chromium through the feel prototype's dev server, on the
   forced WebGL 2 path (the sandbox has no GPU, so SwiftShader draws),
   with the controls hidden and the clock stopped (shot=1). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveGame } from '../feel/serve.js';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..', '..', '..');       // crazygames/
export const reviewDir = path.join(root, 'review', 'cars');

function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'chrome-linux', 'chrome'); if (d.startsWith('chromium-') && fs.existsSync(p)) return p; }
  return undefined;
}

export async function start() {
  const { server, url } = await serveGame();
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  return { server, url, browser, close: async () => { await browser.close(); server.close(); } };
}

export async function openLab(env, viewport, query) {
  const context = await env.browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const loaded = [];
  page.on('response', async r => { try { const b = await r.body(); loaded.push({ url: r.url(), bytes: b.length }); } catch (e) {} });
  await page.goto(env.url + 'lab/cars.html?renderer=webgl2&shot=1' + (query ? '&' + query : ''), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const failed = await page.evaluate(() => { const f = document.getElementById('fail'); return f && !f.hidden ? f.textContent : null; });
  if (failed) throw new Error('lab failed: ' + failed);
  return { page, context, errors, loaded, close: () => context.close() };
}

export const LANDSCAPE = { width: 1280, height: 720 };
export const PORTRAIT = { width: 390, height: 844 };
export function writeJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 1)); }
