/* BOTH BACKENDS (briefs/COVER-LOOK.md, measure 7): every new thing the
   look draws is drawn on WebGL 2 and on WebGPU, both tiers, and read
   back off the screen (WebGL 2: the page's screenshot; WebGPU: the
   texture the renderer drew into, game/test/webgpu/lib.js). The frame:
   career track 1 at floodlit dusk (the look's lights all on, the road
   wet) mid race, the chase camera; each thing is taken out of the same
   frame (nothing is stepped between the two pictures) and the pixels
   that change are counted: a thing that draws changes at least MIN of
   them. The environment is taken out by dropping it from the scene;
   the antialiasing by drawing the frame through the look's pipeline
   without it (?aa=0, a second page at the same moment). The showroom's
   studio is checked in the garage.
   The floodlights' lamps are looked at from a camera facing a tower's
   head (21 m up, they are above the chase camera's picture then).
   Known answer: the floodlights' lamps hidden on purpose in both
   pictures, from that camera, read as missing.

   node game/test/look/backends.js [--backends webgl2,webgpu] [--tiers low,high]   writes review/look/backends.json */
import path from 'node:path';
import * as L from './lib.js';
import * as W from '../webgpu/lib.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const backends = arg('--backends', 'webgl2,webgpu').split(','), tiers = arg('--tiers', 'low,high').split(',');
const VP = { width: 960, height: 540 }, MIN = 40, TOL = 6;
/* the new things, by what takes each out of the frame */
const THINGS = [
  ['floodlight towers', 'name', 'prop:flood'],
  ['floodlight lamps', 'name', 'lit:flood'],
  ['catch fence', 'name', 'venue:fence'],
  ['fence posts', 'name', 'venue:posts'],
  ['barriers in panels', 'name', 'wall'],
  ['the wet road (its material)', 'name', 'road'],
  ['pools of light', 'name', 'dress:pools'],
  ['glows: flares and wet streaks', 'name', 'glows'],
  ['smoke', 'name', 'smoke'],
  ['the car (clear coat, trim, glass)', 'car', null],
  ['the environment in the reflections', 'env', null],
];
const TOGGLE = `
  const S = window.__feel.scene, sc = S.scene, [kind, name, on] = extra;
  if (kind === 'name') sc.traverse(o => { if (o.name === name) o.visible = on; });
  else if (kind === 'car') S.car.visible = on;
  else if (kind === 'env') { if (!window.__env) window.__env = sc.environment; sc.environment = on ? window.__env : null; }
  return true;
`;
/* the floodlights' heads stand 21 m up, above the chase camera's picture at that moment: the lamps are
   looked at from a camera put 31 m from a tower's head, and the camera put back after */
const AIM = `
  const S = window.__feel.scene, T = S.THREE, cam = S.camera; let lit = null;
  S.scene.traverse(o => { if (o.name === 'lit:flood') lit = o; });
  if (extra === 'save') { window.__chase = { p: cam.position.clone(), q: cam.quaternion.clone() }; return !!lit; }
  if (extra === 'back') { cam.position.copy(window.__chase.p); cam.quaternion.copy(window.__chase.q); cam.updateMatrixWorld(); return true; }
  const m = new T.Matrix4(), b = new T.Box3(); lit.getMatrixAt(0, m);
  lit.geometry.computeBoundingBox(); b.copy(lit.geometry.boundingBox).applyMatrix4(m);
  const c = b.getCenter(new T.Vector3()); cam.position.set(c.x + 22, c.y - 6, c.z + 22); cam.lookAt(c); cam.updateMatrixWorld();
  return true;
`;
const draw = page => page.evaluate(() => { const F = window.__feel, Lp = window.__loop; F.draw = true; const d = () => Lp.app.state === 'garage' ? Lp.showroom.render() : F.scene.render(); d(); d(); F.draw = false; return new Promise(r => setTimeout(r, 60)); });

async function picture(backend, page) {
  await draw(page);
  if (backend === 'webgpu') return W.grab(page);
  return L.decode(await page.screenshot({ timeout: 180000 }));
}
/* in software a WebGPU page now and then never gets its device and never becomes ready: such a page is
   given up after a minute and the browser started again, three times at most */
let env = null;
async function open(backend, _env, tier, query) {
  const q = 'tier=' + tier + '&adapt=0&title=1&look=2' + (query || '');
  let pg = null;
  if (backend !== 'webgpu') pg = await L.openPage(env, VP, q);
  else for (let attempt = 0; !pg; attempt++) {
    try { pg = await W.open(env, VP, q, { timeout: 60000 }); }
    catch (e) { if (attempt >= 3) throw e; console.log('(again after: ' + String(e.message || e).split('\n')[0] + ')'); await env.close().catch(() => {}); env = await W.start(); }
  }
  await pg.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} const S = window.__loop.save; S.reset(); S.setOnboarded(); for (let i = 0; i < 24; i++) S.careerResult(i, 3, 100000); });
  return pg;
}
async function frameAt(pg) {
  await L.dress(pg.page, L.HERO);
  await L.raceTo(pg.page, { rival: 'r1', to: 560 });
  await L.hud(pg.page, false);
}
const changed = (A, B) => L.diffMask(A, B, TOL).n;

const out = {};
for (const backend of backends) {
  env = backend === 'webgpu' ? await W.start() : await L.start();
  for (const tier of tiers) {
    const key = backend + ' ' + tier, rows = {};
    const pg = await open(backend, env, tier);
    await frameAt(pg);
    const info = await L.sceneInfo(pg.page);
    const base = await picture(backend, pg.page);
    const aim = how => pg.page.evaluate(new Function('extra', AIM), how);
    for (const [label, kind, name] of THINGS) {
      const lamps = name === 'lit:flood';
      if (lamps) { await aim('save'); await aim('head'); }
      const before = lamps ? await picture(backend, pg.page) : base;
      await pg.page.evaluate(new Function('extra', TOGGLE), [kind, name, false]);
      const without = await picture(backend, pg.page);
      await pg.page.evaluate(new Function('extra', TOGGLE), [kind, name, true]);
      if (lamps) await aim('back');
      rows[label] = changed(before, without);
      L.say(rows[label] >= MIN, key + ' (' + info.backend + '): ' + label + ' drawn, ' + rows[label] + ' pixels change without it' + (lamps ? ' (seen from 31 m off a tower\'s head)' : ''));
    }
    /* the known answer: the lamps hidden on purpose in both pictures, from the camera that sees them */
    await aim('save'); await aim('head');
    await pg.page.evaluate(new Function('extra', TOGGLE), ['name', 'lit:flood', false]);
    const k1 = await picture(backend, pg.page), k2 = await picture(backend, pg.page);
    await pg.page.evaluate(new Function('extra', TOGGLE), ['name', 'lit:flood', true]);
    await aim('back');
    rows['known answer'] = changed(k1, k2);
    L.say(rows['known answer'] < MIN, key + ': known answer, the lamps hidden on purpose in both pictures read as missing (' + rows['known answer'] + ' pixels change): ' + (rows['known answer'] < MIN ? 'CAUGHT' : 'MISSED'));
    if (pg.errors.length) console.log('page errors: ' + pg.errors.slice(0, 3).join(' | '));
    await pg.close();
    /* the antialiasing: the same moment drawn without it */
    const off = await open(backend, env, tier, '&aa=0');
    await frameAt(off);
    const noAa = await picture(backend, off.page);
    await off.close();
    rows['antialiasing'] = changed(base, noAa);
    L.say(rows['antialiasing'] >= MIN, key + ': antialiasing drawn, ' + rows['antialiasing'] + ' pixels change without it');
    /* the showroom's studio */
    const gp = await open(backend, env, tier);
    await L.dress(gp.page, L.HERO);
    await L.openGarage(gp.page, 0, 'paint');
    const withStudio = await picture(backend, gp.page);
    await gp.page.evaluate(() => { const s = window.__loop.showroom.scene; window.__studio = s.environment; s.environment = null; });
    const noStudio = await picture(backend, gp.page);
    await gp.close();
    rows['the showroom\'s studio'] = changed(withStudio, noStudio);
    L.say(rows['the showroom\'s studio'] >= MIN, key + ': the showroom\'s studio drawn in the paint, ' + rows['the showroom\'s studio'] + ' pixels change without it');
    out[key] = { backend: info.backend, tier: info.tier, rows };
  }
  await env.close();
}
L.writeJson(path.join(L.lookDir, 'backends.json'), out);
console.log(L.failed() ? L.failed() + ' failed' : 'all passed');
process.exit(L.failed() ? 1 : 0);
