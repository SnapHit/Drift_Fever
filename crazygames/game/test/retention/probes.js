/* THE RETENTION MEASUREMENTS, briefs/RETENTION.md "Measure" 1 to 7, each
   with a known answer that can fail, and the screenshots of every new
   screen and prompt. Runs the shipped page in headless Chromium on the
   forced WebGL 2 path through the dev server and writes
   review/retention/*.json and review/retention/shots/.

   node game/test/retention/probes.js [clicks] [onboard] [missions] [codes] [saves] [perf] [shots]
   (no names: everything)

   1. Clicks: real clicks on the page from load to a moving car, on a
      first visit (no save) and on a returning visit (a save with a
      finished run). Known answer: ?title=1 forces the title on a first
      visit, and the count must then be one.
   2. Onboarding: the prompts show on the first visit, SKIP (a real
      click) ends them without stopping the car, and they are not shown
      on the next visit. Known answer: the save's onboarded flag put back
      to false (with no finished run) brings them back.
   3. Missions: every career track and the daily driven by the scripted
      drifter and by the careful driver; every mission kind is completed
      somewhere, and no kind is completed on every track by both drivers
      (not trivial). The drifter's tape on career 1 replayed through the
      run structure completes the same missions at the same steps; the
      same tape with the handbrake taken out changes the outcome. Known
      answer: every target a hundred times larger, and the drifter
      completes none. */
import path from 'node:path';
import fs from 'node:fs';
import * as R from './lib.js';

const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
const run = name => want.length === 0 || want.includes(name);
const env = await R.start();
const started = new Date().toISOString();
const note = 'headless Chromium, forced WebGL 2 on SwiftShader';
const out = {};
let failed = 0;
function verdict(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ': ' + detail : '')); if (!ok) failed++; return ok; }
const RUN_BUDGET = 60 * 300;
const MOVE_BUDGET = 60 * 10;   // frames: ten seconds for the countdown and the launch

/* ---- 1. clicks to gameplay ---- */
if (run('clicks')) {
  console.log('\n== 1. clicks to gameplay');
  out.clicks = {};
  // a first visit: no save
  const first = await R.openPage(env, R.LANDSCAPE, { firstVisit: true, query: 'auto=1' });
  const stateAtLoad = await first.page.evaluate(() => window.__loop.app.state);
  await first.page.evaluate(() => { window.__feel.draw = false; });
  const movedAt = await R.framesUntilMoving(first.page, MOVE_BUDGET);
  const clicksFirst = await R.clicks(first.page);
  out.clicks.firstVisit = { stateAtLoad, clicks: clicksFirst, movingAtFrame: movedAt, movingAtSeconds: movedAt < 0 ? null : +(movedAt / 60).toFixed(2), track: await first.page.evaluate(() => window.__loop.app.spec && window.__loop.app.spec.key) };
  verdict('first visit: the car moves with no click', clicksFirst === 0 && movedAt >= 0 && stateAtLoad === 'countdown', 'state at load ' + stateAtLoad + ', moving after ' + out.clicks.firstVisit.movingAtSeconds + ' s, ' + clicksFirst + ' clicks');
  // finish that run, so the save has a finished run, then come back
  await first.page.evaluate(() => { window.__feel.setDriver({ drift: '*' }); });
  const r = await R.driveToResults(first.page, RUN_BUDGET);
  await R.reload(first.page);
  const stateBack = await first.page.evaluate(() => window.__loop.app.state);
  await first.page.evaluate(() => { window.__feel.draw = false; });
  const movedNoClick = await R.framesUntilMoving(first.page, MOVE_BUDGET);
  await first.page.click('button[data-action="daily"]');
  const movedAfterClick = await R.framesUntilMoving(first.page, MOVE_BUDGET);
  const clicksBack = await R.clicks(first.page);
  out.clicks.returningVisit = { firstRunFinished: r.finished, stateAtLoad: stateBack, movedWithNoClick: movedNoClick >= 0, clicks: clicksBack, movingAtFrameAfterClick: movedAfterClick };
  verdict('returning visit: the title, then one click to a moving car', r.finished && stateBack === 'title' && movedNoClick < 0 && clicksBack === 1 && movedAfterClick >= 0, 'state at load ' + stateBack + ', moved before any click: ' + (movedNoClick >= 0) + ', clicks ' + clicksBack);
  out.clicks.errors = first.errors;
  await first.close();
  // the known answer: a forced title on a first visit must count one
  const ka = await R.openPage(env, R.LANDSCAPE, { firstVisit: true, query: 'auto=1&title=1' });
  const kaState = await ka.page.evaluate(() => window.__loop.app.state);
  await ka.page.evaluate(() => { window.__feel.draw = false; });
  const kaMoved0 = await R.framesUntilMoving(ka.page, MOVE_BUDGET);
  await ka.page.click('button[data-action="daily"]');
  const kaMoved1 = await R.framesUntilMoving(ka.page, MOVE_BUDGET);
  const kaClicks = await R.clicks(ka.page);
  out.clicks.knownAnswer = { query: 'title=1', stateAtLoad: kaState, movedWithNoClick: kaMoved0 >= 0, clicks: kaClicks, movedAfterClick: kaMoved1 >= 0, caught: kaState === 'title' && kaMoved0 < 0 && kaClicks === 1 && kaMoved1 >= 0 };
  verdict('known answer: a forced title first counts one click', out.clicks.knownAnswer.caught, 'state ' + kaState + ', clicks ' + kaClicks);
  await ka.close();
}

/* ---- 2. onboarding shown once, skippable, gone on the next visit ---- */
if (run('onboard')) {
  console.log('\n== 2. onboarding');
  out.onboard = {};
  // a. the whole sequence with the scripted drifter, keyboard prompts
  const seq = await R.openPage(env, R.LANDSCAPE, { firstVisit: true, query: 'auto=1' });
  await seq.page.evaluate(() => { window.__feel.draw = false; window.__feel.setDriver({ drift: '*' }); });
  const timeline = [];
  let lastKey = '';
  for (let k = 0; k < 60; k++) {
    const fr = await R.runFrames(seq.page, 60, 'const o = window.__loop.onboard; return { s: window.__loop.app.state, step: o.state.step, vis: o.visible(), txt: (document.querySelector("#onboard .prompt") || {}).textContent || "", info: (document.querySelector("#onboard .info") || {}).textContent || "", v: +window.__feel.world.car.speed.toFixed(1), active: o.active };');
    for (let i = 0; i < fr.length; i++) { const f = fr[i], key = f.step + '|' + f.txt + '|' + f.info; if (key !== lastKey) { lastKey = key; timeline.push({ t: +((k * 60 + i) / 60).toFixed(2), ...f }); } }
    if (fr[fr.length - 1].s === 'results') break;
  }
  const seqState = await R.onboardState(seq.page);
  const paused = timeline.filter(e => e.s === 'drive' && e.v < 0.5 && e.t > 4);
  out.onboard.sequence = { shown: seqState.shown, done: seqState.done, timeline, carStoppedWhilePrompting: paused.length, errors: seq.errors };
  verdict('the prompts come in order, each once, and the car is never paused', ['steer', 'drift', 'brake'].every(k => seqState.shown.filter(x => x === k).length === 1) && seqState.shown.indexOf('steer') < seqState.shown.indexOf('drift') && seqState.shown.indexOf('drift') < seqState.shown.indexOf('brake') && paused.length === 0, 'shown ' + seqState.shown.join(', ') + '; ' + timeline.length + ' changes');
  await seq.close();

  // b. SKIP, by a real click, mid run; then the next visit
  const sk = await R.openPage(env, R.LANDSCAPE, { firstVisit: true, query: 'auto=1' });
  await sk.page.evaluate(() => { window.__feel.draw = false; });
  await R.runFrames(sk.page, 60 * 5);
  const before = await R.onboardState(sk.page);
  const speedBefore = await sk.page.evaluate(() => window.__feel.world.car.speed);
  await sk.page.click('#skip');
  const after = await R.onboardState(sk.page);
  await R.runFrames(sk.page, 60);
  const speedAfter = await sk.page.evaluate(() => window.__feel.world.car.speed);
  const saved = await R.saveState(sk.page);
  const stateAfterSkip = await sk.page.evaluate(() => window.__loop.app.state);
  out.onboard.skip = { before, after, speedBefore, speedAfter, stateAfterSkip, savedOnboarded: saved.onboarded, clicks: await R.clicks(sk.page) };
  verdict('SKIP (one real click) ends the prompts, the car keeps driving, the save remembers', before.skipShown && before.visible && !after.active && !after.visible && saved.onboarded === true && stateAfterSkip === 'drive' && speedAfter > 1, 'speed ' + speedBefore.toFixed(1) + ' -> ' + speedAfter.toFixed(1) + ' m/s, onboarded ' + saved.onboarded);
  await R.reload(sk.page);
  const next = await sk.page.evaluate(() => ({ state: window.__loop.app.state, active: window.__loop.onboard.active }));
  await sk.page.evaluate(() => { window.__feel.draw = false; window.__loop.action('daily'); });
  const fr = await R.runFrames(sk.page, 60 * 8, 'return window.__loop.onboard.visible();');
  out.onboard.nextVisit = { ...next, promptsSeenInDaily: fr.filter(Boolean).length };
  verdict('on the next visit the title shows and no prompt comes in a run', next.state === 'title' && !next.active && fr.every(v => !v), 'state ' + next.state);
  // the known answer: the flag put back (no finished run) brings the onboarding back
  await sk.page.evaluate(() => { const S = window.__loop.save; S.state.onboarded = false; S.write(); });
  await R.reload(sk.page);
  const ka = await sk.page.evaluate(() => ({ state: window.__loop.app.state, active: window.__loop.onboard.active, needs: window.__loop.save.needsOnboarding() }));
  out.onboard.knownAnswer = { ...ka, caught: ka.state === 'countdown' && ka.active };
  verdict('known answer: the flag put back brings the onboarding back', out.onboard.knownAnswer.caught, 'state ' + ka.state + ', active ' + ka.active);
  out.onboard.errors = sk.errors;
  await sk.close();

  // c. the touch prompts point at the buttons
  const tp = await R.openPage(env, R.PORTRAIT, { firstVisit: true, touch: true, query: 'auto=1' });
  await tp.page.evaluate(() => { window.__feel.draw = false; });
  await R.runFrames(tp.page, 60 * 5);
  const touch = await tp.page.evaluate(() => { const p = document.querySelector('#onboard .prompt'); const pad = document.querySelector('#touch button[data-b="left"]').getBoundingClientRect(), pr = p.getBoundingClientRect(); return { cls: p.className, text: p.textContent, hasArrow: !!p.querySelector('.arrow'), promptBottom: pr.bottom, padTop: pad.top, source: window.__loop.onboard.state.source }; });
  out.onboard.touch = touch;
  verdict('on touch the steer prompt sits above the steer buttons with an arrow', touch.source === 'touch' && touch.cls.includes('at-left') && touch.hasArrow && touch.promptBottom < touch.padTop, touch.text + ' (' + touch.cls + ')');
  await tp.close();
}

/* ---- 3. missions ---- */
if (run('missions')) {
  console.log('\n== 3. missions');
  out.missions = { runs: [], offered: [] };
  const side = await R.openPage(env, R.LANDSCAPE, { firstVisit: true, query: 'auto=1&title=1' });
  await side.page.evaluate(() => { window.__feel.draw = false; });
  const list = [];
  for (let i = 0; i < 8; i++) list.push(['career', i]);
  list.push(['daily', null]);
  /* what each track offers (its three) */
  for (const [how, arg] of list) {
    await R.beginRun(side.page, how, arg, null);
    const offered = await side.page.evaluate(() => ({ key: window.__loop.app.spec.key, track: window.__loop.app.track.name, length: window.__loop.app.track.length, missions: window.__loop.missions().list.map(m => m.text) }));
    out.missions.offered.push(offered);
  }
  /* every kind judged on every track, three drivers: the game's drifter,
     the game's careful driver, and the test's wall hugging clipper */
  const byKind = {};
  const drivers = [['drifter', { drift: '*' }], ['careful', { drift: null }], ['clipper', 'clipper']];
  for (const [name, driver] of drivers) {
    for (const [how, arg] of list) {
      await R.beginRun(side.page, how, arg, driver === 'clipper' ? { drift: '*' } : driver);
      if (driver === 'clipper') await R.installClipper(side.page);
      await side.page.evaluate(() => window.__loop.judgeAll());
      const r = await R.driveToResults(side.page, RUN_BUDGET);
      const m = r.results && r.results.missions;
      const last = r.frames[r.frames.length - 1];
      const row = { driver: name, run: how + (arg === null ? '' : ' ' + (arg + 1)), finished: r.finished, score: r.results && r.results.score, bestChain: r.results && r.results.best, seconds: r.results && +r.results.seconds.toFixed(1), contacts: last.hits, respawns: r.frames.reduce((s, f) => s + f.resp, 0), missions: m && m.map(x => ({ kind: x.kind, target: x.target, text: x.text, done: x.doneNow, progress: +(+x.progress).toFixed(2), doneAt: x.doneAt })) };
      out.missions.runs.push(row);
      if (m) for (const x of m) { const k = byKind[x.kind] = byKind[x.kind] || { offered: 0, drifter: 0, careful: 0, clipper: 0, tracks: {} }; if (name === 'drifter') k.offered++; if (x.doneNow) { k[name]++; k.tracks[row.run] = (k.tracks[row.run] || []).concat(name); } }
      console.log('  ' + name.padEnd(8) + row.run.padEnd(10) + (m ? m.map(x => (x.doneNow ? '[done] ' : '[    ] ') + x.kind + ' ' + x.target + ' (' + (+x.progress).toFixed(1) + ')').join('; ') : 'no missions'));
    }
  }
  out.missions.byKind = byKind;
  const KINDS = ['hold', 'chain', 'clean', 'clip', 'time', 'mult'];
  const everyKindDone = KINDS.every(k => byKind[k] && Object.keys(byKind[k].tracks).length > 0);
  const everywhere = KINDS.filter(k => byKind[k] && Object.keys(byKind[k].tracks).length === byKind[k].offered && Object.values(byKind[k].tracks).every(d => d.length === drivers.length));
  verdict('every mission kind is completed by a scripted driver on some track', everyKindDone, KINDS.map(k => k + ' on ' + (byKind[k] ? Object.keys(byKind[k].tracks).length : 0) + ' of ' + (byKind[k] ? byKind[k].offered : 0)).join(', '));
  verdict('no mission kind is completed on every track by every driver', everywhere.length === 0, everywhere.length ? 'trivial: ' + everywhere.join(', ') : 'none trivial');
  // the replay: the drifter's tape on career 1 through the run structure, every kind judged
  await R.beginRun(side.page, 'career', 0, { drift: '*' });
  await R.installClipper(side.page);
  await side.page.evaluate(() => window.__loop.judgeAll());
  const live = await R.driveToResults(side.page, RUN_BUDGET);
  const tape = await side.page.evaluate(() => window.__feel.tapeCopy());
  const pick = x => ({ kind: x.kind, done: x.doneNow, doneAt: x.doneAt, progress: +(+x.progress).toFixed(3) });
  const liveM = live.results.missions.map(pick);
  const replayOn = (t) => side.page.evaluate(t => {
    const Lp = window.__loop, spec = Lp.careerSpec(0);
    /* replayRun starts the run and the probe's judge over every kind must be in place before the steps: start, swap, then step */
    Lp.startRun(spec); Lp.judgeAll();
    const r = Lp.replayRun(spec, t, true);
    return r && { score: r.score, seconds: r.seconds, hash: r.hash, missions: r.missions.map(x => ({ kind: x.kind, done: x.doneNow, doneAt: x.doneAt, progress: +(+x.progress).toFixed(3) })) };
  }, t);
  const replay = await replayOn(tape);
  const same = replay && JSON.stringify(replay.missions) === JSON.stringify(liveM) && replay.score === live.results.score;
  const noHb = tape.map(e => ({ ...e, h: 0 }));
  const perturbed = await replayOn(noHb);
  const changed = !perturbed || JSON.stringify(perturbed.missions) !== JSON.stringify(liveM);
  out.missions.replay = { live: { score: live.results.score, seconds: live.results.seconds, missions: liveM, tapeEntries: tape.length, steps: live.results.steps }, replay, identical: same, perturbed: { handbrakeRemoved: true, result: perturbed, outcomeChanged: changed } };
  verdict('the tape replayed completes the same missions at the same steps, with the same score', same && liveM.some(m => m.done), liveM.filter(m => m.done).map(m => m.kind + '@' + m.doneAt).join(', ') + '; score ' + live.results.score + ' -> ' + (replay && replay.score));
  verdict('the tape with the handbrake taken out changes the outcome', changed, perturbed ? perturbed.missions.filter(m => m.done).map(m => m.kind + '@' + m.doneAt).join(', ') + '; score ' + perturbed.score : 'did not finish');
  // the known answer: every numeric target a hundred times larger
  const keep = await side.page.evaluate(() => {
    const M = window.__loop.LOOP.MISSIONS, keep = JSON.parse(JSON.stringify(M));
    M.HOLD_RANGE = [200, 400]; M.CHAIN_MIN = 10000; M.CHAIN_SHARE = 25; M.CLIP_SHARE = 50; M.TIME_FACTOR = 0.0095; M.MULT = [200, 300];
    return keep;
  });
  await R.beginRun(side.page, 'career', 0, { drift: '*' });
  await R.installClipper(side.page);
  const kaList = await side.page.evaluate(() => window.__loop.judgeAll().map(m => m.text));
  const kaRun = await R.driveToResults(side.page, RUN_BUDGET);
  await side.page.evaluate(keep => { Object.assign(window.__loop.LOOP.MISSIONS, keep); }, keep);
  const kaNumeric = kaRun.results ? kaRun.results.missions.filter(x => x.kind !== 'clean') : [];
  const kaDone = kaNumeric.filter(x => x.doneNow).length;
  out.missions.knownAnswer = { targets: kaList, numericDone: kaDone, numericOffered: kaNumeric.length, caught: kaRun.finished && kaNumeric.length >= 4 && kaDone === 0 };
  verdict('known answer: with every numeric target a hundred times larger the clipper completes none of them', out.missions.knownAnswer.caught, kaList.join('; ') + ' -> ' + kaDone + ' of ' + kaNumeric.length + ' done');
  out.missions.errors = side.errors;
  await side.close();
}

await env.close();
for (const k of Object.keys(out)) R.writeJson(path.join(R.reviewDir, k + '.json'), { started, note, ...out[k] });
console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '; wrote review/retention/' + Object.keys(out).map(k => k + '.json').join(', '));
process.exit(failed ? 1 : 0);
