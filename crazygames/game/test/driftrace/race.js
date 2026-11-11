/* A DRIFT RACE IN NODE, for the measurements' many runs: the host's per
   step code for a race (game/src/main.js stepOnce and driveStep): the
   rival's step, then the player's world with the rival solid in it, the
   close bonus, the scoring with its multiplier, the progress, the race's
   clean and pace, the lead gates, the line (the open chain banked and
   the pace paid), and the rival run on to his line if the player
   finished first. The page probes are the record; this is the same code
   without the page.

   who: 'grip', 'slide', 'mixed' (rivals/players.js), 'still', or a
   function (world, rival, ctx) => input. Every scripted player here
   uses only the player's hands; a function's input is checked and the
   run says how many steps broke that (handsBroken).

   node game/test/driftrace/race.js [r1]                                  */
import { createWorld, STEP } from '../../src/physics/world.js';
import { createScoring } from '../../src/scoring/drift.js';
import { createProgress } from '../../src/loop/progress.js';
import { createRace } from '../../src/scoring/race.js';
import { createTandem } from '../../src/scoring/tandem.js';
import { createLead } from '../../src/scoring/lead.js';
import { createRival, gridStart } from '../../src/rivals/rival.js';
import { createPlayer } from '../../src/rivals/players.js';
import { carTune } from '../../src/garage/roster.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec, battleLaps } from '../../src/loop/modes.js';
import { TUNE } from '../../src/tune.js';

const q = r => ({ steer: Math.round(r.steer * 1000) / 1000, throttle: Math.round(r.throttle * 100) / 100, brake: Math.round(r.brake * 100) / 100, handbrake: r.handbrake ? 1 : 0 });
/* a player's hands: the throttle full, no brake (DRIFT with no steering is a handbrake with the wheel straight) */
export const handsOk = inp => inp.throttle === 1 && inp.brake === 0;
export const LAUNCH = 3;   // s after GO before the place counts

/* opts: { car, up, rivalOpts, playerOpts (driving numbers for a scripted player), offset [dx, dz] on the player's start,
   solid (false: the rival not solid), noRival (the rival drives but is not in the player's world),
   maxSeconds, onStep, trace } */
export function runRace(def, who, opts) {
  const o = opts || {};
  const track = trackFor(careerSpec(def.track)), laps = battleLaps(track, def);
  const start = gridStart(track, -(def.side || 1));
  if (o.offset) { start.x += o.offset[0]; start.z += o.offset[1]; }
  const world = createWorld(Object.assign({}, track, { start }), { tune: carTune(o.car || 'starter', o.up) });
  const scoring = createScoring(), progress = createProgress(track, laps), race = createRace(track, laps, scoring), tandem = createTandem(), lead = createLead(track, laps);
  const rival = createRival(track, def, laps, o.rivalOpts);
  if (o.solid !== false && !o.noRival) world.obstacle = () => rival.body();
  let drive;
  const ctx = {};
  if (typeof who === 'function') drive = w => who(w, rival, ctx);
  else if (who === 'still') drive = () => ({ steer: 0, throttle: 0, brake: 0, handbrake: 0 });
  else { const p = createPlayer(track, who, o.playerOpts); drive = w => p.input(w); }
  let dist = track.start.along || 0, along = world.along, t = 0, handsBroken = 0;
  const L = track.length, limit = Math.round((o.maxSeconds || 300) / STEP);
  let finished = false, i = 0, respawns = 0, minV = Infinity;
  /* the place after the launch (LAUNCH s): on a level grid both cars are level at the start, which is not a lead */
  let lastPlace = 0, changes = 0, aheadT = 0, raceT = 0;
  const trace = [];
  for (; i < limit; i++) {
    const inp = q(drive(world));
    if (who !== 'still' && !handsOk(inp)) handsBroken++;
    rival.step();
    world.stepWorld(inp);
    if (world.respawned) respawns++;
    let d = world.along - along; if (track.kind === 'circuit') { if (d < -L / 2) d += L; else if (d > L / 2) d -= L; }
    dist += d; along = world.along;
    ctx.dist = dist;
    const S = TUNE.SCORING, c = world.car, ang = Math.abs(c.slip) * 180 / Math.PI;
    tandem.step(world, rival, dist, ang >= S.MIN_ANGLE && c.speed >= S.MIN_SPEED && c.vx > 0);
    scoring.step(world, STEP, tandem.state);
    progress.step(world);
    race.step(world, progress.state);
    lead.step(progress.state, rival.progress.state, dist, rival.runDistance());
    t += STEP;
    if (t > 3 && c.speed < minV) minV = c.speed;
    if (t > LAUNCH && !rival.state.finished) { const pl = lead.state.place; if (lastPlace && pl !== lastPlace) changes++; lastPlace = pl; raceT += STEP; if (pl === 1) aheadT += STEP; }
    if (o.onStep) o.onStep({ world, rival, tandem: tandem.state, lead: lead.state, scoring: scoring.state, i, t, dist });
    if (o.trace && i % 60 === 0) trace.push({ t: +t.toFixed(1), d: +dist.toFixed(0), rd: +rival.runDistance().toFixed(0), place: lead.state.place, gap: +lead.state.gap.toFixed(2), v: +c.speed.toFixed(1), rv: +rival.world.car.speed.toFixed(1) });
    if (progress.state.finished) { scoring.bank(); race.finish(t); finished = true; break; }
  }
  /* the rival run on to his line, with the gates still stepped (he takes none the player has) */
  let k = 0;
  while (!rival.state.finished && k++ < 120 * 600) { rival.step(); lead.step(progress.state, rival.progress.state, dist, rival.runDistance()); }
  const s = scoring.state, rs = rival.scoring.state, LS = lead.state;
  const total = s.total + LS.player.total, rtotal = rs.total + LS.rival.total;
  return {
    finished, seconds: +t.toFixed(2), rivalSeconds: +rival.state.finishTime.toFixed(2),
    total, rival: rtotal, won: total >= rtotal, margin: total - rtotal,
    parts: { drift: s.drift - s.tandem, clean: s.clean, pace: s.pace, leads: LS.player.lead, line: LS.player.line, close: s.tandem },
    rivalParts: { drift: rs.drift, clean: rs.clean, pace: rs.pace, leads: LS.rival.lead, line: LS.rival.line, close: 0 },
    gates: LS.gates, leadGates: LS.player.gates, rivalGates: LS.rival.gates, lineTo: LS.owner[LS.gates - 1] || null,
    aheadShare: raceT > 0 ? +(aheadT / raceT).toFixed(3) : 0, changes, changesAll: LS.changes,
    closeShare: tandem.state.rivalSlideT ? +(tandem.state.bothT / tandem.state.rivalSlideT).toFixed(3) : 0,
    wallHits: world.hits - world.bodyHits, hard: world.hardHits - world.bodyHardHits, bodyHits: world.bodyHits, bodyHard: world.bodyHardHits, respawns, minKmh: +(minV * 3.6).toFixed(1),
    handsBroken, rivalOverruled: rival.state.overruled,
    rivalHash: rival.hash(), hash: world.hash(), trace,
  };
}

if (process.argv[1] && process.argv[1].endsWith('race.js')) {
  const { rivalById } = await import('../../src/rivals/roster.js');
  const args = process.argv.slice(2);
  const def = rivalById(args.find(a => /^r\d/.test(a)) || 'r1');
  for (const who of ['grip', 'slide', 'mixed', 'still']) { const r = runRace(def, who); delete r.trace; console.log(who.padEnd(6), JSON.stringify(r)); }
}
