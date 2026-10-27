/* THE GREYBOX WORLD. Stage 2 of Drift Fever: CrazyGames edition.

   One simulation, two renderers. This is the second one: the road, the
   terrain, the hazards, the jumps, the gates, the signs, the skyline and
   the cars, in real 3D on three.js, drawn in plain shapes from the
   simulation's own numbers every frame. It reads the simulation through
   SIM and writes nothing back except the two ledgers the original's draw
   passes drained (wreckN and contactN) and the shake the simulation hands
   it through addShake, exactly as the original's renderer did.

   THE WORLD IS BUILT RELATIVE TO THE CAR EVERY FRAME, as the original's
   was. The frame's origin is the car's position along the road, its Z
   axis is the road's heading there, and everything up the road is placed
   by walking the segments' curvature from that point. The camera then
   sits at one fixed place behind and above the car and never has to be
   smoothed: the road turns under it. Curvature in the simulation is a
   sideways slide per segment, not a heading, so CURVE_HEADING below says
   how much of a real turn one unit of it draws as; see the report.

   Every tunable lives in WORLD at the top. Nothing in the update is a
   bare number. */
import * as THREE from 'three';

export const WORLD = {
  /* The chase camera. Behind the car along the road, above the ground
     under the car, pitched down. One rig per orientation, because a true
     perspective cannot be the original's stretched one in both: the
     original showed the road edges beside the car (4245 units either side
     at the car's depth), put the ground under the car at 58 per cent of
     the screen height and the horizon at 32 per cent. These rigs are
     solved from those three numbers, then judged by the stage 2
     measurements: seconds of road visible ahead at top speed, and no
     hazard or jump seen later than the original's reference camera. */
  /* Measured over the visibility probe's drives (probes/visibility.js):
     the rig solved for the original's layout (height 4450 in portrait) saw
     less road than the original past crests on 4 of 114 frames; this one,
     higher and steeper, never did. The horizon sits at 27 per cent of the
     height in portrait and 14 in landscape, the car at 64 and 78. */
  /* Lowered 28 October 2026, after play: the rigs above saw well past
     crests but felt slow, because how fast the ground seems to pass goes
     roughly as speed over camera height, and these sat nearly three times
     higher than the live game's 2200. The rigs below are solved to make
     the road surface at the car move down the screen about as fast as the
     live game's does (probes/speed.js), while still showing both road
     edges beside the car in portrait. ?tune=1 adjusts them live. The
     earlier rigs: portrait fov 100, back 5594, height 6038, pitch 28.7;
     landscape fov 66, back 5600, height 5600, pitch 25. */
  PORTRAIT:  { fov: 110, back: 2900, height: 2900, pitch: 18.0 },   // vertical field of view, units behind the car, above its ground, degrees down
  LANDSCAPE: { fov: 62,  back: 4200, height: 2000, pitch: 10.0 },
  CAM_NEAR:             120,
  CAM_FAR:           140000,
  /* The camera sits behind the car itself, not behind the simulation's
     cameraX. cameraX is carX times CAMERA_FOLLOW (0.55): right for the
     original's flat picture, where following the car fully shoved the
     whole screen sideways, but in 3D it left the car sliding off centre
     and the camera catching up a beat later, a constant slow sway. */
  CAM_FOLLOW_X:        1.00,     // share of the car's carX the camera follows across the road
  CAM_X_LAG:           0.05,     // seconds of smoothing on that, just enough to take out jitter
  CAM_X_SNAP:          2000,     // a jump bigger than this (a respawn, a new run) is taken at once
  CAM_LIFT:            0.62,     // share of the car's height the camera follows in a jump, per camLift
  /* How much real turn one unit of post scale curvature draws as, in
     radians of heading per segment. 1/SEGMENT_LENGTH would make the near
     field match the original's slide exactly and a hard corner a 150
     degree hairpin; measured over the 28 days this keeps every corner
     under 100 degrees and no road overlapping itself. */
  CURVE_HEADING:    1 / 1000,
  DRAW_SEGMENTS:        200,     // segments of road ahead, the original's draw distance
  BEHIND_SEGMENTS:       34,     // and behind the car, so the camera never looks at a void
  /* The road's cross section, in road half widths. */
  LIP:                 0.13,     // the bright lip, EDGE_LIP_FRACTION
  LANE_HALF:           0.02,     // half width of the centre dash, LANE_DASH_FRACTION
  LANE_ON:                2,     // segments of dash on
  LANE_OFF:               2,     // and off
  SLAB_DEPTH:           640,     // ROAD_THICKNESS
  SLAB_FLARE:           880,     // ROAD_FLARE, how much wider the slab is at the bottom
  TERRAIN_NEAR:         1.0,     // terrain starts this many half widths past the lip
  TERRAIN_REACH:       14.0,     // and reaches this far out
  TERRAIN_DROP:        2600,     // dropping this far below the road by the reach
  TERRAIN_RIPPLE:       420,     // and rippling by this much
  TYRE_MARK_HALF:     0.028,     // TYRE_MARK_WIDTH, as a share of the half width
  TYRE_MARK_LIFT:         3,     // units above the surface
  PYLON_HEIGHT:         640,
  PYLON_WIDTH:           85,
  PYLON_OUT:           0.06,     // beyond the lip, in half widths
  HAZARD_HEIGHT:        900,
  WARN_LIFT:              2,     // the warning band's height above the surface
  CHEVRON_LIFT:           2,
  ROUGH_LIFT:             1,
  GATE_HEIGHT:         1500,     // CHECKPOINT_HEIGHT
  GATE_POST:            260,     // CHECKPOINT_POST
  GATE_SWEEP_SEGMENTS:  260,
  FINISH_HEIGHT:       3800,
  FINISH_POST:          320,
  FINISH_BANNER:       0.20,
  SKYLINE_DISTANCE:   90000,     // how far out the city stands
  SKYLINE_SPREAD:      1.35,     // radians of horizon it covers, centred ahead at the start
  SKYLINE_WIDTH:       4200,
  SKYLINE_HEIGHT_MIN:  3000,
  SKYLINE_HEIGHT_MAX: 22000,
  FOG_NEAR:            0.30,     // as a share of the draw distance
  FOG_FAR:             1.00,
  /* Cars. The player's block out body: a hull, a cabin, four wheels and a
     light bar, in the original's dimensions. */
  CAR_LIGHT_HALF:      0.74,
  CAR_LIGHT_Y:         0.62,
  CAR_LIGHT_THICK:     0.10,
  CAR_CABIN_WIDTH:     0.74,     // as a share of the body width
  CAR_CABIN_LENGTH:    0.46,
  CAR_CABIN_HEIGHT:    0.70,     // as a share of the body height
  CAR_CABIN_BACK:      0.06,     // cabin centre behind the body centre, as a share of the length
  GHOST_ALPHA:         0.42,
  /* Particles. Smoke comes off the rear wheels and drifts back along the
     road; debris and sparks fly off cars; fireworks go up over the
     finish. All in road coordinates, so they stay put as the frame moves. */
  SMOKE_MAX:             70,
  SMOKE_SIZE:           170,
  SMOKE_GROWTH:         900,     // units per second
  SMOKE_BACK:          2600,     // units per second, back along the road
  SMOKE_RISE:           700,
  DEBRIS_MAX:           160,
  DEBRIS_SIZE:          110,
  DEBRIS_SPEED:        5200,
  DEBRIS_GRAVITY:     14000,
  DEBRIS_DRAG:         1.3,
  DEBRIS_TIME:         1.10,     // EXPLODE_TIME
  SPARK_MAX:             96,
  SPARK_SIZE:            45,
  SPARK_SPEED:         2600,
  SPARK_TIME:          0.42,     // NPC_SPARK_TIME
  SPARK_COUNT:           10,
  WRECK_PARTS:           16,     // NPC_WRECK_PARTS
  GRIT_PARTS:            14,
  FIREWORK_MAX:         240,
  FIREWORK_RISE:      24000,     // units per second, up
  FIREWORK_SPARKS:       18,     // FIREWORK_SPARKS
  FIREWORK_SPARK_SPEED: 9000,
  FIREWORK_LIFE:       1.20,     // FIREWORK_LIFE
  FIREWORK_GRAVITY:    9000,
  FIREWORK_AHEAD:     16000,     // where the shells stand, up the road from the car
  FIREWORK_SPREAD:    12000,
  FIREWORK_SIZE:        160,
  /* The quality tiers. The low tier is the one that must hold 60fps on
     WebGL 2 on a five year old Chromebook, so it caps the device pixel
     ratio and keeps the draw distance. Selection is simple at this stage:
     the fallback backend or four cores or fewer is the low tier. */
  TIERS: {
    low:  { pixelRatio: 1.0, drawSegments: 200, antialias: false },
    high: { pixelRatio: 2.0, drawSegments: 200, antialias: false },
  },
  LOW_TIER_CORES:         4,
};

const SPRITE = {
  // id to a block, by the sprite registry's sizes: [width key or world units, height, kind]
  gantry: { w: 'SIGN_GANTRY_SPAN', spansRoad: true, h: 'SIGN_GANTRY_HIGH' },
  marker: { w: 'SIGN_MARKER_WIDE', h: 'SIGN_MARKER_HIGH' },
  post:   { w: 'SIGN_POST_WIDE', h: 'SIGN_POST_HIGH' },
  tree:   [{ w: 'TREE_BROAD_WIDE', h: 'TREE_BROAD_HIGH' }, { w: 'TREE_CONIFER_WIDE', h: 'TREE_CONIFER_HIGH' }, { w: 'TREE_SCRUB_WIDE', h: 'TREE_SCRUB_HIGH' }],
  house:  [{ w: 'HOUSE_COTTAGE_WIDE', h: 'HOUSE_COTTAGE_HIGH' }, { w: 'HOUSE_TWO_WIDE', h: 'HOUSE_TWO_HIGH' }, { w: 'HOUSE_BARN_WIDE', h: 'HOUSE_BARN_HIGH' }],
  mast:   { w: 'MAST_WIDE', h: 'MAST_HIGH' },
  tower:  { w: 'TOWER_WIDE', h: 'TOWER_HIGH' },
};

const _c = new THREE.Color();
function rgb(css) { _c.set(cssColour(css)); return _c; }
function cssColour(css) {
  // The palette holds '#rrggbb', 'rgb(...)', 'rgba(...)' and bare 'r,g,b' triples.
  if (typeof css !== 'string') return '#ff00ff';
  if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(css)) return 'rgb(' + css + ')';
  if (css.startsWith('rgba')) { const m = css.match(/rgba\(([^,]+),([^,]+),([^,]+)/); return m ? 'rgb(' + m[1] + ',' + m[2] + ',' + m[3] + ')' : '#ff00ff'; }
  return css;
}

export function createWorld(SIM, canvas, opts) {
  const FEEL = SIM.FEEL;
  const L = FEEL.SEGMENT_LENGTH;
  const W = WORLD;
  const options = opts || {};
  const COLOUR = () => SIM.COLOUR;      // the chrome's palette, once the host has handed it over

  /* ---- the renderer and the tier ---- */
  const forceWebGL = options.renderer === 'webgl2';
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL, alpha: false, powerPreference: 'high-performance' });
  let backend = 'pending';
  let tier = 'low';
  const ready = renderer.init().then(() => {
    backend = renderer.backend && renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 0;
    tier = options.tier || ((backend === 'webgl2' || (cores > 0 && cores <= W.LOW_TIER_CORES)) ? 'low' : 'high');
    applyTier();
  });
  function applyTier() {
    const t = W.TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.pixelRatio));
    renderer.setSize(view.w, view.h, false);
  }

  /* TWO LAYERS, AS THE ORIGINAL PAINTED THEM. The original drew the
     terrain and the roadside scenery BEFORE the road, so that by
     construction nothing beside the road could hide the road ahead, a
     hazard, a gate or a car; the road, the things on it and the cars came
     after, in painter's order, so hills still hide what is behind them.
     Here the ground layer (terrain, slab walls, roadside blocks, the
     skyline) is drawn first, the depth buffer is cleared, and the road
     layer (road, marks, paint, gantries, ramps, hazards, gates, cars,
     particles) is drawn over it, depth tested among itself. Measured
     before this: 53 of 2,245 hazards and jumps were hidden by roadside
     blocks near the horizon from a high camera, which the original never
     does. */
  const scene = new THREE.Scene();          // the road layer
  const under = new THREE.Scene();          // the ground layer
  const camera = new THREE.PerspectiveCamera(W.PORTRAIT.fov, 1, W.CAM_NEAR, W.CAM_FAR);
  scene.add(camera);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-0.4, 1, -0.35);
  scene.add(sun);
  under.add(hemi.clone()); const sun2 = sun.clone(); under.add(sun2);
  scene.fog = new THREE.Fog(0x000000, 1, 2);
  under.fog = scene.fog;
  renderer.autoClear = false;
  const view = { w: 1, h: 1 };

  /* ---- the frame's road table ----
     Boundaries from BEHIND_SEGMENTS behind the car's segment to
     DRAW_SEGMENTS ahead: plan position, heading, height, half width. The
     car's own position is the origin and heading zero. */
  const MAXB = W.DRAW_SEGMENTS + W.BEHIND_SEGMENTS + 4;
  const bX = new Float64Array(MAXB), bZ = new Float64Array(MAXB), bH = new Float64Array(MAXB), bY = new Float64Array(MAXB), bW = new Float64Array(MAXB), bIdx = new Int32Array(MAXB), bOk = new Uint8Array(MAXB);
  let bFirst = 0, bCount = 0, carIdx = 0, carFrac = 0, carGroundY = 0, carS = 0, absHeading = 0, lastCarS = -1, lastSeed = null, lastState = -1;
  function segHeight(i) { return SIM.segHeight(i) + (i === probeBump.seg ? probeBump.dy : 0); }
  /* The simulation trims the road behind the camera's segment, about
     twenty segments behind the car, and the rig looks further back than
     that at the bottom of the screen. Segments are remembered as they go
     by, read only, so the road under the camera is still there. */
  const SEG_CACHE = 128;
  const segCache = new Array(SEG_CACHE).fill(null);
  function segAt(i) {
    const s = SIM.segAt(i);
    if (s) { segCache[((i % SEG_CACHE) + SEG_CACHE) % SEG_CACHE] = s; return s; }
    const c = segCache[((i % SEG_CACHE) + SEG_CACHE) % SEG_CACHE];
    return c && c.index === i ? c : undefined;
  }
  function buildTable() {
    carS = SIM.position + FEEL.CAMERA_DISTANCE;
    carIdx = Math.floor(carS / L);
    carFrac = (carS - carIdx * L) / L;
    const h0 = segHeight(carIdx), h1 = segHeight(carIdx + 1);
    carGroundY = h0 + (h1 - h0) * carFrac;
    const cs = SIM.curveScale, K = W.CURVE_HEADING;
    bFirst = carIdx - W.BEHIND_SEGMENTS;
    bCount = 0;
    // The absolute heading, for the skyline: integrate the segments the car crossed.
    const seed = SIM.lastSeed, st = SIM.state;
    if (lastCarS < 0 || carS < lastCarS || seed !== lastSeed || (st === SIM.DRIVING && lastState !== SIM.DRIVING && SIM.position < L * 4)) { absHeading = 0; }
    else {
      for (let i = Math.floor(lastCarS / L); i < carIdx; i++) { const s = segAt(i); if (s) absHeading += s.curve * cs * K; }
    }
    lastCarS = carS; lastSeed = seed; lastState = st;
    /* Forward from the car: the car sits at fraction carFrac of segment
       carIdx, heading 0. In three.js a camera looks down its own -Z, so the
       road runs toward -Z, +X is the player's right and a positive heading
       is a turn to the right: forward is (sin th, -cos th), right is
       (cos th, sin th). */
    const segCar = segAt(carIdx);
    const cCar = segCar ? segCar.curve * cs * K : 0;
    // boundary carIdx + 1 is (1 - carFrac) of a segment ahead
    let x = 0, z = 0, th = 0;
    const ahead = [];
    {
      const d = (1 - carFrac);
      const thMid = th + cCar * d / 2;
      x += Math.sin(thMid) * L * d; z -= Math.cos(thMid) * L * d; th += cCar * d;
      ahead.push([x, z, th]);
      for (let i = carIdx + 1; i <= carIdx + W.DRAW_SEGMENTS + 2; i++) {
        const s = segAt(i);
        if (!s) break;
        const c = s.curve * cs * K;
        const thMid2 = th + c / 2;
        x += Math.sin(thMid2) * L; z -= Math.cos(thMid2) * L; th += c;
        ahead.push([x, z, th]);
      }
    }
    // Backward from the car to boundary carIdx: carFrac of a segment behind.
    const back = [];
    {
      let bx = 0, bz = 0, bth = 0;
      const d = carFrac;
      const thMid = bth - cCar * d / 2;
      bx -= Math.sin(thMid) * L * d; bz += Math.cos(thMid) * L * d; bth -= cCar * d;
      back.push([bx, bz, bth]);
      for (let i = carIdx - 1; i >= bFirst; i--) {
        const s = segAt(i);
        const c = s ? s.curve * cs * K : 0;
        const thMid2 = bth - c / 2;
        bx -= Math.sin(thMid2) * L; bz += Math.cos(thMid2) * L; bth -= c;
        back.push([bx, bz, bth]);
      }
    }
    // Lay them out: boundary k = bFirst + n
    let n = 0;
    for (let i = back.length - 1; i >= 0; i--) { const idx = carIdx - i; const b = back[i]; bIdx[n] = idx; bX[n] = b[0]; bZ[n] = b[1]; bH[n] = b[2]; bY[n] = segHeight(idx); const s = segAt(idx); bW[n] = s ? s.hw : FEEL.ROAD_HALF_WIDTH_BASE; bOk[n] = s ? 1 : 0; n++; }
    for (let i = 0; i < ahead.length; i++) { const idx = carIdx + 1 + i; const b = ahead[i]; bIdx[n] = idx; bX[n] = b[0]; bZ[n] = b[1]; bH[n] = b[2]; bY[n] = segHeight(idx); const s = segAt(idx); bW[n] = s ? s.hw : bW[n - 1]; bOk[n] = s ? 1 : 0; n++; }
    bCount = n;
  }
  /* A point on or beside the road: along-road world units s, lateral
     world units x (positive right), height y above the surface. */
  const P = new THREE.Vector3();
  function roadPoint(out, s, x, y) {
    const k = Math.floor(s / L);
    const f = (s - k * L) / L;
    let n = k - bFirst;
    if (n < 0) n = 0; else if (n > bCount - 2) n = bCount - 2;
    const n1 = n + 1;
    const th = bH[n] + (bH[n1] - bH[n]) * f;
    const px = bX[n] + (bX[n1] - bX[n]) * f, pz = bZ[n] + (bZ[n1] - bZ[n]) * f, py = bY[n] + (bY[n1] - bY[n]) * f;
    const cx = Math.cos(th), sx = Math.sin(th);
    out.x = px + cx * x; out.z = pz + sx * x; out.y = py + y;
    return out;
  }
  function headingAt(s) { const k = Math.floor(s / L); const f = (s - k * L) / L; let n = k - bFirst; if (n < 0) n = 0; else if (n > bCount - 2) n = bCount - 2; return bH[n] + (bH[n + 1] - bH[n]) * f; }
  function hwAt(s) { const k = Math.floor(s / L); let n = k - bFirst; if (n < 0) n = 0; else if (n > bCount - 1) n = bCount - 1; return bW[n]; }

  /* ---- dynamic strips ----
     A strip is a pool of quads rewritten every frame: positions and flat
     colours, six vertices a quad. */
  function makeStrip(maxQuads, material) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(maxQuads * 18), col = new Float32Array(maxQuads * 18);
    const pa = new THREE.BufferAttribute(pos, 3), ca = new THREE.BufferAttribute(col, 3);
    pa.setUsage(THREE.DynamicDrawUsage); ca.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pa); geo.setAttribute('color', ca);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    const strip = { mesh, pos, col, n: 0, max: maxQuads, pa, ca, geo, tags: new Array(maxQuads).fill(null), tag: null };
    strip.begin = () => { strip.n = 0; strip.tag = null; };
    strip.quad = (a, b, c, d, colour) => {
      if (strip.n >= strip.max) return;
      strip.tags[strip.n] = strip.tag;
      const o = strip.n * 18;
      const p = strip.pos, q = strip.col;
      // a b c d is near left, near right, far right, far left for a flat quad
      // seen from above, with the road running toward -Z: anticlockwise from
      // above, so the face shows upward. Triangles a b c and a c d.
      p[o] = a.x; p[o + 1] = a.y; p[o + 2] = a.z; p[o + 3] = b.x; p[o + 4] = b.y; p[o + 5] = b.z; p[o + 6] = c.x; p[o + 7] = c.y; p[o + 8] = c.z;
      p[o + 9] = a.x; p[o + 10] = a.y; p[o + 11] = a.z; p[o + 12] = c.x; p[o + 13] = c.y; p[o + 14] = c.z; p[o + 15] = d.x; p[o + 16] = d.y; p[o + 17] = d.z;
      for (let i = 0; i < 6; i++) { q[o + i * 3] = colour.r; q[o + i * 3 + 1] = colour.g; q[o + i * 3 + 2] = colour.b; }
      strip.n++;
    };
    strip.end = () => {
      // degenerate the rest, so what is not drawn this frame has no area
      const used = strip.n * 18;
      strip.pos.fill(0, used);
      strip.pa.needsUpdate = true; strip.ca.needsUpdate = true;
      strip.geo.setDrawRange(0, strip.n * 6);
    };
    return strip;
  }
  const unlit = new THREE.MeshBasicMaterial({ vertexColors: true });
  const unlitBoth = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const litBoth = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const SEGS = W.DRAW_SEGMENTS + W.BEHIND_SEGMENTS + 2;
  const road = makeStrip(SEGS * 6, unlit);          // lip, shoulder, surface, shoulder, lip, dash
  const marks = makeStrip(SEGS * 2, unlit);         // tyre marks
  const paint = makeStrip(SEGS * 2 + 80, unlitBoth); // warnings, rough, chevrons, finish line
  const walls = makeStrip(SEGS * 2, litBoth);       // slab sides
  const terrain = makeStrip(SEGS * 4, lit);         // two bands a side
  const blocks = makeStrip(1200, litBoth);          // on the road: hazards, ramps, gates, gantries: boxes, five quads each
  const scenery = makeStrip(2600, litBoth);         // beside the road: trees, houses, masts, towers, markers, posts, pylons
  const city = makeStrip(200, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));   // the skyline, beyond the fog
  under.add(terrain.mesh, walls.mesh, scenery.mesh, city.mesh);
  scene.add(road.mesh, marks.mesh, paint.mesh, blocks.mesh);
  marks.mesh.renderOrder = 1; paint.mesh.renderOrder = 2;

  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), D = new THREE.Vector3();
  const E = new THREE.Vector3(), F = new THREE.Vector3(), G = new THREE.Vector3(), Hh = new THREE.Vector3();
  const col = new THREE.Color(), col2 = new THREE.Color();
  /* An axis aligned box in road coordinates: centred at along s, lateral
     x, from height y0 to y1, half width hx and half length hs, yawed by
     yaw about its vertical axis. Six quads. */
  function box(strip, s, x, y0, y1, hx, hs, yaw, top, side, front) {
    const th = headingAt(s) + (yaw || 0);
    const cx = Math.cos(th), sx = Math.sin(th);
    roadPoint(P, s, x, 0);
    const baseY = P.y;
    const corner = (out, dx, ds, y) => { out.x = P.x + cx * dx + sx * ds; out.z = P.z + sx * dx - cx * ds; out.y = baseY + y; return out; };
    // bottom corners a b c d (near left, near right, far right, far left), top e f g h
    corner(A, -hx, -hs, y0); corner(B, hx, -hs, y0); corner(C, hx, hs, y0); corner(D, -hx, hs, y0);
    corner(E, -hx, -hs, y1); corner(F, hx, -hs, y1); corner(G, hx, hs, y1); corner(Hh, -hx, hs, y1);
    strip.quad(E, Hh, G, F, top);                    // top
    strip.quad(A, B, F, E, front || side);            // near face (faces the camera)
    strip.quad(D, Hh, G, C, front || side);           // far face
    strip.quad(A, E, Hh, D, side);                    // left
    strip.quad(B, C, G, F, side);                     // right
  }

  /* ---- cars ---- */
  function makeCar(bodyCss, topCss, sideCss, lightCss, alpha) {
    const g = new THREE.Group();
    const hw = FEEL.CAR_BODY_WIDTH / 2, hl = FEEL.CAR_BODY_LENGTH / 2, bh = FEEL.CAR_BODY_HEIGHT, ride = FEEL.CAR_RIDE_HEIGHT;
    const mat = (css) => new THREE.MeshLambertMaterial({ color: cssColour(css), transparent: alpha < 1, opacity: alpha, depthWrite: alpha >= 1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, bh, hl * 2), mat(bodyCss));
    body.position.set(0, ride + bh / 2, 0);
    // the nose points down -Z, the way the camera looks; the tail and its light bar are at +Z
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 * W.CAR_CABIN_WIDTH, bh * W.CAR_CABIN_HEIGHT, hl * 2 * W.CAR_CABIN_LENGTH), mat(topCss));
    cabin.position.set(0, ride + bh + bh * W.CAR_CABIN_HEIGHT / 2, hl * 2 * W.CAR_CABIN_BACK);
    const wr = FEEL.CAR_WHEEL_DIAMETER / 2, ww = FEEL.CAR_WHEEL_WIDTH;
    const wheelGeo = new THREE.BoxGeometry(ww, wr * 2, wr * 2);
    const wheelMat = mat(COLOUR().CAR_TYRE || '#0a0f14');
    const wheels = [];   // front left, front right, rear left, rear right
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const m = new THREE.Mesh(wheelGeo, wheelMat);
      m.position.set(sx * FEEL.CAR_TRACK / 2, wr, sz * FEEL.CAR_WHEELBASE / 2);
      g.add(m); wheels.push(m);
    }
    const light = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 * W.CAR_LIGHT_HALF, bh * W.CAR_LIGHT_THICK * 2, 30), new THREE.MeshBasicMaterial({ color: cssColour(lightCss), transparent: alpha < 1, opacity: alpha }));
    light.position.set(0, ride + bh * W.CAR_LIGHT_Y, hl + 10);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 8, bh * 0.35, hl * 2 * 0.9), mat(sideCss));
    sideL.position.set(0, ride + bh * 0.2, 0);
    g.add(body, cabin, light, sideL);
    /* The group's origin is the body's centre. The yaw pivot is
       CAR_YAW_PIVOT ahead of it in the original's carToWorld, and placeCar
       puts the centre where that pivot puts it: at the simulation's own
       bodyOffsetX and bodyOffsetZ off the car's position, in road
       coordinates, so a yawed car on a bend sits exactly where the
       simulation's contact tests say its body is. */
    g.userData.wheels = wheels; g.userData.body = g;
    g.visible = false;
    scene.add(g);
    return g;
  }
  let player = null, ghost = null;
  const racers = [];
  const RACER = [['NPC_BODY_A', 'NPC_ROOF_A', 'NPC_SIDE_A'], ['NPC_BODY_B', 'NPC_ROOF_B', 'NPC_SIDE_B'], ['NPC_BODY_C', 'NPC_ROOF_C', 'NPC_SIDE_C']];
  function buildCars() {
    const Cl = COLOUR();
    if (player) { scene.remove(player); scene.remove(ghost); for (const r of racers) scene.remove(r); racers.length = 0; }
    player = makeCar(Cl.CAR_SIDE, Cl.CAR_TOP, Cl.CAR_HIP, Cl.CAR_LIGHT, 1);
    ghost = makeCar(Cl.GHOST, Cl.GHOST_EDGE, Cl.GHOST, Cl.GHOST_EDGE, W.GHOST_ALPHA);
    for (let i = 0; i < 3; i++) racers.push(makeCar(Cl[RACER[i][0]], Cl[RACER[i][1]], Cl[RACER[i][2]], Cl.NPC_LIGHT, 1));
  }
  const Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  /* Place a car: the pivot at (s, x, y) on the road, the road's heading,
     then the road's slope about the road's own lateral axis, then the
     drift yaw about the car's vertical, then the tumble pitch about the
     car's own lateral axis and the roll about its length. Composed one
     rotation at a time because no Euler order says all of that. */
  const T1 = new THREE.Vector3(), T2 = new THREE.Vector3();
  function placeCar(car, s, x, y, yaw, pitch, roll, steer) {
    car.visible = true;
    const sb = s + SIM.bodyOffsetZ(yaw), xb = x + SIM.bodyOffsetX(yaw);
    roadPoint(P, sb, xb, y);
    car.position.copy(P);
    const th = headingAt(sb);
    // the slope of the road under the car, from the heights a segment either side
    roadPoint(T1, sb + L, 0, 0); roadPoint(T2, sb - L, 0, 0);
    const slope = Math.atan2(T1.y - T2.y, 2 * L);
    /* With the nose down -Z, a positive turn about Y swings it to -X, so
       headings and the drift yaw go in negated; a positive turn about X
       lifts the nose, so an uphill slope and the nose up pitch go in as
       they are. */
    Q.setFromAxisAngle(AY, -th);
    Q.multiply(Q2.setFromAxisAngle(AX, slope));
    Q.multiply(Q2.setFromAxisAngle(AY, -yaw));
    if (pitch) Q.multiply(Q2.setFromAxisAngle(AX, pitch));
    if (roll) Q.multiply(Q2.setFromAxisAngle(AZ, roll));
    car.quaternion.copy(Q);
    const wheels = car.userData.wheels;
    wheels[0].rotation.y = -(steer || 0); wheels[1].rotation.y = -(steer || 0);
  }

  /* ---- particles ----
     Instanced quads in road coordinates. Each pool is one InstancedMesh. */
  function makePool(max, size, css, alphaLike) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({ color: cssColour(css), transparent: true, opacity: alphaLike, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const items = [];
    for (let i = 0; i < max; i++) items.push({ life: 0, s: 0, x: 0, y: 0, vs: 0, vx: 0, vy: 0, r: size, fade: 1, drag: 0, grav: 0, colour: null });
    scene.add(mesh);
    const pool = { mesh, items, max, head: 0, size };
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    for (let i = 0; i < max; i++) mesh.setColorAt(i, col.set(cssColour(css)));
    pool.take = () => { const p = pool.items[pool.head]; pool.head = (pool.head + 1) % pool.max; return p; };
    return pool;
  }
  let smoke = null, debris = null, sparks = null, fireworks = null;
  function buildPools() {
    const Cl = COLOUR();
    smoke = makePool(W.SMOKE_MAX, W.SMOKE_SIZE, 'rgb(' + (Cl.SMOKE || '198,198,198') + ')', FEEL.SMOKE_ALPHA * 1.6);
    debris = makePool(W.DEBRIS_MAX, W.DEBRIS_SIZE, Cl.CAR_TOP, 1);
    sparks = makePool(W.SPARK_MAX, W.SPARK_SIZE, Cl.EDGE_LIGHT, 1);
    fireworks = makePool(W.FIREWORK_MAX, W.FIREWORK_SIZE, Cl.SCORE, 1);
  }
  const M4 = new THREE.Matrix4(), S3 = new THREE.Vector3();
  function stepPool(pool, dt) {
    const items = pool.items;
    const mesh = pool.mesh;
    let shown = 0;
    for (let i = 0; i < pool.max; i++) {
      const p = items[i];
      if (p.life > 0) {
        p.life -= dt;
        if (p.drag) { const k = Math.exp(-p.drag * dt); p.vs *= k; p.vx *= k; }
        p.vy -= p.grav * dt;
        p.s += p.vs * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.grow) p.r += p.grow * dt;
        if (p.y < 0 && p.grav) { p.y = 0; p.vy = 0; }
      }
      if (p.life <= 0) { M4.makeScale(0, 0, 0); mesh.setMatrixAt(i, M4); continue; }
      roadPoint(P, p.s, p.x, p.y);
      const scale = p.r / pool.size;
      M4.makeRotationFromQuaternion(camera.quaternion);
      S3.set(scale, scale, scale);
      M4.scale(S3);
      M4.setPosition(P);
      mesh.setMatrixAt(i, M4);
      if (p.colour) { mesh.setColorAt(i, p.colour); }
      shown++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.visible = shown > 0;
  }
  let smokeAcc = 0, smokeSide = 1;
  const rnd = () => Math.random();   // decoration only; never the simulation's stream
  function spawnSmoke(side) {
    const p = smoke.take();
    const yaw = SIM.carYaw();
    const wheels = SIM.rearWheelOffsets(SIM.carX);
    p.s = SIM.rearAxleZ() + (rnd() * 2 - 1) * 60; p.x = (side < 0 ? wheels.left : wheels.right) + (rnd() * 2 - 1) * 60; p.y = 40;
    p.vs = -W.SMOKE_BACK * (0.75 + rnd() * 0.5); p.vx = -SIM.drift.lateralV * 0.4 + (rnd() * 2 - 1) * 400; p.vy = W.SMOKE_RISE * (0.6 + rnd() * 0.8);
    p.r = W.SMOKE_SIZE * (0.8 + rnd() * 0.4); p.grow = W.SMOKE_GROWTH; p.life = FEEL.SMOKE_LIFE; p.drag = 0; p.grav = 0; p.colour = null;
    void yaw;
  }
  const hooks = {
    /* L26519 addShake: the simulation's shake is the one the frame decays */
    addShake(px) { if (px > SIM.shake) SIM.shake = px; if (SIM.shake > FEEL.SHAKE_MAX_PX) SIM.shake = FEEL.SHAKE_MAX_PX; },
    /* L14107 updateSmoke: the simulation calls this every driving frame */
    updateSmoke(dt) {
      if (!smoke) return;
      if (SIM.drift.slipNorm <= FEEL.SMOKE_MIN_SLIP) { smokeAcc = 0; return; }
      const strength = (SIM.drift.slipNorm - FEEL.SMOKE_MIN_SLIP) / (1 - FEEL.SMOKE_MIN_SLIP);
      smokeAcc += dt * FEEL.SMOKE_RATE * strength;
      let guard = 0;
      while (smokeAcc >= 1 && guard < 8) { smokeAcc -= 1; guard++; smokeSide = -smokeSide; spawnSmoke(smokeSide); }
      if (smokeAcc > 1) smokeAcc = 1;
    },
    clearSmoke() { if (smoke) for (const p of smoke.items) p.life = 0; smokeAcc = 0; },
    updateDebris() { /* the pools step in render, on the frame's dt */ },
    clearDebris() { if (debris) for (const p of debris.items) p.life = 0; if (sparks) for (const p of sparks.items) p.life = 0; },
    /* L27544 explode: the burst off the car at the moment of the hit */
    explode() {
      if (!debris) return;
      const s = SIM.position + FEEL.CAMERA_DISTANCE, x = SIM.carX;
      const n = Math.round(FEEL.EXPLODE_PARTICLES);
      const Cl = COLOUR();
      for (let i = 0; i < n; i++) {
        const p = debris.take();
        const a = rnd() * Math.PI * 2;
        const speed = W.DEBRIS_SPEED * (0.45 + 0.55 * rnd());
        p.s = s + (rnd() * 2 - 1) * 100; p.x = x + (rnd() * 2 - 1) * 100; p.y = FEEL.CAR_RIDE_HEIGHT + FEEL.CAR_BODY_HEIGHT / 2;
        p.vs = Math.cos(a) * speed; p.vx = Math.sin(a) * speed; p.vy = speed * (0.6 + 0.8 * rnd());
        p.r = W.DEBRIS_SIZE * (0.35 + 0.65 * rnd()); p.life = W.DEBRIS_TIME * (0.6 + 0.4 * rnd()); p.drag = W.DEBRIS_DRAG; p.grav = W.DEBRIS_GRAVITY; p.grow = 0;
        p.colour = col.set(cssColour(rnd() < 0.38 ? Cl.EDGE_DARK : Cl.CAR_TOP)).clone();
      }
    },
    /* L13726 landImpact, the renderer half: grit off the wheels */
    landImpact(q, tier, bad) {
      if (!sparks) return;
      const s = SIM.rearAxleZ();
      const wheels = SIM.rearWheelOffsets(SIM.carX);
      const n = W.GRIT_PARTS;
      for (let i = 0; i < n; i++) {
        const p = sparks.take();
        const side = i & 1 ? wheels.right : wheels.left;
        p.s = s; p.x = side; p.y = 20;
        p.vs = -W.SPARK_SPEED * (0.3 + rnd() * 0.7); p.vx = (rnd() * 2 - 1) * W.SPARK_SPEED * 0.6; p.vy = W.SPARK_SPEED * (0.4 + rnd() * 0.8) * (bad ? 1.4 : 1);
        p.r = W.SPARK_SIZE * (1 + rnd()); p.life = 0.5; p.drag = 2; p.grav = W.DEBRIS_GRAVITY; p.grow = 0;
        p.colour = col.set(cssColour(bad ? COLOUR().HAZARD_WARN : COLOUR().EDGE_DARK)).clone();
      }
    },
    /* L27930 finaleShells: a wave of fireworks over the finish */
    finaleShells(count) {
      if (!fireworks) return;
      const n = Math.max(1, Math.round(count || 1));
      const Cl = COLOUR();
      const colours = [Cl.SCORE, Cl.GATE, Cl.HAZARD_WARN, Cl.CAR_TOP, Cl.EDGE_LIGHT];
      for (let k = 0; k < n; k++) {
        const s0 = SIM.position + FEEL.CAMERA_DISTANCE + W.FIREWORK_AHEAD + (rnd() * 2 - 1) * W.FIREWORK_SPREAD;
        const x0 = (rnd() * 2 - 1) * W.FIREWORK_SPREAD;
        const y0 = 6000 + rnd() * 9000;
        const c = col.set(cssColour(colours[Math.floor(rnd() * colours.length)])).clone();
        for (let i = 0; i < W.FIREWORK_SPARKS; i++) {
          const p = fireworks.take();
          const a = rnd() * Math.PI * 2, b = (rnd() - 0.5) * Math.PI;
          const v = W.FIREWORK_SPARK_SPEED * (0.5 + rnd() * 0.5);
          p.s = s0; p.x = x0; p.y = y0;
          p.vs = Math.cos(a) * Math.cos(b) * v; p.vx = Math.sin(a) * Math.cos(b) * v; p.vy = Math.sin(b) * v;
          p.r = W.FIREWORK_SIZE * (0.6 + rnd() * 0.8); p.life = W.FIREWORK_LIFE * (0.7 + rnd() * 0.5); p.drag = 1.2; p.grav = W.FIREWORK_GRAVITY; p.grow = 0;
          p.colour = c;
        }
      }
    },
  };
  const lastContacts = [];
  function contactSparks() {
    // the contact ledger, drained as the original's drawContactSparks drained it
    const n = SIM.contactN;
    lastContacts.length = 0;
    for (let c = 0; c < n; c++) lastContacts.push({ z: SIM.contactZ[c], x: SIM.contactX[c], f: SIM.contactF[c] });
    if (n && sparks) {
      const Cl = COLOUR();
      for (let c = 0; c < n; c++) {
        const s = SIM.contactZ[c] + FEEL.CAMERA_DISTANCE, x = SIM.contactX[c], f = SIM.contactF[c];
        const count = Math.round(W.SPARK_COUNT * (0.5 + f));
        for (let i = 0; i < count; i++) {
          const p = sparks.take();
          p.s = s; p.x = x; p.y = FEEL.CAR_RIDE_HEIGHT + 60;
          p.vs = (rnd() * 2 - 1) * W.SPARK_SPEED; p.vx = (rnd() * 2 - 1) * W.SPARK_SPEED; p.vy = W.SPARK_SPEED * (0.3 + rnd() * 0.9);
          p.r = W.SPARK_SIZE * (0.6 + rnd() * (1 + f)); p.life = W.SPARK_TIME * (0.6 + 0.4 * rnd()); p.drag = 4; p.grav = W.DEBRIS_GRAVITY; p.grow = 0;
          p.colour = col.set(cssColour(rnd() < 0.45 ? Cl.EDGE_LIGHT : Cl.EDGE_DARK)).clone();
        }
      }
    }
    SIM.contactN = 0;
    const wn = SIM.wreckN;
    if (wn && debris) {
      const Cl = COLOUR();
      for (let c = 0; c < wn; c++) {
        const s = SIM.wreckZ[c] + FEEL.CAMERA_DISTANCE, x = SIM.wreckX[c];
        for (let i = 0; i < W.WRECK_PARTS; i++) {
          const p = debris.take();
          const a = rnd() * Math.PI * 2, speed = W.DEBRIS_SPEED * 0.8 * (0.35 + 0.65 * rnd());
          p.s = s; p.x = x; p.y = FEEL.CAR_RIDE_HEIGHT + FEEL.CAR_BODY_HEIGHT / 2;
          p.vs = Math.cos(a) * speed; p.vx = Math.sin(a) * speed; p.vy = speed * (0.5 + 0.8 * rnd());
          p.r = W.DEBRIS_SIZE * (0.4 + 0.6 * rnd()); p.life = W.SPARK_TIME * 2.4 * (0.6 + 0.4 * rnd()); p.drag = W.DEBRIS_DRAG; p.grav = W.DEBRIS_GRAVITY; p.grow = 0;
          p.colour = col.set(cssColour(rnd() < 0.38 ? Cl.EDGE_DARK : Cl.NPC_BODY_B)).clone();
        }
      }
    }
    SIM.wreckN = 0;
  }

  /* ---- the skyline, fixed in the world ---- */
  const skyline = [];
  {
    let seed = 1337;
    const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 1000) / 1000; };
    for (let i = 0; i < FEEL.SKYLINE_COUNT; i++) {
      const u = (i + 0.5) / FEEL.SKYLINE_COUNT - 0.5;
      skyline.push({ angle: u * W.SKYLINE_SPREAD, h: W.SKYLINE_HEIGHT_MIN + (W.SKYLINE_HEIGHT_MAX - W.SKYLINE_HEIGHT_MIN) * Math.pow(next(), 1.6), w: W.SKYLINE_WIDTH * (0.6 + next() * 0.9), dist: W.SKYLINE_DISTANCE * (0.85 + next() * 0.3) });
    }
  }

  /* ---- colours, read once a frame off the palette ---- */
  const CC = {};
  function readColours() {
    const Cl = COLOUR();
    const g = (k, d) => { const v = Cl[k]; const c = new THREE.Color(); c.set(cssColour(v === undefined ? d : v)); return c; };
    CC.roadLight = g('ROAD_LIGHT', '#422022'); CC.roadDark = g('ROAD_DARK', '#3a1b1e');
    CC.shoulderLight = g('SHOULDER_LIGHT', '#a63a15'); CC.shoulderDark = g('SHOULDER_DARK', '#87290f');
    CC.edgeLight = g('EDGE_LIGHT', '#fff6dc'); CC.edgeDark = g('EDGE_DARK', '#ffb03a');
    CC.lane = g('LANE', '#6b3524'); CC.wall = g('WALL', '#1f0f0e'); CC.slabBottom = g('SLAB_BOTTOM', '#d2551a');
    CC.groundNear = g('TERRAIN_LIT', '#345b2e'); CC.groundMid = g('TERRAIN_MID', '#264a25'); CC.groundFar = g('TERRAIN_SHADE', '#1c381f');
    CC.hazardTop = g('HAZARD_TOP', '#ff3d7a'); CC.hazardSide = g('HAZARD_SIDE', '#8e1338'); CC.hazardLip = g('HAZARD_LIP', '#ffd6e4'); CC.hazardWarn = g('HAZARD_WARN', '#ff5c8f'); CC.hazardWarnBar = g('HAZARD_WARN_BAR', '#ffe4ec'); CC.hazardDark = g('HAZARD_DARK', '#5d0a22');
    CC.jumpDeck = g('JUMP_DECK', '#8a5a30'); CC.jumpDeckDark = g('JUMP_DECK_DARK', '#3a1c18'); CC.jumpSide = g('JUMP_SIDE', '#2a1210'); CC.jumpLip = g('JUMP_LIP', '#4dff7a'); CC.jumpRough = g('JUMP_ROUGH', '#2b1416'); CC.jumpRoughChip = g('JUMP_ROUGH_CHIP', '#6b3a2c'); CC.jumpArrow = g('JUMP_ARROW', '#4dff7a');
    CC.gate = g('GATE', '#8dfbe0'); CC.gatePost = g('GATE_POST', '#1d7f70');
    CC.pylon = g('PYLON', '#d85a22'); CC.pylonMajor = g('PYLON_MAJOR', '#ffc266');
    CC.sign = g('SIGN', '#ff9a3c'); CC.signShade = g('SCN_SIGN_SHADE', '#356a7b'); CC.metal = g('SCN_METAL_LIT', '#4f5c79'); CC.metalShade = g('SCN_METAL_SHADE', '#343d4f');
    CC.bark = g('SCN_BARK_LIT', '#4c2f1e'); CC.foliage = g('SCN_FOLIAGE_LIT', '#365c2b'); CC.foliageShade = g('SCN_FOLIAGE_SHADE', '#233c1c');
    CC.wallLit = g('SCN_WALL_LIT', '#7e7044'); CC.wallShade = g('SCN_WALL_SHADE', '#584e30'); CC.roof = g('SCN_ROOF_LIT', '#76303f');
    CC.skyline = g('SKYLINE', '#170906'); CC.skylineLit = g('SKYLINE_LIT', '#8a3413'); CC.skylineTop = g('SKYLINE_TOP', '#66200c');
    CC.skyHigh = g('SKY_HIGH', '6,3,10'); CC.skyLow = g('SKY_LOW', '40,16,12'); CC.haze = g('HAZE', '58,24,18'); CC.horizonGlow = g('HORIZON_GLOW', '#b8431a'); CC.void = g('VOID', '#0b0503');
    CC.score = g('SCORE', '#ffd24a'); CC.text = g('TEXT', '#fff2e2'); CC.trail = g('JUMP_ROUGH', '#2b1416');
    CC.finishA = g('EDGE_LIGHT', '#fff6dc'); CC.finishB = g('VOID', '#0b0503');
  }
  let paletteKey = '';

  /* ---- the frame ---- */
  let lastRenderMs = { sim: 0, scene: 0, submit: 0, total: 0 };
  let frameNo = 0;
  function render(w, h) {
    const t0 = performance.now();
    update(w, h);
    const t1 = performance.now();
    renderer.clear(true, true, true);
    renderer.render(under, camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
    const t2 = performance.now();
    lastRenderMs = { scene: t1 - t0, submit: t2 - t1, total: t2 - t0 };
    frameNo++;
  }
  /* Everything but the submission: the tables, the camera, the strips, the cars, the particles. */
  function update(w, h) {
    if (w !== view.w || h !== view.h) { view.w = w; view.h = h; applyTier(); }
    const Cl = COLOUR();
    if (Cl && Cl.ROAD_LIGHT !== paletteKey) { paletteKey = Cl.ROAD_LIGHT; readColours(); if (!player) { buildCars(); buildPools(); } }
    if (!player) { buildCars(); buildPools(); readColours(); }
    const tt = profile ? performance.now() : 0;
    buildTable();
    if (profile) profile.table += performance.now() - tt;
    const dt = Math.min(FEEL.MAX_FRAME_DELTA, frameDt);

    /* the camera: straight behind the car on the frame's Z axis, not on
       the road behind it, so a hill behind never pitches it */
    const rig = h > w ? W.PORTRAIT : W.LANDSCAPE;
    camera.fov = rig.fov;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const lift = SIM.camLift * Math.max(0, SIM.carY) * W.CAM_LIFT;
    const camTarget = SIM.carX * W.CAM_FOLLOW_X;
    if (camXs === null || !(W.CAM_X_LAG > 0) || Math.abs(camTarget - camXs) > W.CAM_X_SNAP) camXs = camTarget;
    else camXs += (camTarget - camXs) * (1 - Math.exp(-dt / W.CAM_X_LAG));
    const camX = camXs;
    camera.position.set(camX, carGroundY + rig.height + lift, rig.back);
    camera.rotation.set(-rig.pitch * Math.PI / 180, 0, 0, 'YXZ');
    const sx = SIM.shakeX || 0, sy = SIM.shakeY || 0;
    if (sx || sy) camera.setViewOffset(w, h, -sx, -sy, w, h); else if (camera.view && camera.view.enabled) camera.clearViewOffset();

    /* sky and fog */
    const drawFar = W.DRAW_SEGMENTS * L;
    scene.fog.color.copy(CC.haze).lerp(CC.skyLow, 0.5);
    scene.fog.near = drawFar * W.FOG_NEAR; scene.fog.far = drawFar * W.FOG_FAR;
    under.background = under.background || new THREE.Color();
    under.background.copy(CC.skyLow).lerp(CC.horizonGlow, 0.35 * Math.min(1, (SIM.worldHeat || 0) + (SIM.finaleSky || 0)));
    scene.background = null;
    hemi.color.copy(CC.skyLow).lerp(new THREE.Color(0xffffff), 0.7); hemi.groundColor.copy(CC.void).lerp(CC.groundMid, 0.6);

    const tm = profile ? performance.now() : 0;
    drawRoad();
    if (profile) profile.road += performance.now() - tm;
    const t2 = profile ? performance.now() : 0;
    drawTerrain();
    if (profile) profile.terrain += performance.now() - t2;
    const t3 = profile ? performance.now() : 0;
    drawPaint();
    if (profile) profile.paint += performance.now() - t3;
    const t4 = profile ? performance.now() : 0;
    drawBlocks();
    if (profile) profile.blocks += performance.now() - t4;
    const t5 = profile ? performance.now() : 0;
    drawCars();
    contactSparks();
    stepPool(smoke, dt); stepPool(debris, dt); stepPool(sparks, dt); stepPool(fireworks, dt);
    camera.updateMatrixWorld();
    if (profile) { profile.rest += performance.now() - t5; profile.frames++; }
  }
  let camXs = null;
  let profile = null;
  let frameDt = 1 / 60;
  let probeOffset = 0;
  /* probeBump is the visibility probe's known answer: a fake crest, this
     many units added to the drawn road at one segment, which must hide
     what is behind it. Zero in play. */
  let probeBump = { seg: -1, dy: 0 };
  let raycastLast = null;

  /* The road and the terrain are built from cross sections: every boundary
     in the table gets its stations across the road computed once, and the
     quads between consecutive boundaries read them. */
  const STATIONS = 12;   // per boundary: terrain far, terrain mid, slab foot, lip out, lip in, edge, lane left, lane right, edge, lip in, lip out, slab foot, terrain mid, terrain far
  const XS = new Float64Array(MAXB * 16), YS = new Float64Array(MAXB * 16), ZS = new Float64Array(MAXB * 16);
  const SP = new THREE.Vector3();
  function stationsFor(n, EO, lip) {
    const idx = bIdx[n], s0 = idx * L, hw = bW[n];
    const o = n * 16;
    const ripple = Math.sin(idx * 0.21) * W.TERRAIN_RIPPLE;
    const put = (k, x, y) => { roadPoint(SP, s0, x, y); XS[o + k] = SP.x; YS[o + k] = SP.y; ZS[o + k] = SP.z; };
    const near = EO * hw + W.SLAB_FLARE, mid = (EO + W.TERRAIN_NEAR * 3) * hw, far = W.TERRAIN_REACH * hw;
    const yNear = -W.SLAB_DEPTH, yMid = -W.SLAB_DEPTH - W.TERRAIN_DROP * 0.35 + ripple * 0.5, yFar = -W.SLAB_DEPTH - W.TERRAIN_DROP + ripple;
    put(0, -far, yFar); put(1, -mid, yMid); put(2, -near, yNear);
    put(3, -EO * hw, 0); put(4, -(EO - lip) * hw, 0); put(5, -hw, 0); put(6, -W.LANE_HALF * hw, 0);
    put(7, W.LANE_HALF * hw, 0); put(8, hw, 0); put(9, (EO - lip) * hw, 0); put(10, EO * hw, 0);
    put(11, near, yNear); put(12, mid, yMid); put(13, far, yFar);
  }
  const st = (out, n, k) => { const o = n * 16 + k; out.x = XS[o]; out.y = YS[o]; out.z = ZS[o]; return out; };
  function drawRoad() {
    road.begin(); walls.begin(); marks.begin(); terrain.begin();
    const lip = W.LIP, EO = 1 + FEEL.RUMBLE_WIDTH_FRACTION;
    const heat = SIM.worldHeat || 0;
    const edgeHot = col2.copy(CC.edgeDark).lerp(CC.edgeLight, Math.min(1, heat * FEEL.HEAT_EDGE_LIFT));
    for (let n = 0; n < bCount; n++) stationsFor(n, EO, lip);
    for (let n = 0; n + 1 < bCount; n++) {
      if (!bOk[n]) continue;
      const idx = bIdx[n];
      const light = (Math.floor(idx / FEEL.RUMBLE_SEGMENTS) & 1) === 0;
      const surf = light ? CC.roadLight : CC.roadDark;
      const shoulder = light ? CC.shoulderLight : CC.shoulderDark;
      const edge = light ? CC.edgeLight : edgeHot;
      const q = (strip, ka, kb, colour, tag) => { st(A, n, ka); st(B, n, kb); st(C, n + 1, kb); st(D, n + 1, ka); strip.tag = tag || null; strip.quad(A, B, C, D, colour); strip.tag = null; };
      q(road, 5, 8, surf, { kind: 'surface', seg: idx, a0: -1, a1: 1 });
      q(road, 4, 5, shoulder, { kind: 'shoulder', seg: idx, a0: -(EO - lip), a1: -1 }); q(road, 8, 9, shoulder, { kind: 'shoulder', seg: idx, a0: 1, a1: EO - lip });
      q(road, 3, 4, edge, { kind: 'lip', seg: idx, a0: -EO, a1: -(EO - lip) }); q(road, 9, 10, edge, { kind: 'lip', seg: idx, a0: EO - lip, a1: EO });
      if ((idx % (W.LANE_ON + W.LANE_OFF)) < W.LANE_ON) q(road, 6, 7, CC.lane, { kind: 'lane', seg: idx });
      // the slab's sides, flared out at the bottom
      q(walls, 2, 3, CC.wall); q(walls, 10, 11, CC.wall);
      // the terrain, two bands a side, stations left to right so the faces show upward
      q(terrain, 1, 2, (idx & 1) ? CC.groundNear : CC.groundMid); q(terrain, 0, 1, (idx & 1) ? CC.groundMid : CC.groundFar);
      q(terrain, 11, 12, (idx & 1) ? CC.groundNear : CC.groundMid); q(terrain, 12, 13, (idx & 1) ? CC.groundMid : CC.groundFar);
      // tyre marks ride the segment
      const sg = segAt(idx);
      if (sg && sg.ma > 0) {
        const a = Math.min(1, sg.ma);
        const mc = col.copy(surf).lerp(CC.trail, a * FEEL.TYRE_MARK_MAX_ALPHA);
        const half = W.TYRE_MARK_HALF, hw0 = bW[n], hw1 = bW[n + 1], s0 = idx * L, s1 = (idx + 1) * L;
        for (const [m0, m1] of [[sg.ml0, sg.ml1], [sg.mr0, sg.mr1]]) {
          roadPoint(A, s0, (m0 - half) * hw0, W.TYRE_MARK_LIFT); roadPoint(B, s0, (m0 + half) * hw0, W.TYRE_MARK_LIFT);
          roadPoint(C, s1, (m1 + half) * hw1, W.TYRE_MARK_LIFT); roadPoint(D, s1, (m1 - half) * hw1, W.TYRE_MARK_LIFT);
          marks.quad(A, B, C, D, mc);
        }
      }
    }
    road.end(); walls.end(); marks.end(); terrain.end();
  }

  function drawTerrain() { /* built with the road, from the same cross sections */ }

  function drawPaint() {
    paint.begin();
    const first = bIdx[0], last = bIdx[bCount - 1];
    const inView = (a, b) => b >= first && a <= last;
    const flat = (sa, sb, xa0, xa1, xb0, xb1, lift, colour) => {
      roadPoint(A, sa, xa0, lift); roadPoint(B, sa, xa1, lift); roadPoint(C, sb, xb1, lift); roadPoint(D, sb, xb0, lift);
      paint.quad(A, B, C, D, colour);
    };
    // hazard warnings: the band painted across the hazard's width for the warning run
    const warn = FEEL.HAZARD_WARN_SEGMENTS;
    for (const hz of SIM.hazards) {
      const a = hz.from - warn, b = hz.from - 1;
      if (!inView(a, b)) continue;
      const lo = Math.max(a, first), hi = Math.min(b, last);
      for (let i = lo; i <= hi; i += 2) {
        const hw = hwAt(i * L);
        const x = hz.kind === SIM.HAZ_MOVER ? hz.x : hz.x;
        const half = hz.half + (hz.kind === SIM.HAZ_MOVER ? Math.abs(hz.swing) * hw : 0);
        flat(i * L, Math.min(i + 1, hi + 1) * L, x * hw - half, x * hw + half, x * hw - half, x * hw + half, W.WARN_LIFT, ((i - a) & 2) ? CC.hazardWarn : CC.hazardWarnBar);
      }
    }
    // jumps: the rough shoulders alongside and past the deck, and the chevrons leading to it
    const tail = SIM.roughTail();
    for (const j of SIM.jumps) {
      const a = j.from, b = j.to + tail;
      if (inView(a, b)) {
        const lo = Math.max(a, first), hi = Math.min(b, last);
        for (let i = lo; i <= hi; i++) {
          const hw0 = hwAt(i * L), hw1 = hwAt((i + 1) * L);
          for (const side of [-1, 1]) flat(i * L, (i + 1) * L, side * FEEL.JUMP_RAMP_HALF * hw0, side * hw0, side * FEEL.JUMP_RAMP_HALF * hw1, side * hw1, W.ROUGH_LIFT, (i & 1) ? CC.jumpRough : CC.jumpRoughChip);
        }
      }
      if (j.done) continue;
      for (let m = 1; m <= FEEL.JUMP_ARROW_COUNT; m++) {
        const n = j.from - Math.round(m * FEEL.JUMP_WARN_SEGMENTS / FEEL.JUMP_ARROW_COUNT);
        const len = FEEL.JUMP_ARROW_LENGTH;
        if (!inView(n, n + len)) continue;
        const shrink = 1 - (m - 1) * 0.12;
        const hw = hwAt(n * L);
        const hx = hw * FEEL.JUMP_ARROW_HALF * shrink, tx = hx * FEEL.JUMP_ARROW_THICK, tz = len * L * shrink * FEEL.JUMP_ARROW_THICK;
        const base = n * L, tip = base + len * L * shrink;
        // two arms of a chevron pointing up the road, as flat quads
        roadPoint(A, base, -hx, W.CHEVRON_LIFT); roadPoint(B, base, -hx + tx, W.CHEVRON_LIFT); roadPoint(C, tip, 0, W.CHEVRON_LIFT); roadPoint(D, tip - tz, 0, W.CHEVRON_LIFT);
        paint.quad(A, B, C, D, CC.jumpArrow);
        roadPoint(A, base, hx, W.CHEVRON_LIFT); roadPoint(B, base, hx - tx, W.CHEVRON_LIFT); roadPoint(C, tip - tz, 0, W.CHEVRON_LIFT); roadPoint(D, tip, 0, W.CHEVRON_LIFT);
        paint.quad(A, B, C, D, CC.jumpArrow);
      }
    }
    // the finish line, chequered across the road
    if (SIM.mode === SIM.DAILY) {
      const fs = SIM.finishSeg;
      if (inView(fs, fs + 1)) {
        const hw = hwAt(fs * L);
        const bars = FEEL.FINISH_BARS || 7;
        for (let i = 0; i < bars; i++) {
          const x0 = -hw + (2 * hw) * i / bars, x1 = -hw + (2 * hw) * (i + 1) / bars;
          flat(fs * L, fs * L + L * 0.5, x0, x1, x0, x1, W.WARN_LIFT, (i & 1) ? CC.finishA : CC.finishB);
          flat(fs * L + L * 0.5, (fs + 1) * L, x0, x1, x0, x1, W.WARN_LIFT, (i & 1) ? CC.finishB : CC.finishA);
        }
      }
    }
    paint.end();
  }

  function spriteBlock(id, s, xHalf, hw) {
    // id is the segment's sgn minus one: 0..3 gantry, 4..7 marker, 8 post, 9..11 tree, 12..14 house, 15..16 mast, 17 tower
    const x = xHalf * hw;
    if (id <= 3) {
      // a gantry spans the road, so it is drawn with the road layer, as the original drew its sprites after the road
      const span = FEEL.SIGN_GANTRY_SPAN * FEEL.ROAD_HALF_WIDTH_BASE, high = FEEL.SIGN_GANTRY_HIGH;
      const postW = 110;
      blocks.tag = { kind: 'gantry', seg: Math.floor(s / L) };
      box(blocks, s, -span / 2, 0, high, postW, postW, 0, CC.metal, CC.metalShade);
      box(blocks, s, span / 2, 0, high, postW, postW, 0, CC.metal, CC.metalShade);
      // the plate is thin, because from a high camera a deep beam hides the road behind it
      box(blocks, s, 0, high - 300, high, span / 2 + postW, 90, 0, CC.sign, CC.signShade);
      blocks.tag = null;
      return;
    }
    if (id <= 7) { const wd = FEEL.SIGN_MARKER_WIDE, hi = FEEL.SIGN_MARKER_HIGH; box(scenery, s, x, 0, hi * 0.45, 40, 40, 0, CC.metal, CC.metalShade); box(scenery, s, x, hi * 0.45, hi, wd / 2, 60, 0, CC.sign, CC.signShade); return; }
    if (id === 8) { const wd = FEEL.SIGN_POST_WIDE, hi = FEEL.SIGN_POST_HIGH; box(scenery, s, x, 0, hi, wd / 2, 50, 0, CC.sign, CC.signShade); return; }
    if (id <= 11) { const t = SPRITE.tree[id - 9]; const wd = FEEL[t.w], hi = FEEL[t.h]; box(scenery, s, x, 0, hi * 0.3, wd * 0.08, wd * 0.08, 0, CC.bark, CC.bark); box(scenery, s, x, hi * 0.3, hi, wd / 2, wd / 2, 0, CC.foliage, CC.foliageShade); return; }
    if (id <= 14) { const t = SPRITE.house[id - 12]; const wd = FEEL[t.w], hi = FEEL[t.h]; box(scenery, s, x, 0, hi * 0.7, wd / 2, wd * 0.35, 0, CC.wallLit, CC.wallShade); box(scenery, s, x, hi * 0.7, hi, wd / 2 * 0.9, wd * 0.3, 0, CC.roof, CC.roof); return; }
    if (id <= 16) { const wd = FEEL.MAST_WIDE, hi = FEEL.MAST_HIGH; box(scenery, s, x, 0, hi, wd * 0.08, wd * 0.08, 0, CC.metal, CC.metalShade); box(scenery, s, x, hi * 0.9, hi, wd / 2, wd / 2, 0, id === 16 ? CC.edgeDark : CC.metal, CC.metalShade); return; }
    { const wd = FEEL.TOWER_WIDE, hi = FEEL.TOWER_HIGH; box(scenery, s, x, 0, hi * 0.6, wd * 0.12, wd * 0.12, 0, CC.metal, CC.metalShade); box(scenery, s, x, hi * 0.6, hi, wd / 2, wd / 2, 0, CC.wallLit, CC.wallShade); }
  }

  function drawBlocks() {
    blocks.begin(); scenery.begin();
    const first = bIdx[0], last = bIdx[bCount - 1];
    const EO = 1 + FEEL.RUMBLE_WIDTH_FRACTION;
    // pylons: every PYLON_SPACING segments, both sides
    for (let n = 0; n < bCount; n++) {
      if (!bOk[n]) continue;
      const idx = bIdx[n];
      if (idx % FEEL.PYLON_SPACING === 0) {
        const major = (idx / FEEL.PYLON_SPACING) % FEEL.PYLON_MAJOR_EVERY === 0;
        const hgt = major ? FEEL.PYLON_MAJOR_HEIGHT : FEEL.PYLON_HEIGHT, wid = (major ? FEEL.PYLON_MAJOR_WIDTH : FEEL.PYLON_WIDTH) / 2;
        scenery.tag = { kind: 'pylon', seg: idx };
        for (const side of [-1, 1]) box(scenery, idx * L, side * (EO + W.PYLON_OUT) * bW[n] + side * wid, 0, hgt, wid, wid, 0, major ? CC.pylonMajor : CC.pylon, CC.pylon);
        scenery.tag = null;
      }
      // signs and landmarks, from the segment's own slots
      const sg = segAt(idx);
      if (sg) {
        scenery.tag = { kind: 'scenery', seg: idx };
        if (sg.sgn) spriteBlock(sg.sgn - 1, idx * L, sg.sgnX, bW[n]);
        if (sg.sg2) spriteBlock(sg.sg2 - 1, idx * L, sg.sg2X, bW[n]);
        if (sg.sg3) spriteBlock(sg.sg3 - 1, idx * L, sg.sg3X, bW[n]);
        scenery.tag = null;
      }
    }
    // hazards
    for (const hz of SIM.hazards) {
      if (hz.to < first || hz.from > last) continue;
      const s0 = hz.from * L, s1 = (hz.to + 1) * L;
      const hw = hwAt(s0);
      const x = SIM.hazardX(hz) * hw;
      blocks.tag = { kind: 'hazard', hazard: hz };
      box(blocks, (s0 + s1) / 2, x, 0, W.HAZARD_HEIGHT, hz.half, (s1 - s0) / 2, 0, CC.hazardTop, CC.hazardSide, CC.hazardLip);
      blocks.tag = null;
    }
    // jumps: the ramp wedge
    for (const j of SIM.jumps) {
      if (j.to + 1 < first || j.from > last) continue;
      blocks.tag = { kind: 'jump', jump: j };
      const hw = hwAt(j.from * L);
      const half = FEEL.JUMP_RAMP_HALF * hw;
      const s0 = j.from * L, s1 = (j.to + 1) * L;
      const top = FEEL.JUMP_RAMP_HEIGHT;
      // deck, in slices so it follows the hill
      const slices = j.to - j.from + 1;
      for (let i = 0; i < slices; i++) {
        const sa = s0 + (s1 - s0) * i / slices, sb = s0 + (s1 - s0) * (i + 1) / slices;
        const ya = top * i / slices, yb = top * (i + 1) / slices;
        roadPoint(A, sa, -half, ya); roadPoint(B, sa, half, ya); roadPoint(C, sb, half, yb); roadPoint(D, sb, -half, yb);
        blocks.quad(A, B, C, D, (i & 1) ? CC.jumpDeck : CC.jumpDeckDark);
        // sides
        roadPoint(E, sa, -half, 0); roadPoint(F, sb, -half, 0);
        blocks.quad(E, A, D, F, CC.jumpSide);
        roadPoint(E, sa, half, 0); roadPoint(F, sb, half, 0);
        blocks.quad(E, B, C, F, CC.jumpSide);
      }
      // the lip and the back face
      roadPoint(A, s1, -half, top); roadPoint(B, s1, half, top); roadPoint(C, s1, half, 0); roadPoint(D, s1, -half, 0);
      blocks.quad(A, B, C, D, CC.jumpSide);
      roadPoint(A, s1 - 40, -half, top + 30); roadPoint(B, s1 - 40, half, top + 30); roadPoint(C, s1, half, top + 30); roadPoint(D, s1, -half, top + 30);
      blocks.quad(A, B, C, D, CC.jumpLip);
      blocks.tag = null;
    }
    // gates: the next one and every one after it in range, the finish gate when it is the finish
    if (SIM.state !== SIM.TITLE || true) {
      const finish = SIM.mode === SIM.DAILY;
      let g = SIM.nextGate;
      const gates = SIM.dailyGates;
      let count = 0;
      while (g <= last && count < 6) {
        if (g >= first) {
          const isFinish = finish && g === SIM.finishSeg;
          blocks.tag = { kind: isFinish ? 'finish' : 'gate', seg: g };
          const hw = hwAt(g * L);
          if (isFinish) {
            const hgt = W.FINISH_HEIGHT, pw = W.FINISH_POST / 2;
            for (const side of [-1, 1]) box(blocks, g * L, side * (EO * hw + pw), 0, hgt, pw, pw, 0, CC.gate, CC.gatePost);
            box(blocks, g * L, 0, hgt * (1 - W.FINISH_BANNER), hgt, EO * hw + pw * 2, pw * 0.6, 0, CC.edgeLight, CC.score);
          } else {
            const hgt = W.GATE_HEIGHT, pw = W.GATE_POST / 2;
            for (const side of [-1, 1]) box(blocks, g * L, side * (EO * hw + pw), 0, hgt, pw, pw, 0, CC.gate, CC.gatePost);
            box(blocks, g * L, 0, hgt - pw * 0.8, hgt, EO * hw + pw * 2, pw * 0.4, 0, CC.gate, CC.gate);
            const away = g - SIM.carSegIndex;
            if (g === SIM.nextGate && away > 0 && away < W.GATE_SWEEP_SEGMENTS && SIM.state === SIM.DRIVING) {
              const u = 1 - away / W.GATE_SWEEP_SEGMENTS;
              const y = hgt * (1 - u);
              for (const side of [-1, 1]) box(blocks, g * L, side * (EO * hw + pw), y - hgt * 0.08, y + hgt * 0.08, pw * 1.7, pw * 1.7, 0, CC.gate, CC.gate);
            }
          }
        }
        blocks.tag = null;
        if (finish && g >= SIM.finishSeg) break;
        g += FEEL.CHECKPOINT_EVERY;
        count++;
      }
      void gates;
    }
    blocks.end(); scenery.end();
    // the skyline, fixed in the world: rotate by the absolute heading
    city.begin();
    for (const b of skyline) {
      const ang = b.angle - absHeading;
      const bx = Math.sin(ang) * b.dist, bz = -Math.cos(ang) * b.dist;
      const hx = b.w / 2;
      const cx = Math.cos(ang), sx = Math.sin(ang);
      const corner = (out, dx, ds, y) => { out.x = bx + cx * dx + sx * ds; out.z = bz + sx * dx - cx * ds; out.y = carGroundY - 4000 + y; return out; };
      corner(A, -hx, -hx, 0); corner(B, hx, -hx, 0); corner(C, hx, hx, 0); corner(D, -hx, hx, 0);
      corner(E, -hx, -hx, b.h); corner(F, hx, -hx, b.h); corner(G, hx, hx, b.h); corner(Hh, -hx, hx, b.h);
      const lit = col.copy(CC.skyline).lerp(CC.skylineLit, 0.25 + 0.75 * Math.min(1, SIM.cityGlow || 0));
      city.quad(E, Hh, G, F, lit); city.quad(A, B, F, E, lit); city.quad(A, E, Hh, D, CC.skyline); city.quad(B, C, G, F, CC.skyline);
    }
    city.end();
  }

  function drawCars() {
    const st = SIM.state;
    const onTitle = st === SIM.TITLE;
    // the player: hidden after a hit once the hit stop is over, as the original drew it
    const dead = st === SIM.DEAD;
    const gone = dead && SIM.deathKind === SIM.HIT_OBJECT && SIM.hitStop <= 0;
    if (gone) player.visible = false;
    else {
      const yaw = SIM.carYaw();
      const roll = Math.max(-1, Math.min(1, SIM.drift.lateralAccel / FEEL.CAR_ROLL_REFERENCE)) * FEEL.CAR_ROLL_DEG * Math.PI / 180;
      const steer = SIM.steering.value * FEEL.CAR_FRONT_STEER_DEG * Math.PI / 180;
      /* probeOffset is the screen agreement probe's known answer: a drawn
         car shifted sideways by a share of the half width, which the probe
         must catch. Zero in play. */
      placeCar(player, carS, SIM.carX + probeOffset * hwAt(carS), SIM.carY, yaw, SIM.carPitch, roll, steer);
      void onTitle;
    }
    // the racers
    const rs = SIM.racers;
    for (let i = 0; i < racers.length; i++) {
      const r = rs[i];
      if (!r || r.wreck > 0) { racers[i].visible = false; continue; }
      const s = r.z + FEEL.CAMERA_DISTANCE;
      if (s < carS - W.BEHIND_SEGMENTS * L + L || s > carS + W.DRAW_SEGMENTS * L) { racers[i].visible = false; continue; }
      placeCar(racers[i], s, r.x, r.y, r.yaw, 0, 0, 0);
    }
    // the ghost
    const gh = SIM.ghost;
    if (gh && gh.shown && gh.live) {
      const s = gh.pos + FEEL.CAMERA_DISTANCE;
      if (s > carS - W.BEHIND_SEGMENTS * L + L && s < carS + W.DRAW_SEGMENTS * L) placeCar(ghost, s, gh.frac * hwAt(s), 0, gh.yawNow, 0, 0, 0);
      else ghost.visible = false;
    } else ghost.visible = false;
  }

  /* ---- for the probes: where things are on screen ---- */
  const V = new THREE.Vector3();
  function project(x, y, z) { V.set(x, y, z).project(camera); return { sx: (V.x + 1) / 2 * view.w, sy: (1 - V.y) / 2 * view.h, depth: V.z, inFront: V.z < 1 && V.z > -1 }; }
  function projectRoad(s, x, y) { roadPoint(P, s, x, y); return project(P.x, P.y, P.z); }

  return {
    ready, render, hooks, camera, scene, renderer,
    setFrameDt(dt) { frameDt = dt; },
    info() { return { backend, tier, pixelRatio: renderer.getPixelRatio(), ms: lastRenderMs, frame: frameNo, drawSegments: W.DRAW_SEGMENTS }; },
    probe: {
      project, projectRoad, roadPoint: (s, x, y) => roadPoint(new THREE.Vector3(), s, x, y), headingAt, hwAt,
      table: () => ({ first: bFirst, count: bCount, idx: bIdx, x: bX, z: bZ, y: bY, h: bH, w: bW, ok: bOk, carIdx, carFrac, carGroundY, carS, absHeading }),
      cars: () => ({ player, racers, ghost }), view, lastContacts,
      strips: { road, marks, paint, walls, terrain, blocks, scenery, city },
      setOffset(v) { probeOffset = v || 0; },
      setBump(seg, dy) { probeBump = { seg: seg === undefined ? -1 : seg, dy: dy || 0 }; },
      /* The nearest thing the world draws along a line, as a distance, or
         Infinity: the road, its walls, the terrain, the blocks. */
      raycast(from, to, which) {
        const f = new THREE.Vector3(from.x, from.y, from.z), t = new THREE.Vector3(to.x, to.y, to.z);
        const dir = t.clone().sub(f); const len = dir.length(); dir.normalize();
        const rc = new THREE.Raycaster(f, dir, 0, len);
        /* the road layer: what can hide the road, a hazard, a gate or a car.
           The ground layer (terrain, walls, scenery, city) is drawn under it
           with the depth cleared between, so it never does; it is listed
           for a probe that asks. */
        const all = { road, walls, terrain, blocks, scenery };
        const names = which || ['road', 'blocks'];
        const meshes = names.map(n => all[n].mesh);
        for (const m of meshes) { m.geometry.computeBoundingSphere(); }
        const hits = rc.intersectObjects(meshes, false);
        if (!hits.length) return Infinity;
        const h = hits[0];
        const strip = names.find(n => all[n].mesh === h.object);
        const q = Math.floor(h.faceIndex / 2);
        const tag = all[strip].tags[q];
        raycastLast = { distance: h.distance, strip, tag: tag ? tag.kind : null, seg: tag ? tag.seg : null };
        return h.distance;
      },
      lastHit() { return raycastLast; },
      /* Rebuild the frame tables and strips for the simulation's state as
         it stands, without the frame function: for sweeps. */
      rebuild(w, h) { update(w || view.w || 390, h || view.h || 844); },
      profile(on) { profile = on ? { road: 0, terrain: 0, paint: 0, blocks: 0, rest: 0, frames: 0, table: 0 } : null; return profile; },
      worldPos(obj) { obj.updateWorldMatrix(true, false); const v = new THREE.Vector3(); obj.getWorldPosition(v); return { x: v.x, y: v.y, z: v.z }; },
      cameraPos() { return { x: camera.position.x, y: camera.position.y, z: camera.position.z }; },
      frustum() { camera.updateMatrixWorld(); const f = new THREE.Frustum(); f.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); return p => f.containsPoint(new THREE.Vector3(p.x, p.y, p.z)); },
      rig: () => (view.h > view.w ? W.PORTRAIT : W.LANDSCAPE),
      W,
    },
    tier: () => tier,
    setTier(t) { if (W.TIERS[t]) { tier = t; applyTier(); } },
  };
}
