/* SPECTACLE MEASURE 4: FRAME TIME. JavaScript time per frame at 6x CPU
   throttle on the low tier, on career 1 and on the longest Legend track,
   with the round on and with ?fx=0 (the game as on main), measured the
   same way as the visuals probe (game/test/visuals/probes.js 3): forced
   WebGL 2, 390x844, the scripted drifter, 300 frames with the first 30
   apart, and "JS without submit", the frame less renderer.render, which
   on SwiftShader is the whole software rasterisation and says nothing
   about a GPU. The chain is held at x5 through the measured frames so
   the show is at its heaviest (the score is the probe's, not a run's).
   Also career 1 at night (the heaviest dressing) and the high tier, for
   the draw calls and triangles per tier against main.

   THE BAR: the low tier's p95 at 6x under 16.7 ms with the round on.
   Known answer: 20 ms of busy work in every frame must fail it.

   node game/test/spectacle/perf.js
   Writes review/spectacle/perf.json. */
import path from 'node:path';
import * as S from './lib.js';

const FRAMES = 300, WARM = 30, BUDGET = 16.7;
const env = await S.start();
const out = { budgetMs: BUDGET, note: 'headless Chromium, forced WebGL 2 on SwiftShader, 390x844, 6x CPU throttle through CDP; the GPU is not measured here', runs: [] };

async function measure(o) {
  const pg = await S.page(env, S.PORTRAIT, 'tier=' + o.tier + (o.fx === '0' ? '&fx=0' : '') + (o.preset ? '&preset=' + o.preset : ''), { touch: true });
  const p = pg.page;
  await S.careerRun(p, o.index);
  await S.until(p, "f.state==='drive'", 400);
  await S.runFrames(p, 60 * (o.into || 8));   // into the run, past the start
  const cdp = await pg.context.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: o.throttle || 6 });
  await p.evaluate(() => { window.__feel.draw = true; });
  const frames = await p.evaluate(({ n, busy }) => {
    const F = window.__feel, s = F.scoring.state, rows = [];
    for (let i = 0; i < n; i++) {
      window.__clock += 1000 / 60;
      if (s.chain > 0) s.driftTime = Math.max(s.driftTime, 4 * 1.2 + 0.05);
      const t0 = performance.now();
      F.frame(window.__clock);
      if (busy) { const b0 = performance.now(); while (performance.now() - b0 < busy) {} }
      const ms = performance.now() - t0, info = F.scene.info();
      rows.push({ ms, js: ms - info.submitMs, submit: info.submitMs, phys: F.info().physMs, draw: info.drawCalls, tris: info.triangles, state: window.__loop.app.state, mult: s.mult });
    }
    return rows;
  }, { n: FRAMES, busy: o.busy || 0 });
  const info = await p.evaluate(() => ({ ...window.__feel.scene.info(), live: window.__feel.scene.effects ? (() => { const e = window.__feel.scene.effects(); return e ? Object.fromEntries(Object.entries(e.pools).map(([k, v]) => [k, v.live()])) : null; })() : null }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await pg.close();
  const body = frames.slice(WARM);
  return { ...o, frames: frames.length, driving: body.filter(f => f.state === 'drive').length, preset: info.preset, theme: info.theme, bloom: info.bloom, jsWithoutSubmit: S.stat(body.map(f => f.js)), physics: S.stat(body.map(f => f.phys)), frame: S.stat(body.map(f => f.ms)), drawCalls: S.stat(body.map(f => f.draw)), triangles: S.stat(body.map(f => f.tris)), particlesAtEnd: info.live, errors: pg.errors.slice(0, 3) };
}
const show = r => console.log('  ' + r.label + ': JS without submit p95 ' + r.jsWithoutSubmit.p95 + ' ms, worst ' + r.jsWithoutSubmit.worst + ', median ' + r.jsWithoutSubmit.p50 + '; physics p95 ' + r.physics.p95 + '; draw calls ' + r.drawCalls.p50 + ' (worst ' + r.drawCalls.worst + '), triangles ' + r.triangles.p50 + ' (' + r.preset + ', ' + r.theme + ', ' + r.driving + ' of ' + (r.frames - WARM) + ' frames driving)');

const legend = 22;   // The vice, the longest Legend track by run metres (determinism.js finds it)
const plan = [
  { label: 'low, career 1, round on', tier: 'low', fx: 'on', index: 0 },
  { label: 'low, career 1, ?fx=0 (main)', tier: 'low', fx: '0', index: 0 },
  { label: 'low, longest Legend, round on', tier: 'low', fx: 'on', index: legend },
  { label: 'low, longest Legend, ?fx=0 (main)', tier: 'low', fx: '0', index: legend },
  { label: 'low, career 1 at night, round on', tier: 'low', fx: 'on', index: 0, preset: 'night' },
  { label: 'low, career 1 at night, ?fx=0 (main)', tier: 'low', fx: '0', index: 0, preset: 'night' },
  { label: 'high, career 1, round on', tier: 'high', fx: 'on', index: 0 },
  { label: 'high, career 1, ?fx=0 (main)', tier: 'high', fx: '0', index: 0 },
  { label: 'high, career 1 at night, round on', tier: 'high', fx: 'on', index: 0, preset: 'night' },
  { label: 'high, career 1 at night, ?fx=0 (main)', tier: 'high', fx: '0', index: 0, preset: 'night' },
];
for (const o of plan) { const r = await measure(o); out.runs.push(r); show(r); }
const lowOn = out.runs.filter(r => r.tier === 'low' && r.fx === 'on');
const worst = lowOn.reduce((a, b) => (b.jsWithoutSubmit.p95 > a.jsWithoutSubmit.p95 ? b : a));
S.verdict(lowOn.every(r => r.jsWithoutSubmit.p95 < BUDGET && r.driving > 0 && !r.errors.length), 'low tier, round on, JavaScript p95 at 6x under ' + BUDGET + ' ms on every run: worst ' + worst.jsWithoutSubmit.p95 + ' ms (' + worst.label + ')');
for (const r of lowOn) {
  const m = out.runs.find(q => q.tier === r.tier && q.fx === '0' && q.index === r.index && q.preset === r.preset);
  console.log('  against main: ' + r.label + ' p95 ' + m.jsWithoutSubmit.p95 + ' -> ' + r.jsWithoutSubmit.p95 + ' ms, draw calls ' + m.drawCalls.p50 + ' -> ' + r.drawCalls.p50 + ', triangles ' + m.triangles.p50 + ' -> ' + r.triangles.p50);
}
const loaded = await measure({ label: 'known answer: 20 ms of busy work per frame, low, career 1, round on', tier: 'low', fx: 'on', index: 0, busy: 20 });
show(loaded);
out.knownAnswer = { p95: loaded.jsWithoutSubmit.p95, caught: loaded.jsWithoutSubmit.p95 >= BUDGET };
S.verdict(out.knownAnswer.caught, 'known answer: 20 ms of busy work per frame fails the budget: p95 ' + loaded.jsWithoutSubmit.p95 + ' ms: ' + (out.knownAnswer.caught ? 'CAUGHT' : 'MISSED'));
out.runs.push(loaded);
S.writeJson(path.join(S.reviewDir, 'perf.json'), out);
await env.close();
console.log(S.failures() ? S.failures() + ' failed' : 'all passed');
process.exit(S.failures() ? 1 : 0);
