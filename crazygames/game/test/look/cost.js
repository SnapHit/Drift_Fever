/* COST (briefs/COVER-LOOK.md, measure 6): on the low tier, draw calls,
   triangles and the game's own work per frame (the frame function: the
   physics, the scene's update and the submission to the GPU; the GPU's
   own time is not in it, and the sandbox draws in software anyway), with
   ?look=2 against main (no switch) in the same race on three tracks
   (day, dusk and night), drawing every frame from GO for FRAMES frames
   at 640x360 (draw calls, triangles and the game's own work do not
   depend on the size; the sandbox's software drawing is four times
   quicker at it than at 1280x720, and a page held up behind it timed
   out). The look must stay within 10 per cent of main on each, race by
   race (medians over the frames). The high tier is reported. Each race
   is its own browser, and one that fails to load is run again once.
   Known answer: 500 extra meshes added to the look's scene are caught.

   node game/test/look/cost.js [--frames N] [--tiers low,high]   writes review/look/cost.json */
import path from 'node:path';
import * as L from './lib.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const FRAMES = +arg('--frames', 150), tiers = arg('--tiers', 'low,high').split(',');
const VP = { width: 640, height: 360 };
const LIMIT = 0.10;
const COLLECT = `const i2 = F.scene.info(); return { dc: i2.drawCalls, tri: i2.triangles, ms: F.info().frameMs, phys: F.info().physMs, submit: i2.submitMs };`;
const med = list => { const s = list.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const p90 = list => { const s = list.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] : 0; };

async function run(race, tier, query, extra) {
  for (let attempt = 0; ; attempt++) {
    const env = await L.start();
    try { const r = await once(env, race, tier, query, extra); await env.close(); return r; }
    catch (e) { await env.close().catch(() => {}); if (attempt >= 1) throw e; console.log('(run again after: ' + String(e.message || e).split('\n')[0] + ')'); }
  }
}
async function once(env, race, tier, query, extra) {
  const pg = await L.page(env, VP, 'tier=' + tier + query);
  await L.dress(pg.page, L.STARTER);
  await L.raceTo(pg.page, { rival: L.RACES[race].rival, to: 0 });
  if (extra) await pg.page.evaluate(n => {   /* the known answer: n small meshes, each its own draw call, in front of the camera */
    const S = window.__feel.scene, T = S.THREE, g = new T.BoxGeometry(0.3, 0.3, 0.3);
    for (let k = 0; k < n; k++) { const m = new T.Mesh(g, new T.MeshLambertMaterial({ color: 0xff00ff })); m.frustumCulled = false; m.position.set((k % 25) * 0.5, 50 + Math.floor(k / 25) * 0.5, 0); S.scene.add(m); }
  }, extra);
  await L.hud(pg.page, false);
  await pg.page.evaluate(() => { window.__feel.draw = true; });
  const f = await L.runFrames(pg.page, FRAMES, COLLECT);
  await pg.close();
  const tail = f.slice(10);   // the first frames compile the materials
  return { frames: tail.length, drawCalls: med(tail.map(x => x.dc)), drawCallsMax: Math.max(...tail.map(x => x.dc)), triangles: med(tail.map(x => x.tri)), workMs: +med(tail.map(x => x.ms)).toFixed(2), workP90: +p90(tail.map(x => x.ms)).toFixed(2), physMs: +med(tail.map(x => x.phys)).toFixed(2), submitMs: +med(tail.map(x => x.submit)).toFixed(2) };
}

const out = { frames: FRAMES, size: VP.width + 'x' + VP.height, races: {} };
const within = (a, b) => a <= b * (1 + LIMIT);
for (const tier of tiers) {
  for (const race of ['day', 'dusk', 'night']) {
    const main = await run(race, tier, ''), look = await run(race, tier, '&look=2');
    out.races[tier + ' ' + race] = { main, look, ratio: { drawCalls: +(look.drawCalls / main.drawCalls).toFixed(3), triangles: +(look.triangles / main.triangles).toFixed(3), work: +(look.workMs / main.workMs).toFixed(3) } };
    const r = out.races[tier + ' ' + race].ratio, line = tier + ' tier, ' + L.RACES[race].label + ': draw calls ' + main.drawCalls + ' to ' + look.drawCalls + ' (x' + r.drawCalls + '), triangles ' + main.triangles + ' to ' + look.triangles + ' (x' + r.triangles + '), work ' + main.workMs + ' to ' + look.workMs + ' ms (x' + r.work + '; physics ' + main.physMs + ' and ' + look.physMs + ', drawing submitted in ' + main.submitMs + ' and ' + look.submitMs + ')';
    if (tier === 'low') L.say(within(look.drawCalls, main.drawCalls) && within(look.triangles, main.triangles) && within(look.workMs, main.workMs), line + ': within 10 per cent');
    else console.log('INFO ' + line);
  }
}
if (tiers.includes('low')) {
  const main = out.races['low dusk'].main, ka = await run('dusk', 'low', '&look=2', 500);
  out.knownAnswer = ka;
  L.say(!within(ka.drawCalls, main.drawCalls), 'known answer: the look with 500 extra meshes draws ' + ka.drawCalls + ' calls against main\'s ' + main.drawCalls + ': ' + (within(ka.drawCalls, main.drawCalls) ? 'MISSED' : 'CAUGHT'));
}
L.writeJson(path.join(L.lookDir, 'cost.json'), out);
console.log(L.failed() ? L.failed() + ' failed' : 'all passed');
process.exit(L.failed() ? 1 : 0);
