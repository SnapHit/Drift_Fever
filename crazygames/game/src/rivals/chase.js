/* THE SCRIPTED CHASE DRIVER, for the measurements (briefs/RIVALS.md
   measure 3): it plays the player in a battle by following the rival.
   It is the rival's own driver (rivals/driver.js, with his character)
   driving the player's car, so it takes his line and slides where he
   slides, because those choices come from where the car is on the
   track; and unlike his driver it watches him, as a player does, and
   holds GAP behind him: quicker on grip when it is further back, a lift
   when it is too close; and its look ahead is pulled onto the line he
   actually drove (FOLLOW in rivals/driver.js), at the same metres into
   the run, so a chaser that started beside him does not keep a line of
   its own. Before he is away and after his finish it
   drives as he would alone. ?auto=1 in a battle drives it. */
import { createRivalDriver } from './driver.js';

export const CHASE = {
  GAP:        6.5,    // m behind him (along the run) it aims for
  PACE:       0.6,    // m/s more speed wanted on grip per metre too far back
  PACE_MAX:   8,      // m/s, at most
  MATCH:      0,      // on grip, m/s over his speed at the same place per metre too far back (0: off; the planner's own pace does it)
  MATCH_MAX:  9,      // m/s, at most
  DRIVE:      { EDGE_SAFE: 1.6, EDGE_COST: 1500, FOLLOW: 1500 },   // the rival's driving with a wider margin from the edge: a chaser is never quite on his line
  LIFT:       0.12,   // throttle taken off per metre too close
  BRAKE:      0.12,   // and brake on grip
};

export function createChaseDriver(track, rival, opts) {
  const K = Object.assign({}, CHASE, opts || {});
  /* his line, by metres into the run: where he was across the road */
  const line = [];
  let lineStep = -1;
  function lineAt(delta) {
    const d = myDist + delta;
    if (!line.length || d < line[0].d || d > line[line.length - 1].d) return null;
    let lo = 0, hi = line.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (line[m].d <= d) lo = m; else hi = m; }
    return line[lo].lat;
  }
  const drv = createRivalDriver(track, rival.def.drive, Object.assign({}, K.DRIVE, K.drive || {}), lineAt);
  const base = { VMAX: drv.params.VMAX, ENTRY: drv.params.ENTRY };
  let myDist = track.start.along || 0, myAlong = null;
  const L = track.length, circuit = track.kind === 'circuit';
  const state = { gapErr: 0 };
  /* his speed by metres into the run, as he went */
  const trail = []; let lastStep = -1, ti = 0;
  function speedAt(d) {
    if (!trail.length || d < trail[0].d + 1) return null;   // not yet on his trail: he started ahead
    while (ti + 1 < trail.length && trail[ti + 1].d <= d) ti++;
    const c = trail[ti];
    return c && Math.abs(c.d - d) < 4 ? c.v : null;
  }
  function input(world) {
    if (rival.state.steps !== lastStep && !rival.state.finished) { lastStep = rival.state.steps; trail.push({ d: rival.runDistance(), v: rival.world.car.speed }); if (!line.length || rival.runDistance() > line[line.length - 1].d + 0.5) line.push({ d: rival.runDistance(), lat: rival.world.lateral }); }
    if (myAlong === null) myAlong = world.along;
    let dd = world.along - myAlong; if (circuit) { if (dd < -L / 2) dd += L; else if (dd > L / 2) dd -= L; }
    myDist += dd; myAlong = world.along;
    const gapErr = rival.solid() ? rival.runDistance() - myDist - K.GAP : 0;
    state.gapErr = gapErr;
    const dv = Math.max(-K.PACE_MAX, Math.min(K.PACE_MAX, gapErr * K.PACE));
    drv.params.VMAX = base.VMAX + dv; drv.params.ENTRY = base.ENTRY + dv * 0.5;
    const out = drv.input(world);
    /* on grip, his speed where he was, and more to close the gap */
    const vHis = !world.car.drifting && !out.handbrake ? speedAt(myDist) : null;
    if (K.MATCH > 0 && vHis !== null && gapErr > -1) {
      const want = vHis + Math.min(K.MATCH_MAX, Math.max(0, gapErr) * K.MATCH), v = world.car.speed;
      out.throttle = v < want ? 1 : 0; out.brake = v > want + 2 ? Math.min(1, (v - want - 2) * 0.3) : 0;
    }
    if (gapErr < -1) {
      out.throttle = Math.max(0, out.throttle - (-gapErr - 1) * K.LIFT);
      if (!world.car.drifting) out.brake = Math.min(1, out.brake + (-gapErr - 1) * K.BRAKE);
    }
    return out;
  }
  return { input, state, driver: drv };
}
