/* THE STARTER: a compact, balanced coupe, friendly. Cyan by default.
   Built to the feel prototype's vehicle exactly: wheelbase 2.55 m, track
   1.60 m, wheel radius 0.33 m, and inside its 4.40 by 1.84 m collision
   box, which is centred 0.025 m ahead of the middle of the wheelbase
   (the centre of mass sits 1.25 m behind the front axle).

   Every number is metres. z runs from the front bumper (negative) to the
   rear; the middle of the wheelbase is z = 0, the front axle -1.275. */
export default {
  id: 'fastback',
  label: 'Starter coupe',
  character: 'compact and balanced, friendly',
  paint: 0x19d8ff,
  dims: { length: 4.36, wheelbase: 2.55, track: 1.60, wheelRadius: 0.33, tyre: [0.22, 0.22] },
  offset: -0.025,          // the body's middle from the middle of the wheelbase
  halfWidth: 0.915,        // the sides; the tyres' outer faces are at 0.91
  floor: 0.15, sill: 0.27,
  nose: { low: 0.25, belt: 0.64, deck: 0.68, taper: 0.84, round: 0.32 },
  tail: { low: 0.32, belt: 0.86, deck: 0.93, taper: 0.88, round: 0.26 },
  belt: 0.84, beltRise: 0.04, hood: 0.89, hoodCrown: 0.045,
  screen: [-0.62, 0.02],
  roof: { h: 1.32, end: 0.76, w: 0.6, drop: 0.03, crown: 0.035 },
  rear: { base: 1.42, deck: 0.96 },
  windows: [[-0.5, 0.42], [0.5, 1.08]],
  shoulder: 0.035, glassIn: 0.12, waist: 0.42,
  archGap: [0.05, 0.045], archSteps: 6, spacing: 0.2,
  sillTrim: true,
  front: {
    lamps: [[0.44, 0.72, 0.5, 0.6]],
    trim: [[-0.34, 0.34, 0.42, 0.56], [-0.5, 0.5, 0.29, 0.37]],
  },
  back: {
    lamps: [[0.42, 0.75, 0.7, 0.8]],
    trim: [[-0.21, 0.21, 0.5, 0.62, 0xd9d8cf], [-0.7, 0.7, 0.36, 0.44, 0x34363d]],
  },
  extras: [
    { type: 'mirrors', at: 0.14, reach: 0.15 },
    { type: 'lip', back: 0.03, chord: 0.16, h: 0.045, span: 0.66, paint: true },
    { type: 'exhaust', x: [0.48], y: 0.3, r: 0.04, out: 0.01 },
  ],
  wheel: { segments: 15, spokes: 5, spokeShare: 0.33, rim: 0.66, dish: 0.035, colour: 0xc3c8cf },
};
