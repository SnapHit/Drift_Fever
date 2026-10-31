/* THE CAR MEASUREMENTS THAT NEED THE RENDERER, AND THE SCREENSHOTS.
   Opens the lab (game/lab/cars.html) in headless Chromium on the forced
   WebGL 2 path and:

   1. Reads the triangles and draw calls three.js's renderer reports for
      each car drawn alone, and checks them against the counts from the
      geometry. Known answer: a 12 triangle box in its own material added
      to the starter must read 12 more triangles and one more call.
   2. Checks the bytes the page actually fetched for the car code against
      the files on disk. Known answer: the same comparison with one file
      left out must disagree.
   3. Readable as itself at 30 m: each car's silhouette from the chase
      camera's height and pitch, 30 m back, on a phone (390 by 844 at a
      pixel ratio of 1, the low tier), straight and in a 35 degree slide.
      Every pair of cars must differ by at least 15 per cent of their
      combined silhouette (1 - IoU). Known answers: a car against itself,
      and against itself repainted, differ by nothing and must fail.
   4. The screenshots for the report: each car from the chase camera,
      straight and sliding, in a three-quarter view and at 30 m, the five
      together, and the lab itself on a phone.

   node game/test/cars/render.js     writes review/cars/render.json and the PNGs */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { createCar, CARS } from '../../src/cars/index.js';
import { start, openLab, LANDSCAPE, PORTRAIT, reviewDir, root, writeJson } from './lib.js';

const shots = path.join(reviewDir, 'shots');
fs.mkdirSync(shots, { recursive: true });
const result = { when: new Date().toISOString(), counts: {}, knownAnswers: [], silhouettes: {}, shots: [] };
const failures = [];

function geometryCounts(car) {
  let triangles = 0, drawCalls = 0;
  car.group.traverse(o => { if (!o.isMesh || !o.visible) return; triangles += o.geometry.attributes.position.count / 3; drawCalls += Array.isArray(o.material) ? o.geometry.groups.length : 1; });
  return { triangles, drawCalls };
}

const env = await start();
try {
  /* ---- 1 and 2, landscape ---- */
  const lab = await openLab(env, LANDSCAPE, '');
  const P = lab.page;
  result.backend = await P.evaluate(() => window.__lab.backend);
  const rendered = await P.evaluate(() => window.__lab.counts);
  result.counts.empty = rendered.empty;
  for (const c of CARS) {
    const car = createCar(THREE, c.id);
    const g = geometryCounts(car);
    const r = rendered[c.id];
    const ok = r.plain.triangles === g.triangles && r.plain.drawCalls === g.drawCalls && r.withGlow.triangles === g.triangles + 10 && r.withGlow.drawCalls === g.drawCalls + 1;
    result.counts[c.id] = { geometry: g, rendered: r, agree: ok };
    if (!ok) failures.push(c.id + ': rendered counts ' + JSON.stringify(r) + ' against geometry ' + JSON.stringify(g));
  }
  const ka = await P.evaluate(() => {
    const L = window.__lab, T = L.THREE;
    const before = L.measure().starter.plain;
    const box = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.2), new T.MeshBasicMaterial({ color: 0xff00ff }));
    L.cars.starter.group.add(box);
    const after = L.measure().starter.plain;
    L.cars.starter.group.remove(box);
    return { triangles: after.triangles - before.triangles, drawCalls: after.drawCalls - before.drawCalls };
  });
  result.knownAnswers.push({ name: 'renderer counts: a 12 triangle box in its own material added to the starter', expect: '+12 triangles, +1 call', value: ka, caught: ka.triangles === 12 && ka.drawCalls === 1 });

  const carFiles = fs.readdirSync(path.join(root, 'game', 'src', 'cars')).filter(f => f.endsWith('.js'));
  const disk = Object.fromEntries(carFiles.map(f => [f, fs.statSync(path.join(root, 'game', 'src', 'cars', f)).size]));
  const fetched = Object.fromEntries(lab.loaded.filter(l => l.url.includes('/src/cars/')).map(l => [l.url.split('/src/cars/')[1].split('?')[0], l.bytes]));
  const same = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => a[k] === b[k]);
  result.code = { disk, fetched, agree: same(disk, fetched), fetchedTotal: Object.values(fetched).reduce((s, v) => s + v, 0) };
  if (!result.code.agree) failures.push('fetched car code differs from the files: ' + JSON.stringify(result.code));
  const short = { ...disk }; delete short['build.js'];
  result.knownAnswers.push({ name: 'code fetched: the comparison with build.js left out', expect: 'disagree', value: same(short, fetched) ? 'agree' : 'disagree', caught: !same(short, fetched) });

  result.errors = lab.errors.slice();
  await lab.close();

  /* ---- 4, the shots. Each car on a fresh page with the sliding view
     last: see vanish.js, a renderer anomaly that drops a wheel from
     frames drawn after a sliding chase frame on the same page. ---- */
  const shoot = async (page, name, o, clip) => {
    await page.evaluate(o => window.__lab.show(o), o);
    let c = clip;
    if (clip === 'car') {
      const b = await page.evaluate(id => window.__lab.screenBox(id), o.car);
      const vp = page.viewportSize(), m = 24;
      const x = Math.max(0, Math.floor(b.x0 - m)), y = Math.max(0, Math.floor(b.y0 - m));
      c = { x, y, width: Math.min(vp.width - x, Math.ceil(b.x1 - b.x0 + 2 * m)), height: Math.min(vp.height - y, Math.ceil(b.y1 - b.y0 + 2 * m)) };
    }
    const file = path.join(shots, name + '.png');
    await page.screenshot({ path: file, clip: c || undefined });
    result.shots.push(path.relative(reviewDir, file));
  };
  const fresh = async (vp, fn) => { const l = await openLab(env, vp, ''); try { await fn(l.page); } finally { result.errors.push(...l.errors); await l.close(); } };
  const CHASE_CLIP = { x: 240, y: 160, width: 800, height: 480 };
  for (const c of CARS) {
    await fresh(LANDSCAPE, async page => {
      await shoot(page, c.id + '-three-quarter', { car: c.id, view: 'three', yawDeg: 0 }, 'car');
      await shoot(page, c.id + '-rear-three-quarter', { car: c.id, view: 'three', yawDeg: 180 }, 'car');
      await shoot(page, c.id + '-chase', { car: c.id, view: 'chase', yawDeg: 0 }, CHASE_CLIP);
      await shoot(page, c.id + '-chase-slide', { car: c.id, view: 'chase', yawDeg: 35 }, CHASE_CLIP);
    });
  }
  await fresh(LANDSCAPE, async page => {
    await shoot(page, 'all-three-quarter', { car: 'all', view: 'three', yawDeg: 0 }, null);
    await shoot(page, 'all-turntable', { car: 'all', view: 'turntable', spin: 0 }, null);
    await page.evaluate(() => { for (const id in window.__lab.cars) window.__lab.cars[id].setUnderglow(0xff2bd6); });
    await shoot(page, 'all-underglow', { car: 'all', view: 'turntable', spin: 0 }, null);
  });

  /* ---- 3, silhouettes at 30 m, and the 30 m shots, on a phone ---- */
  for (const c of CARS) {
    await fresh(PORTRAIT, async page => {
      for (const yaw of [0, 35]) {
        await page.evaluate(o => window.__lab.show(o), { car: c.id, view: 'far', yawDeg: yaw });
        const b = await page.evaluate(id => window.__lab.screenBox(id), c.id);
        const m = 30, x = Math.max(0, Math.floor(b.x0 - m)), y = Math.max(0, Math.floor(b.y0 - m));
        const file = path.join(shots, c.id + '-30m' + (yaw ? '-slide' : '') + '.png');
        await page.screenshot({ path: file, clip: { x, y, width: Math.ceil(b.x1 - b.x0 + 2 * m), height: Math.ceil(b.y1 - b.y0 + 2 * m) } });
        result.shots.push(path.relative(reviewDir, file));
      }
    });
  }
  const vp = PORTRAIT;
  /* One silhouette on its own fresh page: nothing but the car, flat white on black. */
  const maskOf = async (id, yaw, paint) => {
    let mask;
    await fresh(PORTRAIT, async Q => {
      await Q.evaluate(o => {
        const L = window.__lab, T = L.THREE;
        L.env.visible = false; L.scene.fog = null; L.scene.background = new T.Color(0x000000);
        L.scene.overrideMaterial = new T.MeshBasicMaterial({ color: 0xffffff });
        if (o.paint != null) L.cars[o.id].setPaint(o.paint);
        L.show({ car: o.id, view: 'far', yawDeg: o.yaw });
      }, { id, yaw, paint });
      const png = await Q.screenshot({ type: 'png' });
      mask = await Q.evaluate(async b64 => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height).data;
        const on = []; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
        for (let i = 0, p = 0; i < d.length; i += 4, p++) if (d[i] > 127) { on.push(p); const x = p % cv.width, y = (p / cv.width) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        return { on, box: { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
      }, png.toString('base64'));
    });
    return mask;
  };
  const diff = (a, b) => { const A = new Set(a.on); let inter = 0; for (const p of b.on) if (A.has(p)) inter++; const uni = a.on.length + b.on.length - inter; return uni ? 1 - inter / uni : 0; };
  const LIMIT = 0.15;
  for (const yaw of [0, 35]) {
    const masks = {};
    for (const c of CARS) masks[c.id] = await maskOf(c.id, yaw);
    const pairs = [];
    for (let i = 0; i < CARS.length; i++) for (let j = i + 1; j < CARS.length; j++) pairs.push({ a: CARS[i].id, b: CARS[j].id, diff: +diff(masks[CARS[i].id], masks[CARS[j].id]).toFixed(3) });
    pairs.sort((p, q) => p.diff - q.diff);
    const sizes = Object.fromEntries(CARS.map(c => [c.id, { pixels: masks[c.id].on.length, w: masks[c.id].box.w, h: masks[c.id].box.h }]));
    const under = pairs.filter(p => p.diff < LIMIT);
    result.silhouettes[yaw ? 'slide35' : 'straight'] = { closest: pairs[0], under: under.length, pairs, sizes, limit: LIMIT, pass: under.length === 0 };
    for (const p of under) failures.push(`silhouettes at 30 m (${yaw} deg): ${p.a} and ${p.b} differ by only ${p.diff}`);
    if (yaw === 0) {
      const again = await maskOf('starter', 0);
      const repainted = await maskOf('starter', 0, 0xff2d8a);
      const d1 = diff(masks.starter, again), d2 = diff(masks.starter, repainted);
      result.knownAnswers.push({ name: 'silhouette: the starter against itself', expect: 'fail (diff < 0.15)', value: +d1.toFixed(3), caught: d1 < LIMIT });
      result.knownAnswers.push({ name: 'silhouette: the starter against itself repainted pink', expect: 'fail (diff < 0.15)', value: +d2.toFixed(3), caught: d2 < LIMIT });
      result.knownAnswers.push({ name: 'silhouette: the mask holds the car and only the car', expect: 'between 0.05 and 5 per cent of the screen', value: masks.starter.on.length, caught: masks.starter.on.length > vp.width * vp.height * 0.0005 && masks.starter.on.length < vp.width * vp.height * 0.05 });
    }
  }

  /* ---- the lab on a phone, as the author will see it ---- */
  const ctx = await env.browser.newContext({ viewport: PORTRAIT, deviceScaleFactor: 2, hasTouch: true });
  const ui = await ctx.newPage();
  await ui.goto(env.url + 'lab/cars.html?renderer=webgl2&car=driftbuild', { waitUntil: 'load' });
  await ui.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await ui.waitForTimeout(1500);
  await ui.screenshot({ path: path.join(shots, 'lab-phone.png') });
  result.shots.push('shots/lab-phone.png');
  await ctx.close();
} finally {
  await env.close();
}

for (const k of result.knownAnswers) if (!k.caught) failures.push('known answer missed: ' + k.name + ' ' + JSON.stringify(k.value));
if (result.errors.length) failures.push('page errors: ' + result.errors.join(' | '));
result.failures = failures;
result.pass = failures.length === 0;
writeJson(path.join(reviewDir, 'render.json'), result);

console.log('backend ' + result.backend);
for (const c of CARS) { const r = result.counts[c.id]; console.log(`${c.id.padEnd(11)} rendered ${r.rendered.plain.triangles} tris ${r.rendered.plain.drawCalls} calls (glow ${r.rendered.withGlow.triangles}/${r.rendered.withGlow.drawCalls}); geometry ${r.geometry.triangles}/${r.geometry.drawCalls}; ${r.agree ? 'agree' : 'DISAGREE'}`); }
console.log('code fetched ' + result.code.fetchedTotal + ' B over ' + Object.keys(result.code.fetched).length + ' files, ' + (result.code.agree ? 'same as disk' : 'DIFFERS'));
for (const [k, s] of Object.entries(result.silhouettes)) console.log(`silhouettes ${k}: closest ${s.closest.a}/${s.closest.b} ${s.closest.diff} (limit ${s.limit}); sizes ${Object.entries(s.sizes).map(([id, z]) => id + ' ' + z.w + 'x' + z.h).join(', ')}`);
for (const k of result.knownAnswers) console.log((k.caught ? 'caught  ' : 'MISSED  ') + k.name + ' -> ' + JSON.stringify(k.value));
for (const f of failures) console.log('FAIL ' + f);
console.log(result.shots.length + ' shots; ' + (result.pass ? 'PASS' : 'FAIL'));
process.exit(result.pass ? 0 : 1);
