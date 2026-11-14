/* THE REST OF THE PLAYGROUND BRIEF'S RULES, each with a known answer.

   1. A first visit shows one line on what the park is, once: on the
      first visit and not on the second, nor after a reload.
   2. The list is reached from the park by touch (the HUD's button), by
      keyboard (L or Tab; Escape or the same key back) and by gamepad
      (the top face button; B back), and the park is as it was on the
      way back (the same car in the same place, the chain not reset).
      Known answer: a key that is not bound (K) opens nothing.
   3. Each place's marker dims once its gold is won, and only that
      place's. Known answer: silver does not dim it.
   4. The garage round's cosmetics show in the park as in any run.
      Known answer: with none worn there is no glow.
   5. The CrazyGames adapter sees the park as play, and the list as
      not. Known answer: the title is not play.
   6. Knocked cones stand up again once the car is away, and not while
      it is near. The physics is not touched: this is the host's.
   7. Free drift pays nothing else and keeps nothing else: after a
      drive the save differs from before only in its park field and
      its coins, by exactly the levels won.

   node game/test/park/extras.js   writes review/park/extras.json and a shot */
import path from 'node:path';
import * as P from './lib.js';
import { LOOP } from '../../src/tune.js';

const env = await P.start(), out = {};
const pg = await P.parkPage(env, P.LANDSCAPE, ''), page = pg.page;
const tipShown = () => page.evaluate(() => { const e = document.getElementById('parktip'); return !e.hidden ? e.textContent : null; });

/* 1. the welcome, once */
await page.evaluate(() => { window.__feel.draw = false; window.__loop.action('free'); });
await P.runFrames(page, 5);
const tip1 = await tipShown();
await P.runFrames(page, 60 * 7);
const tipGone = await tipShown();
await page.evaluate(() => { document.getElementById('exit').click(); window.__loop.action('free'); });
await P.runFrames(page, 5);
const tip2 = await tipShown();
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await P.loadHands(page);
await page.evaluate(() => { window.__feel.draw = false; window.__loop.action('free'); });
await P.runFrames(page, 5);
const tip3 = await tipShown();
out.welcome = { first: tip1, after7s: tipGone, second: tip2, afterReload: tip3 };
P.say(!!tip1 && /stunt park/i.test(tip1) && tipGone === null && tip2 === null && tip3 === null, 'a first visit shows one line on what the park is ("' + tip1 + '"), gone after 7 s, and not on the second visit nor after a reload');
P.say(!!tip1, 'known answer: the line is there on a first visit, so its absence later is the save\'s doing: ' + (tip1 ? 'CAUGHT' : 'MISSED'));

/* 2. the list from the park by touch, keyboard and gamepad; the park as it was on the way back */
await page.evaluate(() => { window.__feel.inject = { steer: 1, throttle: 1, brake: 0, handbrake: 1 }; });
await P.runFrames(page, 150);
await page.evaluate(() => { window.__feel.inject = { steer: 1, throttle: 1, brake: 0, handbrake: 0 }; });
await P.runFrames(page, 90);
const where = () => page.evaluate(() => { const c = window.__feel.world.car, s = window.__feel.scoring.state; return { state: window.__loop.app.state, x: c.x, z: c.z, chain: s.chain, step: window.__feel.world.step, open: document.querySelector('#screens').classList.contains('on') && !!document.querySelector('.screen.park'), hud: !document.getElementById('hud').classList.contains('hidden') }; });
const same = (a, b) => a.x === b.x && a.z === b.z && a.step === b.step && a.chain === b.chain;
const key = code => page.evaluate(code => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true })), code);
const ways = {};
{
  const a = await where();
  await page.evaluate(() => document.getElementById('plist').click());
  await P.runFrames(page, 30);
  const b = await where();
  await page.evaluate(() => document.querySelector('.park .drive button').click());
  const c = await where();
  ways.touch = { opened: b.state === 'park' && b.open && !b.hud, still: same(a, b), back: c.state === 'free' && !c.open && c.hud && same(a, c), chain: +a.chain.toFixed(1) };
}
for (const [name, code, backCode] of [['L', 'KeyL', 'Escape'], ['Tab', 'Tab', 'Tab']]) {
  const a = await where();
  await key(code); await P.runFrames(page, 10);
  const b = await where();
  await key(backCode);
  const c = await where();
  ways[name] = { opened: b.state === 'park' && b.open, still: same(a, b), back: c.state === 'free' && !c.open && same(a, c) };
}
{ await key('KeyK'); await P.runFrames(page, 2); const b = await where(); ways.known = b.state === 'free' && !b.open; }
{
  /* a gamepad: the top face button opens it, B (through the menus' own pad code) goes back */
  await page.evaluate(() => { window.__pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }; navigator.getGamepads = () => [window.__pad]; });
  await P.runFrames(page, 2);
  const press = async i => { await page.evaluate(i => { window.__pad.buttons[i] = { pressed: true, value: 1 }; }, i); await P.runFrames(page, 2); await page.evaluate(i => { window.__pad.buttons[i] = { pressed: false, value: 0 }; }, i); await P.runFrames(page, 3); };
  await press(3);
  const b = await where();
  const ring = await page.evaluate(() => document.querySelectorAll('#screens .padfocus').length);
  await press(1);
  const c = await where();
  ways.pad = { opened: b.state === 'park' && b.open, ring, back: c.state === 'free' && !c.open };
  await page.evaluate(() => { navigator.getGamepads = () => []; window.dispatchEvent(new PointerEvent('pointerdown')); });
}
out.ways = ways;
P.say(ways.touch.opened && ways.touch.still && ways.touch.back && ways.touch.chain > 0, 'the list from the park by touch: the HUD\'s button opens it, the park waits (the car and an open chain of ' + ways.touch.chain + ' exactly as they were), BACK TO THE PARK returns to it');
P.say(ways.L.opened && ways.L.back && ways.Tab.opened && ways.Tab.back, 'by keyboard: L opens it and Escape goes back; Tab opens it and Tab goes back; the park as it was each time');
P.say(ways.known, 'known answer: a key that is not bound (K) opens nothing: ' + (ways.known ? 'CAUGHT' : 'MISSED'));
P.say(ways.pad.opened && ways.pad.ring === 1 && ways.pad.back, 'by gamepad: the top face button opens it from the park with the focus ring up, and B goes back to the park');

/* 3. a place's marker dims once its gold is won */
const bands = () => page.evaluate(() => Object.fromEntries(window.__feel.scene.park().bandsState().map(b => [b.place, +b.gain.toFixed(2)])));
const b0 = await bands();
await page.evaluate(() => { window.__loop.save.parkWin('donut', 2); window.__feel.scene.park().setWon(window.__loop.save.state.park.won); });
const b1 = await bands();
await page.evaluate(() => { window.__loop.save.parkWin('donut', 3); window.__loop.action('free'); });
await P.runFrames(page, 3);
const b2 = await bands();
out.bands = { fresh: b0, silver: b1, gold: b2 };
P.say(b2.donut < b0.donut * 0.5 && Object.keys(b2).filter(k => k !== 'donut').every(k => b2[k] === b0[k]), 'the donut pillar\'s band and rings are dimmed once its gold is won (brightness ' + b0.donut + ' to ' + b2.donut + '), on coming back into the park too, and no other place\'s is: ' + JSON.stringify(b2));
P.say(b1.donut === b0.donut, 'known answer: silver does not dim it (' + b1.donut + '): ' + (b1.donut === b0.donut ? 'CAUGHT' : 'MISSED'));
await P.runFrames(page, 20);
await P.snap(page, path.join(P.shots, 'gold-dimmed.png'));

/* 4. the cosmetics show in the park */
const worn = () => page.evaluate(() => { const sc = window.__feel.scene, m = sc.carModel(); return { looks: sc.looks.car, glow: !!(m.underglow && m.underglow.visible), wheels: m.wheelsId }; });
const plain = await worn();
await P.wear(page, { wheels: 'blades', glow: 'aqua', smoke: 'rose' });
await page.evaluate(() => { window.__loop.action('free'); });
await P.runFrames(page, 3);
const dressed = await worn();
out.cosmetics = { plain, dressed };
P.say(dressed.wheels === 'blades' && dressed.glow && dressed.looks.smoke === 'rose' && dressed.looks.glow === 'aqua', 'the garage\'s cosmetics show in the park: wheels ' + dressed.wheels + ', the glow lit (' + dressed.looks.glow + '), smoke ' + dressed.looks.smoke);
P.say(!plain.glow && plain.wheels !== 'blades', 'known answer: with none worn there is no glow and the standard wheels: ' + (!plain.glow ? 'CAUGHT' : 'MISSED'));
await P.wear(page, null);

/* 5. the adapter sees the park as play */
const sdk = await page.evaluate(() => {
  const F = window.__feel, Lp = window.__loop, calls = [], orig = F.sdk.playing.bind(F.sdk);
  F.sdk.playing = v => { calls.push(!!v); orig(v); };
  const frame = () => { window.__clock += 1000 / 60; F.frame(window.__clock); return calls[calls.length - 1]; };
  Lp.action('title'); const title = frame();
  Lp.action('free'); const park = frame();
  Lp.parkList.open(); const list = frame();
  Lp.parkList.close(); const back = frame();
  F.sdk.playing = orig;
  return { title, park, list, back };
});
out.sdk = sdk;
P.say(sdk.park === true && sdk.back === true && sdk.list === false, 'the CrazyGames adapter is told the park is play (' + sdk.park + '), its list is not (' + sdk.list + '), and play again on the way back (' + sdk.back + ')');
P.say(sdk.title === false, 'known answer: the title is not play: ' + (sdk.title === false ? 'CAUGHT' : 'MISSED'));

/* 6. knocked cones stand up again once the car is away */
const cones = await page.evaluate(() => {
  const F = window.__feel, w = F.world, k = w.cones[3], c = w.car;
  const frames = n => { for (let i = 0; i < n; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); } };
  F.inject = { steer: 0, throttle: 0, brake: 0, handbrake: 1 };
  c.x = k.x0 + 6; c.z = k.z0 + 6; c.wvx = 0; c.wvz = 0;
  k.knocked = 1; k.x = k.x0 + 2; k.z = k.z0 + 1; k.vx = 0; k.vz = 0; k.tilt = 1;
  frames(30);
  const near = k.knocked;
  c.x = k.x0 + 80; c.z = k.z0 + 60; frames(3);
  const away = k.knocked, home = k.x === k.x0 && k.z === k.z0;
  k.knocked = 1; k.x = k.x0 + 1; k.vx = 2; frames(1);
  const rolling = k.knocked;
  F.inject = null;
  return { near, away, home, rolling };
});
out.cones = cones;
P.say(cones.near === 1 && cones.away === 0 && cones.home && cones.rolling === 1, 'a knocked cone stays down while the car is near (8 m), stands up at its own spot once the car is away (100 m), and one still rolling is left alone');

/* 7. free drift pays and keeps nothing else */
await page.evaluate(() => { const S = window.__loop.save; S.reset(); S.setOnboarded(); S.setParkSeen(); });
const saveState = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__loop.save.state)));
const before = await saveState();
const d = await P.drive(page, { line: 'open', args: [2], seconds: 40, tail: 3, noRec: true });
const after = await saveState();
const strip = s => { const c = JSON.parse(JSON.stringify(s)); delete c.park; delete c.coins; return JSON.stringify(c); };
let due = 0; for (const id of Object.keys(after.park.won)) for (let lv = 1; lv <= after.park.won[id]; lv++) due += LOOP.PARK.COINS[id][lv - 1];
out.nothingElse = { chain: d.best.chain, won: after.park.won, coins: after.coins - before.coins, due, same: strip(before) === strip(after) };
P.say(strip(before) === strip(after) && after.coins - before.coins === due && due > 0 && d.best.chain > 400, 'free drift pays and keeps nothing else: after two turns of a slide that banked ' + Math.round(d.best.chain) + ' points, the save differs from before only in its park field (' + JSON.stringify(after.park.won) + ') and its coins, up ' + (after.coins - before.coins) + ', exactly what those levels pay (' + due + '): no coins a point, no stars, no missions, no ghost');
out.errors = pg.errors.slice(0, 5);
P.say(pg.errors.length === 0, 'no page errors: ' + pg.errors.length + (pg.errors.length ? ' (' + pg.errors[0] + ')' : ''));
await P.finish(env, 'extras.json', out);
