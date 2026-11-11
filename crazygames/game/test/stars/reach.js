/* CAN A STRONG DRIVER REACH THREE STARS? (after play, 11 November 2026:
   "it's impossible for a player to get three stars on the track
   regardless of how skilled they are"). For a career track, or a
   candidate seed for its slot, the rivals round's look-ahead driver
   (rivals/driver.js) drives the solo run in the starter with no
   upgrades, over N random sets of its driving numbers and then N near
   the best; the mark is the best total of a run that finishes with no
   respawn. It is a floor on what skill can score, not a ceiling: a
   better driver than this one may exist. Node's Math is not Chromium's
   to the last bit, so this is a search, not a record.

   node game/test/stars/reach.js [--n 40] [--track i] [--seeds a,b,c]   */
import { measureCore, LAUNCH } from '../rivals/sim.js';
import { RANGES } from '../rivals/search.js';
import { STEP } from '../../src/physics/world.js';
import { createRival } from '../../src/rivals/rival.js';
import { RIVAL_DRIVE } from '../../src/rivals/driver.js';
import { trackFor } from '../../src/ground/source.js';
import { CAREER, careerSpec, lapsFor, starTargets } from '../../src/loop/modes.js';

const HANDS = !process.argv.includes('--free');   // --free: the driver may also brake and lift, which a player cannot
let rs = 1;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const round = (k, v) => /KEEP|COST|PROGRESS/.test(k) ? Math.round(v) : +v.toFixed(3);

/* spec: a career spec (possibly with another seed) */
export function reach(spec, n, seed) {
  rs = seed || 1;
  const deps = { createRival, trackFor, careerSpec: () => spec, battleLaps: lapsFor, STEP, LAUNCH };
  const def = { id: 'reach', name: 'reach', car: 'starter', paint: 'white', track: 0, side: 0, drive: {} };
  const run = drive => { const m = measureCore(deps, { ...def, drive }, { maxSeconds: 300, hands: HANDS }); return { ok: m.finished && m.respawns === 0, total: m.total, drift: m.drift, clean: m.clean, pace: m.pace, seconds: m.seconds, hits: m.contacts, mean: +m.meanCorner.toFixed(2) }; };
  let best = null, bestDrive = {};
  for (let k = 0; k < n * 2; k++) {
    const local = k >= n && best, drive = Object.assign({}, local ? bestDrive : {});
    for (const key of Object.keys(RANGES)) {
      const [a, b] = RANGES[key];
      if (local) { if (rnd() < 0.3) { const cur = drive[key] !== undefined ? drive[key] : RIVAL_DRIVE[key]; drive[key] = round(key, Math.max(a, Math.min(b, cur + (rnd() - 0.5) * (b - a) * 0.25))); } }
      else drive[key] = round(key, a + (b - a) * rnd());
    }
    const r = run(drive);
    if (r.ok && (!best || r.total > best.total)) { best = r; bestDrive = drive; }
  }
  return best;
}

if (process.argv[1] && process.argv[1].endsWith('reach.js')) {
  const args = process.argv.slice(2), arg = k => args.includes(k) ? args[args.indexOf(k) + 1] : null;
  const n = +(arg('--n') || 40), only = arg('--track'), seeds = arg('--seeds');
  const list = only !== null ? [+only] : CAREER.map((_, i) => i);
  for (const i of list) {
    for (const seed of seeds ? seeds.split(',').map(Number) : [CAREER[i].seed]) {
      const spec = Object.assign({}, careerSpec(i), { seed });
      let track; try { track = trackFor(spec); } catch (e) { console.log(JSON.stringify({ index: i, seed, error: String(e) })); continue; }
      const targets = starTargets(track, lapsFor(track)), t0 = Date.now(), b = reach(spec, n, 7 + i);
      console.log(JSON.stringify({ index: i, name: CAREER[i].name, seed, kind: track.kind, length: Math.round(track.length), corners: track.corners.length, targets, best: b, stars: b ? targets.filter(t => b.total >= t).length : 0, share3: b ? +(b.total / targets[2]).toFixed(2) : 0, ms: Date.now() - t0 }));
    }
  }
}
