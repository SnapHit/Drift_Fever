/* THE FEEL MEASUREMENTS, FEEL.md "Measure" 1 to 4, each with a known
   answer that can fail. Runs the shipped page in headless Chromium on the
   forced WebGL 2 path through the dev server, drives it with the scripted
   driver through window.__feel, and writes review/feel/*.json.

   node game/test/feel/probes.js [determinism] [drive] [camera] [perf] [shots]
   (no names: everything)

   1. Determinism: a recorded run replayed from its tape gives the same
      hash; the same tape through a different frame cadence gives the
      same hash; one perturbed step gives a different hash.
   2. Drive: the scripted driver laps the test track inside the walls
      without touching them; the drift script holds more than 30 degrees
      cleanly through hairpin 2: over 30 degrees for at least 1.5 s with
      no wall contact. Changed on 29 October 2026 from 2 s through the
      sweeper: a drift now carves and slows the car, so it turns tighter
      than the long fast sweeper; it belongs in a hairpin. Holding a drift
      for longer is also measured in handling.js (DRIFT and steer held). Known answers: the
      driver with its steering inverted, and the drift script without its
      handbrake.
   3. Camera: every frame of those drives keeps the whole car on screen in
      390x844 and 1280x720, including a hit's shake. Known answer: the
      camera looking up at the sky must lose the car.
   4. Perf: JavaScript time per frame at 1x, 4x and 6x CPU throttle on
      forced WebGL 2 at 390x844, p95 and worst, physics time beside it.
      Known answer: 20 ms of busy work per frame must raise the p95 by
      about 20 ms and flip the verdict. */
import path from 'node:path';
import fs from 'node:fs';
import * as L from './lib.js';

const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
const run = name => want.length === 0 || want.includes(name);
const env = await L.start();
const results = { started: new Date().toISOString(), note: 'headless Chromium, forced WebGL 2 on SwiftShader; the GPU half of a frame is not measured here' };
const out = {};
let failed = 0;
function verdict(label, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ': ' + detail : '')); if (!ok) failed++; return ok; }

/* Drive in the page: frames at 60 Hz, two steps each, no drawing, until
   the lap completes or maxFrames. Collects per frame. */
const COLLECT = `
  const w = F.world, c = w.car, on = F.onScreen(0);
  return { i, along: +w.along.toFixed(2), lat: +w.lateral.toFixed(3), hw: w.halfWidth, hits: w.hits, hard: w.hardHits, resp: w.respawned ? 1 : 0, angle: +(Math.abs(c.slip) * 180 / Math.PI).toFixed(2), v: +c.speed.toFixed(2), ex: +on.excess.toFixed(4), corner: on.corner, ms: +F.info().frameMs.toFixed(3), phys: +F.info().physMs.toFixed(3), steps: F.info().steps };
`;
async function drive(page, driverOpts, maxFrames, tuneSet) {
  await page.evaluate(({ driverOpts, tuneSet }) => {
    const F = window.__feel;
    F.draw = false;
    if (tuneSet) for (const [p, v] of tuneSet) { const [g, k] = p.split('.'); F.TUNE[g][k] = v; }
    F.restart();
    F.setDriver(driverOpts);
    window.__clock = 1000;
  }, { driverOpts, tuneSet: tuneSet || null });
  const frames = [];
  let lastAlong = 0, lapped = false;
  const chunk = 120;
  for (let done = 0; done < maxFrames && !lapped; done += chunk) {
    const part = await L.runFrames(page, Math.min(chunk, maxFrames - done), COLLECT);
    for (const f of part) { if (f.along < lastAlong - 300) { lapped = true; frames.push(f); break; } lastAlong = f.along; frames.push(f); }
  }
  const hash = await page.evaluate(() => window.__feel.hash());
  const tape = await page.evaluate(() => window.__feel.tapeCopy());
  return { frames, lapped, hash, tape };
}
function holdAbove(frames, deg, section) {
  let hold = 0, best = 0, sum = 0, n = 0, bestAngle = 0, bestSpeed = 0, vsum = 0;
  for (const f of frames) {
    const inSec = !section || (f.along >= section[0] && f.along <= section[1] + 30);
    if (inSec && f.angle > deg && f.v > 6) { hold += 1 / 60; sum += f.angle; vsum += f.v; n++; if (hold > best) { best = hold; bestAngle = sum / n; bestSpeed = vsum / n; } }
    else { hold = 0; sum = 0; vsum = 0; n = 0; }
  }
  return { seconds: +best.toFixed(2), meanAngle: +bestAngle.toFixed(1), meanKmh: +(bestSpeed * 3.6).toFixed(0) };
}

/* ---- 1. determinism ---- */
if (run('determinism')) {
  console.log('\n== 1. determinism');
  const side = await L.openPage(env, L.LANDSCAPE, 'ground=track');
  const a = await drive(side.page, { drift: 'hairpin2' }, 1500);
  const steps = a.tape.reduce((s, e) => s + e.n, 0);
  const replayed = await side.page.evaluate(t => window.__feel.replay(t), a.tape);
  // the same tape at a different cadence: one step per frame, through the frame function with no driver
  const cadence = await side.page.evaluate(t => {
    const F = window.__feel; F.setDriver(null); F.restart(); F.draw = false;
    // feed the tape through the input record, one step per 120 Hz frame
    let clock = 1000;
    for (const e of t) for (let i = 0; i < e.n; i++) {
      F.inject = { steer: e.s, throttle: e.t, brake: e.b, handbrake: e.h };
      const before = F.world.step;
      let guard = 0;
      while (F.world.step === before && guard++ < 4) { clock += 1000 / 120; F.frame(clock); }
      if (F.world.step !== before + 1) throw new Error('a 120 Hz frame took ' + (F.world.step - before) + ' steps');
    }
    F.inject = null;
    return F.hash();
  }, a.tape);
  // the known answer: one step's steer perturbed by 0.01
  const perturbed = a.tape.map(e => ({ ...e }));
  const mid = Math.floor(perturbed.length / 2);
  perturbed[mid].s = +(perturbed[mid].s + 0.01).toFixed(3);
  const perturbedHash = await side.page.evaluate(t => window.__feel.replay(t), perturbed);
  const same = replayed === a.hash;
  const cadenceSame = cadence === a.hash;
  const differs = perturbedHash !== a.hash;
  out.determinism = { steps, tapeEntries: a.tape.length, hash: a.hash, replayHash: replayed, cadenceHash: cadence, perturbedHash, replayIdentical: same, cadenceIdentical: cadenceSame, knownAnswerCaught: differs, errors: side.errors };
  verdict('replay from tape is bit identical', same, steps + ' steps, ' + a.tape.length + ' tape entries');
  verdict('one step per frame at 120 Hz gives the same hash as two per frame at 60 Hz', cadenceSame);
  verdict('known answer: one perturbed step changes the end state', differs);
  await side.close();
}

/* ---- 2. drive, and 3. camera, over the same drives ---- */
if (run('drive') || run('camera')) {
  console.log('\n== 2. drive and 3. camera');
  out.drive = {}; out.camera = { viewports: {} };
  for (const [vname, vp] of [['1280x720', L.LANDSCAPE], ['390x844', L.PORTRAIT]]) {
    const side = await L.openPage(env, vp, 'ground=track');
    const lap = await drive(side.page, {}, 5400);
    const sections = await side.page.evaluate(() => window.__feel.world.ground.sections);
    const dr = await drive(side.page, { drift: 'hairpin2' }, 5400);
    // a hit for the shake: drive straight into the first wall with the driver off, then watch the camera settle
    const hit = await (async () => {
      await side.page.evaluate(() => { const F = window.__feel; F.setDriver(null); F.restart(); F.draw = false; window.__clock = 1000; F.inject = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }; });
      const a = await L.runFrames(side.page, 200, COLLECT);
      await side.page.evaluate(() => { window.__feel.inject = { steer: 0.6, throttle: 1, brake: 0, handbrake: 0 }; });
      const b = await L.runFrames(side.page, 400, COLLECT);
      await side.page.evaluate(() => { window.__feel.inject = null; });
      return a.concat(b);
    })();
    const all = { lap: lap.frames, drift: dr.frames, hit };
    if (vname === '1280x720') {
      const last = lap.frames[lap.frames.length - 1];
      const maxLat = Math.max(...lap.frames.map(f => Math.abs(f.lat)));
      const hw = lap.frames[0].hw;
      const hold = holdAbove(dr.frames, 30, sections.hairpin2);
      const drLast = dr.frames[dr.frames.length - 1];
      out.drive = { lap: { lapped: lap.lapped, frames: lap.frames.length, seconds: +(lap.frames.length / 60).toFixed(1), maxAbsLateral: +maxLat.toFixed(2), halfWidth: hw, wallContacts: last.hits, hardHits: last.hard, respawns: lap.frames.reduce((s, f) => s + f.resp, 0), topKmh: +(Math.max(...lap.frames.map(f => f.v)) * 3.6).toFixed(0) },
        drift: { lapped: dr.lapped, holdAbove30: hold, wallContacts: drLast.hits, hardHits: drLast.hard, maxAbsLateral: +Math.max(...dr.frames.map(f => Math.abs(f.lat))).toFixed(2), section: 'hairpin2', range: sections.hairpin2, maxAngle: +Math.max(...dr.frames.map(f => f.angle)).toFixed(1) } };
      verdict('driver laps the test track', lap.lapped, out.drive.lap.seconds + ' s');
      verdict('driver stays inside the walls, never touching', maxLat < hw && last.hits === 0 && out.drive.lap.respawns === 0, 'max |lateral| ' + maxLat.toFixed(2) + ' of ' + hw + ' m, contacts ' + last.hits + ', respawns ' + out.drive.lap.respawns);
      verdict('drift script drifts cleanly through hairpin 2: over 30 degrees for at least 1.5 s, no wall contact', hold.seconds >= 1.5 && drLast.hits === 0, hold.seconds + ' s at a mean ' + hold.meanAngle + ' degrees, ' + hold.meanKmh + ' km/h');
      // known answers
      const inv = await drive(side.page, { invert: -1 }, 5400);
      const invLast = inv.frames[inv.frames.length - 1];
      const invBad = !inv.lapped || invLast.hits > 0;
      out.drive.knownAnswerInverted = { lapped: inv.lapped, wallContacts: invLast.hits, caught: invBad };
      verdict('known answer: the inverted driver fails to lap cleanly', invBad, 'lapped ' + inv.lapped + ', contacts ' + invLast.hits);
      const noHb = await side.page.evaluate(async () => { const m = await import('./src/physics/driver.js'); const hb = m.DRIVER.DRIFT_HB; m.DRIVER.DRIFT_HB = 0; return hb; });
      const dr0 = await drive(side.page, { drift: 'hairpin2' }, 5400);
      await side.page.evaluate(async hb => { const m = await import('./src/physics/driver.js'); m.DRIVER.DRIFT_HB = hb; }, noHb);
      const hold0 = holdAbove(dr0.frames, 30, sections.hairpin2);
      out.drive.knownAnswerNoHandbrake = { holdAbove30: hold0, caught: hold0.seconds < 1.5 };
      verdict('known answer: the drift script without its handbrake cannot hold 1.5 s', hold0.seconds < 1.5, hold0.seconds + ' s');
    }
    // camera
    const cam = {};
    for (const k in all) {
      const fr = all[k];
      const off = fr.filter(f => f.ex > 0);
      const worst = fr.reduce((w, f) => f.ex > w.ex ? f : w, fr[0]);
      cam[k] = { frames: fr.length, offScreenFrames: off.length, worstExcess: worst.ex, worstFrame: worst.i, worstCorner: worst.corner, hits: fr[fr.length - 1].hits };
    }
    // the known answer: the camera looking 30 m up into the sky
    const far = await drive(side.page, { drift: 'hairpin2' }, 900, [['CAMERA.LOOK_UP', 30]]);
    await side.page.evaluate(() => { window.__feel.TUNE.CAMERA.LOOK_UP = 0.7; });
    const farOff = far.frames.filter(f => f.ex > 0).length;
    cam.knownAnswerLookUp = { frames: far.frames.length, offScreenFrames: farOff, caught: farOff > 0 };
    out.camera.viewports[vname] = cam;
    const totalOff = cam.lap.offScreenFrames + cam.drift.offScreenFrames + cam.hit.offScreenFrames;
    verdict('camera keeps the car fully on screen in ' + vname, totalOff === 0 && cam.hit.hits > 0, 'lap ' + cam.lap.frames + ' frames, drift ' + cam.drift.frames + ', hit run ' + cam.hit.frames + ' with ' + cam.hit.hits + ' contacts; off screen ' + totalOff + ', worst excess ' + Math.max(cam.lap.worstExcess, cam.drift.worstExcess, cam.hit.worstExcess).toFixed(3));
    verdict('known answer: a camera looking at the sky loses the car in ' + vname, farOff > 0, farOff + ' of ' + far.frames.length + ' frames off screen');
    out.camera.viewports[vname].errors = side.errors;
    await side.close();
  }
}

/* ---- 4. perf ---- */
if (run('perf')) {
  console.log('\n== 4. perf');
  out.perf = { budgetMs: 16.7, runs: [] };
  const FRAMES = 420;
  async function measure(throttle, loadMs) {
    const side = await L.openPage(env, L.PORTRAIT, 'ground=track');
    const cdp = await side.context.newCDPSession(side.page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await side.page.evaluate(({ loadMs }) => {
      const F = window.__feel; F.draw = true; F.restart(); F.setDriver({ drift: 'hairpin2' }); window.__clock = 1000;
      // the known answer's load: busy work inside every step, so the frame carries about loadMs more JavaScript
      if (loadMs) { const step = F.world.stepWorld; F.world.stepWorld = inp => { const t0 = performance.now(); let g = 0; while (performance.now() - t0 < loadMs / 2 && g++ < 1e9) {} return step(inp); }; }
    }, { loadMs: loadMs || 0 });
    const frames = await L.runFrames(side.page, FRAMES, 'return { ms: F.info().frameMs, phys: F.info().physMs, submit: F.scene.info().submitMs, steps: F.info().steps };');
    const info = await side.page.evaluate(() => window.__feel.scene.info());
    await side.close();
    const warm = 30;
    const body = frames.slice(warm);
    return { throttle, loadMs: loadMs || 0, frames: frames.length, backend: info.backend, tier: info.tier, frame: L.stat(body.map(f => f.ms)), jsWithoutSubmit: L.stat(body.map(f => f.ms - f.submit)), physics: L.stat(body.map(f => f.phys)), submit: L.stat(body.map(f => f.submit)), stepsPerFrame: +(body.reduce((s, f) => s + f.steps, 0) / body.length).toFixed(2), firstFrames: { worst: +Math.max(...frames.slice(0, warm).map(f => f.ms)).toFixed(1) }, errors: side.errors };
  }
  for (const throttle of [1, 4, 6]) {
    const r = await measure(throttle, 0);
    out.perf.runs.push(r);
    console.log('throttle ' + throttle + 'x: frame p95 ' + r.frame.p95 + ' worst ' + r.frame.worst + ' ms; js without submit p95 ' + r.jsWithoutSubmit.p95 + ' worst ' + r.jsWithoutSubmit.worst + '; physics p95 ' + r.physics.p95 + ' worst ' + r.physics.worst + ' (' + r.stepsPerFrame + ' steps); submit p95 ' + r.submit.p95 + '; first frames worst ' + r.firstFrames.worst + '; ' + r.backend + ' ' + r.tier);
  }
  const at6 = out.perf.runs.find(r => r.throttle === 6);
  const holds = at6.jsWithoutSubmit.p95 < out.perf.budgetMs;
  out.perf.summary = { jsWithoutSubmitP95At6x: at6.jsWithoutSubmit.p95, jsWithoutSubmitWorstAt6x: at6.jsWithoutSubmit.worst, frameP95At6x: at6.frame.p95, frameWorstAt6x: at6.frame.worst, physicsP95At6x: at6.physics.p95, holdsBudgetAt6x: holds };
  verdict('JavaScript frame p95 at 6x throttle under 16.7 ms', holds, at6.jsWithoutSubmit.p95 + ' ms, worst ' + at6.jsWithoutSubmit.worst);
  const loaded = await measure(4, 20);
  const base4 = out.perf.runs.find(r => r.throttle === 4);
  const rise = loaded.jsWithoutSubmit.p95 - base4.jsWithoutSubmit.p95;
  out.perf.knownAnswer = { loadMs: 20, atThrottle: 4, p95Before: base4.jsWithoutSubmit.p95, p95Loaded: loaded.jsWithoutSubmit.p95, rise: +rise.toFixed(2), verdictFlipped: loaded.jsWithoutSubmit.p95 >= out.perf.budgetMs, caught: rise > 12 && loaded.jsWithoutSubmit.p95 >= out.perf.budgetMs };
  verdict('known answer: 20 ms of busy work per frame raises the p95 by about 20 ms and fails the budget', out.perf.knownAnswer.caught, 'p95 ' + base4.jsWithoutSubmit.p95 + ' -> ' + loaded.jsWithoutSubmit.p95 + ' ms at 4x');
}

/* ---- shots: the car mid drift in both viewports, and the car park ---- */
if (run('shots')) {
  console.log('\n== shots');
  const dir = path.join(L.reviewDir, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  out.shots = [];
  for (const [vname, vp] of [['1280x720', L.LANDSCAPE], ['390x844', L.PORTRAIT]]) {
    const side = await L.openPage(env, vp, 'ground=track', { touch: vp === L.PORTRAIT });
    const sections = await side.page.evaluate(() => window.__feel.world.ground.sections);
    await side.page.evaluate(() => { const F = window.__feel; F.draw = false; F.restart(); F.setDriver({ drift: 'hairpin2' }); window.__clock = 1000; });
    // to the frame with the biggest angle inside the sweeper
    let best = null, i = 0;
    for (let k = 0; k < 20 && !best; k++) {
      const fr = await L.runFrames(side.page, 60, COLLECT);
      for (const f of fr) { i++; if (f.along >= sections.sweeper[0] && f.along <= sections.sweeper[1] && f.angle > 30 && f.v > 15) { best = f; break; } }
    }
    await side.page.evaluate(() => { window.__feel.draw = true; });
    await L.runFrames(side.page, 1);
    const file = path.join(dir, 'drift-' + vname + '.png');
    await side.page.screenshot({ path: file, timeout: 120000 });
    out.shots.push({ file: path.relative(L.reviewDir, file), viewport: vname, angle: best && best.angle, kmh: best && Math.round(best.v * 3.6) });
    console.log('wrote ' + file + (best ? ' at ' + best.angle + ' degrees, ' + Math.round(best.v * 3.6) + ' km/h' : ''));
    await side.close();
    const park = await L.openPage(env, vp, 'ground=park', { touch: vp === L.PORTRAIT });
    await park.page.evaluate(() => { const F = window.__feel; F.draw = false; F.restart(); window.__clock = 1000; F.inject = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }; });
    await L.runFrames(park.page, 150);
    await park.page.evaluate(() => { window.__feel.inject = { steer: 1, throttle: 1, brake: 0, handbrake: 1 }; });
    await L.runFrames(park.page, 30);
    await park.page.evaluate(() => { window.__feel.inject = { steer: 1, throttle: 1, brake: 0, handbrake: 0 }; });
    await L.runFrames(park.page, 60);
    await park.page.evaluate(() => { window.__feel.draw = true; });
    await L.runFrames(park.page, 1);
    const pfile = path.join(dir, 'park-' + vname + '.png');
    await park.page.screenshot({ path: pfile, timeout: 120000 });
    out.shots.push({ file: path.relative(L.reviewDir, pfile), viewport: vname, ground: 'park' });
    console.log('wrote ' + pfile);
    await park.close();
  }
}

await env.close();
results.failed = failed;
Object.assign(results, out);
for (const k of Object.keys(out)) L.writeJson(path.join(L.reviewDir, k + '.json'), { started: results.started, note: results.note, ...out[k] });
console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '; wrote review/feel/' + Object.keys(out).map(k => k + '.json').join(', '));
process.exit(failed ? 1 : 0);
