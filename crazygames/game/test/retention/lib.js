/* SHARED BY THE RETENTION PROBES. The loop probes' harness (headless
   Chromium through the dev server, the frame loop stubbed, the page
   advanced by window.__feel.frame at a synthetic 60 Hz), plus a page
   opener that clears the save before the game loads (a first visit) and
   counts real clicks on the page. */
import path from 'node:path';
import * as L from '../loop/lib.js';

export const { start, runFrames, stat, writeJson, PORTRAIT, LANDSCAPE, root, COLLECT, beginRun, driveToResults, saveState, saveStatus } = L;
export const reviewDir = path.join(L.root, 'review', 'retention');
export const SMALL = { width: 800, height: 450 };          // CrazyGames' smallest 16:9 frame
export const PHONE_LANDSCAPE = { width: 844, height: 390 };

const INIT = `(function () {
  window.requestAnimationFrame = function () { return 0; };
  window.cancelAnimationFrame = function () {};
})();`;

/* A page. opts.firstVisit clears localStorage before the game loads;
   opts.touch gives the context a touch screen; opts.query adds to the
   query string. Every real click on the page is counted in
   window.__clicks, so a probe can say how many it took to reach
   gameplay. */
export async function openPage(env, viewport, opts) {
  const o = opts || {};
  const context = await env.browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!o.touch });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  /* a first visit clears the save once per tab (the init script runs on every load, a reload included) */
  await page.addInitScript(INIT + (o.firstVisit ? `try { if (!sessionStorage.getItem('probe-cleared')) { localStorage.clear(); sessionStorage.setItem('probe-cleared', '1'); } } catch (e) {}` : '') + `window.__clicks = 0; window.addEventListener('click', function () { window.__clicks++; }, true);`);
  const q = 'renderer=webgl2' + (o.query ? '&' + o.query : '');
  await page.goto(env.url + '?' + q, { waitUntil: 'load', timeout: 120000 });
  await waitReady(page);
  return { page, context, errors, close: () => context.close() };
}

export async function waitReady(page) {
  await page.waitForFunction(() => window.__ready === true || (document.getElementById('fail') && !document.getElementById('fail').hidden), null, { timeout: 120000 });
  const failed = await page.evaluate(() => { const f = document.getElementById('fail'); return f && !f.hidden ? f.textContent : null; });
  if (failed) throw new Error('page failed: ' + failed);
}

/* Reload the page as the same device (the save kept) and wait for it. */
export async function reload(page) {
  await page.reload({ waitUntil: 'load', timeout: 120000 });
  await waitReady(page);
}

/* Run frames until the car moves faster than 1 m/s or the budget runs
   out; returns the frame it moved on, or -1. */
export async function framesUntilMoving(page, budget) {
  const frames = await runFrames(page, budget, 'return +window.__feel.world.car.speed.toFixed(2);');
  return frames.findIndex(v => v > 1);
}

export const clicks = page => page.evaluate(() => window.__clicks);
export const onboardState = page => page.evaluate(() => { const o = window.__loop.onboard; return { active: o.active, visible: o.visible(), step: o.state.step, shown: o.state.shown.slice(), done: { ...o.state.done }, skipped: o.state.skipped, skipShown: !document.getElementById('skip').hidden && !o.el.hidden }; });
