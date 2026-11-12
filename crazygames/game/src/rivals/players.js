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
  '0:starter:000': {"grip": {"EDGE_SAFE": 1.5, "ENTRY": 18.43, "VMAX": 32.38, "AY_MAX": 7.62, "OUTSIDE": 0.482, "SETUP": 77.45, "HB_OVER": 5.92, "HB_STEER": 0.32}, "slide": {"SLIDE_GAIN": 0.35, "PROGRESS": 30, "KEEP": 473, "ANGLE_CAP": 25, "EDGE_SAFE": 2.25, "EDGE_COST": 2960, "ENTRY": 26.25, "VMAX": 34, "CHAIN_KEEP": 273, "CHAIN_MARGIN": 0.27, "AY_MAX": 7.86, "OUTSIDE": 0.42, "SETUP": 27.06, "WINDOW_PRE": 4.36, "WINDOW_POST": -1.67, "LINK": 9.43, "HB_TIME": 0.173, "HB_OVER": 1.34, "HB_STEER": 0.22}, "mixed": {"SLIDE_GAIN": 0.566, "PROGRESS": 92, "KEEP": 413, "ANGLE_CAP": 35.65, "EDGE_SAFE": 1.69, "EDGE_COST": 2709, "ENTRY": 29, "VMAX": 26.08, "CHAIN_KEEP": 264, "CHAIN_MARGIN": 0.21, "AY_MAX": 5, "OUTSIDE": 0.8, "SETUP": 28.5, "WINDOW_PRE": 6.64, "WINDOW_POST": 20, "LINK": 41.58, "HB_TIME": 0.162, "HB_OVER": 1.23, "HB_STEER": 0.07}, "_from": {"grip": "grip-0", "slide": "slide-0a", "mixed": "mixed-0"}},
  '4:starter:000': {"grip": {"EDGE_SAFE": 2.47, "ENTRY": 12.41, "VMAX": 26.02, "AY_MAX": 4.7, "OUTSIDE": 0.309, "SETUP": 44.9, "HB_OVER": 2.85, "HB_STEER": 0.1}, "slide": {"SLIDE_GAIN": 0.447, "PROGRESS": 57, "KEEP": 44, "ANGLE_CAP": 35.28, "EDGE_SAFE": 2.74, "EDGE_COST": 2699, "ENTRY": 22.58, "VMAX": 23.95, "CHAIN_KEEP": 2367, "CHAIN_MARGIN": 0.26, "AY_MAX": 9, "OUTSIDE": 0.627, "SETUP": 40.89, "WINDOW_PRE": 7.01, "WINDOW_POST": -3.65, "LINK": 1.37, "HB_TIME": 0.237, "HB_OVER": 6, "HB_STEER": 0.08}, "mixed": {"SLIDE_GAIN": 0.393, "PROGRESS": 101, "KEEP": 508, "ANGLE_CAP": 35.38, "EDGE_SAFE": 1.77, "EDGE_COST": 2525, "ENTRY": 29, "VMAX": 26.08, "CHAIN_KEEP": 0, "CHAIN_MARGIN": 0.21, "AY_MAX": 5.32, "OUTSIDE": 0.64, "SETUP": 28.63, "WINDOW_PRE": 11.15, "WINDOW_POST": 20, "LINK": 46.97, "HB_TIME": 0.162, "HB_OVER": 1.51, "HB_STEER": 0.06}, "_from": {"grip": "grip-4b", "slide": "slide-4b", "mixed": "mixed-4e"}},
  '8:starter:111': {"grip": {"EDGE_SAFE": 1.6, "ENTRY": 17.39, "VMAX": 31.9, "AY_MAX": 8.26, "OUTSIDE": 0.397, "SETUP": 68.03, "HB_OVER": 6, "HB_STEER": 0.38}, "slide": {"SLIDE_GAIN": 0.5, "PROGRESS": 28, "KEEP": 490, "ANGLE_CAP": 25, "EDGE_SAFE": 2.57, "EDGE_COST": 3000, "ENTRY": 27.75, "VMAX": 33.01, "CHAIN_KEEP": 0, "CHAIN_MARGIN": 0.37, "AY_MAX": 7.39, "OUTSIDE": 0.35, "SETUP": 56.65, "WINDOW_PRE": 5.4, "WINDOW_POST": -9.79, "LINK": 0, "HB_TIME": 0.27, "HB_OVER": 0.69, "HB_STEER": 0.26}, "mixed": {"SLIDE_GAIN": 0.494, "PROGRESS": 140, "KEEP": 1329, "ANGLE_CAP": 52.08, "EDGE_SAFE": 1.65, "EDGE_COST": 477, "ENTRY": 21.85, "VMAX": 34, "CHAIN_KEEP": 830, "CHAIN_MARGIN": 0.26, "AY_MAX": 6.26, "OUTSIDE": 0.412, "SETUP": 75.52, "WINDOW_PRE": 12.2, "WINDOW_POST": 5.31, "LINK": 48.4, "HB_TIME": 0.293, "HB_OVER": 1.64, "HB_STEER": 0.5}, "_from": {"grip": "grip-8", "slide": "slide-8c", "mixed": "mixed-8c"}},
  '12:starter:111': {"grip": {"EDGE_SAFE": 1.54, "ENTRY": 14.96, "VMAX": 33.21, "AY_MAX": 8.94, "OUTSIDE": 0.324, "SETUP": 48.27, "HB_OVER": 4.79, "HB_STEER": 0.4}, "slide": {"SLIDE_GAIN": 0.35, "PROGRESS": 37, "KEEP": 482, "ANGLE_CAP": 20.41, "EDGE_SAFE": 2.31, "EDGE_COST": 2517, "ENTRY": 28.42, "VMAX": 34, "CHAIN_KEEP": 0, "CHAIN_MARGIN": 0.29, "AY_MAX": 7.66, "OUTSIDE": 0.556, "SETUP": 35.22, "WINDOW_PRE": 1.06, "WINDOW_POST": -3.75, "LINK": 4.31, "HB_TIME": 0.108, "HB_OVER": 0.5, "HB_STEER": 0.3}, "mixed": {"SLIDE_GAIN": 0.466, "PROGRESS": 44, "KEEP": 83, "ANGLE_CAP": 33.43, "EDGE_SAFE": 2.88, "EDGE_COST": 2853, "ENTRY": 23.29, "VMAX": 23.78, "CHAIN_KEEP": 2292, "CHAIN_MARGIN": 0.2, "AY_MAX": 7.3, "OUTSIDE": 0.743, "SETUP": 54.44, "WINDOW_PRE": 7.38, "WINDOW_POST": -7.11, "LINK": 2.48, "HB_TIME": 0.1, "HB_OVER": 5.63, "HB_STEER": 0.08}, "_from": {"grip": "grip-12c", "slide": "slide-12a", "mixed": "mixed-12c"}},
  '16:starter:222': {"grip": {"EDGE_SAFE": 3, "ENTRY": 19.91, "VMAX": 23.2, "AY_MAX": 7.74, "OUTSIDE": 0.119, "SETUP": 67.32, "HB_OVER": 2.23, "HB_STEER": 0.15}, "slide": {"SLIDE_GAIN": 0.15, "PROGRESS": 69, "KEEP": 734, "ANGLE_CAP": 44.01, "EDGE_SAFE": 2.34, "EDGE_COST": 2102, "ENTRY": 21.79, "VMAX": 22, "CHAIN_KEEP": 0, "CHAIN_MARGIN": 0.59, "AY_MAX": 5.81, "OUTSIDE": 0.374, "SETUP": 55.64, "WINDOW_PRE": 15.84, "WINDOW_POST": -8.07, "LINK": 25.91, "HB_TIME": 0.5, "HB_OVER": 1.81, "HB_STEER": 0.5}, "mixed": {"SLIDE_GAIN": 0.275, "PROGRESS": 49, "KEEP": 912, "ANGLE_CAP": 38.49, "EDGE_SAFE": 2.67, "EDGE_COST": 2225, "ENTRY": 21.79, "VMAX": 22.35, "CHAIN_KEEP": 385, "CHAIN_MARGIN": 0.42, "AY_MAX": 6.56, "OUTSIDE": 0.495, "SETUP": 67.78, "WINDOW_PRE": 17.85, "WINDOW_POST": -7.37, "LINK": 40.61, "HB_TIME": 0.484, "HB_OVER": 2.5, "HB_STEER": 0.5}, "_from": {"grip": "grip-16d", "slide": "slide-16a", "mixed": "mixed-16c"}},
  '20:starter:222': {"grip": {"EDGE_SAFE": 1.05, "ENTRY": 12.46, "VMAX": 32.94, "AY_MAX": 8.17, "OUTSIDE": 0.201, "SETUP": 33.27, "HB_OVER": 3.19, "HB_STEER": 0.43}, "slide": {"SLIDE_GAIN": 0.15, "PROGRESS": 61, "KEEP": 858, "ANGLE_CAP": 41.36, "EDGE_SAFE": 1.76, "EDGE_COST": 2146, "ENTRY": 20.56, "VMAX": 22, "CHAIN_KEEP": 326, "CHAIN_MARGIN": 0.58, "AY_MAX": 5.78, "OUTSIDE": 0.311, "SETUP": 53.56, "WINDOW_PRE": 19.6, "WINDOW_POST": -6.04, "LINK": 31.64, "HB_TIME": 0.495, "HB_OVER": 1.83, "HB_STEER": 0.45}, "mixed": {"SLIDE_GAIN": 0.255, "PROGRESS": 49, "KEEP": 915, "ANGLE_CAP": 39.62, "EDGE_SAFE": 2.54, "EDGE_COST": 1820, "ENTRY": 24.93, "VMAX": 22.43, "CHAIN_KEEP": 666, "CHAIN_MARGIN": 0.43, "AY_MAX": 5.41, "OUTSIDE": 0.333, "SETUP": 55.2, "WINDOW_PRE": 17.69, "WINDOW_POST": -10, "LINK": 28.57, "HB_TIME": 0.484, "HB_OVER": 2.65, "HB_STEER": 0.48}, "_from": {"grip": "grip-20c", "slide": "slide-20a", "mixed": "mixed-20c"}},
};

/* where a player drives: career index, car and upgrades ({ power, grip, steer } or none) */
export function atKey(index, car, up) {
  const u = up ? [up.power || 0, up.grip || 0, up.steer || 0].join('') : '000';
  return index + ':' + (car || 'starter') + ':' + u;
}
export function playerDrive(kind, at) {
  const e = at && PLAYERS.AT[atKey(at.index, at.car, at.up)];
  return e && e[kind] ? Object.assign({}, PLAYERS[kind].drive, e[kind]) : PLAYERS[kind].drive;   // searched over its own numbers, so a number the search left alone is its own
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
