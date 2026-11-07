/* POINTS FOR DRIVING WELL. Drifting is not the only way to score: a run
   is cut into sectors at its checkpoints (and at the line on a circuit),
   and a sector driven with no wall contact and no respawn pays its share
   of CLEAN_SHARE of the first star; finishing pays PACE_SHARE of it at
   par speed, more the faster, up to PACE_CAP times. So a clean run at par
   earns one star on its own, and drifting adds the rest. Stepped at the
   physics rate after the progress, so a replay scores the same; every
   constant is in TUNE.SCORING. */
import { TUNE } from '../tune.js';
import { runMetres, starRate } from '../loop/modes.js';

export function createRace(track, laps, scoring) {
  const S = TUNE.SCORING;
  const metres = runMetres(track, laps), rate = starRate(track);
  const circuit = track.kind === 'circuit', cps = (track.checkpoints || []).length;
  const sectors = circuit ? laps * (cps + 1) : cps + 1;
  const perSector = S.CLEAN_SHARE * rate * metres / sectors;
  const r = { sectors, done: 0, clean: 0, hitsAt: 0, dirty: false, paceDone: false };
  function reset() { r.done = 0; r.clean = 0; r.hitsAt = 0; r.dirty = false; r.paceDone = false; }
  /* sectors passed so far, from the progress */
  const passed = p => circuit ? p.lap * (cps + 1) + p.nextCp : p.nextCp + (p.finished ? 1 : 0);
  function step(world, progress) {
    if (world.respawned) r.dirty = true;
    const n = passed(progress);
    while (r.done < n && r.done < sectors) {
      r.done++;
      const clean = !r.dirty && world.hits === r.hitsAt;
      if (clean) { r.clean++; scoring.award(perSector, 'clean', 'CLEAN'); }
      r.hitsAt = world.hits; r.dirty = false;
    }
  }
  /* at the finish: the pace bonus for the run's time in seconds */
  function finish(seconds) {
    if (r.paceDone || !(seconds > 0)) return;
    r.paceDone = true;
    const par = metres / S.PAR_SPEED;
    scoring.award(S.PACE_SHARE * rate * metres * Math.min(S.PACE_CAP, par / seconds), 'pace', 'PACE');
  }
  return { state: r, step, finish, reset, par: () => metres / S.PAR_SPEED };
}
