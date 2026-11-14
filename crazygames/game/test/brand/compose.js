/* THE COVERS: each background from capture.js under the game's own
   wordmark, at the exact size asked for. CrazyGames' rules for covers
   (docs.crazygames.com/requirements/game-covers, read 15 November 2026):
   no border, no words but the title, no icons or store logos, nothing
   blurry. So a cover is the picture, a soft shade behind the title so it
   reads, and the title. Nothing else.

   node game/test/brand/compose.js [--bg dir] [--out dir] [--ext jpg]
   reads brand/bg/<concept>-<shape>.png, writes brand/covers/<concept>-<shape>.png */
import path from 'node:path'; import fs from 'node:fs';
import { chromium } from 'playwright';
import * as R from '../garage/lib.js';
const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const bg = arg('--bg', path.join(R.root, 'brand', 'bg')), out = arg('--out', path.join(R.root, 'brand', 'covers')), ext = arg('--ext', 'png');
fs.mkdirSync(out, { recursive: true });
const SHAPES = { landscape: [1920, 1080], portrait: [800, 1200], square: [800, 800], share: [1200, 630] };
/* the title: its width as a share of the cover's, and how far down its top sits as a share of the height */
const TITLE = { landscape: { w: 0.36, top: 0.04 }, portrait: { w: 0.86, top: 0.06 }, square: { w: 0.74, top: 0.045 }, share: { w: 0.36, top: 0.04 } };
const mark = fs.readFileSync(path.join(R.root, 'game', 'assets', 'brand', 'drift-fever-wordmark.svg'), 'utf8');
const exe = process.env.PLAYWRIGHT_BROWSERS_PATH ? fs.readdirSync(process.env.PLAYWRIGHT_BROWSERS_PATH).map(d => path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, d, 'chrome-linux', 'chrome')).find(p => fs.existsSync(p)) : undefined;
const browser = await chromium.launch({ executablePath: exe });
for (const f of fs.readdirSync(bg).sort()) {
  const m = /^(.+)-(landscape|portrait|square|share)\.(png|jpg)$/.exec(f); if (!m) continue;
  const [, name, shape] = m, [w, h] = SHAPES[shape], T = TITLE[shape];
  const data = 'data:image/' + (m[3] === 'jpg' ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(path.join(bg, f)).toString('base64');
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
  await page.setContent(`<!doctype html><style>
    html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: #000; }
    .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 100%; }   /* a picture of another shape keeps its foot, where the car is, and gives up sky */
    .shade { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 42% at 50% ${Math.round((T.top + 0.13) * 100)}%, rgba(8, 4, 22, 0.55), rgba(8, 4, 22, 0) 72%), linear-gradient(to bottom, rgba(0, 0, 0, 0) 78%, rgba(0, 0, 0, 0.28)); }
    .title { position: absolute; left: ${(1 - T.w) / 2 * 100}%; top: ${T.top * 100}%; width: ${T.w * 100}%; filter: drop-shadow(0 ${Math.round(w * 0.006)}px ${Math.round(w * 0.012)}px rgba(10, 2, 20, 0.7)) drop-shadow(0 0 ${Math.round(w * 0.03)}px rgba(255, 110, 30, 0.35)); }
    .title svg { display: block; width: 100%; height: auto; }
  </style><img class="bg" src="${data}"><div class="shade"></div><div class="title">${mark}</div>`);
  await page.waitForTimeout(200);
  const file = path.join(out, name + '-' + shape + '.' + ext);
  await page.screenshot(ext === 'jpg' ? { path: file, quality: 90 } : { path: file });
  console.log('wrote ' + path.relative(R.root, file) + ' ' + w + 'x' + h);
  await page.context().close();
}
await browser.close();
