/* THE TRACK MEASUREMENTS, briefs/TRACKS.md "Measure", each with a known
   answer that must fail, plus the contract checks the game relies on.

     1  determinism: the same seed gives byte identical output, in Node
        and in Chromium; a different seed gives a different track
     2  validity over 1,000 seeds per kind: no self-overlap, no wall
        closer than the drivable width, length within the target, every
        corner's radius inside the stated range (and width, elevation,
        the data contract); hand broken tracks must fail each check
     3  drift character: share of the length in corners, direction
        changes, longest straight, as distributions
     W  the physics world, unchanged: the scripted driver drives them;
        clipDistance finds the clip walls
     D  the daily seed across time zones
     M  the mesh builder in Node: finite geometry

   node game/test/tracks/probes.js [--seeds 1000] [--only 1,2,3,W,D,M] [--no-browser]
   Writes review/tracks/*.json and prints a summary. Exits non zero if a
   measurement fails or a known answer is not caught. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { generateTrack, dailySeed, trackFromElements, TRACKS } from '../../src/tracks/generate.js';
import { validateTrack, characterOf, cornersOf } from '../../src/tracks/analyse.js';
import { buildTrackMesh } from '../../src/tracks/mesh.js';
import { createWorld } from '../../src/physics/world.js';
import { createDriver } from '../../src/physics/driver.js';
import { testTrack } from '../../src/ground/track.js';
import { STEP } from '../../src/physics/vehicle.js';
import { root, findChromium, sha256, dist, writeJson } from './lib.js';

const args = process.argv.slice(2);
const SEEDS = +(args.includes('--seeds') ? args[args.indexOf('--seeds') + 1] : 1000);
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : ['1', '2', '3', 'W', 'D', 'M'];
const BROWSER = !args.includes('--no-browser');
const tracksDir = path.join(root, 'game', 'src', 'tracks');
const KINDS = ['circuit', 'sprint'];
const diffOf = seed => ((seed - 1) % 11) / 10;
const clone = o => JSON.parse(JSON.stringify(o));
const summary = [];
let failures = 0;
function result(name, pass, text) { summary.push((pass ? 'PASS ' : 'FAIL ') + name + ': ' + text); if (!pass) failures++; }
function known(name, caught, text) { summary.push((caught ? 'CAUGHT ' : 'MISSED ') + name + ': ' + text); if (!caught) failures++; }

/* ===================================================== 1 determinism */
async function determinism() {
  const out = { node: {}, chromium: null, knownAnswers: {} };
  const N = Math.min(SEEDS, 1000);
  const hashes = { circuit: [], sprint: [] };
  let repeatMismatch = 0;
  for (const kind of KINDS) {
    for (let s = 1; s <= N; s++) {
      const o = { kind, difficulty: diffOf(s) };
      const a = JSON.stringify(generateTrack(s, o)), b = JSON.stringify(generateTrack(s, o));
      if (a !== b) repeatMismatch++;
      hashes[kind].push(sha256(a));
    }
  }
  const distinct = KINDS.map(k => new Set(hashes[k]).size);
  out.node = { seedsPerKind: N, repeatMismatches: repeatMismatch, distinctHashes: { circuit: distinct[0], sprint: distinct[1] } };
  result('1 determinism, same seed twice', repeatMismatch === 0, repeatMismatch + ' mismatches over ' + 2 * N + ' tracks');
  result('1 determinism, different seeds differ', distinct[0] === N && distinct[1] === N, distinct.join(' and ') + ' distinct of ' + N + ' per kind');

  /* known answers: a comparator that cannot fail proves nothing */
  {
    const flaky = (s, o) => generateTrack(s ^ (Math.random() < 0.5 ? 1 : 0), o);
    let mism = 0;
    for (let s = 1; s <= 20; s++) if (JSON.stringify(flaky(s, { kind: 'sprint' })) !== JSON.stringify(flaky(s, { kind: 'sprint' }))) mism++;
    out.knownAnswers.flakyGenerator = mism;
    known('1a a generator that flips a seed bit at random', mism > 0, mism + ' of 20 repeats mismatched');
    const deaf = (s, o) => generateTrack(1, o);
    const set = new Set();
    for (let s = 1; s <= 20; s++) set.add(sha256(JSON.stringify(deaf(s, { kind: 'circuit' }))));
    out.knownAnswers.seedIgnoringDistinct = set.size;
    known('1b a generator that ignores the seed', set.size < 20, set.size + ' distinct of 20');
  }

  /* static: the generator, the validator and the maths call nothing an
     engine may round differently */
  {
    const bad = /Math\.(sin|cos|tan|asin|acos|atan2?|exp|expm1|log1?p?|log2|log10|pow|hypot|cbrt|sinh|cosh|tanh|random)\b|\*\*/g;
    const scan = f => { const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); return (src.match(bad) || []); };
    const hits = ['generate.js', 'analyse.js', 'dmath.js'].map(f => [f, scan(path.join(tracksDir, f))]);
    const total = hits.reduce((a, [, h]) => a + h.length, 0);
    out.staticScan = Object.fromEntries(hits.map(([f, h]) => [f, h]));
    result('1 no engine dependent maths in the generator', total === 0, total + ' calls found');
    const ka = scan(path.join(root, 'game', 'src', 'physics', 'world.js'));
    known('1c the same scan on physics/world.js', ka.length > 0, ka.length + ' calls found (' + [...new Set(ka)].join(', ') + ')');
  }

  /* Node against Chromium, and the same with Math.sin and Math.cos in
     place of dmath.js, which should part somewhere if the engines differ */
  if (BROWSER) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tracks-'));
    fs.cpSync(tracksDir, path.join(tmp, 'real'), { recursive: true });
    fs.cpSync(tracksDir, path.join(tmp, 'variant'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'variant', 'dmath.js'), 'export const dsin = x => Math.sin(x);\nexport const dcos = x => Math.cos(x);\nexport const TWO_PI = 6.283185307179586;\nexport function wrapAngle(a) { return a - TWO_PI * Math.round(a / TWO_PI); }\n');
    fs.cpSync(tracksDir, path.join(tmp, 'nudged'), { recursive: true });
    const dm = fs.readFileSync(path.join(tracksDir, 'dmath.js'), 'utf8');
    fs.writeFileSync(path.join(tmp, 'nudged', 'dmath.js'), dm.replace('export function dsin(x) {', 'export function dsin(x) { return dsinTrue(x) * (1 + 1e-6); }\nfunction dsinTrue(x) {'));
    fs.cpSync(tracksDir, path.join(tmp, 'ulp'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'ulp', 'dmath.js'), dm.replace('export function dsin(x) {', 'export function dsin(x) { return dsinTrue(x) * (1 + 2.220446049250313e-16); }\nfunction dsinTrue(x) {'));
    fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><title>tracks</title>');
    const server = http.createServer((req, res) => {
      const p = path.join(tmp, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(tmp) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); res.end(fs.readFileSync(p));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
    const page = await browser.newPage();
    await page.goto(url + 'index.html');
    const M = Math.min(N, 200);
    const inPage = async (dir) => page.evaluate(async ({ dir, M }) => {
      const g = await import('/' + dir + '/generate.js');
      const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
      const out = {};
      for (const kind of ['circuit', 'sprint']) { out[kind] = []; for (let s = 1; s <= M; s++) out[kind].push(await hex(JSON.stringify(g.generateTrack(s, { kind, difficulty: ((s - 1) % 11) / 10 })))); }
      out.daily = await hex(JSON.stringify(g.generateTrack(g.dailySeed(new Date(2026, 9, 31)), {})));
      return out;
    }, { dir, M });
    const chromeReal = await inPage('real');
    const chromeVariant = await inPage('variant');
    const chromeNudged = await inPage('nudged');
    const chromeUlp = await inPage('ulp');
    await browser.close(); server.close();
    const variant = await import(path.join(tmp, 'variant', 'generate.js'));
    let realDiff = 0, variantDiff = 0, variantFirst = null, nudgedDiff = 0, ulpDiff = 0;
    for (const kind of KINDS) for (let s = 1; s <= M; s++) {
      if (chromeReal[kind][s - 1] !== hashes[kind][s - 1]) realDiff++;
      if (chromeNudged[kind][s - 1] !== hashes[kind][s - 1]) nudgedDiff++;
      if (chromeUlp[kind][s - 1] !== hashes[kind][s - 1]) ulpDiff++;
      const nv = sha256(JSON.stringify(variant.generateTrack(s, { kind, difficulty: diffOf(s) })));
      if (nv !== chromeVariant[kind][s - 1]) { variantDiff++; if (!variantFirst) variantFirst = kind + ' ' + s; }
    }
    const dailyNode = sha256(JSON.stringify(generateTrack(dailySeed(new Date(2026, 9, 31)), {})));
    out.chromium = { seedsPerKind: M, differFromNode: realDiff, dailyMatches: dailyNode === chromeReal.daily, nudgedDifferFromNode: nudgedDiff, ulpDifferFromNode: ulpDiff, mathSinVariantDifferFromNode: variantDiff, mathSinVariantFirstDifference: variantFirst };
    result('1 Node and Chromium give the same bytes', realDiff === 0 && dailyNode === chromeReal.daily, realDiff + ' of ' + 2 * M + ' differ; the daily track ' + (dailyNode === chromeReal.daily ? 'matches' : 'differs'));
    known('1d the browser copy with sine one part in a million high', nudgedDiff > 0, nudgedDiff + ' of ' + 2 * M + ' tracks differ from Node');
    summary.push('NOTE 1f the browser copy with sine one unit in the last place high: ' + ulpDiff + ' of ' + 2 * M + ' tracks differ from Node (information: the output is rounded to 0.1 mm and a millionth of a radian, which absorbs most last bit differences)');
    summary.push('NOTE 1e the generator on Math.sin and Math.cos instead of dmath.js: ' + variantDiff + ' of ' + 2 * M + ' tracks differ between Node and this Chromium (information only: these two engines happen to agree here, other engines are not guaranteed to)');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  writeJson('determinism.json', out);
}

/* ======================================================= 2 validity */
function validity() {
  const out = { seedsPerKind: SEEDS, difficulty: 'seed n uses ((n - 1) mod 11) / 10', kinds: {}, targets: {}, knownAnswers: {} };
  const tracks = { circuit: [], sprint: [] };
  for (const kind of KINDS) {
    const fails = {}, worst = { clearance: Infinity, otherBarrier: Infinity, tightest: Infinity, widestCorner: 0, minWidth: Infinity, maxWidth: 0, maxGrade: 0, maxCrest: 0, maxLift: 0, maxBankDeg: 0, minLength: Infinity, maxLength: 0, minStep: Infinity, maxStep: 0 };
    const attempts = [], ms = [];
    let invalid = 0, fallback = 0;
    const rejected = {};
    for (let s = 1; s <= SEEDS; s++) {
      const t0 = performance.now();
      const t = generateTrack(s, { kind, difficulty: diffOf(s) });
      ms.push(performance.now() - t0);
      attempts.push(t.attempts);
      if (t.fallback) fallback++;
      for (const [k, v] of Object.entries(t.rejected)) rejected[k] = (rejected[k] || 0) + v;
      const v = validateTrack(t, TRACKS.LENGTH ? { min: TRACKS.LENGTH[0], max: TRACKS.LENGTH[1] } : t.target);
      if (!v.ok) { invalid++; for (const f of v.failed) (fails[f] = fails[f] || []).push(s); }
      const c = v.checks;
      worst.clearance = Math.min(worst.clearance, c.clearance.worstMargin);
      worst.otherBarrier = Math.min(worst.otherBarrier, c.overlap.closestOtherBarrier);
      worst.tightest = Math.min(worst.tightest, c.radius.tightest);
      worst.widestCorner = Math.max(worst.widestCorner, c.radius.widest);
      worst.minWidth = Math.min(worst.minWidth, c.width.min); worst.maxWidth = Math.max(worst.maxWidth, c.width.max);
      worst.maxGrade = Math.max(worst.maxGrade, c.elevation.maxGrade); worst.maxCrest = Math.max(worst.maxCrest, c.elevation.maxCrestCurvature);
      worst.maxLift = Math.max(worst.maxLift, c.elevation.liftAtTopSpeed); worst.maxBankDeg = Math.max(worst.maxBankDeg, c.elevation.maxBankDeg);
      worst.minLength = Math.min(worst.minLength, t.length); worst.maxLength = Math.max(worst.maxLength, t.length);
      worst.minStep = Math.min(worst.minStep, c.spacing.minStep); worst.maxStep = Math.max(worst.maxStep, c.spacing.maxStep);
      tracks[kind].push(t);
    }
    for (const k of Object.keys(worst)) worst[k] = Math.round(worst[k] * 10000) / 10000;
    out.kinds[kind] = { tracks: SEEDS, invalid, fallback, failuresByCheck: Object.fromEntries(Object.entries(fails).map(([k, v]) => [k, { count: v.length, seeds: v.slice(0, 20) }])), worst, attempts: dist(attempts), generationMs: dist(ms), rejectedAttemptsByCheck: rejected };
    result('2 validity, ' + kind + 's', invalid === 0 && fallback === 0, invalid + ' invalid and ' + fallback + ' fallbacks of ' + SEEDS + '; worst clearance margin ' + worst.clearance.toFixed(3) + ' m, closest other barrier ' + worst.otherBarrier.toFixed(2) + ' m, radii ' + worst.tightest.toFixed(2) + ' to ' + worst.widestCorner.toFixed(1) + ' m, widths ' + worst.minWidth + ' to ' + worst.maxWidth + ' m, lengths ' + worst.minLength + ' to ' + worst.maxLength + ' m, lift at top speed ' + worst.maxLift.toFixed(2) + ' g');
  }
  /* explicit targets */
  for (const kind of KINDS) for (const L of [600, 900, 1200]) {
    let bad = 0, fb = 0, lo = Infinity, hi = 0;
    const n = Math.min(100, SEEDS);
    for (let s = 1; s <= n; s++) {
      const t = generateTrack(5000 + s, { kind, length: L, difficulty: diffOf(s) });
      const v = validateTrack(t, { min: L * 0.9, max: L * 1.1 });
      if (!v.ok) bad++; if (t.fallback) fb++;
      lo = Math.min(lo, t.length); hi = Math.max(hi, t.length);
    }
    out.targets[kind + ' ' + L] = { tracks: n, invalid: bad, fallback: fb, lengths: [lo, hi] };
    result('2 validity, ' + kind + 's of about ' + L + ' m', bad === 0 && fb === 0, bad + ' invalid, ' + fb + ' fallbacks of ' + n + ', lengths ' + lo + ' to ' + hi + ' m');
  }
  /* the fallback courses, which no seed above needed, must pass too */
  {
    const keep = TRACKS.ATTEMPTS;
    TRACKS.ATTEMPTS = 0;
    const fbs = [];
    for (const k of KINDS) for (const L of [undefined, 600, 900, 1200]) {
      const t = generateTrack(1, { kind: k, length: L });
      const target = L ? { min: L * 0.9, max: L * 1.1 } : { min: TRACKS.LENGTH[0], max: TRACKS.LENGTH[1] };
      fbs.push({ kind: k, target: L || 'default', fallback: t.fallback, length: t.length, failed: validateTrack(t, target).failed });
    }
    TRACKS.ATTEMPTS = keep;
    out.fallbackCourses = fbs;
    result('2 the fallback courses are valid', fbs.every(f => f.fallback && f.failed.length === 0), fbs.map(f => f.kind + ' ' + f.target + ': ' + f.length + ' m ' + (f.failed.length ? 'fails ' + f.failed.join(',') : 'valid')).join('; '));
  }
  out.knownAnswers = brokenTracks();
  writeJson('validity.json', out);
  return tracks;
}

/* Hand broken tracks: each must fail the check it breaks. */
function brokenTracks() {
  const ka = {};
  const base = generateTrack(5, { kind: 'circuit', difficulty: 0.5 });
  const all = { min: 0, max: 1e9 };
  const expect = (name, track, target, check, how) => {
    const v = validateTrack(track, target);
    ka[name] = { expected: check, failed: v.failed, detail: v.checks[check] };
    known('2 ' + name, v.failed.includes(check), how + '; fails ' + (v.failed.join(', ') || 'nothing'));
  };
  ka.control = validateTrack(base, all).failed;
  result('2 control: the base for the broken tracks is valid', validateTrack(base, all).ok, 'circuit 5');
  {
    const t = trackFromElements('sprint', [{ s: 60 }, { c: { R: 30, angle: 300, lt: 0, width: 12 } }, { s: 160 }]);
    expect('overlap: a sprint that turns 300 degrees and crosses itself', t, all, 'overlap', 'a 300 degree corner of radius 30 between straights');
  }
  {
    const t = trackFromElements('sprint', [{ s: 100 }, { c: { R: 20, angle: 180, lt: 0, width: 14 } }, { s: 30 }, { c: { R: 12.5, angle: 180, lt: 0, width: 14 } }, { s: 25 }]);
    expect('overlap: two parts whose barriers run closer than the gap', t, all, 'overlap', 'two left hairpins that bring the course back alongside its start straight, 2.75 m barrier to barrier, without crossing');
    ka['overlap: two parts whose barriers run closer than the gap'].crossings = validateTrack(t, all).checks.overlap.crossings;
  }
  {
    const t = clone(base);
    for (let i = 40; i <= 44; i++) { const c = t.centre[i], p = t.walls[0].points[i]; p.x = c.x + (p.x - c.x) * 0.4; p.z = c.z + (p.z - c.z) * 0.4; }
    expect('clearance: five left wall points moved to 40% of the half width', t, all, 'clearance', 'samples 40 to 44');
  }
  {
    const t = clone(base);
    expect('length: the same track against a target it misses', t, { min: t.length + 2, max: t.length + 200 }, 'length', 'target starts 2 m above its length');
  }
  {
    const t = trackFromElements('sprint', [{ s: 60 }, { c: { R: 11, angle: 90, lt: 6, width: 12 } }, { s: 60 }]);
    expect('radius: a corner of radius 11', t, all, 'radius', 'one 90 degree corner, radius 11 m');
  }
  {
    const t = trackFromElements('sprint', [{ s: 60 }, { c: { R: 160, angle: 40, lt: 10, width: 12 } }, { s: 60 }]);
    expect('radius: a corner of radius 160', t, all, 'radius', 'one 40 degree corner, radius 160 m');
  }
  {
    const t = clone(base);
    for (let i = 10; i <= 20; i++) t.centre[i].width = 9;
    expect('width: 9 m on the start straight', t, all, 'width', 'samples 10 to 20');
  }
  {
    const t = clone(base);
    for (let i = 0; i < t.centre.length; i++) t.centre[i].y += 1.2 * Math.exp(-(((i - 30) * 2 / 8) ** 2));
    expect('elevation: a 1.2 m bump 16 m long', t, all, 'elevation', 'centred on 60 m');
  }
  {
    const t = clone(base);
    for (let i = 0; i < t.centre.length; i++) t.centre[i].y += i >= 20 && i <= 40 ? (i - 20) * 2 * 0.08 : i > 40 ? 3.2 : 0;
    expect('elevation: an 8% ramp', t, all, 'elevation', '40 m at 8%');
  }
  {
    const t = clone(base);
    for (let i = 50; i <= 55; i++) t.centre[i].bank = 0.15;
    expect('elevation: 8.6 degrees of bank', t, all, 'elevation', 'samples 50 to 55');
  }
  {
    const t = clone(base);
    const p = t.walls[0].points; p.unshift(...p.splice(p.length - 4, 3));
    expect('contract: left wall points shifted three samples', t, all, 'contract', 'the wall no longer beside its samples');
  }
  {
    const t = clone(base);
    t.centre.splice(100, 1); t.walls[0].points.splice(100, 1); t.walls[1].points.splice(100, 1);
    expect('spacing: one sample removed', t, all, 'spacing', 'a 4 m step at 200 m');
  }
  return ka;
}

/* ===================================================== 3 drift character */
function character(tracks) {
  const out = { seedsPerKind: SEEDS, kinds: {}, byDifficulty: {}, knownAnswers: {} };
  for (const kind of KINDS) {
    const list = tracks[kind];
    const ch = list.map(t => characterOf(t));
    const field = f => dist(ch.map(c => c[f]));
    const mix = {};
    for (const t of list) for (const c of t.corners) mix[c.type] = (mix[c.type] || 0) + 1;
    out.kinds[kind] = {
      length: field('length'), cornerShare: field('cornerShare'), directionChanges: field('directionChanges'), longestStraight: field('longestStraight'),
      corners: field('corners'), hairpins: field('hairpins'), clips: field('clips'), tightestRadius: field('minRadius'), meanWidth: field('meanWidth'),
      difficultyEstimate: dist(list.map(t => t.difficulty)),
      designedCornerTypes: mix,
      directionChangesPer100m: dist(ch.map(c => c.directionChanges / c.length * 100)),
    };
    for (const d of [0, 0.5, 1]) {
      const pick = list.filter((t, i) => diffOf(i + 1) === d);
      const pc = pick.map(t => characterOf(t));
      out.byDifficulty[kind + ' ' + d] = { tracks: pick.length, directionChanges: dist(pc.map(c => c.directionChanges)), tightestRadius: dist(pc.map(c => c.minRadius)), meanWidth: dist(pc.map(c => c.meanWidth)), hairpins: dist(pc.map(c => c.hairpins)), longestStraight: dist(pc.map(c => c.longestStraight)), estimate: dist(pick.map(t => t.difficulty)) };
    }
    const rho = spearman(list.map((t, i) => diffOf(i + 1)), list.map(t => t.difficulty));
    out.kinds[kind].spearmanRequestedVsEstimate = Math.round(rho * 1000) / 1000;
    const k = out.kinds[kind];
    result('3 drift character, ' + kind + 's', true, 'in corners ' + pct(k.cornerShare) + ', direction changes ' + rng(k.directionChanges) + ', longest straight ' + rng(k.longestStraight) + ' m (p50 [p5, p95], worst); requested and estimated difficulty rank together at ' + k.spearmanRequestedVsEstimate);
  }
  /* known answer: a course whose numbers are known by construction */
  {
    const els = [{ s: 100 }, { c: { R: 30, angle: 90, lt: 0 } }, { s: 40 }, { c: { R: 30, angle: -90, lt: 0 } }, { s: 60 }, { c: { R: 20, angle: 120, lt: 0 } }, { s: 80 }];
    const t = trackFromElements('sprint', els);
    const c = characterOf(t);
    const arcs = 30 * Math.PI / 2 * 2 + 20 * 2 * Math.PI / 3;
    const want = { corners: 3, directionChanges: 2, longestStraight: 100, cornerShare: arcs / t.length };
    const okNow = c.corners === 3 && c.directionChanges === 2 && Math.abs(c.longestStraight - 100) <= 2 && Math.abs(c.cornerShare - want.cornerShare) <= 2 * 3 * 2 / t.length + 1e-9;
    out.knownAnswers.constructed = { want, got: { corners: c.corners, directionChanges: c.directionChanges, longestStraight: c.longestStraight, cornerShare: c.cornerShare, radii: c.cornerList.map(x => Math.round(x.radius * 100) / 100) } };
    result('3 the analyser on a course built to known numbers', okNow, 'corners ' + c.corners + ' (3), direction changes ' + c.directionChanges + ' (2), longest straight ' + c.longestStraight + ' m (100), in corners ' + c.cornerShare.toFixed(3) + ' (' + want.cornerShare.toFixed(3) + ' +- one sample a corner end), radii ' + out.knownAnswers.constructed.got.radii.join(', '));
    const keep = TRACKS.STRAIGHT_RADIUS;
    TRACKS.STRAIGHT_RADIUS = 25;
    const w = characterOf(t);
    TRACKS.STRAIGHT_RADIUS = keep;
    const caught = !(w.corners === 3 && w.directionChanges === 2 && Math.abs(w.longestStraight - 100) <= 2);
    out.knownAnswers.wrongThreshold = { corners: w.corners, directionChanges: w.directionChanges, longestStraight: w.longestStraight };
    known('3 the analyser with its straight threshold at 25 m', caught, 'reads ' + w.corners + ' corners, ' + w.directionChanges + ' changes, longest straight ' + w.longestStraight + ' m on the same course');
    const tt = testTrack();
    const tc = characterOf(tt);
    out.knownAnswers.handMadeTestTrack = { length: tt.length, corners: tc.corners, directionChanges: tc.directionChanges, longestStraight: tc.longestStraight, cornerShare: tc.cornerShare, radii: tc.cornerList.map(x => Math.round(x.radius)) };
  }
  writeJson('character.json', out);
}
const pct = d => Math.round(d.p50 * 100) + '% [' + Math.round(d.p5 * 100) + ', ' + Math.round(d.p95 * 100) + '], ' + Math.round(d.min * 100) + ' to ' + Math.round(d.max * 100) + '%';
const rng = d => d.p50 + ' [' + d.p5 + ', ' + d.p95 + '], ' + d.min + ' to ' + d.max;
function spearman(a, b) {
  const rank = v => { const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(v.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const ra = rank(a), rb = rank(b), n = a.length, ma = ra.reduce((x, y) => x + y) / n, mb = rb.reduce((x, y) => x + y) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (ra[i] - ma) * (rb[i] - mb); saa += (ra[i] - ma) ** 2; sbb += (rb[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
}

/* ============================================ W the physics, unchanged */
function drive(t, maxSeconds) {
  const world = createWorld(t), driver = createDriver(t, {});
  const end = t.kind === 'circuit' ? null : t.finish.along;
  let last = world.along, laps = 0, done = false, clipSteps = 0, clipMin = Infinity, maxLat = 0;
  const steps = Math.round(maxSeconds / STEP);
  let hits = 0, respawns = 0, i = 0;
  for (; i < steps; i++) {
    world.stepWorld(driver.input(world));
    if (world.hit) hits++;
    if (world.respawned) respawns++;
    if (Number.isFinite(world.nearest)) { clipSteps++; clipMin = Math.min(clipMin, world.nearest); }
    maxLat = Math.max(maxLat, Math.abs(world.lateral) - world.halfWidth);
    if (end === null) { if (world.along < last - t.length / 2) laps++; last = world.along; if (laps >= 1) { done = true; break; } }
    else if (world.along >= end) { done = true; break; }
  }
  return { done, seconds: i * STEP, hits, hardHits: world.hardHits, respawns, clipSteps, clipMin, beyondEdge: maxLat };
}
function physics() {
  const out = { kinds: {}, knownAnswers: {} };
  const N = Math.min(100, SEEDS);
  for (const kind of KINDS) {
    const rs = [];
    for (let s = 1; s <= N; s++) rs.push(drive(generateTrack(s, { kind, difficulty: diffOf(s) }), 300));
    const notDone = rs.filter(r => !r.done).length, resp = rs.reduce((a, r) => a + r.respawns, 0), hits = rs.reduce((a, r) => a + r.hits, 0), hard = rs.reduce((a, r) => a + r.hardHits, 0);
    const noClip = rs.filter(r => r.clipSteps === 0).length;
    out.kinds[kind] = { tracks: N, notFinished: notDone, respawns: resp, wallHits: hits, hardHits: hard, tracksWithHits: rs.filter(r => r.hits).length, seconds: dist(rs.map(r => r.seconds)), clipMin: dist(rs.filter(r => r.clipSteps).map(r => r.clipMin)), tracksWithoutClipReadings: noClip, mostBeyondEdge: Math.max(...rs.map(r => r.beyondEdge)) };
    result('W the scripted driver in world.js, ' + kind + 's', notDone === 0 && resp === 0 && noClip === 0, N - notDone + ' of ' + N + ' finished, ' + resp + ' respawns, ' + hits + ' wall touches (' + hard + ' hard) on ' + out.kinds[kind].tracksWithHits + ' tracks, ' + rng(out.kinds[kind].seconds) + ' s, clipDistance read on every track');
  }
  /* known answer: a wall pushed into the road must be hit */
  {
    const t = generateTrack(1, { kind: 'circuit', difficulty: 0 });
    const clean = drive(t, 300);
    const b = clone(t);
    for (let i = 60; i <= 75; i++) { const c = b.centre[i], lx = -Math.cos(c.heading), lz = Math.sin(c.heading); b.walls[1].points[i] = { x: c.x - lx * 0.3, y: c.y, z: c.z - lz * 0.3 }; }
    const broken = drive(b, 300);
    out.knownAnswers.wallIntoRoad = { clean: { hits: clean.hits, respawns: clean.respawns }, broken: { hits: broken.hits, respawns: broken.respawns, hardHits: broken.hardHits } };
    known('W a right barrier moved to 0.3 m right of the centre line for 30 m', broken.hits + broken.respawns > clean.hits + clean.respawns, 'touches ' + clean.hits + ' before, ' + broken.hits + ' after (' + broken.hardHits + ' hard), respawns ' + broken.respawns);
  }
  /* clipDistance: a car parked 1.5 m in from a clip wall reads the gap to it */
  {
    const t = generateTrack(3, { kind: 'circuit' });
    const clip = t.clips[0];
    const park = (track) => {
      const w = createWorld(track);
      const i = Math.round((clip.from + clip.to) / 4);
      const c = track.centre[i], lx = -Math.cos(c.heading), lz = Math.sin(c.heading), sgn = clip.side === 'left' ? 1 : -1;
      const wall = track.walls[clip.side === 'left' ? 0 : 1].points[i];
      const lat = ((wall.x - c.x) * lx + (wall.z - c.z) * lz) * sgn;
      w.car.x = c.x + lx * sgn * (lat - 1.5); w.car.z = c.z + lz * sgn * (lat - 1.5); w.car.yaw = c.heading;
      w.locate(true);
      w.stepWorld({ steer: 0, throttle: 0, brake: 0, handbrake: 0 });
      return w.nearest;
    };
    const good = park(t);
    const want = 1.5 - 0.92;
    const b = clone(t);
    for (const k of [0, 1]) { const p = b.walls[k].points; p.unshift(...p.splice(p.length - 11, 10)); }
    const bad = park(b);
    out.knownAnswers.clipDistance = { clip, expected: want, aligned: good, misaligned: bad };
    result('W clipDistance at a clip wall', Math.abs(good - want) < 0.1, 'reads ' + good.toFixed(3) + ' m, expected ' + want.toFixed(2) + ' m (1.5 m less the half width)');
    known('W the same with the barriers misaligned by ten samples', !(Math.abs(bad - want) < 0.1), 'reads ' + (Number.isFinite(bad) ? bad.toFixed(3) + ' m' : 'nothing'));
  }
  writeJson('drive.json', out);
}

/* ============================================== D the daily seed */
function daily() {
  const zones = ['Pacific/Kiritimati', 'Australia/Sydney', 'Asia/Kolkata', 'UTC', 'America/Los_Angeles', 'Pacific/Pago_Pago'];
  const script = `import { dailySeed, hashString } from ${JSON.stringify(path.join(tracksDir, 'generate.js'))};
const at = (h, m) => new Date(2026, 9, 31, h, m);
const utc = d => hashString('drift-fever daily ' + d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'));
console.log(JSON.stringify({ early: dailySeed(at(0, 5)), late: dailySeed(at(23, 55)), next: dailySeed(new Date(2026, 10, 1, 0, 5)), utcEarly: utc(at(0, 5)), utcLate: utc(at(23, 55)) }));`;
  const rows = {};
  for (const tz of zones) rows[tz] = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: tz } }).toString());
  const r = Object.values(rows);
  const same = r.every(x => x.early === r[0].early && x.late === r[0].early && x.next === r[0].next) && r[0].next !== r[0].early;
  const utcSame = r.every(x => x.utcEarly === r[0].utcEarly && x.utcLate === r[0].utcEarly);
  const days = new Set();
  for (let i = 0; i < 3653; i++) days.add(dailySeed(new Date(2026, 0, 1 + i, 12)));
  const out = { zones: rows, sameEverywhere: same, utcVariantSameEverywhere: utcSame, distinctOver3653Days: days.size };
  writeJson('daily.json', out);
  result('D dailySeed: one seed per local date in ' + zones.length + ' time zones, 00:05 and 23:55', same, 'seed ' + r[0].early + ' for 31 October 2026 everywhere, ' + r[0].next + ' the next day; ' + days.size + ' distinct seeds over 3,653 days');
  known('D the same with the UTC date', !utcSame, 'gives ' + new Set(r.flatMap(x => [x.utcEarly, x.utcLate])).size + ' different seeds for the one local date');
}

/* ===================================================== M the meshes */
async function meshes() {
  const THREE = await import('three');
  const out = { tracks: [] };
  let bad = 0;
  const check = (t) => {
    const g = buildTrackMesh(t, THREE);
    let nan = 0, tris = 0;
    g.traverse(o => { if (!o.geometry) return; const a = o.geometry.attributes.position.array; tris += a.length / 9; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) nan++; });
    const box = new THREE.Box3().setFromObject(g);
    return { nan, tris, box: [box.min.x, box.min.z, box.max.x, box.max.z].map(v => Math.round(v)), drawCalls: g.children.length };
  };
  for (const kind of KINDS) for (let s = 1; s <= 10; s++) { const t = generateTrack(s, { kind }); const r = check(t); out.tracks.push({ kind, seed: s, ...r }); if (r.nan || !r.tris) bad++; }
  out.testTrack = check(testTrack());
  const tris = out.tracks.map(r => r.tris);
  result('M buildTrackMesh in Node', bad === 0 && out.testTrack.nan === 0, bad + ' of 20 generated tracks with a non finite vertex; ' + Math.min(...tris) + ' to ' + Math.max(...tris) + ' triangles in 2 draw calls; the hand made test track builds too');
  const b = clone(generateTrack(1, {}));
  b.centre[10].x = NaN;
  const quiet = console.error; console.error = () => {};
  const r = check(b);
  console.error = quiet;
  out.knownAnswer = r;
  known('M a track with one NaN coordinate', r.nan > 0, r.nan + ' non finite values found');
  writeJson('mesh.json', out);
}

/* ------------------------------------------------------------------ run */
const t0 = Date.now();
if (ONLY.includes('1')) await determinism();
let tracks = null;
if (ONLY.includes('2') || ONLY.includes('3')) tracks = validity();
if (ONLY.includes('3')) character(tracks);
if (ONLY.includes('W')) physics();
if (ONLY.includes('D')) daily();
if (ONLY.includes('M')) await meshes();
console.log(summary.join('\n'));
console.log('\n' + (failures ? failures + ' FAILED' : 'all measurements pass and every known answer was caught') + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
process.exit(failures ? 1 : 0);
