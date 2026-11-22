/* MEASURE 6, ALL SIX RIVALS' RACES (briefs/FIRST-MINUTE.md rule 3): every
   rival race is the same to the bit with and without ?first=2, and as on
   main. Each of the six races, from an empty save in the starter, driven
   to its results by the game's own mixed scripted player (as park/same.js
   drives Kestrow's), on three sides in one browser: main (out of git),
   this branch without the switch, and this branch with it. His total and
   his world's hash must agree on all three; the player's score and hash
   must agree between main and this branch without the switch (with it,
   the player's starter is the new handling on Easy, so his own run may
   differ, and is reported). Kestrow and Sarrow drive the starter
   themselves, so they are the rivals the new handling could reach.
   Known answer: Kestrow with one driving number moved one per cent (his
   ENTRY) no longer agrees.

   node game/test/first/rivals.js   writes review/first/rivals.json */
import path from 'node:path';
import * as F from './lib.js';

const IDS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
async function sideRuns(sideName, query, tweak) {
  const S = await F.side(sideName), env = await S.R.start(), out = {};
  try {
    for (const id of (tweak ? ['r1'] : IDS)) {
      const pg = await S.R.openPage(env, { width: 640, height: 360 }, query);
      const r = await pg.page.evaluate(({ id, tweak }) => {
        const Lp = window.__loop, F = window.__feel; F.draw = false; window.__clock = 1000;
        try { localStorage.clear(); } catch (e) { /* none */ }
        Lp.save.reset(); Lp.save.setOnboarded();
        if (tweak) { const d = Lp.RIVALS.find(x => x.id === id); d.drive.ENTRY *= 1.01; }
        Lp.startRun(Lp.battleSpec(id));
        F.setDriver({ player: 'mixed' });
        for (let i = 0; i < 60 * 240 && Lp.app.state !== 'results'; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); }
        const o = Lp.results();
        return o ? { score: o.score, steps: o.steps, hash: o.hash, rival: o.rival ? o.rival.total : null, rivalHash: o.rivalHash || null, seconds: +o.seconds.toFixed(3), car: Lp.save.state.car } : null;
      }, { id, tweak: !!tweak });
      if (r) r.errors = pg.errors.length;
      out[id] = r;
      await pg.close();
    }
  } finally { await env.close(); }
  return out;
}
const main = await sideRuns('main', ''), plain = await sideRuns('branch', ''), first = await sideRuns('branch', 'first=2'), moved = await sideRuns('branch', 'first=2', true);
const his = r => r && JSON.stringify([r.rival, r.rivalHash]), mine = r => r && JSON.stringify([r.score, r.steps, r.hash]);
for (const id of IDS) {
  const a = main[id], b = plain[id], c = first[id];
  F.say(!!a && his(a) === his(b) && his(a) === his(c) && !a.errors && !b.errors && !c.errors, id + ': his race the same to the bit on main (' + F.mainCommit() + '), this branch and this branch with ?first=2: ' + (a ? a.rival + ', ' + (a.rivalHash === (b && b.rivalHash) && a.rivalHash === (c && c.rivalHash) ? 'hash the same' : 'hash DIFFERENT') : 'no result'));
  F.say(!!a && mine(a) === mine(b), id + ': the player\'s run the same to the bit on main and this branch without the switch: ' + (a ? a.score + ' in ' + a.steps + ' steps' : '-') + ' and ' + (b ? b.score + ' in ' + b.steps + ' steps' : '-'));
  console.log('INFO ' + id + ' with ?first=2, the player in the ' + (c && c.car) + ': ' + (c ? c.score + ' against ' + c.rival + ' in ' + c.seconds + ' s' : 'no result') + ' (without: ' + (b ? b.score + ' in ' + b.seconds + ' s' : '-') + ')');
}
F.say(his(moved.r1) !== his(first.r1), 'known answer: Kestrow with his ENTRY moved one per cent races otherwise (' + (moved.r1 ? moved.r1.rival : '-') + ' against ' + (first.r1 ? first.r1.rival : '-') + '): ' + (his(moved.r1) !== his(first.r1) ? 'CAUGHT' : 'MISSED'));
F.writeJson(path.join(F.dir, 'rivals.json'), { main: F.mainCommit(), mainSide: main, branch: plain, first, moved });
console.log(F.failed() ? F.failed() + ' failed' : 'all passed');
process.exit(F.failed() ? 1 : 0);
