/* THE FIRST MINUTE, BEFORE AND AFTER (briefs/FIRST-MINUTE.md, "When
   done"): at 390x844 as a phone, from an empty save, main's (out of git)
   and ?first=2's title, the first corner of the first run and its
   results, the run played by the same stranger's thumbs (thumbs.js, seed
   SEED) on both, every picture a screenshot of the page as a player sees
   it (HUD, prompts and touch buttons included). WebGL 2 at the high
   tier, so the screenshots hold the canvas (the Pixel 9 draws the same
   look on WebGPU). Writes review/first/strip.jpg: main on the top row,
   ?first=2 under it, title, first corner and results left to right.
   Not a measure: pictures for the eye.

   node game/test/first/strip.js [--seed 1] */
import path from 'node:path';
import fs from 'node:fs';
import * as F from './lib.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const STRIP = {
  SEED:   +arg('--seed', 1),
  TITLE:  5,            // s on the title before its picture (the live title's car well under way)
  CORNER: { corner: 0, share: 0.5 },   // the first corner, half way through it
  AFTER:  40,           // frames drawn on the results before their picture
  GAP:    8,            // px between pictures
};
const shots = {};
for (const side of ['main', 'branch']) {
  const S = await F.side(side), env = await S.R.start();
  try {
    const pg = await F.freshPage(env, S.R, F.PHONE, 'tier=high' + (side === 'branch' ? '&first=2' : ''), true);
    const p = pg.page;
    await p.evaluate(n => { const F = window.__feel; F.draw = true; window.__clock = 1000; for (let i = 0; i < n; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); } }, STRIP.TITLE * 60);
    shots[side + '-title'] = await p.screenshot({ timeout: 300000 });
    const run = p.evaluate(({ seed, pause }) => window.__first.run(seed, { flush: true, keepClock: true, pause, maxS: 240 }), { seed: STRIP.SEED, pause: STRIP.CORNER });
    for (const end = Date.now() + 600000; Date.now() < end; await new Promise(r => setTimeout(r, 250))) if (await p.evaluate(() => !!(window.__first && window.__first.paused))) break;
    shots[side + '-corner'] = await p.screenshot({ timeout: 300000 });
    await p.evaluate(() => window.__first.resume());
    const r = await run;
    if (r.error) throw new Error(side + ': ' + r.error);
    await p.evaluate(n => { const F = window.__feel; F.draw = true; for (let i = 0; i < n; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); } }, STRIP.AFTER);
    shots[side + '-results'] = await p.screenshot({ timeout: 300000 });
    console.log('INFO ' + side + ': ' + (r.results ? r.results.score + ' points, ' + r.results.stars + ' stars, ' + r.results.seconds.toFixed(1) + ' s' : 'no results') + '; page errors ' + pg.errors.length);
    await pg.close();
  } finally { await env.close(); }
}
/* set side by side, in a page (the browser decodes and draws them) */
{
  const S = await F.side('branch'), env = await S.R.start();
  try {
    const ctx = await env.browser.newContext({ viewport: { width: 400, height: 300 } }), page = await ctx.newPage();
    const W = F.PHONE.width, H = F.PHONE.height, G = STRIP.GAP;
    const png = await page.evaluate(async ({ list, W, H, G }) => {
      const c = document.createElement('canvas'); c.width = W * 3 + G * 2; c.height = H * 2 + G;
      const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < list.length; i++) {
        const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + list[i]; });
        g.drawImage(img, (i % 3) * (W + G), Math.floor(i / 3) * (H + G), W, H);
      }
      return c.toDataURL('image/jpeg', 0.86).split(',')[1];
    }, { list: ['main-title', 'main-corner', 'main-results', 'branch-title', 'branch-corner', 'branch-results'].map(k => shots[k].toString('base64')), W, H, G });
    fs.writeFileSync(path.join(F.dir, 'strip.jpg'), Buffer.from(png, 'base64'));
    await ctx.close();
  } finally { await env.close(); }
}
console.log('wrote ' + path.join(F.dir, 'strip.jpg'));
