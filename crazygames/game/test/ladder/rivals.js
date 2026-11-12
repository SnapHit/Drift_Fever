/* LADDER MEASURES 2 AND 3 (briefs/RIVALS-LADDER.md), FOR EACH RIVAL, AND
   THE LADDER TABLE.

   2. He drives well, robustly, with a player's hands: the drift race's
      measure 2 (driftrace/hands.js BAR, misses, DISTURB) on his track,
      laps and car: in the page (Chromium's Math, the record) and in Node
      under 20 disturbances. No respawn, no hard hit, at most 2 wall
      contacts, never under 40 km/h after the launch, every corner at
      least 30 per cent sliding, his total within 25 per cent of
      undisturbed; the brake never on, the throttle never below full,
      the guard never used. 0 of 20 may miss.
   3. He is a race: the three scripted players (grip, slide, mixed;
      rivals/players.js, only a player's hands), 20 disturbed races each
      (driftrace/race.js, the host's race step), in the car a player
      would plausibly drive by then (lib.js PLAYER_CAR):
      - no player wins 20 of 20 or loses 20 of 20 across all three: at
        least two of the three win at least 3 of 20, and none wins all 20;
      - no player is ahead all the way, or behind all the way, in every
        race;
      - a player who never moves loses.
   The ladder table: for each rival his track, car, laps, race time, his
   own total, his total as a multiple of his track's three star target
   (at his race's laps, and at the career's), the wins of each player out
   of 20 and the car they drove. The ladder climbs when, from each rival
   to the next, the players' total wins fall or his multiple rises.
   Known answer: with two rivals swapped in the order the check fails.

   Each run of this probe measures the rivals named (all six by default)
   and keeps the others' rows from review/ladder/rivals.json, so a rival
   can be measured on his own while he is searched.

   node game/test/ladder/rivals.js [r2 ...] [--runs 20] [--no-page]   writes review/ladder/rivals.json */
import path from 'node:path';
import fs from 'node:fs';
import * as R from './lib.js';
import { measureRival, measureCore } from '../rivals/sim.js';
import { BAR, DISTURB, misses, handsMiss } from '../driftrace/hands.js';
import { runRace } from '../driftrace/race.js';
import { RIVALS, rivalById } from '../../src/rivals/roster.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec, starTargets, battleLaps, lapsFor, chapterOf, CHAPTERS } from '../../src/loop/modes.js';

import { PLAYER_CAR } from './lib.js';
export const RACE = { MIN_WINS: 3, OF_PLAYERS: 2 };   // the brief: at least two of the three win at least 3 of 20

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? +args[args.indexOf(k) + 1] : d;
const RUNS = arg('--runs', 20);
const ids = args.filter(a => /^r\d$/.test(a));
const list = ids.length ? ids.map(rivalById) : RIVALS;
const file = process.env.LADDER_OUT || path.join(R.ladderDir, 'rivals.json');   // LADDER_OUT: a candidate's numbers kept apart from the record while he is searched
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { rows: {} };
out.bar = BAR; out.runs = RUNS; out.playerCar = PLAYER_CAR;

/* the k-th race's disturbances, as driftrace/racing.js: the player's start, and his start and grip */
const disturb = k => k === 0 ? {} : { offset: [DISTURB[k % 20].offset[1], DISTURB[k % 20].offset[0]], rivalOpts: DISTURB[(k * 7) % 20] };
const allAhead = r => r.changes === 0 && r.aheadShare > 0.5, allBehind = r => r.changes === 0 && r.aheadShare <= 0.5;
const mm = (rs, f) => [Math.min(...rs.map(f)), Math.max(...rs.map(f))];

let env = null;
if (!args.includes('--no-page')) env = await R.start();
for (const def of list) {
  const track = trackFor(careerSpec(def.track)), laps = battleLaps(track, def), ch = chapterOf(def.track), pc = PLAYER_CAR[ch];
  const t3 = starTargets(track, laps)[2], t3career = starTargets(track, lapsFor(track))[2];
  /* measure 2 */
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
  const node = measureRival(def);
  const base = page || node;
  const dist = DISTURB.map(d => measureRival(def, d));
  const bad = dist.map(m => misses(m, base)).filter(w => w.length);
  const own = misses(base);
  const worst = { respawns: Math.max(...dist.map(m => m.respawns)), hard: Math.max(...dist.map(m => m.hard)), contacts: Math.max(...dist.map(m => m.contacts)), minKmh: Math.min(...dist.map(m => m.minKmh)), worstCorner: +Math.min(...dist.map(m => m.worstCorner)).toFixed(2), total: mm(dist, m => m.total), seconds: mm(dist, m => m.seconds), guard: Math.max(...dist.map(m => m.hands.overruled)), brake: Math.max(...dist.map(m => m.hands.brakeSteps)), lift: Math.max(...dist.map(m => m.hands.liftSteps)) };
  const m2 = own.length === 0 && bad.length === 0;
  R.verdict(m2, def.name + ' (' + def.id + ') drives well with a player\'s hands, career ' + (def.track + 1) + ' ' + careerSpec(def.track).name + ', ' + laps + ' laps, ' + def.car + ': ' + (page ? 'in the page' : 'in Node') + ' ' + base.seconds + ' s, ' + base.total + ' points, respawns ' + base.respawns + ', hard ' + base.hard + ', contacts ' + base.contacts + ', lowest ' + base.minKmh + ' km/h, least sliding corner ' + Math.round(base.worstCorner * 100) + '%, hands ' + (handsMiss(base).length ? handsMiss(base).join(', ') : 'a player\'s') + (own.length ? ' :: ' + own.join(', ') : '') + '; under 20 disturbances ' + bad.length + ' miss (worst: respawns ' + worst.respawns + ', hard ' + worst.hard + ', contacts ' + worst.contacts + ', lowest ' + worst.minKmh + ' km/h, corner ' + Math.round(worst.worstCorner * 100) + '%, total ' + worst.total.join(' to ') + ', guard ' + worst.guard + ')' + (bad.length ? ' :: ' + bad.slice(0, 3).map(w => w.join(', ')).join('; ') : ''));
  /* measure 3 */
  const players = {};
  for (const who of ['grip', 'slide', 'mixed']) {
    const rs = Array.from({ length: RUNS }, (_, k) => { const r = runRace(def, who, { ...disturb(k), car: pc.car, up: pc.up || undefined }); delete r.trace; return r; });
    players[who] = { wins: rs.filter(r => r.won).length, allAhead: rs.filter(allAhead).length, allBehind: rs.filter(allBehind).length, seconds: mm(rs, r => r.seconds), rivalSeconds: mm(rs, r => r.rivalSeconds), total: mm(rs, r => r.total), rival: mm(rs, r => r.rival), margin: mm(rs, r => r.margin), aheadShare: mm(rs, r => r.aheadShare), changes: mm(rs, r => r.changes), leadGates: mm(rs, r => r.leadGates), lineWon: rs.filter(r => r.lineTo === 'player').length, wallHits: Math.max(...rs.map(r => r.wallHits)), hard: Math.max(...rs.map(r => r.hard)), bodyHits: Math.max(...rs.map(r => r.bodyHits)), respawns: Math.max(...rs.map(r => r.respawns)), handsBroken: Math.max(...rs.map(r => r.handsBroken)), parts: rs[0].parts, rivalParts: rs[0].rivalParts };
    const P = players[who];
    console.log('     ' + who.padEnd(5) + ' wins ' + P.wins + ' of ' + RUNS + '; finish ' + P.seconds.join(' to ') + ' s against his ' + P.rivalSeconds.join(' to ') + '; ahead ' + P.aheadShare.map(v => Math.round(v * 100) + '%').join(' to ') + '; place changes ' + P.changes.join(' to ') + '; totals ' + P.total.join(' to ') + ' against ' + P.rival.join(' to ') + '; ahead all the way ' + P.allAhead + ', behind all the way ' + P.allBehind + '; walls ' + P.wallHits + ' (hard ' + P.hard + '), contacts with him ' + P.bodyHits + ', respawns ' + P.respawns + ', hands broken ' + P.handsBroken);
  }
  const still = runRace(def, 'still', { car: pc.car, up: pc.up || undefined });
  const W = ['grip', 'slide', 'mixed'].map(w => players[w].wins);
  const raceOk = W.filter(n => n >= RACE.MIN_WINS).length >= RACE.OF_PLAYERS && W.every(n => n < RUNS);
  const paceOk = ['grip', 'slide', 'mixed'].every(w => players[w].allAhead < RUNS && players[w].allBehind < RUNS);
  const handsOk = ['grip', 'slide', 'mixed'].every(w => players[w].handsBroken === 0);
  R.verdict(raceOk, def.name + ' is a race: wins of 20, grip ' + W[0] + ', slide ' + W[1] + ', mixed ' + W[2] + ' (at least two of three win ' + RACE.MIN_WINS + ' or more, none wins all ' + RUNS + ')');
  R.verdict(paceOk, def.name + ': no player ahead all the way in every race, or behind all the way in every race (' + ['grip', 'slide', 'mixed'].map(w => w + ' ' + players[w].allAhead + ' ahead / ' + players[w].allBehind + ' behind').join(', ') + ')');
  R.verdict(!still.won, def.name + ': a player who never moves loses (' + still.total + ' against ' + still.rival + ')');
  R.verdict(handsOk, def.name + ': every scripted player had only the player\'s hands on every step');
  out.rows[def.id] = {
    id: def.id, name: def.name, style: def.style, track: def.track, trackName: careerSpec(def.track).name, kind: track.kind, laps, car: def.car, paint: def.paint, chapter: CHAPTERS[ch].name, playerCar: pc.label,
    seconds: base.seconds, total: base.total, target3: t3, multiple: +(base.total / t3).toFixed(3), target3career: t3career, multipleCareer: +(base.total / t3career).toFixed(3),
    wins: { grip: W[0], slide: W[1], mixed: W[2], all: W[0] + W[1] + W[2] },
    m2: { pass: m2, page, node: { ...node, trace: undefined }, worst, missing: bad.length, own }, m3: { pass: raceOk && paceOk && !still.won && handsOk, players, still: { total: still.total, rival: still.rival, won: still.won } },
    measured: new Date().toISOString().slice(0, 10),
  };
}
if (env) await env.close();

/* the ladder: from each rival to the next, the players' wins fall or his multiple rises */
export function climbs(rows) {
  const steps = [];
  for (let k = 1; k < rows.length; k++) { const a = rows[k - 1], b = rows[k]; steps.push({ from: a.name, to: b.name, winsFall: b.wins.all < a.wins.all, multipleRises: b.multiple > a.multiple, ok: b.wins.all < a.wins.all || b.multiple > a.multiple }); }
  return steps;
}
const rows = RIVALS.map(d => out.rows[d.id]).filter(Boolean);
console.log('\nrival     track                 laps  car         s      total  x3star (career)  grip slide mixed  all  player car');
for (const r of rows) console.log(r.name.padEnd(9) + ' ' + (r.track + 1 + ' ' + r.trackName).padEnd(21) + ' ' + String(r.laps).padEnd(5) + ' ' + r.car.padEnd(11) + ' ' + String(r.seconds).padEnd(6) + ' ' + String(r.total).padEnd(6) + ' ' + r.multiple.toFixed(2) + ' (' + r.multipleCareer.toFixed(2) + ')      ' + String(r.wins.grip).padEnd(4) + ' ' + String(r.wins.slide).padEnd(5) + ' ' + String(r.wins.mixed).padEnd(5) + ' ' + String(r.wins.all).padEnd(4) + ' ' + r.playerCar + (r.m2.pass && r.m3.pass ? '' : '  [' + (r.m2.pass ? '' : 'm2 FAILS ') + (r.m3.pass ? '' : 'm3 FAILS') + ']'));
if (rows.length >= 2) {
  const steps = climbs(rows);
  out.climbs = steps;
  R.verdict(steps.every(s => s.ok), 'the ladder climbs over the ' + rows.length + ' rivals measured: ' + steps.map(s => s.from + ' to ' + s.to + ' ' + (s.ok ? (s.winsFall ? 'wins fall' : '') + (s.winsFall && s.multipleRises ? ', ' : '') + (s.multipleRises ? 'multiple rises' : '') : 'DOES NOT CLIMB')).join('; '));
  /* known answer: two rivals swapped in the order; every adjacent swap is tried and the first pair's must be caught */
  const swaps = [];
  for (let k = 1; k < rows.length; k++) { const s = rows.slice(); [s[k - 1], s[k]] = [s[k], s[k - 1]]; swaps.push({ swapped: rows[k - 1].name + ' and ' + rows[k].name, caught: !climbs(s).every(x => x.ok) }); }
  out.knownAnswer = swaps;
  R.verdict(swaps[0].caught, 'known answer: with ' + swaps[0].swapped + ' swapped the check fails: ' + (swaps[0].caught ? 'CAUGHT' : 'MISSED') + ' (every adjacent swap: ' + swaps.map(s => s.swapped + ' ' + (s.caught ? 'caught' : 'missed')).join(', ') + ')');
}
R.writeJson(file, out);
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
