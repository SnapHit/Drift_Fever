/* MEASURING PLAYERS THAT ARE A FAIR MEASURE ON EVERY TRACK
   (briefs/RIVALS-LADDER-2.md priority 1).

   The three scripted players (grip, slide, mixed; rivals/players.js),
   each with only a player's hands, searched for each track and car they
   measure a rival on, as the rivals' driving is searched: a random
   search then a local one, each candidate driven alone (solo.js) from
   the player's place on the grid under small start disturbances and
   marked by its worst run. The winners go in PLAYERS.AT.

   THE BAR (PLAYER_BAR, set before measuring), on each place, over the
   undisturbed run and 20 disturbed ones (the race's start offsets) for
   each player:
   - every run finishes with no respawn (the brief);
   - THE SPREAD: the slowest run of any of the three is at most 10 per
     cent slower than the fastest run of any. Why 10: a rival whose pace
     sits in the middle of that band is then within 5 per cent of each
     player, about 4 s over a 90 s race, which is one corner on these
     tracks (a corner every 4 to 8 s), so a slide or a touch can change
     who leads; and it is under half the last round's 17 per cent (the
     slide player 14 to 17 s slower over three laps on every Pro
     circuit). The slide player is slower, as the brief says, but not by
     a quarter of a minute;
   - each player is what it is called: the slide player slides at least
     30 per cent of every corner in every run (the rival's own bar), the
     mixed player at least 30 per cent of every drift corner (42 m radius
     or tighter and turning 85 degrees or more, as game/test/stars/slot.js
     defines one), and the grip player's drift points are at most a tenth
     of its total.
   Known answer: the players' own numbers (chosen on career 1) on Upper
   deck, where the last round found the slide player 14 to 17 s slower,
   fail the spread.

   node game/test/ladder2/players.js search grip|slide|mixed --track 8 [--laps 3] [--car starter] [--up 1] [--n 150] [--seed 1] [--pace 95] [--from own|JSON|r1] [--from-log file] [--local] [--range KEY=a,b] [--offs 6: judge on the undisturbed start and the first 5 race offsets]
   node game/test/ladder2/players.js measure [--place 8:3:starter:1 ...] [--own]   writes review/ladder2/players.json */
import path from 'node:path';
import fs from 'node:fs';
import { soloPlayer } from './solo.js';
import { HAND_RANGES } from '../driftrace/search.js';
import { DISTURB } from '../driftrace/hands.js';
import { PLAYERS, atKey } from '../../src/rivals/players.js';
import { RIVAL_DRIVE } from '../../src/rivals/driver.js';
import { rivalById } from '../../src/rivals/roster.js';
import { CAREER } from '../../src/loop/modes.js';

export const PLAYER_BAR = { respawns: 0, spread: 0.10, slideCorner: 0.3, mixedCorner: 0.3, gripDrift: 0.1 };
/* the start offsets of the 20 disturbed races (ladder/rivals.js disturb): the player's start a few cm off */
export const OFFSETS = Array.from({ length: 20 }, (_, k) => [DISTURB[k].offset[1], DISTURB[k].offset[0]]);
/* the offsets a candidate is judged on in the search */
const SEARCH_OFFS = [[0, 0], OFFSETS[3], OFFSETS[11]];
const UP = n => n ? { power: n, grip: n, steer: n } : null;

/* how a candidate is marked: its worst run. Respawns, hard hits and wall
   contact cost most, then time; the slide and mixed players earn their
   drift points and must slide what they are for; the grip player pays for
   drift points; --pace is a time the run must not exceed */
export function markRun(kind, r, o) {
  let v = -(r.finished ? 0 : 20000) - r.respawns * 8000 - r.hard * 3000 - r.walls * 500 - r.seconds * 60;
  if (kind === 'grip') v -= r.drift * 8;
  if (kind === 'slide') v += r.drift * 0.6 - Math.max(0, PLAYER_BAR.slideCorner + 0.03 - r.worstCorner) * 30000;
  if (kind === 'mixed') v += r.drift * 1.5 - Math.max(0, PLAYER_BAR.mixedCorner + 0.03 - (r.worstTight === null ? 1 : r.worstTight)) * 30000;
  if (o && o.pace) v -= Math.max(0, r.seconds - o.pace) * 1500;
  return v;
}
export function judge(where, kind, drive, o) {
  let worst = Infinity, detail = null;
  for (const off of (o && o.offs) || SEARCH_OFFS) {
    const r = soloPlayer(where, kind, drive, { offset: off });
    const v = markRun(kind, r, o);
    if (v < worst) { worst = v; detail = { seconds: r.seconds, total: r.total, drift: r.drift, walls: r.walls, hard: r.hard, respawns: r.respawns, worstCorner: r.worstCorner, worstTight: r.worstTight, angle: r.angle }; }
  }
  return { value: worst, detail };
}

/* the best a search's log printed: its drive line, or the last improvement's numbers if it was stopped */
export function lastDrive(text) {
  const lines = text.split('\n'), d = lines.filter(l => l.startsWith('drive: '));
  if (d.length) return d[d.length - 1].slice(7);
  const imp = lines.filter(l => /^\d+ -?\d+ /.test(l));
  if (!imp.length) return null;
  const l = imp[imp.length - 1], k = l.lastIndexOf(' {');
  return l.slice(k + 1);
}

let rs = 1;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const round = (k, v) => /KEEP|COST|PROGRESS/.test(k) ? Math.round(v) : /TIME|GAIN|OUTSIDE/.test(k) ? +v.toFixed(3) : +v.toFixed(2);
const GRIP_KEYS = /VMAX|ENTRY|AY_MAX|OUTSIDE|SETUP|HB_OVER|HB_STEER|EDGE_SAFE/;

export function searchPlayer(where, kind, from, o) {
  rs = o.seed || 1;
  const ranges = Object.assign({}, HAND_RANGES, o.ranges || {});
  const keys = Object.keys(ranges).filter(k => kind !== 'grip' || GRIP_KEYS.test(k));
  let best = { drive: Object.assign({}, from), ...judge(where, kind, from, o) };
  console.log('start ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
  for (let k = 0; k < o.n; k++) {
    const local = k >= o.n * (o.localFrom === undefined ? 0.3 : o.localFrom), drive = Object.assign({}, local ? best.drive : from);
    for (const key of keys) {
      const [a, b] = ranges[key];
      if (local) { if (rnd() < 0.3) { const cur = drive[key] !== undefined ? drive[key] : RIVAL_DRIVE[key]; drive[key] = round(key, Math.max(a, Math.min(b, cur + (rnd() - 0.5) * (b - a) * 0.25))); } }
      else drive[key] = round(key, a + (b - a) * rnd());
    }
    const r = judge(where, kind, drive, o);
    if (r.value > best.value) { best = { drive, ...r }; console.log(k + ' ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail) + ' ' + JSON.stringify(drive)); }
  }
  return best;
}

/* one place measured: each player's undisturbed run and 20 disturbed ones */
export function measurePlace(where, own) {
  const out = { where, players: {} };
  for (const kind of ['grip', 'slide', 'mixed']) {
    const drive = own ? PLAYERS[kind].drive : null;
    const runs = [soloPlayer(where, kind, drive), ...OFFSETS.map(off => soloPlayer(where, kind, drive, { offset: off }))];
    const mm = f => [Math.min(...runs.map(f)), Math.max(...runs.map(f))];
    const P = {
      runs: runs.length, unfinished: runs.filter(r => !r.finished).length, respawns: Math.max(...runs.map(r => r.respawns)), withRespawn: runs.filter(r => r.respawns > 0).length,
      seconds: mm(r => r.seconds), total: mm(r => r.total), drift: mm(r => r.drift), hard: Math.max(...runs.map(r => r.hard)), walls: Math.max(...runs.map(r => r.walls)), withHard: runs.filter(r => r.hard > 0).length,
      worstCorner: Math.min(...runs.map(r => r.worstCorner)), worstTight: runs[0].worstTight === null ? null : Math.min(...runs.map(r => r.worstTight)), angle: runs[0].angle,
      gripShare: Math.max(...runs.map(r => r.total ? r.drift / r.total : 0)), handsBroken: Math.max(...runs.map(r => r.handsBroken)), minKmh: Math.min(...runs.map(r => r.minKmh)),
    };
    P.character = kind === 'slide' ? P.worstCorner >= PLAYER_BAR.slideCorner : kind === 'mixed' ? (P.worstTight === null || P.worstTight >= PLAYER_BAR.mixedCorner) : P.gripShare <= PLAYER_BAR.gripDrift;
    out.players[kind] = P;
  }
  const Ps = Object.values(out.players), fastest = Math.min(...Ps.map(P => P.seconds[0])), slowest = Math.max(...Ps.map(P => P.seconds[1]));
  out.spread = +((slowest - fastest) / fastest).toFixed(4);
  out.spreadSeconds = +(slowest - fastest).toFixed(2);
  out.finishes = Ps.every(P => P.unfinished === 0 && P.respawns === 0 && P.handsBroken === 0);
  out.spreadOk = out.spread <= PLAYER_BAR.spread;
  out.characterOk = Ps.every(P => P.character);
  out.pass = out.finishes && out.spreadOk && out.characterOk;
  return out;
}
export function placeLine(m) {
  const w = m.where, P = m.players;
  return 'career ' + (w.index + 1) + ' ' + CAREER[w.index].name + ', ' + w.laps + ' laps, ' + (w.car || 'starter') + ' ' + (w.upLevel || 0) + ' of each: ' +
    ['grip', 'slide', 'mixed'].map(k => k + ' ' + P[k].seconds.join(' to ') + ' s (respawns ' + P[k].respawns + ', unfinished ' + P[k].unfinished + ', hard ' + P[k].hard + ' in ' + P[k].withHard + ' runs, walls ' + P[k].walls + ', drift ' + P[k].drift.join(' to ') + ', ' + (k === 'grip' ? 'drift share ' + Math.round(P[k].gripShare * 100) + '%' : k === 'slide' ? 'least corner ' + Math.round(P[k].worstCorner * 100) + '%' : 'least drift corner ' + (P[k].worstTight === null ? 'none' : Math.round(P[k].worstTight * 100) + '%')) + ')').join('; ') +
    '; spread ' + m.spreadSeconds + ' s, ' + (m.spread * 100).toFixed(1) + '%';
}

/* a place on the command line: index:laps:car:upLevel[:side] */
export function parsePlace(s) { const [i, l, c, u, side] = s.split(':'); return { index: +i, laps: +l, car: c || 'starter', up: UP(+u || 0), upLevel: +u || 0, side: side ? +side : 1 }; }
export function placeKey(w) { return atKey(w.index, w.car, w.up); }

if (process.argv[1] && process.argv[1].endsWith('ladder2/players.js')) {
  const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
  if (args[0] === 'search') {
    const kind = args[1];
    const where = { index: +arg('--track', 0), laps: +arg('--laps', 3), car: arg('--car', 'starter'), up: UP(+arg('--up', 0)), side: +arg('--side', 1) };
    /* --range KEY=a,b widens or narrows one number's range */
    const ranges = {}; for (let i = 0; i < args.length; i++) if (args[i] === '--range') { const [k, v] = args[i + 1].split('='); ranges[k] = v.split(',').map(Number); }
    let f = arg('--from', 'own');
    /* --from-log: the best a previous search printed */
    if (args.includes('--from-log')) { f = lastDrive(fs.readFileSync(arg('--from-log'), 'utf8')) || f; }
    const from = f === 'own' ? PLAYERS[kind].drive : f === 'at' ? (PLAYERS.AT[placeKey(where)] || {})[kind] || PLAYERS[kind].drive : f.startsWith('{') ? JSON.parse(f) : PLAYERS[f] ? PLAYERS[f].drive : rivalById(f).drive;
    console.log('searching the ' + kind + ' player on career ' + (where.index + 1) + ' ' + CAREER[where.index].name + ', ' + where.laps + ' laps, ' + where.car + ' ' + JSON.stringify(where.up) + (arg('--pace') ? ', pace at most ' + arg('--pace') + ' s' : ''));
    const best = searchPlayer(where, kind, from, { n: +arg('--n', 150), seed: +arg('--seed', 1), pace: arg('--pace') ? +arg('--pace') : 0, localFrom: args.includes('--local') ? 0 : undefined, ranges, offs: args.includes('--offs') ? [[0, 0], ...OFFSETS.slice(0, +arg('--offs') - 1)] : undefined });
    console.log('best ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
    console.log('drive: ' + JSON.stringify(best.drive));
  } else if (args[0] === 'measure') {
    const file = process.env.PLAYERS_OUT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'review', 'ladder2', 'players.json');
    const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { bar: PLAYER_BAR, places: {}, own: {} };
    out.bar = PLAYER_BAR;
    const places = []; for (let i = 0; i < args.length; i++) if (args[i] === '--place') places.push(parsePlace(args[i + 1]));
    const own = args.includes('--own');
    let fails = 0;
    for (const w of places) {
      const m = measurePlace(w, own);
      const line = placeLine(m);
      console.log((m.pass ? 'PASS ' : 'FAIL ') + (own ? '[their own numbers] ' : '') + line + (m.pass ? '' : ' :: ' + [!m.finishes && 'a run did not finish clean of respawns', !m.spreadOk && 'spread over ' + PLAYER_BAR.spread * 100 + '%', !m.characterOk && 'a player is not what it is called'].filter(Boolean).join(', ')));
      if (!m.pass) fails++;
      m.measured = new Date().toISOString().slice(0, 10);
      (own ? out.own : out.places)[placeKey(w) + ':' + w.laps] = m;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(out, null, 1));
    process.exit(fails ? 1 : 0);
  }
}
