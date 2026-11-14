/* THE STUNT PARK'S SHAPE (briefs/PLAYGROUND.md). Free drift's ground:
   an open paved area, walled all round and flat, with places to drive
   to: a donut pad round a pillar, a figure eight round two pillars, a
   slalom of cones, a long curved wall to slide beside and two gates.
   Plain data and plain JavaScript, in the data contract every other
   ground uses (ground/track.js), so the physics drives on it as on any
   other: pillars and the long wall are walls like any wall.

   Every solid is round where a car can meet it (a pillar, a gate's
   piers, the long wall's ends): the physics tests the car's four
   corners and two side midpoints against a wall's faces, so a square
   corner could stand a metre inside the car's flank before either
   touched it; a 2 m radius cannot be more than a third of a metre in.
   And every solid is at least 3.2 m through: the physics pushes back a
   point up to 2.5 m behind a face (its guard against tunnelling), so a
   thinner wall would pull a car through from the other side.

   Units metres, x to the right and z towards the viewer on a plan, the
   start facing -z. Every number of the park's shape is in PARK. */
export const PARK = {
  W:            300,          // m across (the car park it replaces was 150)
  H:            200,          // m deep (was 110): 3.6 times the area
  START:        { x: 0, z: 80, yaw: 0 },   // facing the first gate; the donut pillar ahead to the left, the figure eight's first pillar ahead to the right, the cone line beyond
  SOLID_R:      2.0,          // m, the radius of a pillar, a pier and the long wall's ends
  SOLID_SIDES:  12,           // faces of a round solid, as the physics sees it
  DONUT:        { x: -32, z: -18, rings: [12, 20, 28], reach: 30, h: 11 },   // the pillar, the rings painted round it, and how far out a donut still counts
  EIGHT:        { a: { x: 36, z: -14 }, b: { x: 82, z: -14 }, reach: 30, h: 9 },   // two pillars 46 m apart: a held slide's circle is about 20 m in radius
  WALL:         { x: -108, z: -20, r: 29, from: 100, to: 260 },   // the long wall: a curve round this centre at this radius (its centre line; it is 2 x SOLID_R through), from and to in degrees, open to the east. A held slide circles at 20 to 29 m, so it can follow the inside all the way round: 75 m of wall
  WALL_H:       1.0,          // m tall, as the park's edge
  WALL_FACES:   22,           // straight faces along each side of the curve
  SLALOM:       { z: -70, x0: -90, step: 30, n: 7 },   // cones in a line across the north side, 30 m apart: a slide changes sides in about that at speed
  GATES:        [
    { id: 'a', x: 0, z: 35, along: 'z', gap: 9, h: 6.5 },      // driven through north or south, dead ahead of the start
    { id: 'b', x: -100, z: 40, along: 'x', gap: 7, h: 6.5 },   // the narrow one, driven through east or west
  ],
  TOUR_DONUT:   28,           // m from the donut pillar that visits the pad
  TOUR_EIGHT:   24,           // m from either of the eight's pillars that visits it
};

/* a round solid as a closed wall, its faces looking outwards */
function round(x, z, r, sides, kind, place) {
  const pts = [];
  for (let k = 0; k <= sides; k++) { const a = (k % sides) / sides * Math.PI * 2; pts.push({ x: x + Math.cos(a) * r, y: 0, z: z + Math.sin(a) * r }); }
  return { points: pts, kind, side: 'right', place };
}
/* the long wall: a curved band with a round end at each tip, one closed wall looking outwards */
function curvedWall(W, r, faces, sides, kind, place) {
  const a0 = W.from * Math.PI / 180, a1 = W.to * Math.PI / 180, pts = [], half = sides / 2;
  const at = (a, rad) => ({ x: W.x + Math.cos(a) * rad, y: 0, z: W.z + Math.sin(a) * rad });
  for (let k = 0; k <= faces; k++) pts.push(at(a0 + (a1 - a0) * k / faces, W.r + r));                       // the outside, from to
  { const c = at(a1, W.r); for (let k = 1; k < half; k++) { const a = a1 + k / half * Math.PI; pts.push({ x: c.x + Math.cos(a) * r, y: 0, z: c.z + Math.sin(a) * r }); } }   // round the far tip
  for (let k = 0; k <= faces; k++) pts.push(at(a1 + (a0 - a1) * k / faces, W.r - r));                       // the inside, back
  { const c = at(a0, W.r); for (let k = 1; k < half; k++) { const a = a0 + Math.PI + k / half * Math.PI; pts.push({ x: c.x + Math.cos(a) * r, y: 0, z: c.z + Math.sin(a) * r }); } }   // round the near tip
  pts.push({ ...pts[0] });
  return { points: pts, kind, side: 'right', place };
}
/* the gap between a point and the long wall's surface (negative inside it): W is park.wall */
export function wallGap(W, x, z) {
  const dx = x - W.x, dz = z - W.z;
  let a = Math.atan2(dz, dx); while (a < W.a0) a += 2 * Math.PI; while (a > W.a0 + 2 * Math.PI) a -= 2 * Math.PI;
  if (a <= W.a1) return Math.abs(Math.hypot(dx, dz) - W.r) - W.half;
  return Math.min(Math.hypot(x - W.tips[0].x, z - W.tips[0].z), Math.hypot(x - W.tips[1].x, z - W.tips[1].z)) - W.half;
}

/* THE GROUND. Besides the contract's fields it carries park: the
   places as the judge (park/challenges.js) and the scene (env/park.js)
   read them: solids (every round thing, with its height and the place
   it belongs to), and each place by name. */
export function stuntPark() {
  const P = PARK, hw = P.W / 2, hh = P.H / 2, r = P.SOLID_R, n = P.SOLID_SIDES;
  /* the outer wall, running clockwise seen from above with the park on its right */
  const ring = [{ x: -hw, y: 0, z: -hh }, { x: hw, y: 0, z: -hh }, { x: hw, y: 0, z: hh }, { x: -hw, y: 0, z: hh }, { x: -hw, y: 0, z: -hh }];
  const walls = [{ points: ring, kind: 'tyres', side: 'left', place: 'edge' }];
  const solids = [];
  const pillar = (x, z, h, place, id) => { walls.push(round(x, z, r, n, 'pillar', place)); solids.push({ id, x, z, r, h, place }); };
  pillar(P.DONUT.x, P.DONUT.z, P.DONUT.h, 'donut', 'donut');
  pillar(P.EIGHT.a.x, P.EIGHT.a.z, P.EIGHT.h, 'eight', 'eight-a');
  pillar(P.EIGHT.b.x, P.EIGHT.b.z, P.EIGHT.h, 'eight', 'eight-b');
  const gates = P.GATES.map(g => {
    const off = g.gap / 2 + r, ax = g.along === 'z' ? 1 : 0, az = g.along === 'z' ? 0 : 1;   // the piers stand either side, across the way through
    const piers = [{ x: g.x - ax * off, z: g.z - az * off }, { x: g.x + ax * off, z: g.z + az * off }];
    piers.forEach((p, k) => pillar(p.x, p.z, g.h, 'gate-' + g.id, 'gate-' + g.id + '-' + k));
    return { id: g.id, x: g.x, z: g.z, along: g.along, gap: g.gap, h: g.h, piers };
  });
  walls.push(curvedWall(P.WALL, r, P.WALL_FACES, n, 'longwall', 'wall'));
  const cones = [];
  for (let i = 0; i < P.SLALOM.n; i++) cones.push({ x: P.SLALOM.x0 + i * P.SLALOM.step, z: P.SLALOM.z });
  const a0 = P.WALL.from * Math.PI / 180, a1 = P.WALL.to * Math.PI / 180, tip = a => ({ x: P.WALL.x + Math.cos(a) * P.WALL.r, z: P.WALL.z + Math.sin(a) * P.WALL.r });
  const park = {
    solids, gates,
    donut: { x: P.DONUT.x, z: P.DONUT.z, rings: P.DONUT.rings.slice(), reach: P.DONUT.reach, tour: P.TOUR_DONUT },
    eight: { a: { ...P.EIGHT.a }, b: { ...P.EIGHT.b }, reach: P.EIGHT.reach, tour: P.TOUR_EIGHT },
    wall: { x: P.WALL.x, z: P.WALL.z, r: P.WALL.r, a0, a1, half: r, h: P.WALL_H, tips: [tip(a0), tip(a1)] },
    slalom: { z: P.SLALOM.z, x: cones.map(c => c.x), first: 0, n: P.SLALOM.n },
    places: ['donut', 'eight', 'slalom', 'wall', 'gate-a', 'gate-b'],
  };
  return { name: 'stunt park', kind: 'park', length: 0, centre: [], walls, clips: [], start: { ...P.START }, checkpoints: [], bounds: { minX: -hw, maxX: hw, minZ: -hh, maxZ: hh }, cones, sections: {}, park };
}
