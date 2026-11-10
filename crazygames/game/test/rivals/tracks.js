/* CHOOSING EACH RIVAL'S TRACK BY MEASUREMENT (briefs/RIVALS.md: two
   rivals in each chapter, each on a career track of his half of the
   chapter). For a rival, every career track in his half chapter gets a
   short search (search.js, N tries, in his car and inside his
   character's ranges) and the best mark found on it, less a cost for a
   battle outside 60 to 120 s; the track with the highest is his. The
   long search for his driving then runs on that track.

   node game/test/rivals/tracks.js r2 [--n 24]   appends to review/rivals/tracks.json */
import path from 'node:path';
import fs from 'node:fs';
import { search, CHARACTERS } from './search.js';
import { rivalById, RIVALS } from '../../src/rivals/roster.js';
import { CAREER, CHAPTERS } from '../../src/loop/modes.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const file = path.resolve(here, '..', '..', '..', 'review', 'rivals', 'tracks.json');
const args = process.argv.slice(2);
const id = args.find(a => /^r\d/.test(a)), n = args.includes('--n') ? +args[args.indexOf('--n') + 1] : 24;
const k = RIVALS.findIndex(r => r.id === id), ch = CHAPTERS[Math.floor(k / 2)], mid = ch.from + (ch.to - ch.from) / 2;
const [from, to] = k % 2 === 0 ? [ch.from, mid] : [mid, ch.to];
const C = CHARACTERS[id] || {}, rows = [];
for (let i = from; i < to; i++) {
  const def = { ...rivalById(id), track: i };
  const best = search(def, { n, seed: 11 + i, want: C.want, ranges: C.ranges, quiet: true });
  const secs = best.detail.seconds, long = secs > 120 ? secs - 120 : secs < 60 ? 60 - secs : 0;
  const row = { index: i, name: CAREER[i].name, kind: CAREER[i].kind, mark: Math.round(best.value - long * 60), ...best.detail, drive: best.drive };
  rows.push(row);
  console.log(id + ' track ' + (i + 1) + ' ' + CAREER[i].name + ': mark ' + row.mark + ' ' + JSON.stringify(best.detail));
}
rows.sort((a, b) => b.mark - a.mark);
console.log(id + ' chosen: track ' + (rows[0].index + 1) + ' ' + rows[0].name);
let all = {}; try { all = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { all = {}; }
all[id] = { half: [from, to], tries: n, chosen: rows[0].index, rows };
fs.writeFileSync(file, JSON.stringify(all, null, 1));
