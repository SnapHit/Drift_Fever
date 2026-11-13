/* GARAGE MEASURE 7, the second half: THE QUALITY STILL ADAPTS with the
   cosmetics on. As game/test/spectacle/adapt.js drives it: a career run
   at night with wheels, glow and coloured smoke worn, frames handed to
   the game with a slow device's gaps (40 ms at full quality, 24 at the
   last level). It must step down to the last level and stay, on both
   tiers, and the cosmetics must still be there afterwards: the wheels
   on the model, the glow lit (the cheap form on the low tier), the
   smoke in its colour.
   Known answer: 900 frames at 60 fps step nothing down.
   And what the glow is to the renderer on each tier: the same frame
   drawn with it and without it, the draw calls and triangles counted
   (one call; 10 triangles in the cheap form, the low tier's, and 262
   in the soft form). Known answer: the wheels, which are more
   triangles and no more calls, do not read as a call.

   node game/test/garage/adapt.js   writes review/garage/adapt.json */
import path from 'node:path';
import fs from 'node:fs';
import * as G from './lib.js';

const env = await G.start(), out = { runs: [] };
async function drive(p, gaps, n) {
  return p.evaluate(({ gaps, n }) => {
    const F = window.__feel, A = window.__loop.app;
    for (let i = 0; i < n; i++) { window.__clock += gaps.byLevel ? gaps.byLevel[F.scene.adaptState().level] : gaps[i % gaps.length]; F.frame(window.__clock); if (A.state === 'results') window.__loop.startRun(window.__loop.careerSpec(0)); }
    return F.scene.adaptState();
  }, { gaps, n });
}
for (const tier of ['low', 'high']) {
  const pg = await G.page(env, G.PORTRAIT, 'tier=' + tier + '&preset=night'), p = pg.page;
  await G.wear(p, { wheels: 'blades', glow: 'aqua', smoke: 'rose' });
  await G.careerRun(p, 0);
  const start = await p.evaluate(() => window.__feel.scene.adaptState());
  const fast = await drive(p, [1000 / 60], 900);
  const slow = await drive(p, { byLevel: [40, 36, 33, 29, 24] }, 1500);
  const worn = await p.evaluate(() => { const sc = window.__feel.scene, m = sc.carModel(); return { wheels: m.wheelsId, glow: m.underglow.visible, glowTris: m.underglow.geometry.attributes.position.count / 3, looks: sc.looks.car }; });
  out.runs.push({ tier, start, fast, slow, worn });
  G.say(fast.level === 0, tier + ' known answer: 900 frames at 60 fps with the cosmetics on leave the quality alone: level ' + fast.level);
  G.say(slow.level === 4 && slow.density < 1 && slow.pixelRatio < start.pixelRatio && !slow.bloom, tier + ': a slow device is stepped down to the last level with the cosmetics on: level ' + slow.level + ', effects at ' + slow.density + ', pixel ratio ' + start.pixelRatio + ' -> ' + slow.pixelRatio + ', bloom ' + start.bloom + ' -> ' + slow.bloom);
  G.say(worn.wheels === 'blades' && worn.glow && worn.looks.smoke === 'rose' && (tier === 'low' ? worn.glowTris === 10 : worn.glowTris > 100), tier + ': and the cosmetics are still on: wheels ' + worn.wheels + ', the glow lit (' + worn.glowTris + ' triangles), smoke ' + worn.looks.smoke);
  /* what the renderer is asked for, with and without: the same frame, counted */
  const pc = await G.page(env, G.PORTRAIT, 'tier=' + tier + '&preset=night&adapt=0'), q = pc.page;
  const count = async look => { await G.wear(q, look); await G.midSlide(q, 0, 2, 16); await q.evaluate(() => { window.__feel.draw = true; }); await G.runFrames(q, 1); const r = await q.evaluate(() => { const i = window.__feel.scene.info(); return { calls: i.drawCalls, tris: i.triangles }; }); await q.evaluate(() => { window.__feel.draw = false; }); return r; };
  const none = await count({}), glow = await count({ glow: 'aqua' }), wheels = await count({ wheels: 'blades' });
  out.runs.push({ tier, counted: { none, glow, wheels } });
  const want = tier === 'low' ? 10 : 262;
  G.say(glow.calls - none.calls === 1 && glow.tris - none.tris === want, tier + ': the glow is ' + (glow.calls - none.calls) + ' draw call and ' + (glow.tris - none.tris) + ' triangles more (the ' + (tier === 'low' ? 'cheap' : 'soft') + ' form, ' + want + '), of ' + none.calls + ' calls and ' + none.tris + ' triangles');
  G.say(wheels.calls === none.calls && wheels.tris > none.tris, tier + ' known answer: a wheel design is ' + (wheels.tris - none.tris) + ' triangles more and ' + (wheels.calls - none.calls) + ' calls more, so the count tells a call from a triangle: ' + (wheels.calls === none.calls && wheels.tris > none.tris ? 'CAUGHT' : 'MISSED'));
  await pc.close();
  if (pg.errors.length) G.say(false, tier + ' page errors: ' + pg.errors.slice(0, 2).join(' | '));
  await pg.close();
}
fs.writeFileSync(path.join(G.dir, 'adapt.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(G.failed() ? G.failed() + ' failed' : 'all passed');
process.exit(G.failed() ? 1 : 0);
