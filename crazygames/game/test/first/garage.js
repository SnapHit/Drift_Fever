/* MEASURE 4, THE GARAGE WITHIN THREE MINUTES (briefs/FIRST-MINUTE.md
   priority 2). From an empty save on a phone (390x844, touch), by real
   presses: the title's start here, the first run (a stranger's thumbs,
   thumbs.js, through the touch buttons), the results, the results' way
   to the garage, and the garage with something the coins buy on show:
   the item on the car and its BUY button live. Inside 180 s of game
   time, counted at 60 frames a second from the title, with a person's
   pauses: READ_TITLE seconds on the title and READ_RESULTS on the
   results before each press.
   Known answers: the same path on main (whose results have no way to
   the garage: MENU, then GARAGE, and what is on show there), reported;
   and this branch with the results' line taken off the page fails.

   node game/test/first/garage.js   writes review/first/garage.json */
import path from 'node:path';
import * as F from './lib.js';

const READ_TITLE = 3, READ_RESULTS = 3, LIMIT = 180, SEED = 1;   // s a person reads each screen; the brief's limit; the stranger

const frames = (page, n) => page.evaluate(n => { const F = window.__feel; for (let i = 0; i < n; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); } }, n);
const tap = async (page, sel) => {
  const q = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, sel);
  if (!q) return false;
  await page.touchscreen.tap(q.x, q.y);
  return true;
};
/* what the garage shows: its section, the item on the car, the main button and whether the coins reach it */
const GARAGE = () => {
  const L = window.__loop, A = L.app, act = document.querySelector('.garage .act .big');
  return { state: A.state, tab: A.tab, preview: Object.assign({}, A.preview), coins: L.save.state.coins, button: act ? { text: act.innerText.replace(/\s+/g, ' ').trim(), enabled: !act.disabled, action: act.dataset.action } : null };
};

async function path1(name, query, opts) {
  const S = await F.side(name), env = await S.R.start(), o = opts || {};
  const log = { steps: [] };
  try {
    const pg = await F.freshPage(env, S.R, F.PHONE, query, true), page = pg.page;
    await page.evaluate(() => { window.__clock = 1000; window.__feel.draw = false; });
    let t = 0;
    const step = (what, extra) => { log.steps.push({ what, at: +t.toFixed(1), ...(extra || {}) }); };
    step('title');
    await frames(page, READ_TITLE * 60); t += READ_TITLE;
    if (!(await tap(page, '#screens.on [data-action="first"]'))) throw new Error('no start here');
    step('start here pressed', { state: await page.evaluate(() => window.__loop.app.state) });
    const r = await page.evaluate(seed => window.__first.run(seed, { started: true, keepClock: true }), SEED);
    if (r.error) throw new Error(r.error);
    t += r.frames / 60;
    step('results', { score: r.results.score, stars: r.results.stars, coins: r.results.coins, saved: await page.evaluate(() => window.__loop.save.state.coins) });
    if (o.remove) await page.evaluate(() => { const b = document.querySelector('.results .shopgo'); if (b) b.remove(); });
    await frames(page, READ_RESULTS * 60); t += READ_RESULTS;
    const line = await page.evaluate(() => { const b = document.querySelector('.results .shopgo'); return b ? b.innerText.replace(/\s+/g, ' ').trim() : null; });
    if (line) {
      await tap(page, '.results .shopgo'); await frames(page, 2); t += 2 / 60;
      step('the results\' garage line pressed', { line });
    } else {
      /* main's way: MENU, then GARAGE on the title */
      await tap(page, '.results [data-action="title"]'); await frames(page, 30); t += 0.5;
      await tap(page, '#screens.on [data-action="garage"]'); await frames(page, 2); t += 2 / 60;
      step('MENU then GARAGE pressed (no line on the results)');
    }
    const g = await page.evaluate(GARAGE);
    step('garage', g);
    log.garage = g; log.seconds = +t.toFixed(1); log.run = { score: r.results.score, stars: r.results.stars, coins: r.results.coins };
    /* something affordable on show: an item previewed on the car whose BUY button the coins reach */
    log.onShow = g.state === 'garage' && Object.keys(g.preview).length > 0 && !!g.button && g.button.enabled && /^(buy-look|buy-paint)$/.test(g.button.action || '');
    log.errors = pg.errors.slice(0, 5);
    await pg.close();
  } finally { await env.close(); }
  return log;
}

const now = await path1('branch', 'first=2');
F.say(now.onShow && now.seconds <= LIMIT, 'with ?first=2, by real presses from an empty save: title, the first run, the results, the garage with ' + (now.garage.button ? '"' + now.garage.button.text + '"' : 'nothing') + ' on show (' + JSON.stringify(now.garage.preview) + ', ' + now.garage.coins + ' coins) at ' + now.seconds + ' s of game time (limit ' + LIMIT + '); the run ' + now.run.score + ' points, ' + now.run.stars + ' star(s), ' + now.run.coins + ' coins');
F.say(now.errors.length === 0, 'no page errors (' + now.errors.join(' | ') + ')');
const main = await path1('main', '');
console.log('INFO main, the same path: ' + main.steps.map(s => s.what + ' at ' + s.at + ' s').join(', ') + '; in the garage: ' + (main.garage.button ? '"' + main.garage.button.text + '"' : 'no button') + ', ' + JSON.stringify(main.garage.preview) + ', ' + main.garage.coins + ' coins: something affordable on show ' + main.onShow);
const off = await path1('branch', 'first=2', { remove: true });
F.say(!off.onShow, 'known answer: with the results\' line taken off, the same path ends with ' + (off.onShow ? 'something affordable on show (MISSED)' : 'nothing affordable on show: caught'));
F.writeJson(path.join(F.dir, 'garage.json'), { main: F.mainCommit(), limit: LIMIT, reads: { title: READ_TITLE, results: READ_RESULTS }, branch: now, mainPath: main, lineRemoved: off });
console.log(F.failed() ? F.failed() + ' failed' : 'all passed');
process.exit(F.failed() ? 1 : 0);
