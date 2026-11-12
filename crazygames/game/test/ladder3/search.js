/* CHOOSING A RIVAL'S DRIVING ON A PLATEAU, PLACED ON THE STAIRCASE
   (briefs/RIVALS-LADDER-3.md priorities 1 and 2). The last round's
   robust search (ladder2/search.js: a random search then a local one
   over the look ahead driver's numbers with a player's hands, each
   candidate judged on his undisturbed run, measure 2's first DISTURBED
   disturbances and JOGS runs with every number moved one per cent up or
   down at once on top of a disturbance), with two changes:
   - margins on the bar, so a candidate that passes only just loses to
     one that passes with room: the least sliding corner at least
     MARGIN.corner (the bar is 0.3), the lowest speed at least
     MARGIN.minKmh (the bar is 40), no wall contact at all (the bar
     allows two scrapes), his total within MARGIN.total of his
     undisturbed run's (the bar is 0.25);
   - in place of a ceiling on his total, a band on the ruler's multiple
     (ladder3/ruler.js: his points a second over his track's three star
     rate), --band lo,hi, and the race inside 60 to 120 s.
   The probes (ladder3/drive.js, ladder3/ruler.js) are the record; this
   is the search.

   node game/test/ladder3/search.js r2 --band 2.1,2.45 [--track 4] [--laps 3] [--car hatch] [--up 1] [--n 200] [--seed 1] [--from r2|JSON] [--from-log file] [--local] [--range KEY=a,b] [--jogs 6] [--disturbed 6] [--want-angle 24] */
import fs from 'node:fs';
import { measureRival } from '../rivals/sim.js';
import { mark, CHARACTERS } from '../rivals/search.js';
import { HAND_RANGES } from '../driftrace/search.js';
import { DISTURB } from '../driftrace/hands.js';
import { lastDrive } from '../ladder2/search.js';
import { threeStarRate } from './ruler.js';
import { rivalById } from '../../src/rivals/roster.js';
import { RIVAL_DRIVE } from '../../src/rivals/driver.js';
import { PLAYERS } from '../../src/rivals/players.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec } from '../../src/loop/modes.js';

export const MARGIN = { corner: 0.4, minKmh: 46, total: 0.15, seconds: [62, 118] };

let js = 7;
const jrnd = () => { js = (js * 48271) % 2147483647; return js / 2147483647; };
const KEYS = Object.keys(HAND_RANGES);
function jogSigns(n) { js = 7; return Array.from({ length: n }, () => Object.fromEntries(KEYS.map(k => [k, jrnd() < 0.5 ? -1 : 1]))); }

export function judge(def, drive, o) {
  const star = o.star;
  const runs = [{}].concat(DISTURB.slice(0, o.disturbed)).map(d => measureRival({ ...def, drive }, { ...d, maxSeconds: 200 }));
  const jogRuns = jogSigns(o.jogs).map((sg, k) => { const d2 = {}; for (const key of Object.keys(drive)) d2[key] = drive[key] * (1 + 0.01 * (sg[key] || 1)); return measureRival({ ...def, drive: d2 }, { ...DISTURB[(k * 3 + 9) % 20], maxSeconds: 200 }); });
  const all = runs.concat(jogRuns);
  let v = mark(all, o.want).value;
  const base = runs[0], mult = r => r.total / r.seconds / star;
  for (const r of all) {
    if (!r.finished) v -= 30000;
    v -= r.respawns * 8000 + r.hard * 4000 + r.contacts * 1500 + (r.hands.overruled ? 20000 : 0);
    v -= Math.max(0, MARGIN.minKmh - r.minKmh) * 300;
    v -= Math.max(0, MARGIN.corner - r.worstCorner) * 60000;
    v -= Math.max(0, Math.abs(r.total - base.total) - MARGIN.total * base.total) * 30;
    v -= (Math.max(0, MARGIN.seconds[0] - r.seconds) + Math.max(0, r.seconds - MARGIN.seconds[1])) * 400;
    const m = mult(r);
    v -= (Math.max(0, o.band[0] - m) + Math.max(0, m - o.band[1])) * 20000;
  }
  const secs = all.map(r => r.seconds), tots = all.map(r => r.total), ms = all.map(mult);
  return { value: v, detail: { seconds: [Math.min(...secs), Math.max(...secs)], totals: [Math.min(...tots), Math.max(...tots)], base: base.total, mult: [+Math.min(...ms).toFixed(2), +Math.max(...ms).toFixed(2)], contacts: Math.max(...all.map(r => r.contacts)), hard: Math.max(...all.map(r => r.hard)), respawns: Math.max(...all.map(r => r.respawns)), minKmh: Math.min(...all.map(r => r.minKmh)), worstCorner: +Math.min(...all.map(r => r.worstCorner)).toFixed(3), angle: +(base.corners.reduce((a, c) => a + c.angle, 0) / base.corners.length).toFixed(1) } };
}

let rs = 1;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const round = (k, v) => /KEEP|COST|PROGRESS/.test(k) ? Math.round(v) : /TIME|GAIN|OUTSIDE/.test(k) ? +v.toFixed(3) : +v.toFixed(2);

export function searchPlateau(def, o) {
  rs = o.seed || 1;
  const ranges = Object.assign({}, HAND_RANGES, o.ranges || {});
  let best = { drive: Object.assign({}, def.drive), ...judge(def, def.drive, o) };
  console.log('start ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
  for (let k = 0; k < o.n; k++) {
    const local = k >= o.n * (o.localFrom === undefined ? 0.3 : o.localFrom);
    const drive = Object.assign({}, local ? best.drive : def.drive);
    for (const key of Object.keys(ranges)) {
      const [a, b] = ranges[key];
      if (local) { if (rnd() < 0.3) { const cur = drive[key] !== undefined ? drive[key] : RIVAL_DRIVE[key]; drive[key] = round(key, Math.max(a, Math.min(b, cur + (rnd() - 0.5) * (b - a) * 0.25))); } }
      else drive[key] = round(key, a + (b - a) * rnd());
    }
    const r = judge(def, drive, o);
    if (r.value > best.value) { best = { drive, ...r }; console.log(k + ' ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail) + ' ' + JSON.stringify(drive)); }
  }
  return best;
}

if (process.argv[1] && process.argv[1].endsWith('ladder3/search.js')) {
  const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
  const baseDef = rivalById(args.find(a => /^r\d$/.test(a)) || 'r2');
  const def = { ...baseDef, track: +arg('--track', baseDef.track), laps: +arg('--laps', baseDef.laps || 2), car: arg('--car', baseDef.car), up: args.includes('--up') ? { power: +arg('--up'), grip: +arg('--up'), steer: +arg('--up') } : baseDef.up };
  let f = arg('--from', null);
  if (args.includes('--from-log')) f = lastDrive(fs.readFileSync(arg('--from-log'), 'utf8')) || f;
  if (f) def.drive = { ...(f.startsWith('{') ? JSON.parse(f) : PLAYERS[f] ? PLAYERS[f].drive : rivalById(f).drive) };
  const ranges = Object.assign({}, (CHARACTERS[def.id] || {}).ranges);
  if (args.includes('--no-character')) for (const k of Object.keys(ranges)) delete ranges[k];
  for (let i = 0; i < args.length; i++) if (args[i] === '--range') { const [k, v] = args[i + 1].split('='); ranges[k] = v.split(',').map(Number); }
  const want = args.includes('--want-angle') ? { angle: +arg('--want-angle') } : (CHARACTERS[def.id] || {}).want;
  const star = threeStarRate(trackFor(careerSpec(def.track)));
  const band = arg('--band', '0,99').split(',').map(Number);
  console.log('searching ' + def.name + ' on career ' + (def.track + 1) + ', ' + def.laps + ' laps, ' + def.car + ' ' + JSON.stringify(def.up || null) + ', three star rate ' + star.toFixed(2) + ', band x' + band.join(' to x') + ', want ' + JSON.stringify(want) + ', ranges ' + JSON.stringify(ranges));
  const best = searchPlateau(def, { n: +arg('--n', 200), seed: +arg('--seed', 1), band, star, want, ranges, jogs: +arg('--jogs', 6), disturbed: +arg('--disturbed', 6), localFrom: args.includes('--local') ? 0 : undefined });
  console.log('best ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
  console.log('drive: ' + JSON.stringify(best.drive));
}
