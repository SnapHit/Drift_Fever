/* RIVALS MEASURE 7: THE CAMERA. Through the battle's countdown sweep,
   every frame at 60 Hz: the camera is never inside either car (each
   car's box from the road to its roof, grown by MARGIN), and at GO both
   cars are wholly in view (the eight corners of each box inside the
   view). For every rival on his track, at 1280x720 and 390x844.
   Known answer: the solo sweep (DIRECTOR.BATTLE off), with the rival
   on the grid straight ahead (TANDEM.STAGGER_SIDE 0), starts inside him.

   node game/test/rivals/camera.js   writes review/rivals/camera.json */
import path from 'node:path';
import * as R from './lib.js';

const MARGIN = 0.3;
const env = await R.start();
const out = { margin: MARGIN, runs: [] };
const ids = await (async () => { const pg = await R.page(env, { width: 200, height: 200 }, ''); const v = await pg.page.evaluate(() => window.__loop.RIVALS.map(r => r.id)); await pg.close(); return v; })();

async function sweep(id, vp, flip) {
  const pg = await R.page(env, vp, '');
  const r = await pg.page.evaluate(async ({ id, MARGIN, flip }) => {
    if (flip) { const d = await import('/src/camera/director.js'); d.DIRECTOR.BATTLE = false; window.__loop.TANDEM.STAGGER_SIDE = 0; }
    const Lp = window.__loop, F = window.__feel, A = Lp.app, THREE = F.scene.THREE;
    window.__clock = 1000; Lp.startRun(Lp.battleSpec(id)); F.draw = false;
    const cam = F.scene.camera, v = new THREE.Vector3();
    const boxOf = (c, hl, hw) => ({ c, hl: hl + MARGIN, hw: hw + MARGIN, h: 1.45 + MARGIN });
    const inside = (b, p) => { const c = b.c, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), lx = -Math.cos(c.yaw), lz = Math.sin(c.yaw), dx = p.x - c.x, dz = p.z - c.z, f = dx * fx + dz * fz, l = dx * lx + dz * lz, y = p.y - (c.y || 0); return Math.abs(f) <= b.hl && Math.abs(l) <= b.hw && y >= -MARGIN && y <= b.h; };
    const view = b => { let worst = -Infinity; const c = b.c, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), lx = -Math.cos(c.yaw), lz = Math.sin(c.yaw); for (const f of [-1, 1]) for (const l of [-1, 1]) for (const y of [0, 1.45]) { v.set(c.x + fx * f * (b.hl - MARGIN) + lx * l * (b.hw - MARGIN), (c.y || 0) + y, c.z + fz * f * (b.hl - MARGIN) + lz * l * (b.hw - MARGIN)).project(cam); worst = Math.max(worst, Math.abs(v.x) - 1, Math.abs(v.y) - 1, v.z > 1 ? 1 : -1); } return worst; };
    let frames = 0, insideMe = 0, insideHim = 0, minMe = Infinity, minHim = Infinity, atGo = null;
    const pv = F.world.car, rv = Lp.rival().world.car, hlP = F.world.tune ? F.world.tune.VEHICLE.HALF_LENGTH : F.TUNE.VEHICLE.HALF_LENGTH, hwP = F.world.tune ? F.world.tune.VEHICLE.HALF_WIDTH : F.TUNE.VEHICLE.HALF_WIDTH;
    while (A.state === 'countdown' && frames < 400) {
      window.__clock += 1000 / 60; F.frame(window.__clock); frames++;
      cam.updateMatrixWorld();
      const me = boxOf(pv, hlP, hwP), him = boxOf(rv, Lp.rival().box.halfLength, Lp.rival().box.halfWidth);
      if (inside(me, cam.position)) insideMe++;
      if (inside(him, cam.position)) insideHim++;
      minMe = Math.min(minMe, Math.hypot(cam.position.x - pv.x, cam.position.z - pv.z)); minHim = Math.min(minHim, Math.hypot(cam.position.x - rv.x, cam.position.z - rv.z));
      if (A.state !== 'countdown') atGo = { me: view(me), him: view(him) };
    }
    if (!atGo) { cam.updateMatrixWorld(); atGo = { me: view(boxOf(pv, hlP, hwP)), him: view(boxOf(rv, Lp.rival().box.halfLength, Lp.rival().box.halfWidth)) }; }
    return { frames, insideMe, insideHim, minMe: +minMe.toFixed(2), minHim: +minHim.toFixed(2), atGo };
  }, { id, MARGIN, flip });
  await pg.close();
  return r;
}
for (const id of ids) for (const vp of [R.LANDSCAPE, R.PORTRAIT]) {
  const r = await sweep(id, vp, false);
  out.runs.push({ id, size: R.tagOf(vp), ...r });
  R.verdict(r.insideMe === 0 && r.insideHim === 0 && r.atGo.me <= 0 && r.atGo.him <= 0, id + ' ' + R.tagOf(vp) + ': ' + r.frames + ' frames of the sweep, inside the player ' + r.insideMe + ', inside him ' + r.insideHim + ' (closest ' + r.minMe + ' and ' + r.minHim + ' m); at GO both in view: player ' + (r.atGo.me <= 0) + ', rival ' + (r.atGo.him <= 0));
}
const ka = await sweep(ids[0], R.LANDSCAPE, true);
out.knownAnswer = ka;
R.verdict(ka.insideHim > 0 || ka.atGo.him > 0, 'known answer: the solo sweep with him straight ahead passes inside him in ' + ka.insideHim + ' frames (closest ' + ka.minHim + ' m) or leaves him out at GO (' + (ka.atGo.him > 0) + '): ' + (ka.insideHim > 0 || ka.atGo.him > 0 ? 'CAUGHT' : 'MISSED'));
R.writeJson(path.join(R.rivalsDir, 'camera.json'), out);
await env.close();
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
