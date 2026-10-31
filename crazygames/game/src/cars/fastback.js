/* RAW POWER: a muscular fastback. A long flat bonnet with a raised
   bulge, a short roof that runs straight into a long sloping deck and a
   kicked up tail, a full width grille band, wide rear hips over wider
   rear tyres, and big twin exhausts. */
export default {
  id: 'fastback',
  label: 'Fastback',
  character: 'muscular, wide rear arches, raw power',
  paint: 0xe8452c,
  dims: { length: 4.7, wheelbase: 2.76, track: 1.62, wheelRadius: 0.35, tyre: [0.24, 0.3] },
  offset: 0.03,
  halfWidth: 0.92,
  floor: 0.15, sill: 0.27,
  nose: { low: 0.27, belt: 0.76, deck: 0.8, taper: 0.92, round: 0.18 },
  tail: { low: 0.33, belt: 0.98, deck: 1.1, taper: 0.95, round: 0.16 },
  belt: 0.92, beltRise: 0.02, hood: 0.97, hoodCrown: 0.03,
  screen: [-0.32, 0.3],
  roof: { h: 1.42, end: 0.62, w: 0.56, drop: 0.02, crown: 0.03 },
  rear: { base: 2.08, deck: 1.06 },
  rearGlass: [[0.64, 1.3]],
  windows: [[-0.2, 0.55], [0.62, 1.12]],
  shoulder: 0.015, glassIn: 0.13, waist: 0.48,
  flare: { front: { amount: 0.03, len: 0.5 }, rear: { amount: 0.08, len: 0.8, belt: 0.7 } },
  archGap: [0.05, 0.05], archSteps: 6, spacing: 0.2,
  bulge: { from: -1.95, to: -0.42, w: 0.3, h: 0.05 },
  front: {
    lamps: [[0.56, 0.78, 0.52, 0.62]],
    trim: [[-0.84, 0.84, 0.48, 0.66], [-0.6, 0.6, 0.3, 0.38]],
  },
  back: {
    lamps: [[0.32, 0.8, 0.76, 0.86]],
    trim: [[-0.2, 0.2, 0.58, 0.7, 0xd9d8cf], [-0.8, 0.8, 0.38, 0.46, 0x16171b]],
  },
  extras: [
    { type: 'mirrors', at: 0.14, reach: 0.15 },
    { type: 'lip', back: 0.0, chord: 0.24, h: 0.12, span: 0.84, paint: true },
    { type: 'exhaust', x: [0.55, -0.55], y: 0.31, r: 0.05, out: 0.015 },
  ],
  wheel: { segments: 15, spokes: 5, spokeShare: 0.33, rim: 0.66, dish: 0.045, colour: 0x5a5e66 },
};
