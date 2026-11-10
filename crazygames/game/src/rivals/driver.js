/* THE RIVAL'S DRIVER (briefs/RIVALS.md 1). Grown from the scripted
   drifter in ../physics/driver.js, which stays as it is (every
   measurement since the feel round uses it, and the career seeds were
   chosen by it). It writes the same input record the player does and
   reads only its own world: its car, and the track.

   It drives by looking ahead. Every REPLAN steps it tries a handful of
   ways to drive the next HORIZON seconds on a copy of its own car,
   stepped by the same vehicle code the world uses: stay on grip along
   its line, or hold a slide at one of a few depths of steering into it
   (with a flick of DRIFT / BRAKE first if it is not sliding yet). Each
   try is marked the way the game marks a drift (angle times speed while
   the slide scores), less a heavy cost for any corner of the body
   coming near the edge of the road, plus the ground it covers. The best
   is driven until the next look. So he commits to a slide as a corner
   comes, holds it while the road allows, and lets it go before the
   wall, and because he looks again a dozen times a second, a last bit
   of difference in Math.sin on another engine is corrected, not
   compounded. Nothing timed by a clock, nothing random: the same world
   gives the same run.

   The copy of the car sees no walls and keeps the road's slope as it
   is at the look (the world's own collisions and slope apply to the
   real car), which is why it looks only a second ahead and again soon.

   A character (rivals/roster.js) is a few overrides of RIVAL_DRIVE. */
import { stepVehicle, STEP } from '../physics/vehicle.js';
import { TUNE } from '../tune.js';

export const RIVAL_DRIVE = {
  /* looking ahead */
  HORIZON:      1.0,     // s each try is driven ahead
  REPLAN:       6,       // physics steps between looks
  INTO:         [0.1, 0.2, 0.32, 0.48, 0.7, 1.0],   // the depths of steering into the slide tried
  KEEP:         60,      // a bonus for the try already being driven, so he does not dither between near equals
  /* the marks */
  SLIDE_GAIN:   0.35,    // weight of the slide: angle in degrees times km/h, per second (the score's own measure), times the share of the travel along the road
  ANGLE_CAP:    48,      // degrees past which more angle earns no more
  PROGRESS:     60,      // per metre covered along the track
  ALONG_MIN:    0.6,     // the travel's share along the road below which it costs (heading round, not down the road)
  ASTRAY:       4000,    // per unit short of it, per second
  EDGE_SAFE:    2.0,     // m between the body and the edge below which it costs
  EDGE_COST:    900,     // per metre short of EDGE_SAFE, per second
  CRASH:        60000,   // a try that puts a corner of the body past the edge
  SLOW:         10,      // m/s: ending a try slower than this costs
  SLOW_COST:    600,     // per m/s under it
  /* on grip, between corners */
  LOOK_BASE:    5,       // m of look ahead at rest
  LOOK_GAIN:    0.42,    // m per m/s
  STEER_GAIN:   2.4,     // input per radian to the target
  AY_MAX:       7.0,     // m/s^2 of cornering planned for on grip
  VMAX:         32,      // m/s on a straight
  ENTRY:        25,      // m/s wanted at the start of a corner
  BRAKE_GAIN:   0.25,    // brake per m/s over the speed wanted
  OUTSIDE:      0.45,    // share of the half width to the outside of the next corner the grip line moves to
  SETUP:        50,      // m before a corner the grip line moves out
  EDGE:         2.6,     // m of the half width kept clear by the grip line
  /* when sliding is tried */
  WINDOW_PRE:   10,      // m before a corner's start a slide may be tried
  WINDOW_POST:  4,       // m before its end the last slide may be started
  LINK:         30,      // m: within this of the next corner, a slide may be held across the gap
  HB_TIME:      0.25,    // s of DRIFT / BRAKE in a flick
  /* his chain: the score banks an open chain after SCORING.BANK_GAP seconds
     without a scoring slide; a try that lets it lapse while the next
     corner is within LINK costs this, so he links corners decisively
     instead of by a coin toss at the gap */
  CHAIN_KEEP:   2500,
  CHAIN_MARGIN: 0.25,    // s short of the bank gap the cost is judged at
  /* a character's own line (0: none): a reward per metre the car is to the outside (positive) of a corner */
  WIDE:         0,
};

const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const DEG = 180 / Math.PI;

export function createRivalDriver(ground, character, override) {
  const D = Object.assign({}, RIVAL_DRIVE, character || {}, override || {});
  const C = ground.centre, n = C.length, closed = ground.kind === 'circuit', L = ground.length;
  const at = i => closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
  const kap = new Float64Array(n);
  for (let i = 0; i < n; i++) kap[i] = Math.abs(wrap(C[at(i + 1)].heading - C[at(i - 1)].heading)) / 4;
  const corners = (ground.corners || []).map(c => ({ from: c.from, to: c.to, sign: c.dir === 'left' ? 1 : -1, name: c.name })).sort((a, b) => a.from - b.from);
  const H = Math.round(D.HORIZON / STEP), HB = Math.round(D.HB_TIME / STEP);

  /* the corner the car is in, or the next one, and how far to it */
  function cornerAt(s) {
    let best = null, ahead = Infinity;
    for (const c of corners) {
      if (s >= c.from && s <= c.to) return { c, ahead: 0 };
      const a = closed ? ((c.from - s) % L + L) % L : c.from - s;
      if (a > 0 && a < ahead) { ahead = a; best = c; }
    }
    return { c: best, ahead };
  }
  /* the grip line's offset (left positive) at s: out towards the outside of the next corner */
  function gripOffset(s, width) {
    const { c, ahead } = cornerAt(s);
    if (!c || ahead === 0 || ahead > D.SETUP) return 0;
    const k = 1 - ahead / D.SETUP, e = k * k * (3 - 2 * k);
    return -c.sign * D.OUTSIDE * Math.max(0, width / 2 - D.EDGE) * e;
  }
  /* the grip policy: pure pursuit on the line, and the speed for the corner ahead */
  function grip(car, ci, s, out) {
    const v = car.speed;
    const look = D.LOOK_BASE + D.LOOK_GAIN * v;
    const t = C[at(ci + Math.round(look / 2))];
    const off = gripOffset(s + look, t.width);
    const tx = t.x - Math.cos(t.heading) * off, tz = t.z + Math.sin(t.heading) * off;
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw), lx = -Math.cos(car.yaw), lz = Math.sin(car.yaw);
    const dx = tx - car.x, dz = tz - car.z;
    const ang = Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz);
    let steer = -ang * D.STEER_GAIN;
    out.steer = steer > 1 ? 1 : steer < -1 ? -1 : steer;
    let kmax = 0;
    const { c, ahead } = cornerAt(s);
    const plan = Math.max(14, v * 1.6) / 2;
    for (let k = 0; k <= plan; k++) { if (c && ahead > 0 && k * 2 >= ahead) break; if (c && ahead === 0) break; const kk = kap[at(ci + k)]; if (kk > kmax) kmax = kk; }
    let vWant = kmax > 1e-4 ? Math.min(D.VMAX, Math.sqrt(D.AY_MAX / kmax)) : D.VMAX;
    if (c && ahead > 0) vWant = Math.min(vWant, Math.sqrt(D.ENTRY * D.ENTRY + 2 * 8 * ahead));
    out.throttle = v < vWant ? 1 : 0;
    out.brake = v > vWant + 0.5 ? Math.min(1, (v - vWant) * D.BRAKE_GAIN) : 0;
    out.handbrake = 0;
    return out;
  }

  /* ---- a try, on a copy of the car ---- */
  const sim = {}, inp = { steer: 0, throttle: 1, brake: 0, handbrake: 0 };
  function nearest(x, z, ci) {
    let best = ci, bd = Infinity;
    for (let k = -3; k <= 4; k++) { const j = at(ci + k), c = C[j], d = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z); if (d < bd) { bd = d; best = j; } }
    return best;
  }
  /* kind: -1 grip, else an index into INTO; dir the slide's sign */
  const SC = TUNE.SCORING;
  const scores = c => Math.abs(c.slip) * DEG >= SC.MIN_ANGLE && c.speed >= SC.MIN_SPEED && c.vx > 0;
  /* is the next corner near enough that an open chain should live to it */
  function linkAhead(s) { const { c, ahead } = cornerAt(s); return !!c && ahead <= D.LINK; }
  function rollout(car, ci0, s0, kind, dir, hl, hw0) {
    Object.assign(sim, car);
    let ci = ci0, value = 0, flick = kind >= 0 && !car.drifting ? HB : 0;
    let gapT = sinceSlide, chain = sinceSlide < SC.BANK_GAP;
    const into = kind >= 0 ? D.INTO[kind] : 0;
    for (let k = 0; k < H; k++) {
      const c = C[ci];
      const lx = -Math.cos(c.heading), lz = Math.sin(c.heading), fx = -Math.sin(c.heading), fz = -Math.cos(c.heading);
      const lat = (sim.x - c.x) * lx + (sim.z - c.z) * lz;
      const s = ci * 2 + (sim.x - c.x) * fx + (sim.z - c.z) * fz;
      if (kind < 0) grip(sim, ci, s, inp);
      else if (flick > 0) { flick--; inp.steer = dir; inp.throttle = 1; inp.brake = 0; inp.handbrake = 1; }
      else { inp.steer = into * dir; inp.throttle = 1; inp.brake = 0; inp.handbrake = 0; }
      stepVehicle(sim, inp, STEP);
      ci = nearest(sim.x, sim.z, ci);
      /* the body's reach across the road: its corners at the angle it makes with the road */
      const rel = wrap(sim.yaw - C[ci].heading);
      const reach = hl * Math.abs(Math.sin(rel)) + hw0 * Math.abs(Math.cos(rel));
      const cc = C[ci], clx = -Math.cos(cc.heading), clz = Math.sin(cc.heading);
      const l2 = (sim.x - cc.x) * clx + (sim.z - cc.z) * clz;
      const margin = cc.width / 2 - Math.abs(l2) - reach;
      if (margin < 0) { value -= D.CRASH * (1 - k / H); break; }
      if (margin < D.EDGE_SAFE) value -= D.EDGE_COST * (D.EDGE_SAFE - margin) * STEP;
      /* travel down the road, not round: the slide only pays for the share of the travel that is along it */
      const along = Math.cos(wrap(Math.atan2(-sim.wvx, -sim.wvz) - cc.heading));
      if (along < D.ALONG_MIN) value -= D.ASTRAY * (D.ALONG_MIN - along) * STEP;
      const angle = Math.abs(sim.slip) * DEG;
      if (angle >= 12 && sim.speed >= 6 && sim.vx > 0 && along > 0) value += D.SLIDE_GAIN * Math.min(angle, D.ANGLE_CAP) * sim.speed * 3.6 * STEP * along;
      if (D.WIDE && dir) value += D.WIDE * (-l2 * -dir) * STEP;   // outside of the slide's corner
      if (scores(sim)) gapT = 0; else gapT += STEP;
      if (chain && gapT >= SC.BANK_GAP - D.CHAIN_MARGIN) { chain = false; if (linkAhead(ci * 2)) value -= D.CHAIN_KEEP; }
      void lat; void s;
    }
    const cEnd = C[ci];
    const sEnd = ci * 2 + (sim.x - cEnd.x) * -Math.sin(cEnd.heading) + (sim.z - cEnd.z) * -Math.cos(cEnd.heading);
    let ds = sEnd - s0; if (closed) { if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L; }
    value += D.PROGRESS * ds;
    if (sim.speed < D.SLOW) value -= D.SLOW_COST * (D.SLOW - sim.speed);
    return value;
  }

  let choice = -1, dirNow = 0, flickLeft = 0, untilReplan = 0, sinceSlide = 1e9;
  const out = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
  const last = { tries: 0 };
  function reset() { choice = -1; dirNow = 0; flickLeft = 0; untilReplan = 0; sinceSlide = 1e9; }
  function input(world) {
    const car = world.car, s = world.along, ci = world.centreIndex;
    const V = car.tune ? car.tune.VEHICLE : null;
    const hl = V ? V.HALF_LENGTH : 2.2, hw0 = V ? V.HALF_WIDTH : 0.92;
    sinceSlide = scores(car) ? 0 : sinceSlide + STEP;
    if (--untilReplan <= 0) {
      untilReplan = D.REPLAN;
      const { c, ahead } = cornerAt(s);
      /* may a slide be tried here: in a corner's window, or held across a short gap to the next */
      let dir = 0;
      if (c) {
        const inWindow = ahead > 0 ? ahead <= D.WINDOW_PRE : s <= c.to - D.WINDOW_POST || car.drifting;
        if (inWindow || ((car.drifting || sinceSlide < SC.BANK_GAP) && ahead <= D.LINK)) dir = -c.sign;
      }
      let best = -1, bestV = 0;
      last.tries = 0;
      if (dir && car.speed > 8) {
        bestV = rollout(car, ci, s, -1, 0, hl, hw0) + (choice === -1 ? D.KEEP : 0);
        last.tries = 1;
        for (let k = 0; k < D.INTO.length; k++) {
          const v = rollout(car, ci, s, k, dir, hl, hw0) + (choice === k && dirNow === dir ? D.KEEP : 0);
          last.tries++;
          if (v > bestV) { bestV = v; best = k; }
        }
      }
      if (best >= 0 && !(choice >= 0 && dirNow === dir) && !car.drifting) flickLeft = HB;
      if (best < 0) flickLeft = 0;
      choice = best; dirNow = best >= 0 ? dir : 0;
      last.value = bestV;
    }
    if (choice < 0) return grip(car, ci, s, out);
    if (flickLeft > 0) { flickLeft--; out.steer = dirNow; out.throttle = 1; out.brake = 0; out.handbrake = 1; return out; }
    out.steer = D.INTO[choice] * dirNow; out.throttle = 1; out.brake = 0; out.handbrake = 0;
    return out;
  }
  return { input, reset, params: D, corners, get mode() { return choice < 0 ? 'grip' : 'drift' + choice; }, last };
}
