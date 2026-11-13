/* GARAGE MEASURE 7: FRAME COST. JavaScript time per frame, measured as
   the spectacle round measured it (game/test/spectacle/perf.js): forced
   WebGL 2 on the sandbox's software renderer, 390x844, 6x CPU throttle,
   the scripted drifter on career 1 at night with the chain held at x5,
   300 frames with the first 30 apart, and "JS without submit" (the
   frame less renderer.render, which here is the whole software
   rasterisation and says nothing about a GPU).

   The same race, the same frames, with: nothing; each cosmetic alone;
   all three. On the low tier (the cheap glow) and the high (the soft
   glow), with the draw calls and triangles of each.

   THE BAR: the low tier's p95 with all three on stays under 16.7 ms,
   and no more than SLACK over the same race without them (run to run,
   the same race differs by about that much: the two plain runs say how
   much).
   Known answers: 20 ms of busy work per frame fails the budget, and
   3 ms of busy work per frame shows as a cost over the plain race.

   node game/test/garage/perf.js [low|high|known]   writes review/garage/perf-<part>.json */
import path from 'node:path';
import fs from 'node:fs';
import * as G from './lib.js';

const part = process.argv[2] || 'low', FRAMES = 300, WARM = 30, BUDGET = 16.7, SLACK = 1.5;
const env = await G.start(), out = { part, budgetMs: BUDGET, slackMs: SLACK, note: 'headless Chromium, forced WebGL 2 on SwiftShader, 390x844, 6x CPU throttle through CDP; the GPU is not measured here', runs: [] };

async function measure(o) {
  const pg = await G.page(env, G.PORTRAIT, 'tier=' + o.tier + '&preset=night', { touch: true }), p = pg.page;
  await G.wear(p, o.look);
  await G.careerRun(p, 0);
  await G.seedRandom(p, 7);
  await G.until(p, "f.state==='drive'", 400);
  await G.runFrames(p, 60 * 8);
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
      if (busy) { const b0 = performance.now(); while (performance.now() - b0 < busy) { /* busy */ } }
      const ms = performance.now() - t0, info = F.scene.info();
      rows.push({ ms, js: ms - info.submitMs, draw: info.drawCalls, tris: info.triangles, state: window.__loop.app.state });
    }
    return rows;
  }, { n: FRAMES, busy: o.busy || 0 });
  const info = await p.evaluate(() => { const sc = window.__feel.scene, m = sc.carModel(); return { ...sc.info(), looks: sc.looks.car, glow: m.underglow.visible, glowTris: m.underglow.geometry.attributes.position.count / 3, smoke: sc.effects().pools.smoke.live() }; });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await pg.close();
  const body = frames.slice(WARM);
  const r = { label: o.label, tier: o.tier, look: o.look || {}, busy: o.busy || 0, driving: body.filter(f => f.state === 'drive').length, preset: info.preset, js: G.stat(body.map(f => f.js)), drawCalls: G.stat(body.map(f => f.draw)), triangles: G.stat(body.map(f => f.tris)), glowTriangles: info.glow ? info.glowTris : 0, smokeAtEnd: info.smoke, errors: pg.errors.slice(0, 3) };
  console.log('  ' + r.label + ': JS without submit median ' + r.js.p50 + ' ms, p95 ' + r.js.p95 + ', worst ' + r.js.worst + '; draw calls ' + r.drawCalls.p50 + ', triangles ' + r.triangles.p50 + (r.glowTriangles ? ', the glow ' + r.glowTriangles + ' of them' : '') + ' (' + r.preset + ', ' + r.driving + ' of ' + body.length + ' frames driving)');
  out.runs.push(r);
  return r;
}
const ALL = { wheels: 'blades', glow: 'aqua', smoke: 'rose' };
if (part === 'known') {
  const plain = await measure({ label: 'low, plain', tier: 'low' });
  const three = await measure({ label: 'known answer: 3 ms of busy work per frame', tier: 'low', busy: 3 });
  const twenty = await measure({ label: 'known answer: 20 ms of busy work per frame', tier: 'low', busy: 20 });
  G.say(twenty.js.p95 >= BUDGET, 'known answer: 20 ms of busy work per frame fails the budget: p95 ' + twenty.js.p95 + ' ms: ' + (twenty.js.p95 >= BUDGET ? 'CAUGHT' : 'MISSED'));
  G.say(three.js.p50 - plain.js.p50 > SLACK, 'known answer: 3 ms of busy work per frame shows as a cost: median ' + plain.js.p50 + ' -> ' + three.js.p50 + ' ms (over the ' + SLACK + ' ms slack): ' + (three.js.p50 - plain.js.p50 > SLACK ? 'CAUGHT' : 'MISSED'));
} else {
  const tier = part === 'high' ? 'high' : 'low';
  /* a frame takes the software renderer about a second at 6x, so the high tier is measured plain and with all three only */
  const plain = await measure({ label: tier + ', no cosmetics', tier });
  const all = await measure({ label: tier + ', all three', tier, look: ALL });
  const wheels = tier === 'low' ? await measure({ label: tier + ', wheels (tri-blades)', tier, look: { wheels: 'blades' } }) : all;
  const glow = tier === 'low' ? await measure({ label: tier + ', glow (aqua)', tier, look: { glow: 'aqua' } }) : all;
  const smoke = tier === 'low' ? await measure({ label: tier + ', smoke (rose)', tier, look: { smoke: 'rose' } }) : all;
  const plain2 = await measure({ label: tier + ', no cosmetics, again', tier });
  const d = (a, b, k) => +(a.js[k] - b.js[k]).toFixed(2);
  out.cost = tier !== 'low' ? { runToRun: { p50: d(plain2, plain, 'p50'), p95: d(plain2, plain, 'p95') }, all: { p50: d(all, plain, 'p50'), p95: d(all, plain, 'p95'), triangles: all.triangles.p50 - plain.triangles.p50, drawCalls: all.drawCalls.p50 - plain.drawCalls.p50 } } : { runToRun: { p50: d(plain2, plain, 'p50'), p95: d(plain2, plain, 'p95') }, wheels: { p50: d(wheels, plain, 'p50'), p95: d(wheels, plain, 'p95'), triangles: wheels.triangles.p50 - plain.triangles.p50, drawCalls: wheels.drawCalls.p50 - plain.drawCalls.p50 }, glow: { p50: d(glow, plain, 'p50'), p95: d(glow, plain, 'p95'), triangles: glow.triangles.p50 - plain.triangles.p50, drawCalls: glow.drawCalls.p50 - plain.drawCalls.p50 }, smoke: { p50: d(smoke, plain, 'p50'), p95: d(smoke, plain, 'p95'), triangles: smoke.triangles.p50 - plain.triangles.p50, drawCalls: smoke.drawCalls.p50 - plain.drawCalls.p50 }, all: { p50: d(all, plain, 'p50'), p95: d(all, plain, 'p95'), triangles: all.triangles.p50 - plain.triangles.p50, drawCalls: all.drawCalls.p50 - plain.drawCalls.p50 } };
  console.log('  what each costs over the plain race (median ms, p95 ms, triangles, draw calls): ' + JSON.stringify(out.cost));
  const ok = all.js.p95 < BUDGET && all.js.p95 - Math.max(plain.js.p95, plain2.js.p95) <= SLACK && all.driving > 0 && !all.errors.length && all.glowTriangles > 0;
  if (tier === 'low') G.say(ok, 'low tier, all three cosmetics on at night: JavaScript p95 ' + all.js.p95 + ' ms, under ' + BUDGET + ' and within ' + SLACK + ' ms of the same race without them (' + plain.js.p95 + ' and ' + plain2.js.p95 + ' ms)');
  else console.log('  high tier, reported (the bar is the low tier\'s): all three p95 ' + all.js.p95 + ' ms against ' + plain.js.p95 + ' and ' + plain2.js.p95);
  G.say(tier === 'low' ? glow.glowTriangles === 10 : glow.glowTriangles > 100, tier + ' tier: the glow is the ' + (tier === 'low' ? 'cheap form, 10 triangles' : 'soft form') + ': ' + glow.glowTriangles + ' triangles, ' + (glow.drawCalls.p50 - plain.drawCalls.p50) + ' draw call more');
}
fs.writeFileSync(path.join(G.dir, 'perf-' + part + '.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(G.failed() ? G.failed() + ' failed' : 'all passed');
process.exit(G.failed() ? 1 : 0);
