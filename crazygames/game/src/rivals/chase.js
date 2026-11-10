/* THE SCRIPTED CHASE DRIVER, for the measurements (briefs/RIVALS.md
   measure 3): it plays the player in a battle by following the rival.
   It is the rival's own driver (rivals/driver.js, with his character)
   driving the player's car, so it takes his line and slides where he
   slides, because those choices come from where the car is on the
   track; and unlike his driver it watches him, as a player does, and
   holds GAP behind him: quicker on grip when it is further back, a lift
   when it is too close. Before he is away and after his finish it
   drives as he would alone. ?auto=1 in a battle drives it. */
import { createRivalDriver } from './driver.js';

export const CHASE = {
  GAP:        5.0,    // m behind him (along the run) it aims for
  PACE:       0.6,    // m/s more speed wanted on grip per metre too far back
  PACE_MAX:   8,      // m/s, at most
  LIFT:       0.12,   // throttle taken off per metre too close
  BRAKE:      0.08,   // and brake on grip
};

export function createChaseDriver(track, rival, opts) {
  const K = Object.assign({}, CHASE, opts || {});
  const drv = createRivalDriver(track, rival.def.drive, K.drive);
  const base = { VMAX: drv.params.VMAX, ENTRY: drv.params.ENTRY };
  let myDist = track.start.along || 0, myAlong = null;
  const L = track.length, circuit = track.kind === 'circuit';
  const state = { gapErr: 0 };
  function input(world) {
    if (myAlong === null) myAlong = world.along;
    let dd = world.along - myAlong; if (circuit) { if (dd < -L / 2) dd += L; else if (dd > L / 2) dd -= L; }
    myDist += dd; myAlong = world.along;
    const gapErr = rival.solid() ? rival.runDistance() - myDist - K.GAP : 0;
    state.gapErr = gapErr;
    const dv = Math.max(-K.PACE_MAX, Math.min(K.PACE_MAX, gapErr * K.PACE));
    drv.params.VMAX = base.VMAX + dv; drv.params.ENTRY = base.ENTRY + dv * 0.5;
    const out = drv.input(world);
    if (gapErr < -1) {
      out.throttle = Math.max(0, out.throttle - (-gapErr - 1) * K.LIFT);
      if (!world.car.drifting) out.brake = Math.min(1, out.brake + (-gapErr - 1) * K.BRAKE);
    }
    return out;
  }
  return { input, state, driver: drv };
}
