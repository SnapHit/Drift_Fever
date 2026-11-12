/* WHAT MAIN WROTE, for briefs/RIVALS-LADDER-2.md measure 1 (and the ladder round's 8). Run once
   on main's code (this branch before any change of the round, or a worktree of main, given on the
   command line), in headless Chromium through main's own harness:
   - the scripted drifter drives career 1 and The vice live through the
     game's frame function; each run's tape, world hash and score;
   - a drift race against Kestrow, the mixed scripted player (a player's
     hands) driving, live: its tape, the player's hash, his hash and both
     totals;
   - a save as main stores it after a career 1 run with a star and that
     race played to its results: so it carries a `rivals` entry (won,
     best, when), a ghost, missions and coins.
   All are written to review/ladder2/main.json, as the strings main
   wrote. determinism.js and save.js read them on this branch.

   node game/test/ladder/main-record.js /path/to/main/worktree */
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const wt = path.resolve(process.argv[2] || '');
const S = await import(path.join(wt, 'crazygames', 'game', 'test', 'spectacle', 'lib.js'));
const here = path.dirname(new URL(import.meta.url).pathname);
const outFile = path.resolve(here, '..', '..', '..', 'review', 'ladder2', 'main.json');
const VP = { width: 640, height: 360 };
const env = await S.start();
const out = { note: 'recorded on main\'s code, headless Chromium, forced WebGL 2, 60 Hz synthetic clock', commit: execSync('git rev-parse HEAD', { cwd: wt }).toString().trim(), tapes: [], save: null };
const RUN = () => {
  const F = window.__feel, A = window.__loop.app;
  let k = 0;
  while (A.state !== 'results' && k < 60 * 400) { window.__clock += 1000 / 60; F.draw = k % 30 === 0; F.frame(window.__clock); k++; }
  F.draw = false;
  const res = window.__loop.results(), tape = F.tapeCopy();
  let left = res.steps; const cut = [];
  for (const e of tape) { if (left <= 0) break; const n = Math.min(e.n, left); cut.push({ ...e, n }); left -= n; }
  return { score: res.score, hash: res.hash, steps: res.steps, tape: cut.map(e => [e.n, e.s, e.t, e.b, e.h]), parts: res.parts, rival: res.rival ? res.rival.total : null, rivalHash: res.rivalHash || null };
};
for (const t of [{ index: 0, name: 'career 1, First slide' }, { index: 22, name: 'career 23, The vice' }]) {
  const pg = await S.page(env, VP, '');
  await S.careerRun(pg.page, t.index);
  const r = await pg.page.evaluate(RUN);
  console.log(t.name + ': score ' + r.score + ', ' + r.steps + ' steps, ' + r.tape.length + ' tape entries, errors ' + pg.errors.length);
  out.tapes.push({ ...t, ...r });
  await pg.close();
}
/* a drift race against Kestrow, the mixed player driving */
{
  const pg = await S.page(env, VP, '');
  await pg.page.evaluate(() => { const Lp = window.__loop; window.__feel.draw = false; window.__clock = window.__clock || 1000; Lp.startRun(Lp.battleSpec('r1')); window.__feel.setDriver({ player: 'mixed' }); });
  const r = await pg.page.evaluate(RUN);
  console.log('the race: ' + r.score + ' against ' + r.rival + ', ' + r.steps + ' steps, errors ' + pg.errors.length);
  out.race = r;
  await pg.close();
}
/* the save: a fresh one, career 1 played to a star, then a drift race against Kestrow */
{
  const pg = await S.openPage(env, VP, 'title=1');
  await pg.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const Sv = window.__loop.save; Sv.reset(); Sv.setOnboarded(); });
  await S.careerRun(pg.page, 0);
  const c = await pg.page.evaluate(RUN);
  await pg.page.evaluate(() => { const Lp = window.__loop; window.__feel.draw = false; Lp.startRun(Lp.battleSpec('r1')); window.__feel.setDriver({ player: 'mixed' }); });
  const b = await pg.page.evaluate(RUN);
  const blob = await pg.page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/drift/i.test(k)) return [k, localStorage.getItem(k)]; } return null; });
  console.log('the save: career 1 ' + c.score + ', the race ' + b.score + ' against ' + b.rival + ', key ' + (blob && blob[0]) + ', ' + (blob ? blob[1].length : 0) + ' characters, errors ' + pg.errors.length);
  out.save = { key: blob && blob[0], blob: blob && blob[1], career1: c.score, battle: { score: b.score, rival: b.rival } };
  await pg.close();
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out));
await env.close();
