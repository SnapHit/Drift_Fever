/* THE GAME LOOP MEASUREMENTS, GAME-LOOP.md "Measure" 1 to 4, each with a
   known answer that can fail, and the screenshots of every screen. Runs
   the shipped page in headless Chromium on the forced WebGL 2 path through
   the dev server, drives it with the scripted driver (drifting every
   corner) through window.__loop and window.__feel, and writes
   review/loop/*.json and review/loop/shots/.

   node game/test/loop/probes.js [ghost] [runs] [save] [perf] [shots]
   (no names: everything)

   1. Ghost: a run is recorded through the real run structure and its
      tape saved as the track's ghost; the same track is started again
      and the ghost's end state hash equals the recorded run's, and its
      position at every sampled frame equals the recorded run's at the
      same step. Known answer: one tape entry's steer moved by 0.01 gives
      a different end hash.
   2. Runs: the scripted driver completes three generated circuits and
      three generated sprints (career 1 to 6) and the daily, start to
      finish through countdown, drive and results, with a score and the
      results screen in the DOM. Known answer: with LOOP.LAPS set to 99
      the circuit does not finish inside the same budget.
   3. Save: progress (coins, career, the ghost) survives a reload; the
      game runs to a results screen with localStorage throwing on every
      call; a save that is not JSON, and one that is JSON of the wrong
      shape, both load to a valid state and the game runs. Known answer:
      the wrong shaped save fails the state invariants before repair and
      passes them after, so the invariants can see a bad state.
   4. Perf: JavaScript time per frame at 1x, 4x and 6x CPU throttle on
      forced WebGL 2 at 390x844 during a run on a generated circuit with
      a ghost running, p95 and worst. Known answer: 20 ms of busy work per
      frame flips the verdict. */
import path from 'node:path';
import fs from 'node:fs';
import * as L from './lib.js';

const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
const run = name => want.length === 0 || want.includes(name);
const env = await L.start();
const started = new Date().toISOString();
const note = 'headless Chromium, forced WebGL 2 on SwiftShader; the GPU half of a frame is not measured here';
const out = {};
let failed = 0;
function verdict(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ': ' + detail : '')); if (!ok) failed++; return ok; }
const RUN_BUDGET = 60 * 300;    // frames: five minutes of game time

/* ---- 1. ghost ---- */
if (run('ghost')) {
  console.log('\n== 1. ghost');
  const side = await L.openPage(env, L.LANDSCAPE, 'auto=1');
  await side.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} window.__loop.save.reset(); });
  // the recording run, on career track 1 (a circuit)
  await L.beginRun(side.page, 'career', 0);
  const rec = await L.driveToResults(side.page, RUN_BUDGET);
  const saved = await side.page.evaluate(() => { const g = window.__loop.save.ghost('career:0'); return g && { score: g.score, steps: g.steps, hash: g.hash, entries: g.tape.length, car: g.car }; });
  // the run again, with the ghost; sample its pose against the recording at the same step
  await L.beginRun(side.page, 'again');
  const second = await L.driveToResults(side.page, RUN_BUDGET);
  const byStep = new Map(); for (const f of rec.frames) if (f.state === 'drive' || f.state === 'results') byStep.set(f.step, f);
  let compared = 0, mismatches = 0, worst = 0, lockstepBroken = 0;
  for (const f of second.frames) {
    const g = f.ghost; if (!g || f.state !== 'drive') continue;
    if (!g.done && g.steps !== f.step) lockstepBroken++;
    const r = byStep.get(g.steps); if (!r) continue;
    compared++;
    const d = Math.hypot(g.x - r.x, g.z - r.z) + Math.abs(g.yaw - r.yaw);
    if (d !== 0) mismatches++;
    if (d > worst) worst = d;
  }
  const ghostHash = await side.page.evaluate(() => window.__loop.ghostHash());
  const ghostDone = await side.page.evaluate(() => window.__loop.ghostState());
  const hashSame = saved && ghostHash === saved.hash;
  // the known answer: one tape entry perturbed, the run again, the ghost's hash must differ
  const perturbed = await side.page.evaluate(() => {
    const g = window.__loop.save.state.ghosts['career:0'];
    const mid = Math.floor(g.tape.length / 2);
    g.tape[mid][1] = +(g.tape[mid][1] + 0.01).toFixed(3);
    window.__loop.save.write();
    return { entry: mid, steer: g.tape[mid][1] };
  });
  await L.beginRun(side.page, 'again');
  const third = await L.driveToResults(side.page, RUN_BUDGET);
  const perturbedHash = await side.page.evaluate(() => window.__loop.ghostHash());
  out.ghost = { recording: { finished: rec.finished, score: rec.results && rec.results.score, steps: rec.results && rec.results.steps, hash: rec.results && rec.results.hash, seconds: rec.results && rec.results.seconds }, saved, replay: { finished: second.finished, ghostHash, ghostDone, hashIdentical: hashSame, framesCompared: compared, mismatches, worstDifference: worst, lockstepBroken }, knownAnswer: { perturbed, ghostHash: perturbedHash, differs: perturbedHash !== saved.hash, finished: third.finished }, errors: side.errors };
  verdict('the recorded run was saved as the ghost', !!saved && saved.steps === rec.results.steps && saved.hash === rec.results.hash, saved && saved.steps + ' steps, ' + saved.entries + ' tape entries, score ' + saved.score);
  verdict('the ghost ends in exactly the recorded state', hashSame, 'ghost steps ' + (ghostDone && ghostDone.steps) + ', done ' + (ghostDone && ghostDone.done));
  verdict('the ghost matches the recording frame for frame', compared > 100 && mismatches === 0 && lockstepBroken === 0, compared + ' frames compared, ' + mismatches + ' differ, worst ' + worst + ', lockstep broken ' + lockstepBroken);
  verdict('known answer: one perturbed tape entry changes the ghost\'s end state', perturbedHash !== saved.hash, 'entry ' + perturbed.entry);
  await side.close();
}

/* ---- 2. runs ---- */
if (run('runs')) {
  console.log('\n== 2. runs');
  const side = await L.openPage(env, L.PORTRAIT, 'auto=1');
  await side.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} window.__loop.save.reset(); });
  out.runs = { budgetFrames: RUN_BUDGET, tracks: [] };
  const list = [['career', 0], ['career', 1], ['career', 2], ['career', 3], ['career', 4], ['career', 5], ['daily', null]];
  for (const [how, arg] of list) {
    const t0 = Date.now();
    await L.beginRun(side.page, how, arg);
    const track = await side.page.evaluate(() => { const t = window.__loop.app.track; return { name: t.name, kind: t.kind, length: t.length, seed: t.seed, difficulty: +t.difficulty.toFixed(2), corners: t.corners ? t.corners.length : 0, fallback: !!t.fallback, laps: window.__loop.app.laps, targets: window.__loop.app.targets }; });
    const r = await L.driveToResults(side.page, RUN_BUDGET);
    const lastF = r.frames[r.frames.length - 1];
    const row = { mode: how + (arg === null ? '' : ' ' + (arg + 1)), ...track, finished: r.finished, resultsScreen: r.screen, score: r.results && r.results.score, bestChain: r.results && r.results.best, stars: r.results && r.results.stars, coins: r.results && r.results.coins, seconds: r.results && +r.results.seconds.toFixed(1), wallContacts: lastF.hits, hardHits: lastF.hard, respawns: r.frames.reduce((s, f) => s + f.resp, 0), topKmh: Math.round(Math.max(...r.frames.map(f => f.v)) * 3.6), maxAngle: Math.max(...r.frames.map(f => f.angle)), driftFrames: r.frames.filter(f => f.angle > 12 && f.v > 6 && f.state === 'drive').length, wallSeconds: +((Date.now() - t0) / 1000).toFixed(0) };
    out.runs.tracks.push(row);
    verdict('run ' + row.mode + ' (' + track.kind + ', ' + track.length + ' m) finishes with a results screen', r.finished && r.screen.shown && r.screen.score === String(r.results.score), (r.results ? r.results.seconds.toFixed(1) + ' s, score ' + r.results.score + ', stars ' + r.results.stars + ', ' + lastF.hits + ' contacts, ' + row.respawns + ' respawns' : 'did not finish'));
  }
  const circuits = out.runs.tracks.filter(t => t.kind === 'circuit' && t.finished).length, sprints = out.runs.tracks.filter(t => t.kind === 'sprint' && t.finished).length;
  out.runs.summary = { circuitsFinished: circuits, sprintsFinished: sprints, allScreensShown: out.runs.tracks.every(t => t.resultsScreen.shown) };
  verdict('three generated circuits and three generated sprints completed', circuits >= 3 && sprints >= 3, circuits + ' circuits, ' + sprints + ' sprints');
  // the known answer: 99 laps do not finish inside the budget
  await side.page.evaluate(() => { window.__loop.LOOP.LAPS = 99; });
  await L.beginRun(side.page, 'career', 0);
  const ka = await L.driveToResults(side.page, Math.round(RUN_BUDGET / 2));
  await side.page.evaluate(() => { window.__loop.LOOP.LAPS = 3; });
  const kl = ka.frames[ka.frames.length - 1];
  out.runs.knownAnswer = { laps: 99, budgetFrames: Math.round(RUN_BUDGET / 2), finished: ka.finished, lapsDone: kl.lap, state: kl.state, caught: !ka.finished };
  verdict('known answer: with 99 laps the run does not finish in the budget', !ka.finished, kl.lap + ' laps done, state ' + kl.state);
  out.runs.errors = side.errors;
  await side.close();
}

/* ---- 3. save ---- */
if (run('save')) {
  console.log('\n== 3. save');
  out.save = {};
  // a. progress survives a reload
  const side = await L.openPage(env, L.PORTRAIT, 'auto=1');
  await side.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} window.__loop.save.reset(); });
  await L.beginRun(side.page, 'career', 1);
  const r1 = await L.driveToResults(side.page, RUN_BUDGET);
  await side.page.evaluate(() => { const S = window.__loop.save; S.addCoins(5000); S.buyCar('hatch', 900); S.chooseCar('hatch'); S.setPaint('hatch', 'lime'); });
  const before = await L.saveState(side.page);
  await side.page.reload({ waitUntil: 'load' });
  await side.page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const after = await L.saveState(side.page);
  const status = await L.saveStatus(side.page);
  const same = JSON.stringify(before) === JSON.stringify(after);
  out.save.reload = { coinsBefore: before.coins, coinsAfter: after.coins, car: after.car, paint: after.cars.hatch && after.cars.hatch.paint, career1: after.career['1'], ghostSteps: after.ghosts['career:1'] && after.ghosts['career:1'].steps, identical: same, status, runScore: r1.results && r1.results.score };
  verdict('saved progress survives a reload', same && after.coins > 0 && after.car === 'hatch' && !!after.ghosts['career:1'], 'coins ' + after.coins + ', car ' + after.car + ', paint ' + out.save.reload.paint + ', ghost steps ' + out.save.reload.ghostSteps);
  await side.close();

  // a2. the career ladder unlocks in order
  const sideU = await L.openPage(env, L.PORTRAIT, 'auto=1');
  const unlock = await sideU.page.evaluate(() => {
    const Lp = window.__loop, S = Lp.save; try { localStorage.clear(); } catch (e) {} S.reset();
    const r = {};
    r.lockedAtStart = !Lp.careerUnlocked(S.state, 1) && Lp.careerUnlocked(S.state, 0);
    Lp.action('play-career', '1'); r.refusedWhileLocked = Lp.app.state !== 'countdown';
    S.careerResult(0, 0, 500); r.stillLockedWithNoStar = !Lp.careerUnlocked(S.state, 1);
    S.careerResult(0, 1, 1200); r.openAfterOneStar = Lp.careerUnlocked(S.state, 1) && !Lp.careerUnlocked(S.state, 2);
    Lp.action('play-career', '1'); r.startsWhenOpen = Lp.app.state === 'countdown' && Lp.app.spec.index === 1;
    return r;
  });
  out.save.unlock = unlock;
  verdict('the career ladder unlocks in order, one star at a time', Object.values(unlock).every(v => v === true), JSON.stringify(unlock));
  await sideU.close();

  // b. storage throwing: first the property itself, then every method
  const throwers = {
    property: `Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage is off'); }, configurable: true });`,
    methods: `Object.defineProperty(window, 'localStorage', { get() { return { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() { throw new Error('no'); }, clear() { throw new Error('no'); }, key() { throw new Error('no'); }, get length() { throw new Error('no'); } }; }, configurable: true });`,
  };
  out.save.throwing = {};
  for (const [name, thrower] of Object.entries(throwers)) {
    const ctx = await env.browser.newContext({ viewport: L.PORTRAIT, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.addInitScript(`(function () { window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {}; ${thrower} })();`);
    await page.goto(env.url + '?renderer=webgl2&auto=1', { waitUntil: 'load', timeout: 120000 });
    const ready = await page.waitForFunction(() => window.__ready === true || (document.getElementById('fail') && !document.getElementById('fail').hidden), null, { timeout: 120000 }).then(() => true).catch(() => false);
    const threw = await page.evaluate(() => { try { localStorage.getItem('x'); return false; } catch (e) { return true; } });
    let r2 = { finished: false, screen: { shown: false }, results: null }, st2 = null, title = null;
    if (ready) {
      await L.beginRun(page, 'career', 0);
      r2 = await L.driveToResults(page, RUN_BUDGET);
      st2 = await L.saveStatus(page);
      title = await page.evaluate(() => { window.__loop.action('title'); return { screen: window.__loop.screens.current, text: document.querySelector('.screen .sub') && document.querySelector('.screen .sub').textContent }; });
    }
    out.save.throwing[name] = { storageThrows: threw, ready, finished: r2.finished, score: r2.results && r2.results.score, status: st2, titleAfter: title, pageErrors: errors };
    verdict('the game runs to a results screen with localStorage\'s ' + name + ' throwing', threw && ready && r2.finished && r2.screen.shown && errors.length === 0 && st2.available === false, 'score ' + (r2.results && r2.results.score) + ', failed writes ' + (st2 && st2.failedWrites) + ' of ' + (st2 && st2.writes) + ', page errors ' + errors.length);
    await ctx.close();
  }

  // c. corrupted saves
  const side3 = await L.openPage(env, L.PORTRAIT, 'auto=1');
  const KEY = await side3.page.evaluate(() => window.__loop.save.KEY);
  const corrupt = { notJson: 'not json {{{', wrongShape: JSON.stringify({ v: 1, coins: 'abc', car: 'a real car brand', cars: 'x', career: { '0': { stars: 'three', best: -5 }, 'x': 1 }, daily: 7, ghosts: { 'career:0': { score: 10, steps: 3, car: 'starter', tape: [[1, 0, 1, 0, 0], [2, 'x', 1, 0, 0]] }, 'career:1': { score: 5, steps: 2, car: 'starter', tape: [[2, 0, 1, 0, 0]] } } }) };
  const results = {};
  for (const [name, blob] of Object.entries(corrupt)) {
    await side3.page.evaluate(([k, b]) => { localStorage.setItem(k, b); }, [KEY, blob]);
    await side3.page.reload({ waitUntil: 'load' });
    await side3.page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    const state = await L.saveState(side3.page), st = await L.saveStatus(side3.page);
    await L.beginRun(side3.page, 'career', 0);
    const r = await L.driveToResults(side3.page, RUN_BUDGET);
    results[name] = { status: st, state: { coins: state.coins, car: state.car, cars: Object.keys(state.cars), career: state.career, ghosts: Object.keys(state.ghosts) }, finished: r.finished, errors: side3.errors.slice() };
    verdict('a save that is ' + (name === 'notJson' ? 'not JSON' : 'JSON of the wrong shape') + ' loads to a valid state and the game runs', r.finished && side3.errors.length === 0 && typeof state.coins === 'number' && state.car === 'starter', 'repaired ' + st.repaired + ', coins ' + state.coins + ', car ' + state.car + ', ghosts kept ' + Object.keys(state.ghosts).length);
  }
  // the known answer: the invariants fail on the raw wrong shaped save and pass after repair
  const ka = await side3.page.evaluate(async blob => {
    const m = await import('./src/loop/save.js');
    const raw = JSON.parse(blob);
    const invariants = s => s && typeof s.coins === 'number' && isFinite(s.coins) && s.coins >= 0 && typeof s.car === 'string' && s.cars && typeof s.cars === 'object' && s.cars[s.car] && Object.values(s.career).every(e => typeof e.stars === 'number' && e.stars >= 0 && e.stars <= 3 && e.best >= 0) && Object.values(s.ghosts).every(g => m.validGhost(g) !== null);
    let rawOk; try { rawOk = !!invariants(raw); } catch (e) { rawOk = false; }
    const rep = m.repair(raw);
    return { rawPassesInvariants: rawOk, repairedPassesInvariants: !!invariants(rep.state), fixes: rep.fixes, ghostsKept: Object.keys(rep.state.ghosts) };
  }, corrupt.wrongShape);
  out.save.corrupted = { blobs: corrupt, results, knownAnswer: { ...ka, caught: !ka.rawPassesInvariants && ka.repairedPassesInvariants } };
  verdict('known answer: the wrong shaped save fails the invariants raw and passes them repaired', !ka.rawPassesInvariants && ka.repairedPassesInvariants, ka.fixes + ' fixes, ghosts kept ' + ka.ghostsKept.join(','));
  await side3.close();
}

/* ---- 4. perf ---- */
if (run('perf')) {
  console.log('\n== 4. perf');
  out.perf = { budgetMs: 16.7, runs: [] };
  const FRAMES = 420;
  async function measure(throttle, loadMs) {
    const side = await L.openPage(env, L.PORTRAIT, 'auto=1');
    await side.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} window.__loop.save.reset(); });
    // a ghost first: record a run on career 1 so the measured run has one
    await L.beginRun(side.page, 'career', 0);
    await L.driveToResults(side.page, RUN_BUDGET);
    const hasGhost = await side.page.evaluate(() => !!window.__loop.save.ghost('career:0'));
    const cdp = await side.context.newCDPSession(side.page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await L.beginRun(side.page, 'again');
    await side.page.evaluate(({ loadMs }) => {
      const F = window.__feel; F.draw = true;
      if (loadMs) { const step = F.world.stepWorld; F.world.stepWorld = inp => { const t0 = performance.now(); let g = 0; while (performance.now() - t0 < loadMs / 2 && g++ < 1e9) {} return step(inp); }; }
    }, { loadMs: loadMs || 0 });
    const frames = await L.runFrames(side.page, FRAMES, 'return { ms: F.info().frameMs, phys: F.info().physMs, submit: F.scene.info().submitMs, steps: F.info().steps, ghost: !!window.__loop.ghostState() && !window.__loop.ghostState().done, state: window.__loop.app.state };');
    const info = await side.page.evaluate(() => window.__feel.scene.info());
    const track = await side.page.evaluate(() => ({ name: window.__loop.app.track.name, length: window.__loop.app.track.length }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await side.close();
    const warm = 30;
    const body = frames.slice(warm);
    return { throttle, loadMs: loadMs || 0, frames: frames.length, track, hasGhost, ghostRunningFrames: body.filter(f => f.ghost).length, allDriving: body.every(f => f.state === 'drive'), backend: info.backend, tier: info.tier, frame: L.stat(body.map(f => f.ms)), jsWithoutSubmit: L.stat(body.map(f => f.ms - f.submit)), physics: L.stat(body.map(f => f.phys)), submit: L.stat(body.map(f => f.submit)), stepsPerFrame: +(body.reduce((s, f) => s + f.steps, 0) / body.length).toFixed(2), firstFrames: { worst: +Math.max(...frames.slice(0, warm).map(f => f.ms)).toFixed(1) }, errors: side.errors };
  }
  for (const throttle of [1, 4, 6]) {
    const r = await measure(throttle, 0);
    out.perf.runs.push(r);
    console.log('throttle ' + throttle + 'x: frame p95 ' + r.frame.p95 + ' worst ' + r.frame.worst + ' ms; js without submit p95 ' + r.jsWithoutSubmit.p95 + ' worst ' + r.jsWithoutSubmit.worst + '; physics p95 ' + r.physics.p95 + ' worst ' + r.physics.worst + ' (' + r.stepsPerFrame + ' steps, ghost in ' + r.ghostRunningFrames + ' frames); submit p95 ' + r.submit.p95 + '; first frames worst ' + r.firstFrames.worst + '; ' + r.backend + ' ' + r.tier);
  }
  const at6 = out.perf.runs.find(r => r.throttle === 6);
  const holds = at6.jsWithoutSubmit.p95 < out.perf.budgetMs;
  out.perf.summary = { jsWithoutSubmitP95At6x: at6.jsWithoutSubmit.p95, jsWithoutSubmitWorstAt6x: at6.jsWithoutSubmit.worst, frameP95At6x: at6.frame.p95, frameWorstAt6x: at6.frame.worst, physicsP95At6x: at6.physics.p95, ghostPresent: at6.hasGhost && at6.ghostRunningFrames > 0, holdsBudgetAt6x: holds };
  verdict('JavaScript frame p95 at 6x throttle under 16.7 ms, on a generated circuit with a ghost', holds && at6.hasGhost && at6.ghostRunningFrames > 0, at6.jsWithoutSubmit.p95 + ' ms, worst ' + at6.jsWithoutSubmit.worst + ', ghost running in ' + at6.ghostRunningFrames + ' of ' + (at6.frames - 30) + ' frames');
  const loaded = await measure(4, 20);
  const base4 = out.perf.runs.find(r => r.throttle === 4);
  const rise = loaded.jsWithoutSubmit.p95 - base4.jsWithoutSubmit.p95;
  out.perf.knownAnswer = { loadMs: 20, atThrottle: 4, p95Before: base4.jsWithoutSubmit.p95, p95Loaded: loaded.jsWithoutSubmit.p95, rise: +rise.toFixed(2), verdictFlipped: loaded.jsWithoutSubmit.p95 >= out.perf.budgetMs, caught: rise > 12 && loaded.jsWithoutSubmit.p95 >= out.perf.budgetMs };
  verdict('known answer: 20 ms of busy work per frame raises the p95 by about 20 ms and fails the budget', out.perf.knownAnswer.caught, 'p95 ' + base4.jsWithoutSubmit.p95 + ' -> ' + loaded.jsWithoutSubmit.p95 + ' ms at 4x');
}

/* ---- shots: every screen in both orientations ---- */
if (run('shots')) {
  console.log('\n== shots');
  const dir = path.join(L.reviewDir, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  out.shots = [];
  for (const [vname, vp] of [['1280x720', L.LANDSCAPE], ['390x844', L.PORTRAIT], ['844x390', { width: 844, height: 390 }]]) {
    const side = await L.openPage(env, vp, 'auto=1', { touch: vp !== L.LANDSCAPE });
    await side.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const S = window.__loop.save; S.reset(); S.addCoins(2400); S.buyCar('hatch', 900); S.careerResult(0, 2, 1480); S.careerResult(1, 1, 610); });
    const shot = async (name, prep) => {
      if (prep) await prep();
      await side.page.evaluate(() => { window.__feel.draw = true; });
      await L.runFrames(side.page, 1);
      const file = path.join(dir, name + '-' + vname + '.png');
      await side.page.screenshot({ path: file, timeout: 120000 });
      out.shots.push({ file: path.relative(L.reviewDir, file), viewport: vname, screen: name });
      console.log('wrote ' + file);
    };
    await shot('title', async () => { await side.page.evaluate(() => { window.__loop.action('title'); window.__clock = 1000; }); await L.runFrames(side.page, 30); });
    await shot('career', async () => { await side.page.evaluate(() => window.__loop.action('career')); });
    await shot('garage', async () => { await side.page.evaluate(() => { window.__loop.action('garage'); window.__loop.action('pick-car', 'tourer'); }); });
    await shot('countdown', async () => { await side.page.evaluate(() => { window.__loop.action('play-career', '0'); window.__feel.draw = false; window.__clock = 1000; }); await L.runFrames(side.page, 70); });
    await shot('drive', async () => {
      // a ghost first, then the second run held on the line for two seconds
      // (DRIFT with no steering) so the ghost is ahead and in view, then the
      // driver takes over, to a frame mid drift
      await L.beginRun(side.page, 'career', 0); await L.driveToResults(side.page, RUN_BUDGET);
      await L.beginRun(side.page, 'again', null, null);
      await side.page.evaluate(() => { window.__feel.setDriver(null); window.__feel.inject = { steer: 0, throttle: 0, brake: 0, handbrake: 1 }; });
      await L.runFrames(side.page, 120);
      await side.page.evaluate(() => { window.__feel.inject = null; window.__feel.setDriver({ drift: '*' }); });
      let best = null;
      for (let k = 0; k < 40 && !best; k++) { const fr = await L.runFrames(side.page, 30, L.COLLECT); for (const f of fr) if (f.angle > 28 && f.v > 12 && f.state === 'drive') { best = f; break; } }
    });
    await shot('results', async () => { await L.driveToResults(side.page, RUN_BUDGET); });
    await shot('ghost', async () => {
      // the car held on the line (DRIFT, no steering) while the ghost drives away
      await L.beginRun(side.page, 'again', null, null);
      await side.page.evaluate(() => { window.__feel.setDriver(null); window.__feel.inject = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }; });
      await L.runFrames(side.page, 150);
      await side.page.evaluate(() => { window.__feel.inject = { steer: 0, throttle: 0, brake: 0, handbrake: 1 }; });
      await L.runFrames(side.page, 240);
      await side.page.evaluate(() => { window.__feel.inject = null; });
    });
    await shot('free', async () => {
      await side.page.evaluate(() => { window.__loop.action('free'); window.__feel.draw = false; window.__clock = 1000; window.__feel.inject = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }; });
      await L.runFrames(side.page, 150);
      await side.page.evaluate(() => { window.__feel.inject = { steer: 1, throttle: 1, brake: 0, handbrake: 1 }; });
      await L.runFrames(side.page, 40);
      await side.page.evaluate(() => { window.__feel.inject = null; });
    });
    await side.close();
  }
}

await env.close();
for (const k of Object.keys(out)) L.writeJson(path.join(L.reviewDir, k + '.json'), { started, note, ...out[k] });
console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '; wrote review/loop/' + Object.keys(out).map(k => k + '.json').join(', '));
process.exit(failed ? 1 : 0);
