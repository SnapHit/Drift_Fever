/* THE ENVIRONMENT THE WORLD REFLECTS (briefs/COVER-LOOK.md 1, ?look=2).
   Made at load from what the game already draws, no image downloaded:
   the track's own sky (the dome with its sun glow and band, the cloud
   streaks, the stars, the silhouettes on the horizon) is put in a scene
   of its own with what a reflection needs and a picture of the sky
   does not have: the sun as a hot disc (so a clear coat shows a sharp
   highlight), the ground below the horizon at the preset's light (so a
   car's flanks show the road and the dark line of the horizon, as the
   cover's do), and, when the lamps are on, the floodlight banks round
   the venue as bright panels. That scene is drawn into a cube from a
   point at a car's height and filtered for rough and smooth surfaces
   (three.js's PMREM: one sharp level for a clear coat, blurred levels
   for satin trim and asphalt), and the result is the scene's
   environment, which every standard material (the cars, the wet road,
   the water) reflects. Rebuilt only when the track, its time of day or
   the tier changes; never per frame.

   The showroom gets a studio of its own (studioEnvironment): a dark
   room with soft boxes overhead and strip lights either side, the
   classic long reflections down a car's flanks.

   Every number of taste is in ENVMAP. */

export const ENVMAP = {
  SIZE:         { low: 128, high: 256 },   // px per cube face: the sharp level a clear coat sees (the low tier's is a quarter of the memory)
  NEAR:         0.5,
  FAR:          1000,
  EYE:          1.2,         // m above the ground the cube is drawn from: about a car's waist
  INTENSITY:    0.8,         // the scene's environmentIntensity: the cars keep their sky fill too (render/scene.js LOOK.COVER.CAR_HEMI), so a little under one
  /* the sun as the reflections see it: a disc of the preset's sun colour
     at this many times the colour, so a clear coat's highlight is white
     hot; the moon at night, dimmer */
  SUN_GAIN:     { dusk: 5, dawn: 5, night: 5, rain: 0, twilight: 14 },   // dusk and dawn's sun is low and a car drives into it: a hotter one turns a whole flat facet facing it white
  SUN_SIZE:     0.022,       // radians of apparent radius: smaller than the drawn disc, the hot core
  /* the ground below the horizon: the asphalt near, the terrain beyond,
     each its albedo times the preset's light (the sun's height and the
     sky's fill), fading into the haze of the horizon colour */
  GROUND_DROP:  1.2,         // m under the eye the ground is
  ROAD_ALBEDO:  0x3a3b44,    // the asphalt (tracks/mesh.js LOOK.ROAD)
  ROAD_REACH:   14,          // m, the asphalt round the eye
  GROUND_LIGHT: 0.32,        // the light falling on the ground, as a share of sun times its height plus the sky's fill
  HAZE_FROM:    120,         // m: the ground starts to fade into the horizon colour
  HAZE_TO:      600,
  /* the floodlight banks, when the preset's lamps are on: panels in a
     ring at a little above the horizon, each a grid of hot lamps */
  FLOODS:       { count: 9, elev: [5, 16], dist: 160, w: 9, h: 4.5, cols: 4, rows: 2, gap: 0.22, gain: 36, colour: 0xfff2dc, seed: 17 },
  /* the stands and the venue's walls as dark shapes low on the horizon,
     so a reflection has something between the road and the sky */
  STANDS:       { count: 14, dist: 90, h: [9, 20], w: [24, 40], colour: 0x121219, lit: 0x6a6f88, litGain: 0.6 },   // dense, as the look's venue is: a wet road at a grazing angle mirrors these, not the bright sky above them
  /* the studio (the garage's showroom) */
  STUDIO: {
    ROOM:       0x0b0e1a,    // the walls and the floor
    FLOOR:      0x1a1f33,
    /* bright strips with dark between, as a car studio's: overhead, a few long bars; round the room, bands of light at three heights and tall panels. A facet catches a strip or a gap by the way it faces, so faceted paint sparkles instead of going one pale shade. Narrow and hot: a clear coat mirrors a strip by its brightness, while the light it throws on the paint goes by its size, so narrow strips give bright reflections without washing the colour out */
    BARS:       { n: 5, y: 7, len: 14, w: 0.3, gap: 2.6, gain: 3.5 },
    RINGS:      [{ y: 1.4, h: 0.22 }, { y: 2.6, h: 0.26 }, { y: 4.0, h: 0.3 }, { y: 5.8, h: 0.34 }],
    RING:       { r: 10, gain: 12 },
    PANELS:     { n: 8, r: 9, w: 0.28, h: 5.5, y: 3.0, gain: 6 },
    COLOUR:     0xf2f4ff,
    SIZE:       256,
    FLOOR_ENV:  0.3,         // the showroom's floor reflects it this much (its own envMapIntensity)
    LIGHTS:     0.45,        // the showroom's own key, rim and fill at this share with the studio on: its strips light the car as well, and both together wash the paint pale
  },
};

const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const rgb = hex => [lin(((hex >> 16) & 255) / 255), lin(((hex >> 8) & 255) / 255), lin((hex & 255) / 255)];
/* a small seeded generator, so a track's floodlights stand where they stood last time */
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* The light falling on flat ground under a preset, in the renderer's
   linear units: the sun by its height and the sky's fill. */
function groundLight(preset) {
  const el = (preset.sunElev || 30) * Math.PI / 180;
  const sun = rgb(preset.sunColour || 0xffffff).map(c => c * (preset.sun || 1) * Math.max(0, Math.sin(el)));
  const sky = rgb(preset.hemiSky || 0x808080), gnd = rgb(preset.hemiGround || 0x404040);
  const fill = sky.map((c, k) => (c * 0.7 + gnd[k] * 0.3) * (preset.hemi || 1));
  return sun.map((c, k) => (c + fill[k]) * ENVMAP.GROUND_LIGHT);
}

/* A plain unlit material, in linear colour (never tone mapped: the cube
   is a render target, where the renderer applies none). */
function basic(THREE, colour, opts) {
  return new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color().setRGB(colour[0], colour[1], colour[2], THREE.LinearSRGBColorSpace), fog: false, toneMapped: false }, opts || {}));
}

/* The environment for a track: sky is the world's own sky group (env/sky.js,
   its dome, sun, clouds, stars and backdrop), drawn as it is. Returns
   { texture, dispose }. */
export function buildEnvMap(THREE, renderer, o) {
  const E = ENVMAP, preset = o.preset, tierName = o.tierName || 'low';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const own = [];   // what this module made, to dispose
  const keep = mesh => { own.push(mesh.geometry, mesh.material); scene.add(mesh); return mesh; };
  /* the sky, as drawn: shared geometry and materials, lifted so the eye is at the cube's centre */
  const sky = o.sky ? o.sky.clone(true) : null;
  if (sky) { sky.position.set(0, -E.EYE, 0); scene.add(sky); }
  const toSun = (() => { const el = (preset.sunElev || 30) * Math.PI / 180, az = (preset.sunAzim || 0) * Math.PI / 180; return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]; })();
  /* the hot sun */
  const sunGain = E.SUN_GAIN[preset.look || preset.name];
  if (sunGain > 0 && !preset.rain) {
    const R = E.FAR * 0.8, c = rgb(preset.sunDisc || preset.sunColour || 0xffffff).map(v => v * sunGain);
    const disc = keep(new THREE.Mesh(new THREE.CircleGeometry(R * Math.tan(E.SUN_SIZE), 20), basic(THREE, c, { depthWrite: false })));
    disc.position.set(toSun[0] * R, toSun[1] * R, toSun[2] * R); disc.lookAt(0, 0, 0); disc.renderOrder = 2;
  }
  /* the ground: a disc of rings, the asphalt round the eye, the terrain beyond, the haze at the edge */
  {
    const light = groundLight(preset), road = rgb(E.ROAD_ALBEDO), land = rgb((o.theme && o.theme.ground && o.theme.ground[0]) || 0x4f6a2e), haze = rgb(preset.horizon || 0x808080);
    const radii = [0, E.ROAD_REACH * 0.6, E.ROAD_REACH, E.ROAD_REACH * 2, E.HAZE_FROM, (E.HAZE_FROM + E.HAZE_TO) / 2, E.HAZE_TO, E.FAR * 0.95];
    const colourAt = r => {
      const t = Math.max(0, Math.min(1, (r - E.ROAD_REACH) / E.ROAD_REACH)), h = Math.max(0, Math.min(1, (r - E.HAZE_FROM) / (E.HAZE_TO - E.HAZE_FROM)));
      return [0, 1, 2].map(k => { const lit = (road[k] + (land[k] - road[k]) * t) * light[k]; return lit + (haze[k] * 0.55 - lit) * h; });
    };
    const seg = 48, pos = [], col = [];
    for (let i = 0; i + 1 < radii.length; i++) {
      const r0 = radii[i], r1 = radii[i + 1], c0 = colourAt(r0), c1 = colourAt(r1);
      for (let k = 0; k < seg; k++) {
        const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2;
        const p = (r, a) => [Math.cos(a) * r, -E.GROUND_DROP, Math.sin(a) * r];
        const A = p(r0, a0), B = p(r0, a1), C = p(r1, a1), D = p(r1, a0);
        for (const [v, c] of [[A, c0], [C, c1], [B, c0], [A, c0], [D, c1], [C, c1]]) { pos.push(...v); col.push(...c); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    keep(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false, side: THREE.DoubleSide })));
  }
  /* the stands: dark shapes low on the horizon, a lit band along each */
  {
    const S = E.STANDS, r = rng((o.seed >>> 0) + 5), dark = rgb(S.colour), lit = rgb(S.lit).map(v => v * S.litGain * (preset.lamps ? 1.6 : 0.5));
    const pos = [], col = [];
    for (let i = 0; i < S.count; i++) {
      const a = (i + r() * 0.6) / S.count * Math.PI * 2, w = S.w[0] + (S.w[1] - S.w[0]) * r(), h = S.h[0] + (S.h[1] - S.h[0]) * r();
      const cx = Math.cos(a) * S.dist, cz = Math.sin(a) * S.dist, tx = -Math.sin(a) * w / 2, tz = Math.cos(a) * w / 2, y0 = -E.GROUND_DROP, y1 = y0 + h, yb = y0 + h * 0.62;
      const quad = (ya, yb2, ca, cb) => { const A = [cx - tx, ya, cz - tz], B = [cx + tx, ya, cz + tz], C = [cx + tx, yb2, cz + tz], D = [cx - tx, yb2, cz - tz]; for (const [v, c] of [[A, ca], [B, ca], [C, cb], [A, ca], [C, cb], [D, cb]]) { pos.push(...v); col.push(...c); } };
      quad(y0, yb, dark, dark); quad(yb, yb + 0.6, lit, lit); quad(yb + 0.6, y1, dark, dark);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    keep(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false, side: THREE.DoubleSide })));
  }
  /* the floodlight banks, when the lamps are on */
  if (preset.lamps) {
    const F = E.FLOODS, r = rng((o.seed >>> 0) + F.seed), hot = rgb(F.colour).map(v => v * F.gain), back = rgb(0x22242c);
    const pos = [], col = [];
    for (let i = 0; i < F.count; i++) {
      const a = (i + 0.2 + r() * 0.6) / F.count * Math.PI * 2, el = (F.elev[0] + (F.elev[1] - F.elev[0]) * r()) * Math.PI / 180;
      const cx = Math.cos(a) * Math.cos(el) * F.dist, cy = Math.sin(el) * F.dist - E.GROUND_DROP, cz = Math.sin(a) * Math.cos(el) * F.dist;
      const ux = -Math.sin(a), uz = Math.cos(a);                  // across the bank
      const vx = -Math.cos(a) * Math.sin(el), vy = Math.cos(el), vz = -Math.sin(a) * Math.sin(el);   // up the bank, square to the eye
      const put = (u0, u1, v0, v1, c, lift) => {
        const P = (u, v) => [cx + ux * u + vx * v - Math.cos(a) * lift, cy + vy * v, cz + uz * u + vz * v - Math.sin(a) * lift];
        const A = P(u0, v0), B = P(u1, v0), C = P(u1, v1), D = P(u0, v1);
        for (const v of [A, B, C, A, C, D]) { pos.push(...v); col.push(...c); }
      };
      put(-F.w / 2, F.w / 2, -F.h / 2, F.h / 2, back, 0);
      const cw = F.w / F.cols, rh = F.h / F.rows;
      for (let x = 0; x < F.cols; x++) for (let y = 0; y < F.rows; y++) {
        const u0 = -F.w / 2 + x * cw + cw * F.gap / 2, v0 = -F.h / 2 + y * rh + rh * F.gap / 2;
        put(u0, u0 + cw * (1 - F.gap), v0, v0 + rh * (1 - F.gap), hot, 0.5);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    keep(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false, side: THREE.DoubleSide, depthTest: false }))).renderOrder = 3;
  }
  const generator = o.generator || new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0, E.NEAR, E.FAR, { size: E.SIZE[tierName] || E.SIZE.low });
  for (const d of own) d.dispose();
  if (!o.generator) generator.dispose();
  return { texture: target.texture, target, dispose() { target.dispose(); } };
}

/* The showroom's studio: a dark room, a soft box overhead, strip lights
   either side and behind. Returns { texture, dispose }. */
export function studioEnvironment(THREE, renderer) {
  const S = ENVMAP.STUDIO;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const own = [];
  const add = (geo, colour, x, y, z, rx, ry) => { const m = new THREE.Mesh(geo, basic(THREE, colour, { side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); scene.add(m); own.push(geo, m.material); return m; };
  add(new THREE.SphereGeometry(30, 24, 12), rgb(S.ROOM), 0, 0, 0);
  add(new THREE.CircleGeometry(29, 32), rgb(S.FLOOR).map(v => v * 0.6), 0, -1, 0, -Math.PI / 2);
  const hot = gain => rgb(S.COLOUR).map(v => v * gain);
  for (let i = 0; i < S.BARS.n; i++) add(new THREE.PlaneGeometry(S.BARS.w, S.BARS.len), hot(S.BARS.gain), (i - (S.BARS.n - 1) / 2) * S.BARS.gap, S.BARS.y, 0, Math.PI / 2);
  for (const r of S.RINGS) add(new THREE.CylinderGeometry(S.RING.r, S.RING.r, r.h, 48, 1, true), hot(S.RING.gain), 0, r.y, 0);
  for (let i = 0; i < S.PANELS.n; i++) { const a = (i + 0.5) / S.PANELS.n * Math.PI * 2, m = add(new THREE.PlaneGeometry(S.PANELS.w, S.PANELS.h), hot(S.PANELS.gain), Math.sin(a) * S.PANELS.r, S.PANELS.y, Math.cos(a) * S.PANELS.r); m.lookAt(0, S.PANELS.y, 0); }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0, 0.1, 100, { size: S.SIZE });
  for (const d of own) d.dispose();
  generator.dispose();
  return { texture: target.texture, target, dispose() { target.dispose(); } };
}
