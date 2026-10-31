/* A RENDERER ANOMALY, FOUND WHILE TAKING THE REVIEW SHOTS. In headless
   Chromium on SwiftShader, three.js 0.184.0's WebGL 2 fallback, the lab
   page: draw a car from the chase camera with the car turned 35 degrees,
   then draw it from the three-quarter view, and the near rear wheel is
   gone. The renderer still issues its draw call (the counts do not
   change), so a GPU buffer has gone stale; giving the wheel a fresh copy
   of its geometry brings it back. Whether a real GPU does the same is
   not known: this sandbox has none.

   This probe reproduces it and says whether it happened. It is not a
   gate on the cars. Known answer: the same pixel test with the wheel
   hidden on purpose must report it missing, and on a fresh page it must
   report it present.

   node game/test/cars/vanish.js     writes review/cars/vanish.json */
import path from 'node:path';
import { start, openLab, LANDSCAPE, reviewDir, writeJson } from './lib.js';

const env = await start();
const out = {};
try {
  const lab = await openLab(env, LANDSCAPE, '');
  const P = lab.page;
  /* Rim coloured pixels inside the near rear wheel's square on screen. */
  const rimPixels = async () => {
    await P.evaluate(() => window.__lab.show({ car: 'starter', view: 'three', yawDeg: 0 }));
    const box = await P.evaluate(() => {
      const L = window.__lab, T = L.THREE, w = L.cars.starter.wheels.rl.mesh;
      L.cars.starter.group.updateMatrixWorld(true);
      const c = new T.Vector3().setFromMatrixPosition(w.matrixWorld).project(L.camera);
      const e = new T.Vector3().setFromMatrixPosition(w.matrixWorld).add(new T.Vector3(0, 0.33, 0)).project(L.camera);
      const W = innerWidth, H = innerHeight, x = (c.x + 1) / 2 * W, y = (1 - c.y) / 2 * H, r = Math.abs((e.y - c.y) / 2 * H);
      return { x: Math.round(x - r), y: Math.round(y - r), width: Math.round(2 * r), height: Math.round(2 * r) };
    });
    const png = await P.screenshot({ clip: box });
    return P.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, cv.width, cv.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 120 && d[i + 1] > 120 && d[i + 2] > 120 && Math.abs(d[i] - d[i + 2]) < 50) n++;   // the silver rim
      return n;
    }, png.toString('base64'));
  };
  out.fresh = await rimPixels();
  await P.evaluate(() => { window.__lab.cars.starter.wheels.rl.pivot.visible = false; });
  out.hiddenOnPurpose = await rimPixels();
  await P.evaluate(() => { window.__lab.cars.starter.wheels.rl.pivot.visible = true; });
  out.freshAgain = await rimPixels();
  await P.evaluate(() => window.__lab.show({ car: 'starter', view: 'chase', yawDeg: 35 }));
  out.afterSlidingChase = await rimPixels();
  await P.evaluate(() => { const w = window.__lab.cars.starter.wheels.rl.mesh; w.geometry = w.geometry.clone(); });
  out.afterFreshGeometry = await rimPixels();
  out.errors = lab.errors;
  await lab.close();
} finally { await env.close(); }

const PRESENT = 20;
out.knownAnswers = [
  { name: 'wheel hidden on purpose reads as missing', value: out.hiddenOnPurpose, caught: out.hiddenOnPurpose < PRESENT },
  { name: 'wheel on a fresh page reads as present', value: out.fresh, caught: out.fresh >= PRESENT && out.freshAgain >= PRESENT },
];
out.reproduced = out.afterSlidingChase < PRESENT;
out.recoveredByFreshGeometry = out.afterFreshGeometry >= PRESENT;
writeJson(path.join(reviewDir, 'vanish.json'), out);
console.log(JSON.stringify(out));
const ok = out.knownAnswers.every(k => k.caught);
console.log((ok ? 'probe sound' : 'PROBE DEFECT') + '; anomaly ' + (out.reproduced ? 'REPRODUCED' : 'not reproduced'));
process.exit(ok ? 0 : 1);
