/* LADDER3 MEASURE 3: THE RULER (briefs/RIVALS-LADDER-3.md), one table
   for all six rivals, every number deterministic.

   THE DEFINITION, written once and used for all six:
   - his points: his own total in his race (drift, clean and pace, the
     solo scoring; no leads, no line), which is the same whatever the
     player does (he reads only his own world), so it is measured with
     no player, in Node (rivals/sim.js measureRival);
   - his rate: his points divided by his race time, in points a second;
   - his track's three star rate: the track's three star target for a
     career run (loop/modes.js starTargets at the career's laps) divided
     by that career run's time at par pace (runMetres at the career's
     laps over SCORING.PAR_SPEED), in points a second;
   - his multiple: his rate over his track's three star rate.
   THE STAIRCASE: Kestrow's multiple is the bottom step and each rival's
   multiple is at least STAIR.STEP (5 per cent) above the one before.
   HEADROOM AND PACE: the strong driver with a player's hands (the look
   ahead driver of stars/reach.js, searched the same way: random sets of
   its driving numbers, then sets near the best, the mark the best solo
   total of a run with no respawn) on his track over his laps, in the car
   a player would plausibly own by then (ladder/lib.js PLAYER_CAR: the
   starter with no upgrades in Rookie, one step of each by Pro, two by
   Legend; the reason is written there), then raced against him
   (driftrace/race.js, the race's own scoring with leads, the line and
   the close bonus), keeping clear of him as a player would
   (RIVAL_DRIVE.AVOID_*): he finishes first, and his race total is at
   least HEAD.SHARE (a quarter) more than the rival's.
   THE SANITY CHECK, gating nothing else: the three scripted players
   (rivals/players.js; PLAYERS.AT on First slide, the one place it
   passed, their own numbers elsewhere), 20 disturbed races each: across
   the 60 at least one won and one lost; a player who never moves loses.

   Known answers: two adjacent rivals swapped fails the staircase (every
   adjacent swap tried); a rival given the strong driver's own driving
   and car fails the headroom.

   node game/test/ladder3/ruler.js [r2 ...] [--runs 20] [--no-sanity] [--n 40] [--known]
   Rows for the rivals named are measured and the rest kept from the
   file (review/ladder3/ruler.json), so a rival can be measured alone. */
import path from 'node:path';
import fs from 'node:fs';
import { measureRival, measureCore, LAUNCH } from '../rivals/sim.js';
import { runRace } from '../driftrace/race.js';
import { DISTURB } from '../driftrace/hands.js';
import { RANGES } from '../rivals/search.js';
import { PLAYER_CAR } from '../ladder/lib.js';
import { PLAYERS, atKey } from '../../src/rivals/players.js';
import { RIVALS, rivalById } from '../../src/rivals/roster.js';
import { createRival } from '../../src/rivals/rival.js';
import { createRivalDriver, RIVAL_DRIVE } from '../../src/rivals/driver.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec, starTargets, lapsFor, battleLaps, runMetres, chapterOf, CHAPTERS } from '../../src/loop/modes.js';
import { TUNE } from '../../src/tune.js';
import { STEP } from '../../src/physics/world.js';

export const STAIR = { STEP: 0.05 };    // each rival's multiple at least this share above the one before
export const HEAD = { SHARE: 0.25 };    // the strong driver's race total at least this share above the rival's
export const SANITY = { RUNS: 20 };
export const STRONG = { N: 40, RUNS: 3, LATE: 0.05 };   // reach.js's default N random sets then N near the best; each marked by its worst of RUNS races, LATE off its share for each second behind him at the line

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
export const dir = path.join(root, 'review', 'ladder3');

/* the definition */
export function threeStarRate(track) {
  const laps = lapsFor(track);
  return starTargets(track, laps)[2] / (runMetres(track, laps) / TUNE.SCORING.PAR_SPEED);
}
export function rateOf(def) {
  const track = trackFor(careerSpec(def.track)), m = measureRival(def);
  const rate = m.total / m.seconds, star = threeStarRate(track);
  return { m, track, laps: battleLaps(track, def), rate, star, multiple: rate / star };
}
export const carFor = def => PLAYER_CAR[chapterOf(def.track)];

/* THE STRONG DRIVER. stars/reach.js's driver and search (random sets of
   the look ahead driver's numbers in RANGES, then sets near the best),
   with a player's hands. reach.js marks a set by its best solo total;
   that set is a lucky draw (on First slide it scores 6,089 from the
   centre of the grid and 3,903 from the player's slot with no rival at
   all, 10 wall hits), so here, as the brief's measure asks, he is
   searched in the race itself: from the player's slot, in the player's
   car, racing the rival, each set marked by its worst of STRONG.RUNS
   races (undisturbed, then the first disturbances of measure 2 on the
   player's start and the rival's grip): its share over the rival's
   total, less STRONG.LATE for each second it finishes behind him, and
   nothing for a race with a respawn or a broken hand. The literal
   reach.js set (the best solo total from the centre) is kept beside as
   strongLiteral. */
let rs = 1;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const round = (k, v) => /KEEP|COST|PROGRESS/.test(k) ? Math.round(v) : +v.toFixed(3);
/* reach.js's ranges, with the two numbers of a player's brake (DRIFT with the wheel straight) the players' seeds carry */
const SRANGES = Object.assign({}, RANGES, { HB_OVER: [0.5, 6], HB_STEER: [0.05, 0.5] });
const raceDisturb = k => k === 0 ? {} : { offset: [DISTURB[k].offset[1], DISTURB[k].offset[0]], rivalOpts: DISTURB[(k * 7) % 20] };
export function strongMark(def, drive, pc, runs) {
  let worst = Infinity, rows = [];
  for (let k = 0; k < runs; k++) {
    const r = strongRace(def, { drive }, pc, raceDisturb(k));
    const share = r.rival > 0 ? r.total / r.rival - 1 : 0;
    const v = (r.respawns || r.handsBroken || !r.finished) ? -9 : share - STRONG.LATE * Math.max(0, r.seconds - r.rivalSeconds);
    rows.push(r); if (v < worst) worst = v;
  }
  return { value: worst, races: rows };
}
/* where he starts: besides random sets, the measuring players' numbers
   (their own, and those searched for this track and car where any were),
   each as a whole driver that may slide any corner, so the search is not
   left to luck on a track where a known good set exists */
export function strongSeeds(def, pc) {
  const e = PLAYERS.AT[atKey(def.track, pc.car, pc.up)] || {};
  const seeds = [];
  for (const kind of ['slide', 'mixed', 'grip']) { seeds.push(PLAYERS[kind].drive); if (e[kind]) seeds.push(Object.assign({}, PLAYERS[kind].drive, e[kind])); }
  return seeds;
}
export function strongDriver(def, pc, n, seed) {
  rs = seed || (7 + def.track);
  let best = null;
  for (const drive of strongSeeds(def, pc)) {
    const m = strongMark(def, drive, pc, STRONG.RUNS);
    if (!best || m.value > best.value) best = { value: m.value, drive: { ...drive }, races: m.races, from: 'seed' };
  }
  for (let k = 0; k < n * 2; k++) {
    const local = k >= n && best, drive = Object.assign({}, local ? best.drive : {});
    for (const key of Object.keys(SRANGES)) {
      const [a, b] = SRANGES[key];
      if (local) { if (rnd() < 0.3) { const cur = drive[key] !== undefined ? drive[key] : RIVAL_DRIVE[key]; drive[key] = round(key, Math.max(a, Math.min(b, cur + (rnd() - 0.5) * (b - a) * 0.25))); } }
      else drive[key] = round(key, a + (b - a) * rnd());
    }
    const m = strongMark(def, drive, pc, STRONG.RUNS);
    if (!best || m.value > best.value) best = { value: m.value, drive, races: m.races, from: local ? 'local' : 'random' };
  }
  return best;
}
/* reach.js to the letter: the best solo total from the centre of the grid, over the race's laps in the player's car */
export function strongLiteral(index, laps, pc, n, seed) {
  rs = seed || (7 + index);
  const spec = careerSpec(index);
  const deps = { createRival, trackFor, careerSpec: () => spec, battleLaps: () => laps, STEP, LAUNCH };
  const def = { id: 'strong', name: 'strong', car: pc.car, up: pc.up || undefined, paint: 'white', track: index, side: 0, drive: {} };
  let best = null, bestDrive = {};
  for (let k = 0; k < n * 2; k++) {
    const local = k >= n && best, drive = Object.assign({}, local ? bestDrive : {});
    for (const key of Object.keys(RANGES)) {
      const [a, b] = RANGES[key];
      if (local) { if (rnd() < 0.3) { const cur = drive[key] !== undefined ? drive[key] : RIVAL_DRIVE[key]; drive[key] = round(key, Math.max(a, Math.min(b, cur + (rnd() - 0.5) * (b - a) * 0.25))); } }
      else drive[key] = round(key, a + (b - a) * rnd());
    }
    const m = measureCore(deps, { ...def, drive }, { maxSeconds: 300 });
    if (m.finished && m.respawns === 0 && (!best || m.total > best.total)) { best = { total: m.total, seconds: m.seconds, contacts: m.contacts }; bestDrive = drive; }
  }
  return { solo: best, drive: bestDrive };
}
/* the strong driver racing him: a scripted player with a player's hands that sees him and keeps clear */
export function strongRace(def, strong, pc, o) {
  let drv = null;
  const who = (world, rival) => {
    if (!drv) drv = createRivalDriver(trackFor(careerSpec(def.track)), strong.drive, { HANDS: 1 }, null, null, () => (rival.solid() ? rival.world.car : null));
    return drv.input(world);
  };
  const r = runRace(def, who, { car: pc.car, up: pc.up || undefined, ...(o || {}) });
  delete r.trace;
  return r;
}
export function headroom(r) {
  const ahead = r.finished && r.seconds < r.rivalSeconds, share = r.rival > 0 ? r.total / r.rival - 1 : Infinity;
  return { ahead, share: +share.toFixed(3), pass: ahead && share >= HEAD.SHARE && r.handsBroken === 0 };
}

/* the sanity check: 20 disturbed races for each scripted player, and one parked */
const disturb = k => k === 0 ? {} : { offset: [DISTURB[k % 20].offset[1], DISTURB[k % 20].offset[0]], rivalOpts: DISTURB[(k * 7) % 20] };
export function sanity(def, pc, runs) {
  const at = def.track === 0, W = {};
  let lost = 0, handsBroken = 0;
  for (const who of ['grip', 'slide', 'mixed']) {
    const rs = Array.from({ length: runs }, (_, k) => runRace(def, who, { ...disturb(k), car: pc.car, up: pc.up || undefined, at }));
    W[who] = rs.filter(r => r.won).length; lost += rs.length - W[who]; handsBroken += rs.reduce((a, r) => a + r.handsBroken, 0);
  }
  const still = runRace(def, 'still', { car: pc.car, up: pc.up || undefined });
  const won = W.grip + W.slide + W.mixed;
  return { players: at ? 'PLAYERS.AT (searched on First slide, where it passed)' : 'their own numbers', wins: W, won, lost, handsBroken, still: { total: still.total, rival: still.rival, won: still.won }, pass: won >= 1 && lost >= 1 && !still.won && handsBroken === 0 };
}

/* the staircase over rows in ladder order */
export function staircase(rows) {
  return rows.map((r, k) => {
    const prev = k ? rows[k - 1].multiple : null, step = prev ? r.multiple / prev - 1 : null;
    return { id: r.id, name: r.name, multiple: r.multiple, step: step === null ? null : +step.toFixed(3), pass: k === 0 || step >= STAIR.STEP };
  });
}

function measureRow(def, o) {
  const pc = carFor(def);
  const R0 = rateOf(def);
  const strong = strongDriver(def, pc, o.n || STRONG.N);
  const race = strong.races[0], h = headroom(race);
  const worst = strong.races.map(r => ({ seconds: r.seconds, rivalSeconds: r.rivalSeconds, total: r.total, rival: r.rival, ...headroom(r) }));
  const allPass = worst.every(w => w.pass);
  let literal = null;
  if (o.literal) { const L = strongLiteral(def.track, R0.laps, pc, o.n || STRONG.N); const lr = strongRace(def, L, pc); literal = { solo: L.solo, drive: L.drive, race: { seconds: lr.seconds, rivalSeconds: lr.rivalSeconds, total: lr.total, rival: lr.rival, wallHits: lr.wallHits }, ...headroom(lr) }; }
  const san = o.sanity ? sanity(def, pc, o.runs) : null;
  return {
    id: def.id, name: def.name, style: def.style, track: def.track, trackName: careerSpec(def.track).name, laps: R0.laps, car: def.car, up: def.up || null,
    seconds: R0.m.seconds, points: R0.m.total, parts: { drift: R0.m.drift, clean: R0.m.clean, pace: R0.m.pace }, rate: +R0.rate.toFixed(2), threeStarRate: +R0.star.toFixed(2), multiple: +R0.multiple.toFixed(3),
    driving: { respawns: R0.m.respawns, hard: R0.m.hard, contacts: R0.m.contacts, worstCorner: +R0.m.worstCorner.toFixed(3), guard: R0.m.hands.overruled },
    playerCar: pc.label, strong: { drive: strong.drive, from: strong.from, value: +strong.value.toFixed(3), race: { seconds: race.seconds, rivalSeconds: race.rivalSeconds, total: race.total, rival: race.rival, parts: race.parts, rivalParts: race.rivalParts, wallHits: race.wallHits, hard: race.hard, bodyHits: race.bodyHits, respawns: race.respawns, handsBroken: race.handsBroken }, ...h, runs: worst, pass: allPass, worstShare: Math.min(...worst.map(w => w.share)) },
    strongLiteral: literal,
    sanity: san, measured: new Date().toISOString().slice(0, 10),
  };
}

if (process.argv[1] && process.argv[1].endsWith('ladder3/ruler.js')) {
  const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? +args[args.indexOf(k) + 1] : d;
  const file = process.env.RULER_OUT || path.join(dir, 'ruler.json');
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { rows: {} };
  out.definition = { STAIR, HEAD, SANITY, STRONG, PAR_SPEED: TUNE.SCORING.PAR_SPEED, playerCar: PLAYER_CAR };
  const ids = args.filter(a => /^r\d$/.test(a));
  const list = ids.length ? ids.map(rivalById) : args.includes('--known') ? [] : RIVALS;
  let fails = 0;
  const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
  for (const def of list) {
    const row = measureRow(def, { n: arg('--n', STRONG.N), sanity: !args.includes('--no-sanity'), runs: arg('--runs', SANITY.RUNS), literal: args.includes('--literal') });
    out.rows[def.id] = row;
    const s = row.strong;
    console.log(def.name + ': career ' + (def.track + 1) + ' ' + row.trackName + ', ' + row.laps + ' laps, ' + def.car + '; ' + row.seconds + ' s, ' + row.points + ' points, ' + row.rate + ' a second against ' + row.threeStarRate + ': x' + row.multiple);
    if (row.strongLiteral) { const L = row.strongLiteral; console.log('     reach.js to the letter (best solo ' + (L.solo ? L.solo.total + ' in ' + L.solo.seconds + ' s from the centre' : 'none') + ') races him: ' + L.race.seconds + ' s against ' + L.race.rivalSeconds + ', ' + L.race.total + ' against ' + L.race.rival + ' (' + Math.round(L.share * 100) + '%)' + (L.pass ? ', passes' : ', FAILS')); }
    verdict(s.pass, def.name + ' headroom and pace, worst of ' + s.runs.length + ' races ' + s.runs.map(w => w.seconds + '/' + w.rivalSeconds + ' s ' + (w.share >= 0 ? '+' : '') + Math.round(w.share * 100) + '%').join(', ') + ': the strong driver (' + row.playerCar + ') races him: ' + s.race.seconds + ' s against ' + s.race.rivalSeconds + ', ' + s.race.total + ' against ' + s.race.rival + ' (' + (s.share >= 0 ? '+' : '') + Math.round(s.share * 100) + '%, bar +' + HEAD.SHARE * 100 + '%), walls ' + s.race.wallHits + ', contacts ' + s.race.bodyHits + ', respawns ' + s.race.respawns + ', hands broken ' + s.race.handsBroken);
    if (row.sanity) verdict(row.sanity.pass, def.name + ' sanity (' + row.sanity.players + '): wins of 20 grip ' + row.sanity.wins.grip + ', slide ' + row.sanity.wins.slide + ', mixed ' + row.sanity.wins.mixed + ' (' + row.sanity.won + ' won, ' + row.sanity.lost + ' lost of 60); parked ' + row.sanity.still.total + ' against ' + row.sanity.still.rival + (row.sanity.still.won ? ' WINS' : ', loses'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(out, null, 1));
  }
  const rows = RIVALS.map(d => out.rows[d.id]).filter(Boolean);
  if (rows.length) {
    const st = staircase(rows);
    out.staircase = st;
    console.log('\nrival     track                 laps car          s      points rate   3*rate  mult   step    strong s / his s     strong / his        sanity W/L  parked');
    for (const r of rows) {
      const sp = st.find(x => x.id === r.id);
      console.log(r.name.padEnd(9) + ' ' + (r.track + 1 + ' ' + r.trackName).padEnd(21) + ' ' + String(r.laps).padEnd(3) + ' ' + r.car.padEnd(12) + ' ' + String(r.seconds).padEnd(6) + ' ' + String(r.points).padEnd(6) + ' ' + String(r.rate).padEnd(6) + ' ' + String(r.threeStarRate).padEnd(7) + ' ' + r.multiple.toFixed(2).padEnd(6) + ' ' + (sp.step === null ? 'bottom' : (sp.step >= 0 ? '+' : '') + (sp.step * 100).toFixed(1) + '%').padEnd(7) + ' ' + (r.strong.race.seconds + ' / ' + r.strong.race.rivalSeconds).padEnd(20) + ' ' + (r.strong.race.total + ' / ' + r.strong.race.rival + ' ' + (r.strong.share >= 0 ? '+' : '') + Math.round(r.strong.share * 100) + '%').padEnd(19) + ' ' + (r.sanity ? (r.sanity.won + '/' + r.sanity.lost).padEnd(11) + ' ' + (r.sanity.still.won ? 'WINS' : 'loses') : '-'));
    }
    verdict(st.every(s => s.pass), 'the staircase (each at least +' + STAIR.STEP * 100 + '% on the one before): ' + st.map(s => s.name + ' x' + s.multiple.toFixed(2) + (s.step === null ? '' : ' (' + (s.step >= 0 ? '+' : '') + (s.step * 100).toFixed(1) + '%' + (s.pass ? '' : ', FAILS') + ')')).join(', '));
    /* known answer: two adjacent rivals swapped */
    if (rows.length >= 2) {
      const swaps = [];
      for (let k = 1; k < rows.length; k++) { const s = rows.slice(); [s[k - 1], s[k]] = [s[k], s[k - 1]]; swaps.push({ swapped: rows[k - 1].name + ' and ' + rows[k].name, caught: !staircase(s).every(x => x.pass) }); }
      out.knownSwap = swaps;
      verdict(swaps.every(s => s.caught), 'known answer: two rivals swapped fails the staircase: ' + swaps.map(s => s.swapped + ' ' + (s.caught ? 'caught' : 'MISSED')).join(', '));
    }
  }
  /* known answer: a rival given the strong driver's own driving and car */
  if (args.includes('--known')) {
    const known = [];
    for (const id of (ids.length ? ids : RIVALS.slice(0, +(process.env.KNOWN_LIVE || 2)).map(d => d.id))) {
      const def = rivalById(id), row = out.rows[id];
      if (!row) continue;
      const pc = carFor(def), strong = { drive: row.strong.drive };   // the twin: his car and numbers the strong driver's
      const twin = { ...def, car: pc.car, up: pc.up || undefined, drive: { ...strong.drive } };
      const r = strongRace(twin, strong, pc), h = headroom(r);
      known.push({ id, seconds: r.seconds, rivalSeconds: r.rivalSeconds, total: r.total, rival: r.rival, share: h.share, caught: !h.pass });
      verdict(!h.pass, 'known answer: ' + def.name + ' given the strong driver\'s own driving and car: ' + r.seconds + ' s against ' + r.rivalSeconds + ', ' + r.total + ' against ' + r.rival + ' (' + Math.round(h.share * 100) + '%): ' + (h.pass ? 'MISSED, the headroom passes' : 'CAUGHT, the headroom fails'));
    }
    out.knownTwin = known;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(fails ? fails + ' failed' : 'all passed');
  process.exit(fails ? 1 : 0);
}
