/* CHOOSING A LATER RIVAL'S DRIVING (briefs/RIVALS-LADDER.md priority 3).
   The drift race round's search (driftrace/search.js: a random search
   then a local one, every candidate driven with a player's hands under
   small disturbances and judged by its worst run, with his finish time
   held near the scripted players' pace and his total under a ceiling),
   for a rival on a track, laps and car chosen here rather than in the
   roster, so a track can be tried before it is his. His character's
   ranges (rivals/search.js CHARACTERS) keep his driving his own. The
   probes are the record; this is the search.

   node game/test/ladder/search.js r2 --track 4 --laps 3 [--car hatch] [--n 200] [--seed 1] [--seconds 81] [--cap 2600] [--from r1|grip|slide|mixed|JSON] [--cap-weight 1] [--range KEY=a,b] */
import { search } from '../driftrace/search.js';
import { CHARACTERS } from '../rivals/search.js';
import { rivalById } from '../../src/rivals/roster.js';
import { PLAYERS } from '../../src/rivals/players.js';

const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const base = rivalById(args.find(a => /^r\d/.test(a)) || 'r2');
const def = { ...base, track: +arg('--track', base.track), laps: +arg('--laps', base.laps || 2), car: arg('--car', base.car) };
const from = arg('--from', null);
if (from) def.drive = { ...(PLAYERS[from] ? PLAYERS[from].drive : from.startsWith('{') ? JSON.parse(from) : rivalById(from).drive) };
/* --range KEY=a,b narrows or widens one number's range */
const ranges = Object.assign({}, (CHARACTERS[def.id] || {}).ranges);
for (let i = 0; i < args.length; i++) if (args[i] === '--range') { const [k, v] = args[i + 1].split('='); ranges[k] = v.split(',').map(Number); }
const ch = CHARACTERS[def.id] || {};
console.log('searching ' + def.name + ' on career ' + (def.track + 1) + ', ' + def.laps + ' laps, ' + def.car + ', ranges ' + JSON.stringify(ranges));
const best = search(def, { n: +arg('--n', 200), seed: +arg('--seed', 1), seconds: +arg('--seconds', 80), slack: +arg('--slack', 2), cap: +arg('--cap', 2600), capWeight: +arg('--cap-weight', 1), want: ch.want, ranges, localFrom: args.includes('--local') ? 0 : undefined });
console.log('best ' + best.value.toFixed(0) + ' ' + JSON.stringify(best.detail));
console.log('drive: ' + JSON.stringify(best.drive));
