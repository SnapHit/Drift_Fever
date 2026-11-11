/* LADDER MEASURE 9 (briefs/RIVALS-LADDER.md): FRAMES, in
   review/ladder/shots/, at 1280x720, 390x844 and 844x390:
     title-STATE        the title, its RIVALS button: none earned, one
                        waiting (the mark), all beaten
     rivals-STATE       the rivals screen: none earned, mid ladder (two
                        beaten, the third waiting, the rest locked), all
                        beaten; and as shipped (TANDEM.LIVE), none earned
     offer-career       a career result offering his race beside NEXT
     offer-won, offer-lost   a race's results naming the next rival
     side-RIVAL-PRESET  each rival side by side with the player mid slide,
                        by day (?preset=dusk, as the drift race round)
                        and at night, the player driven by the scripted
                        mixed player (a player's hands only) in the car a
                        player would drive by then (lib.js PLAYER_CAR)
   The race results come from a real race ended at once by the probe
   hook (finishNow); the won card shows those results as a win by 137
   (its words are the game's, its totals not a real race's).
   Each file is SIZE-WHAT.png.

   node game/test/ladder/shots.js [screens|side] [r2 ...]   writes review/ladder/shots/ and shots.json */
import path from 'node:path';
import fs from 'node:fs';
import * as R from './lib.js';
import { chapterOf } from '../../src/loop/modes.js';
import { rivalById } from '../../src/rivals/roster.js';

const args = process.argv.slice(2);
const parts = args.filter(a => /^(screens|side)$/.test(a)), ids = args.filter(a => /^r\d$/.test(a));
const DO = parts.length ? parts : ['screens', 'side'];
const RIDS = ids.length ? ids : ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
const SIZES = [R.LANDSCAPE, R.PORTRAIT, R.PHONE_LANDSCAPE];
const env = await R.start();
const jfile = path.join(R.ladderDir, 'shots.json');
const out = fs.existsSync(jfile) ? JSON.parse(fs.readFileSync(jfile, 'utf8')) : { shots: {} };
const file = (vp, what) => path.join(R.ladderShots, R.tagOf(vp) + '-' + what + '.png');
const SAVES = {
  none: 'S.reset(); S.setOnboarded();',
  waiting: 'S.reset(); S.setOnboarded(); S.careerResult(0, 1, 500);',
  mid: 'S.reset(); S.setOnboarded(); for (let i = 0; i < 9; i++) S.careerResult(i, 2, 700); S.rivalResult("r1", true, 412); S.rivalResult("r2", true, 186); S.rivalResult("r3", false, -340);',
  beaten: 'S.reset(); S.setOnboarded(); for (let i = 0; i < 24; i++) S.careerResult(i, 2, 700); for (const d of window.__loop.RIVALS) S.rivalResult(d.id, true, 300 + d.prize / 10);',
};
async function snap(p, vp, what) { await R.runFrames(p, 3); await p.screenshot({ path: file(vp, what), timeout: 180000 }); out.shots[R.tagOf(vp) + '-' + what] = true; console.log('shot ' + R.tagOf(vp) + '-' + what); }

if (DO.includes('screens')) for (const vp of SIZES) {
  const touch = vp.width < 900;
  for (const q of ['?rivals=all', '']) {
    const pg = await R.openPage(env, vp, q + '&title=1', { touch });
    const p = pg.page;
    await p.evaluate(() => { window.__feel.draw = true; });
    const go = async (save, action) => p.evaluate(({ save, action }) => { new Function('S', save)(window.__loop.save); window.__loop.action(action); }, { save, action });
    if (q) {
      for (const st of ['none', 'waiting', 'beaten']) { await go(SAVES[st], 'title'); await snap(p, vp, 'title-' + st); }
      for (const st of ['none', 'mid', 'beaten']) { await go(SAVES[st], 'rivals'); await snap(p, vp, 'rivals-' + st); }
      /* the offers */
      await p.evaluate(() => { const L = window.__loop, S = L.save; S.reset(); S.setOnboarded(); S.careerResult(0, 1, 500); L.startRun(L.careerSpec(0)); L.finishNow(); });
      await snap(p, vp, 'offer-career');
      await p.evaluate(() => { const L = window.__loop, S = L.save; S.reset(); S.setOnboarded(); for (let i = 0; i < 8; i++) S.careerResult(i, 1, 500); S.rivalResult('r1', true, 137); L.action('battle', 'r1'); const r = L.finishNow(); Object.assign(r, { won: true, score: r.rival.total + 137, margin: 137, first: true, prize: 300 }); L.screens.results(r); });
      await snap(p, vp, 'offer-won');
      await p.evaluate(() => { const L = window.__loop, S = L.save; S.reset(); S.setOnboarded(); for (let i = 0; i < 8; i++) S.careerResult(i, 1, 500); S.rivalResult('r1', true, 300); L.action('battle', 'r2'); L.finishNow(); });
      await snap(p, vp, 'offer-lost');
    } else { await go(SAVES.none, 'rivals'); await snap(p, vp, 'rivals-shipped'); }
    await pg.close();
  }
}

if (DO.includes('side')) for (const id of RIDS) for (const preset of ['dusk', 'night']) for (const vp of SIZES) {
  const touch = vp.width < 900, def = rivalById(id), pc = R.PLAYER_CAR[chapterOf(def.track)];
  const pg = await R.page(env, vp, '?rivals=all&preset=' + preset, { touch });
  await pg.page.evaluate(pc => { const S = window.__loop.save; S.state.rivals.r1 = { won: false, best: -100, when: 1 }; if (pc.up) S.state.cars.starter.up = Object.assign({}, pc.up); }, pc);
  await R.battleRun(pg.page, id, { player: 'mixed' });
  const f = await pg.page.evaluate(() => {
    const F = window.__feel, A = window.__loop.app;
    F.draw = false;
    for (let k = 0; k < 60 * 150; k++) {
      window.__clock += 1000 / 60; F.frame(window.__clock);
      const Rv = window.__loop.rival(), t = window.__loop.tandem();
      if (A.state === 'results') return null;
      if (A.state === 'drive' && A.runTime > 3 && Rv && Rv.state.sliding && Math.abs(F.world.car.slip) > 0.3 && t.gap < 8 && t.mult > 1.1) return { k, gap: +t.gap.toFixed(2), mult: +t.mult.toFixed(2), t: +A.runTime.toFixed(1) };
    }
    return null;
  });
  const what = 'side-' + def.name.toLowerCase() + '-' + preset;
  if (f) { await R.shot(pg.page, file(vp, what), 1); out.shots[R.tagOf(vp) + '-' + what] = f; console.log('shot ' + R.tagOf(vp) + '-' + what + ' ' + JSON.stringify(f)); }
  else { out.shots[R.tagOf(vp) + '-' + what] = { missing: true }; console.log('MISSING ' + R.tagOf(vp) + '-' + what + ': the mixed player was never sliding within 8 m of him while he slid'); }
  await pg.close();
}
R.writeJson(jfile, out);
await env.close();
