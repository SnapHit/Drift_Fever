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
    ACCEL:              14,      // m/s^2, drive at a standstill (was 8.5: 0 to 100 km/h took 7.2 s)
    TOP_SPEED:          68,      // m/s, where the drive force reaches zero (223 km/h; was 48)
    TRACTION:           1.6,     // drive grip as a multiple of the rear's lateral grip, so a launch hooks up instead of spinning
    TURN_LIFT:          0.85,    // share of the drive eased off at full steer on grip, so a held turn holds its speed
    TURN_LIFT_FROM:     10,      // m/s, above this
    REVERSE_SPEED:      12,      // m/s
    REVERSE_ACCEL:      7,       // m/s^2
    DRAG:               0.0012,  // per metre: drag deceleration is DRAG * v^2
    ROLL:               0.35,    // m/s^2, rolling resistance
    BRAKE:              16,      // m/s^2, full brake
    BRAKE_FRONT_SHARE:  0.65,    // share of the brake on the front axle
    MU_FRONT:           1.80,    // arcade grip: about 1.5 g in a turn (was 1.2, about 1 g)    // peak tyre grip, front axle (as a multiple of the axle load)
    MU_REAR:            2.10,    // more than the front, so a hard grip turn grips instead of stepping out    // and rear
    PEAK_ANGLE_FRONT:   9,       // degrees of slip where the front tyre peaks
    PEAK_ANGLE_REAR:    8,       // and the rear
    TAIL_FRONT:         0.85,    // grip left at a full slide, as a share of the peak
    TAIL_REAR:          0.85,
    TAIL_FALL:          0.9,     // how quickly grip falls past the peak (per unit of excess slip)
    SPIN_GRIP:          0.85,    // lateral grip left when the rear is spinning under power
    SPIN_DRIVE:         0.85,    // drive force delivered when the rear is spinning
    HANDBRAKE_GRIP:     0.25,    // rear grip while the handbrake is on, as a share
    HANDBRAKE_DECEL:    9.0,     // m/s^2 of braking from the locked rear
    HANDBRAKE_ENGAGE:   0.25,    // s for the handbrake to take the rear's grip, so the tail steps out gradually
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
    /* THE SLINGSHOT (5 November 2026, for speed and fury): a drift held
       for at least BOOST_MIN_DRIFT seconds gives a burst of speed as it
       ends, BOOST_PER_S seconds of boost per second of drift up to
       BOOST_MAX. A hard hit or a respawn cancels the drift's credit. Kept
       in the physics, not the scoring, so a ghost boosts exactly as its
       run did. */
    BOOST_MIN_DRIFT:    0.6,     // s of drift before the exit pays a boost
    BOOST_PER_S:        0.7,     // s of boost per s of drift
    BOOST_MAX:          0,       // s; 0 is off. Off by default: on generated tracks the scripted drifter hit walls
                                 // 1.5 to 2.4 times as often with it on (it ends drifts mid corner). Try 1 to 2 at ?tune=1.
    BOOST_ACCEL:        9,       // m/s^2 of extra drive while boosting
    BOOST_TOP:          14,      // m/s added to the top speed while boosting
    WALL_SPIN:          0.35,    // share of a wall hit's turning that reaches the car: walls slide you along instead of spinning you round
  },
  ASSIST: {
    LEVEL:              1.0,     // the hidden level: 0 is raw, 1 is the phone setting
    COUNTERSTEER:       0.60,    // steer added per radian of body slip, scaled by LEVEL
    COUNTERSTEER_LOCK:  40,      // degrees the assist may steer to, beyond the driver's lock
    SPIN_ANGLE:         40,      // degrees of slip where the spin guard starts
    SPIN_GAIN:          5.0,     // extra countersteer per radian past that
    SLIDE_FROM:         10,      // degrees of slide where the spin control and yaw damping start
    SLIDE_FULL:         25,      // and where they are fully on
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
    DRIFT_EASE_IN:      50,      // degrees a second the held drift angle may grow, so a drift builds instead of snapping in
    DRIFT_EASE_OUT:     120,     // and shrink
    DRIFT_HOLD:         40,      // rad/s of yaw rate per radian of angle error, per second
    DRIFT_DAMP:         8,       // yaw rate per unit of slide angle rate, against quick changes
    /* A drift turns and slows the car, so DRIFT through a corner carves
       an arc instead of sliding straight on into the wall. The path bends
       towards where the car points at DRIFT_CARVE rad/s per radian of
       slide, and the slide scrubs speed at DRIFT_SCRUB m/s^2 (at 45
       degrees) down to DRIFT_CRUISE, where it holds. */
    DRIFT_GRIP:         0.35,    // share of the rear's grip it keeps for as long as a drift lasts
    DRIFT_CARVE:        0.9,     // rad/s of path turn per radian of slide angle
    DRIFT_SCRUB:        9,       // m/s^2 of slowing at a 45 degree slide
    DRIFT_CRUISE:       24,      // m/s, the speed a drift settles to (54 km/h)
    DRIFT_KEEP:         0.0,     // share of the speed scrubbed by the slide that the drift gives back
    RECOVER_AFTER:      1.2,     // s stuck (slow, against a wall or facing backwards, trying to drive) before the car is put back on the track
    RECOVER_SPEED:      2.0,     // m/s, below this counts as stuck
    RECOVER_LAUNCH:     8,       // m/s, the speed the car is given back on the track
  },
  /* THE ROAD'S SHAPE UNDER THE CAR (briefs/TRACKS-2.md): banked corners
     and the climbs to a bridge. New physics beside the handling, not a
     retune of it: on a flat road every term here is exactly zero and the
     car behaves as before. The world hands the vehicle the road's slope
     under it each step; the vehicle feels gravity's share along and
     across the road, the load the bank presses it into the road with,
     and a crest's unloading. */
  BANK: {
    GRIP:               1.0,     // share of a banked road's help the tyres get: gravity's sideways pull and the extra load into the bank (0 is flat physics)
    SLOPE:              1.0,     // share of gravity's pull along a slope: climbing slows the car, descending speeds it
    LIFT:               1.0,     // share of a crest's unloading, and a dip's extra load
    CRUISE_PER_DEG:     0.5,     // m/s added to the speed a drift settles to, per degree the road banks towards the inside of the slide
    LAYER_HEIGHT:       2.5,     // m: a wall more than this above or below the car's road is on another layer and is never touched
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
    FOV_SPEED:          0.5,     // degrees per m/s (was 0.35; more sense of speed)
    BOOST_FOV:          10,      // degrees more while boosting, eased in and out
    BOOST_FOV_TIME:     0.25,    // s for the boost field of view to ease
    SPEED_RUMBLE:       0.012,   // m of look target rumble per m/s above RUMBLE_FROM, for a sense of speed
    RUMBLE_FROM:        30,      // m/s
    PORTRAIT_DISTANCE:  1.05,    // multiplier on the distance in portrait
    PORTRAIT_HEIGHT:    1.25,    // and on the height
    PORTRAIT_LOOK:      1.30,    // and on the look ahead
    BRIDGE_CLEAR:       0.6,     // m the camera keeps under a bridge deck's underside while the car is on the road beneath
    BRIDGE_EDGE:        1.0,     // m past the deck's half width its parapets reach
    BRIDGE_EASE:        0.3,     // m the camera may rise per m it is outside the deck's edge, so it eases down to pass under
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
    CHAIN_STEP:         1.2,     // seconds of drift per multiplier step (was 2.0: after play on 8 November, big chains were out of reach)
    CHAIN_MAX:          8,       // the multiplier's ceiling
    BANK_GAP:           1.5,     // seconds straight before the chain banks (was 0.7: a chain now links across a short straight into the next corner)
    HARD_HIT:           6.0,     // m/s into a wall loses the chain
    HIT_SPEED_KEEP:     0.75,    // share of speed kept through a hard hit
    PROX_DIST:          1.6,     // m from a clip wall or a cone for the proximity bonus
    PROX_BONUS:         2.0,     // multiplier on points while close
    CLEAN_SHARE:        0.65,    // a run with no wall contact earns this share of the first star, sector by sector
    PACE_SHARE:         0.4,     // and finishing at par pace this share, more the faster (so a clean run at par is one star)
    PAR_SPEED:          18,      // m/s (65 km/h), the average speed that is par for a run: a careful clean driver's pace
    PACE_CAP:           1.6,     // the pace bonus is at most this many times its value at par
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
  ['VEHICLE.MU_FRONT',       'grip front',      0.6,  2.5,  0.05],
  ['VEHICLE.MU_REAR',        'grip rear',       0.6,  2.5,  0.05],
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
  ['VEHICLE.TURN_LIFT',      'turn eases drive',  0,    1,  0.05],
  ['VEHICLE.BOOST_MAX',      'drift boost s (0 off)', 0, 2.5, 0.1],
  ['VEHICLE.BOOST_ACCEL',    'boost push m/s2',   0,   16,  0.5],
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
  ['ASSIST.DRIFT_HOLD',      'drift hold',        0,   60,  1],
  ['ASSIST.DRIFT_EASE_IN',   'drift ease in deg/s', 20, 200, 5],
  ['VEHICLE.HANDBRAKE_ENGAGE','drift engage s',   0,  0.6, 0.05],
  ['ASSIST.DRIFT_CARVE',     'drift carve',       0,    3,  0.1],
  ['ASSIST.DRIFT_GRIP',      'drift rear grip',   0.2,  1,  0.05],
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
  ['BANK.GRIP',              'bank grip',         0,    1,  0.05],
  ['BANK.CRUISE_PER_DEG',    'bank drift m/s per deg', 0, 1.5, 0.05],
];

/* Read and write by dotted path, for the panel and the probes. */
export function tuneGet(path) { const [g, k] = path.split('.'); return TUNE[g][k]; }
export function tuneSet(path, v) { const [g, k] = path.split('.'); TUNE[g][k] = v; }
export function tuneDefaults() { return JSON.parse(JSON.stringify(DEFAULTS)); }
const DEFAULTS = JSON.parse(JSON.stringify(TUNE));

/* THE GAME LOOP BLOCK: everything tunable about a run that is not the
   car's feel. The countdown, the lap count, how a run's score turns into
   stars and coins, what cars and paint cost, and how the ghost looks.
   Nothing here is balanced yet; the numbers are a first guess for the
   author to play against, and the loop probes report what the scripted
   drifter scores against the star targets. */
export const LOOP = {
  COUNTDOWN:          3.0,     // s, 3 2 1 then GO
  GO_SHOWN:           0.8,     // s the GO stays up after the car is released
  LAPS:               3,       // laps of a circuit
  CHECKPOINTS:        3,       // per lap when a track names none (the test track)
  RESULTS_LOCKOUT:    0.7,     // s before the results screen takes the go again input
  FINISH_SETTLE:      0.35,    // s after the line before the open chain is banked and the results shown
  STAR_RATE:          0.3,     // points per metre of run (length times laps) for the first star (was 0.55: after play on 7 November, too hard to progress)
  STAR_LEVELS:        [1, 2, 3.5],   // the three targets as multiples of the first (was 1, 2.2, 4)
  STAR_HARD_EASE:     0.3,     // a track of difficulty d asks (1 - d x this) of the rate: tighter tracks score less per metre
  COIN_PER_POINT:     0.1,     // coins from the score (was 0.02: after play on 8 November, a whole career earned too little to buy a car)
  COIN_PER_STAR:      30,      // and for each star earned, every time (was 25)
  NEW_STAR_BONUS:     100,     // and once more for each star newly won on a track or the day's daily
  DAILY_BONUS:        1.5,     // the daily drift pays this much more
  PAINT_PRICE:        60,      // coins for a paint other than the car's own
  UPGRADE_PRICES:     [250, 500, 900],   // coins for each step of an upgrade, the same for every car
  UPGRADE: {                   // what each step does, as a share of the car's own value
    POWER_ACCEL:      0.06,    // power: drive, per step
    POWER_TOP:        0.04,    // and top speed
    GRIP:             0.04,    // grip: both axles' peak grip, per step
    STEER_LOCK:       0.07,    // steering: lock at a standstill and at speed, per step
    STEER_RATE:       0.07,    // and how fast it turns in
  },
  GHOST_OPACITY:      0.38,
  GHOST_TINT:         0xdfe6ff,
  GHOST_MIN_STEPS:    120,     // a run shorter than a second is not a ghost
  SAVE_VERSION:       1,
  FREE_TRACK:         'park',
  /* TRACK MISSIONS (briefs/RETENTION.md 2): three per career track and
     per daily, chosen from the track's seed and features, paid in coins
     the first time each is done. First guesses for the author to tune.
     Targets scale with the track: a hold from its longest corner, a
     chain and a time from its first star and par pace, clips from its
     clipping zones. */
  MISSIONS: {
    COINS:            60,      // coins the first time a mission is done
    HOLD_SPEED:       24,      // m/s a drift settles to (ASSIST.DRIFT_CRUISE): a corner of L metres is L / this seconds of slide
    HOLD_SHARE:       0.6,     // share of the longest corner's slide time to hold
    HOLD_RANGE:       [2, 4],  // s, the hold target is kept inside this
    CHAIN_SHARE:      0.25,    // one banked chain worth this share of the first star
    CHAIN_MIN:        100,     // points, at least
    CLIP_SHARE:       0.5,     // share of the track's clipping zones to clip (drift close to), at least 2 where there are 2
    TIME_FACTOR:      0.95,    // finish inside this share of par time (run metres at SCORING.PAR_SPEED)
    MULT:             [2, 3],  // the multiplier to reach, easy and hard tracks (x4 was never reached by a scripted driver)
    SHOWN:            2.5,     // s the mission list stays after GO
  },
  /* TRACK LAB (briefs/RETENTION.md 3): a player's own tracks by code.
     What the length words mean to the generator, the feature weights of
     each style (TRACKS.WEIGHTS is 'mixed'), how many codes are kept, and
     what a Lab run pays. First guesses. */
  LAB: {
    DIFFICULTY:       0.5,     // the difficulty every Lab track is asked at; the style shapes it
    LENGTH:           { circuit: { short: 560, medium: 760, long: 1000 }, sprint: { short: 700, medium: 1000, long: 1300 } },   // m asked of the generator
    STYLES: {                  // feature weights [easy, hard], as TRACKS.WEIGHTS
      flowing:   { hairpin: [0, 0], tight: [1, 1], sweeper: [4, 3], esses: [2, 2], chicane: [0, 0], flow: [4, 4], multi: [3, 3], double: [0, 0], tightening: [1, 1], opening: [2, 2] },
      technical: { hairpin: [1, 1], tight: [3, 3], sweeper: [0, 0], esses: [3, 3], chicane: [3, 3], flow: [2, 2], multi: [0, 0], double: [1, 1], tightening: [2, 2], opening: [1, 1] },
      hairpins:  { hairpin: [4, 4], tight: [2, 2], sweeper: [1, 1], esses: [0, 0], chicane: [0, 0], flow: [0, 0], multi: [1, 1], double: [3, 3], tightening: [1, 1], opening: [1, 1] },
    },
    KEEP:             6,       // codes whose best and ghost are kept, the most recently driven
    COIN_RATE:        0.5,     // a Lab run's coins as a share of a career run's; no new star bonus
  },
  /* CAREER CHAPTERS (briefs/CHAPTERS.md): Rookie, Pro and Legend, eight
     tracks each (modes.js). OPEN[c] is the stars won in chapter c - 1
     that open chapter c's first track; the first chapter is always open.
     First guesses, out of 24 in each chapter. */
  CHAPTERS: {
    OPEN:             [0, 12, 14],
  },
  /* FIRST-RUN ONBOARDING (briefs/RETENTION.md 1): the first visit skips
     the title and lands in career track 1, with short prompts at the
     moments they apply. The car is never paused to explain. */
  ONBOARD: {
    STEER_HOLD:       0.5,     // s of steering held before the steer prompt counts as done
    DRIFT_LEAD:       45,      // m before the next corner the drift prompt comes up (once steering is done)
    DRIFT_WAIT:       4,       // s after steering is done the drift prompt comes up anyway
    BRAKE_AFTER:      1.0,     // s after a drift is done before the brake prompt
    BRAKE_HOLD:       0.3,     // s of DRIFT / BRAKE with no steering before the brake prompt counts as done
    PROMPT_MIN:       1.2,     // s a prompt stays at least, so it can be read even when the player is already doing it
    PROMPT_MAX:       9,       // s a prompt the player ignores stays before the next one comes
    INFO_SHOWN:       4.5,     // s the chain and clean explanations stay
    INFO_CHAIN_MIN:   15,      // points a banked chain must be worth before it is the one explained (a one point bank teaches nothing)
  },
};

/* THE TANDEM BLOCK (briefs/RIVALS.md): a battle is one run against a
   rival who leads it. Every number about the run itself lives here; the
   rivals themselves (names, cars, tracks, how each drives) are in
   rivals/roster.js. First guesses for the author to set by play. With
   no rival, nothing here is read. */
export const TANDEM = {
  LAPS:             2,       // laps of a circuit in a battle (a solo run is LOOP.LAPS), so a battle stays near 60 to 120 s
  STAGGER_AHEAD:    8,       // m the rival starts ahead of the player on the grid
  STAGGER_SIDE:     3,       // m to the side; the sign is the rival's (left is positive)
  /* the zone: how close counts. Distances are between the two cars' centres */
  NEAR:             4.5,     // m: this close or closer is the full bonus
  FAR:              14,      // m: past this there is no bonus ("too far")
  BONUS:            1.5,     // at full closeness the player's drift points count 1 + this times over
  AHEAD:            1.0,     // m: the player's centre this far ahead of the rival's, along the rival's travel, is ahead: no bonus
  LAYER:            2.5,     // m of height apart (a bridge over the other road) that is never together
  RUN_GAP:          40,      // m apart in run distance that is never together (a car a lap down passing the other)
  /* contact: the rival is solid and never moved by the player */
  HARD_HIT:         5.0,     // m/s into the rival that is a hard contact: the chain is lost, as a wall hit
  HIT_SPEED_KEEP:   0.85,    // share of the player's speed, relative to the rival, kept through a hard contact
  RESTITUTION:      0.1,
  FRICTION:         0.3,
  COOL:             1.5,     // s the tandem bonus is off after a hard contact
  PIN_SLACK:        0.4,     // m: if the walls hold the player this deep inside the rival, the rival lets him through until they part
  FADE:             1.2,     // s the rival takes to fade away after his finish, no longer solid
  /* the HUD and callouts */
  CALL_HOLD:        1.2,     // s in the zone, both sliding, before TANDEM is called
  CALL_CLOSE:       2.6,     // m of gap between the cars' sides for DOOR TO DOOR
  CALL_FAR_AFTER:   2.0,     // s too far while he slides before TOO FAR is called (once per slide)
  METER_SMOOTH:     0.12,    // s, the closeness meter's easing
};
