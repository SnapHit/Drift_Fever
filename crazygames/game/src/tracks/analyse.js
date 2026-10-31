/* WHAT A TRACK IS, MEASURED. Reads only the data a track hands the game
   (its samples, walls, clips, start and finish), never the generator's
   plan, so it can judge a hand made or a hand broken track as easily as
   a generated one. The generator accepts a course only if
   validateTrack passes it, and the probes in test/tracks/ use the same
   functions, with known answers that must fail.

   Deterministic like the generator: + - * /, Math.sqrt, Math.round and
   dmath.js only, because its verdicts decide which course a seed gives. */
import { dsin, dcos, wrapAngle } from './dmath.js';
import { TRACKS } from './generate.js';

const DEG = Math.PI / 180;
const G = 9.81;

/* ---------------------------------------------------------- curvature */

/* Signed curvature at every sample, 1/m, positive turning left, from the
   change in heading across the two neighbours. */
export function curvatureOf(track) {
  const C = track.centre, n = C.length, closed = track.kind === 'circuit';
  const k = new Array(n);
  for (let i = 0; i < n; i++) {
    let a = i - 1, b = i + 1, span = 4;
    if (closed) { a = (a + n) % n; b = b % n; }
    else { if (a < 0) { a = 0; span = 2; } if (b >= n) { b = n - 1; span = 2; } }
    k[i] = wrapAngle(C[b].heading - C[a].heading) / span;
  }
  return k;
}

/* Corners: maximal runs of samples turning one way at least as tightly as
   STRAIGHT_RADIUS. Each with its tightest radius and its turn. */
export function cornersOf(track, kappa) {
  const k = kappa || curvatureOf(track);
  const n = k.length, closed = track.kind === 'circuit';
  const K = 1 / TRACKS.STRAIGHT_RADIUS;
  const sign = i => k[i] >= K ? 1 : k[i] <= -K ? -1 : 0;
  const runs = [];
  let cur = null;
  for (let i = 0; i < n; i++) {
    const s = sign(i);
    if (s !== 0 && cur && cur.dir === s && cur.to === i - 1) { cur.to = i; continue; }
    if (s !== 0) { cur = { dir: s, from: i, to: i }; runs.push(cur); } else cur = null;
  }
  if (closed && runs.length > 1) {
    const f = runs[0], l = runs[runs.length - 1];
    if (f.from === 0 && l.to === n - 1 && f.dir === l.dir) { f.from = l.from - n; runs.pop(); }
  }
  return runs.map(r => {
    let kmax = 0, turn = 0;
    for (let i = r.from; i <= r.to; i++) { const v = k[((i % n) + n) % n]; if (Math.abs(v) > kmax) kmax = Math.abs(v); turn += v * TRACKS.SAMPLE; }
    return { from: r.from * TRACKS.SAMPLE, to: r.to * TRACKS.SAMPLE, dir: r.dir, radius: 1 / kmax, angle: turn / DEG, length: (r.to - r.from + 1) * TRACKS.SAMPLE };
  });
}

/* ---------------------------------------------------- drift character */

export function characterOf(track) {
  const k = curvatureOf(track);
  const corners = cornersOf(track, k);
  const n = k.length, closed = track.kind === 'circuit';
  const K = 1 / TRACKS.STRAIGHT_RADIUS;
  let inCorner = 0;
  for (let i = 0; i < n; i++) if (Math.abs(k[i]) >= K) inCorner++;
  /* the longest run of straight samples, round the join on a circuit */
  let longest = 0, run = 0;
  const m = closed ? 2 * n : n;
  for (let t = 0; t < m; t++) {
    if (Math.abs(k[t % n]) < K) { run++; if (run > longest) longest = run; } else run = 0;
  }
  if (longest > n) longest = n;
  let changes = 0;
  for (let i = 1; i < corners.length; i++) if (corners[i].dir !== corners[i - 1].dir) changes++;
  if (closed && corners.length > 1 && corners[0].dir !== corners[corners.length - 1].dir) changes++;
  let minR = Infinity, maxR = 0, hairpins = 0, wSum = 0;
  for (const c of corners) { if (c.radius < minR) minR = c.radius; if (c.radius > maxR) maxR = c.radius; if (Math.abs(c.angle) >= 130 && c.radius <= 22) hairpins++; }
  for (const c of track.centre) wSum += c.width;
  return {
    length: track.length,
    cornerShare: inCorner / n,
    directionChanges: changes,
    longestStraight: longest * TRACKS.SAMPLE,
    corners: corners.length,
    hairpins,
    minRadius: minR, maxCornerRadius: maxR,
    meanWidth: wSum / n,
    clips: track.clips.length,
    cornerList: corners,
  };
}

/* An estimate, 0 easy to 1 hard, from how tight, how narrow and how busy
   the course is. */
export function difficultyOf(track) {
  const ch = characterOf(track);
  let tight = 0, wsum = 0;
  for (const c of ch.cornerList) { const w = Math.abs(c.angle); tight += w * clamp01((60 - c.radius) / 45); wsum += w; }
  tight = wsum > 0 ? tight / wsum : 0;
  const narrow = clamp01((15.5 - ch.meanWidth) / 4.5);
  const busy = clamp01(ch.directionChanges / (ch.length / 100) / 1.2);
  const straights = clamp01(1 - ch.longestStraight / TRACKS.STRAIGHT_MAX);
  return Math.round((0.45 * tight + 0.25 * narrow + 0.2 * busy + 0.1 * straights) * 100) / 100;
}
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* -------------------------------------------------------- geometry */

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = px - (ax + dx * t), ez = pz - (az + dz * t);
  return Math.sqrt(ex * ex + ez * ez);
}
const orient = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
const onSeg = (ax, az, bx, bz, cx, cz) => Math.min(ax, bx) - 1e-9 <= cx && cx <= Math.max(ax, bx) + 1e-9 && Math.min(az, bz) - 1e-9 <= cz && cz <= Math.max(az, bz) + 1e-9;
function segsCross(a, b) {
  const o1 = orient(a.ax, a.az, a.bx, a.bz, b.ax, b.az), o2 = orient(a.ax, a.az, a.bx, a.bz, b.bx, b.bz);
  const o3 = orient(b.ax, b.az, b.bx, b.bz, a.ax, a.az), o4 = orient(b.ax, b.az, b.bx, b.bz, a.bx, a.bz);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  if (o1 === 0 && onSeg(a.ax, a.az, a.bx, a.bz, b.ax, b.az)) return true;
  if (o2 === 0 && onSeg(a.ax, a.az, a.bx, a.bz, b.bx, b.bz)) return true;
  if (o3 === 0 && onSeg(b.ax, b.az, b.bx, b.bz, a.ax, a.az)) return true;
  if (o4 === 0 && onSeg(b.ax, b.az, b.bx, b.bz, a.bx, a.bz)) return true;
  return false;
}
const sameP = (x1, z1, x2, z2) => Math.abs(x1 - x2) < 1e-6 && Math.abs(z1 - z2) < 1e-6;

/* Every wall segment, with its wall, index and arc position, in a grid. */
function segmentGrid(track) {
  const segs = [];
  track.walls.forEach((w, wi) => {
    const p = w.points;
    let cum = 0;
    for (let i = 0; i + 1 < p.length; i++) {
      const dx = p[i + 1].x - p[i].x, dz = p[i + 1].z - p[i].z, len = Math.sqrt(dx * dx + dz * dz);
      segs.push({ ax: p[i].x, az: p[i].z, bx: p[i + 1].x, bz: p[i + 1].z, wall: wi, i, cap: !!w.cap, side: w.side, arc0: cum, arc1: cum + len, total: 0 });
      cum += len;
    }
    for (const s of segs) if (s.wall === wi) s.total = cum;
  });
  const CELL = 8;
  let minX = Infinity, minZ = Infinity;
  for (const s of segs) { minX = Math.min(minX, s.ax, s.bx); minZ = Math.min(minZ, s.az, s.bz); }
  minX -= 20; minZ -= 20;
  const map = new Map();
  const key = (cx, cz) => cx * 100003 + cz;
  segs.forEach((s, si) => {
    const x0 = Math.floor((Math.min(s.ax, s.bx) - minX) / CELL), x1 = Math.floor((Math.max(s.ax, s.bx) - minX) / CELL);
    const z0 = Math.floor((Math.min(s.az, s.bz) - minZ) / CELL), z1 = Math.floor((Math.max(s.az, s.bz) - minZ) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const k = key(cx, cz); let l = map.get(k); if (!l) { l = []; map.set(k, l); } l.push(si); }
  });
  const stamp = new Int32Array(segs.length).fill(-1);
  let q = 0;
  function near(x, z, r, fn) {
    q++;
    const x0 = Math.floor((x - r - minX) / CELL), x1 = Math.floor((x + r - minX) / CELL);
    const z0 = Math.floor((z - r - minZ) / CELL), z1 = Math.floor((z + r - minZ) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const l = map.get(key(cx, cz));
      if (!l) continue;
      for (const si of l) { if (stamp[si] === q) continue; stamp[si] = q; fn(segs[si], si); }
    }
  }
  return { segs, near };
}

/* -------------------------------------------------------- validation */

/* Every check the brief asks for, and the contract the physics relies
   on. Returns { ok, failed: [names], checks: { name: { ok, ...worst } } }. */
export function validateTrack(track, target) {
  const T = TRACKS;
  const C = track.centre, n = C.length, closed = track.kind === 'circuit';
  const checks = {};
  const put = (name, ok, info) => { checks[name] = Object.assign({ ok }, info); };

  /* samples every 2 m, headings that agree with the positions */
  {
    let lo = Infinity, hi = 0, worstHeading = 0;
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = C[i], b = C[(i + 1) % n];
      const d = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z));
      if (d < lo) lo = d; if (d > hi) hi = d;
    }
    for (let i = 0; i < n; i++) {
      let a = i - 1, b = i + 1;
      if (closed) { a = (a + n) % n; b %= n; } else { if (a < 0) a = 0; if (b >= n) b = n - 1; }
      const dx = C[b].x - C[a].x, dz = C[b].z - C[a].z, l = Math.sqrt(dx * dx + dz * dz);
      const fx = -dsin(C[i].heading), fz = -dcos(C[i].heading);
      const dot = (dx * fx + dz * fz) / l, cr = Math.abs(dx * fz - dz * fx) / l;
      const e = dot < 0 ? 1 : cr;
      if (e > worstHeading) worstHeading = e;
    }
    put('spacing', lo >= 1.99 && hi <= 2.001 && worstHeading < 0.06 && n >= 3, { minStep: lo, maxStep: hi, worstHeadingSin: worstHeading });
  }

  /* the length inside the target */
  if (target) put('length', track.length >= target.min - 1e-9 && track.length <= target.max + 1e-9, { length: track.length, min: target.min, max: target.max });

  /* the width inside the stated range */
  {
    let lo = Infinity, hi = 0;
    for (const c of C) { if (c.width < lo) lo = c.width; if (c.width > hi) hi = c.width; }
    put('width', lo >= T.WIDTH[0] && hi <= T.WIDTH[1], { min: lo, max: hi });
  }

  /* every corner's tightest radius inside the stated range */
  {
    const corners = cornersOf(track);
    let lo = Infinity, hi = 0, bad = 0;
    for (const c of corners) { if (c.radius < lo) lo = c.radius; if (c.radius > hi) hi = c.radius; if (c.radius < T.RADIUS[0] || c.radius > T.RADIUS[1]) bad++; }
    put('radius', bad === 0, { corners: corners.length, outside: bad, tightest: lo, widest: hi });
  }

  const grid = segmentGrid(track);
  const { segs } = grid;

  /* no self-overlap: no two wall segments cross, and the barriers of two
     different parts of the track keep GAP apart */
  {
    let crossings = 0, worstGap = Infinity, gapBreaks = 0;
    segs.forEach((a, ai) => {
      const r = Math.max(Math.abs(a.bx - a.ax), Math.abs(a.bz - a.az));
      grid.near((a.ax + a.bx) / 2, (a.az + a.bz) / 2, r, (b, bi) => {
        if (bi <= ai) return;
        if (sameP(a.ax, a.az, b.ax, b.az) || sameP(a.ax, a.az, b.bx, b.bz) || sameP(a.bx, a.bz, b.ax, b.az) || sameP(a.bx, a.bz, b.bx, b.bz)) return;
        if (segsCross(a, b)) crossings++;
      });
    });
    for (let wi = 0; wi < 2 && wi < track.walls.length; wi++) {
      const w = track.walls[wi], p = w.points;
      let cum = 0;
      for (let i = 0; i < p.length; i++) {
        if (i > 0) { const dx = p[i].x - p[i - 1].x, dz = p[i].z - p[i - 1].z; cum += Math.sqrt(dx * dx + dz * dz); }
        const arc = cum;
        grid.near(p[i].x, p[i].z, T.GAP, s => {
          if (s.cap) return;
          if (s.wall === wi) {
            let sep = Math.min(Math.abs(arc - s.arc0), Math.abs(arc - s.arc1));
            if (closed) sep = Math.min(sep, s.total - sep);
            if (arc >= s.arc0 && arc <= s.arc1) sep = 0;
            if (sep <= 3 * T.GAP) return;
          }
          const d = segDist(p[i].x, p[i].z, s.ax, s.az, s.bx, s.bz);
          if (d < worstGap) worstGap = d;
          if (d < T.GAP) gapBreaks++;
        });
      }
    }
    put('overlap', crossings === 0 && gapBreaks === 0, { crossings, gapBreaks, closestOtherBarrier: worstGap });
  }

  /* no wall closer than the drivable width: from every centre sample, no
     wall segment (its own or any other part's) inside half the width */
  {
    let worst = Infinity, at = -1, breaks = 0;
    for (let i = 0; i < n; i++) {
      const c = C[i], hw = c.width / 2;
      let best = Infinity;
      grid.near(c.x, c.z, hw + 0.5, s => { if (s.cap) return; const d = segDist(c.x, c.z, s.ax, s.az, s.bx, s.bz); if (d < best) best = d; });
      const margin = (best === Infinity ? hw + 0.5 : best) - hw;
      if (margin < worst) { worst = margin; at = i * T.SAMPLE; }
      if (margin < -0.1) breaks++;
    }
    put('clearance', breaks === 0, { worstMargin: worst, at, breaks });
  }

  /* gentle enough that a car never leaves the ground */
  {
    let grade = 0, crest = 0, bank = 0;
    for (let i = 0; i < n; i++) {
      const g = (j) => C[closed ? ((j % n) + n) % n : Math.max(0, Math.min(n - 1, j))].y;
      if (closed || (i >= 1 && i < n - 1)) { const v = Math.abs(g(i + 1) - g(i - 1)) / 4; if (v > grade) grade = v; }
      if (closed || (i >= 2 && i < n - 2)) { const v = -(g(i + 2) - 2 * g(i) + g(i - 2)) / 16; if (v > crest) crest = v; }
      if (Math.abs(C[i].bank) > bank) bank = Math.abs(C[i].bank);
    }
    const lift = T.TOP_SPEED * T.TOP_SPEED * crest / G;
    put('elevation', grade <= T.GRADE_MAX && crest <= T.CREST_K_MAX && bank <= T.BANK_MAX * DEG + 1e-6, { maxGrade: grade, maxCrestCurvature: crest, liftAtTopSpeed: lift, maxBankDeg: bank / DEG });
  }

  /* the contract world.js and the scene rely on */
  {
    const problems = [];
    const L = track.walls[0], R = track.walls[1];
    if (!L || L.side !== 'left' || !R || R.side !== 'right') problems.push('walls[0] left and walls[1] right');
    const want = closed ? n + 1 : n;
    if (L && L.points.length !== want) problems.push('left wall has ' + L.points.length + ' points, not ' + want);
    if (R && R.points.length !== want) problems.push('right wall has ' + R.points.length + ' points, not ' + want);
    const setback = { left: new Array(n).fill(0), right: new Array(n).fill(0) };
    let worstAlign = 0;
    for (const [w, sgn] of [[L, 1], [R, -1]]) {
      if (!w) continue;
      for (let i = 0; i < Math.min(n, w.points.length); i++) {
        const c = C[i], p = w.points[i];
        const lx = -dcos(c.heading), lz = dsin(c.heading), fx = -dsin(c.heading), fz = -dcos(c.heading);
        const lat = ((p.x - c.x) * lx + (p.z - c.z) * lz) * sgn, lon = (p.x - c.x) * fx + (p.z - c.z) * fz;
        const sb = lat - c.width / 2;
        setback[w.side][i] = sb;
        const e = Math.max(Math.abs(lon), sb < 0 ? -sb : 0, sb > T.RUNOFF ? sb - T.RUNOFF : 0);
        if (e > worstAlign) worstAlign = e;
      }
      if (closed && w.points.length === n + 1 && !sameP(w.points[0].x, w.points[0].z, w.points[n].x, w.points[n].z)) problems.push(w.side + ' wall not closed');
    }
    if (worstAlign > 0.01) problems.push('a wall point is not beside its sample: ' + worstAlign.toFixed(3) + ' m');
    let clipSetback = 0;
    for (const c of track.clips) {
      if (!(c.from < c.to) || c.from < 0 || c.to > track.length) problems.push('clip ' + c.from + ' to ' + c.to + ' out of range');
      if (c.side !== 'left' && c.side !== 'right') problems.push('clip side ' + c.side);
      if (c.kind !== 'inner' && c.kind !== 'outer') problems.push('clip kind ' + c.kind);
      for (let i = Math.ceil(c.from / T.SAMPLE); i <= Math.floor(c.to / T.SAMPLE) && i < n; i++) clipSetback = Math.max(clipSetback, setback[c.side][i] || 0);
      /* an inner clip is on the inside of the turn there, an outer on the outside */
      const k = curvatureOf(track)[Math.round((c.from + c.to) / 2 / T.SAMPLE)];
      const inside = k > 0 ? 'left' : 'right';
      if ((c.kind === 'inner') !== (c.side === inside)) problems.push('clip at ' + c.from + ' judges the wrong wall');
    }
    if (clipSetback > 0.01) problems.push('run-off inside a clip zone: ' + clipSetback.toFixed(2) + ' m');
    const s = track.start, si = Math.round(s.along / T.SAMPLE);
    if (!C[si] || Math.abs(C[si].x - s.x) > 0.01 || Math.abs(C[si].z - s.z) > 0.01 || Math.abs(wrapAngle(s.yaw - C[si].heading)) > 1e-6) problems.push('start is not on the centre line facing along it');
    const end = closed ? track.length : track.finish ? track.finish.along : -1;
    if (!closed && !track.finish) problems.push('a sprint needs a finish');
    let prev = track.startLine;
    for (const cp of track.checkpoints) { if (!(cp > prev) || !(cp < end)) problems.push('checkpoint ' + cp + ' out of order'); prev = cp; }
    if (!closed && track.walls.filter(w => w.cap).length !== 2) problems.push('a sprint needs two end caps');
    put('contract', problems.length === 0, { problems });
  }

  const failed = Object.keys(checks).filter(k => !checks[k].ok);
  return { ok: failed.length === 0, failed, checks };
}
