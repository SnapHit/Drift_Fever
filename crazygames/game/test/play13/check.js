/* AFTER PLAY, 13 November 2026: all six rivals in the game, the race
   HUD says points decide, the winning margin pays the player, bigger
   HUD buttons, a locked rival's track says where it is. Frames in
   review/play13/shots/ and the facts in review/play13/check.json.
   node game/test/play13/check.js */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../ladder/lib.js';
const out = path.join(R.root, 'review', 'play13'), shots = path.join(out, 'shots');
fs.mkdirSync(shots, { recursive: true });
const env = await R.start();
const facts = {}, fails = [];
const ok = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ': ' + detail : '')); if (!pass) fails.push(name); };
for (const [w, h] of [[390, 844], [844, 390], [1280, 720]]) {
  const tag = w + 'x' + h, pg = await R.emptyPage(env, { width: w, height: h }, '');
  const page = pg.page;
  /* the rivals screen as shipped: six cards, none SOON, Tolvo's track named as not open */
  await page.evaluate(() => window.__loop.action('rivals'));
  await R.runFrames(page, 20);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.rcard')].map(c => ({ cls: c.className, text: c.innerText.replace(/\s+/g, ' ') })));
  ok(tag + ' six rival cards, none SOON', cards.length === 6 && !cards.some(c => /SOON|off/.test(c.cls + c.text)), cards.map(c => c.cls).join(' | '));
  ok(tag + ' Tolvo says where his track is', /Rookie track 5, not open yet/.test(cards[1].text), cards[1].text);
  await page.screenshot({ path: path.join(shots, tag + '-rivals.png') });
  /* a race with Varsk: the grid, then the HUD a few seconds in */
  await page.evaluate(() => { const L = window.__loop; L.startRun(L.battleSpec('r3')); window.__feel.setDriver({ drift: '*' }); });
  await R.runFrames(page, 60);
  const grid = await page.evaluate(() => ({ n: document.querySelector('#vsN').textContent, lead: document.querySelector('#vsLead').textContent, head: document.querySelector('#missions').textContent }));
  ok(tag + ' the grid says most points wins, no "0 LEVEL"', grid.n === '' && grid.lead === 'MOST POINTS WINS' && /Most points wins/.test(grid.head), JSON.stringify(grid));
  await page.screenshot({ path: path.join(shots, tag + '-grid.png') });
  await page.evaluate(() => window.__loop.skipCountdown());
  await page.evaluate(() => { window.__feel.draw = false; });
  await R.runFrames(page, 1100);
  await page.evaluate(() => { window.__feel.draw = true; });
  await R.runFrames(page, 3);
  const hud = await page.evaluate(() => { const q = s => document.querySelector(s), L = window.__loop.lead(); return { lead: q('#vsLead').textContent, n: q('#vsN').textContent, place: q('#placeN').textContent, gap: q('#gapT').textContent, line: q('#lineT').textContent, t: window.__loop.app.runTime, gates: L.player.gates + L.rival.gates }; });
  ok(tag + ' the pill is a points gap', /^[\d,]+ PTS (AHEAD|BEHIND)$/.test(hud.lead), JSON.stringify(hud));
  ok(tag + ' first on the road shows what the line is worth, second does not', hud.place === '1ST' ? /^\+[\d,]+ AT THE LINE$/.test(hud.line) : hud.line === '', hud.place + ' "' + hud.line + '"');
  await page.screenshot({ path: path.join(shots, tag + '-race.png') });
  /* nothing in the HUD overlaps, and every HUD button is at least 44 px */
  const boxes = await page.evaluate(() => ['#exit', '#fs', '#snd', '#runinfo', '#vs', '#restart', '#readout', '#score', '#missions', '#count'].map(s => { const e = document.querySelector(s); if (!e || e.hidden || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { s, x: r.left, y: r.top, w: r.width, h: r.height }; }).filter(Boolean));
  const hit = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) hit.push(a.s + ' ' + b.s); }
  ok(tag + ' HUD boxes do not overlap', hit.length === 0, hit.join(', ') || boxes.map(b => b.s).join(' '));
  const small = boxes.filter(b => ['#exit', '#fs', '#snd', '#restart'].includes(b.s) && (b.w < 44 || b.h < 44));
  ok(tag + ' HUD buttons at least 44 px', small.length === 0, boxes.filter(b => /exit|fs|snd|restart/.test(b.s)).map(b => b.s + ' ' + Math.round(b.w) + 'x' + Math.round(b.h)).join(', '));
  /* the results, ended now */
  const res = await page.evaluate(() => { const r = window.__loop.finishNow(); return { score: r.score, them: r.rival.total, parts: r.parts, lineTo: r.lineTo }; });
  await R.runFrames(page, 30);
  const card = await page.evaluate(() => { const c = document.querySelector('#screens .card'); const r = c.getBoundingClientRect(); return { text: c.innerText.replace(/\s+/g, ' '), fits: c.scrollHeight <= c.clientHeight + 1 || r.bottom <= innerHeight }; });
  ok(tag + ' the results say most points wins', /most points wins/i.test(card.text) && /Led at gates/.test(card.text), card.text.slice(0, 160));
  await page.screenshot({ path: path.join(shots, tag + '-results.png') });
  /* a win with the margin row on the card: it shows, and the card still fits without scrolling */
  await page.evaluate(() => { const L = window.__loop, r = L.results(); L.screens.results({ ...r, tip: null, won: true, score: r.rival.total + 357, margin: 357, lineTo: 'player', parts: { ...r.parts, line: 636, clear: 1909, clearS: 12.6 } }); });
  await R.runFrames(page, 30);
  const win = await page.evaluate(() => ({ text: document.querySelector('#screens .card').innerText.replace(/\s+/g, ' '), scrolls: [...document.querySelectorAll('#screens, #screens *')].filter(e => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map(e => e.className || e.id) }));
  ok(tag + ' a win shows "First home +2,545 12.6 s clear" and the card does not scroll', /First home \+2,545 12\.6 s clear/.test(win.text) && win.scrolls.length === 0, win.scrolls.join(',') || 'fits');
  await page.screenshot({ path: path.join(shots, tag + '-results-won.png') });
  /* the margin: 0 s pays nothing, the author's race (12.6 s clear on Upper deck) would have been won, and the cap holds */
  const m = await page.evaluate(() => { const L = window.__loop; return { line: L.lead().lineValue, m0: L.app.lead.margin(0), m5: L.app.lead.margin(5), m126: L.app.lead.margin(12.6), m30: L.app.lead.margin(30) }; });
  ok(tag + ' the margin pays by the second up to the cap', m.m0 === 0 && m.m5 > 0 && m.m126 === m.m30 && m.m5 < m.m30, JSON.stringify(m));
  ok(tag + ' the author\'s race with Varsk (5,029 to 6,581, 12.6 s clear) is now a win', 5029 + m.m126 > 6581, '5,029 + ' + m.m126 + ' = ' + (5029 + m.m126));
  facts[tag] = { cards, grid, hud, boxes, res, margin: m };
  await pg.close();
}
fs.writeFileSync(path.join(out, 'check.json'), JSON.stringify(facts, null, 1));
await env.close();
console.log(fails.length ? fails.length + ' FAILED' : 'all passed');
process.exit(fails.length ? 1 : 0);
