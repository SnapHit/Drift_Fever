/* DRIFT SCORING. Points come from the drift angle times the speed for
   every step the slide is held above MIN_ANGLE at more than MIN_SPEED.
   They go into the chain, whose multiplier climbs one step every
   CHAIN_STEP seconds of drifting up to CHAIN_MAX. Straighten up for
   BANK_GAP seconds and the chain is banked into the total at its
   multiplier; a hard hit loses it. Near a marked wall (a clipping zone)
   or a cone, the points count PROX_BONUS times over. Callouts are
   queued for the HUD. Stepped at the physics rate so a replay scores
   the same; every constant is in TUNE.SCORING. */
import { TUNE } from '../tune.js';

const DEG = 180 / Math.PI;

export function createScoring() {
  const s = {
    total: 0,          // banked
    chain: 0,          // points in the open chain, before the multiplier
    mult: 1,
    driftTime: 0,      // seconds of this chain spent drifting
    gap: 0,            // seconds since the slide last scored
    drifting: false,
    near: false,       // close to a marked wall or a cone right now
    best: 0,           // the best banked chain this run
    angle: 0, lastBank: 0, lastBankMult: 1, lost: 0,
    callouts: [],      // the last few { text, kind }; calloutCount counts them all
    calloutCount: 0,
    bigAngleSaid: false, longChainSaid: false, nearSaid: false,
    drift: 0,          // of the total, from drifting
    clean: 0,          // from clean sectors
    pace: 0,           // from the pace at the finish
    tandem: 0,         // of the total, what the tandem bonus added (briefs/RIVALS.md; 0 with no rival)
    tandemChain: 0,    // the bonus's share of the open chain, before the multiplier
  };
  function callout(text, kind) { s.callouts.push({ text, kind }); s.calloutCount++; if (s.callouts.length > 6) s.callouts.shift(); }
  function reset() {
    s.total = 0; s.chain = 0; s.mult = 1; s.driftTime = 0; s.gap = 0; s.drifting = false; s.near = false; s.best = 0; s.angle = 0; s.lastBank = 0; s.lost = 0;
    s.callouts.length = 0; s.calloutCount = 0; s.bigAngleSaid = false; s.longChainSaid = false; s.nearSaid = false;
    s.drift = 0; s.clean = 0; s.pace = 0; s.tandem = 0; s.tandemChain = 0;
  }
  /* points for driving, not drifting: kind is 'clean' or 'pace' */
  function award(v, kind, text) {
    v = Math.round(v);
    if (v <= 0) return;
    s.total += v; s[kind] += v;
    callout(text + ' +' + v, 'bank');
  }
  function bank() {
    if (s.chain > 0) {
      const v = Math.round(s.chain * s.mult);
      s.total += v; s.drift += v; s.lastBank = v; s.lastBankMult = s.mult;
      if (v > s.best) s.best = v;
      if (s.tandemChain > 0) { s.tandem += Math.min(v, Math.round(s.tandemChain * s.mult)); s.tandemChain = 0; }
      callout('+' + v + (s.mult > 1 ? '  x' + s.mult : ''), 'bank');
    }
    s.chain = 0; s.mult = 1; s.driftTime = 0; s.bigAngleSaid = false; s.longChainSaid = false; s.nearSaid = false;
  }
  function lose() {
    if (s.chain > 0) { s.lost = Math.round(s.chain * s.mult); callout('CHAIN LOST', 'lost'); }
    s.chain = 0; s.tandemChain = 0; s.mult = 1; s.driftTime = 0; s.drifting = false; s.gap = 0; s.bigAngleSaid = false; s.longChainSaid = false; s.nearSaid = false;
  }
  /* world: the physics world after its step; dt the step; tandem, only
     in a battle: { mult }, the tandem's multiplier on this step's drift
     points (scoring/tandem.js). Without it the arithmetic is exactly as
     it always was. */
  function step(world, dt, tandem) {
    const S = TUNE.SCORING;
    const car = world.car;
    const angle = Math.abs(car.slip) * DEG;
    s.angle = angle;
    if (world.hit && world.hit.hard) { lose(); return; }
    if (world.respawned) { lose(); return; }
    const kmh = car.speed * 3.6;
    const scoring = angle >= S.MIN_ANGLE && car.speed >= S.MIN_SPEED && car.vx > 0;
    s.near = scoring && world.nearest <= S.PROX_DIST;
    if (scoring) {
      s.drifting = true; s.gap = 0;
      s.driftTime += dt;
      s.mult = Math.min(S.CHAIN_MAX, 1 + Math.floor(s.driftTime / S.CHAIN_STEP));
      const pts = angle * kmh * S.RATE * dt * (s.near ? S.PROX_BONUS : 1);
      if (tandem && tandem.mult > 1) { s.chain += pts * tandem.mult; s.tandemChain += pts * (tandem.mult - 1); tandem.counted = true; }
      else s.chain += pts;
      if (angle >= S.BIG_ANGLE && !s.bigAngleSaid) { s.bigAngleSaid = true; callout('BIG ANGLE', 'good'); }
      if (s.driftTime >= S.LONG_CHAIN && !s.longChainSaid) { s.longChainSaid = true; callout('LONG CHAIN', 'good'); }
      if (s.near && !s.nearSaid) { s.nearSaid = true; callout(world.nearestClip ? 'ORANGE WALL x' + S.PROX_BONUS : 'NEAR MISS', 'good'); }
      if (!s.near) s.nearSaid = false;
    } else if (s.drifting) {
      s.gap += dt;
      if (s.gap >= S.BANK_GAP) { s.drifting = false; bank(); }
    }
  }
  return { state: s, step, reset, bank, lose, award };
}
