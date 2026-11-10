/* SPECTACLE MEASURE 5: QUALITY THAT ADAPTS. Sustained slow frames step
   the quality down (the effects' density, then the bloom, then the
   pixel ratio), one level at a time, and nothing steps it back up.

   The game is driven through its own frame function with the clock the
   browser would hand it: frames 40 ms apart (25 fps) must step it down;
   frames 16.7 ms apart (60 fps) must not (the known answer: a quality
   step on fast frames would be a probe passing for the wrong reason);
   fast frames after slow ones must not step it back up; the odd slow
   frame among fast ones (one in six, a hitch) must not step it down;
   and with ?fx=0 nothing adapts (the game as on main).

   node game/test/spectacle/adapt.js
   Writes review/spectacle/adapt.json. */
import path from 'node:path';
import * as S from './lib.js';

const env = await S.start();
const out = { runs: [] };
/* frames with the given gaps (ms), drawing off, through a career run; returns the adaptation's state */
async function drive(p, gaps, n) {
  return p.evaluate(({ gaps, n }) => {
    const F = window.__feel, A = window.__loop.app;
    for (let i = 0; i < n; i++) { window.__clock += gaps[i % gaps.length]; F.frame(window.__clock); if (A.state === 'results') window.__loop.startRun(window.__loop.careerSpec(0)); }
    return F.scene.adaptState ? F.scene.adaptState() : null;
  }, { gaps, n });
}
for (const tier of ['low', 'high']) {
  const pg = await S.page(env, S.PORTRAIT, 'tier=' + tier);
  const p = pg.page;
  await S.careerRun(p, 0);
  const start = await p.evaluate(() => window.__feel.scene.adaptState());
  const fast = await drive(p, [1000 / 60], 900);
  const slow = await drive(p, [40], 1200);
  const after = await drive(p, [1000 / 60], 900);
  out.runs.push({ tier, start, fast, slow, after });
  S.verdict(fast.level === 0, tier + ' known answer: 900 frames at 60 fps leave the quality alone: level ' + fast.level + ', pixel ratio ' + fast.pixelRatio + ', bloom ' + fast.bloom);
  S.verdict(slow.level >= 3 && slow.density < 1 && slow.pixelRatio < start.pixelRatio && !slow.bloom, tier + ': 1,200 frames at 25 fps step it down: level ' + slow.level + ' in ' + slow.steps.length + ' steps, density ' + slow.density + ', pixel ratio ' + start.pixelRatio + ' -> ' + slow.pixelRatio + ', bloom ' + start.bloom + ' -> ' + slow.bloom);
  S.verdict(after.level === slow.level && after.pixelRatio === slow.pixelRatio, tier + ': 900 fast frames after them do not step it back up: level ' + after.level);
  await pg.close();
}
{
  const pg = await S.page(env, S.PORTRAIT, 'tier=low');
  await S.careerRun(pg.page, 0);
  const hitch = await drive(pg.page, [1000 / 60, 1000 / 60, 1000 / 60, 1000 / 60, 1000 / 60, 45], 1500);
  out.hitches = hitch;
  S.verdict(hitch.level === 0, 'one slow frame in six for 1,500 frames is a hitch, not a slow device: level ' + hitch.level);
  await pg.close();
}
{
  const pg = await S.page(env, S.PORTRAIT, 'tier=low&fx=0');
  await S.careerRun(pg.page, 0);
  const r = await pg.page.evaluate(() => { const F = window.__feel; const pr = F.scene.renderer.getPixelRatio(); for (let i = 0; i < 1200; i++) { window.__clock += 40; F.frame(window.__clock); } return { pixelRatio: F.scene.renderer.getPixelRatio(), before: pr, adapt: F.scene.info().adapt, on: F.scene.adaptState().on }; });
  out.fx0 = r;
  S.verdict(!r.on && r.adapt === 0 && r.pixelRatio === r.before, 'with ?fx=0 nothing adapts, as on main: on ' + r.on + ', level ' + r.adapt + ', pixel ratio ' + r.before + ' -> ' + r.pixelRatio);
  await pg.close();
}
S.writeJson(path.join(S.reviewDir, 'adapt.json'), out);
await env.close();
console.log(S.failures() ? S.failures() + ' failed' : 'all passed');
process.exit(S.failures() ? 1 : 0);
