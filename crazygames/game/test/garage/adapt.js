/* GARAGE MEASURE 7, the second half: THE QUALITY STILL ADAPTS with the
   cosmetics on. As game/test/spectacle/adapt.js drives it: a career run
   at night with wheels, glow and coloured smoke worn, frames handed to
   the game with a slow device's gaps (40 ms at full quality, 24 at the
   last level). It must step down to the last level and stay, on both
   tiers, and the cosmetics must still be there afterwards: the wheels
   on the model, the glow lit (the cheap form on the low tier), the
   smoke in its colour.
   Known answer: 900 frames at 60 fps step nothing down.

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
  if (pg.errors.length) G.say(false, tier + ' page errors: ' + pg.errors.slice(0, 2).join(' | '));
  await pg.close();
}
fs.writeFileSync(path.join(G.dir, 'adapt.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(G.failed() ? G.failed() + ' failed' : 'all passed');
process.exit(G.failed() ? 1 : 0);
