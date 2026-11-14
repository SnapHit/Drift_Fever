/* PLAYGROUND MEASURE 8: FRAME COST. JavaScript time per frame in the
   park at night mid slide, measured as the spectacle and garage rounds
   measured a race (forced WebGL 2 on the sandbox's software renderer,
   390x844, the low tier, 6x CPU throttle, 300 frames with the first 30
   apart, "JS without submit": the frame less renderer.render, which
   here is the software rasteriser and says nothing about a GPU),
   against a career run (track 1 at night, the scripted drifter with
   the chain held at x5, the same frames).

   In the park the car is brought into a slide round the donut pillar
   by the scripted hands and then held there by fixed inputs (the
   steering held into the slide, the throttle on), so the hands' own
   looking ahead is not in the measurement: the judge, the readout, the
   fading and the park's drawing are.

   THE BAR: three runs of each, turn about. Every park run's p95 is
   under 16.7 ms, and the middle one of the three is no more than SLACK
   over the middle one of the career's three, in p95 and in the median.
   The worst frame and the frames over the budget are reported for
   every run.
   Known answers: 20 ms of busy work per frame fails the budget, and
   3 ms of busy work per frame shows as a cost over the plain park.
   And the quality still adapts in the park: frames handed over with a
   slow device's gaps step it down to the last level; 900 frames at
   60 fps step nothing (the known answer).

   node game/test/park/perf.js [cost|known|adapt]   writes review/park/perf-<part>.json */
import * as P from './lib.js';

const part = process.argv[2] || 'cost', FRAMES = 300, WARM = 30, BUDGET = 16.7, SLACK = 1.5;
const env = await P.start(), out = { part, budgetMs: BUDGET, slackMs: SLACK, note: 'headless Chromium, forced WebGL 2 on SwiftShader, 390x844, low tier, night, 6x CPU throttle through CDP; the GPU is not measured here', runs: [] };

const TIMED = ({ n, busy, chain }) => {
  const F = window.__feel, s = F.scoring.state, rows = [];
  for (let i = 0; i < n; i++) {
    window.__clock += 1000 / 60;
    if (chain && s.chain > 0) s.driftTime = Math.max(s.driftTime, 4 * 1.2 + 0.05);
    const t0 = performance.now();
    F.frame(window.__clock);
    if (busy) { const b0 = performance.now(); while (performance.now() - b0 < busy) { /* busy */ } }
    const ms = performance.now() - t0, info = F.scene.info();
    rows.push({ ms, js: ms - info.submitMs, draw: info.drawCalls, tris: info.triangles, state: window.__loop.app.state, angle: Math.abs(F.world.car.slip) * 57.3, v: F.world.car.speed });
  }
  return rows;
};
async function timed(pg, label, o) {
  const p = pg.page, cdp = await pg.context.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await p.evaluate(() => { window.__feel.draw = true; });
  const frames = await p.evaluate(TIMED, { n: FRAMES, busy: o.busy || 0, chain: !!o.chain });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const body = frames.slice(WARM), info = await p.evaluate(() => window.__feel.scene.info());
  const r = { label, busy: o.busy || 0, state: body[body.length - 1].state, sliding: body.filter(f => f.angle >= 12 && f.v >= 6).length, of: body.length, preset: info.preset, tier: info.tier, js: P.stat(body.map(f => f.js)), over: body.filter(f => f.js > BUDGET).length, frame: P.stat(body.map(f => f.ms)), drawCalls: P.stat(body.map(f => f.draw)), triangles: P.stat(body.map(f => f.tris)), errors: pg.errors.slice(0, 3) };
  console.log('  ' + label + ': JS without submit median ' + r.js.p50 + ' ms, p95 ' + r.js.p95 + ', worst ' + r.js.worst + ', over budget on ' + r.over + '; draw calls ' + r.drawCalls.p50 + ', triangles ' + r.triangles.p50 + ' (' + r.preset + ', ' + r.tier + ' tier, sliding on ' + r.sliding + ' of ' + r.of + ' frames)');
  out.runs.push(r);
  return r;
}
/* into a slide round the donut pillar by the hands, stopped mid turn, then the steering held into the slide they left it in */
async function intoSlide(p) {
  await P.ownCar(p, 'starter', null);
  await P.drive(p, { line: 'donut', args: [8, 18], seconds: 15, tail: 0, noRec: true });
  await p.evaluate(() => { window.__feel.inject = { steer: window.__feel.world.car.slip >= 0 ? 1 : -1, throttle: 1, brake: 0, handbrake: 0 }; });
}
async function park(label, o) {
  const pg = await P.parkPage(env, P.PORTRAIT, 'tier=low&preset=night', { touch: true }), p = pg.page;
  await P.seedRandom(p, 7);
  await intoSlide(p);
  await P.runFrames(p, 20);
  const r = await timed(pg, label, o || {});
  r.judge = await p.evaluate(() => { const J = window.__loop.park().state; return { donut: J.best.donut, slide: Math.round(J.best.slide), live: J.live.id, hits: window.__feel.world.hits }; });
  await pg.close();
  return r;
}
async function career(label) {
  const pg = await P.page(env, P.PORTRAIT, 'tier=low&preset=night', { touch: true }), p = pg.page;
  await P.careerRun(p, 0);
  await P.seedRandom(p, 7);
  await P.until(p, "f.state==='drive'", 400);
  await P.runFrames(p, 60 * 8);
  const r = await timed(pg, label, { chain: true });
  await pg.close();
  return r;
}
if (part === 'cost') {
  /* three of each, turn about, so a slow minute of the machine falls on both; each side is judged by the middle one of its three */
  const cs = [], ps = [];
  for (let k = 0; k < 3; k++) { cs.push(await career('a career run (track 1), the scripted drifter, ' + (k + 1))); ps.push(await park('the park, a held slide round the donut pillar, ' + (k + 1))); }
  const midOf = (list, key) => list.map(r => r.js[key]).sort((a, b) => a - b)[1], list = (rs, k) => rs.map(r => r.js[k]).join(', ');
  const cMid = midOf(cs, 'p95'), pMid = midOf(ps, 'p95');
  out.all = { career: cs.map(r => ({ p50: r.js.p50, p95: r.js.p95, worst: r.js.worst, over: r.over })), park: ps.map(r => ({ p50: r.js.p50, p95: r.js.p95, worst: r.js.worst, over: r.over })), middle: { career: { p95: cMid, p50: midOf(cs, 'p50') }, park: { p95: pMid, p50: midOf(ps, 'p50') } }, drawCalls: { career: cs[0].drawCalls.p50, park: ps[0].drawCalls.p50 }, triangles: { career: cs[0].triangles.p50, park: ps[0].triangles.p50 } };
  P.say(ps.every(r => r.sliding > r.of * 0.8 && r.state === 'free' && r.judge.live !== null), 'the park was measured mid slide: sliding on ' + ps.map(r => r.sliding).join(', ') + ' of ' + ps[0].of + ' frames, the readout counting (' + ps[0].judge.live + ', ' + ps[0].judge.donut + ' turns by the end), ' + ps[0].judge.hits + ' wall contacts');
  P.say(Math.max(...ps.map(r => r.js.p95)) < BUDGET && pMid - cMid <= SLACK && midOf(ps, 'p50') - midOf(cs, 'p50') <= SLACK, 'low tier at night, three runs of each: the park\'s JavaScript p95 is ' + list(ps, 'p95') + ' ms (median ' + list(ps, 'p50') + ', worst frame ' + list(ps, 'worst') + ', frames over ' + BUDGET + ' ms: ' + ps.map(r => r.over).join(', ') + ' of ' + ps[0].of + '), every one under ' + BUDGET + ', and the middle one (' + pMid + ') no more than ' + SLACK + ' ms over the career run\'s middle one (' + cMid + ' of ' + list(cs, 'p95') + '; median ' + list(cs, 'p50') + ', worst ' + list(cs, 'worst') + ', over budget ' + cs.map(r => r.over).join(', ') + '); draw calls ' + ps[0].drawCalls.p50 + ' against ' + cs[0].drawCalls.p50 + ', triangles ' + ps[0].triangles.p50 + ' against ' + cs[0].triangles.p50);
} else if (part === 'known') {
  const plain = await park('the park, plain'), three = await park('known answer: 3 ms of busy work per frame', { busy: 3 }), twenty = await park('known answer: 20 ms of busy work per frame', { busy: 20 });
  P.say(twenty.js.p95 >= BUDGET, 'known answer: 20 ms of busy work per frame fails the budget: p95 ' + twenty.js.p95 + ' ms: ' + (twenty.js.p95 >= BUDGET ? 'CAUGHT' : 'MISSED'));
  P.say(three.js.p50 - plain.js.p50 > SLACK, 'known answer: 3 ms of busy work per frame shows as a cost: median ' + plain.js.p50 + ' -> ' + three.js.p50 + ' ms (over the ' + SLACK + ' ms slack): ' + (three.js.p50 - plain.js.p50 > SLACK ? 'CAUGHT' : 'MISSED'));
} else {
  for (const tier of ['low', 'high']) {
    const pg = await P.parkPage(env, P.PORTRAIT, 'tier=' + tier + '&preset=night'), p = pg.page;
    await intoSlide(p);
    const go = (gaps, n) => p.evaluate(({ gaps, n }) => { const F = window.__feel; for (let i = 0; i < n; i++) { window.__clock += gaps.byLevel ? gaps.byLevel[F.scene.adaptState().level] : gaps[0]; F.frame(window.__clock); } return Object.assign({ state: window.__loop.app.state }, F.scene.adaptState()); }, { gaps, n });
    const start = await p.evaluate(() => window.__feel.scene.adaptState());
    const fast = await go([1000 / 60], 900), slow = await go({ byLevel: [40, 36, 33, 29, 24] }, 1500);
    out.runs.push({ tier, start, fast, slow });
    P.say(fast.level === 0 && fast.state === 'free', tier + ' known answer: 900 frames at 60 fps in the park leave the quality alone: level ' + fast.level);
    P.say(slow.level === 4 && slow.density < 1 && slow.pixelRatio < start.pixelRatio && !slow.bloom && slow.state === 'free', tier + ': in the park a slow device is stepped down to the last level: level ' + slow.level + ', effects at ' + slow.density + ', pixel ratio ' + start.pixelRatio + ' -> ' + slow.pixelRatio + ', bloom ' + start.bloom + ' -> ' + slow.bloom);
    if (pg.errors.length) P.say(false, tier + ' page errors: ' + pg.errors.slice(0, 2).join(' | '));
    await pg.close();
  }
}
await P.finish(env, 'perf-' + part + '.json', out);
