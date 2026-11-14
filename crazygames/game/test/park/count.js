/* THE COUNTS MADE AGAIN (briefs/PLAYGROUND.md measure 3): each
   challenge's count from the recorded positions of a drive, by a means
   that is not the judge's (src/park/challenges.js), in Node. A row of a
   recording is [x, z, yaw, speed, slip, vx > 0, touching, hard hit,
   cones knocked, ...the judge's counts] (lib.js drive). Geometry is
   read from the ground the page sent (groundOf), not from the judge.

   What a slide and a chain are is re-derived here from the angle and
   the speed with the scorer's published numbers (TUNE.SCORING), not
   read from the scorer. */
const DEG = 180 / Math.PI, STEP = 1 / 120;
export const X = 0, Z = 1, YAW = 2, V = 3, SLIP = 4, FWD = 5, TOUCH = 6, HARD = 7, CONES = 8, JUDGE = 9;

/* per step: sliding (the scorer would score it), and the chain it belongs to (0 for none): a chain runs from its first sliding step until gap seconds pass without one, or a hard hit */
export function chains(rec, S) {
  const sliding = new Uint8Array(rec.length), chain = new Int32Array(rec.length);
  let id = 0, on = false, gap = 0;
  for (let i = 0; i < rec.length; i++) {
    const r = rec[i], sl = Math.abs(r[SLIP]) * DEG >= S.MIN_ANGLE && r[V] >= S.MIN_SPEED && r[FWD] === 1;
    if (r[HARD]) { on = false; continue; }
    if (sl) { if (!on) { on = true; id++; } gap = 0; sliding[i] = 1; }
    else if (on) { gap += STEP; if (gap >= S.BANK_GAP - 1e-9) on = false; }
    if (on) chain[i] = id;
  }
  return { sliding, chain, count: id };
}
/* runs of consecutive steps for which keep(i) holds, allowing gaps of up to grace seconds */
function runs(n, keep, grace) {
  const out = []; let from = -1, last = -1;
  for (let i = 0; i < n; i++) {
    if (keep(i)) { if (from < 0) from = i; last = i; }
    else if (from >= 0 && (i - last) * STEP > (grace || 0)) { out.push([from, last]); from = -1; }
  }
  if (from >= 0) out.push([from, last]);
  return out;
}
const pathLen = (rec, a, b) => { let m = 0; for (let i = Math.max(1, a); i <= b; i++) m += Math.hypot(rec[i][X] - rec[i - 1][X], rec[i][Z] - rec[i - 1][Z]); return m; };

/* donuts: quarter turns. The plane round the pillar is cut into four quadrants; a full turn is four quadrant changes the same way, counted over sliding steps only, within one slide (gaps up to grace) inside reach */
export function donuts(rec, g, C, grace) {
  const D = g.park.donut, quad = i => { const dx = rec[i][X] - D.x, dz = rec[i][Z] - D.z; return dx >= 0 ? (dz >= 0 ? 0 : 3) : (dz >= 0 ? 1 : 2); };
  const inReach = i => Math.hypot(rec[i][X] - D.x, rec[i][Z] - D.z) <= D.reach;
  let best = 0;
  for (const [a, b] of runs(rec.length, i => C.sliding[i] && C.chain[i] && inReach(i), grace)) {
    let q = null, net = 0, most = 0;
    for (let i = a; i <= b; i++) {
      if (!C.chain[i] || !inReach(i)) break;
      if (!C.sliding[i]) continue;
      const k = quad(i);
      if (q !== null && k !== q) { const d = (k - q + 4) % 4; net += d === 1 ? 1 : d === 3 ? -1 : 0; }
      q = k; most = Math.max(most, Math.abs(net));
    }
    best = Math.max(best, Math.floor(most / 4));
  }
  return best;
}
/* the figure eight: the path is cut where it crosses the line half way between the pillars; each piece on one pillar's side that winds half a turn round that pillar is a loop (and each whole turn more round the same pillar another); links are loops in a row that swap pillars and turn the other way, in one chain */
export function eights(rec, g, C) {
  const E = g.park.eight, mid = (E.a.x + E.b.x) / 2, west = E.a.x < E.b.x ? E.a : E.b, east = west === E.a ? E.b : E.a;
  let best = 0, run = 0, last = null, piece = null;
  for (let i = 1; i < rec.length; i++) {
    if (!C.chain[i] || C.chain[i] !== C.chain[i - 1]) { piece = null; run = 0; last = null; continue; }
    const at = rec[i][X] < mid ? 'w' : 'e', P = at === 'w' ? west : east, ang = Math.atan2(rec[i][Z] - P.z, rec[i][X] - P.x);
    if (!piece || piece.at !== at) { piece = { at, wind: 0, loops: 0, ang }; continue; }
    let d = ang - piece.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    piece.wind += d; piece.ang = ang;
    const loops = Math.floor((Math.abs(piece.wind) + Math.PI) / (2 * Math.PI));
    if (loops > piece.loops && C.sliding[i]) {
      piece.loops = loops;
      const sense = piece.wind > 0 ? 1 : -1;
      run = last && last.at !== at && last.sense === -sense ? run + 1 : 1;
      last = { at, sense }; best = Math.max(best, run);
    }
  }
  return best;
}
/* the slalom: side changes. For every cone the car draws level with inside reach, which side it was on; the count is the longest run of cones in order, each on the other side from the one before, in one chain, with no cone knocked on the way */
export function slalom(rec, g, C, reach) {
  const S = g.park.slalom;
  let best = 0, run = 0, last = null, knocked = rec.length ? rec[0][CONES] : 0;
  for (let i = 1; i < rec.length; i++) {
    if (rec[i][CONES] !== knocked) { knocked = rec[i][CONES]; run = 0; last = null; }
    if (!C.chain[i] || C.chain[i] !== C.chain[i - 1]) { run = 0; last = null; continue; }
    for (let k = 0; k < S.n; k++) {
      const x = S.x[k];
      if ((rec[i - 1][X] - x) * (rec[i][X] - x) >= 0) continue;
      const lat = rec[i][Z] - S.z; if (Math.abs(lat) > reach) continue;
      const side = lat > 0 ? 1 : -1, dir = rec[i][X] > rec[i - 1][X] ? 1 : -1;
      /* knocked within the next half second: not passed */
      let hit = false; for (let j = i; j < Math.min(rec.length, i + 60); j++) if (rec[j][CONES] !== knocked) hit = true;
      if (hit) continue;
      run = last && k === last.k + dir && dir === last.dir && side === -last.side ? run + 1 : 1;
      last = { k, side, dir }; best = Math.max(best, run);
    }
  }
  return best;
}
/* the distance from a point to the long wall, from the wall's own outline as the physics has it */
export function wallOutline(g) { return g.walls.find(w => w.place === 'wall').points; }
function toOutline(P, x, z) {
  let best = Infinity;
  for (let i = 0; i + 1 < P.length; i++) { const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, l2 = dx * dx + dz * dz; let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (d < best) best = d; }
  return best;
}
/* the body's nearest corner or side to the outline: hl and hw the car's half length and width */
export function bodyGap(P, r, hl, hw) {
  const fx = -Math.sin(r[YAW]), fz = -Math.cos(r[YAW]), lx = -Math.cos(r[YAW]), lz = Math.sin(r[YAW]);
  let best = Infinity;
  for (const [f, l] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [0, hw], [0, -hw]]) best = Math.min(best, toOutline(P, r[X] + fx * f + lx * l, r[Z] + fz * f + lz * l));
  return best;
}
/* the wall ride: metres of path on sliding steps with the body within near of the outline, in one slide (gaps up to grace), ended by a touch near the wall */
export function wallRide(rec, g, C, near, grace, box) {
  const P = wallOutline(g), gap = rec.map(r => Math.hypot(r[X] - g.park.wall.x, r[Z] - g.park.wall.z) < g.park.wall.r + 12 ? bodyGap(P, r, box.hl, box.hw) : Infinity);
  let best = 0;
  for (const [a, b] of runs(rec.length, i => C.sliding[i] && C.chain[i], grace)) {
    let m = 0;
    for (let i = Math.max(1, a); i <= b; i++) {
      if (rec[i][TOUCH] && gap[i] < 1.3) { m = 0; continue; }
      if (C.sliding[i] && gap[i] <= near) m += Math.hypot(rec[i][X] - rec[i - 1][X], rec[i][Z] - rec[i - 1][Z]);
      if (m > best) best = m;
    }
  }
  return best;
}
/* the gates: the speed over the ground (from the positions either side of the crossing) at each crossing of a gate's line inside its gap, with the slide's angle there and whether a wall was touched in the quarter second before */
export function gatePasses(rec, g, C, angleMin, clean) {
  const out = [];
  for (let i = 1; i < rec.length; i++) for (const gt of g.park.gates) {
    const u0 = gt.along === 'z' ? rec[i - 1][Z] - gt.z : rec[i - 1][X] - gt.x, u1 = gt.along === 'z' ? rec[i][Z] - gt.z : rec[i][X] - gt.x, v = gt.along === 'z' ? rec[i][X] - gt.x : rec[i][Z] - gt.z;
    if ((u0 > 0) === (u1 > 0) || Math.abs(v) > gt.gap / 2) continue;
    let touched = false; for (let j = Math.max(0, i - Math.round(clean / STEP)); j <= i; j++) if (rec[j][TOUCH]) touched = true;
    const kmh = Math.hypot(rec[i][X] - rec[i - 1][X], rec[i][Z] - rec[i - 1][Z]) / STEP * 3.6, angle = Math.abs(rec[i][SLIP]) * DEG;
    out.push({ gate: gt.id, kmh, angle, sliding: !!C.sliding[i], touched, counts: !!C.sliding[i] && angle >= angleMin && !touched, chain: C.chain[i], i });
  }
  return out;
}
/* the long slide: the longest path over steps that slide one after another with no break at all */
export function longSlide(rec, C) { let best = 0; for (const [a, b] of runs(rec.length, i => C.sliding[i] === 1, 0)) best = Math.max(best, pathLen(rec, a + 1, b)); return best; }
/* the big chain: each chain's points by the scorer's published rule (angle times km/h times RATE per second, the multiplier a step every CHAIN_STEP seconds of sliding, doubled within PROX_DIST of a cone), rounded as it banks; a chain ended by a hard hit banks nothing; one still open at the end of the recording has not banked */
export function chainPoints(rec, g, C, S, box) {
  const out = []; let id = 0, pts = 0, t = 0;
  const near = r => { for (const k of g.cones) { const dx = k.x - r[X], dz = k.z - r[Z]; if (dx * dx + dz * dz > 64) continue; const fx = -Math.sin(r[YAW]), fz = -Math.cos(r[YAW]), f = dx * fx + dz * fz, l = dx * -fz + dz * fx; if (Math.hypot(f - Math.max(-box.hl, Math.min(box.hl, f)), l - Math.max(-box.hw, Math.min(box.hw, l))) - 0.3 <= S.PROX_DIST) return true; } return false; };
  for (let i = 0; i <= rec.length; i++) {
    const c = i < rec.length ? C.chain[i] : 0;
    if (c !== id) { if (id && i < rec.length && !rec[i][HARD]) out.push(Math.round(pts * Math.min(S.CHAIN_MAX, 1 + Math.floor(t / S.CHAIN_STEP)))); id = c; pts = 0; t = 0; }
    if (c && C.sliding[i]) { t += STEP; pts += Math.abs(rec[i][SLIP]) * DEG * rec[i][V] * 3.6 * S.RATE * STEP * (near(rec[i]) ? S.PROX_BONUS : 1); }
  }
  return out;
}
/* the tour: the most places touched by one chain */
export function tour(rec, g, C, K, box) {
  const P = wallOutline(g), G = g.park; let best = 0, id = 0, seen = new Set();
  for (let i = 1; i < rec.length; i++) {
    if (C.chain[i] !== id) { id = C.chain[i]; seen = new Set(); }
    if (!id) continue;
    const r = rec[i];
    if (C.sliding[i]) {
      if (Math.hypot(r[X] - G.donut.x, r[Z] - G.donut.z) <= G.donut.tour) seen.add('donut');
      if (Math.hypot(r[X] - G.eight.a.x, r[Z] - G.eight.a.z) <= G.eight.tour || Math.hypot(r[X] - G.eight.b.x, r[Z] - G.eight.b.z) <= G.eight.tour) seen.add('eight');
      if (Math.abs(r[Z] - G.slalom.z) <= K.TOUR_SLALOM && r[X] >= G.slalom.x[0] - 5 && r[X] <= G.slalom.x[G.slalom.n - 1] + 5) seen.add('slalom');
      if (Math.hypot(r[X] - G.wall.x, r[Z] - G.wall.z) < G.wall.r + 14 && bodyGap(P, r, box.hl, box.hw) <= K.TOUR_WALL) seen.add('wall');
    }
    if (C.chain[i - 1] === id) for (const gt of G.gates) { const u0 = gt.along === 'z' ? rec[i - 1][Z] - gt.z : rec[i - 1][X] - gt.x, u1 = gt.along === 'z' ? r[Z] - gt.z : r[X] - gt.x, v = gt.along === 'z' ? r[X] - gt.x : r[Z] - gt.z; if ((u0 > 0) !== (u1 > 0) && Math.abs(v) <= gt.gap / 2) seen.add('gate-' + gt.id); }
    best = Math.max(best, seen.size);
  }
  return best;
}
