/* THE RIVALS (briefs/RIVALS.md): six named drivers, two in each
   chapter, each on a career track of his half of the chapter. Each has
   an invented name, one of the five cars with a paint, the side of the
   grid he starts on, a prize for the first win over him, and his
   character: a few overrides of the rival driver's numbers
   (rivals/driver.js RIVAL_DRIVE). First guesses for the author to set
   by play; the measurements in game/test/rivals/ say how each drives. */
import { TANDEM } from '../tune.js';

export const RIVALS = [
  { id: 'r1', name: 'Kestrow', car: 'starter', paint: 'flame', track: 0, side: 1, prize: 300, laps: 4,
    style: 'Smooth and wide',
    /* the drift race (briefs/DRIFT-RACE.md): his driving searched again with a player's hands (game/test/driftrace/search.js --character): shallow slides in every corner, each banked on its own, at the scripted players' pace */
    drive: { SLIDE_GAIN: 0.35, PROGRESS: 30, KEEP: 397, ANGLE_CAP: 20.41, EDGE_SAFE: 2.47, EDGE_COST: 2670, ENTRY: 26.25, VMAX: 34, CHAIN_KEEP: 273, CHAIN_MARGIN: 0.33, AY_MAX: 7.4, OUTSIDE: 0.427, SETUP: 33.45, WINDOW_PRE: 5.32, WINDOW_POST: -3.75, LINK: 4.31, HB_TIME: 0.108, HB_OVER: 0.65, HB_STEER: 0.3 } },
  /* the other five: tracks, and how each drives, chosen by measurement (game/test/rivals/search.js, review/rivals/REPORT.md) */
  { id: 'r2', name: 'Tolvo', car: 'hatch', paint: 'amber', track: 6, side: -1, prize: 400,
    style: 'Fast and shallow',
    drive: { SLIDE_GAIN: 0.985, PROGRESS: 131, KEEP: 801, ANGLE_CAP: 22.56, EDGE_SAFE: 1.77, EDGE_COST: 1158, ENTRY: 19.17, VMAX: 25.42, CHAIN_KEEP: 475, CHAIN_MARGIN: 0.21, AY_MAX: 5.51, OUTSIDE: 0.425, SETUP: 40.98, WINDOW_PRE: 28.63, WINDOW_POST: 16.53, LINK: 0.19, HB_TIME: 0.116 } },
  { id: 'r3', name: 'Varsk', car: 'fastback', paint: 'lime', track: 8, side: 1, prize: 600,
    style: 'Late and aggressive',
    drive: { SLIDE_GAIN: 0.254, PROGRESS: 66, KEEP: 335, ANGLE_CAP: 46.48, EDGE_SAFE: 1.11, EDGE_COST: 1093, ENTRY: 23.5, VMAX: 26.92, CHAIN_KEEP: 0, CHAIN_MARGIN: 0.1, AY_MAX: 7.07, OUTSIDE: 0.662, SETUP: 19.86, WINDOW_PRE: 2.31, WINDOW_POST: 1.44, LINK: 3.1, HB_TIME: 0.462 } },
  { id: 'r4', name: 'Dovane', car: 'tourer', paint: 'wine', track: 12, side: -1, prize: 800,
    style: 'Long, linked slides',
    drive: { SLIDE_GAIN: 1.353, PROGRESS: 87, KEEP: 974, ANGLE_CAP: 35.87, EDGE_SAFE: 2.63, EDGE_COST: 428, ENTRY: 24.37, VMAX: 30.93, CHAIN_KEEP: 2979, CHAIN_MARGIN: 0.42, AY_MAX: 7.42, OUTSIDE: 0.609, SETUP: 44.06, WINDOW_PRE: 21.02, WINDOW_POST: 1.05, LINK: 26.64, HB_TIME: 0.13 } },
  { id: 'r5', name: 'Halvik', car: 'driftbuild', paint: 'magenta', track: 16, side: 1, prize: 1000,
    style: 'The biggest angles',
    drive: { SLIDE_GAIN: 0.945, PROGRESS: 92, KEEP: 1500, ANGLE_CAP: 50.2, EDGE_SAFE: 1.66, EDGE_COST: 2786, ENTRY: 19.5, VMAX: 32.1, CHAIN_KEEP: 197, CHAIN_MARGIN: 0.24, AY_MAX: 7.38, OUTSIDE: 0.092, SETUP: 70.99, WINDOW_PRE: 13.45, WINDOW_POST: 5.64, LINK: 11.96, HB_TIME: 0.279 } },
  { id: 'r6', name: 'Sarrow', car: 'fastback', paint: 'white', track: 20, side: -1, prize: 1500,
    style: 'Fast, deep and linked',
    drive: { SLIDE_GAIN: 0.714, PROGRESS: 51, KEEP: 405, ANGLE_CAP: 52.72, EDGE_SAFE: 1.03, EDGE_COST: 671, ENTRY: 23.61, VMAX: 24.77, CHAIN_KEEP: 2000, CHAIN_MARGIN: 0.39, AY_MAX: 7.1, OUTSIDE: 0.723, SETUP: 33.14, WINDOW_PRE: 8.88, WINDOW_POST: 1.18, LINK: 59.53, HB_TIME: 0.439 } },
];

export function rivalById(id) { return RIVALS.find(r => r.id === id) || null; }
export function rivalOnTrack(index) { return RIVALS.find(r => r.track === index) || null; }

/* A rival opens with a star on his track and a win over the rival
   before him (briefs/RIVALS.md). Battles gate nothing that exists. */
export function rivalIndex(id) { return RIVALS.findIndex(r => r.id === id); }
/* How many rivals are in the game: the first TANDEM.LIVE, or all six
   with ?rivals=all in the address (the rest are built but not yet fair
   or robust: review/rivals/REPORT.md). */
const ALL = typeof location !== 'undefined' && /[?&]rivals=all(&|$)/.test(location.search || '');
export function rivalsLive() { return ALL ? RIVALS.length : Math.min(RIVALS.length, TANDEM.LIVE); }
export function rivalOpen(save, id) {
  const k = rivalIndex(id);
  if (k < 0 || k >= rivalsLive()) return false;
  const e = save.career[String(RIVALS[k].track)];
  if (!e || e.stars < 1) return false;
  if (k === 0) return true;
  const prev = save.rivals && save.rivals[RIVALS[k - 1].id];
  return !!(prev && prev.won);
}
export function openRivals(save) { return RIVALS.filter(r => rivalOpen(save, r.id)).map(r => r.id); }

/* The rival's paint, never the player's (the readability rule: the
   player's car is the most findable). */
export function rivalPaint(def, playerPaint) { return def.paint !== playerPaint ? def.paint : def.altPaint || 'white'; }
