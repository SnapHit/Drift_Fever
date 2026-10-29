/* THE HANDLING PROBE, after the author's first play on 29 October 2026:
   too slow, the turn tips into a spin, and the car gets stuck facing a
   wall with no way out. Node, no browser: the physics is plain modules.

   1. Pace: 0 to 100 km/h, speed after 5 s, top speed on the flat.
   2. Spins: player-like input patterns at three speeds (hold full steer;
      a handbrake tap then steer held; handbrake held with steer; a flick
      left then right), each followed by letting go of the steering.
      A spin is the body slip passing 100 degrees, or the slide still over
      25 degrees 1.5 s after letting go. Reports the count.
   3. Stuck: the car parked nose to a wall with the throttle on (touch
      plays with the throttle always on), and nose to a wall pressing
      reverse. Escaped when it is 3 m clear of the wall and moving, or the
      game has put it back on the track, within 3 s.
   Known answers: assist off must spin more than assist on; with the
   recovery switched off the throttle-on case must stay stuck.

   node game/test/feel/handling.js [--json] */
import { createVehicle, stepVehicle, STEP } from '../../src/physics/vehicle.js';
import { createWorld } from '../../src/physics/world.js';
import { testTrack } from '../../src/ground/track.js';
import { TUNE } from '../../src/tune.js';

const DEG = Math.PI / 180;
const out = {};

function pace() {
  const s = createVehicle(0, 0, 0);
  let t = 0, t100 = null, v5 = null, top = 0;
  for (let i = 0; i < 30 / STEP; i++) {
    stepVehicle(s, { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, STEP);
    t += STEP;
    if (t100 === null && s.speed * 3.6 >= 100) t100 = t;
    if (v5 === null && t >= 5) v5 = s.speed * 3.6;
    top = Math.max(top, s.speed * 3.6);
  }
  return { zeroTo100s: t100 === null ? null : +t100.toFixed(2), kmhAfter5s: +v5.toFixed(1), topKmh: +top.toFixed(1) };
}

function pattern(name, v0) {
  const s = createVehicle(0, 0, 0);
  s.wvz = -v0;                         // rolling forward at v0
  const seq = [];
  const add = (secs, inp) => { for (let i = 0; i < secs / STEP; i++) seq.push(inp); };
  const T = 1, R = { steer: 1, throttle: T, brake: 0, handbrake: 0 };
  if (name === 'hold steer') add(3, R);
  if (name === 'handbrake tap, steer held') { add(0.4, { ...R, handbrake: 1 }); add(2.6, R); }
  if (name === 'handbrake held with steer') { add(1.2, { ...R, handbrake: 1 }); add(1.8, R); }
  if (name === 'flick left then right') { add(0.6, { ...R, steer: -1 }); add(0.3, { ...R, handbrake: 1 }); add(2.1, R); }
  const letGo = seq.length;
  add(1.5, { steer: 0, throttle: T, brake: 0, handbrake: 0 });
  let maxSlip = 0, spun = false;
  for (let i = 0; i < seq.length; i++) {
    stepVehicle(s, seq[i], STEP);
    const a = Math.abs(s.slip) / DEG;
    if (s.speed > 2) { maxSlip = Math.max(maxSlip, a); if (a > 100) spun = true; }
  }
  const endSlip = Math.abs(s.slip) / DEG;
  const unrecovered = s.speed > 2 && endSlip > 25;
  void letGo;
  return { name, v0, maxSlip: +maxSlip.toFixed(1), endSlip: +endSlip.toFixed(1), spin: spun || unrecovered };
}

function spins() {
  const names = ['hold steer', 'handbrake tap, steer held', 'handbrake held with steer', 'flick left then right'];
  const rows = [];
  for (const v of [15, 25, 35]) for (const n of names) rows.push(pattern(n, v));
  return { cases: rows.length, spins: rows.filter(r => r.spin).length, rows };
}

function stuck(mode) {
  const g = testTrack();
  const w = createWorld(g);
  // nose to the nearest wall: find a left wall point and the inward normal there
  const seg = w.segs.find(s => s.side === 'left' && s.index === 40) || w.segs[40];
  const px = seg.ax + seg.ux * seg.len / 2 + seg.nx * 2.6, pz = seg.az + seg.uz * seg.len / 2 + seg.nz * 2.6;
  // facing the wall: forward = -n, so yaw = atan2(nx, nz)
  Object.assign(w.car, createVehicle(px, pz, Math.atan2(seg.nx, seg.nz)));
  const inp = mode === 'reverse' ? { steer: 0, throttle: 0, brake: 1, handbrake: 0 } : { steer: 0, throttle: 1, brake: 0, handbrake: 0 };
  let escaped = null;
  for (let i = 0; i < 3 / STEP; i++) {
    w.stepWorld(inp);
    const d = (w.car.x - (seg.ax + seg.ux * seg.len / 2)) * seg.nx + (w.car.z - (seg.az + seg.uz * seg.len / 2)) * seg.nz;
    if (escaped === null && (w.respawned || w.recovered || (d > 3 + 2.2 && w.car.speed > 1))) { escaped = +(i * STEP).toFixed(2); }
  }
  return { mode, escapedAfterS: escaped, stuck: escaped === null };
}

out.pace = pace();
out.spins = spins();
out.stuck = [stuck('throttle'), stuck('reverse')];
const level = TUNE.ASSIST.LEVEL;
TUNE.ASSIST.LEVEL = 0;
out.knownAnswerAssistOff = { spins: spins().spins };
TUNE.ASSIST.LEVEL = level;
if ('RECOVER_AFTER' in TUNE.ASSIST) { const r = TUNE.ASSIST.RECOVER_AFTER; TUNE.ASSIST.RECOVER_AFTER = 1e9; out.knownAnswerNoRecovery = stuck('throttle'); TUNE.ASSIST.RECOVER_AFTER = r; }
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  console.log('pace', JSON.stringify(out.pace));
  console.log('spins', out.spins.spins + ' of ' + out.spins.cases, out.spins.rows.filter(r => r.spin).map(r => r.name + '@' + r.v0 + ' max ' + r.maxSlip + ' end ' + r.endSlip).join('; '));
  console.log('stuck', JSON.stringify(out.stuck));
  console.log('known answers', JSON.stringify({ assistOffSpins: out.knownAnswerAssistOff.spins, noRecovery: out.knownAnswerNoRecovery }));
}
