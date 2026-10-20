/* STAGE 2 "DONE" 4: THE LOW TIER FRAME BUDGET, measured as far as a
   sandbox can measure it.

   There is no Chromebook here and the headless browser's GPU is a software
   rasteriser, so the numbers that mean something are the JavaScript ones:
   the simulation and chrome per frame, the world's scene update, and the
   time the render submission takes on the main thread. Each is measured
   on the forced WebGL 2 path at 390x844 on the low tier, with the
   DevTools CPU throttle at 1x, 4x and 6x as a proxy for a five year old
   Chromebook, over the parity driver, hug and chaos tapes. p95 and the
   worst frame, never a median alone.

   What this does not tell us: the real GPU cost on a Chromebook's
   integrated GPU, and the real frame pacing. The ?debug=1 overlay on the
   shipped page shows backend, tier, fps and the worst frame for that.

   node probes/perf.js [--quick]   writes review/stage-2/perf.json */
import path from 'node:path';
import * as L from './lib.js';
import * as J from '../parity/jobs.js';

const quick = process.argv.includes('--quick');
const days = J.dayList(20261001, 28);
const env = await L.start();
const results = { started: new Date().toISOString(), note: 'headless Chromium, software WebGL 2 (SwiftShader); submit times are not a GPU measurement', runs: [] };
const drives = quick ? [[2, 'driver', 400]] : [[2, 'driver', 700], [5, 'hug', 600], [6, 'chaos', 500]];
for (const throttle of (quick ? [1, 4] : [1, 4, 6])) {
  const side = await L.openSide(env, 'page-webgl2', J.VIEW, days[0]);
  const cdp = await side.context.newCDPSession(side.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  for (const [level, tape, frames] of drives) {
    const r = await side.page.evaluate(({ job }) => {
      const S = window.__S;
      const total = [], scene = [], submit = [], js = [];
      const frameFn = S.fn.__frame;
      S.fn.__frame = t => { const t0 = performance.now(); frameFn(t); const dt = performance.now() - t0; const ms = S.world.info().ms; total.push(dt); scene.push(ms.scene); submit.push(ms.submit); js.push(dt - ms.submit); };
      const d = window.driveProbe.drive(S, job, {});
      S.fn.__frame = frameFn;
      const stat = a => { const s = a.slice().sort((x, y) => x - y); const p = q => s[Math.min(s.length - 1, Math.floor(s.length * q))]; return { n: s.length, p50: +p(0.5).toFixed(2), p95: +p(0.95).toFixed(2), p99: +p(0.99).toFixed(2), worst: +s[s.length - 1].toFixed(2), mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2) }; };
      // the first frames carry shader compiles and the first allocations; reported separately
      const warm = 30;
      return { frames: d.frames, events: d.events.length, info: S.world.info(), frame: stat(total.slice(warm)), jsWithoutSubmit: stat(js.slice(warm)), sceneUpdate: stat(scene.slice(warm)), submit: stat(submit.slice(warm)), firstFrames: { worst: +Math.max(...total.slice(0, warm)).toFixed(2), mean: +(total.slice(0, warm).reduce((x, y) => x + y, 0) / warm).toFixed(2) } };
    }, { job: { day: days[0], level, mode: 'DAILY', seed: J.seedOf(days[0], level, tape), tape, maxFrames: frames } });
    results.runs.push({ throttle, level, tape, ...r });
    console.log('throttle ' + throttle + 'x L' + level + ' ' + tape + ': ' + r.frames + ' frames, frame p95 ' + r.frame.p95 + ' worst ' + r.frame.worst + ' ms; js without submit p95 ' + r.jsWithoutSubmit.p95 + ' worst ' + r.jsWithoutSubmit.worst + '; scene update p95 ' + r.sceneUpdate.p95 + '; submit p95 ' + r.submit.p95 + ' worst ' + r.submit.worst + '; first ' + JSON.stringify(r.firstFrames) + '; backend ' + r.info.backend + ' tier ' + r.info.tier);
  }
  results.errors = side.errors;
  await side.close();
}
await env.close();
/* The budget: 16.7 ms a frame. The low tier holds it in JavaScript if the
   worst JavaScript frame at 6x stays under it; the GPU half is unmeasured. */
const at6 = results.runs.filter(r => r.throttle === (quick ? 4 : 6));
results.summary = {
  budgetMs: 16.7,
  jsWithoutSubmitWorstAtTopThrottle: Math.max(...at6.map(r => r.jsWithoutSubmit.worst)),
  jsWithoutSubmitP95AtTopThrottle: Math.max(...at6.map(r => r.jsWithoutSubmit.p95)),
  sceneUpdateP95AtTopThrottle: Math.max(...at6.map(r => r.sceneUpdate.p95)),
  frameP95AtTopThrottle: Math.max(...at6.map(r => r.frame.p95)),
  frameWorstAtTopThrottle: Math.max(...at6.map(r => r.frame.worst)),
};
results.summary.jsHoldsBudgetAtTopThrottle = results.summary.jsWithoutSubmitP95AtTopThrottle < results.summary.budgetMs;
results.finished = new Date().toISOString();
L.writeJson(path.join(L.root, 'review', 'stage-2', 'perf.json'), results);
console.log(JSON.stringify(results.summary));
