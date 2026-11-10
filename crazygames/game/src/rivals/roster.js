/* THE RIVALS (briefs/RIVALS.md): six named drivers, two in each
   chapter, each on a career track of his half of the chapter. Each has
   an invented name, one of the five cars with a paint, the side of the
   grid he starts on, a prize for the first win over him, and his
   character: a few overrides of the rival driver's numbers
   (rivals/driver.js RIVAL_DRIVE). First guesses for the author to set
   by play; the measurements in game/test/rivals/ say how each drives. */
export const RIVALS = [
  { id: 'r1', name: 'Rook', car: 'starter', paint: 'flame', track: 0, side: 1, prize: 300,
    style: 'Smooth and wide',
    drive: { SLIDE_GAIN: 0.573, PROGRESS: 75, KEEP: 644, ANGLE_CAP: 34.71, EDGE_SAFE: 1.85, EDGE_COST: 1802, ENTRY: 19.44, VMAX: 24.78, AY_MAX: 6.11, OUTSIDE: 0.203, SETUP: 58.67, WINDOW_PRE: 20.29, WINDOW_POST: 5.42, LINK: 43.72, HB_TIME: 0.428 } },
];

export function rivalById(id) { return RIVALS.find(r => r.id === id) || null; }
export function rivalOnTrack(index) { return RIVALS.find(r => r.track === index) || null; }
