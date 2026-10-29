/* THE VEHICLE. An arcade rear wheel drive model of our own: two axles,
   each with a tyre grip curve that peaks and then falls to a tail, a
   friction circle on each so throttle and brake eat into cornering grip,
   weight transfer between the axles, a handbrake that takes the rear's
   grip away, and a countersteer assist that scales with a hidden level.

   Units metres, seconds, kilograms, radians. Inside the step the car's
   own frame is x forward and y left, with yaw positive to the left, which
   is three.js's rotation about Y for a car that faces -Z. The world
   velocity is kept in world axes (wvx, wvz) so collisions can act on it
   directly; the step converts to the body frame and back.

   Deterministic: no Math.random, no clock, no allocation that depends on
   timing. The same input stream from the same start gives the same run.
   Every constant comes from TUNE.VEHICLE and TUNE.ASSIST, read on every
   step so the tuning panel applies live. */
import { TUNE } from '../tune.js';

export const STEP = 1 / 120;
const DEG = Math.PI / 180;

export function createVehicle(x, z, yaw) {
  return {
    x: x || 0, z: z || 0, yaw: yaw || 0,
    wvx: 0, wvz: 0,       // world velocity
    r: 0,                 // yaw rate, rad/s, positive left
    steerDriver: 0,       // the driver's steering angle after the slew, rad
    steer: 0,             // the angle the front wheels are at, with the assist, rad
    axF: 0,               // filtered longitudinal acceleration, for weight transfer
    hb: 0,                // handbrake state, 1 locked, easing back to 0
    drifting: 0,          // 1 while the drift controller holds the slide
    prevBeta: 0,          // last step's slide angle, for the damping
    driftTarget: 0,       // the angle the drift controller is holding, easing towards the asked one, degrees
    hbGrip: 0,            // how far the handbrake has taken the rear's grip, 0 to 1, easing in
    speed: 0, vx: 0, vy: 0,
    slip: 0,              // body slip angle, rad, positive when the car points right of its travel
    alphaF: 0, alphaR: 0, // axle slip angles
    rearSlide: 0, frontSlide: 0, spinning: 0,
    wheelF: 0, wheelR: 0, // wheel rotation angles for drawing
    loadF: 0, loadR: 0,
    throttle: 0, brake: 0,
    hit: null,            // the biggest hit this step: { speed, hard, nx, nz }
  };
}

/* The tyre: a rise to the peak at s = 1 with zero slope there, then a
   fall to the tail. Returns the grip as a share of mu * load, signed to
   oppose the slip. */
function tyre(alpha, peakRad, tail, fall) {
  const s = Math.abs(alpha) / peakRad;
  const f = s <= 1 ? s * (2 - s) : tail + (1 - tail) * Math.exp(-fall * (s - 1));
  return alpha < 0 ? f : -f;
}

function moveToward(v, target, max) {
  if (v < target) return Math.min(target, v + max);
  return Math.max(target, v - max);
}

function smooth01(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }

/* One fixed step. input: { steer -1..1 (+ is right), throttle 0..1,
   brake 0..1, handbrake 0 or 1 }. */
export function stepVehicle(s, input, dt) {
  const V = TUNE.VEHICLE, A = TUNE.ASSIST;
  const m = V.MASS, g = V.GRAVITY, L = V.WHEELBASE, a = V.CG_TO_FRONT, b = L - a;
  const Iz = V.INERTIA_FACTOR * m * a * b;
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);     // forward in world
  const lx = -Math.cos(s.yaw), lz = Math.sin(s.yaw);      // left in world
  let vx = s.wvx * fx + s.wvz * fz;
  let vy = s.wvx * lx + s.wvz * lz;
  const speed = Math.sqrt(vx * vx + vy * vy);
  const absVx = Math.abs(vx);
  const fwdSign = vx < 0 ? -1 : 1;

  /* ---- the handbrake state ---- */
  if (input.handbrake > 0) s.hb = 1;
  else if (s.hb > 0) s.hb = V.HANDBRAKE_RELEASE > 0 ? Math.max(0, s.hb - dt / V.HANDBRAKE_RELEASE) : 0;

  /* ---- steering: the driver's slewed angle, then the assist ---- */
  const lockFull = V.LOCK * DEG;
  const lockDrive = (V.LOCK + (V.LOCK_AT_SPEED - V.LOCK) * Math.min(1, speed / V.LOCK_SPEED)) * DEG;
  const beta = speed > 0.01 ? Math.atan2(vy, absVx) : 0;
  s.slip = beta;
  let steerIn = input.steer;
  let throttleIn = input.throttle;
  let assist = 0;
  if (vx > V.LOW_SPEED && A.LEVEL > 0) {
    /* The spin control. A spin is a yaw rate running away, not an angle:
       a held drift through a sweeper turns at well under one radian a
       second, a power on spin at over two. Between YAW_SOFT and YAW_MAX,
       steering further into the slide fades out and the throttle eases,
       so a held button cannot spin the car; steering against the slide is
       never touched. beta > 0 means the car points right of its travel, a
       right hand slide, and steering right (input > 0) deepens it. */
    const absR = Math.abs(s.r);
    /* Only a sliding car can spin: in a grip turn the yaw rate is high
       because the car is turning, and cutting the steering there (as this
       did until 29 October 2026) left full lock at 43 km/h circling on a
       50 m radius. The spin control now fades in between SLIDE_FROM and
       SLIDE_FULL degrees of slide. */
    const sliding = smooth01((Math.abs(beta) / DEG - A.SLIDE_FROM) / (A.SLIDE_FULL - A.SLIDE_FROM));
    if (absR > A.YAW_SOFT && sliding > 0) {
      const over = Math.min(1, (absR - A.YAW_SOFT) / (A.YAW_MAX - A.YAW_SOFT)) * A.LEVEL * sliding;
      if (steerIn * beta > 0) steerIn *= 1 - over;
      throttleIn *= 1 - over * A.THROTTLE_EASE;
    }
    /* In a drift the drift controller owns the angle, so the countersteer
       assist steps back and only the yaw damping stays. */
    assist = ((s.drifting ? 0 : A.COUNTERSTEER * beta) - A.YAW_DAMP * s.r * sliding) * A.LEVEL;
    const guard = A.SPIN_ANGLE * DEG;
    if (beta > guard) assist += A.SPIN_GAIN * (beta - guard) * A.LEVEL;
    else if (beta < -guard) assist += A.SPIN_GAIN * (beta + guard) * A.LEVEL;
  }
  const target = -steerIn * lockDrive;
  const turningIn = Math.abs(target) > Math.abs(s.steerDriver) && target * s.steerDriver >= 0;
  s.steerDriver = moveToward(s.steerDriver, target, (turningIn ? V.STEER_RATE : V.STEER_RETURN) * lockFull * dt);
  const lockAssist = A.COUNTERSTEER_LOCK * DEG;
  let delta = s.steerDriver + assist;
  if (delta > lockAssist) delta = lockAssist; else if (delta < -lockAssist) delta = -lockAssist;
  s.steer = delta;
  const cosD = Math.cos(delta), sinD = Math.sin(delta);

  /* ---- axle loads with weight transfer ---- */
  const minLoad = V.MIN_AXLE_LOAD * m * g;
  let loadF = m * g * b / L - m * s.axF * V.CG_HEIGHT / L;
  let loadR = m * g * a / L + m * s.axF * V.CG_HEIGHT / L;
  if (loadF < minLoad) loadF = minLoad;
  if (loadR < minLoad) loadR = minLoad;
  s.loadF = loadF; s.loadR = loadR;

  /* ---- longitudinal demands ---- */
  const throttle = throttleIn, brake = input.brake;
  let driveR = 0;
  /* Steering on grip eases the drive: the car drives itself, and a held
     turn should hold its speed, not gather it and run wide. TURN_LIFT of
     the drive goes at full steer, above TURN_LIFT_FROM; a drift keeps it. */
  const turnLift = s.drifting ? 0 : V.TURN_LIFT * Math.abs(input.steer) * smooth01((vx - V.TURN_LIFT_FROM) / 4);
  if (throttle > 0) driveR = throttle * m * V.ACCEL * Math.max(0, 1 - Math.max(0, vx) / V.TOP_SPEED) * (1 - s.hb * (input.steer === 0 ? 1 : 0.5)) * (1 - turnLift);
  else if (vx <= 0.3 && brake > 0 && throttle === 0) driveR = -brake * m * V.REVERSE_ACCEL * Math.max(0, 1 - Math.max(0, -vx) / V.REVERSE_SPEED);
  /* The brake acts against forward travel only. Rolling backwards, the
     brake input is the reverse gear and the throttle is the brake. This
     used to brake any motion past 0.3 m/s either way, which stopped
     reverse at walking pace and left the car stuck nose to a wall. */
  const brakeTotal = vx > 0.05 ? brake * m * V.BRAKE : (vx < -0.3 && throttle > 0 ? throttle * m * V.BRAKE : 0);
  const brakeF = -fwdSign * brakeTotal * V.BRAKE_FRONT_SHARE;
  const brakeR = -fwdSign * brakeTotal * (1 - V.BRAKE_FRONT_SHARE);
  /* DRIFT pressed with no steering is the brake: there is no other. With
     steering it only breaks the rear loose, and the drift's own scrub
     slows the car. */
  const hbBraking = input.steer === 0 ? 1 : 0;
  const hbForce = -fwdSign * m * V.HANDBRAKE_DECEL * s.hb * hbBraking * (absVx > 0.2 ? 1 : absVx / 0.2);
  s.throttle = throttle; s.brake = brake;

  /* ---- the front axle ---- */
  const muF = V.MU_FRONT, capF = muF * loadF;
  let FxF = brakeF;
  if (FxF < -capF) FxF = -capF; else if (FxF > capF) FxF = capF;
  const latCapF = capF * Math.sqrt(Math.max(0, 1 - (FxF / capF) * (FxF / capF)));
  const vlatF = vy + a * s.r;
  const alphaF = speed > 0.01 ? Math.atan2(vlatF, absVx) - delta * fwdSign : 0;
  let FyF = tyre(alphaF, V.PEAK_ANGLE_FRONT * DEG, V.TAIL_FRONT, V.TAIL_FALL) * latCapF;
  s.alphaF = alphaF;

  /* ---- the rear axle: drive, brake, handbrake, wheelspin ---- */
  /* the handbrake takes the rear's grip over HANDBRAKE_ENGAGE seconds,
     not at once, so the tail steps out instead of snapping out */
  s.hbGrip = input.handbrake > 0 ? (V.HANDBRAKE_ENGAGE > 0 ? Math.min(1, s.hbGrip + dt / V.HANDBRAKE_ENGAGE) : 1) : s.hb;
  /* In a drift the rear keeps DRIFT_GRIP of its grip after DRIFT is
     released: with full grip back while sliding at 40 degrees it scrubbed
     the car down to walking pace in a couple of seconds. */
  const hbShare = Math.min(s.hb, s.hbGrip);
  const driftShare = s.drifting && A.LEVEL > 0 ? 1 - (1 - A.DRIFT_GRIP) * A.LEVEL : 1;
  const muR = V.MU_REAR * Math.min(1 + (V.HANDBRAKE_GRIP - 1) * hbShare, driftShare);
  const capR = muR * loadR;
  let FxR = driveR + brakeR;
  let spinning = 0;
  let latScaleR = 1;
  const capDrive = FxR > 0 ? capR * V.TRACTION : capR;
  if (Math.abs(FxR) >= capDrive) {
    spinning = FxR > 0 ? 1 : 0;
    FxR = (FxR > 0 ? 1 : -1) * capDrive * (spinning ? V.SPIN_DRIVE : 1);
    latScaleR = spinning ? V.SPIN_GRIP : 0.4;
  } else {
    latScaleR = Math.sqrt(Math.max(0, 1 - (FxR / capDrive) * (FxR / capDrive)));
  }
  const vlatR = vy - b * s.r;
  const alphaR = speed > 0.01 ? Math.atan2(vlatR, absVx) : 0;
  const tailR = V.TAIL_REAR + A.GRIP_EASE * A.LEVEL;
  let FyR = tyre(alphaR, V.PEAK_ANGLE_REAR * DEG, tailR > 1 ? 1 : tailR, V.TAIL_FALL) * capR * latScaleR;
  s.alphaR = alphaR;
  s.spinning = spinning;
  s.rearSlide = Math.min(2, Math.abs(alphaR) / (V.PEAK_ANGLE_REAR * DEG));
  s.frontSlide = Math.min(2, Math.abs(alphaF) / (V.PEAK_ANGLE_FRONT * DEG));

  /* Neither axle may reverse its own lateral slip within one step; that
     is what makes the model still at rest instead of twitching. The
     front's slip is measured across the steered wheel, not the body. */
  const halfM = 0.5 * m / dt;
  const vlatWheelF = vlatF * cosD - vx * sinD;
  const limF = Math.abs(vlatWheelF) * halfM; if (FyF > limF) FyF = limF; else if (FyF < -limF) FyF = -limF;
  const limR = Math.abs(vlatR) * halfM; if (FyR > limR) FyR = limR; else if (FyR < -limR) FyR = -limR;

  /* ---- resistance ---- */
  let resist = -V.DRAG * m * vx * absVx;
  const rollF = m * V.ROLL;
  if (absVx > 0.01) resist -= fwdSign * Math.min(rollF, absVx * m / dt);

  /* ---- sum, integrate ---- */
  const Fx = FxR + FxF * cosD + hbForce - FyF * sinD + resist;
  const Fy = FyF * cosD + FyR + FxF * sinD;
  const yawMoment = a * (FyF * cosD + FxF * sinD) - b * FyR;
  const ax = Fx / m, ay = Fy / m;
  s.axF += (ax - s.axF) * Math.min(1, dt / V.WEIGHT_TRANSFER_TAU);
  s.r += yawMoment / Iz * dt;
  /* The angle limiter: past ANGLE_LIMIT the car is turned back towards
     its travel, so a slide stays a drift and does not tip into a spin.
     beta > 0 is a right hand slide, which a left turn (+r) closes. */
  if (vx > V.LOW_SPEED && A.LEVEL > 0) {
    const absB = Math.abs(beta), dir = beta > 0 ? 1 : -1;
    /* a slide past DRIFT_ENTER starts a drift, and so does the handbrake
       at speed: tap DRIFT and the tail kicks out to the drift angle */
    if (!s.drifting && (absB > A.DRIFT_ENTER * DEG || (s.hb > 0.5 && vx > A.DRIFT_MIN_SPEED && input.steer !== 0))) s.drifting = 1;
    else if (s.drifting && absB < A.DRIFT_EXIT * DEG && s.hb === 0) s.drifting = 0;
    if (!s.drifting) s.driftTarget = 0;
    if (s.drifting) {
      /* the angle the driver is asking for: steering into the slide
         (the same sign as beta, see the spin control) opens it, out of
         it closes it, and lifting off closes it a little */
      /* at the very start of a handbrake drift the slide has no direction
         yet: take it from the steering, defaulting to the way the car is
         turning */
      const dirUse = absB < 2 * DEG ? (input.steer !== 0 ? (input.steer > 0 ? 1 : -1) : (s.r < 0 ? 1 : -1)) : dir;
      const into = input.steer * dirUse;
      let target = into > 0 ? (A.DRIFT_ANGLE + A.DRIFT_RANGE * into) * Math.min(1, into * 2) : 0;
      target *= A.DRIFT_LIFT + (1 - A.DRIFT_LIFT) * input.throttle;
      if (s.hb > 0 && input.steer !== 0) target = Math.max(target, A.DRIFT_ANGLE);
      /* Ease in: the angle the controller holds rises towards the one
         asked for at DRIFT_EASE_IN degrees a second, so a drift builds
         instead of snapping in; it falls at DRIFT_EASE_OUT. */
      const want = target;
      if (want > s.driftTarget) s.driftTarget = Math.min(want, Math.max(s.driftTarget, absB / DEG) + A.DRIFT_EASE_IN * dt);
      else s.driftTarget = Math.max(want, s.driftTarget - A.DRIFT_EASE_OUT * dt);
      target = s.driftTarget;
      // beta > 0 opens with a right turn (-r)
      s.r -= dirUse * A.DRIFT_HOLD * (target * DEG - absB * (dirUse === dir ? 1 : -1)) * dt * A.LEVEL;
      /* +r always closes the slide angle, whichever way it points, so the
         damping is the same expression for both directions */
      s.r += A.DRIFT_DAMP * (beta - s.prevBeta) * A.LEVEL;
    }
    const lim = A.ANGLE_LIMIT * DEG;
    if (beta > lim) s.r += A.ANGLE_PULL * (beta - lim) * dt * A.LEVEL;
    else if (beta < -lim) s.r += A.ANGLE_PULL * (beta + lim) * dt * A.LEVEL;
  }
  // world velocity from the body accelerations
  s.wvx += (ax * fx + ay * lx) * dt;
  s.wvz += (ax * fz + ay * lz) * dt;
  /* A drift keeps its speed: the tyres' sideways scrub would bleed it
     away in a second or two, which reads as the car bogging down. Give
     back DRIFT_KEEP of the speed lost this step while drifting under
     throttle. */
  if (s.drifting && throttle > 0 && A.LEVEL > 0 && A.DRIFT_KEEP > 0) {
    const sp1 = Math.hypot(s.wvx, s.wvz);
    if (sp1 > 0.1 && sp1 < speed) { const k = (sp1 + (speed - sp1) * A.DRIFT_KEEP * throttle * A.LEVEL) / sp1; s.wvx *= k; s.wvz *= k; }
  }
  /* The carve and the scrub: in a drift the path bends towards where the
     car points, and the slide slows the car to DRIFT_CRUISE. The path's
     direction psi is measured like yaw, so v = (-sin psi, -cos psi), and
     a slide of beta has psi = yaw + beta; carving moves psi towards yaw. */
  if (s.drifting && A.LEVEL > 0) {
    const sp = Math.hypot(s.wvx, s.wvz);
    if (sp > 1) {
      const absB = Math.abs(beta);
      const c = Math.min(A.DRIFT_CARVE * absB * dt, absB) * (beta > 0 ? 1 : -1) * A.LEVEL;
      const psi = Math.atan2(-s.wvx, -s.wvz) - c;
      let sp2 = sp;
      if (sp > A.DRIFT_CRUISE) sp2 = Math.max(A.DRIFT_CRUISE, sp - A.DRIFT_SCRUB * Math.min(1.5, absB / (45 * DEG)) * dt * A.LEVEL);
      s.wvx = -Math.sin(psi) * sp2; s.wvz = -Math.cos(psi) * sp2;
    }
  }

  /* ---- the low speed blend: below LOW_SPEED the car turns as a
     kinematic bicycle and stops sliding, so it can be parked ---- */
  vx = s.wvx * fx + s.wvz * fz;
  vy = s.wvx * lx + s.wvz * lz;
  const w = 1 - smooth01((Math.sqrt(vx * vx + vy * vy) - V.LOW_SPEED * 0.5) / V.LOW_SPEED);
  if (w > 0) {
    const rK = vx * Math.tan(delta) / L;
    const vyK = b * rK;
    s.r += (rK - s.r) * w;
    vy += (vyK - vy) * w;
    s.wvx = vx * fx + vy * lx;
    s.wvz = vx * fz + vy * lz;
  }
  s.prevBeta = beta;
  s.yaw += s.r * dt;
  if (s.yaw > Math.PI) s.yaw -= 2 * Math.PI; else if (s.yaw < -Math.PI) s.yaw += 2 * Math.PI;
  s.x += s.wvx * dt;
  s.z += s.wvz * dt;
  s.vx = vx; s.vy = vy;
  s.speed = Math.sqrt(vx * vx + vy * vy);

  /* ---- the wheels, for drawing ---- */
  const wr = V.WHEEL_RADIUS;
  s.wheelF += vx / wr * dt;
  s.wheelR += (spinning ? Math.max(vx, 8) * 2.2 : s.hb > 0.5 ? vx * (1 - s.hb) : vx) / wr * dt;
}

/* A collision impulse at a body point: n is the unit normal pointing
   into the car (away from the wall), px, pz the point in world. Returns
   the normal speed that was removed. The car is a 2D rigid body here:
   its yaw rate takes a share of the hit through the point's lever arm. */
export function applyImpact(s, px, pz, nx, nz, restitution, friction) {
  const V = TUNE.VEHICLE;
  const m = V.MASS, a = V.CG_TO_FRONT, b = V.WHEELBASE - a;
  const Iz = V.INERTIA_FACTOR * m * a * b;
  const rx = px - s.x, rz = pz - s.z;            // lever arm
  // point velocity: v + omega x r, omega about +Y: (x, z) -> (omega*z, -omega*x)
  const pvx = s.wvx + s.r * rz, pvz = s.wvz - s.r * rx;
  const vn = pvx * nx + pvz * nz;
  if (vn >= 0) return 0;
  const rn = rz * nx - rx * nz;                  // r x n, scalar about Y
  const kn = 1 / m + rn * rn / Iz;
  const j = -(1 + restitution) * vn / kn;
  s.wvx += j * nx / m; s.wvz += j * nz / m;
  s.r += j * rn / Iz * V.WALL_SPIN;
  // friction along the tangent
  const tx = -nz, tz = nx;
  const pvx2 = s.wvx + s.r * rz, pvz2 = s.wvz - s.r * rx;
  const vt = pvx2 * tx + pvz2 * tz;
  const rt = rz * tx - rx * tz;
  const kt = 1 / m + rt * rt / Iz;
  let jt = -vt / kt;
  const maxJt = friction * j;
  if (jt > maxJt) jt = maxJt; else if (jt < -maxJt) jt = -maxJt;
  s.wvx += jt * tx / m; s.wvz += jt * tz / m;
  s.r += jt * rt / Iz * V.WALL_SPIN;
  return -vn;
}

/* The body's contact points in world: four corners and the two side
   midpoints. Fills out (12 numbers) and returns it. */
export function bodyPoints(s, out) {
  const V = TUNE.VEHICLE;
  const hl = V.HALF_LENGTH, hw = V.HALF_WIDTH;
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
  const lx = -Math.cos(s.yaw), lz = Math.sin(s.yaw);
  const pts = out || new Float64Array(12);
  const put = (i, f, l) => { pts[i * 2] = s.x + fx * f + lx * l; pts[i * 2 + 1] = s.z + fz * f + lz * l; };
  put(0, hl, hw); put(1, hl, -hw); put(2, -hl, hw); put(3, -hl, -hw); put(4, 0, hw); put(5, 0, -hw);
  return pts;
}

/* The state that defines a run, as a string, for the determinism test. */
export function vehicleHash(s) {
  return [s.x, s.z, s.yaw, s.wvx, s.wvz, s.r, s.steerDriver, s.axF, s.hb].map(v => v.toString()).join(',');
}
