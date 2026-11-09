/* A CAREER RUN IN NODE, for choosing seeds. The same per step code the
   host's driveStep runs (game/src/main.js): the world with the starter's
   tune, the scoring, the progress, the race, the line banking the open
   chain and paying the pace, stars from starTargets. No browser, no
   drawing, so a candidate seed costs seconds. Node's Math differs from
   Chromium's in the last bit of sin and exp, so the kept seeds are
   driven again in the page (probes.js) and that is the record. */
import { createWorld, STEP } from '../../src/physics/world.js';
import { createDriver } from '../../src/physics/driver.js';
import { createScoring } from '../../src/scoring/drift.js';
import { createProgress } from '../../src/loop/progress.js';
import { createRace } from '../../src/scoring/race.js';
import { starTargets, starsFor, lapsFor } from '../../src/loop/modes.js';
import { carTune } from '../../src/garage/roster.js';

export const DRIVERS = { careful: { drift: null }, drifter: { drift: '*' } };

/* Drive a track (a generated track object) with a scripted driver to the
   line, or until maxSeconds. */
export function driveRun(track, driverName, maxSeconds) {
  const laps = lapsFor(track), targets = starTargets(track, laps);
  const world = createWorld(track, { tune: carTune('starter') });
  const scoring = createScoring(), progress = createProgress(track, laps), race = createRace(track, laps, scoring);
  const driver = createDriver(track, DRIVERS[driverName]);
  world.reset(); scoring.reset(); progress.reset(); race.reset();
  const limit = Math.round((maxSeconds || 400) / STEP);
  let t = 0, offTrack = 0, stuck = 0, finished = false, stalls = 0, slow = false, vSum = 0, i = 0;
  for (; i < limit; i++) {
    world.stepWorld(driver.input(world));
    if (world.respawned) { if (world.recovered) stuck++; else offTrack++; }
    scoring.step(world, STEP);
    progress.step(world);
    race.step(world, progress.state);
    t += STEP;
    if (t > 3) { const s = world.car.speed < 5; if (s && !slow) stalls++; slow = s; }
    vSum += world.car.speed;
    if (progress.state.finished) { scoring.bank(); race.finish(t); finished = true; break; }
  }
  const score = scoring.state.total;
  return {
    finished, seconds: +t.toFixed(2), score, stars: starsFor(score, targets), targets,
    drift: scoring.state.drift, clean: scoring.state.clean, pace: scoring.state.pace,
    cleanSectors: race.state.clean, sectors: race.state.sectors,
    contacts: world.hits, hard: world.hardHits, offTrack, stuck, respawns: offTrack + stuck, stalls,
    meanKmh: +(vSum / Math.max(1, i) * 3.6).toFixed(1),
  };
}
