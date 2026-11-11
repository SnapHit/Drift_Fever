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
  SUB:          2,       // physics steps per step of a try: the copy is stepped at 60 Hz, the real car at 120
  REPLAN:       8,       // physics steps between looks; a look's tries are spread over them, a few each step
  INTO:         [0.1, 0.2, 0.32, 0.48, 0.7, 1.0],   // the depths of steering into the slide tried
  KEEP:         60,      // a bonus for the try already being driven, so he does not dither between near equals
  TRIES_PER_STEP: 1,     // tries made each physics step while a look is in progress
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
  BRAKE_GAIN:   0.25,    // brake per m/s over the speed wanted (HANDS 0 only)
  /* a player's hands (briefs/DRIFT-RACE.md): the throttle always on, no
     brake pedal, and DRIFT with no steering is the only brake. 1 plans
     with exactly those; 0 is the rivals round's driver, which lifted and
     braked (kept for the known answer of game/test/driftrace/hands.js) */
  HANDS:        1,
  HB_OVER:      1.5,     // m/s over the speed wanted on grip before DRIFT with no steering is pressed, to slow
  HB_STEER:     0.2,     // and only while the line asks for less steering than this (the brake needs the wheel straight)
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
  /* following another car's line (the chase driver, rivals/chase.js; 0
     and no follow function for a rival): a cost per metre off it, per
     second, at the same metres ahead */
  FOLLOW:       0,
  /* a character's own line (0: none): a reward per metre the car is to the outside (positive) of a corner */
  WIDE:         0,
};

const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const DEG = 180 / Math.PI;

/* pick (optional, the scripted players of the measurements): pick(corner)
   says whether a slide may be tried in that corner; none is every corner */
export function createRivalDriver(ground, character, override, follow, pick) {
  const D = Object.assign({}, RIVAL_DRIVE, character || {}, override || {});
  const C = ground.centre, n = C.length, closed = ground.kind === 'circuit', L = ground.length;
  const at = i => closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
  const kap = new Float64Array(n);
  /* each sample's left and forward vectors, worked once (the same values the look ahead would work every step) */
  const LX = new Float64Array(n), LZ = new Float64Array(n), FX = new Float64Array(n), FZ = new Float64Array(n);
  for (let i = 0; i < n; i++) { LX[i] = -Math.cos(C[i].heading); LZ[i] = Math.sin(C[i].heading); FX[i] = -Math.sin(C[i].heading); FZ[i] = -Math.cos(C[i].heading); }
  for (let i = 0; i < n; i++) kap[i] = Math.abs(wrap(C[at(i + 1)].heading - C[at(i - 1)].heading)) / 4;
  const corners = (ground.corners || []).map(c => ({ from: c.from, to: c.to, sign: c.dir === 'left' ? 1 : -1, name: c.name, src: c })).sort((a, b) => a.from - b.from);
  const DT = STEP * D.SUB, H = Math.round(D.HORIZON / DT), HB = Math.round(D.HB_TIME / DT), HBS = Math.round(D.HB_TIME / STEP);

  /* the corner the car is in, or the next one, and how far to it, from s */
  function cornerAtSlow(s) {
    let best = null, ahead = Infinity;
    for (const c of corners) {
      if (s >= c.from && s <= c.to) return { c, ahead: 0 };
      const a = closed ? ((c.from - s) % L + L) % L : c.from - s;
      if (a > 0 && a < ahead) { ahead = a; best = c; }
    }
    return { c: best, ahead };
  }
  /* the same, read from a table worked once per sample (2 m apart): the
     look ahead asks it every step it rolls out */
  const tabC = new Array(n), tabA = new Float64Array(n), tabFrom = new Float64Array(n);
  for (let i = 0; i < n; i++) { const r = cornerAtSlow(i * 2); tabC[i] = r.c; tabA[i] = r.ahead; tabFrom[i] = i * 2; }
  const hit = { c: null, ahead: 0 };
  function cornerAt(s) {
    const i = closed ? ((Math.round(s / 2) % n) + n) % n : Math.max(0, Math.min(n - 1, Math.round(s / 2)));
    hit.c = tabC[i]; hit.ahead = tabA[i] > 0 ? Math.max(0.001, tabA[i] - (s - tabFrom[i])) : 0;
    return hit;
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
    if (D.HANDS) {
      /* the throttle stays on; to slow, DRIFT with the wheel straight, as a player brakes */
      out.throttle = 1; out.brake = 0; out.handbrake = 0;
      if (v > vWant + D.HB_OVER && Math.abs(out.steer) < D.HB_STEER) { out.steer = 0; out.handbrake = 1; }
      return out;
    }
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
      if (kind < 0) { const c = C[ci]; grip(sim, ci, ci * 2 + (sim.x - c.x) * FX[ci] + (sim.z - c.z) * FZ[ci], inp); }
      else if (flick > 0) { flick--; inp.steer = dir; inp.throttle = 1; inp.brake = 0; inp.handbrake = 1; }
      else { inp.steer = into * dir; inp.throttle = 1; inp.brake = 0; inp.handbrake = 0; }
      stepVehicle(sim, inp, DT);
      ci = nearest(sim.x, sim.z, ci);
      /* the body's reach across the road: its corners at the angle it makes with the road */
      const rel = wrap(sim.yaw - C[ci].heading);
      const reach = hl * Math.abs(Math.sin(rel)) + hw0 * Math.abs(Math.cos(rel));
      const cc = C[ci];
      const l2 = (sim.x - cc.x) * LX[ci] + (sim.z - cc.z) * LZ[ci];
      const margin = cc.width / 2 - Math.abs(l2) - reach;
      if (margin < 0) { value -= D.CRASH * (1 - k / H); break; }
      if (margin < D.EDGE_SAFE) value -= D.EDGE_COST * (D.EDGE_SAFE - margin) * DT;
      /* travel down the road, not round: the slide only pays for the share of the travel that is along it */
      const along = Math.cos(wrap(Math.atan2(-sim.wvx, -sim.wvz) - cc.heading));
      if (along < D.ALONG_MIN) value -= D.ASTRAY * (D.ALONG_MIN - along) * DT;
      const angle = Math.abs(sim.slip) * DEG;
      if (angle >= 12 && sim.speed >= 6 && sim.vx > 0 && along > 0) value += D.SLIDE_GAIN * Math.min(angle, D.ANGLE_CAP) * sim.speed * 3.6 * DT * along;
      if (D.WIDE && dir) value += D.WIDE * (-l2 * -dir) * DT;
      if (follow && D.FOLLOW) { let ds = ci * 2 - s0; if (closed) { if (ds < -L / 2) ds += L; else if (ds > L / 2) ds -= L; } const tl = follow(ds); if (tl !== null) value -= D.FOLLOW * Math.abs(l2 - tl) * DT; }   // outside of the slide's corner
      if (scores(sim)) gapT = 0; else gapT += DT;
      if (chain && gapT >= SC.BANK_GAP - D.CHAIN_MARGIN) { chain = false; if (linkAhead(ci * 2)) value -= D.CHAIN_KEEP; }
    }
    const cEnd = C[ci];
    const sEnd = ci * 2 + (sim.x - cEnd.x) * FX[ci] + (sim.z - cEnd.z) * FZ[ci];
    let ds = sEnd - s0; if (closed) { if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L; }
    value += D.PROGRESS * ds;
    if (sim.speed < D.SLOW) value -= D.SLOW_COST * (D.SLOW - sim.speed);
    return value;
  }

  let choice = -1, dirNow = 0, flickLeft = 0, untilReplan = 0, sinceSlide = 1e9;
  /* a look in progress: the car as it was when the look began, the tries
     still to make, and the best so far. Its tries are spread over the
     steps until the next look (TRIES_PER_STEP at most each step), so no
     single frame pays for them all; the choice is driven once they are
     all made. */
  const snap = {};
  const look = { on: false, ci: 0, s: 0, dir: 0, next: 0, best: -1, bestV: 0, hl: 2.2, hw0: 0.92, was: -1, wasDir: 0 };
  const out = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
  const last = { tries: 0, value: 0 };
  function reset() { choice = -1; dirNow = 0; flickLeft = 0; untilReplan = 0; sinceSlide = 1e9; look.on = false; }
  function tryNext() {
    const k = look.next++;
    /* try -1 is the grip, 0.. the depths of slide */
    const v = rollout(snap, look.ci, look.s, k - 1, k === 0 ? 0 : look.dir, look.hl, look.hw0) + (look.was === k - 1 && (k === 0 || look.wasDir === look.dir) ? D.KEEP : 0);
    last.tries++;
    if (k === 0 || v > look.bestV) { look.bestV = v; look.best = k - 1; }
  }
  function commit(car) {
    look.on = false;
    const best = look.best, dir = look.dir;
    if (best >= 0 && !(choice >= 0 && dirNow === dir) && !car.drifting) flickLeft = HBS;
    if (best < 0) flickLeft = 0;
    choice = best; dirNow = best >= 0 ? dir : 0;
    last.value = look.bestV;
  }
  function input(world) {
    const car = world.car, s = world.along, ci = world.centreIndex;
    const V = car.tune ? car.tune.VEHICLE : null;
    sinceSlide = scores(car) ? 0 : sinceSlide + STEP;
    if (look.on) { for (let k = 0; k < D.TRIES_PER_STEP && look.next <= D.INTO.length; k++) tryNext(); if (look.next > D.INTO.length) commit(car); }
    if (--untilReplan <= 0 && !look.on) {
      untilReplan = D.REPLAN;
      const { c, ahead } = cornerAt(s);
      /* may a slide be tried here: in a corner's window, or held across a short gap to the next */
      let dir = 0;
      if (c) {
        const inWindow = ahead > 0 ? ahead <= D.WINDOW_PRE : s <= c.to - D.WINDOW_POST || car.drifting;
        if (inWindow || ((car.drifting || sinceSlide < SC.BANK_GAP) && ahead <= D.LINK)) dir = -c.sign;
        if (pick && !pick(c)) dir = 0;
      }
      last.tries = 0;
      if (dir && car.speed > 8) {
        Object.assign(snap, car);
        look.on = true; look.ci = ci; look.s = s; look.dir = dir; look.next = 0; look.best = -1; look.bestV = 0; look.was = choice; look.wasDir = dirNow;
        look.hl = V ? V.HALF_LENGTH : 2.2; look.hw0 = V ? V.HALF_WIDTH : 0.92;
        for (let k = 0; k < D.TRIES_PER_STEP; k++) tryNext();
      } else { choice = -1; dirNow = 0; flickLeft = 0; }
    }
    if (choice < 0) return grip(car, ci, s, out);
    if (flickLeft > 0) { flickLeft--; out.steer = dirNow; out.throttle = 1; out.brake = 0; out.handbrake = 1; return out; }
    out.steer = D.INTO[choice] * dirNow; out.throttle = 1; out.brake = 0; out.handbrake = 0;
    return out;
  }
  return { input, reset, params: D, corners, get mode() { return choice < 0 ? 'grip' : 'drift' + choice; }, last };
}
