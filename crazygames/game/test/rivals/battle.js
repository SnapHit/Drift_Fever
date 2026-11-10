/* A BATTLE IN NODE, for iterating and for the measurements' many runs:
   the host's per step code (game/src/main.js stepOnce and driveStep) for
   a battle: the rival's step, then the player's world with the rival
   solid in it, the tandem, the scoring with the tandem's multiplier,
   the progress, the race, the line (the open chain banked and the pace
   paid), and the rival run on to his line if the player finished first.
   The page probes are the record; this is the same code without the
   page, so a run costs a second.

   player: a function (world, rival) => input, or a driver object */
import { createWorld, STEP } from '../../src/physics/world.js';
import { createScoring } from '../../src/scoring/drift.js';
import { createProgress } from '../../src/loop/progress.js';
import { createRace } from '../../src/scoring/race.js';
import { createTandem } from '../../src/scoring/tandem.js';
import { createRival } from '../../src/rivals/rival.js';
import { createChaseDriver } from '../../src/rivals/chase.js';
import { createDriver } from '../../src/physics/driver.js';
import { carTune } from '../../src/garage/roster.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec, battleLaps } from '../../src/loop/modes.js';
import { TUNE, TANDEM } from '../../src/tune.js';

const q = r => ({ steer: Math.round(r.steer * 1000) / 1000, throttle: Math.round(r.throttle * 100) / 100, brake: Math.round(r.brake * 100) / 100, handbrake: r.handbrake ? 1 : 0 });

/* who: 'chase', 'careful', 'drifter', 'still', or a function (world, rival) => input
   opts: { car, up, rivalOpts, noRival (the rival drives but is not in the player's world), solid (false: not solid), maxSeconds, onStep } */
export function runBattle(def, who, opts) {
  const o = opts || {};
  const track = trackFor(careerSpec(def.track)), laps = battleLaps(track);
  const world = createWorld(track, { tune: carTune(o.car || 'starter', o.up) });
  const scoring = createScoring(), progress = createProgress(track, laps), race = createRace(track, laps, scoring), tandem = createTandem();
  const rival = createRival(track, def, laps, o.rivalOpts);
  if (o.solid !== false) world.obstacle = () => rival.body();
  let drive;
  if (typeof who === 'function') drive = w => who(w, rival);
  else if (who === 'chase') { const d = createChaseDriver(track, rival, o.chase); drive = w => d.input(w); }
  else if (who === 'careful') { const d = createDriver(track, { drift: null }); drive = w => d.input(w); }
  else if (who === 'drifter') { const d = createDriver(track, { drift: '*' }); drive = w => d.input(w); }
  else drive = () => ({ steer: 0, throttle: 0, brake: 0, handbrake: 0 });
  let dist = track.start.along || 0, along = world.along, t = 0;
  const L = track.length, limit = Math.round((o.maxSeconds || 300) / STEP);
  let finished = false, i = 0;
  for (; i < limit; i++) {
    const inp = q(drive(world));
    rival.step();
    world.stepWorld(inp);
    let d = world.along - along; if (track.kind === 'circuit') { if (d < -L / 2) d += L; else if (d > L / 2) d -= L; }
    dist += d; along = world.along;
    const S = TUNE.SCORING, c = world.car, ang = Math.abs(c.slip) * 180 / Math.PI;
    tandem.step(world, rival, dist, ang >= S.MIN_ANGLE && c.speed >= S.MIN_SPEED && c.vx > 0);
    scoring.step(world, STEP, tandem.state);
    progress.step(world);
    race.step(world, progress.state);
    t += STEP;
    if (o.onStep) o.onStep({ world, rival, tandem: tandem.state, scoring: scoring.state, i, t });
    if (progress.state.finished) { scoring.bank(); race.finish(t); finished = true; break; }
  }
  if (!rival.state.finished) rival.finishRun();
  const T = tandem.state, s = scoring.state;
  return {
    finished, seconds: +t.toFixed(2), score: s.total, rival: rival.scoring.state.total, rivalSeconds: +rival.state.finishTime.toFixed(2), won: s.total >= rival.scoring.state.total, margin: s.total - rival.scoring.state.total,
    tandem: s.tandem, drift: s.drift, clean: s.clean, pace: s.pace,
    zoneShare: T.rivalSlideT ? +(T.zoneT / T.rivalSlideT).toFixed(3) : 0, closeShare: T.rivalSlideT ? +(T.closeT / T.rivalSlideT).toFixed(3) : 0, bothShare: T.rivalSlideT ? +(T.bothT / T.rivalSlideT).toFixed(3) : 0,
    wallHits: world.hits - world.bodyHits, hard: world.hardHits - world.bodyHardHits, bodyHits: world.bodyHits, bodyHard: world.bodyHardHits, respawns: 0,
    rivalHash: rival.hash(), hash: world.hash(),
  };
}

if (process.argv[1] && process.argv[1].endsWith('battle.js')) {
  const { rivalById } = await import('../../src/rivals/roster.js');
  const args = process.argv.slice(2);
  const def = rivalById(args.find(a => /^r\d/.test(a)) || 'r1');
  for (const who of ['chase', 'careful', 'drifter', 'still']) console.log(who.padEnd(8), JSON.stringify(runBattle(def, who)));
  const b = TANDEM.BONUS; TANDEM.BONUS = 0; console.log('chase, no bonus', JSON.stringify(runBattle(def, 'chase'))); TANDEM.BONUS = b;
}
