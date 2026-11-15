/* THE GAME OPENS ON THE TITLE, 15 November 2026 (the author's decision
   after a friend's play: one track, one rival, then gone, with the rest
   never seen). A new player sees every mode at once; the main button is
   one click from career track 1; the prompts come on the first run of
   whatever is picked and never again once the three are done.
   Known answers: a save with a career run has no start here button, its
   main button is the daily, and its runs carry no prompts.
   node game/test/start/check.js   writes review/start/check.json and shots */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../ladder/lib.js';
const dir = path.join(R.root, 'review', 'start'); fs.mkdirSync(dir, { recursive: true });
const env = await R.start(), out = {};
let fails = 0;
const ok = (name, pass, detail) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + name + ': ' + detail); };

const fresh = page => page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const L = window.__loop; L.save.reset(); L.action('title'); });
const title = page => page.evaluate(() => {
  const W = innerWidth, H = innerHeight;
  const bs = [...document.querySelectorAll('.menu button, .opts button')].filter(b => b.offsetParent !== null).map(b => { const r = b.getBoundingClientRect(); return { action: b.dataset.action, primary: b.classList.contains('primary'), text: b.innerText.replace(/\s+/g, ' ').trim(), h: Math.round(r.height), inside: r.left >= 0 && r.top >= 0 && r.right <= W + 0.5 && r.bottom <= H + 0.5 }; });
  return { state: window.__loop.app.state, onboard: window.__loop.onboard.active, buttons: bs };
});

for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['phone-wide', { width: 844, height: 390 }], ['desktop', { width: 1280, height: 720 }], ['frame', { width: 800, height: 450 }]]) {
  /* the boot itself, storage empty, nothing asked of the page */
  const pg = await R.openPage(env, vp, ''), page = pg.page;
  await R.runFrames(page, 5);
  const t = out[name] = await title(page);
  const menu = t.buttons.filter(b => ['first', 'daily', 'career', 'rivals', 'park', 'garage', 'lab'].includes(b.action));
  ok(name + ': an empty save boots on the title, no run started', t.state !== 'countdown' && t.state !== 'drive' && !t.onboard && menu.length >= 6, 'state ' + t.state + ', ' + menu.map(b => b.action).join(' '));
  ok(name + ': the main button is start here, first in the list, and the only main one', menu[0].action === 'first' && menu[0].primary && menu.filter(b => b.primary).length === 1 && !menu.some(b => b.action === 'career'), menu[0].text);
  ok(name + ': every title button is inside the frame and at least 36 px high', t.buttons.every(b => b.inside && b.h >= 36), t.buttons.filter(b => !b.inside || b.h < 36).map(b => b.action + ' ' + b.h + (b.inside ? '' : ' outside')).join(', ') || 'all ' + t.buttons.length);
  /* the menu is balanced: every row of it is filled edge to edge (the author's eye, 15 November) */
  const rows = await page.evaluate(() => { const m = document.querySelector('.title .menu').getBoundingClientRect(), by = {};
    for (const b of document.querySelectorAll('.title .menu button')) { const r = b.getBoundingClientRect(), k = Math.round(r.top); (by[k] = by[k] || []).push([r.left - m.left, m.right - r.right]); }
    return Object.values(by).map(a => ({ n: a.length, left: Math.round(Math.min(...a.map(x => x[0]))), right: Math.round(Math.min(...a.map(x => x[1]))) })); });
  ok(name + ': every row of the menu runs from edge to edge', rows.every(r => r.left <= 1 && r.right <= 1), rows.map(r => r.n).join(' '));
  await page.screenshot({ path: path.join(dir, 'title-' + name + '.png') });

  /* one click to gameplay, with the prompts */
  await page.click('[data-action="first"]');
  const run = await page.evaluate(() => { const L = window.__loop; return { state: L.app.state, mode: L.app.spec.mode, index: L.app.spec.index, onboard: L.onboard.active }; });
  ok(name + ': one click on it is the countdown of career track 1 with the prompts', run.state === 'countdown' && run.mode === 'career' && run.index === 0 && run.onboard, JSON.stringify(run));
  if (name === 'desktop') {
    /* the three prompts done by a sliding driver: remembered, and the next run has none */
    await page.evaluate(() => { window.__feel.draw = false; window.__loop.skipCountdown(); window.__feel.setDriver({ player: 'slide' }); });
    let taught = false;
    for (let i = 0; i < 40 && !taught; i++) { await R.runFrames(page, 120); taught = await page.evaluate(() => window.__loop.onboard.taught); }
    const after = await page.evaluate(() => { const L = window.__loop, shown = L.onboard.state.shown.slice(), saved = L.save.state.onboarded; L.action('title'); L.startRun(L.careerSpec(0)); const again = L.onboard.active; L.action('title'); return { shown, saved, again, first: !!document.querySelector('[data-action="first"]') }; });
    out.taught = after;
    ok('the three prompts, once done, are remembered and do not come again', taught && after.saved && !after.again, 'shown ' + after.shown.join(' ') + ', saved ' + after.saved + ', prompts on the next run ' + after.again);
    ok('known answer: start here stays until a career run is finished', after.first, 'no career run finished yet, button ' + after.first);

    /* a new player who picks something else first is taught there */
    for (const [what, go] of [['the stunt park', "L.action('free')"], ['the daily', "L.action('daily')"]]) {
      await fresh(page);
      const o = await page.evaluate(go => { const L = window.__loop; eval(go); const r = { state: L.app.state, onboard: L.onboard.active }; return r; }, go);
      ok('a new player who picks ' + what + ' first gets the prompts there', o.onboard, JSON.stringify(o));
      if (what === 'the stunt park') {
        await page.evaluate(() => { window.__feel.draw = true; }); await R.runFrames(page, 90);
        await page.screenshot({ path: path.join(dir, 'park-first.png') });
        const lap = await page.evaluate(() => { const a = document.querySelector('#skip').getBoundingClientRect(), b = document.querySelector('#plist').getBoundingClientRect(); return { skip: [a.top, a.bottom], list: [b.top, b.bottom], clear: a.top >= b.bottom || b.top >= a.bottom, inside: a.bottom <= innerHeight }; });
        ok('in the park SKIP does not sit on the list button', lap.clear && lap.inside, JSON.stringify(lap));
        /* by keys, as a player would: steer, then DRIFT with steering, then DRIFT alone */
        await page.evaluate(() => { window.__feel.draw = false; });
        const K = page.keyboard;
        await K.down('ArrowLeft'); await R.runFrames(page, 150); await K.up('ArrowLeft'); await R.runFrames(page, 300);
        for (let i = 0; i < 4; i++) { await K.down('ArrowRight'); await K.down('Space'); await R.runFrames(page, 150); await K.up('Space'); await K.up('ArrowRight'); await R.runFrames(page, 60); }
        await R.runFrames(page, 120);
        await K.down('Space'); await R.runFrames(page, 200); await K.up('Space'); await R.runFrames(page, 30);
        const t2 = await page.evaluate(() => window.__loop.onboard.taught);
        const s = await page.evaluate(() => ({ saved: window.__loop.save.state.onboarded, how: window.__loop.onboard.state.how }));
        ok('the park teaches all three and it is remembered', t2 && s.saved, JSON.stringify(s));
      }
      await page.evaluate(() => window.__loop.action('title'));
    }

    /* known answer: a player with a finished career run */
    await fresh(page);
    await page.evaluate(() => { const L = window.__loop; window.__feel.draw = false; L.startRun(L.careerSpec(0)); L.skipCountdown(); });
    await R.runFrames(page, 60); await page.evaluate(() => window.__loop.finishNow()); await R.runFrames(page, 30);
    await page.evaluate(() => window.__loop.action('title'));
    const old = await title(page), again = await page.evaluate(() => { const L = window.__loop; L.startRun(L.careerSpec(0)); const a = L.onboard.active; L.action('title'); return a; });
    out.old = old;
    const m2 = old.buttons.filter(b => b.primary);
    ok('known answer: after a career run there is no start here, the daily is the main button, and runs carry no prompts', !old.buttons.some(b => b.action === 'first') && m2.length === 1 && m2[0].action === 'daily' && old.buttons.some(b => b.action === 'career') && !again, m2.map(b => b.action).join() + ', prompts ' + again);
  }
  await pg.context.close().catch(() => {});
}
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(fails ? fails + ' failed' : 'all passed');
