/* THE TRACK GENERATOR. A seeded drift course as plain data: no three.js,
   no DOM, deterministic for a seed in every JavaScript engine (see
   dmath.js; nothing here calls Math.sin, Math.cos or Math.random).

   generateTrack(seed, options) returns a closed circuit or a point to
   point sprint in exactly the shape of the hand made test track in
   ../ground/track.js, so physics/world.js drives on it unchanged:

     kind         'circuit' or 'sprint'
     length       metres. A circuit's lap; a sprint's centre line, end to end
     centre       a sample every 2 m: { x, y, z, heading, bank, width,
                  layer, part }. heading is the vehicle's yaw (zero faces
                  -Z, positive turns left); width is the full drivable
                  width; bank is the road's roll in radians, positive
                  lowers the left edge, which banks a left hand corner.
                  layer is 1 where the track is raised onto a bridge
                  (its ramps included) and 0 elsewhere; part names the
                  structure there: 'deck', 'ramp' or 'cut' (the lower
                  road's dip under a bridge). Sample i is at i * 2 metres
                  along, which is what world.js assumes.
     walls        [left, right, ...caps]. walls[0] and walls[1] are the
                  barriers, one point beside every centre sample (a
                  circuit repeats the first point at the end), because
                  world.js and the scene find a clip's wall by side and
                  index it by sample. Each has side, kind (what the
                  physics reports on a hit) and spans: { from, to, kind,
                  runoff } in metres along, kind 'concrete', 'tyres' or
                  'fence', runoff the metres of run-off before the
                  barrier there. A sprint adds two end caps (cap: true).
                  Wall points carry y, so a wall on a bridge is above a
                  wall beneath it; the physics only touches walls at the
                  car's height.
     clips        { from, to, side, kind, apex, corner }: kind 'inner'
                  (clip the apex, the inside wall) or 'outer' (close to
                  the outside wall), side the wall that is judged.
     start        { along, x, y, z, yaw, heading }; startLine, metres
                  along; checkpoints, metres along; finish (sprints) {
                  along, x, y, z, heading, width }, null for a circuit,
                  whose finish is the start line.
     bridges      one record per crossover: { along (the upper pass's
                  crossing, metres along), under (the lower pass's),
                  angle (degrees between the passes), height, depth,
                  deck: [from, to], ramps: [[from, to], [from, to]],
                  cut: [from, to] }, every range in metres along, which
                  may run past the lap on a circuit and wrap.
     bounds       { minX, maxX, minZ, maxZ, minY, maxY }, 30 m padded.
     difficulty   an estimate, 0 to 1, from the geometry (analyse.js).
     corners      { type, from, to, apex, radius, radiusEnd, angle, dir,
                  bank } as designed; sections the same as
                  { name: [from, to] } for the scripted driver; cones []
                  as the test track has.

   How it builds one. A course is a curvature profile: straights,
   clothoid ramps and arcs (an arc may tighten or open, its curvature
   running from one radius to another), so every radius is known and
   the heading is exact. Features (hairpin, tight corner, sweeper,
   esses, chicane, a flowing chain of linked corners, a long multi apex
   corner, a double hairpin, a corner that tightens, one that opens) are
   drawn by weight for the difficulty and joined by straights, most of
   them short links. A circuit steers its features towards one full
   turn, then the corner angles are trimmed to make the turning exact,
   and the straights' lengths and the corners' angles are solved
   together to close the gap in position at the asked lap length, so the
   loop meets itself exactly. A figure eight draws one lobe that way,
   level with its start, and mirrors it. Then it is
   scaled by a fraction of a per cent so the lap is a whole number of
   samples. Width, run-off, barrier kinds, clipping zones, elevation and
   bank are laid along it. Where the centre line crosses itself once,
   cleanly, the straighter pass is raised onto a bridge (ramps up, a
   level deck over the other pass, ramps down) and the other dips a
   little beneath it; a crossing that cannot be bridged fails
   validation like any other overlap. Some corners are banked towards
   their inside by a real angle the physics feels. analyse.js validates
   the result: on any failure the next attempt is drawn from the same
   seeded stream. Every tunable is in TRACKS below.

   Options: kind, length, difficulty as before; elevation 0 to 1 scales
   the rise and fall and the gentle bank every corner gets, and at 0 the
   course is flat with no banked corners and no crossovers, for a host
   whose car and camera do not follow the road's height; bank: false
   and crossover: false switch those off on their own. */
import { dsin, dcos, dasin, wrapAngle, TWO_PI } from './dmath.js';
import { validateTrack, difficultyOf, findCrossings } from './analyse.js';

const DEG = Math.PI / 180;

export const TRACKS = {
  SAMPLE:          2,            // m between centre samples, fixed by the physics
  LENGTH:          [600, 1200],  // m, the default target range
  LENGTH_SLACK:    0.1,          // a single number target accepts this share either side
  WIDTH:           [11, 24],     // m, the stated range of the drivable width
  RADIUS:          [12, 120],    // m, the stated range of every corner's tightest radius
  STRAIGHT_RADIUS: 250,          // m: gentler than this counts as straight
  INNER_CLEAR:     4,            // m: half the width is at most the radius less this, so the inside wall never folds
  GAP:             4,            // m, at least, between barriers of two different parts of the track
  NEAR_CENTRES:    14,           // m: centre lines of two parts closer than this fail before the build (two roads of the least width and GAP apart are 15 m)
  NEAR_APART:      40,           // m along the track before two samples count as two parts
  RUNOFF:          4,            // m of run-off before a set back barrier, inside the physics' 6 m respawn line
  RUNOFF_RAMP:     16,           // m over which a barrier steps out to its run-off and back
  START_STRAIGHT:  { circuit: [70, 120], sprint: [40, 70], lap: 850 },   // m: a circuit keeps one longer run to breathe and build speed, scaled down on a lap shorter than lap
  CLOSE_STRAIGHT:  10,           // m, at least, before a circuit's start straight
  FINISH_STRAIGHT: [30, 50],     // m before a sprint's finish line
  FINISH_RUNOUT:   40,           // m of track past a sprint's finish line
  STRAIGHT_MAX:    160,          // m, no straight longer
  SHRINK:          0.15,          // a circuit's closure may shorten a straight to this share of its drawn length
  START_ALONG:     2,            // m along where the car starts
  START_LINE:      8,            // m along, the start line (the scene draws it at sample 4)
  CAP_BACK:        1,            // m a sprint's end cap sits beyond its last sample
  LINK_SHARE:      [0.6, 0.85],  // share of the straights between features that are short links, easy to hard
  LINK:            [4, 18],      // m, a short link
  STRAIGHT:        [[26, 60], [20, 42]],   // m, a longer straight, easy and hard
  STRAIGHT_WIDTH:  [14, 12.5],   // m on straights, easy to hard
  WIDTH_SMOOTH:    6,            // samples either side the width is averaged over
  BANK_MAX:        3,            // degrees of the gentle bank every corner gets by its curvature
  BANK_RADIUS:     20,           // m: this tight or tighter takes the full gentle bank
  BANK_SMOOTH:     5,            // samples either side
  ELEVATION:       [1.2, 3.5],   // m of rise and fall, easy to hard, before the limits below
  GRADE_MAX:       0.05,         // the steepest slope the rise and fall aims for, as rise over run
  CREST_K_MAX:     0.002,        // 1/m: a crest this sharp at TOP_SPEED pulls 0.78 g of the car's weight off
  TOP_SPEED:       62,           // m/s, the car's flat out speed (TUNE.VEHICLE.TOP_SPEED)
  ELEVATION_USE:   0.8,          // share of the grade and crest limits the rise and fall aims for
  TURN_BIAS:       0.72,         // chance a corner turns the way the plan wants
  PLAN_SHARE:      0.7,          // share of a circuit's goal the plan draws features for; closure lengthens the rest
  CLOSE_ANGLE:     3,            // m of straight that a degree of corner angle costs the closure, so it prefers lengthening
  ATTEMPTS:        1000,         // a failed attempt costs about a millisecond; no seed tested needs more than a few hundred
  /* Features, each [easy, hard] where a range is given, lerped by the
     difficulty. R radius in m, angle in degrees of turn (including the
     clothoid ramps), lt the ramp length in m, width in m. count is how
     many corners a chain has, link the short straight inside a chain,
     end the ratio of the end radius to the start for a corner that
     tightens or opens, vary the spread of radii in a multi apex corner. */
  WEIGHTS: {
    hairpin: [1, 2], tight: [2, 2], sweeper: [2, 1], esses: [2, 2], chicane: [1, 1],
    flow: [2, 3], multi: [2, 2], double: [1, 2], tightening: [1, 2], opening: [1, 1],
  },
  FEATURES: {
    hairpin:    { R: [[16, 22], [13, 17]],   angle: [150, 195], lt: 8,  width: [[19, 22], [17, 19]], clip: 'inner', outside: 'tyres', runoff: 0.7 },
    tight:      { R: [[24, 34], [18, 26]],   angle: [70, 120],  lt: 10, width: [[18, 20], [16, 18]], clip: 'either', outside: 'tyres', runoff: 0.5 },
    sweeper:    { R: [[60, 110], [40, 75]],  angle: [45, 120],  lt: 20, width: [[16, 18], [14, 16]], clip: 'outer', outside: 'concrete', runoff: 0 },
    esses:      { R: [[32, 50], [22, 36]],   angle: [45, 95],   lt: 12, width: [[17, 19], [15, 17]], clip: 'alternate', outside: 'concrete', runoff: 0, count: [2, 3] },
    chicane:    { R: [[26, 36], [18, 26]],   angle: [25, 45],   lt: 8,  width: [[15, 16], [13, 14]], clip: 'middle', outside: 'concrete', runoff: 0, link: [0, 6] },
    flow:       { R: [[30, 46], [22, 34]],   angle: [40, 80],   lt: 10, width: [[17, 19], [15, 17]], clip: 'alternate', outside: 'concrete', runoff: 0, count: [3, 5], link: [0, 6] },
    multi:      { R: [[40, 70], [28, 50]],   angle: [120, 200], lt: 12, width: [[17, 19], [15, 17]], clip: 'inner', outside: 'concrete', runoff: 0.3, count: [2, 3], vary: 0.35 },
    double:     { R: [[18, 22], [15, 19]],   angle: [140, 180], lt: 8,  width: [[19, 22], [17, 19]], clip: 'inner', outside: 'tyres', runoff: 0.5, link: [12, 24] },
    tightening: { R: [[40, 60], [30, 45]],   angle: [80, 130],  lt: 12, width: [[18, 20], [16, 18]], clip: 'inner', outside: 'tyres', runoff: 0.5, end: [0.45, 0.6] },
    opening:    { R: [[20, 30], [16, 24]],   angle: [80, 130],  lt: 12, width: [[18, 20], [16, 18]], clip: 'outer', outside: 'tyres', runoff: 0, end: [1.7, 2.3] },
  },
  FENCE_FROM:      40,           // m: straights at least this long are fenced, away from the corners
  /* Banked corners: a share of the corners, by type, tilted towards the
     inside by a real angle, built over the clothoid in and out. */
  BANK_CORNERS: {
    share: [0.35, 0.5],          // share of the corners offered a bank, easy to hard
    angle: [8, 14],              // degrees
    chance: { sweeper: 1, multi: 1, tight: 0.6, tightening: 0.6, opening: 0.7, hairpin: 0.3, flow: 0.4, esses: 0.4, chicane: 0, double: 0.3 },
  },
  BANK_CORNER_MAX: 16,           // degrees, the validator's limit on any sample's bank
  /* Crossovers: a circuit may be planned as a figure eight (one full
     turn then back to none), and any single clean crossing of the
     centre line, planned or not, becomes a bridge. */
  CROSS: {
    chance: [0.35, 0.5],         // share of circuit attempts planned as a figure eight, easy to hard
    eightStart: 0.6,             // a figure eight's start straight, as a share of a circuit's
    turnBias: 0.85,              // chance a lobe's corner turns the way the lobe wants (a lobe has less room to wander than a lap)
    minLap: 760,                 // m: a figure eight is only tried on a lap at least this long, since each lobe holds a full turn
    minSin: 0.643,               // sine of the least angle between the passes (40 degrees)
    clearance: 5.0,              // m from the lower road's surface to the upper's at the crossing
    dipShare: 0.3,               // share of the clearance the lower road dips, the rest the upper climbs
    grade: 0.075,                // the ramps' steepest slope, rise over run
    crest: 0.0025,               // 1/m, the ramps' sharpest vertical curvature (0.41 g off the car at 40 m/s)
    margin: 3,                   // m the deck reaches past the lower road's barriers, and the cut past the upper's
    layerGap: 4.0,               // m: barriers this far apart in height belong to different layers and may cross
    apart: 40,                   // m, at least, along the track between the two passes' structures
    startClear: 30,              // m a structure keeps from the start line
  },
};

/* ---------------------------------------------------------------- seeds */

/* A 32 bit FNV-1a hash of a string. */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/* The daily seed: the same for the same local calendar date everywhere,
   whatever the time of day or the time zone the date is in. */
export function dailySeed(date) {
  const d = date || new Date();
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  return hashString('drift-fever daily ' + y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day);
}

/* sfc32, seeded through a mix of the seed and the kind. */
function createRng(seed, salt) {
  let a = 0x9e3779b9 ^ salt, b = 0x243f6a88, c = 0xb7e15162, d = seed >>> 0;
  function next() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  for (let i = 0; i < 15; i++) next();
  return next;
}

/* -------------------------------------------------------------- helpers */

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const between = (rng, lo, hi) => lo + (hi - lo) * rng();
const rangeAt = (pair, d) => [lerp(pair[0][0], pair[1][0], d), lerp(pair[0][1], pair[1][1], d)];
const r4 = v => Math.round(v * 10000) / 10000;
const r6 = v => Math.round(v * 1000000) / 1000000;
const r2 = v => Math.round(v * 100) / 100;
const smooth = x => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };

function weightedPick(rng, weights, d) {
  const names = Object.keys(weights);
  let total = 0;
  const w = names.map(n => { const v = lerp(weights[n][0], weights[n][1], d); total += v; return v; });
  let x = rng() * total;
  for (let i = 0; i < names.length; i++) { x -= w[i]; if (x < 0) return names[i]; }
  return names[names.length - 1];
}

function targetRange(length) {
  if (Array.isArray(length)) return { min: length[0], max: length[1] };
  if (length && typeof length === 'object') return { min: length.min, max: length.max };
  if (typeof length === 'number') return { min: length * (1 - TRACKS.LENGTH_SLACK), max: length * (1 + TRACKS.LENGTH_SLACK) };
  return { min: TRACKS.LENGTH[0], max: TRACKS.LENGTH[1] };
}

/* ------------------------------------------------------------- features */

/* One corner: radius at its start and end (the same for a constant arc),
   signed turn (radians, positive left), ramps, the angle range it may
   be trimmed within, and its bank in degrees (0 for none). */
function corner(type, R, a, lt, width, clip, R2, limits) {
  const Rend = R2 === undefined ? R : R2;
  const F = TRACKS.FEATURES[type];
  return {
    type, R, R2: Rend, a, lt,
    width: Math.min(width, 2 * (Math.min(R, Rend) - TRACKS.INNER_CLEAR)),
    clip, outside: F.outside, runoff: false, adjustable: type !== 'chicane',
    aMin: (limits || F.angle)[0] * DEG, aMax: (limits || F.angle)[1] * DEG,
    bank: 0,
  };
}

/* A feature: a run of corners and the short links inside it. dir is the
   first corner's direction, +1 left. */
function makeFeature(type, dir, rng, d) {
  const F = TRACKS.FEATURES[type];
  const [rLo, rHi] = rangeAt(F.R, d), [wLo, wHi] = rangeAt(F.width, d);
  const R = () => between(rng, rLo, rHi), W = () => between(rng, wLo, wHi);
  const A = () => between(rng, F.angle[0], F.angle[1]) * DEG;
  const items = [];
  if (type === 'esses' || type === 'flow') {
    const n = F.count[0] + Math.floor(rng() * (F.count[1] - F.count[0] + 1));
    for (let i = 0; i < n; i++) {
      const c = corner(type, R(), (i % 2 ? -dir : dir) * A(), F.lt, W(), i % 2 ? 'inner' : 'outer');
      if (i > 0 && F.link) { const l = between(rng, F.link[0], F.link[1]); if (l > 0.5) items.push({ link: l }); }
      items.push({ c });
    }
  } else if (type === 'chicane') {
    const three = rng() < 0.4;
    const a = A(), r = R(), w = W();
    const link = () => between(rng, F.link[0], F.link[1]);
    if (three) {
      items.push({ c: corner(type, r, dir * a, F.lt, w, null) }, { link: link() },
        { c: corner(type, r, -dir * 2 * a, F.lt, w, 'outer') }, { link: link() },
        { c: corner(type, r, dir * a, F.lt, w, null) });
    } else {
      items.push({ c: corner(type, r, dir * a, F.lt, w, null) }, { link: link() },
        { c: corner(type, r, -dir * a, F.lt, w, 'outer') });
    }
  } else if (type === 'multi') {
    /* one long corner, its radius changing at each apex */
    const n = F.count[0] + Math.floor(rng() * (F.count[1] - F.count[0] + 1));
    const total = A(), base = R(), w = W();
    const radii = [];
    for (let i = 0; i < n; i++) radii.push(base * (1 + F.vary * (2 * rng() - 1)));
    let tightest = 0;
    for (let i = 1; i < n; i++) if (radii[i] < radii[tightest]) tightest = i;
    const limits = [F.angle[0] / n, F.angle[1] / n];
    for (let i = 0; i < n; i++) items.push({ c: corner(type, i === 0 ? radii[0] : radii[i - 1], dir * total / n, i === 0 || i === n - 1 ? F.lt : 0, w, i === tightest ? 'inner' : null, radii[i], limits) });
    items[0].c.runoff = rng() < F.runoff;
    const B = TRACKS.BANK_CORNERS;
    if (rng() < lerp(B.share[0], B.share[1], d) * B.chance.multi) { const b = between(rng, B.angle[0], B.angle[1]); for (const it of items) it.c.bank = b; }
  } else if (type === 'double') {
    const w = W();
    const first = corner(type, R(), dir * A(), F.lt, w, 'inner'), second = corner(type, R(), -dir * A(), F.lt, w, 'inner');
    first.runoff = rng() < F.runoff; second.runoff = rng() < F.runoff;
    items.push({ c: first }, { link: between(rng, F.link[0], F.link[1]) }, { c: second });
  } else if (type === 'tightening' || type === 'opening') {
    const r0 = R(), r1 = r0 * between(rng, F.end[0], F.end[1]);
    const c = corner(type, r0, dir * A(), F.lt, W(), F.clip, r1);
    c.runoff = F.clip !== 'outer' && rng() < F.runoff;
    items.push({ c });
  } else {
    let clip = F.clip;
    if (clip === 'either') clip = rng() < 0.5 ? 'inner' : 'outer';
    const c = corner(type, R(), dir * A(), F.lt, W(), clip);
    c.runoff = clip !== 'outer' && rng() < F.runoff;
    items.push({ c });
  }
  /* banked corners, by type and difficulty (a multi apex corner rolled once above) */
  if (type !== 'multi') {
    const B = TRACKS.BANK_CORNERS;
    const share = lerp(B.share[0], B.share[1], d) * (B.chance[type] || 0);
    for (const it of items) if (it.c && rng() < share) it.c.bank = between(rng, B.angle[0], B.angle[1]);
  }
  let net = 0;
  for (const it of items) if (it.c) net += it.c.a;
  return { type, items, net };
}

/* -------------------------------------------------------- the planners */

/* A sequence of elements: { s: length, adj, min, max } straights and
   { c } corners. eight: plan a figure eight, one full turn and back. */
function planCircuit(rng, d, goal) {
  const T = TRACKS;
  const sgn = rng() < 0.5 ? 1 : -1;
  /* the one longer run, scaled down on a short lap */
  const ss = T.START_STRAIGHT.circuit, scale = Math.min(1, goal / T.START_STRAIGHT.lap);
  const els = [{ s: between(rng, ss[0], ss[1]) * scale, adj: true, min: ss[0] * scale, start: true }];
  let H = 0, est = els[0].s;
  const budget = goal * T.PLAN_SHARE;
  let guard = 0;
  while (est < budget && guard++ < 60) {
    const type = weightedPick(rng, T.WEIGHTS, d);
    const u = Math.min(1, (est + 80) / budget);
    const want = sgn * TWO_PI * u;
    const toward = want - H >= 0 ? 1 : -1;
    const dir = rng() < T.TURN_BIAS ? toward : -toward;
    const f = makeFeature(type, dir, rng, d);
    for (const it of f.items) { if (it.c) { els.push({ c: it.c }); est += cornerLength(it.c); } else { els.push({ s: it.link, adj: false }); est += it.link; } }
    H += f.net;
    const s = straightBetween(rng, d);
    els.push({ s, adj: true, min: T.LINK[0] });
    est += s;
  }
  /* Turn the rest of the way: whole corners while far off, then trim. */
  let D = sgn * TWO_PI - H;
  guard = 0;
  while (Math.abs(D) > 140 * DEG && guard++ < 6) {
    const type = rng() < 0.5 ? 'sweeper' : 'tight';
    const f = makeFeature(type, D > 0 ? 1 : -1, rng, d);
    const c = f.items[0].c;
    c.a = (D > 0 ? 1 : -1) * clamp(Math.abs(D), c.aMin, c.aMax);
    els.push({ c });
    const s = straightBetween(rng, d);
    els.push({ s, adj: true, min: T.LINK[0] });
    D -= c.a;
  }
  if (!trimTurning(els, D)) return null;
  const last = els[els.length - 1];
  if (last.s !== undefined) { last.min = Math.max(last.min, T.CLOSE_STRAIGHT); last.s = Math.max(last.s, T.CLOSE_STRAIGHT); }
  return { els, sgn, eight: false };
}

/* A figure eight, closed by symmetry: one lobe is drawn like a circuit
   that turns a full turn, trimmed to exactly that, and closed so it ends
   level with its start (the same z, half the goal long); the second lobe
   is its mirror image, turning the other way, which lands exactly on the
   start. The lobes must cross on the mirror line, where the bridge goes.
   The start straight is drawn shorter, since each lobe has one. */
function planEight(rng, d, goal, target) {
  const T = TRACKS;
  const sgn = rng() < 0.5 ? 1 : -1;
  const ss = T.START_STRAIGHT.circuit, scale = Math.min(1, goal / T.START_STRAIGHT.lap) * T.CROSS.eightStart;
  const els = [{ s: between(rng, ss[0], ss[1]) * scale, adj: true, min: ss[0] * scale, start: true }];
  let H = 0, est = els[0].s;
  const budget = goal / 2 * T.PLAN_SHARE;
  let guard = 0;
  while (est < budget && guard++ < 60) {
    const type = weightedPick(rng, T.WEIGHTS, d);
    const u = Math.min(1, (est + 80) / budget);
    const want = sgn * TWO_PI * u;
    const toward = want - H >= 0 ? 1 : -1;
    const dir = rng() < T.CROSS.turnBias ? toward : -toward;
    const f = makeFeature(type, dir, rng, d);
    for (const it of f.items) { if (it.c) { els.push({ c: it.c }); est += cornerLength(it.c); } else { els.push({ s: it.link, adj: false }); est += it.link; } }
    H += f.net;
    const s = straightBetween(rng, d);
    els.push({ s, adj: true, min: T.LINK[0] });
    est += s;
  }
  /* the rest of the turn in tight corners, which a lobe has room for */
  let D = sgn * TWO_PI - H;
  guard = 0;
  while (Math.abs(D) > 140 * DEG && guard++ < 6) {
    const f = makeFeature('tight', D > 0 ? 1 : -1, rng, d);
    const c = f.items[0].c;
    c.a = (D > 0 ? 1 : -1) * clamp(Math.abs(D), c.aMin, c.aMax);
    els.push({ c });
    const s = straightBetween(rng, d);
    els.push({ s, adj: true, min: T.LINK[0] });
    D -= c.a;
  }
  if (!trimTurning(els, D)) return null;
  const last = els[els.length - 1];
  last.min = Math.max(last.min, T.CLOSE_STRAIGHT); last.s = Math.max(last.s, T.CLOSE_STRAIGHT);
  /* level with the start, half the lap: z and length, not x */
  if (!closePosition(els, { min: target.min / 2, max: target.max / 2 }, [false, true, true, true], goal / 2)) return null;
  const mirror = els.map(e => e.s !== undefined ? { s: e.s, adj: e.adj, min: e.min } : { c: Object.assign({}, e.c, { a: -e.c.a }) });
  return { els: els.concat(mirror), sgn, eight: true };
}

function straightBetween(rng, d) {
  const T = TRACKS;
  if (rng() < lerp(T.LINK_SHARE[0], T.LINK_SHARE[1], d)) return between(rng, T.LINK[0], T.LINK[1]);
  const [lo, hi] = rangeAt(T.STRAIGHT, d);
  return between(rng, lo, hi);
}

/* Share a heading error D out over the adjustable corners, each within
   its angle range, in proportion to how far each can move. */
function trimTurning(els, D) {
  if (Math.abs(D) < 1e-12) return true;
  const sD = D > 0 ? 1 : -1;
  const caps = [];
  let C = 0;
  for (const e of els) {
    if (!e.c || !e.c.adjustable) continue;
    const m = Math.abs(e.c.a);
    const cap = (e.c.a > 0 ? 1 : -1) === sD ? e.c.aMax - m : m - e.c.aMin;
    if (cap > 0) { caps.push([e.c, cap]); C += cap; }
  }
  if (C < Math.abs(D)) return false;
  const k = Math.abs(D) / C;
  for (const [c, cap] of caps) c.a += sD * cap * k;
  return true;
}

function planSprint(rng, d, goal) {
  const T = TRACKS;
  const ss = T.START_STRAIGHT.sprint;
  const els = [{ s: between(rng, ss[0], ss[1]), adj: false, start: true }];
  let H = 0, est = els[0].s;
  const finishMin = T.FINISH_STRAIGHT[0] + T.FINISH_RUNOUT;
  let guard = 0;
  while (est < goal - finishMin - 60 && guard++ < 60) {
    const type = weightedPick(rng, T.WEIGHTS, d);
    /* Wander, but lean back towards the first heading the further off it
       the course has turned, so a sprint does not curl into itself. */
    const back = H > 0 ? -1 : 1;
    const lean = 0.5 + 0.45 * Math.min(1, Math.abs(H) / (100 * DEG));
    const dir = rng() < lean ? back : -back;
    const f = makeFeature(type, dir, rng, d);
    for (const it of f.items) { if (it.c) { els.push({ c: it.c }); est += cornerLength(it.c); } else { els.push({ s: it.link, adj: false }); est += it.link; } }
    H += f.net;
    const s = straightBetween(rng, d);
    els.push({ s, adj: false });
    est += s;
  }
  const fin = between(rng, T.FINISH_STRAIGHT[0], T.FINISH_STRAIGHT[1]) + T.FINISH_RUNOUT;
  els.push({ s: fin, adj: false, finish: true });
  return { els, sgn: 0 };
}

/* --------------------------------------------------- the curvature profile */

/* A corner's length along the track: its ramps and its arc. */
function cornerLength(c) {
  const m = Math.abs(c.a), kavg = (1 / c.R + 1 / c.R2) / 2;
  const lt = Math.min(c.lt, 0.45 * m / kavg);
  return m / kavg + lt;
}
function planLength(els) { let total = 0; for (const e of els) total += e.s !== undefined ? e.s : cornerLength(e.c); return total; }

/* Pieces of linearly varying curvature: { len, k0, k1, corner, el }. A
   corner is a ramp in, an arc from its start radius to its end radius,
   and a ramp out; the turn in the ramps is half their length times
   their curvature, so the arc takes the rest. */
function toPieces(els) {
  const pieces = [];
  els.forEach((e, ei) => {
    if (e.s !== undefined) { if (e.s > 0) pieces.push({ len: e.s, k0: 0, k1: 0, corner: null, el: ei }); return; }
    const c = e.c, m = Math.abs(c.a), sgn = c.a > 0 ? 1 : -1;
    const k0 = sgn / c.R, k1 = sgn / c.R2, kavg = (Math.abs(k0) + Math.abs(k1)) / 2;
    const lt = Math.min(c.lt, 0.45 * m / kavg);
    const arc = (m - lt * kavg) / kavg;
    c.ltUsed = lt;
    if (lt > 0) pieces.push({ len: lt, k0: 0, k1: k0, corner: c, el: ei, part: 'in' });
    pieces.push({ len: arc, k0, k1, corner: c, el: ei, part: 'arc' });
    if (lt > 0) pieces.push({ len: lt, k0: k1, k1: 0, corner: c, el: ei, part: 'out' });
  });
  return pieces;
}

const GL = [[0.1127016653792583, 5 / 18], [0.5, 8 / 18], [0.8872983346207417, 5 / 18]];

/* Heading along a piece, u metres in. */
function headingIn(p, th0, u) { return th0 + p.k0 * u + (p.len > 0 ? (p.k1 - p.k0) * u * u / (2 * p.len) : 0); }

/* Position u metres into a piece from its start pose: in closed form
   for a straight or an arc of constant curvature, and by three point
   Gauss-Legendre on steps of a metre or less through a clothoid ramp. */
function advance(p, x0, z0, th0, u) {
  if (p.k0 === p.k1) {
    if (p.k0 === 0) return [x0 - u * dsin(th0), z0 - u * dcos(th0)];
    const th1 = th0 + p.k0 * u;
    return [x0 + (dcos(th1) - dcos(th0)) / p.k0, z0 - (dsin(th1) - dsin(th0)) / p.k0];
  }
  const n = Math.max(1, Math.ceil(u));
  const h = u / n;
  let x = x0, z = z0;
  for (let i = 0; i < n; i++) {
    for (const [t, w] of GL) {
      const th = headingIn(p, th0, (i + t) * h);
      x -= w * h * dsin(th); z -= w * h * dcos(th);
    }
  }
  return [x, z];
}

/* Start poses of every piece and the end pose. */
function integrate(pieces) {
  const starts = [];
  let x = 0, z = 0, th = 0, s = 0;
  for (const p of pieces) {
    starts.push({ s, x, z, th });
    [x, z] = advance(p, x, z, th, p.len);
    th = headingIn(p, th, p.len);
    s += p.len;
  }
  return { starts, end: { s, x, z, th } };
}

/* Close a circuit in position by changing the lengths of its adjustable
   straights and the angles of its adjustable corners: a small change
   that meets the gap and brings the lap inside the target length, each
   straight kept between its least length and STRAIGHT_MAX, each corner
   inside its angle range, the total turning kept exact (so the heading
   stays closed), and the start straight with the one before it, which
   are one straight across the line, no longer than STRAIGHT_MAX.
   Gauss-Newton: the end position is linear in the straights and, about
   a corner's apex, a rotation of everything after it in its angle; each
   round takes the least norm change that meets the four equations,
   clipped to the bounds and repeated (alternating projections), then
   re-integrates. A degree of angle is costed as CLOSE_ANGLE metres of
   straight. Converges whenever a closure inside the bounds exists; a
   plan with none fails here. */
function closePosition(els, target, rowsOn, drawnGoal) {
  const T = TRACKS;
  const on = rowsOn || [true, true, true, true];
  const aScale = T.CLOSE_ANGLE / DEG;   // m per radian
  const vars = [];
  for (const e of els) {
    if (e.s !== undefined) { if (e.adj) vars.push({ e, kind: 's', lo: Math.max(e.min || 0, e.s * T.SHRINK) - e.s, hi: T.STRAIGHT_MAX - e.s, x: 0 }); }
    else if (e.c.adjustable) { const m = Math.abs(e.c.a); vars.push({ e, kind: 'a', sgn: e.c.a > 0 ? 1 : -1, lo: (e.c.aMin - m) * aScale, hi: (e.c.aMax - m) * aScale, x: 0 }); }
  }
  if (vars.length < 2) return false;
  const apply = () => { for (const v of vars) { if (v.kind === 's') v.e.s = v.s0 + v.x; else v.e.c.a = v.sgn * (v.m0 + v.x / aScale); } };
  for (const v of vars) { if (v.kind === 's') v.s0 = v.e.s; else v.m0 = Math.abs(v.e.c.a); }
  /* four rows: the end's x and z, the turning, the length; a column per variable */
  const rows = () => {
    const pieces = toPieces(els);
    const { starts, end } = integrate(pieces);
    const idxOf = new Map();
    pieces.forEach((p, i) => { if (!idxOf.has(p.el)) idxOf.set(p.el, i); });
    for (const v of vars) {
      const ei = els.indexOf(v.e);
      if (v.kind === 's') { const st = starts[idxOf.get(ei)]; v.j = [-dsin(st.th), -dcos(st.th), 0, 1]; }
      else {
        /* the arc's midpoint: turning the rest of the course about it by
           an angle moves the end along the left of the vector from it;
           the length grows by the mean radius per radian */
        const i0 = idxOf.get(ei), arc = pieces[i0 + 1] && pieces[i0 + 1].part === 'arc' ? i0 + 1 : i0;
        const st = starts[arc], c = v.e.c;
        const [mx, mz] = advance(pieces[arc], st.x, st.z, st.th, pieces[arc].len / 2);
        const rx = end.x - mx, rz = end.z - mz;
        v.j = [v.sgn * rz / aScale, -v.sgn * rx / aScale, v.sgn / aScale, (c.R + c.R2) / 2 / aScale];
      }
    }
    return end;
  };
  const act = [0, 1, 2, 3].filter(a => on[a]), na = act.length;
  /* the inverse of J Jt over the rows in use, for the least norm step
     x += Jt (J Jt)^-1 r; the Jacobian is fixed within a round */
  const inverse = (list) => {
    const M = act.map(() => act.map(() => 0));
    for (const v of list) for (let a = 0; a < na; a++) for (let b = 0; b < na; b++) M[a][b] += v.j[act[a]] * v.j[act[b]];
    const inv = [];
    for (let k = 0; k < na; k++) { const e = act.map((_, i) => i === k ? 1 : 0); const col = solveLinear(M, e); if (!col) return null; inv.push(col); }
    return inv;   // inv[k][a]: column k
  };
  const solve = (list, inv, r) => {
    const lam = new Array(na).fill(0);
    for (let a = 0; a < na; a++) for (let k = 0; k < na; k++) lam[a] += inv[k][a] * r[act[k]];
    for (const v of list) for (let a = 0; a < na; a++) v.x += v.j[act[a]] * lam[a];
  };
  const residual = (g) => { const r = g.slice(); for (const v of vars) for (let a = 0; a < 4; a++) r[a] -= v.x * v.j[a]; for (let a = 0; a < 4; a++) if (!on[a]) r[a] = 0; return r; };
  let end = rows();
  /* the length to make: the lap as drawn if it is inside the target, the
     goal the attempt drew if the lap is short of it (the usual case: the
     plan leaves room to grow), else a little inside the top */
  const goal = end.s < target.min ? clamp(drawnGoal || target.min + 4, target.min + 4, Math.max(target.min + 4, target.max - 4)) : clamp(end.s, target.min + 4, Math.max(target.min + 4, target.max - 4));
  const gapOf = () => { const g = [-end.x, -end.z, 0, goal - end.s]; for (let a = 0; a < 4; a++) if (!on[a]) g[a] = 0; return g; };
  for (let round = 0; round < 8; round++) {
    const g = gapOf();
    if (g[0] * g[0] + g[1] * g[1] + g[3] * g[3] < 1e-14) break;
    const inv = inverse(vars);
    if (!inv) return false;
    for (let iter = 0; iter < 300; iter++) {
      const r = residual(g);
      if (r[0] * r[0] + r[1] * r[1] + r[2] * r[2] + r[3] * r[3] < 1e-14) break;
      solve(vars, inv, r);
      for (const v of vars) { if (v.x < v.lo) v.x = v.lo; else if (v.x > v.hi) v.x = v.hi; }
    }
    {
      const r = residual(g);
      if (r[0] * r[0] + r[1] * r[1] + r[2] * r[2] + r[3] * r[3] > 1e-2) return false;
    }
    /* re-linearise from the new course; the next round's gap is what is left */
    apply();
    for (const v of vars) { if (v.kind === 's') v.s0 = v.e.s; else v.m0 = Math.abs(v.e.c.a); v.lo -= v.x; v.hi -= v.x; v.x = 0; }
    end = rows();
  }
  /* the last bit of position exactly, by the straights alone (linear),
     those not at a bound */
  {
    const g = gapOf();
    const gx = g[0], gz = g[1];
    if (gx * gx + gz * gz > 1e-6) return false;
    const free = vars.filter(v => v.kind === 's' && v.lo < -1e-9 && v.hi > 1e-9);
    if (on[0] && on[1]) {
      let a = 0, b = 0, c = 0;
      for (const v of free) { a += v.j[0] * v.j[0]; b += v.j[0] * v.j[1]; c += v.j[1] * v.j[1]; }
      const det = a * c - b * b;
      if (Math.abs(det) < 1e-9) return false;
      const lx = (c * gx - b * gz) / det, lz = (a * gz - b * gx) / det;
      for (const v of free) { v.x = v.j[0] * lx + v.j[1] * lz; if (v.x < v.lo - 1e-6 || v.x > v.hi + 1e-6) return false; }
    } else {
      /* one position row: the straights share it by their direction's share of it */
      const row = on[0] ? 0 : 1, gr = on[0] ? gx : gz;
      let a = 0;
      for (const v of free) a += v.j[row] * v.j[row];
      if (a < 1e-9) return false;
      for (const v of free) { v.x = v.j[row] * gr / a; if (v.x < v.lo - 1e-6 || v.x > v.hi + 1e-6) return false; }
    }
    apply();
  }
  const first = els[0], last = els[els.length - 1];
  if (first.s + (last.s || 0) > T.STRAIGHT_MAX) return false;
  return true;
}

/* A small dense system by Gaussian elimination with partial pivoting;
   null when singular. */
function solveLinear(M, r) {
  const n = r.length, A = M.map((row, i) => row.concat([r[i]]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let i = col + 1; i < n; i++) if (Math.abs(A[i][col]) > Math.abs(A[piv][col])) piv = i;
    if (Math.abs(A[piv][col]) < 1e-12) return null;
    if (piv !== col) { const t = A[piv]; A[piv] = A[col]; A[col] = t; }
    for (let i = col + 1; i < n; i++) { const f = A[i][col] / A[col][col]; if (f === 0) continue; for (let k = col; k <= n; k++) A[i][k] -= f * A[col][k]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let v = A[i][n]; for (let k = i + 1; k < n; k++) v -= A[i][k] * x[k]; x[i] = v / A[i][i]; }
  return x;
}

/* -------------------------------------------------------------- sampling */

function moving(arr, k, closed) {
  const n = arr.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, m = 0;
    for (let j = -k; j <= k; j++) {
      let t = i + j;
      if (closed) t = ((t % n) + n) % n; else if (t < 0 || t >= n) continue;
      s += arr[t]; m++;
    }
    out[i] = s / m;
  }
  return out;
}

/* A ramp's height u metres from its foot: a vertical arc of curvature K
   up to the grade G, a straight climb, and an arc over the top; two arcs
   alone when the rise is small. Returns the height and the ramp's length
   is rampLength(H). */
function rampLength(H) {
  const G = TRACKS.CROSS.grade, K = TRACKS.CROSS.crest;
  if (H >= G * G / K) return H / G + G / K;
  return 2 * Math.sqrt(H / K);
}
function rampHeight(u, H) {
  const G = TRACKS.CROSS.grade, K = TRACKS.CROSS.crest;
  const L = rampLength(H);
  if (u <= 0) return 0;
  if (u >= L) return H;
  if (H >= G * G / K) {
    const a = G / K;
    if (u <= a) return K * u * u / 2;
    if (u >= L - a) return H - K * (L - u) * (L - u) / 2;
    return K * a * a / 2 + G * (u - a);
  }
  const a = L / 2;
  if (u <= a) return K * u * u / 2;
  return H - K * (L - u) * (L - u) / 2;
}

function build(plan, kind, rng, d, opts, always) {
  const T = TRACKS, SAMPLE = T.SAMPLE;
  const closed = kind === 'circuit';
  const elevationScale = opts.elevation === undefined ? 1 : clamp(+opts.elevation || 0, 0, 1);
  const wantBank = elevationScale > 0 && opts.bank !== false && opts.bank !== 0;
  const wantCross = elevationScale > 0 && opts.crossover !== false && opts.crossover !== 0;
  let pieces = toPieces(plan.els);
  let total = 0;
  for (const p of pieces) total += p.len;
  if (closed) {
    /* Scale to a whole number of samples: closure is kept, radii move by
       a fraction of a per cent. */
    const f = Math.round(total / SAMPLE) * SAMPLE / total;
    for (const p of pieces) { p.len *= f; p.k0 /= f; p.k1 /= f; }
    for (const e of plan.els) { if (e.c) { e.c.R *= f; e.c.R2 *= f; } }
  } else {
    const extra = Math.ceil(total / SAMPLE - 1e-9) * SAMPLE - total;
    pieces[pieces.length - 1].len += extra;
  }
  const { starts } = integrate(pieces);
  total = 0;
  for (const p of pieces) total += p.len;
  const length = Math.round(total / SAMPLE) * SAMPLE;
  const n = closed ? length / SAMPLE : length / SAMPLE + 1;

  /* Per sample: pose, curvature, which corner, which straight. */
  const S = [];
  let pi = 0;
  for (let i = 0; i < n; i++) {
    const s = i * SAMPLE;
    while (pi < pieces.length - 1 && starts[pi + 1].s <= s) pi++;
    const p = pieces[pi], st = starts[pi];
    const u = Math.min(p.len, Math.max(0, s - st.s));
    const [x, z] = advance(p, st.x, st.z, st.th, u);
    const th = headingIn(p, st.th, u);
    const k = p.len > 0 ? p.k0 + (p.k1 - p.k0) * u / p.len : p.k0;
    S.push({ s, x, z, th, k, corner: p.corner, el: p.el, part: p.part });
  }
  const idx = s => { let i = Math.round(s / SAMPLE); if (closed) i = ((i % n) + n) % n; return i; };
  const inRange = (i) => closed || (i >= 0 && i < n);
  /* distance along from sample i to a point at metres along, the short way round on a circuit */
  const alongDist = (i, at) => { let dd = i * SAMPLE - at; if (closed) { dd = ((dd % length) + length) % length; if (dd > length / 2) dd -= length; } return dd; };

  /* Corner extents in metres along. */
  const corners = [];
  const seen = new Map();
  pieces.forEach((p, i) => {
    if (!p.corner) return;
    let c = seen.get(p.corner);
    if (!c) { c = { src: p.corner, from: starts[i].s, to: starts[i].s, arcFrom: 0, arcTo: 0 }; seen.set(p.corner, c); corners.push(c); }
    if (p.part === 'arc') { c.arcFrom = starts[i].s; c.arcTo = starts[i].s + p.len; }
    c.to = starts[i].s + p.len;
  });

  /* Width: the feature's, averaged along, held inside the clearance the
     local radius allows and the stated range. */
  const wantW = S.map(q => q.corner ? q.corner.width : lerp(T.STRAIGHT_WIDTH[0], T.STRAIGHT_WIDTH[1], d));
  const limitW = S.map(q => { const r = Math.abs(q.k) > 1e-9 ? 1 / Math.abs(q.k) : 1e9; return Math.min(T.WIDTH[1], 2 * (r - T.INNER_CLEAR)); });
  const clampedW = wantW.map((w, i) => Math.min(w, limitW[i]));
  const smoothW = moving(clampedW, T.WIDTH_SMOOTH, closed);
  const width = smoothW.map((w, i) => r2(clamp(Math.min(w, limitW[i]), T.WIDTH[0], T.WIDTH[1])));

  /* The crossover, if the centre line crosses itself exactly once and
     cleanly: the straighter pass goes over. Everything is in metres
     along the track. */
  let bridge = null;
  const X = T.CROSS;
  const xs = findCrossings({ kind, centre: S.map(q => ({ x: q.x, z: q.z })) });
  /* a crossing that cannot be bridged is an overlap: say so now rather
     than after the whole build (the validator would) */
  if (xs.length > 1 || (xs.length === 1 && (!wantCross || xs[0].sinAngle < X.minSin))) { if (!always) return { reject: 'overlap' }; }
  /* two parts of the track too close to share the road between them,
     which the validator's gap rule would reject after the whole build:
     centre samples at least NEAR_APART along the track closer than
     NEAR_CENTRES, which two roads of the least width and a gap apart can
     never be (a crossing's own neighbourhood is left to the validator) */
  if (!always && xs.length === 0) {
    const CELL = 16, apart = Math.round(T.NEAR_APART / SAMPLE);
    const cells = new Map();
    const key = (cx, cz) => cx * 100003 + cz;
    for (let i = 0; i < n; i++) { const k = key(Math.floor(S[i].x / CELL), Math.floor(S[i].z / CELL)); let l = cells.get(k); if (!l) { l = []; cells.set(k, l); } l.push(i); }
    const d2 = T.NEAR_CENTRES * T.NEAR_CENTRES;
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(S[i].x / CELL), cz = Math.floor(S[i].z / CELL);
      for (let a = cx - 1; a <= cx + 1; a++) for (let b = cz - 1; b <= cz + 1; b++) {
        const l = cells.get(key(a, b));
        if (!l) continue;
        for (const j of l) {
          if (j <= i) continue;
          let sep = j - i; if (closed) sep = Math.min(sep, n - sep);
          if (sep < apart) continue;
          const dx = S[i].x - S[j].x, dz = S[i].z - S[j].z;
          if (dx * dx + dz * dz < d2) return { reject: 'overlap' };
        }
      }
    }
  }
  if (wantCross) {
    if (xs.length === 1 && xs[0].sinAngle >= X.minSin) {
      const x = xs[0];
      const Hup = X.clearance * (1 - X.dipShare), Hdn = X.clearance * X.dipShare;
      const Lup = rampLength(Hup), Ldn = rampLength(Hdn);
      const bend = (at, half) => { let m = 0; for (let i = idx(at - half); i <= idx(at + half); i++) { const j = closed ? ((i % n) + n) % n : i; if (inRange(j) && Math.abs(S[j].k) > m) m = Math.abs(S[j].k); } return m; };
      const widthAt = at => width[Math.max(0, Math.min(n - 1, idx(at)))];
      const cand = [[x.alongI, x.alongJ], [x.alongJ, x.alongI]].map(([up, dn]) => {
        const deckHalf = (widthAt(dn) / 2 + 1 + X.margin) / x.sinAngle + X.margin;
        const cutHalf = (widthAt(up) / 2 + 1 + X.margin) / x.sinAngle + X.margin;
        return { up, dn, deckHalf, cutHalf, bend: bend(up, deckHalf + 10) };
      });
      cand.sort((a, b) => a.bend - b.bend);
      const pick = cand[0].bend < cand[1].bend - 1e-9 ? cand[0] : cand[rng() < 0.5 ? 0 : 1];
      const upExtent = pick.deckHalf + Lup, dnExtent = pick.cutHalf + Ldn;
      let sep = Math.abs(pick.up - pick.dn);
      if (closed) sep = Math.min(sep, length - sep);
      /* room along the track for both structures; a sprint keeps them off its ends */
      const inside = (at, ext) => closed || (at - ext >= T.START_LINE + X.startClear && at + ext <= length - 10);
      const fits = sep >= upExtent + dnExtent + X.apart && inside(pick.up, upExtent) && inside(pick.dn, dnExtent);
      if (fits) bridge = { along: pick.up, under: pick.dn, angle: Math.round(dasin(Math.min(1, x.sinAngle)) / DEG * 10) / 10, height: Hup, depth: Hdn, deckHalf: pick.deckHalf, cutHalf: pick.cutHalf, Lup, Ldn };
      else if (!always) return { reject: 'crossover' };
    }
  }
  /* the structure's reach at every sample: 1 on the deck, falling over
     the ramps; and the cut's, on the lower pass */
  const struct = new Array(n).fill(0), cut = new Array(n).fill(0), part = new Array(n).fill(null);
  const layStructure = () => {
    for (let i = 0; i < n; i++) {
      struct[i] = 0; cut[i] = 0; part[i] = null;
      const du = Math.abs(alongDist(i, bridge.along)), dl = Math.abs(alongDist(i, bridge.under));
      if (du <= bridge.deckHalf) { struct[i] = 1; part[i] = 'deck'; }
      else if (du < bridge.deckHalf + bridge.Lup) { struct[i] = rampHeight(bridge.deckHalf + bridge.Lup - du, bridge.height) / bridge.height; part[i] = 'ramp'; }
      if (dl <= bridge.cutHalf) { cut[i] = 1; part[i] = 'cut'; }
      else if (dl < bridge.cutHalf + bridge.Ldn) { cut[i] = rampHeight(bridge.cutHalf + bridge.Ldn - dl, bridge.depth) / bridge.depth; part[i] = 'cut'; }
    }
  };
  if (bridge) layStructure();
  /* A figure eight crosses near its waist, where a circuit starts, so a
     crossover circuit starts somewhere else: the loop is turned so the
     start is 10 m into the longest straight that keeps startClear metres
     from the structure before it and 50 m after, or there is no bridge. */
  if (bridge && closed) {
    const before = Math.round(X.startClear / SAMPLE) + 5, after = Math.round(50 / SAMPLE) + 5;
    let bestRun = null;
    let i0 = -1;
    const straightAt = i => !S[i].corner;
    const runs = [];
    for (let i = 0; i < n; i++) { if (straightAt(i)) { if (i0 < 0) i0 = i; } else if (i0 >= 0) { runs.push([i0, i - 1]); i0 = -1; } }
    if (i0 >= 0) runs.push([i0, n - 1]);
    if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === n - 1) { const lastRun = runs.pop(); runs[0] = [lastRun[0] - n, runs[0][1]]; }
    for (const [a, b] of runs) {
      if ((b - a + 1) * SAMPLE < 30) continue;
      let clear = true;
      for (let i = a - before; i <= a + after && clear; i++) if (part[((i % n) + n) % n]) clear = false;
      if (clear && (!bestRun || b - a > bestRun[1] - bestRun[0])) bestRun = [a, b];
    }
    if (!bestRun) { if (!always) return { reject: 'crossover' }; }
    else {
      const shift = ((bestRun[0] % n) + n) % n;
      if (shift !== 0) {
        const rot = arr => arr.splice(0, 0, ...arr.splice(shift));
        rot(S); rot(width);
        for (let i = 0; i < n; i++) S[i].s = i * SAMPLE;
        const back = v => { v -= shift * SAMPLE; return ((v % length) + length) % length; };
        for (const c of corners) { const len = c.to - c.from, arcLen = c.arcTo - c.arcFrom, arcOff = c.arcFrom - c.from; c.from = back(c.from); c.to = c.from + len; c.arcFrom = c.from + arcOff; c.arcTo = c.arcFrom + arcLen; }
        bridge.along = back(bridge.along); bridge.under = back(bridge.under);
        layStructure();
      }
    }
  }

  /* Clipping zones. */
  const clips = [];
  const snap = v => Math.round(v / SAMPLE) * SAMPLE;
  corners.forEach((c, ci) => {
    const src = c.src;
    if (!src.clip) return;
    const left = src.a > 0;
    const inner = src.clip === 'inner';
    const side = inner === left ? 'left' : 'right';
    const apex = (c.arcFrom + c.arcTo) / 2;
    let from, to;
    if (inner) { const hs = Math.max(6, 0.35 * (c.arcTo - c.arcFrom + src.ltUsed)); from = apex - hs; to = apex + hs; }
    else { from = c.from + src.ltUsed * 0.5; to = c.to - src.ltUsed * 0.3; }
    from = clamp(snap(from), c.from, c.to); to = clamp(snap(to), c.from, c.to);
    if (to - from < 8) return;
    clips.push({ from, to, side, kind: src.clip, apex: snap(apex), corner: ci });
  });

  /* Run-off and barrier kinds, per side. */
  const runT = { left: new Array(n).fill(0), right: new Array(n).fill(0) };
  const kinds = { left: new Array(n).fill('concrete'), right: new Array(n).fill('concrete') };
  /* fences along long straights, clear of the corners */
  {
    let i0 = -1;
    const isStraight = i => Math.abs(S[i].k) < 1 / T.STRAIGHT_RADIUS && !S[i].corner;
    const runs = [];
    for (let i = 0; i < n; i++) { if (isStraight(i)) { if (i0 < 0) i0 = i; } else if (i0 >= 0) { runs.push([i0, i - 1]); i0 = -1; } }
    if (i0 >= 0) runs.push([i0, n - 1]);
    if (closed && runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === n - 1) { const lastRun = runs.pop(); runs[0] = [lastRun[0] - n, runs[0][1]]; }
    for (const [a, b] of runs) {
      if ((b - a) * SAMPLE < T.FENCE_FROM) continue;
      for (let i = a + 5; i <= b - 5; i++) { const j = ((i % n) + n) % n; kinds.left[j] = 'fence'; kinds.right[j] = 'fence'; }
    }
  }
  corners.forEach(c => {
    const src = c.src;
    const outside = src.a > 0 ? 'right' : 'left';
    const a = idx(c.from) - 2, b = idx(c.from) + Math.round((c.to - c.from) / SAMPLE) + 5;
    for (let i = a; i <= b; i++) {
      const j = closed ? ((i % n) + n) % n : i;
      if (!inRange(j)) continue;
      if (src.outside === 'tyres') kinds[outside][j] = 'tyres';
      else if (kinds[outside][j] === 'fence') kinds[outside][j] = 'concrete';
      const inside = outside === 'left' ? 'right' : 'left';
      if (kinds[inside][j] === 'fence') kinds[inside][j] = 'concrete';
      if (src.runoff) runT[outside][j] = T.RUNOFF;
    }
  });
  /* never run-off where a clip judges that wall, or near it */
  const rampK = Math.round(T.RUNOFF_RAMP / SAMPLE / 2);
  for (const cl of clips) {
    for (let i = idx(cl.from) - 2 * rampK; i <= idx(cl.from) + Math.round((cl.to - cl.from) / SAMPLE) + 2 * rampK; i++) {
      const j = closed ? ((i % n) + n) % n : i;
      if (inRange(j)) runT[cl.side][j] = 0;
    }
  }
  /* a bridge and the cut beneath it: plain concrete, no run-off */
  if (bridge) {
    for (let i = 0; i < n; i++) {
      if (!part[i]) continue;
      for (let j = i - 2 * rampK; j <= i + 2 * rampK; j++) { const k = closed ? ((j % n) + n) % n : j; if (inRange(k)) { runT.left[k] = 0; runT.right[k] = 0; } }
      kinds.left[i] = 'concrete'; kinds.right[i] = 'concrete';
    }
  }
  const setback = { left: moving(runT.left, rampK, closed), right: moving(runT.right, rampK, closed) };
  for (const side of ['left', 'right']) for (let i = 0; i < n; i++) if (setback[side][i] < 1e-9) setback[side][i] = 0;

  /* Elevation: a few long waves, a whole number per lap on a circuit,
     scaled until the grade and the crests are inside their limits. A
     crossover track has the bridge for its elevation and no waves. */
  const y = new Array(n).fill(0);
  {
    const waves = [];
    const amp = between(rng, 0.6, 1) * lerp(T.ELEVATION[0], T.ELEVATION[1], d);
    const count = 2 + (rng() < 0.5 ? 1 : 0);
    let gradeSum = 0, crestSum = 0;
    for (let w = 0; w < count; w++) {
      const kw = closed ? TWO_PI * (1 + Math.floor(rng() * 3)) / length : TWO_PI / between(rng, 220, 600);
      const A = amp * between(rng, 0.3, 1) / count * 2;
      waves.push({ kw, A, ph: rng() * TWO_PI });
      gradeSum += A * kw; crestSum += A * kw * kw;
    }
    const scale = bridge ? 0 : elevationScale * Math.min(1, T.GRADE_MAX * T.ELEVATION_USE / gradeSum, T.CREST_K_MAX * T.ELEVATION_USE / crestSum);
    let y0 = 0;
    for (const w of waves) y0 += w.A * dsin(w.ph);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (const w of waves) v += w.A * dsin(w.kw * S[i].s + w.ph);
      y[i] = (v - y0) * scale;
    }
    if (bridge) for (let i = 0; i < n; i++) y[i] = struct[i] * bridge.height - cut[i] * bridge.depth;
  }
  /* Bank: the gentle bank every corner gets by its curvature, plus the
     banked corners' real angle, built over their ramps in and out, and
     none on a bridge or in the cut beneath it. */
  const bankRaw = S.map(q => clamp(q.k * T.BANK_RADIUS, -1, 1) * T.BANK_MAX * DEG * elevationScale);
  const bankGentle = moving(bankRaw, T.BANK_SMOOTH, closed);
  const bank = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let b = bankGentle[i];
    const q = S[i], c = q.corner;
    if (wantBank && c && c.bank > 0) {
      const cc = seen.get(c);
      /* over the ramp in and out; a middle piece of a multi apex corner has no ramps and takes the full bank */
      const lt = c.ltUsed;
      const win = lt > 1e-6 ? Math.min(smooth((q.s - cc.from) / lt), smooth((cc.to - q.s) / lt)) : 1;
      b += (c.a > 0 ? 1 : -1) * c.bank * DEG * win;
    }
    if (bridge && part[i]) b *= 1 - Math.max(struct[i], cut[i]);
    bank[i] = clamp(b, -T.BANK_CORNER_MAX * DEG, T.BANK_CORNER_MAX * DEG);
  }

  /* Assemble. */
  const centre = [], leftPts = [], rightPts = [];
  for (let i = 0; i < n; i++) {
    const q = S[i], h = wrapAngle(q.th);
    const lx = -dcos(q.th), lz = dsin(q.th);
    const tb = dsin(bank[i]) / dcos(bank[i]);
    const hw = width[i] / 2;
    const offL = hw + setback.left[i], offR = hw + setback.right[i];
    const c = { x: r4(q.x), y: r4(y[i]), z: r4(q.z), heading: r6(h), bank: r6(bank[i]), width: width[i], layer: struct[i] > 0 ? 1 : 0 };
    if (part[i]) c.part = part[i];
    centre.push(c);
    leftPts.push({ x: r4(q.x + lx * offL), y: r4(y[i] - Math.min(offL, hw) * tb), z: r4(q.z + lz * offL) });
    rightPts.push({ x: r4(q.x - lx * offR), y: r4(y[i] + Math.min(offR, hw) * tb), z: r4(q.z - lz * offR) });
  }
  if (closed) { leftPts.push({ ...leftPts[0] }); rightPts.push({ ...rightPts[0] }); }

  const spansOf = side => {
    const out = [];
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const kind = kinds[side][i], ro = setback[side][i] > 0 || setback[side][(i + 1) % n] > 0;
      const last = out[out.length - 1];
      if (last && last.kind === kind && (last.runoff > 0) === ro) { last.to = (i + 1) * SAMPLE; last.runoff = Math.max(last.runoff, r2(Math.max(setback[side][i], setback[side][(i + 1) % n]))); }
      else out.push({ from: i * SAMPLE, to: (i + 1) * SAMPLE, kind, runoff: ro ? r2(Math.max(setback[side][i], setback[side][(i + 1) % n])) : 0 });
    }
    return out;
  };
  const walls = [
    { side: 'left', kind: 'concrete', points: leftPts, spans: spansOf('left') },
    { side: 'right', kind: 'concrete', points: rightPts, spans: spansOf('right') },
  ];
  if (!closed) {
    /* End caps, so nobody drives off either end. With side 'left' the
       physics takes the track to be on the right of the direction the
       polyline runs, which these paths keep. */
    const capAt = (i, back) => {
      const q = centre[i], fx = -dsin(q.heading), fz = -dcos(q.heading);
      const L = leftPts[i], R = rightPts[i], o = back ? -T.CAP_BACK : T.CAP_BACK;
      const Lb = { x: r4(L.x + fx * o), y: L.y, z: r4(L.z + fz * o) }, Rb = { x: r4(R.x + fx * o), y: R.y, z: r4(R.z + fz * o) };
      return back ? [{ ...R }, Rb, Lb, { ...L }] : [{ ...L }, Lb, Rb, { ...R }];
    };
    walls.push({ side: 'left', kind: 'tyres', cap: 'start', points: capAt(0, true), spans: [] });
    walls.push({ side: 'left', kind: 'tyres', cap: 'finish', points: capAt(n - 1, false), spans: [] });
  }

  /* Start, line, checkpoints, finish. */
  const at = s => centre[Math.round(s / SAMPLE)];
  const st = at(T.START_ALONG);
  const start = { along: T.START_ALONG, x: st.x, y: st.y, z: st.z, yaw: st.heading, heading: st.heading };
  let finish = null, checkpoints;
  if (closed) {
    checkpoints = [1, 2, 3].map(k => snap(length * k / 4));
  } else {
    const fa = length - T.FINISH_RUNOUT;
    const f = at(fa);
    finish = { along: fa, x: f.x, y: f.y, z: f.z, heading: f.heading, width: f.width };
    checkpoints = [1, 2].map(k => snap(T.START_LINE + (fa - T.START_LINE) * k / 3));
  }

  /* Bounds. */
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const w of walls) for (const p of w.points) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
  const bounds = { minX: r4(minX - 30), maxX: r4(maxX + 30), minZ: r4(minZ - 30), maxZ: r4(maxZ + 30), minY: r4(minY), maxY: r4(maxY) };

  const names = {};
  const cornerList = corners.map((c, i) => {
    const src = c.src;
    const count = (names[src.type] = (names[src.type] || 0) + 1);
    return { name: src.type + ' ' + count, type: src.type, from: snap(c.from), to: snap(c.to), apex: snap((c.arcFrom + c.arcTo) / 2), radius: r2(Math.min(src.R, src.R2)), radiusEnd: r2(src.R2), angle: r2(src.a / DEG), dir: src.a > 0 ? 'left' : 'right', bank: wantBank ? r2(src.bank) : 0, index: i };
  });
  const sections = {};
  for (const c of cornerList) sections[c.name] = [c.from, c.to];
  const bridges = [];
  if (bridge) {
    const u = bridge.along, l = bridge.under;
    bridges.push({
      along: r2(u), under: r2(l), angle: bridge.angle, height: r2(bridge.height), depth: r2(bridge.depth),
      deck: [r2(u - bridge.deckHalf), r2(u + bridge.deckHalf)],
      ramps: [[r2(u - bridge.deckHalf - bridge.Lup), r2(u - bridge.deckHalf)], [r2(u + bridge.deckHalf), r2(u + bridge.deckHalf + bridge.Lup)]],
      cut: [r2(l - bridge.cutHalf - bridge.Ldn), r2(l + bridge.cutHalf + bridge.Ldn)],
    });
  }

  return { kind, length, centre, walls, clips, start, startLine: T.START_LINE, checkpoints, finish, bridges, bounds, corners: cornerList, sections, cones: [] };
}

/* ------------------------------------------------------- the public face */

export function generateTrack(seed, options) {
  const o = options || {};
  const kind = o.kind === 'sprint' ? 'sprint' : 'circuit';
  const d = clamp(o.difficulty === undefined ? 0.5 : +o.difficulty || 0, 0, 1);
  const target = targetRange(o.length);
  const seedN = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);
  const rng = createRng(seedN, kind === 'circuit' ? 0x51c0 : 0x5b71);
  const elevationOn = o.elevation === undefined || (clamp(+o.elevation || 0, 0, 1) > 0);
  const eights = kind === 'circuit' && elevationOn && o.crossover !== false && o.crossover !== 0;
  let failures = {};
  for (let attempt = 1; attempt <= TRACKS.ATTEMPTS; attempt++) {
    const goal = between(rng, target.min, target.max);
    const eight = eights && goal >= TRACKS.CROSS.minLap && rng() < lerp(TRACKS.CROSS.chance[0], TRACKS.CROSS.chance[1], d);
    const plan = kind === 'sprint' ? planSprint(rng, d, goal) : eight ? planEight(rng, d, goal, target) : planCircuit(rng, d, goal);
    if (!plan) { failures.turning = (failures.turning || 0) + 1; continue; }
    if (kind === 'circuit' && !closePosition(plan.els, target, null, goal)) { failures.closure = (failures.closure || 0) + 1; continue; }
    /* the length (after closure on a circuit), before the cost of a build */
    {
      const total = planLength(plan.els);
      if (total < target.min - 2 || total > target.max + 2) { failures.length = (failures.length || 0) + 1; if (eight) failures.eights = (failures.eights || 0) + 1; continue; }
    }
    const t = build(plan, kind, rng, d, o);
    if (t.reject) { failures[t.reject] = (failures[t.reject] || 0) + 1; if (eight) failures.eights = (failures.eights || 0) + 1; continue; }
    const v = validateTrack(t, target);
    if (!v.ok) { for (const f of v.failed) failures[f] = (failures[f] || 0) + 1; if (eight) failures.eights = (failures.eights || 0) + 1; continue; }
    return finishTrack(t, seedN, kind, d, target, attempt, failures, false, eight);
  }
  /* Nothing passed: the safe course, which always does (the validity
     test checks it). */
  const t = build(fallbackPlan(kind, (target.min + target.max) / 2), kind, rng, d, o, true);
  return finishTrack(t, seedN, kind, d, target, TRACKS.ATTEMPTS, failures, true, false);
}

function finishTrack(t, seed, kind, d, target, attempts, failures, fallback, eight) {
  return {
    name: kind + ' ' + seed, seed, version: 2,
    kind: t.kind, length: t.length,
    target: { min: r2(target.min), max: r2(target.max) }, requested: { difficulty: d },
    difficulty: difficultyOf(t),
    centre: t.centre, walls: t.walls, clips: t.clips,
    start: t.start, startLine: t.startLine, checkpoints: t.checkpoints, finish: t.finish,
    bridges: t.bridges,
    bounds: t.bounds, corners: t.corners, sections: t.sections, cones: t.cones,
    attempts, rejected: failures, fallback, plannedEight: !!eight,
  };
}

/* A plain course that passes every check, sized to the goal (a corner
   is its ramp length longer than R times its angle): a rounded
   rectangle for a circuit, four easy bends for a sprint. */
function fallbackPlan(kind, goal) {
  const sweep = (R, a) => ({ c: corner('sweeper', R, a, 20, 13, 'outer') });
  if (kind === 'circuit') {
    const R = clamp((goal - 480) / TWO_PI, 40, 110), X = clamp((goal - TWO_PI * R - 4 * 20) / 4, 60, TRACKS.STRAIGHT_MAX);
    const q = TWO_PI / 4;
    const els = [{ s: X - 10, adj: true, min: 50 }, sweep(R, q), { s: X, adj: true }, sweep(R, q), { s: X, adj: true }, sweep(R, q), { s: X, adj: true }, sweep(R, q), { s: 10, adj: true, min: 10 }];
    return { els, sgn: 1 };
  }
  const a = 60 * DEG, R = clamp((goal - TRACKS.FINISH_RUNOUT - 80 - 5 * 80) / (4 * a), 40, 110);
  const X = clamp((goal - 4 * (R * a + 20) - TRACKS.FINISH_RUNOUT) / 5, 50, TRACKS.STRAIGHT_MAX - TRACKS.FINISH_RUNOUT);
  return { els: [{ s: X }, sweep(R, a), { s: X }, sweep(R, -a), { s: X }, sweep(R, a), { s: X }, sweep(R, -a), { s: X + TRACKS.FINISH_RUNOUT }], sgn: 0 };
}

/* For the probes and the lab: build a course from a hand written list of
   elements, through the same pipeline but without validation, so a
   known answer can be made deliberately broken. A corner may carry R2
   (its end radius) and bank (degrees). */
export function trackFromElements(kind, els, options) {
  const o = options || {};
  const rng = createRng(1, 0x7e57);
  const plan = { els: els.map(e => {
    if (!e.c) return { s: e.s, adj: !!e.adj, min: e.s };
    const c = corner(e.c.type || 'tight', e.c.R, e.c.angle * DEG, e.c.lt === undefined ? 10 : e.c.lt, e.c.width || 14, e.c.clip || null, e.c.R2);
    if (e.c.bank) c.bank = e.c.bank;
    return { c };
  }), sgn: 0 };
  if (kind === 'circuit' && o.close) { if (!closePosition(plan.els, targetRange(o.length || [0, 1e9]))) return null; }
  const t = build(plan, kind, rng, o.difficulty === undefined ? 0.5 : o.difficulty, o, true);
  return finishTrack(t, 0, kind, 0.5, targetRange(o.length || [0, 1e9]), 1, {}, false, false);
}
