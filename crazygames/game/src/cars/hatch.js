/* LIGHT AND TWITCHY: a small three door hatch on a short wheelbase,
   upright, with a roof spoiler over a steep tailgate, rally mud flaps
   and white wheels. Short overhangs and big arches for its size, so it
   reads as small and nimble from behind. */
export default {
  id: 'hatch',
  label: 'Light hatch',
  character: 'small, short wheelbase, twitchy',
  paint: 0xffb81c,
  dims: { length: 3.68, wheelbase: 2.32, track: 1.48, wheelRadius: 0.3, tyre: [0.19, 0.19] },
  offset: -0.02,
  halfWidth: 0.84,
  floor: 0.17, sill: 0.28,
  nose: { low: 0.27, belt: 0.66, deck: 0.7, taper: 0.86, round: 0.24 },
  tail: { low: 0.33, belt: 0.9, deck: 0.96, taper: 0.93, round: 0.12 },
  belt: 0.88, beltRise: 0.03, hood: 0.92, hoodCrown: 0.03,
  screen: [-0.74, -0.16],
  roof: { h: 1.42, end: 1.42, w: 0.62, drop: 0.02, crown: 0.025 },
  rear: { base: 1.76, deck: 0.98 },
  windows: [[-0.64, 0.42], [0.5, 1.36]],
  shoulder: 0.03, glassIn: 0.11, waist: 0.4,
  archGap: [0.05, 0.05], archSteps: 6, spacing: 0.2,
  sillTrim: true,
  front: {
    lamps: [[0.48, 0.72, 0.52, 0.62]],
    trim: [[-0.46, 0.46, 0.5, 0.62], [-0.56, 0.56, 0.3, 0.4]],
  },
  back: {
    lamps: [[0.6, 0.8, 0.64, 0.9]],
    trim: [[-0.2, 0.2, 0.52, 0.63, 0xd9d8cf], [-0.75, 0.75, 0.37, 0.45, 0x34363d]],
  },
  extras: [
    { type: 'mirrors', at: 0.12, reach: 0.14 },
    { type: 'roofSpoiler', chord: 0.2, drop: 0.05, span: 0.6, paint: true },
    { type: 'mudflaps', y0: 0.07, y1: 0.27, colour: 0x16171b },
    { type: 'exhaust', x: [-0.45], y: 0.3, r: 0.035, out: 0.01 },
  ],
  wheel: { segments: 16, spokes: 8, spokeShare: 0.5, rim: 0.64, dish: 0.025, colour: 0xeceee8 },
};
