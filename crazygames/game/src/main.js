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
   the hidden assist level; ?auto=1 the scripted driver drives every run;
   ?title=1 shows the title even on a first visit (the probes' known
   answer for the clicks to gameplay); ?track=CODE opens the Track Lab on
   that track, one click from driving it. */
import { TUNE, LOOP } from './tune.js';
import { createWorld, STEP } from './physics/world.js';
import { createDriver } from './physics/driver.js';
import { groundByName } from './ground/track.js';
import { trackFor, freeGround, STAND_IN as TRACK_STAND_IN } from './ground/source.js';
import { createScene } from './render/scene.js';
import { STAND_IN as CAR_STAND_IN } from './render/car.js';
import { createChaseCamera, carOnScreen } from './camera/chase.js';
import { LOOK as TRACK_LOOK } from './tracks/mesh.js';
import { createInput } from './input/input.js';
import { createScoring } from './scoring/drift.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createOnboarding, cornerAhead } from './ui/onboard.js';
import { createTunePanel, loadSavedTune } from './ui/tune.js';
import { createDebug } from './ui/debug.js';
import { createSave } from './loop/save.js';
import { createProgress } from './loop/progress.js';
import { createRace } from './scoring/race.js';
import { fullscreenSupported, toggleFullscreen, onFullscreenChange, fullscreenIcon } from './ui/fullscreen.js';
import { createSound, soundIcon } from './audio/sound.js';
import { createGhost, compactTape } from './loop/ghost.js';
import { CAREER, careerSpec, dailySpec, careerUnlocked, starTargets, starsFor, coinsFor, lapsFor } from './loop/modes.js';
import { missionsFor, allMissionsFor, createMissionJudge, missionTally } from './loop/missions.js';
import { DEFAULT_SETTINGS, tidySettings, labSpec, specFromCode, randomSeed, linkFor, crossoverOffered } from './lab/lab.js';
import { drawPlan } from './tracks/plan.js';
import { carTune, carById, carBox, carRev, upgradeLevels } from './garage/roster.js';

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
const onboard = createOnboarding(root, () => { save.setOnboarded(); sound.ui('tap'); });
const sound = createSound();
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
  spec: null, track: null, laps: 0, targets: null, key: null, missions: null,
  countdown: 0, goShown: 0, runTime: 0, menuT: 0, settle: 0, lockout: 0,
  results: null, picked: null,
  lab: null,     // the Track Lab's state: { settings, seed, code, spec, track, message, error }
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
  app.world = createWorld(ground, { tune: carTune(carId, save.state.cars[carId] && save.state.cars[carId].up) });
  box = carBox(carId);
  scene.setGround(ground);
  scene.setCar(carId, paintId);
  chase.setCeiling(deckCeiling(ground));
}

/* The camera's ceiling under a bridge: while the car is on the road
   beneath (layer 0), the camera stays BRIDGE_CLEAR under the deck's
   underside, easing down as it nears the deck's edge. null on a track
   with no bridge. */
function deckCeiling(ground) {
  const C = ground.centre || [], decks = [];
  for (const b of ground.bridges || []) {
    for (let i = Math.max(0, Math.floor(b.deck[0] / 2)); i <= Math.min(C.length - 1, Math.ceil(b.deck[1] / 2)); i++) decks.push({ x: C[i].x, z: C[i].z, r: C[i].width / 2 + TUNE.CAMERA.BRIDGE_EDGE, under: (C[i].y || 0) - TRACK_LOOK.DECK_THICK });
  }
  if (!decks.length) return null;
  const K = TUNE.CAMERA;
  return (x, z, pose) => {
    let top = Infinity;
    for (const q of decks) {
      if (pose.layer) continue;    // the car is on the bridge or its ramps: the camera follows it over
      const out = Math.max(0, Math.hypot(x - q.x, z - q.z) - q.r);
      top = Math.min(top, q.under - K.BRIDGE_CLEAR + out * K.BRIDGE_EASE);
    }
    return top;
  };
}

/* ---- the loop ---- */
const prev = { x: 0, y: 0, z: 0, yaw: 0 }, pose = { x: 0, y: 0, z: 0, yaw: 0, slip: 0, speed: 0 }, ghostPose = { x: 0, y: 0, z: 0, yaw: 0, car: null };
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
  if (app.race) app.race.reset();
  if (app.missions) app.missions.reset();
  if (app.ghost) app.ghost.reset();
  tape.length = 0; acc = 0; last = -1; app.runTime = 0;
  prev.x = world.car.x; prev.y = world.car.y || 0; prev.z = world.car.z; prev.yaw = world.car.yaw;
  chase.reset({ yaw: world.car.yaw });
  if (autoDrive && app.state !== 'dev' && app.ground.centre.length) app.driver = createDriver(app.ground, { drift: '*' });
}

function stepOnce(rec) {
  const world = app.world, c = world.car;
  prev.x = c.x; prev.y = c.y || 0; prev.z = c.z; prev.yaw = c.yaw;
  const inp = app.driver ? quantise(app.driver.input(world)) : rec;
  world.stepWorld(inp);
  record(inp);
  scoring.step(world, STEP);
  if (app.progress) app.progress.step(world);
  if (app.race) app.race.step(world, app.progress.state);
  if (app.missions) app.missions.step(world, scoring.state, app.race, app.progress.state);
  if (app.ghost) app.ghost.step();
  if (world.hit) chase.hit(world.hit.speed);
  if (world.hit && (!app.frameHit || world.hit.speed > app.frameHit.speed)) app.frameHit = { speed: world.hit.speed, hard: world.hit.hard };
}

/* One physics step of a run in 'drive': the clock, and the line. The
   frame loop and the probes' tape replay both go through here. */
function driveStep(rec) {
  stepOnce(rec);
  app.runTime += STEP;
  if (app.progress.state.finished && app.settle === 0) { app.settle = LOOP.FINISH_SETTLE; scoring.bank(); if (app.race) app.race.finish(app.runTime); }
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
  const menu = S === 'title' || S === 'career' || S === 'garage' || S === 'lab';
  if (raw.restart && !menu) { if (S === 'dev' || S === 'free') resetRun(); else if (S === 'drive' || S === 'countdown') startRun(app.spec, { onboard: onboard.active }); }
  let rec = quantise(raw);
  let steps = 0;
  if (S === 'countdown') {
    app.countdown -= dt;
    const n = Math.max(1, Math.ceil(app.countdown));
    hud.setCount(String(n), false);
    if (n !== app.lastTick) { app.lastTick = n; sound.ui('tick'); }
    if (app.countdown <= 0) { app.state = 'drive'; input.setStarted(true); app.goShown = LOOP.GO_SHOWN; hud.setCount('GO', true); acc = 0; sound.ui('go'); sound.launch(); }
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
    for (let i = 0; i < steps; i++) { if (S === 'drive') driveStep(rec); else stepOnce(rec); }
    acc = Math.max(0, acc - steps * STEP);
    physMs = performance.now() - p0; lastSteps = steps;
    if (S === 'drive' && app.settle > 0) { app.settle -= dt; if (app.settle <= 0) finishRun(); }
    if (S === 'results') { app.lockout -= dt; if (app.lockout <= 0 && raw.action) onAction('again'); }
  }
  const alpha = stepping ? acc / STEP : 0;
  const c = world.car;
  let dy = c.yaw - prev.yaw; if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
  pose.x = prev.x + (c.x - prev.x) * alpha; pose.y = prev.y + ((c.y || 0) - prev.y) * alpha; pose.z = prev.z + (c.z - prev.z) * alpha; pose.yaw = prev.yaw + dy * alpha;
  pose.slip = c.slip; pose.speed = c.speed; pose.boost = c.boost; pose.layer = c.layer || 0;
  if (menu) { app.menuT += dt; chase.orbit(pose, app.menuT, scene.camera, view.w / view.h); }
  else chase.update(pose, dt, scene.camera, view.w / view.h);
  const g = app.ghost && (S === 'drive' || S === 'results') ? app.ghost.pose(alpha, ghostPose) : null;
  scene.update(pose, world, dt, g);
  sound.update(world.car, S === 'drive' || S === 'countdown' || S === 'free' || S === 'dev', world.touching);
  if (app.frameHit) { sound.hit(app.frameHit.speed, app.frameHit.hard); app.frameHit = null; }
  /* the score's sounds, from the callouts it queued this frame */
  const sc = scoring.state;
  if ((app.heardCallouts || 0) > sc.calloutCount) app.heardCallouts = 0;   // the score was reset
  if (sc.calloutCount !== app.heardCallouts) {
    const fresh = Math.min(sc.callouts.length, sc.calloutCount - (app.heardCallouts || 0));
    for (const co of sc.callouts.slice(-fresh)) {
      if (co.kind === 'lost') sound.ui('lost');
      else if (co.kind === 'bank') sound.ui(/^(CLEAN|PACE)/.test(co.text) ? 'clean' : 'bank', sc.lastBankMult);
    }
    app.heardCallouts = sc.calloutCount;
  }
  /* a mission done this frame: a callout and a cue */
  if (app.missions && app.missions.state.completed !== app.heardMissions) {
    const ev = app.missions.state.events;
    for (let i = app.heardMissions || 0; i < ev.length; i++) hud.notice('MISSION: ' + app.missions.missions[ev[i]].text, 'mission');
    app.heardMissions = app.missions.state.completed;
    sound.ui('star', 3); sound.ui('coin', 0, 0.2);
  }
  if (app.missionsShown > 0 && S === 'drive') { app.missionsShown -= dt; if (app.missionsShown <= 0) hud.setMissions(null); }
  hud.update(scoring, pose, scene.camera, THREE, view, dt);
  if (onboard.active) onboard.update(dt, { driving: S === 'drive', record: raw, source: inputSource(), scoring: scoring.state, cornerAhead: S === 'drive' ? cornerAhead(app.track, world.along) : Infinity });
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
  return { dailyDate: d.date, dailyName: d.date, dailyKind: d.kind === 'circuit' ? LOOP.LAPS + ' laps' : 'sprint', standIn: TRACK_STAND_IN, missions: missionTally(save.state, CAREER.length), missionsOf: CAREER.length * 3, labCodes: Object.keys(save.state.lab.codes).length, storage: save.status.available, backPay: save.status.backPay || 0, sound: sound.available ? (sound.muted ? 'off' : 'on') : null, music: sound.music ? 'on' : 'off' };
}
function showMenu(name) {
  app.state = name; app.driver = null;
  if (onboard.active) onboard.stop(false);
  hud.setVisible(false); hud.setCount('', false); input.touch.setVisible(false);
  if (name === 'title') screens.title(save.state, titleInfo());
  else if (name === 'career') screens.career(save.state);
  else if (name === 'garage') screens.garage(save.state, app.picked);
  else if (name === 'lab') showLab();
}

/* ---- the Track Lab ---- */
/* The Lab's current track from its settings and seed: the spec, the
   track generated (memoised by trackFor), the code, and the backdrop
   switched to it so the theme and the time of day show behind the
   screen. message is shown once under the code. */
function setLab(settings, seed, message, error) {
  const spec = labSpec(settings, seed);
  if (!spec) { app.lab = { settings: tidySettings(settings), seed, code: '', spec: null, track: null, message: message || 'those settings do not make a code', error: true }; return; }
  const track = trackFor(spec);
  app.lab = { settings: spec.settings, seed, code: spec.code, spec, track, message: message || '', error: !!error };
  save.setLabLast(spec.code);
  app.spec = spec; app.track = track;
  setGround(track, save.state.car, save.state.cars[save.state.car].paint);
  app.progress = null; app.race = null; app.ghost = null; app.missions = null; scene.setGhost(null);
  resetRun(); app.driver = null;
}
/* The Lab opened from the title: the last code shown, or a fresh track. */
function openLab() {
  if (app.lab && app.lab.spec) return;
  const last = save.state.lab.last ? specFromCode(save.state.lab.last) : null;
  if (last && last.spec) setLab(last.spec.settings, last.spec.seed);
  else setLab(DEFAULT_SETTINGS, randomSeed());
}
function showLab() {
  openLab();
  const L = app.lab;
  const best = L.code ? save.labBest(L.code) : null;
  const ghost = L.code && L.track ? !!ghostFor('lab:' + L.code, L.track) : false;
  screens.lab(save.state, { ...L, best, ghost, link: L.code ? linkFor(L.code) : '' });
  const canvas = document.getElementById('plan');
  if (canvas && L.track) drawPlan(canvas, L.track, { labels: Math.min(view.w, view.h) >= 600 });
  L.message = ''; L.error = false;   // shown once
}
/* one setting changed: name=value */
function labSet(arg) {
  const [name, value] = String(arg || '').split('=');
  const s = { ...app.lab.settings };
  if (name === 'bank' || name === 'cross') s[name] = value === 'on'; else s[name] = value;
  if (!crossoverOffered(s)) s.cross = false;
  setLab(tidySettings(s), app.lab.seed);
  showMenu('lab');
}
async function copyText(text, what) {
  let ok = false;
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
  if (!ok) {
    try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e) { ok = false; }
  }
  return ok ? what + ' copied' : what + ': ' + text;
}
/* The title's backdrop: the chosen car on the daily track's line. */
function menuGround() {
  const spec = dailySpec();
  app.spec = spec; app.track = trackFor(spec);
  setGround(app.track, save.state.car, save.state.cars[save.state.car].paint);
  app.progress = null; app.race = null; app.ghost = null; scene.setGhost(null);
  resetRun(); app.driver = null;
}

/* A saved ghost only drives the track it was recorded on. A ghost from an
   earlier generator version (gen) was recorded on a different layout of
   the same seed, and one from before its car's handling changed (rev)
   drove a different car, so either is ignored, left in the save, and
   replaced by the next ghost worth keeping. */
function ghostFor(key, track) {
  const rec = save.ghost(key);
  return rec && rec.gen === (track.version || 1) && rec.rev === carRev(rec.car) ? rec : null;
}

/* Which controls the prompts should draw: the source that moved last,
   or, before anything has, the touch pad if it is showing. */
function inputSource() {
  const src = input.record.source;
  if (src === 'keys' && !input.keyUsed && input.touch.el.classList.contains('on')) return 'touch';
  return src;
}

function startRun(spec, opts) {
  app.spec = spec; app.key = spec.key;
  app.track = trackFor(spec);
  const carId = save.state.car, paint = save.state.cars[carId].paint;
  setGround(app.track, carId, paint);
  app.laps = lapsFor(app.track);
  app.targets = starTargets(app.track, app.laps);
  app.progress = createProgress(app.track, app.laps);
  app.race = createRace(app.track, app.laps, scoring);
  /* the career tracks and the daily carry missions; the Lab does not */
  const missions = spec.mode === 'career' || spec.mode === 'daily' ? missionsFor(app.track, app.laps) : null;
  app.missions = missions ? createMissionJudge(missions, app.track, app.laps) : null;
  app.heardMissions = 0;
  hud.setMissions(missions ? missions.map((m, i) => ({ text: m.text, done: !!(save.state.missions[spec.key] || [])[i] })) : null);
  app.missionsShown = missions ? LOOP.MISSIONS.SHOWN : 0;
  const rec = ghostFor(spec.key, app.track);
  app.ghost = rec ? createGhost(app.track, rec) : null;
  scene.setGhost(rec ? rec.car : null, rec ? rec.paint : null);
  hud.setToBeat(rec ? 'best ' + rec.score : spec.mode === 'lab' ? (save.labBest(spec.code) ? 'best ' + save.labBest(spec.code).best : '') : (save.state.career[String(spec.index)] ? 'best ' + save.state.career[String(spec.index)].best : ''));
  app.state = 'countdown'; app.countdown = LOOP.COUNTDOWN; app.settle = 0; app.results = null;
  sound.engineStart(); app.lastTick = 0; app.heardCallouts = 0;
  input.setStarted(false);
  screens.hide(); hud.setVisible(true); input.touch.setVisible(true);
  resetRun();
  hud.setRun(app.track.kind === 'circuit' ? 'LAP 1/' + app.laps : Math.round(app.progress.total()) + ' m', '0.0');
  hud.setCount(String(Math.ceil(LOOP.COUNTDOWN)), false);
  if (opts && opts.onboard) onboard.start(inputSource()); else if (onboard.active) onboard.stop(false);
}

function finishRun() {
  const spec = app.spec, score = scoring.state.total, best = scoring.state.best;
  const stars = starsFor(score, app.targets);
  /* the stars this track (or today's daily) had before, for the new star bonus */
  const had = spec.mode === 'career' ? ((save.state.career[String(spec.index)] || {}).stars || 0)
    : spec.mode === 'daily' && save.state.daily.date === spec.date ? (save.state.daily.stars || 0) : spec.mode === 'daily' ? 0 : stars;
  const newStars = Math.max(0, stars - had);
  /* a Lab run pays at the Lab's rate and no new star bonus, so the Lab is not a coin farm */
  let coins = spec.mode === 'lab' ? Math.floor(coinsFor(score, stars, spec.mode) * LOOP.LAB.COIN_RATE) : coinsFor(score, stars, spec.mode) + newStars * LOOP.NEW_STAR_BONUS;
  /* the missions: those newly done pay once */
  let missions = null;
  if (app.missions) {
    app.missions.finish(app.runTime, app.world.step);
    const done = app.missions.state.done.slice();
    const fresh = app.missions.probe ? [] : save.missionResult(spec.key, done);   // a probe's judge over every kind is not saved
    coins += fresh.length * LOOP.MISSIONS.COINS;
    const was = save.state.missions[spec.key] || [];
    missions = app.missions.missions.map((m, i) => ({ text: m.text, kind: m.kind, target: m.target, done: !!was[i], doneNow: done[i], fresh: fresh.includes(i), coins: fresh.includes(i) ? LOOP.MISSIONS.COINS : 0, progress: app.missions.state.progress[i], doneAt: app.missions.state.doneAt[i] }));
  }
  let improved = false, nextIndex = null;
  if (spec.mode === 'career') { improved = save.careerResult(spec.index, stars, score); if (spec.index + 1 < CAREER.length && careerUnlocked(save.state, spec.index + 1)) nextIndex = spec.index + 1; }
  else if (spec.mode === 'daily') improved = save.dailyResult(spec.date, stars, score);
  else if (spec.mode === 'lab') improved = save.labResult(spec.code, stars, score);
  save.addCoins(coins);
  const steps = tape.reduce((s, e) => s + e.n, 0);
  const prevGhost = ghostFor(spec.key, app.track);
  let ghostSaved = false;
  if (steps >= LOOP.GHOST_MIN_STEPS && (!prevGhost || score > prevGhost.score)) {
    ghostSaved = save.setGhost(spec.key, { score, best, car: save.state.car, paint: save.state.cars[save.state.car].paint, steps, hash: app.world.hash(), tape: compactTape(tape), when: Date.now(), seconds: app.runTime, gen: app.track.version || 1, rev: carRev(save.state.car), up: upgradeLevels(save.state.cars[save.state.car].up) });
  }
  app.results = { score, best, parts: { drift: scoring.state.drift, clean: scoring.state.clean, pace: scoring.state.pace }, cleanSectors: app.race ? app.race.state.clean + ' of ' + app.race.state.sectors : '', stars, newStars, targets: app.targets, coins, improved, mode: spec.mode, name: spec.name, seconds: app.runTime, nextIndex, laps: app.laps, kind: app.track.kind, ghostSaved, steps, hash: app.world.hash(), missions, missionTally: missionTally(save.state, CAREER.length), code: spec.mode === 'lab' ? spec.code : null };
  app.state = 'results'; app.lockout = LOOP.RESULTS_LOCKOUT;
  if (onboard.active) onboard.stop(false);
  save.setOnboarded();
  for (let i = 0; i < stars; i++) sound.ui('star', i + 1, 0.35 + i * 0.28);
  sound.ui('coin', 0, 0.45 + stars * 0.28);
  hud.setCount('', false); hud.setVisible(false); hud.setMissions(null); input.touch.setVisible(false);
  screens.results(app.results);
}

function startFree() {
  if (onboard.active) onboard.stop(false);
  app.spec = { mode: 'free', key: 'free', name: 'Free drift' };
  app.track = freeGround();
  setGround(app.track, save.state.car, save.state.cars[save.state.car].paint);
  app.progress = null; app.race = null; app.ghost = null; scene.setGhost(null);
  app.state = 'free';
  input.setStarted(false);
  screens.hide(); hud.setVisible(true); hud.setRun('', ''); hud.setToBeat(''); input.touch.setVisible(true);
  resetRun();
}

function onAction(action, arg) {
  sound.ui('tap');
  switch (action) {
    case 'music': sound.setMusic(!sound.music); showMenu('title'); break;
    case 'fullscreen': toggleFullscreen(); break;
    case 'sound': sound.setMuted(!sound.muted); soundButton(); showMenu('title'); break;
    case 'title': menuGround(); showMenu('title'); break;
    case 'career': showMenu('career'); break;
    case 'garage': app.picked = null; showMenu('garage'); break;
    case 'free': startFree(); break;
    case 'daily': startRun(dailySpec()); break;
    case 'onboard': startRun(careerSpec(0), { onboard: true }); break;
    case 'lab': showMenu('lab'); break;
    case 'lab-set': labSet(arg); break;
    case 'lab-new': setLab(app.lab.settings, randomSeed()); showMenu('lab'); break;
    case 'lab-drive': if (app.lab && app.lab.spec) startRun(app.lab.spec); break;
    case 'lab-copy': case 'lab-link': {
      const L = app.lab, code = app.state === 'results' && app.results && app.results.code ? app.results.code : L && L.code;
      if (!code) break;
      copyText(action === 'lab-link' ? linkFor(code) : code, action === 'lab-link' ? 'link' : 'code').then(msg => {
        if (app.state === 'lab') { L.message = msg; showMenu('lab'); }
        else if (app.state === 'results' && app.results) { app.results.message = msg; screens.results(app.results); }
      });
      break;
    }
    case 'lab-code': {
      const field = document.getElementById('codeIn');
      const text = arg !== undefined && arg !== null && arg !== '' ? arg : field ? field.value : '';
      const r = specFromCode(text);
      if (r.error) { if (app.lab) { app.lab.message = 'Not a track code: ' + r.error + '.'; app.lab.error = true; } showMenu('lab'); }
      else { setLab(r.spec.settings, r.spec.seed, 'Track ' + r.spec.code.slice(0, 4) + '... loaded'); showMenu('lab'); }
      break;
    }
    case 'play-career': { const i = +arg; if (careerUnlocked(save.state, i)) startRun(careerSpec(i)); break; }
    case 'again': if (app.spec && app.spec.mode !== 'free') startRun(app.spec); break;
    case 'pick-car': app.picked = arg; previewCar(); screens.garage(save.state, app.picked); break;
    case 'buy-car': if (save.buyCar(arg, carById(arg).price)) { save.chooseCar(arg); app.picked = arg; menuGround(); } screens.garage(save.state, app.picked); break;
    case 'choose-car': if (save.chooseCar(arg)) menuGround(); screens.garage(save.state, app.picked); break;
    case 'upgrade': { const id = app.picked || save.state.car; if (save.buyUpgrade(id, arg) && id === save.state.car) menuGround(); screens.garage(save.state, app.picked); break; }
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
/* full screen: a button in the HUD beside the exit, and one on the title */
if (fullscreenSupported()) { hud.fs.hidden = false; hud.fs.innerHTML = fullscreenIcon(false); }
hud.fs.addEventListener('click', e => { e.stopPropagation(); toggleFullscreen(); });
/* sound on or off: a button in the HUD and one on the title */
function soundButton() { hud.snd.innerHTML = soundIcon(sound.muted); hud.snd.setAttribute('aria-label', sound.muted ? 'sound off' : 'sound on'); }
if (sound.available) { hud.snd.hidden = false; soundButton(); }
hud.snd.addEventListener('click', e => { e.stopPropagation(); sound.setMuted(!sound.muted); soundButton(); });
onFullscreenChange(on => { hud.fs.innerHTML = fullscreenIcon(on); hud.fs.setAttribute('aria-label', on ? 'exit full screen' : 'full screen'); if (app.state === 'title') showMenu('title'); });

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
  } else if (query.has('track')) {
    /* a track link: the Lab on that track, one click from driving it; a
       bad code is a plain message on the Lab, never a crash */
    const r = specFromCode(query.get('track'));
    if (r.error) { openLab(); app.lab.message = 'That link is not a track code: ' + r.error + '.'; app.lab.error = true; }
    else setLab(r.spec.settings, r.spec.seed, 'A shared track: ' + r.spec.code.slice(0, 4) + '-' + r.spec.code.slice(4, 8) + '-' + r.spec.code.slice(8));
    showMenu('lab');
  } else if (save.needsOnboarding() && query.get('title') !== '1') {
    /* the first visit: no title, no click, straight into career track 1
       with the prompts (RETENTION.md 1; CrazyGames asks for gameplay at
       once). The title comes after that run's results. */
    startRun(careerSpec(0), { onboard: true });
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
  app, save, LOOP, screens, sound, onboard, standIn: { tracks: TRACK_STAND_IN, cars: CAR_STAND_IN },
  lab: { setLab, labSpec, specFromCode, state: () => app.lab && { settings: app.lab.settings, seed: app.lab.seed, code: app.lab.code, message: app.lab.message, error: app.lab.error, track: app.lab.track && { name: app.lab.track.name, length: app.lab.track.length, kind: app.lab.track.kind, corners: app.lab.track.corners.length, bridges: (app.lab.track.bridges || []).length, fallback: !!app.lab.track.fallback, theme: app.lab.track.theme, preset: app.lab.track.preset } } },
  action: onAction, startRun, dailySpec, careerSpec, careerUnlocked, trackFor,
  progress: () => app.progress && app.progress.state,
  results: () => app.results,
  ghostHash: () => app.ghost ? app.ghost.hash() : null,
  ghostState: () => app.ghost ? { steps: app.ghost.state.steps, done: app.ghost.state.done, x: app.ghost.world.car.x, z: app.ghost.world.car.z, yaw: app.ghost.world.car.yaw } : null,
  skipCountdown() { if (app.state === 'countdown') { app.countdown = 0; } },
  missions: () => app.missions && { list: app.missions.missions, ...JSON.parse(JSON.stringify(app.missions.state)) },
  /* the probes: judge every mission the current track could carry, not only its three */
  judgeAll() { app.missions = createMissionJudge(allMissionsFor(app.track, app.laps), app.track, app.laps); app.missions.probe = true; app.heardMissions = 0; return app.missions.missions; },
  missionsFor: (track, laps) => missionsFor(track, laps),
  /* Replay a tape through the real run structure on the spec: the
     countdown skipped, every step a drive step, the results computed as
     the run's would be. No drawing. Returns the results. */
  replayRun(spec, t, keepJudge) {
    if (!keepJudge) startRun(spec);
    app.driver = null; app.countdown = 0; app.state = 'drive'; input.setStarted(true);
    for (const e of t) { for (let i = 0; i < e.n; i++) { if (app.settle > 0) break; driveStep({ steer: e.s, throttle: e.t, brake: e.b, handbrake: e.h }); } if (app.settle > 0) break; }
    if (app.settle > 0) finishRun(); else { app.state = 'results'; app.results = null; }
    return app.results;
  },
};
