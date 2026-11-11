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
   Unlike the rival they see the other car, as a player does: given
   avoid (a function returning his car, or null), they keep clear of it
   (RIVAL_DRIVE.AVOID_*). None blocks or follows him. */
import { createRivalDriver } from './driver.js';

export const PLAYERS = {
  MIX_RADIUS: 42,          // m: the mixed player slides corners this tight or tighter (game/test/stars/slot.js calls these drift corners)
  /* each player's numbers, chosen by game/test/driftrace/players-search.js on career 1 in the starter: no wall contact in its worst run; the grip player's search also charged for any drift points (GRIP_DRIFT_COST 8), so it truly takes the line on grip; the mixed player's weighed its drift points 1.5 against its time (DRIFT_WEIGHT) */
  grip:  { drive: { EDGE_SAFE: 1.6, ENTRY: 17.39, VMAX: 31.9, AY_MAX: 8.26, OUTSIDE: 0.397, SETUP: 64.3, HB_OVER: 5.82, HB_STEER: 0.38 } },
  slide: { drive: { SLIDE_GAIN: 0.306, PROGRESS: 62, KEEP: 607, ANGLE_CAP: 44.25, EDGE_SAFE: 2.43, EDGE_COST: 2254, ENTRY: 23.3, VMAX: 22, CHAIN_KEEP: 0, CHAIN_MARGIN: 0.58, AY_MAX: 5.75, OUTSIDE: 0.284, SETUP: 54.92, WINDOW_PRE: 17.12, WINDOW_POST: -6.22, LINK: 33.17, HB_TIME: 0.443, HB_OVER: 2.46, HB_STEER: 0.47 } },
  mixed: { drive: { SLIDE_GAIN: 0.416, PROGRESS: 92, KEEP: 585, ANGLE_CAP: 35.38, EDGE_SAFE: 1.74, EDGE_COST: 2525, ENTRY: 29, VMAX: 26.08, CHAIN_KEEP: 264, CHAIN_MARGIN: 0.21, AY_MAX: 5.32, OUTSIDE: 0.626, SETUP: 34.27, WINDOW_PRE: 6.38, WINDOW_POST: 20, LINK: 46.97, HB_TIME: 0.162, HB_OVER: 1.51, HB_STEER: 0.05 } },
};

const PICK = {
  grip: () => false,
  slide: null,
  mixed: c => !!(c.src && c.src.radius <= PLAYERS.MIX_RADIUS),
};

/* kind: 'grip', 'slide' or 'mixed'; override: driving numbers on top of
   its own (the measurements' disturbances) */
export function createPlayer(track, kind, override, avoid) {
  const P = PLAYERS[kind];
  if (!P) throw new Error('no scripted player ' + kind);
  const drv = createRivalDriver(track, P.drive, Object.assign({ HANDS: 1 }, override || {}), null, PICK[kind], avoid || null);
  return { kind, input: world => drv.input(world), reset: () => drv.reset(), driver: drv };
}
