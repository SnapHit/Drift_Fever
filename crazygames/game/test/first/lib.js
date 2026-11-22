/* SHARED BY THE FIRST MINUTE'S PROBES (briefs/FIRST-MINUTE.md). Every
   measure here is before and after: main's game out of git (served from
   a temporary folder with its own harness, as look/switch.js and
   park/same.js do it) and this branch's, in the same kind of browser,
   with the same scripted hands (thumbs.js) handed into both pages.

   side(name)            { dir, R }: 'main' (origin/main, or MAIN_REF) or 'branch'
   RUNNER                the page's half: window.__first.run(seed, opts) plays a
                         newcomer's first run from the title's start here press to
                         the results with the thumbs, and returns a row per frame
   COLS                  the names of a row's numbers
   writeJson, say, failed, dir (review/first/)

   Run from crazygames/ with PLAYWRIGHT_BROWSERS_PATH set. */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeThumbs } from './thumbs.js';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..', '..', '..');   // crazygames/
export const repo = path.resolve(root, '..');
export const dir = path.join(root, 'review', 'first');
fs.mkdirSync(dir, { recursive: true });

let fails = 0;
export const say = (pass, text) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + text); return pass; };
export const failed = () => fails;
export function writeJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 1)); }

/* main out of git, once per process */
let mainDir = null;
export const mainRef = process.env.MAIN_REF || 'origin/main';
export function mainCommit() { return execFileSync('git', ['-C', repo, 'rev-parse', '--short', mainRef]).toString().trim(); }
export function extractMain() {
  if (mainDir) return mainDir;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-main-'));
  execFileSync('sh', ['-c', `git -C "${repo}" archive ${mainRef} crazygames music 2>/dev/null | tar -x -C "${tmp}" || git -C "${repo}" archive ${mainRef} crazygames | tar -x -C "${tmp}"`]);
  fs.symlinkSync(fs.realpathSync(path.join(root, 'node_modules')), path.join(tmp, 'crazygames', 'node_modules'));
  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* left for the system */ } });
  return (mainDir = path.join(tmp, 'crazygames'));
}
/* a side's own harness (its feel/lib.js), so main runs main's */
export async function side(name) {
  const d = name === 'main' ? extractMain() : root;
  const R = await import(pathToFileURL(path.join(d, 'game', 'test', 'feel', 'lib.js')).href + '?' + name);
  return { name, dir: d, R };
}

/* the columns of a frame's row */
export const COLS = ['t', 'st', 's', 'lat', 'hw', 'v', 'ang', 'r', 'dr', 'hbS', 'inS', 'inH', 'inT', 'inB', 'touch', 'hit', 'hard', 'resp', 'total', 'chain', 'mult', 'prompt', 'cx', 'cy', 'cz', 'cyaw', 'cpitch', 'fov', 'shake', 'fin', 'lap', 'real', 'pipes'];
export const PROMPTS = [null, 'steer', 'drift', 'brake', 'drive', 'hold'];

/* the page's half, handed in as text: the thumbs and the run */
export const RUNNER = `(function () {
  const makeThumbs = (${makeThumbs.toString()});
  const PROMPTS = ${JSON.stringify(PROMPTS)};
  const KEYS = { left: ['ArrowLeft', 'ArrowLeft'], right: ['ArrowRight', 'ArrowRight'], hb: [' ', 'Space'], w: ['w', 'KeyW'], s: ['s', 'KeyS'] };
  const key = (name, down) => { const k = KEYS[name]; window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k[0], code: k[1], bubbles: true })); };
  const r3 = v => Math.round(v * 1000) / 1000, r1 = v => Math.round(v * 10) / 10;
  window.__first = {
    /* opts: { pro (keys on Pro), scale (the thumbs' known answer), maxS, started (the run already begun by a real press), tweak (page source run before the run starts), draw, keepClock,
       flush (hitches.js: drawing, each frame stepped with the GPU idle before it, so its time is its own work; the run is then a promise), inject: { at (s of the run), src (page source run once then: a known answer) },
       pause: { corner, share } (strip.js, with flush: the frame the car is share of the way through that corner on the first lap is drawn, and the run waits there for window.__first.resume(); window.__first.paused says when) } */
    run(seed, opts) {
      const o = opts || {}, L = window.__loop, F = window.__feel, A = L.app;
      if (!o.keepClock) window.__clock = 1000;   // every run from the same clock: the game's dt is a difference of it, and a countdown that ends a frame later is another run
      F.draw = !!o.draw;   // the run's numbers need no pictures (the hitch probe draws)
      if (o.tweak) new Function(o.tweak)();
      if (!o.started) {   /* started: a real press on start here already began the run (garage.js) */
        const btn = document.querySelector('#screens.on [data-action="first"]');
        if (!btn) return { error: 'no start here button on the title (state ' + A.state + ')' };
        btn.click();
      }
      if (A.state !== 'countdown') return { error: 'start here did not start a run: ' + A.state };
      if (o.skip) { const sk = document.querySelector('#skip'); if (sk && !sk.hidden) sk.click(); }   // a stranger who presses SKIP at once (the prompts' own cost, measured)
      const track = A.track, world = F.world;
      const th = makeThumbs(track, seed, { pro: !!o.pro, scale: o.scale });
      /* every step's hits and recoveries, not only the last step of a frame's */
      let fHit = 0, fHard = 0, fResp = 0;
      const orig = world.stepWorld;
      world.stepWorld = function (inp) { orig(inp); if (world.hit) { fHit = Math.max(fHit, world.hit.speed); if (world.hit.hard) fHard++; } if (world.respawned) fResp = world.recovered ? 2 : 1; };
      const held = { left: 0, right: 0, hb: 0, w: 0, s: 0 };
      const rows = [];
      const cam = F.scene.camera, dirV = new (F.scene.THREE.Vector3)();
      const maxFrames = Math.round((o.maxS || 240) * 60);
      let resultsAt = -1, t0 = performance.now(), injected = false, pauseDue = false, pausedOnce = false;
      const pc = o.pause ? track.corners[o.pause.corner] : null, pauseAt = pc ? pc.from + (pc.to - pc.from) * o.pause.share : 0;
      const R0 = F.scene.renderer, pipes = () => (R0._pipelines && R0._pipelines.caches ? R0._pipelines.caches.size : 0);
      const gpu = () => { const d = window.__gpuCanvas && window.__gpuCanvas.device(); if (d) return d.queue.onSubmittedWorkDone(); if (R0.backend && R0.backend.gl) R0.backend.gl.finish(); return null; };
      const one = f => {
        const ob = L.onboard, step = ob.active && ob.visible() ? ob.state.step : null;
        if (o.inject && !injected && A.runTime >= o.inject.at) { injected = true; new Function(o.inject.src)(); }
        const b = th.frame(world, { state: A.state, prompt: step, pro: !!o.pro });
        for (const k of ['left', 'right', 'hb', 'w', 's']) {
          const want = b[k] ? 1 : 0;
          if (want === held[k]) continue;
          held[k] = want;
          if (o.pro) key(k, !!want);
          else if (k === 'left' || k === 'right' || k === 'hb') F.input.touch.press(k, !!want);
        }
        fHit = 0; fHard = 0; fResp = 0;
        if (pc && !pausedOnce && A.state === 'drive' && A.runTime > 1 && world.along >= pauseAt && world.along < pc.to) { pausedOnce = true; pauseDue = true; F.draw = true; }
        window.__clock += 1000 / 60;
        const p0 = pipes(), ta = performance.now();
        F.frame(window.__clock);
        const real = performance.now() - ta, built = pipes() - p0;
        const c = world.car, s = F.scoring.state, p = L.progress(), rec = F.input.record;
        cam.getWorldDirection(dirV);
        const st = A.state === 'countdown' ? 0 : A.state === 'drive' ? 1 : A.state === 'results' ? 2 : 3;
        const pcode = PROMPTS.indexOf(step) > 0 ? PROMPTS.indexOf(step) : (ob.active && !ob.el.querySelector('.info').hidden ? 6 : 0);
        rows.push([r3(A.runTime), st, r1(world.along), r1(world.lateral), r1(world.halfWidth || 0), r3(c.speed), r1(c.slip * 180 / Math.PI), r1(c.r * 180 / Math.PI), c.drifting ? 1 : 0, r3(c.hb), rec.steer, rec.handbrake, rec.throttle, rec.brake, world.touching ? 1 : 0, r3(fHit), fHard, fResp, s.total, r1(s.chain), s.mult, pcode,
          r3(cam.position.x), r3(cam.position.y), r3(cam.position.z), r1(Math.atan2(-dirV.x, -dirV.z) * 180 / Math.PI), r1(Math.asin(Math.max(-1, Math.min(1, dirV.y))) * 180 / Math.PI), r1(cam.fov), r3(F.chase.state.shake), p && p.finished ? 1 : 0, p ? p.lap : -1, r1(real), built]);
        if (A.state === 'results') { if (resultsAt < 0) resultsAt = f; if (f - resultsAt >= 30) return true; }
        return false;
      };
      const finish = () => {
      world.stepWorld = orig;
      for (const k of Object.keys(held)) if (held[k]) { if (o.pro) key(k, false); else if (k === 'left' || k === 'right' || k === 'hb') F.input.touch.press(k, false); }
      const R = A.results;
      return { seed, P: th.P, log: th.log, frames: rows.length, wall: Math.round(performance.now() - t0), track: { name: track.name, length: track.length, corners: track.corners.map(c => ({ from: c.from, to: c.to, radius: c.radius, angle: c.angle, dir: c.dir })), checkpoints: track.checkpoints, kind: track.kind, laps: A.laps },
        targets: A.targets, profile: L.profile(), results: R ? { score: R.score, stars: R.stars, coins: R.coins, parts: R.parts, cleanSectors: R.cleanSectors, seconds: R.seconds, best: R.best, bestChain: Math.round(F.scoring.state.best), missions: R.missions ? R.missions.map(m => ({ kind: m.kind, doneNow: m.doneNow, coins: m.coins })) : null } : null,
        onboard: { shown: L.onboard.state.shown.slice(), how: Object.assign({}, L.onboard.state.how), taught: L.onboard.taught }, rows };
      };
      if (!o.flush) { for (let f = 0; f < maxFrames; f++) if (one(f)) break; return finish(); }
      return (async () => {
        for (let f = 0; f < maxFrames; f++) {
          const w = gpu(); if (w) await w;
          if (one(f)) break;
          if (pauseDue) { pauseDue = false; F.draw = !!o.draw; window.__first.paused = true; await new Promise(r => { window.__first.resume = r; }); window.__first.paused = false; }
        }
        return finish();
      })();
    },
  };
})();`;

/* a page on a side, an empty save, on the title, as a phone (touch) or a desktop */
export async function freshPage(env, R, vp, query, touch) {
  const pg = await R.openPage(env, vp, query || '', { touch: !!touch });
  await pg.page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } const L = window.__loop; L.save.reset(); L.action('title'); });
  await pg.page.evaluate(RUNNER);
  return pg;
}
export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1280, height: 720 };

/* rows as objects */
export function rowsOf(run) { return run.rows.map(a => { const o = {}; COLS.forEach((k, i) => { o[k] = a[i]; }); return o; }); }

/* The GPU process held to one core and the page's own process to the other (all their threads), so a
   frame's work is not timed while the software GPU takes its turns on the same core (look/cost.js);
   the processes are this probe's own browsers', found from this process down */
export function pin() {
  try {
    const rows = execFileSync('ps', ['-eo', 'pid=,ppid=,args=']).toString().trim().split('\n').map(l => { const m = l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/); return m && { pid: +m[1], ppid: +m[2], args: m[3] }; }).filter(Boolean);
    const mine = new Set([process.pid]);
    for (let grew = true; grew;) { grew = false; for (const r of rows) if (!mine.has(r.pid) && mine.has(r.ppid)) { mine.add(r.pid); grew = true; } }
    const ours = rows.filter(r => mine.has(r.pid)), gpu = ours.filter(r => r.args.includes('--type=gpu-process')), page = ours.filter(r => r.args.includes('--type=renderer'));
    for (const r of gpu) execFileSync('taskset', ['-a', '-p', '-c', '1', String(r.pid)], { stdio: 'ignore' });
    for (const r of page) execFileSync('taskset', ['-a', '-p', '-c', '0', String(r.pid)], { stdio: 'ignore' });
    return gpu.length && page.length ? 'pinned' : 'not found';
  } catch (e) { return 'not pinned: ' + String(e.message || e).slice(0, 60); }
}
