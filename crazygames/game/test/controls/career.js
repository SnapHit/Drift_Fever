/* DRIVEN BY KEYS ON THREE CAREER TRACKS (briefs/PRO-CONTROLS.md: "drive
   it yourself through the probes' inputs on every variant on three
   career tracks. If a slide on Pro cannot be held on purpose by a
   careful input, or holding it is no different from Easy, it is not
   done"). The careful driver of driver.js presses W, S, the arrows and
   space as real key events, sixty times a second, into the game's own
   input (Pro's bindings, the throttle ramp, the steering's slew), on
   career 1 (First slide), 2 (Harbour run) and 3 (Crossover) in the
   starter, each run to its finish. Its numbers for each variant were
   chosen by a search in Node over its own driving numbers (DRIVE below;
   the search kept the variant fixed and charged for wall contact,
   respawns and spins, and paid for time sliding).

   Per run: finished, the time, seconds sliding (12 degrees or more at 6
   m/s or more, short of a spin), the held slides (one held 1.5 s or
   more counts), spins, wall hits and hard ones, respawns.
   On purpose: every variant holds slides of 1.5 s or more on every
   track, with no spin and no respawn. The difference from Easy: the
   same hands, the same key events, on Easy's handling (the Pro keys
   kept, the car as Easy builds it) slide for under half as long, because
   countersteer there ends the slide the controller was holding.
   Known answer: the same hands on Easy's handling are caught by the
   on-purpose bar (short of it on at least one track).

   node game/test/controls/career.js   writes review/controls/career.json */
import * as R from './lib.js';
import { createProDriver, PRO_DRIVER } from './driver.js';

/* the driver's numbers per variant, from the search (seeds 11, 12, 13, 120 tries each over three tracks) */
export const DRIVE = {
  a: { ENTRY_SPEED: 26.223, LEAD: 2.513, HB_TIME: 0.219, CURVE_BAND: 0.006, CURVE_LIFT: 0.029, DRIFT_LOOK: 17.973, DRIFT_LOOK_GAIN: 0.326, ANGLE_MAX: 63.198, ANGLE_MIN: 16.725, APPROACH: 71.972 },
  b: { ENTRY_SPEED: 21.308, LEAD: 0.314, HB_TIME: 0.313, CURVE_BAND: 0.003, CURVE_LIFT: 0.028, DRIFT_LOOK: 18.204, DRIFT_LOOK_GAIN: 0.616, ANGLE_MAX: 63.007, ANGLE_MIN: 6.16, APPROACH: 84.976 },
  c: { ENTRY_SPEED: 27.636, LEAD: 3.071, HB_TIME: 0.19, CURVE_BAND: 0.002, CURVE_LIFT: 0.021, DRIFT_LOOK: 14.174, DRIFT_LOOK_GAIN: 0.691, ANGLE_MAX: 47.319, ANGLE_MIN: 14.973, APPROACH: 75.703 },
};
const TRACKS = [0, 1, 2], HELD = 1.5;

const env = await R.start(), out = { tracks: TRACKS, drive: DRIVE, runs: {} };
async function run(variant, index, easyHandling) {
  const pg = await R.profilePage(env, null, variant);
  const r = await pg.page.evaluate(({ src, base, opts, index, easyHandling, HELD }) => {
    const L = window.__loop, F = window.__feel; F.draw = false;
    const createProDriver = new Function('PRO_DRIVER', 'return ' + src)(base);
    if (easyHandling) L.controls.setEasyPreferred(true);
    L.startRun(L.careerSpec(index)); L.skipCountdown();
    if (easyHandling) { F.input.setMode('pro'); L.controls.setEasyPreferred(false); }   // Pro's keys on the car as Easy builds it
    const drv = createProDriver(L.app.ground, opts);
    const KEYS = { up: ['w', 'KeyW'], down: ['s', 'KeyS'], left: ['a', 'KeyA'], right: ['d', 'KeyD'], hb: [' ', 'Space'] }, was = {};
    const send = (k, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { key: KEYS[k][0], code: KEYS[k][1], bubbles: true }));
    const o = { finished: false, slideT: 0, slides: [], cur: 0, spins: 0, hits: 0, hard: 0, respawns: 0, spinning: false };
    if (window.__clock === undefined) window.__clock = 1000;
    for (let f = 0; f < 60 * 240 && (L.app.state === 'drive' || L.app.state === 'countdown'); f++) {
      const w = F.world, k = drv.decide(w);
      for (const name of Object.keys(KEYS)) if (!!k[name] !== !!was[name]) { send(name, k[name]); was[name] = !!k[name]; }
      const step0 = w.step;
      window.__clock += 1000 / 60; F.frame(window.__clock);
      const c = F.world.car, slip = Math.abs(Math.atan2(c.vy, c.vx) * 180 / Math.PI), dt = (F.world.step - step0) / 120;
      if (F.world.hit) { o.hits++; if (F.world.hit.hard) o.hard++; }
      if (F.world.respawned) o.respawns++;
      if (c.speed > 2 && slip > 90) { if (!o.spinning) o.spins++; o.spinning = true; } else if (slip < 60) o.spinning = false;
      const sliding = c.speed >= 6 && slip >= 12 && slip < 90;
      if (sliding) { o.slideT += dt; o.cur += dt; } else if (o.cur > 0) { o.slides.push(o.cur); o.cur = 0; }
    }
    if (o.cur > 0) o.slides.push(o.cur);
    for (const name of Object.keys(KEYS)) if (was[name]) send(name, false);
    const res = L.results();
    return { profile: L.profile(), handling: easyHandling ? 'easy' : 'pro', mode: F.input.mode, finished: !!(res && res.finished), seconds: res ? +res.seconds.toFixed(1) : null, score: res ? res.score : null,
      slideT: +o.slideT.toFixed(1), held: o.slides.filter(s => s >= HELD).length, longest: +Math.max(0, ...o.slides).toFixed(1), spins: o.spins, hits: o.hits, hard: o.hard, respawns: o.respawns };
  }, { src: createProDriver.toString(), base: PRO_DRIVER, opts: DRIVE[variant], index, easyHandling, HELD });
  r.errors = pg.errors.length; await pg.close();
  return r;
}
const say = r => (r.finished ? 'finished in ' + r.seconds + ' s' : 'NOT FINISHED') + ', sliding ' + r.slideT + ' s, ' + r.held + ' slides held ' + HELD + ' s or more (longest ' + r.longest + ' s), ' + r.spins + ' spins, ' + r.hits + ' wall hits (' + r.hard + ' hard), ' + r.respawns + ' respawns';
let easyShort = false;
for (const v of R.VARIANTS) {
  for (const i of TRACKS) {
    const pro = out.runs[v + ' ' + i] = await run(v, i, false);
    const easy = out.runs[v + ' ' + i + ' on Easy handling'] = await run(v, i, true);
    const onPurpose = pro.finished && pro.held >= 1 && pro.spins === 0 && pro.respawns === 0 && pro.profile.variant === v && pro.mode === 'pro';
    R.verdict(onPurpose && pro.errors === 0, 'variant ' + v + ', career ' + (i + 1) + ': ' + say(pro));
    const differs = easy.slideT < pro.slideT * 0.5;
    if (!(easy.finished && easy.held >= 1 && easy.spins === 0 && easy.respawns === 0)) easyShort = true;
    R.verdict(differs && easy.handling === 'easy' && easy.mode === 'pro', '  the same hands on Easy\'s handling slide for under half as long: ' + say(easy));
  }
}
R.verdict(easyShort, 'known answer: the same hands on Easy\'s handling fall short of the on-purpose bar on at least one track: ' + (easyShort ? 'CAUGHT' : 'MISSED'));
await env.close();
process.exit(R.finish('career', out) ? 1 : 0);
