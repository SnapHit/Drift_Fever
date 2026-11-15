/* CRAZYGAMES READINESS, the frame sizes (15 November 2026). Their
   gameplay page asks that text and images are legible at device pixel
   ratio 1 in 16:9 frames (docs.crazygames.com/requirements/gameplay,
   read the same day). Their pages give no list of sizes, so these are
   ten 16:9 sizes of this probe's own choosing across the range their
   player uses, 800x450 to 1920x1080. On every screen and in a run, at
   each: nothing is wider than the frame, every enabled button is whole
   inside it or inside a part that scrolls to it, no button is under 36
   px either way (a mouse's size: the touch sizes are 44, measured by
   the rounds that made the screens), and no text is under 10 px.
   Known answers: a button pushed off the right edge, one made 20 px
   high and a line set in 7 px type are each caught.
   node game/test/ready/sizes.js   writes review/ready/sizes.json and shots at the smallest and the largest */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../ladder/lib.js';
const dir = path.join(R.root, 'review', 'ready'); fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });
const SIZES = [[800, 450], [907, 510], [1024, 576], [1152, 648], [1280, 720], [1366, 768], [1536, 864], [1600, 900], [1760, 990], [1920, 1080]];
const MIN = { button: 36, text: 10 };
const env = await R.start(), out = {};
let fails = 0;
const say = (pass, msg) => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + msg); };
const MEASURE = `
  const W = innerWidth, H = innerHeight, bad = [];
  const shown = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  /* inside a part that scrolls up and down: reachable by scrolling */
  const scrolls = el => { for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) return true; } return false; };
  const roots = [document.querySelector('#screens.on'), document.querySelector('#hud')].filter(Boolean);
  let buttons = 0, minText = 99, minTextOf = '', minBtn = 999;
  for (const root of roots) {
    for (const b of root.querySelectorAll('button')) {
      if (b.disabled || !shown(b)) continue; buttons++;
      const r = b.getBoundingClientRect();
      if (r.left < -1 || r.right > W + 1) bad.push('off the side: ' + (b.textContent || b.id).trim().slice(0, 24));
      if ((r.top < -1 || r.bottom > H + 1) && !scrolls(b)) bad.push('off the frame: ' + (b.textContent || b.id).trim().slice(0, 24));
      const m = Math.min(r.width, r.height); if (m < minBtn) minBtn = m;
      if (m < MINB) bad.push('small button ' + Math.round(m) + ' px: ' + (b.textContent || b.id).trim().slice(0, 24));
    }
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!/[A-Za-z0-9]/.test(n.nodeValue) || !shown(n.parentElement)) continue;   // letters and figures: a coin's dot or an arrow is a drawing
      const f = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (f < minText) { minText = f; minTextOf = n.nodeValue.trim().slice(0, 24); }
      if (f < MINT) bad.push('small text ' + f.toFixed(1) + ' px: ' + n.nodeValue.trim().slice(0, 24));
    }
  }
  if (document.documentElement.scrollWidth > W + 1) bad.push('the page is ' + document.documentElement.scrollWidth + ' wide');
  return { buttons, minBtn: Math.round(minBtn), minText: +minText.toFixed(1), minTextOf, bad: [...new Set(bad)] };
`.replace(/MINB/g, MIN.button).replace(/MINT/g, MIN.text);
const measure = page => page.evaluate(new Function(MEASURE));
const VIEWS = [
  ['title', `L.action('title')`], ['career', `L.action('career')`], ['rivals', `L.action('rivals')`], ['garage', `L.action('garage')`],
  ['garage wheels', `L.action('garage'); L.action('garage-tab', 'wheels')`], ['lab', `L.action('lab')`], ['park list', `L.action('park')`],
  ['a run', `L.startRun(L.careerSpec(0)); L.skipCountdown()`, 40], ['career results', `L.finishNow()`, 60],
  ['a race', `L.startRun(L.battleSpec('r1')); L.skipCountdown()`, 40], ['race results', `L.finishNow()`, 60],
  ['stunt park', `L.action('title'); L.action('free')`, 20],
];
for (const [w, h] of SIZES) {
  const tag = w + 'x' + h, pg = await R.emptyPage(env, { width: w, height: h }, 'rivals=all'), page = pg.page, worst = [];
  await page.evaluate(() => { window.__loop.save.state.coins = 5000; });
  let minText = 99, minBtn = 999, buttons = 0;
  for (const [name, code, frames] of VIEWS) {
    await page.evaluate(new Function(`const L = window.__loop; window.__feel.draw = false; ${code};`));
    await R.runFrames(page, frames || 3);
    const m = await measure(page);
    out[tag + ' ' + name] = m; buttons += m.buttons; minText = Math.min(minText, m.minText); minBtn = Math.min(minBtn, m.minBtn);
    for (const b of m.bad) worst.push(name + ': ' + b);
    if ((w === 800 || w === 1920) && ['title', 'garage', 'a race', 'race results'].includes(name)) { await page.evaluate(() => { window.__feel.draw = true; }); await R.runFrames(page, 2); await page.screenshot({ path: path.join(dir, 'shots', tag + '-' + name.replace(/ /g, '-') + '.png') }); }
  }
  say(worst.length === 0, tag + ': ' + VIEWS.length + ' views, ' + buttons + ' buttons, the smallest ' + minBtn + ' px, the smallest text ' + minText + ' px' + (worst.length ? '; ' + worst.slice(0, 6).join('; ') : ''));
  if (w === 800 || w === 1920) {
    /* the known answers, on the title */
    const k = await page.evaluate(new Function(`const L = window.__loop; L.action('title'); const b = document.querySelector('#screens button[data-action="career"]'), keep = b.style.cssText;
      const m = () => (function () {${MEASURE}})();
      b.style.cssText = keep + ';position:relative;left:' + innerWidth + 'px'; const off = m().bad.some(x => /off the side/.test(x));
      b.style.cssText = keep + ';height:20px;min-height:0;padding:0;overflow:hidden'; const small = m().bad.some(x => /small button/.test(x));
      b.style.cssText = keep; const t = b.querySelector('b') || b, tk = t.style.cssText; t.style.cssText = tk + ';font-size:7px'; const tiny = m().bad.some(x => /small text/.test(x)); t.style.cssText = tk;
      b.style.cssText = keep; return { off, small, tiny, clean: m().bad.length === 0 };`));
    say(k.off && k.small && k.tiny && k.clean, tag + ' known answers: a button off the side ' + (k.off ? 'CAUGHT' : 'MISSED') + ', one 20 px high ' + (k.small ? 'CAUGHT' : 'MISSED') + ', 7 px type ' + (k.tiny ? 'CAUGHT' : 'MISSED') + ', and put back, clean: ' + k.clean);
  }
  await page.close();
}
fs.writeFileSync(path.join(dir, 'sizes.json'), JSON.stringify(out, null, 1));
await env.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
