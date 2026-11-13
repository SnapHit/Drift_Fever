/* CRAZYGAMES READINESS, the menus by gamepad (14 November 2026). On
   every screen at three sizes: from the button the pad lands on, every
   enabled button can be reached by d-pad moves alone (a search over the
   four directions from each focus), A presses the focused one, B goes
   back, and nothing is ringed until a pad is used. Then a whole trip by
   pad: title to career to a run, out by the back button.
   Known answers: with moves limited to up and down the search misses
   buttons on a screen that has a row (so it can fail); a pointer press
   drops the ring.
   node game/test/ready/pad.js   writes review/ready/pad.json and shots */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../ladder/lib.js';
const dir = path.join(R.root, 'review', 'ready'); fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });
const env = await R.start(), out = {};
let fails = 0;
const say = (pass, msg) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + msg); };
const PAD = `
  const pad = (o) => [{ buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!(o && o.b === i), value: o && o.b === i ? 1 : 0 })), axes: [0, 0, 0, 0] }];
  const N = window.__feel.padnav; let T = window.__padT || 1e6;
  const tap = b => { T += 20; N.update(T, pad({ b })); T += 20; N.update(T, pad(null)); window.__padT = T; };
  const DIR = { up: 12, down: 13, left: 14, right: 15 };
  const keys = () => [...document.querySelectorAll('#screens button[data-action]')].filter(b => !b.disabled && b.offsetParent !== null).map(b => b.dataset.action + '|' + (b.dataset.arg || ''));
  const reach = dirs => { N.focus(null); const start = N.key, seen = new Set([start]), q = [start];
    while (q.length) { const k = q.shift(); for (const d of dirs) { N.focus(k); tap(DIR[d]); if (!seen.has(N.key)) { seen.add(N.key); q.push(N.key); } } }
    N.focus(start); return { start, seen: [...seen] }; };
`;
const SCREENS = ['title', 'career', 'rivals', 'garage', 'lab'];
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
  const tag = vp.width + 'x' + vp.height, pg = await R.emptyPage(env, vp, '');
  await pg.page.evaluate(() => { const S = window.__loop.save; S.state.coins = 99999; });
  for (const name of SCREENS) {
    const r = await pg.page.evaluate(new Function('name', PAD + `
      window.__loop.action(name);
      const before = document.querySelectorAll('#screens .padfocus').length;
      const all = [...new Set(keys())], full = reach(['up', 'down', 'left', 'right']), ud = reach(['up', 'down']);
      return { before, all: all.length, missed: all.filter(k => !full.seen.includes(k)), start: full.start, udMissed: all.filter(k => !ud.seen.includes(k)).length, ring: document.querySelectorAll('#screens .padfocus').length };
    `), name);
    out[tag + ' ' + name] = r;
    say(r.before === 0 && r.missed.length === 0 && r.ring === 1, tag + ' ' + name + ': no ring before a pad is used (' + r.before + '), then all ' + r.all + ' buttons reached from ' + r.start + (r.missed.length ? ', MISSED ' + r.missed.join(' ') : '') + '; up and down alone miss ' + r.udMissed);
    await pg.page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown')));
    const dropped = await pg.page.evaluate(() => document.querySelectorAll('#screens .padfocus').length === 0 && !window.__feel.padnav.active);
    say(dropped, tag + ' ' + name + ' known answer: a pointer press drops the ring');
  }
  const anyRow = SCREENS.some(n => out[tag + ' ' + n].udMissed > 0);
  say(anyRow, tag + ' known answer: with up and down alone the search misses buttons on some screen, so it can fail: ' + (anyRow ? 'CAUGHT' : 'MISSED'));
  /* a trip by pad: title, A on CAREER, B back; then into a run and out by the back button; results reached */
  const trip = await pg.page.evaluate(new Function(PAD + `
    const L = window.__loop, o = {};
    L.action('title'); tap(99); N.focus('career|'); o.focus = N.key; tap(0); o.afterA = document.querySelector('#screens .screen').className;
    tap(1); o.afterB = document.querySelector('#screens .screen').className;
    L.action('career'); tap(99); N.focus('play-career|0'); tap(0); o.inRun = !document.querySelector('#screens').classList.contains('on');
    tap(8); o.afterBack = document.querySelector('#screens').classList.contains('on') ? document.querySelector('#screens .screen').className : 'still in the run';
    return o;
  `));
  out[tag + ' trip'] = trip;
  say(/career/.test(trip.afterA) && /title/.test(trip.afterB) && trip.inRun && /title/.test(trip.afterBack), tag + ' a trip by pad: A on CAREER opens it, B goes back, A starts track 1, the back button leaves the run: ' + JSON.stringify(trip));
  await pg.page.evaluate(new Function(PAD + `window.__loop.action('garage'); tap(99); tap(13);`));
  await pg.page.screenshot({ path: path.join(dir, 'shots', tag + '-pad-garage.png') });
  await pg.page.close();
}
fs.writeFileSync(path.join(dir, 'pad.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
