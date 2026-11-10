/* CHOOSING EACH RIVAL'S TRACK BY MEASUREMENT (briefs/RIVALS.md: two
   rivals in each chapter, each on a career track of his half of the
   chapter). For each half chapter after the first rival's, every track
   in it is driven in Node by the first rival's driving and three
   variants of it (SETS), in the car the rival will drive, under the
   search's disturbances (search.js DISTURB), and marked as the search
   marks a candidate (search.js mark: no respawn, no hard hit, no wall
   contact, no stall, the corners' sliding, his total and its spread),
   less a cost for a battle outside 60 to 120 s. The track whose best set
   marks highest is his. Writes review/rivals/tracks.json.

   node game/test/rivals/tracks.js */
import path from 'node:path';
import fs from 'node:fs';
import { evaluate } from './search.js';
import { RIVALS } from '../../src/rivals/roster.js';
import { CAREER, CHAPTERS } from '../../src/loop/modes.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const base = RIVALS[0].drive;
export const SETS = [base, { ...base, ANGLE_CAP: 32, PROGRESS: 160 }, { ...base, ENTRY: 21, VMAX: 27, EDGE_SAFE: 1.4, EDGE_COST: 1200 }, { ...base, LINK: 30, CHAIN_KEEP: 2500 }];
export const HALVES = [];
for (const ch of CHAPTERS) { const mid = ch.from + (ch.to - ch.from) / 2; HALVES.push([ch.from, mid], [mid, ch.to]); }
const CARS = ['starter', 'hatch', 'fastback', 'tourer', 'driftbuild', 'fastback'];

const out = { sets: SETS, halves: [] };
for (let h = 1; h < HALVES.length; h++) {
  const [from, to] = HALVES[h], car = CARS[h], rows = [];
  for (let i = from; i < to; i++) {
    let best = null;
    for (let k = 0; k < SETS.length; k++) {
      const r = evaluate({ id: 'probe', track: i, car, side: 1, drive: {} }, SETS[k]);
      const secs = r.detail.seconds, long = secs > 120 ? secs - 120 : secs < 60 ? 60 - secs : 0;
      const v = r.value - long * 60;
      if (!best || v > best.value) best = { value: Math.round(v), set: k, ...r.detail };
    }
    rows.push({ index: i, name: CAREER[i].name, kind: CAREER[i].kind, ...best });
    console.log('half ' + h + ' (' + car + ') track ' + (i + 1) + ' ' + CAREER[i].name + ': ' + JSON.stringify(best));
  }
  rows.sort((a, b) => b.value - a.value);
  out.halves.push({ half: h, from, to, car, chosen: rows[0].index, rows });
  console.log('  chosen: ' + rows[0].name);
}
fs.writeFileSync(path.resolve(here, '..', '..', '..', 'review', 'rivals', 'tracks.json'), JSON.stringify(out, null, 1));
