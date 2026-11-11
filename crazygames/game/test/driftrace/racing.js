/* DRIFT RACE MEASURE 3 (briefs/DRIFT-RACE.md): THE RACE IS A RACE. In Node
   through the host's race step (race.js), against the rival on his
   track, in the starter with no upgrades. Three scripted players, each
   with only the player's hands (rivals/players.js): grip (the line, never
   a slide), slide (every corner), mixed (the drift corners slid, the
   rest on grip); and a player who never moves. Each plays RUNS races:
   the undisturbed one and the rest with the player's start a few cm off
   and the rival's start and grip a little off (hands.js DISTURB). For
   each: his finish time against the rival's, the share of the race spent
   ahead, the lead gates won, both totals, who wins, and how many times
   the place changed hands. Worst cases and counts.

   The bar (the brief's):
   - the place changes hands at least once in every mixed race;
   - no player is ahead for all of every race, or behind for all of
     every race (if one is, the rival's pace is wrong);
   - the mixed player wins every race; the player who never moves loses;
   - with the close bonus at nothing, the mixed player still wins every
     race; with the lead and line bonuses at nothing, who wins is
     reported, not judged;
   - and the two edge cases the author is to judge, in numbers: a player
     who leads all the way but never slides, and one who slides well but
     trails all the way.
   Known answers: a rival made far too slow (KNOWN_SLOW) is behind every
   player all the way, and the pace check catches it; the mixed player's
   win check fails against a rival who drives as the slide player does
   (KNOWN_STRONG).

   node game/test/driftrace/racing.js [r1] [--runs 20]   writes review/driftrace/racing.json */
import path from 'node:path';
import fs from 'node:fs';
import { runRace } from './race.js';
import { DISTURB } from './hands.js';
import { rivalById } from '../../src/rivals/roster.js';
import { TANDEM } from '../../src/tune.js';
import { PLAYERS } from '../../src/rivals/players.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const outDir = path.resolve(here, '..', '..', '..', 'review', 'driftrace');
const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? +args[args.indexOf(k) + 1] : d;
const def = rivalById(args.find(a => /^r\d/.test(a)) || 'r1');
const RUNS = arg('--runs', 20);
export const KNOWN_SLOW = { VMAX: 16, ENTRY: 12 };
let failed = 0;
const verdict = (ok, text) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); return ok; };

/* the k-th race's disturbances: the player's start, and the rival's start and grip */
const disturb = k => k === 0 ? {} : { offset: [DISTURB[k % 20].offset[1], DISTURB[k % 20].offset[0]], rivalOpts: DISTURB[(k * 7) % 20] };
export function races(d, who, n, extra) { return Array.from({ length: n }, (_, k) => { const r = runRace(d, who, { ...disturb(k), ...(extra || {}) }); delete r.trace; return r; }); }
const allAhead = r => r.changes === 0 && r.aheadShare > 0.5, allBehind = r => r.changes === 0 && r.aheadShare <= 0.5;
function summary(rs) {
  const mm = f => [Math.min(...rs.map(f)), Math.max(...rs.map(f))];
  return {
    runs: rs.length, wins: rs.filter(r => r.won).length,
    seconds: mm(r => r.seconds), rivalSeconds: mm(r => r.rivalSeconds), timeGap: mm(r => +(r.seconds - r.rivalSeconds).toFixed(2)),
    aheadShare: mm(r => r.aheadShare), leadGates: mm(r => r.leadGates), changes: mm(r => r.changes), lineWon: rs.filter(r => r.lineTo === 'player').length,
    total: mm(r => r.total), rival: mm(r => r.rival), margin: mm(r => r.margin),
    allAhead: rs.filter(allAhead).length, allBehind: rs.filter(allBehind).length,
    wallHits: Math.max(...rs.map(r => r.wallHits)), hard: Math.max(...rs.map(r => r.hard)), bodyHits: Math.max(...rs.map(r => r.bodyHits)), respawns: Math.max(...rs.map(r => r.respawns)), handsBroken: Math.max(...rs.map(r => r.handsBroken)),
    parts: rs[0].parts, rivalParts: rs[0].rivalParts,
  };
}
const fmt = s => 'wins ' + s.wins + ' of ' + s.runs + '; finish ' + s.seconds.join(' to ') + ' s against his ' + s.rivalSeconds.join(' to ') + ' s; ahead ' + s.aheadShare.map(v => Math.round(v * 100) + '%').join(' to ') + ' of the race; lead gates ' + s.leadGates.join(' to ') + ' of ' + (TANDEM.LEAD_SHARE ? 'the gates' : '') + '; first home ' + s.lineWon + '; place changes ' + s.changes.join(' to ') + '; totals ' + s.total.join(' to ') + ' against ' + s.rival.join(' to ') + '; walls ' + s.wallHits + ' (hard ' + s.hard + '), contacts with him ' + s.bodyHits + ', respawns ' + s.respawns;

const out = { rival: def.id, runs: RUNS, players: {}, noLeads: {}, noClose: {}, edges: {} };
const all = {};
for (const who of ['grip', 'slide', 'mixed']) {
  const rs = races(def, who, RUNS);
  all[who] = rs;
  const s = summary(rs);
  out.players[who] = { ...s, races: rs.map(r => ({ seconds: r.seconds, rivalSeconds: r.rivalSeconds, total: r.total, rival: r.rival, won: r.won, aheadShare: r.aheadShare, leadGates: r.leadGates, rivalGates: r.rivalGates, lineTo: r.lineTo, changes: r.changes, parts: r.parts, rivalParts: r.rivalParts, wallHits: r.wallHits, bodyHits: r.bodyHits })) };
  console.log(who.padEnd(5) + ' ' + fmt(s));
  verdict(s.handsBroken === 0, who + ': only the player\'s hands on every step of every race');
  verdict(!(s.allAhead === RUNS) && !(s.allBehind === RUNS), who + ': not ahead all the way in every race (' + s.allAhead + ' of ' + RUNS + ' ahead all the way) and not behind all the way in every race (' + s.allBehind + ' of ' + RUNS + ')');
}
const mixed = summary(all.mixed);
verdict(all.mixed.every(r => r.changes >= 1), 'the place changes hands at least once in every mixed race: ' + all.mixed.filter(r => r.changes >= 1).length + ' of ' + RUNS + ' (fewest changes ' + mixed.changes[0] + ')');
verdict(mixed.wins === RUNS, 'the mixed player wins every race: ' + mixed.wins + ' of ' + RUNS + ', the narrowest margin ' + mixed.margin[0]);
const still = runRace(def, 'still');
out.still = { total: still.total, rival: still.rival, won: still.won };
verdict(!still.won, 'a player who never moves loses: ' + still.total + ' against ' + still.rival);

/* the bonuses at nothing */
const keep = { lead: TANDEM.LEAD_SHARE, line: TANDEM.LINE_SHARE, close: TANDEM.BONUS };
TANDEM.LEAD_SHARE = 0; TANDEM.LINE_SHARE = 0;
for (const who of ['grip', 'slide', 'mixed']) { const s = summary(races(def, who, RUNS)); out.noLeads[who] = s; console.log('no lead or line bonus: ' + who + ' wins ' + s.wins + ' of ' + RUNS + ' (margin ' + s.margin.join(' to ') + ')'); }
TANDEM.LEAD_SHARE = keep.lead; TANDEM.LINE_SHARE = keep.line; TANDEM.BONUS = 0;
for (const who of ['grip', 'slide', 'mixed']) { const s = summary(races(def, who, RUNS)); out.noClose[who] = s; console.log('no close bonus: ' + who + ' wins ' + s.wins + ' of ' + RUNS + ' (margin ' + s.margin.join(' to ') + ')'); }
TANDEM.BONUS = keep.close;
verdict(out.noClose.mixed.wins === RUNS, 'with the close bonus at nothing the mixed player still wins every race: ' + out.noClose.mixed.wins + ' of ' + RUNS + ', the narrowest margin ' + out.noClose.mixed.margin[0]);

/* the two edge cases, in numbers: from the races, and the arithmetic of a race led (or trailed) at every gate */
const g = all.grip[0], sl = all.slide[0], gates = g.gates - 1, perGate = Math.round((g.parts.leads + g.rivalParts.leads) / gates), line = g.parts.line + g.rivalParts.line;
const soloOf = p => p.drift + p.clean + p.pace + p.close;
const rivalSolo = soloOf(g.rivalParts);
out.edges = {
  perGate, gates, line, rivalSolo,
  leadsNeverSlides: { races: all.grip.filter(allAhead).length, ofRuns: RUNS, playerSolo: soloOf(g.parts), playerTotalIfLedAll: soloOf(g.parts) + gates * perGate + line, rivalTotalIfLedAll: rivalSolo, drift: g.parts.drift, aheadShare: g.aheadShare, won: g.won, total: g.total, rival: g.rival },
  slidesTrailsAll: { races: all.slide.filter(allBehind).length, ofRuns: RUNS, playerSolo: soloOf(sl.parts), playerTotalIfTrailedAll: soloOf(sl.parts), rivalTotalIfTrailedAll: rivalSolo + gates * perGate + line, aheadShare: sl.aheadShare, won: sl.won, total: sl.total, rival: sl.rival },
};
const E = out.edges;
console.log('EDGE a player who leads all the way but never slides (the grip player): in its races ahead ' + Math.round(g.aheadShare * 100) + '% of the undisturbed race, ' + g.total + ' against ' + g.rival + (g.won ? ' (wins)' : ' (loses)') + '; had he led every gate and the line: ' + E.leadsNeverSlides.playerTotalIfLedAll + ' (' + E.leadsNeverSlides.playerSolo + ' of his own, of it ' + g.parts.drift + ' drift from the slip of a grip car and his braking, + ' + gates + ' gates at ' + perGate + ' + the line ' + line + ') against ' + rivalSolo + ' for the rival');
console.log('EDGE a player who slides well but trails all the way (the slide player): undisturbed ahead ' + Math.round(sl.aheadShare * 100) + '%, ' + sl.total + ' against ' + sl.rival + (sl.won ? ' (wins)' : ' (loses)') + '; had he trailed at every gate and the line: ' + E.slidesTrailsAll.playerTotalIfTrailedAll + ' against ' + E.slidesTrailsAll.rivalTotalIfTrailedAll + ' for the rival (' + rivalSolo + ' of his own + all ' + gates + ' gates and the line)');

/* known answers */
const slow = { ...def, drive: { ...def.drive, ...KNOWN_SLOW } };
const ks = ['grip', 'slide', 'mixed'].map(who => summary(races(slow, who, 4)));
const caughtSlow = ks.some(s => s.allAhead === s.runs);
verdict(caughtSlow, 'known answer: the rival made far too slow (' + JSON.stringify(KNOWN_SLOW) + ') is behind all the way in every race of ' + ks.filter(s => s.allAhead === s.runs).length + ' of the 3 players, and the pace check fails for him: ' + (caughtSlow ? 'CAUGHT' : 'MISSED') + ' (his time ' + ks[0].rivalSeconds.join(' to ') + ' s)');
const strong = { ...def, drive: PLAYERS.slide.drive };
const km = summary(races(strong, 'mixed', 4));
verdict(km.wins < km.runs, 'known answer: against a rival who drives as the slide player does (KNOWN_STRONG), the mixed player\'s win check fails: he wins ' + km.wins + ' of ' + km.runs + ' (' + km.total.join(' to ') + ' against ' + km.rival.join(' to ') + '): ' + (km.wins < km.runs ? 'CAUGHT' : 'MISSED'));
out.knownAnswers = { slow: ks.map(s => ({ allAhead: s.allAhead, runs: s.runs, rivalSeconds: s.rivalSeconds })), strong: { wins: km.wins, runs: km.runs, total: km.total, rival: km.rival } };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'racing.json'), JSON.stringify(out, null, 1));
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
