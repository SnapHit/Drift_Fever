/* THE TUNE BLOCK. Every feel constant in the game lives here and nowhere
   else: the vehicle, the assists, the camera, the scoring and the
   controls. Nothing tunable sits inline in a loop. The ?tune=1 panel
   edits these live and remembers them on the device; PANEL at the bottom
   says which ones it shows and over what range.

   Units are metres, seconds, kilograms, radians inside the physics; the
   angles here are written in degrees for the author and converted where
   they are read. Y is up. The car faces -Z at yaw zero, and +yaw is a
   left turn, as three.js rotates about Y. */

export const TUNE = {
  VEHICLE: {
    MASS:               1250,    // kg
    WHEELBASE:          2.55,    // m, front axle to rear axle
    CG_TO_FRONT:        1.25,    // m, centre of mass to the front axle (rear heavy helps rotation)
    CG_HEIGHT:          0.52,    // m, for weight transfer
    TRACK:              1.60,    // m, left wheel to right wheel, for the wheels and the corners
    HALF_LENGTH:        2.20,    // m, body half length, for collisions
    HALF_WIDTH:         0.92,    // m, body half width
    WHEEL_RADIUS:       0.33,    // m
    INERTIA_FACTOR:     1.15,    // yaw inertia as a share of m * (a*b): below 1 turns in quicker
    ACCEL:              12,      // m/s^2, drive at a standstill (was 8.5: 0 to 100 km/h took 7.2 s)
    TOP_SPEED:          62,      // m/s, where the drive force reaches zero (223 km/h; was 48)
    TRACTION:           1.6,     // drive grip as a multiple of the rear's lateral grip, so a launch hooks up instead of spinning
    REVERSE_SPEED:      12,      // m/s
    REVERSE_ACCEL:      7,       // m/s^2
    DRAG:               0.0012,  // per metre: drag deceleration is DRAG * v^2
    ROLL:               0.35,    // m/s^2, rolling resistance
    BRAKE:              16,      // m/s^2, full brake
    BRAKE_FRONT_SHARE:  0.65,    // share of the brake on the front axle
    MU_FRONT:           1.20,    // peak tyre grip, front axle (as a multiple of the axle load)
    MU_REAR:            1.15,    // and rear
    PEAK_ANGLE_FRONT:   9,       // degrees of slip where the front tyre peaks
    PEAK_ANGLE_REAR:    8,       // and the rear
    TAIL_FRONT:         0.85,    // grip left at a full slide, as a share of the peak
    TAIL_REAR:          0.78,
    TAIL_FALL:          0.9,     // how quickly grip falls past the peak (per unit of excess slip)
    SPIN_GRIP:          0.85,    // lateral grip left when the rear is spinning under power
    SPIN_DRIVE:         0.85,    // drive force delivered when the rear is spinning
    HANDBRAKE_GRIP:     0.45,    // rear grip while the handbrake is on, as a share
    HANDBRAKE_DECEL:    9.0,     // m/s^2 of braking from the locked rear
    HANDBRAKE_RELEASE:  0.25,    // s for the rear to find grip again after release
    LOCK:               32,      // degrees of steering lock at a standstill
    LOCK_AT_SPEED:      12,      // degrees at LOCK_SPEED and above, for the driver's input
    LOCK_SPEED:         30,      // m/s
    STEER_RATE:         3.2,     // full lock per second, turning in
    STEER_RETURN:       5.0,     // and returning to centre
    WEIGHT_TRANSFER_TAU: 0.12,   // s, how quickly load moves under acceleration
    MIN_AXLE_LOAD:      0.18,    // never less than this share of the weight on an axle
    LOW_SPEED:          3.0,     // m/s, below this the kinematic model takes over
    GRAVITY:            9.81,
    WALL_SPIN:          0.35,    // share of a wall hit's turning that reaches the car: walls slide you along instead of spinning you round
  },
  ASSIST: {
    LEVEL:              1.0,     // the hidden level: 0 is raw, 1 is the phone setting
    COUNTERSTEER:       0.60,    // steer added per radian of body slip, scaled by LEVEL
    COUNTERSTEER_LOCK:  40,      // degrees the assist may steer to, beyond the driver's lock
    SPIN_ANGLE:         40,      // degrees of slip where the spin guard starts
    SPIN_GAIN:          5.0,     // extra countersteer per radian past that
    YAW_SOFT:           0.8,     // rad/s of yaw where the spin control starts
    YAW_MAX:            1.6,     // and where steering in is gone and the throttle fully eased
    THROTTLE_EASE:      0.9,     // share of the throttle the spin control lifts by YAW_MAX
    YAW_DAMP:           0.15,    // steer against yaw rate, per rad/s, scaled by LEVEL
    GRIP_EASE:          0.0,     // extra rear tail grip at full LEVEL (0 keeps the tuned tyre)
    ANGLE_LIMIT:        58,      // degrees of slide past which the car is turned back towards its travel
    ANGLE_PULL:         60,      // rad/s of yaw rate added per radian past the limit, per second, scaled by LEVEL
    /* The drift controller. Once the car is sliding (past DRIFT_ENTER) it
       is in a drift until the slide closes below DRIFT_EXIT. In a drift,
       steering sets the angle: full steer into the slide holds
       DRIFT_ANGLE + DRIFT_RANGE, less steer holds less, and letting go of
       the steering asks for none, so the car straightens itself (the
       natural thing to do on a phone). The handbrake holds at least
       DRIFT_ANGLE. Lifting off the throttle closes it a little. The car is
       turned towards that angle at DRIFT_HOLD, and DRIFT_DAMP resists the
       slide angle changing quickly, which stops a flick overshooting. */
    DRIFT_ENTER:        14,      // degrees
    DRIFT_MIN_SPEED:    8,       // m/s, the handbrake starts a drift above this
    DRIFT_EXIT:         6,       // degrees
    DRIFT_ANGLE:        30,      // degrees held by the handbrake, and the base of the steered angle
    DRIFT_RANGE:        16,      // more degrees with full steer into the slide
    DRIFT_LIFT:         0.5,     // share of the angle kept with the throttle off
    DRIFT_HOLD:         40,      // rad/s of yaw rate per radian of angle error, per second
    DRIFT_DAMP:         8,       // yaw rate per unit of slide angle rate, against quick changes
    /* A drift turns and slows the car, so DRIFT through a corner carves
       an arc instead of sliding straight on into the wall. The path bends
       towards where the car points at DRIFT_CARVE rad/s per radian of
       slide, and the slide scrubs speed at DRIFT_SCRUB m/s^2 (at 45
       degrees) down to DRIFT_CRUISE, where it holds. */
    DRIFT_CARVE:        0.9,     // rad/s of path turn per radian of slide angle
    DRIFT_SCRUB:        9,       // m/s^2 of slowing at a 45 degree slide
    DRIFT_CRUISE:       20,      // m/s, the speed a drift settles to (54 km/h)
    DRIFT_KEEP:         0.0,     // share of the speed scrubbed by the slide that the drift gives back
    RECOVER_AFTER:      1.2,     // s stuck (slow, against a wall or facing backwards, trying to drive) before the car is put back on the track
    RECOVER_SPEED:      2.0,     // m/s, below this counts as stuck
    RECOVER_LAUNCH:     8,       // m/s, the speed the car is given back on the track
  },
  CAMERA: {
    DISTANCE:           8.5,     // m behind the car
    DISTANCE_SPEED:     0.045,   // extra metres per m/s
    HEIGHT:             3.8,     // m above the ground
    LOOK_AHEAD:         6.0,     // m ahead of the car the camera looks at
    LOOK_UP:            0.7,     // m above the ground
    LAG:                0.22,    // s, time constant of the heading follow
    SWING:              0.65,    // share of the drift angle the camera swings out by
    SWING_MAX:          50,      // degrees, the most it swings
    FOV:                62,      // degrees, vertical, in landscape
    FOV_PORTRAIT:       78,      // and in portrait
    FOV_SPEED:          0.35,    // degrees per m/s
    PORTRAIT_DISTANCE:  1.05,    // multiplier on the distance in portrait
    PORTRAIT_HEIGHT:    1.25,    // and on the height
    PORTRAIT_LOOK:      1.30,    // and on the look ahead
    SHAKE:              0.06,    // m of look target shake per m/s of impact
    SHAKE_MAX:          0.9,     // m
    SHAKE_DECAY:        6.0,     // per second
    SHAKE_HZ:           23,      // cycles per second
    NEAR:               0.5,
    FAR:                900,
  },
  SCORING: {
    MIN_ANGLE:          12,      // degrees of drift before points start
    MIN_SPEED:          6,       // m/s, below this nothing scores
    RATE:               0.011,   // points per second per degree per km/h
    CHAIN_STEP:         2.0,     // seconds of drift per multiplier step
    CHAIN_MAX:          8,       // the multiplier's ceiling
    BANK_GAP:           0.7,     // seconds straight before the chain banks
    HARD_HIT:           4.0,     // m/s into a wall loses the chain
    HIT_SPEED_KEEP:     0.55,    // share of speed kept through a hard hit
    PROX_DIST:          1.6,     // m from a clip wall or a cone for the proximity bonus
    PROX_BONUS:         2.0,     // multiplier on points while close
    BIG_ANGLE:          45,      // degrees, the callout
    LONG_CHAIN:         8,       // seconds, the callout
  },
  CONTROLS: {
    GAMEPAD_DEADZONE:   0.12,
    AUTO_THROTTLE:      1,       // 1: the car always drives once the player has pressed anything; no brake, DRIFT slows it
  },
};

/* What the ?tune=1 panel shows: path, label, min, max, step. */
export const PANEL = [
  ['VEHICLE.ACCEL',          'accel m/s2',        3,   16,  0.5],
  ['VEHICLE.TOP_SPEED',      'top speed m/s',    25,   70,  1],
  ['VEHICLE.MU_FRONT',       'grip front',      0.6,  1.8,  0.05],
  ['VEHICLE.MU_REAR',        'grip rear',       0.6,  1.8,  0.05],
  ['VEHICLE.TAIL_REAR',      'rear slide grip', 0.4,  1.0,  0.02],
  ['VEHICLE.TAIL_FRONT',     'front slide grip',0.4,  1.0,  0.02],
  ['VEHICLE.PEAK_ANGLE_REAR','rear peak deg',     4,   16,  0.5],
  ['VEHICLE.SPIN_GRIP',      'wheelspin grip',  0.2,  1.0,  0.05],
  ['VEHICLE.HANDBRAKE_GRIP', 'handbrake grip',  0.1,  0.8,  0.05],
  ['VEHICLE.HANDBRAKE_RELEASE','hb release s',  0.0,  0.8,  0.05],
  ['VEHICLE.LOCK',           'lock deg',         15,   45,  1],
  ['VEHICLE.LOCK_AT_SPEED',  'lock at speed',     5,   30,  1],
  ['VEHICLE.STEER_RATE',     'steer rate',        1,    8,  0.2],
  ['VEHICLE.INERTIA_FACTOR', 'yaw inertia',     0.5,  1.6,  0.05],
  ['VEHICLE.CG_TO_FRONT',    'cg to front m',   0.9,  1.6,  0.05],
  ['VEHICLE.BRAKE',          'brake m/s2',        6,   24,  1],
  ['VEHICLE.TRACTION',       'launch traction', 1.0,  2.5,  0.1],
  ['VEHICLE.WALL_SPIN',      'wall spin',         0,    1,  0.05],
  ['ASSIST.LEVEL',           'assist level',      0,    1,  0.05],
  ['ASSIST.COUNTERSTEER',    'countersteer',      0,    2,  0.05],
  ['ASSIST.YAW_DAMP',        'yaw damp',          0,  0.4,  0.01],
  ['ASSIST.SPIN_ANGLE',      'spin guard deg',   30,   90,  1],
  ['ASSIST.YAW_SOFT',        'spin ctrl from',  0.5,    3,  0.1],
  ['ASSIST.YAW_MAX',         'spin ctrl full',    1,    4,  0.1],
  ['ASSIST.THROTTLE_EASE',   'spin ctrl lift',    0,    1,  0.05],
  ['ASSIST.ANGLE_LIMIT',     'max angle deg',    30,   90,  1],
  ['ASSIST.DRIFT_ANGLE',     'drift angle deg',  15,   50,  1],
  ['ASSIST.DRIFT_RANGE',     'drift steer range', 0,   35,  1],
  ['ASSIST.DRIFT_HOLD',      'drift hold',        0,   15,  0.5],
  ['ASSIST.DRIFT_CARVE',     'drift carve',       0,    3,  0.1],
  ['ASSIST.DRIFT_SCRUB',     'drift slows m/s2',  0,   20,  0.5],
  ['ASSIST.DRIFT_CRUISE',    'drift speed m/s',   6,   30,  1],
  ['VEHICLE.HANDBRAKE_DECEL','drift brake m/s2',  2,   16,  0.5],
  ['ASSIST.ANGLE_PULL',      'angle pull',        0,   20,  0.5],
  ['CAMERA.DISTANCE',        'cam distance',      4,   16,  0.5],
  ['CAMERA.HEIGHT',          'cam height',        1,    9,  0.1],
  ['CAMERA.LOOK_AHEAD',      'cam look ahead',    0,   16,  0.5],
  ['CAMERA.LAG',             'cam lag s',      0.02,  0.8,  0.02],
  ['CAMERA.SWING',           'cam swing',         0,    1,  0.05],
  ['CAMERA.FOV',             'fov landscape',    40,   95,  1],
  ['CAMERA.FOV_PORTRAIT',    'fov portrait',     50,  110,  1],
  ['CAMERA.FOV_SPEED',       'fov per m/s',       0,    1,  0.05],
  ['SCORING.MIN_ANGLE',      'score min angle',   5,   25,  1],
];

/* Read and write by dotted path, for the panel and the probes. */
export function tuneGet(path) { const [g, k] = path.split('.'); return TUNE[g][k]; }
export function tuneSet(path, v) { const [g, k] = path.split('.'); TUNE[g][k] = v; }
export function tuneDefaults() { return JSON.parse(JSON.stringify(DEFAULTS)); }
const DEFAULTS = JSON.parse(JSON.stringify(TUNE));
