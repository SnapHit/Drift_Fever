/* RIVALS MEASURE 5: FRAME TIME. JavaScript time per frame at 6x CPU
   throttle on the low tier, measured as the spectacle and visuals probes
   do it (forced WebGL 2, 390x844, 300 frames with the first 30 apart,
   "JS without submit": the frame less renderer.render, which on
   SwiftShader is the whole software rasterisation and says nothing
   about a GPU): a battle against the first and the last rival, the chase
   driver following him so he is in view, against the same track solo
   with the scripted drifter. The player's chain is held at x5 as the
   spectacle probe holds it (the show at its heaviest); his own heat is
   his own. Draw calls and triangles per tier, with and without him.
   Physics p95 is reported apart: it now includes his world and his
   driver's look ahead.

   THE BAR: the low tier's p95 at 6x under 16.7 ms in a battle. Known
   answer: 20 ms of busy work per frame fails it.

   node game/test/rivals/perf.js [first last]   writes review/rivals/perf.json */
import path from 'node:path';
import * as R from './lib.js';

const FRAMES = 300, WARM = 30, BUDGET = 16.7;
const env = await R.start();
const out = { budgetMs: BUDGET, note: 'headless Chromium, forced WebGL 2 on SwiftShader, 390x844, 6x CPU throttle through CDP; the GPU is not measured here', runs: [] };
const args = process.argv.slice(2);
const first = args[0] || 'r1', last = args[1] || (await (async () => { const pg = await R.page(env, { width: 200, height: 200 }, ''); const id = await pg.page.evaluate(() => window.__loop.RIVALS[window.__loop.RIVALS.length - 1].id); await pg.close(); return id; })());

async function measure(o) {
  const pg = await R.page(env, R.PORTRAIT, 'tier=' + o.tier, { touch: true });
  const p = pg.page;
  const index = await p.evaluate(id => window.__loop.RIVALS.find(r => r.id === id).track, o.rival);
  if (o.battle) await R.battleRun(p, o.rival, o.driver || { chase: true }); else await R.careerRun(p, index);
  await R.until(p, "f.state==='drive'", 400);
  await R.runFrames(p, 60 * (o.into || 8));
  const cdp = await pg.context.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await p.evaluate(() => { window.__feel.draw = true; });
  const frames = await p.evaluate(({ n, busy }) => {
    const F = window.__feel, s = F.scoring.state, rows = [];
    for (let i = 0; i < n; i++) {
      window.__clock += 1000 / 60;
      if (s.chain > 0) s.driftTime = Math.max(s.driftTime, 4 * 1.2 + 0.05);
      const t0 = performance.now();
      F.frame(window.__clock);
      if (busy) { const b0 = performance.now(); while (performance.now() - b0 < busy) {} }
      const ms = performance.now() - t0, info = F.scene.info(), R = window.__loop.rival();
      rows.push({ ms, js: ms - info.submitMs, phys: F.info().physMs, draw: info.drawCalls, tris: info.triangles, state: window.__loop.app.state, inView: R ? window.__loop.tandem().gap < 40 : false });
    }
    return rows;
  }, { n: FRAMES, busy: o.busy || 0 });
  const info = await p.evaluate(() => window.__feel.scene.info());
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await pg.close();
  const body = frames.slice(WARM);
  return { ...o, index, frames: frames.length, driving: body.filter(f => f.state === 'drive').length, near: body.filter(f => f.inView).length, preset: info.preset, theme: info.theme, jsWithoutSubmit: R.stat(body.map(f => f.js)), physics: R.stat(body.map(f => f.phys)), drawCalls: R.stat(body.map(f => f.draw)), triangles: R.stat(body.map(f => f.tris)), errors: pg.errors.slice(0, 3) };
}
const show = r => console.log('  ' + r.label + ': JS p95 ' + r.jsWithoutSubmit.p95 + ' ms (worst ' + r.jsWithoutSubmit.worst + '), physics p95 ' + r.physics.p95 + ' ms, draw calls ' + r.drawCalls.p50 + ', triangles ' + r.triangles.p50 + ' (' + r.preset + '; ' + r.driving + ' frames driving, ' + (r.battle ? r.near + ' with him within 40 m' : 'solo') + ')');
const plan = [];
for (const rv of [first, last]) for (const tier of ['low', 'high']) for (const battle of [true, false]) plan.push({ label: tier + ', ' + (battle ? 'battle against ' + rv : 'the same track solo (' + rv + '\'s)'), tier, rival: rv, battle });
/* the chase driver runs the same look ahead as the rival: a battle with a cheap player (the scripted drifter), measured early while he is near, shows what a human player's battle costs */
plan.push({ label: 'low, battle against ' + first + ', the scripted drifter playing (no second look ahead)', tier: 'low', rival: first, battle: true, driver: { drift: '*' }, into: 2 });
for (const o of plan) { const r = await measure(o); out.runs.push(r); show(r); }
const lowB = out.runs.filter(r => r.tier === 'low' && r.battle && !r.driver);
const worst = lowB.reduce((a, b) => (b.jsWithoutSubmit.p95 > a.jsWithoutSubmit.p95 ? b : a));
R.verdict(lowB.every(r => r.jsWithoutSubmit.p95 < BUDGET && r.driving > 0 && r.near > 0 && !r.errors.length), 'low tier, a battle, JavaScript p95 at 6x under ' + BUDGET + ' ms: worst ' + worst.jsWithoutSubmit.p95 + ' ms (' + worst.label + ')');
for (const r of out.runs.filter(r => r.battle)) { const s = out.runs.find(q => !q.battle && q.tier === r.tier && q.rival === r.rival); console.log('  ' + r.label + ' against solo: JS p95 ' + s.jsWithoutSubmit.p95 + ' -> ' + r.jsWithoutSubmit.p95 + ' ms, physics p95 ' + s.physics.p95 + ' -> ' + r.physics.p95 + ', draw calls ' + s.drawCalls.p50 + ' -> ' + r.drawCalls.p50 + ', triangles ' + s.triangles.p50 + ' -> ' + r.triangles.p50); }
const loaded = await measure({ label: 'known answer: 20 ms of busy work per frame, low, battle against ' + first, tier: 'low', rival: first, battle: true, busy: 20 });
show(loaded);
out.knownAnswer = { p95: loaded.jsWithoutSubmit.p95, caught: loaded.jsWithoutSubmit.p95 >= BUDGET };
R.verdict(out.knownAnswer.caught, 'known answer: 20 ms of busy work per frame fails the budget: p95 ' + loaded.jsWithoutSubmit.p95 + ' ms: ' + (out.knownAnswer.caught ? 'CAUGHT' : 'MISSED'));
R.writeJson(path.join(R.rivalsDir, 'perf.json'), out);
await env.close();
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
