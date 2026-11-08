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
      to false (with no finished run) brings them back. */
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

await env.close();
for (const k of Object.keys(out)) R.writeJson(path.join(R.reviewDir, k + '.json'), { started, note, ...out[k] });
console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '; wrote review/retention/' + Object.keys(out).map(k => k + '.json').join(', '));
process.exit(failed ? 1 : 0);
