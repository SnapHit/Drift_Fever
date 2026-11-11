/* RIVALS MEASURE 3: THE BATTLE IS FAIR. For each rival on his track, in
   Node through the host's battle step (battle.js), over RUNS battles:
   the undisturbed one and RUNS - 1 with the chase driver's gap and the
   rival's start and grip a little off (search.js's kind of disturbance):
   - the chase driver (rivals/chase.js: his own driving in the player's
     car, following his line, holding a gap): the share of his sliding
     time it spends in the zone, and how many it wins. The Rookie rivals
     in the starter with no upgrades; for Pro and Legend, the first car
     and upgrades in LADDER with which it wins most of them;
   - the careful driver (physics/driver.js, no drifting) in the starter,
     and a player who never moves: they must lose every one;
   - known answer: the same chase battles with TANDEM.BONUS at nothing
     must lose to the first rival (most of them; all is reported).
   The undisturbed chase against the first rival is also run in the page.

   node game/test/rivals/fair.js [r1 ...]   writes review/rivals/fair.json */
import path from 'node:path';
import fs from 'node:fs';
import { runBattle } from './battle.js';
import { RIVALS, rivalById } from '../../src/rivals/roster.js';
import { TANDEM } from '../../src/tune.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const outFile = path.resolve(here, '..', '..', '..', 'review', 'rivals', 'fair.json');
export const RUNS = 12;
export const LADDER = [
  { car: 'starter', up: null }, { car: 'starter', up: { power: 3, grip: 3, steer: 3 } },
  { car: 'hatch', up: { power: 3, grip: 3, steer: 3 } }, { car: 'tourer', up: { power: 3, grip: 3, steer: 3 } },
  { car: 'fastback', up: { power: 3, grip: 3, steer: 3 } }, { car: 'driftbuild', up: { power: 3, grip: 3, steer: 3 } },
];
let failed = 0;
const verdict = (ok, text) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); return ok; };
const disturb = k => k === 0 ? {} : { chase: { GAP: 6.5 + ((k * 7) % 5 - 2) * 0.3 }, rivalOpts: { grip: ((k * 3) % 11 - 5) * 0.001, offset: [((k * 5) % 7 - 3) * 0.01, 0] } };
function series(def, who, car) {
  const rows = [];
  for (let k = 0; k < RUNS; k++) { const d = disturb(k); rows.push(runBattle(def, who, { ...d, car: car && car.car, up: car && car.up })); }
  return { wins: rows.filter(r => r.won).length, runs: rows.length, undisturbed: rows[0], worstMargin: Math.min(...rows.map(r => r.margin)), bestMargin: Math.max(...rows.map(r => r.margin)), zoneMin: +Math.min(...rows.map(r => r.zoneShare)).toFixed(3), zoneMean: +(rows.reduce((a, r) => a + r.zoneShare, 0) / rows.length).toFixed(3), rows: rows.map(r => ({ score: r.score, rival: r.rival, won: r.won, zone: r.zoneShare, tandem: r.tandem, wallHits: r.wallHits, bodyHits: r.bodyHits })) };
}
const ids = process.argv.slice(2).filter(a => /^r\d/.test(a));
const list = ids.length ? ids.map(rivalById) : RIVALS;
const out = { runs: RUNS, ladder: LADDER, rivals: {} };
for (const def of list) {
  const k = RIVALS.indexOf(def), rookie = k < 2;
  let used = null, chase = null;
  for (const car of rookie ? [LADDER[0]] : LADDER) { chase = series(def, 'chase', car); used = car; if (chase.wins * 2 > chase.runs) break; }
  const careful = series(def, 'careful', LADDER[0]), still = runBattle(def, 'still');
  const carName = used.car + (used.up ? ' with every upgrade' : ', no upgrades');
  verdict(chase.wins * 2 > chase.runs, def.id + ' ' + def.name + ' (career ' + (def.track + 1) + '): the chase driver in the ' + carName + ' wins ' + chase.wins + ' of ' + chase.runs + ' (worst margin ' + chase.worstMargin + ', undisturbed ' + chase.undisturbed.score + ' against ' + chase.undisturbed.rival + '), in the zone for ' + Math.round(chase.zoneMean * 100) + '% of his sliding on average, ' + Math.round(chase.zoneMin * 100) + '% at worst');
  verdict(careful.wins === 0, def.id + ': the careful driver loses all ' + careful.runs + ' (best margin ' + careful.bestMargin + ')');
  verdict(!still.won, def.id + ': a player who never moves loses (' + still.score + ' against ' + still.rival + ')');
  out.rivals[def.id] = { name: def.name, track: def.track, car: used, chase, careful: { ...careful, rows: undefined }, still: { score: still.score, rival: still.rival, won: still.won } };
  if (k === 0) {
    const b = TANDEM.BONUS; TANDEM.BONUS = 0;
    const none = series(def, 'chase', LADDER[0]); TANDEM.BONUS = b;
    verdict(none.wins * 2 < none.runs && !none.undisturbed.won, 'known answer: the same chase battles with no tandem bonus lose to ' + def.name + ': ' + (none.runs - none.wins) + ' of ' + none.runs + ' lost, the undisturbed one ' + none.undisturbed.score + ' against ' + none.undisturbed.rival + ': ' + (none.wins * 2 < none.runs && !none.undisturbed.won ? 'CAUGHT' : 'MISSED'));
    out.knownAnswer = { ...none, rows: undefined };
  }
}
let all = {}; try { all = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch (e) { all = {}; }
Object.assign(all, { runs: RUNS, ladder: LADDER }); all.rivals = Object.assign(all.rivals || {}, out.rivals); if (out.knownAnswer) all.knownAnswer = out.knownAnswer;
fs.writeFileSync(outFile, JSON.stringify(all, null, 1));
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
