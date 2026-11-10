/* CHOOSING A RIVAL'S DRIVING BY MEASUREMENT. A random search, then a
   local one, over the rival driver's numbers (rivals/driver.js
   RIVAL_DRIVE), inside the ranges his character allows (RANGES below,
   narrowed per rival by CHARACTER), each candidate driven in Node on
   his track under DISTURB small disturbances. A candidate's mark is
   its worst disturbed run: no respawn, no hard hit, no wall contact,
   no stall are demands (each costs far more than any slide earns);
   then the least sliding share of any corner, the mean share, the
   slide angle his character asks for, and his total. The winner is
   printed as the drive block for rivals/roster.js. This is the search;
   measure.js and the page probes are the record.

   node game/test/rivals/search.js r1 [--n 300] [--seed 1] */
import { measureRival } from './sim.js';
import { rivalById } from '../../src/rivals/roster.js';
import { RIVAL_DRIVE } from '../../src/rivals/driver.js';

export const RANGES = {
  SLIDE_GAIN: [0.15, 1.5], PROGRESS: [15, 140], KEEP: [0, 1500], ANGLE_CAP: [25, 55], EDGE_SAFE: [0.8, 3], EDGE_COST: [200, 3000],
  ENTRY: [16, 29], VMAX: [24, 34], CHAIN_KEEP: [0, 4000], CHAIN_MARGIN: [0, 0.6], AY_MAX: [5, 9], OUTSIDE: [0, 0.8], SETUP: [15, 80], WINDOW_PRE: [0, 30], WINDOW_POST: [-10, 20], LINK: [0, 60], HB_TIME: [0.1, 0.5],
};
/* each rival's character, as narrower ranges and the slide angle he
   should average, so the character shows in how he drives */
export const CHARACTERS = {
  r1: { want: null, ranges: {} },
  r2: { want: { angle: 24 }, ranges: { ANGLE_CAP: [22, 32], PROGRESS: [110, 200], LINK: [0, 12] } },
  r3: { want: { angle: 34 }, ranges: { WINDOW_PRE: [0, 3], HB_TIME: [0.3, 0.5], ENTRY: [23, 30], ANGLE_CAP: [36, 50] } },
  r4: { want: { angle: 30 }, ranges: { LINK: [25, 60], CHAIN_KEEP: [2000, 4000], ANGLE_CAP: [30, 42], KEEP: [600, 1500] } },
  r5: { want: { angle: 40 }, ranges: { ANGLE_CAP: [48, 60], SLIDE_GAIN: [0.8, 1.5] } },
  r6: { want: { angle: 35 }, ranges: { LINK: [25, 60], CHAIN_KEEP: [2000, 4000], ANGLE_CAP: [40, 55], SLIDE_GAIN: [0.6, 1.4] } },
};
/* the disturbances every candidate is judged on: the start a few cm off and the grip half a per cent off */
export const DISTURB = [{}, { offset: [0.04, -0.03], grip: 0.005 }, { offset: [-0.05, 0.02], grip: -0.005 }, { offset: [0.01, 0.05], grip: 0.002 }];

export function mark(runs, want) {
  let worst = Infinity, detail = null;
  /* his total should not swing with a disturbance: the spread across the runs, as a share of their mean, costs */
  const totals = runs.map(m => m.total), mean = totals.reduce((a, b) => a + b, 0) / totals.length, spread = mean > 0 ? (Math.max(...totals) - Math.min(...totals)) / mean : 1;
  for (const m of runs) {
    let v = 0;
    if (!m.finished) v -= 20000;
    v -= m.respawns * 5000 + m.hard * 2000 + m.contacts * 400;
    if (m.minKmh < 40) v -= (40 - m.minKmh) * 60;
    const shares = m.corners.map(c => c.share), mean = shares.reduce((a, b) => a + b, 0) / shares.length;
    v += m.worstCorner * 1500 + mean * 800 + m.total * 0.4;
    /* a rival who does not slide is no rival: every corner should see a slide, and most of each */
    if (mean < 0.4) v -= (0.4 - mean) * 20000;
    if (m.worstCorner < 0.2) v -= (0.2 - m.worstCorner) * 10000;
    const ang = m.corners.reduce((a, c) => a + c.angle, 0) / m.corners.length;
    if (want && want.angle) v -= Math.abs(ang - want.angle) * 25;
    if (want && want.seconds && m.seconds > want.seconds) v -= (m.seconds - want.seconds) * 40;
    v -= spread * 2500;
    if (v < worst) { worst = v; detail = { spread: +spread.toFixed(2), total: m.total, seconds: m.seconds, worstCorner: +m.worstCorner.toFixed(2), mean: +mean.toFixed(2), angle: +ang.toFixed(1), hits: m.contacts, hard: m.hard, resp: m.respawns, minKmh: m.minKmh }; }
  }
  return { value: worst, detail };
}

export function evaluate(def, drive, want, disturb) {
  const runs = (disturb || DISTURB).map(d => measureRival({ ...def, drive }, { ...d, maxSeconds: 240 }));
  return mark(runs, want);
}

let rs = 1;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const pick = ([a, b]) => a + (b - a) * rnd();
const round = (k, v) => /KEEP|COST|PROGRESS/.test(k) ? Math.round(v) : /TIME|GAIN|OUTSIDE/.test(k) ? +v.toFixed(3) : +v.toFixed(2);

export function search(def, opts) {
  const o = opts || {};
  const ranges = Object.assign({}, RANGES, o.ranges || {});
  rs = o.seed || 1;
  let best = { drive: Object.assign({}, def.drive), ...evaluate(def, def.drive, o.want) };
  const log = m => { if (!o.quiet) console.log(m); };
  log('start ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
  const N = o.n || 300;
  for (let k = 0; k < N; k++) {
    const local = k > N * (o.localFrom === undefined ? 0.4 : o.localFrom);
    const drive = Object.assign({}, local ? best.drive : {});
    for (const key of Object.keys(ranges)) {
      if (local) { if (rnd() < 0.3) { const [a, b] = ranges[key], cur = drive[key] !== undefined ? drive[key] : RIVAL_DRIVE[key]; drive[key] = round(key, Math.max(a, Math.min(b, cur + (rnd() - 0.5) * (b - a) * 0.25))); } }
      else drive[key] = round(key, pick(ranges[key]));
    }
    if (drive.ENTRY_MIN > drive.ENTRY_MAX) drive.ENTRY_MIN = drive.ENTRY_MAX;
    const r = evaluate(def, drive, o.want);
    if (r.value > best.value) { best = { drive, ...r }; log(k + ' ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail)); }
  }
  return best;
}

if (process.argv[1] && process.argv[1].endsWith('search.js')) {
  const args = process.argv.slice(2);
  const def = { ...rivalById(args.find(a => /^r\d/.test(a)) || 'r1') };
  const n = args.includes('--n') ? +args[args.indexOf('--n') + 1] : 300, seed = args.includes('--seed') ? +args[args.indexOf('--seed') + 1] : 1;
  const ch = CHARACTERS[def.id] || {};
  if (args.includes('--track')) def.track = +args[args.indexOf('--track') + 1];
  /* --screened: start from the track the screen chose (tracks.js) and the best driving it found there */
  if (args.includes('--screened')) {
    const fs = await import('node:fs'), p = await import('node:path');
    const t = JSON.parse(fs.readFileSync(p.resolve(p.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'review', 'rivals', 'tracks.json'), 'utf8'))[def.id];
    if (t) { def.track = t.chosen; def.drive = t.rows.find(r => r.index === t.chosen).drive; console.log('screened: track ' + (def.track + 1) + ', from ' + JSON.stringify(def.drive)); }
  }
  const best = search(def, { n, seed, want: ch.want, ranges: ch.ranges, localFrom: args.includes('--screened') ? 0.15 : 0.4 });
  console.log('best ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
  console.log('track: ' + def.track);
  console.log('drive: ' + JSON.stringify(best.drive));
}
