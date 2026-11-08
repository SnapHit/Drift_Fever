/* THE RETENTION MEASUREMENTS, briefs/RETENTION.md "Measure" 1 to 7, each
   with a known answer that can fail, and the screenshots of every new
   screen and prompt. Runs the shipped page in headless Chromium on the
   forced WebGL 2 path through the dev server and writes
   review/retention/*.json and review/retention/shots/.

   node game/test/retention/probes.js [clicks] [onboard] [missions] [lab] [saves] [perf] [shots]
   (no names: everything). Measurement 4's codes and the generator are
   codes.js, in Node.

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
      completes none.
   4. Lab (the browser half): at all four sizes, every Lab control is
      reachable (scrolled into view, document.elementFromPoint at its
      centre is the control) and never under the NEW LAYOUT / DRIVE bar
      at any scroll position, the scroll end clears the bar, and the
      code and COPY are on screen without scrolling; the coin badge and
      the career header's tally never overlap with a five digit count
      (known answer for the first: the layout before 9 November, a
      sticky bar inside the scrolling screen, fails at three sizes).
      Then the Lab from the title, every setting by
      real clicks with the backdrop following the theme and the time of
      day, a run to results with the code shown, the best and the ghost
      kept per code, coins at the Lab's rate, a code typed, a ?track=
      link one click from a moving car, a bad link and a bad code
      refused with a message and no error, and the last LOOP.LAB.KEEP
      codes kept. Known answer: a code with one character changed is
      refused.
   5. Saves: a save in main's shape (this build's save with the new
      fields taken out) loads with everything kept and no fixes; a
      corrupted save with the new fields wrong loads to a valid state
      and the game runs; storage throwing lands the first visit in the
      onboarding run and the Lab still works. Known answer: the
      corrupted save fails the invariants raw and passes repaired.
   6. Perf: JavaScript time per frame at 6x CPU throttle on career 1
      with a ghost, as the loop probe measures it, against the loop
      probe's number for main measured in this sandbox. Known answer:
      20 ms of busy work per frame flips the verdict. */
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

/* ---- 4. the Lab in the browser ---- */
if (run('lab')) {
  console.log('\n== 4. the Track Lab');
  out.lab = { layout: [] };
  // the layout at four sizes, and the coin badge against the career header
  for (const [vname, vp, touch] of [['390x844', R.PORTRAIT, true], ['844x390', R.PHONE_LANDSCAPE, true], ['800x450', R.SMALL, false], ['1280x720', R.LANDSCAPE, false]]) {
    const pg = await R.openPage(env, vp, { firstVisit: true, touch, query: 'auto=1&title=1' });
    await pg.page.evaluate(() => { window.__loop.save.addCoins(12345); window.__loop.save.careerResult(0, 3, 900); window.__loop.save.missionResult('career:0', [true, true, true]); window.__loop.action('career'); });
    const header = await pg.page.evaluate(() => { const r = e => e.getBoundingClientRect(); const a = r(document.querySelector('.coins')), b = r(document.querySelector('header .tally')); return { coins: [Math.round(a.left), Math.round(a.right)], tally: [Math.round(b.left), Math.round(b.right)], text: document.querySelector('.coins').textContent.trim(), overlap: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top }; });
    await pg.page.evaluate(() => { window.__loop.action('lab'); });
    const lay = await R.labLayout(pg.page);
    await pg.page.evaluate(css => { document.head.insertAdjacentHTML('beforeend', '<style id="old">' + css + '</style>'); }, R.OLD_LAB_CSS);
    const old = await R.labLayout(pg.page);
    out.lab.layout.push({ viewport: vname, header, layout: lay, oldLayout: { ok: old.ok, codeVisible: old.codeVisible, unreachable: old.unreachable.length, underBar: old.underBar, clearsBar: old.clearsBar } });
    verdict(vname + ': every Lab control reachable, none under the bar at ' + lay.positionsTried + ' scroll positions, the scroll end clears the bar, the code and COPY on screen unscrolled', lay.ok, lay.controls + ' controls, ' + lay.scrollers + ' scroll box' + (lay.scrollers === 1 ? '' : 'es') + ', unreachable ' + lay.unreachable.map(u => u.what).join(',') + ', under the bar ' + lay.underBar);
    verdict(vname + ': the coin badge (' + header.text + ') and the career tally do not overlap', !header.overlap, 'badge ' + header.coins.join('-') + ', tally ' + header.tally.join('-'));
    await pg.close();
  }
  const oldFails = out.lab.layout.filter(l => !l.oldLayout.ok).map(l => l.viewport);
  verdict('known answer: the sticky bar layout fails the same check at the three smaller sizes', ['390x844', '844x390', '800x450'].every(v => oldFails.includes(v)), 'fails at ' + oldFails.join(', '));
  const side = await R.openPage(env, R.SMALL, { firstVisit: true, query: 'auto=1&title=1' });
  await side.page.evaluate(() => { window.__feel.draw = false; });
  await side.page.click('button[data-action="lab"]');
  const opened = await side.page.evaluate(() => ({ state: window.__loop.app.state, lab: window.__loop.lab.state(), planDrawn: (() => { const c = document.getElementById('plan'); if (!c) return false; const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 200) lit++; return lit > 20; })() }));
  // every setting by a real click; the backdrop follows the theme and the time of day
  const clicks = [['kind=sprint', 'kind', 'sprint'], ['length=long', 'length', 'long'], ['style=technical', 'style', 'technical'], ['bank=off', 'bank', false], ['theme=desert', 'theme', 'desert'], ['time=night', 'time', 'night'], ['kind=circuit', 'kind', 'circuit'], ['cross=on', 'cross', true]];
  const settingResults = [];
  for (const [arg, name, want] of clicks) {
    await side.page.click('button[data-arg="' + arg + '"]');
    const r = await side.page.evaluate(([name]) => { const L = window.__loop.lab.state(), i = window.__feel.scene.info(); return { value: L.settings[name], code: L.code, track: L.track, scene: { preset: i.preset, theme: i.theme } }; }, [name]);
    settingResults.push({ click: arg, got: r.value, want, code: r.code, track: r.track, scene: r.scene });
  }
  const settingsOk = settingResults.every(r => r.got === r.want) && new Set(settingResults.map(r => r.code)).size === settingResults.length;
  const last = settingResults[settingResults.length - 1];
  const sceneOk = last.scene.theme === 'desert' && last.scene.preset === 'night' && last.track.theme === 'desert' && last.track.preset === 'night' && last.track.bridges === 1;
  const crossBefore = settingResults.find(r => r.click === 'kind=circuit');
  out.lab.settings = { opened, clicks: settingResults, settingsOk, sceneOk };
  verdict('the Lab opens from the title with a plan drawn, and every setting changes the track and the code by a click', opened.state === 'lab' && opened.planDrawn && settingsOk, settingResults.map(r => r.click + ' -> ' + r.code).join(', '));
  verdict('the backdrop follows the theme and the time of day, and a long circuit with the crossover on has a bridge', sceneOk, 'scene ' + last.scene.theme + ' ' + last.scene.preset + ', bridges ' + last.track.bridges + ' (before the toggle ' + crossBefore.track.bridges + ')');
  // a run to results, the code shown, the best and the ghost kept, coins at the Lab's rate
  const codeDriven = last.code;
  await side.page.click('button[data-action="lab-drive"]');
  const started = await side.page.evaluate(() => ({ state: window.__loop.app.state, key: window.__loop.app.spec.key, missions: window.__loop.app.missions }));
  await side.page.evaluate(() => { window.__feel.setDriver({ drift: '*' }); });
  await R.runFrames(side.page, 240);
  const r1 = await R.driveToResults(side.page, RUN_BUDGET);
  const shown = await side.page.evaluate(() => ({ code: (document.querySelector('.results .code') || {}).textContent, lab: !!document.querySelector('.results [data-action="lab"]'), next: !!document.querySelector('.results [data-action="play-career"]') }));
  const save1 = await R.saveState(side.page);
  const expectedCoins = await side.page.evaluate(([score, stars]) => Math.floor(Math.floor(score * window.__loop.LOOP.COIN_PER_POINT + stars * window.__loop.LOOP.COIN_PER_STAR) * window.__loop.LOOP.LAB.COIN_RATE), [r1.results.score, r1.results.stars]);
  await side.page.click('button[data-action="lab-copy"]');
  await side.page.waitForFunction(() => document.querySelector('.results .status'), null, { timeout: 5000 }).catch(() => {});
  const copied = await side.page.evaluate(() => (document.querySelector('.results .status') || {}).textContent || '');
  out.lab.run = { started, finished: r1.finished, score: r1.results.score, stars: r1.results.stars, coins: r1.results.coins, expectedCoins, code: r1.results.code, shown, copied, saved: save1.lab.codes[codeDriven], ghostKept: !!save1.ghosts['lab:' + codeDriven], ghostKeys: Object.keys(save1.ghosts) };
  verdict('a Lab run reaches results with its code, a LAB button and no NEXT, pays at the Lab\'s rate, and keeps a best and a ghost for the code', started.state === 'countdown' && started.key === 'lab:' + codeDriven && started.missions === null && r1.finished && shown.code.replace(/-/g, '') === codeDriven && shown.lab && !shown.next && r1.results.coins === expectedCoins && save1.lab.codes[codeDriven] && save1.lab.codes[codeDriven].best === r1.results.score && !!save1.ghosts['lab:' + codeDriven] && /copied/.test(copied), 'score ' + r1.results.score + ', coins ' + r1.results.coins + ' (expected ' + expectedCoins + '), ' + copied);
  // the ghost drives on the second run
  await side.page.click('button[data-action="again"]');
  await side.page.evaluate(() => { window.__feel.setDriver({ drift: '*' }); });
  await R.runFrames(side.page, 240);
  const ghost = await side.page.evaluate(() => window.__loop.ghostState());
  const r2 = await R.driveToResults(side.page, RUN_BUDGET);
  out.lab.again = { ghostRunning: !!ghost && ghost.steps > 0, finished: r2.finished, improved: r2.results.improved };
  verdict('going again on a Lab track runs its saved ghost', !!ghost && ghost.steps > 0 && r2.finished, 'ghost steps ' + (ghost && ghost.steps));
  // a code typed into the Lab
  await side.page.click('.results [data-action="lab"]');
  const typedCode = await side.page.evaluate(() => window.__loop.lab.labSpec({ kind: 'sprint', length: 'short', style: 'flowing', bank: true, cross: false, theme: 'coastal', time: 'dawn' }, 777).code);
  await side.page.fill('#codeIn', typedCode.slice(0, 4).toLowerCase() + '-' + typedCode.slice(4, 8) + ' ' + typedCode.slice(8));
  await side.page.click('form.entry button');
  const typed = await side.page.evaluate(() => window.__loop.lab.state());
  await side.page.fill('#codeIn', typedCode.slice(0, 11) + (typedCode[11] === 'A' ? 'B' : 'A'));
  await side.page.click('form.entry button');
  const badTyped = await side.page.evaluate(() => ({ status: (document.querySelector('.lab .status') || {}).textContent || '', bad: !!document.querySelector('.lab .status.bad'), code: window.__loop.lab.state().code }));
  out.lab.typed = { code: typedCode, loaded: typed.code === typedCode && typed.settings.theme === 'coastal' && typed.settings.time === 'dawn', badTyped };
  verdict('a code typed in lower case with a dash and a space loads its track', out.lab.typed.loaded, typed.code);
  verdict('known answer: the same code with its last character changed is refused with a message and the track stays', badTyped.bad && badTyped.code === typedCode && /not a track code/i.test(badTyped.status), badTyped.status);
  // the cap: the last LOOP.LAB.KEEP codes kept, ghosts with them
  const KEEP = await side.page.evaluate(() => window.__loop.LOOP.LAB.KEEP);
  for (let i = 0; i < KEEP + 2; i++) {
    await side.page.evaluate(i => { const Lp = window.__loop; const spec = Lp.lab.labSpec({ kind: 'sprint', length: 'short', style: 'mixed', bank: true, cross: false, theme: 'forest', time: 'dusk' }, 1000 + i); Lp.lab.setLab(spec.settings, spec.seed); Lp.action('lab-drive'); }, i);
    await side.page.evaluate(() => { window.__feel.setDriver({ drift: null }); });
    await R.runFrames(side.page, 240);
    await R.driveToResults(side.page, RUN_BUDGET);
  }
  const save2 = await R.saveState(side.page);
  const labGhosts = Object.keys(save2.ghosts).filter(k => k.startsWith('lab:'));
  const bytes = await side.page.evaluate(() => { try { return localStorage.getItem(window.__loop.save.KEY).length; } catch (e) { return -1; } });
  const newestKept = Object.keys(save2.lab.codes).every(c => c !== codeDriven) && Object.keys(save2.lab.codes).length === KEEP;
  out.lab.cap = { keep: KEEP, codes: Object.keys(save2.lab.codes).length, labGhosts: labGhosts.length, oldestDropped: !save2.lab.codes[codeDriven] && !save2.ghosts['lab:' + codeDriven], saveBytes: bytes };
  verdict('after ' + (KEEP + 3) + ' codes driven the save keeps the last ' + KEEP + ' with their ghosts and drops the oldest', newestKept && labGhosts.length === KEEP && out.lab.cap.oldestDropped, Object.keys(save2.lab.codes).length + ' codes, ' + labGhosts.length + ' lab ghosts, save ' + bytes + ' bytes');
  out.lab.errors = side.errors;
  verdict('no page errors through the Lab', side.errors.length === 0, side.errors.join(' | '));
  await side.close();
  // a track link: one click to a moving car
  const code = await (async () => { const m = await import('../../src/lab/lab.js'); return m.labSpec({ kind: 'circuit', length: 'long', style: 'hairpins', bank: true, cross: true, theme: 'docks', time: 'night' }, 1234567).code; })();
  const link = await R.openPage(env, R.SMALL, { firstVisit: true, query: 'auto=1&track=' + code.slice(0, 4) + '-' + code.slice(4, 8) + '-' + code.slice(8) });
  const landed = await link.page.evaluate(() => ({ state: window.__loop.app.state, code: window.__loop.lab.state().code, message: (document.querySelector('.lab .status') || {}).textContent || '', bridges: window.__loop.lab.state().track.bridges }));
  await link.page.evaluate(() => { window.__feel.draw = false; });
  await link.page.click('button[data-action="lab-drive"]');
  const movedAt = await R.framesUntilMoving(link.page, MOVE_BUDGET);
  const linkClicks = await R.clicks(link.page);
  out.lab.link = { code, landed, movedAt, clicks: linkClicks, errors: link.errors };
  verdict('a ?track= link lands on its track in the Lab, one click from a moving car', landed.state === 'lab' && landed.code === code && landed.bridges === 1 && movedAt >= 0 && linkClicks === 1 && link.errors.length === 0, landed.message + '; clicks ' + linkClicks);
  await link.close();
  const bad = await R.openPage(env, R.SMALL, { firstVisit: true, query: 'auto=1&track=' + code.slice(0, 11) + (code[11] === 'A' ? 'B' : 'A') });
  const badLanded = await bad.page.evaluate(() => ({ state: window.__loop.app.state, message: (document.querySelector('.lab .status.bad') || {}).textContent || '', hasTrack: !!window.__loop.lab.state().track }));
  out.lab.badLink = { ...badLanded, errors: bad.errors };
  verdict('a tampered link is refused with a plain message on the Lab, a fresh track shown, no error', badLanded.state === 'lab' && /not a track code/i.test(badLanded.message) && badLanded.hasTrack && bad.errors.length === 0, badLanded.message);
  await bad.close();
}

/* ---- 5. saves ---- */
if (run('saves')) {
  console.log('\n== 5. saves');
  out.saves = {};
  // a. a save in main's shape: a run here, then the new fields taken out, as main wrote it
  const side = await R.openPage(env, R.PORTRAIT, { firstVisit: true, query: 'auto=1&title=1' });
  await side.page.evaluate(() => { window.__feel.draw = false; const S = window.__loop.save; S.addCoins(2400); S.buyCar('hatch', 900); S.buyUpgrade('hatch', 'grip'); S.chooseCar('hatch'); S.setPaint('hatch', 'lime'); S.careerResult(1, 1, 610); S.dailyResult('2026-11-07', 2, 900); });
  await R.beginRun(side.page, 'career', 0, { drift: '*' });
  await R.driveToResults(side.page, RUN_BUDGET);
  const KEY = await side.page.evaluate(() => window.__loop.save.KEY);
  const full = await R.saveState(side.page);
  const mainShape = { v: full.v, coins: full.coins, car: full.car, cars: full.cars, career: full.career, daily: full.daily, ghosts: full.ghosts, starPay: true };
  await side.page.evaluate(([k, blob]) => localStorage.setItem(k, blob), [KEY, JSON.stringify(mainShape)]);
  await R.reload(side.page);
  const loaded = await R.saveState(side.page), status = await R.saveStatus(side.page);
  const kept = ['coins', 'car', 'cars', 'career', 'daily', 'ghosts'].every(k => JSON.stringify(loaded[k]) === JSON.stringify(mainShape[k]));
  const landed = await side.page.evaluate(() => window.__loop.app.state);
  out.saves.mainShape = { keys: Object.keys(mainShape), loadedKeys: Object.keys(loaded), kept, fixes: status.repaired, onboarded: loaded.onboarded, missions: loaded.missions, lab: loaded.lab, landed, coins: loaded.coins, ghosts: Object.keys(loaded.ghosts) };
  verdict('a save in main\'s shape loads with coins, cars, upgrades, stars, the daily and the ghosts kept, no fixes, the new fields at their defaults, and the title (it has finished runs)', kept && status.repaired === 0 && loaded.onboarded === false && JSON.stringify(loaded.missions) === '{}' && JSON.stringify(loaded.lab) === JSON.stringify({ codes: {}, last: '' }) && landed === 'title', 'coins ' + loaded.coins + ', car ' + loaded.car + ', ghosts ' + Object.keys(loaded.ghosts).join(','));
  // b. a corrupted save with the new fields wrong
  const corrupt = JSON.stringify({ ...mainShape, coins: 'abc', onboarded: 'yes', missions: { 'career:0': [1, 0], 'career:1': [1, 'x', 0], 'daily:bad': [0, 0, 0], 'career:2': [1, 1, 1] }, lab: { codes: { TOOSHORT: { best: 1, when: 1 }, 'ABCDEFGH1234': { best: 'x' }, 'ABCDEFGH5678': { best: 50, when: 5, stars: 9 } }, last: 'not a code' } });
  await side.page.evaluate(([k, blob]) => localStorage.setItem(k, blob), [KEY, corrupt]);
  await R.reload(side.page);
  const fixed = await R.saveState(side.page), st2 = await R.saveStatus(side.page);
  await side.page.evaluate(() => { window.__feel.draw = false; });
  await R.beginRun(side.page, 'career', 0, { drift: null });
  const run2 = await R.driveToResults(side.page, RUN_BUDGET);
  await side.page.evaluate(() => { window.__loop.action('lab'); });
  const labOk = await side.page.evaluate(() => window.__loop.app.state === 'lab' && !!window.__loop.lab.state().track);
  const ka = await side.page.evaluate(async blob => {
    const m = await import('./src/loop/save.js');
    const raw = JSON.parse(blob);
    const inv = s => s && typeof s.coins === 'number' && s.coins >= 0 && typeof s.onboarded === 'boolean' && Object.values(s.missions).every(e => Array.isArray(e) && e.length === 3 && e.every(v => v === 0 || v === 1)) && Object.keys(s.lab.codes).every(k => /^[0-9A-Z]{12}$/.test(k) && typeof s.lab.codes[k].best === 'number' && s.lab.codes[k].stars <= 3) && /^([0-9A-Z]{12})?$/.test(s.lab.last);
    let rawOk; try { rawOk = !!inv(raw); } catch (e) { rawOk = false; }
    const rep = m.repair(raw);
    return { rawPasses: rawOk, repairedPasses: !!inv(rep.state), fixes: rep.fixes };
  }, corrupt);
  out.saves.corrupted = { fixes: st2.repaired, state: { coins: fixed.coins, onboarded: fixed.onboarded, missions: fixed.missions, lab: fixed.lab }, runFinished: run2.finished, labOk, errors: side.errors.slice(), knownAnswer: { ...ka, caught: !ka.rawPasses && ka.repairedPasses } };
  verdict('a corrupted save with the new fields wrong loads to a valid state (the good mission and code kept), the game runs and the Lab opens', st2.repaired > 0 && fixed.coins === 0 && fixed.onboarded === false && JSON.stringify(Object.keys(fixed.missions)) === '["career:2"]' && JSON.stringify(Object.keys(fixed.lab.codes)) === '["ABCDEFGH5678"]' && fixed.lab.codes.ABCDEFGH5678.stars === 3 && fixed.lab.last === '' && run2.finished && labOk && side.errors.length === 0, st2.repaired + ' fixes, missions ' + JSON.stringify(fixed.missions) + ', lab ' + JSON.stringify(fixed.lab.codes));
  verdict('known answer: the corrupted save fails the invariants raw and passes them repaired', out.saves.corrupted.knownAnswer.caught, ka.fixes + ' fixes');
  await side.close();
  // c. storage throwing: the first visit still lands in the onboarding run, the Lab still works
  const ctx = await env.browser.newContext({ viewport: R.PORTRAIT, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(`(function () { window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {}; Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage is off'); }, configurable: true }); })();`);
  await page.goto(env.url + '?renderer=webgl2&auto=1', { waitUntil: 'load', timeout: 120000 });
  await R.waitReady(page);
  const thrown = await page.evaluate(() => ({ state: window.__loop.app.state, onboard: window.__loop.onboard.active, available: window.__loop.save.status.available }));
  await page.evaluate(() => { window.__feel.draw = false; window.__feel.setDriver({ drift: '*' }); });
  const r3 = await R.driveToResults(page, RUN_BUDGET);
  await page.evaluate(() => { window.__loop.action('lab'); window.__loop.action('lab-set', 'theme=docks'); });
  const lab3 = await page.evaluate(() => ({ state: window.__loop.app.state, code: window.__loop.lab.state().code, failedWrites: window.__loop.save.status.failedWrites, writes: window.__loop.save.status.writes }));
  out.saves.throwing = { ...thrown, runFinished: r3.finished, missions: r3.results && r3.results.missions.map(m => m.doneNow), lab: lab3, errors };
  verdict('with localStorage throwing the first visit lands in the onboarding run, it finishes, and the Lab works, no error', thrown.state === 'countdown' && thrown.onboard && !thrown.available && r3.finished && lab3.state === 'lab' && !!lab3.code && errors.length === 0, 'storage available ' + thrown.available + ', ' + lab3.writes + ' writes went nowhere');
  await ctx.close();
}

/* ---- 6. perf ---- */
if (run('perf')) {
  console.log('\n== 6. perf');
  const FRAMES = 420, warm = 30;
  async function measure(throttle, loadMs) {
    const side = await R.openPage(env, R.PORTRAIT, { firstVisit: true, query: 'auto=1&title=1' });
    await R.beginRun(side.page, 'career', 0, { drift: '*' });
    await R.driveToResults(side.page, RUN_BUDGET);
    const cdp = await side.context.newCDPSession(side.page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await R.beginRun(side.page, 'again', null, { drift: '*' });
    await side.page.evaluate(({ loadMs }) => {
      const F = window.__feel; F.draw = true;
      if (loadMs) { const step = F.world.stepWorld; F.world.stepWorld = inp => { const t0 = performance.now(); let g = 0; while (performance.now() - t0 < loadMs / 2 && g++ < 1e9) {} return step(inp); }; }
    }, { loadMs: loadMs || 0 });
    const frames = await R.runFrames(side.page, FRAMES, 'return { ms: F.info().frameMs, phys: F.info().physMs, submit: F.scene.info().submitMs, ghost: !!window.__loop.ghostState() && !window.__loop.ghostState().done, state: window.__loop.app.state, missions: !!window.__loop.missions() };');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await side.close();
    const body = frames.slice(warm);
    return { throttle, loadMs: loadMs || 0, frames: frames.length, ghostRunningFrames: body.filter(f => f.ghost).length, missionsJudged: body.every(f => f.missions), allDriving: body.every(f => f.state === 'drive'), frame: R.stat(body.map(f => f.ms)), jsWithoutSubmit: R.stat(body.map(f => f.ms - f.submit)), physics: R.stat(body.map(f => f.phys)), submit: R.stat(body.map(f => f.submit)) };
  }
  const at6 = await measure(6, 0);
  let baseline = null;
  try { const j = JSON.parse(fs.readFileSync(path.join(R.root, 'review', 'retention', 'perf-main.json'), 'utf8')); baseline = j.runs.find(r => r.throttle === 6); } catch (e) { baseline = null; }
  const basep95 = baseline ? baseline.jsWithoutSubmit.p95 : null;
  const noise = basep95 === null ? null : Math.max(1.5, basep95 * 0.35);
  const within = basep95 !== null && Math.abs(at6.jsWithoutSubmit.p95 - basep95) <= noise;
  console.log('6x: js without submit p95 ' + at6.jsWithoutSubmit.p95 + ' worst ' + at6.jsWithoutSubmit.worst + ' ms; physics p95 ' + at6.physics.p95 + '; main here: ' + basep95);
  const loaded = await measure(6, 20);
  const rise = loaded.jsWithoutSubmit.p95 - at6.jsWithoutSubmit.p95;
  out.perf = { note: 'review/retention/perf-main.json is review/loop/perf.json as main produced it in this sandbox, kept for the comparison', budgetMs: 16.7, at6, baselineAt6: baseline, noiseMs: noise, withinNoise: within, knownAnswer: { loadMs: 20, p95Before: at6.jsWithoutSubmit.p95, p95Loaded: loaded.jsWithoutSubmit.p95, rise: +rise.toFixed(2), caught: rise > 12 && loaded.jsWithoutSubmit.p95 >= 16.7 } };
  verdict('JavaScript p95 at 6x with the ghost and the missions judged is within noise of main\'s in this sandbox and under the budget', within && at6.jsWithoutSubmit.p95 < 16.7 && at6.ghostRunningFrames > 0 && at6.missionsJudged, at6.jsWithoutSubmit.p95 + ' ms against ' + basep95 + ' (noise ' + (noise && noise.toFixed(1)) + ')');
  verdict('known answer: 20 ms of busy work per frame flips the verdict', out.perf.knownAnswer.caught, at6.jsWithoutSubmit.p95 + ' -> ' + loaded.jsWithoutSubmit.p95 + ' ms');
}

/* ---- shots: every new screen and prompt, four sizes ---- */
if (run('shots')) {
  console.log('\n== shots');
  const dir = path.join(R.reviewDir, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  out.shots = [];
  const labCode = await (async () => { const m = await import('../../src/lab/lab.js'); return m.labSpec({ kind: 'circuit', length: 'long', style: 'hairpins', bank: true, cross: true, theme: 'docks', time: 'night' }, 1234567).code; })();
  for (const [vname, vp, touch] of [['390x844', R.PORTRAIT, true], ['844x390', R.PHONE_LANDSCAPE, true], ['800x450', R.SMALL, false], ['1280x720', R.LANDSCAPE, false]]) {
    const shot = async (side, name, prep) => {
      if (prep) await prep();
      await side.page.evaluate(() => { window.__feel.draw = true; });
      await R.runFrames(side.page, 1);
      const file = path.join(dir, name + '-' + vname + '.png');
      await side.page.screenshot({ path: file, timeout: 120000 });
      out.shots.push({ file: path.relative(R.reviewDir, file), viewport: vname, screen: name });
      console.log('wrote ' + file);
    };
    /* until a condition holds in the page, in chunks of frames; false if it never did */
    const until = async (side, cond, maxFrames) => { for (let k = 0; k < maxFrames; k += 15) { await R.runFrames(side.page, 15); if (await side.page.evaluate(cond)) return true; } return false; };
    // the onboarding run, first visit
    const ob = await R.openPage(env, vp, { firstVisit: true, touch, query: 'auto=1' });
    await ob.page.evaluate(() => { window.__feel.draw = false; });
    await shot(ob, 'onboard-steer', async () => { await R.runFrames(ob.page, 60 * 4); });
    await shot(ob, 'onboard-drift', async () => {
      await ob.page.evaluate(() => { window.__feel.draw = false; window.__feel.inject = { steer: 1, throttle: 1, brake: 0, handbrake: 0 }; });
      await R.runFrames(ob.page, 45);
      await ob.page.evaluate(() => { window.__feel.inject = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }; });
      await until(ob, () => window.__loop.onboard.state.step === 'drift', 60 * 8);
    });
    await shot(ob, 'onboard-brake', async () => {
      await ob.page.evaluate(() => { window.__feel.draw = false; window.__feel.inject = { steer: -1, throttle: 1, brake: 0, handbrake: 1 }; });
      await until(ob, () => window.__loop.onboard.state.done.drift, 60 * 6);
      await ob.page.evaluate(() => { window.__feel.inject = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }; });
      await until(ob, () => window.__loop.onboard.state.step === 'brake', 60 * 4);
    });
    await shot(ob, 'onboard-chain', async () => {
      await ob.page.evaluate(() => { window.__feel.draw = false; window.__feel.inject = null; window.__feel.setDriver({ drift: '*' }); });
      await until(ob, () => window.__loop.onboard.state.infoKind === 'chain', 60 * 60);
    });
    await shot(ob, 'onboard-clean', async () => {
      await ob.page.evaluate(() => { window.__feel.draw = false; });
      await until(ob, () => window.__loop.onboard.state.infoKind === 'clean', 60 * 90);
    });
    await ob.close();
    // the menus and a run with missions
    const side = await R.openPage(env, vp, { firstVisit: true, touch, query: 'auto=1&title=1' });
    await side.page.evaluate(() => { window.__feel.draw = false; const S = window.__loop.save; S.addCoins(2400); S.buyCar('hatch', 900); S.careerResult(0, 2, 1480); S.careerResult(1, 1, 610); S.missionResult('career:0', [true, false, true]); S.missionResult('career:1', [false, true, false]); window.__clock = 1000; });
    await shot(side, 'title', async () => { await side.page.evaluate(() => window.__loop.action('title')); await R.runFrames(side.page, 30); });
    await shot(side, 'career', async () => { await side.page.evaluate(() => window.__loop.action('career')); });
    await shot(side, 'countdown-missions', async () => { await side.page.evaluate(() => { window.__loop.action('play-career', '1'); window.__feel.draw = false; }); await R.runFrames(side.page, 70); });
    await shot(side, 'mission-complete', async () => {
      await R.beginRun(side.page, 'career', 3, { drift: '*' });
      await R.installClipper(side.page);
      /* a callout lives 1.5 s of real time and fades by a CSS animation; a
         software rendered screenshot takes longer than that, so for this
         shot the removal is held off and the animation frozen mid way */
      await side.page.evaluate(() => { window.__feel.draw = false; const st = window.setTimeout; window.__setTimeout = st; window.setTimeout = (fn, ms) => st(fn, ms >= 1500 ? 60000 : ms); document.head.insertAdjacentHTML('beforeend', '<style id="hold">.callout { animation-delay: -0.4s !important; animation-play-state: paused !important; }</style>'); });
      await until(side, () => window.__loop.missions() && window.__loop.missions().completed > 0 && document.querySelector('.callout.mission') !== null, 60 * 120);
      await side.page.evaluate(() => { for (const e of document.querySelectorAll('.callout:not(.mission)')) e.remove(); });   // the held score callouts of the last seconds, which in play have faded
    });
    await side.page.evaluate(() => { window.setTimeout = window.__setTimeout; const h = document.getElementById('hold'); if (h) h.remove(); });
    await shot(side, 'results-missions', async () => { await R.driveToResults(side.page, RUN_BUDGET); });
    await shot(side, 'lab', async () => { await side.page.evaluate(code => { const Lp = window.__loop, r = Lp.lab.specFromCode(code); Lp.lab.setLab(r.spec.settings, r.spec.seed); Lp.action('lab'); }, labCode); });
    await shot(side, 'lab-results', async () => {
      await side.page.evaluate(() => window.__loop.action('lab-drive'));
      await side.page.evaluate(() => { window.__feel.draw = false; window.__feel.setDriver({ drift: '*' }); });
      await R.runFrames(side.page, 240);
      await R.driveToResults(side.page, RUN_BUDGET);
    });
    await shot(side, 'lab-bad-code', async () => { await side.page.evaluate(() => { window.__loop.action('lab'); window.__loop.action('lab-code', 'H3TT-J0XB-EKQZ'); }); });
    await side.close();
    const link = await R.openPage(env, vp, { firstVisit: true, touch, query: 'auto=1&track=' + labCode });
    await shot(link, 'lab-link', async () => { await link.page.evaluate(() => { window.__clock = 1000; }); await R.runFrames(link.page, 5); });
    await link.close();
  }
}

await env.close();
for (const k of Object.keys(out)) R.writeJson(path.join(R.reviewDir, k + '.json'), { started, note, ...out[k] });
console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '; wrote review/retention/' + Object.keys(out).map(k => k + '.json').join(', '));
process.exit(failed ? 1 : 0);
