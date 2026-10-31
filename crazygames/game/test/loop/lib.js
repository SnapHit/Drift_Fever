/* SHARED BY THE LOOP PROBES. The feel probes' harness (headless
   Chromium through the dev server, the frame loop stubbed, the page
   advanced by window.__feel.frame with a synthetic 60 Hz clock), plus
   the moves a run needs: start a mode, get through the countdown, drive
   until the results screen, read the save. */
import path from 'node:path';
import * as F from '../feel/lib.js';

export const { start, openPage, runFrames, stat, writeJson, PORTRAIT, LANDSCAPE, root } = F;
export const reviewDir = path.join(F.root, 'review', 'loop');

/* What a frame collects in the page. */
export const COLLECT = `
  const A = window.__loop.app, w = window.__feel.world, c = w.car, p = window.__loop.progress();
  return { i, state: A.state, t: +A.runTime.toFixed(3), along: +w.along.toFixed(2), x: c.x, z: c.z, yaw: c.yaw, step: w.step, hits: w.hits, hard: w.hardHits, resp: w.respawned ? 1 : 0,
    angle: +(Math.abs(c.slip) * 180 / Math.PI).toFixed(2), v: +c.speed.toFixed(2), score: window.__feel.scoring.state.total, chain: +window.__feel.scoring.state.chain.toFixed(1),
    lap: p ? p.lap : -1, cp: p ? p.nextCp : -1, finished: p ? p.finished : false, ms: +window.__feel.info().frameMs.toFixed(3), phys: +window.__feel.info().physMs.toFixed(3), submit: +window.__feel.scene.info().submitMs.toFixed(3), steps: window.__feel.info().steps,
    ghost: window.__loop.ghostState() };
`;

/* Start a run by action (or by spec through startRun) with the scripted
   driver, run the countdown out, and return once the state is drive. */
export async function beginRun(page, how, arg, driverOpts) {
  await page.evaluate(({ how, arg, driverOpts }) => {
    const Lp = window.__loop; window.__feel.draw = false; window.__clock = 1000;
    if (how === 'career') Lp.startRun(Lp.careerSpec(+arg));
    else if (how === 'daily') Lp.startRun(Lp.dailySpec());
    else Lp.action(how, arg);
    if (driverOpts !== null) window.__feel.setDriver(driverOpts);
  }, { how, arg: arg === undefined ? null : arg, driverOpts: driverOpts === undefined ? { drift: '*' } : driverOpts });
  const frames = await runFrames(page, 240, 'return window.__loop.app.state;');
  const i = frames.indexOf('drive');
  if (i < 0) throw new Error('the countdown did not end: ' + frames[frames.length - 1]);
  return i;
}

/* Drive frames in chunks until the results screen or maxFrames; every
   frame collected. */
export async function driveToResults(page, maxFrames) {
  const frames = [];
  const chunk = 240;
  for (let done = 0; done < maxFrames; done += chunk) {
    const part = await runFrames(page, Math.min(chunk, maxFrames - done), COLLECT);
    frames.push(...part);
    if (part[part.length - 1].state === 'results') break;
  }
  const results = await page.evaluate(() => window.__loop.results());
  const screen = await page.evaluate(() => { const s = document.querySelector('#screens.on .screen.results'); return s ? { shown: true, score: s.querySelector('.score .n').textContent, stars: s.querySelectorAll('.stars .on').length } : { shown: false }; });
  return { frames, results, screen, finished: frames.length && frames[frames.length - 1].state === 'results' };
}

export const saveState = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__loop.save.state)));
export const saveStatus = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__loop.save.status)));
