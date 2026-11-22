/* CAR ON SCREEN (briefs/COVER-LOOK.md, measure 3): the player's car's
   projected width as a share of the screen's, in a race, over 600
   frames from GO, at 1280x720, 844x390 and 390x844. The car's box (the
   model's own measured dims, turned with it) is projected through the
   camera as the frame left it (the chase camera and the director's
   moves over it), and its width across the screen divided by the
   screen's. Three races (day, dusk and night), so the corners and the
   straights of three tracks are in it. Nothing is drawn.
   With ?look=2 the median must be 14 to 18 per cent in landscape, and
   portrait about the same (reported).
   Known answer: the camera as on main (no switch) measures about 8 per
   cent and fails.

   node game/test/look/carsize.js   writes review/look/carsize.json */
import path from 'node:path';
import * as L from './lib.js';

const FRAMES = 600;
const SHARE = `
  const S = window.__feel.scene, m = S.carModel(), cam = S.camera, T = S.THREE, d = m.dims;
  S.car.updateMatrixWorld(true); cam.updateMatrixWorld();
  let x0 = Infinity, x1 = -Infinity;
  const v = new T.Vector3();
  for (const x of [-d.halfWidth, d.halfWidth]) for (const y of [0, d.height]) for (const z of [(d.centreZ || 0) - d.halfLength, (d.centreZ || 0) + d.halfLength]) {
    v.set(x, y, z).applyMatrix4(m.group.matrixWorld).project(cam);
    if (v.z > 1) continue;
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
  }
  return x1 > x0 ? Math.min(2, x1 - x0) / 2 : null;
`;
async function measure(env, vp, query) {
  const all = [];
  for (const race of ['day', 'dusk', 'night']) {
    const pg = await L.page(env, vp, 'tier=low' + query);
    await L.dress(pg.page, L.STARTER);
    await L.raceTo(pg.page, { rival: L.RACES[race].rival, to: 0 });
    const shares = await L.runFrames(pg.page, FRAMES, SHARE);
    all.push(...shares.filter(s => s !== null));
    await pg.close();
  }
  const s = all.slice().sort((a, b) => a - b), q = k => s[Math.min(s.length - 1, Math.floor(k * s.length))];
  return { frames: all.length, median: +(q(0.5) * 100).toFixed(1), p10: +(q(0.1) * 100).toFixed(1), p90: +(q(0.9) * 100).toFixed(1) };
}

const env = await L.start();
const out = {};
for (const [name, vp] of [['1280x720', L.LAND], ['844x390', L.PHONE_LAND], ['390x844', L.PORT]]) {
  const look = await measure(env, vp, '&look=2'), main = await measure(env, vp, '');
  out[name] = { look, main };
  const land = vp.width > vp.height;
  if (land) L.say(look.median >= 14 && look.median <= 18, name + ' with ?look=2: the car is ' + look.median + ' per cent of the screen\'s width (median of ' + look.frames + ' frames, 10th to 90th centile ' + look.p10 + ' to ' + look.p90 + '); between 14 and 18 asked');
  else console.log('INFO ' + name + ' with ?look=2: ' + look.median + ' per cent (10th to 90th ' + look.p10 + ' to ' + look.p90 + ')');
  L.say(!(main.median >= 14 && main.median <= 18), 'known answer, ' + name + ': the camera as on main measures ' + main.median + ' per cent: ' + (land ? (main.median >= 14 && main.median <= 18 ? 'MISSED' : 'CAUGHT, it fails the band') : 'reported'));
}
L.writeJson(path.join(L.lookDir, 'carsize.json'), out);
await env.close();
console.log(L.failed() ? L.failed() + ' failed' : 'all passed');
process.exit(L.failed() ? 1 : 0);
