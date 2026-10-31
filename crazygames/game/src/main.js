/* THE HOST. Makes the scene, the camera, the input, the scoring, the HUD
   and the screens, and runs the game loop: a title, then a run (a
   countdown, the drive, a finish or a lap count, the results), with the
   daily drift, the career ladder, free drift in the car park and the
   garage. The physics steps at a fixed 120 Hz from the input record,
   interpolated for drawing at whatever rate the display runs. Every
   step's input is recorded, so a run can be replayed exactly: the ghost
   is the best run's tape driven through a second world in lockstep.

   States: title, career, garage (the screens, the menu camera orbiting
   the car on the line); countdown, drive, results (a run); free (the car
   park); dev (?ground=track or park: the feel prototype's endless drive,
   which the feel probes use through window.__feel).

   Query: ?renderer=webgl2 forces the fallback; ?ground=park or track the
   dev drive; ?tune=1 the tuning panel; ?debug=1 the readout; ?assist=0..1
   the hidden assist level; ?auto=1 the scripted driver drives every run. */
import { TUNE, LOOP } from './tune.js';
import { createWorld, STEP } from './physics/world.js';
import { createDriver } from './physics/driver.js';
import { groundByName } from './ground/track.js';
import { trackFor, freeGround, STAND_IN as TRACK_STAND_IN } from './ground/source.js';
import { createScene } from './render/scene.js';
import { STAND_IN as CAR_STAND_IN } from './render/car.js';
import { createChaseCamera, carOnScreen } from './camera/chase.js';
import { createInput } from './input/input.js';
import { createScoring } from './scoring/drift.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createTunePanel, loadSavedTune } from './ui/tune.js';
import { createDebug } from './ui/debug.js';
import { createSave } from './loop/save.js';
import { createProgress } from './loop/progress.js';
import { createGhost, compactTape } from './loop/ghost.js';
import { CAREER, careerSpec, dailySpec, careerUnlocked, starTargets, starsFor, coinsFor, lapsFor } from './loop/modes.js';
import { carTune, carById, carBox } from './garage/roster.js';

const query = new URLSearchParams(location.search);
const MAX_STEPS = 8;              // steps per frame before time is dropped
const root = document.getElementById('ui');
const canvas = document.getElementById('world');
const save = createSave();
const scoring = createScoring();
const chase = createChaseCamera();
const input = createInput(root);
const hud = createHud(root);
const screens = createScreens(root, onAction);
if (query.has('assist')) TUNE.ASSIST.LEVEL = Math.max(0, Math.min(1, +query.get('assist') || 0));
let tuned = 0;
if (query.get('tune') === '1') { tuned = loadSavedTune(); createTunePanel(root, () => { /* applied live; nothing to rebuild */ }); }
const debug = query.get('debug') === '1' ? createDebug(root) : null;
const scene = createScene(canvas, { renderer: query.get('renderer') === 'webgl2' ? 'webgl2' : undefined, tier: query.get('tier') || undefined });
const THREE = scene.THREE;
const autoDrive = query.get('auto') === '1';
const devGround = query.get('ground');

/* ---- the run: what the loop is doing now ---- */
const app = {
  state: 'title',
  ground: null, world: null, progress: null, ghost: null, driver: null,
  spec: null, track: null, laps: 0, targets: null, key: null,
  countdown: 0, goShown: 0, runTime: 0, menuT: 0, settle: 0, lockout: 0,
  results: null, picked: null,
};
let box = carBox('starter');

/* ---- the recorder: every step's input, run length encoded ---- */
const tape = [];
function record(i) {
  const last = tape[tape.length - 1];
  if (last && last.s === i.steer && last.t === i.throttle && last.b === i.brake && last.h === i.handbrake) last.n++;
  else tape.push({ n: 1, s: i.steer, t: i.throttle, b: i.brake, h: i.handbrake });
}
function quantise(rec) {
  return { steer: Math.round(rec.steer * 1000) / 1000, throttle: Math.round(rec.throttle * 100) / 100, brake: Math.round(rec.brake * 100) / 100, handbrake: rec.handbrake ? 1 : 0 };
}

/* ---- the world for a ground, with the chosen car ---- */
function setGround(ground, carId, paintId) {
  app.ground = ground;
  app.world = createWorld(ground, { tune: carTune(carId) });
  box = carBox(carId);
  scene.setGround(ground);
  scene.setCar(carId, paintId);
}

/* ---- the loop ---- */
const prev = { x: 0, z: 0, yaw: 0 }, pose = { x: 0, z: 0, yaw: 0, slip: 0, speed: 0 }, ghostPose = { x: 0, z: 0, yaw: 0, car: null };
let acc = 0, last = -1;
const view = { w: 1, h: 1 };
function resize() {
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  if (w === view.w && h === view.h) return;
  view.w = w; view.h = h;
  scene.resize(w, h);
}
window.addEventListener('resize', resize);

/* Back to the line: the world, the scoring, the tape and the clock. */
function resetRun() {
  const world = app.world;
  world.reset(); scoring.reset(); hud.reset(); scene.clearMarks();
  if (app.progress) app.progress.reset();
  if (app.ghost) app.ghost.reset();
  tape.length = 0; acc = 0; last = -1; app.runTime = 0;
  prev.x = world.car.x; prev.z = world.car.z; prev.yaw = world.car.yaw;
  chase.reset({ yaw: world.car.yaw });
  if (autoDrive && app.state !== 'dev' && app.ground.centre.length) app.driver = createDriver(app.ground, { drift: '*' });
}

function stepOnce(rec) {
  const world = app.world, c = world.car;
  prev.x = c.x; prev.z = c.z; prev.yaw = c.yaw;
  const inp = app.driver ? quantise(app.driver.input(world)) : rec;
  world.stepWorld(inp);
  record(inp);
  scoring.step(world, STEP);
  if (app.progress) app.progress.step(world);
  if (app.ghost) app.ghost.step();
  if (world.hit) chase.hit(world.hit.speed);
}

const STOP = { steer: 0, throttle: 0, brake: 0, handbrake: 1 };   // DRIFT with no steering: the car stops
let physMs = 0, lastSteps = 0, frameMs = 0;
function frame(t) {
  const t0 = performance.now();
  if (last < 0) last = t;
  const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
  last = t;
  resize();
  const raw = input.read(t);
  if (window.__feel.inject) Object.assign(raw, window.__feel.inject);   // the probes' input
  const world = app.world;
  const S = app.state;
  const menu = S === 'title' || S === 'career' || S === 'garage';
  if (raw.restart && !menu) { if (S === 'dev' || S === 'free') resetRun(); else if (S === 'drive' || S === 'countdown') startRun(app.spec); }
  let rec = quantise(raw);
  let steps = 0;
  if (S === 'countdown') {
    app.countdown -= dt;
    hud.setCount(String(Math.max(1, Math.ceil(app.countdown))), false);
    if (app.countdown <= 0) { app.state = 'drive'; input.setStarted(true); app.goShown = LOOP.GO_SHOWN; hud.setCount('GO', true); acc = 0; }
  }
  const stepping = S === 'drive' || S === 'results' || S === 'free' || S === 'dev';
  if (stepping) {
    if (S === 'drive' && app.goShown > 0) { app.goShown -= dt; if (app.goShown <= 0) hud.setCount('', false); }
    if (S === 'results') { rec = STOP; app.driver = null; }
    acc += dt;
    /* How many steps this frame: the count is rounded up when the
       accumulator is within a millionth of a step, so a 60 Hz frame is
       always two steps and a 120 Hz frame always one, instead of the
       float remainder slipping a step into the next frame. */
    steps = Math.floor(acc / STEP + 1e-6);
    if (steps > MAX_STEPS) { steps = MAX_STEPS; acc = steps * STEP; }
    const p0 = performance.now();
    for (let i = 0; i < steps; i++) {
      stepOnce(rec);
      if (S === 'drive') { app.runTime += STEP; if (app.progress.state.finished && app.settle === 0) { app.settle = LOOP.FINISH_SETTLE; scoring.bank(); } }
    }
    acc = Math.max(0, acc - steps * STEP);
    physMs = performance.now() - p0; lastSteps = steps;
    if (S === 'drive' && app.settle > 0) { app.settle -= dt; if (app.settle <= 0) finishRun(); }
    if (S === 'results') { app.lockout -= dt; if (app.lockout <= 0 && raw.action) onAction('again'); }
  }
  const alpha = stepping ? acc / STEP : 0;
  const c = world.car;
  let dy = c.yaw - prev.yaw; if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
  pose.x = prev.x + (c.x - prev.x) * alpha; pose.z = prev.z + (c.z - prev.z) * alpha; pose.yaw = prev.yaw + dy * alpha;
  pose.slip = c.slip; pose.speed = c.speed;
  if (menu) { app.menuT += dt; chase.orbit(pose, app.menuT, scene.camera, view.w / view.h); }
  else chase.update(pose, dt, scene.camera, view.w / view.h);
  const g = app.ghost && (S === 'drive' || S === 'results') ? app.ghost.pose(alpha, ghostPose) : null;
  scene.update(pose, world, dt, g);
  hud.update(scoring, pose, scene.camera, THREE, view);
  if (S === 'drive' || S === 'countdown') {
    const p = app.progress.state;
    hud.setRun(app.track.kind === 'circuit' ? 'LAP ' + Math.min(p.laps, p.lap + 1) + '/' + p.laps : Math.round(p.remaining) + ' m', app.runTime.toFixed(1));
  }
  if (window.__feel.draw) scene.render(); else scene.camera.updateMatrixWorld();
  frameMs = performance.now() - t0;
  if (debug) debug.frame(frameMs, physMs, steps, scene.info().submitMs, scene.info(), t);
}

/* ---- the states ---- */
function titleInfo() {
  const d = dailySpec();
  return { dailyDate: d.date, dailyName: d.date, dailyKind: d.kind === 'circuit' ? LOOP.LAPS + ' laps' : 'sprint', standIn: TRACK_STAND_IN, storage: save.status.available };
}
function showMenu(name) {
  app.state = name; app.driver = null;
  hud.setVisible(false); hud.setCount('', false); input.touch.setVisible(false);
  if (name === 'title') screens.title(save.state, titleInfo());
  else if (name === 'career') screens.career(save.state);
  else if (name === 'garage') screens.garage(save.state, app.picked);
}
/* The title's backdrop: the chosen car on the daily track's line. */
function menuGround() {
  const spec = dailySpec();
  app.spec = spec; app.track = trackFor(spec);
  setGround(app.track, save.state.car, save.state.cars[save.state.car].paint);
  app.progress = null; app.ghost = null; scene.setGhost(null);
  resetRun(); app.driver = null;
}

function startRun(spec) {
  app.spec = spec; app.key = spec.key;
  app.track = trackFor(spec);
  const carId = save.state.car, paint = save.state.cars[carId].paint;
  setGround(app.track, carId, paint);
  app.laps = lapsFor(app.track);
  app.targets = starTargets(app.track, app.laps);
  app.progress = createProgress(app.track, app.laps);
  const rec = save.ghost(spec.key);
  app.ghost = rec ? createGhost(app.track, rec) : null;
  scene.setGhost(rec ? rec.car : null, rec ? rec.paint : null);
  hud.setToBeat(rec ? 'best ' + rec.score : (save.state.career[String(spec.index)] ? 'best ' + save.state.career[String(spec.index)].best : ''));
  app.state = 'countdown'; app.countdown = LOOP.COUNTDOWN; app.settle = 0; app.results = null;
  input.setStarted(false);
  screens.hide(); hud.setVisible(true); input.touch.setVisible(true);
  resetRun();
  hud.setRun(app.track.kind === 'circuit' ? 'LAP 1/' + app.laps : Math.round(app.progress.total()) + ' m', '0.0');
  hud.setCount(String(Math.ceil(LOOP.COUNTDOWN)), false);
}

function finishRun() {
  const spec = app.spec, score = scoring.state.total, best = scoring.state.best;
  const stars = starsFor(score, app.targets), coins = coinsFor(score, stars, spec.mode);
  let improved = false, nextIndex = null;
  if (spec.mode === 'career') { improved = save.careerResult(spec.index, stars, score); if (spec.index + 1 < CAREER.length && careerUnlocked(save.state, spec.index + 1)) nextIndex = spec.index + 1; }
  else if (spec.mode === 'daily') improved = save.dailyResult(spec.date, stars, score);
  save.addCoins(coins);
  const steps = tape.reduce((s, e) => s + e.n, 0);
  const prevGhost = save.ghost(spec.key);
  let ghostSaved = false;
  if (steps >= LOOP.GHOST_MIN_STEPS && (!prevGhost || score > prevGhost.score)) {
    ghostSaved = save.setGhost(spec.key, { score, best, car: save.state.car, paint: save.state.cars[save.state.car].paint, steps, hash: app.world.hash(), tape: compactTape(tape), when: Date.now(), seconds: app.runTime });
  }
  app.results = { score, best, stars, targets: app.targets, coins, improved, mode: spec.mode, name: spec.name, seconds: app.runTime, nextIndex, laps: app.laps, kind: app.track.kind, ghostSaved, steps, hash: app.world.hash() };
  app.state = 'results'; app.lockout = LOOP.RESULTS_LOCKOUT;
  hud.setCount('', false); hud.setVisible(false); input.touch.setVisible(false);
  screens.results(app.results);
}

function startFree() {
  app.spec = { mode: 'free', key: 'free', name: 'Free drift' };
  app.track = freeGround();
  setGround(app.track, save.state.car, save.state.cars[save.state.car].paint);
  app.progress = null; app.ghost = null; scene.setGhost(null);
  app.state = 'free';
  input.setStarted(false);
  screens.hide(); hud.setVisible(true); hud.setRun('', ''); hud.setToBeat(''); input.touch.setVisible(true);
  resetRun();
}

function onAction(action, arg) {
  switch (action) {
    case 'title': menuGround(); showMenu('title'); break;
    case 'career': showMenu('career'); break;
    case 'garage': app.picked = null; showMenu('garage'); break;
    case 'free': startFree(); break;
    case 'daily': startRun(dailySpec()); break;
    case 'play-career': { const i = +arg; if (careerUnlocked(save.state, i)) startRun(careerSpec(i)); break; }
    case 'again': if (app.spec && app.spec.mode !== 'free') startRun(app.spec); break;
    case 'pick-car': app.picked = arg; previewCar(); screens.garage(save.state, app.picked); break;
    case 'buy-car': if (save.buyCar(arg, carById(arg).price)) { save.chooseCar(arg); app.picked = arg; menuGround(); } screens.garage(save.state, app.picked); break;
    case 'choose-car': if (save.chooseCar(arg)) menuGround(); screens.garage(save.state, app.picked); break;
    case 'paint': {
      const id = app.picked || save.state.car, car = carById(id);
      if (save.state.cars[id]) {
        const free = arg === car.paint || arg === save.state.cars[id].paint;
        if (free || save.state.coins >= LOOP.PAINT_PRICE) { if (!free) save.addCoins(-LOOP.PAINT_PRICE); save.setPaint(id, arg); if (id === save.state.car) menuGround(); }
      }
      previewCar();
      screens.garage(save.state, app.picked); break;
    }
  }
}
/* The garage's backdrop shows the car being looked at, in its paint. */
function previewCar() {
  const id = app.picked || save.state.car;
  scene.setCar(id, save.state.cars[id] ? save.state.cars[id].paint : carById(id).paint);
}
hud.exit.addEventListener('click', () => { if (app.state !== 'dev') { menuGround(); showMenu('title'); } });

/* ---- go ---- */
let running = false;
function loop(t) { frame(t); requestAnimationFrame(loop); }
scene.ready.then(() => {
  resize();
  if (devGround) {
    /* the feel prototype's endless drive, for the probes and for tuning */
    app.state = 'dev';
    app.track = groundByName(devGround === 'park' ? 'park' : 'track');
    setGround(app.track, 'starter', 'cyan');
    hud.setVisible(true); hud.setRun(devGround === 'park' ? 'car park' : 'test track', ''); input.touch.setVisible(true); hud.exit.hidden = true;
    resetRun();
    if (autoDrive) app.driver = createDriver(app.track, { drift: app.track.kind === 'circuit' ? 'sweeper' : null });
  } else {
    menuGround();
    showMenu('title');
  }
  running = true;
  frame(performance.now());
  requestAnimationFrame(loop);
  window.__ready = true;
}).catch(e => {
  const el = document.getElementById('fail');
  el.textContent = 'The 3D renderer could not start: ' + (e && e.message || e);
  el.hidden = false;
  console.error(e);
});

/* ---- the probe API: the feel probes' window.__feel, unchanged in
   shape, and window.__loop for the game loop's ---- */
window.__feel = {
  draw: true,          // the probes turn the GPU submission off on the way to a frame
  inject: null,        // { steer, throttle, brake, handbrake } written over the live input by the probes
  TUNE, STEP, scoring, chase, scene, input, hud, view, pose, tape, groundName: devGround || null, tunedFromDevice: tuned,
  get world() { return app.world; },
  frame, restart: resetRun,
  hash: () => app.world.hash(),
  info: () => ({ ...scene.info(), running, physMs, steps: lastSteps, frameMs, state: app.state }),
  setDriver(opts) { app.driver = opts ? createDriver(app.ground, opts) : null; return app.driver; },
  /* Replay a tape (run length entries) from a fresh start, no drawing. Returns the hash. */
  replay(t) {
    resetRun();
    for (const e of t) for (let i = 0; i < e.n; i++) stepOnce({ steer: e.s, throttle: e.t, brake: e.b, handbrake: e.h });
    return app.world.hash();
  },
  /* Step a fixed input for n steps from the current state, no drawing. */
  step(n, rec) { const q = quantise(rec); for (let i = 0; i < n; i++) stepOnce(q); return app.world.hash(); },
  tapeCopy: () => tape.map(e => ({ ...e })),
  onScreen(margin) { scene.camera.updateMatrixWorld(); return carOnScreen(THREE, scene.camera, pose, box, margin || 0); },
};
window.__loop = {
  app, save, LOOP, screens, standIn: { tracks: TRACK_STAND_IN, cars: CAR_STAND_IN },
  action: onAction, startRun, dailySpec, careerSpec, careerUnlocked, trackFor,
  progress: () => app.progress && app.progress.state,
  results: () => app.results,
  ghostHash: () => app.ghost ? app.ghost.hash() : null,
  ghostState: () => app.ghost ? { steps: app.ghost.state.steps, done: app.ghost.state.done, x: app.ghost.world.car.x, z: app.ghost.world.car.z, yaw: app.ghost.world.car.yaw } : null,
  skipCountdown() { if (app.state === 'countdown') { app.countdown = 0; } },
};
