/* THE PACE ROUND'S FIRST LOOK (briefs/RIVALS-PACE.md): before a robust
   search (ladder3/search.js), which only climbs from where it starts,
   where on his track a rival can score faster at all. Random sets of
   the look ahead driver's numbers with a player's hands (driftrace/search.js
   HAND_RANGES), each driven once, undisturbed, in Node, in each car and
   upgrade step asked; a set is kept when that run is clean with room
   (no respawn, no hard hit, at most one scrape, every corner at least
   35 per cent sliding, the driving bar met, the race 60 to 120 s), and
   printed with its multiple (ladder3/ruler.js threeStarRate). Half the
   sets are drawn near a proven driving (--near, roster ids), half from
   the whole range. A start for a search, not a measure.

   node game/test/pace/explore.js r4 --track 12 --cars tourer,fastback --ups 2,3 --laps 3 --n 400 --seed 1 [--near r3,r4] [--min 3.5] [--robust 2] */
import fs from 'node:fs';
import { measureRival } from '../rivals/sim.js';
import { misses, DISTURB } from '../driftrace/hands.js';
import { HAND_RANGES } from '../driftrace/search.js';
import { threeStarRate } from '../ladder3/ruler.js';
import { rivalById } from '../../src/rivals/roster.js';
import { RIVAL_DRIVE } from '../../src/rivals/driver.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec } from '../../src/loop/modes.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const base = rivalById(args.find(a => /^r\d$/.test(a)));
const track = +arg('--track', base.track), laps = +arg('--laps', base.laps || 3), n = +arg('--n', 400), min = +arg('--min', 0);
const cars = arg('--cars', base.car).split(','), ups = arg('--ups', '0').split(',').map(Number);
const near = arg('--near', '').split(',').filter(Boolean).map(id => /^r\d$/.test(id) ? rivalById(id).drive : JSON.parse(fs.readFileSync(id, 'utf8')));   // roster ids, or files holding a driving
const star = threeStarRate(trackFor(careerSpec(track)));
let rs = +arg('--seed', 1);
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const round = (k, v) => /KEEP|COST|PROGRESS/.test(k) ? Math.round(v) : /TIME|GAIN|OUTSIDE/.test(k) ? +v.toFixed(3) : +v.toFixed(2);
console.log('exploring ' + base.name + ' on career ' + (track + 1) + ', ' + laps + ' laps, cars ' + cars + ', steps ' + ups + ', three star rate ' + star.toFixed(2));
for (let k = 0; k < n; k++) {
  let drive;
  if (near.length && k % 2 === 0) {
    drive = { ...RIVAL_DRIVE, ...near[(k / 2) % near.length] };
    for (const key of Object.keys(HAND_RANGES)) if (rnd() < 0.4) { const [a, b] = HAND_RANGES[key]; drive[key] = round(key, Math.max(a, Math.min(b, drive[key] + (rnd() - 0.5) * (b - a) * 0.4))); }
    drive = Object.fromEntries(Object.keys(HAND_RANGES).map(key => [key, drive[key]]));
  } else drive = Object.fromEntries(Object.entries(HAND_RANGES).map(([key, [a, b]]) => [key, round(key, a + (b - a) * rnd())]));
  const car = cars[Math.floor(rnd() * cars.length)], up = ups[Math.floor(rnd() * ups.length)];
  const def = { ...base, track, laps, car, up: { power: up, grip: up, steer: up }, drive };
  let m; try { m = measureRival(def, { maxSeconds: 200 }); } catch (e) { continue; }
  const mult = m.total / m.seconds / star;
  if (m.hard || m.respawns || m.contacts > 1 || m.worstCorner < 0.35 || misses(m).length || m.seconds < 60 || m.seconds > 120 || mult < min) continue;
  /* --robust: a find is also driven over the 20 disturbances, and how many miss the bar is printed; --robust N stops at the first that misses more than N */
  let disturbed;
  if (args.includes('--robust')) { const cap = +arg('--robust', 20); disturbed = 0; for (const d of DISTURB) { if (misses(measureRival(def, d), m).length) disturbed++; if (disturbed > cap) break; } }
  console.log(JSON.stringify({ k, car, up, disturbed, s: m.seconds, total: m.total, mult: +mult.toFixed(2), cont: m.contacts, corner: +m.worstCorner.toFixed(2), best: m.best, angle: +(m.corners.reduce((a, c) => a + c.angle, 0) / m.corners.length).toFixed(1), drive }));
}
console.log('done');
