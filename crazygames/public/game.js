/* THE HOST. Drift Fever: CrazyGames edition, stage 2.

   One simulation, two renderers. This page makes the vendored simulation,
   the 3D world and the original's chrome, wires the simulation's hooks to
   the halves that own them, and starts the original's own frame function.
   The frame order is the original's to the line: chrome.js carries
   frame() verbatim, with every simulation name reaching the module
   through SIM.

   Nothing here fetches anything. The music is loaded by the chrome's own
   tune code, from the local music/ folder, after the first playable frame. */
import { createSim } from './sim/drift-fever-sim.js';
import { createChrome, CHROME_HOOKS } from './chrome.js';
import { createWorld, WORLD } from './world.js';

const query = (() => { try { return new URLSearchParams(window.location.search); } catch (e) { return new URLSearchParams(); } })();

/* ---- the simulation ---- */
const hooks = {
  now: () => new Date(),
  random: () => Math.random(),
  storeGet: k => window.localStorage.getItem(k),
  storeSet: (k, v) => { window.localStorage.setItem(k, v); },
};
const sim = createSim(hooks);

/* THE SIMULATION VIEW. Every simulation variable as an accessor, every
   simulation function as a method, so the chrome and the world read and
   write the module through its own access table and nothing else. */
const SIM = {};
for (const n of new Set(sim.names)) {
  let writable = true;
  try { sim.set(n, sim.get(n)); } catch (e) { writable = false; }
  Object.defineProperty(SIM, n, { get: () => sim.get(n), set: writable ? v => sim.set(n, v) : undefined, enumerable: true });
}
for (const n in sim.fn) SIM[n] = sim.fn[n];

/* ---- the world ---- */
const worldCanvas = document.getElementById('world');
const world = createWorld(SIM, worldCanvas, { renderer: query.get('renderer') === 'webgl2' ? 'webgl2' : undefined, tier: query.get('tier') || undefined });

/* THE PARITY KNOWN ANSWER. The parity test sets window.__parityBreak to
   the name of a simulation field before the page loads, and the renderer
   then writes that field every frame, which is the one thing a renderer
   must never do. The comparison must fail. Unset in play. */
const parityBreak = window.__parityBreak || null;

/* ---- the chrome ---- */
let frameDtSeen = 1 / 60;
const WORLD_HOOKS = {
  render(w, h) {
    world.setFrameDt(Math.min(SIM.FEEL.MAX_FRAME_DELTA, frameDtSeen));
    if (parityBreak) { const v = SIM[parityBreak]; if (typeof v === 'number') SIM[parityBreak] = v + 1e-6; }
    world.render(w, h);
  },
  // the world passes the original's render called, now the 3D canvas
  drawSkyline() {}, drawGrid() {}, drawRoad() {}, drawSmoke() {}, drawCar() {}, drawCarReflection() {}, drawDebris() {},
  spawnSmoke() {}, updateSmoke(dt) { world.hooks.updateSmoke(dt); }, clearSmoke() { world.hooks.clearSmoke(); }, updateDebris() {},
  finaleShells(n) { world.hooks.finaleShells(n); }, fireworkLaunch() {}, fireworkBurst() {}, addShake(px) { world.hooks.addShake(px); },
};
const chrome = createChrome(SIM, WORLD_HOOKS, document);

/* The three values the simulation stubbed are the chrome's real ones: the
   palette, so callouts carry colours rather than role names; the icons
   and the pause button, so setPaused paints the real button. */
sim.set('COLOUR', chrome.get('COLOUR'));
sim.set('ICON', chrome.get('ICON'));
sim.set('pauseBtn', chrome.get('pauseBtn'));

/* The simulation's hooks, each wired to the half that owns it. */
for (const n of CHROME_HOOKS) sim.hooks[n] = (...a) => chrome.fn[n](...a);
sim.hooks.applyBiome = i => chrome.fn.applyBiomeChrome(i);
sim.hooks.stopTiltHint = remember => chrome.fn.stopTiltHintChrome(remember);
sim.hooks.recomputeCamera = () => chrome.fn.recomputeCameraChrome();
for (const n of ['addShake', 'updateSmoke', 'clearSmoke', 'updateDebris', 'explode', 'clearDebris', 'landImpact', 'finaleShells']) sim.hooks[n] = (...a) => world.hooks[n](...a);

/* ---- boot, as the original's last lines had it ---- */
if (SIM.bootFlash > 0) { try { document.documentElement.classList.add('booting'); } catch (e) {} }
else chrome.set('bootChromeHidden', false);
if (chrome.get('debugAllowed')) chrome.fn.setDebug(true);
chrome.fn.applyBiomeChrome(SIM.biome);

/* The frame loop is the original's frame(), re armed by itself. A
   measured dt is kept for the world's particles. */
let lastSeen = 0;
const frame = chrome.fn.frame;
function tick(now) {
  frameDtSeen = lastSeen ? (now - lastSeen) / 1000 : 1 / 60;
  lastSeen = now;
  frame(now);
}
/* Exposed for the parity test and the probes: the same narrow interface
   the original page offers through its adapter, plus the page's frame. */
window.__S = {
  get: n => { try { return sim.get(n); } catch (e) { return chrome.get(n); } },
  set: (n, v) => { try { sim.set(n, v); } catch (e) { if (/no such state/.test(String(e))) chrome.set(n, v); else throw e; } },
  fn: Object.assign({}, sim.fn, { __frame: t => { frameDtSeen = 17 / 1000; frame(t); } }),
  seedRandom: k => { if (window.__seedRandom) window.__seedRandom(k); },
  chrome, world, sim, SIM,
};
window.__names = sim.names;
window.__commit = sim.commit;

world.ready.then(() => {
  chrome.fn.resize();
  debugOverlay();
  window.__ready = true;
  /* The probe drives the page by hand through __frame and never lets
     the loop run; the stubbed requestAnimationFrame it installs before
     load makes this a no op there. */
  window.requestAnimationFrame(tick);
}).catch(e => {
  const el = document.getElementById('note');
  if (el) { el.textContent = 'The 3D renderer could not start: ' + (e && e.message || e); el.hidden = false; }
  console.error(e);
});

/* ---- ?debug=1: the backend, the tier, the frame rate and the worst frame ---- */
function debugOverlay() {
  if (!chrome.get('debugAllowed')) return;
  const el = document.createElement('div');
  el.id = 'worldDebug';
  el.style.cssText = 'position:fixed;left:8px;bottom:112px;z-index:9;pointer-events:none;color:#fff;background:rgba(0,0,0,0.6);padding:4px 6px;font:600 11px/1.3 monospace;white-space:pre';
  document.body.appendChild(el);
  let frames = 0, worst = 0, elapsed = 0, last = performance.now(), shownFps = 0, shownWorst = 0, worstJs = 0, shownJs = 0;
  const tickDbg = () => {
    const now = performance.now();
    const dt = (now - last) / 1000; last = now;
    frames++; elapsed += dt; if (dt > worst) worst = dt;
    const ms = world.info().ms.total; if (ms > worstJs) worstJs = ms;
    if (elapsed >= 1) { shownFps = frames / elapsed; shownWorst = worst * 1000; shownJs = worstJs; frames = 0; elapsed = 0; worst = 0; worstJs = 0; }
    const i = world.info();
    el.textContent = 'backend ' + i.backend + '  tier ' + i.tier + '  dpr ' + i.pixelRatio.toFixed(2) + '\nfps ' + shownFps.toFixed(0) + '  worst frame ' + shownWorst.toFixed(0) + ' ms\nworld js worst ' + shownJs.toFixed(1) + ' ms (scene ' + i.ms.scene.toFixed(1) + ' + submit ' + i.ms.submit.toFixed(1) + ')\ncurve heading 1/' + Math.round(1 / WORLD.CURVE_HEADING) + '  cam ' + WORLD.CAM_HEIGHT + '/' + WORLD.CAM_BACK;
    window.requestAnimationFrame(tickDbg);
  };
  window.requestAnimationFrame(tickDbg);
}
