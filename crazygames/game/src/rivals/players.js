/* THE SCRIPTED PLAYERS (briefs/DRIFT-RACE.md measure 3), and ?auto=1 in
   a race. Each drives the player's car with only the player's hands:
   the throttle always on, no brake, DRIFT with or without steering. Each
   is the look-ahead driver (rivals/driver.js, which plans with exactly
   those controls) with its own numbers and its own choice of which
   corners to slide:
   - grip: drives the line on grip and never slides; to slow it presses
     DRIFT with the wheel straight, as a player brakes;
   - slide: slides every corner;
   - mixed: slides the drift corners (MIX_RADIUS or tighter) and takes
     the rest on grip.
   They read only their own world, as the rival does: none of them
   watches him, so none blocks, follows or avoids him. */
import { createRivalDriver } from './driver.js';

export const PLAYERS = {
  MIX_RADIUS: 42,          // m: the mixed player slides corners this tight or tighter (game/test/stars/slot.js calls these drift corners)
  /* each player's numbers, chosen by game/test/driftrace/players-search.js on career 1 in the starter: no wall contact in its worst run */
  grip:  { drive: { EDGE_SAFE: 1.56, ENTRY: 24.75, VMAX: 34, AY_MAX: 5.76, OUTSIDE: 0.506, SETUP: 49.57, HB_OVER: 3.92, HB_STEER: 0.26 } },
  slide: { drive: { SLIDE_GAIN: 0.306, PROGRESS: 62, KEEP: 607, ANGLE_CAP: 44.25, EDGE_SAFE: 2.43, EDGE_COST: 2254, ENTRY: 23.3, VMAX: 22, CHAIN_KEEP: 0, CHAIN_MARGIN: 0.58, AY_MAX: 5.75, OUTSIDE: 0.284, SETUP: 54.92, WINDOW_PRE: 17.12, WINDOW_POST: -6.22, LINK: 33.17, HB_TIME: 0.443, HB_OVER: 2.46, HB_STEER: 0.47 } },
  mixed: { drive: {} },
};

const PICK = {
  grip: () => false,
  slide: null,
  mixed: c => !!(c.src && c.src.radius <= PLAYERS.MIX_RADIUS),
};

/* kind: 'grip', 'slide' or 'mixed'; override: driving numbers on top of
   its own (the measurements' disturbances) */
export function createPlayer(track, kind, override) {
  const P = PLAYERS[kind];
  if (!P) throw new Error('no scripted player ' + kind);
  const drv = createRivalDriver(track, P.drive, Object.assign({ HANDS: 1 }, override || {}), null, PICK[kind]);
  return { kind, input: world => drv.input(world), reset: () => drv.reset(), driver: drv };
}
