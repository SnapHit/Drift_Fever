/* PLAYGROUND MEASURE 4: PAYING, through the game. The scripted hands
   drive, the game's judge counts, the game's save pays; the probe only
   reads the coins before and after.

   1. A level pays its coins once: a turn and a bit round the donut
      pillar pays bronze (and nothing else: the park pays no coins a
      point, no stars, nothing for the drive); the level is celebrated
      (the readout, the notice, the list's tally; the fireworks are
      there to let off).
   2. Again, after leaving for the title and coming back: nothing, and
      no celebration.
   3. Again after a reload of the page: nothing.
   4. A higher level first pays the lower ones too, once: a pass through
      the gate at silver speed with bronze never won pays bronze and
      silver together; a bronze pass after it pays nothing.
   Known answers, one for each:
     1 to 3. the same reload with the storage cleared pays again, so a
        payment is seen when there is one and the reload's nothing is
        the save's doing;
     4. bronze won first, then silver: silver pays its own coins only,
        so the harness tells the two cases apart.

   node game/test/park/paying.js   writes review/park/paying.json */
import * as P from './lib.js';
import { LOOP } from '../../src/tune.js';

const C = LOOP.PARK.COINS;
const env = await P.start(), out = {};
const pg = await P.parkPage(env, P.LANDSCAPE, '');
const page = pg.page;
const donut = () => P.drive(page, { line: 'donut', args: [1.5], seconds: 40, noRec: true, each: `const p = document.querySelector('#park'); if (p && !p.hidden && p.classList.contains('won')) return { text: p.innerText.replace(/\\s+/g, ' ').trim(), notice: [...document.querySelectorAll('#callouts .callout.mission')].map(d => d.textContent).join('|'), tally: document.querySelector('#plistN').textContent };` });
const brief = d => ({ coins: d.coins, events: d.events, won: d.won, celebrated: d.frames.length, shown: d.frames[0] || null, best: { donut: d.best.donut, gate: +d.best.gate.toFixed(1) } });
const paidFor = (before, after) => { let n = 0; for (const id of Object.keys(after)) for (let lv = (before[id] || 0) + 1; lv <= after[id]; lv++) n += C[id][lv - 1]; return n; };
const reload = async clear => { if (clear) await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }); await page.evaluate(() => { const S = window.__loop.save; S.setOnboarded(); window.__loop.action('title'); }); await P.loadHands(page); };

/* 1. once */
await P.ownCar(page, 'starter', null);
const a = await donut();
out.first = brief(a);
const sum1 = paidFor(a.wonBefore, a.won);
P.say(a.best.donut >= 1 && a.best.donut < LOOP.PARK.TARGETS.donut[1] && a.won.donut === 1 && a.coins === sum1 && a.coins >= C.donut[0], 'a turn and a half round the donut pillar: bronze won (' + a.best.donut + ' full turns), and the save is ' + a.coins + ' coins up: exactly the levels newly won in the drive (' + JSON.stringify(a.won) + ' pay ' + sum1 + '), the donut\'s bronze ' + C.donut[0] + ' of it, and nothing else for the drive');
const said = a.frames.find(f => /DONUTS BRONZE/.test(f.notice)), shown = a.frames.find(f => /^DONUTS .*BRONZE \+100/.test(f.text));
P.say(!!said && !!shown && a.frames[a.frames.length - 1].tally !== '0/24', 'and it is celebrated: the readout says "' + (shown ? shown.text : '') + '", the notice "' + (said ? said.notice.split('|').find(t => /DONUTS/.test(t)) : '') + '", the list button\'s tally goes to ' + (a.frames.length ? a.frames[a.frames.length - 1].tally : '?'));
const fw = await page.evaluate(() => { const d = window.__feel.scene.dressing(); return !!(d && d.fireworks && d.group.children.some(m => m.name === 'fireworks')); });
P.say(fw, 'the fireworks the game already has are built for the park (a ground with no road), to let off when a level is won');

/* 2. left for the title and back */
await page.evaluate(() => { document.querySelector('#exit').click(); });
const onTitle = await page.evaluate(() => ({ state: window.__loop.app.state, line: document.querySelector('.parkbtn small').textContent }));
const b = await donut();
out.afterTitle = Object.assign(brief(b), { title: onTitle });
P.say(onTitle.state === 'title' && b.best.donut >= 1 && b.coins === 0 && b.won.donut === 1 && !b.frames.some(f => /DONUTS/.test(f.notice)), 'left for the title (its button says "' + onTitle.line + '") and came back: the same drive reaches bronze again (' + b.best.donut + ' full turns) and pays nothing (' + b.coins + ' coins), with no notice');

/* 3. after a reload */
const coinsBefore = await page.evaluate(() => window.__loop.save.state.coins);
await reload(false);
const loaded = await page.evaluate(() => ({ coins: window.__loop.save.state.coins, won: window.__loop.save.state.park.won, seen: window.__loop.save.state.park.seen }));
const c = await donut();
out.afterReload = Object.assign(brief(c), { loaded });
P.say(loaded.coins === coinsBefore && loaded.won.donut === 1 && loaded.seen === true && c.best.donut >= 1 && c.coins === 0 && c.won.donut === 1, 'after a reload: the save comes back with ' + loaded.coins + ' coins and the donut\'s bronze won, the same drive reaches bronze again and pays nothing (' + c.coins + ' coins)');
await reload(true);
const k = await donut();
out.knownOnce = brief(k);
P.say(k.won.donut === 1 && k.coins >= C.donut[0] && k.frames.some(f => /DONUTS BRONZE/.test(f.notice)), 'known answer: with the storage cleared, the same reload and the same drive pay again (' + k.coins + ' coins, the donut\'s bronze among them) and celebrate it, so a payment is seen when there is one: ' + (k.coins >= C.donut[0] ? 'CAUGHT' : 'MISSED'));

/* 4. a higher level first */
const gate = long => P.drive(page, { line: 'gate', args: long ? [true, { off: -3, lead: 16, dir: -1 }] : [false, { off: -2, lead: 10, dir: 1 }], seconds: 26, tail: 0.5, noRec: true });
const gatePaid = d => paidFor({ gate: d.wonBefore.gate || 0 }, { gate: d.won.gate || 0 });
const g1 = await gate(true);
out.silverFirst = brief(g1);
const ev = g1.events.filter(e => e.id === 'gate');
P.say(ev.length === 1 && ev[0].level === 2 && (g1.wonBefore.gate || 0) === 0 && g1.won.gate === 2 && g1.coins === paidFor(g1.wonBefore, g1.won) && gatePaid(g1) === C.gate[0] + C.gate[1], 'a higher level first: through the gate at ' + g1.best.gate.toFixed(0) + ' km/h with bronze never won, the judge reports silver in one step and the save pays bronze and silver together (' + C.gate[0] + ' + ' + C.gate[1] + ' of the drive\'s ' + g1.coins + ')');
const g2 = await gate(false);
out.bronzeAfter = brief(g2);
P.say(g2.best.gate >= LOOP.PARK.TARGETS.gate[0] && g2.best.gate < LOOP.PARK.TARGETS.gate[1] && g2.won.gate === 2 && gatePaid(g2) === 0 && g2.coins === paidFor(g2.wonBefore, g2.won), 'and a bronze pass after it (' + g2.best.gate.toFixed(0) + ' km/h) pays nothing for the gate (' + g2.coins + ' coins in the drive)');
await page.evaluate(() => { const S = window.__loop.save; S.reset(); S.setOnboarded(); });
const h1 = await gate(false), h2 = await gate(true);
out.knownOrder = { bronze: brief(h1), silver: brief(h2) };
P.say(gatePaid(h1) === C.gate[0] && gatePaid(h2) === C.gate[1] && gatePaid(g1) === C.gate[0] + C.gate[1], 'known answer: on an emptied save, bronze first pays ' + gatePaid(h1) + ' and silver after it ' + gatePaid(h2) + ', not the ' + gatePaid(g1) + ' that silver first paid, so the harness tells the two apart: ' + (gatePaid(h2) !== gatePaid(g1) ? 'CAUGHT' : 'MISSED'));
out.errors = pg.errors.slice(0, 5);
P.say(pg.errors.length === 0, 'no page errors: ' + pg.errors.length + (pg.errors.length ? ' (' + pg.errors[0] + ')' : ''));
await P.finish(env, 'paying.json', out);
