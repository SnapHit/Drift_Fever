/* MEASURE 2, HITCHES (briefs/FIRST-MINUTE.md priority 1). The first 30 s
   of a cold first run, on both backends, before (main, from git) and
   after (?first=2). Each side and backend in a fresh browser (cold:
   nothing compiled), from an empty save: the title read for READ_TITLE
   s, drawn, with the page's own work let run between frames as a
   browser does, then start here, and the first run played by a
   stranger's thumbs (thumbs.js, seed 1), every frame drawn and stepped
   with the GPU idle before it (as look/cost.js does), so a frame's time
   is its own work, the first build of anything included. three.js's
   render pipelines are counted each frame, so a slow frame says whether
   something was built in it. WebGPU at the high tier (a Pixel 9's: four
   or more cores), WebGL 2 at its low tier; at SIZE, small, since the
   sandbox draws in software (pipeline builds do not depend on the size).
   The brief's measure is frames over SLOW_MS (50 ms). Here every frame
   drawn in software takes over 100 ms, so that count is reported and
   cannot judge; the verdict is what a phone would feel as a hitch: no
   pipeline built after GO, and no more frames after GO over SPIKE times
   the run's own median than main has. The adaptive quality cannot step
   here (the probe's clock is a steady 60 Hz); what one step costs is
   measured after the run, by frames the game is told were slow.
   Known answer: a material never seen before, put in front of the
   camera 15 s into the run, is caught as a spike with a pipeline built
   in it.

   node game/test/first/hitches.js [--backends webgl2,webgpu] [--sides main,branch]   writes review/first/hitches-<backends>.json */
import path from 'node:path';
import fs from 'node:fs';
import * as F from './lib.js';
import { ARGS, FAKE } from '../webgpu/lib.js';
import { CLUNK } from './measure.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const BACKENDS = arg('--backends', 'webgl2,webgpu').split(','), SIDES = arg('--sides', 'main,branch').split(',');
const SLOW_MS = 50, SPAN = 30, SIZE = { width: 195, height: 422 }, SEED = 1, READ_TITLE = 3, SPIKE = 3;   // ms (the brief's); s from GO; px; the stranger; s on the title first, as a visitor reads it; a frame over this many times the run's own median is a hitch here
const KNOWN = `const S = window.__feel.scene, T = S.THREE, m = new T.Mesh(new T.TorusKnotGeometry(0.6, 0.2, 64, 8), new T.MeshPhysicalMaterial({ color: 0x33ff66, clearcoat: 1, iridescence: 1, sheen: 1, transmission: 0.5, thickness: 1 }));
  m.position.copy(S.camera.position); m.position.y -= 0.5; const d = new T.Vector3(); S.camera.getWorldDirection(d); m.position.addScaledVector(d, 4); m.frustumCulled = false; S.scene.add(m); window.__known = m;`;

async function cold(side, backend, opts) {
  const S = await F.side(side), env = await S.R.start({ args: backend === 'webgpu' ? ARGS : [] });
  try {
    for (let attempt = 0; ; attempt++) {
      const ctx = await env.browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
      if (backend === 'webgpu') await page.addInitScript(FAKE);
      else await page.addInitScript('window.requestAnimationFrame = function () { return 0; }; window.cancelAnimationFrame = function () {};');
      const q = (backend === 'webgl2' ? 'renderer=webgl2&tier=low' : 'tier=high') + '&controls=easy' + (side === 'branch' ? '&first=2' : '');
      await page.goto(env.url + '?' + q, { waitUntil: 'load', timeout: 120000 });
      let ready = false;
      for (const end = Date.now() + 90000; Date.now() < end && !ready; await new Promise(r => setTimeout(r, 200))) ready = await page.evaluate(() => window.__ready === true).catch(() => false);
      if (!ready) { await ctx.close(); if (attempt >= 2) throw new Error(side + ' ' + backend + ': never ready'); console.log('(again: the page never became ready)'); continue; }
      const got = await page.evaluate(() => ({ backend: window.__feel.scene.info().backend, tier: window.__feel.scene.info().tier }));
      if (got.backend !== backend) throw new Error('asked for ' + backend + ', got ' + got.backend);
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } const L = window.__loop; L.save.reset(); L.action('title'); });
      await page.evaluate(F.RUNNER);
      /* a visitor reads the title first (with the switch its backdrop is alive), drawn */
      await page.evaluate(async n => { const F = window.__feel; F.draw = true; window.__clock = 1000; for (let i = 0; i < n; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); await new Promise(r => setTimeout(r, 0)); } }, READ_TITLE * 60);   // the page's own work between frames runs, as it does between a browser's frames
      const r = await page.evaluate(({ seed, span, inject }) => window.__first.run(seed, { draw: true, flush: true, maxS: span + 3, inject, keepClock: true }), { seed: SEED, span: SPAN, inject: opts.known ? { at: 15, src: KNOWN } : null });
      if (r.error) throw new Error(r.error);
      /* one step of the adaptive quality: 3 s of frames the game is told took 34 ms, timed as above */
      let adapt = null;
      if (opts.adapt) adapt = await page.evaluate(async () => {
        const F = window.__feel, R0 = F.scene.renderer, out = [], lv0 = F.scene.adaptState().level;
        for (let i = 0; i < 300; i++) {
          const d = window.__gpuCanvas && window.__gpuCanvas.device(); if (d) await d.queue.onSubmittedWorkDone(); else if (R0.backend && R0.backend.gl) R0.backend.gl.finish();
          const lv = F.scene.adaptState().level; window.__clock += 34; const t = performance.now(); F.frame(window.__clock); const ms = performance.now() - t;
          if (F.scene.adaptState().level !== lv) out.push({ frame: i, ms: Math.round(ms), from: lv, to: F.scene.adaptState().level });
        }
        return { from: lv0, steps: out, level: F.scene.adaptState().level };
      });
      await ctx.close();
      return { ...r, got, errors, adapt };
    }
  } finally { await env.close(); }
}

const K = Object.fromEntries(F.COLS.map((k, i) => [k, i]));
function hitches(r) {
  const go = r.rows.findIndex(x => x[K.st] === 1), rows = r.rows.slice(0, go + SPAN * 60);
  const slow = [];
  rows.forEach((x, i) => { if (x[K.real] > SLOW_MS) slow.push({ frame: i, t: x[K.t], ms: x[K.real], built: x[K.pipes], state: ['countdown', 'drive', 'results', 'other'][x[K.st]], sliding: Math.abs(x[K.ang]) >= CLUNK.SLIDE, wall: x[K.touch] || x[K.hit] > 0.8 }); });
  const steady = rows.slice(go + 60).map(x => x[K.real]).sort((a, b) => a - b), median = steady[Math.floor(steady.length / 2)];
  const spikes = slow.filter(x => x.frame > go && x.ms > SPIKE * median);
  return { frames: rows.length, over: slow.length, worst: Math.max(...rows.map(x => x[K.real])), median, built: rows.reduce((n, x) => n + x[K.pipes], 0), builtInDrive: rows.slice(go).reduce((n, x) => n + x[K.pipes], 0), spikes: spikes.length, spikeFrames: spikes, slow: slow.filter(x => x.built > 0 || x.ms > SPIKE * median) };
}

const out = { slowMs: SLOW_MS, span: SPAN, size: SIZE, seed: SEED, main: F.mainCommit(), runs: {} };
for (const backend of BACKENDS) for (const side of SIDES) {
  const r = await cold(side, backend, { adapt: true });
  const h = out.runs[side + ' ' + backend] = { ...hitches(r), got: r.got, errors: r.errors, adapt: r.adapt };
  console.log('INFO ' + side + ' on ' + backend + ' (' + r.got.tier + ' tier): ' + h.over + ' of ' + h.frames + ' frames over ' + SLOW_MS + ' ms in the first ' + SPAN + ' s (software drawing: median ' + h.median + ' ms, worst ' + h.worst + '); ' + h.spikes + ' after GO over ' + SPIKE + ' times the median; pipelines built ' + h.built + ', ' + h.builtInDrive + ' of them after GO; the frames that built or spiked: ' + h.slow.map(s => s.state + ' ' + s.t.toFixed(2) + ' s ' + s.ms + ' ms' + (s.built ? ' built ' + s.built : '') + (s.sliding ? ' sliding' : '') + (s.wall ? ' wall' : '')).join(', ') + '; the adaptive quality, told frames were slow: ' + (r.adapt ? r.adapt.steps.map(s => 'level ' + s.from + ' to ' + s.to + ' in ' + s.ms + ' ms').join(', ') || 'no step' : '-'));
  F.say(r.errors.length === 0, side + ' on ' + backend + ': no page errors (' + r.errors.join(' | ') + ')');
}
if (SIDES.includes('branch')) for (const backend of BACKENDS) {
  const a = out.runs['main ' + backend], b = out.runs['branch ' + backend];
  if (a && b) F.say(b.builtInDrive === 0 && b.spikes <= a.spikes, backend + ': with ?first=2, nothing built after GO (' + b.builtInDrive + ' pipelines, main ' + a.builtInDrive + ') and ' + b.spikes + ' frames after GO over ' + SPIKE + ' times the median (main ' + a.spikes + '); over ' + SLOW_MS + ' ms: ' + b.over + ' and ' + a.over + ' of ' + b.frames + ', which here is every frame drawn in software');
}
/* the known answer, on the first backend, this branch */
const kr = await cold(SIDES.includes('branch') ? 'branch' : 'main', BACKENDS[0], { known: true });
const kh = hitches(kr), at = kh.spikeFrames.find(s => s.t >= 15 && s.t < 15.2 && s.built > 0);
out.knownAnswer = kh;
F.say(!!at, 'known answer: a material never seen before, put in front of the camera 15 s into the run on ' + BACKENDS[0] + ', is caught: ' + (at ? at.ms + ' ms at ' + at.t.toFixed(2) + ' s with ' + at.built + ' pipelines built' : 'MISSED (' + kh.slow.map(s => s.t.toFixed(2) + ' s ' + s.ms + ' ms').join(', ') + ')'));
F.writeJson(path.join(F.dir, 'hitches-' + BACKENDS.join('-') + '.json'), out);
console.log(F.failed() ? F.failed() + ' failed' : 'all passed');
process.exit(F.failed() ? 1 : 0);
