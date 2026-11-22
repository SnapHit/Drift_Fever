/* COST (briefs/COVER-LOOK.md, measure 6): on the low tier, draw calls,
   triangles and the game's own work per frame (the frame function: the
   physics, the scene's update and the submission to the GPU; the GPU's
   own time is not in it), with ?look=2 against main (no switch) in the
   same race on three tracks (day, dusk and night), drawing every frame
   from GO for FRAMES frames. The look must stay within 10 per cent of
   main on each, race by race (medians over the frames). The high tier
   is reported. Each race is its own browser, and one that fails to
   load is run again once.
   The sandbox's GPU is software on the same two cores as the page, so
   a frame timed while the GPU is still drawing the one before is timed
   against it: the first runs, all frames in one go at 640x360, read 3.1
   against 8.4 ms on one race and 2.7 against 4.1 on the next with the
   submission nearly unchanged. So each frame is stepped on its own with
   the GPU idle before it (WebGPU's queue drained, or WebGL 2's finish),
   and at 320x180 (draw calls, triangles and the game's own work do not
   depend on the size; the GPU's share does). One browser's median moves
   by a fifth from the next one's with the same build, so each side runs
   in ROUNDS browsers, main and the look in turn, and their frames are
   pooled. --backend webgpu runs it
   on the WebGPU backend (game/test/webgpu/lib.js), what a phone runs.
   Known answer: 500 extra meshes added to the look's scene are caught,
   in draw calls and in work.

   node game/test/look/cost.js [--frames N] [--tiers low,high] [--backend webgl2|webgpu] [--size 320x180] [--races day,dusk,night] [--rounds 2]   writes review/look/cost-<backend>.json */
import path from 'node:path';
import * as L from './lib.js';
import * as W from '../webgpu/lib.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const FRAMES = +arg('--frames', 150), ROUNDS = +arg('--rounds', 2), tiers = arg('--tiers', 'low,high').split(','), backend = arg('--backend', 'webgl2'), races = arg('--races', 'day,dusk,night').split(',');
const VP = (([w, h]) => ({ width: +w, height: +h }))(arg('--size', '320x180').split('x'));
const LIMIT = 0.10;
const COLLECT = `const i2 = F.scene.info(); return { dc: i2.drawCalls, tri: i2.triangles, ms: F.info().frameMs, phys: F.info().physMs, submit: i2.submitMs };`;
const med = list => { const s = list.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const p90 = list => { const s = list.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] : 0; };

/* one frame, with the GPU idle before it */
const STEP = (page, collect) => page.evaluate(async src => {
  const F = window.__feel, R = F.scene.renderer, gpu = window.__gpuCanvas && window.__gpuCanvas.device();
  if (gpu) await gpu.queue.onSubmittedWorkDone(); else if (R.backend && R.backend.gl) R.backend.gl.finish();
  window.__clock = (window.__clock === undefined ? 1000 : window.__clock) + 1000 / 60;
  F.frame(window.__clock);
  return new Function('F', src)(F);
}, collect);

async function run(race, tier, query, extra) {
  for (let attempt = 0; ; attempt++) {
    const env = backend === 'webgpu' ? await W.start() : await L.start();
    try { const r = await once(env, race, tier, query, extra); await env.close(); return r; }
    catch (e) { await env.close().catch(() => {}); if (attempt >= 1) throw e; console.log('(run again after: ' + String(e.message || e).split('\n')[0] + ')'); }
  }
}
async function once(env, race, tier, query, extra) {
  const pg = backend === 'webgpu' ? await W.open(env, VP, 'tier=' + tier + query + '&title=1&adapt=0') : await L.page(env, VP, 'tier=' + tier + query);
  if (backend === 'webgpu') await pg.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const S = window.__loop.save; S.reset(); S.setOnboarded(); for (let i = 0; i < 24; i++) S.careerResult(i, 3, 100000); });
  await L.dress(pg.page, L.STARTER);
  await L.raceTo(pg.page, { rival: L.RACES[race].rival, to: 0 });
  if (extra) await pg.page.evaluate(n => {   /* the known answer: n small meshes, each its own draw call, in front of the camera */
    const S = window.__feel.scene, T = S.THREE, g = new T.BoxGeometry(0.3, 0.3, 0.3);
    for (let k = 0; k < n; k++) { const m = new T.Mesh(g, new T.MeshLambertMaterial({ color: 0xff00ff })); m.frustumCulled = false; m.position.set((k % 25) * 0.5, 50 + Math.floor(k / 25) * 0.5, 0); S.scene.add(m); }
  }, extra);
  await L.hud(pg.page, false);
  await pg.page.evaluate(() => { window.__feel.draw = true; });
  const f = [];
  for (let i = 0; i < FRAMES; i++) f.push(await STEP(pg.page, COLLECT));
  await pg.close();
  return f.slice(10);   // the first frames compile the materials
}
const sum = tail => ({ frames: tail.length, drawCalls: med(tail.map(x => x.dc)), drawCallsMax: Math.max(...tail.map(x => x.dc)), triangles: med(tail.map(x => x.tri)), workMs: +med(tail.map(x => x.ms)).toFixed(2), workP90: +p90(tail.map(x => x.ms)).toFixed(2), physMs: +med(tail.map(x => x.phys)).toFixed(2), submitMs: +med(tail.map(x => x.submit)).toFixed(2) });

const out = { frames: FRAMES, size: VP.width + 'x' + VP.height, backend, stepped: 'one frame at a time, the GPU idle before each', races: {} };
const within = (a, b) => a <= b * (1 + LIMIT);
for (const tier of tiers) {
  for (const race of races) {
    const runs = { main: [], look: [] }, each = { main: [], look: [] };
    for (let k = 0; k < ROUNDS; k++) for (const [side, q] of [['main', ''], ['look', '&look=2']]) { const t = await run(race, tier, q); runs[side].push(...t); each[side].push(sum(t).workMs); }
    const main = { ...sum(runs.main), workByBrowser: each.main }, look = { ...sum(runs.look), workByBrowser: each.look };
    out.races[tier + ' ' + race] = { main, look, ratio: { drawCalls: +(look.drawCalls / main.drawCalls).toFixed(3), triangles: +(look.triangles / main.triangles).toFixed(3), work: +(look.workMs / main.workMs).toFixed(3) } };
    const r = out.races[tier + ' ' + race].ratio, line = tier + ' tier, ' + L.RACES[race].label + ': draw calls ' + main.drawCalls + ' to ' + look.drawCalls + ' (x' + r.drawCalls + '), triangles ' + main.triangles + ' to ' + look.triangles + ' (x' + r.triangles + '), work ' + main.workMs + ' to ' + look.workMs + ' ms (x' + r.work + '; physics ' + main.physMs + ' and ' + look.physMs + ', drawing submitted in ' + main.submitMs + ' and ' + look.submitMs + '; by browser ' + main.workByBrowser.join(', ') + ' and ' + look.workByBrowser.join(', ') + ')';
    if (tier === 'low') L.say(within(look.drawCalls, main.drawCalls) && within(look.triangles, main.triangles) && within(look.workMs, main.workMs), line + ': within 10 per cent');
    else console.log('INFO ' + line);
  }
}
if (tiers.includes('low')) {
  const kr = races.includes('dusk') ? 'dusk' : races[0], main = out.races['low ' + kr].main, ka = sum(await run(kr, 'low', '&look=2', 500));
  out.knownAnswer = ka;
  const caught = !within(ka.drawCalls, main.drawCalls) && !within(ka.workMs, main.workMs);
  L.say(caught, 'known answer: the look with 500 extra meshes draws ' + ka.drawCalls + ' calls against main\'s ' + main.drawCalls + ' and works ' + ka.workMs + ' ms against ' + main.workMs + ': ' + (caught ? 'CAUGHT' : 'MISSED'));
}
L.writeJson(path.join(L.lookDir, 'cost-' + backend + '.json'), out);
console.log(L.failed() ? L.failed() + ' failed' : 'all passed');
process.exit(L.failed() ? 1 : 0);
