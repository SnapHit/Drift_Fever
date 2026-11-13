/* AFTER PLAY, 13 November 2026: for one of the last three rivals, every track of his half of his chapter, every car, upgrade step and proven driving, kept when the base run is clean (no hard hit, at most two scrapes, the driving bar met, 50 to 125 s), with its points a second, its multiple of the three star rate and how many of the 20 disturbed runs miss.
   node game/test/play13/scan.js FROM TO ID   (track indices; prints one JSON line a find) */
import { measureRival } from '../rivals/sim.js';
import { DISTURB, misses } from '../driftrace/hands.js';
import { RIVALS, rivalById } from '../../src/rivals/roster.js';
import { CAREER, careerSpec, starRate } from '../../src/loop/modes.js';
import { trackFor } from '../../src/ground/source.js';
const [from, to, id] = process.argv.slice(2);
for (let track = +from; track < +to; track++) for (const src of RIVALS) for (const car of ['starter', 'hatch', 'tourer', 'fastback', 'driftbuild']) for (const k of [0, 1, 2, 3]) for (const laps of [2, 3]) {
  if (CAREER[track].kind !== 'circuit' && laps === 3) continue;
  const def = { ...rivalById(id), track, car, laps, drive: src.drive, up: { power: k, grip: k, steer: k } };
  let b; try { b = measureRival(def); } catch (e) { continue; }
  if (b.hard || b.contacts > 2 || misses(b).length || b.seconds < 50 || b.seconds > 125) continue;
  const mult = (b.total / b.seconds) / (3.5 * starRate(trackFor(careerSpec(track))) * 18);
  const bad = DISTURB.map(d => misses(measureRival(def, d), b)).filter(w => w.length);
  console.log(JSON.stringify({ track, name: CAREER[track].name, car, up: k, laps, drive: src.name, s: +b.seconds.toFixed(1), total: b.total, rate: +(b.total / b.seconds).toFixed(1), mult: +mult.toFixed(2), cont: b.contacts, disturbed: bad.length, why: [...new Set(bad.flat())].slice(0, 3).join(';') }));
}
console.log('done');
