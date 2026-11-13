/* THE GARAGE BY KEYBOARD, TOUCH AND GAMEPAD, AND THE DRAG
   (briefs/GARAGE.md 1 and 5). At 390x844, 844x390 and 1280x720.

   Gamepad: in every section, from the button the pad lands on, every
   enabled button is reached by d-pad moves alone (the search of
   game/test/ready/pad.js); A on an item previews it, A on the buy
   button buys it, B goes back to the title. Known answer: with up and
   down alone the search misses buttons, so it can fail.
   Keyboard: Tab reaches every enabled button of a section, and Enter on
   an item and then on the buy button previews and buys.
   Touch: a tap on an item and a tap on the buy button preview and buy.
   The drag: a pointer dragged across the stage turns the car by hand
   (by DRAG radians a pixel) and it does not turn itself meanwhile; let
   go, it stays for RESUME seconds and then turns itself again; a touch
   drags it the same. Known answer: a drag that starts on the controls
   does not turn it.
   The way in from a lost race: with another section left open, GARAGE
   opens on the cars section.

   node game/test/garage/controls.js   writes review/garage/controls.json */
import path from 'node:path';
import fs from 'node:fs';
import * as G from './lib.js';

const env = await G.start(), out = {};
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
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
  const tag = vp.width + 'x' + vp.height, pg = await G.openPage(env, vp, '&title=1', { touch: true }), page = pg.page, o = out[tag] = {};
  const reset = () => page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } const S = window.__loop.save; S.reset(); S.setOnboarded(); window.__loop.action('title'); window.__feel.draw = false; });
  await reset();

  /* ---- gamepad ---- */
  let missed = [], udMiss = 0;
  for (const section of G.SECTIONS) {
    const r = await page.evaluate(new Function('section', PAD + `
      const L = window.__loop; L.save.state.coins = 3000; L.action('garage'); L.action('garage-tab', section);
      if (section === 'wheels') L.action('look', 'wheels:blades'); if (section === 'glow') L.action('look', 'glow:lime'); if (section === 'smoke') L.action('look', 'smoke:rose'); if (section === 'paint') L.action('paint', 'lime');
      const all = [...new Set(keys())], full = reach(['up', 'down', 'left', 'right']), ud = reach(['up', 'down']);
      return { all: all.length, missed: all.filter(k => !full.seen.includes(k)), udMissed: all.filter(k => !ud.seen.includes(k)).length };
    `), section);
    o['pad ' + section] = r; udMiss += r.udMissed;
    for (const k of r.missed) missed.push(section + ' ' + k);
  }
  G.say(missed.length === 0, tag + ' gamepad: every enabled button of all six sections is reached by d-pad' + (missed.length ? ', MISSED ' + missed.join(', ') : ' (' + G.SECTIONS.map(s => o['pad ' + s].all).join(', ') + ' buttons)'));
  G.say(udMiss > 0, tag + ' known answer: with up and down alone the search misses ' + udMiss + ' buttons: ' + (udMiss ? 'CAUGHT' : 'MISSED'));
  const trip = await page.evaluate(new Function(PAD + `
    const L = window.__loop, S = L.save, r = {};
    S.state.coins = 3000; L.action('garage'); L.action('garage-tab', 'glow'); tap(99);
    N.focus('look|glow:violet'); tap(0); r.preview = L.showroom.state.look.glow; r.coinsAfterPreview = S.state.coins;
    N.focus('buy-look|glow:violet'); tap(0); r.coins = S.state.coins; r.worn = S.state.cars.starter.glow;
    tap(1); r.afterB = document.querySelector('#screens .screen').className;
    return r;
  `));
  o.padTrip = trip;
  G.say(trip.preview === 'violet' && trip.coinsAfterPreview === 3000 && trip.coins === 2600 && trip.worn === 'violet' && /title/.test(trip.afterB), tag + ' gamepad: A on an item previews it (no coins move), A on the buy button buys it (3,000 to ' + trip.coins + '), B goes back to the title');

  /* ---- keyboard ---- */
  await reset();
  await page.evaluate(() => { const L = window.__loop; L.save.state.coins = 3000; L.action('garage'); L.action('garage-tab', 'wheels'); });
  const want = await page.evaluate(() => [...document.querySelectorAll('#screens button[data-action]')].filter(b => !b.disabled).map(b => b.dataset.action + '|' + (b.dataset.arg || '')));
  const seen = new Set();
  for (let i = 0; i < want.length + 6; i++) { await page.keyboard.press('Tab'); const k = await page.evaluate(() => { const a = document.activeElement; return a && a.dataset && a.dataset.action ? a.dataset.action + '|' + (a.dataset.arg || '') : null; }); if (k) seen.add(k); }
  const tabMiss = want.filter(k => !seen.has(k));
  await page.evaluate(() => document.querySelector('#screens button[data-arg="wheels:discs"]').focus());
  await page.keyboard.press('Enter');
  const kPreview = await page.evaluate(() => ({ look: window.__loop.showroom.state.look.wheels, coins: window.__loop.save.state.coins }));
  await page.evaluate(() => document.querySelector('#screens .act button.primary').focus());
  await page.keyboard.press('Enter');
  const kBought = await page.evaluate(() => ({ worn: window.__loop.save.state.cars.starter.wheels, coins: window.__loop.save.state.coins }));
  o.keys = { want: want.length, tabMiss, kPreview, kBought };
  G.say(tabMiss.length === 0 && kPreview.look === 'discs' && kPreview.coins === 3000 && kBought.worn === 'discs' && kBought.coins === 2200, tag + ' keyboard: Tab reaches all ' + want.length + ' buttons of the wheels section' + (tabMiss.length ? ' but ' + tabMiss.join(', ') : '') + '; Enter on Discs previews it, Enter on the buy button buys it (3,000 to ' + kBought.coins + ')');

  /* ---- touch ---- */
  await reset();
  await page.evaluate(() => { const L = window.__loop; L.save.state.coins = 3000; L.action('garage'); L.action('garage-tab', 'smoke'); });
  const mid = sel => page.evaluate(sel => { const b = document.querySelector(sel); b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  let at = await mid('#screens button[data-arg="smoke:lime"]'); await page.touchscreen.tap(at[0], at[1]);
  const tPreview = await page.evaluate(() => ({ look: window.__loop.showroom.state.look.smoke, coins: window.__loop.save.state.coins }));
  at = await mid('#screens .act button.primary'); await page.touchscreen.tap(at[0], at[1]);
  const tBought = await page.evaluate(() => ({ worn: window.__loop.save.state.cars.starter.smoke, coins: window.__loop.save.state.coins }));
  o.touch = { tPreview, tBought };
  G.say(tPreview.look === 'lime' && tPreview.coins === 3000 && tBought.worn === 'lime' && tBought.coins === 2700, tag + ' touch: a tap on Lime smoke previews it, a tap on the buy button buys it (3,000 to ' + tBought.coins + ')');

  /* ---- the drag ---- */
  await reset();
  await page.evaluate(() => { window.__loop.action('garage'); });
  await G.runFrames(page, 30);
  const SR = () => page.evaluate(() => { const s = window.__loop.showroom.state; return { angle: s.angle, dragging: s.dragging, hold: s.hold, vel: s.vel }; });
  const K = await page.evaluate(async () => (await import('/src/garage/showroom.js')).SHOWROOM);
  const st = await page.evaluate(() => { const r = document.querySelector('.garage .stage').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
  const a0 = await SR(), turning = await (async () => { await G.runFrames(page, 60); return (await SR()).angle - a0.angle; })();
  const b0 = await SR();
  await page.mouse.move(st.x - 60, st.y); await page.mouse.down(); await page.mouse.move(st.x, st.y, { steps: 6 }); await page.mouse.move(st.x + 60, st.y, { steps: 6 });
  await G.runFrames(page, 30);
  const b1 = await SR();
  await page.mouse.up();
  await G.runFrames(page, Math.round(K.RESUME * 60 * 0.6));
  const b2 = await SR();
  await G.runFrames(page, Math.round(K.RESUME * 60 * 0.4) + 240);
  const b3 = await SR(), again = await (async () => { const x = await SR(); await G.runFrames(page, 60); return (await SR()).angle - x.angle; })();
  /* a touch: pointer events of type touch on the stage */
  const t0 = await SR();
  await page.evaluate(({ x, y }) => { const el = document.querySelector('.garage .stage'), ev = (type, dx) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x + dx, clientY: y })); ev('pointerdown', 0); ev('pointermove', -40); ev('pointermove', -90); ev('pointerup', -90); }, st);
  const t1 = await SR();
  /* the known answer: a drag that starts on the controls */
  await G.runFrames(page, Math.round(K.RESUME * 60) + 240);
  const c0 = await SR(), tabAt = await mid('#screens .tab');
  await page.mouse.move(tabAt[0], tabAt[1]); await page.mouse.down(); await page.mouse.move(tabAt[0] + 120, tabAt[1], { steps: 6 });
  const c1 = await SR(); await page.mouse.up();
  o.drag = { turning, byHand: b1.angle - b0.angle, expected: 120 * K.DRAG, held: b2.angle - b1.angle, resumed: b3.angle - b2.angle, again, touch: t1.angle - t0.angle, touchExpected: -90 * K.DRAG, offStage: { dragging: c1.dragging, moved: c1.angle - c0.angle } };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  G.say(near(turning, K.SPIN, 0.02) && near(o.drag.byHand, o.drag.expected, 0.02) && b1.dragging && near(o.drag.held, 0, 0.03) && o.drag.resumed > 0.5 && near(again, K.SPIN, 0.03) && near(o.drag.touch, o.drag.touchExpected, 0.001),
    tag + ' the drag: left alone it turns ' + turning.toFixed(2) + ' radians a second; 120 px by pointer turns it ' + o.drag.byHand.toFixed(2) + ' (' + o.drag.expected.toFixed(2) + ' expected) and it does not turn itself meanwhile; let go, it holds (' + o.drag.held.toFixed(2) + ' in ' + (K.RESUME * 0.6).toFixed(1) + ' s) and then turns itself again (' + again.toFixed(2) + ' a second); 90 px by touch turns it ' + o.drag.touch.toFixed(2));
  G.say(!c1.dragging && near(c1.angle - c0.angle, 0, 0.001), tag + ' known answer: a drag that starts on the controls does not turn the car: ' + (!c1.dragging ? 'CAUGHT' : 'MISSED'));

  /* ---- the way in from a lost race ---- */
  const tip = await page.evaluate(() => { const L = window.__loop; L.action('garage'); L.action('garage-tab', 'smoke'); L.action('title'); L.action('garage'); return { tab: L.garage().tab, on: document.querySelector('#screens .tab.on').textContent, cards: document.querySelectorAll('#screens .garage .cards .card').length }; });
  o.tip = tip;
  G.say(tip.tab === 'cars' && tip.on === 'CARS' && tip.cards === 5, tag + ' GARAGE (the lost race\'s way in) opens on the cars section, whatever section was left open: ' + tip.on + ', ' + tip.cards + ' cars');
  if (pg.errors.length) G.say(false, tag + ' page errors: ' + pg.errors.slice(0, 2).join(' | '));
  await page.close();
}
fs.writeFileSync(path.join(G.dir, 'controls.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(G.failed() ? G.failed() + ' failed' : 'all passed');
process.exit(G.failed() ? 1 : 0);
