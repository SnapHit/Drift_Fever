/* THE STUNT PARK, DRAWN (briefs/PLAYGROUND.md 1 and 3). Everything the
   park's ground (park/layout.js) needs that a track gets from its
   mesh: the slab and its faint bay lines (so the ground moves under the
   car), the outer wall, the pillars and the gates' piers with a beam
   across, the long curved wall in the orange the game already uses for
   a wall worth sliding close to, the paint on the ground at each place
   (the donut rings, the eight's two loops, the cone line, the wall's
   riding lane, the gates' thresholds), and each place's name carried
   high on its own solid as a band of letters, so a place reads from
   across the park and nothing new stands where a car drives. At night
   and in the rain: lamps round the outside with pools of light under
   them, a pool on each place, and the bands and the paint lit.

   A pillar or a pier between the camera and the car fades until the
   car shows through it (FADE), and comes back once it is clear:
   update() does it every frame from the camera and the car's pose, and
   solidsState() says how see-through each is for the sight probe.

   A place whose gold is won is dimmed: setWon({ id: level }).
   No image files: the letters are drawn on canvases. Every number of
   taste is in PARK_LOOK. */
import { buildProps } from './props.js';

export const PARK_LOOK = {
  SLAB:        0x565864,
  BAY:         [0.3, 0.31, 0.35],   // the faint bay lines, linear
  BAY_EVERY:   20,           // m between lines
  BAY_DASH:    [5, 5],       // m of line and of gap
  BAY_WIDTH:   0.16,
  EDGE:        0x3a3f4a,     // the outer wall of tyres
  EDGE_H:      1.0,
  PILLAR:      0xc9ccd6,
  PILLAR_FOOT: 0x23252e,     // a dark foot, so a pillar's base reads against the slab
  FOOT_H:      0.9,
  BAND_H:      2.6,          // m, the band of letters round a pillar's top
  BAND_OUT:    0.22,         // m it stands off the pillar
  BEAM:        [1.3, 1.3],   // m tall and deep, the beam across a gate
  POLE:        { r: 0.14, h: 7.5, band: 1.7 },   // the slim poles that carry a name where there is no pillar (the wall's tips, the cone line): radius, height, and the band's radius
  WALL:        0xff8a3c,     // the long wall: the game's orange for a wall to slide close to
  WALL_TOP:    0x8a4a22,
  PAINT_W:     0.34,         // m, the width of a painted line
  PAINT_Y:     0.03,
  PAINT:       { donut: 0x19d8ff, eight: 0xff2d8a, slalom: 0xffd34d, wall: 0xff8a3c, gate: 0x9be31c, start: 0xe8e4d8 },
  PAINT_GAIN:  { dusk: 0.8, dawn: 0.8, night: 0.95, rain: 0.85 },   // unlit paint: how bright under each time of day
  BAND_GAIN:   { dusk: 0.95, dawn: 0.95, night: 1.0, rain: 0.95 },
  WON_DIM:     0.3,          // a place whose gold is won: its band and its paint at this share
  FADE:        { to: 0.16, time: 0.07, pad: 0.9, clear: 0.35 },   // a solid in the way: the opacity it falls to, the s it takes, the m round the sight line that counts as in the way, and the opacity under which the probe calls the car seen through it
  LAMP_EVERY:  50,           // m between lamps round the outside
  LAMP_BACK:   3.5,          // m outside the wall
  LAMP_HEAD:   [0, 7.95, -1.2],
  POOL:        { lamp: 16, place: 34, gain: { night: 0.05, rain: 0.03 }, colour: [1.0, 0.78, 0.5], lift: 0.045 },
  FLARE:       { size: 0.75, colour: [1.5, 1.17, 0.75], alpha: { night: 0.9, rain: 0.6 }, range: 320 },
  NAMES:       { donut: 'DONUTS', eight: 'EIGHT', 'gate-a': 'GATE', 'gate-b': 'NARROW', wall: 'WALL RIDE', slalom: 'SLALOM' },
};

/* which challenge a place's band belongs to, for the dimming */
const CHALLENGE_OF = { donut: 'donut', eight: 'eight', 'gate-a': 'gate', 'gate-b': 'gate', wall: 'wall', slalom: 'slalom' };
const paintOf = place => PARK_LOOK.PAINT[place.startsWith('gate') ? 'gate' : place];

/* a band of letters: the name twice round, in the place's colour on dark */
function bandTexture(THREE, text, hex) {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 256;
  const g = c.getContext('2d'), col = '#' + hex.toString(16).padStart(6, '0');
  g.fillStyle = '#10121c'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = col; g.fillRect(0, 0, c.width, 26); g.fillRect(0, c.height - 26, c.width, 26);
  g.font = '900 150px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k < 2; k++) { g.fillStyle = col; g.fillText(text, c.width / 2 * (k + 0.5), c.height / 2 + 8, c.width / 2 - 70); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export function buildPark(THREE, ground, o) {
  const K = PARK_LOOK, G = ground.park, b = ground.bounds, preset = o.preset, dark = !!preset.lamps;
  const group = new THREE.Group(); group.name = 'park';
  const disposables = [];
  const keep = x => { disposables.push(x); return x; };
  const info = { lamps: 0, pools: 0, bands: 0 };

  /* ---- the slab ---- */
  {
    const geo = keep(new THREE.PlaneGeometry(b.maxX - b.minX, b.maxZ - b.minZ));
    const mat = keep(preset.wet ? new THREE.MeshStandardMaterial({ color: K.SLAB, roughness: 0.35 }) : new THREE.MeshLambertMaterial({ color: K.SLAB }));
    const slab = new THREE.Mesh(geo, mat);
    slab.rotation.x = -Math.PI / 2; slab.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2); slab.receiveShadow = true; slab.name = 'park:slab';
    group.add(slab);
  }

  /* ---- paint: quads on the ground, one mesh, unlit so it reads under any light ---- */
  const pos = [], col = [], tag = [];   // tag: which place each vertex belongs to, for the dimming
  const c3 = new THREE.Color();
  const places = ['bay', 'start', 'donut', 'eight', 'slalom', 'wall', 'gate'];
  function quad(p0, p1, p2, p3, rgb, place) { for (const p of [p0, p1, p2, p0, p2, p3]) { pos.push(p[0], K.PAINT_Y, p[1]); col.push(rgb[0], rgb[1], rgb[2]); tag.push(places.indexOf(place)); } }
  const rgbOf = hex => { c3.setHex(hex); return [c3.r, c3.g, c3.b]; };
  function stroke(x0, z0, x1, z1, w, rgb, place) {
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
    quad([x0 + nx, z0 + nz], [x1 + nx, z1 + nz], [x1 - nx, z1 - nz], [x0 - nx, z0 - nz], rgb, place);
  }
  function ring(cx, cz, r, w, rgb, place, a0, a1, dash) {
    const from = a0 === undefined ? 0 : a0, to = a1 === undefined ? Math.PI * 2 : a1, n = Math.max(8, Math.round(Math.abs(to - from) * r / 2.2));
    for (let k = 0; k < n; k++) {
      if (dash && k % 2) continue;
      const a = from + (to - from) * k / n, c = from + (to - from) * (k + 1) / n;
      quad([cx + Math.cos(a) * (r - w / 2), cz + Math.sin(a) * (r - w / 2)], [cx + Math.cos(c) * (r - w / 2), cz + Math.sin(c) * (r - w / 2)], [cx + Math.cos(c) * (r + w / 2), cz + Math.sin(c) * (r + w / 2)], [cx + Math.cos(a) * (r + w / 2), cz + Math.sin(a) * (r + w / 2)], rgb, place);
    }
  }
  /* the bay lines: faint dashes both ways */
  for (let x = Math.ceil((b.minX + 10) / K.BAY_EVERY) * K.BAY_EVERY; x < b.maxX - 5; x += K.BAY_EVERY) for (let z = b.minZ + 6; z < b.maxZ - 6 - K.BAY_DASH[0]; z += K.BAY_DASH[0] + K.BAY_DASH[1]) stroke(x, z, x, z + K.BAY_DASH[0], K.BAY_WIDTH, K.BAY, 'bay');
  for (let z = Math.ceil((b.minZ + 10) / K.BAY_EVERY) * K.BAY_EVERY; z < b.maxZ - 5; z += K.BAY_EVERY) for (let x = b.minX + 6; x < b.maxX - 6 - K.BAY_DASH[0]; x += K.BAY_DASH[0] + K.BAY_DASH[1]) stroke(x, z, x + K.BAY_DASH[0], z, K.BAY_WIDTH, K.BAY, 'bay');
  /* the start: a box round the car */
  { const s = ground.start, rgb = rgbOf(K.PAINT.start), w = 1.9, l = 3.2; stroke(s.x - w, s.z - l, s.x + w, s.z - l, 0.2, rgb, 'start'); stroke(s.x - w, s.z - l, s.x - w, s.z + l, 0.2, rgb, 'start'); stroke(s.x + w, s.z - l, s.x + w, s.z + l, 0.2, rgb, 'start'); }
  /* the donut pad: its rings */
  { const rgb = rgbOf(K.PAINT.donut); G.donut.rings.forEach((r, i) => ring(G.donut.x, G.donut.z, r, K.PAINT_W * (i === 0 ? 1.6 : 1), rgb, 'donut', undefined, undefined, i === 2)); }
  /* the figure eight: a loop round each pillar, meeting between them */
  { const rgb = rgbOf(K.PAINT.eight), E = G.eight, r = Math.hypot(E.b.x - E.a.x, E.b.z - E.a.z) / 2; ring(E.a.x, E.a.z, r, K.PAINT_W, rgb, 'eight'); ring(E.b.x, E.b.z, r, K.PAINT_W, rgb, 'eight'); }
  /* the cone line: a dashed line through the cones and a tick each side of every cone, where to pass */
  {
    const rgb = rgbOf(K.PAINT.slalom), S = G.slalom, x0 = S.x[0] - 14, x1 = S.x[S.n - 1] + 14;
    for (let x = x0; x < x1; x += 6) stroke(x, S.z, Math.min(x1, x + 3), S.z, K.PAINT_W * 0.7, rgb, 'slalom');
    S.x.forEach((x, i) => { const s = i % 2 ? 1 : -1; for (const k of [0, 1, 2]) { const z = S.z + s * (3 + k * 1.5); stroke(x - 1.6 + k * 0.4, z, x, z + s * 1.0, K.PAINT_W * 0.8, rgb, 'slalom'); stroke(x + 1.6 - k * 0.4, z, x, z + s * 1.0, K.PAINT_W * 0.8, rgb, 'slalom'); } });
  }
  /* the long wall: the edge of its riding lane, o.wallNear from its inside face */
  { const rgb = rgbOf(K.PAINT.wall), W = G.wall; ring(W.x, W.z, W.r - W.half - (o.wallNear || 2.5) - 1.8, K.PAINT_W, rgb, 'wall', W.a0, W.a1, true); }
  /* the gates: a threshold across the gap and chevrons pointing in from both sides */
  for (const g of G.gates) {
    const rgb = rgbOf(K.PAINT.gate), ax = g.along === 'z' ? 1 : 0, az = 1 - ax, h = g.gap / 2;
    stroke(g.x - ax * h, g.z - az * h, g.x + ax * h, g.z + az * h, K.PAINT_W * 1.5, rgb, 'gate');
    for (const s of [-1, 1]) for (const k of [1, 2, 3]) {
      const d = s * (4 + k * 3.2), tx = g.x + az * d, tz = g.z + ax * d, bx = g.x + az * (d + s * 1.6), bz = g.z + ax * (d + s * 1.6);
      stroke(bx - ax * 1.7, bz - az * 1.7, tx, tz, K.PAINT_W, rgb, 'gate'); stroke(bx + ax * 1.7, bz + az * 1.7, tx, tz, K.PAINT_W, rgb, 'gate');
    }
  }
  const paintGeo = keep(new THREE.BufferGeometry());
  paintGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const base = new Float32Array(col), colours = new THREE.Float32BufferAttribute(col, 3);
  paintGeo.setAttribute('color', colours);
  const paintMat = keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true }));
  paintMat.color.setScalar(K.PAINT_GAIN[preset.name] || 0.8);
  const paint = new THREE.Mesh(paintGeo, paintMat); paint.name = 'park:paint'; paint.frustumCulled = false; paint.renderOrder = 1;
  group.add(paint);
  info.paintTriangles = pos.length / 9;

  /* ---- the outer wall and the long wall ---- */
  function wallStrip(points, h, colour, lit, name) {
    const list = [];
    for (let i = 0; i + 1 < points.length; i++) {
      const p = points[i], q = points[i + 1];
      list.push(p.x, 0, p.z, q.x, 0, q.z, q.x, h, q.z, p.x, 0, p.z, q.x, h, q.z, p.x, h, p.z);
    }
    const geo = keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.Float32BufferAttribute(list, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, keep(new THREE.MeshLambertMaterial({ color: colour, side: THREE.DoubleSide, emissive: colour, emissiveIntensity: lit ? (dark ? 0.35 : 0.08) : 0 })));
    m.name = name; m.castShadow = true; m.receiveShadow = true; group.add(m);
    return m;
  }
  {
    /* the tyres: a band half a metre through, as the car park's was */
    const ring0 = ground.walls.find(w => w.place === 'edge').points, t = 0.5;
    const inner = ring0.map(p => ({ x: p.x, z: p.z })), outer = ring0.map(p => ({ x: p.x + Math.sign(p.x) * t, z: p.z + Math.sign(p.z) * t }));
    wallStrip(inner, K.EDGE_H, K.EDGE, false, 'park:edge'); wallStrip(outer, K.EDGE_H, K.EDGE, false, 'park:edge');
    const cap = []; for (let i = 0; i + 1 < inner.length; i++) { const a = inner[i], c = inner[i + 1], d = outer[i + 1], e = outer[i]; cap.push(a.x, K.EDGE_H, a.z, c.x, K.EDGE_H, c.z, d.x, K.EDGE_H, d.z, a.x, K.EDGE_H, a.z, d.x, K.EDGE_H, d.z, e.x, K.EDGE_H, e.z); }
    const geo = keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.Float32BufferAttribute(cap, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, keep(new THREE.MeshLambertMaterial({ color: K.EDGE, side: THREE.DoubleSide }))); m.name = 'park:edge'; group.add(m);
  }
  {
    const lw = ground.walls.find(w => w.place === 'wall'), W = G.wall;
    wallStrip(lw.points, W.h, K.WALL, true, 'park:longwall');
    /* its top: a strip along the curve between its two faces, and a half disc over each round tip */
    const top = [], n = 48, at = (a, r) => [W.x + Math.cos(a) * r, W.h, W.z + Math.sin(a) * r];
    for (let k = 0; k < n; k++) {
      const a = W.a0 + (W.a1 - W.a0) * k / n, c = W.a0 + (W.a1 - W.a0) * (k + 1) / n;
      top.push(...at(a, W.r - W.half), ...at(c, W.r - W.half), ...at(c, W.r + W.half), ...at(a, W.r - W.half), ...at(c, W.r + W.half), ...at(a, W.r + W.half));
    }
    for (const [t, a0] of [[W.tips[0], W.a0 + Math.PI], [W.tips[1], W.a1]]) for (let k = 0; k < 8; k++) {
      const a = a0 + k / 8 * Math.PI, c = a0 + (k + 1) / 8 * Math.PI;
      top.push(t.x, W.h, t.z, t.x + Math.cos(a) * W.half, W.h, t.z + Math.sin(a) * W.half, t.x + Math.cos(c) * W.half, W.h, t.z + Math.sin(c) * W.half);
    }
    const geo = keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.Float32BufferAttribute(top, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, keep(new THREE.MeshLambertMaterial({ color: K.WALL_TOP, side: THREE.DoubleSide }))); m.name = 'park:longwall-top'; m.receiveShadow = true; group.add(m);
  }

  /* ---- the round solids, each its own materials so each can fade ---- */
  const bands = [];     // { place, mat }: for the dimming
  const solids = [];    // { id, x, z, r, h, opacity, mats }
  function band(place, x, y, z, r, h) {
    const tex = keep(bandTexture(THREE, K.NAMES[place], paintOf(place)));
    const mat = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: true, side: THREE.DoubleSide }));
    mat.color.setScalar(K.BAND_GAIN[preset.name] || 0.95);
    const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(r, r, h, 28, 1, true)), mat);
    m.position.set(x, y, z); m.name = 'park:band'; m.renderOrder = 2; group.add(m);
    bands.push({ place, mat, gain: K.BAND_GAIN[preset.name] || 0.95 }); info.bands++;
    return mat;
  }
  for (const s of G.solids) {
    const body = keep(new THREE.MeshLambertMaterial({ color: K.PILLAR, transparent: true })), foot = keep(new THREE.MeshLambertMaterial({ color: K.PILLAR_FOOT, transparent: true }));
    const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(s.r, s.r, s.h - K.FOOT_H, 20)), body);
    m.position.set(s.x, K.FOOT_H + (s.h - K.FOOT_H) / 2, s.z); m.castShadow = true; m.receiveShadow = true; m.name = 'park:pillar'; m.renderOrder = 2; group.add(m);
    const f = new THREE.Mesh(keep(new THREE.CylinderGeometry(s.r + 0.02, s.r + 0.02, K.FOOT_H, 20)), foot);
    f.position.set(s.x, K.FOOT_H / 2, s.z); f.castShadow = true; f.name = 'park:pillar'; f.renderOrder = 2; group.add(f);
    const mats = [body, foot];
    /* the donut pillar and the eight's two carry their name; a gate's name is on its beam */
    if (!s.place.startsWith('gate')) mats.push(band(s.place, s.x, s.h - K.BAND_H / 2 - 0.25, s.z, s.r + K.BAND_OUT, K.BAND_H));
    solids.push({ id: s.id, x: s.x, z: s.z, r: s.r, h: s.h, place: s.place, opacity: 1, mats });
  }
  /* the gates' beams, lettered both sides, fading with their piers */
  for (const g of G.gates) {
    const place = 'gate-' + g.id, len = g.gap + 4 * g.piers.length, tex = keep(bandTexture(THREE, K.NAMES[place], paintOf(place)));
    tex.repeat.set(1 / 2, 1);
    const face = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: true })), side = keep(new THREE.MeshLambertMaterial({ color: K.PILLAR_FOOT, transparent: true }));
    face.color.setScalar(K.BAND_GAIN[preset.name] || 0.95);
    const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(len, K.BEAM[0], K.BEAM[1])), [side, side, side, side, face, face]);
    beam.position.set(g.x, g.h - K.BEAM[0] / 2, g.z); if (g.along === 'x') beam.rotation.y = Math.PI / 2;
    beam.castShadow = true; beam.name = 'park:beam'; beam.renderOrder = 2; group.add(beam);
    bands.push({ place, mat: face, gain: K.BAND_GAIN[preset.name] || 0.95 }); info.bands++;
    for (const s of solids) if (s.place === place) s.mats.push(face, side);
  }
  /* a slim pole with a band where a place has no pillar: one on each tip of the long wall, one behind the middle of the cone line */
  function pole(place, x, z, y0) {
    const P = K.POLE, m = new THREE.Mesh(keep(new THREE.CylinderGeometry(P.r, P.r, P.h - y0, 8)), keep(new THREE.MeshLambertMaterial({ color: K.PILLAR })));
    m.position.set(x, y0 + (P.h - y0) / 2, z); m.name = 'park:pole'; group.add(m);
    band(place, x, P.h - K.BAND_H / 2, z, P.band, K.BAND_H);
  }
  for (const t of G.wall.tips) pole('wall', t.x, t.z, G.wall.h);
  { const S = G.slalom; pole('slalom', (S.x[0] + S.x[S.n - 1]) / 2, S.z - 16, 0); }

  /* ---- the lamps round the outside, and the pools of light ---- */
  const lights = [];
  if (dark) {
    const props = buildProps(THREE, o.theme, 3), list = [];
    const per = (x0, z0, x1, z1, nx, nz) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / K.LAMP_EVERY); for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; list.push({ x: x0 + (x1 - x0) * t + nx * K.LAMP_BACK, z: z0 + (z1 - z0) * t + nz * K.LAMP_BACK, ry: Math.atan2(nx, nz) }); } };
    per(b.minX, b.minZ, b.maxX, b.minZ, 0, -1); per(b.maxX, b.minZ, b.maxX, b.maxZ, 1, 0); per(b.maxX, b.maxZ, b.minX, b.maxZ, 0, 1); per(b.minX, b.maxZ, b.minX, b.minZ, -1, 0);
    if (props.lamp) {
      const bodyM = keep(new THREE.MeshLambertMaterial({ vertexColors: true })), headM = keep(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 2.4 }));
      const body = new THREE.InstancedMesh(props.lamp.body, bodyM, list.length), head = new THREE.InstancedMesh(props.lamp.lit, headM, list.length);
      body.name = 'park:lamp'; head.name = 'park:lamphead'; body.frustumCulled = head.frustumCulled = false;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      list.forEach((l, j) => { e.set(0, l.ry, 0); q.setFromEuler(e); v.set(l.x, 0, l.z); m4.compose(v, q, one); body.setMatrixAt(j, m4); head.setMatrixAt(j, m4); });
      body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true;
      group.add(body, head); keep(props.lamp.body); keep(props.lamp.lit);
      info.lamps = list.length;
      for (const l of list) lights.push({ x: l.x + Math.sin(l.ry) * K.LAMP_HEAD[2], y: K.LAMP_HEAD[1], z: l.z + Math.cos(l.ry) * K.LAMP_HEAD[2], foot: { x: l.x - Math.sin(l.ry) * (K.LAMP_BACK + 5), z: l.z - Math.cos(l.ry) * (K.LAMP_BACK + 5) }, r: K.POOL.lamp });
    }
    for (const kind of Object.keys(props)) if (kind !== 'lamp') { if (props[kind].body) props[kind].body.dispose(); if (props[kind].lit) props[kind].lit.dispose(); }
    /* a pool on each place, as if lit from its own pillar */
    const E = G.eight, S = G.slalom, pools = lights.map(l => ({ x: l.foot.x, z: l.foot.z, r: l.r }));
    pools.push({ x: G.donut.x, z: G.donut.z, r: K.POOL.place }, { x: E.a.x, z: E.a.z, r: K.POOL.place }, { x: E.b.x, z: E.b.z, r: K.POOL.place }, { x: G.wall.x, z: G.wall.z, r: K.POOL.place }, { x: ground.start.x, z: ground.start.z, r: K.POOL.lamp * 1.3 });
    for (const g of G.gates) pools.push({ x: g.x, z: g.z, r: K.POOL.lamp * 1.4 });
    for (let i = 0; i < S.n; i += 2) pools.push({ x: S.x[i], z: S.z, r: K.POOL.lamp * 1.3 });
    const pp = [], uv = [];
    for (const p of pools) { const y = K.POOL.lift; for (const [u, w] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { pp.push(p.x + (u * 2 - 1) * p.r, y, p.z + (w * 2 - 1) * p.r); uv.push(u, w); } }
    const geo = keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const T = THREE.TSL, mat = keep(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, side: THREE.DoubleSide }));
    const gain = K.POOL.gain[preset.name] || 0.04, fall = T.float(1).sub(T.uv().sub(0.5).length().mul(2)).max(0);
    mat.colorNode = T.vec3(K.POOL.colour[0] * gain, K.POOL.colour[1] * gain, K.POOL.colour[2] * gain).mul(fall.mul(fall));
    const mesh = new THREE.Mesh(geo, mat); mesh.name = 'park:pools'; mesh.renderOrder = 3; mesh.frustumCulled = false; group.add(mesh);
    info.pools = pools.length;
    /* and a light on top of every pillar and pier, for the flares */
    for (const s of solids) lights.push({ x: s.x, y: s.h + 0.3, z: s.z, r: 0 });
  }

  /* ---- per frame: a solid between the camera and the car fades ---- */
  let fadeOn = true;
  function update(dt, camera, pose) {
    const F = K.FADE, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, px = pose.x, py = (pose.y || 0) + 0.7, pz = pose.z;
    const dx = px - cx, dz = pz - cz, l2 = dx * dx + dz * dz || 1;
    for (const s of solids) {
      let want = 1;
      if (fadeOn) {
        const t = ((s.x - cx) * dx + (s.z - cz) * dz) / l2;
        if (t > -0.05 && t < 1.05) {
          const tc = t < 0 ? 0 : t > 1 ? 1 : t, d = Math.hypot(s.x - (cx + dx * tc), s.z - (cz + dz * tc));
          if (d < s.r + F.pad && cy + (py - cy) * tc < s.h + 0.5) want = F.to;
        }
      }
      if (s.opacity !== want) {
        const k = dt > 0 ? Math.min(1, dt / F.time) : 1;
        s.opacity += (want - s.opacity) * k; if (Math.abs(s.opacity - want) < 0.01) s.opacity = want;
        for (const m of s.mats) m.opacity = s.opacity;
      }
    }
  }
  /* the flares on the lamps and the pillars' tops, through the show's glows */
  function flares(glows, camera) {
    if (!dark || !glows) return;
    const F = K.FLARE, a = F.alpha[preset.name] || 0.7, cp = camera.position;
    for (const l of lights) { const d = Math.hypot(l.x - cp.x, l.z - cp.z); if (d < F.range) glows.add(l.x, l.y, l.z, F.size, F.colour[0], F.colour[1], F.colour[2], a * (1 - d / F.range * 0.5)); }
  }
  /* a place whose gold is won goes dim: its band and its paint */
  const state = { won: {} };
  function setWon(won) {
    const gold = id => !!won && won[id] >= 3;
    for (const bd of bands) bd.mat.color.setScalar(bd.gain * (gold(CHALLENGE_OF[bd.place]) ? K.WON_DIM : 1));
    const arr = colours.array;
    for (let i = 0; i < tag.length; i++) { const k = gold(places[tag[i]]) ? K.WON_DIM : 1; arr[i * 3] = base[i * 3] * k; arr[i * 3 + 1] = base[i * 3 + 1] * k; arr[i * 3 + 2] = base[i * 3 + 2] * k; }
    colours.needsUpdate = true;
    state.won = Object.assign({}, won || {});
  }
  return {
    group, update, flares, setWon, info, lights, state,
    solidsState: () => solids.map(s => ({ id: s.id, x: s.x, z: s.z, r: s.r, h: s.h, opacity: s.opacity })),
    bandsState: () => bands.map(bd => ({ place: bd.place, gain: bd.mat.color.r })),
    setFade(on) { fadeOn = !!on; },
    dispose() { for (const d of disposables) if (d && d.dispose) d.dispose(); },
  };
}
