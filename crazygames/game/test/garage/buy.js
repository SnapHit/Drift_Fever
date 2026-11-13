/* GARAGE MEASURE 4: BUYING. By real presses of the screen's own
   buttons, at 390x844 and 1280x720, from an empty save with coins, for
   a wheel, a glow, a smoke colour and a paint:
     a. a press on an item not owned is a preview: the showroom shows
        it, the save is untouched and no coin moves;
     b. the buy button takes the price once: coins fall by exactly the
        price in LOOP, the item is owned and worn;
     c. a second press charges nothing: the item again, and the buy
        action sent again by hand, leave the coins where they were;
     d. out of reach: one coin short, the buy button is disabled and
        says how many more are needed, the item's tile says so too, and
        the buy action sent by hand is refused;
     e. a preview does not survive leaving the garage (the save and the
        showroom on the way back in wear what is owned) and does not
        reach a race (the car on the track wears what the save says);
     f. a car not owned can be dressed to look at and nothing can be
        bought for it.
   Known answers, one for each of b to e: the same checks run against a
   save made to charge twice, to charge again for what is owned, to sell
   with too few coins, and a host made to write the preview into the
   save. Each must be caught.

   node game/test/garage/buy.js   writes review/garage/buy.json and shots */
import path from 'node:path';
import fs from 'node:fs';
import * as G from './lib.js';

const env = await G.start(), out = {};
/* the checks, in the page: returns what failed, by letter */
const TRIAL = `(async () => {
  const L = window.__loop, S = L.save, bad = [], PR = L.LOOP.COSMETICS, F = window.__feel;
  const press = sel => { const b = document.querySelector(sel); if (!b) return false; b.click(); return true; };
  const tile = (kind, id) => '#screens .garage button[data-action="' + (kind === 'paint' ? 'paint' : 'look') + '"][data-arg="' + (kind === 'paint' ? id : kind + ':' + id) + '"]';
  const buyBtn = () => document.querySelector('#screens .garage .act button.primary');
  const car = () => S.state.cars[S.state.car];
  const snapSave = () => JSON.stringify(S.state);
  const ITEMS = [['wheels', 'fours', PR.WHEELS.fours], ['glow', 'violet', PR.GLOW.violet], ['smoke', 'tangerine', PR.SMOKE.tangerine], ['paint', 'magenta', L.LOOP.PAINT_PRICE]];
  for (const [kind, id, price] of ITEMS) {
    const worn = () => kind === 'paint' ? car().paint : car()[kind], has = () => kind === 'paint' ? car().paint === id : car().own[kind].includes(id);
    const shown = () => kind === 'paint' ? L.garage().preview.paint : L.showroom.state.look[kind];
    L.action('garage'); S.state.coins = 5000; L.action('garage-tab', kind);
    /* a. the preview */
    const before = snapSave();
    if (!press(tile(kind, id))) { bad.push('a ' + kind + ': no tile'); continue; }
    if (snapSave() !== before) bad.push('a ' + kind + ': the preview changed the save');
    if (shown() !== id) bad.push('a ' + kind + ': the showroom does not show the preview (' + shown() + ')');
    /* b. the buy */
    const b = buyBtn();
    if (!b || b.disabled) { bad.push('b ' + kind + ': no buy button'); continue; }
    b.click();
    if (S.state.coins !== 5000 - price) bad.push('b ' + kind + ': coins fell by ' + (5000 - S.state.coins) + ', the price is ' + price);
    if (!has() || worn() !== id) bad.push('b ' + kind + ': not owned and worn after buying');
    /* c. again */
    const after = S.state.coins;
    press(tile(kind, id)); if (buyBtn() && /buy|paint/i.test(buyBtn().dataset.action)) buyBtn().click();
    L.action(kind === 'paint' ? 'buy-paint' : 'buy-look', kind === 'paint' ? id : kind + ':' + id);
    if (S.state.coins !== after) bad.push('c ' + kind + ': a second press took ' + (after - S.state.coins) + ' more');
  }
  /* d. out of reach: another item of each kind, one coin short */
  for (const [kind, id, price] of [['wheels', 'blades', PR.WHEELS.blades], ['glow', 'aqua', PR.GLOW.aqua], ['smoke', 'lime', PR.SMOKE.lime], ['paint', 'lime', L.LOOP.PAINT_PRICE]]) {
    L.action('garage'); S.state.coins = price - 1; L.action('garage-tab', kind);
    press(tile(kind, id));
    const b = buyBtn(), t = document.querySelector(tile(kind, id));
    if (!b || !b.disabled) bad.push('d ' + kind + ': the buy button is not disabled one coin short');
    if (!b || !/1 more coin needed/.test(b.textContent)) bad.push('d ' + kind + ': the button does not say how many more (' + (b ? b.textContent.trim() : 'none') + ')');
    if (kind !== 'paint' && !/1 more/.test(t.textContent)) bad.push('d ' + kind + ': the tile does not say how many more (' + t.textContent.trim() + ')');
    if (b) b.click();
    L.action(kind === 'paint' ? 'buy-paint' : 'buy-look', kind === 'paint' ? id : kind + ':' + id);
    const got = kind === 'paint' ? car().paint === id : car().own[kind].includes(id);
    if (got || S.state.coins !== price - 1) bad.push('d ' + kind + ': bought out of reach (coins ' + S.state.coins + ')');
  }
  /* e. a preview does not leave the garage or reach a race */
  L.action('garage'); S.state.coins = 0;
  const wornNow = JSON.stringify({ w: car().wheels, g: car().glow, s: car().smoke, p: car().paint });
  L.action('garage-tab', 'wheels'); press(tile('wheels', 'discs')); L.action('garage-tab', 'glow'); press(tile('glow', 'lime')); L.action('garage-tab', 'smoke'); press(tile('smoke', 'rose')); L.action('garage-tab', 'paint'); press(tile('paint', 'white'));
  if (L.showroom.state.look.wheels !== 'discs' || L.showroom.state.look.glow !== 'lime' || L.showroom.state.look.smoke !== 'rose') bad.push('e: the previews do not hold across sections');
  press('#screens .garage button.back');
  if (JSON.stringify({ w: car().wheels, g: car().glow, s: car().smoke, p: car().paint }) !== wornNow) bad.push('e: a preview was saved on leaving the garage');
  if (Object.keys(L.garage().preview).length) bad.push('e: the preview survived leaving the garage');
  const onTitle = F.scene.looks.car;
  if (onTitle.wheels !== car().wheels || onTitle.glow !== car().glow || onTitle.smoke !== car().smoke) bad.push('e: the title\\'s car wears a preview');
  L.action('garage');
  if (L.showroom.state.look.wheels !== car().wheels || L.showroom.state.look.glow !== car().glow || L.showroom.state.look.smoke !== car().smoke) bad.push('e: the showroom shows the old preview on the way back in');
  L.action('garage-tab', 'wheels'); press(tile('wheels', 'discs')); L.action('garage-tab', 'paint'); press(tile('paint', 'white'));
  F.draw = false; L.startRun(L.careerSpec(0));
  const raced = F.scene.looks.car, model = F.scene.carModel();
  if (raced.wheels !== car().wheels || raced.glow !== car().glow || raced.smoke !== car().smoke || (model.wheelsId || 'standard') !== car().wheels) bad.push('e: a preview reached the race (' + JSON.stringify(raced) + ')');
  L.action('title');
  /* f. a car not owned */
  L.action('garage'); S.state.coins = 99999; L.action('pick-car', 'tourer'); L.action('garage-tab', 'wheels');
  const c0 = S.state.coins; press(tile('wheels', 'daggers'));
  if (L.showroom.state.look.wheels !== 'daggers') bad.push('f: a car not owned cannot be dressed to look at');
  if (buyBtn()) bad.push('f: a buy button for a car not owned');
  L.action('buy-look', 'wheels:daggers');
  if (S.state.coins !== c0 || S.state.cars.tourer) bad.push('f: bought for a car not owned');
  L.action('title');
  return bad;
})()`;
const RESET = `(() => { const S = window.__loop.save; S.reset(); S.setOnboarded(); window.__loop.action('title'); })()`;
/* the save and the host made wrong, for the known answers */
const WRONG = {
  'b: charges twice': `(() => { const S = window.__loop.save, real = S.buyCosmetic; S.buyCosmetic = function (id, kind, item) { const p = S.state.coins, ok = real.call(S, id, kind, item); if (ok) S.addCoins(S.state.coins - p); return ok; }; return () => { S.buyCosmetic = real; }; })()`,
  'c: charges again for what is owned': `(() => { const S = window.__loop.save, real = S.buyCosmetic, PR = window.__loop.LOOP.COSMETICS; S.buyCosmetic = function (id, kind, item) { const ok = real.call(S, id, kind, item); if (!ok && S.state.cars[id] && S.state.cars[id].own[kind].includes(item)) S.addCoins(-(PR[kind.toUpperCase()][item] || 0)); return ok; }; return () => { S.buyCosmetic = real; }; })()`,
  'd: sells with too few coins': `(() => { const S = window.__loop.save, real = S.buyCosmetic; S.buyCosmetic = function (id, kind, item) { const c = S.state.cars[id]; if (c && !c.own[kind].includes(item) && S.state.coins < 5000) { c.own[kind].push(item); c[kind] = item; return true; } return real.call(S, id, kind, item); }; return () => { S.buyCosmetic = real; }; })()`,
  'e: the preview written into the save': `(() => { const L = window.__loop, sr = L.showroom, real = sr.show; sr.show = function (id, paint, look) { const c = L.save.state.cars[id]; if (c && look) { c.wheels = look.wheels; c.glow = look.glow; c.smoke = look.smoke; } return real.call(sr, id, paint, look); }; return () => { sr.show = real; }; })()`,
};
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
  const tag = vp.width + 'x' + vp.height, pg = await G.emptyPage(env, vp, ''), page = pg.page;
  const bad = await page.evaluate(TRIAL);
  out[tag] = { bad, known: {} };
  G.say(bad.length === 0, tag + ': a press previews and changes nothing; buying takes the price once and the item is owned and worn; a second press charges nothing; one coin short it cannot be bought and says 1 more is needed; a preview does not leave the garage or reach a race; nothing is sold for a car not owned' + (bad.length ? ' FAILED: ' + bad.join(' | ') : ''));
  /* the buy button on show, and out of reach, for the eye */
  await page.evaluate(RESET);
  await page.evaluate(() => { const L = window.__loop; L.action('garage'); L.save.state.coins = 700; L.action('garage-tab', 'wheels'); L.action('look', 'wheels:blades'); const s = L.showroom.state; s.angle = 4.1; s.dragging = true; });
  await G.runFrames(page, 3); await G.snap(page, path.join(G.shots, 'buy-' + tag + '-out-of-reach.png'));
  await page.evaluate(() => { const L = window.__loop; L.action('look', 'wheels:daggers'); L.showroom.state.dragging = true; });
  await G.runFrames(page, 3); await G.snap(page, path.join(G.shots, 'buy-' + tag + '-preview.png'));
  await page.evaluate(() => { document.querySelector('#screens .garage .act button.primary').click(); window.__loop.showroom.state.dragging = true; });
  await G.runFrames(page, 3); await G.snap(page, path.join(G.shots, 'buy-' + tag + '-bought.png'));
  for (const name of Object.keys(WRONG)) {
    await page.evaluate(RESET);
    const letter = name[0];
    const caught = await page.evaluate(`(async () => { const undo = ${WRONG[name]}; const bad = await ${TRIAL}; undo(); return bad; })()`);
    const hit = caught.filter(b => b[0] === letter);
    out[tag].known[name] = caught;
    G.say(hit.length > 0, tag + ' known answer, ' + name.slice(3) + ': ' + (hit.length ? 'CAUGHT (' + hit[0] + ')' : 'MISSED'));
  }
  if (pg.errors.length) G.say(false, tag + ' page errors: ' + pg.errors.slice(0, 2).join(' | '));
  await page.close();
}
fs.writeFileSync(path.join(G.dir, 'buy.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(G.failed() ? G.failed() + ' failed' : 'all passed');
process.exit(G.failed() ? 1 : 0);
