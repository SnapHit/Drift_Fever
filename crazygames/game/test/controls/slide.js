/* THE THROTTLE STEERS THE SLIDE, AND A SLIDE CAN BE LOST
   (briefs/PRO-CONTROLS.md, measures 3 and 4). On each variant and on
   Easy, in the game's page: the stunt park started as a player starts it
   (so the handling is the object the game builds for that run, the
   player's car with the profile over it), and the trials of trials.js
   stepped through the game's physics world on the park's own ground with
   its solids taken out, so nothing is ever hit (a trial runs up to 137 by
   171 m). The car is given 20 m/s straight ahead first.

   3. A handbrake entry, then the throttle held at three levels (0.7,
      0.85 and full) with half countersteer: the held angle (the mean over
      the last second of three) must rise with the throttle, each a slide
      that scores (12 degrees or more), is not a spin and is not a pivot
      (8 m/s or more), and lifting must close it under 10 degrees within
      a second. The angle against the
      throttle at every countersteer is kept for the report.
      Known answer: on Easy, where the controller holds the angle the
      steering asks for, the same inputs show no rise (countersteer ends
      the slide), and the probe says so.
   4. The same entry, then full throttle with no countersteer, both with
      the steering let go and held into the slide: on each variant the
      car spins (the nose more than 90 degrees from the travel) within
      three seconds; on Easy it does not.
      Known answer: variant c with every anti-spin number of the assist
      at its full (Easy) strength is caught as unspinnable.

   node game/test/controls/slide.js   writes review/controls/slide.json */
import * as R from './lib.js';
import { slideTrial, spinTrial, TRIAL } from './trials.js';

const env = await R.start(), out = { trial: TRIAL, profiles: {} };
const LEVELS = [0.7, 0.85, 1], HALF = -0.5;
const TABLE_T = [0, 0.25, 0.5, 0.625, 0.75, 0.875, 1], TABLE_C = [0.5, 0, -0.25, -0.5, -0.75, -1];
const FULL = ['DRIFT_HOLD', 'SPIN_GAIN', 'SPIN_ANGLE', 'ANGLE_LIMIT', 'ANGLE_PULL', 'THROTTLE_EASE', 'YAW_SOFT', 'YAW_MAX'];

async function measure(profile, fullAssist) {
  const pg = await R.profilePage(env, null, profile);
  const r = await pg.page.evaluate(async ({ slideSrc, spinSrc, TRIAL, LEVELS, HALF, TABLE_T, TABLE_C, fullKeys }) => {
    const L = window.__loop, F = window.__feel; F.draw = false;
    L.action('free');
    const W = await import('/src/physics/world.js');
    const tune = F.world.tune;
    if (fullKeys) for (const k of fullKeys) tune.ASSIST[k] = F.TUNE.ASSIST[k];
    const ground = Object.assign({}, L.app.ground, { walls: [], cones: [] });
    const slideTrial = new Function('TRIAL', 'return ' + slideSrc)(TRIAL), spinTrial = new Function('TRIAL', 'slideTrial', 'return ' + spinSrc)(TRIAL, slideTrial);
    const fresh = () => { const w = W.createWorld(ground, { tune }); w.car.x = 0; w.car.z = 0; w.car.yaw = 0; w.car.wvx = 0; w.car.wvz = -20; return w; };
    const go = (fn, T, C) => { const w = fresh(); const res = fn(inp => w.stepWorld(inp), w.car, T, C); res.hits = w.hits; delete res.box; return res; };
    const rise = LEVELS.map(T => go(slideTrial, T, HALF));
    const table = {};
    for (const C of TABLE_C) table[C] = TABLE_T.map(T => go(slideTrial, T, C));
    const spins = { letGo: go(spinTrial, 1, 0), into: go(spinTrial, 1, 1) };
    return { profile: L.profile(), tuneName: tune ? 'own' : 'TUNE', rise, table, spins };
  }, { slideSrc: slideTrial.toString(), spinSrc: spinTrial.toString(), TRIAL, LEVELS, HALF, TABLE_T, TABLE_C, fullKeys: fullAssist ? FULL : null });
  r.errors = pg.errors.length;
  await pg.close();
  return r;
}

const held = x => x.spun === null && x.held >= 12 && x.minSpeed >= 8 && x.closed !== null && x.closed <= 1 && x.hits === 0;   // a slide, not a pivot: still 8 m/s or more
const fmt = x => x.spun ? 'spin' : !(Math.abs(x.held) >= 8) ? 'straight' : x.minSpeed < 8 ? 'a pivot at ' + Math.round(x.held) : Math.round(x.held) + (x.closed !== null && x.closed <= 1 ? '' : ' (lift: not closed in 1 s)');
for (const p of ['easy', ...R.VARIANTS]) {
  const r = out.profiles[p] = await measure(p);
  const rise = r.rise, rising = rise.every(held) && rise[1].held > rise[0].held + 3 && rise[2].held > rise[1].held + 3;
  const line = rise.map((x, i) => 'throttle ' + LEVELS[i] + ': ' + fmt(x)).join(', ');
  if (p === 'easy') R.verdict(!rising && r.profile.controls === 'easy', 'known answer: on Easy the same inputs show no rise with the throttle (' + line + '), and the probe says so: ' + (rising ? 'MISSED' : 'CAUGHT'));
  else R.verdict(rising && r.profile.controls === 'pro' && r.profile.variant === p, 'variant ' + p + ': with half countersteer the held angle rises with the throttle and lifting closes it inside a second: ' + line + '; closed in ' + rise.map(x => x.closed === null ? 'never' : x.closed.toFixed(2) + ' s').join(', '));
  const sp = r.spins, spunLetGo = sp.letGo.spunAfter !== null && sp.letGo.spunAfter <= 3, spunInto = sp.into.spunAfter !== null && sp.into.spunAfter <= 3;
  const say = x => x.spunAfter === null ? 'no spin' : 'spun ' + x.spunAfter.toFixed(2) + ' s after the entry';
  if (p === 'easy') R.verdict(!spunLetGo && !spunInto, 'Easy: full throttle with no countersteer does not spin (steering let go: ' + say(sp.letGo) + '; held into the slide: ' + say(sp.into) + ')');
  else R.verdict(spunLetGo && spunInto, 'variant ' + p + ': full throttle with no countersteer spins within 3 s (steering let go: ' + say(sp.letGo) + '; held into the slide: ' + say(sp.into) + ')');
  R.verdict(r.errors === 0, p + ': no page errors (' + r.errors + ')');
}
/* the known answer for 4: the assist at full strength cannot be spun */
const k = out.profiles['c, assist at full strength'] = await measure('c', true);
const unspun = k.spins.letGo.spunAfter === null && k.spins.into.spunAfter === null;
R.verdict(unspun, 'known answer: variant c with the assist at full strength (' + FULL.join(', ') + ' at their Easy values) is caught as unspinnable: ' + (unspun ? 'CAUGHT' : 'MISSED, it spun'));
/* the angle against the throttle, for the report */
for (const p of Object.keys(out.profiles)) {
  console.log('\n' + p + ': held angle (degrees) by countersteer (rows, negative is against the slide) and throttle (columns); spin, . straightened, pivot: under 8 m/s, * not closed a second after lifting');
  console.log('        ' + TABLE_T.map(T => String(T).padStart(9)).join(''));
  for (const C of TABLE_C) console.log(String(C).padStart(6) + '  ' + out.profiles[p].table[C].map(x => (x.spun ? 'spin' : !(Math.abs(x.held) >= 8) ? '.' : (x.minSpeed < 8 ? 'pivot ' : '') + String(Math.round(x.held)) + (x.closed !== null && x.closed <= 1 ? '' : '*')).padStart(9)).join(''));
}
await env.close();
process.exit(R.finish('slide', out) ? 1 : 0);
