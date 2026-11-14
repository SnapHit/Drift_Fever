/* PLAYGROUND MEASURE 1: THE PARK. In the page, on the game's own
   ground and the game's own physics.

   1. Its size: the area inside the outer wall against the car park it
      replaces (150 by 110 m): the brief asks about three to four
      times.
   2. Every place can be reached from the start without touching a
      wall: a flood from the start over a half metre grid of every spot
      where the car fits clear of every wall whichever way it points
      (its half diagonal and a quarter metre), which must reach every
      place asked of it and every such spot in the park. And driven:
      the hands on grip from the start to six places, no wall contact.
      Known answer: the flood does not enter a pillar.
   3. The car cannot leave: a driver aimed at a point every 12.5 m
      round the outer wall, corners included, flat out, in the plain
      starter and in the fastback fully upgraded, from the start and
      from two far corners so it arrives at speed: no part of the body
      is ever outside the wall or inside a solid.
      Known answer: a gap cut in the outer wall at the aim is caught
      (the same harness, the same driver).
   4. Getting unstuck: the car driven nose first into each wall and
      each solid and held there with the throttle on until the game's
      stuck recovery acts; where it is put down must be open ground
      (clear of everything, and able to drive off). The start itself,
      where a restart puts the car, is open ground.
      Known answer: a recovery that puts the car inside a pillar is
      caught by the same check.

   node game/test/park/park.js   writes review/park/park.json */
import * as P from './lib.js';

const env = await P.start(), out = {};
const pg = await P.parkPage(env, P.LANDSCAPE, 'fx=none');
const page = pg.page;
await page.evaluate(() => { window.__feel.draw = false; window.__loop.action('free'); });

/* ---- 1 and 2: size and the flood ---- */
const flood = await page.evaluate(() => {
  const g = window.__loop.app.ground, G = g.park, b = g.bounds, V = window.__feel.TUNE.VEHICLE;
  const need = Math.hypot(V.HALF_LENGTH, V.HALF_WIDTH) + 0.25, cell = 0.5;
  const segs = []; for (const w of g.walls) for (let i = 0; i + 1 < w.points.length; i++) segs.push([w.points[i].x, w.points[i].z, w.points[i + 1].x, w.points[i + 1].z]);
  const gap = (x, z) => { let best = Infinity; for (const s of segs) { const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz; let t = ((x - s[0]) * dx + (z - s[1]) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t); if (d < best) best = d; } return best; };
  const cols = Math.round((b.maxX - b.minX) / cell) + 1, rows = Math.round((b.maxZ - b.minZ) / cell) + 1, free = new Uint8Array(cols * rows), seen = new Uint8Array(cols * rows);
  /* a spot inside a solid is not free however far its faces are */
  const inside = (x, z) => G.solids.some(s => Math.hypot(x - s.x, z - s.z) < s.r) || (() => { const W = G.wall, d = Math.hypot(x - W.x, z - W.z); let a = Math.atan2(z - W.z, x - W.x); while (a < W.a0) a += 2 * Math.PI; return a <= W.a1 && Math.abs(d - W.r) < W.half; })();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = b.minX + c * cell, z = b.minZ + r * cell; free[r * cols + c] = !inside(x, z) && gap(x, z) >= need ? 1 : 0; }
  const at = (x, z) => Math.round((z - b.minZ) / cell) * cols + Math.round((x - b.minX) / cell);
  const q = [at(g.start.x, g.start.z)]; seen[q[0]] = 1;
  while (q.length) { const k = q.pop(), c = k % cols, r = (k - c) / cols; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue; const j = rr * cols + cc; if (free[j] && !seen[j]) { seen[j] = 1; q.push(j); } } }
  const E = G.eight, S = G.slalom, W = G.wall, mid = (W.a0 + W.a1) / 2;
  const places = [];
  G.donut.rings.forEach(rr => { for (const a of [0, 1.57, 3.14, 4.71]) places.push(['donut ring ' + rr + ' m', G.donut.x + Math.cos(a) * rr, G.donut.z + Math.sin(a) * rr]); });
  for (const [n, p] of [['west', E.a], ['east', E.b]]) for (const [m, dx, dz] of [['north', 0, -12], ['south', 0, 12], ['west', -12, 0], ['east', 12, 0]]) places.push(['eight ' + n + ' pillar, ' + m + ' of it', p.x + dx, p.z + dz]);
  for (let i = 0; i + 1 < S.n; i++) places.push(['between cones ' + (i + 1) + ' and ' + (i + 2), (S.x[i] + S.x[i + 1]) / 2, S.z]);
  places.push(['west end of the cone line', S.x[0] - 12, S.z], ['east end of the cone line', S.x[S.n - 1] + 12, S.z]);
  for (const a of [W.a0 + 0.2, mid, W.a1 - 0.2]) { places.push(['inside the long wall', W.x + Math.cos(a) * (W.r - W.half - 3.2), W.z + Math.sin(a) * (W.r - W.half - 3.2)]); places.push(['behind the long wall', W.x + Math.cos(a) * (W.r + W.half + 4), W.z + Math.sin(a) * (W.r + W.half + 4)]); }
  for (const gt of G.gates) { const az = gt.along === 'z' ? 1 : 0, ax = 1 - az; places.push(['gate ' + gt.id + ', one side', gt.x + ax * 8, gt.z + az * 8], ['gate ' + gt.id + ', in the gap', gt.x, gt.z], ['gate ' + gt.id + ', the other side', gt.x - ax * 8, gt.z - az * 8]); }
  for (const [n, x, z] of [['north west corner', b.minX + 6, b.minZ + 6], ['north east corner', b.maxX - 6, b.minZ + 6], ['south east corner', b.maxX - 6, b.maxZ - 6], ['south west corner', b.minX + 6, b.maxZ - 6]]) places.push([n, x, z]);
  const res = places.map(([name, x, z]) => ({ name, x: +x.toFixed(1), z: +z.toFixed(1), reached: !!seen[at(x, z)] }));
  let nFree = 0, nSeen = 0; for (let i = 0; i < free.length; i++) { nFree += free[i]; nSeen += seen[i]; }
  return { area: (b.maxX - b.minX) * (b.maxZ - b.minZ), w: b.maxX - b.minX, h: b.maxZ - b.minZ, need: +need.toFixed(2), places: res, free: nFree, seen: nSeen, solidCentre: !!seen[at(G.donut.x, G.donut.z)], startGap: +gap(g.start.x, g.start.z).toFixed(1) };
});
out.size = { w: flood.w, h: flood.h, area: flood.area, times: +(flood.area / (150 * 110)).toFixed(2) };
P.say(out.size.times >= 3 && out.size.times <= 4, 'the park is ' + flood.w + ' by ' + flood.h + ' m, ' + flood.area + ' square metres: ' + out.size.times + ' times the 150 by 110 m car park it replaces (the brief: about three to four)');
const missed = flood.places.filter(p => !p.reached);
out.flood = { places: flood.places.length, missed: missed.map(p => p.name), free: flood.free, seen: flood.seen, need: flood.need };
P.say(missed.length === 0 && flood.seen === flood.free, 'every place is reachable from the start without touching a wall: a flood over every spot where the car fits whichever way it points (' + flood.need + ' m clear of every wall) reaches all ' + flood.places.length + ' places asked of it' + (missed.length ? ', MISSING ' + missed.map(p => p.name).join(', ') : '') + ', and every such spot in the park (' + flood.seen + ' of ' + flood.free + ' half metre cells): nothing is walled off');
P.say(!flood.solidCentre, 'known answer: the flood does not enter a pillar (its centre is not reached), so it can fail: ' + (!flood.solidCentre ? 'CAUGHT' : 'MISSED'));
P.say(flood.startGap >= 5, 'the start, where a restart puts the car, is open ground: ' + flood.startGap + ' m from the nearest wall');

/* driven: the hands on grip from the start to six places */
await page.evaluate(() => { const R = window.__hands, H = R.H, P0 = R.P.PARK, S = P0.START, W = P0.WALL, G = P0.GATES; const go = pts => H.smooth([[S.x, S.z], ...pts], 18);
  R.lines.to = name => ({ donut: go([[-12, 40], [P0.DONUT.x + 16, P0.DONUT.z + 10]]), eight: go([[30, 50], [(P0.EIGHT.a.x + P0.EIGHT.b.x) / 2, P0.EIGHT.a.z + 14]]), slalom: go([[70, 50], [104, -20], [104, P0.SLALOM.z + 8]]), wall: go([[-50, 60], [W.x + 20, W.z + 30], [W.x + 12, W.z]]), 'gate-a': go([[G[0].x, G[0].z - 14]]), 'gate-b': go([[-50, 70], [G[1].x + 30, G[1].z], [G[1].x - 12, G[1].z]]) }[name]); });
out.driven = [];
for (const name of ['donut', 'eight', 'slalom', 'wall', 'gate-a', 'gate-b']) {
  const d = await P.drive(page, { line: 'to', args: [name], seconds: 30, tail: 0, noRec: true, hands: { SLOW: 0 } });
  out.driven.push({ name, done: d.done, hits: d.hits, cones: d.cones, seconds: d.seconds });
}
P.say(out.driven.every(d => d.done && d.hits === 0), 'driven: the scripted hands, on grip, from the start to the donut pad, the eight, the cone line, the long wall and through both gates: ' + out.driven.map(d => d.name + ' in ' + d.seconds + ' s, ' + d.hits + ' contacts').join('; '));

/* ---- 3: the car cannot leave ---- */
const AIM = `
  const W = await import('/src/physics/world.js'), Ro = await import('/src/garage/roster.js'), L = await import('/src/park/layout.js');
  const run = (ground, tune, from, aim, seconds) => {
    const g = Object.assign({}, ground, { start: from }), w = W.createWorld(g, { tune }), b = ground.bounds, V = tune ? tune.VEHICLE : window.__feel.TUNE.VEHICLE;
    let out = 0, deep = 0, vmax = 0, vhit = 0;
    for (let i = 0; i < seconds * 120; i++) {
      const c = w.car, dx = aim[0] - c.x, dz = aim[1] - c.z, want = Math.atan2(-dx, -dz); let d = want - c.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      w.stepWorld({ steer: Math.abs(d) < 0.03 ? 0 : d > 0 ? -1 : 1, throttle: 1, brake: 0, handbrake: 0 });
      if (c.speed > vmax) vmax = c.speed; if (w.hit && w.hit.speed > vhit) vhit = w.hit.speed;
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), lx = -Math.cos(c.yaw), lz = Math.sin(c.yaw);
      for (const [f, l] of [[V.HALF_LENGTH, V.HALF_WIDTH], [V.HALF_LENGTH, -V.HALF_WIDTH], [-V.HALF_LENGTH, V.HALF_WIDTH], [-V.HALF_LENGTH, -V.HALF_WIDTH], [0, V.HALF_WIDTH], [0, -V.HALF_WIDTH]]) {
        const x = c.x + fx * f + lx * l, z = c.z + fz * f + lz * l;
        const o = Math.max(b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ); if (o > out) out = o;
        for (const s of ground.park.solids) { const q = s.r * Math.cos(Math.PI / 12) - Math.hypot(x - s.x, z - s.z); if (q > deep) deep = q; }
        const q = -L.wallGap(ground.park.wall, x, z); if (q > deep) deep = q;
      }
    }
    return { out, deep, vmax, vhit };
  };
`;
const leave = await page.evaluate(new Function('return (async () => {' + AIM + `
  const g = window.__loop.app.ground, b = g.bounds, aims = [];
  const w = b.maxX - b.minX, h = b.maxZ - b.minZ, per = 2 * w + 2 * h, n = Math.round(per / 12.5);
  for (let k = 0; k < n; k++) { const s = k * per / n; if (s < w) aims.push([b.minX + s, b.minZ - 30]); else if (s < w + h) aims.push([b.maxX + 30, b.minZ + s - w]); else if (s < 2 * w + h) aims.push([b.maxX - (s - w - h), b.maxZ + 30]); else aims.push([b.minX - 30, b.maxZ - (s - 2 * w - h)]); }
  for (const [x, z] of [[b.minX - 30, b.minZ - 30], [b.maxX + 30, b.minZ - 30], [b.maxX + 30, b.maxZ + 30], [b.minX - 30, b.maxZ + 30]]) aims.push([x, z]);
  const cars = [null, Ro.carTune('fastback', { power: 3, grip: 3, steer: 3 })];
  const froms = [g.start, { x: b.maxX - 12, z: b.minZ + 12, yaw: 2.4 }, { x: b.minX + 12, z: b.maxZ - 12, yaw: -0.8 }];
  const worst = { out: 0, deep: 0, vhit: 0, vmax: 0 }; let runs = 0;
  for (const tune of cars) for (const from of froms) for (const aim of aims) { const r = run(g, tune, from, aim, 16); runs++; for (const k of Object.keys(worst)) if (r[k] > worst[k]) worst[k] = r[k]; }
  /* known answer: 14 m of the outer wall cut away where the driver is aimed */
  const cut = Object.assign({}, g, { walls: g.walls.filter(w => w.place !== 'edge').concat([{ points: [{ x: b.minX, y: 0, z: b.minZ }, { x: -7, y: 0, z: b.minZ }], kind: 'tyres', side: 'left', place: 'edge' }, { points: [{ x: 7, y: 0, z: b.minZ }, { x: b.maxX, y: 0, z: b.minZ }, { x: b.maxX, y: 0, z: b.maxZ }, { x: b.minX, y: 0, z: b.maxZ }, { x: b.minX, y: 0, z: b.minZ }], kind: 'tyres', side: 'left', place: 'edge' }]) });
  const from = { x: 15, z: b.minZ + 60, yaw: 0 }, known = run(cut, null, from, [15, b.minZ - 200], 8), whole = run(g, null, from, [15, b.minZ - 200], 8);
  return { runs, aims: aims.length, worst, known, whole };
})();`));
out.leave = leave;
P.say(leave.worst.out <= 0.3 && leave.worst.deep <= 0.35, 'the car cannot leave: ' + leave.runs + ' drives (the starter and the fastback fully upgraded, from the start and from two far corners, aimed flat out at ' + leave.aims + ' points round the outer wall, every 12.5 m and each corner): the body is never more than ' + leave.worst.out.toFixed(2) + ' m past the wall\'s line nor more than ' + leave.worst.deep.toFixed(2) + ' m into a solid; top speed ' + (leave.worst.vmax * 3.6).toFixed(0) + ' km/h, the hardest hit ' + leave.worst.vhit.toFixed(1) + ' m/s');
P.say(leave.known.out > 5 && leave.whole.out <= 0.3, 'known answer: a 14 m gap cut in the outer wall where the driver is aimed lets it ' + leave.known.out.toFixed(0) + ' m outside (and ' + leave.whole.out.toFixed(2) + ' m with the wall whole): ' + (leave.known.out > 5 ? 'CAUGHT' : 'MISSED'));

/* ---- 4: getting unstuck ---- */
const stuck = await page.evaluate(new Function('return (async () => {' + AIM + `
  const g = window.__loop.app.ground, b = g.bounds, G = g.park, V = window.__feel.TUNE.VEHICLE, cases = [];
  const segs = []; for (const w of g.walls) for (let i = 0; i + 1 < w.points.length; i++) segs.push([w.points[i].x, w.points[i].z, w.points[i + 1].x, w.points[i + 1].z]);
  const gapAt = (x, z) => { let best = Infinity; for (const s of segs) { const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz; let t = ((x - s[0]) * dx + (z - s[1]) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t); if (d < best) best = d; } return best; };
  const inSolid = (x, z) => G.solids.some(s => Math.hypot(x - s.x, z - s.z) < s.r * Math.cos(Math.PI / 12)) || L.wallGap(G.wall, x, z) < 0 || x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ;
  const body = c => { const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), lx = -Math.cos(c.yaw), lz = Math.sin(c.yaw); return [[V.HALF_LENGTH, V.HALF_WIDTH], [V.HALF_LENGTH, -V.HALF_WIDTH], [-V.HALF_LENGTH, V.HALF_WIDTH], [-V.HALF_LENGTH, -V.HALF_WIDTH], [0, V.HALF_WIDTH], [0, -V.HALF_WIDTH], [0, 0]].map(([f, l]) => [c.x + fx * f + lx * l, c.z + fz * f + lz * l]); };
  /* from a spot, drive at a target with the throttle held until the recovery acts; then is the car on open ground, and does it drive off */
  const trial = (name, from, aim, move) => {
    const g2 = Object.assign({}, g, { start: from }), w = W.createWorld(g2, {});
    let rec = null;
    for (let i = 0; i < 20 * 120 && !rec; i++) {
      const c = w.car, dx = aim[0] - c.x, dz = aim[1] - c.z, want = Math.atan2(-dx, -dz); let d = want - c.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      w.stepWorld({ steer: Math.abs(d) < 0.03 ? 0 : d > 0 ? -1 : 1, throttle: 1, brake: 0, handbrake: 0 });
      if (w.recovered) { if (move) { c.x = move[0]; c.z = move[1]; } const pts = body(c); rec = { x: +c.x.toFixed(2), z: +c.z.toFixed(2), inside: pts.some(p => inSolid(p[0], p[1])), clear: +Math.min(...pts.map(p => gapAt(p[0], p[1]))).toFixed(2), t: +(i / 120).toFixed(1) }; }
    }
    if (!rec) return { name, recovered: false };
    const x0 = w.car.x, z0 = w.car.z; let far = 0;
    for (let i = 0; i < 3 * 120; i++) { w.stepWorld({ steer: 0, throttle: 1, brake: 0, handbrake: 0 }); far = Math.max(far, Math.hypot(w.car.x - x0, w.car.z - z0)); }
    return Object.assign({ name, recovered: true, drivesOff: +far.toFixed(1) }, rec);
  };
  for (const [n, from, aim] of [['the north wall', { x: 40, z: b.minZ + 20, yaw: 0 }, [40, b.minZ - 20]], ['the south wall', { x: -40, z: b.maxZ - 20, yaw: Math.PI }, [-40, b.maxZ + 20]], ['the east wall', { x: b.maxX - 20, z: 30, yaw: -Math.PI / 2 }, [b.maxX + 20, 30]], ['the west wall', { x: b.minX + 14, z: 60, yaw: Math.PI / 2 }, [b.minX - 20, 60]],
    ['the north west corner', { x: b.minX + 20, z: b.minZ + 20, yaw: 0.78 }, [b.minX - 20, b.minZ - 20]], ['the north east corner', { x: b.maxX - 20, z: b.minZ + 20, yaw: -0.78 }, [b.maxX + 20, b.minZ - 20]], ['the south east corner', { x: b.maxX - 20, z: b.maxZ - 20, yaw: -2.35 }, [b.maxX + 20, b.maxZ + 20]], ['the south west corner', { x: b.minX + 20, z: b.maxZ - 20, yaw: 2.35 }, [b.minX - 20, b.maxZ + 20]]]) cases.push(trial(n, from, aim));
  for (const s of G.solids) for (const [m, dx, dz] of [['from the south', 0, 14], ['from the east', 14, 0], ['from the north west', -10, -10]]) cases.push(trial(s.id + ' ' + m, { x: s.x + dx, z: s.z + dz, yaw: Math.atan2(dx, dz) }, [s.x, s.z]));
  const Wl = G.wall, mid = (Wl.a0 + Wl.a1) / 2;
  for (const a of [Wl.a0 + 0.3, mid, Wl.a1 - 0.3]) {
    cases.push(trial('the long wall from inside', { x: Wl.x + Math.cos(a) * (Wl.r - 16), z: Wl.z + Math.sin(a) * (Wl.r - 16), yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) }, [Wl.x + Math.cos(a) * (Wl.r + 30), Wl.z + Math.sin(a) * (Wl.r + 30)]));
    cases.push(trial('the long wall from behind', { x: Wl.x + Math.cos(a) * (Wl.r + 9), z: Wl.z + Math.sin(a) * (Wl.r + 9), yaw: Math.atan2(Math.cos(a), Math.sin(a)) }, [Wl.x, Wl.z]));
  }
  for (const t of Wl.tips) cases.push(trial('a tip of the long wall', { x: t.x + 14, z: t.z, yaw: Math.PI / 2 }, [t.x, t.z]));
  cases.push(trial('the west wall, behind the long wall', { x: Wl.x - Wl.r - 6, z: Wl.z, yaw: Math.PI / 2 }, [b.minX - 20, Wl.z]));
  const known = trial('known answer', { x: 40, z: b.minZ + 20, yaw: 0 }, [40, b.minZ - 20], [G.donut.x + 1, G.donut.z]);
  return { cases, known };
})();`));
out.stuck = stuck;
const bad = stuck.cases.filter(c => !c.recovered || c.inside || c.clear < 0.2 || c.drivesOff < 5), ok = stuck.cases.filter(c => c.recovered);
P.say(bad.length === 0, 'getting unstuck: the car held nose first against the wall in ' + stuck.cases.length + ' places (each side and corner of the outer wall, every pillar and pier from three sides, the long wall from inside, from behind and at its tips, and the lane behind it) is put down by the game\'s stuck recovery on open ground every time: no part of the body in a solid or outside, at least ' + Math.min(...ok.map(c => c.clear)).toFixed(2) + ' m clear of every wall, and it drives off (' + Math.min(...ok.map(c => c.drivesOff)).toFixed(0) + ' m or more in 3 s)' + (bad.length ? '; FAILING: ' + bad.map(c => c.name + ' ' + JSON.stringify(c)).join(' | ') : ''));
P.say(stuck.known.recovered && stuck.known.inside, 'known answer: a recovery that puts the car inside the donut pillar is caught by the same check: ' + (stuck.known.inside ? 'CAUGHT' : 'MISSED'));
out.errors = pg.errors.slice(0, 5);
P.say(pg.errors.length === 0, 'no page errors: ' + pg.errors.length + (pg.errors.length ? ' (' + pg.errors[0] + ')' : ''));
await P.finish(env, 'park.json', out);
