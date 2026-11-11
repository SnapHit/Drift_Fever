/* A LOOK, for working: a race against the first rival with a scripted
   player, drawn at a few moments, to the scratch folder given.
   node game/test/driftrace/peek.js /some/dir [mixed] [1280x720] */
import path from 'node:path';
import * as R from '../rivals/lib.js';
const dir = process.argv[2], kind = process.argv[3] || 'mixed', [w, h] = (process.argv[4] || '1280x720').split('x').map(Number);
const env = await R.start();
const pg = await R.page(env, { width: w, height: h }, 'preset=night', { touch: w < 900 });
await pg.page.evaluate(() => { window.__loop.save.state.rivals.r1 = { won: false, best: -100, when: 1 }; });
await R.battleRun(pg.page, 'r1', { player: kind });
for (const [i, frames] of [[0, 100], [1, 400], [2, 300], [3, 400], [4, 1200]].entries()) {
  await R.runFrames(pg.page, frames[1]);
  await R.shot(pg.page, path.join(dir, 'peek-' + kind + '-' + w + 'x' + h + '-' + i + '.png'), 1);
  console.log(i, JSON.stringify(await pg.page.evaluate(() => { const L = window.__loop.lead(); return { place: L.place, gap: L.gap, ev: L.events, pt: L.player.total, rt: L.rival.total }; })));
}
await pg.page.evaluate(() => { window.__feel.draw = false; });
await R.until(pg.page, "f.state==='results'", 60 * 200, 120);
await R.runFrames(pg.page, 100);
await pg.page.screenshot({ path: path.join(dir, 'peek-' + kind + '-' + w + 'x' + h + '-results.png') });
await env.close();
