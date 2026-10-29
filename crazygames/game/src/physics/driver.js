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
  DRIFT_HB:     0.8,     // s of handbrake at the entry of a drift section
  DRIFT_LOOK:   0.35,    // look ahead gain while drifting (shorter: aims at the apex)
  DRIFT_ENTRY_SPEED: 19, // m/s wanted at the entry of a drift section
  DRIFT_WIDE:   2.0,     // m outside the centre before the driver lifts
  DRIFT_LIFT:   0.20,    // throttle left per metre further out
  DRIFT_MIN_THROTTLE: 0.35,
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
  const sec = o.drift && ground.sections[o.drift];
  let hbUntil = -1, inSection = false;
  const out = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
  return {
    input(world) {
      const car = world.car, v = car.speed;
      const D = DRIVER;
      let drifting = false;
      if (sec) {
        const s = world.along;
        const inside = s >= sec[0] && s <= sec[1];
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
        // before the section: arrive at the entry speed
        const ahead = (sec[0] - world.along + ground.length) % ground.length;
        if (ahead < 60 && ahead > 0) { if (v > D.DRIFT_ENTRY_SPEED + 1) { throttle = 0; brake = 0.5; } else if (v < D.DRIFT_ENTRY_SPEED - 1) { throttle = 1; brake = 0; } }
      }
      if (drifting) {
        // full throttle holds the slide; running wide, the driver lifts to tighten the line
        const outside = -world.lateral * turn[world.centreIndex];   // metres towards the outside of the turn
        throttle = Math.max(D.DRIFT_MIN_THROTTLE, 1 - Math.max(0, outside - D.DRIFT_WIDE) * D.DRIFT_LIFT);
        brake = 0;
        if (world.time < hbUntil) { handbrake = 1; steer = steer > 0 ? 1 : -1; throttle = 1; }
      }
      out.steer = steer; out.throttle = throttle; out.brake = brake; out.handbrake = handbrake;
      return out;
    },
  };
}

void TUNE;
