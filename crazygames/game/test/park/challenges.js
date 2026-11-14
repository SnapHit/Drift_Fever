/* PLAYGROUND MEASURE 3: EACH CHALLENGE, EACH LEVEL. The scripted hands
   (hands.js: the throttle always on, no brake, steering hard left,
   straight or hard right, and the one button) drive a line for each
   challenge through the real game, from the park's own start: free
   drift started by its own action, the game's judge counting, the
   game's save paying. Bronze is asked of the plain starter; gold of
   any car a player can own.

   For every drive the count is made again from the recorded positions
   by other means (count.js: donuts by quadrant changes round the
   pillar, the eight by the winding of each piece of the path either
   side of the half way line, the slalom by side changes at each cone,
   the wall ride from the wall's own outline, the gate's speed from the
   positions either side of the line, the slide and the chain from the
   angle and the speed with the scorer's published numbers), and must
   agree with the judge's.

   Known answers, each of which can fail:
     - a slide broken in the middle of a donut does not count on;
     - a wall touched ends the wall ride;
     - a cone hit is not a cone passed;
     - the hands held to a player's controls: an input that is not one
       of a phone's is counted by the guard (a known answer feeds one);
     - the counts made again can disagree: a recording with a stretch
       cut out is caught.

   node game/test/park/challenges.js <part>    part: donut eight slalom wall gate open tour known
   writes review/park/challenge-<part>.json; run-all.sh runs every part */
import * as P from './lib.js';
import * as N from './count.js';
import { TUNE, LOOP } from '../../src/tune.js';
import { carBox } from '../../src/garage/roster.js';

const part = process.argv[2] || 'donut';
const S = TUNE.SCORING, K = LOOP.PARK, T = K.TARGETS;
const FULL = { power: 3, grip: 3, steer: 3 };
const env = await P.start(), out = { part, drives: [], reach: {} };
const pg = await P.parkPage(env, P.LANDSCAPE, 'fx=none');
const page = pg.page;
const levelOf = (id, v) => T[id].filter(t => v >= t).length;

/* the counts of a drive made again in Node */
function again(d, g) {
  const C = N.chains(d.rec, S), b = carBox(d.car), box = { hl: b.halfLength, hw: b.halfWidth };
  const gates = N.gatePasses(d.rec, g, C, K.GATE_ANGLE, K.GATE_CLEAN).filter(p => p.counts);
  const banked = N.chainPoints(d.rec, g, C, S, box);
  return { donut: N.donuts(d.rec, g, C, K.GRACE), eight: N.eights(d.rec, g, C), slalom: N.slalom(d.rec, g, C, K.SLALOM_REACH), wall: N.wallRide(d.rec, g, C, K.WALL_NEAR, K.GRACE, box), gate: gates.length ? Math.max(...gates.map(p => p.kmh)) : 0, slide: N.longSlide(d.rec, C), chain: banked.length ? Math.max(...banked) : 0, tour: N.tour(d.rec, g, C, K, box) };
}
const close = (id, a, b) => ['donut', 'eight', 'slalom', 'tour'].includes(id) ? a === b : id === 'gate' ? Math.abs(a - b) <= 1.5 : Math.abs(a - b) <= Math.max(1.5, 0.03 * Math.max(a, b));
let ground = null;
/* one drive: car, line, what it is for; says what the judge counted for id, the count made again, and the levels reached */
async function go(id, label, car, up, o) {
  await P.ownCar(page, car, up);
  const d = await P.drive(page, o);
  if (!ground) ground = await P.groundOf(page);
  const re = again(d, ground), judge = d.best[id], lv = levelOf(id, judge);
  const agree = close(id, judge, re[id]);
  const row = { id, label, car, up: up || null, line: o.line, args: o.args || [], seconds: d.seconds, judge: +judge.toFixed(1), again: +re[id].toFixed(1), agree, level: lv, guard: d.guard, hits: d.hits, hardHits: d.hardHits, cones: d.cones, paid: d.coins, steps: d.rec.length, all: Object.fromEntries(Object.entries(d.best).map(([k, v]) => [k, +v.toFixed(1)])), allAgain: Object.fromEntries(Object.entries(re).map(([k, v]) => [k, +v.toFixed(1)])) };
  out.drives.push(row);
  console.log('  ' + label + ' (' + car + (up ? ' fully upgraded' : '') + ', ' + d.seconds + ' s): the judge counts ' + row.judge + ', made again from the positions ' + row.again + '; level ' + lv + ' of 3; ' + d.hits + ' wall contacts, ' + d.cones + ' cones, ' + d.guard + ' inputs a phone could not make');
  P.say(agree, id + ', ' + label + ': the judge\'s count (' + row.judge + ') and the count made again (' + row.again + ') agree');
  P.say(d.guard === 0, id + ', ' + label + ': every input was a phone\'s (steer -1, 0 or 1, throttle on, no brake): ' + d.guard + ' were not');
  return { d, row, re };
}
/* the levels a challenge's drives reached, by car */
function reached(id, rows) {
  const r = {};
  ['bronze', 'silver', 'gold'].forEach((name, i) => { const hit = rows.filter(x => x.level > i), st = hit.find(x => x.car === 'starter' && !x.up); r[name] = hit.length ? { reached: true, target: T[id][i], car: st ? 'starter' : hit[0].car + (hit[0].up ? ' fully upgraded' : ''), by: (st || hit[0]).label, value: (st || hit[0]).judge } : { reached: false, target: T[id][i] }; });
  out.reach[id] = r;
  P.say(r.bronze.reached && r.bronze.car === 'starter', id + ' bronze (' + T[id][0] + '): reached by the scripted hands in the plain starter: ' + (r.bronze.reached ? r.bronze.value + ' in the ' + r.bronze.car : 'NOT REACHED'));
  P.say(r.silver.reached, id + ' silver (' + T[id][1] + '): ' + (r.silver.reached ? r.silver.value + ' in the ' + r.silver.car : 'NOT REACHED'));
  P.say(r.gold.reached, id + ' gold (' + T[id][2] + '): ' + (r.gold.reached ? r.gold.value + ' in the ' + r.gold.car : 'NOT REACHED by any scripted hand: unproven'));
}

if (part === 'donut') {
  const a = await go('donut', 'round the pillar eleven times', 'starter', null, { line: 'donut', args: [11], seconds: 100 });
  reached('donut', [a.row]);
} else if (part === 'eight') {
  const a = await go('eight', 'nine loops of the eight', 'starter', null, { line: 'eight', args: [9], seconds: 110 });
  reached('eight', [a.row]);
} else if (part === 'slalom') {
  const rows = [];
  for (const [amp, lag] of [[5.5, 4], [4, 4], [6.5, 0]]) { const a = await go('slalom', 'the weave ' + amp + ' m wide, drawn ' + lag + ' m early', 'starter', null, { line: 'slalom', args: [amp, lag], seconds: 45, hands: { cones: true } }); rows.push(a.row); if (a.row.level >= 2) break; }
  for (const [amp, lag] of [[6.5, 12], [4, 4], [5.5, 8], [6.5, 4], [4, 0], [4, 8], [5.5, 4], [6.5, 0]]) { const a = await go('slalom', 'the weave ' + amp + ' m wide, drawn ' + lag + ' m early', 'hatch', FULL, { line: 'slalom', args: [amp, lag], seconds: 45, hands: { cones: true } }); rows.push(a.row); if (a.row.level >= 3) break; }
  reached('slalom', rows);
} else if (part === 'wall') {
  const a = await go('wall', 'five laps round the inside of the curve', 'starter', null, { line: 'wall', args: [5.2], seconds: 130 });
  reached('wall', [a.row]);
} else if (part === 'gate') {
  const rows = [];
  rows.push((await go('gate', 'north through the first gate from the start, a flick 10 m before it', 'starter', null, { line: 'gate', args: [false, { off: -2, lead: 10, dir: 1 }], seconds: 14, tail: 0.5 })).row);
  for (const o of [{ off: -3, lead: 16, dir: -1 }, { off: 2, lead: 22, dir: -1 }, { off: -3, lead: 22, dir: -1 }]) { const a = await go('gate', 'round and back south through it, a flick ' + o.lead + ' m before, ' + o.off + ' m off its centre', 'starter', null, { line: 'gate', args: [true, o], seconds: 26, tail: 0.5 }); rows.push(a.row); if (a.row.level >= 2) break; }
  for (const o of [{ off: 0, lead: 16, dir: -1 }, { off: 3, lead: 16, dir: 1 }, { off: 1, lead: 16, dir: -1 }, { off: -1, lead: 16, dir: -1 }, { off: 0, lead: 13, dir: -1 }, { off: 0, lead: 19, dir: -1 }]) { const a = await go('gate', 'round and back south through it, a flick ' + o.lead + ' m before, ' + o.off + ' m off its centre', 'fastback', FULL, { line: 'gate', args: [true, o], seconds: 26, tail: 0.5 }); rows.push(a.row); if (a.row.level >= 3) break; }
  reached('gate', rows);
} else if (part === 'open') {
  const a = await go('slide', 'eleven turns of a circle on the open floor, then straight on', 'starter', null, { line: 'open', args: [11], seconds: 110, tail: 3 });
  reached('slide', [a.row]);
  const row = Object.assign({}, a.row, { id: 'chain', judge: a.row.all.chain, again: a.row.allAgain.chain, level: levelOf('chain', a.row.all.chain) });
  row.agree = close('chain', row.judge, row.again);
  P.say(row.agree, 'chain, the same drive: the judge\'s banked chain (' + row.judge + ') and the one worked again by the scorer\'s rule (' + row.again + ') agree');
  out.drives.push(row);
  reached('chain', [row]);
} else if (part === 'tour') {
  const a = await go('tour', 'one chain: the narrow gate, the wall, the donut pad, the first gate, the eight, the cones', 'starter', null, { line: 'tour', seconds: 70 });
  reached('tour', [a.row]);
} else if (part === 'known') {
  /* 1. a slide broken in the middle of a donut: after a turn and a half the hands are made to let go for a second; the count must start again, not carry on */
  await P.ownCar(page, 'starter', null);
  const whole = await P.drive(page, { line: 'donut', args: [4], seconds: 60 });
  ground = await P.groundOf(page);
  const broken = await P.drive(page, { line: 'donut', args: [4], seconds: 60, meddle: `const J = window.__loop.park().state; if (mem.t0 === undefined && Math.abs(J.donutWind) >= 1.5 * 2 * Math.PI) mem.t0 = t; if (mem.t0 !== undefined && t - mem.t0 < 1.0) { out.steer = 0; out.handbrake = 0; }` });
  const reB = again(broken, ground), reW = again(whole, ground);
  const series = broken.rec.map(r => r[N.JUDGE]), drop = series.findIndex((v, i) => i > 0 && v < series[i - 1]), before = drop > 0 ? series[drop - 1] : null;
  out.known = { donut: { whole: whole.best.donut, broken: broken.best.donut, again: reB.donut, wholeAgain: reW.donut, before, dropsTo: drop > 0 ? series[drop] : null } };
  P.say(whole.best.donut >= 4 && broken.best.donut < whole.best.donut && before === 1 && series[drop] === 0 && reB.donut === broken.best.donut, 'known answer: a slide broken in the middle of a donut does not count on: unbroken the same line counts ' + whole.best.donut + ' turns; let go for a second after a turn and a half, the count falls from ' + before + ' to ' + (drop > 0 ? series[drop] : '?') + ' and its best is ' + broken.best.donut + ' (made again: ' + reB.donut + ')');
  /* 2. a wall touched ends the wall ride: the line drawn a metre from the wall, and the hands told not to mind touching it */
  const ride = await P.drive(page, { line: 'wall', args: [1.2, 1.0], seconds: 40, hands: { SAFE: 0, SAFE_COST: 0, CRASH: 0 } });
  const ws = ride.rec.map(r => r[N.JUDGE + 3]), touchAt = ride.rec.findIndex((r, i) => i > 0 && r[N.TOUCH] && ws[i - 1] >= 3), reR = again(ride, ground);
  out.known.wall = { best: +ride.best.wall.toFixed(1), touchAt, before: touchAt > 0 ? +ws[touchAt - 1].toFixed(1) : null, after: touchAt > 0 ? +ws[Math.min(ws.length - 1, touchAt + 1)].toFixed(1) : null, again: +reR.wall.toFixed(1), hits: ride.hits };
  P.say(touchAt > 0 && ws[Math.min(ws.length - 1, touchAt + 1)] === 0 && ride.hits > 0 && close('wall', ride.best.wall, reR.wall), 'known answer: a wall touched ends the wall ride: riding a metre from the wall the car touches it after ' + (touchAt > 0 ? ws[touchAt - 1].toFixed(1) : '?') + ' m, and the count is ' + (touchAt > 0 ? ws[Math.min(ws.length - 1, touchAt + 1)] : '?') + ' on the step after the touch (' + ride.hits + ' contacts in the drive; its best ' + ride.best.wall.toFixed(0) + ' m, made again ' + reR.wall.toFixed(0) + ')');
  /* 3. a cone hit is not a cone passed: the weave drawn with no width runs down the cone line itself */
  const through = await P.drive(page, { line: 'slalom', args: [0.01, 0], seconds: 45 });
  const reT = again(through, ground);
  const sl = through.rec.map(r => r[N.JUDGE + 2]), knocks = through.rec.map((r, i) => i > 0 && r[N.CONES] > through.rec[i - 1][N.CONES] ? i : -1).filter(i => i > 0);
  const zeroAfter = knocks.every(i => sl[Math.min(sl.length - 1, i + 1)] === 0), neverUp = knocks.every(i => { for (let j = i; j < Math.min(sl.length, i + 40); j++) if (sl[j] > sl[i]) return false; return true; });
  out.known.slalom = { cones: through.cones, judge: through.best.slalom, again: reT.slalom, knocks: knocks.length, zeroAfter, neverUp };
  P.say(knocks.length >= 2 && zeroAfter && neverUp && through.best.slalom + through.cones <= ground.park.slalom.n && reT.slalom === through.best.slalom, 'known answer: a cone hit is not a cone passed: down the cone line the car knocks ' + through.cones + ' cones; on the step after each knock the count is nothing, it does not rise for a third of a second after, and its best is ' + through.best.slalom + ' (made again: ' + reT.slalom + ')');
  /* 4. the guard can count: hands asked to hold half steering */
  const guard = await page.evaluate(() => { const R = window.__hands, g = window.__loop.app.ground, w = window.__feel.world, clean = R.H.createHands(R.deps, g, R.lines.donut(1), {}), fed = R.H.createHands(R.deps, g, R.lines.donut(1), { flick: { at: 0, dir: 0.5, hb: 0.1, hold: 0.1 } }); for (let i = 0; i < 12; i++) { clean.input(w); fed.input(w); } return { clean: clean.guard, fed: fed.guard }; });
  out.known.guard = guard;
  P.say(guard.clean === 0 && guard.fed === 12, 'known answer: the guard counts an input a phone cannot make: the hands asked to hold half steering for 12 steps are counted ' + guard.fed + ' times (and ' + guard.clean + ' when left alone)');
  /* 5. the counts made again can disagree: the unbroken donut drive with a quarter of its steps cut out no longer agrees with the judge */
  const cut = Object.assign({}, whole, { rec: whole.rec.filter((r, i) => i < whole.rec.length * 0.35 || i > whole.rec.length * 0.6) });
  const reC = again(cut, ground);
  out.known.cut = { judge: whole.best.donut, again: reC.donut };
  P.say(reC.donut !== whole.best.donut, 'known answer: the count made again can disagree: with a quarter of the recording cut out it finds ' + reC.donut + ' turns against the judge\'s ' + whole.best.donut + ': ' + (reC.donut !== whole.best.donut ? 'CAUGHT' : 'MISSED'));
}
out.errors = pg.errors.slice(0, 5);
P.say(pg.errors.length === 0, 'no page errors: ' + pg.errors.length + (pg.errors.length ? ' (' + pg.errors[0] + ')' : ''));
await P.finish(env, 'challenge-' + part + '.json', out);
