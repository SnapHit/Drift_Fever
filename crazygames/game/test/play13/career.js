/* AFTER THE NEW PLAYER RUN, 14 November 2026 (the author, incognito):
   1 a race's results lead back into the career; 2 a chapter opens only
   when every track of the one before is finished as well as its stars;
   3 dearer cars and upgrades. Frames in review/play13/shots/.
   node game/test/play13/career.js */
import path from 'node:path';
import * as R from '../ladder/lib.js';
const shots = path.join(R.root, 'review', 'play13', 'shots');
const env = await R.start();
let fails = 0;
const ok = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ': ' + detail : '')); if (!pass) fails++; };
const seed = (page, career, rivals, coins) => page.evaluate(({ career, rivals, coins }) => { const S = window.__loop.save; S.reset(); S.setOnboarded(); for (const k in career) S.state.career[k] = career[k]; for (const k in rivals) S.state.rivals[k] = rivals[k]; if (coins) S.state.coins = coins; }, { career, rivals, coins });
const st = n => ({ stars: n, best: 1000 });
for (const [w, h] of [[390, 844], [844, 390], [1280, 720]]) {
  const tag = w + 'x' + h, pg = await R.emptyPage(env, { width: w, height: h }, ''), page = pg.page;
  /* 2: five Rookie tracks at three stars (15 stars, over the 12 asked) does not open Pro; all eight finished does; a save already in Pro keeps it */
  await seed(page, { 0: st(3), 1: st(3), 2: st(3), 3: st(3), 4: st(3) }, {});
  const a = await page.evaluate(() => { const L = window.__loop; return { open: L.careerUnlocked(L.save.state, 8) }; });
  await page.evaluate(() => window.__loop.action('career')); await R.runFrames(page, 20);
  const head = await page.evaluate(() => document.querySelector('.chapter[data-chapter="1"] .chead small').textContent);
  ok(tag + ' fifteen stars on five Rookie tracks leaves Pro shut, and says why', !a.open && /Finish 3 more Rookie tracks to open Pro/.test(head), head);
  await page.screenshot({ path: path.join(shots, tag + '-career-shut.png') });
  await seed(page, { 0: st(3), 1: st(3), 2: st(3), 3: st(3), 4: st(1), 5: st(1), 6: st(1), 7: st(0) }, {});
  const b = await page.evaluate(() => { const L = window.__loop; return L.careerUnlocked(L.save.state, 8); });
  ok(tag + ' all eight finished with the stars opens Pro', b === true);
  await seed(page, { 0: st(3), 1: st(3), 2: st(3), 3: st(3), 4: st(3), 8: st(1) }, {});
  const c = await page.evaluate(() => { const L = window.__loop; return L.careerUnlocked(L.save.state, 8); });
  ok(tag + ' a save with a run in Pro already keeps Pro open', c === true);
  /* 1: a win over Kestrow with Tolvo not yet earned: NEXT TRACK is the main button and starts that track; a loss keeps REMATCH main with CAREER under it */
  await seed(page, { 0: st(3), 1: st(1) }, {});
  await page.evaluate(() => { const L = window.__loop; L.startRun(L.battleSpec('r1')); const r = L.finishNow(); L.screens.results({ ...r, won: true, score: r.rival.total + 100, margin: 100 }); });
  await R.runFrames(page, 30);
  const win = await page.evaluate(() => { const B = [...document.querySelectorAll('#screens .card button')].map(b => ({ t: b.innerText.replace(/\s+/g, ' '), primary: b.classList.contains('primary'), act: b.dataset.action, arg: b.dataset.arg, r: b.getBoundingClientRect() })); return { B, scrolls: [...document.querySelectorAll('#screens, #screens *')].filter(e => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY)).length, vh: innerHeight, vw: innerWidth }; });
  const main = win.B.find(x => x.primary);
  ok(tag + ' after a win the main button is NEXT TRACK, the first unfinished track', !!main && main.act === 'play-career' && main.arg === '2' && /NEXT TRACK Rookie track 3/.test(main.t), win.B.map(x => x.t).join(' | '));
  ok(tag + ' the card fits and every button is in view', win.scrolls === 0 && win.B.every(x => x.r.top >= 0 && x.r.bottom <= win.vh && x.r.left >= 0 && x.r.right <= win.vw && x.r.height >= 44), win.scrolls + ' scroll');
  await page.screenshot({ path: path.join(shots, tag + '-race-won-career.png') });
  await page.evaluate(() => document.querySelector('#screens .card button.primary').click());
  await R.runFrames(page, 10);
  const went = await page.evaluate(() => { const A = window.__loop.app; return A.spec && A.spec.mode + ':' + A.spec.index + ':' + A.state; });
  ok(tag + ' NEXT TRACK starts that career run', went === 'career:2:countdown', went);
  await seed(page, { 0: st(3), 1: st(1) }, {});
  await page.evaluate(() => { const L = window.__loop; L.startRun(L.battleSpec('r1')); L.finishNow(); });
  await R.runFrames(page, 30);
  const lost = await page.evaluate(() => [...document.querySelectorAll('#screens .card button')].map(b => (b.classList.contains('primary') ? '*' : '') + b.innerText.replace(/\s+/g, ' ')));
  ok(tag + ' after a loss REMATCH stays main and CAREER is under it', /^\*REMATCH/.test(lost[0]) && lost.some(t => /^CAREER/.test(t)), lost.join(' | '));
  await page.screenshot({ path: path.join(shots, tag + '-race-lost-career.png') });
  /* 3: the prices */
  const prices = await page.evaluate(async () => { const g = await import('./src/garage/roster.js'); return { cars: g.ROSTER.map(c => c.price), up: window.__loop.LOOP.UPGRADE_PRICES }; });
  ok(tag + ' cars 0, 2,500, 5,500, 10,000, 16,000 and upgrades 400, 900, 1,800', JSON.stringify(prices) === '{"cars":[0,2500,5500,10000,16000],"up":[400,900,1800]}', JSON.stringify(prices));
  await seed(page, {}, {}, 9999);
  await page.evaluate(() => window.__loop.action('garage')); await R.runFrames(page, 20);
  await page.screenshot({ path: path.join(shots, tag + '-garage.png') });
  await pg.close();
}
await env.close();
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
