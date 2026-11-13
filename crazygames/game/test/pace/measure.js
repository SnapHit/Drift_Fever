/* THE PACE ROUND'S MEASURES (briefs/RIVALS-PACE.md), 14 November 2026.

   bars: for each rival named, the three bars the brief sets:
   - his undisturbed run in the page (Chromium's arithmetic, the
     record): the driving bar of driftrace/hands.js (no respawn, no hard
     hit, at most two scrapes, never under 40 km/h after the launch,
     every corner at least 30 per cent sliding, only a player's hands);
   - the 20 disturbed runs (hands.js DISTURB) in Node: at most
     BARS.disturbed miss the bar against the page run;
   - the plateau (ladder2/plateau.js, each driving number one per cent
     either way, 5 disturbed runs each): at most BARS.plateau of the
     moves miss.
   Known answer (--main): Halvik as he is on main fails the disturbed
   bar.

   table: all six rivals in the page, each one's setup, race seconds,
   own points (drift, clean and pace, no lead bonuses), points a second
   and multiple (points a second over his track's three star rate,
   ladder3/ruler.js threeStarRate, computed in the page too). It climbs
   when every rival from Varsk on has a higher multiple than the one
   before and none is above BARS.ceiling.
   Known answer (--main): the table with main's last three does not
   climb after Varsk.

   A candidate not yet in the roster can be judged with --def JSON (an
   entry merged over his roster entry).

   node game/test/pace/measure.js bars [r4 r5 r6] [--main] [--def JSON]   writes review/pace/bars.json
   node game/test/pace/measure.js table [--main]                           writes review/pace/table.json */
import path from 'node:path';
import fs from 'node:fs';
import * as R from '../rivals/lib.js';
import { measureRival, measureCore } from '../rivals/sim.js';
import { DISTURB, misses } from '../driftrace/hands.js';
import { plateau } from '../ladder2/plateau.js';
import { RIVALS, rivalById } from '../../src/rivals/roster.js';
import { CAREER } from '../../src/loop/modes.js';
import { MAIN } from './main.js';

export const BARS = { contacts: 2, disturbed: 2, plateau: 4, ceiling: 6 };
const dir = path.join(R.root, 'review', 'pace');
const args = process.argv.slice(2), mode = args[0];
const ids = args.filter(a => /^r\d$/.test(a));
const defArg = args.includes('--def') ? JSON.parse(args[args.indexOf('--def') + 1]) : null;
const mainOnly = args.includes('--main');

/* one rival measured in the page with the page's own modules: the measurement of sim.js, and his track's three star rate */
async function inPage(env, def) {
  const pg = await R.page(env, { width: 320, height: 180 }, '');
  const m = await pg.page.evaluate(async ({ src, def }) => {
    const [rv, so, mo, wo, tu] = await Promise.all([import('/src/rivals/rival.js'), import('/src/ground/source.js'), import('/src/loop/modes.js'), import('/src/physics/world.js'), import('/src/tune.js')]);
    const f = new Function('return (' + src + ')')();
    const m = f({ createRival: rv.createRival, trackFor: so.trackFor, careerSpec: mo.careerSpec, battleLaps: mo.battleLaps, STEP: wo.STEP, LAUNCH: 3 }, def, {});
    const track = so.trackFor(mo.careerSpec(def.track)), laps = mo.lapsFor(track);
    m.star = mo.starTargets(track, laps)[2] / (mo.runMetres(track, laps) / tu.TUNE.SCORING.PAR_SPEED);
    m.laps = mo.battleLaps(track, def);
    delete m.trace; return m;
  }, { src: measureCore.toString(), def });
  await pg.close();
  return m;
}
const setup = d => CAREER[d.track].name + ', ' + d.car + (d.up ? ' +' + [d.up.power, d.up.grip, d.up.steer].join('/') : '') + ', ' + (d.laps || 2) + ' laps';
const angleOf = m => +(m.corners.reduce((a, c) => a + c.angle, 0) / m.corners.length).toFixed(1);

const env = await R.start();
const out = { bars: BARS, measured: new Date().toISOString().slice(0, 10) };

if (mode === 'bars') {
  const list = mainOnly ? [MAIN.r5] : (ids.length ? ids : ['r4', 'r5', 'r6']).map(id => defArg && defArg.id === id ? { ...rivalById(id), ...defArg } : rivalById(id));
  out.rivals = {};
  for (const def of list) {
    const page = await inPage(env, def);
    const own = misses(page);
    const dist = DISTURB.map(d => measureRival(def, d));
    const bad = dist.map(m => misses(m, page)).filter(w => w.length);
    const pl = plateau(def);
    const mult = page.total / page.seconds / page.star;
    const row = { id: def.id, name: def.name, setup: setup(def), car: def.car, up: def.up || null, laps: page.laps, track: def.track, drive: def.drive, style: def.style,
      page: { seconds: page.seconds, total: page.total, drift: page.drift, clean: page.clean, pace: page.pace, best: page.best, respawns: page.respawns, hard: page.hard, contacts: page.contacts, minKmh: page.minKmh, worstCorner: +page.worstCorner.toFixed(3), angle: angleOf(page), hands: page.hands, hash: page.hash },
      rate: +(page.total / page.seconds).toFixed(1), star: +page.star.toFixed(3), multiple: +mult.toFixed(2),
      pageBar: { pass: own.length === 0, why: own },
      disturbed: { pass: bad.length <= BARS.disturbed, missing: bad.length, of: dist.length, why: bad.map(w => w.join(', ')), worst: { hard: Math.max(...dist.map(m => m.hard)), contacts: Math.max(...dist.map(m => m.contacts)), minKmh: Math.min(...dist.map(m => m.minKmh)), worstCorner: +Math.min(...dist.map(m => m.worstCorner)).toFixed(3), total: [Math.min(...dist.map(m => m.total)), Math.max(...dist.map(m => m.total))] } },
      plateau: { pass: pl.missedVariants <= BARS.plateau, missedVariants: pl.missedVariants, variants: pl.variants, missedRuns: pl.missedRuns, runs: pl.runs, missed: pl.missed.map(r => ({ key: r.key, from: r.from, to: r.to, missing: r.missing, why: r.why })) } };
    out.rivals[def.id] = row;
    const tag = (mainOnly ? 'known answer, main\'s ' : '') + def.name + ' (' + row.setup + ')';
    if (mainOnly) {
      R.verdict(!row.disturbed.pass, tag + ' fails the disturbed bar: ' + row.disturbed.missing + ' of 20 miss (bar ' + BARS.disturbed + ') ' + (row.disturbed.pass ? 'MISSED' : 'CAUGHT') + ' :: ' + row.disturbed.why.slice(0, 2).join('; '));
    } else {
      R.verdict(row.pageBar.pass, tag + ' in the page: ' + page.seconds + ' s, ' + page.total + ' points, ' + row.rate + ' a second, x' + row.multiple + '; respawns ' + page.respawns + ', hard ' + page.hard + ', scrapes ' + page.contacts + ', lowest ' + page.minKmh + ' km/h, least sliding corner ' + Math.round(page.worstCorner * 100) + '%, mean angle ' + row.page.angle + ' deg, best chain ' + page.best + ', the guard ' + page.hands.overruled + (own.length ? ' :: ' + own.join(', ') : ''));
      R.verdict(row.disturbed.pass, tag + ' 20 disturbed: ' + row.disturbed.missing + ' miss (bar ' + BARS.disturbed + '); worst hard ' + row.disturbed.worst.hard + ', scrapes ' + row.disturbed.worst.contacts + ', lowest ' + row.disturbed.worst.minKmh + ' km/h, corner ' + Math.round(row.disturbed.worst.worstCorner * 100) + '%, total ' + row.disturbed.worst.total.join(' to ') + (bad.length ? ' :: ' + row.disturbed.why.slice(0, 3).join('; ') : ''));
      R.verdict(row.plateau.pass, tag + ' plateau: ' + pl.missedVariants + ' of ' + pl.variants + ' moves miss (' + pl.missedRuns + ' of ' + pl.runs + ' runs; bar ' + BARS.plateau + ')' + (pl.missed.length ? ' :: ' + pl.missed.map(r => r.key + (r.to > r.from ? '+' : '-') + ' ' + r.missing + ' (' + r.why[0] + ')').join('; ') : ''));
    }
  }
  const file = path.join(dir, mainOnly ? 'bars-main.json' : 'bars.json');
  const prev = fs.existsSync(file) && !mainOnly ? JSON.parse(fs.readFileSync(file, 'utf8')) : { rivals: {} };
  R.writeJson(file, { ...out, rivals: { ...prev.rivals, ...out.rivals } });
}

if (mode === 'table') {
  const list = RIVALS.map(d => mainOnly && MAIN[d.id] ? MAIN[d.id] : d);
  const rows = [];
  for (const def of list) {
    const m = await inPage(env, def);
    rows.push({ id: def.id, name: def.name, setup: setup(def), seconds: m.seconds, total: m.total, rate: +(m.total / m.seconds).toFixed(1), star: +m.star.toFixed(3), multiple: +(m.total / m.seconds / m.star).toFixed(2), hard: m.hard, contacts: m.contacts, respawns: m.respawns, hash: m.hash });
  }
  for (const r of rows) console.log('   ' + r.name.padEnd(8) + ' ' + r.setup.padEnd(40) + ' ' + String(r.seconds).padStart(6) + ' s ' + String(r.total).padStart(6) + ' ' + String(r.rate).padStart(5) + '/s  x' + r.multiple + '  hard ' + r.hard + ' scrapes ' + r.contacts);
  const k = rows.findIndex(r => r.id === 'r3');
  const stepFails = rows.slice(k + 1).filter((r, i) => !(r.multiple > rows[k + i].multiple)).map(r => r.name + ' x' + r.multiple + ' not above ' + rows[rows.indexOf(r) - 1].name + ' x' + rows[rows.indexOf(r) - 1].multiple);
  const over = rows.filter(r => r.multiple > BARS.ceiling).map(r => r.name + ' x' + r.multiple);
  const climbs = !stepFails.length && !over.length;
  if (mainOnly) R.verdict(!climbs, 'known answer: the table with main\'s last three does not climb after Varsk: ' + (climbs ? 'MISSED' : 'CAUGHT (' + [...stepFails, ...over].join('; ') + ')'));
  else R.verdict(climbs, 'the table climbs after Varsk and nobody is above x' + BARS.ceiling + (climbs ? '' : ': ' + [...stepFails, ...over].join('; ')));
  R.writeJson(path.join(dir, mainOnly ? 'table-main.json' : 'table.json'), { ...out, rows, climbs, stepFails, over });
}
await env.close();
console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
process.exit(R.failures() ? 1 : 0);
