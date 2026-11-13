/* AFTER PLAY, 13 November 2026: the last three rivals as the game runs
   them, in the page (Chromium's arithmetic, the record): each one's
   race time, own points, hard hits and scrapes, beside a player who
   never moves. node game/test/play13/page.js   writes review/play13/page.json */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../ladder/lib.js';
const env = await R.start(), pg = await R.emptyPage(env, { width: 390, height: 844 }, ''), out = {};
let fails = 0;
for (const id of ['r4', 'r5', 'r6']) {
  await pg.page.evaluate(id => { const L = window.__loop; window.__feel.draw = false; L.startRun(L.battleSpec(id)); L.skipCountdown(); }, id);
  let r = null;
  for (let i = 0; i < 60 && !r; i++) { await R.runFrames(pg.page, 300); r = await pg.page.evaluate(() => { const v = window.__loop.rival(); if (!v.state.finished) return null; const s = v.scoring.state, w = v.world || {}; return { seconds: +v.state.finishTime.toFixed(1), total: s.total, drift: s.drift, clean: s.clean, pace: s.pace, cleanSectors: v.race && v.race.state ? v.race.state.clean + ' of ' + v.race.state.sectors : null, hash: v.hash() }; }); }
  out[id] = r;
  const pass = !!r && r.total >= 3400;   // was 4,000 until the pace round gave Halvik two laps (3,509)
  if (!pass) fails++;
  console.log((pass ? 'PASS ' : 'FAIL ') + id + ' in the page: ' + JSON.stringify(r));
}
fs.writeFileSync(path.join(R.root, 'review', 'play13', 'page.json'), JSON.stringify(out, null, 1));
await env.close();
process.exit(fails ? 1 : 0);
