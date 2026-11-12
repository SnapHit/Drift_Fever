/* LADDER3 MEASURE 2 (briefs/RIVALS-LADDER-3.md): EACH RIVAL FROM TOLVO
   ON DRIVES WELL, ON A PLATEAU. For each rival named:
   - the driving bar (driftrace/hands.js BAR and misses: no respawn, no
     hard hit, at most two scrapes, never under 40 km/h after the launch,
     every corner at least 30 per cent sliding, his total within 25 per
     cent of his undisturbed run's, only a player's hands with the guard
     changing nothing), in the page (Chromium's Math, the record) and
     over the 20 disturbances in Node, 0 of 20 missing;
   - the plateau (ladder2/plateau.js): each driving number one per cent
     up and down, 5 disturbed runs each, none missing.
   Kestrow is the author's and is reported, not judged.
   Known answer: the Tolvo on main fails the plateau (--main-tolvo).

   node game/test/ladder3/drive.js [r2 ...] [--main-tolvo] [--no-page]   writes review/ladder3/drive.json */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../rivals/lib.js';
import { measureRival, measureCore } from '../rivals/sim.js';
import { DISTURB, misses, handsMiss, BAR } from '../driftrace/hands.js';
import { plateau, MAIN_TOLVO, PLATEAU } from '../ladder2/plateau.js';
import { RIVALS, rivalById } from '../../src/rivals/roster.js';
import { careerSpec, battleLaps } from '../../src/loop/modes.js';
import { trackFor } from '../../src/ground/source.js';

const args = process.argv.slice(2);
const file = path.join(R.root, 'review', 'ladder3', 'drive.json');
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { rivals: {} };
out.bar = BAR; out.plateau = PLATEAU;
const mm = (rs, f) => [Math.min(...rs.map(f)), Math.max(...rs.map(f))];
const ids = args.filter(a => /^r\d$/.test(a));
const list = args.includes('--main-tolvo') ? [] : (ids.length ? ids.map(rivalById) : RIVALS.slice(1));
const env = args.includes('--no-page') || !list.length ? null : await R.start();

async function inPage(def) {
  const pg = await R.page(env, { width: 320, height: 180 }, '?rivals=all');
  const m = await pg.page.evaluate(async ({ src, id }) => {
    const [rv, so, mo, wo] = await Promise.all([import('/src/rivals/rival.js'), import('/src/ground/source.js'), import('/src/loop/modes.js'), import('/src/physics/world.js')]);
    const f = new Function('return (' + src + ')')();
    const d = window.__loop.RIVALS.find(r => r.id === id);
    const m = f({ createRival: rv.createRival, trackFor: so.trackFor, careerSpec: mo.careerSpec, battleLaps: mo.battleLaps, STEP: wo.STEP, LAUNCH: 3 }, d, {});
    delete m.trace; return m;
  }, { src: measureCore.toString(), id: def.id });
  await pg.close();
  return m;
}

for (const def of list) {
  const page = env ? await inPage(def) : null, node = measureRival(def), base = page || node;
  delete node.trace;
  const own = misses(base);
  const dist = DISTURB.map(d => measureRival(def, d));
  const bad = dist.map(m => misses(m, base)).filter(w => w.length);
  const worst = { respawns: Math.max(...dist.map(m => m.respawns)), hard: Math.max(...dist.map(m => m.hard)), contacts: Math.max(...dist.map(m => m.contacts)), minKmh: Math.min(...dist.map(m => m.minKmh)), worstCorner: +Math.min(...dist.map(m => m.worstCorner)).toFixed(3), total: mm(dist, m => m.total), seconds: mm(dist, m => m.seconds), guard: Math.max(...dist.map(m => m.hands.overruled)) };
  const track = trackFor(careerSpec(def.track)), laps = battleLaps(track, def);
  const angle = +(base.corners.reduce((a, c) => a + c.angle, 0) / base.corners.length).toFixed(1);
  R.verdict(own.length === 0 && bad.length === 0, def.name + ' (' + def.id + ') the driving bar, career ' + (def.track + 1) + ' ' + careerSpec(def.track).name + ', ' + laps + ' laps, ' + def.car + ': ' + (page ? 'in the page ' : 'in Node ') + base.seconds + ' s, ' + base.total + ' points, respawns ' + base.respawns + ', hard ' + base.hard + ', contacts ' + base.contacts + ', lowest ' + base.minKmh + ' km/h, least sliding corner ' + Math.round(base.worstCorner * 100) + '% (mean angle ' + angle + ' deg, best chain ' + base.best + '), hands ' + (handsMiss(base).length ? handsMiss(base).join(', ') : 'a player\'s, the guard ' + base.hands.overruled) + (own.length ? ' :: ' + own.join(', ') : '') + (page ? '; Node ' + node.total + (node.hash === page.hash ? ', the same hash' : ', another hash (the engines\' Math)') : '') + '; under 20 disturbances ' + bad.length + ' miss (worst: hard ' + worst.hard + ', contacts ' + worst.contacts + ', lowest ' + worst.minKmh + ' km/h, corner ' + Math.round(worst.worstCorner * 100) + '%, total ' + worst.total.join(' to ') + ', ' + worst.seconds.join(' to ') + ' s, guard ' + worst.guard + ')' + (bad.length ? ' :: ' + bad.slice(0, 3).map(w => w.join(', ')).join('; ') : ''));
  const pl = plateau(def);
  if (def.id === 'r1') console.log('REPORTED (Kestrow is the author\'s) plateau: ' + pl.missedVariants + ' of ' + pl.variants + ' variants miss (' + pl.missedRuns + ' of ' + pl.runs + ' runs)');
  else R.verdict(pl.pass, def.name + ' on a plateau: ' + pl.missedVariants + ' of ' + pl.variants + ' variants miss (' + pl.missedRuns + ' of ' + pl.runs + ' runs)' + (pl.missed.length ? ' :: ' + pl.missed.slice(0, 6).map(r => r.key + ' ' + r.from + ' to ' + r.to + ' (' + r.missing + ': ' + r.why[0] + ')').join('; ') : ''));
  out.rivals[def.id] = { id: def.id, name: def.name, style: def.style, track: def.track, laps, car: def.car, up: def.up || null, drive: def.drive, page, node, angle, own, missing: bad.length, worst, disturbed: dist.map(m => ({ total: m.total, seconds: m.seconds, hard: m.hard, contacts: m.contacts, minKmh: m.minKmh, worstCorner: +m.worstCorner.toFixed(3) })), plateau: { pass: pl.pass, variants: pl.variants, runs: pl.runs, missedVariants: pl.missedVariants, missedRuns: pl.missedRuns, missed: pl.missed }, pass: own.length === 0 && bad.length === 0 && (def.id === 'r1' || pl.pass), measured: new Date().toISOString().slice(0, 10) };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
}
if (env) await env.close();
if (args.includes('--main-tolvo')) {
  const pl = plateau(MAIN_TOLVO);
  R.verdict(!pl.pass, 'known answer: the Tolvo on main on a plateau: ' + pl.missedVariants + ' of ' + pl.variants + ' variants miss (' + pl.missedRuns + ' of ' + pl.runs + ' runs): ' + (pl.pass ? 'MISSED' : 'CAUGHT'));
  out.knownAnswer = { id: 'mainTolvo', pass: pl.pass, missedVariants: pl.missedVariants, variants: pl.variants, missedRuns: pl.missedRuns, missed: pl.missed.map(r => ({ key: r.key, from: r.from, to: r.to, missing: r.missing, why: r.why })) };
}
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
