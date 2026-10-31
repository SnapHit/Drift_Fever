/* THE SCRIPTED DRIVER. Pure pursuit on the centre line with a speed
   target from the curvature ahead, for the measurements: it drives the
   test track without leaving it, and in its drift mode it throws the car
   into a named section with the handbrake and holds the throttle through
   it so the slide can be measured. It writes the same input record the
   player does. Plain JavaScript, no DOM. */
import { TUNE } from '../tune.js';

export const DRIVER = {
  LOOK_BASE:    5,       // m of look ahead at rest
  LOOK_GAIN:    0.42,    // m per m/s
  STEER_GAIN:   2.4,     // input per radian to the target
  AY_MAX:       7.0,     // m/s^2 of cornering the driver plans for
  PLAN_TIME:    1.6,     // s ahead the driver reads the curvature
  PLAN_MIN:     14,      // m, at least
  VMAX:         36,      // m/s
  BRAKE_MARGIN: 1.5,     // m/s over the target before braking
  DRIFT_HB:     0.4,     // s of handbrake at the entry of a drift section
  DRIFT_LEAD:   6,      // m before the section the drift starts: a drift takes about 0.75 s to build
  DRIFT_LOOK:   0.35,    // look ahead gain while drifting (shorter: aims at the apex)
  DRIFT_ENTRY_SPEED: 20, // m/s wanted at the entry of a drift section
  DRIFT_WIDE:   2.0,     // m outside the centre before the driver lifts
  DRIFT_LIFT:   0.20,    // throttle left per metre further out
  DRIFT_MIN_THROTTLE: 0.35,
  DRIFT_STEER_BASE: 0.7,  // steer into the turn while drifting
  DRIFT_STEER_GAIN: 3,  // more per metre towards the outside
  DRIFT_STEER_MIN:  0.3,
};

export function createDriver(ground, opts) {
  const o = Object.assign({ drift: null, invert: 1, gain: 1 }, opts || {});
  const C = ground.centre, n = C.length;
  const curvature = new Float64Array(n), turn = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = C[(i - 1 + n) % n], b = C[(i + 1) % n];
    let d = b.heading - a.heading;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    curvature[i] = Math.abs(d) / 4;
    turn[i] = d > 0 ? 1 : d < 0 ? -1 : 0;     // +1 a left turn
  }
  /* the sections to drift: one by name, or every one with '*' */
  const secs = o.drift === '*' ? Object.values(ground.sections || {}) : (o.drift && ground.sections[o.drift] ? [ground.sections[o.drift]] : []);
  const sec = secs.length > 0;
  let hbUntil = -1, inSection = false, current = null;
  const out = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
  return {
    input(world) {
      const car = world.car, v = car.speed;
      const D = DRIVER;
      let drifting = false;
      if (sec) {
        const s = world.along;
        let inside = false;
        for (const sc of secs) if (s >= sc[0] - D.DRIFT_LEAD && s <= sc[1]) { inside = true; current = sc; break; }
        if (inside && !inSection) hbUntil = world.time + D.DRIFT_HB;
        inSection = inside;
        drifting = inside;
      }
      const look = D.LOOK_BASE + (drifting ? D.DRIFT_LOOK : D.LOOK_GAIN) * v;
      const ti = (world.centreIndex + Math.round(look / 2)) % n;
      const t = C[ti];
      const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw), lx = -Math.cos(car.yaw), lz = Math.sin(car.yaw);
      const dx = t.x - car.x, dz = t.z - car.z;
      const ang = Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz);
      let steer = -ang * D.STEER_GAIN * o.gain * o.invert;
      steer = steer > 1 ? 1 : steer < -1 ? -1 : steer;
      // the speed target from the curvature ahead
      const planM = Math.max(D.PLAN_MIN, v * D.PLAN_TIME);
      let kmax = 0;
      for (let k = 0; k <= planM / 2; k++) { const c = curvature[(world.centreIndex + k) % n]; if (c > kmax) kmax = c; }
      let vDes = kmax > 1e-4 ? Math.sqrt(D.AY_MAX / kmax) : D.VMAX;
      if (vDes > D.VMAX) vDes = D.VMAX;
      let throttle = v < vDes ? 1 : 0;
      let brake = v > vDes + D.BRAKE_MARGIN ? Math.min(1, (v - vDes - D.BRAKE_MARGIN) / 4) : 0;
      let handbrake = 0;
      if (sec && !drifting) {
        // before the next section: arrive at the entry speed
        let ahead = Infinity;
        for (const sc of secs) { const a = (sc[0] - world.along + ground.length) % ground.length; if (a < ahead) ahead = a; }
        if (ahead < 60 && ahead > 0) { if (v > D.DRIFT_ENTRY_SPEED + 1) { throttle = 0; brake = 0.5; } else if (v < D.DRIFT_ENTRY_SPEED - 1) { throttle = 1; brake = 0; } }
      }
      if (drifting) {
        // full throttle holds the slide; running wide, the driver lifts to tighten the line
        const outside = -world.lateral * turn[world.centreIndex];   // metres towards the outside of the turn
        throttle = Math.max(D.DRIFT_MIN_THROTTLE, 1 - Math.max(0, outside - D.DRIFT_WIDE) * D.DRIFT_LIFT);
        brake = 0;
        /* The drift controller sets the angle from how far the steering
           points into the corner (vehicle.js): steering out of the slide
           ends the drift, so a drifting driver steers into the turn, more
           when running wide, less when tight. */
        /* In a drift the path follows the direction of travel, not the
           nose, so the driver steers by the angle from the velocity to its
           target: more into the turn when the path must bend more, out of
           it (which ends the drift) when the corner is done. diff > 0 is a
           target to the left, which wants steer < 0. */
        const psiV = Math.atan2(-car.wvx, -car.wvz), psiT = Math.atan2(-dx, -dz);
        let diff = psiT - psiV; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
        let ds = -diff * D.DRIFT_STEER_GAIN;
        const intoSign = -turn[world.centreIndex];
        if (ds * intoSign > 0 && Math.abs(ds) < D.DRIFT_STEER_MIN) ds = intoSign * D.DRIFT_STEER_MIN;
        steer = Math.max(-1, Math.min(1, ds)) * o.invert;
        void outside; void current;
        if (world.time < hbUntil) { handbrake = 1; steer = -turn[world.centreIndex] * o.invert || (steer > 0 ? 1 : -1); throttle = 1; }
      }
      out.steer = steer; out.throttle = throttle; out.brake = brake; out.handbrake = handbrake;
      return out;
    },
  };
}

void TUNE;
