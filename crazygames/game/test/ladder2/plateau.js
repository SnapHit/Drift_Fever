/* LADDER2 MEASURE 2's PLATEAU (briefs/RIVALS-LADDER-2.md): a rival
   drives well on a plateau, not on a knife edge. Each of his driving
   numbers (his `drive` in rivals/roster.js) moved one per cent up and one
   per cent down, the rest as they are, 5 disturbed runs each (measure
   2's first five disturbances, driftrace/hands.js DISTURB), in Node; none
   may miss the bar (driftrace/hands.js misses, against his own
   undisturbed run). A number at nothing moved one per cent is still
   nothing, and is reported as such.
   Known answer: the Tolvo on main (ENTRY 26.2, which the last round
   found passing at 26.2 and failing at 26.0 and 26.3) fails.

   node game/test/ladder2/plateau.js [r2 ...] [--main-tolvo] [--runs 5]   writes review/ladder2/plateau.json */
import path from 'node:path';
import fs from 'node:fs';
import { measureRival } from '../rivals/sim.js';
import { DISTURB, misses } from '../driftrace/hands.js';
import { RIVALS, rivalById } from '../../src/rivals/roster.js';

export const PLATEAU = { STEP: 0.01, RUNS: 5 };
/* Tolvo as he is on main (review/ladder/REPORT.md), the known answer */
export const MAIN_TOLVO = { id: 'r2', name: 'Tolvo (main)', car: 'hatch', paint: 'amber', track: 4, side: -1, laps: 3, drive: { SLIDE_GAIN: 0.35, PROGRESS: 45, KEEP: 325, ANGLE_CAP: 21.56, EDGE_SAFE: 2.37, EDGE_COST: 2875, ENTRY: 26.2, VMAX: 33.14, CHAIN_KEEP: 0, CHAIN_MARGIN: 0.34, AY_MAX: 7.28, OUTSIDE: 0.157, SETUP: 39.95, WINDOW_PRE: 3.98, WINDOW_POST: -5.28, LINK: 4.81, HB_TIME: 0.1, HB_OVER: 0.75, HB_STEER: 0.35 } };

/* every number one per cent each way: what missed, and the worst of each */
export function plateau(def, o) {
  const runs = (o && o.runs) || PLATEAU.RUNS;
  const base = measureRival(def);
  const rows = [];
  for (const key of Object.keys(def.drive)) {
    for (const sgn of [1, -1]) {
      const v = def.drive[key], nv = v * (1 + sgn * PLATEAU.STEP);
      if (v === 0) { rows.push({ key, from: v, to: nv, zero: true, missing: 0, why: [] }); continue; }
      const d2 = { ...def, drive: { ...def.drive, [key]: nv } };
      const ms = DISTURB.slice(0, runs).map(d => measureRival(d2, d));
      const bad = ms.map(m => misses(m, base)).filter(w => w.length);
      rows.push({ key, from: v, to: +nv.toFixed(4), missing: bad.length, why: bad.slice(0, 2).map(w => w.join(', ')), worstCorner: +Math.min(...ms.map(m => m.worstCorner)).toFixed(3), hard: Math.max(...ms.map(m => m.hard)), contacts: Math.max(...ms.map(m => m.contacts)), total: [Math.min(...ms.map(m => m.total)), Math.max(...ms.map(m => m.total))] });
    }
  }
  const missed = rows.filter(r => r.missing > 0);
  return { id: def.id, name: def.name, base: { seconds: base.seconds, total: base.total, worstCorner: base.worstCorner }, variants: rows.length, runs: rows.reduce((a, r) => a + (r.zero ? 0 : runs), 0), missedVariants: missed.length, missedRuns: missed.reduce((a, r) => a + r.missing, 0), missed, rows, pass: missed.length === 0 };
}

if (process.argv[1] && process.argv[1].endsWith('plateau.js')) {
  const args = process.argv.slice(2);
  const file = process.env.PLATEAU_OUT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'review', 'ladder2', 'plateau.json');
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { rivals: {} };
  out.plateau = PLATEAU;
  const ids = args.filter(a => /^r\d$/.test(a));
  const list = args.includes('--main-tolvo') ? [MAIN_TOLVO] : (ids.length ? ids.map(rivalById) : RIVALS.slice(1));
  let fails = 0;
  for (const def of list) {
    const p = plateau(def, { runs: args.includes('--runs') ? +args[args.indexOf('--runs') + 1] : undefined });
    const known = def === MAIN_TOLVO;
    const ok = known ? !p.pass : p.pass;
    if (!ok) fails++;
    console.log((ok ? 'PASS ' : 'FAIL ') + (known ? 'known answer: ' : '') + p.name + ' on a plateau: ' + p.variants + ' variants, ' + p.runs + ' runs, ' + p.missedVariants + ' variants with ' + p.missedRuns + ' runs missing the bar' + (p.missed.length ? ' :: ' + p.missed.slice(0, 6).map(r => r.key + ' ' + r.from + ' to ' + r.to + ' (' + r.missing + ' of 5: ' + r.why[0] + ')').join('; ') : '') + (known ? (p.pass ? ' (MISSED: the known answer should fail)' : ' (CAUGHT)') : ''));
    p.measured = new Date().toISOString().slice(0, 10);
    out.rivals[known ? 'mainTolvo' : def.id] = p;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  process.exit(fails ? 1 : 0);
}
