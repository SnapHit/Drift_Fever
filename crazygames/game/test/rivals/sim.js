/* THE RIVAL IN NODE, for iterating and for measure 2's disturbances.
   Drives a rival (game/src/rivals/rival.js, the code the game runs) on
   his track to his line, no browser, and reports what the brief asks:
   respawns, hard hits, wall contacts, the lowest speed after the
   launch, the share of each corner spent sliding (scoring), his total.
   Node's Math is not Chromium's to the last bit; the page probes are
   the record, and these numbers agree with them to within that.

   node game/test/rivals/sim.js [rival id] [--all] [--trace] */
import { createRival } from '../../src/rivals/rival.js';
import { RIVALS, rivalById } from '../../src/rivals/roster.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec, battleLaps } from '../../src/loop/modes.js';
import { TANDEM } from '../../src/tune.js';
import { STEP } from '../../src/physics/world.js';

export const LAUNCH = 3;   // s after GO before the lowest speed counts

export function lapsOf(track) { return track.kind === 'circuit' ? TANDEM.LAPS : 1; }

/* The measurement itself, with what it needs handed in, so the same
   function runs in Node (measureRival) and in the page (drive.js), each
   with its own engine's Math. deps: { createRival, trackFor, careerSpec,
   battleLaps, STEP, LAUNCH }; opts: { offset, grip, driveOverride,
   maxSeconds, trace, hits } */
export function measureCore(deps, def, opts) {
  const { createRival, trackFor, careerSpec, battleLaps, STEP, LAUNCH } = deps;
  const o = opts || {};
  const track = trackFor(careerSpec(def.track)), laps = battleLaps(track);
  const r = createRival(track, def, laps, o);
  const w = r.world;
  const corners = [];
  for (let lap = 0; lap < laps; lap++) for (const c of track.corners) corners.push({ name: c.name + (laps > 1 ? ' L' + (lap + 1) : ''), from: c.from + lap * track.length, to: c.to + lap * track.length, t: 0, slide: 0, angleSum: 0, maxAngle: 0 });
  let respawns = 0, minV = Infinity, minVAt = 0;
  const trace = [];
  const limit = Math.round((o.maxSeconds || 300) / STEP);
  for (let i = 0; i < limit && !r.state.finished; i++) {
    r.step();
    if (w.respawned) respawns++;
    if (w.hit && o.hits) o.hits.push({ t: +r.state.runTime.toFixed(2), d: +r.runDistance().toFixed(1), lat: +w.lateral.toFixed(2), hw: +w.halfWidth.toFixed(1), v: +w.car.speed.toFixed(1), speed: +w.hit.speed.toFixed(1), hard: w.hit.hard, md: r.driver.mode });
    const t = r.state.runTime;
    if (t > LAUNCH && w.car.speed < minV) { minV = w.car.speed; minVAt = t; }
    /* metres from his start: the corners are counted from the track's zero, laps apart */
    const d = r.runDistance(), s = r.scoring.state;
    const scoring = s.drifting && s.gap === 0;
    for (const c of corners) if (d >= c.from && d <= c.to) { c.t += STEP; if (scoring) { c.slide += STEP; c.angleSum += s.angle * STEP; if (s.angle > c.maxAngle) c.maxAngle = s.angle; } }
    if (o.trace && i % 12 === 0) trace.push({ t: +t.toFixed(2), d: +d.toFixed(1), lat: +w.lateral.toFixed(2), v: +w.car.speed.toFixed(1), a: +s.angle.toFixed(1), m: s.mult, sc: Math.round(s.total), md: r.driver.mode });
  }
  const s = r.scoring.state;
  const shares = corners.filter(c => c.t > 0).map(c => c.slide / c.t);
  return {
    rival: def.id, track: def.track, finished: r.state.finished, seconds: +r.state.runTime.toFixed(2), total: s.total, drift: s.drift, clean: s.clean, pace: s.pace, best: s.best,
    respawns, hard: w.hardHits, contacts: w.hits, minKmh: +(minV * 3.6).toFixed(1), minAt: +minVAt.toFixed(1),
    corners: corners.map(c => ({ name: c.name, share: c.t ? +(c.slide / c.t).toFixed(3) : 0, angle: c.slide ? +(c.angleSum / c.slide).toFixed(1) : 0, max: +c.maxAngle.toFixed(1), s: +c.t.toFixed(2) })),
    worstCorner: shares.length ? Math.min(...shares) : 0, meanCorner: shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : 0,
    hash: r.hash(), trace,
  };
}

export function measureRival(def, opts) { return measureCore({ createRival, trackFor, careerSpec, battleLaps, STEP, LAUNCH }, def, opts); }

if (process.argv[1] && process.argv[1].endsWith('sim.js')) {
  const args = process.argv.slice(2);
  const list = args.includes('--all') ? RIVALS : [rivalById(args.find(a => /^r\d/.test(a)) || 'r1')];
  for (const def of list) {
    const m = measureRival(def, { trace: args.includes('--trace') });
    console.log(def.id + ' ' + def.name + ' on career ' + (def.track + 1) + ': ' + (m.finished ? 'finished' : 'DID NOT FINISH') + ' in ' + m.seconds + ' s, total ' + m.total + ' (drift ' + m.drift + ', clean ' + m.clean + ', pace ' + m.pace + ', best chain ' + m.best + '), respawns ' + m.respawns + ', hard hits ' + m.hard + ', contacts ' + m.contacts + ', lowest ' + m.minKmh + ' km/h at ' + m.minAt + ' s, worst corner slide share ' + m.worstCorner.toFixed(2));
    for (const c of m.corners) console.log('   ' + c.name.padEnd(16) + ' slide ' + (c.share * 100).toFixed(0).padStart(3) + '%  mean ' + c.angle + ' deg, max ' + c.max + ', ' + c.s + ' s');
    if (args.includes('--trace')) for (const t of m.trace) console.log(JSON.stringify(t));
  }
}
