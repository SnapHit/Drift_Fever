/* STAGE 2 "DONE" 2: WHAT THE PLAYER SEES IS WHAT THE SIMULATION DECIDES.

   Drives the shipped page with the parity tapes, and on every sampled
   frame compares what the renderer drew (car meshes, road vertex buffer,
   hazard and gate quads) with the simulation's numbers: the car and the
   racers against the drawn road edges in half widths and in pixels, the
   car's height above the drawn road against carY, off road deaths, hits,
   contacts, gates and ramps. Worst case and count, never a median.

   Known answer: the drawn car is shifted sideways by a share of the half
   width (world.probe.setOffset) and the same checks must fail.

   node probes/screen.js [--quick]   writes review/stage-2/screen.json */
import path from 'node:path';
import * as L from './lib.js';
import * as J from '../parity/jobs.js';

const quick = process.argv.includes('--quick');
const days = J.dayList(20261001, 28);
const env = await L.start();
const jobsFor = (viewport) => {
  const out = [];
  const plan = quick ? [[days[0], [2, 5], { driver: 500, hug: 400 }]] : [[days[0], J.LEVELS, { driver: 1000, hug: 800, chaos: 500 }], [days[1], J.LEVELS, { driver: 1000, hug: 800, chaos: 500 }]];
  for (const [day, levels, tapes] of plan) for (const level of levels) for (const tape in tapes) out.push({ day, level, mode: 'DAILY', seed: J.seedOf(day, level, tape), tape, maxFrames: tapes[tape], every: 2, viewport });
  return out;
};
const results = { viewports: {}, knownAnswer: null, started: new Date().toISOString() };
async function runSet(viewport, jobs, offset) {
  const side = await L.openSide(env, 'page', viewport, jobs[0].day);
  await side.page.addScriptTag({ path: path.join(L.here, 'screen-inpage.js') });
  const per = [];
  let day = null;
  for (const job of jobs) {
    if (job.day !== day) { await side.page.clock.setFixedTime(L.dayDate(job.day)); day = job.day; }
    const r = await side.page.evaluate(({ job, offset }) => {
      window.screenProbe.reset();
      window.__S.world.probe.setOffset(offset);
      const d = window.driveProbe.drive(window.__S, job, { frame: (n, S, info) => window.screenProbe.sample(n, info) });
      return { drive: d, summary: window.screenProbe.summary() };
    }, { job, offset });
    per.push({ job: { day: job.day, level: job.level, tape: job.tape, frames: r.drive.frames }, events: r.drive.events.length, summary: r.summary });
    process.stdout.write('  ' + viewport.width + 'x' + viewport.height + (offset ? ' (offset ' + offset + ')' : '') + ' L' + job.level + ' ' + job.day + ' ' + job.tape + ': ' + r.drive.frames + ' frames, ' + Object.values(r.summary.checks).reduce((s, c) => s + c.fail, 0) + ' check failures\n');
  }
  const errors = side.errors.slice();
  await side.close();
  return { per, errors };
}
/* Fold per drive summaries into worst case and counts. */
function fold(per) {
  const checks = {}, counts = {};
  let frames = 0; const fails = [];
  for (const p of per) {
    frames += p.summary.frames;
    for (const k in p.summary.checks) { const c = p.summary.checks[k]; const o = checks[k] = checks[k] || { n: 0, fail: 0, worst: 0, worstDrive: null, worstDetail: null }; o.n += c.n; o.fail += c.fail; if (c.worst > o.worst) { o.worst = c.worst; o.worstDrive = p.job; o.worstDetail = c.worstDetail; } }
    for (const k in p.summary.counts) counts[k] = (counts[k] || 0) + p.summary.counts[k];
    for (const f of p.summary.fails) if (fails.length < 60) fails.push('L' + p.job.level + ' ' + p.job.day + ' ' + p.job.tape + ': ' + f);
  }
  return { drives: per.length, frames, checks, counts, fails };
}
for (const viewport of [J.VIEW, J.VIEW_WIDE]) {
  const jobs = quick && viewport === J.VIEW_WIDE ? jobsFor(viewport).slice(0, 1) : (viewport === J.VIEW_WIDE ? jobsFor(viewport).filter(j => j.tape === 'driver' && j.day === days[0]) : jobsFor(viewport));
  const r = await runSet(viewport, jobs, 0);
  results.viewports[viewport.width + 'x' + viewport.height] = { ...fold(r.per), errors: r.errors };
}
/* The known answer: the same drive with the drawn car shifted by 0.05 of the half width. */
{
  const jobs = jobsFor(J.VIEW).filter(j => j.tape === 'driver').slice(0, 1).map(j => ({ ...j, maxFrames: 400 }));
  const r = await runSet(J.VIEW, jobs, 0.05);
  const f = fold(r.per);
  const wheel = f.checks['rear wheel vs road frame (units)'], centre = f.checks['car centre vs road frame (units)'], px = f.checks['rear wheel on screen vs the lips (px)'];
  results.knownAnswer = { offset: 0.05, caught: !!(wheel && wheel.fail > 0 && centre && centre.fail > 0 && px && px.fail > 0), wheelFails: wheel && wheel.fail, centreFails: centre && centre.fail, pxFails: px && px.fail, worstPx: px && px.worst, frames: f.frames };
}
await env.close();
const main = results.viewports['390x844'];
const anyFail = Object.values(results.viewports).some(v => Object.values(v.checks).some(c => c.fail > 0) || v.errors.length);
results.pass = !anyFail && results.knownAnswer.caught && Object.values(results.viewports).every(v => Object.keys(v.counts).every(k => !/ with | but |inside|clear|no drawn|not drawn/.test(k) || v.counts[k] === 0));
results.finished = new Date().toISOString();
L.writeJson(path.join(L.root, 'review', 'stage-2', 'screen.json'), results);
console.log('\nscreen agreement: ' + (results.pass ? 'PASS' : 'FAIL'));
for (const vp in results.viewports) {
  const v = results.viewports[vp];
  console.log(vp + ': ' + v.drives + ' drives, ' + v.frames + ' sampled frames, errors ' + v.errors.length);
  for (const k in v.checks) console.log('  ' + k.padEnd(62) + ' n ' + String(v.checks[k].n).padStart(6) + '  fail ' + String(v.checks[k].fail).padStart(4) + '  worst ' + v.checks[k].worst);
  console.log('  counts: ' + JSON.stringify(v.counts));
  for (const f of v.fails.slice(0, 8)) console.log('  FAIL ' + f);
}
console.log('known answer (drawn car offset 0.05 hw): ' + JSON.stringify(results.knownAnswer));
process.exit(results.pass ? 0 : 1);
