/* MEASURE 1, THE CLUNK (briefs/FIRST-MINUTE.md). A newcomer's first
   run, from an empty save, from the title's start here button to the
   results, with the prompts on, played by scripted strangers
   (thumbs.js): on a phone at 390x844 by the touch buttons (Easy), and on
   a desktop at 1280x720 by keys (Pro variant a, what a keyboard gets).
   RUNS disturbed runs each (each seed a different stranger), on main
   (from git) and on this branch with ?first=2, the same strangers on
   both. Every number of the brief's priority 1 (measure.js), each with
   its median and its worst over the runs, and the steering open loop:
   on the run's own handling, on a flat plane, a tap of 50, 100 and 200
   ms and a held button, at the speeds track 1 is driven.
   Known answer: main with the steering slowed to half (STEER_RATE and
   STEER_RETURN) reads as worse on this probe's own numbers (the score,
   the time, the wall contacts and the speed, at least three of four).

   node game/test/first/newcomer.js [--runs 10] [--only touch|keys] [--no-known]   writes review/first/newcomer.json */
import path from 'node:path';
import * as F from './lib.js';
import { clunk, summarise } from './measure.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const RUNS = +arg('--runs', 10), ONLY = arg('--only', null);
const INPUTS = [{ name: 'touch', vp: F.PHONE, touch: true, query: '' }, { name: 'keys', vp: F.DESKTOP, touch: false, query: 'pro=a' }].filter(i => !ONLY || i.name === ONLY);
const SEEDS = Array.from({ length: RUNS }, (_, i) => 1 + i);
const HALF = 'const T = window.__feel.TUNE.VEHICLE; T.STEER_RATE *= 0.5; T.STEER_RETURN *= 0.5;';

/* the steering open loop, in the page, on the handling the first run is given */
const STEER = `return (async () => {
  const V = await import('/src/physics/vehicle.js');
  const L = window.__loop, F = window.__feel, A = L.app;
  const btn = document.querySelector('#screens.on [data-action="first"]'); if (btn) btn.click();
  const tune = F.world.tune, DEG = 180 / Math.PI, STEP = V.STEP;
  const up = v => { const s = V.createVehicle(0, 0, 0, tune); for (let i = 0; i < 120 * 30 && s.speed < v; i++) V.stepVehicle(s, { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, STEP); return s; };
  const out = { taps: [], holds: [] };
  for (const v of [14, 20, 25]) for (const ms of [50, 100, 200]) {
    const s = up(v), y0 = s.yaw, x0 = s.x, n = Math.round(ms / 1000 / STEP);
    for (let i = 0; i < Math.round(1.5 / STEP); i++) V.stepVehicle(s, { steer: i < n ? 1 : 0, throttle: 1, brake: 0, handbrake: 0 }, STEP);
    out.taps.push({ v, ms, turnedDeg: +(Math.abs(s.yaw - y0) * DEG).toFixed(1), sidewaysM: +Math.abs(s.x - x0).toFixed(2) });
  }
  for (const v of [14, 20, 25]) {
    const s = up(v); let sumR = 0, sumV = 0, k = 0;
    const N = Math.round(6 / STEP);
    for (let i = 0; i < N; i++) { V.stepVehicle(s, { steer: 1, throttle: 1, brake: 0, handbrake: 0 }, STEP); if (i > N - 120) { sumR += Math.abs(s.r); sumV += s.speed; k++; } }
    out.holds.push({ v, settlesMs: +(sumV / k).toFixed(1), yawDegS: +(sumR / k * DEG).toFixed(1), radiusM: +((sumV / k) / (sumR / k)).toFixed(1) });
  }
  L.action('title');
  return out;
})();`;

async function sideRuns(sideName, query, tweak) {
  const S = await F.side(sideName);
  const env = await S.R.start();
  const res = {};
  try {
    for (const inp of INPUTS) {
      const q = [inp.query, query].filter(Boolean).join('&');
      const pg = await F.freshPage(env, S.R, inp.vp, q, inp.touch);
      if (tweak) await pg.page.evaluate(new Function(tweak));
      const steer = await pg.page.evaluate(new Function(STEER));
      const runs = [];
      for (const seed of SEEDS) {
        await pg.page.evaluate(() => { const L = window.__loop; try { localStorage.clear(); } catch (e) { /* none */ } L.save.reset(); L.action('title'); });
        const r = await pg.page.evaluate(({ seed, pro }) => window.__first.run(seed, { pro }), { seed, pro: inp.name === 'keys' });
        if (r.error) throw new Error(sideName + ' ' + inp.name + ' seed ' + seed + ': ' + r.error);
        runs.push({ seed, profile: r.profile, onboard: r.onboard, ...clunk(r, F.COLS) });
      }
      res[inp.name] = { steer, runs, summary: summarise(runs), errors: pg.errors.slice(0, 5) };
      await pg.close();
    }
  } finally { await env.close(); }
  return res;
}

const main = await sideRuns('main', '');
const branch = await sideRuns('branch', 'first=2');
const out = { main: F.mainCommit(), runs: RUNS, seeds: SEEDS, inputs: INPUTS.map(i => i.name), sides: { main, branch } };

/* the table: every number, median (worst), main against the branch */
const fmt = x => x === null || x === undefined ? '-' : typeof x === 'object' ? x.median + ' (' + x.worst + ')' : String(x);
for (const inp of INPUTS) {
  const a = main[inp.name], b = branch[inp.name];
  console.log('\n== ' + inp.name + ' (' + inp.vp.width + 'x' + inp.vp.height + ', ' + RUNS + ' strangers): median (worst), main | ?first=2');
  console.log('runs with a star: ' + a.summary.withStar + ' | ' + b.summary.withStar + ' of ' + RUNS);
  for (const k of Object.keys(a.summary)) { if (['runs', 'withStar', 'finished'].includes(k)) continue; console.log('  ' + k.padEnd(22) + fmt(a.summary[k]).padEnd(22) + '| ' + fmt(b.summary[k])); }
  console.log('  steering open loop, main: taps ' + a.steer.taps.map(t => t.v + 'm/s ' + t.ms + 'ms ' + t.turnedDeg + 'deg').join(', ') + '; held ' + a.steer.holds.map(h => h.v + 'm/s settles ' + h.settlesMs + ' on ' + h.radiusM + ' m').join(', '));
  console.log('  steering open loop, ?first=2: taps ' + b.steer.taps.map(t => t.v + 'm/s ' + t.ms + 'ms ' + t.turnedDeg + 'deg').join(', ') + '; held ' + b.steer.holds.map(h => h.v + 'm/s settles ' + h.settlesMs + ' on ' + h.radiusM + ' m').join(', '));
  F.say(a.errors.length === 0 && b.errors.length === 0, inp.name + ': no page errors (' + [...a.errors, ...b.errors].join(' | ') + ')');
  F.say(a.summary.finished === RUNS && b.summary.finished === RUNS, inp.name + ': every stranger finished the run on both (' + a.summary.finished + ', ' + b.summary.finished + ')');
}

/* the known answer: main with the steering slowed to half reads as worse */
if (!args.includes('--no-known') && (!ONLY || ONLY === 'touch')) {
  const saved = INPUTS.slice();
  INPUTS.splice(0, INPUTS.length, ...saved.filter(i => i.name === 'touch'));
  const half = await sideRuns('main', '', HALF);
  INPUTS.splice(0, INPUTS.length, ...saved);
  const m = main.touch.summary, h = half.touch.summary;
  const worse = [['score', h.score.median < m.score.median], ['seconds', h.seconds.median > m.seconds.median], ['contactsPerLap', h.contactsPerLap.median > m.contactsPerLap.median], ['meanV', h.meanV.median < m.meanV.median]];
  out.knownAnswer = { half: half.touch.summary, worse: Object.fromEntries(worse) };
  F.say(worse.filter(w => w[1]).length >= 3, 'known answer: main with the steering slowed to half reads as worse on ' + worse.filter(w => w[1]).map(w => w[0]).join(', ') + ' (score ' + m.score.median + ' to ' + h.score.median + ', ' + m.seconds.median + ' to ' + h.seconds.median + ' s, contacts a lap ' + m.contactsPerLap.median + ' to ' + h.contactsPerLap.median + ', speed ' + m.meanV.median + ' to ' + h.meanV.median + ' m/s)');
}
F.writeJson(path.join(F.dir, 'newcomer' + (ONLY ? '-' + ONLY : '') + '.json'), out);
console.log(F.failed() ? F.failed() + ' failed' : 'all passed');
process.exit(F.failed() ? 1 : 0);
