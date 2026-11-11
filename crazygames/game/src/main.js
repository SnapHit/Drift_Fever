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
import { CAREER, CHAPTERS, chapterOf, chapterOpen, starsToOpen, careerSpec, dailySpec, careerUnlocked, starTargets, starsFor, coinsFor, lapsFor } from './loop/modes.js';
import { missionsFor, allMissionsFor, createMissionJudge, missionTally } from './loop/missions.js';
import { DEFAULT_SETTINGS, tidySettings, labSpec, specFromCode, randomSeed, linkFor, crossoverOffered, format as formatCode } from './lab/lab.js';
import { drawPlan } from './tracks/plan.js';
import { carTune, carById, carBox, carRev, upgradeLevels } from './garage/roster.js';
import { FX_ON } from './fx.js';
import { createDirector } from './camera/director.js';
import { TANDEM } from './tune.js';
import { createRival, gridStart } from './rivals/rival.js';
import { RIVALS, rivalById, rivalOpen, openRivals, rivalPaint, rivalIndex, rivalOnTrack, rivalState, rivalNeeds, rivalsLive } from './rivals/roster.js';
import { createPortraits } from './ui/portraits.js';
import { battleSpec, battleLaps } from './loop/modes.js';
import { createTandem } from './scoring/tandem.js';
import { createLead } from './scoring/lead.js';
import { createPlayer } from './rivals/players.js';

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
const director = FX_ON ? createDirector(THREE) : null;   // the spectacle round's camera moments, over the chase camera
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
  rival: null,   // in a drift race (the code says battle): the rival (rivals/rival.js), else null
  tandem: createTandem(),   // the close bonus, stepped only in a race (scoring/tandem.js)
  lead: null,               // in a race: the lead gates, the place and the gap (scoring/lead.js)
  dist: 0, distAlong: 0,    // in a race: the player's metres into the run, unwrapped
};
const rivalPose = { x: 0, y: 0, z: 0, yaw: 0, car: null };
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
/* start: in a race, the player's place on the grid (rivals/rival.js
   gridStart); otherwise the track's own start */
function setGround(ground, carId, paintId, start) {
  app.ground = ground;
  app.rival = null; app.lead = null; scene.setRival(null);
  app.world = createWorld(start ? Object.assign({}, ground, { start }) : ground, { tune: carTune(carId, save.state.cars[carId] && save.state.cars[carId].up) });
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
  if (app.rival) app.rival.reset();
  app.tandem.reset(); if (app.lead) app.lead.reset(); app.dist = app.ground.start ? app.ground.start.along || 0 : 0; app.distAlong = app.world.along;
  tape.length = 0; acc = 0; last = -1; app.runTime = 0;
  prev.x = world.car.x; prev.y = world.car.y || 0; prev.z = world.car.z; prev.yaw = world.car.yaw;
  chase.reset({ yaw: world.car.yaw });
  if (director) director.reset();
  if (autoDrive && app.state !== 'dev' && app.ground.centre.length) app.driver = app.rival ? createPlayer(app.ground, 'mixed', null, () => (app.rival && app.rival.solid() ? app.rival.world.car : null)) : createDriver(app.ground, { drift: '*' });
}

function stepOnce(rec) {
  const world = app.world, c = world.car;
  prev.x = c.x; prev.y = c.y || 0; prev.z = c.z; prev.yaw = c.yaw;
  const inp = app.driver ? quantise(app.driver.input(world)) : rec;
  if (app.rival) app.rival.step();   // his step first: the player's world meets him where he now is
  world.stepWorld(inp);
  record(inp);
  if (app.rival) {
    /* the tandem: the player's metres into the run, unwrapped, and whether his slide scores this step (as the scoring judges it) */
    let d = world.along - app.distAlong; const Lt = app.ground.length || 0;
    if (app.ground.kind === 'circuit') { if (d < -Lt / 2) d += Lt; else if (d > Lt / 2) d -= Lt; }
    app.dist += d; app.distAlong = world.along;
    const S = TUNE.SCORING, c = world.car, ang = Math.abs(c.slip) * 180 / Math.PI;
    app.tandem.step(world, app.rival, app.dist, ang >= S.MIN_ANGLE && c.speed >= S.MIN_SPEED && c.vx > 0);
    scoring.step(world, STEP, app.tandem.state);
  } else scoring.step(world, STEP);
  if (app.progress) app.progress.step(world);
  if (app.race) app.race.step(world, app.progress.state);
  if (app.lead) app.lead.step(app.progress.state, app.rival.progress.state, app.dist, app.rival.runDistance());
  if (app.missions && app.progress) app.missions.step(world, scoring.state, app.race, app.progress.state);
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
  if (FX_ON) scene.frameTime(t - last);   // the adaptation reads the browser's frame clock
  const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
  last = t;
  resize();
  const raw = input.read(t);
  if (window.__feel.inject) Object.assign(raw, window.__feel.inject);   // the probes' input
  const world = app.world;
  const S = app.state;
  const menu = S === 'title' || S === 'career' || S === 'rivals' || S === 'garage' || S === 'lab';
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
  /* after the line, time slows (the director's beat): the same physics steps, drawn over more frames */
  const finishing = !!director && ((S === 'drive' && app.settle > 0) || (S === 'results' && app.results && app.results.finished));
  if (finishing && director.state.finishT < 0) director.finish(world.lateral > 0 ? -1 : 1);
  const ts = finishing ? director.timeScale : 1;
  if (stepping) {
    if (S === 'drive' && app.goShown > 0) { app.goShown -= dt; if (app.goShown <= 0) hud.setCount('', false); }
    if (S === 'results') { rec = STOP; app.driver = null; }
    acc += dt * ts;
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
    if (S === 'drive' && app.settle > 0) { app.settle -= dt * ts; if (app.settle <= 0) finishRun(); }
    if (S === 'results') { app.lockout -= dt; if (app.lockout <= 0 && raw.action) onAction('again'); }
  }
  const alpha = stepping ? acc / STEP : 0;
  const c = world.car;
  let dy = c.yaw - prev.yaw; if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
  pose.x = prev.x + (c.x - prev.x) * alpha; pose.y = prev.y + ((c.y || 0) - prev.y) * alpha; pose.z = prev.z + (c.z - prev.z) * alpha; pose.yaw = prev.yaw + dy * alpha;
  pose.slip = c.slip; pose.speed = c.speed; pose.boost = c.boost; pose.layer = c.layer || 0;
  if (menu) { app.menuT += dt; chase.orbit(pose, app.menuT, scene.camera, view.w / view.h); }
  else {
    chase.update(pose, dt, scene.camera, view.w / view.h);
    if (director) director.apply(S === 'countdown' ? 'countdown' : finishing ? 'finish' : 'drive', pose, scene.camera, dt, S === 'countdown' ? 1 - Math.max(0, app.countdown) / LOOP.COUNTDOWN : 0, chase.state, app.rival && (S === 'countdown' || S === 'drive') ? app.rival.world.car : null);
  }
  const g = app.ghost && (S === 'drive' || S === 'results') ? app.ghost.pose(alpha, ghostPose) : null;
  let rv = null;
  if (app.rival && (S === 'drive' || S === 'countdown' || S === 'results')) {
    const rs = app.rival.scoring.state;
    rv = { pose: app.rival.pose(alpha, rivalPose), world: app.rival.world, mult: rs.chain > 0 ? rs.mult : 1, fade: S === 'results' && app.rivalRanOn ? 1 : app.rival.state.fade };
  }
  scene.update(pose, world, dt * ts, g, { mult: scoring.state.chain > 0 ? scoring.state.mult : 1, rival: rv });
  sound.update(world.car, S === 'drive' || S === 'countdown' || S === 'free' || S === 'dev', world.touching);
  if (app.frameHit) { sound.hit(app.frameHit.speed, app.frameHit.hard); if (director && app.frameHit.hard) director.hardHit(); app.frameHit = null; }
  /* the score's sounds, from the callouts it queued this frame */
  const sc = scoring.state;
  if ((app.heardCallouts || 0) > sc.calloutCount) app.heardCallouts = 0;   // the score was reset
  if (sc.calloutCount !== app.heardCallouts) {
    const fresh = Math.min(sc.callouts.length, sc.calloutCount - (app.heardCallouts || 0));
    for (const co of sc.callouts.slice(-fresh)) {
      if (co.kind === 'lost') sound.ui('lost');
      else if (co.kind === 'bank') { const drift = !/^(CLEAN|PACE)/.test(co.text); sound.ui(drift ? 'bank' : 'clean', sc.lastBankMult); if (director && drift) director.bank(sc.lastBankMult); }
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
  hud.update(scoring, pose, scene.camera, THREE, view, dt, app.lead ? app.lead.state.player.total : 0);
  if (app.rival && (S === 'drive' || S === 'countdown')) {
    hud.battle(app.tandem.state, app.rival, scoring.state, rv, scene.camera, THREE, view, dt, S === 'countdown', app.lead.state);
    /* the first battle ever: one prompt, as he starts his first slide */
    if (app.battleIntro && app.rival.state.sliding && S === 'drive') { app.battleIntro = false; hud.prompt('Slide close to him for more points, ahead or behind', 3.2); }
    const tc = app.tandem.state;
    if ((app.heardTandem || 0) > tc.calloutCount) app.heardTandem = 0;
    if (tc.calloutCount !== app.heardTandem) {
      for (const co of tc.callouts.slice(-Math.min(tc.callouts.length, tc.calloutCount - (app.heardTandem || 0)))) { hud.notice(co.text, co.kind); if (co.kind === 'tandem') sound.ui('clean'); }
      app.heardTandem = tc.calloutCount;
    }
  }
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
  else if (name === 'rivals') showRivals();
  else if (name === 'garage') screens.garage(save.state, app.picked);
  else if (name === 'lab') showLab();
}

/* THE RIVALS SCREEN (briefs/RIVALS-LADDER.md): each rival's portrait is
   his car in his paint (the paint he races in against the player's car),
   drawn by the game's renderer the first time the screen opens. */
const portraits = createPortraits(THREE, scene.renderer, () => scene.render());
function showRivals() {
  const mine = save.state.cars[save.state.car] ? save.state.cars[save.state.car].paint : 'cyan';
  if (running) portraits.make(RIVALS.map(d => ({ car: d.car, paint: rivalPaint(d, mine) })));
  screens.rivals(save.state, { portrait: portraits.get });
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
  app.progress = null; app.race = null; app.ghost = null; app.missions = null; scene.setGhost(null);
  resetRun(); app.driver = null;
}

/* A saved ghost only drives the track it was recorded on. A ghost from an
   earlier generator version (gen) was recorded on a different layout of
   the same seed, and one from before its car's handling changed (rev)
   drove a different car, so either is ignored, left in the save, and
   replaced by the next ghost worth keeping. */
function ghostFor(key, track) {
  const rec = save.ghost(key);
  if (!rec || rec.gen !== (track.version || 1) || rec.rev !== carRev(rec.car)) return null;
  /* a career slot whose seed was replaced: a ghost recorded on another seed, or with none on a slot that has had two, drove another layout */
  const m = /^career:(\d+)$/.exec(key), c = m ? CAREER[+m[1]] : null;
  if (c && (rec.seed !== undefined ? rec.seed !== c.seed : c.was !== undefined)) return null;
  return rec;
}

/* Which controls the prompts should draw: the source that moved last,
   or, before anything has, the touch pad if it is showing. */
function inputSource() {
  const src = input.record.source;
  if (src === 'keys' && !input.keyUsed && input.touch.el.classList.contains('on')) return 'touch';
  return src;
}

/* which run this is, over the countdown, so a new player landed in a
   run knows it is the first of a career, and a player in Pro knows it */
function runHead(spec) {
  if (spec.mode === 'career') { const ch = CHAPTERS[chapterOf(spec.index)]; return { label: 'CAREER \u00b7 ' + ch.name.toUpperCase() + ' \u00b7 TRACK ' + (spec.index - ch.from + 1) + ' OF ' + (ch.to - ch.from), name: spec.name }; }
  if (spec.mode === 'daily') return { label: 'DAILY DRIFT', name: 'A new track every day' };
  if (spec.mode === 'lab') return { label: 'TRACK LAB', name: formatCode(spec.code) };
  if (spec.mode === 'battle') { const d = rivalById(spec.rival); return { label: 'DRIFT RACE \u00b7 ' + d.name.toUpperCase(), name: 'Outscore him. Lead at the gates and the line for a bonus.', battle: true }; }
  return null;
}

/* What a career run did to the ladder, for the results card: unlock is
   the main line (a chapter or a track just opened, or what opens the next
   track), note a second line (another track opened by the same run, or
   how many more stars open the next chapter), nextIndex the track NEXT
   plays. wasOpen and nextChapterWasOpen are the next track and the next
   chapter as they were before the run's result was saved. */
function careerNews(index, wasOpen, nextChapterWasOpen) {
  const c = chapterOf(index), ch = CHAPTERS[c], n = index + 1, size = ch.to - ch.from, up = CHAPTERS[c + 1];
  let unlock = null, note = null, nextIndex = null;
  const trackLine = () => n < ch.to && !wasOpen
    ? careerUnlocked(save.state, n) ? { done: true, text: 'Track ' + (n - ch.from + 1) + ' of ' + size + ' unlocked: ' + CAREER[n].name } : { done: false, text: 'Win a star to unlock track ' + (n - ch.from + 1) + ' of ' + size }
    : null;
  if (up && !nextChapterWasOpen && chapterOpen(save.state, c + 1)) {
    /* this run opened the next chapter: NEXT goes to its first track */
    unlock = { done: true, chapter: up.id, text: up.name + ' unlocked: ' + CAREER[up.from].name };
    nextIndex = up.from;
    const t = trackLine(); if (t && t.done) note = { text: t.text };
  } else {
    if (n < CAREER.length && careerUnlocked(save.state, n)) nextIndex = n;
    unlock = trackLine();
    if (up && !chapterOpen(save.state, c + 1)) { const k = starsToOpen(save.state, c + 1); note = { text: k + ' more ' + ch.name + ' star' + (k === 1 ? '' : 's') + ' to open ' + up.name }; }
  }
  return { unlock, note, nextIndex };
}

function startRun(spec, opts) {
  app.spec = spec; app.key = spec.key;
  app.track = trackFor(spec);
  const carId = save.state.car, paint = save.state.cars[carId].paint;
  const raceDef = spec.mode === 'battle' ? rivalById(spec.rival) : null;
  /* a race starts level: the rival on his side of the grid, the player on the other */
  setGround(app.track, carId, paint, raceDef ? gridStart(app.track, -(raceDef.side || 1)) : null);
  app.laps = raceDef ? battleLaps(app.track, raceDef) : lapsFor(app.track);
  app.targets = starTargets(app.track, app.laps);
  app.progress = createProgress(app.track, app.laps);
  app.race = createRace(app.track, app.laps, scoring);
  /* the career tracks and the daily carry missions; the Lab does not */
  const missions = spec.mode === 'career' || spec.mode === 'daily' ? missionsFor(app.track, app.laps) : null;
  app.missions = missions ? createMissionJudge(missions, app.track, app.laps) : null;
  app.heardMissions = 0;
  /* the list over the countdown; not on the onboarding run, which teaches the core and nothing else (the missions are still judged and paid) */
  const listed = missions && !(opts && opts.onboard);
  const head = runHead(spec);
  hud.setMissions(listed ? missions.map((m, i) => ({ text: m.text, done: !!(save.state.missions[spec.key] || [])[i] })) : null, head);
  app.missionsShown = listed || head ? LOOP.MISSIONS.SHOWN : 0;
  const rec = spec.mode === 'battle' ? null : ghostFor(spec.key, app.track);   // no ghost is kept for a battle
  app.ghost = rec ? createGhost(app.track, rec) : null;
  scene.setGhost(rec ? rec.car : null, rec ? rec.paint : null);
  hud.setToBeat(rec ? 'best ' + rec.score : spec.mode === 'lab' ? (save.labBest(spec.code) ? 'best ' + save.labBest(spec.code).best : '') : (save.state.career[String(spec.index)] ? 'best ' + save.state.career[String(spec.index)].best : ''));
  /* a race: the rival beside the player on the grid, solid, and the lead gates */
  if (spec.mode === 'battle') {
    const def = raceDef;
    app.rival = createRival(app.track, def, app.laps, app.rivalProbe || undefined);   // rivalProbe: the measurements' disturbances and known answers only
    app.lead = createLead(app.track, app.laps);
    app.world.obstacle = () => app.rival.body();
    scene.setRival(def.car, rivalPaint(def, paint));
    app.battleIntro = Object.keys(save.state.rivals).length === 0;
    hud.setBattle({ name: def.name });
    hud.setToBeat('');
  } else hud.setBattle(null);
  app.rivalRanOn = false; app.heardTandem = 0;
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
  if (app.spec.mode === 'battle') return finishBattle();
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
  let improved = false, nextIndex = null, unlock = null, note = null, offer = null;
  if (spec.mode === 'career') {
    /* say what the career is: a chapter or a track just opened, what opens the next, and how far the next chapter is */
    const n = spec.index + 1, c = chapterOf(spec.index);
    const wasOpen = n < CAREER.length && careerUnlocked(save.state, n), nextChapterWasOpen = c + 1 < CHAPTERS.length && chapterOpen(save.state, c + 1);
    const rivalsBefore = openRivals(save.state);
    improved = save.careerResult(spec.index, stars, score);
    /* the offer repeats (briefs/RIVALS-LADDER.md): a result on a rival's track offers his race whenever he is earned and not yet beaten */
    const here = rivalOnTrack(spec.index), k = here ? rivalIndex(here.id) : -1;
    if (here && rivalState(save.state, k) === 'open') offer = { id: here.id, name: here.name, fresh: !rivalsBefore.includes(here.id) };
    ({ unlock, note, nextIndex } = careerNews(spec.index, wasOpen, nextChapterWasOpen));
  }
  else if (spec.mode === 'daily') improved = save.dailyResult(spec.date, stars, score);
  else if (spec.mode === 'lab') improved = save.labResult(spec.code, stars, score);
  save.addCoins(coins);
  const steps = tape.reduce((s, e) => s + e.n, 0);
  const prevGhost = ghostFor(spec.key, app.track);
  let ghostSaved = false;
  if (steps >= LOOP.GHOST_MIN_STEPS && (!prevGhost || score > prevGhost.score)) {
    ghostSaved = save.setGhost(spec.key, { score, best, car: save.state.car, paint: save.state.cars[save.state.car].paint, steps, hash: app.world.hash(), tape: compactTape(tape), when: Date.now(), seconds: app.runTime, gen: app.track.version || 1, ...(spec.mode === 'career' ? { seed: spec.seed } : {}), rev: carRev(save.state.car), up: upgradeLevels(save.state.cars[save.state.car].up) });
  }
  app.results = { finished: true, score, best, parts: { drift: scoring.state.drift, clean: scoring.state.clean, pace: scoring.state.pace }, cleanSectors: app.race ? app.race.state.clean + ' of ' + app.race.state.sectors : '', stars, newStars, targets: app.targets, coins, improved, mode: spec.mode, name: spec.name, seconds: app.runTime, nextIndex, laps: app.laps, kind: app.track.kind, ghostSaved, steps, hash: app.world.hash(), missions, missionTally: missionTally(save.state, CAREER.length), unlock, note, offer, label: runHead(spec) ? runHead(spec).label : '', code: spec.mode === 'lab' ? spec.code : null };
  app.state = 'results'; app.lockout = LOOP.RESULTS_LOCKOUT;
  if (onboard.active) onboard.stop(false);
  save.setOnboarded();
  if (FX_ON && stars > 0) scene.fireworks(stars);
  for (let i = 0; i < stars; i++) sound.ui('star', i + 1, 0.35 + i * 0.28);
  sound.ui('coin', 0, 0.45 + stars * 0.28);
  hud.setCount('', false); hud.setVisible(false); hud.setMissions(null); input.touch.setVisible(false);
  screens.results(app.results);
  if (FX_ON) countCoins(0.45 + stars * 0.28);
}
/* A drift race's end (briefs/DRIFT-RACE.md; the code says battle): the
   rival run on to his line if the player finished first, both totals
   (each car's own score plus the lead and line bonuses it banked), who
   won (a tie is the player's), what each part was worth for each car,
   the coins (the run's at the career rate with no stars, and the prize
   the first time he is beaten), and the next thing to do. No stars, no
   ghost, no missions, nothing in the career: races gate nothing that
   exists. */
function finishBattle() {
  const spec = app.spec, def = rivalById(spec.rival), R = app.rival, L = app.lead.state;
  if (!R.state.finished) { R.finishRun(); app.rivalRanOn = true; }
  const score = scoring.state.total + L.player.total, them = R.scoring.state.total + L.rival.total, won = score >= them, margin = score - them;
  const before = openRivals(save.state);
  const first = save.rivalResult(def.id, won, margin);
  const opened = openRivals(save.state).find(id => !before.includes(id)) || null;
  const coins = Math.floor(score * LOOP.COIN_PER_POINT) + (first ? def.prize : 0);
  save.addCoins(coins);
  save.setOnboarded();
  const s = scoring.state, rs = R.scoring.state;
  app.results = { finished: true, battle: true, mode: 'battle', score, best: s.best, rival: { id: def.id, name: def.name, total: them, seconds: R.state.finishTime }, won, margin, first, prize: first ? def.prize : 0,
    tandem: s.tandem, parts: { drift: s.drift - s.tandem, clean: s.clean, pace: s.pace, leads: L.player.lead, line: L.player.line, close: s.tandem },
    rivalParts: { drift: rs.drift, clean: rs.clean, pace: rs.pace, leads: L.rival.lead, line: L.rival.line, close: 0 },
    gates: L.gates, leadGates: L.player.gates, rivalGates: L.rival.gates, lineTo: L.owner[L.gates - 1] || null, changes: L.changes,
    coins, name: spec.name, label: runHead(spec).label, seconds: app.runTime, laps: app.laps, kind: app.track.kind, steps: tape.reduce((n, e) => n + e.n, 0), hash: app.world.hash(), rivalHash: R.hash(),
    offer: opened ? { id: opened, name: rivalById(opened).name } : null, next: nextRival(def), nextIndex: null, best2: (save.state.rivals[def.id] || {}).best };
  app.state = 'results'; app.lockout = LOOP.RESULTS_LOCKOUT;
  if (FX_ON && won) scene.fireworks(3);
  if (won) for (let i = 0; i < 3; i++) sound.ui('star', i + 1, 0.35 + i * 0.28);
  sound.ui('coin', 0, 0.45 + (won ? 3 : 0) * 0.28);
  hud.setCount('', false); hud.setVisible(false); hud.setMissions(null); input.touch.setVisible(false);
  screens.results(app.results);
  if (FX_ON) countCoins(0.45 + (won ? 3 : 0) * 0.28);
}
/* The rival after def on the ladder, for a race's results: his name, and
   either that he is open (a button) or what still earns him; null after
   the last rival in the game. */
function nextRival(def) {
  const k = rivalIndex(def.id) + 1;
  if (k >= rivalsLive()) return k < RIVALS.length ? null : { last: true };
  const d = RIVALS[k], st = rivalState(save.state, k);
  return { id: d.id, name: d.name, open: st === 'open' || st === 'beaten', beaten: st === 'beaten', needs: rivalNeeds(save.state, k) };
}
/* the results' coins count up from nothing, starting with the coin sound */
let coinTimer = 0;
function countCoins(delay) {
  clearInterval(coinTimer);
  const el = document.querySelector('#screens .coinsN');
  if (!el) return;
  const to = +el.dataset.to || 0, t0 = performance.now() + delay * 1000, span = 700;
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  el.textContent = '+0';
  coinTimer = setInterval(() => {
    const k = Math.max(0, Math.min(1, (performance.now() - t0) / span));
    if (!el.isConnected) { clearInterval(coinTimer); return; }
    el.textContent = '+' + fmt(to * (1 - Math.pow(1 - k, 3)));
    if (k >= 1) clearInterval(coinTimer);
  }, 33);
}

function startFree() {
  if (onboard.active) onboard.stop(false);
  app.spec = { mode: 'free', key: 'free', name: 'Free drift' };
  app.track = freeGround();
  setGround(app.track, save.state.car, save.state.cars[save.state.car].paint);
  app.progress = null; app.race = null; app.ghost = null; app.missions = null; hud.setMissions(null); scene.setGhost(null);
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
    case 'rivals': menuGround(); showMenu('rivals'); break;
    case 'garage': app.picked = null; showMenu('garage'); break;
    case 'free': startFree(); break;
    case 'daily': startRun(dailySpec()); break;
    case 'onboard': startRun(careerSpec(0), { onboard: true }); break;
    case 'lab': if (app.state !== 'lab' && app.lab && app.lab.spec) setLab(app.lab.settings, app.lab.seed); showMenu('lab'); break;   // back from a run: the car to the line, the backdrop as the Lab left it
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
    case 'battle': { const d = rivalById(arg); if (d && rivalOpen(save.state, d.id)) startRun(battleSpec(d)); break; }
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
  if (FX_ON) {
    document.body.classList.add('fx');
    /* the low tier has no post pass, so its vignette is a gradient over the canvas (the high tier's is in the grade) */
    if (scene.info().tier === 'low') { const v = document.createElement('div'); v.id = 'vignette'; document.body.insertBefore(v, root); }
  }
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
  /* opts.player: 'grip', 'slide' or 'mixed', a scripted player with a player's hands (rivals/players.js); else the scripted drifter's options */
  setDriver(opts) { app.driver = opts ? (opts.player ? createPlayer(app.ground, opts.player, opts.drive, () => (app.rival && app.rival.solid() ? app.rival.world.car : null)) : createDriver(app.ground, opts)) : null; return app.driver; },
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
  action: onAction, startRun, dailySpec, careerSpec, careerUnlocked, trackFor, battleSpec: id => battleSpec(rivalById(id)), RIVALS, TANDEM,
  rival: () => app.rival, tandem: () => app.tandem.state, lead: () => app.lead && app.lead.state,
  /* the probes: the next battle's rival with a start offset, a grip share or a driving number changed (rivals/rival.js opts); null for none */
  setRivalProbe(o) { app.rivalProbe = o || null; },
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
