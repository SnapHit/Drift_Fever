/* BEFORE AND AFTER (briefs/COVER-LOOK.md, "When done"): a race as a
   player sees it, the HUD in, in day, dusk and night and on career
   track 1, at 1280x720 and 390x844, without the switch (the game as on
   main, which measure 8 proves pixel for pixel) and with ?look=2. The
   car is the starter in cyan, what a new player drives; the moment is
   the same step of the same race on both sides.

   node game/test/look/shots.js [--extra '&coat=0'] [--only day,night] [--sizes land,port] [--sides before,after] [--tier low|high] [--out dir] [--step N] [--pairs]
   writes review/look/shots/<race>-<size>-<side>.png, and with --pairs
   review/look/pairs/<race>-<size>.jpg: before over after in landscape,
   side by side in portrait, for the report on a phone */
import path from 'node:path';
import * as L from './lib.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const only = arg('--only', 'day,dusk,night,first').split(',');
const sizes = arg('--sizes', 'land,port').split(',');
const sides = arg('--sides', 'before,after').split(',');
const tier = arg('--tier', 'high');
const out = arg('--out', L.lookShots);
const stepOver = args.includes('--step') ? +arg('--step') : null;
/* the step of each race drawn: mid slide with the rival in the picture, found by eye */
export const AT = { day: 896, dusk: 651, night: 270, first: 560 };
const VP = { land: L.LAND, port: L.PORT, phone: L.PHONE_LAND };

const env = await L.start();
for (const race of only) {
  for (const size of sizes) {
    for (const side of sides) {
      const pg = await L.page(env, VP[size], 'tier=' + tier + (side === 'after' ? '&look=2' + arg('--extra', '') : '&look=1'));   // the look is the default since 22 November: the side before it asks for ?look=1; --extra: more on the side with it (?coat=0&key=0)
      await L.dress(pg.page, L.STARTER);
      const at = await L.raceTo(pg.page, { rival: L.RACES[race].rival, to: stepOver || AT[race] });
      await L.hud(pg.page, true);
      const file = path.join(out, race + '-' + size + '-' + side + '.png');
      await L.snap(pg.page, file);
      const info = await L.sceneInfo(pg.page);
      console.log(file.replace(L.root + '/', ''), JSON.stringify({ state: at.state, angle: +at.angle.toFixed(1), v: +at.v.toFixed(1), preset: info.preset, theme: info.theme, tier: info.tier, drawCalls: info.drawCalls, triangles: info.triangles }), pg.errors.length ? pg.errors.slice(0, 2) : '');
      await pg.close();
    }
  }
}
if (args.includes('--pairs')) {
  const fs = await import('node:fs'), dir = path.join(L.lookDir, 'pairs');
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await env.browser.newContext({ viewport: { width: 1280, height: 1440 }, deviceScaleFactor: 1 }), page = await ctx.newPage();
  for (const race of only) for (const size of sizes) {
    const a = path.join(out, race + '-' + size + '-before.png'), b = path.join(out, race + '-' + size + '-after.png');
    if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
    const [w, h] = [VP[size].width, VP[size].height], tall = w > h;
    await page.setViewportSize(tall ? { width: w, height: h * 2 } : { width: w * 2, height: h });
    const img = f => '<img src="data:image/png;base64,' + fs.readFileSync(f).toString('base64') + '">';
    await page.setContent('<!doctype html><style>html,body{margin:0;background:#000}body{display:flex;flex-direction:' + (tall ? 'column' : 'row') + '}img{display:block;width:' + w + 'px;height:' + h + 'px}</style>' + img(a) + img(b));
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(dir, race + '-' + VP[size].width + 'x' + VP[size].height + '.jpg'), type: 'jpeg', quality: 86 });
    console.log('wrote review/look/pairs/' + race + '-' + VP[size].width + 'x' + VP[size].height + '.jpg');
  }
  await ctx.close();
}
await env.close();
