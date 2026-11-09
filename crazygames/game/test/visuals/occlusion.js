/* NOTHING OCCLUDES THE ROAD AHEAD, VISUALS.md "Measure" 2, in Node with
   no browser: the scenery and the terrain are plain data (../../src/env/
   terrain.js and scenery.js), so the same placement the scene draws is
   checked here over many generated tracks and every theme.

   node game/test/visuals/occlusion.js [--seeds N] [--quick] [--career]

   --career checks the 24 career tracks instead, as the game asks for
   them (briefs/CHAPTERS.md), and writes review/chapters/occlusion.json.

   Three checks, each over every track and theme:
   a. Inside the barriers: no prop's footprint (a circle's rim, or a
      box's corners) reaches inside the barrier line, read from the
      track's own wall points at the nearest centre sample. Reported as
      the least clearance over every instance.
   b. The terrain never rises onto the road: at every centre sample,
      across the road and two metres beyond the edge, the ground is no
      higher than just under the road's own height there (tilted by a
      bank; under a bridge and beside a cutting it is lower, as it should
      be). The tracks are generated as the game asks for them, banked and
      with crossovers.
   c. Sight lines: from the chase camera's position at every 10 m along
      the track (TUNE.CAMERA: behind and above the car, on the road's
      heading), lines to the road's centre every 4 m ahead to 60 m. A
      line is blocked when it passes through a prop's volume (a
      vertical cylinder or box of the kind's footprint and height) or
      under the terrain. Reported as the share blocked and the nearest
      blocked distance; the budget is in BUDGET below.
   Known answers: a pine planted on the road's centre line is caught by
   a and by c; the terrain lifted under the road is caught by b. */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateTrack } from '../../src/tracks/generate.js';
import { buildTerrain, TERRAIN } from '../../src/env/terrain.js';
import { placeScenery, flatten, footprintPoints, PROP_DIMS } from '../../src/env/scenery.js';
import { THEMES, THEME_NAMES } from '../../src/env/themes.js';
import { TUNE } from '../../src/tune.js';
import { CAREER, careerSpec } from '../../src/loop/modes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const careerOnly = args.includes('--career');
const seedsN = args.includes('--seeds') ? +args[args.indexOf('--seeds') + 1] : (quick ? 4 : 24);

export const BUDGET = {
  BLOCKED_SHARE:   0.02,   // at most this share of all sight lines may be blocked
  CLEAR_AHEAD:     30,     // m: no sight line this short may be blocked
  ROAD_FLAT:       0.06,   // m: the ground under and beside the road is within this of the flat level
  STEP_ALONG:      10,     // m between camera positions
  LOOK_STEP:       4,      // m between road points looked at
  LOOK_TO:         60,     // m ahead
  LOOK_UP:         0.7,    // m above the road the sight line aims (TUNE.CAMERA.LOOK_UP)
};

/* The chase camera's position for a centre sample: behind along the
   heading and above, as camera/chase.js places it in landscape. */
function cameraAt(c, speed) {
  const C = TUNE.CAMERA;
  const dist = C.DISTANCE + C.DISTANCE_SPEED * speed;
  const fx = -Math.sin(c.heading), fz = -Math.cos(c.heading);
  return { x: c.x - fx * dist, y: (c.y || 0) + C.HEIGHT, z: c.z - fz * dist };
}

/* Does the segment a to b pass through the vertical volume of an
   instance (a cylinder of radius r and height h, or a box w by d turned
   by ry) standing at (x, y, z)? */
function hitsInstance(a, b, it) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const box = it.box;
  if (box) {
    // a box: transform into the box's frame (undo its turn about y) and slab test in x, y, z
    const c = Math.cos(it.ry), s = Math.sin(it.ry);
    const lx = (a.x - it.x) * c - (a.z - it.z) * s, lz = (a.x - it.x) * s + (a.z - it.z) * c;
    const ldx = dx * c - dz * s, ldz = dx * s + dz * c;
    const hw = box[0] / 2, hd = box[1] / 2, hh = it.h;
    let t0 = 0, t1 = 1;
    const slab = (p, d, lo, hi) => { if (Math.abs(d) < 1e-9) return p >= lo && p <= hi; let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); return t0 <= t1; };
    return slab(lx, ldx, -hw, hw) && slab(a.y - it.y, dy, 0, hh) && slab(lz, ldz, -hd, hd);
  }
  // a cylinder: nearest approach in the plane, then the height at that point
  const ex = it.x - a.x, ez = it.z - a.z;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? (ex * dx + ez * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + dx * t, pz = a.z + dz * t, py = a.y + dy * t;
  const d = Math.hypot(px - it.x, pz - it.z);
  if (d > it.r) return false;
  // the line crosses the disc: is it between the ground and the top there
  const tIn = Math.max(0, t - it.r / Math.sqrt(len2 || 1)), tOut = Math.min(1, t + it.r / Math.sqrt(len2 || 1));
  const yIn = a.y + dy * tIn, yOut = a.y + dy * tOut;
  return Math.min(yIn, yOut, py) <= it.y + it.h && Math.max(yIn, yOut, py) >= it.y;
}
function underTerrain(a, b, terrain) {
  const n = 12;
  for (let i = 1; i < n; i++) { const t = i / n; const y = a.y + (b.y - a.y) * t; if (terrain.heightAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) > y) return true; }
  return false;
}

/* Every check over one track and theme; `inject` adds instances for the known answer. */
export function checkTrack(track, theme, options) {
  const o = options || {};
  const terrain = buildTerrain(track, theme, { cell: 8 });
  const placed = placeScenery(track, theme, terrain, { share: 1 });
  const list = flatten(placed);
  if (o.inject) list.push(...o.inject);
  const C = track.centre, n = C.length;
  /* a. inside the barriers */
  let worstClear = Infinity, worstKind = null, inside = 0;
  const keep = {}; for (const p of theme.props) keep[p.kind] = p.keepOut;
  for (const it of list) {
    // from the footprint's edge to the wall line: a circle's rim, or a box's nearest corner
    let d = Infinity;
    for (const p of footprintPoints(it)) { const e = terrain.wallClearance(p.x, p.z) - p.r; if (e < d) d = e; }
    if (d < 0) inside++;
    if (d < worstClear) { worstClear = d; worstKind = it.kind; }
  }
  /* b. the road is flat, and the drawn ground (the grid's own triangles,
     which cut corners a banked road does not) stays under it too */
  const P = terrain.positions, cols = terrain.cols, rows = terrain.rows, cell = terrain.cell, ex = terrain.extent;
  const drawnAt = (x, z) => {
    const fx = (x - ex.minX) / cell, fz = (z - ex.minZ) / cell;
    const c = Math.max(0, Math.min(cols - 2, Math.floor(fx))), r = Math.max(0, Math.min(rows - 2, Math.floor(fz)));
    const tx = fx - c, tz = fz - r, h = (cc, rr) => P[((r + rr) * cols + c + cc) * 3 + 1];
    // the triangles a, cc, bb and bb, cc, dd: split along the diagonal from (c + 1, r) to (c, r + 1)
    return tx + tz <= 1 ? h(0, 0) + (h(1, 0) - h(0, 0)) * tx + (h(0, 1) - h(0, 0)) * tz
                        : h(1, 1) + (h(0, 1) - h(1, 1)) * (1 - tx) + (h(1, 0) - h(1, 1)) * (1 - tz);
  };
  let worstRise = 0;
  for (let idx = 0; idx < C.length; idx++) {
    const c = C[idx];
    const lx = -Math.cos(c.heading), lz = Math.sin(c.heading);
    for (let u = -c.width / 2 - 2; u <= c.width / 2 + 2; u += 2) {
      const h = (o.terrainLift || 0) + terrain.heightAt(c.x + lx * u, c.z + lz * u);
      /* the road's height there, as mesh.js lays it: tilted by the bank, level beyond the edge */
      const road = (c.y || 0) - Math.max(-c.width / 2, Math.min(c.width / 2, u)) * Math.tan(c.bank || 0);
      const rise = h - road - TERRAIN.BELOW;   // above the road is the failure; under a bridge or beside a cutting the ground is lower, which is right
      if (rise > worstRise) worstRise = rise;
      /* the drawn ground against the road itself; beyond the edge of the
         road through a cutting the ground rises to the cutting's walls, as it should */
      const inCut = (track.bridges || []).some(b => b.cut && idx * 2 >= b.cut[0] && idx * 2 <= b.cut[1]);
      const drawn = (o.terrainLift || 0) + drawnAt(c.x + lx * u, c.z + lz * u) - road;
      if (!(inCut && Math.abs(u) > c.width / 2) && drawn > worstRise) worstRise = drawn;
    }
  }
  /* c. sight lines */
  const closed = track.kind === 'circuit';
  let lines = 0, blocked = 0, blockedNear = 0, nearest = Infinity, byTerrain = 0, byProp = 0;
  const blockers = {};
  // a coarse spatial bucket of instances so each line tests a few hundred, not thousands
  const B = 40, bx = x => Math.floor((x - terrain.extent.minX) / B), bz = z => Math.floor((z - terrain.extent.minZ) / B);
  const buckets = new Map();
  for (const it of list) { const k = bx(it.x) + ',' + bz(it.z); (buckets.get(k) || buckets.set(k, []).get(k)).push(it); }
  const near = (a, b) => { const out = []; const x0 = Math.min(bx(a.x), bx(b.x)) - 1, x1 = Math.max(bx(a.x), bx(b.x)) + 1, z0 = Math.min(bz(a.z), bz(b.z)) - 1, z1 = Math.max(bz(a.z), bz(b.z)) + 1; for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const l = buckets.get(x + ',' + z); if (l) out.push(...l); } return out; };
  for (let s = 0; s < track.length - (closed ? 0 : BUDGET.LOOK_TO + 20); s += BUDGET.STEP_ALONG) {
    const i = Math.round(s / 2) % n;
    const cam = cameraAt(C[i], 20);
    for (let a = BUDGET.LOOK_STEP; a <= BUDGET.LOOK_TO; a += BUDGET.LOOK_STEP) {
      const j = (i + Math.round(a / 2)) % n;
      if (!closed && j < i) break;
      const to = { x: C[j].x, y: (C[j].y || 0) + BUDGET.LOOK_UP, z: C[j].z };
      lines++;
      let hit = null;
      for (const it of near(cam, to)) if (hitsInstance(cam, to, it)) { hit = it.kind; break; }
      if (!hit && underTerrain(cam, to, terrain)) hit = 'terrain';
      if (hit) {
        blocked++; if (a <= BUDGET.CLEAR_AHEAD) blockedNear++; if (a < nearest) nearest = a;
        if (hit === 'terrain') byTerrain++; else byProp++;
        blockers[hit] = (blockers[hit] || 0) + 1;
      }
    }
  }
  return { instances: list.length, inside, worstClear: +worstClear.toFixed(2), worstKind, worstRise: +worstRise.toFixed(3), lines, blocked, blockedNear, nearest: isFinite(nearest) ? nearest : null, byTerrain, byProp, blockers };
}

/* run as a script; imported (by the chapters' seed search, for checkTrack) it does nothing */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const t0 = Date.now();
const seeds = [];
if (careerOnly) for (let i = 0; i < CAREER.length; i++) { const c = careerSpec(i); seeds.push([c.seed, c.kind, c.length, c.difficulty, c.options]); }
else for (let k = 0; k < seedsN; k++) seeds.push([2000 + k * 7, k % 2 ? 'sprint' : 'circuit']);
/* the tracks as the game asks for them, banked and with crossovers; four
   figure eights for certain: the career's crossover and three more */
const extra = [[1327, 'circuit', 820, 0.3], [3007, 'circuit', 1000], [3016, 'circuit', 1000], [3029, 'circuit', 1000]];
if (!careerOnly) for (const e of extra) seeds.push(e);
const rows = [];
let worst = { clear: Infinity, rise: 0, blockedShare: 0, blockedNear: 0, inside: 0 };
let totalLines = 0, totalBlocked = 0;
let crossings = 0;
for (const [seed, kind, length, difficulty, options] of seeds) {
  const track = generateTrack(seed, { kind, length, difficulty, ...(options || {}) });
  crossings += (track.bridges || []).length;
  for (const name of THEME_NAMES) {
    const r = checkTrack(track, THEMES[name]);
    rows.push({ seed, kind, theme: name, ...r });
    totalLines += r.lines; totalBlocked += r.blocked;
    if (r.worstClear < worst.clear) worst.clear = r.worstClear;
    if (r.worstRise > worst.rise) worst.rise = r.worstRise;
    if (r.blocked / r.lines > worst.blockedShare) worst.blockedShare = r.blocked / r.lines;
    worst.blockedNear += r.blockedNear; worst.inside += r.inside;
  }
}
/* known answers on the first track, forest */
const kaTrack = generateTrack(seeds[0][0], { kind: seeds[0][1] });
const mid = kaTrack.centre[Math.floor(kaTrack.centre.length / 2)];
const tree = { kind: 'pine', x: mid.x, y: 0, z: mid.z, r: PROP_DIMS.pine.r, h: PROP_DIMS.pine.h, ry: 0, s: 1, box: null };
const kaTree = checkTrack(kaTrack, THEMES.forest, { inject: [tree] });
const kaLift = checkTrack(kaTrack, THEMES.forest, { terrainLift: 1.5 });
const verdicts = [];
const verdict = (label, ok, detail) => { verdicts.push({ label, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + label + ': ' + detail); };
verdict('no prop footprint inside the barriers, over ' + rows.length + ' track and theme pairs', worst.inside === 0 && worst.clear >= 0, worst.inside + ' inside, least clearance ' + worst.clear.toFixed(2) + ' m');
verdict('the terrain never rises above the road, banked corners and ' + crossings + ' crossings included', worst.rise <= BUDGET.ROAD_FLAT, 'worst rise ' + worst.rise.toFixed(3) + ' m');
verdict('sight lines to the road ahead: none blocked within ' + BUDGET.CLEAR_AHEAD + ' m, at most ' + (BUDGET.BLOCKED_SHARE * 100) + '% blocked in all', worst.blockedNear === 0 && worst.blockedShare <= BUDGET.BLOCKED_SHARE, totalBlocked + ' of ' + totalLines + ' blocked (' + (100 * totalBlocked / totalLines).toFixed(2) + '%), worst track ' + (100 * worst.blockedShare).toFixed(2) + '%, blocked within ' + BUDGET.CLEAR_AHEAD + ' m: ' + worst.blockedNear);
verdict('known answer: a pine on the road is inside the barriers', kaTree.inside >= 1 && kaTree.worstClear < 0, 'inside ' + kaTree.inside + ', clearance ' + kaTree.worstClear + ' m (' + kaTree.worstKind + ')');
verdict('known answer: a pine on the road blocks sight lines', kaTree.blocked > 0 && kaTree.blockedNear > 0, kaTree.blocked + ' blocked, ' + kaTree.blockedNear + ' within ' + BUDGET.CLEAR_AHEAD + ' m, nearest ' + kaTree.nearest + ' m');
verdict('known answer: the terrain lifted a metre and a half under the road is caught', kaLift.worstRise > BUDGET.ROAD_FLAT, 'worst rise ' + kaLift.worstRise + ' m');
const out = { started: new Date(t0).toISOString(), seconds: +((Date.now() - t0) / 1000).toFixed(1), budget: BUDGET, seeds: seeds.length, themes: THEME_NAMES, summary: { pairs: rows.length, inside: worst.inside, leastClearance: worst.clear, worstRise: worst.rise, lines: totalLines, blocked: totalBlocked, blockedShare: +(totalBlocked / totalLines).toFixed(4), worstTrackBlockedShare: +worst.blockedShare.toFixed(4), blockedNear: worst.blockedNear }, knownAnswers: { treeOnRoad: kaTree, terrainLifted: { worstRise: kaLift.worstRise } }, verdicts, rows };
const dir = path.join(root, 'review', careerOnly ? 'chapters' : 'visuals');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'occlusion.json'), JSON.stringify(out, null, 1));
const failed = verdicts.filter(v => !v.ok).length;
console.log((failed ? failed + ' FAILED' : 'all passed') + ' in ' + out.seconds + ' s; wrote review/' + (careerOnly ? 'chapters' : 'visuals') + '/occlusion.json');
process.exit(failed ? 1 : 0);
}
