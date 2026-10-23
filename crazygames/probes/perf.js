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

   Known answer: the same drive with a fixed 20 ms of busy work added
   inside the frame, through the simulation's own updateSmoke hook (called
   on every grounded frame). The median JavaScript time must rise by about
   20 ms and the budget verdict must flip to a fail.

   node probes/perf.js [--quick]   writes review/stage-2/perf.json */
import path from 'node:path';
import * as L from './lib.js';
import * as J from '../parity/jobs.js';

const quick = process.argv.includes('--quick');
const days = J.dayList(20261001, 28);
const env = await L.start();
const results = { started: new Date().toISOString(), note: 'headless Chromium, software WebGL 2 (SwiftShader); submit times are not a GPU measurement', runs: [] };
const drives = quick ? [[2, 'driver', 400]] : [[2, 'driver', 700], [5, 'hug', 600], [6, 'chaos', 500]];
async function measure(side, level, tape, frames, loadMs) {
  return side.page.evaluate(({ job, loadMs }) => {
    const S = window.__S;
    const total = [], scene = [], submit = [], js = [];
    const frameFn = S.fn.__frame;
    S.fn.__frame = t => { const t0 = performance.now(); frameFn(t); const dt = performance.now() - t0; const ms = S.world.info().ms; total.push(dt); scene.push(ms.scene); submit.push(ms.submit); js.push(dt - ms.submit); };
    /* the known answer's load: busy work inside the frame, outside the submission */
    const smoke = S.world.hooks.updateSmoke;
    let loaded = 0;
    if (loadMs) S.world.hooks.updateSmoke = (...a) => { const t0 = performance.now(); let guard = 0; while (performance.now() - t0 < loadMs && guard++ < 1e9) {} loaded++; return smoke(...a); };
    const d = window.driveProbe.drive(S, job, {});
    S.world.hooks.updateSmoke = smoke;
    S.fn.__frame = frameFn;
    const stat = a => { const s = a.slice().sort((x, y) => x - y); const p = q => s[Math.min(s.length - 1, Math.floor(s.length * q))]; return { n: s.length, p50: +p(0.5).toFixed(2), p95: +p(0.95).toFixed(2), p99: +p(0.99).toFixed(2), worst: +s[s.length - 1].toFixed(2), mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2) }; };
    // the first frames carry shader compiles and the first allocations; reported separately
    const warm = 30;
    return { frames: d.frames, events: d.events.length, loadedFrames: loaded, info: S.world.info(), frame: stat(total.slice(warm)), jsWithoutSubmit: stat(js.slice(warm)), sceneUpdate: stat(scene.slice(warm)), submit: stat(submit.slice(warm)), firstFrames: { worst: +Math.max(...total.slice(0, warm)).toFixed(2), mean: +(total.slice(0, warm).reduce((x, y) => x + y, 0) / warm).toFixed(2) } };
  }, { job: { day: days[0], level, mode: 'DAILY', seed: J.seedOf(days[0], level, tape), tape, maxFrames: frames }, loadMs: loadMs || 0 });
}
const line = (throttle, level, tape, r) => 'throttle ' + throttle + 'x L' + level + ' ' + tape + ': ' + r.frames + ' frames, frame p95 ' + r.frame.p95 + ' worst ' + r.frame.worst + ' ms; js without submit p50 ' + r.jsWithoutSubmit.p50 + ' p95 ' + r.jsWithoutSubmit.p95 + ' worst ' + r.jsWithoutSubmit.worst + '; scene update p95 ' + r.sceneUpdate.p95 + '; submit p95 ' + r.submit.p95 + ' worst ' + r.submit.worst + '; first ' + JSON.stringify(r.firstFrames) + '; backend ' + r.info.backend + ' tier ' + r.info.tier;
results.errors = [];
for (const throttle of (quick ? [1, 4] : [1, 4, 6])) {
  const side = await L.openSide(env, 'page-webgl2', J.VIEW, days[0]);
  const cdp = await side.context.newCDPSession(side.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  for (const [level, tape, frames] of drives) {
    const r = await measure(side, level, tape, frames, 0);
    results.runs.push({ throttle, level, tape, ...r });
    console.log(line(throttle, level, tape, r));
  }
  results.errors.push(...side.errors);
  await side.close();
}
/* The budget: 16.7 ms a frame. The low tier holds it in JavaScript if the
   p95 JavaScript frame (everything but the GPU submission) at the top
   throttle stays under it; the worst frame is reported beside it. The GPU
   half is unmeasured here. */
const BUDGET = 16.7;
const verdict = runs => Math.max(...runs.map(r => r.jsWithoutSubmit.p95)) < BUDGET;
const at6 = results.runs.filter(r => r.throttle === (quick ? 4 : 6));
results.summary = {
  budgetMs: BUDGET,
  jsWithoutSubmitWorstAtTopThrottle: Math.max(...at6.map(r => r.jsWithoutSubmit.worst)),
  jsWithoutSubmitP95AtTopThrottle: Math.max(...at6.map(r => r.jsWithoutSubmit.p95)),
  sceneUpdateP95AtTopThrottle: Math.max(...at6.map(r => r.sceneUpdate.p95)),
  frameP95AtTopThrottle: Math.max(...at6.map(r => r.frame.p95)),
  frameWorstAtTopThrottle: Math.max(...at6.map(r => r.frame.worst)),
};
results.summary.jsHoldsBudgetAtTopThrottle = verdict(at6);
/* The known answer: the first drive again at 1x, with and without 20 ms
   of busy work in the frame, on a fresh page each. */
{
  const LOAD = 20, [level, tape, frames] = drives[0];
  const runOnce = async (load) => { const side = await L.openSide(env, 'page-webgl2', J.VIEW, days[0]); const r = await measure(side, level, tape, frames, load); results.errors.push(...side.errors); await side.close(); return r; };
  const base = await runOnce(0), loaded = await runOnce(LOAD);
  const rise = +(loaded.jsWithoutSubmit.p50 - base.jsWithoutSubmit.p50).toFixed(2);
  results.knownAnswer = {
    loadMs: LOAD, level, tape, loadedFrames: loaded.loadedFrames, frames: loaded.frames,
    baseP50: base.jsWithoutSubmit.p50, loadedP50: loaded.jsWithoutSubmit.p50, riseP50: rise,
    baseP95: base.jsWithoutSubmit.p95, loadedP95: loaded.jsWithoutSubmit.p95,
    verdictWithoutLoad: verdict([base]), verdictWithLoad: verdict([loaded]),
  };
  results.knownAnswer.caught = rise >= LOAD * 0.9 && rise <= LOAD * 1.5 && results.knownAnswer.verdictWithLoad === false;
  console.log('known answer (' + LOAD + ' ms busy work in the frame): ' + JSON.stringify(results.knownAnswer));
}
await env.close();
results.finished = new Date().toISOString();
L.writeJson(path.join(L.root, 'review', 'stage-2', 'perf.json'), results);
console.log(JSON.stringify(results.summary));
process.exit(results.knownAnswer.caught ? 0 : 1);
