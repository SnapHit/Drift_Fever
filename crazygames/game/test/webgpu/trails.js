/* THE TAIL-LIGHT TRAILS, ON EVERY TIME OF DAY (15 November 2026). The
   author had never seen one on his phone. Two causes were possible and
   both are changed: dawn tracks drew none by design and dusk ones faint,
   and the ribbon's index was rewritten every frame, which only the
   WebGPU backend, his phone's, might mind. This measures the first on
   the WebGL 2 fallback, both tiers: the same slide on First slide with
   the time of day forced, the trails' mesh shown and then hidden, and
   the pixels that differ counted. The second cannot be measured here:
   the sandbox's WebGPU (--enable-unsafe-webgpu, swiftshader) starts and
   draws a blank canvas, trails or no trails.
   Known answer: with the mesh hidden both ways, nothing differs.
   node game/test/webgpu/trails.js   writes review/webgpu/trails.json and shots */
import path from 'node:path'; import fs from 'node:fs';
import * as R from '../garage/lib.js';
const out = path.join(R.root, 'review', 'webgpu'); fs.mkdirSync(out, { recursive: true });
const env = await R.start(), res = {};
let fails = 0;
for (const tier of ['low', 'high']) for (const preset of ['dawn', 'dusk', 'night', 'rain']) {
  const pg = await R.openPage(env, { width: 844, height: 390 }, 'tier=' + tier + '&adapt=0&title=1&preset=' + preset), page = pg.page;
  await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    const L = window.__loop; L.save.reset(); L.save.setOnboarded();
    window.__feel.draw = false;
    L.startRun(L.careerSpec(0)); L.skipCountdown();
    window.__feel.setDriver({ player: 'slide', drive: L.RIVALS.find(r => r.id === 'r4').drive });
    document.getElementById('ui').style.visibility = 'hidden';
    window.__clock = 1000;
  });
  await R.seedRandom(page, 7);
  const at = await page.evaluate(() => {
    const F = window.__feel; let run = 0;
    for (let k = 0; k < 60 * 60; k++) { window.__clock += 1000 / 60; F.frame(window.__clock); const c = F.world.car; run = Math.abs(c.slip) * 57.3 > 25 && c.speed > 14 ? run + 1 : 0; if (run >= 30) { const t = F.scene.scene.getObjectByName('trails'); return { k, preset: F.scene.info().preset, quads: t.geometry.drawRange.count / 6 }; } }
    return null;
  });
  const shot = async (show, name) => { await page.evaluate(show => { const F = window.__feel, t = F.scene.scene.getObjectByName('trails'); t.visible = show; F.draw = true; F.scene.render(); F.draw = false; }, show); await page.waitForTimeout(300); const f = path.join(out, name); await page.screenshot({ path: f }); return R.decode(fs.readFileSync(f)); };
  const on = await shot(true, 'trails-' + tier + '-' + preset + '.png'), off = await shot(false, 'off.png'), off2 = await shot(false, 'off.png');
  const differ = (a, b) => { let n = 0; for (let i = 0; i < a.d.length; i += 4) if (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]) > 24) n++; return n; };
  const px = differ(on, off), known = differ(off, off2), pass = at && at.preset === preset && px >= 150 && known === 0;
  if (!pass) fails++;
  res[tier + ' ' + preset] = { ...at, px, known };
  console.log((pass ? 'PASS ' : 'FAIL ') + tier + ' tier, ' + preset + ': the trails change ' + px + ' pixels of 844x390 (' + (at ? at.quads : 0) + ' quads); hidden twice, ' + known + ' differ');
  await pg.close();
}
fs.rmSync(path.join(out, 'off.png'), { force: true });
fs.writeFileSync(path.join(out, 'trails.json'), JSON.stringify(res, null, 1));
await env.close();
console.log(fails ? fails + ' failed' : 'all passed');
