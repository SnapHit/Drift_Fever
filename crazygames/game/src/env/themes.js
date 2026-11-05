/* THEMES: what the world around a track is made of. Five, chosen per
   track by its seed, with ?theme= overriding: forest and hills, a
   coast with water and cliffs, a desert canyon, city docks, and a
   mountain pass with snow. A theme is data: the terrain's palette and
   relief, what the backdrop on the horizon is, and which props stand
   where, with how many of each per hectare. The props themselves are
   built in props.js and placed in scenery.js.

   Distances are in metres. `keepOut` is the least distance from the
   road's edge (plus run-off) a prop's footprint may stand, by prop
   kind, so nothing stands inside the barriers or leans over the road.
   Tall things keep further back than low ones, so the camera's view
   of the road ahead stays clear; the visuals probe checks sight lines
   against every placed prop and the terrain. */

export const THEMES = {
  forest: {
    name: 'forest',
    ground:      [0x4f6a2e, 0x6a7d36],   // grass, two tones mixed by noise
    dry:         0x7d7a3c,               // worn patches
    rock:        0x5c5650,
    snow:        null,
    hill:        34,                     // m, the tallest hills
    hillScale:   0.0034,                 // noise frequency: lower is broader hills
    rolling:     6,                      // m of gentle roll that starts closer in
    flatFrom:    16,                     // m past the road edge the ground is dead flat
    flatTo:      110,                    // m past the edge the hills are at full height
    sea:         null,
    backdrop:    'mountains',
    backColour:  0x3a4160,
    water:       null,
    props: [
      { kind: 'pine',       perHa: 6.5,  keepOut: 11, near: 0.35, scale: [0.8, 1.5] },
      { kind: 'tree',       perHa: 4.0,  keepOut: 11, near: 0.35, scale: [0.8, 1.4] },
      { kind: 'bush',       perHa: 6.0,  keepOut: 5,  near: 0.9,  scale: [0.7, 1.3] },
      { kind: 'rock',       perHa: 1.2,  keepOut: 5,  near: 0.6,  scale: [0.6, 1.6] },
      { kind: 'house',      perHa: 0.12, keepOut: 22, near: 0.4,  scale: [1, 1.2], flat: true },
      { kind: 'barn',       perHa: 0.08, keepOut: 24, near: 0.4,  scale: [1, 1.2], flat: true },
      { kind: 'haybale',    perHa: 0.8,  keepOut: 6,  near: 0.8,  scale: [1, 1] },
    ],
    trackside: { grandstands: 3, towers: 4, flags: 24, tyres: 12, boards: 10, lamps: 0 },
  },
  coastal: {
    name: 'coastal',
    ground:      [0x62793a, 0x7a8842],
    dry:         0xb8a06a,               // sand
    rock:        0x7a6e62,
    snow:        null,
    hill:        28,
    hillScale:   0.004,
    rolling:     4,
    flatFrom:    16,
    flatTo:      100,
    sea:         { drop: 9, cliff: 18 },  // the land falls this far to the water, over this width
    backdrop:    'headland',
    backColour:  0x4a5878,
    water:       0x2a6f8a,
    props: [
      { kind: 'palm',       perHa: 2.2,  keepOut: 11, near: 0.5,  scale: [0.8, 1.3] },
      { kind: 'bush',       perHa: 5.0,  keepOut: 5,  near: 0.9,  scale: [0.6, 1.2] },
      { kind: 'rock',       perHa: 2.0,  keepOut: 5,  near: 0.7,  scale: [0.5, 1.8] },
      { kind: 'boulder',    perHa: 0.5,  keepOut: 14, near: 0.3,  scale: [1, 1.8] },
      { kind: 'house',      perHa: 0.15, keepOut: 22, near: 0.5,  scale: [0.9, 1.1], flat: true },
    ],
    trackside: { grandstands: 2, towers: 4, flags: 30, tyres: 16, boards: 10, lamps: 0 },
  },
  desert: {
    name: 'desert',
    ground:      [0xb07a48, 0xc08f58],
    dry:         0xc9a06c,
    rock:        0x8a4a34,               // red rock
    snow:        null,
    hill:        40,
    hillScale:   0.0045,
    rolling:     5,
    flatFrom:    16,
    flatTo:      95,
    sea:         null,
    backdrop:    'mesas',
    backColour:  0x6a3a3a,
    water:       null,
    props: [
      { kind: 'cactus',     perHa: 2.5,  keepOut: 8,  near: 0.7,  scale: [0.7, 1.4] },
      { kind: 'bush',       perHa: 4.0,  keepOut: 5,  near: 0.9,  scale: [0.5, 1.0], colour: 0x8a7a40 },
      { kind: 'rock',       perHa: 3.0,  keepOut: 5,  near: 0.7,  scale: [0.6, 2.0], colour: 0x9a5a40 },
      { kind: 'boulder',    perHa: 0.8,  keepOut: 14, near: 0.3,  scale: [1, 2.2], colour: 0x9a5a40 },
      { kind: 'mesa',       perHa: 0.06, keepOut: 60, near: 0.0,  scale: [1, 1.8], flat: true },
    ],
    trackside: { grandstands: 2, towers: 4, flags: 20, tyres: 20, boards: 10, lamps: 0 },
  },
  docks: {
    name: 'docks',
    ground:      [0x4d4f52, 0x5a5c60],   // concrete and tarmac
    dry:         0x6a6660,
    rock:        0x3e4044,
    snow:        null,
    hill:        0,
    hillScale:   0.004,
    rolling:     0,
    flatFrom:    16,
    flatTo:      100,
    sea:         { drop: 4, cliff: 2 },   // a quay edge straight into the water
    backdrop:    'skyline',
    backColour:  0x2c3350,
    water:       0x1f3a4a,
    props: [
      { kind: 'container',  perHa: 3.0,  keepOut: 9,  near: 0.8,  scale: [1, 1], stack: 3, align: true },
      { kind: 'warehouse',  perHa: 0.22, keepOut: 24, near: 0.5,  scale: [0.8, 1.3], flat: true },
      { kind: 'crane',      perHa: 0.12, keepOut: 30, near: 0.4,  scale: [1, 1.2], flat: true },
      { kind: 'lamp',       perHa: 1.2,  keepOut: 7,  near: 0.9,  scale: [1, 1] },
      { kind: 'tyrestack',  perHa: 1.0,  keepOut: 6,  near: 0.9,  scale: [1, 1] },
      { kind: 'bollard',    perHa: 1.5,  keepOut: 5,  near: 0.9,  scale: [1, 1] },
    ],
    trackside: { grandstands: 3, towers: 6, flags: 16, tyres: 24, boards: 12, lamps: 10 },
  },
  mountain: {
    name: 'mountain',
    ground:      [0x56703a, 0x6c7a40],
    dry:         0x7a7050,
    rock:        0x6a6a70,
    snow:        0xe8eef8,
    snowLine:    22,                     // m above the track, snow from here up
    hill:        70,
    hillScale:   0.0035,
    rolling:     7,
    flatFrom:    16,
    flatTo:      90,
    sea:         null,
    backdrop:    'peaks',
    backColour:  0x4a5270,
    water:       null,
    props: [
      { kind: 'pine',       perHa: 9.0,  keepOut: 11, near: 0.35, scale: [0.8, 1.6] },
      { kind: 'rock',       perHa: 2.5,  keepOut: 5,  near: 0.7,  scale: [0.6, 1.8] },
      { kind: 'boulder',    perHa: 0.7,  keepOut: 14, near: 0.3,  scale: [1, 2.0] },
      { kind: 'bush',       perHa: 3.0,  keepOut: 5,  near: 0.9,  scale: [0.5, 1.0] },
      { kind: 'cabin',      perHa: 0.1,  keepOut: 22, near: 0.4,  scale: [1, 1.1], flat: true },
    ],
    trackside: { grandstands: 2, towers: 4, flags: 20, tyres: 14, boards: 8, lamps: 0 },
  },
};

export const THEME_NAMES = Object.keys(THEMES);

export function themeFor(seed, override) {
  if (override && THEMES[override]) return THEMES[override];
  let h = ((seed >>> 0) ^ 0x5bd1e995) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x9e3779b1) >>> 0;
  return THEMES[THEME_NAMES[(h >>> 8) % THEME_NAMES.length]];
}
