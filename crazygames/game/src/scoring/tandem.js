/* THE TANDEM (briefs/RIVALS.md 2). In a battle, while the player's
   slide is scoring and the rival is sliding too, the player's drift
   points count more the closer he is behind or beside the rival: 1 +
   TANDEM.BONUS at NEAR or closer, falling to nothing at FAR. Ahead of
   the rival (his centre more than AHEAD in front of the rival's along
   the rival's travel) earns nothing, and so does a car on another
   layer (a bridge) or a lap away. A hard contact with the rival turns
   the bonus off for COOL seconds. Everything else about the score is
   as it is: this hands scoring/drift.js a multiplier, which it applies
   only to a step's drift points while the slide scores.

   Stepped at the physics rate after both worlds, so a replay scores the
   same. Also keeps what the HUD, the callouts and the measurements read:
   the gap, the closeness, the zone, and the time the rival spent
   sliding and how much of it the player spent in the zone. */
import { TANDEM } from '../tune.js';
import { STEP } from '../physics/world.js';

export function createTandem() {
  const t = {
    mult: 1, counted: false, k: 0, gap: Infinity, side: 0, ahead: false, together: false, zone: 'off', cool: 0,
    rivalSliding: false, rivalSlideT: 0, zoneT: 0, closeT: 0, bothT: 0, hold: 0, farT: 0, farSaid: false, doorSaid: false, tandemSaid: false,
    callouts: [], calloutCount: 0,
  };
  function callout(text, kind) { t.callouts.push({ text, kind }); t.calloutCount++; if (t.callouts.length > 6) t.callouts.shift(); }
  function reset() {
    t.mult = 1; t.counted = false; t.k = 0; t.gap = Infinity; t.side = 0; t.ahead = false; t.together = false; t.zone = 'off'; t.cool = 0;
    t.rivalSliding = false; t.rivalSlideT = 0; t.zoneT = 0; t.closeT = 0; t.bothT = 0; t.hold = 0; t.farT = 0; t.farSaid = false; t.doorSaid = false; t.tandemSaid = false;
    t.callouts.length = 0; t.calloutCount = 0;
  }
  /* world: the player's, after its step; rival: rivals/rival.js;
     playerDist: the player's metres into the run; sliding: whether the
     player's slide is scoring this step (as scoring/drift.js judges it). */
  function step(world, rival, playerDist, sliding) {
    t.counted = false;
    if (world.hit && world.hit.kind === 'rival' && world.hit.hard) t.cool = TANDEM.COOL;
    else if (t.cool > 0) t.cool = Math.max(0, t.cool - STEP);
    if (!rival || !rival.solid()) { t.mult = 1; t.k = 0; t.zone = 'off'; t.together = false; t.rivalSliding = false; return t; }
    const c = world.car, r = rival.world.car;
    const dx = c.x - r.x, dz = c.z - r.z;
    t.gap = Math.hypot(dx, dz);
    /* along his travel, and to his left */
    const sp = Math.hypot(r.wvx, r.wvz);
    const ux = sp > 1 ? r.wvx / sp : -Math.sin(r.yaw), uz = sp > 1 ? r.wvz / sp : -Math.cos(r.yaw);
    const fwd = dx * ux + dz * uz;
    t.side = dx * -uz + dz * ux;   // > 0: the player is to the left of his travel... as seen along it
    t.ahead = fwd > TANDEM.AHEAD;
    t.together = Math.abs((c.y || 0) - (r.y || 0)) < TANDEM.LAYER && Math.abs(rival.runDistance() - playerDist) < TANDEM.RUN_GAP;
    t.k = t.together ? Math.max(0, Math.min(1, (TANDEM.FAR - t.gap) / (TANDEM.FAR - TANDEM.NEAR))) : 0;
    t.rivalSliding = rival.state.sliding;
    const inZone = t.together && !t.ahead && t.k > 0;
    t.zone = !t.together ? 'off' : t.ahead ? 'ahead' : t.k >= 1 ? 'close' : t.k > 0 ? 'near' : 'far';
    t.mult = t.rivalSliding && inZone && t.cool <= 0 ? 1 + TANDEM.BONUS * t.k : 1;
    /* the measurements: his sliding time, and the share of it the player spent in the zone */
    if (t.rivalSliding) { t.rivalSlideT += STEP; if (inZone) t.zoneT += STEP; if (inZone && t.k >= 1) t.closeT += STEP; if (sliding && inZone) t.bothT += STEP; }
    /* the callouts: a held tandem, door to door, and too far while he slides */
    const both = t.rivalSliding && sliding && inZone && t.cool <= 0;
    t.hold = both ? t.hold + STEP : 0;
    if (t.hold >= TANDEM.CALL_HOLD && !t.tandemSaid) { t.tandemSaid = true; callout('TANDEM', 'tandem'); }
    if (!t.rivalSliding) { t.tandemSaid = false; t.doorSaid = false; t.farSaid = false; t.farT = 0; }
    if (both && !t.doorSaid) {
      /* the gap between the sides: centre distance across his travel less the two half widths */
      const across = Math.abs(t.side) - rival.box.halfWidth - (world.tune ? world.tune.VEHICLE.HALF_WIDTH : 0.92), along = Math.abs(fwd);
      if (along < 2.5 && across < TANDEM.CALL_CLOSE) { t.doorSaid = true; callout('DOOR TO DOOR', 'tandem'); }
    }
    if (t.rivalSliding && !inZone && !t.ahead) { t.farT += STEP; if (t.farT >= TANDEM.CALL_FAR_AFTER && !t.farSaid) { t.farSaid = true; callout('TOO FAR', 'far'); } }
    else t.farT = 0;
    return t;
  }
  return { state: t, step, reset };
}
