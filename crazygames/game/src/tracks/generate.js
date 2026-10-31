/* THE TRACK GENERATOR. A seeded drift course as plain data: no three.js,
   no DOM, deterministic for a seed in every JavaScript engine (see
   dmath.js; nothing here calls Math.sin, Math.cos or Math.random).

   generateTrack(seed, options) returns a closed circuit or a point to
   point sprint in exactly the shape of the hand made test track in
   ../ground/track.js, so physics/world.js drives on it unchanged:

     kind         'circuit' or 'sprint'
     length       metres. A circuit's lap; a sprint's centre line, end to end
     centre       a sample every 2 m: { x, y, z, heading, bank, width }.
                  heading is the vehicle's yaw (zero faces -Z, positive
                  turns left); width is the full drivable width; bank is
                  the road's roll in radians, positive lowers the left
                  edge, which banks a left hand corner. Sample i is at
                  i * 2 metres along, which is what world.js assumes.
     walls        [left, right, ...caps]. walls[0] and walls[1] are the
                  barriers, one point beside every centre sample (a
                  circuit repeats the first point at the end), because
                  world.js and the scene find a clip's wall by side and
                  index it by sample. Each has side, kind (what the
                  physics reports on a hit) and spans: { from, to, kind,
                  runoff } in metres along, kind 'concrete', 'tyres' or
                  'fence', runoff the metres of run-off before the
                  barrier there. A sprint adds two end caps (cap: true).
     clips        { from, to, side, kind, apex, corner }: kind 'inner'
                  (clip the apex, the inside wall) or 'outer' (close to
                  the outside wall), side the wall that is judged.
     start        { along, x, y, z, yaw, heading }; startLine, metres
                  along; checkpoints, metres along; finish (sprints) {
                  along, x, y, z, heading, width }, null for a circuit,
                  whose finish is the start line.
     bounds       { minX, maxX, minZ, maxZ, minY, maxY }, 30 m padded.
     difficulty   an estimate, 0 to 1, from the geometry (analyse.js).
     corners      { type, from, to, apex, radius, angle, dir } as designed;
                  sections the same as { name: [from, to] } for the
                  scripted driver; cones [] as the test track has.

   How it builds one. A course is a curvature profile: straights,
   clothoid ramps and arcs, so every radius is known and the heading is
   exact. Features (hairpin, tight corner, sweeper, esses, chicane) are
   drawn by weight for the difficulty and joined by straights. A circuit
   steers its features towards one full turn, then the corner angles
   are trimmed to make the turning exactly 360 degrees, and the straights
   are lengthened (least squares, never shortened) to close the gap in
   position, so the loop meets itself exactly. Then it is scaled by a
   fraction of a per cent so the lap is a whole number of samples.
   Width, run-off, barrier kinds, clipping zones, elevation and bank
   are laid along it, and analyse.js validates it: on any failure the
   next attempt is drawn from the same seeded stream. Every tunable is
   in TRACKS below. */
import { dsin, dcos, wrapAngle, TWO_PI } from './dmath.js';
import { validateTrack, difficultyOf } from './analyse.js';

const DEG = Math.PI / 180;

export const TRACKS = {
  SAMPLE:          2,            // m between centre samples, fixed by the physics
  LENGTH:          [600, 1200],  // m, the default target range
  LENGTH_SLACK:    0.1,          // a single number target accepts this share either side
  WIDTH:           [10, 18],     // m, the stated range of the drivable width
  RADIUS:          [12, 120],    // m, the stated range of every corner's tightest radius
  STRAIGHT_RADIUS: 250,          // m: gentler than this counts as straight
  INNER_CLEAR:     4,            // m: half the width is at most the radius less this, so the inside wall never folds
  GAP:             4,            // m, at least, between barriers of two different parts of the track
  RUNOFF:          4,            // m of run-off before a set back barrier, inside the physics' 6 m respawn line
  RUNOFF_RAMP:     16,           // m over which a barrier steps out to its run-off and back
  START_STRAIGHT:  [50, 80],     // m
  CLOSE_STRAIGHT:  10,           // m, at least, before a circuit's start straight
  FINISH_STRAIGHT: [30, 50],     // m before a sprint's finish line
  FINISH_RUNOUT:   40,           // m of track past a sprint's finish line
  STRAIGHT_MAX:    150,          // m, no straight longer
  SHRINK:          0.6,          // a circuit's closure may shorten a straight to this share of its drawn length
  START_ALONG:     2,            // m along where the car starts
  START_LINE:      8,            // m along, the start line (the scene draws it at sample 4)
  CAP_BACK:        1,            // m a sprint's end cap sits beyond its last sample
  LINK_SHARE:      [0.45, 0.7],  // share of the straights between features that are short links, easy to hard
  LINK:            [6, 24],      // m, a short link
  STRAIGHT:        [[30, 75], [22, 50]],   // m, a longer straight, easy and hard
  STRAIGHT_WIDTH:  [13, 11.5],   // m on straights, easy to hard
  WIDTH_SMOOTH:    6,            // samples either side the width is averaged over
  BANK_MAX:        3,            // degrees
  BANK_RADIUS:     20,           // m: this tight or tighter takes the full bank
  BANK_SMOOTH:     5,            // samples either side
  ELEVATION:       [1.2, 3.5],   // m of rise and fall, easy to hard, before the limits below
  GRADE_MAX:       0.05,         // the steepest slope, as rise over run
  CREST_K_MAX:     0.002,        // 1/m: a crest this sharp at TOP_SPEED pulls 0.78 g of the car's weight off
  TOP_SPEED:       62,           // m/s, the car's flat out speed (TUNE.VEHICLE.TOP_SPEED)
  ELEVATION_USE:   0.8,          // share of the grade and crest limits the generator aims for
  TURN_BIAS:       0.72,         // chance a corner turns the way the plan wants
  ATTEMPTS:        1000,         // a failed attempt costs about a millisecond; no seed tested needs more than a few hundred
  /* Features, each [easy, hard] where a range is given, lerped by the
     difficulty. R radius in m, angle in degrees of turn (including the
     clothoid ramps), lt the ramp length in m, width in m. */
  WEIGHTS: {
    hairpin: [1, 3], tight: [3, 2], sweeper: [3, 1], esses: [2, 3], chicane: [1, 2],
  },
  FEATURES: {
    hairpin: { R: [[16, 22], [12.5, 16]], angle: [150, 195], lt: 8,  width: [[15, 17], [13, 15]], clip: 'inner', outside: 'tyres', runoff: 0.7 },
    tight:   { R: [[24, 34], [18, 26]],   angle: [70, 120],  lt: 10, width: [[14, 16], [12, 14]], clip: 'either', outside: 'tyres', runoff: 0.5 },
    sweeper: { R: [[60, 110], [40, 75]],  angle: [45, 120],  lt: 20, width: [[13, 15], [11, 13]], clip: 'outer', outside: 'concrete', runoff: 0 },
    esses:   { R: [[32, 50], [22, 36]],   angle: [45, 95],   lt: 12, width: [[14, 16], [12, 14]], clip: 'alternate', outside: 'concrete', runoff: 0, count: [2, 3] },
    chicane: { R: [[26, 36], [18, 26]],   angle: [25, 45],   lt: 8,  width: [[13, 14], [11, 12]], clip: 'middle', outside: 'concrete', runoff: 0, link: [0, 6] },
  },
  FENCE_FROM:      40,           // m: straights at least this long are fenced, away from the corners
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

/* One corner: radius, signed turn (radians, positive left), ramps. */
function corner(type, R, a, lt, width, clip) {
  return { type, R, a, lt, width: Math.min(width, 2 * (R - TRACKS.INNER_CLEAR)), clip, outside: TRACKS.FEATURES[type].outside, runoff: false, adjustable: type !== 'chicane' };
}

/* A feature: a run of corners and the short links inside it. dir is the
   first corner's direction, +1 left. */
function makeFeature(type, dir, rng, d) {
  const F = TRACKS.FEATURES[type];
  const [rLo, rHi] = rangeAt(F.R, d), [wLo, wHi] = rangeAt(F.width, d);
  const R = () => between(rng, rLo, rHi), W = () => between(rng, wLo, wHi);
  const A = () => between(rng, F.angle[0], F.angle[1]) * DEG;
  const items = [];
  if (type === 'esses') {
    const n = rng() < 0.5 ? F.count[0] : F.count[1];
    for (let i = 0; i < n; i++) {
      const c = corner(type, R(), (i % 2 ? -dir : dir) * A(), F.lt, W(), i % 2 ? 'inner' : 'outer');
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
  } else {
    let clip = F.clip;
    if (clip === 'either') clip = rng() < 0.5 ? 'inner' : 'outer';
    const c = corner(type, R(), dir * A(), F.lt, W(), clip);
    c.runoff = clip !== 'outer' && rng() < F.runoff;
    items.push({ c });
  }
  let net = 0;
  for (const it of items) if (it.c) net += it.c.a;
  return { type, items, net };
}

/* The angle range a corner may be trimmed within. */
function angleLimits(c) {
  const F = TRACKS.FEATURES[c.type];
  return [F.angle[0] * DEG, F.angle[1] * DEG];
}

/* -------------------------------------------------------- the planners */

/* A sequence of elements: { s: length, adj, min, max } straights and
   { c } corners. */
function planCircuit(rng, d, goal) {
  const T = TRACKS;
  const sgn = rng() < 0.5 ? 1 : -1;
  const els = [{ s: between(rng, T.START_STRAIGHT[0], T.START_STRAIGHT[1]), adj: true, min: T.START_STRAIGHT[0], start: true }];
  let H = 0, est = els[0].s;
  const budget = goal * 0.8;
  let guard = 0;
  while (est < budget && guard++ < 60) {
    const type = weightedPick(rng, T.WEIGHTS, d);
    const want = sgn * TWO_PI * Math.min(1, (est + 80) / budget);
    const toward = want - H >= 0 ? 1 : -1;
    const dir = rng() < T.TURN_BIAS ? toward : -toward;
    const f = makeFeature(type, dir, rng, d);
    for (const it of f.items) { if (it.c) { els.push({ c: it.c }); est += Math.abs(it.c.a) * it.c.R; } else { els.push({ s: it.link, adj: false }); est += it.link; } }
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
    const [lo, hi] = angleLimits(c);
    c.a = (D > 0 ? 1 : -1) * clamp(Math.abs(D), lo, hi);
    els.push({ c });
    const s = straightBetween(rng, d);
    els.push({ s, adj: true, min: T.LINK[0] });
    D -= c.a;
  }
  if (!trimTurning(els, D)) return null;
  const last = els[els.length - 1];
  if (last.s !== undefined) { last.min = Math.max(last.min, T.CLOSE_STRAIGHT); last.s = Math.max(last.s, T.CLOSE_STRAIGHT); }
  return { els, sgn };
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
    const [lo, hi] = angleLimits(e.c);
    const m = Math.abs(e.c.a);
    const cap = (e.c.a > 0 ? 1 : -1) === sD ? hi - m : m - lo;
    if (cap > 0) { caps.push([e.c, cap]); C += cap; }
  }
  if (C < Math.abs(D)) return false;
  const k = Math.abs(D) / C;
  for (const [c, cap] of caps) c.a += sD * cap * k;
  return true;
}

function planSprint(rng, d, goal) {
  const T = TRACKS;
  const els = [{ s: between(rng, T.START_STRAIGHT[0], T.START_STRAIGHT[1]), adj: false, start: true }];
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
    for (const it of f.items) { if (it.c) { els.push({ c: it.c }); est += Math.abs(it.c.a) * it.c.R; } else { els.push({ s: it.link, adj: false }); est += it.link; } }
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

/* Pieces of linearly varying curvature: { len, k0, k1, corner, el }. */
function toPieces(els) {
  const pieces = [];
  els.forEach((e, ei) => {
    if (e.s !== undefined) { if (e.s > 0) pieces.push({ len: e.s, k0: 0, k1: 0, corner: null, el: ei }); return; }
    const c = e.c, m = Math.abs(c.a), k = (c.a > 0 ? 1 : -1) / c.R;
    const lt = Math.min(c.lt, 0.45 * c.R * m);
    const arc = c.R * m - lt;
    c.ltUsed = lt;
    pieces.push({ len: lt, k0: 0, k1: k, corner: c, el: ei, part: 'in' });
    pieces.push({ len: arc, k0: k, k1: k, corner: c, el: ei, part: 'arc' });
    pieces.push({ len: lt, k0: k, k1: 0, corner: c, el: ei, part: 'out' });
  });
  return pieces;
}

const GL = [[0.1127016653792583, 5 / 18], [0.5, 8 / 18], [0.8872983346207417, 5 / 18]];

/* Heading along a piece, u metres in. */
function headingIn(p, th0, u) { return th0 + p.k0 * u + (p.len > 0 ? (p.k1 - p.k0) * u * u / (2 * p.len) : 0); }

/* Position u metres into a piece from its start pose, by three point
   Gauss-Legendre on steps of a metre or less. */
function advance(p, x0, z0, th0, u) {
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
   straights: the least squares change that meets the gap, each straight
   kept between its least length and STRAIGHT_MAX (an active set on the
   two equations), and the start straight with the one before it, which
   are one straight across the line, no longer than STRAIGHT_MAX. */
function closePosition(els) {
  const T = TRACKS;
  const pieces = toPieces(els);
  const { starts, end } = integrate(pieces);
  let tx = -end.x, tz = -end.z;
  const adj = [];
  pieces.forEach((p, i) => {
    const e = els[p.el];
    if (p.corner || !e.adj) return;
    const lo = Math.max(e.min, e.s * T.SHRINK) - e.s, hi = T.STRAIGHT_MAX - e.s;
    adj.push({ e, dx: -dsin(starts[i].th), dz: -dcos(starts[i].th), lo, hi, fixed: false, dl: 0 });
  });
  for (let iter = 0; iter < 40; iter++) {
    const free = adj.filter(q => !q.fixed);
    let rx = tx, rz = tz;
    for (const q of adj) if (q.fixed) { rx -= q.dl * q.dx; rz -= q.dl * q.dz; }
    if (!free.length) return false;
    let a = 0, b = 0, c = 0;
    for (const q of free) { a += q.dx * q.dx; b += q.dx * q.dz; c += q.dz * q.dz; }
    const det = a * c - b * b;
    if (Math.abs(det) < 1e-9) return false;
    const lx = (c * rx - b * rz) / det, lz = (a * rz - b * rx) / det;
    let worst = null, over = 0;
    for (const q of free) {
      q.dl = q.dx * lx + q.dz * lz;
      const v = q.dl < q.lo ? q.lo - q.dl : q.dl > q.hi ? q.dl - q.hi : 0;
      if (v > over) { over = v; worst = q; }
    }
    if (!worst) {
      for (const q of adj) q.e.s += q.dl;
      const first = els[0], last = els[els.length - 1];
      if (first.s + (last.s || 0) > T.STRAIGHT_MAX) return false;
      return true;
    }
    worst.dl = worst.dl < worst.lo ? worst.lo : worst.hi;
    worst.fixed = true;
  }
  return false;
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

function build(plan, kind, rng, d, opts) {
  const T = TRACKS, SAMPLE = T.SAMPLE;
  const closed = kind === 'circuit';
  let pieces = toPieces(plan.els);
  let total = 0;
  for (const p of pieces) total += p.len;
  if (closed) {
    /* Scale to a whole number of samples: closure is kept, radii move by
       a fraction of a per cent. */
    const f = Math.round(total / SAMPLE) * SAMPLE / total;
    for (const p of pieces) { p.len *= f; p.k0 /= f; p.k1 /= f; }
    for (const e of plan.els) { if (e.c) e.c.R *= f; }
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
    S.push({ s, x, z, th, k, corner: p.corner, el: p.el });
  }

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
  const idx = s => { let i = Math.round(s / SAMPLE); if (closed) i = ((i % n) + n) % n; return i; };
  const inRange = (i) => closed || (i >= 0 && i < n);
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
  /* sprints: no run-off by the start or the finish */
  const setback = { left: moving(runT.left, rampK, closed), right: moving(runT.right, rampK, closed) };
  for (const side of ['left', 'right']) for (let i = 0; i < n; i++) if (setback[side][i] < 1e-9) setback[side][i] = 0;

  /* Elevation: a few long waves, a whole number per lap on a circuit,
     scaled until the grade and the crests are inside their limits. */
  const y = new Array(n).fill(0);
  const elevationScale = opts.elevation === undefined ? 1 : clamp(+opts.elevation || 0, 0, 1);
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
    const scale = elevationScale * Math.min(1, T.GRADE_MAX * T.ELEVATION_USE / gradeSum, T.CREST_K_MAX * T.ELEVATION_USE / crestSum);
    let y0 = 0;
    for (const w of waves) y0 += w.A * dsin(w.ph);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (const w of waves) v += w.A * dsin(w.kw * S[i].s + w.ph);
      y[i] = (v - y0) * scale;
    }
  }
  /* Bank into the corners. */
  const bankRaw = S.map(q => clamp(q.k * T.BANK_RADIUS, -1, 1) * T.BANK_MAX * DEG * elevationScale);
  const bank = moving(bankRaw, T.BANK_SMOOTH, closed);

  /* Assemble. */
  const centre = [], leftPts = [], rightPts = [];
  for (let i = 0; i < n; i++) {
    const q = S[i], h = wrapAngle(q.th);
    const lx = -dcos(q.th), lz = dsin(q.th);
    const tb = dsin(bank[i]) / dcos(bank[i]);
    const hw = width[i] / 2;
    const offL = hw + setback.left[i], offR = hw + setback.right[i];
    centre.push({ x: r4(q.x), y: r4(y[i]), z: r4(q.z), heading: r6(h), bank: r6(bank[i]), width: width[i] });
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
    return { name: src.type + ' ' + count, type: src.type, from: snap(c.from), to: snap(c.to), apex: snap((c.arcFrom + c.arcTo) / 2), radius: r2(src.R), angle: r2(src.a / DEG), dir: src.a > 0 ? 'left' : 'right', index: i };
  });
  const sections = {};
  for (const c of cornerList) sections[c.name] = [c.from, c.to];

  return { kind, length, centre, walls, clips, start, startLine: T.START_LINE, checkpoints, finish, bounds, corners: cornerList, sections, cones: [] };
}

/* ------------------------------------------------------- the public face */

export function generateTrack(seed, options) {
  const o = options || {};
  const kind = o.kind === 'sprint' ? 'sprint' : 'circuit';
  const d = clamp(o.difficulty === undefined ? 0.5 : +o.difficulty || 0, 0, 1);
  const target = targetRange(o.length);
  const seedN = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);
  const rng = createRng(seedN, kind === 'circuit' ? 0x51c0 : 0x5b71);
  let failures = {};
  for (let attempt = 1; attempt <= TRACKS.ATTEMPTS; attempt++) {
    const goal = between(rng, target.min, target.max);
    const plan = kind === 'circuit' ? planCircuit(rng, d, goal) : planSprint(rng, d, goal);
    if (!plan) { failures.turning = (failures.turning || 0) + 1; continue; }
    if (kind === 'circuit' && !closePosition(plan.els)) { failures.closure = (failures.closure || 0) + 1; continue; }
    const t = build(plan, kind, rng, d, o);
    const v = validateTrack(t, target);
    if (!v.ok) { for (const f of v.failed) failures[f] = (failures[f] || 0) + 1; continue; }
    return finishTrack(t, seedN, kind, d, target, attempt, failures, false);
  }
  /* Nothing passed: the safe course, which always does (the validity
     test checks it). */
  const t = build(fallbackPlan(kind, (target.min + target.max) / 2), kind, rng, d, o);
  return finishTrack(t, seedN, kind, d, target, TRACKS.ATTEMPTS, failures, true);
}

function finishTrack(t, seed, kind, d, target, attempts, failures, fallback) {
  return {
    name: kind + ' ' + seed, seed, version: 1,
    kind: t.kind, length: t.length,
    target: { min: r2(target.min), max: r2(target.max) }, requested: { difficulty: d },
    difficulty: difficultyOf(t),
    centre: t.centre, walls: t.walls, clips: t.clips,
    start: t.start, startLine: t.startLine, checkpoints: t.checkpoints, finish: t.finish,
    bounds: t.bounds, corners: t.corners, sections: t.sections, cones: t.cones,
    attempts, rejected: failures, fallback,
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
   known answer can be made deliberately broken. */
export function trackFromElements(kind, els, options) {
  const o = options || {};
  const rng = createRng(1, 0x7e57);
  const plan = { els: els.map(e => e.c ? { c: corner(e.c.type || 'tight', e.c.R, e.c.angle * DEG, e.c.lt === undefined ? 10 : e.c.lt, e.c.width || 14, e.c.clip || null) } : { s: e.s, adj: !!e.adj, min: e.s }), sgn: 0 };
  if (kind === 'circuit' && o.close) { if (!closePosition(plan.els)) return null; }
  const t = build(plan, kind, rng, o.difficulty === undefined ? 0.5 : o.difficulty, o);
  return finishTrack(t, 0, kind, 0.5, targetRange(o.length || [0, 1e9]), 1, {}, false);
}
