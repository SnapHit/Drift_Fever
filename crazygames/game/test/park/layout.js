/* PLAYGROUND MEASURE 6: LAYOUT. The list and the in-park readout at
   390x844, 844x390, 800x450 and 1280x720.

   The list (from the title, and from inside the park): every button is
   at least 44 px both ways, nothing scrolls sideways (the page, the
   screen, the list), every card can be brought fully into view by
   scrolling the list, no words are cut off, the way on (DRIVE) is on
   the screen without scrolling, and the title's button carries its
   name and its tally.
   In the park: the list button is at least 44 px and clear of the
   other buttons; through a drive (a donut, so the readout is up for
   most of it, a level won in it) the readout, the welcome line, the
   list button and the level's notice never lie over the car on any
   frame, and the readout stays on the screen; the longest thing the
   readout can say fits the screen.
   Known answer: a readout moved down over the car is caught.
   Shots of each for the review, by day and at night.

   node game/test/park/layout.js [size]   writes review/park/layout.json and shots */
import path from 'node:path';
import fs from 'node:fs';
import * as P from './lib.js';

const only = process.argv[2];
const env = await P.start(), file = path.join(P.dir, 'layout.json'), out = fs.existsSync(file) && only ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const LIST = `
  const scr = document.querySelector('#screens .screen.park'), list = scr.querySelector('.list'), vw = window.innerWidth, vh = window.innerHeight;
  const btn = [...scr.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return { key: b.dataset.action + '|' + (b.dataset.arg || ''), w: Math.round(r.width), h: Math.round(r.height), left: r.left, right: r.right }; });
  const cards = [...list.querySelectorAll('.pcard')], seen = [];
  for (const c of cards) { c.scrollIntoView({ block: 'nearest' }); const r = c.getBoundingClientRect(), l = list.getBoundingClientRect(); seen.push(r.top >= l.top - 1 && r.bottom <= l.bottom + 1 && r.left >= 0 && r.right <= vw + 0.5); }
  const cut = [...scr.querySelectorAll('.pcard b, .pcard small, h2, .tally, .drive b')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.slice(0, 30));
  const go = scr.querySelector('.drive button').getBoundingClientRect(), head = scr.querySelector('header').getBoundingClientRect();
  return { vw, vh, buttons: btn.length, small: btn.filter(b => b.w < 44 || b.h < 44), off: btn.filter(b => b.left < -0.5 || b.right > vw + 0.5).length, sideways: { doc: document.documentElement.scrollWidth - vw, screens: document.querySelector('#screens').scrollWidth - document.querySelector('#screens').clientWidth, list: list.scrollWidth - list.clientWidth }, cards: cards.length, allSeen: seen.every(Boolean), cut, goOn: go.bottom <= vh + 0.5 && go.top >= 0, pageScrolls: document.querySelector('#screens').scrollHeight - document.querySelector('#screens').clientHeight, headH: Math.round(head.height) };
`;
/* after every frame of a drive: the car's box on the screen and every park HUD box that is showing */
const EACH = `
  const T = F.scene.THREE, cam = F.scene.camera, p = F.pose, V = F.TUNE.VEHICLE, v = new T.Vector3();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), lx = -Math.cos(p.yaw), lz = Math.sin(p.yaw);
  for (const f of [-V.HALF_LENGTH, V.HALF_LENGTH]) for (const l of [-V.HALF_WIDTH, V.HALF_WIDTH]) for (const y of [0, 1.3]) { v.set(p.x + fx * f + lx * l, y, p.z + fz * f + lz * l).project(cam); const sx = (v.x * 0.5 + 0.5) * F.view.w, sy = (-v.y * 0.5 + 0.5) * F.view.h; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  const over = {}; let shown = 0, offscreen = 0;
  const lap = r => { const w = Math.min(r.right, x1) - Math.max(r.left, x0), h = Math.min(r.bottom, y1) - Math.max(r.top, y0); return w > 0 && h > 0 ? Math.round(w * h) : 0; };
  for (const id of ['park', 'parktip', 'plist']) { const e = document.getElementById(id); if (!e || e.hidden) continue; const r = e.getBoundingClientRect(); if (id === 'park') { shown = 1; if (r.left < 0 || r.right > F.view.w || r.top < 0 || r.bottom > F.view.h) offscreen = 1; } const a = lap(r); if (a) over[id] = a; }
  for (const e of document.querySelectorAll('#callouts .callout.mission')) { const a = lap(e.getBoundingClientRect()); if (a && getComputedStyle(e).opacity > 0.5) over.notice = a; }
  return [shown, Object.keys(over).length ? over : 0, offscreen, document.getElementById('park').classList.contains('won') ? 1 : 0, Math.round(y0)];
`;
for (const vp of P.SIZES) {
  const t = P.tag(vp);
  if (only && only !== t) continue;
  const pg = await P.parkPage(env, vp, ''), page = pg.page, o = {};
  /* the title's button */
  o.title = await page.evaluate(() => { const b = document.querySelector('.parkbtn'), h = b.querySelector('b'), s = b.querySelector('small'), r = b.getBoundingClientRect(); return { name: h.textContent, line: s.textContent, oneLine: h.getBoundingClientRect().height < 30, w: Math.round(r.width), h: Math.round(r.height), fits: s.scrollWidth <= s.clientWidth + 1 && h.scrollWidth <= h.clientWidth + 1 && r.right <= window.innerWidth, dailyOneLine: document.querySelector('[data-action="daily"] b').getBoundingClientRect().height < 30 }; });
  /* the title's menu is a grid of narrow columns on a phone on its side and at 800x450, where a two word name takes two lines (DAILY DRIFT does too): one line is asked at 390 wide, the brief's size, and at 1280 */
  const wide = vp.width === 390 || vp.width >= 1000;
  P.say(o.title.name === 'STUNT PARK' && (o.title.oneLine || (!wide && !o.title.dailyOneLine)) && o.title.h >= 44 && o.title.fits && /0 of 24/.test(o.title.line), t + ' the title\'s button: "' + o.title.name + '" on ' + (o.title.oneLine ? 'one line' : 'two lines (as DAILY DRIFT is at this size)') + ', "' + o.title.line + '" under it, ' + o.title.w + ' by ' + o.title.h + ' px, nothing cut off');
  await page.screenshot({ path: path.join(P.shots, t + '-title.png') });
  /* the list from the title */
  await page.evaluate(() => { window.__loop.action('park'); });
  o.list = await page.evaluate(new Function(LIST));
  const okList = L => L.small.length === 0 && L.off === 0 && L.sideways.doc <= 0 && L.sideways.screens <= 0 && L.sideways.list <= 0 && L.cards === 8 && L.allSeen && L.cut.length === 0 && L.goOn && L.pageScrolls <= 0 && L.headH <= 60;
  P.say(okList(o.list), t + ' the list from the title: ' + o.list.buttons + ' buttons, none under 44 px' + (o.list.small.length ? ' (SMALL: ' + JSON.stringify(o.list.small) + ')' : '') + ', nothing scrolls sideways (page ' + o.list.sideways.doc + ', screen ' + o.list.sideways.screens + ', list ' + o.list.sideways.list + ' px), all ' + o.list.cards + ' cards come fully into view by scrolling the list, no words cut off' + (o.list.cut.length ? ' (CUT: ' + o.list.cut.join(', ') + ')' : '') + ', the header on one line (' + o.list.headH + ' px), DRIVE on the screen without scrolling');
  await page.evaluate(() => { document.querySelector('.park .list').scrollTop = 0; });
  await page.screenshot({ path: path.join(P.shots, t + '-list.png') });
  await page.evaluate(() => { const l = document.querySelector('.park .list'); l.scrollTop = l.scrollHeight; });
  await page.screenshot({ path: path.join(P.shots, t + '-list-end.png') });
  /* into the park: the welcome line, then a donut, the readout up, bronze won */
  await P.ownCar(page, 'starter', null);
  const d = await P.drive(page, { line: 'donut', args: [1.6], seconds: 40, noRec: true, each: EACH });
  const fr = d.frames, shown = fr.filter(f => f[0]).length, overs = fr.filter(f => f[1] !== 0), won = fr.filter(f => f[3]).length;
  o.drive = { frames: fr.length, shown, over: overs.length, what: [...new Set(overs.flatMap(f => Object.keys(f[1])))], offscreen: fr.filter(f => f[2]).length, won, carTop: Math.min(...fr.map(f => f[4])) };
  o.hud = await page.evaluate(() => { const r = document.getElementById('plist').getBoundingClientRect(), others = ['exit', 'fs', 'snd', 'restart'].map(id => document.getElementById(id)).filter(e => e && !e.hidden && e.offsetParent !== null).map(e => e.getBoundingClientRect()); return { w: Math.round(r.width), h: Math.round(r.height), on: r.left >= 0 && r.right <= window.innerWidth && r.top >= 0, clash: others.some(q => Math.min(r.right, q.right) > Math.max(r.left, q.left) && Math.min(r.bottom, q.bottom) > Math.max(r.top, q.top)) }; });
  P.say(o.hud.w >= 44 && o.hud.h >= 44 && o.hud.on && !o.hud.clash, t + ' the list button in the park: ' + o.hud.w + ' by ' + o.hud.h + ' px, on the screen, clear of the other buttons');
  P.say(shown > 60 && won > 0 && overs.length === 0 && o.drive.offscreen === 0, t + ' through a donut drive (' + fr.length + ' frames, the readout up on ' + shown + ', a level won shown on ' + won + '): the readout, the welcome line, the list button and the notice lie over the car on ' + overs.length + ' frames' + (overs.length ? ' (' + o.drive.what.join(', ') + ')' : '') + '; the readout is off the screen on ' + o.drive.offscreen + ' (the car\'s box is never higher than ' + o.drive.carTop + ' px)');
  /* the readout mid count, for a shot, and the known answer */
  await P.drive(page, { line: 'donut', args: [1.3], seconds: 14, tail: 0, noRec: true });
  await P.snap(page, path.join(P.shots, t + '-readout.png'));
  const known = await page.evaluate(new Function(`
    const F = window.__feel, Lp = window.__loop, e = document.getElementById('park'), was = e.getAttribute('style') || '';
    const each = new Function('F', 'Lp', ${JSON.stringify(EACH)});
    window.__clock += 1000 / 60; F.frame(window.__clock); e.hidden = false; e.style.top = '58%'; e.style.left = '50%'; e.style.setProperty('--ptx', '-50%');
    const r = each(F, Lp); e.setAttribute('style', was);
    return r;
  `));
  o.known = known;
  P.say(known[1] !== 0 && known[1].park > 0, t + ' known answer: the readout moved down over the car is caught: ' + (known[1] !== 0 ? JSON.stringify(known[1]) + ' px of it over the car: CAUGHT' : 'MISSED'));
  /* the longest thing the readout can say, with a level won beside it, fits the screen */
  o.longest = await page.evaluate(() => { const e = document.getElementById('park'), tx = document.getElementById('parkT'), w = document.getElementById('parkW'), was = [e.hidden, tx.textContent, w.textContent, e.className]; e.hidden = false; e.className = 'won gold'; tx.textContent = 'WALL RIDE 140 m'; w.textContent = 'GOLD +570'; const r = e.getBoundingClientRect(); const res = { w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), vw: window.innerWidth, popped: Math.round(r.width * 1.14) }; e.hidden = was[0]; tx.textContent = was[1]; w.textContent = was[2]; e.className = was[3]; return res; });
  P.say(o.longest.left >= 0 && o.longest.right <= o.longest.vw && o.longest.popped <= o.longest.vw, t + ' the longest readout ("WALL RIDE 140 m" with "GOLD +570") is ' + o.longest.w + ' px wide, ' + o.longest.popped + ' at the height of its pop, inside the ' + o.longest.vw + ' px screen');
  /* the list from inside the park, with a level won */
  await page.evaluate(() => { window.__loop.parkList.open(); });
  o.listIn = await page.evaluate(new Function(LIST));
  const back = await page.evaluate(() => { const b = document.querySelector('.park .drive button'); const txt = b.textContent, got = document.querySelectorAll('.pcard .lv.got').length; b.click(); return { txt, got, state: window.__loop.app.state, open: document.querySelector('#screens').classList.contains('on') }; });
  o.back = back;
  P.say(okList(o.listIn) && back.got >= 1 && /BACK TO THE PARK/.test(back.txt) && back.state === 'free' && !back.open, t + ' the list from inside the park: the same bars hold, ' + back.got + ' levels shown won, and "' + back.txt + '" goes back to the park');
  o.errors = pg.errors.slice(0, 3);
  if (pg.errors.length) P.say(false, t + ' page errors: ' + pg.errors.slice(0, 2).join(' | '));
  out[t] = o;
  await pg.close();
  /* the start by day and at night, for the review: what a player dropped in the park sees, and five seconds straight on */
  for (const preset of ['dusk', 'night', 'dawn']) {
    const q = await P.parkPage(env, vp, 'preset=' + preset);
    await q.page.evaluate(() => { window.__feel.draw = false; window.__loop.save.setParkSeen(); window.__loop.action('free'); });
    await P.runFrames(q.page, 20);
    await P.snap(q.page, path.join(P.shots, t + '-start-' + preset + '.png'));
    if (preset !== 'dawn') { await q.page.evaluate(() => { window.__feel.inject = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }; }); await P.runFrames(q.page, 300); await P.snap(q.page, path.join(P.shots, t + '-5s-' + preset + '.png')); }
    await q.close();
  }
}
await P.finish(env, 'layout.json', out);
