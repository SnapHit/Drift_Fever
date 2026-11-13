/* THE WHEEL DESIGNS (briefs/GARAGE.md 2). Five original wheels beyond
   each car's standard one, built from numbers like the cars: no models,
   no textures, no images. A design is a tyre lathed round the axle, a
   lip, a dark barrel behind the face, and a face of spokes (or a solid
   disc with slots) with a centre cap. Each is told from the others at
   race distance by its colour and its share of the tyre before its
   spoke count: silver and thin, gunmetal with a bright lip, a white
   disc, gold with a deep lip, red and broad.

   face(design) gives the face as flat shapes in polar terms, which both
   the mesh (wheelDesignGeometry) and the garage's little pictures
   (wheelIcon) are made from, so a tile shows the wheel it sells.

   Nothing here is named after a real wheel or its maker. */
import { FINISH } from './build.js';

export const WHEEL_DESIGNS = {
  daggers: {
    name: 'Daggers', segments: 24, rim: 0.82, lipIn: 0.93, dish: 0.022, hub: 0.2, recess: 0.035,
    lip: 0xf4f6fa, spoke: 0xe9edf3, cap: 0x2a2d35, gap: 0x121216,
    spokes: { n: 10, w0: 0.016, w1: 0.011, twist: 0, hubOut: 0.012, thick: 0.03 },
  },
  turbines: {
    name: 'Turbines', segments: 24, rim: 0.78, lipIn: 0.88, dish: 0.03, hub: 0.26, recess: 0.04,
    lip: 0xdfe4ea, spoke: 0x4a4f5c, cap: 0xdfe4ea, gap: 0x0c0c10,
    spokes: { n: 12, w0: 0.02, w1: 0.03, twist: 0.42, hubOut: 0.0, thick: 0.035 },
  },
  discs: {
    name: 'Discs', segments: 24, rim: 0.76, lipIn: 0.95, dish: 0.012, hub: 0.16, recess: 0.02,
    lip: 0xf3f1ea, spoke: 0xf3f1ea, cap: 0xe8452c, gap: 0x16171b,
    disc: { slots: 8, at: 0.74, len: 0.14, w: 0.022, out: 0.014 },
  },
  fours: {
    name: 'Deep fours', segments: 24, rim: 0.74, lipIn: 0.74, dish: 0.07, hub: 0.3, recess: 0.03,
    lip: 0xf0d27a, spoke: 0xd9a52c, cap: 0x2a2d35, gap: 0x0c0c10,
    spokes: { n: 4, w0: 0.05, w1: 0.036, twist: 0, hubOut: -0.01, thick: 0.03 },
  },
  blades: {
    name: 'Tri-blades', segments: 24, rim: 0.8, lipIn: 0.9, dish: 0.028, hub: 0.24, recess: 0.04,
    lip: 0x23252e, spoke: 0xe83a2c, cap: 0x23252e, gap: 0x0c0c10,
    spokes: { n: 3, w0: 0.075, w1: 0.05, twist: 0.3, hubOut: 0.006, thick: 0.035 },
  },
};

export const wheelDesign = id => (id && Object.prototype.hasOwnProperty.call(WHEEL_DESIGNS, id) ? WHEEL_DESIGNS[id] : null);

/* The face of a design on a wheel of radius R: shapes as { colour, pts:
   [[r, angle, out]] } with r in metres, the angle from straight down
   and out in metres proud of the face plane (negative is sunk). */
export function face(W, R) {
  const rimR = R * W.rim, inR = rimR * W.lipIn, hubR = rimR * W.hub, shapes = [];
  if (W.spokes) {
    const P = W.spokes;
    for (let i = 0; i < P.n; i++) {
      const a = 2 * Math.PI * i / P.n, a0 = P.w0 / (hubR * 0.7), a1 = P.w1 / inR;
      shapes.push({ colour: W.spoke, thick: P.thick, pts: [[hubR * 0.7, a - a0, P.hubOut], [hubR * 0.7, a + a0, P.hubOut], [inR, a + P.twist + a1, 0], [inR, a + P.twist - a1, 0]] });
    }
  }
  if (W.disc) {
    const D = W.disc, ring = [];
    for (let k = 0; k < W.segments; k++) ring.push([inR, 2 * Math.PI * k / W.segments, 0]);
    shapes.push({ colour: W.spoke, thick: 0, fan: true, pts: ring });
    for (let i = 0; i < D.slots; i++) {
      const a = 2 * Math.PI * (i + 0.5) / D.slots, r0 = inR * D.at, r1 = r0 - R * D.len, w = D.w;
      shapes.push({ colour: W.gap, thick: 0, pts: [[r1, a - w / r1, D.out], [r1, a + w / r1, D.out], [r0, a + w / r0, D.out], [r0, a - w / r0, D.out]] });
    }
  }
  const cap = [];
  for (let k = 0; k < 10; k++) cap.push([hubR, 2 * Math.PI * k / 10, (W.spokes ? W.spokes.hubOut : 0) + 0.012]);
  shapes.push({ colour: W.cap, thick: 0.012, fan: true, pts: cap });
  return { rimR, inR, hubR, shapes };
}

/* The wheel as flat triangles: positions and colours, the outer face
   towards +x, a vertex at the very bottom so it rests on the ground. */
export function wheelDesignGeometry(THREE, R, w, W) {
  const S = W.segments, h = w / 2, F = face(W, R), xf = h - W.dish, xb = xf - W.recess + Math.min(0, W.spokes ? W.spokes.hubOut : 0);
  const pos = [], col = [], c = new THREE.Color();
  const P = (r, x, a) => [x, -r * Math.cos(a), r * Math.sin(a)];
  /* a triangle, turned to face the way dir points */
  const tri = (a, b, d, colour, dir) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-14) return;
    if (nx * dir[0] + ny * dir[1] + nz * dir[2] < 0) { const t = b; b = d; d = t; }
    pos.push(...a, ...b, ...d); c.setHex(colour); for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b);
  };
  /* the tyre, the lip and the barrel, lathed: the profile runs from the inner middle out and round to the face's back */
  const prof = [[0, -h, FINISH.TYRE], [R, -h, FINISH.TYRE], [R, h - 0.03, FINISH.TYRE], [R - 0.03, h, FINISH.TYRE_WALL], [F.rimR, h, W.lip], [F.inR, xf, W.gap], [F.inR * 0.98, xb, W.gap], [0, xb, null]];
  for (let s = 0; s + 1 < prof.length; s++) {
    const [r0, x0, colour] = prof[s], [r1, x1] = prof[s + 1];
    for (let k = 0; k < S; k++) {
      const t0 = 2 * Math.PI * k / S, t1 = 2 * Math.PI * (k + 1) / S;
      const a0 = P(r0, x0, t0), a1 = P(r0, x0, t1), b0 = P(r1, x1, t0), b1 = P(r1, x1, t1);
      /* out from the axle on the tread, out along the axle on the walls and the face */
      const tm = (t0 + t1) / 2, dir = s === 1 ? [0, -Math.cos(tm), Math.sin(tm)] : s === 0 ? [-1, 0, 0] : s === 5 ? [0.2, Math.cos(tm), -Math.sin(tm)] : [1, 0, 0];
      tri(a0, b0, b1, colour, dir); tri(a0, b1, a1, colour, dir);
    }
  }
  /* the face's shapes, each proud of the barrel, with walls down its sides where it has a thickness */
  for (const sh of F.shapes) {
    const top = sh.pts.map(([r, a, out]) => P(r, xf + out, a)), n = top.length;
    for (let i = 1; i + 1 < n; i++) tri(top[0], top[i], top[i + 1], sh.colour, [1, 0, 0]);
    if (sh.thick > 0) {
      let my = 0, mz = 0; for (const p of top) { my += p[1]; mz += p[2]; } my /= n; mz /= n;
      for (let i = 0; i < n; i++) {
        const a = top[i], b = top[(i + 1) % n], a2 = [Math.max(xb, a[0] - sh.thick), a[1], a[2]], b2 = [Math.max(xb, b[0] - sh.thick), b[1], b[2]];
        const dir = [0, (a[1] + b[1]) / 2 - my, (a[2] + b[2]) / 2 - mz];
        tri(a, b, b2, sh.colour, dir); tri(a, b2, a2, sh.colour, dir);
      }
    }
  }
  return { pos, col };
}

/* A design's face as a small picture for a garage tile: an SVG string
   drawn from the same shapes. size is its side in px. */
export function wheelIcon(W, size) {
  const R = 1, F = face(W, R), s = size || 44, hex = n => '#' + n.toString(16).padStart(6, '0');
  const pt = ([r, a]) => (50 + r * 46 * Math.sin(a)).toFixed(1) + ',' + (50 + r * 46 * Math.cos(a)).toFixed(1);
  const polys = F.shapes.map(sh => `<polygon points="${sh.pts.map(pt).join(' ')}" fill="${hex(sh.colour)}"/>`).join('');
  return `<svg class="wicon" viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="${hex(FINISH.TYRE)}"/><circle cx="50" cy="50" r="${(F.rimR * 46).toFixed(1)}" fill="${hex(W.lip)}"/><circle cx="50" cy="50" r="${(F.inR * 46).toFixed(1)}" fill="${hex(W.gap)}"/>${polys}</svg>`;
}

/* A standard wheel's picture, from a car's own wheel numbers (build.js wheelGeometry). */
export function standardIcon(W, size) {
  const s = size || 44, hex = n => '#' + n.toString(16).padStart(6, '0'), rim = 46 * W.rim, n = W.spokes, half = Math.PI * W.spokeShare / n;
  let polys = '';
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n, q = (r, t) => (50 + r * Math.sin(t)).toFixed(1) + ',' + (50 + r * Math.cos(t)).toFixed(1);
    polys += `<polygon points="${q(rim * 0.24, a - half * 2)} ${q(rim * 0.24, a + half * 2)} ${q(rim * 0.93, a + half)} ${q(rim * 0.93, a - half)}" fill="${hex(W.colour)}"/>`;
  }
  return `<svg class="wicon" viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="${hex(FINISH.TYRE)}"/><circle cx="50" cy="50" r="${rim.toFixed(1)}" fill="${hex(W.colour)}"/><circle cx="50" cy="50" r="${(rim * 0.93).toFixed(1)}" fill="${hex(FINISH.GAP)}"/>${polys}<circle cx="50" cy="50" r="${(rim * 0.24).toFixed(1)}" fill="${hex(W.colour)}"/></svg>`;
}
