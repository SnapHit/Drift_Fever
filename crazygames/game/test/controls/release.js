/* THE AUTHOR'S SLIDE ON A KEYBOARD (23 November 2026). He played Pro on
   a desktop for the first time: "I turned, tapped drift, countersteered,
   and the car always overturned and crashed into the wall." His keys, in
   the game's physics on the stunt park's ground with its solids taken
   out (nothing to hit), the car given SPEED straight ahead first: W held
   all through, the turn key held, SPACE for 0.2 s, the turn key still
   held until the slide passes 20 degrees, a person's 0.25 s to react,
   then the other key held CATCH s. Then either
   - the other key let go with W still held, as anyone does once the nose
     points down the road: does the car spin (the nose more than 90
     degrees from the travel) within 3 s; or
   - W let go at the same moment: is the slide under 10 degrees within a
     second, or at all.
   On Easy, the keyboard's default since that evening, the same keys
   (SPACE is DRIFT there and W only drives) must never spin.
   Known answer: on every Pro variant the probe sees the spin he saw,
   whenever the other key is let go with W held (a slide on Pro closes
   only when the throttle lifts), and lifting closes it. When Pro is
   reworked for keys, that line is the bar: no spin.
   node game/test/controls/release.js   writes review/controls/release.json */
import * as R from './lib.js';

const SPEEDS = [15, 20, 25], CATCH = [0.3, 0.6, 1.0, 1.5];
const SIDES = [['easy', 'first=2'], ['a', 'controls=pro&pro=a'], ['b', 'controls=pro&pro=b'], ['c', 'controls=pro&pro=c']];
const env = await R.start(), out = { speeds: SPEEDS, catch: CATCH, sides: {} };

for (const [name, q] of SIDES) {
  const pg = await R.emptyPage(env, { width: 1280, height: 720 }, q);
  const r = await pg.page.evaluate(async ({ SPEEDS, CATCH }) => {
    const L = window.__loop, F = window.__feel; F.draw = false;
    L.action('free');
    const W = await import('/src/physics/world.js');
    const tune = F.world.tune, ground = Object.assign({}, L.app.ground, { walls: [], cones: [] });
    const DEG = 180 / Math.PI, STEP = 1 / 120, HB = 0.2, REACT = 0.25, OPEN = 20;
    const res = [];
    for (const V of SPEEDS) for (const C of CATCH) for (const lift of [false, true]) {
      const w = W.createWorld(ground, { tune }), car = w.car;
      car.x = 0; car.z = 0; car.yaw = 0; car.wvx = 0; car.wvz = -V;
      const inp = { steer: 0, throttle: 1, brake: 0, handbrake: 0 };
      let t = 0, opened = null, counterAt = null, letGo = null, spun = null, closed = null, peak = 0;
      for (let i = 0; i < 120 * 10; i++) {
        const a = Math.atan2(car.vy, car.vx) * DEG;
        if (opened === null && t >= HB && (a >= OPEN || t >= HB + 1.2)) opened = t;
        if (opened !== null && counterAt === null && t >= opened + REACT) counterAt = t;
        if (counterAt !== null && letGo === null && t >= counterAt + C) letGo = t;
        inp.handbrake = t < HB ? 1 : 0;
        inp.steer = counterAt === null ? 1 : letGo === null ? -1 : 0;
        inp.throttle = letGo !== null && lift ? 0 : 1;
        w.stepWorld(inp); t += STEP;
        const s = Math.atan2(car.vy, car.vx) * DEG;
        if (Math.abs(s) > peak) peak = Math.abs(s);
        if (spun === null && Math.abs(s) > 90 && car.speed > 2) spun = { after: +(t - (letGo !== null ? letGo : counterAt !== null ? counterAt : 0)).toFixed(2), phase: letGo !== null ? 'let go' : counterAt !== null ? 'catch' : 'entry' };
        if (letGo !== null && closed === null && Math.abs(s) < 10) closed = +(t - letGo).toFixed(2);
        if (letGo !== null && t > letGo + 3) break;
      }
      res.push({ V, C, lift, spun, closed, peak: Math.round(peak) });
    }
    return { profile: L.profile(), res };
  }, { SPEEDS, CATCH });
  r.errors = pg.errors.length;
  out.sides[name] = r;
  await pg.close();
}
await env.close();

const cell = x => x.spun ? 'spin ' + x.spun.after + ' s' + (x.spun.phase !== 'let go' ? ' (in the ' + x.spun.phase + ')' : '') : x.closed !== null ? 'closed ' + x.closed + ' s' : 'held, peak ' + x.peak;
for (const [name, r] of Object.entries(out.sides)) {
  console.log('\n' + name + ' (' + r.profile.controls + (r.profile.variant ? ' ' + r.profile.variant : '') + '): the other key held for, then let go with W held | W let go too');
  console.log('  m/s ' + CATCH.map(c => (c + ' s').padStart(36)).join(''));
  for (const V of SPEEDS) console.log(String(V).padStart(5) + ' ' + CATCH.map(c => { const a = r.res.find(x => x.V === V && x.C === c && !x.lift), b = r.res.find(x => x.V === V && x.C === c && x.lift); return (cell(a) + ' | ' + cell(b)).padStart(36); }).join(''));
}
console.log('');
const easy = out.sides.easy;
R.verdict(easy.profile.controls === 'easy' && easy.res.every(x => x.spun === null), 'Easy, the keyboard\'s default: his keys never spin the car, at ' + SPEEDS.join(', ') + ' m/s with the other key held ' + CATCH.join(', ') + ' s (' + easy.res.filter(x => x.spun).length + ' spins in ' + easy.res.length + ')');
for (const v of ['a', 'b', 'c']) {
  const r = out.sides[v], held = r.res.filter(x => !x.lift), lifted = r.res.filter(x => x.lift);
  const spins = held.filter(x => x.spun && x.spun.phase === 'let go'), times = spins.map(x => x.spun.after);
  R.verdict(r.profile.controls === 'pro' && r.profile.variant === v && spins.length === held.length, 'known answer, the spin he saw: on Pro ' + v + ' letting the other key go with W held spins the car every time (' + spins.length + ' of ' + held.length + ', ' + (times.length ? Math.min(...times) + ' to ' + Math.max(...times) + ' s after letting go' : 'never') + '): ' + (spins.length === held.length ? 'CAUGHT' : 'MISSED') + '. The bar for Pro reworked for keys: no spin');
  const shut = lifted.map(x => x.closed).filter(x => x !== null);
  R.verdict(lifted.every(x => !x.spun && x.closed !== null), 'Pro ' + v + ': lifting W as the other key is let go is the way out, closing the slide under 10 degrees every time with no spin (' + shut.length + ' of ' + lifted.length + ', ' + Math.min(...shut) + ' to ' + Math.max(...shut) + ' s)');
}
R.verdict(Object.values(out.sides).every(r => r.errors === 0), 'no page errors');
process.exit(R.finish('release', out) ? 1 : 0);
