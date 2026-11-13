/* THE LAST THREE RIVALS AS THEY ARE ON main (14 November 2026, before
   briefs/RIVALS-PACE.md), the known answers of the pace round's
   measures: Halvik fails the disturbed bar, and this table does not
   climb after Varsk. Copied from game/src/rivals/roster.js at that
   commit, unchanged. */
import { rivalById } from '../../src/rivals/roster.js';

const TOLVO = { SLIDE_GAIN: 0.35, PROGRESS: 45, KEEP: 325, ANGLE_CAP: 21.56, EDGE_SAFE: 2.37, EDGE_COST: 2875, ENTRY: 26.2, VMAX: 33.14, CHAIN_KEEP: 0, CHAIN_MARGIN: 0.34, AY_MAX: 7.28, OUTSIDE: 0.157, SETUP: 39.95, WINDOW_PRE: 3.98, WINDOW_POST: -5.28, LINK: 4.81, HB_TIME: 0.1, HB_OVER: 0.75, HB_STEER: 0.35 };
const VARSK = { SLIDE_GAIN: 0.445, PROGRESS: 40, KEEP: 578, ANGLE_CAP: 29.2, EDGE_SAFE: 2.86, EDGE_COST: 2646, ENTRY: 25.85, VMAX: 33.8, CHAIN_KEEP: 0, CHAIN_MARGIN: 0.36, AY_MAX: 7.29, OUTSIDE: 0.49, SETUP: 52.23, WINDOW_PRE: 3, WINDOW_POST: -7.89, LINK: 3.79, HB_TIME: 0.302, HB_OVER: 1.86, HB_STEER: 0.35 };
const HALVIK = { SLIDE_GAIN: 0.945, PROGRESS: 92, KEEP: 1500, ANGLE_CAP: 50.2, EDGE_SAFE: 1.66, EDGE_COST: 2786, ENTRY: 19.5, VMAX: 32.1, CHAIN_KEEP: 197, CHAIN_MARGIN: 0.24, AY_MAX: 7.38, OUTSIDE: 0.092, SETUP: 70.99, WINDOW_PRE: 13.45, WINDOW_POST: 5.64, LINK: 11.96, HB_TIME: 0.279 };

export const MAIN = {
  r4: { ...rivalById('r4'), car: 'tourer', track: 12, laps: 3, up: { power: 2, grip: 2, steer: 2 }, style: 'Long, linked slides', drive: TOLVO },
  r5: { ...rivalById('r5'), car: 'driftbuild', track: 18, laps: 3, up: undefined, style: 'The biggest angles', drive: HALVIK },
  r6: { ...rivalById('r6'), car: 'starter', track: 20, laps: 3, up: undefined, style: 'Beats you in the starter coupe', drive: VARSK },
};
for (const k in MAIN) if (!MAIN[k].up) delete MAIN[k].up;
