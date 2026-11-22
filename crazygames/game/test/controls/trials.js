/* THE SLIDE TRIALS (briefs/PRO-CONTROLS.md, measures 3 and 4), written
   once so the probes can run them in the game's page (their source is
   handed to page.evaluate) and the tuning scripts in Node. Pure
   functions: step(inp) advances the physics one step and car is the
   vehicle state it moves. Angles are the signed angle between the nose
   and the travel, atan2(vy, vx) in degrees, positive for the right hand
   slide the trial starts: the physics' own slip angle folds back past 90
   degrees (it divides by the speed along the nose's line whichever way
   that points), so a spin is read here, not there.

   slideTrial: from the speed the car is given, the handbrake with
   steering right for HB s, then steering held right with throttle T
   until the slide reaches OPEN degrees (at most OPEN_MAX s), then steer
   C (negative is countersteer) with throttle T for HOLD s, then the
   throttle off with the same steering for LIFT s. */
export const TRIAL = { HB: 0.35, OPEN: 20, OPEN_MAX: 1, HOLD: 3, LIFT: 1, SPIN: 90, CLOSED: 10, STEP: 1 / 120 };

export function slideTrial(step, car, T, C, o) {
  const P = Object.assign({}, TRIAL, o || {});
  const deg = 180 / Math.PI, slipOf = () => Math.atan2(car.vy, car.vx) * deg;
  let phase = 'entry', t = 0, tPh = 0, opened = null, spunAt = null, closedAt = null, maxHold = -Infinity, minHold = Infinity;
  const held = [];
  let x0 = car.x, z0 = car.z, x1 = car.x, z1 = car.z;
  const inp = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
  const total = P.HB + P.OPEN_MAX + P.HOLD + P.LIFT;
  for (let i = 0; t < total - 1e-9 && i < 100000; i++) {
    const slip = slipOf();
    if (phase === 'entry' && t >= P.HB - 1e-9) { phase = 'open'; tPh = t; }
    if (phase === 'open' && (slip >= P.OPEN || t - tPh >= P.OPEN_MAX - 1e-9)) { phase = 'hold'; tPh = t; opened = slip; }
    if (phase === 'hold' && t - tPh >= P.HOLD - 1e-9) { phase = 'lift'; tPh = t; }
    if (phase === 'entry') { inp.steer = 1; inp.throttle = 1; inp.handbrake = 1; }
    else if (phase === 'open') { inp.steer = 1; inp.throttle = T; inp.handbrake = 0; }
    else if (phase === 'hold') { inp.steer = C; inp.throttle = T; inp.handbrake = 0; }
    else { inp.steer = C; inp.throttle = 0; inp.handbrake = 0; }
    step(inp);
    t += P.STEP;
    const s = slipOf();
    if (car.x < x0) x0 = car.x; if (car.x > x1) x1 = car.x; if (car.z < z0) z0 = car.z; if (car.z > z1) z1 = car.z;
    if (spunAt === null && Math.abs(s) > P.SPIN && car.speed > 2) spunAt = { t, phase, sincePhase: t - tPh };
    if (phase === 'hold' && t - tPh > P.HOLD - 1) { held.push(s); if (s > maxHold) maxHold = s; if (s < minHold) minHold = s; }
    if (phase === 'lift' && closedAt === null && Math.abs(s) < P.CLOSED) closedAt = t - tPh;
  }
  const mean = held.length ? held.reduce((a, b) => a + b, 0) / held.length : NaN;
  return { T, C, opened, held: mean, band: [minHold, maxHold], spun: spunAt, closed: closedAt, speed: car.speed, box: [x0, z0, x1, z1] };
}

/* spinTrial: the same entry, then throttle T with steering C (0: none,
   1: held into the slide) for up to SPIN_FOR s; when, after the entry,
   the angle first passes SPIN degrees, or null. */
export function spinTrial(step, car, T, C, o) {
  const P = Object.assign({}, TRIAL, o || {});
  const r = slideTrial(step, car, T, C, Object.assign({}, P, { HOLD: P.SPIN_FOR || 3, LIFT: 0.01 }));
  const after = r.spun && (r.spun.phase === 'hold' || r.spun.phase === 'lift') ? r.spun.sincePhase : r.spun ? 0 : null;
  return { T, C, spunAfter: after, phase: r.spun ? r.spun.phase : null, opened: r.opened, box: r.box };
}
