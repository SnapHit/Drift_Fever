/* THE CAMERA PROBE, after play on 28 October 2026 found the greybox slow
   and swaying.

   1. Sense of speed. How fast the road surface at the car moves down the
      screen, in pixels per world unit travelled, against the live game's
      own projection at the same viewport (projectPoint: the ground at
      depth z sits CAMERA_DEPTH * camHeight * h/2 / z below the horizon,
      and the car is at z = CAMERA_DISTANCE). The greybox side is read off
      the page's own three.js camera, projecting the road under the car
      and a point 50 units ahead. Pass: at least 1.0 of the live game in
      both viewports. Known answer: the stage 2 portrait rig must come out
      under 1.0.

   2. The camera stays on the car. On a drive with deep drifts, every frame,
      how far the car sits from the screen's centre line, in pixels at the
      car's depth. Pass: worst under 3 per cent of the screen width.
      Known answer: the stage 2 follow (the simulation's cameraX, carX
      times 0.55) must fail.

   node probes/camera.js   writes review/stage-2/camera.json */
import path from 'node:path';
import * as L from './lib.js';
import * as J from '../parity/jobs.js';

const env = await L.start();
const day = 20261001;
const job = { day, level: 3, mode: 'DAILY', seed: J.seedOf(day, 3, 'driver'), tape: 'driver', maxFrames: 1500 };
const OLD_PORTRAIT = { fov: 100, back: 5594, height: 6038, pitch: 28.7 };
const out = { started: new Date().toISOString(), viewports: {}, knownAnswers: {} };

async function measure(viewport, opts) {
  const s = await L.openSide(env, 'page', viewport, day);
  const r = await s.page.evaluate(({ job, opts }) => {
    const S = window.__S, P = S.world.probe, W = P.W, F = S.get('FEEL');
    if (opts.rig) Object.assign(window.innerHeight > window.innerWidth ? W.PORTRAIT : W.LANDSCAPE, opts.rig);
    S.world.renderer.render = () => {};
    const w = window.innerWidth, h = window.innerHeight;
    /* the live game's rate at this viewport */
    const depth = 1 / Math.tan((F.FIELD_OF_VIEW_DEG / 2) * Math.PI / 180);
    const liveRate = depth * F.CAMERA_HEIGHT * (h / 2) / (F.CAMERA_DISTANCE * F.CAMERA_DISTANCE);
    let speed = null, worst = 0, worstFrame = -1, n = 0, sum = 0;
    const offsets = [];
    window.driveProbe.drive(S, job, { frame: (k) => {
      if (S.get('state') !== S.get('DRIVING') || S.get('countdown') > 0) return;
      const cam = P.cameraPos();
      const camX = opts.oldFollow ? S.get('cameraX') : cam.x;
      /* the car's ground point is at x = carX, y = carGroundY, z = 0 in the frame the world is built in */
      const rig = P.rig();
      const dist = Math.hypot(rig.back, rig.height);
      const hfovTan = Math.tan((rig.fov / 2) * Math.PI / 180) * (w / h);
      const px = Math.abs(S.get('carX') - camX) / (dist * hfovTan) * (w / 2);
      offsets.push(px); sum += px; n++;
      if (px > worst) { worst = px; worstFrame = k; }
      if (speed === null) {
        /* the camera geometry, as world.js sets it: behind the car by back, above by height, pitched down */
        const f = (h / 2) / Math.tan((rig.fov / 2) * Math.PI / 180), p = rig.pitch * Math.PI / 180;
        const proj = (z) => { const dy = -rig.height, dz = z - rig.back; const fwd = -dy * Math.sin(p) - dz * Math.cos(p); const up = dy * Math.cos(p) - dz * Math.sin(p); return h / 2 - f * up / fwd; };
        speed = (proj(0) - proj(-50)) / 50 / liveRate;
      }
    } });
    offsets.sort((a, b) => a - b);
    return { liveRate, speedRatio: speed, rig: P.rig(), frames: n, worstPx: worst, worstFrame, p95Px: offsets[Math.floor(offsets.length * 0.95)] || 0, meanPx: n ? sum / n : 0, width: w };
  }, { job, opts: opts || {} });
  await s.close();
  return r;
}

let pass = true;
for (const vp of [J.VIEW, J.VIEW_WIDE || { width: 1280, height: 720 }]) {
  const r = await measure(vp);
  r.speedPass = r.speedRatio >= 1.0;
  r.centrePass = r.worstPx < 0.03 * r.width;
  pass = pass && r.speedPass && r.centrePass;
  out.viewports[vp.width + 'x' + vp.height] = r;
  console.log(vp.width + 'x' + vp.height, 'speed x' + r.speedRatio.toFixed(2), 'off centre worst ' + r.worstPx.toFixed(1) + ' px p95 ' + r.p95Px.toFixed(1) + ' over ' + r.frames + ' frames');
}
{
  const r = await measure(J.VIEW, { rig: OLD_PORTRAIT });
  out.knownAnswers.oldPortraitRigIsSlow = { speedRatio: r.speedRatio, caught: r.speedRatio < 1.0 };
  const o = await measure(J.VIEW, { oldFollow: true });
  out.knownAnswers.oldFollowSways = { worstPx: o.worstPx, p95Px: o.p95Px, caught: o.worstPx >= 0.03 * o.width };
  console.log('known answers:', JSON.stringify(out.knownAnswers));
  pass = pass && out.knownAnswers.oldPortraitRigIsSlow.caught && out.knownAnswers.oldFollowSways.caught;
}
out.pass = pass; out.finished = new Date().toISOString();
L.writeJson(path.join(L.root, 'review', 'stage-2', 'camera.json'), out);
console.log(pass ? 'PASS' : 'FAIL');
await env.close();
process.exit(pass ? 0 : 1);
