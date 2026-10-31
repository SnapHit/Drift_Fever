/* THE TRACK AS MESHES. buildTrackMesh(track, THREE) turns a track from
   generate.js (or the hand made test track) into plain material meshes
   for the lab and the game: the road with its bright edges, kerbs
   through the corners, run-off strips, the start and finish lines, the
   barriers by kind with clipping zones in their own colour, and posts
   marking each zone's ends and apex. Two draw calls for the ground and
   the barriers, vertex coloured, no textures. three.js is passed in so
   this module imports nothing.

   The road follows the track's elevation and bank: a point u metres to
   the left of a sample sits at y - u * tan(bank), and run-off continues
   level from the road edge. Every number of taste is in LOOK. */

export const LOOK = {
  ROAD:          0x3a3b44,
  EDGE:          0xf6e7a1,     // the readability rule: the brightest, most saturated thing on screen
  EDGE_WIDTH:    0.45,         // m either side of the road edge
  KERB_A:        0x7d5753,     // kerbs, muted so the edge stays the brightest thing
  KERB_B:        0x8f8f96,
  KERB_WIDTH:    1.0,          // m, inside the edge line
  KERB_RADIUS:   70,           // m: corners this tight or tighter get kerbs
  RUNOFF:        0x4a4436,     // gravel
  LINE:          0xffffff,     // start and finish
  LINE_DEPTH:    1.0,          // m
  CHECKPOINT:    0x5a5d6a,
  WALL:          0x8f8f99,     // concrete
  WALL_TYRES:    0x3a3f4a,
  WALL_FENCE:    0x6d7380,
  WALL_CLIP:     0xff8a3c,     // a barrier inside a clipping zone, as the scene draws it
  HEIGHT:        { concrete: 1.0, tyres: 0.8, fence: 1.6 },
  THICK:         { concrete: 0.5, tyres: 0.9, fence: 0.12 },
  POST:          0xff8a3c,
  POST_HEIGHT:   2.4,
  POST_SIZE:     0.35,
  LIFT_EDGE:     0.02,         // m above the road, against z fighting
  LIFT_KERB:     0.012,
  LIFT_LINE:     0.016,
};

export function buildTrackMesh(track, THREE) {
  const C = track.centre, n = C.length, closed = track.kind === 'circuit';
  const group = new THREE.Group();
  group.name = 'track';
  if (!n) return group;
  const SAMPLE = 2;

  /* per sample frames */
  const F = C.map(c => {
    const lx = -Math.cos(c.heading), lz = Math.sin(c.heading);
    return { x: c.x, y: c.y || 0, z: c.z, lx, lz, tb: Math.tan(c.bank || 0), hw: c.width / 2 };
  });
  const at = (i, u, lift) => {
    const f = F[i], uc = Math.max(-f.hw, Math.min(f.hw, u));
    return [f.x + f.lx * u, f.y - uc * f.tb + (lift || 0), f.z + f.lz * u];
  };
  const kappa = new Array(n);
  for (let i = 0; i < n; i++) {
    let a = i - 1, b = i + 1, span = 4;
    if (closed) { a = (a + n) % n; b %= n; } else { if (a < 0) { a = 0; span = 2; } if (b >= n) { b = n - 1; span = 2; } }
    let d = C[b].heading - C[a].heading;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    kappa[i] = d / span;
  }

  /* ---- the ground: one vertex coloured mesh ---- */
  const pos = [], col = [];
  const colour = new THREE.Color();
  const tri = (a, b, c, hex) => {
    pos.push(...a, ...b, ...c);
    colour.setHex(hex);
    for (let k = 0; k < 3; k++) col.push(colour.r, colour.g, colour.b);
  };
  /* a quad between samples i and j, from lateral offA (more to the left) to offB */
  const quad = (i, j, offA, offB, hex, lift) => {
    const a1 = at(i, offA(i), lift), a2 = at(i, offB(i), lift), b1 = at(j, offA(j), lift), b2 = at(j, offB(j), lift);
    tri(a1, a2, b1, hex); tri(b1, a2, b2, hex);
  };
  const segCount = closed ? n : n - 1;
  const left = track.walls[0], right = track.walls[1];
  const lateralOf = (w, i, sgn) => { const p = w.points[i], f = F[i]; return ((p.x - f.x) * f.lx + (p.z - f.z) * f.lz) * sgn; };
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % n;
    quad(i, j, k => F[k].hw, k => -F[k].hw, LOOK.ROAD, 0);
    /* run-off, where the barrier stands back from the edge */
    for (const [w, sgn] of [[left, 1], [right, -1]]) {
      if (!w) continue;
      const ui = lateralOf(w, i, sgn), uj = lateralOf(w, j, sgn);
      if (ui - F[i].hw > 0.3 || uj - F[j].hw > 0.3) {
        if (sgn > 0) quad(i, j, k => lateralOf(w, k, 1), k => F[k].hw, LOOK.RUNOFF, -0.005);
        else quad(i, j, k => -F[k].hw, k => -lateralOf(w, k, -1), LOOK.RUNOFF, -0.005);
      }
    }
    /* kerbs through the tighter corners, striped per sample */
    if (Math.abs(kappa[i]) >= 1 / LOOK.KERB_RADIUS && Math.abs(kappa[j]) >= 1 / LOOK.KERB_RADIUS) {
      const hex = i % 2 ? LOOK.KERB_A : LOOK.KERB_B, e = LOOK.EDGE_WIDTH, kw = LOOK.KERB_WIDTH;
      quad(i, j, k => F[k].hw - e, k => F[k].hw - e - kw, hex, LOOK.LIFT_KERB);
      quad(i, j, k => -(F[k].hw - e - kw), k => -(F[k].hw - e), hex, LOOK.LIFT_KERB);
    }
    const e = LOOK.EDGE_WIDTH;
    quad(i, j, k => F[k].hw + e, k => F[k].hw - e, LOOK.EDGE, LOOK.LIFT_EDGE);
    quad(i, j, k => -(F[k].hw - e), k => -(F[k].hw + e), LOOK.EDGE, LOOK.LIFT_EDGE);
  }
  /* lines across the road: start, finish, checkpoints */
  const across = (along, hex, depth) => {
    const i = Math.max(0, Math.min(n - 1, Math.round(along / SAMPLE)));
    const f = F[i], fx = -Math.sin(C[i].heading), fz = -Math.cos(C[i].heading), d = depth / 2;
    const p = (u, s) => { const q = at(i, u, LOOK.LIFT_LINE); return [q[0] + fx * s, q[1], q[2] + fz * s]; };
    const a1 = p(f.hw, -d), a2 = p(-f.hw, -d), b1 = p(f.hw, d), b2 = p(-f.hw, d);
    tri(a1, a2, b1, hex); tri(b1, a2, b2, hex);
  };
  across(track.startLine === undefined ? 8 : track.startLine, LOOK.LINE, LOOK.LINE_DEPTH);
  if (track.finish) across(track.finish.along, LOOK.LINE, LOOK.LINE_DEPTH * 2);
  for (const cp of track.checkpoints || []) across(cp, LOOK.CHECKPOINT, 0.5);

  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.name = 'road';
  ground.frustumCulled = false;
  group.add(ground);

  /* ---- the barriers ---- */
  const wpos = [], wcol = [];
  const wtri = (a, b, c, hex) => { wpos.push(...a, ...b, ...c); colour.setHex(hex); for (let k = 0; k < 3; k++) wcol.push(colour.r, colour.g, colour.b); };
  const wquad = (a, b, c, d, hex) => { wtri(a, b, c, hex); wtri(a, c, d, hex); };
  const box = (p, q, h, t, hex) => {
    const dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz);
    if (len < 1e-6) return;
    const nx = -dz / len * t / 2, nz = dx / len * t / 2;
    const py = p.y || 0, qy = q.y || 0;
    const A = [p.x + nx, py, p.z + nz], B = [q.x + nx, qy, q.z + nz], Bt = [q.x + nx, qy + h, q.z + nz], At = [p.x + nx, py + h, p.z + nz];
    const A2 = [p.x - nx, py, p.z - nz], B2 = [q.x - nx, qy, q.z - nz], B2t = [q.x - nx, qy + h, q.z - nz], A2t = [p.x - nx, py + h, p.z - nz];
    wquad(A, B, Bt, At, hex); wquad(B2, A2, A2t, B2t, hex); wquad(At, Bt, B2t, A2t, hex);
  };
  const kindAt = (w, s) => { for (const sp of w.spans || []) if (s >= sp.from && s < sp.to) return sp.kind; return w.kind || 'concrete'; };
  for (const w of track.walls) {
    const p = w.points;
    for (let i = 0; i + 1 < p.length; i++) {
      const s = i * SAMPLE;
      const kind = w.cap ? w.kind : kindAt(w, s);
      const inClip = !w.cap && track.clips.some(c => c.side === w.side && s >= c.from && s < c.to);
      const hex = inClip ? LOOK.WALL_CLIP : kind === 'tyres' ? LOOK.WALL_TYRES : kind === 'fence' ? LOOK.WALL_FENCE : LOOK.WALL;
      box(p[i], p[i + 1], LOOK.HEIGHT[kind] || 1, LOOK.THICK[kind] || 0.5, hex);
    }
  }
  /* posts at each clipping zone's ends and apex, on the judged barrier */
  const post = (pt, hex) => {
    const s = LOOK.POST_SIZE / 2, h = LOOK.POST_HEIGHT, y = pt.y || 0;
    const c = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([a, b]) => [pt.x + a, pt.z + b]);
    for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; wquad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + h, b[1]], [a[0], y + h, a[1]], hex); }
    wquad([c[0][0], y + h, c[0][1]], [c[3][0], y + h, c[3][1]], [c[2][0], y + h, c[2][1]], [c[1][0], y + h, c[1][1]], hex);
  };
  for (const c of track.clips) {
    const w = track.walls.find(x => x.side === c.side && !x.cap);
    if (!w) continue;
    const marks = c.kind === 'inner' && c.apex !== undefined ? [c.from, c.apex, c.to] : [c.from, c.to];
    for (const s of marks) { const pt = w.points[Math.max(0, Math.min(w.points.length - 1, Math.round(s / SAMPLE)))]; post(pt, LOOK.POST); }
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
  wallGeo.computeVertexNormals();
  const walls = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  walls.name = 'barriers';
  walls.frustumCulled = false;
  group.add(walls);
  group.userData = { triangles: (pos.length + wpos.length) / 9, drawCalls: 2 };
  return group;
}
