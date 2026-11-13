/* THE PACE ROUND: a found driving in the setups around it (briefs/RIVALS-PACE.md
   lets laps, car and upgrade steps change). Each setup driven undisturbed and
   over the 20 disturbances in Node, then, when that run is clean and at most
   --cap disturbed runs miss, on the plateau (ladder2/plateau.js). Not a search
   of the driving: the numbers are as given.
   node game/test/pace/around.js r4 <drive JSON> --track 12 --cars fastback --ups 2,3 --laps 3,4 [--cap 2] [--no-plateau] */
import { measureRival } from '../rivals/sim.js';
import { DISTURB, misses } from '../driftrace/hands.js';
import { plateau } from '../ladder2/plateau.js';
import { threeStarRate } from '../ladder3/ruler.js';
import { rivalById } from '../../src/rivals/roster.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec } from '../../src/loop/modes.js';
const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const base = rivalById(args[0]), drive = JSON.parse(args[1]);
const track = +arg('--track', base.track), cap = +arg('--cap', 2), star = threeStarRate(trackFor(careerSpec(track)));
for (const car of arg('--cars', base.car).split(',')) for (const up of arg('--ups', '0').split(',').map(Number)) for (const laps of arg('--laps', String(base.laps)).split(',').map(Number)) {
  const def = { ...base, track, car, laps, up: { power: up, grip: up, steer: up }, drive };
  const m = measureRival(def), own = misses(m);
  const bad = DISTURB.map(d => misses(measureRival(def, d), m)).filter(w => w.length);
  const row = { car, up, laps, s: m.seconds, total: m.total, mult: +(m.total / m.seconds / star).toFixed(2), hard: m.hard, cont: m.contacts, own: own.join(','), disturbed: bad.length };
  if (!own.length && bad.length <= cap && !args.includes('--no-plateau')) { const p = plateau(def); row.plateau = p.missedVariants; row.plateauWhy = p.missed.map(r => r.key + (r.to > r.from ? '+' : '-') + ' ' + r.why[0]).join(' | '); }
  console.log(JSON.stringify(row));
}
