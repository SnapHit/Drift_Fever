/* AFTER PLAY, 14 November 2026 (the author's second empty save run): a
   lost race points at the garage, and a hard touch with the rival banks
   the chain. At three sizes, from an empty save in the starter.
   Known answers: a first loss to Kestrow (the same car) carries no tip,
   a win carries none, a wall hit still loses the chain, and with
   TANDEM.HIT_BANKS off the touch loses it as it used to.
   node game/test/play14/check.js   writes review/play14/ */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../ladder/lib.js';
const dir = path.join(R.root, 'review', 'play14'), shots = path.join(dir, 'shots'); fs.mkdirSync(shots, { recursive: true });
const env = await R.start(), out = {};
let fails = 0;
const ok = (name, pass, detail) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + name + ': ' + detail); };
const race = async (page, id) => {
  await page.evaluate(id => { const L = window.__loop; window.__feel.draw = false; L.startRun(L.battleSpec(id)); L.skipCountdown(); }, id);
  await R.runFrames(page, 60);
  await page.evaluate(() => window.__loop.finishNow());
  await R.runFrames(page, 30);
  return page.evaluate(() => { const c = document.querySelector('#screens .card'), q = c.getBoundingClientRect(), t = c.querySelector('.tip'), m = c.querySelector('button.primary');
    return { won: c.classList.contains('won'), tip: t ? t.textContent : null, main: m ? m.querySelector('b').textContent : null, buttons: [...c.querySelectorAll('button')].map(b => b.querySelector('b').textContent), next: !!c.querySelector('.nextr'), fits: c.scrollHeight <= c.clientHeight + 1 || q.bottom <= innerHeight }; });
};
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
  const tag = vp.width + 'x' + vp.height, pg = await R.emptyPage(env, vp, ''), page = pg.page, o = out[tag] = {};
  o.k1 = await race(page, 'r1');
  ok(tag + ' known answer: a first loss to Kestrow, in the same car, has no tip', !o.k1.won && o.k1.tip === null && o.k1.main === 'REMATCH', JSON.stringify(o.k1));
  o.v1 = await race(page, 'r3');
  ok(tag + ' a first loss to Varsk with no coins names his car and says to earn', !o.v1.won && /Varsk drives the fastback/.test(o.v1.tip || '') && /Earn coins/.test(o.v1.tip) && o.v1.main === 'REMATCH' && o.v1.buttons.includes('GARAGE') && o.v1.fits, JSON.stringify(o.v1));
  await page.evaluate(() => { window.__loop.save.state.coins = 6000; });
  o.v2 = await race(page, 'r3');
  ok(tag + ' a second loss with 6,000 coins puts GARAGE first and names the grand tourer', /You can afford the grand tourer/.test(o.v2.tip || '') && o.v2.main === 'GARAGE' && o.v2.buttons.includes('REMATCH') && o.v2.fits, JSON.stringify(o.v2));
  await page.evaluate(() => { window.__feel.draw = true; }); await R.runFrames(page, 3);
  await page.screenshot({ path: path.join(shots, tag + '-lost-garage.png') });
  await page.evaluate(() => document.querySelector('#screens button.primary').click());
  const at = await page.evaluate(() => document.querySelector('#screens .screen').className);
  ok(tag + ' GARAGE opens the garage', /garage/.test(at), at);
  await page.evaluate(() => { window.__loop.save.state.coins = 500; });
  o.v3 = await race(page, 'r3');
  ok(tag + ' with 500 coins it offers an upgrade', /You can afford an upgrade/.test(o.v3.tip || '') && o.v3.main === 'GARAGE', JSON.stringify(o.v3));
  /* a win has no tip */
  await page.evaluate(() => { const L = window.__loop, r = L.results(); L.screens.results({ ...r, won: true, tip: null, score: r.rival.total + 10, margin: 10 }); });
  const w = await page.evaluate(() => !!document.querySelector('#screens .tip'));
  ok(tag + ' known answer: a win has no tip', !w, String(w));
  /* the touch: the scoring's own step on a made hit */
  const hit = await page.evaluate(async () => {
    const { createScoring } = await import('/src/scoring/drift.js'), { TANDEM } = await import('/src/tune.js');
    const go = (kind) => { const sc = createScoring(() => {}), s = sc.state; sc.reset && sc.reset(); s.chain = 400; s.mult = 3; s.drifting = true; const t0 = s.total;
      sc.step({ hit: { hard: true, kind }, respawned: false, nearest: 99, car: { slip: 0, speed: 20, vx: 20 } }, 1 / 120); return { gained: s.total - t0, chain: s.chain, lost: s.lost }; };
    const rival = go('rival'), wall = go('wall'); TANDEM.HIT_BANKS = false; const off = go('rival'); TANDEM.HIT_BANKS = true;
    return { rival, wall, off };
  });
  o.hit = hit;
  ok(tag + ' a hard touch with the rival banks the chain (400 at x3 pays 1,200)', hit.rival.gained === 1200 && hit.rival.chain === 0, JSON.stringify(hit.rival));
  ok(tag + ' known answer: a wall hit still loses it', hit.wall.gained === 0 && hit.wall.lost === 1200, JSON.stringify(hit.wall));
  ok(tag + ' known answer: with HIT_BANKS off the touch loses it', hit.off.gained === 0 && hit.off.lost === 1200, JSON.stringify(hit.off));
  await page.close();
}
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
