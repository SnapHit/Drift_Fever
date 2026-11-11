/* A REPLACEMENT SEED FOR A CAREER SLOT, measured as the chapters round
   measured its seeds (game/test/chapters/seeds.js: generates in time,
   both scripted drivers finish with no respawn, the careful driver
   clean to a star, nothing occludes the road), with two things added
   after play on 11 November 2026 ("the corners aren't sharp enough to
   get a drift going"): how many drift corners it has (radius at most
   DRIFT.RADIUS, at least DRIFT.ANGLE of turn, no hairpin tighter than
   DRIFT.TOO_TIGHT for a Rookie), and what a strong driver with a
   player's controls scores on it against three stars (reach.js).

   node game/test/stars/slot.js <career index> <seed,seed,...> [--n 30] */
import { careerSpec, CAREER, lapsFor, starTargets } from '../../src/loop/modes.js';
import { trackFor } from '../../src/ground/source.js';
import { measure, check } from '../chapters/seeds.js';
import { reach } from './reach.js';

export const DRIFT = { RADIUS: 42, ANGLE: 85, TOO_TIGHT: 22 };
export function driftCorners(t) { return t.corners.filter(c => c.radius <= DRIFT.RADIUS && Math.abs(c.angle) >= DRIFT.ANGLE).length; }

if (process.argv[1] && process.argv[1].endsWith('slot.js')) {
  const args = process.argv.slice(2), i = +args[0], n = args.includes('--n') ? +args[args.indexOf('--n') + 1] : 30;
  for (const seed of args[1].split(',').map(Number)) {
    const spec = Object.assign({}, careerSpec(i), { seed }), t = trackFor(spec);
    const m = measure(spec), fails = check(m, spec), targets = starTargets(t, lapsFor(t)), b = reach(spec, n, 7 + i);
    console.log(JSON.stringify({ index: i, slot: CAREER[i].name, seed, length: Math.round(t.length), corners: t.corners.map(c => c.type + ' ' + Math.round(c.radius) + ' m ' + Math.round(Math.abs(c.angle)) + ' deg'), drift: driftCorners(t), tightest: Math.round(Math.min(...t.corners.map(c => c.radius))), banked: m.banked, genMs: m.genMs,
      careful: { score: m.careful.score, stars: m.careful.stars, contacts: m.careful.contacts, respawns: m.careful.respawns, seconds: m.careful.seconds }, drifter: { score: m.drifter.score, stars: m.drifter.stars, respawns: m.drifter.respawns },
      occlusion: m.occlusion, fails, targets, reach: b, reachShare3: b ? +(b.total / targets[2]).toFixed(2) : 0 }));
  }
}
