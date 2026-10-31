/* HEAVY AND SMOOTH: a long, wide grand tourer. A long bonnet, the cabin
   set well back, a long fast rear glass into a short tail with a full
   width lamp bar, twin exhausts each side and fine ten spoke wheels.
   Finer stations than the others, so its surfaces read smoother. */
export default {
  id: 'tourer',
  label: 'Grand tourer',
  character: 'long, wide and heavy, smooth',
  paint: 0x8c1f3a,
  dims: { length: 4.8, wheelbase: 2.86, track: 1.66, wheelRadius: 0.35, tyre: [0.245, 0.255] },
  offset: 0.06,
  halfWidth: 0.99,
  floor: 0.14, sill: 0.25,
  nose: { low: 0.22, belt: 0.58, deck: 0.62, taper: 0.8, round: 0.36 },
  tail: { low: 0.3, belt: 0.86, deck: 0.92, taper: 0.86, round: 0.34 },
  belt: 0.78, beltRise: 0.05, hood: 0.82, hoodCrown: 0.05,
  screen: [-0.26, 0.38],
  roof: { h: 1.24, end: 1.02, w: 0.5, drop: 0.04, crown: 0.035 },
  rear: { base: 1.86, deck: 0.93 },
  windows: [[-0.14, 0.72], [0.8, 1.3]],
  shoulder: 0.09, glassIn: 0.18, waist: 0.46,
  archGap: [0.05, 0.05], archSteps: 7, spacing: 0.16,
  front: {
    lamps: [[0.46, 0.74, 0.46, 0.53]],
    trim: [[-0.43, 0.43, 0.28, 0.5, 0xb4b9c1], [-0.4, 0.4, 0.3, 0.48], [-0.62, 0.62, 0.24, 0.27]],
  },
  back: {
    lamps: [[-0.82, 0.82, 0.76, 0.82]],
    trim: [[-0.2, 0.2, 0.52, 0.63, 0xd9d8cf], [-0.72, 0.72, 0.33, 0.42, 0x16171b]],
  },
  extras: [
    { type: 'mirrors', at: 0.14, reach: 0.15 },
    { type: 'lip', back: 0.02, chord: 0.2, h: 0.035, span: 0.7, paint: true },
    { type: 'exhaust', x: [0.5, 0.6, -0.5, -0.6], y: 0.3, r: 0.035, out: 0.015 },
  ],
  wheel: { segments: 20, spokes: 10, spokeShare: 0.5, rim: 0.68, dish: 0.03, colour: 0x9aa0a8 },
};
