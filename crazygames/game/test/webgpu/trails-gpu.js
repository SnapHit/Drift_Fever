/* THE TAIL-LIGHT TRAILS ON THE WEBGPU BACKEND (15 November 2026): the
   author's phone draws none there and draws them with ?renderer=webgl2.
   The same night slide on First slide, the trails' mesh shown and then
   hidden, the pixels that differ counted, on both tiers.
   Known answer: hidden twice, nothing differs.
   node game/test/webgpu/trails-gpu.js   writes review/webgpu/gpu-trails-<tier>.png and gpu-trails.json */
import path from 'node:path'; import fs from 'node:fs';
import * as W from './lib.js';
const out = path.join(W.root, 'review', 'webgpu'); fs.mkdirSync(out, { recursive: true });
const env = await W.start(), res = {};
let fails = 0;
for (const tier of (process.argv[2] ? [process.argv[2]] : ['high', 'low'])) {
  const pg = await W.open(env, { width: 844, height: 390 }, 'tier=' + tier + '&adapt=0&title=1&preset=night'), page = pg.page;
  await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    const L = window.__loop; L.save.reset(); L.save.setOnboarded();
    window.__feel.draw = false;
    L.startRun(L.careerSpec(0)); L.skipCountdown();
    window.__feel.setDriver({ player: 'slide', drive: L.RIVALS.find(r => r.id === 'r4').drive });
    document.getElementById('ui').style.visibility = 'hidden';
    window.__clock = 1000;
  });
  await W.seedRandom(page, 7);
  const at = await page.evaluate(() => {
    const F = window.__feel; let run = 0;
    for (let k = 0; k < 60 * 60; k++) { window.__clock += 1000 / 60; F.frame(window.__clock); const c = F.world.car; run = Math.abs(c.slip) * 57.3 > 25 && c.speed > 14 ? run + 1 : 0; if (run >= 30) { const t = F.scene.scene.getObjectByName('trails'), i = F.scene.info(); return { k, backend: i.backend, tier: i.tier, bloom: i.bloom, quads: t.geometry.drawRange.count / 6 }; } }
    return null;
  });
  const shot = async (show, file) => { await page.evaluate(show => { const F = window.__feel, t = F.scene.scene.getObjectByName('trails'); t.visible = show; F.draw = true; F.scene.render(); F.draw = false; }, show); await page.waitForTimeout(200); return W.grab(page, file); };
  const on = await shot(true, path.join(out, 'gpu-trails-' + tier + '.png')), off = await shot(false, null), off2 = await shot(false, null);
  const differ = (a, b) => { let n = 0; for (let i = 0; i < a.d.length; i += 4) if (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]) > 24) n++; return n; };
  const px = differ(on, off), known = differ(off, off2), pass = at && at.backend === 'webgpu' && px >= 150 && known === 0;
  if (!pass) fails++;
  res[tier] = { ...at, px, known, errors: pg.errors.slice(0, 4) };
  console.log((pass ? 'PASS ' : 'FAIL ') + tier + ' tier on ' + (at && at.backend) + ': the trails change ' + px + ' pixels (' + (at ? at.quads : 0) + ' quads); hidden twice, ' + known + ' differ ' + pg.errors.slice(0, 2).join(' | '));
  await pg.close();
}
fs.writeFileSync(path.join(out, 'gpu-trails.json'), JSON.stringify(res, null, 1));
await env.close();
console.log(fails ? fails + ' failed' : 'all passed');
