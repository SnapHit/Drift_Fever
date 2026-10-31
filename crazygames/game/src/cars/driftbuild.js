/* THE PRIZE: a low, wide, aggressive drift build. Slammed, box flares
   front and rear over fat tyres in deep dish bronze wheels, a wedge nose
   with a splitter and canards, side skirts, a diffuser, and a big wing
   on uprights with end plates. */
export default {
  id: 'driftbuild',
  label: 'Drift build',
  character: 'low, wide and aggressive, the prize',
  paint: 0xff2d8a,
  dims: { length: 4.48, wheelbase: 2.62, track: 1.7, wheelRadius: 0.34, tyre: [0.26, 0.27] },
  offset: -0.03,
  halfWidth: 0.895,
  floor: 0.1, sill: 0.2,
  nose: { low: 0.17, belt: 0.56, deck: 0.58, taper: 0.86, round: 0.3 },
  tail: { low: 0.28, belt: 0.86, deck: 0.92, taper: 0.92, round: 0.2 },
  belt: 0.76, beltRise: 0.06, hood: 0.8, hoodCrown: 0.04,
  screen: [-0.5, 0.12],
  roof: { h: 1.17, end: 0.8, w: 0.56, drop: 0.02, crown: 0.03 },
  rear: { base: 1.4, deck: 0.9 },
  windows: [[-0.4, 0.48], [0.56, 1.02]],
  shoulder: 0.03, glassIn: 0.12, waist: 0.42,
  flare: { front: { amount: 0.095, box: true, flat: 0.44, ramp: 0.22, belt: 0 }, rear: { amount: 0.095, box: true, flat: 0.46, ramp: 0.26, belt: 0 } },
  archGap: [0.045, 0.045], archSteps: 6, spacing: 0.2,
  roofColour: 0x16171b,
  front: {
    lamps: [[0.5, 0.76, 0.42, 0.47]],
    trim: [[-0.3, 0.3, 0.36, 0.46], [-0.66, 0.66, 0.22, 0.33]],
  },
  back: {
    lamps: [[0.36, 0.8, 0.74, 0.79]],
    trim: [[-0.2, 0.2, 0.52, 0.63, 0xd9d8cf]],
  },
  extras: [
    { type: 'mirrors', at: 0.14, reach: 0.13 },
    { type: 'splitter', out: 0.06, depth: 0.4, y: 0.1, thick: 0.03, span: 0.86, colour: 0x1d1e22 },
    { type: 'canards', z: 0.14, x0: 0.62, x1: 0.84, y: 0.3, rise: 0.06, colour: 0x1d1e22 },
    { type: 'skirts', y0: 0.1, y1: 0.2, out: 0.1, colour: 0x1d1e22 },
    { type: 'diffuser', depth: 0.45, y0: 0.13, y1: 0.33, rise: 0.12, span: 0.7, fins: 4, colour: 0x1d1e22 },
    { type: 'wing', z: 1.98, chord: 0.34, thick: 0.05, angle: 0.12, y: 1.24, span: 0.86, post: 0.45, plateUp: 0.08, plateDown: 0.2, platePaint: true, colour: 0x16171b },
    { type: 'exhaust', x: [0.36], y: 0.24, r: 0.055, out: 0.015 },
  ],
  wheel: { segments: 18, spokes: 6, spokeShare: 0.34, rim: 0.66, dish: 0.07, colour: 0xc08a3e },
};
