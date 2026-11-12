/* CHOOSING A RIVAL'S DRIVING ON A PLATEAU (briefs/RIVALS-LADDER-2.md
   priorities 2 and 3). The ladder round's search (ladder/search.js over
   driftrace/search.js: a random search then a local one, every
   candidate driven with a player's hands and judged by its worst run,
   his time held near a pace and his total under a ceiling), judged on
   more: his undisturbed run, measure 2's first DISTURBED disturbances,
   and JOGS runs with every one of his numbers moved one per cent up or
   down at once (a fixed pattern of signs per run) on top of a
   disturbance. A candidate that only passes on a knife edge loses to one
   on a plateau. The probes (plateau.js, ladder2/rivals.js) are the
   record; this is the search.

   node game/test/ladder2/search.js r2 [--track 4] [--laps 3] [--car hatch] [--up 1] [--n 300] [--seed 1] [--seconds 82] [--slack 2] [--cap 4800] [--cap-weight 1] [--floor 0] [--from r2|JSON] [--from-log file] [--local] [--range KEY=a,b] [--jogs 6] [--disturbed 8] */
import fs from 'node:fs';
import { measureRival } from '../rivals/sim.js';
import { mark, CHARACTERS } from '../rivals/search.js';
import { HAND_RANGES } from '../driftrace/search.js';
import { DISTURB, BAR } from '../driftrace/hands.js';
import { rivalById } from '../../src/rivals/roster.js';
import { RIVAL_DRIVE } from '../../src/rivals/driver.js';
import { PLAYERS } from '../../src/rivals/players.js';

let js = 7;
const jrnd = () => { js = (js * 48271) % 2147483647; return js / 2147483647; };
/* the jogs: for each, a sign per number, the same for every candidate */
function jogSigns(n) { js = 7; return Array.from({ length: n }, () => Object.fromEntries(Object.keys(HAND_RANGES).concat(['HB_OVER', 'HB_STEER']).map(k => [k, jrnd() < 0.5 ? -1 : 1]))); }

export function judgeRobust(def, drive, o) {
  const signs = jogSigns(o.jogs);
  const runs = [{}].concat(DISTURB.slice(0, o.disturbed)).map(d => measureRival({ ...def, drive }, { ...d, maxSeconds: 240 }));
  const jogRuns = signs.map((sg, k) => { const d2 = {}; for (const key of Object.keys(drive)) d2[key] = drive[key] * (1 + 0.01 * (sg[key] || 1)); return measureRival({ ...def, drive: d2 }, { ...DISTURB[(k * 3 + 9) % 20], maxSeconds: 240 }); });
  const all = runs.concat(jogRuns);
  const m = mark(all, o.want);
  let v = m.value;
  const base = runs[0];
  for (const r of all) {
    v -= Math.max(0, Math.abs(r.seconds - o.seconds) - o.slack) * 300;
    v -= Math.max(0, r.total - o.cap) * (o.capWeight || 1);
    if (o.floor) v -= Math.max(0, o.floor - r.total) * (o.capWeight || 1);
    v -= r.contacts * 600 + r.hard * 3000 + r.respawns * 8000;
    if (r.minKmh < BAR.minKmh + 3) v -= (BAR.minKmh + 3 - r.minKmh) * 300;
    v -= Math.max(0, Math.abs(r.total - base.total) - 0.2 * base.total) * 30;
    v -= Math.max(0, 0.34 - r.worstCorner) * 60000;
  }
  const secs = all.map(r => r.seconds), tots = all.map(r => r.total);
  return { value: v, detail: { seconds: [Math.min(...secs), Math.max(...secs)], totals: [Math.min(...tots), Math.max(...tots)], base: base.total, contacts: Math.max(...all.map(r => r.contacts)), hard: Math.max(...all.map(r => r.hard)), respawns: Math.max(...all.map(r => r.respawns)), minKmh: Math.min(...all.map(r => r.minKmh)), worstCorner: +Math.min(...all.map(r => r.worstCorner)).toFixed(3) } };
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

export function searchRobust(def, o) {
  rs = o.seed || 1;
  const ranges = Object.assign({}, HAND_RANGES, o.ranges || {});
  let best = { drive: Object.assign({}, def.drive), ...judgeRobust(def, def.drive, o) };
  console.log('start ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
  for (let k = 0; k < o.n; k++) {
    const local = k >= o.n * (o.localFrom === undefined ? 0.3 : o.localFrom);
    const drive = Object.assign({}, local ? best.drive : def.drive);
    for (const key of Object.keys(ranges)) {
      const [a, b] = ranges[key];
      if (local) { if (rnd() < 0.3) { const cur = drive[key] !== undefined ? drive[key] : RIVAL_DRIVE[key]; drive[key] = round(key, Math.max(a, Math.min(b, cur + (rnd() - 0.5) * (b - a) * 0.25))); } }
      else drive[key] = round(key, a + (b - a) * rnd());
    }
    const r = judgeRobust(def, drive, o);
    if (r.value > best.value) { best = { drive, ...r }; console.log(k + ' ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail) + ' ' + JSON.stringify(drive)); }
  }
  return best;
}

if (process.argv[1] && process.argv[1].endsWith('ladder2/search.js')) {
  const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
  const baseDef = rivalById(args.find(a => /^r\d$/.test(a)) || 'r2');
  const def = { ...baseDef, track: +arg('--track', baseDef.track), laps: +arg('--laps', baseDef.laps || 2), car: arg('--car', baseDef.car), up: args.includes('--up') ? { power: +arg('--up'), grip: +arg('--up'), steer: +arg('--up') } : baseDef.up };
  let f = arg('--from', null);
  if (args.includes('--from-log')) { f = lastDrive(fs.readFileSync(arg('--from-log'), 'utf8')) || f; }
  if (f) def.drive = { ...(f.startsWith('{') ? JSON.parse(f) : PLAYERS[f] ? PLAYERS[f].drive : rivalById(f).drive) };
  const ranges = Object.assign({}, (CHARACTERS[def.id] || {}).ranges);
  for (let i = 0; i < args.length; i++) if (args[i] === '--range') { const [k, v] = args[i + 1].split('='); ranges[k] = v.split(',').map(Number); }
  console.log('searching ' + def.name + ' on career ' + (def.track + 1) + ', ' + def.laps + ' laps, ' + def.car + ' ' + JSON.stringify(def.up || null) + ', ranges ' + JSON.stringify(ranges));
  const best = searchRobust(def, { n: +arg('--n', 300), seed: +arg('--seed', 1), seconds: +arg('--seconds', 80), slack: +arg('--slack', 2), cap: +arg('--cap', 99999), floor: +arg('--floor', 0), capWeight: +arg('--cap-weight', 1), want: (CHARACTERS[def.id] || {}).want, ranges, jogs: +arg('--jogs', 6), disturbed: +arg('--disturbed', 8), localFrom: args.includes('--local') ? 0 : undefined });
  console.log('best ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
  console.log('drive: ' + JSON.stringify(best.drive));
}
