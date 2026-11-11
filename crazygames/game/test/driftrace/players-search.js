/* CHOOSING THE SCRIPTED PLAYERS' DRIVING (briefs/DRIFT-RACE.md measure
   3). Each of the three (rivals/players.js) drives alone on the rival's
   track, the race's laps, in the starter with no upgrades, with only a
   player's hands, under three small start disturbances. A random search,
   then a local one, over the look-ahead driver's numbers; the mark is
   its worst run: hard hits and wall contacts cost most, then time, and
   for the two that slide, the drift points. The winners go in PLAYERS.

   node game/test/driftrace/players-search.js grip|slide|mixed [--n 120] [--seed 1] [r1] */
import { runRace } from './race.js';
import { HAND_RANGES } from './search.js';
import { rivalById } from '../../src/rivals/roster.js';
import { RIVAL_DRIVE } from '../../src/rivals/driver.js';
import { PLAYERS } from '../../src/rivals/players.js';

const OFFS = [[0, 0], [0.03, -0.02], [-0.04, 0.03]];
export function markPlayer(def, kind, drive) {
  let worst = Infinity, detail = null;
  for (const off of OFFS) {
    const r = runRace(def, kind, { noRival: true, offset: off, playerOpts: drive });
    const solo = r.total - r.parts.leads - r.parts.line;
    let v = -r.hard * 3000 - r.wallHits * 500 - r.respawns * 8000 - (r.finished ? 0 : 20000) - r.seconds * 60;
    if (kind !== 'grip') v += r.parts.drift * (+process.env.DRIFT_WEIGHT || 0.6);
    /* the grip player never slides: drift points it earns anyway (the slip of a car at the limit, a brake with DRIFT) cost */
    else v -= r.parts.drift * (+process.env.GRIP_DRIFT_COST || 0);
    if (v < worst) { worst = v; detail = { seconds: r.seconds, solo, walls: r.wallHits, hard: r.hard, respawns: r.respawns, minKmh: r.minKmh }; }
  }
  return { value: worst, detail };
}

let rs = 1;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const round = (k, v) => /KEEP|COST|PROGRESS/.test(k) ? Math.round(v) : /TIME|GAIN|OUTSIDE/.test(k) ? +v.toFixed(3) : +v.toFixed(2);

if (process.argv[1] && process.argv[1].endsWith('players-search.js')) {
  const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? +args[args.indexOf(k) + 1] : d;
  const kind = args.find(a => /^(grip|slide|mixed)$/.test(a)) || 'grip', n = arg('--n', 120);
  rs = arg('--seed', 1);
  const def = rivalById(args.find(a => /^r\d/.test(a)) || 'r1');
  /* the grip player has no use for the slide's numbers */
  const keys = Object.keys(HAND_RANGES).filter(k => kind !== 'grip' || /VMAX|ENTRY|AY_MAX|OUTSIDE|SETUP|HB_OVER|HB_STEER|EDGE_SAFE/.test(k));
  let best = { drive: Object.assign({}, PLAYERS[kind].drive), ...markPlayer(def, kind, PLAYERS[kind].drive) };
  console.log('start ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
  for (let k = 0; k < n; k++) {
    const local = k > n * 0.35, drive = Object.assign({}, local ? best.drive : {});
    for (const key of keys) {
      const [a, b] = HAND_RANGES[key];
      if (local) { if (rnd() < 0.3) { const cur = drive[key] !== undefined ? drive[key] : RIVAL_DRIVE[key]; drive[key] = round(key, Math.max(a, Math.min(b, cur + (rnd() - 0.5) * (b - a) * 0.25))); } }
      else drive[key] = round(key, a + (b - a) * rnd());
    }
    const r = markPlayer(def, kind, drive);
    if (r.value > best.value) { best = { drive, ...r }; console.log(k + ' ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail) + ' ' + JSON.stringify(drive)); }
  }
  console.log('best ' + JSON.stringify(best.detail));
  console.log('drive: ' + JSON.stringify(best.drive));
}
