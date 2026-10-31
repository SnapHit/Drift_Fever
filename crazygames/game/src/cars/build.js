/* THE CAR BUILDER. Turns one car's numbers (a file per car beside this
   one) into a three.js group, procedurally: no models, no textures, no
   images. The game reaches it through createCar in index.js.

   The body is a loft. Along the car, from the front bumper to the rear,
   sits a list of stations; at each one a cross-section of nine points
   runs from the middle of the floor out to the side, up past the waist
   and the shoulder, over the greenhouse and in to the middle of the
   roof, and is mirrored for the other side. Between two stations every
   pair of neighbouring points makes a quad. Outside the cabin the
   greenhouse points lie on the bonnet or the boot lid, so the
   windscreen and the rear glass are simply the stretch where the roof
   rises from the deck. Over each axle the stations follow a semicircle
   and the lowest points climb into a wheel well; the arch edges are two
   stations at the same z, which closes the well. The ends are fans.

   Every face is flat shaded: each triangle carries its own normal,
   which is the faceted, low poly look. Faces come out wound outwards
   by construction (the loft) or by checking against the part's middle
   (the convex pieces: lamps, wings, mirrors), and the probes check it
   by the signed volume of every part.

   Units metres, Y up, the car faces -Z, the origin on the ground at the
   middle of the wheelbase. */

/* Colours that are not the paint, in one place. */
export const FINISH = {
  UNDER:     0x101114,   // floor, wheel wells
  BLACK:     0x16171b,   // grilles, bumpers, wings
  GREY:      0x34363d,   // sills, diffusers
  METAL:     0xb4b9c1,   // exhaust tips, grille surrounds
  PLATE:     0xd9d8cf,   // a blank number plate
  TYRE:      0x1b1b1f,
  TYRE_WALL: 0x24242a,
  GAP:       0x121216,   // between the spokes
  GLASS:     0x141a26,
  HEAD_LENS: 0xd6dde6,
  HEAD_GLOW: 0xfff1d2,
  TAIL_LENS: 0x4a080c,
  TAIL_GLOW: 0xff1f2a,
  HEAD_ON:   1.6,        // emissive intensity with the lights on
  TAIL_ON:   1.4,
  UNDERGLOW_SPREAD: 0.55,  // m the glow reaches past the body
  UNDERGLOW_LIFT:   0.025, // m above the ground
  PAINT_ROUGH: 0.42, PAINT_METAL: 0.2,
  GLASS_ROUGH: 0.15, GLASS_METAL: 0.5,
  TRIM_ROUGH:  0.72, TRIM_METAL:  0.1,
  LAMP_ROUGH:  0.3,
};

const SINKS = ['paint', 'glass', 'trim', 'head', 'tail'];

/* Piecewise linear through [z, value] keys in order of z, flat beyond. */
function curve(keys) {
  return z => {
    if (z <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (z <= keys[i][0]) {
        const [z0, v0] = keys[i - 1], [z1, v1] = keys[i];
        return z1 - z0 < 1e-9 ? v1 : v0 + (v1 - v0) * (z - z0) / (z1 - z0);
      }
    }
    return keys[keys.length - 1][1];
  };
}
const inRanges = (z, ranges) => ranges.some(r => z >= r[0] && z <= r[1]);

/* Triangles land in one list per material. With debug on, every part's
   triangles are also kept apart, for the closed-and-outward check. */
function makeSink(THREE, debug) {
  const lists = {}; for (const k of SINKS) lists[k] = { p: [], c: [] };
  const parts = [];
  let part = null;
  const col = new THREE.Color();
  return {
    lists, parts,
    begin(name) { part = debug ? { name, p: [] } : null; if (part) parts.push(part); },
    /* a, b, c: [x, y, z]. ref: a point inside a convex part, or null when
       the winding is already right. */
    tri(sink, colour, a, b, c, ref) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * nx + ny * ny + nz * nz < 1e-12) return;          // a sliver: nothing to draw
      if (ref) {
        const mx = (a[0] + b[0] + c[0]) / 3 - ref[0], my = (a[1] + b[1] + c[1]) / 3 - ref[1], mz = (a[2] + b[2] + c[2]) / 3 - ref[2];
        if (nx * mx + ny * my + nz * mz < 0) { const t = b; b = c; c = t; }
      }
      const L = lists[sink];
      L.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      col.setHex(colour == null ? 0xffffff : colour);
      for (let i = 0; i < 3; i++) L.c.push(col.r, col.g, col.b);
      if (part) part.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    },
  };
}

/* A loft along z through stations, each giving the right half of its
   cross-section as [x, y] points from the bottom middle (x = 0) round to
   the top middle (x = 0). kind(s, zMid) says which material and colour
   segment s (0 at the bottom) takes between two stations; cap(end) the
   same for the two ends. Wound outwards by construction: the loop runs
   anticlockwise seen from +z. */
function loft(sink, stations, section, kind, cap) {
  const rings = stations.map(st => {
    const half = section(st), n = half.length;
    const loop = half.map(([x, y]) => [x, y, st.z]);
    for (let i = n - 2; i >= 1; i--) loop.push([-half[i][0], half[i][1], st.z]);
    return { loop, n, z: st.z };
  });
  for (let r = 0; r + 1 < rings.length; r++) {
    const A = rings[r].loop, B = rings[r + 1].loop, m = A.length, n = rings[r].n;
    const zm = (rings[r].z + rings[r + 1].z) / 2;
    for (let k = 0; k < m; k++) {
      const k1 = (k + 1) % m, s = k < n - 1 ? k : m - 1 - k;
      const [mat, colour] = kind(s, zm);
      sink.tri(mat, colour, A[k], A[k1], B[k1], null);
      sink.tri(mat, colour, A[k], B[k1], B[k], null);
    }
  }
  for (const [end, ring, dir] of [['front', rings[0], -1], ['rear', rings[rings.length - 1], 1]]) {
    const L = ring.loop, m = L.length;
    const c = [0, L.reduce((s, p) => s + p[1], 0) / m, ring.z];
    const [mat, colour] = cap(end);
    for (let k = 0; k < m; k++) {
      const a = L[k], b = L[(k + 1) % m];
      if (dir > 0) sink.tri(mat, colour, c, a, b, null); else sink.tri(mat, colour, c, b, a, null);
    }
  }
}

/* A convex prism: a polygon in the plane across `axis` ('x': points are
   [z, y]; 'z': points are [x, y]), from a0 to a1 along it. */
function prism(sink, mat, colour, poly, axis, a0, a1) {
  const P = (u, v, a) => axis === 'x' ? [a, v, u] : [u, v, a];
  const n = poly.length;
  let cu = 0, cv = 0; for (const [u, v] of poly) { cu += u; cv += v; } cu /= n; cv /= n;
  const ref = P(cu, cv, (a0 + a1) / 2);
  for (let i = 0; i < n; i++) {
    const [u0, v0] = poly[i], [u1, v1] = poly[(i + 1) % n];
    sink.tri(mat, colour, P(u0, v0, a0), P(u1, v1, a0), P(u1, v1, a1), ref);
    sink.tri(mat, colour, P(u0, v0, a0), P(u1, v1, a1), P(u0, v0, a1), ref);
  }
  for (let i = 1; i + 1 < n; i++) {
    sink.tri(mat, colour, P(poly[0][0], poly[0][1], a0), P(poly[i][0], poly[i][1], a0), P(poly[i + 1][0], poly[i + 1][1], a0), ref);
    sink.tri(mat, colour, P(poly[0][0], poly[0][1], a1), P(poly[i][0], poly[i][1], a1), P(poly[i + 1][0], poly[i + 1][1], a1), ref);
  }
}
/* An axis aligned box from its corners. */
function box(sink, mat, colour, x0, x1, y0, y1, z0, z1) {
  prism(sink, mat, colour, [[z0, y0], [z1, y0], [z1, y1], [z0, y1]], 'x', x0, x1);
}
/* A part on both sides: f(sign) builds the one at sign * x. */
const both = f => { f(1); f(-1); };

/* ---- the body ---- */

/* Everything the loft needs, worked out once from the car's numbers. */
function shape(S) {
  const D = S.dims;
  const zF = S.offset - D.length / 2, zR = S.offset + D.length / 2;
  const fa = -D.wheelbase / 2, ra = D.wheelbase / 2;
  const N = S.nose, T = S.tail, R = S.roof, sb = S.screen[0], st = S.screen[1], rb = S.rear.base;
  const hw = S.halfWidth;
  const flare = (z, axle, f) => {
    if (!f || !f.amount) return 0;
    const d = Math.abs(z - axle);
    if (f.box) return d <= f.flat ? f.amount : d >= f.flat + f.ramp ? 0 : f.amount * (1 - (d - f.flat) / f.ramp);
    return d >= f.len ? 0 : f.amount * 0.5 * (1 + Math.cos(Math.PI * d / f.len));
  };
  const plan = curve([[zF, hw * N.taper], [zF + N.round, hw], [zR - T.round, hw], [zR, hw * T.taper]]);
  const flareAt = z => flare(z, fa, S.flare && S.flare.front) + flare(z, ra, S.flare && S.flare.rear);
  const side = z => plan(z) + flareAt(z);
  const floor = curve([[zF, N.low], [zF + 0.3, S.floor], [zR - 0.3, S.floor], [zR, T.low]]);
  const belt = curve([[zF, N.belt], [sb, S.belt], [rb, S.belt + (S.beltRise || 0)], [zR, T.belt]]);
  const deck = curve([[zF, N.deck], [zF + Math.min(0.12, N.round), N.deck + 0.03], [sb, S.hood], [rb, S.rear.deck], [zR - Math.min(0.1, T.round), T.deck + 0.01], [zR, T.deck - 0.02]]);
  const hc = S.hoodCrown, rc = R.crown;
  const inCabin = z => z > sb && z < rb;
  const roofEdgeY = curve([[sb, S.hood + hc * 0.7], [st, R.h - rc], [R.end, R.h - rc - R.drop], [rb, S.rear.deck + hc * 0.7]]);
  const crown = curve([[sb, hc * 0.3], [st, rc], [R.end, rc], [rb, hc * 0.3]]);
  const glassIn = S.glassIn, shoulder = S.shoulder;
  const glassX = z => side(z) - shoulder - glassIn - flareAt(z) * (1 - (S.flare && S.flare.belt || 0));
  const roofX = curve([[sb, null], [st, R.w], [R.end, R.w * 0.97], [rb, null]]);
  const roofXAt = z => {
    if (!inCabin(z)) return glassX(z) * 0.55;
    if (z < st) { const t = (z - sb) / (st - sb); return glassX(sb) * 0.55 * (1 - t) + R.w * t; }
    if (z > R.end) { const t = (z - R.end) / (rb - R.end); return R.w * 0.97 * (1 - t) + glassX(rb) * 0.55 * t; }
    return roofX(z);
  };
  const y7 = z => inCabin(z) ? roofEdgeY(z) : deck(z) + hc * 0.7;
  const y8 = z => inCabin(z) ? roofEdgeY(z) + crown(z) : deck(z) + hc;
  const arch = (axle, front) => ({ z: axle, r: D.wheelRadius + (front ? S.archGap[0] : S.archGap[1]),
    wellX: D.track / 2 - (front ? D.tyre[0] : D.tyre[1]) / 2 - 0.05 });
  const arches = [arch(fa, true), arch(ra, false)];
  return { zF, zR, fa, ra, side, floor, belt, deck, y7, y8, glassX, roofXAt, flareAt, arches, inCabin };
}

/* The stations: an even spacing, every key z the shape turns at, and
   each arch as a semicircle with doubled edges. */
function stations(S, sh) {
  const keys = [sh.zF, sh.zF + Math.min(0.12, S.nose.round), sh.zF + S.nose.round, S.screen[0], S.screen[1], S.roof.end, S.rear.base,
    sh.zR - S.tail.round, sh.zR - Math.min(0.1, S.tail.round), sh.zR];
  for (const r of S.windows) keys.push(r[0], r[1]);
  for (const r of S.rearGlass || []) keys.push(r[0], r[1]);
  const step = S.spacing || 0.2;
  for (let z = sh.zF + step; z < sh.zR - step * 0.5; z += step) keys.push(z);
  const inside = z => sh.arches.some(a => Math.abs(z - a.z) < a.r + 0.03);
  const plain = [...new Set(keys.map(z => +z.toFixed(4)))].filter(z => !inside(z) && z >= sh.zF && z <= sh.zR).sort((a, b) => a - b);
  const thinned = [];
  for (const z of plain) if (!thinned.length || z - thinned[thinned.length - 1] > 0.035 || z === sh.zR) thinned.push(z);
  const list = thinned.map(z => ({ z, arch: null }));
  const steps = S.archSteps || 6;
  for (const a of sh.arches) {
    const ring = [{ z: a.z - a.r, arch: null }];
    for (let i = 0; i <= steps; i++) { const th = Math.PI * (1 - i / steps); ring.push({ z: a.z + a.r * Math.cos(th), arch: a, th }); }
    ring.push({ z: a.z + a.r, arch: null });
    const at = list.findIndex(s => s.z > a.z);
    list.splice(at, 0, ...ring);
  }
  return list;
}

function buildBody(S, sink) {
  const sh = shape(S), D = S.dims;
  const st = stations(S, sh);
  const sillBase = z => Math.max(S.sill, sh.floor(z) + 0.06);
  const section = s => {
    const z = s.z, ws = sh.side(z), yF = sh.floor(z);
    let wellX = ws - 0.06, wellY = yF, sillX = ws - 0.02, sillY = sillBase(z);
    if (s.arch) {
      const a = s.arch, top = D.wheelRadius + a.r * Math.sin(s.th);
      wellX = Math.min(a.wellX, ws - 0.06); wellY = Math.max(yF, top); sillX = ws; sillY = Math.max(sillY, top);
    }
    const yWaist = Math.max(sillY + (sh.belt(z) - sillY) * S.waist, sillY + 0.04);
    const yBelt = Math.max(sh.belt(z), yWaist + 0.04);
    const yDeck = Math.max(sh.deck(z), yBelt + 0.02);
    const y7 = Math.max(sh.y7(z), yDeck + 0.005), y8 = Math.max(sh.y8(z), y7 + 0.005);
    const wb = ws - S.shoulder - sh.flareAt(z) * (1 - (S.flare && S.flare.belt || 0));
    return [[0, yF], [wellX, yF], [wellX, wellY], [sillX, sillY], [ws, yWaist], [wb, yBelt], [Math.min(sh.glassX(z), wb - 0.02), yDeck], [Math.min(sh.roofXAt(z), sh.glassX(z) - 0.01), y7], [0, y8]];
  };
  const topGlass = [[S.screen[0] + 0.02, S.screen[1] - 0.01], ...(S.rearGlass || [[S.roof.end + 0.02, S.rear.base - 0.02]])];
  const between = z => z > sh.fa + sh.arches[0].r && z < sh.ra - sh.arches[1].r;
  const kind = (s, z) => {
    if (s <= 2) return ['trim', FINISH.UNDER];
    if (s === 3 && S.sillTrim && between(z)) return ['trim', FINISH.GREY];
    if (s === 6 && inRanges(z, S.windows)) return ['glass'];
    if (s === 7 && inRanges(z, topGlass)) return ['glass'];
    if (s === 7 && S.roofColour != null && z > S.screen[1] && z < S.roof.end) return ['trim', S.roofColour];
    return ['paint'];
  };
  sink.begin('body');
  loft(sink, st, section, kind, () => ['paint']);
  return { sh, section };
}

/* A bulge on the bonnet: a small loft that sits on the bonnet's middle line. */
function bonnetBulge(S, sh, sink) {
  const b = S.bulge; if (!b) return;
  const zs = []; for (let i = 0; i <= 5; i++) zs.push(b.from + (b.to - b.from) * i / 5);
  sink.begin('bulge');
  loft(sink, zs.map(z => ({ z })), ({ z }) => {
    const y = sh.y8(z) - 0.02, t = (z - b.from) / (b.to - b.from), h = 0.02 + b.h * Math.min(1, t * 1.6);
    return [[0, y], [b.w, y], [b.w * 0.82, y + h], [0, y + h + 0.01]];
  }, () => ['paint'], () => [b.colour != null ? 'trim' : 'paint', b.colour]);
}

/* The lamps and the trim on the two end faces. Rects are [x0, x1, y0, y1];
   mirrored unless x0 is negative (one piece across the middle). */
function endFaces(S, sh, sink) {
  const zF = sh.zF, zR = sh.zR, d = 0.02;
  const put = (mat, colour, r, z0, z1) => {
    if (r[0] < 0) box(sink, mat, colour, r[0], r[1], r[2], r[3], z0, z1);
    else both(s => box(sink, mat, colour, s > 0 ? r[0] : -r[1], s > 0 ? r[1] : -r[0], r[2], r[3], z0, z1));
  };
  sink.begin('front');
  for (const r of S.front.trim || []) put('trim', r[4] != null ? r[4] : FINISH.BLACK, r, zF - d * 0.6, zF + 0.01);
  for (const r of S.front.lamps) put('head', null, r, zF - d, zF + 0.01);
  sink.begin('rear');
  for (const r of S.back.trim || []) put('trim', r[4] != null ? r[4] : FINISH.BLACK, r, zR - 0.01, zR + d * 0.6);
  for (const r of S.back.lamps) put('tail', null, r, zR - 0.01, zR + d);
}

/* Everything else bolted on, from the car's list of extras. */
function extras(S, sh, sink) {
  const D = S.dims;
  for (const e of S.extras || []) {
    sink.begin(e.type);
    const colour = e.colour != null ? e.colour : FINISH.BLACK;
    const mat = e.paint ? 'paint' : 'trim';
    if (e.type === 'mirrors') {
      // a stalk from the door top at the base of the A pillar, and the housing on it
      const z = S.screen[0] + e.at, y = sh.belt(z), x = sh.glassX(z);
      both(s => {
        box(sink, 'trim', FINISH.BLACK, s > 0 ? x - 0.02 : -x - 0.07, s > 0 ? x + 0.07 : -x + 0.02, y - 0.02, y + 0.06, z - 0.02, z + 0.05);
        box(sink, 'paint', null, s > 0 ? x + 0.06 : -x - e.reach, s > 0 ? x + e.reach : -x - 0.06, y + 0.03, y + 0.12, z - 0.02, z + 0.06);
      });
    } else if (e.type === 'lip') {
      const z = sh.zR - e.back, y = sh.y8(z);
      prism(sink, mat, colour, [[z - e.chord, y - 0.01], [z, y - 0.01], [z, y + e.h]], 'x', -e.span, e.span);
    } else if (e.type === 'roofSpoiler') {
      const z = S.roof.end, y = sh.y8(z);
      prism(sink, mat, colour, [[z - 0.08, y - 0.01], [z + e.chord, y - e.drop], [z + e.chord, y - e.drop + 0.035], [z - 0.08, y + 0.02]], 'x', -e.span, e.span);
    } else if (e.type === 'wing') {
      const zl = e.z - e.chord / 2, c = e.chord, t = e.thick, y = e.y, rise = c * Math.sin(e.angle);
      prism(sink, mat, colour, [[zl, y], [zl + c * 0.28, y + t * 0.55], [zl + c, y + rise + t * 0.18], [zl + c, y + rise - t * 0.12], [zl + c * 0.3, y - t * 0.4]], 'x', -e.span, e.span);
      both(s => {
        const x = s * e.post;
        const base = sh.deck(e.z) - 0.03;
        box(sink, 'trim', FINISH.BLACK, x - 0.02, x + 0.02, base, y, e.z - 0.05, e.z + 0.07);
        const xp = s * e.span;
        box(sink, e.platePaint ? 'paint' : 'trim', FINISH.BLACK, s > 0 ? xp : xp - 0.02, s > 0 ? xp + 0.02 : xp, y - e.plateDown, y + e.plateUp, zl - 0.06, zl + c + 0.04);
      });
    } else if (e.type === 'splitter') {
      const z = sh.zF;
      prism(sink, 'trim', colour, [[z - e.out, e.y], [z + e.depth, e.y], [z + e.depth, e.y + e.thick], [z - e.out, e.y + e.thick]], 'x', -e.span, e.span);
    } else if (e.type === 'canards') {
      const z = sh.zF + e.z;
      both(s => prism(sink, 'trim', colour, s > 0 ? [[e.x0, e.y], [e.x1, e.y + e.rise], [e.x1, e.y + e.rise + 0.015], [e.x0, e.y + 0.015]] : [[-e.x0, e.y], [-e.x0, e.y + 0.015], [-e.x1, e.y + e.rise + 0.015], [-e.x1, e.y + e.rise]], 'z', z - 0.12, z + 0.04));
    } else if (e.type === 'skirts') {
      const z0 = sh.fa + sh.arches[0].r + 0.02, z1 = sh.ra - sh.arches[1].r - 0.02;
      both(s => { const x = sh.side((z0 + z1) / 2); box(sink, 'trim', colour, s > 0 ? x - 0.08 : -x - e.out, s > 0 ? x + e.out : -x + 0.08, e.y0, e.y1, z0, z1); });
    } else if (e.type === 'diffuser') {
      const z = sh.zR;
      prism(sink, 'trim', colour, [[z - e.depth, e.y0], [z + 0.02, e.y0 + e.rise], [z + 0.02, e.y1], [z - e.depth, e.y1]], 'x', -e.span, e.span);
      for (let i = 0; i < e.fins; i++) {
        const x = -e.span * 0.7 + (e.span * 1.4) * i / Math.max(1, e.fins - 1);
        prism(sink, 'trim', FINISH.BLACK, [[z - e.depth * 0.8, e.y0 - 0.005], [z + 0.03, e.y0 + e.rise - 0.04], [z + 0.03, e.y0 + e.rise + 0.01], [z - e.depth * 0.8, e.y0 + 0.02]], 'x', x - 0.008, x + 0.008);
      }
    } else if (e.type === 'exhaust') {
      for (const x of e.x) {
        const poly = []; for (let i = 0; i < 6; i++) { const a = Math.PI * 2 * i / 6 + Math.PI / 6; poly.push([x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r]); }
        prism(sink, 'trim', FINISH.METAL, poly, 'z', sh.zR - 0.15, sh.zR + e.out);
      }
    } else if (e.type === 'mudflaps') {
      for (const [axle, front] of [[sh.fa, true], [sh.ra, false]]) {
        const a = sh.arches[front ? 0 : 1], z = axle + a.r + 0.01, x = D.track / 2;
        both(s => box(sink, 'trim', colour, s * x - 0.1, s * x + 0.1, e.y0, e.y1, z, z + 0.015));
      }
    }
  }
}

/* ---- wheels ---- */

/* A wheel lathed round the x axis, its outer face towards +x, with a
   vertex at the very bottom so it rests on the ground at no spin. The
   spokes are sectors of the face in the rim colour, the rest in the gap
   colour. Returns flat triangles: positions and colours. */
function wheelGeometry(THREE, R, w, W) {
  const S = W.segments, h = w / 2, dish = W.dish, rimR = R * W.rim, hub = rimR * 0.24;
  const prof = [[0, -h], [R, -h], [R, h - 0.03], [R - 0.03, h], [rimR, h], [rimR * 0.93, h - dish], [hub, h - dish + 0.008], [0, h - dish + 0.02]];
  const colourOf = (seg, k) => {
    if (seg <= 1) return FINISH.TYRE;
    if (seg <= 3) return seg === 3 ? FINISH.TYRE_WALL : FINISH.TYRE;
    if (seg === 4) return W.colour;
    if (seg === 5) { const per = S / W.spokes, i = k % per; return i < per * W.spokeShare ? W.colour : FINISH.GAP; }
    return W.colour;
  };
  const pos = [], col = [], c = new THREE.Color();
  const P = (r, x, k) => { const a = 2 * Math.PI * k / S; return [x, -r * Math.cos(a), r * Math.sin(a)]; };
  const push = (a, b, d, colour) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    if ((uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + (ux * vy - uy * vx) ** 2 < 1e-14) return;
    pos.push(...a, ...b, ...d); c.setHex(colour); for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b);
  };
  for (let seg = 0; seg + 1 < prof.length; seg++) {
    const [r0, x0] = prof[seg], [r1, x1] = prof[seg + 1];
    for (let k = 0; k < S; k++) {
      const a0 = P(r0, x0, k), a1 = P(r0, x0, k + 1), b0 = P(r1, x1, k), b1 = P(r1, x1, k + 1), colour = colourOf(seg, k);
      // the profile runs from the inner middle out and round to the outer middle: this order faces out
      push(a0, b0, b1, colour); push(a0, b1, a1, colour);
    }
  }
  return { pos, col };
}

function wheelMesh(THREE, R, w, W, side, material) {
  const { pos, col } = wheelGeometry(THREE, R, w, W);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (side < 0) g.rotateY(Math.PI);           // the left wheels: outer face to -x, winding kept
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

/* ---- the glow under the car ---- */
function underglowMesh(THREE, sh, S) {
  const s = FINISH.UNDERGLOW_SPREAD, y = FINISH.UNDERGLOW_LIFT;
  const hw = S.halfWidth * 0.8, z0 = sh.fa - 0.2, z1 = sh.ra + 0.2;
  const inner = [[-hw, z0], [hw, z0], [hw, z1], [-hw, z1]];
  const outer = [[-hw - s, z0 - s], [hw + s, z0 - s], [hw + s, z1 + s], [-hw - s, z1 + s]];
  const pos = [], col = [];
  const v = (p, k) => { pos.push(p[0], y, p[1]); col.push(k, k, k); };
  // facing up: anticlockwise seen from above is x then -z
  const quad = (a, b, c, d, ka, kb, kc, kd) => { v(a, ka); v(d, kd); v(c, kc); v(a, ka); v(c, kc); v(b, kb); };
  quad(inner[0], inner[1], inner[2], inner[3], 1, 1, 1, 1);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(outer[i], outer[j], inner[j], inner[i], 0, 0, 1, 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = -1;
  return mesh;
}

/* ---- assembly ---- */

function geometryFrom(THREE, lists, names) {
  const pos = [], col = [], groups = [];
  let start = 0;
  names.forEach((k, i) => {
    const L = lists[k]; if (!L.p.length) return;
    pos.push(...L.p); col.push(...L.c);
    groups.push([start, L.p.length / 3, i]); start += L.p.length / 3;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  for (const [s, c, m] of groups) g.addGroup(s, c, m);
  g.computeVertexNormals();                  // non indexed, so each face keeps its own normal
  return g;
}

export function buildCar(THREE, S, options) {
  const opts = options || {};
  const D = S.dims;
  const sink = makeSink(THREE, !!opts.debug);
  const { sh } = buildBody(S, sink);
  bonnetBulge(S, sh, sink);
  endFaces(S, sh, sink);
  extras(S, sh, sink);

  const paint = new THREE.MeshStandardMaterial({ color: opts.paint != null ? opts.paint : S.paint, roughness: FINISH.PAINT_ROUGH, metalness: FINISH.PAINT_METAL });
  const glass = new THREE.MeshStandardMaterial({ color: FINISH.GLASS, roughness: FINISH.GLASS_ROUGH, metalness: FINISH.GLASS_METAL });
  const trim = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: FINISH.TRIM_ROUGH, metalness: FINISH.TRIM_METAL });
  const headMat = new THREE.MeshStandardMaterial({ color: FINISH.HEAD_LENS, emissive: FINISH.HEAD_GLOW, emissiveIntensity: FINISH.HEAD_ON, roughness: FINISH.LAMP_ROUGH });
  const tailMat = new THREE.MeshStandardMaterial({ color: FINISH.TAIL_LENS, emissive: FINISH.TAIL_GLOW, emissiveIntensity: FINISH.TAIL_ON, roughness: FINISH.LAMP_ROUGH });

  const group = new THREE.Group();
  group.name = 'car:' + S.id;
  const body = new THREE.Mesh(geometryFrom(THREE, sink.lists, ['paint', 'glass', 'trim']), [paint, glass, trim]);
  body.name = 'body';
  group.add(body);
  const head = new THREE.Mesh(geometryFrom(THREE, sink.lists, ['head']), headMat);
  const tail = new THREE.Mesh(geometryFrom(THREE, sink.lists, ['tail']), tailMat);
  head.name = 'headlights'; tail.name = 'taillights';
  group.add(head, tail);

  /* Wheels: a pivot the game steers (rotation.y) holding a mesh it spins
     (rotation.x), as the feel prototype's scene does. */
  const wheels = {};
  const W = S.wheel;
  for (const [name, side, z, front] of [['fl', -1, sh.fa, true], ['fr', 1, sh.fa, true], ['rl', -1, sh.ra, false], ['rr', 1, sh.ra, false]]) {
    const pivot = new THREE.Group();
    pivot.name = 'wheel:' + name;
    pivot.position.set(side * D.track / 2, D.wheelRadius, z);
    const mesh = wheelMesh(THREE, D.wheelRadius, front ? D.tyre[0] : D.tyre[1], W, side, trim);
    pivot.add(mesh);
    group.add(pivot);
    wheels[name] = { pivot, mesh };
  }

  const glow = underglowMesh(THREE, sh, S);
  glow.name = 'underglow';
  group.add(glow);
  const setUnderglow = colour => { if (colour == null) glow.visible = false; else { glow.material.color.setHex(colour); glow.visible = true; } };
  setUnderglow(opts.underglow != null ? opts.underglow : null);

  const lights = {
    head, tail,
    /* 0 is off, 1 is on; anything between dims them. */
    set(h, t) { if (h != null) headMat.emissiveIntensity = FINISH.HEAD_ON * h; if (t != null) tailMat.emissiveIntensity = FINISH.TAIL_ON * t; },
  };

  /* The measured box of everything but the glow, so dims say what is drawn. */
  group.updateMatrixWorld(true);
  const bb = new THREE.Box3(), tmp = new THREE.Box3();
  group.traverse(o => { if (o.isMesh && o !== glow) { o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); bb.union(tmp); } });
  const dims = {
    length: bb.max.z - bb.min.z, width: bb.max.x - bb.min.x, height: bb.max.y,
    wheelbase: D.wheelbase, track: D.track, wheelRadius: D.wheelRadius,
    tyreFront: D.tyre[0], tyreRear: D.tyre[1],
    halfLength: (bb.max.z - bb.min.z) / 2, halfWidth: (bb.max.x - bb.min.x) / 2,
    centreZ: (bb.max.z + bb.min.z) / 2,       // the box's middle, from the origin (negative is forwards)
    frontAxle: sh.fa, rearAxle: sh.ra,
  };

  const car = {
    id: S.id, group, body, wheels, lights, dims, underglow: glow,
    setPaint(colour) { paint.color.setHex(colour); },
    setUnderglow,
    dispose() { group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); for (const m of [paint, glass, trim, headMat, tailMat, glow.material]) m.dispose(); },
  };
  if (opts.debug) car.parts = sink.parts;
  return car;
}
