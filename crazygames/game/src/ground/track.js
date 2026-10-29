/* THE TEST TRACK AND THE CAR PARK. Hand made, plain data, in the shape
   the track generator (another session's job) will produce, so the game
   can drive on either: centre samples every two metres with a heading
   and a width, walls as polylines with the side the track is on, clipping
   zones in metres along the track, a start, bounds and cones.

   Units metres, Y up, flat. Headings follow the vehicle: yaw zero faces
   -Z, positive yaw turns left. */

const SAMPLE = 2;

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
}

/* Yaw for a travel direction (dx, dz): forward = (-sin yaw, -cos yaw). */
export function yawOf(dx, dz) { return Math.atan2(-dx, -dz); }

/* A closed loop through control points, resampled every SAMPLE metres. */
function closedLoop(points, width) {
  const n = points.length;
  const fine = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    for (let k = 0; k < 40; k++) fine.push(catmullRom(p0, p1, p2, p3, k / 40));
  }
  const cum = [0];
  for (let i = 1; i <= fine.length; i++) { const a = fine[i - 1], b = fine[i % fine.length]; cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z)); }
  const length = cum[fine.length];
  const count = Math.floor(length / SAMPLE);
  const centre = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const s = i * SAMPLE;
    while (cum[j + 1] < s) j++;
    const a = fine[j], b = fine[(j + 1) % fine.length];
    const t = (s - cum[j]) / (cum[j + 1] - cum[j]);
    centre.push({ x: a.x + (b.x - a.x) * t, y: 0, z: a.z + (b.z - a.z) * t, heading: 0, bank: 0, width: typeof width === 'function' ? width(s, length) : width });
  }
  for (let i = 0; i < count; i++) {
    const a = centre[(i - 1 + count) % count], b = centre[(i + 1) % count];
    centre[i].heading = yawOf(b.x - a.x, b.z - a.z);
  }
  return { centre, length: count * SAMPLE };
}

/* Walls either side of a sampled centre line, closed. */
function wallsOf(centre, closed) {
  const left = [], right = [];
  const n = centre.length;
  for (let i = 0; i <= (closed ? n : n - 1); i++) {
    const c = centre[i % n];
    const lx = -Math.cos(c.heading), lz = Math.sin(c.heading);
    const h = c.width / 2;
    left.push({ x: c.x + lx * h, y: 0, z: c.z + lz * h });
    right.push({ x: c.x - lx * h, y: 0, z: c.z - lz * h });
  }
  // inward: the track is to the right of the left wall as it runs (+1 means
  // the normal is the wall direction rotated to its right)
  return [
    { points: left, kind: 'concrete', side: 'left' },
    { points: right, kind: 'concrete', side: 'right' },
  ];
}

export function testTrack() {
  /* Start straight up the -Z axis, a 150 degree right hand sweeper of
     radius 55, a straight, a tight right hairpin (r 14), a short straight,
     a left-right chicane, a tight left hairpin (r 14), a long straight
     back and a wide right hairpin (r 19) onto the start straight. */
  const P = [
    [0, -20], [0, -60], [0, -100], [0, -115],
    [16.1, -153.9], [55, -170], [93.9, -153.9], [110, -115],
    [110, -80], [110, -45],
    [110, -40], [105.9, -30.1], [96, -26], [86.1, -30.1], [82, -40],
    [82, -60], [82, -74], [74, -86], [66, -98], [66, -112],
    [66, -130], [61.9, -139.9], [52, -144], [42.1, -139.9], [38, -130],
    [38, -100], [38, -60], [38, -20],
    [38, -10], [32.4, 3.4], [19, 9], [5.6, 3.4], [0, -10],
  ].map(([x, z]) => ({ x, z }));
  const loop = closedLoop(P, 14);
  const centre = loop.centre;
  const walls = wallsOf(centre, true);
  /* Clipping zones, by the nearest sample to a landmark. */
  const near = (x, z) => { let best = 0, bd = 1e9; for (let i = 0; i < centre.length; i++) { const d = (centre[i].x - x) ** 2 + (centre[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } } return best * SAMPLE; };
  const clips = [
    { from: near(0, -125), to: near(104, -135), side: 'left', kind: 'outer', name: 'sweeper' },
    { from: near(110, -48), to: near(82, -48), side: 'right', kind: 'inner', name: 'hairpin 1' },
    { from: near(82, -72), to: near(66, -112), side: 'left', kind: 'outer', name: 'chicane' },
    { from: near(66, -122), to: near(38, -122), side: 'left', kind: 'inner', name: 'hairpin 2' },
    { from: near(38, -18), to: near(0, -18), side: 'right', kind: 'inner', name: 'hairpin 3' },
  ];
  const bounds = boundsOf(centre, 30);
  const sections = { sweeper: [near(0, -118), near(108, -120)], hairpin1: [near(110, -46), near(82, -46)], chicane: [near(82, -70), near(66, -114)], hairpin2: [near(66, -126), near(38, -126)], hairpin3: [near(38, -14), near(0, -14)] };
  return { name: 'track', kind: 'circuit', length: loop.length, centre, walls, clips, start: { x: 0, z: -24, yaw: 0 }, checkpoints: [], bounds, cones: [], sections };
}

export function carPark() {
  const W = 150, H = 110;
  const hw = W / 2, hh = H / 2;
  // one closed wall around the park, running clockwise seen from above with the park on its right
  const ring = [{ x: -hw, y: 0, z: -hh }, { x: hw, y: 0, z: -hh }, { x: hw, y: 0, z: hh }, { x: -hw, y: 0, z: hh }, { x: -hw, y: 0, z: -hh }];
  const walls = [{ points: ring, kind: 'tyres', side: 'left' }];
  const cones = [];
  // a slalom down the left, a donut circle on the right, a gate, and a box
  for (let i = 0; i < 8; i++) cones.push({ x: -40, z: 40 - i * 12 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cones.push({ x: 35 + Math.cos(a) * 11, z: -10 + Math.sin(a) * 11 }); }
  cones.push({ x: -8, z: -40 }, { x: 8, z: -40 });
  for (let i = 0; i < 5; i++) { cones.push({ x: -10 + i * 5, z: 35 }); cones.push({ x: -10 + i * 5, z: 45 }); }
  cones.push({ x: 40, z: 35 }, { x: 55, z: 35 }, { x: 40, z: 48 }, { x: 55, z: 48 });
  return { name: 'park', kind: 'park', length: 0, centre: [], walls, clips: [], start: { x: 0, z: 10, yaw: 0 }, checkpoints: [], bounds: { minX: -hw, maxX: hw, minZ: -hh, maxZ: hh }, cones, sections: {} };
}

function boundsOf(centre, pad) {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const c of centre) { if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x; if (c.z < minZ) minZ = c.z; if (c.z > maxZ) maxZ = c.z; }
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

export function groundByName(name) { return name === 'park' ? carPark() : testTrack(); }
