/* SHARED BY THE SPECTACLE PROBES. The loop probes' harness (headless
   Chromium through the dev server, the frame loop stubbed, the page
   advanced by window.__feel.frame at a synthetic 60 Hz), plus the moves
   this round's measurements need: a career run with the scripted
   drifter brought to a chosen moment (mid slide at a multiplier, a wall
   hit, the countdown, the finish, the results), a screenshot of it, and
   the pixels of a screenshot read back in the page. */
import path from 'node:path';
import fs from 'node:fs';
import * as L from '../loop/lib.js';

export const { start, openPage, runFrames, stat, writeJson, PORTRAIT, LANDSCAPE, root, COLLECT, beginRun, driveToResults } = L;
export const reviewDir = path.join(L.root, 'review', 'spectacle');
export const shotsDir = path.join(reviewDir, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });
export const SMALL = { width: 800, height: 450 };
export const PHONE_LANDSCAPE = { width: 844, height: 390 };
export const tagOf = vp => vp.width + 'x' + vp.height;

let failed = 0;
export function verdict(ok, text) { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); return ok; }
export const failures = () => failed;

/* A page with a clean save in which the first six career tracks are
   open (so the probe can start any of them) and the onboarding is done. */
export async function page(env, vp, query, opts) {
  const pg = await L.openPage(env, vp, (query || '') + '&title=1', opts);
  await pg.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const S = window.__loop.save; S.reset(); S.setOnboarded(); for (let i = 0; i < 23; i++) S.careerResult(i, 3, 100000); });
  return pg;
}

/* What a frame looks like to the probes: the state, the car, the score. */
export const MOMENT = `
  const A = window.__loop.app, w = window.__feel.world, c = w.car, s = window.__feel.scoring.state, p = window.__loop.progress();
  return { i, state: A.state, angle: Math.abs(c.slip) * 180 / Math.PI, v: c.speed, mult: s.mult, chain: s.chain, hit: w.hit ? w.hit.speed : 0, touching: !!w.touching, finished: p ? p.finished : false, step: w.step };
`;

/* Run frames (drawing off) until cond(frame) is true, in chunks; returns
   the frame or null. cond is a source string over f. */
export async function until(pg, cond, maxFrames, chunk) {
  const fn = new Function('f', 'return (' + cond + ');');
  for (let done = 0; done < maxFrames; done += chunk || 20) {
    const fr = await L.runFrames(pg, chunk || 20, MOMENT);
    for (const f of fr) if (fn(f)) return f;
    if (fr.length && fr[fr.length - 1].state === 'results' && !/results/.test(cond)) return null;
  }
  return null;
}
/* the same, a frame at a time, so the moment found is the frame drawn next */
export async function untilExact(pg, cond, maxFrames) {
  const fn = new Function('f', 'return (' + cond + ');');
  for (let k = 0; k < maxFrames; k += 1) {
    const [f] = await L.runFrames(pg, 1, MOMENT);
    if (fn(f)) return f;
    if (f.state === 'results' && !/results/.test(cond)) return null;
  }
  return null;
}

/* Start a career run with the scripted drifter, drawing off. */
export async function careerRun(pg, index, driver) {
  await pg.evaluate(({ index, driver }) => {
    const Lp = window.__loop; window.__feel.draw = false; window.__clock = 1000;
    Lp.startRun(Lp.careerSpec(index));
    if (driver !== null) window.__feel.setDriver(driver || { drift: '*' });
  }, { index, driver: driver === undefined ? { drift: '*' } : driver });
}

/* Draw one frame and take the screenshot. */
export async function shot(pg, file, frames) {
  await pg.evaluate(() => { window.__feel.draw = true; });
  await L.runFrames(pg, frames || 1);
  const png = await pg.screenshot({ path: file, timeout: 180000 });
  await pg.evaluate(() => { window.__feel.draw = false; });
  return png;
}

/* Read pixel luminances (0..1) off a PNG in the page: for every rect
   { x0, y0, x1, y1 }, the mean and the brightest. */
export async function readRects(pg, png, rects) {
  return pg.evaluate(async ({ png, rects }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + png; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    return rects.map(r => {
      let sum = 0, k = 0, max = 0;
      for (let y = Math.max(0, Math.round(r.y0)); y <= Math.min(c.height - 1, Math.round(r.y1)); y++) for (let x = Math.max(0, Math.round(r.x0)); x <= Math.min(c.width - 1, Math.round(r.x1)); x++) {
        const o = (y * c.width + x) * 4, l = (0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]) / 255;
        sum += l; k++; if (l > max) max = l;
      }
      return { mean: k ? sum / k : 0, max, n: k };
    });
  }, { png: png.toString('base64'), rects });
}

/* Two PNGs of the same size, compared in the page: the share of pixels
   whose channels differ by more than tol, and a mask of them is not
   kept. Used for "the same frame, with and without". */
export async function diffPngs(pg, a, b, tol) {
  return pg.evaluate(async ({ a, b, tol }) => {
    const load = async s => { const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + s; }); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const A = await load(a), B = await load(b);
    if (A.width !== B.width || A.height !== B.height) return { same: false, share: 1, note: 'sizes differ' };
    let n = 0;
    for (let i = 0; i < A.data.length; i += 4) if (Math.abs(A.data[i] - B.data[i]) > tol || Math.abs(A.data[i + 1] - B.data[i + 1]) > tol || Math.abs(A.data[i + 2] - B.data[i + 2]) > tol) n++;
    return { share: n / (A.width * A.height), pixels: n };
  }, { a: a.toString('base64'), b: b.toString('base64'), tol: tol || 0 });
}

/* Bring the run to a frame mid slide with the chain at multiplier mult
   (the scoring's drift clock is held at that multiplier's share, which
   only the probe does: the score of this run is not a real one), at
   least `held` frames into the slide. Returns the frame, or null. */
export async function slideAt(pg, mult, held, maxFrames) {
  return pg.evaluate(({ mult, held, maxFrames }) => {
    const F = window.__feel, s = F.scoring.state;
    let run = 0;
    for (let k = 0; k < (maxFrames || 60 * 90); k++) {
      window.__clock += 1000 / 60;
      if (s.chain > 0 && mult > 1) s.driftTime = Math.max(s.driftTime, (mult - 1) * 1.2 + 0.05);
      F.frame(window.__clock);
      const c = F.world.car, a = Math.abs(c.slip) * 180 / Math.PI;
      if (window.__loop.app.state !== 'drive') { run = 0; if (window.__loop.app.state === 'results') return null; continue; }
      run = a > 22 && c.speed > 12 ? run + 1 : 0;
      if (run >= held && a > 26) return { angle: a, v: c.speed, mult: s.mult, frame: k };
    }
    return null;
  }, { mult, held, maxFrames: maxFrames || 0 });
}
