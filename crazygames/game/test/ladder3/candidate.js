// LADDER3: a candidate searched by ladder3/search.js, checked in Node: the driving bar over the 20 disturbances, then the plateau (ladder2/plateau.js).
//   node game/test/ladder3/candidate.js r2 <search log or drive JSON> [track=4] [laps=3] [car=hatch] [up=1] [force=1]
import fs from 'node:fs';
import { measureRival } from '../rivals/sim.js';
import { DISTURB, misses } from '../driftrace/hands.js';
import { plateau } from '../ladder2/plateau.js';
import { lastDrive } from '../ladder2/search.js';
import { rivalById } from '../../src/rivals/roster.js';
const [id, log, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map(a => a.split('=')));
const base = rivalById(id);
const def = { ...base, ...(opt.track ? { track: +opt.track } : {}), ...(opt.laps ? { laps: +opt.laps } : {}), ...(opt.car ? { car: opt.car } : {}), ...(opt.up ? { up: { power: +opt.up, grip: +opt.up, steer: +opt.up } } : {}), drive: JSON.parse(log.startsWith('{') ? log : lastDrive(fs.readFileSync(log, 'utf8'))) };
const b = measureRival(def);
console.log('base', b.seconds, b.total, 'hard', b.hard, 'cont', b.contacts, 'corner', b.worstCorner.toFixed(3), 'misses', misses(b).join(','));
const bad = DISTURB.map(d => misses(measureRival(def, d), b)).filter(w => w.length);
console.log('disturbed 20: miss', bad.length, bad.slice(0, 3).map(w => w.join(',')).join(' | '));
if (bad.length && !opt.force) process.exit(0);
const p = plateau(def);
console.log('plateau: ' + p.missedVariants + ' of ' + p.variants + ' miss (' + p.missedRuns + ' runs) ' + p.missed.map(r => r.key + (r.to > r.from ? '+' : '-') + ' ' + r.missing + ' ' + r.why[0]).join(' | '));
console.log('drive: ' + JSON.stringify(def.drive));
