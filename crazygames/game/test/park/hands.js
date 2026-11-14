/* THE PARK'S SCRIPTED HANDS (briefs/PLAYGROUND.md, the rule that every
   challenge can be reached by a player's hands). A driver for the open
   park held to what a player on a phone has: the throttle always on,
   no brake pedal, steering hard left, straight or hard right and
   nothing between, and the one DRIFT / BRAKE button. guard counts any
   input that is not one of those; the probes say it stays at nothing.

   It drives by looking ahead, as the rival's driver does
   (src/rivals/driver.js): every REPLAN steps it tries each thing the
   hands can do for a moment, then each thing they could do after it,
   on a copy of its own car stepped by the game's own vehicle code, and
   marks each try against a line drawn through the park: ground covered
   along the line, less the distance off it, more for sliding where the
   line asks for a slide, and a heavy cost for any corner of the body
   near a solid or a cone. The best is driven until the next look.
   Nothing random, nothing timed by a clock.

   This file has no imports, so the probes can hand the same source to
   the page (the game's modules are passed in as deps) and to Node. */

export const HANDS = {
  REPLAN:     6,        // physics steps between looks
  SUB:        2,        // the copy is stepped at 60 Hz
  FIRST:      0.2,      // s the first thing tried is held
  HORIZON:    1.1,      // s each try is driven ahead
  PROGRESS:   60,       // per metre along the line
  OFF:        14,       // per metre off the line, squared, per second
  SLIDE:      260,      // per second sliding where the line asks for it
  NO_SLIDE:   120,      // per second sliding where it does not
  GAP:        1500,     // per second past GAP_T without a scoring slide, where the chain is to be kept
  GAP_T:      0.9,      // s
  SAFE:       1.2,      // m between the body and a solid below which it costs
  SAFE_COST:  2500,     // per metre short of SAFE, per second
  CRASH:      80000,    // a try that touches
  CONE_SAFE:  0.9,      // m between the body and a cone below which it costs
  CONE_COST:  9000,
  SLOW:       9,        // m/s: ending a try slower than this costs
  SLOW_COST:  400,
  KEEP:       25,       // a bonus for doing what it is already doing
  ANGLE:      14,       // degrees that count as sliding in a try (the scorer's 12, with a margin)
};

/* ---- lines through the park: points a metre apart, each with whether a slide is wanted there ---- */
export function line(points, slide) {
  const out = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len));
    for (let k = 0; k < n; k++) out.push({ x: a[0] + (b[0] - a[0]) * k / n, z: a[1] + (b[1] - a[1]) * k / n, slide: !!slide });
  }
  return out;
}
/* an arc round (cx, cz) of radius r from angle a0 to a1 (radians, atan2(z, x)); a1 < a0 runs the other way */
export function arc(cx, cz, r, a0, a1, slide) {
  const out = [], len = Math.abs(a1 - a0) * r, n = Math.max(1, Math.round(len));
  for (let k = 0; k < n; k++) { const a = a0 + (a1 - a0) * k / n; out.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, slide: !!slide }); }
  return out;
}
export const join = (...parts) => [].concat(...parts);
/* a line through waypoints [x, z, slide?, radius?] with each corner rounded to radius r (or its own): the slide flag of a waypoint holds from it to the next */
export function smooth(way, r) {
  const out = [];
  let from = [way[0][0], way[0][1]];
  for (let i = 1; i < way.length; i++) {
    const p = way[i], sl = !!way[i - 1][2];
    if (i === way.length - 1) { out.push(...line([from, [p[0], p[1]]], sl)); break; }
    const q = way[i + 1];
    let ax = p[0] - from[0], az = p[1] - from[1], bx = q[0] - p[0], bz = q[1] - p[1];
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz); ax /= la; az /= la; bx /= lb; bz /= lb;
    const cross = ax * bz - az * bx, dot = Math.max(-1, Math.min(1, ax * bx + az * bz)), th = Math.acos(dot);
    const rr = p[3] || r, t = Math.min(rr * Math.tan(th / 2), la * 0.9, lb * 0.45), R = th > 1e-3 ? t / Math.tan(th / 2) : 0;
    if (R < 0.5) { out.push(...line([from, [p[0], p[1]]], sl)); from = [p[0], p[1]]; continue; }
    const s0 = [p[0] - ax * t, p[1] - az * t], sg = cross > 0 ? 1 : -1;
    out.push(...line([from, s0], sl));
    /* the corner's centre is to the side it turns to */
    const cx = s0[0] - az * sg * R, cz = s0[1] + ax * sg * R, a0 = Math.atan2(s0[1] - cz, s0[0] - cx);
    out.push(...arc(cx, cz, R, a0, a0 + sg * th, !!p[2]));
    from = [p[0] + bx * t, p[1] + bz * t];
  }
  return out;
}

/* deps: { stepVehicle, STEP, bodyPoints, wallGap } (the game's own);
   ground: the park; path: a line as above; o: overrides of HANDS, and
   loop (the line closes on itself), cones (mind the cones), flick (see
   input). */
export function createHands(deps, ground, path, o) {
  const H = Object.assign({}, HANDS, o || {});
  const { stepVehicle, STEP, bodyPoints, wallGap } = deps;
  const DT = STEP * H.SUB, N = Math.round(H.HORIZON / DT), N1 = Math.round(H.FIRST / DT);
  const n = path.length, loop = !!H.loop;
  const G = ground.park, b = ground.bounds;
  const solids = G.solids, W = G.wall;
  const cones = H.cones ? ground.cones : [];
  const FIRSTS = [[0, 0], [-1, 0], [1, 0], [-1, 1], [1, 1], [0, 1]], THEN = [[0, 0], [-1, 0], [1, 0]];
  const sim = {}, pts = new Float64Array(12), inp = { steer: 0, throttle: 1, brake: 0, handbrake: 0 };
  const out = { steer: 0, throttle: 1, brake: 0, handbrake: 0 };
  let flickT = 0, idx = 0, until = 0, choice = 0, sinceSlide = 1e9, guard = 0, done = false;
  const at = i => loop ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
  function nearest(x, z, from, back, ahead) {
    let best = from, bd = Infinity;
    for (let k = -back; k <= ahead; k++) { const j = at(from + k), p = path[j], d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z); if (d < bd) { bd = d; best = loop ? from + k : j; } }
    return { i: best, d: Math.sqrt(bd) };
  }
  /* the body's clearance from every solid, the outer wall and (if minded) the cones */
  function clearance(car, wantCones) {
    bodyPoints(car, pts);
    let c = Infinity, cone = Infinity;
    for (let k = 0; k < 6; k++) {
      const px = pts[k * 2], pz = pts[k * 2 + 1];
      c = Math.min(c, px - b.minX, b.maxX - px, pz - b.minZ, b.maxZ - pz);
      for (const s of solids) { const d = Math.hypot(px - s.x, pz - s.z) - s.r; if (d < c) c = d; }
      const dw = wallGap(W, px, pz); if (dw < c) c = dw;
    }
    if (wantCones) {
      /* a cone against the body's box, as the physics knocks it */
      const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw), hl = Math.hypot(pts[0] - pts[4], pts[1] - pts[5]) / 2, hw = Math.hypot(pts[0] - pts[2], pts[1] - pts[3]) / 2;
      for (const k of cones) {
        const dx = k.x - car.x, dz = k.z - car.z; if (dx * dx + dz * dz > 100) continue;
        const f = dx * fx + dz * fz, l = dx * -fz + dz * fx, cf = Math.max(-hl, Math.min(hl, f)), cl = Math.max(-hw, Math.min(hw, l)), d = Math.hypot(f - cf, l - cl) - 0.3;
        if (d < cone) cone = d;
      }
    }
    return { c: c - 0.25, cone };
  }
  function rollout(car, a, t2) {
    Object.assign(sim, car);
    let i = idx, value = 0, gap = sinceSlide;
    for (let k = 0; k < N; k++) {
      const u = k < N1 ? FIRSTS[a] : THEN[t2];
      inp.steer = u[0]; inp.handbrake = u[1]; inp.throttle = 1; inp.brake = 0;
      stepVehicle(sim, inp, DT);
      const q = nearest(sim.x, sim.z, i, 2, 6); i = q.i;
      const p = path[at(i)];
      value -= H.OFF * q.d * q.d * DT;
      const ang = Math.abs(sim.slip) * 57.29578, sl = ang >= H.ANGLE && sim.speed >= 6 && sim.vx > 0;
      if (p.slide) { if (sl) { value += H.SLIDE * DT; gap = 0; } else { gap += DT; if (gap > H.GAP_T) value -= H.GAP * DT; } }
      else if (sl) value -= H.NO_SLIDE * DT;
      const cl = clearance(sim, cones.length > 0);
      if (cl.c < 0.1) { value -= H.CRASH * (1 - k / N); break; }
      if (cl.c < H.SAFE) value -= H.SAFE_COST * (H.SAFE - cl.c) * DT;
      if (cl.cone < 0) value -= H.CONE_COST * (1 - k / N) * 0.5 + H.CONE_COST * -cl.cone;
      else if (cl.cone < H.CONE_SAFE) value -= H.CONE_COST * (H.CONE_SAFE - cl.cone) * DT;
    }
    value += H.PROGRESS * (i - idx);
    if (sim.speed < H.SLOW) value -= H.SLOW_COST * (H.SLOW - sim.speed);
    return value;
  }
  function input(world) {
    const car = world.car;
    const ang = Math.abs(car.slip) * 57.29578;
    sinceSlide = ang >= 12 && car.speed >= 6 && car.vx > 0 ? 0 : sinceSlide + STEP;
    idx = nearest(car.x, car.z, idx, 2, 8).i;
    if (!loop && idx >= n - 2) done = true;
    if (--until <= 0) {
      until = H.REPLAN;
      let best = -1, bestV = -Infinity;
      for (let a = 0; a < FIRSTS.length; a++) for (let t2 = 0; t2 < THEN.length; t2++) {
        const v = rollout(car, a, t2) + (a === choice ? H.KEEP : 0);
        if (v > bestV) { bestV = v; best = a; }
      }
      choice = best;
    }
    const u = FIRSTS[choice];
    out.steer = u[0]; out.handbrake = u[1]; out.throttle = 1; out.brake = 0;
    /* a flick the line asks for (H.flick: { at, dir, hb, hold }): from that point of the line the button and the steering are held as a player throws the car, for hb seconds both and hold seconds the steering alone, whatever the look ahead says */
    if (H.flick && idx >= H.flick.at && flickT < H.flick.hb + H.flick.hold) { flickT += STEP; out.steer = H.flick.dir; out.handbrake = flickT <= H.flick.hb ? 1 : 0; until = 0; }
    if (!(out.steer === -1 || out.steer === 0 || out.steer === 1) || out.throttle !== 1 || out.brake !== 0) guard++;
    return out;
  }
  return { input, get done() { return done; }, get index() { return idx; }, get guard() { return guard; }, path, params: H };
}
