/* THE SECOND TRACK GENERATOR'S MEASUREMENTS, briefs/TRACKS-2.md
   "Measure", each with a known answer that must fail.

     B  busier: corners per kilometre, share of the length in corners,
        direction changes, the straights, before and after, 200 seeds per
        kind. Known answer: the old generator (read from the repository's
        history at the commit this work started from) must score lower.
     K  banking: the car's steady grip speed round a banked corner against
        the same corner flat, by about what the bank angle predicts, and
        a drift's settling speed on the bank. Known answers: with BANK.GRIP
        at 0 the banked speed is the flat one; with CRUISE_PER_DEG at 0
        the drift settles at the flat speed.
     X  crossovers: the share of circuits with one, and the scripted
        driver laps 200 generated crossover circuits with no respawn, no
        layer jump and no contact with the other layer's walls. Known
        answers: the nearest sample in x and z on every step (the old
        rule) must jump layers; the layer rule switched off must touch
        the other layer's walls.
     T  generation time and fallbacks, 200 seeds per kind, the default
        range and the three targets.

   node game/test/tracks/tracks2.js [--seeds 200] [--only B,K,X,T]
   Writes review/tracks-2/*.json and prints a summary. Exits non zero if
   a measurement fails or a known answer is not caught. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateTrack, trackFromElements, TRACKS } from '../../src/tracks/generate.js';
import { characterOf } from '../../src/tracks/analyse.js';
import { createWorld } from '../../src/physics/world.js';
import { createDriver } from '../../src/physics/driver.js';
import { STEP, createVehicle, stepVehicle } from '../../src/physics/vehicle.js';
import { TUNE } from '../../src/tune.js';
import { root, dist } from './lib.js';

const args = process.argv.slice(2);
const SEEDS = +(args.includes('--seeds') ? args[args.indexOf('--seeds') + 1] : 200);
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : ['B', 'K', 'X', 'T'];
const BEFORE = 'ad6cfc6';            // main when this brief started: the first generator, at the widths of review/fury
const reviewDir = path.join(root, 'review', 'tracks-2');
const KINDS = ['circuit', 'sprint'];
const diffOf = seed => ((seed - 1) % 11) / 10;
const summary = [];
let failures = 0;
function result(name, pass, text) { summary.push((pass ? 'PASS ' : 'FAIL ') + name + ': ' + text); if (!pass) failures++; }
function known(name, caught, text) { summary.push((caught ? 'CAUGHT ' : 'MISSED ') + name + ': ' + text); if (!caught) failures++; }
function writeJson(name, data) { fs.mkdirSync(reviewDir, { recursive: true }); fs.writeFileSync(path.join(reviewDir, name), JSON.stringify(data, null, 1)); }
const r2 = v => Math.round(v * 100) / 100;
const fmt = d => d.p50 + ' [' + d.p5 + ', ' + d.p95 + '], ' + d.min + ' to ' + d.max;

/* ========================================================= B busier */
async function busier() {
  const out = { seedsPerKind: SEEDS, before: BEFORE, kinds: {}, knownAnswer: {} };
  /* the old generator, from the history */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tracks-before-'));
  for (const f of ['generate.js', 'analyse.js', 'dmath.js']) {
    const src = execFileSync('git', ['show', BEFORE + ':crazygames/game/src/tracks/' + f], { cwd: root }).toString();
    fs.writeFileSync(path.join(tmp, f), src);
  }
  const old = await import(path.join(tmp, 'generate.js'));
  const fields = ['cornersPerKm', 'cornerShare', 'directionChangesPerKm', 'longestStraight', 'secondStraight', 'meanStraight', 'straights', 'corners', 'banked', 'crossings'];
  const lower = ['cornersPerKm', 'cornerShare', 'directionChangesPerKm'];   // the old must be lower on these
  const higher = ['secondStraight', 'meanStraight'];                        // and higher on these
  for (const kind of KINDS) {
    const rows = { before: [], after: [] };
    for (let s = 1; s <= SEEDS; s++) {
      const o = { kind, difficulty: diffOf(s) };
      rows.before.push(characterOf(old.generateTrack(s, o)));
      rows.after.push(characterOf(generateTrack(s, o)));
    }
    const k = { before: {}, after: {} };
    for (const side of ['before', 'after']) for (const f of fields) k[side][f] = dist(rows[side].map(r => r[f]));
    k.after.bankedCornerShare = r2(rows.after.reduce((a, r) => a + r.banked, 0) / rows.after.reduce((a, r) => a + r.corners, 0));
    k.after.tracksWithACrossover = rows.after.filter(r => r.crossings > 0).length;
    k.before.tracksWithACrossover = rows.before.filter(r => r.crossings > 0).length;
    const typeMix = {};
    for (let s = 1; s <= SEEDS; s++) for (const c of generateTrack(s, { kind, difficulty: diffOf(s) }).corners) typeMix[c.type] = (typeMix[c.type] || 0) + 1;
    k.after.designedCornerTypes = typeMix;
    out.kinds[kind] = k;
    const okLower = lower.every(f => k.before[f].p50 < k.after[f].p50), okHigher = higher.every(f => k.before[f].p50 > k.after[f].p50);
    result('B busier, ' + kind + 's: corners per km ' + k.before.cornersPerKm.p50 + ' -> ' + k.after.cornersPerKm.p50 + ', in corners ' + Math.round(k.before.cornerShare.p50 * 100) + '% -> ' + Math.round(k.after.cornerShare.p50 * 100) + '%, direction changes per km ' + k.before.directionChangesPerKm.p50 + ' -> ' + k.after.directionChangesPerKm.p50, true,
      'longest straight ' + k.before.longestStraight.p50 + ' -> ' + k.after.longestStraight.p50 + ' m, second ' + k.before.secondStraight.p50 + ' -> ' + k.after.secondStraight.p50 + ' m, mean straight ' + k.before.meanStraight.p50 + ' -> ' + k.after.meanStraight.p50 + ' m (medians); ' + k.after.bankedCornerShare * 100 + '% of corners banked, ' + k.after.tracksWithACrossover + ' of ' + SEEDS + ' with a crossover');
    known('B the old generator scores lower on busyness, ' + kind + 's', okLower && okHigher, 'lower on ' + lower.filter(f => k.before[f].p50 < k.after[f].p50).length + ' of ' + lower.length + ' busyness medians, higher on ' + higher.filter(f => k.before[f].p50 > k.after[f].p50).length + ' of ' + higher.length + ' straight medians');
    out.knownAnswer[kind] = { oldLowerOn: lower.filter(f => k.before[f].p50 < k.after[f].p50), oldHigherOn: higher.filter(f => k.before[f].p50 > k.after[f].p50), caught: okLower && okHigher };
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  writeJson('busier.json', out);
}

/* ======================================================== K banking */
/* A constant corner of radius R, banked by about bankDeg (the gentle
   bank by curvature adds a little; the data's own bank is what is
   reported and predicted from), between two straights. */
function cornerTrack(R, bankDeg) {
  const t = trackFromElements('sprint', [{ s: 60 }, { c: { type: 'sweeper', R, angle: 200, lt: 0, width: 14, bank: bankDeg } }, { s: 80 }], { crossover: false });
  const c = t.corners[0];
  let bank = 0;
  for (let i = Math.round(c.from / 2) + 6; i <= Math.round(c.to / 2) - 6; i++) bank = Math.max(bank, Math.abs(t.centre[i].bank));
  return { t, corner: c, bankRad: bank };
}
/* Can the car hold the corner's centre line at speed v on grip? The
   scripted driver steers (pure pursuit on the centre line) and the
   throttle holds v; the car is placed rolling at v where the corner
   begins. It holds if it stays inside 2.5 m of the centre line through
   the corner without touching a wall. */
function holds(track, corner, v, level) {
  const keep = TUNE.ASSIST.LEVEL;
  TUNE.ASSIST.LEVEL = level;
  const w = createWorld(track), d = createDriver(track, {});
  const i0 = Math.round(corner.from / 2) - 5, c0 = track.centre[i0];
  w.car.x = c0.x; w.car.z = c0.z; w.car.yaw = c0.heading; w.car.y = c0.y;
  w.car.wvx = -Math.sin(c0.heading) * v; w.car.wvz = -Math.cos(c0.heading) * v;
  w.locate(true);
  let maxLat = 0, hits = 0, minV = v, maxSlip = 0;
  for (let i = 0; i < Math.round(40 / STEP); i++) {
    const inp = d.input(w);
    const sp = w.car.speed;
    inp.throttle = sp < v ? 1 : 0; inp.brake = sp > v + 0.5 ? Math.min(1, (sp - v - 0.5) / 2) : 0; inp.handbrake = 0;
    w.stepWorld(inp);
    if (w.along >= corner.from + 10 && w.along <= corner.to - 10) { maxLat = Math.max(maxLat, Math.abs(w.lateral)); minV = Math.min(minV, w.car.speed); maxSlip = Math.max(maxSlip, Math.abs(w.car.slip)); }
    if (w.hit) hits++;
    if (w.respawned || w.along > corner.to - 8) break;
  }
  TUNE.ASSIST.LEVEL = keep;
  return { ok: maxLat <= 2.5 && hits === 0 && w.along > corner.to - 9, maxLat, hits, minV, maxSlipDeg: maxSlip * 180 / Math.PI };
}
function steadySpeed(track, corner, level) {
  let lo = 8, hi = 60;
  if (!holds(track, corner, lo, level).ok) return { v: 0 };
  for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (holds(track, corner, mid, level).ok) lo = mid; else hi = mid; }
  return { v: lo, at: holds(track, corner, lo, level) };
}
/* The speed a drift settles to on a bank towards its inside: the
   vehicle alone (as handling.js measures its patterns), rolling at 30
   m/s, a handbrake flick with full steer, then steer and throttle held
   for six seconds, on a road whose bank follows the car's own path (the
   road's left is the left of the direction of travel), which is what a
   banked corner is to the car. Reports the mean speed and slide angle
   over the last two seconds. */
function driftSettle(bankDeg) {
  const s = createVehicle(0, 0, 0);
  s.wvz = -30;
  const surf = { gx: 0, gz: 0, kv: 0, bank: -bankDeg * Math.PI / 180 };   // negative: the road falls to the right, the inside of a right hand slide
  const tb = Math.tan(surf.bank);
  let vSum = 0, aSum = 0, n = 0, minAngle = 999;
  const total = Math.round(6.4 / STEP);
  for (let i = 0; i < total; i++) {
    const psi = Math.atan2(-s.wvx, -s.wvz);
    const lx = -Math.cos(psi), lz = Math.sin(psi);
    surf.gx = -tb * lx; surf.gz = -tb * lz;
    s.surf = surf;
    stepVehicle(s, { steer: 1, throttle: 1, brake: 0, handbrake: i < 0.4 / STEP ? 1 : 0 }, STEP);
    if (i >= total - Math.round(2 / STEP)) { vSum += s.speed; const a = Math.abs(s.slip) * 180 / Math.PI; aSum += a; n++; if (a < minAngle) minAngle = a; }
  }
  return { meanKmh: r2(vSum / n * 3.6), meanAngle: r2(aSum / n), minAngle: r2(minAngle), held: minAngle > 20 };
}
function banking() {
  const G = 9.81, R = 60;
  const out = { radius: R, rows: [], knownAnswers: {} };
  const flat = cornerTrack(R, 0);
  for (const level of [0, 1]) {
    const f = steadySpeed(flat.t, flat.corner, level);
    const muEff = f.v * f.v / (R * G);
    const row = { assistLevel: level, flat: { bankDeg: r2(flat.bankRad * 180 / Math.PI), steadyMs: r2(f.v), steadyKmh: r2(f.v * 3.6), effectiveMu: r2(muEff), maxSlipDeg: r2(f.at.maxSlipDeg) }, banked: [] };
    for (const deg of [8, 12]) {
      const b = cornerTrack(R, deg);
      const phi = b.bankRad;
      const predicted = Math.sqrt(R * G * (Math.sin(phi) + muEff * Math.cos(phi)) / Math.max(0.05, Math.cos(phi) - muEff * Math.sin(phi)));
      const m = steadySpeed(b.t, b.corner, level);
      row.banked.push({ askedDeg: deg, bankDeg: r2(phi * 180 / Math.PI), steadyMs: r2(m.v), steadyKmh: r2(m.v * 3.6), predictedMs: r2(predicted), ratioMeasured: r2(m.v / f.v), ratioPredicted: r2(predicted / f.v), withinPct: r2(Math.abs(m.v - predicted) / predicted * 100), maxSlipDeg: r2(m.at.maxSlipDeg) });
    }
    out.rows.push(row);
    const worst = Math.max(...row.banked.map(b => b.withinPct));
    const faster = row.banked.every(b => b.steadyMs > f.v * 1.05);
    result('K banking, assist ' + level + ': steady grip speed round a ' + R + ' m corner', faster && worst <= 15, 'flat ' + row.flat.steadyKmh + ' km/h (mu ' + row.flat.effectiveMu + '); ' + row.banked.map(b => b.bankDeg + ' degrees: ' + b.steadyKmh + ' km/h, predicted ' + r2(b.predictedMs * 3.6) + ' (' + b.ratioMeasured + ' times flat, predicted ' + b.ratioPredicted + ', within ' + b.withinPct + '%)').join('; '));
  }
  /* known answer: bank grip off gives the flat number */
  {
    const keep = TUNE.BANK.GRIP;
    TUNE.BANK.GRIP = 0;
    const b = cornerTrack(R, 12);
    const f = steadySpeed(flat.t, flat.corner, 1), m = steadySpeed(b.t, b.corner, 1);
    TUNE.BANK.GRIP = keep;
    const same = Math.abs(m.v - f.v) / f.v < 0.03;
    out.knownAnswers.gripOff = { flatMs: r2(f.v), bankedMs: r2(m.v), same };
    known('K bank grip switched off: the banked corner gives the flat speed', same, 'flat ' + r2(f.v * 3.6) + ' km/h, banked ' + r2(m.v * 3.6) + ' km/h');
  }
  /* the drift's settling speed on the bank */
  {
    const fd = driftSettle(0), bd = driftSettle(12);
    const keep = TUNE.BANK.CRUISE_PER_DEG;
    TUNE.BANK.CRUISE_PER_DEG = 0;
    const b0 = driftSettle(12);
    TUNE.BANK.CRUISE_PER_DEG = keep;
    const asked = r2(TUNE.BANK.CRUISE_PER_DEG * 12 * 3.6);
    out.drift = { flat: fd, banked12: bd, askedMoreKmh: asked, knownAnswerCruiseOff: b0 };
    result('K a held drift settles faster on a 12 degree bank', fd.held && bd.held && bd.meanKmh > fd.meanKmh + asked * 0.7 && bd.meanKmh < fd.meanKmh + asked * 1.3, 'flat ' + fd.meanKmh + ' km/h at ' + fd.meanAngle + ' degrees, banked ' + bd.meanKmh + ' km/h at ' + bd.meanAngle + ' degrees (' + asked + ' km/h more asked by CRUISE_PER_DEG)');
    known('K CRUISE_PER_DEG at 0: the banked drift settles at the flat speed', b0.held && Math.abs(b0.meanKmh - fd.meanKmh) < asked * 0.3, 'banked ' + b0.meanKmh + ' km/h against flat ' + fd.meanKmh);
  }
  writeJson('banking.json', out);
}

/* ===================================================== X crossovers */
function lap(track, opts) {
  const w = createWorld(track, opts), d = createDriver(track, {});
  const n = track.centre.length;
  let last = w.along, laps = 0, jumps = 0, prev = w.centreIndex, respawns = 0, hits = 0, otherLayer = 0, layerChanges = 0, prevLayer = w.layer, onRamp = 0;
  let worstJump = 0;
  for (let i = 0; i < Math.round(240 / STEP); i++) {
    w.stepWorld(d.input(w));
    let di = Math.abs(w.centreIndex - prev); di = Math.min(di, n - di);
    if (di > 3 && !w.respawned) { jumps++; if (di > worstJump) worstJump = di; }
    prev = w.centreIndex;
    if (w.layer !== prevLayer) { layerChanges++; if (track.centre[w.centreIndex].part === 'ramp' || track.centre[prev].part === 'ramp' || (track.centre[(w.centreIndex + n - 1) % n].part === 'ramp') || (track.centre[(w.centreIndex + 1) % n].part === 'ramp')) onRamp++; }
    prevLayer = w.layer;
    if (w.respawned) respawns++;
    if (w.hit) { hits++; if (Math.abs(w.hit.wy - w.car.y) > TUNE.BANK.LAYER_HEIGHT) otherLayer++; }
    if (w.along < last - track.length / 2) laps++;
    last = w.along;
    if (laps >= 1) break;
  }
  return { lapped: laps >= 1, seconds: r2(w.time), jumps, worstJump, respawns, hits, otherLayerHits: otherLayer, layerChanges, layerChangesOnRamps: onRamp };
}
function crossovers() {
  const out = { share: {}, drives: null, knownAnswers: {} };
  /* the share, by length */
  for (const [label, length] of [['600 to 1200 m', undefined], ['about 600 m', 600], ['about 900 m', 900], ['about 1200 m', 1200]]) {
    let withOne = 0, angles = [];
    for (let s = 1; s <= SEEDS; s++) { const t = generateTrack(s, { kind: 'circuit', length, difficulty: diffOf(s) }); if (t.bridges.length) { withOne++; angles.push(t.bridges[0].angle); } }
    out.share[label] = { circuits: SEEDS, withACrossover: withOne, share: r2(withOne / SEEDS), crossingAngleDeg: angles.length ? dist(angles) : null };
  }
  result('X share of circuits with a crossover', out.share['600 to 1200 m'].withACrossover > 0, Object.entries(out.share).map(([k, v]) => k + ': ' + v.withACrossover + ' of ' + v.circuits).join('; ') + '; crossing angles ' + (out.share['600 to 1200 m'].crossingAngleDeg ? fmt(out.share['600 to 1200 m'].crossingAngleDeg) : 'none') + ' degrees');
  /* 200 crossover circuits driven */
  const tracks = [];
  let seed = 1;
  while (tracks.length < SEEDS && seed < 100000) { const t = generateTrack(seed, { kind: 'circuit', difficulty: diffOf(seed) }); if (t.bridges.length) tracks.push(t); seed++; }
  const rs = tracks.map(t => lap(t, {}));
  const sum = f => rs.reduce((a, r) => a + f(r), 0);
  out.drives = { circuits: tracks.length, seedsScanned: seed - 1, notLapped: rs.filter(r => !r.lapped).length, respawns: sum(r => r.respawns), jumps: sum(r => r.jumps), worstJump: Math.max(...rs.map(r => r.worstJump)), hits: sum(r => r.hits), otherLayerHits: sum(r => r.otherLayerHits), layerChanges: sum(r => r.layerChanges), layerChangesOnRamps: sum(r => r.layerChangesOnRamps), seconds: dist(rs.map(r => r.seconds)) };
  const d = out.drives;
  result('X the scripted driver laps ' + d.circuits + ' crossover circuits', d.notLapped === 0 && d.respawns === 0 && d.jumps === 0 && d.otherLayerHits === 0 && d.layerChanges === d.layerChangesOnRamps && d.layerChanges >= 2 * d.circuits, (d.circuits - d.notLapped) + ' lapped, ' + d.respawns + ' respawns, ' + d.jumps + ' layer jumps, ' + d.hits + ' wall touches of which ' + d.otherLayerHits + ' with the other layer, ' + d.layerChanges + ' layer changes all on ramps (' + d.layerChangesOnRamps + '), ' + fmt(d.seconds) + ' s');
  /* known answers on the same tracks */
  {
    const nearest = tracks.map(t => lap(t, { locate: 'nearest' }));
    const flat = tracks.map(t => lap(t, { locate: 'flat' }));
    const nj = nearest.reduce((a, r) => a + r.jumps, 0), fj = flat.reduce((a, r) => a + r.jumps, 0);
    out.knownAnswers.nearestSample = { jumps: nj, tracksWithJumps: nearest.filter(r => r.jumps).length, respawns: nearest.reduce((a, r) => a + r.respawns, 0), notLapped: nearest.filter(r => !r.lapped).length };
    out.knownAnswers.flatFullSearch = { jumps: fj, tracksWithJumps: flat.filter(r => r.jumps).length, respawns: flat.reduce((a, r) => a + r.respawns, 0), notLapped: flat.filter(r => !r.lapped).length };
    known('X the nearest sample in x and z on every step jumps layers', nj > 0, nj + ' jumps on ' + out.knownAnswers.nearestSample.tracksWithJumps + ' of ' + tracks.length + ' circuits, ' + out.knownAnswers.nearestSample.respawns + ' respawns');
    summary.push('NOTE X the old search in x and z only when a full search is made (incremental otherwise): ' + fj + ' jumps on ' + out.knownAnswers.flatFullSearch.tracksWithJumps + ' circuits, ' + out.knownAnswers.flatFullSearch.respawns + ' respawns, ' + out.knownAnswers.flatFullSearch.notLapped + ' not lapped (information: the step by step search stays on its layer; the full search at a respawn or reset is what could not)');
    const keep = TUNE.BANK.LAYER_HEIGHT;
    TUNE.BANK.LAYER_HEIGHT = 1e9;
    const noLayers = tracks.slice(0, Math.min(50, tracks.length)).map(t => lap(t, {}));
    TUNE.BANK.LAYER_HEIGHT = keep;
    const other = noLayers.reduce((a, r) => a + r.otherLayerHits, 0);
    out.knownAnswers.layerRuleOff = { circuits: noLayers.length, otherLayerHits: other, hits: noLayers.reduce((a, r) => a + r.hits, 0), respawns: noLayers.reduce((a, r) => a + r.respawns, 0), notLapped: noLayers.filter(r => !r.lapped).length };
    known('X the layer rule switched off: the car touches the other layer\'s walls', other > 0, other + ' touches with the other layer on ' + noLayers.length + ' circuits, ' + out.knownAnswers.layerRuleOff.respawns + ' respawns, ' + out.knownAnswers.layerRuleOff.notLapped + ' not lapped');
  }
  writeJson('crossovers.json', out);
}

/* =========================================================== T time */
function timing() {
  const out = {};
  for (const kind of KINDS) for (const [label, length] of [['default', undefined], ['600', 600], ['900', 900], ['1200', 1200]]) {
    const ms = [], attempts = [];
    let fallbacks = 0;
    for (let s = 1; s <= SEEDS; s++) { const t0 = performance.now(); const t = generateTrack(s, { kind, length, difficulty: diffOf(s) }); ms.push(performance.now() - t0); attempts.push(t.attempts); if (t.fallback) fallbacks++; }
    out[kind + ' ' + label] = { seeds: SEEDS, fallbacks, ms: dist(ms), attempts: dist(attempts) };
    const d = out[kind + ' ' + label];
    result('T generation, ' + kind + 's, ' + label, d.ms.p50 < 100 && d.ms.max < 600 && fallbacks === 0, 'median ' + d.ms.p50.toFixed(0) + ' ms, p95 ' + d.ms.p95.toFixed(0) + ', worst ' + d.ms.max.toFixed(0) + ' ms; attempts ' + fmt(d.attempts) + '; ' + fallbacks + ' fallbacks of ' + SEEDS);
  }
  writeJson('timing.json', out);
}

/* ------------------------------------------------------------------ run */
const t0 = Date.now();
if (ONLY.includes('B')) await busier();
if (ONLY.includes('K')) banking();
if (ONLY.includes('X')) crossovers();
if (ONLY.includes('T')) timing();
console.log(summary.join('\n'));
console.log('\n' + (failures ? failures + ' FAILED' : 'all measurements pass and every known answer was caught') + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
process.exit(failures ? 1 : 0);
