/* DOES A CHOSEN PAINT SHOW IN A RUN, ON WEBGPU (15 November 2026)? The
   author has seen his paint missing in a race "sometimes" (14 November),
   and plays on WebGPU. A paint is bought in the garage by its own
   buttons and a run started, twice over with two paints, then a car is
   bought and painted; each time the colour of the car on the screen is
   read against the paint's own.
   node game/test/webgpu/paint.js   writes review/webgpu/paint-*.png and paint.json */
import path from 'node:path'; import fs from 'node:fs';
import * as W from './lib.js';
const out = path.join(W.root, 'review', 'webgpu'); fs.mkdirSync(out, { recursive: true });
const env = await W.start(), res = [];
let fails = 0;
const pg = await W.open(env, { width: 844, height: 390 }, 'tier=high&adapt=0&title=1&preset=dawn'), page = pg.page;
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const L = window.__loop; L.save.reset(); L.save.setOnboarded(); L.save.addCoins(20000); L.action('title'); document.getElementById('ui').style.visibility = 'hidden'; });
const hue = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 12) return -1; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
async function run(label, steps) {
  const want = await page.evaluate(async steps => {
    const L = window.__loop, F = window.__feel; F.draw = false;
    for (const [a, arg] of steps) L.action(a, arg);
    L.action('title');
    L.startRun(L.careerSpec(5)); L.skipCountdown();
    for (let i = 0; i < 20; i++) { window.__clock = (window.__clock || 1000) + 1000 / 60; F.frame(window.__clock); }
    F.draw = true; F.scene.render(); F.draw = false;
    const { paintById } = await import('/src/garage/roster.js');
    const S = L.save.state, hex = paintById(S.cars[S.car].paint).hex;
    return { car: S.car, paint: S.cars[S.car].paint, rgb: [hex >> 16 & 255, hex >> 8 & 255, hex & 255], model: F.scene.carModel() && '#' + F.scene.carModel().group.getObjectByProperty('isMesh', true).material[0].color.getHexString() };
  }, steps);
  await page.waitForTimeout(200);
  const img = await W.grab(page, path.join(out, 'paint-' + label + '.png'));
  /* the car sits low in the middle of the chase view: the commonest strong hue there */
  const bins = new Array(36).fill(0);
  for (let y = Math.round(img.h * 0.45); y < Math.round(img.h * 0.8); y++) for (let x = Math.round(img.w * 0.38); x < Math.round(img.w * 0.62); x++) { const i = (y * img.w + x) * 4, r = img.d[i], g = img.d[i + 1], b = img.d[i + 2]; if (Math.max(r, g, b) - Math.min(r, g, b) > 70) { const h = hue(r, g, b); if (h >= 0) bins[Math.floor(h / 10) % 36]++; } }
  const top = bins.indexOf(Math.max(...bins)) * 10 + 5, wantHue = hue(...want.rgb), white = wantHue < 0;
  const dist = white ? 0 : Math.min(Math.abs(top - wantHue), 360 - Math.abs(top - wantHue)), pass = white || dist <= 25;
  if (!pass) fails++;
  res.push({ label, ...want, seenHue: top, wantHue, dist });
  console.log((pass ? 'PASS ' : 'FAIL ') + label + ': ' + want.car + ' in ' + want.paint + ', the model says ' + want.model + ', the screen\'s commonest strong hue ' + top + ' against the paint\'s ' + Math.round(wantHue));
}
await run('1-own', []);
await run('2-magenta', [['garage'], ['garage-tab', 'paint'], ['paint', 'magenta'], ['buy-paint', 'magenta']]);
await run('3-lime', [['garage'], ['garage-tab', 'paint'], ['paint', 'lime'], ['buy-paint', 'lime']]);
await run('4-hatch-own', [['garage'], ['garage-tab', 'cars'], ['pick-car', 'hatch'], ['buy-car', 'hatch']]);
await run('5-hatch-flame', [['garage'], ['garage-tab', 'paint'], ['paint', 'flame'], ['buy-paint', 'flame']]);
await run('6-back-to-starter', [['garage'], ['garage-tab', 'cars'], ['pick-car', 'starter'], ['choose-car', 'starter']]);
fs.writeFileSync(path.join(out, 'paint.json'), JSON.stringify(res, null, 1));
console.log(pg.errors.slice(0, 3).join(' | '));
await env.close();
console.log(fails ? fails + ' failed' : 'all passed');
