/* REFLECTIONS (briefs/COVER-LOOK.md, measure 1): in the showroom and in
   a race, the paint on the bonnet shows the environment. The bonnet is
   found from the car's own model (its paint triangles that face up,
   ahead of the windscreen and facing the camera), their middles are
   projected to the screen, and the brightness of the frame's pixels
   there is read. The spread of that brightness (the 90th centile less
   the 10th) with the environment must be at least twice the spread
   without it (?env=0: the same look, the sky's flat fill back on the
   car, no environment). A flat painted bonnet lit by a sun and a fill
   is nearly one shade; one that mirrors a sky with a horizon, stands
   and lights is many.
   Known answer: the environment removed from the "with" side too (both
   sides ?env=0): the ratio falls to about one and the probe fails.

   node game/test/look/reflect.js [--only showroom,race] [--presets twilight,dusk]   writes review/look/reflect.json */
import path from 'node:path';
import * as L from './lib.js';

const BONNET = `
  const model = extra.where === 'showroom' ? window.__loop.showroom.model() : window.__feel.scene.carModel();
  const cam = extra.where === 'showroom' ? window.__loop.showroom.camera : window.__feel.scene.camera;
  const T = window.__feel.scene.THREE, body = model.group.getObjectByName('body'), g = body.geometry, pos = g.attributes.position;
  body.updateMatrixWorld(true); cam.updateMatrixWorld();
  const paint = g.groups.find(q => q.materialIndex === 0), fa = model.dims.frontAxle, out = [];
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), n = new T.Vector3(), m = new T.Vector3(), eye = new T.Vector3(), nm = new T.Matrix3().getNormalMatrix(body.matrixWorld);
  cam.getWorldPosition(eye);
  const ray = new T.Raycaster(), dir = new T.Vector3();
  model.group.updateMatrixWorld(true);
  for (let i = paint.start; i < paint.start + paint.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(m.subVectors(c, a)).normalize();
    m.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    if (m.z > fa + 0.35 || n.y < 0.55) continue;             // the bonnet: ahead of the front axle and a little behind it, facing up
    n.applyMatrix3(nm).normalize(); m.applyMatrix4(body.matrixWorld);
    if (n.dot(eye.clone().sub(m)) <= 0) continue;            // facing the camera
    /* in sight: nothing of the car's own between the camera and the facet's middle */
    dir.subVectors(m, eye); const d = dir.length(); ray.set(eye, dir.normalize()); ray.far = d + 0.05;
    const hit = ray.intersectObject(model.group, true).find(h => h.object.isMesh && h.object.name !== 'underglow');
    if (!hit || hit.distance < d - 0.03) continue;
    const p = m.clone().project(cam);
    if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) continue;
    out.push([(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]);
  }
  return out;
`;

async function measure(env, where, query, preset) {
  const pg = await L.page(env, L.LAND, 'tier=high' + query);
  await L.dress(pg.page, L.HERO);
  if (where === 'showroom') {
    await L.openGarage(pg.page, 0, 'paint');
    await L.runFrames(pg.page, 2);
  } else {
    /* the race of the cover pair, at its step, seen from the cover's camera, where the whole bonnet shows */
    await L.raceTo(pg.page, { rival: 'r3', to: 651, hands: 'r6', mult: 4, preset });
    await L.coverCamera(pg.page, [7.6, 1.0, 205, 30, 0.9, 0]);
  }
  await L.hud(pg.page, false);
  await pg.page.evaluate(w => { if (w === 'showroom') { const s = window.__loop.showroom; s.state.angle = Math.PI * 0.82; s.state.vel = 0; s.state.hold = 1e9; s.update(0); } }, where);   // three quarters from the front, held still
  const png = await L.snap(pg.page, path.join(L.lookShots, 'reflect-' + where + (preset ? '-' + preset : '') + (query.includes('env=0') ? '-off' : '-on') + '.png'));
  const pts = await pg.page.evaluate(new Function('extra', BONNET), { where });
  const img = await L.decode(png), lum = [];
  for (const [x, y] of pts) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const px = Math.round(x) + dx, py = Math.round(y) + dy;
      if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
      const k = (py * img.w + px) * 4; lum.push(L.lumOf(img.d[k], img.d[k + 1], img.d[k + 2]));
    }
  }
  await pg.close();
  /* the spread: the standard deviation, which sees a few facets turned bright by a reflection (a centile range does not, when they are under a tenth of the bonnet) */
  const mean = lum.reduce((s, v) => s + v, 0) / Math.max(1, lum.length), spread = Math.sqrt(lum.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, lum.length));
  return { where, query, points: pts.length, pixels: lum.length, mean: +mean.toFixed(4), p10: +L.pct(lum, 0.1).toFixed(4), p90: +L.pct(lum, 0.9).toFixed(4), max: +Math.max(...lum).toFixed(4), spread: +spread.toFixed(4) };
}

const env = await L.start();
const out = {};
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : ['showroom', 'race'];
/* the race at the cover pair's time of day (the floodlit dusk, lamps on) and at the race's own (dusk, lamps off) */
const presets = process.argv.includes('--presets') ? process.argv[process.argv.indexOf('--presets') + 1].split(',') : ['twilight', 'dusk'];
const cases = only.flatMap(w => w === 'race' ? presets.map(p => [w, p]) : [[w, null]]);
for (const [where, preset] of cases) {
  const key = where + (preset ? ' ' + preset : '');
  const on = await measure(env, where, '&look=2', preset), off = await measure(env, where, '&look=2&env=0', preset), known = await measure(env, where, '&look=2&env=0', preset);
  const ratio = on.spread / Math.max(1e-6, off.spread), knownRatio = known.spread / Math.max(1e-6, off.spread);
  out[key] = { on, off, ratio: +ratio.toFixed(2), known: { ...known, ratio: +knownRatio.toFixed(2) } };
  L.say(ratio >= 2 && on.points >= 6, key + ': the bonnet\'s brightness spread with the environment ' + on.spread.toFixed(3) + ' over ' + on.points + ' facets, without it ' + off.spread.toFixed(3) + ': x' + ratio.toFixed(2) + ' (at least x2)');
  L.say(knownRatio < 2, 'known answer, ' + key + ': the environment removed from both sides gives x' + knownRatio.toFixed(2) + ': ' + (knownRatio < 2 ? 'CAUGHT' : 'MISSED'));
}
L.writeJson(path.join(L.lookDir, 'reflect.json'), out);
await env.close();
console.log(L.failed() ? L.failed() + ' failed' : 'all passed');
process.exit(L.failed() ? 1 : 0);
