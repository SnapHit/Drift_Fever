/* LADDER2 MEASURES 2 AND 3 (briefs/RIVALS-LADDER-2.md), FOR EACH RIVAL,
   AND THE LADDER TABLE.

   2. He drives well, robustly, on a plateau: the ladder round's measure
      2 (driftrace/hands.js BAR: in the page, the record, and in Node
      under 20 disturbances, 0 may miss; only a player's hands), plus the
      plateau (plateau.js: each number one per cent up and down, 5
      disturbed runs each, none missing). Kestrow is the author's and is
      not judged on the plateau (his numbers do not change); his plateau
      is reported.
   3. He is a race, and the ladder is a staircase. This round's measuring
      players (rivals/players.js PLAYERS.AT, searched for each track and
      car: players.js), 20 disturbed races each (driftrace/race.js), in
      the car named for his chapter (ladder/lib.js PLAYER_CAR):
      - at least two of the three win at least 3 of 20, none wins 20 of
        20, and none is ahead all the way or behind all the way in every
        race;
      - a player who never moves loses;
      - THE BAND: the three players' wins together, out of 60, fall from
        each rival to the next and stay within BAND.WITHIN of the
        straight line from BAND.FROM for Kestrow to BAND.TO for Sarrow.
   Kestrow's record with the players as they were (their own numbers,
   chosen on his track) is kept beside, as the brief asks.
   Known answers: two rivals swapped in the order fails the band (every
   adjacent swap tried); the Tolvo on main, raced by this round's
   players, is outside his band (--main-tolvo).

   Each run measures the rivals named (all six by default) and keeps the
   others' rows from the file, so a rival can be measured on his own.

   node game/test/ladder2/rivals.js [r2 ...] [--runs 20] [--no-page] [--no-plateau] [--main-tolvo]   writes review/ladder2/rivals.json */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../rivals/lib.js';
import { measureRival, measureCore } from '../rivals/sim.js';
import { BAR, DISTURB, misses, handsMiss } from '../driftrace/hands.js';
import { runRace } from '../driftrace/race.js';
import { plateau, MAIN_TOLVO } from './plateau.js';
import { RIVALS, rivalById } from '../../src/rivals/roster.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec, starTargets, battleLaps, chapterOf, CHAPTERS } from '../../src/loop/modes.js';
import { PLAYERS, atKey } from '../../src/rivals/players.js';
import { PLAYER_CAR } from '../ladder/lib.js';

export const RACE = { MIN_WINS: 3, OF_PLAYERS: 2 };   // the brief: at least two of the three win at least 3 of 20
export const BAND = { FROM: 27, TO: 12, WITHIN: 5 };  // the brief: 27 of 60 for Kestrow sliding down to about 12 for Sarrow, each within 5 of the line
export const bandAt = k => BAND.FROM + (BAND.TO - BAND.FROM) * k / (RIVALS.length - 1);

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? +args[args.indexOf(k) + 1] : d;
const RUNS = arg('--runs', 20);
const ids = args.filter(a => /^r\d$/.test(a));
const file = process.env.LADDER2_OUT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'review', 'ladder2', 'rivals.json');
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { rows: {} };
out.bar = BAR; out.runs = RUNS; out.playerCar = PLAYER_CAR; out.band = BAND;

/* the k-th race's disturbances, as the ladder round's: the player's start, and his start and grip */
const disturb = k => k === 0 ? {} : { offset: [DISTURB[k % 20].offset[1], DISTURB[k % 20].offset[0]], rivalOpts: DISTURB[(k * 7) % 20] };
const allAhead = r => r.changes === 0 && r.aheadShare > 0.5, allBehind = r => r.changes === 0 && r.aheadShare <= 0.5;
const mm = (rs, f) => [Math.min(...rs.map(f)), Math.max(...rs.map(f))];

/* 20 races for each player; at: this round's players (else their own numbers) */
export function races(def, pc, at, runs) {
  const players = {};
  for (const who of ['grip', 'slide', 'mixed']) {
    const rs = Array.from({ length: runs || RUNS }, (_, k) => { const r = runRace(def, who, { ...disturb(k), car: pc.car, up: pc.up || undefined, at }); delete r.trace; return r; });
    players[who] = { wins: rs.filter(r => r.won).length, allAhead: rs.filter(allAhead).length, allBehind: rs.filter(allBehind).length, seconds: mm(rs, r => r.seconds), rivalSeconds: mm(rs, r => r.rivalSeconds), total: mm(rs, r => r.total), rival: mm(rs, r => r.rival), margin: mm(rs, r => r.margin), aheadShare: mm(rs, r => r.aheadShare), changes: mm(rs, r => r.changes), lineWon: rs.filter(r => r.lineTo === 'player').length, wallHits: Math.max(...rs.map(r => r.wallHits)), hard: Math.max(...rs.map(r => r.hard)), bodyHits: Math.max(...rs.map(r => r.bodyHits)), respawns: Math.max(...rs.map(r => r.respawns)), handsBroken: Math.max(...rs.map(r => r.handsBroken)) };
  }
  const W = ['grip', 'slide', 'mixed'].map(w => players[w].wins);
  const still = runRace(def, 'still', { car: pc.car, up: pc.up || undefined });
  return { players, W, all: W[0] + W[1] + W[2], still: { total: still.total, rival: still.rival, won: still.won } };
}
const pline = P => 'wins ' + P.wins + '; finish ' + P.seconds.join(' to ') + ' s against his ' + P.rivalSeconds.join(' to ') + '; place changes ' + P.changes.join(' to ') + '; totals ' + P.total.join(' to ') + ' against ' + P.rival.join(' to ') + '; ahead all the way ' + P.allAhead + ', behind ' + P.allBehind + '; walls ' + P.wallHits + ' (hard ' + P.hard + '), contacts ' + P.bodyHits + ', respawns ' + P.respawns + ', hands broken ' + P.handsBroken;

/* the band: falls from each to the next, each within WITHIN of the line */
export function inBand(rows) {
  const steps = rows.map((r, k) => ({ name: r.name, k: RIVALS.findIndex(d => d.id === r.id), wins: r.wins.all }));
  return steps.map((s, j) => ({ ...s, line: +bandAt(s.k).toFixed(1), within: Math.abs(s.wins - bandAt(s.k)) <= BAND.WITHIN, falls: j === 0 || s.wins < steps[j - 1].wins }));
}

let env = null;
if (!args.includes('--no-page') && !args.includes('--main-tolvo')) env = await R.start();
const list = args.includes('--main-tolvo') ? [] : ids.length ? ids.map(rivalById) : RIVALS;
for (const def of list) {
  const track = trackFor(careerSpec(def.track)), laps = battleLaps(track, def), ch = chapterOf(def.track), pc = PLAYER_CAR[ch];
  const t3 = starTargets(track, laps)[2];
  let page = null;
  if (env) {
    const pg = await R.page(env, { width: 320, height: 180 }, '?rivals=all');
    page = await pg.page.evaluate(async ({ src, id }) => {
      const [rv, so, mo, wo] = await Promise.all([import('/src/rivals/rival.js'), import('/src/ground/source.js'), import('/src/loop/modes.js'), import('/src/physics/world.js')]);
      const f = new Function('return (' + src + ')')();
      const d = window.__loop.RIVALS.find(r => r.id === id);
      const m = f({ createRival: rv.createRival, trackFor: so.trackFor, careerSpec: mo.careerSpec, battleLaps: mo.battleLaps, STEP: wo.STEP, LAUNCH: 3 }, d, {});
      delete m.trace; return m;
    }, { src: measureCore.toString(), id: def.id });
    await pg.close();
  }
  const node = measureRival(def), base = page || node;
  const dist = DISTURB.map(d => measureRival(def, d));
  const bad = dist.map(m => misses(m, base)).filter(w => w.length), own = misses(base);
  const worst = { respawns: Math.max(...dist.map(m => m.respawns)), hard: Math.max(...dist.map(m => m.hard)), contacts: Math.max(...dist.map(m => m.contacts)), minKmh: Math.min(...dist.map(m => m.minKmh)), worstCorner: +Math.min(...dist.map(m => m.worstCorner)).toFixed(3), total: mm(dist, m => m.total), seconds: mm(dist, m => m.seconds), guard: Math.max(...dist.map(m => m.hands.overruled)) };
  const pl = args.includes('--no-plateau') ? null : plateau(def);
  const m2drive = own.length === 0 && bad.length === 0;
  const m2 = m2drive && (def.id === 'r1' || !pl || pl.pass);
  R.verdict(m2, def.name + ' (' + def.id + ') drives well, career ' + (def.track + 1) + ' ' + careerSpec(def.track).name + ', ' + laps + ' laps, ' + def.car + ': ' + (page ? 'in the page' : 'in Node') + ' ' + base.seconds + ' s, ' + base.total + ' points, respawns ' + base.respawns + ', hard ' + base.hard + ', contacts ' + base.contacts + ', lowest ' + base.minKmh + ' km/h, least sliding corner ' + Math.round(base.worstCorner * 100) + '%, hands ' + (handsMiss(base).length ? handsMiss(base).join(', ') : 'a player\'s') + (own.length ? ' :: ' + own.join(', ') : '') + '; under 20 disturbances ' + bad.length + ' miss (worst: hard ' + worst.hard + ', contacts ' + worst.contacts + ', lowest ' + worst.minKmh + ' km/h, corner ' + Math.round(worst.worstCorner * 100) + '%, total ' + worst.total.join(' to ') + ', guard ' + worst.guard + ')' + (bad.length ? ' :: ' + bad.slice(0, 3).map(w => w.join(', ')).join('; ') : '') +
    (pl ? '; plateau: ' + pl.missedVariants + ' of ' + pl.variants + ' variants miss (' + pl.missedRuns + ' of ' + pl.runs + ' runs)' + (def.id === 'r1' ? ', reported only: Kestrow is the author\'s' : '') + (pl.missed.length ? ' :: ' + pl.missed.slice(0, 4).map(r => r.key + ' ' + r.from + ' to ' + r.to).join(', ') : '') : ''));
  const hasAt = ['grip', 'slide', 'mixed'].every(k => PLAYERS.AT[atKey(def.track, pc.car, pc.up)] && PLAYERS.AT[atKey(def.track, pc.car, pc.up)][k]);
  if (!hasAt) R.verdict(false, def.name + ': no measuring players searched for career ' + (def.track + 1) + ' in ' + pc.label + ' (PLAYERS.AT ' + atKey(def.track, pc.car, pc.up) + ')');
  const rc = races(def, pc, true);
  for (const w of ['grip', 'slide', 'mixed']) console.log('     ' + w.padEnd(5) + ' ' + pline(rc.players[w]));
  const raceOk = rc.W.filter(n => n >= RACE.MIN_WINS).length >= RACE.OF_PLAYERS && rc.W.every(n => n < RUNS);
  const paceOk = ['grip', 'slide', 'mixed'].every(w => rc.players[w].allAhead < RUNS && rc.players[w].allBehind < RUNS);
  const handsOk = ['grip', 'slide', 'mixed'].every(w => rc.players[w].handsBroken === 0);
  R.verdict(raceOk, def.name + ' is a race: wins of 20, grip ' + rc.W[0] + ', slide ' + rc.W[1] + ', mixed ' + rc.W[2] + ', ' + rc.all + ' of 60 (at least two of three win ' + RACE.MIN_WINS + ' or more, none wins all ' + RUNS + ')');
  R.verdict(paceOk, def.name + ': no player ahead all the way, or behind all the way, in every race (' + ['grip', 'slide', 'mixed'].map(w => w + ' ' + rc.players[w].allAhead + ' / ' + rc.players[w].allBehind).join(', ') + ')');
  R.verdict(!rc.still.won, def.name + ': a player who never moves loses (' + rc.still.total + ' against ' + rc.still.rival + ')');
  R.verdict(handsOk, def.name + ': every measuring player had only the player\'s hands on every step');
  let record = null;
  if (def.id === 'r1') {
    const old = races(def, pc, false);
    record = { players: old.players, wins: { grip: old.W[0], slide: old.W[1], mixed: old.W[2], all: old.all } };
    console.log('     Kestrow with the players as they were (their own numbers): grip ' + old.W[0] + ', slide ' + old.W[1] + ', mixed ' + old.W[2] + ', ' + old.all + ' of 60 (the record)');
  }
  out.rows[def.id] = {
    id: def.id, name: def.name, style: def.style, track: def.track, trackName: careerSpec(def.track).name, kind: track.kind, laps, car: def.car, up: def.up || null, paint: def.paint, chapter: CHAPTERS[ch].name, playerCar: pc.label, players: atKey(def.track, pc.car, pc.up),
    seconds: base.seconds, total: base.total, target3: t3, multiple: +(base.total / t3).toFixed(3),
    wins: { grip: rc.W[0], slide: rc.W[1], mixed: rc.W[2], all: rc.all }, record,
    m2: { pass: m2, drive: m2drive, page, node: { ...node, trace: undefined }, worst, missing: bad.length, own, plateau: pl ? { pass: pl.pass, variants: pl.variants, runs: pl.runs, missedVariants: pl.missedVariants, missedRuns: pl.missedRuns, missed: pl.missed } : null },
    m3: { pass: raceOk && paceOk && !rc.still.won && handsOk && hasAt, players: rc.players, still: rc.still },
    drive: def.drive, measured: new Date().toISOString().slice(0, 10),
  };
}
if (env) await env.close();

/* the known answer of the band: the Tolvo on main raced by this round's players */
if (args.includes('--main-tolvo')) {
  const pc = PLAYER_CAR[0], rc = races(MAIN_TOLVO, pc, true);
  const lo = bandAt(1) - BAND.WITHIN, hi = bandAt(1) + BAND.WITHIN, outside = rc.all < lo || rc.all > hi;
  R.verdict(outside, 'known answer: the Tolvo on main raced by this round\'s players wins ' + rc.all + ' of 60 (grip ' + rc.W[0] + ', slide ' + rc.W[1] + ', mixed ' + rc.W[2] + '), his band ' + lo + ' to ' + hi + ': ' + (outside ? 'outside, CAUGHT' : 'inside, MISSED'));
  out.mainTolvo = { wins: { grip: rc.W[0], slide: rc.W[1], mixed: rc.W[2], all: rc.all }, band: [lo, hi], outside, players: rc.players };
}

const rows = RIVALS.map(d => out.rows[d.id]).filter(Boolean);
console.log('\nrival     track                 laps  car          s       total  x3star  grip slide mixed  all  line  players drove');
for (const r of rows) console.log(r.name.padEnd(9) + ' ' + (r.track + 1 + ' ' + r.trackName).padEnd(21) + ' ' + String(r.laps).padEnd(5) + ' ' + r.car.padEnd(12) + ' ' + String(r.seconds).padEnd(7) + ' ' + String(r.total).padEnd(6) + ' ' + r.multiple.toFixed(2).padEnd(7) + ' ' + String(r.wins.grip).padEnd(4) + ' ' + String(r.wins.slide).padEnd(5) + ' ' + String(r.wins.mixed).padEnd(5) + ' ' + String(r.wins.all).padEnd(4) + ' ' + bandAt(RIVALS.findIndex(d => d.id === r.id)).toFixed(0).padEnd(5) + ' ' + r.playerCar + (r.m2.pass && r.m3.pass ? '' : '  [' + (r.m2.pass ? '' : 'm2 FAILS ') + (r.m3.pass ? '' : 'm3 FAILS') + ']'));
if (rows.length) {
  const b = inBand(rows);
  out.bandCheck = b;
  R.verdict(b.every(s => s.within && s.falls), 'the band over the ' + rows.length + ' rivals measured: ' + b.map(s => s.name + ' ' + s.wins + ' (line ' + s.line + (s.within ? '' : ', OUTSIDE') + (s.falls ? '' : ', DOES NOT FALL') + ')').join('; '));
  if (rows.length >= 2) {
    const swaps = [];
    for (let k = 1; k < rows.length; k++) { const s = rows.slice(); [s[k - 1], s[k]] = [s[k], s[k - 1]]; const bb = inBand(s.map((r, j) => ({ ...r, id: rows[j].id }))); swaps.push({ swapped: rows[k - 1].name + ' and ' + rows[k].name, caught: !bb.every(x => x.within && x.falls) }); }
    out.knownAnswer = swaps;
    R.verdict(swaps.every(s => s.caught), 'known answer: two rivals swapped fails the band: ' + swaps.map(s => s.swapped + ' ' + (s.caught ? 'caught' : 'MISSED')).join(', '));
  }
}
R.writeJson(file, out);
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
