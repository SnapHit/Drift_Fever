/* THE HOST. Makes the physics world, the scene, the camera, the input,
   the scoring and the HUD, and runs the loop: a fixed 120 Hz physics
   step from the input record, interpolated for drawing at whatever rate
   the display runs. Every step's input is recorded, so a run can be
   replayed exactly, and the probes drive the same frame function with a
   synthetic clock through window.__feel.

   Query: ?renderer=webgl2 forces the fallback; ?ground=park or track;
   ?tune=1 the tuning panel; ?debug=1 the readout; ?assist=0..1 the
   hidden assist level; ?auto=1 the scripted driver drives. */
import { TUNE } from './tune.js';
import { createWorld, STEP } from './physics/world.js';
import { createDriver } from './physics/driver.js';
import { groundByName } from './ground/track.js';
import { createScene } from './render/scene.js';
import { createChaseCamera, carOnScreen } from './camera/chase.js';
import { createInput } from './input/input.js';
import { createScoring } from './scoring/drift.js';
import { createHud } from './ui/hud.js';
import { createTunePanel, loadSavedTune } from './ui/tune.js';
import { createDebug } from './ui/debug.js';

const query = new URLSearchParams(location.search);
const MAX_STEPS = 8;              // steps per frame before time is dropped
const root = document.getElementById('ui');
const canvas = document.getElementById('world');
const groundName = query.get('ground') === 'park' ? 'park' : 'track';
const ground = groundByName(groundName);
const world = createWorld(ground);
const scoring = createScoring();
const chase = createChaseCamera();
const input = createInput(root);
const hud = createHud(root);
hud.setGroundLinks(groundName === 'park'
  ? '<span>car park</span> <a href="?ground=track' + keep() + '">test track</a>'
  : '<a href="?ground=park' + keep() + '">car park</a> <span>test track</span>');
function keep() { let s = ''; for (const k of ['tune', 'debug', 'renderer', 'assist']) if (query.has(k)) s += '&' + k + '=' + encodeURIComponent(query.get(k)); return s; }
if (query.has('assist')) TUNE.ASSIST.LEVEL = Math.max(0, Math.min(1, +query.get('assist') || 0));
let tuned = 0;
if (query.get('tune') === '1') { tuned = loadSavedTune(); createTunePanel(root, () => { /* applied live; nothing to rebuild */ }); }
const debug = query.get('debug') === '1' ? createDebug(root) : null;
const scene = createScene(canvas, { renderer: query.get('renderer') === 'webgl2' ? 'webgl2' : undefined, tier: query.get('tier') || undefined });
scene.setGround(ground);
const THREE = scene.THREE;

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

/* ---- the loop ---- */
const prev = { x: 0, z: 0, yaw: 0 }, pose = { x: 0, z: 0, yaw: 0, slip: 0, speed: 0 };
let acc = 0, last = -1, driver = null, autoDriver = null;
const view = { w: 1, h: 1 };
function resize() {
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  if (w === view.w && h === view.h) return;
  view.w = w; view.h = h;
  scene.resize(w, h);
}
window.addEventListener('resize', resize);

function restart() {
  world.reset(); scoring.reset(); hud.reset(); scene.clearMarks();
  tape.length = 0; acc = 0;
  prev.x = world.car.x; prev.z = world.car.z; prev.yaw = world.car.yaw;
  chase.reset({ yaw: world.car.yaw });
}

function stepOnce(rec) {
  const c = world.car;
  prev.x = c.x; prev.z = c.z; prev.yaw = c.yaw;
  const inp = driver ? quantise(driver.input(world)) : rec;
  world.stepWorld(inp);
  record(inp);
  scoring.step(world, STEP);
  if (world.hit) chase.hit(world.hit.speed);
}

let physMs = 0, lastSteps = 0, frameMs = 0;
function frame(t) {
  const t0 = performance.now();
  if (last < 0) last = t;
  const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
  last = t;
  resize();
  const raw = input.read(t);
  if (raw.restart) restart();
  const rec = quantise(raw);
  acc += dt;
  let steps = 0;
  const p0 = performance.now();
  while (acc >= STEP && steps < MAX_STEPS) { stepOnce(rec); acc -= STEP; steps++; }
  if (steps === MAX_STEPS) acc = 0;
  physMs = performance.now() - p0; lastSteps = steps;
  const alpha = acc / STEP;
  const c = world.car;
  let dy = c.yaw - prev.yaw; if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
  pose.x = prev.x + (c.x - prev.x) * alpha; pose.z = prev.z + (c.z - prev.z) * alpha; pose.yaw = prev.yaw + dy * alpha;
  pose.slip = c.slip; pose.speed = c.speed;
  chase.update(pose, dt, scene.camera, view.w / view.h);
  scene.update(pose, world, dt);
  hud.update(scoring, pose, scene.camera, THREE, view);
  if (window.__feel.draw) scene.render(); else scene.camera.updateMatrixWorld();
  frameMs = performance.now() - t0;
  if (debug) debug.frame(frameMs, physMs, steps, scene.info().submitMs, scene.info(), t);
}

let running = false;
function loop(t) { frame(t); requestAnimationFrame(loop); }
scene.ready.then(() => {
  resize();
  restart();
  if (query.get('auto') === '1') { autoDriver = createDriver(ground, { drift: ground.kind === 'circuit' ? 'sweeper' : null }); driver = autoDriver; }
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

/* ---- the probe API ---- */
window.__feel = {
  draw: true,          // the probes turn the GPU submission off on the way to a frame
  TUNE, STEP, world, scoring, chase, scene, input, hud, view, pose, tape, groundName, tunedFromDevice: tuned,
  frame, restart,
  hash: () => world.hash(),
  info: () => ({ ...scene.info(), running, physMs, steps: lastSteps, frameMs }),
  setDriver(opts) { driver = opts ? createDriver(ground, opts) : null; return driver; },
  /* Replay a tape (run length entries) from a fresh start, no drawing. Returns the hash. */
  replay(t) {
    restart();
    for (const e of t) for (let i = 0; i < e.n; i++) stepOnce({ steer: e.s, throttle: e.t, brake: e.b, handbrake: e.h });
    return world.hash();
  },
  /* Step a fixed input for n steps from the current state, no drawing. */
  step(n, rec) { const q = quantise(rec); for (let i = 0; i < n; i++) stepOnce(q); return world.hash(); },
  tapeCopy: () => tape.map(e => ({ ...e })),
  onScreen(margin) { scene.camera.updateMatrixWorld(); return carOnScreen(THREE, scene.camera, pose, { halfLength: TUNE.VEHICLE.HALF_LENGTH, halfWidth: TUNE.VEHICLE.HALF_WIDTH, height: 1.45 }, margin || 0); },
};
