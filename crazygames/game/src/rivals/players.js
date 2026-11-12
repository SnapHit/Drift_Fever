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
   (RIVAL_DRIVE.AVOID_*). None blocks or follows him.

   Each player's own numbers (PLAYERS[kind].drive) were chosen on career
   1 in the starter and are a poor measure on harder tracks (the slide
   player 14 to 17 s slower over three laps on every Pro circuit:
   review/ladder/REPORT.md). PLAYERS.AT holds numbers searched for one
   track and car (briefs/RIVALS-LADDER-2.md priority 1,
   game/test/ladder2/players.js), used when createPlayer is told where it
   drives; without that, or with no entry, the own numbers, so every run
   recorded with them is unchanged. */
import { createRivalDriver } from './driver.js';

export const PLAYERS = {
  MIX_RADIUS: 42,          // m: the mixed player slides corners this tight or tighter (game/test/stars/slot.js calls these drift corners)
  /* each player's numbers, chosen by game/test/driftrace/players-search.js on career 1 in the starter: no wall contact in its worst run; the grip player's search also charged for any drift points (GRIP_DRIFT_COST 8), so it truly takes the line on grip; the mixed player's weighed its drift points 1.5 against its time (DRIFT_WEIGHT) */
  grip:  { drive: { EDGE_SAFE: 1.6, ENTRY: 17.39, VMAX: 31.9, AY_MAX: 8.26, OUTSIDE: 0.397, SETUP: 64.3, HB_OVER: 5.82, HB_STEER: 0.38 } },
  slide: { drive: { SLIDE_GAIN: 0.306, PROGRESS: 62, KEEP: 607, ANGLE_CAP: 44.25, EDGE_SAFE: 2.43, EDGE_COST: 2254, ENTRY: 23.3, VMAX: 22, CHAIN_KEEP: 0, CHAIN_MARGIN: 0.58, AY_MAX: 5.75, OUTSIDE: 0.284, SETUP: 54.92, WINDOW_PRE: 17.12, WINDOW_POST: -6.22, LINK: 33.17, HB_TIME: 0.443, HB_OVER: 2.46, HB_STEER: 0.47 } },
  mixed: { drive: { SLIDE_GAIN: 0.416, PROGRESS: 92, KEEP: 585, ANGLE_CAP: 35.38, EDGE_SAFE: 1.74, EDGE_COST: 2525, ENTRY: 29, VMAX: 26.08, CHAIN_KEEP: 264, CHAIN_MARGIN: 0.21, AY_MAX: 5.32, OUTSIDE: 0.626, SETUP: 34.27, WINDOW_PRE: 6.38, WINDOW_POST: 20, LINK: 46.97, HB_TIME: 0.162, HB_OVER: 1.51, HB_STEER: 0.05 } },
};

/* the measuring players of the rest of the ladder (briefs/RIVALS-LADDER-2.md priority 1): for each track and car (atKey), each kind's numbers, searched there by game/test/ladder2/players.js so all three finish every disturbed solo run with no respawn and within PLAYER_SPREAD of each other's pace (review/ladder2/REPORT.md) */
PLAYERS.AT = {
};

/* where a player drives: career index, car and upgrades ({ power, grip, steer } or none) */
export function atKey(index, car, up) {
  const u = up ? [up.power || 0, up.grip || 0, up.steer || 0].join('') : '000';
  return index + ':' + (car || 'starter') + ':' + u;
}
export function playerDrive(kind, at) {
  const e = at && PLAYERS.AT[atKey(at.index, at.car, at.up)];
  return e && e[kind] ? e[kind] : PLAYERS[kind].drive;
}

const PICK = {
  grip: () => false,
  slide: null,
  mixed: c => !!(c.src && c.src.radius <= PLAYERS.MIX_RADIUS),
};

/* kind: 'grip', 'slide' or 'mixed'; override: driving numbers on top of
   its own (the measurements' disturbances); at: { index, car, up }, where
   it drives, for the numbers searched there (none: its own) */
export function createPlayer(track, kind, override, avoid, at) {
  const P = PLAYERS[kind];
  if (!P) throw new Error('no scripted player ' + kind);
  const drv = createRivalDriver(track, playerDrive(kind, at), Object.assign({ HANDS: 1 }, override || {}), null, PICK[kind], avoid || null);
  return { kind, input: world => drv.input(world), reset: () => drv.reset(), driver: drv };
}
