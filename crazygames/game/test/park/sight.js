/* PLAYGROUND MEASURE 2: SIGHT. Is the car visible from the chase
   camera through a lap of every place, and is the longest stretch
   hidden under a third of a second.

   Read every frame off the real camera and the real scene: six points
   on the car (the middle of the roof, four corners at the height of
   the windows' sills, the middle of the body) are each seen or not: a
   point is hidden when the straight line from the camera to it passes
   through a pillar or a pier that is still more opaque than the fade
   calls see-through (the scene's own opacity of that solid, that
   frame), or through the long wall or the outer wall below their
   tops. The car is hidden on a frame when more than half the points
   are.

   The laps: the grand tour (every place in one chain), six turns of
   the donut, six loops of the eight, the gate at speed, the wall ride;
   and the worst case made on purpose for every pillar and pier: the
   car set down just beyond it from the camera, driving away, so the
   solid stands square between them. Landscape and portrait (the camera
   sits higher and further back in portrait).

   Known answer: with the fade switched off, the same worst cases hide
   the car for longer than a third of a second.

   node game/test/park/sight.js   writes review/park/sight.json */
import * as P from './lib.js';

const LIMIT = 1 / 3;
const env = await P.start(), out = { limit: LIMIT, runs: [] };

/* in the page, after every frame: how many of the six points are hidden, by what, and the least opacity of any solid */
const SEE = `
  const park = F.scene.park(); if (!park) return;
  const cam = F.scene.camera.position, p = F.pose, g = Lp.app.ground, V = F.TUNE.VEHICLE;
  if (!window.__seeWalls) { window.__seeWalls = []; for (const w of g.walls) if (w.place === 'edge' || w.place === 'wall') for (let i = 0; i + 1 < w.points.length; i++) window.__seeWalls.push([w.points[i].x, w.points[i].z, w.points[i + 1].x, w.points[i + 1].z, w.place === 'wall' ? g.park.wall.h : 1.0, w.place]); }
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), lx = -Math.cos(p.yaw), lz = Math.sin(p.yaw), hl = V.HALF_LENGTH * 0.8, hw = V.HALF_WIDTH * 0.9;
  const pts = [[0, 1.2, 0], [hl, 0.9, hw], [hl, 0.9, -hw], [-hl, 0.9, hw], [-hl, 0.9, -hw], [0, 0.6, 0]].map(([f, y, l]) => [p.x + fx * f + lx * l, (p.y || 0) + y, p.z + fz * f + lz * l]);
  const solids = park.solidsState(), clear = window.__clearAt;
  let hidden = 0, by = null;
  for (const q of pts) {
    const dx = q[0] - cam.x, dy = q[1] - cam.y, dz = q[2] - cam.z;
    let blocked = null;
    for (const s of solids) {
      if (s.opacity <= clear) continue;
      /* the line against the cylinder: the stretch of it inside the circle, and whether it is below the top there */
      const ox = cam.x - s.x, oz = cam.z - s.z, a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - s.r * s.r, disc = b * b - 4 * a * c;
      if (disc <= 0) continue;
      const r0 = Math.sqrt(disc), t0 = Math.max(0, (-b - r0) / (2 * a)), t1 = Math.min(1, (-b + r0) / (2 * a));
      if (t1 <= t0) continue;
      if (Math.min(cam.y + dy * t0, cam.y + dy * t1) < s.h) { blocked = s.id; break; }
    }
    if (!blocked) for (const w of window.__seeWalls) {
      const ex = w[2] - w[0], ez = w[3] - w[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
      const t = ((w[0] - cam.x) * ez - (w[1] - cam.z) * ex) / den, u = ((w[0] - cam.x) * dz - (w[1] - cam.z) * dx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1 && cam.y + dy * t < w[4]) { blocked = w[5]; break; }
    }
    if (blocked) { hidden++; by = blocked; }
  }
  return [hidden, by, Math.min(...solids.map(s => s.opacity))];
`;
function stretches(frames) {
  let longest = 0, run = 0, worstBy = null, hiddenFrames = 0, partly = 0;
  for (const f of frames) { if (f[0] > 3) { run++; hiddenFrames++; if (run > longest) { longest = run; worstBy = f[1]; } } else run = 0; if (f[0] > 0) partly++; }
  return { frames: frames.length, hiddenFrames, partly, longest: +(longest / 60).toFixed(3), by: worstBy, faded: frames.filter(f => f[2] < 0.5).length };
}

for (const vp of [P.LANDSCAPE, P.PORTRAIT]) {
  const pg = await P.parkPage(env, vp, 'fx=none'), page = pg.page, t = P.tag(vp);
  out.clearAt = await page.evaluate(async () => { const m = await import('/src/env/park.js'); window.__clearAt = m.PARK_LOOK.FADE.clear; return window.__clearAt; });
  await P.ownCar(page, 'starter', null);
  for (const [name, o] of [['the grand tour', { line: 'tour', seconds: 70 }], ['six turns of the donut', { line: 'donut', args: [6], seconds: 60 }], ['six loops of the eight', { line: 'eight', args: [6], seconds: 70 }], ['the gate at speed', { line: 'gate', args: [true, { off: -3, lead: 16, dir: -1 }], seconds: 26, tail: 0.5 }], ['the wall ride', { line: 'wall', args: [1.5], seconds: 40 }]]) {
    const d = await P.drive(page, Object.assign({ noRec: true, each: SEE }, o));
    const s = stretches(d.frames);
    out.runs.push(Object.assign({ view: t, name }, s));
    P.say(s.frames > 300 && s.longest < LIMIT, t + ' ' + name + ': ' + s.frames + ' frames, the car hidden on ' + s.hiddenFrames + ' of them, the longest stretch ' + s.longest + ' s' + (s.by ? ' (by ' + s.by + ')' : '') + ', under ' + LIMIT.toFixed(2) + '; partly hidden on ' + s.partly + '; a solid faded on ' + s.faded);
  }
  /* the worst case for each solid: the car set down beyond it from the camera, driving away */
  const worst = async fade => page.evaluate(({ SEE, fade }) => {
    const F = window.__feel, Lp = window.__loop, see = new Function('F', 'Lp', SEE), res = [];
    Lp.action('free'); F.scene.park().setFade(fade);
    for (const s of Lp.app.ground.park.solids) for (const yaw of [0, 1.57, 3.14, -1.57]) {
      F.restart();
      const c = F.world.car, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      c.x = s.x + fx * (s.r + 3.2); c.z = s.z + fz * (s.r + 3.2); c.yaw = yaw; c.wvx = fx * 9; c.wvz = fz * 9;
      F.chase.reset({ yaw });
      F.inject = { steer: 0, throttle: 1, brake: 0, handbrake: 0 };
      const frames = [];
      for (let i = 0; i < 150; i++) { window.__clock += 1000 / 60; F.frame(window.__clock); const r = see(F, Lp); if (r) frames.push(r); }
      F.inject = null;
      let longest = 0, run = 0; for (const f of frames) { if (f[0] > 3) { run++; if (run > longest) longest = run; } else run = 0; }
      res.push({ id: s.id, yaw, longest: longest / 60, faded: frames.filter(f => f[2] < 0.5).length });
    }
    F.scene.park().setFade(true);
    return res;
  }, { SEE, fade });
  const on = await worst(true), off = await worst(false);
  const wOn = on.reduce((a, b) => b.longest > a.longest ? b : a), wOff = off.reduce((a, b) => b.longest > a.longest ? b : a), caught = off.filter(r => r.longest >= LIMIT).length;
  out.runs.push({ view: t, name: 'worst cases', cases: on.length, longest: +wOn.longest.toFixed(3), by: wOn.id, fadedCases: on.filter(r => r.faded > 0).length, known: { longest: +wOff.longest.toFixed(3), by: wOff.id, over: caught } });
  P.say(wOn.longest < LIMIT && on.filter(r => r.faded > 0).length >= on.length * 0.5, t + ' the worst case for every pillar and pier (' + on.length + ' cases: the car set down just beyond each, four ways, driving away with the solid square between it and the camera): the longest stretch hidden is ' + wOn.longest.toFixed(3) + ' s (' + wOn.id + '), under ' + LIMIT.toFixed(2) + '; the solid faded in ' + on.filter(r => r.faded > 0).length + ' of them');
  P.say(caught >= on.length * 0.5 && wOff.longest >= LIMIT, t + ' known answer: with the fade switched off the same cases hide the car for up to ' + wOff.longest.toFixed(2) + ' s, ' + caught + ' of ' + off.length + ' over the limit: ' + (caught > 0 ? 'CAUGHT' : 'MISSED'));
  if (pg.errors.length) P.say(false, t + ' page errors: ' + pg.errors.slice(0, 2).join(' | '));
  await pg.close();
}
await P.finish(env, 'sight.json', out);
