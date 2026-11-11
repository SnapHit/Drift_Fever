/* DRIFT RACE MEASURE 2 (briefs/DRIFT-RACE.md): THE RIVAL DRIVES WELL,
   ROBUSTLY, WITH A PLAYER'S HANDS. The rivals round's measure 2, with
   his driver planning under the player's controls and the race's laps,
   no player in his world (his run does not depend on the player,
   measure 4 shows it):
   - in the page (Chromium's Math, the record) and in Node: respawns,
     hard hits, wall contacts, the lowest speed after LAUNCH seconds, the
     share of each corner spent sliding (scoring), his total;
   - in Node, the same under DISTURB.length small disturbances: the start
     up to 5 cm off in each direction and both axles' grip up to half a
     per cent off. The worst case of each number and how many runs miss
     the bar, not a median.
   - his hands, over his whole run, every step: the brake never above
     nothing, the throttle never below full except in DRIFT with no
     steering, and the rule's guard in rivals/rival.js never had to
     change an input (his driver planned with the player's controls).
   The bar, the rivals round's, set before measuring (BAR): no respawn,
   no hard hit, at most 2 wall contacts (scrapes), never under 40 km/h
   after the launch, every corner at least 30 per cent sliding, and his
   total within 25 per cent of his undisturbed total; and the hands.
   Known answers: the old Kestrow (the rivals round's numbers and
   driver, which lifted and braked) fails the hands; the first rival
   made too fast (KNOWN) misses the bar.

   node game/test/driftrace/hands.js [r1 ...]   writes review/driftrace/hands.json */
import path from 'node:path';
import * as R from '../rivals/lib.js';
import { measureRival, measureCore } from '../rivals/sim.js';
import { RIVALS, rivalById } from '../../src/rivals/roster.js';

export const BAR = { respawns: 0, hard: 0, contacts: 2, minKmh: 40, corner: 0.3, total: 0.25 };
export const KNOWN = { HB_OVER: 40, PROGRESS: 400, EDGE_SAFE: 0.3, EDGE_COST: 100, CRASH: 2000, ANGLE_CAP: 50, SLIDE_GAIN: 1.2 };   // too fast with a player's hands: never brakes, chases ground, the edge nearly free
/* twenty disturbances, all different: offsets in cm and grip in tenths of a per cent from a fixed sequence */
export const DISTURB = Array.from({ length: 20 }, (_, k) => ({ offset: [((k * 7) % 11 - 5) / 100, ((k * 3 + 4) % 11 - 5) / 100], grip: ((k * 5 + 2) % 11 - 5) / 1000 }));

/* the rivals round's Kestrow, as he was on main: his numbers, and his driver allowed to lift and brake (opts.free) */
export const OLD_KESTROW = { SLIDE_GAIN: 0.739, PROGRESS: 129, KEEP: 1029, ANGLE_CAP: 48.94, EDGE_SAFE: 0.8, EDGE_COST: 446, ENTRY: 24.74, VMAX: 29.82, CHAIN_KEEP: 2813, CHAIN_MARGIN: 0.4, AY_MAX: 8.84, OUTSIDE: 0.338, SETUP: 23.08, WINDOW_PRE: 3.64, WINDOW_POST: 14.58, LINK: 4.95, HB_TIME: 0.352 };
export function handsMiss(m) {
  const h = m.hands, why = [];
  if (h.brakeSteps) why.push('braked on ' + h.brakeSteps + ' steps (up to ' + h.maxBrake + ')');
  if (h.liftSteps) why.push('lifted on ' + h.liftSteps + ' steps (down to ' + h.minThrottle + ')');
  if (h.overruled) why.push('the guard changed ' + h.overruled + ' inputs');
  return why;
}
export function misses(m, base) {
  const why = handsMiss(m);
  if (!m.finished) why.push('did not finish');
  if (m.respawns > BAR.respawns) why.push(m.respawns + ' respawns');
  if (m.hard > BAR.hard) why.push(m.hard + ' hard hits');
  if (m.contacts > BAR.contacts) why.push(m.contacts + ' contacts');
  if (m.minKmh < BAR.minKmh) why.push(m.minKmh + ' km/h');
  if (m.worstCorner < BAR.corner) why.push('a corner ' + Math.round(m.worstCorner * 100) + '% sliding');
  if (base && Math.abs(m.total - base.total) > BAR.total * base.total) why.push('total ' + m.total + ' against ' + base.total);
  return why;
}

if (process.argv[1] && process.argv[1].endsWith('hands.js')) {
  const ids = process.argv.slice(2).filter(a => /^r\d/.test(a));
  const list = ids.length ? ids.map(rivalById) : RIVALS.slice(0, 1);
  const env = await R.start();
  const out = { bar: BAR, disturbances: DISTURB, rivals: [] };
  const src = measureCore.toString();
  for (const def of list) {
    const pg = await R.page(env, { width: 320, height: 180 }, '');
    const page = await pg.page.evaluate(async ({ src, def }) => {
      const [rv, so, mo, wo] = await Promise.all([import('/src/rivals/rival.js'), import('/src/ground/source.js'), import('/src/loop/modes.js'), import('/src/physics/world.js')]);
      const f = new Function('return (' + src + ')')();
      const d = window.__loop.RIVALS.find(r => r.id === def);
      const m = f({ createRival: rv.createRival, trackFor: so.trackFor, careerSpec: mo.careerSpec, battleLaps: mo.battleLaps, STEP: wo.STEP, LAUNCH: 3 }, d, {});
      delete m.trace; return m;
    }, { src, def: def.id });
    await pg.close();
    const node = measureRival(def);
    const dist = DISTURB.map(d => measureRival(def, d));
    const bad = dist.map(m => misses(m, page)).filter(w => w.length);
    const handsBad = dist.filter(m => handsMiss(m).length).length;
    const worst = { handsBad, respawns: Math.max(...dist.map(m => m.respawns)), hard: Math.max(...dist.map(m => m.hard)), contacts: Math.max(...dist.map(m => m.contacts)), minKmh: Math.min(...dist.map(m => m.minKmh)), worstCorner: +Math.min(...dist.map(m => m.worstCorner)).toFixed(2), totalLow: Math.min(...dist.map(m => m.total)), totalHigh: Math.max(...dist.map(m => m.total)), seconds: Math.max(...dist.map(m => m.seconds)) };
    const pageMiss = misses(page);
    R.verdict(pageMiss.length === 0, def.id + ' ' + def.name + ' on career ' + (def.track + 1) + ' in the page, ' + (def.laps || 2) + ' laps: hands ' + (handsMiss(page).length ? handsMiss(page).join(', ') : 'only a player\'s (brake never on, throttle always full, the guard never used)') + '; ' + page.seconds + ' s, total ' + page.total + ', respawns ' + page.respawns + ', hard hits ' + page.hard + ', contacts ' + page.contacts + ', lowest ' + page.minKmh + ' km/h, the least sliding corner ' + Math.round(page.worstCorner * 100) + '% (mean ' + Math.round(page.meanCorner * 100) + '%)' + (pageMiss.length ? ': ' + pageMiss.join(', ') : '') + '; in Node total ' + node.total + (node.hash === page.hash ? ', the same hash' : ', a different hash (the engines\' Math)'));
    R.verdict(bad.length === 0, def.id + ' under ' + dist.length + ' disturbances: ' + bad.length + ' miss the bar (' + handsBad + ' on the hands); worst respawns ' + worst.respawns + ', hard hits ' + worst.hard + ', contacts ' + worst.contacts + ', lowest ' + worst.minKmh + ' km/h, least sliding corner ' + Math.round(worst.worstCorner * 100) + '%, total ' + worst.totalLow + ' to ' + worst.totalHigh + (bad.length ? ' (' + bad.slice(0, 3).map(w => w.join(', ')).join('; ') + ')' : ''));
    out.rivals.push({ id: def.id, name: def.name, track: def.track, page, node: { ...node, trace: undefined }, worst, missing: bad.length, disturbed: dist.map(m => ({ total: m.total, respawns: m.respawns, hard: m.hard, contacts: m.contacts, minKmh: m.minKmh, worstCorner: +m.worstCorner.toFixed(3), seconds: m.seconds, hands: m.hands })) });
  }
  /* the known answer for the hands: the old Kestrow */
  const oldDef = { ...RIVALS[0], drive: OLD_KESTROW };
  const om = measureRival(oldDef, { free: true });
  const omiss = handsMiss(om);
  R.verdict(omiss.length > 0, 'known answer: the old Kestrow (the rivals round\'s numbers, a driver that lifts and brakes) fails the hands: ' + (omiss.length ? 'CAUGHT (' + omiss.join(', ') + ')' : 'MISSED'));
  out.knownAnswerHands = { hands: om.hands, total: om.total, seconds: om.seconds };
  /* the known answer: too fast */
  const fast = { ...RIVALS[0], drive: { ...RIVALS[0].drive, ...KNOWN } };
  const fm = [measureRival(fast), ...DISTURB.slice(0, 5).map(d => measureRival(fast, d))];
  const fmiss = fm.map(m => misses(m, out.rivals[0] ? out.rivals[0].page : null)).filter(w => w.length);
  R.verdict(fmiss.length > 0, 'known answer: the first rival made too fast (' + JSON.stringify(KNOWN) + ') misses the bar in ' + fmiss.length + ' of ' + fm.length + ' runs: ' + (fmiss.length ? 'CAUGHT (' + fmiss[0].join(', ') + ')' : 'MISSED'));
  out.knownAnswer = { drive: KNOWN, runs: fm.map(m => ({ total: m.total, hard: m.hard, contacts: m.contacts, minKmh: m.minKmh, worstCorner: m.worstCorner })), missing: fmiss.length };
  R.writeJson(path.join(R.raceDir, 'hands.json'), out);
  await env.close();
  console.log(R.failures() ? R.failures() + ' failed' : 'all passed');
  process.exit(R.failures() ? 1 : 0);
}
