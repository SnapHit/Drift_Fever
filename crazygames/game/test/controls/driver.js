/* A CAREFUL PRO DRIVER WITH A KEYBOARD'S HANDS (briefs/PRO-CONTROLS.md:
   "drive it yourself through the probes' inputs on every variant on
   three career tracks"). It decides keys and nothing else, once a frame:
   W, S, left, right and space, each on or off, as a player does; the
   game's own input turns them into the record (the throttle ramp, the
   steering's slew). Plain JavaScript over the world's state, used by
   career.js in the page and by the tuning scripts in Node.

   On grip it follows the centre line by pure pursuit, tapping the steer
   keys towards the steering it wants (the slew makes a held key a ramp),
   and holds a speed the curvature ahead allows with W, S or neither. A
   corner of at most DRIFT_RADIUS is slid: braked to ENTRY_SPEED before
   it, then a handbrake tap of HB_TIME with the steering into the turn,
   then the slide held by feel, on the path: the curve the car's travel
   is making against the curve that would reach a point on the line
   ahead. Turning too little, it keeps the throttle on and lets the
   countersteer go (power widens the slide and tightens the curve);
   turning too much, it countersteers, and lifts as well when it is well
   over or the slide passes ANGLE_MAX. Past the corner's end it lifts
   until the slide closes, then drives on grip. It never looks at the
   profile: on Easy the same hands countersteer into a controller that
   ends the slide, which is the difference career.js reports. */
export const PRO_DRIVER = {
  LOOK_BASE: 6, LOOK_GAIN: 0.45,     // m of pursuit look ahead, and per m/s
  STEER_GAIN: 2.2,                   // steering wanted per radian to the target
  STEER_BAND: 0.08,                  // the steering may be this far from wanted before a key moves it
  AY_MAX: 8.5, PLAN_TIME: 1.6, PLAN_MIN: 14, VMAX: 34, BRAKE_MARGIN: 1.5,
  DRIFT_RADIUS: 42,                  // m: corners this tight or tighter are slid (stars/slot.js's drift corners)
  ENTRY_SPEED: 21, APPROACH: 70,     // m/s wanted at a slid corner's start, from this far before it
  LEAD: 8,                           // m before the corner the handbrake goes on
  HB_TIME: 0.3,                      // s of handbrake
  DRIFT_LOOK: 10, DRIFT_LOOK_GAIN: 0.35,   // m of look ahead in a slide, and per m/s
  CURVE_BAND: 0.004,                 // 1/m either side of the curve wanted that it leaves alone
  CURVE_LIFT: 0.012,                 // 1/m over it at which it lifts as well as countersteering
  ANGLE_MIN: 12, ANGLE_MAX: 62,      // degrees: under the first it steers into the slide to keep it, past the second it lifts and countersteers
  EXIT_PAD: 6,                       // m past the corner's end before it lets the slide close
  CLOSED: 10,                        // degrees: the slide is over and grip driving resumes
  GIVE_UP: 6,                        // m/s: under this a slide is given up and the driver drives on
};

export function createProDriver(ground, opts) {
  const D = Object.assign({}, PRO_DRIVER, opts || {});
  const C = ground.centre, n = C.length, closed = ground.kind === 'circuit', L = ground.length;
  const curv = new Float64Array(n);
  for (let i = 0; i < n; i++) { const a = C[(i - 1 + n) % n], b = C[(i + 1) % n]; let d = b.heading - a.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; curv[i] = Math.abs(d) / 4; }
  const slid = (ground.corners || []).filter(c => c.radius <= D.DRIFT_RADIUS).map(c => ({ from: c.from, to: c.to, dir: c.angle < 0 ? 1 : -1 }));   // dir: the steering into the turn (+ is right)
  const keys = { up: false, down: false, left: false, right: false, hb: false };
  const st = { mode: 'grip', corner: null, hbUntil: 0, wanted: 0, psiWas: null, log: { slides: 0, entries: 0 } };
  const ahead = (along, c) => { let d = c.from - along; if (closed) d = ((d % L) + L) % L; return d; };
  /* inside a slid corner: from where its handbrake goes on to EXIT_PAD past its end */
  const inside = (along, c) => { const a = c.from - Math.max(0, D.LEAD) - 2; return closed ? ((along - a) % L + L) % L <= ((c.to + D.EXIT_PAD - a) % L + L) % L : along >= a && along <= c.to + D.EXIT_PAD; };
  /* press the steer keys towards a wanted steering (+ right), the slewed steering being now */
  function steerTo(want, now) {
    keys.left = keys.right = false;
    if (want > now + D.STEER_BAND) keys.right = true;
    else if (want < now - D.STEER_BAND) keys.left = true;
    else if (want > 0.5 && now > 0.5) keys.right = true;     // full lock wanted: keep the key held
    else if (want < -0.5 && now < -0.5) keys.left = true;
  }
  function decide(world) {
    const car = world.car, v = car.speed, t = world.time;
    const V = car.tune ? car.tune.VEHICLE : null;
    const lock = (() => { const T = V || { LOCK: 32, LOCK_AT_SPEED: 12, LOCK_SPEED: 30 }; return (T.LOCK + (T.LOCK_AT_SPEED - T.LOCK) * Math.min(1, v / T.LOCK_SPEED)) * Math.PI / 180; })();
    const now = Math.max(-1, Math.min(1, -car.steerDriver / lock));
    const slip = Math.atan2(car.vy, car.vx) * 180 / Math.PI;   // + the nose right of the travel
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw), lx = -Math.cos(car.yaw), lz = Math.sin(car.yaw);
    const along = world.along;
    if (st.mode === 'grip') {
      const next = slid.map(c => ({ c, d: ahead(along, c) })).filter(x => x.d >= -D.LEAD - 2).sort((a, b) => a.d - b.d)[0];   // on a sprint a corner behind is not ahead
      const look = D.LOOK_BASE + D.LOOK_GAIN * v, tp = C[(world.centreIndex + Math.round(look / 2)) % n];
      const dx = tp.x - car.x, dz = tp.z - car.z, ang = Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz);
      steerTo(Math.max(-1, Math.min(1, -ang * D.STEER_GAIN)), now);
      const planM = Math.max(D.PLAN_MIN, v * D.PLAN_TIME); let kmax = 0;
      for (let k = 0; k <= planM / 2; k++) { const c = curv[(world.centreIndex + k) % n]; if (c > kmax) kmax = c; }
      let vDes = Math.min(D.VMAX, kmax > 1e-4 ? Math.sqrt(D.AY_MAX / kmax) : D.VMAX);
      if (next && next.d < D.APPROACH) vDes = Math.min(vDes, D.ENTRY_SPEED);
      keys.up = v < vDes; keys.down = v > vDes + D.BRAKE_MARGIN; keys.hb = false;
      if (next && next.d <= D.LEAD && v > 8) { st.mode = 'entry'; st.corner = next.c; st.hbUntil = t + D.HB_TIME; st.log.entries++; }
      return keys;
    }
    const c = st.corner, into = c.dir;
    if (st.mode === 'entry') {
      keys.hb = true; keys.up = true; keys.down = false; keys.right = into > 0; keys.left = into < 0;
      if (t >= st.hbUntil) { st.mode = 'hold'; st.psiWas = null; st.log.slides++; }
      return keys;
    }
    keys.hb = false; keys.down = false;
    if (st.mode === 'hold' && !inside(along, c)) st.mode = 'exit';
    if (v < D.GIVE_UP) { st.mode = 'grip'; st.corner = null; keys.up = true; return keys; }   // a slide gone to nothing (a wall, a spin): drive on
    if (st.mode === 'exit') {
      keys.up = false; steerTo(0, now);
      if (Math.abs(slip) < D.CLOSED || Math.abs(slip) > 100) { st.mode = 'grip'; st.corner = null; }
      return keys;
    }
    /* the hold: the curve the travel is making against the curve the line needs */
    const look = D.DRIFT_LOOK + D.DRIFT_LOOK_GAIN * v, tp = C[(world.centreIndex + Math.round(look / 2)) % n];
    const psiV = Math.atan2(-car.wvx, -car.wvz), psiT = Math.atan2(-(tp.x - car.x), -(tp.z - car.z));
    let err = psiT - psiV; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    const dist = Math.max(4, Math.hypot(tp.x - car.x, tp.z - car.z));
    const need = 2 * Math.sin(-err * into) / dist;                 // 1/m into the turn that would reach the point
    let dpsi = st.psiWas === null ? 0 : psiV - st.psiWas; while (dpsi > Math.PI) dpsi -= 2 * Math.PI; while (dpsi < -Math.PI) dpsi += 2 * Math.PI;
    st.psiWas = psiV;
    const curve = v > 1 ? -dpsi / (2 * 1 / 120) / v * into : 0;    // 1/m into the turn the travel is making (a frame is two steps)
    st.wanted = need * 1000;   // for the traces: 1/km
    const over = curve - need, a = slip * into;
    if (a > D.ANGLE_MAX) { keys.up = false; steerTo(-into, now); }
    else if (over > D.CURVE_BAND) { keys.up = !(over > D.CURVE_LIFT); steerTo(-into, now); }
    else if (over < -D.CURVE_BAND) { keys.up = true; steerTo(a < D.ANGLE_MIN ? into : 0, now); }
    else { keys.up = true; steerTo(-into * 0.5, now); }
    return keys;
  }
  return { decide, keys, state: st };
}

/* The game's key ramp, for the Node runs (input/input.js does this in the page). */
export function createRamp(CONTROLS, STEP) {
  const s = { t: 0, b: 0 };
  const toward = (v, want, up, down) => {
    if (want > v) { v = Math.min(want, v + 1 / Math.max(1, Math.round(CONTROLS[up] / STEP))); if (v > want - 1e-9) v = want; }
    else if (want < v) { v = Math.max(want, v - 1 / Math.max(1, Math.round(CONTROLS[down] / STEP))); if (v < want + 1e-9) v = want; }
    return v;
  };
  return {
    step(k, out) {
      s.t = toward(s.t, k.up ? 1 : 0, 'THROTTLE_RAMP', 'THROTTLE_RELEASE'); s.b = toward(s.b, k.down ? 1 : 0, 'BRAKE_RAMP', 'BRAKE_RELEASE');
      out.steer = (k.right ? 1 : 0) - (k.left ? 1 : 0); out.throttle = Math.round(s.t * 100) / 100; out.brake = Math.round(s.b * 100) / 100; out.handbrake = k.hb ? 1 : 0;
      return out;
    },
  };
}
