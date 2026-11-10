/* THE RIVALS (briefs/RIVALS.md): six named drivers, two in each
   chapter, each on a career track of his half of the chapter. Each has
   an invented name, one of the five cars with a paint, the side of the
   grid he starts on, a prize for the first win over him, and his
   character: a few overrides of the rival driver's numbers
   (rivals/driver.js RIVAL_DRIVE). First guesses for the author to set
   by play; the measurements in game/test/rivals/ say how each drives. */
export const RIVALS = [
  { id: 'r1', name: 'Kestrow', car: 'starter', paint: 'flame', track: 0, side: 1, prize: 300,
    style: 'Smooth and wide',
    drive: { SLIDE_GAIN: 0.739, PROGRESS: 129, KEEP: 1029, ANGLE_CAP: 48.94, EDGE_SAFE: 0.8, EDGE_COST: 446, ENTRY: 24.74, VMAX: 29.82, CHAIN_KEEP: 2813, CHAIN_MARGIN: 0.4, AY_MAX: 8.84, OUTSIDE: 0.338, SETUP: 23.08, WINDOW_PRE: 3.64, WINDOW_POST: 14.58, LINK: 4.95, HB_TIME: 0.352 } },
  /* the other five: tracks, and how each drives, chosen by measurement (game/test/rivals/search.js, review/rivals/REPORT.md) */
  { id: 'r2', name: 'Tolvo', car: 'hatch', paint: 'amber', track: 6, side: -1, prize: 400,
    style: 'Fast and shallow',
    drive: {} },
  { id: 'r3', name: 'Varsk', car: 'fastback', paint: 'lime', track: 11, side: 1, prize: 600,
    style: 'Late and aggressive',
    drive: {} },
  { id: 'r4', name: 'Dovane', car: 'tourer', paint: 'wine', track: 12, side: -1, prize: 800,
    style: 'Long, linked slides',
    drive: {} },
  { id: 'r5', name: 'Halvik', car: 'driftbuild', paint: 'magenta', track: 18, side: 1, prize: 1000,
    style: 'The biggest angles',
    drive: {} },
  { id: 'r6', name: 'Sarrow', car: 'fastback', paint: 'white', track: 22, side: -1, prize: 1500,
    style: 'Fast, deep and linked',
    drive: {} },
];

export function rivalById(id) { return RIVALS.find(r => r.id === id) || null; }
export function rivalOnTrack(index) { return RIVALS.find(r => r.track === index) || null; }

/* A rival opens with a star on his track and a win over the rival
   before him (briefs/RIVALS.md). Battles gate nothing that exists. */
export function rivalIndex(id) { return RIVALS.findIndex(r => r.id === id); }
export function rivalOpen(save, id) {
  const k = rivalIndex(id);
  if (k < 0) return false;
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
