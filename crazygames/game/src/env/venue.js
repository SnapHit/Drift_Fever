/* THE COVER LOOK'S VENUE, DRAWN (briefs/COVER-LOOK.md 4, ?look=2): what
   the look adds to a track that is neither a prop nor a light. The
   floodlight towers and the denser stands, boards, flags and tyre
   stacks are props, placed by env/scenery.js (VENUE) so the sight line
   probe sees them; their light on the road is env/dressing.js's. Here:

   - the barriers painted in panels of colour, as a circuit's are (the
     concrete only: a tyre wall stays a tyre wall and a clipping zone
     stays orange, the judged wall the missions name), by recolouring
     the track mesh's own barrier segments, so it costs nothing to draw;
   - catch fencing on the outside of every corner, behind the barrier:
     a see through wire mesh on posts, two draw calls for the whole
     track.

   Every number of taste is in VENUE_DRAW. */

export const VENUE_DRAW = {
  /* the barrier's panels, two segments (4 m) each, in turn; colours kept
     well under the edge line's brightness (the readability rule) */
  PANELS:       [0x2a4a9a, 0x9a9ca4, 0xb08818, 0x9a9ca4, 0x982c28, 0x9a9ca4],
  PANEL_SEGS:   2,
  CONCRETE:     0x7a7a84,   // the barrier colour the track mesh paints concrete (tracks/mesh.js LOOK.WALL): only this is panelled
  /* the catch fence */
  FENCE_FROM:   0.9,        // m above the barrier's base, the fence's foot (the barrier is 1 m tall)
  FENCE_TOP:    4.0,        // m above it, the fence's top
  FENCE_OUT:    0.38,       // m out from the barrier's line, behind it
  FENCE_TILE:   0.55,       // m per repeat of the wire's pattern
  FENCE_COLOUR: 0x8a8e98,
  POST_EVERY:   3,          // segments (2 m each) between posts
  POST_SIZE:    0.09,       // m square
  POST_COLOUR:  0x4a4e58,
  CORNER_PAD:   6,          // m the fence runs on past each end of a corner
};

const SAMPLE = 2;   // m between centre samples, as the generator lays them

/* The concrete barrier segments of a track mesh's `wall` geometry
   painted in panels. The mesh builder writes each segment as three
   quads (18 vertices) in order along each wall. */
export function stripeWalls(THREE, geo) {
  const col = geo.attributes.color;
  if (!col) return;
  const c = new THREE.Color(), ref = new THREE.Color().setHex(VENUE_DRAW.CONCRETE), panels = VENUE_DRAW.PANELS.map(h => new THREE.Color().setHex(h));
  const segs = Math.floor(col.count / 18);
  for (let s = 0; s < segs; s++) {
    c.fromBufferAttribute(col, s * 18);
    if (Math.abs(c.r - ref.r) + Math.abs(c.g - ref.g) + Math.abs(c.b - ref.b) > 1e-3) continue;
    const p = panels[Math.floor(s / VENUE_DRAW.PANEL_SEGS) % panels.length];
    for (let k = 0; k < 18; k++) col.setXYZ(s * 18 + k, p.r, p.g, p.b);
  }
  col.needsUpdate = true;
}

/* The wire's pattern: diamonds of thin wire on nothing, alpha tested. */
function wireTexture(THREE) {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.clearRect(0, 0, s, s);
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 4;
  for (const [a, b, d, e] of [[0, 0, s, s], [s, 0, 0, s], [-s / 2, s / 2, s / 2, s * 1.5], [s / 2, -s / 2, s * 1.5, s / 2], [s / 2, s * 1.5, s * 1.5, s / 2], [-s / 2, s / 2, s / 2, -s / 2]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(d, e); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* The catch fencing along the outside of the corners: { group, info, dispose }. */
export function buildVenue(THREE, ground) {
  const V = VENUE_DRAW, group = new THREE.Group();
  group.name = 'venue';
  const info = { drawCalls: 0, triangles: 0, fence: 0 };
  const disposables = [];
  const C = ground.centre || [], n = C.length;
  if (!n || !ground.walls) return { group, info, dispose() {} };
  const wallOf = side => ground.walls.find(w => w.side === side && !w.cap);
  const fp = [], fuv = [], pp = [];
  const along = [0];
  for (const k of ground.corners || []) {
    const w = wallOf(k.dir === 'left' ? 'right' : 'left'), sgn = k.dir === 'left' ? -1 : 1;   // the outside of a left hander is the right
    if (!w) continue;
    const i0 = Math.max(0, Math.floor((k.from - V.CORNER_PAD) / SAMPLE)), i1 = Math.min(w.points.length - 1, Math.ceil((k.to + V.CORNER_PAD) / SAMPLE));
    along[0] = 0;
    for (let i = i0; i < i1; i++) {
      const a = w.points[i], b = w.points[i + 1], ca = C[i], cb = C[Math.min(n - 1, i + 1)];
      if (!a || !b || ca.part === 'deck' || cb.part === 'deck') continue;
      const oa = [-Math.cos(ca.heading) * sgn * V.FENCE_OUT, Math.sin(ca.heading) * sgn * V.FENCE_OUT], ob = [-Math.cos(cb.heading) * sgn * V.FENCE_OUT, Math.sin(cb.heading) * sgn * V.FENCE_OUT];
      const ax = a.x + oa[0], az = a.z + oa[1], bx = b.x + ob[0], bz = b.z + ob[1], ya = a.y || 0, yb = b.y || 0, len = Math.hypot(bx - ax, bz - az);
      const u0 = along[0] / V.FENCE_TILE, u1 = (along[0] + len) / V.FENCE_TILE, v0 = 0, v1 = (V.FENCE_TOP - V.FENCE_FROM) / V.FENCE_TILE;
      const A = [ax, ya + V.FENCE_FROM, az], B = [bx, yb + V.FENCE_FROM, bz], Bt = [bx, yb + V.FENCE_TOP, bz], At = [ax, ya + V.FENCE_TOP, az];
      fp.push(...A, ...B, ...Bt, ...A, ...Bt, ...At); fuv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      along[0] += len;
      if ((i - i0) % V.POST_EVERY === 0) {
        const h = V.POST_SIZE / 2, y0 = ya, y1 = ya + V.FENCE_TOP;
        const q = [[ax - h, az - h], [ax + h, az - h], [ax + h, az + h], [ax - h, az + h]];
        for (let e = 0; e < 4; e++) { const p = q[e], r = q[(e + 1) % 4]; pp.push(p[0], y0, p[1], r[0], y0, r[1], r[0], y1, r[1], p[0], y0, p[1], r[0], y1, r[1], p[0], y1, p[1]); }
      }
      info.fence += len;
    }
  }
  if (fp.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
    g.computeVertexNormals();
    const tex = wireTexture(THREE);
    const m = new THREE.MeshLambertMaterial({ color: V.FENCE_COLOUR, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    mesh.name = 'venue:fence'; mesh.frustumCulled = false;
    group.add(mesh);
    disposables.push(g, m, tex);
    info.drawCalls++; info.triangles += fp.length / 9;
  }
  if (pp.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ color: V.POST_COLOUR, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    mesh.name = 'venue:posts'; mesh.frustumCulled = false; mesh.castShadow = false;
    group.add(mesh);
    disposables.push(g, m);
    info.drawCalls++; info.triangles += pp.length / 9;
  }
  return { group, info, dispose() { for (const d of disposables) d.dispose(); } };
}
