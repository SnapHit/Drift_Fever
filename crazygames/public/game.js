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
  tuneOverlay();
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

/* ---- ?tune=1: camera sliders, for judging the camera by playing ----
   A CAM button opens sliders for the rig of the orientation in use (field
   of view, distance behind, height, pitch down) and the sideways smoothing.
   Changes apply at once and are remembered on this device while ?tune=1 is
   in the address; without it the shipped rigs are used. The line at the
   top of the panel is the setting to send back. Drawing only: nothing here
   touches the simulation. */
function tuneOverlay() {
  if (query.get('tune') !== '1') return;
  const W = world.probe.W, KEY = 'driftFeverCG.tune';
  const shipped = { PORTRAIT: Object.assign({}, W.PORTRAIT), LANDSCAPE: Object.assign({}, W.LANDSCAPE), CAM_X_LAG: W.CAM_X_LAG };
  try { const s = JSON.parse(window.localStorage.getItem(KEY) || 'null'); if (s) { Object.assign(W.PORTRAIT, s.PORTRAIT || {}); Object.assign(W.LANDSCAPE, s.LANDSCAPE || {}); if (typeof s.CAM_X_LAG === 'number') W.CAM_X_LAG = s.CAM_X_LAG; } } catch (e) {}
  const save = () => { try { window.localStorage.setItem(KEY, JSON.stringify({ PORTRAIT: W.PORTRAIT, LANDSCAPE: W.LANDSCAPE, CAM_X_LAG: W.CAM_X_LAG })); } catch (e) {} };
  const css = 'position:fixed;z-index:20;font:600 12px/1.3 system-ui,sans-serif;color:#fff;';
  const btn = document.createElement('button');
  btn.textContent = 'CAM';
  btn.style.cssText = css + 'left:8px;top:45%;padding:8px 10px;border-radius:8px;border:1px solid #4ff0ff;background:rgba(0,0,0,0.7)';
  const panel = document.createElement('div');
  panel.style.cssText = css + 'left:8px;right:8px;top:8px;max-width:420px;padding:10px;border-radius:10px;background:rgba(0,0,0,0.82);display:none';
  for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchend', 'keydown', 'keyup']) { panel.addEventListener(ev, e => e.stopPropagation()); btn.addEventListener(ev, e => e.stopPropagation()); }
  const head = document.createElement('div'); head.style.cssText = 'font:600 12px/1.4 monospace;margin-bottom:6px;white-space:pre-wrap';
  panel.appendChild(head);
  const rows = [];
  const orient = () => (window.innerHeight > window.innerWidth ? 'PORTRAIT' : 'LANDSCAPE');
  const fields = [['fov', 'field of view', 40, 130, 1], ['back', 'distance behind', 500, 12000, 50], ['height', 'height', 300, 10000, 50], ['pitch', 'pitch down', -10, 60, 0.5], ['lag', 'sideways smoothing s', 0, 0.5, 0.01]];
  for (const [k, label, min, max, step] of fields) {
    const row = document.createElement('label'); row.style.cssText = 'display:block;margin:4px 0';
    const txt = document.createElement('span'); const inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.style.cssText = 'width:100%';
    inp.addEventListener('input', () => { const v = +inp.value; if (k === 'lag') W.CAM_X_LAG = v; else W[orient()][k] = v; save(); refresh(); });
    row.appendChild(txt); row.appendChild(inp); panel.appendChild(row); rows.push([k, label, txt, inp]);
  }
  const reset = document.createElement('button'); reset.textContent = 'Reset to shipped';
  reset.style.cssText = 'margin-top:6px;padding:6px 10px;border-radius:6px';
  reset.addEventListener('click', () => { Object.assign(W.PORTRAIT, shipped.PORTRAIT); Object.assign(W.LANDSCAPE, shipped.LANDSCAPE); W.CAM_X_LAG = shipped.CAM_X_LAG; save(); refresh(); });
  panel.appendChild(reset);
  function refresh() {
    const o = orient(), r = W[o];
    head.textContent = o.toLowerCase() + ': fov ' + r.fov + ' back ' + r.back + ' up ' + r.height + ' pitch ' + r.pitch + ' lag ' + W.CAM_X_LAG;
    for (const [k, label, txt, inp] of rows) { const v = k === 'lag' ? W.CAM_X_LAG : r[k]; txt.textContent = label + ' ' + v; inp.value = v; }
  }
  btn.addEventListener('click', () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; refresh(); });
  window.addEventListener('resize', refresh);
  document.body.appendChild(panel); document.body.appendChild(btn);
  refresh();
}

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
    el.textContent = 'backend ' + i.backend + '  tier ' + i.tier + '  dpr ' + i.pixelRatio.toFixed(2) + '\nfps ' + shownFps.toFixed(0) + '  worst frame ' + shownWorst.toFixed(0) + ' ms\nworld js worst ' + shownJs.toFixed(1) + ' ms (scene ' + i.ms.scene.toFixed(1) + ' + submit ' + i.ms.submit.toFixed(1) + ')\ncurve heading 1/' + Math.round(1 / WORLD.CURVE_HEADING) + '  cam fov ' + world.probe.rig().fov + ' back ' + world.probe.rig().back + ' up ' + world.probe.rig().height + ' pitch ' + world.probe.rig().pitch;
    window.requestAnimationFrame(tickDbg);
  };
  window.requestAnimationFrame(tickDbg);
}
