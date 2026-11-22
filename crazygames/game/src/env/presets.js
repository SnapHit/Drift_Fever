/* TIME OF DAY AND WEATHER. Four presets: dusk (the default and the
   most common), night, dawn and rain. A preset is chosen per track by
   its seed, and ?preset= overrides it. Every number of light and
   colour lives here, in the renderer's physical units: the sun is a
   directional light, the sky and ground a hemisphere light, and the
   sky dome, the fog and the haze share the same horizon colour so the
   terrain fades into the sky at distance.

   Sun elevation is kept above about 12 degrees in daylight presets: a
   sun on the very horizon throws shadows longer than the track is
   wide, and the road must stay readable. */

export const PRESETS = {
  dusk: {
    name: 'dusk',
    zenith:       0x1b2347,     // the sky overhead
    horizon:      0xf0885a,     // the sky at the horizon, also the fog
    band:         0x6a4a7a,     // the sky between the two, a purple band
    glow:         0xffb070,     // the glow around the sun
    sunDisc:      0xfff1c8,
    sunElev:      18,           // degrees above the horizon
    sunAzim:      215,          // degrees, where the sun sits round the compass
    sun:          5.0,          // the key light, warm (a Lambert surface shows albedo times this over pi)
    sunColour:    0xffc48a,
    hemiSky:      0x7f86c8,     // the cool fill from the sky
    hemiGround:   0x5a3a2a,
    hemi:         2.2,
    fogNear:      90,
    fogFar:       620,
    exposure:     1.0,
    stars:        0,
    lamps:        false,        // lamp posts and towers lit
    headlights:   false,
    wet:          false,
    rain:         false,
    edgeGlow:     0.6,          // emission on the road's paint: the edge line stays the brightest thing under any light
    smoke:        0xd9c8c0,     // tyre smoke, lit by the sun
    windX:        1.2, windZ: 0.4,   // m/s, the way the smoke drifts
    cloud:        0.6,          // how much of the sky has cloud streaks
  },
  night: {
    name: 'night',
    zenith:       0x05070f,
    horizon:      0x1c2440,
    band:         0x0e1430,
    glow:         0x3a4a80,
    sunDisc:      0xdfe6ff,     // the moon
    sunElev:      38,
    sunAzim:      150,
    sun:          1.0,          // moonlight, cool, strong enough that the car reads
    sunColour:    0x8fa4ff,
    hemiSky:      0x2a3560,
    hemiGround:   0x101018,
    hemi:         0.95,
    fogNear:      70,
    fogFar:       420,
    exposure:     1.0,
    stars:        1,
    lamps:        true,
    headlights:   true,
    wet:          false,
    rain:         false,
    edgeGlow:     0.75,
    smoke:        0x6f7490,
    windX:        0.8, windZ: 0.3,
    cloud:        0.2,
  },
  dawn: {
    name: 'dawn',
    zenith:       0x5a74b8,
    horizon:      0xffd2a0,
    band:         0xd98aa0,
    glow:         0xfff0c0,
    sunDisc:      0xfffaf0,
    sunElev:      12,
    sunAzim:      110,
    sun:          4.6,
    sunColour:    0xffe2b8,
    hemiSky:      0x9fb0e8,
    hemiGround:   0x5a4a40,
    hemi:         1.9,
    fogNear:      60,
    fogFar:       480,
    exposure:     1.0,
    stars:        0,
    lamps:        false,
    headlights:   false,
    wet:          false,
    rain:         false,
    edgeGlow:     0.6,
    smoke:        0xfff0e0,
    windX:        -0.6, windZ: 0.8,
    cloud:        0.8,
  },
  rain: {
    name: 'rain',
    zenith:       0x2a3140,
    horizon:      0x6a7382,
    band:         0x4a5262,
    glow:         0x8a92a2,
    sunDisc:      0x8a92a2,     // no disc shows through the cloud
    sunElev:      45,
    sunAzim:      200,
    sun:          1.1,          // soft, overcast
    sunColour:    0xd8e0f0,
    hemiSky:      0x8a94a8,
    hemiGround:   0x3a3a40,
    hemi:         2.6,
    fogNear:      30,
    fogFar:       300,
    exposure:     1.0,
    stars:        0,
    lamps:        true,
    headlights:   true,
    wet:          true,
    rain:         true,
    edgeGlow:     0.6,
    smoke:        0x8a9098,
    windX:        3.0, windZ: 1.0,
    cloud:        1.0,
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);

/* How often each preset comes up over the seeds: dusk is the look. */
const WEIGHTS = { dusk: 5, night: 2, dawn: 2, rain: 1 };

export function presetFor(seed, override) {
  if (override && PRESETS[override]) return PRESETS[override];
  let h = ((seed >>> 0) * 2654435761 + 0x3c6ef372) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  const total = PRESET_NAMES.reduce((s, k) => s + WEIGHTS[k], 0);
  let pick = (h % 1000) / 1000 * total;
  for (const k of PRESET_NAMES) { pick -= WEIGHTS[k]; if (pick < 0) return PRESETS[k]; }
  return PRESETS.dusk;
}

/* The sun's direction as a unit vector from the elevation and azimuth. */
export function sunDirection(p) {
  const el = p.sunElev * Math.PI / 180, az = p.sunAzim * Math.PI / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}

/* THE SPECTACLE ROUND'S PRESETS (briefs/SPECTACLE.md 2): what each
   preset becomes with the round on, laid over the values above (with
   ?fx=0 the presets are exactly as above). Night is no longer nearly
   black: a brighter moon and sky fill so the world reads as shapes,
   not a silhouette, a city glow on the horizon, the road's paint
   glowing harder, the asphalt giving back a little baked moonlight
   (roadGlow) so it reads between the pools, and the headlights reaching further (LOOK.HEADLIGHT_SHOW
   in render/scene.js); the lamps and their pools are env/dressing.js.
   Dusk and dawn get a sun worth looking at: a bigger disc and a wider,
   stronger glow (sunSize, glowPower and glowGain, read by env/sky.js), and
   a colour grade on the high tier (grade: lift, gain, saturation and a
   vignette, through the bloom's post pass). */
export const PRESET_SHOW = {
  dusk:  { sunSize: 0.075, glowPower: 3.5, glowGain: 1.35, grade: { lift: [0.02, 0.005, 0.03], gain: [1.06, 1.0, 0.94], saturation: 1.12, vignette: 0.32 } },
  night: { roadGlow: 0.15, hemi: 1.75, hemiSky: 0x3c4c8a, hemiGround: 0x1a1a26, sun: 1.7, sunColour: 0x9fb2ff, horizon: 0x2a3866, band: 0x152048, glow: 0x5a6aa8, exposure: 1.12, fogFar: 520, edgeGlow: 1.05, sunSize: 0.05, glowPower: 5, grade: { lift: [0.0, 0.01, 0.03], gain: [0.98, 1.0, 1.06], saturation: 1.08, vignette: 0.38 } },
  dawn:  { sunSize: 0.08, glowPower: 3.2, glowGain: 1.3, grade: { lift: [0.03, 0.015, 0.02], gain: [1.05, 1.0, 0.97], saturation: 1.1, vignette: 0.28 } },
  rain:  { hemi: 2.8, edgeGlow: 0.75, grade: { lift: [0.0, 0.005, 0.015], gain: [0.97, 1.0, 1.04], saturation: 0.95, vignette: 0.34 } },
};
export function presetShow(p) { const o = PRESET_SHOW[p.name]; return o ? { ...p, ...o } : p; }

/* THE COVER LOOK'S PRESETS (briefs/COVER-LOOK.md 3 and 5, ?look=2):
   what each preset becomes with the switch on, laid over the spectacle
   round's, plus one more. Night is wet, as the brief asks (a wet track
   with the lights mirrored in it); dusk and dawn stay dry.

   TWILIGHT is the cover's floodlit dusk: the sun just down behind a
   red and orange band, the sky deep violet overhead, the floodlights
   on and the track wet. The key light is the floodlights' (high and
   cool white, so the shadows stay short), not the sun's, so the sky's
   glow has its own direction (glowElev, glowAzim, read by env/sky.js)
   and there is no disc. Career track 1 (seed FIRST_SEED) and the
   title's backdrop are drawn in it on both tiers; ?preset=twilight
   asks for it anywhere. Every other track keeps its own preset. */
export const TWILIGHT = {
  ...PRESETS.dusk,
  name:         'twilight',
  zenith:       0x0f0c26,     // deep violet overhead
  band:         0x4c2152,     // a purple band between
  horizon:      0xd9582e,     // a red and orange horizon, the sun just gone
  glow:         0xff9a48,     // brightest where it went down
  fog:          0x4a2740,     // the haze over the far ground: dusky, so the land does not glow orange
  sunDisc:      null,         // no disc: the sun is down
  glowElev:     -1,           // degrees, where the glow sits
  glowAzim:     205,
  glowPower:    2.2,
  glowGain:     1.7,
  sunElev:      62,           // the key light: the floodlights, high
  sunAzim:      150,
  sun:          1.35,
  sunColour:    0xe6ecff,     // cool white, as floodlights are
  hemiSky:      0x5a4a9a,     // the violet sky's fill
  hemiGround:   0x2a1a26,
  hemi:         1.05,
  fogNear:      80,
  fogFar:       560,
  exposure:     1.05,
  stars:        0.35,
  lamps:        true,
  headlights:   true,
  wet:          true,
  rain:         false,
  edgeGlow:     0.9,
  roadGlow:     0.06,         // the asphalt's own baked light between the pools (as night's)
  smoke:        0xb8b0c8,
  cloud:        0.7,
  windX:        1.0, windZ: 0.35,
  grade:        { lift: [0.02, 0.0, 0.04], gain: [1.06, 0.99, 1.0], saturation: 1.14, vignette: 0.34 },
};
export const PRESET_LOOK = {
  night: { wet: true },
  rain:  {},
  dusk:  {},
  dawn:  {},
};
export const FIRST_SEED = 1101;   // career track 1, First slide (loop/modes.js CAREER[0])
/* The preset a track is drawn in with the switch on: twilight for career
   track 1 and the title's backdrop (title: true) unless something names
   another, else the track's own with the look's changes. forced: the
   preset a track or the address names, which always wins. */
export function presetLook(p, seed, forced, title) {
  if (forced === 'twilight' || (!forced && (title || (seed >>> 0) === FIRST_SEED))) return TWILIGHT;
  const o = PRESET_LOOK[p.name];
  return o ? { ...p, ...o } : p;
}
