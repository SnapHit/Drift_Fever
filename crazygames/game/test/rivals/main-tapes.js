/* THE TAPES FROM MAIN (briefs/RIVALS.md measure 1). Run once on main's
   code (this branch's base commit, 450312f, before any rival code): the
   scripted drifter drives career 1 and The vice live through the game's
   own frame function, and each run's tape, world hash and score are
   written to review/rivals/main-tapes.json. determinism.js replays them
   on this branch and compares.

   node game/test/rivals/main-tapes.js */
import path from 'node:path';
import { execSync } from 'node:child_process';
import * as S from '../spectacle/lib.js';

const VP = { width: 640, height: 360 };
const env = await S.start();
const out = { note: 'recorded on main\'s code, headless Chromium, forced WebGL 2, the scripted drifter, 60 Hz synthetic clock', commit: execSync('git rev-parse HEAD').toString().trim(), tapes: [] };
for (const t of [{ index: 0, name: 'career 1, First slide' }, { index: 22, name: 'career 23, The vice' }]) {
  const pg = await S.page(env, VP, '');
  await S.careerRun(pg.page, t.index);
  const r = await pg.page.evaluate(() => {
    const F = window.__feel, A = window.__loop.app;
    let k = 0;
    while (A.state !== 'results' && k < 60 * 400) { window.__clock += 1000 / 60; F.draw = k % 30 === 0; F.frame(window.__clock); k++; }
    F.draw = false;
    const res = window.__loop.results(), tape = F.tapeCopy();
    let left = res.steps; const cut = [];
    for (const e of tape) { if (left <= 0) break; const n = Math.min(e.n, left); cut.push({ ...e, n }); left -= n; }
    return { score: res.score, hash: res.hash, steps: res.steps, tape: cut, parts: res.parts };
  });
  console.log(t.name + ': score ' + r.score + ', ' + r.steps + ' steps, ' + r.tape.length + ' tape entries, errors ' + pg.errors.length);
  out.tapes.push({ ...t, ...r });
  await pg.close();
}
S.writeJson(path.join(S.root, 'review', 'rivals', 'main-tapes.json'), out);
await env.close();
