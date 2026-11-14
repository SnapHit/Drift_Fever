/* THE RIVAL IN A RUN (briefs/RIVALS.md). His own physics world on the
   same track, stepped in lockstep with the player's (one rival step for
   every player step, as the ghost is), driven live by his own scripted
   driver (rivals/driver.js) that reads only his world, never the
   player's: his run is the same whatever the player does. No rubber
   band. He scores by the same rules as a solo run (the chain, the
   multiplier, clean sectors, pace), with no close bonus; the race's
   lead and line bonuses (scoring/lead.js) are kept apart from his own
   scoring, so his driving hash never depends on the player.

   He starts level with the player, side by side (TANDEM.GRID_SIDE),
   and has a player's hands (below). When he crosses his line his open
   chain is banked and his pace paid, exactly as the player's are; he
   then brakes to a stop and fades out (TANDEM.FADE), and is no longer
   solid. finishRun() runs him on to his line when the player finishes
   first, so the result is only shown once both totals are final.

   Nothing here draws; the scene is handed an interpolated pose. */
import { createWorld, STEP } from '../physics/world.js';
import { createScoring } from '../scoring/drift.js';
import { createProgress } from '../loop/progress.js';
import { createRace } from '../scoring/race.js';
import { carTune, carBox } from '../garage/roster.js';
import { TUNE, TANDEM } from '../tune.js';
import { createRivalDriver } from './driver.js';

const STOP = { steer: 0, throttle: 0, brake: 0, handbrake: 1 };
const q = r => ({ steer: Math.round(r.steer * 1000) / 1000, throttle: Math.round(r.throttle * 100) / 100, brake: Math.round(r.brake * 100) / 100, handbrake: r.handbrake ? 1 : 0 });

/* A place on the grid: level with the player's start, GRID_SIDE to
   one side of the centre line (side +1 left, -1 right), facing down the
   road. The rival takes his side (def.side) and the player the other
   (briefs/DRIFT-RACE.md: start level, side by side). */
export function gridStart(track, side) {
  const C = track.centre, along = track.start.along || 0;
  const c = C[Math.max(0, Math.min(C.length - 1, Math.round(along / 2)))];
  const s = TANDEM.GRID_SIDE * (side === undefined ? 1 : side);
  const lx = -Math.cos(c.heading), lz = Math.sin(c.heading);
  return { along, x: c.x + lx * s, y: c.y || 0, z: c.z + lz * s, yaw: c.heading, heading: c.heading };
}

/* def: a rival from rivals/roster.js; laps: the run's laps. opts.grip:
   a share of grip off his tyres, opts.offset [dx, dz] metres on his
   start: the measurements' disturbances, never used by the game. */
export function createRival(track, def, laps, opts) {
  const o = opts || {};
  const start = gridStart(track, def.side);
  if (o.offset) { start.x += o.offset[0]; start.z += o.offset[1]; }
  const ground = Object.assign({}, track, { start });
  const tune = o.grip ? gripTune(def, o.grip) : carTune(def.car, def.up);
  const world = createWorld(ground, { tune });
  const scoring = createScoring();
  const progress = createProgress(track, laps);
  const race = createRace(track, laps, scoring);
  /* opts.free: the rivals round's driver, which lifted and braked (the known answer of the hands measurement only) */
  const driver = createRivalDriver(ground, def.drive, o.free ? Object.assign({}, o.driveOverride, { HANDS: 0 }) : o.driveOverride);
  const st = { dist: start.along, along: world.along, input: null, steps: 0, runTime: 0, finished: false, finishStep: -1, finishTime: 0, fade: 0, done: false, total: 0, sliding: false, overruled: 0 };
  const prev = { x: world.car.x, y: world.car.y || 0, z: world.car.z, yaw: world.car.yaw };

  function reset() {
    world.reset(); scoring.reset(); progress.reset(); race.reset(); driver.reset();
    st.steps = 0; st.runTime = 0; st.finished = false; st.finishStep = -1; st.finishTime = 0; st.fade = 0; st.done = false; st.total = 0; st.sliding = false; st.finishHash = null; st.overruled = 0; st.dist = start.along; st.along = world.along;
    prev.x = world.car.x; prev.y = world.car.y || 0; prev.z = world.car.z; prev.yaw = world.car.yaw;
  }
  /* one step, in lockstep with the player's */
  function step() {
    const c = world.car;
    prev.x = c.x; prev.y = c.y || 0; prev.z = c.z; prev.yaw = c.yaw;
    let inp = st.finished ? STOP : q(driver.input(world));
    /* The rule (briefs/DRIFT-RACE.md): he has a player's hands, the
       throttle always on, no brake, DRIFT with or without steering. His
       driver plans with exactly that (RIVAL_DRIVE.HANDS), so this guard
       should never change a thing; st.overruled counts the steps it did,
       and the measurements say it stays at nothing. */
    if (!o.free && !st.finished && (inp.throttle !== 1 || inp.brake !== 0)) { st.overruled++; inp = { steer: inp.steer, throttle: 1, brake: 0, handbrake: inp.handbrake }; }
    st.input = inp;
    world.stepWorld(inp);
    st.steps++;
    let dd = world.along - st.along; if (track.kind === 'circuit') { if (dd < -track.length / 2) dd += track.length; else if (dd > track.length / 2) dd -= track.length; }
    st.dist += dd; st.along = world.along;
    if (st.finished) { st.fade = Math.min(1, st.fade + STEP / TANDEM.FADE); if (st.fade >= 1) st.done = true; return; }
    scoring.step(world, STEP);
    progress.step(world);
    race.step(world, progress.state);
    st.runTime += STEP;
    st.sliding = scoring.state.drifting && scoring.state.gap === 0;
    if (progress.state.finished) { scoring.bank(); race.finish(st.runTime); st.finished = true; st.finishStep = st.steps; st.finishTime = st.runTime; st.sliding = false; st.finishHash = world.hash() + '|' + scoring.state.total + ',' + st.finishStep; }
    st.total = scoring.state.total;
  }
  /* run him on to his line (the player finished first); at most maxSteps */
  function finishRun(maxSteps) {
    for (let k = 0; k < (maxSteps || 120 * 600) && !st.finished; k++) step();
    return st.finished;
  }
  function pose(alpha, out) {
    const c = world.car, p = prev;
    let dy = c.yaw - p.yaw; if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
    out.x = p.x + (c.x - p.x) * alpha; out.y = p.y + ((c.y || 0) - p.y) * alpha; out.z = p.z + (c.z - p.z) * alpha; out.yaw = p.yaw + dy * alpha; out.car = c;
    return out;
  }
  /* how far into the run he is: metres along the track from its zero,
     unwrapped over the laps (the player's is counted the same way), for
     the zone, the HUD and the chase driver */
  function runDistance() { return st.dist; }
  /* solid until his finish; his body for the player's world (physics/world.js obstacle) */
  const solid = () => !st.finished;
  const box = carBox(def.car), bodyOut = { x: 0, z: 0, yaw: 0, hl: box.halfLength, hw: box.halfWidth, wvx: 0, wvz: 0, r: 0 };
  function body() {
    if (!solid()) return null;
    const c = world.car;
    bodyOut.x = c.x; bodyOut.z = c.z; bodyOut.yaw = c.yaw; bodyOut.wvx = c.wvx; bodyOut.wvz = c.wvz; bodyOut.r = c.r;
    return bodyOut;
  }
  /* his run's hash: the world at his finish, and his total (before it, the world now) */
  /* what the race counts for him: his own score with his drift points at his share (TANDEM.RIVAL_DRIFT, or driftShare in his roster entry). His own scoring, and so his hash, never knows of it */
  const share = def.driftShare === undefined ? TANDEM.RIVAL_DRIFT : def.driftShare;
  const driftPoints = () => Math.round(scoring.state.drift * share);
  const points = () => scoring.state.total - scoring.state.drift + driftPoints();
  const hash = () => st.finishHash || world.hash() + '|' + scoring.state.total + ',' + st.finishStep;
  return { def, world, scoring, points, driftPoints, progress, race, driver, driverMode: () => driver.mode, state: st, box, reset, step, finishRun, pose, runDistance, solid, body, hash };
}

/* the measurements' grip disturbance: the rival's car with both axles'
   peak grip times (1 + share) */
function gripTune(def, share) {
  const t = carTune(def.car, def.up) || { VEHICLE: Object.create(TUNE.VEHICLE), ASSIST: Object.create(TUNE.ASSIST) };
  const V = Object.assign(Object.create(TUNE.VEHICLE), t.VEHICLE);
  V.MU_FRONT = t.VEHICLE.MU_FRONT * (1 + share); V.MU_REAR = t.VEHICLE.MU_REAR * (1 + share);
  return { VEHICLE: V, ASSIST: t.ASSIST };
}
