/* A NODE HARNESS FOR THE PHYSICS. Drives the test track with the
   scripted driver, no browser, and prints what the measurements will
   look at: did the car stay inside the walls, how fast was it, and how
   long did the drift script hold its angle through the sweeper. For
   iterating on the model; the real numbers come from the browser probes.

   node game/test/feel/sim.js [laps] [--drift sweeper] [--invert] */
import { createWorld, STEP } from '../../src/physics/world.js';
import { createDriver } from '../../src/physics/driver.js';
import { testTrack } from '../../src/ground/track.js';
import { TUNE } from '../../src/tune.js';

const args = process.argv.slice(2);
const laps = +(args.find(a => /^\d+$/.test(a)) || 1);
const drift = args.includes('--drift') ? args[args.indexOf('--drift') + 1] : null;
const invert = args.includes('--invert') ? -1 : 1;
const quiet = args.includes('--quiet');
if (args.includes('--assist0')) TUNE.ASSIST.LEVEL = 0;

export function runLaps(ground, opts) {
  const world = createWorld(ground);
  const driver = createDriver(ground, opts);
  const maxSteps = Math.round(opts.laps * 90 / STEP);
  let lapsDone = 0, lastAlong = 0, maxLat = 0, maxLatAt = 0, topSpeed = 0, hits = 0, hardHits = 0, respawns = 0;
  let hold = 0, bestHold = 0, bestHoldAngle = 0, holdAngleSum = 0, holdSpeedSum = 0, holdN = 0, bestHoldSpeed = 0;
  const sec = opts.drift && ground.sections[opts.drift];
  const trace = [];
  for (let i = 0; i < maxSteps; i++) {
    const inp = driver.input(world);
    world.stepWorld(inp);
    const car = world.car;
    if (world.along < lastAlong - ground.length / 2) lapsDone++;
    lastAlong = world.along;
    const lat = Math.abs(world.lateral);
    if (lat > maxLat) { maxLat = lat; maxLatAt = world.along; }
    if (car.speed > topSpeed) topSpeed = car.speed;
    if (world.hit) { hits++; if (world.hit.hard) hardHits++; }
    if (world.respawned) respawns++;
    const angle = Math.abs(car.slip) * 180 / Math.PI;
    const inSec = sec ? world.along >= sec[0] && world.along <= sec[1] + 30 : true;
    if (sec && inSec && angle > 30 && car.speed > 6) { hold += STEP; holdAngleSum += angle; holdSpeedSum += car.speed; holdN++; if (hold > bestHold) { bestHold = hold; bestHoldAngle = holdAngleSum / holdN; bestHoldSpeed = holdSpeedSum / holdN; } }
    else { hold = 0; holdAngleSum = 0; holdSpeedSum = 0; holdN = 0; }
    if (i % 12 === 0) trace.push({ t: +world.time.toFixed(2), s: +world.along.toFixed(1), lat: +world.lateral.toFixed(2), v: +car.speed.toFixed(1), angle: +angle.toFixed(1), steer: +(car.steer * 180 / Math.PI).toFixed(1), hb: car.hb, inp: { ...inp } });
    if (lapsDone >= opts.laps) break;
  }
  return { lapsDone, maxLat, maxLatAt, halfWidth: world.halfWidth, topSpeed, hits, hardHits, respawns, bestHold, bestHoldAngle, bestHoldSpeed, time: world.time, trace, world };
}

if (process.argv[1] && process.argv[1].endsWith('sim.js')) {
  const ground = testTrack();
  const r = runLaps(ground, { laps, drift, invert });
  console.log('track length ' + ground.length + ' m, ' + ground.centre.length + ' samples, half width ' + r.halfWidth);
  console.log('laps ' + r.lapsDone + ' in ' + r.time.toFixed(1) + ' s, max |lateral| ' + r.maxLat.toFixed(2) + ' m at s=' + r.maxLatAt.toFixed(0) + ', top speed ' + (r.topSpeed * 3.6).toFixed(0) + ' km/h, wall hits ' + r.hits + ' (hard ' + r.hardHits + '), respawns ' + r.respawns);
  if (drift) console.log('drift through ' + drift + ': longest hold above 30 deg ' + r.bestHold.toFixed(2) + ' s, mean angle ' + r.bestHoldAngle.toFixed(1) + ' deg, mean speed ' + (r.bestHoldSpeed * 3.6).toFixed(0) + ' km/h');
  if (!quiet) { const sec = ground.sections[drift]; for (const t of r.trace) if (!sec || (t.s > sec[0] - 40 && t.s < sec[1] + 40)) console.log(JSON.stringify(t)); }
}
