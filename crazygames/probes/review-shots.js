/* THE REVIEW SET. The reviewer cannot play the branch, so this drives the
   greybox page and the original with the same parity tape to the same
   frame and screenshots both, side by side, at 390x844 and 1280x720:
   the title screen, the countdown, a deep drift, a jump in the air, a
   hazard approach, contact with a racer, a wreck, a gate, the finish and
   the run card. The frames are found by a scouting drive on the page
   (the parity test says the two sides are identical frame for frame, so
   the frame numbers carry across). JPEG, so the set stays under 5MB.

   node probes/review-shots.js   writes review/stage-2/shots/*.jpg and shots.json */
import fs from 'node:fs';
import path from 'node:path';
import * as L from './lib.js';
import * as J from '../parity/jobs.js';

const days = J.dayList(20261001, 28);
const outDir = path.join(L.root, 'review', 'stage-2', 'shots');
fs.mkdirSync(outDir, { recursive: true });
const env = await L.start();

/* ---- scout: which frames show what ---- */
const jobs = {
  drive: { day: days[0], level: 3, mode: 'DAILY', seed: J.seedOf(days[0], 3, 'driver'), tape: 'driver', maxFrames: 4200, finishFrames: 700 },
  racers: { day: days[0], level: 5, mode: 'DAILY', seed: J.seedOf(days[0], 5, 'hug'), tape: 'hug', maxFrames: 2200 },
  finish: { day: days[0], level: 1, mode: 'DAILY', seed: J.seedOf(days[0], 1, 'driver'), tape: 'driver', maxFrames: 3600, finishFrames: 700 },
  wreck: null,   // chosen by the scout: the first tape that dies to a hazard
};
const wreckCandidates = [[6, 'hug', 3000], [4, 'chaos', 2500], [5, 'swing', 2500], [6, 'chaos', 3000], [3, 'hug', 3000]].map(([level, tape, maxFrames]) => ({ day: days[0], level, mode: 'DAILY', seed: J.seedOf(days[0], level, tape), tape, maxFrames }));
const scout = await L.openSide(env, 'page', J.VIEW, days[0]);
const found = await scout.page.evaluate(({ jobs }) => {
  const S = window.__S, F = S.get('FEEL');
  const renderer = S.world.renderer; renderer.render = () => {};
  const out = {};
  {
    let best = { drift: [0, -1], jump: [0, -1], hazard: null, gate: null, finish: null, countdown: null, card: null };
    let finishedAt = null, lastGates = 0;
    window.driveProbe.drive(S, jobs.drive, { frame: (n) => {
      const st = S.get('state');
      if (st === S.get('DRIVING')) {
        if (best.countdown === null && S.get('countdown') > 0 && n > 25) best.countdown = n;
        const slip = S.get('drift').slipNorm; if (slip > best.drift[0] && S.get('carY') === 0) best.drift = [slip, n];
        if (S.get('airborne') && S.get('carY') > best.jump[0]) best.jump = [S.get('carY'), n];
        const idx = S.get('carSegIndex');
        if (best.hazard === null) for (const h of S.get('hazards')) if (h.from - idx > 24 && h.from - idx < 30) { best.hazard = n; break; }
        if (S.get('gatesPassed') > lastGates && best.gate === null) best.gate = n - 12;
        lastGates = S.get('gatesPassed');
      }
    } });
    out.drive = { countdown: best.countdown, drift: best.drift[1], jump: best.jump[1], hazard: best.hazard, gate: best.gate, slip: best.drift[0], carY: best.jump[0] };
  }
  {
    let finishedAt = null, finish = null, card = null;
    window.driveProbe.drive(S, jobs.finish, { frame: (n) => { if (S.get('state') === S.get('FINISHED')) { if (finishedAt === null) finishedAt = n; if (n === finishedAt + 20) finish = n; if (n === finishedAt + 420) card = n; } } });
    out.finish = { finish, card };
  }
  {
    let contact = null;
    window.driveProbe.drive(S, jobs.racers, { frame: (n) => { if (contact === null && S.world.probe.lastContacts.length) contact = n; } });
    out.racers = { contact };
  }
  {
    let wreck = null, job = null;
    for (const cand of wreckCandidates) {
      window.driveProbe.drive(S, cand, { frame: (n, _, info) => { if (wreck === null && info.after === S.get('DEAD') && S.get('deathKind') === S.get('HIT_OBJECT')) wreck = n + 4; } });
      if (wreck !== null) { job = cand; break; }
    }
    out.wreck = { wreck, job };
  }
  return out;
}, { jobs, wreckCandidates });
jobs.wreck = found.wreck.job;
await scout.close();
console.log('frames: ' + JSON.stringify(found));

const scenes = [
  { name: '01-title', job: null, frame: 0 },
  { name: '02-countdown', job: 'drive', frame: found.drive.countdown },
  { name: '03-deep-drift', job: 'drive', frame: found.drive.drift },
  { name: '04-jump-in-the-air', job: 'drive', frame: found.drive.jump },
  { name: '05-hazard-approach', job: 'drive', frame: found.drive.hazard },
  { name: '06-contact-with-a-racer', job: 'racers', frame: found.racers.contact },
  { name: '07-wreck', job: 'wreck', frame: found.wreck.wreck },
  { name: '08-gate', job: 'drive', frame: found.drive.gate },
  { name: '09-finish', job: 'finish', frame: found.finish.finish },
  { name: '10-run-card', job: 'finish', frame: found.finish.card },
].filter(s => s.frame !== null && s.frame >= 0 && (!s.job || jobs[s.job]));

/* ---- shoot: both sides to the frame, then screenshot ---- */
async function shoot(side, viewport, scene) {
  const s = await L.openSide(env, side, viewport, days[0]);
  if (scene.job) {
    /* The greybox skips its GPU submission on the way to the frame (its
       scene is rebuilt from the simulation every frame, so only the last
       one needs drawing); the original draws every frame, as it must. */
    await s.page.evaluate(({ job, frame, page }) => {
      const S = window.__S;
      let real = null;
      if (page) { real = S.world.renderer.render; S.world.renderer.render = () => {}; }
      window.driveProbe.drive(S, { ...job, maxFrames: frame + 1 }, {});
      if (page) { S.world.renderer.render = real; S.world.renderer.render(S.world.scene, S.world.camera); }
    }, { job: jobs[scene.job], frame: scene.frame, page: side === 'page' });
  } else {
    // the title screen, with the boot splash over: the page's own frame, called by hand
    await s.page.evaluate(() => { const S = window.__S; S.set('lastTime', 0); let t = 0; for (let i = 0; i < 150; i++) { t += 17; S.fn.__frame(t); } });
  }
  const png = await s.page.screenshot({ type: 'png' });
  const errors = s.errors.slice();
  await s.close();
  return { png, errors };
}
const index = [];
const composer = await env.browser.newPage({ viewport: { width: 100, height: 100 } });
let totalBytes = 0;
for (const viewport of [J.VIEW, J.VIEW_WIDE]) {
  for (const scene of scenes) {
    const a = await shoot('page', viewport, scene), b = await shoot('original', viewport, scene);
    const jpg = await composer.evaluate(async ({ a, b, w, h, label }) => {
      const load = src => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = src; });
      const ia = await load('data:image/png;base64,' + a), ib = await load('data:image/png;base64,' + b);
      const gap = 12, bar = 22;
      const c = document.createElement('canvas'); c.width = w * 2 + gap; c.height = h + bar;
      const g = c.getContext('2d');
      g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(ia, 0, bar); g.drawImage(ib, w + gap, bar);
      g.fillStyle = '#fff'; g.font = '600 13px system-ui, sans-serif';
      g.fillText('greybox  ' + label, 6, 15); g.fillText('live game  ' + label, w + gap + 6, 15);
      return c.toDataURL('image/jpeg', 0.78).split(',')[1];
    }, { a: a.png.toString('base64'), b: b.png.toString('base64'), w: viewport.width, h: viewport.height, label: scene.name.slice(3).replace(/-/g, ' ') + (scene.job ? ' (frame ' + scene.frame + ')' : '') });
    const file = scene.name + '-' + viewport.width + 'x' + viewport.height + '.jpg';
    const buf = Buffer.from(jpg, 'base64');
    fs.writeFileSync(path.join(outDir, file), buf);
    totalBytes += buf.length;
    index.push({ file, scene: scene.name, viewport: viewport.width + 'x' + viewport.height, job: scene.job, frame: scene.frame, bytes: buf.length, errors: { page: a.errors, original: b.errors } });
    console.log('  ' + file + ' ' + buf.length + ' bytes');
  }
}
await composer.close();
await env.close();
fs.writeFileSync(path.join(L.root, 'review', 'stage-2', 'shots.json'), JSON.stringify({ frames: found, jobs, shots: index, totalBytes }, null, 1));
console.log('review set: ' + index.length + ' images, ' + (totalBytes / 1048576).toFixed(2) + ' MB');
