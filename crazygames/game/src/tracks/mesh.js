/* THE TRACK AS MESHES. buildTrackMesh(track, THREE) turns a track from
   generate.js (or the hand made test track) into plain material meshes
   for the lab and the game, one mesh per kind of thing, each named for
   what it is so a scene can restyle the track by replacing materials by
   name:

     road     the asphalt
     edge     the bright edge lines (the readability rule)
     kerb     the striped kerbs through the tighter corners
     runoff   gravel where a barrier stands back from the edge
     line     the start, the finish and the checkpoints
     wall     the barriers outside clipping zones, vertex coloured by kind
     clip     the barriers inside clipping zones and the posts at each
              zone's ends and apex
     bridge   a crossover's deck: its underside, its sides and the
              supports at its ends
     ramp     the embankment where the track climbs to a bridge and
              falls from it
     cut      the earth walls where the lower road dips beneath a bridge

   Every mesh is vertex coloured (a replacement material wants
   vertexColors on, or its own colour) and all are one group named
   track. No textures, and three.js is passed in so this module imports
   nothing.

   The road follows the track's elevation and bank: a point u metres to
   the left of a sample sits at y - u * tan(bank), and run-off continues
   level from the road edge. Every number of taste is in LOOK. */

export const LOOK = {
  ROAD:          0x3a3b44,
  EDGE:          0xf6e7a1,     // the readability rule: the brightest, most saturated thing on screen
  EDGE_WIDTH:    0.45,         // m, half the edge line's width
  EDGE_INSET:    0.25,         // m the edge line stands in from the road edge: a barrier on the edge is 0.5 m thick and would hide its outer half
  KERB_A:        0x7d5753,     // kerbs, muted so the edge stays the brightest thing
  KERB_B:        0x8f8f96,
  KERB_WIDTH:    1.0,          // m, inside the edge line
  KERB_RADIUS:   70,           // m: corners this tight or tighter get kerbs
  RUNOFF:        0x4a4436,     // gravel
  LINE:          0xffffff,     // start and finish
  LINE_DEPTH:    1.0,          // m
  CHECKPOINT:    0x5a5d6a,
  WALL:          0x7a7a84,     // concrete (was 0x8f8f99: a sunlit barrier came within 1.35 times of the edge line's brightness)
  WALL_TYRES:    0x3a3f4a,
  WALL_FENCE:    0x6d7380,
  WALL_CLIP:     0xc25a26,     // a barrier inside a clipping zone, as the scene draws it (was 0xff8a3c: with longer corners its long sunlit runs came within 1.35 times of the edge line)
  HEIGHT:        { concrete: 1.0, tyres: 0.8, fence: 1.6 },
  THICK:         { concrete: 0.5, tyres: 0.9, fence: 0.12 },
  POST:          0xff8a3c,
  POST_HEIGHT:   2.4,
  POST_SIZE:     0.35,
  BRIDGE:        0x5c5f6b,     // the deck's concrete
  BRIDGE_DARK:   0x44464f,     // its underside
  DECK_THICK:    0.7,          // m, the deck's slab
  WALL_FOOT:     1.2,          // m a barrier reaches below its base, into the ground the scenery lowers beside the road (env/terrain.js UNDER_ROAD)
  PILLAR:        0.9,          // m square
  RAMP:          0x3f4a3a,     // the embankment's earth
  RAMP_SLOPE:    1.2,          // m out per m up (the embankment's foot)
  CUT:           0x4a4a3f,     // the cutting's earth
  CUT_SLOPE:     0.8,          // m out per m down
  GROUND:        0,            // m, the level the embankments and cuttings meet
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

  /* ---- the parts: one vertex coloured mesh each ---- */
  const parts = {};
  const colour = new THREE.Color();
  const part = name => parts[name] || (parts[name] = { pos: [], col: [] });
  const tri = (name, a, b, c, hex) => {
    const p = part(name);
    p.pos.push(...a, ...b, ...c);
    colour.setHex(hex);
    for (let k = 0; k < 3; k++) p.col.push(colour.r, colour.g, colour.b);
  };
  const quad4 = (name, a, b, c, d, hex) => { tri(name, a, b, c, hex); tri(name, a, c, d, hex); };
  /* a quad between samples i and j, from lateral offA (more to the left) to offB */
  const quad = (name, i, j, offA, offB, hex, lift) => {
    const a1 = at(i, offA(i), lift), a2 = at(i, offB(i), lift), b1 = at(j, offA(j), lift), b2 = at(j, offB(j), lift);
    tri(name, a1, a2, b1, hex); tri(name, b1, a2, b2, hex);
  };
  const segCount = closed ? n : n - 1;
  const left = track.walls[0], right = track.walls[1];
  const lateralOf = (w, i, sgn) => { const p = w.points[i], f = F[i]; return ((p.x - f.x) * f.lx + (p.z - f.z) * f.lz) * sgn; };
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % n;
    quad('road', i, j, k => F[k].hw, k => -F[k].hw, LOOK.ROAD, 0);
    /* run-off, where the barrier stands back from the edge */
    for (const [w, sgn] of [[left, 1], [right, -1]]) {
      if (!w) continue;
      const ui = lateralOf(w, i, sgn), uj = lateralOf(w, j, sgn);
      if (ui - F[i].hw > 0.3 || uj - F[j].hw > 0.3) {
        if (sgn > 0) quad('runoff', i, j, k => lateralOf(w, k, 1), k => F[k].hw, LOOK.RUNOFF, -0.005);
        else quad('runoff', i, j, k => -F[k].hw, k => -lateralOf(w, k, -1), LOOK.RUNOFF, -0.005);
      }
    }
    /* kerbs through the tighter corners, striped per sample */
    if (Math.abs(kappa[i]) >= 1 / LOOK.KERB_RADIUS && Math.abs(kappa[j]) >= 1 / LOOK.KERB_RADIUS) {
      const hex = i % 2 ? LOOK.KERB_A : LOOK.KERB_B, e = LOOK.EDGE_INSET + 2 * LOOK.EDGE_WIDTH, kw = LOOK.KERB_WIDTH;
      quad('kerb', i, j, k => F[k].hw - e, k => F[k].hw - e - kw, hex, LOOK.LIFT_KERB);
      quad('kerb', i, j, k => -(F[k].hw - e - kw), k => -(F[k].hw - e), hex, LOOK.LIFT_KERB);
    }
    /* the edge line, wholly inside the road and clear of a barrier standing on its edge */
    const eo = LOOK.EDGE_INSET, ei = LOOK.EDGE_INSET + 2 * LOOK.EDGE_WIDTH;
    quad('edge', i, j, k => F[k].hw - eo, k => F[k].hw - ei, LOOK.EDGE, LOOK.LIFT_EDGE);
    quad('edge', i, j, k => -(F[k].hw - ei), k => -(F[k].hw - eo), LOOK.EDGE, LOOK.LIFT_EDGE);
  }
  /* lines across the road: start, finish, checkpoints */
  const across = (along, hex, depth) => {
    const i = Math.max(0, Math.min(n - 1, Math.round(along / SAMPLE)));
    const f = F[i], fx = -Math.sin(C[i].heading), fz = -Math.cos(C[i].heading), d = depth / 2;
    const p = (u, s) => { const q = at(i, u, LOOK.LIFT_LINE); return [q[0] + fx * s, q[1], q[2] + fz * s]; };
    const a1 = p(f.hw, -d), a2 = p(-f.hw, -d), b1 = p(f.hw, d), b2 = p(-f.hw, d);
    tri('line', a1, a2, b1, hex); tri('line', b1, a2, b2, hex);
  };
  across(track.startLine === undefined ? 8 : track.startLine, LOOK.LINE, LOOK.LINE_DEPTH);
  if (track.finish) across(track.finish.along, LOOK.LINE, LOOK.LINE_DEPTH * 2);
  for (const cp of track.checkpoints || []) across(cp, LOOK.CHECKPOINT, 0.5);

  /* ---- the barriers ---- */
  const box = (name, p, q, h, t, hex) => {
    const dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz);
    if (len < 1e-6) return;
    const nx = -dz / len * t / 2, nz = dx / len * t / 2;
    const py = p.y || 0, qy = q.y || 0, f = LOOK.WALL_FOOT;
    const A = [p.x + nx, py - f, p.z + nz], B = [q.x + nx, qy - f, q.z + nz], Bt = [q.x + nx, qy + h, q.z + nz], At = [p.x + nx, py + h, p.z + nz];
    const A2 = [p.x - nx, py - f, p.z - nz], B2 = [q.x - nx, qy - f, q.z - nz], B2t = [q.x - nx, qy + h, q.z - nz], A2t = [p.x - nx, py + h, p.z - nz];
    quad4(name, A, B, Bt, At, hex); quad4(name, B2, A2, A2t, B2t, hex); quad4(name, At, Bt, B2t, A2t, hex);
  };
  const kindAt = (w, s) => { for (const sp of w.spans || []) if (s >= sp.from && s < sp.to) return sp.kind; return w.kind || 'concrete'; };
  for (const w of track.walls) {
    const p = w.points;
    for (let i = 0; i + 1 < p.length; i++) {
      const s = i * SAMPLE;
      const kind = w.cap ? w.kind : kindAt(w, s);
      const inClip = !w.cap && track.clips.some(c => c.side === w.side && s >= c.from && s < c.to);
      const hex = inClip ? LOOK.WALL_CLIP : kind === 'tyres' ? LOOK.WALL_TYRES : kind === 'fence' ? LOOK.WALL_FENCE : LOOK.WALL;
      box(inClip ? 'clip' : 'wall', p[i], p[i + 1], LOOK.HEIGHT[kind] || 1, LOOK.THICK[kind] || 0.5, hex);
    }
  }
  /* posts at each clipping zone's ends and apex, on the judged barrier */
  const post = (pt, hex) => {
    const s = LOOK.POST_SIZE / 2, h = LOOK.POST_HEIGHT, y = pt.y || 0;
    const c = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([a, b]) => [pt.x + a, pt.z + b]);
    for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; quad4('clip', [a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + h, b[1]], [a[0], y + h, a[1]], hex); }
    quad4('clip', [c[0][0], y + h, c[0][1]], [c[3][0], y + h, c[3][1]], [c[2][0], y + h, c[2][1]], [c[1][0], y + h, c[1][1]], hex);
  };
  for (const c of track.clips) {
    const w = track.walls.find(x => x.side === c.side && !x.cap);
    if (!w) continue;
    const marks = c.kind === 'inner' && c.apex !== undefined ? [c.from, c.apex, c.to] : [c.from, c.to];
    for (const s of marks) { const pt = w.points[Math.max(0, Math.min(w.points.length - 1, Math.round(s / SAMPLE)))]; post(pt, LOOK.POST); }
  }

  /* ---- the bridge, its ramps and the cut beneath it ---- */
  if (left && right && C.some(c => c.part)) {
    const G = LOOK.GROUND;
    const wp = (w, i) => w.points[i];
    const outward = (w, i, sgn) => { const f = F[i]; return [f.lx * sgn, f.lz * sgn]; };   // away from the road, for a wall on side sgn (1 left)
    const deckAt = i => C[i].part === 'deck';
    for (let i = 0; i < segCount; i++) {
      const j = (i + 1) % n;
      const pi = C[i].part, pj = C[j].part;
      if (!pi && !pj) continue;
      const L0 = wp(left, i), L1 = wp(left, j), R0 = wp(right, i), R1 = wp(right, j);
      if (deckAt(i) && deckAt(j)) {
        /* the slab: underside and sides between the walls' bases */
        const t = LOOK.DECK_THICK;
        const u = p => [p.x, (p.y || 0) - t, p.z];
        quad4('bridge', u(L0), u(R0), u(R1), u(L1), LOOK.BRIDGE_DARK);
        quad4('bridge', [L0.x, L0.y, L0.z], [L1.x, L1.y, L1.z], u(L1), u(L0), LOOK.BRIDGE);
        quad4('bridge', [R1.x, R1.y, R1.z], [R0.x, R0.y, R0.z], u(R0), u(R1), LOOK.BRIDGE);
      } else {
        for (const [w, sgn, P0, P1] of [[left, 1, L0, L1], [right, -1, R0, R1]]) {
          const y0 = P0.y || 0, y1 = P1.y || 0;
          const [ox0, oz0] = outward(w, i, sgn), [ox1, oz1] = outward(w, j, sgn);
          if ((pi === 'ramp' || pi === 'deck' || pj === 'ramp' || pj === 'deck') && (y0 > G + 0.05 || y1 > G + 0.05)) {
            /* the embankment: from the wall's base down and out to the ground */
            const s = LOOK.RAMP_SLOPE;
            const f0 = [P0.x + ox0 * Math.max(0, y0 - G) * s, G, P0.z + oz0 * Math.max(0, y0 - G) * s], f1 = [P1.x + ox1 * Math.max(0, y1 - G) * s, G, P1.z + oz1 * Math.max(0, y1 - G) * s];
            if (sgn > 0) quad4('ramp', [P0.x, y0, P0.z], f0, f1, [P1.x, y1, P1.z], LOOK.RAMP);
            else quad4('ramp', [P1.x, y1, P1.z], f1, f0, [P0.x, y0, P0.z], LOOK.RAMP);
          }
          if ((pi === 'cut' || pj === 'cut') && (y0 < G - 0.05 || y1 < G - 0.05)) {
            /* the cutting: from the wall's base up and out to the ground */
            const s = LOOK.CUT_SLOPE;
            const f0 = [P0.x + ox0 * Math.max(0, G - y0) * s, G, P0.z + oz0 * Math.max(0, G - y0) * s], f1 = [P1.x + ox1 * Math.max(0, G - y1) * s, G, P1.z + oz1 * Math.max(0, G - y1) * s];
            if (sgn > 0) quad4('cut', [P1.x, y1, P1.z], f1, f0, [P0.x, y0, P0.z], LOOK.CUT);
            else quad4('cut', [P0.x, y0, P0.z], f0, f1, [P1.x, y1, P1.z], LOOK.CUT);
          }
        }
      }
    }
    /* supports at each end of the deck, from its underside to the ground */
    for (let i = 0; i < n; i++) {
      if (!deckAt(i)) continue;
      const prev = closed ? (i + n - 1) % n : i - 1, next = closed ? (i + 1) % n : i + 1;
      const endOfDeck = (prev < 0 || !deckAt(prev)) || (next >= n || !deckAt(next));
      if (!endOfDeck) continue;
      for (const [w, sgn] of [[left, 1], [right, -1]]) {
        const p = wp(w, i), [ox, oz] = outward(w, i, sgn);
        const f = F[i], h = LOOK.PILLAR / 2;
        const cx = p.x - ox * (h + 0.3), cz = p.z - oz * (h + 0.3);   // just inside the wall line
        const top = (p.y || 0) - LOOK.DECK_THICK + 0.05;
        const ax = -f.lx * h, az = -f.lz * h, bx = -Math.sin(C[i].heading) * h, bz = -Math.cos(C[i].heading) * h;
        const corners = [[cx + ax + bx, cz + az + bz], [cx - ax + bx, cz - az + bz], [cx - ax - bx, cz - az - bz], [cx + ax - bx, cz + az - bz]];
        for (let k = 0; k < 4; k++) { const a = corners[k], b = corners[(k + 1) % 4]; quad4('bridge', [a[0], G - 0.5, a[1]], [b[0], G - 0.5, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], LOOK.BRIDGE); }
      }
    }
  }

  /* ---- the meshes ---- */
  const order = ['road', 'runoff', 'kerb', 'edge', 'line', 'wall', 'clip', 'bridge', 'ramp', 'cut'];
  const doubleSided = { wall: 1, clip: 1, bridge: 1, ramp: 1, cut: 1 };
  let triangles = 0;
  for (const name of order) {
    const p = parts[name];
    if (!p || !p.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: doubleSided[name] ? THREE.DoubleSide : THREE.FrontSide }));
    mesh.name = name;
    mesh.frustumCulled = false;
    group.add(mesh);
    triangles += p.pos.length / 9;
  }
  group.userData = { triangles, drawCalls: group.children.length, names: group.children.map(m => m.name) };
  return group;
}
