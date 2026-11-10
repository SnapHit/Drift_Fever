/* SPECTACLE MEASURE 3: THE CAR READS THROUGH ITS OWN SMOKE. The share
   of the car's screen box that its smoke hides, through a long slide, at
   both tiers, in landscape (1280x720) and portrait (390x844).

   The scripted drifter on career 1, the chain held at x5 (the heat full:
   the most smoke the show makes), through a slide; every few frames
   two pictures of the same frame: as drawn, and drawn again with the
   smoke's mesh hidden (nothing else moves between them), and a third
   with the car hidden too, which gives the car's own pixels (its
   silhouette). Inside the car's box (its body's eight corners
   projected), a pixel is hidden when the smoke moved its colour more
   than HIDE_DELTA in any channel; the share is reported of the box and
   of the silhouette (a box round a car sliding at 40 degrees is half
   road, and smoke on that road hides no car).

   THE BAR, set before measuring: in the worst frame at most WORST of
   the box is hidden, and over the slide at most MEDIAN; the same of the
   silhouette.
   Known answer: the smoke without its clearance (the thinning on the
   camera's line to the car and near the camera turned off) and twice as
   thick must break it.

   node game/test/spectacle/smoke.js
   Writes review/spectacle/smoke.json and shots/smoke-*.png. */
import path from 'node:path';
import * as S from './lib.js';

export const BAR = { WORST: 0.12, MEDIAN: 0.05, HIDE_DELTA: 40, FRAMES: 8, EVERY: 5 };

const BOX = `
  const F = window.__feel, THREE = F.scene.THREE, cam = F.scene.camera, pose = F.pose, b = extra.box;
  cam.updateMatrixWorld();
  const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw), lz = Math.sin(pose.yaw), v = new THREE.Vector3();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of [-b.halfLength, b.halfLength]) for (const l of [-b.halfWidth, b.halfWidth]) for (const y of [0.15, b.height]) {
    v.set(pose.x + fx * f + lx * l, (pose.y || 0) + y, pose.z + fz * f + lz * l).project(cam);
    const px = (v.x + 1) / 2 * extra.w, py = (1 - v.y) / 2 * extra.h;
    x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
  }
  return { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(extra.w - 1, x1), y1: Math.min(extra.h - 1, y1) };
`;
async function hiddenShare(page, a, b, c, box) {
  return page.evaluate(async ({ a, b, c, box, delta }) => {
    const load = async s => { const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + s; }); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const A = await load(a), B = await load(b), C = await load(c);
    const differ = (P, Q, o, d) => Math.abs(P.data[o] - Q.data[o]) > d || Math.abs(P.data[o + 1] - Q.data[o + 1]) > d || Math.abs(P.data[o + 2] - Q.data[o + 2]) > d;
    let n = 0, hid = 0, car = 0, carHid = 0;
    for (let y = Math.round(box.y0); y <= Math.round(box.y1); y++) for (let x = Math.round(box.x0); x <= Math.round(box.x1); x++) {
      const o = (y * A.width + x) * 4; n++;
      const h = differ(A, B, o, delta);
      if (h) hid++;
      if (differ(B, C, o, 10)) { car++; if (h) carHid++; }
    }
    return { pixels: n, hidden: hid, share: n ? hid / n : 0, carPixels: car, carShare: car ? carHid / car : 0 };
  }, { a: a.toString('base64'), b: b.toString('base64'), c: c.toString('base64'), box, delta: BAR.HIDE_DELTA });
}

const env = await S.start();
const out = { bar: BAR, note: 'headless Chromium, forced WebGL 2 on SwiftShader; the scripted drifter, the chain held at x5', runs: [] };
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
for (const known of [false, true]) for (const tier of known ? ['low'] : ['low', 'high']) for (const vp of known ? [S.LANDSCAPE] : [S.LANDSCAPE, S.PORTRAIT]) {
  const tag = (known ? 'known-' : '') + tier + '-' + S.tagOf(vp);
  const pg = await S.page(env, vp, 'tier=' + tier + '&preset=dusk', { touch: vp === S.PORTRAIT });
  const p = pg.page;
  if (known) await p.evaluate(async () => { const m = await import('./src/env/show.js'); const C = m.SHOW.SMOKE.CLEAR; C.keep = 1; C.near = 0; C.far = 0.01; m.SHOW.SMOKE.ALPHA = m.SHOW.SMOKE.ALPHA.map(a => Math.min(1, a * 2)); m.SHOW.SMOKE.RATE = m.SHOW.SMOKE.RATE.map(r => r * 2); });
  await S.careerRun(p, 0);
  const box = await p.evaluate(() => { const b = window.__feel.scene.carModel().dims; return { halfLength: b.halfLength, halfWidth: b.halfWidth, height: b.height }; });
  const f = await S.slideAt(p, 5, 18);
  const shares = [], carShares = [];
  for (let k = 0; k < BAR.FRAMES && f; k++) {
    const a = await S.shot(p, path.join(S.shotsDir, 'smoke-' + tag + (k === 3 ? '' : '-x') + '.png'));
    const rect = await p.evaluate(({ src, extra }) => new Function('extra', src)(extra), { src: BOX, extra: { box, w: vp.width, h: vp.height } });
    await p.evaluate(() => { const sm = window.__feel.scene.effects().pools.smoke.mesh; sm.visible = false; window.__feel.scene.render(); });
    const b = await p.screenshot({ timeout: 180000 });
    await p.evaluate(() => { const F = window.__feel; F.scene.car.visible = false; F.scene.render(); });
    const cc = await p.screenshot({ timeout: 180000 });
    await p.evaluate(() => { window.__feel.scene.car.visible = true; });
    const r = await hiddenShare(p, a, b, cc, rect);
    shares.push(+r.share.toFixed(4)); carShares.push(+r.carShare.toFixed(4));
    await p.evaluate(() => { window.__feel.draw = false; });
    await S.runFrames(p, BAR.EVERY);
  }
  for (const file of (await import('node:fs')).readdirSync(S.shotsDir)) if (file.startsWith('smoke-' + tag + '-x')) (await import('node:fs')).unlinkSync(path.join(S.shotsDir, file));
  const row = { tier, viewport: S.tagOf(vp), known, slide: f, shares, worst: Math.max(...shares), median: median(shares), carShares, carWorst: Math.max(...carShares), carMedian: median(carShares), smokeAlive: await p.evaluate(() => window.__feel.scene.effects().pools.smoke.live()) };
  row.pass = shares.length >= BAR.FRAMES && row.worst <= BAR.WORST && row.median <= BAR.MEDIAN && row.carWorst <= BAR.WORST && row.carMedian <= BAR.MEDIAN;
  out.runs.push(row);
  if (!known) S.verdict(row.pass, tier + ' ' + row.viewport + ': the smoke hides at worst ' + (row.worst * 100).toFixed(1) + '% of the car box, median ' + (row.median * 100).toFixed(1) + '% over ' + shares.length + ' frames of a slide at x5 (' + row.smokeAlive + ' puffs alive); of the car itself at worst ' + (row.carWorst * 100).toFixed(1) + '%, median ' + (row.carMedian * 100).toFixed(1) + '%');
  else S.verdict(!row.pass, 'known answer: the smoke without its clearance and twice as thick hides at worst ' + (row.worst * 100).toFixed(1) + '%, median ' + (row.median * 100).toFixed(1) + '% (of the car itself ' + (row.carWorst * 100).toFixed(1) + '% and ' + (row.carMedian * 100).toFixed(1) + '%): ' + (!row.pass ? 'CAUGHT' : 'MISSED'));
  await pg.close();
}
S.writeJson(path.join(S.reviewDir, 'smoke.json'), out);
await env.close();
console.log(S.failures() ? S.failures() + ' failed' : 'all passed');
process.exit(S.failures() ? 1 : 0);
