/* THE PHYSICS WORLD: one car, the walls, the cones, where the car is
   along the track. Steps at a fixed rate from a single input record and
   is deterministic for a given input stream. Nothing here draws.

   Walls are flattened into segments with an inward normal. A body point
   (a corner or a side midpoint of the car) that is less than WALL_HALF
   inside a segment's line is pushed back and takes an impulse. A hit
   harder than SCORING.HARD_HIT along the normal is a hard hit: the
   scoring loses the chain and the car keeps only HIT_SPEED_KEEP of its
   speed. Cones are knocked and roll away, for the look of it and the
   near miss bonus; they are part of the run's state so a replay knocks
   the same cones. */
import { TUNE } from '../tune.js';
import { createVehicle, stepVehicle, applyImpact, bodyPoints, vehicleHash, STEP } from './vehicle.js';

const WALL_HALF = 0.25;        // m, half the wall's thickness
const TUNNEL_GUARD = 2.5;      // m, a point this far behind a wall is still pushed back in
const WALL_RESTITUTION = 0.12;
const WALL_FRICTION = 0.5;
const HIT_MIN = 0.8;           // m/s along the normal before a contact counts as a hit
const CONE_RADIUS = 0.3;
const CONE_DRAG = 2.5;         // per second
const OFF_TRACK = 6;           // m past the half width is a respawn

export { STEP };

export function createWorld(ground) {
  const segs = [];
  for (const wall of ground.walls) {
    const p = wall.points;
    for (let i = 0; i + 1 < p.length; i++) {
      const dx = p[i + 1].x - p[i].x, dz = p[i + 1].z - p[i].z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      const ux = dx / len, uz = dz / len;
      // inward: right of the direction for a left wall, left for a right wall
      const nx = wall.side === 'left' ? -uz : uz;
      const nz = wall.side === 'left' ? ux : -ux;
      segs.push({ ax: p[i].x, az: p[i].z, ux, uz, len, nx, nz, kind: wall.kind, side: wall.side, index: i, wall });
    }
  }
  // a coarse grid over the segments so a step tests a handful, not all
  const CELL = 16;
  const b = ground.bounds;
  const cols = Math.max(1, Math.ceil((b.maxX - b.minX) / CELL) + 2), rows = Math.max(1, Math.ceil((b.maxZ - b.minZ) / CELL) + 2);
  const grid = new Array(cols * rows);
  for (let i = 0; i < grid.length; i++) grid[i] = [];
  const cellX = x => Math.min(cols - 1, Math.max(0, Math.floor((x - b.minX) / CELL) + 1));
  const cellZ = z => Math.min(rows - 1, Math.max(0, Math.floor((z - b.minZ) / CELL) + 1));
  const cellOf = (x, z) => cellZ(z) * cols + cellX(x);
  for (const s of segs) {
    const x0 = Math.min(s.ax, s.ax + s.ux * s.len) - 1, x1 = Math.max(s.ax, s.ax + s.ux * s.len) + 1;
    const z0 = Math.min(s.az, s.az + s.uz * s.len) - 1, z1 = Math.max(s.az, s.az + s.uz * s.len) + 1;
    for (let cx = cellX(x0); cx <= cellX(x1); cx++) for (let cz = cellZ(z0); cz <= cellZ(z1); cz++) grid[cz * cols + cx].push(s);
  }

  const car = createVehicle(ground.start.x, ground.start.z, ground.start.yaw);
  const cones = ground.cones.map(c => ({ x0: c.x, z0: c.z, x: c.x, z: c.z, vx: 0, vz: 0, knocked: 0, tilt: 0, tiltX: 0, tiltZ: 0 }));
  const pts = new Float64Array(12);
  const world = {
    ground, car, cones, segs, step: 0, time: 0,
    along: 0, lateral: 0, centreIndex: 0,   // where the car is along the track, and how far left of the centre
    hit: null,                              // this step's hit, if any: { speed, hard, kind, x, z }
    respawned: false, recovered: false, stuckT: 0, lastTouch: -1, wallNx: 0, wallNz: 0, touching: false, hits: 0, hardHits: 0, conesKnocked: 0, nearest: Infinity, nearestClip: null,
    stepWorld, reset, hash, locate, clipDistance,
  };

  function reset() {
    const c = createVehicle(ground.start.x, ground.start.z, ground.start.yaw);
    Object.assign(car, c);
    for (const k of cones) { k.x = k.x0; k.z = k.z0; k.vx = 0; k.vz = 0; k.knocked = 0; k.tilt = 0; k.tiltX = 0; k.tiltZ = 0; }
    world.step = 0; world.time = 0; world.hit = null; world.touching = false; world.stuckT = 0; world.lastTouch = -1; world.recovered = false; world.hits = 0; world.hardHits = 0; world.conesKnocked = 0; world.respawned = false;
    world.centreIndex = 0; world.along = 0; world.lateral = 0; world.nearest = Infinity;
    locate(true);
  }

  /* Nearest centre sample, incrementally; a full search when asked or lost. */
  function locate(full) {
    const C = ground.centre, n = C.length;
    if (!n) return;
    let best = world.centreIndex, bd = Infinity;
    const d2 = i => { const c = C[((i % n) + n) % n]; return (c.x - car.x) ** 2 + (c.z - car.z) ** 2; };
    if (full) { for (let i = 0; i < n; i++) { const d = d2(i); if (d < bd) { bd = d; best = i; } } }
    else {
      bd = d2(best);
      for (let k = 1; k <= 6; k++) { const d = d2(best + k); if (d < bd) { bd = d; best = ((best + k) % n + n) % n; } }
      for (let k = 1; k <= 6; k++) { const d = d2(best - k); if (d < bd) { bd = d; best = ((best - k) % n + n) % n; } }
      if (bd > 400) { for (let i = 0; i < n; i++) { const d = d2(i); if (d < bd) { bd = d; best = i; } } }
    }
    world.centreIndex = best;
    const c = C[best];
    const lx = -Math.cos(c.heading), lz = Math.sin(c.heading);
    const fx = -Math.sin(c.heading), fz = -Math.cos(c.heading);
    world.lateral = (car.x - c.x) * lx + (car.z - c.z) * lz;
    world.along = best * 2 + (car.x - c.x) * fx + (car.z - c.z) * fz;
    world.halfWidth = c.width / 2;
  }

  /* Distance from the car's nearest body point to the nearest wall that
     is inside a clipping zone at the car's position; Infinity if none. */
  function clipDistance() {
    if (!ground.clips.length) return Infinity;
    const s = world.along;
    let best = Infinity, which = null;
    for (const clip of ground.clips) {
      if (s < clip.from || s > clip.to) continue;
      const wall = ground.walls.find(w => w.side === clip.side);
      if (!wall) continue;
      const i0 = Math.max(0, Math.floor(clip.from / 2) - 1), i1 = Math.min(wall.points.length - 2, Math.ceil(clip.to / 2) + 1);
      for (let i = i0; i <= i1; i++) {
        const p = wall.points[i], q = wall.points[i + 1];
        for (let k = 0; k < 6; k++) { const d = pointSegment(pts[k * 2], pts[k * 2 + 1], p.x, p.z, q.x, q.z); if (d < best) { best = d; which = clip; } }
      }
    }
    world.nearestClip = which;
    return best;
  }

  function pointSegment(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
  }

  function collideWalls() {
    const S = TUNE.SCORING;
    let worst = null, contact = false;
    for (let pass = 0; pass < 2; pass++) {
      bodyPoints(car, pts);
      let any = false;
      for (let k = 0; k < 6; k++) {
        const px = pts[k * 2], pz = pts[k * 2 + 1];
        const cell = grid[cellOf(px, pz)];
        for (let j = 0; j < cell.length; j++) {
          const s = cell[j];
          const rx = px - s.ax, rz = pz - s.az;
          const t = rx * s.ux + rz * s.uz;
          if (t < -0.3 || t > s.len + 0.3) continue;
          const d = rx * s.nx + rz * s.nz;          // signed distance inward of the wall line
          if (d >= WALL_HALF || d < -TUNNEL_GUARD) continue;
          const depth = WALL_HALF - d;
          car.x += s.nx * depth; car.z += s.nz * depth;
          const removed = applyImpact(car, px, pz, s.nx, s.nz, WALL_RESTITUTION, WALL_FRICTION);
          any = true; contact = true; world.wallNx = s.nx; world.wallNz = s.nz;
          if (removed > 0 && (!worst || removed > worst.speed)) worst = { speed: removed, kind: s.kind, nx: s.nx, nz: s.nz, x: px, z: pz, hard: removed >= S.HARD_HIT };
          bodyPoints(car, pts);
        }
      }
      if (!any) break;
    }
    /* A hit is a new contact, or a hard one at any time; a scrape along
       a wall is one contact however many steps it lasts. */
    if (worst && worst.speed >= HIT_MIN && (!world.touching || worst.hard)) {
      world.hits++;
      if (worst.hard) {
        world.hardHits++;
        car.wvx *= S.HIT_SPEED_KEEP; car.wvz *= S.HIT_SPEED_KEEP; car.r *= S.HIT_SPEED_KEEP;
      }
      world.hit = worst;
    }
    world.touching = contact;
  }

  function collideCones(dt) {
    const V = TUNE.VEHICLE;
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    const lx = -Math.cos(car.yaw), lz = Math.sin(car.yaw);
    let nearest = Infinity;
    for (const k of cones) {
      if (k.knocked) {
        if (k.vx !== 0 || k.vz !== 0) {
          k.x += k.vx * dt; k.z += k.vz * dt;
          const f = Math.max(0, 1 - CONE_DRAG * dt);
          k.vx *= f; k.vz *= f;
          if (Math.abs(k.vx) + Math.abs(k.vz) < 0.05) { k.vx = 0; k.vz = 0; }
          if (k.tilt < 1) k.tilt = Math.min(1, k.tilt + dt * 4);
        }
        continue;
      }
      const dx = k.x - car.x, dz = k.z - car.z;
      const f = dx * fx + dz * fz, l = dx * lx + dz * lz;
      const cx = Math.max(-V.HALF_LENGTH, Math.min(V.HALF_LENGTH, f)), cl = Math.max(-V.HALF_WIDTH, Math.min(V.HALF_WIDTH, l));
      const gap = Math.hypot(f - cx, l - cl) - CONE_RADIUS;
      if (gap < nearest) nearest = gap;
      if (gap <= 0) {
        k.knocked = 1; world.conesKnocked++;
        const px = car.x + fx * f + lx * l;      // the car's velocity at the cone, roughly
        const pvx = car.wvx + car.r * (k.z - car.z), pvz = car.wvz - car.r * (k.x - car.x);
        let ox = f - cx, oz = l - cl;             // push outward from the body
        const ol = Math.hypot(ox, oz) || 1;
        ox /= ol; oz /= ol;
        const wx = fx * ox + lx * oz, wz = fz * ox + lz * oz;
        k.vx = pvx * 0.9 + wx * 3; k.vz = pvz * 0.9 + wz * 3;
        k.tiltX = -wz; k.tiltZ = wx;
        void px;
      }
    }
    world.nearestCone = nearest;
  }

  /* GETTING UNSTUCK. A car that is barely moving while the player tries
     to drive (throttle or brake held), with its nose against a wall or
     facing back down the track, for RECOVER_AFTER seconds, is put back on
     the track pointing the right way and rolling. Reverse still works and
     usually gets there first; this is for the player who does not know
     it is there. In the car park, with no track, it is turned to face
     away from the wall instead. Deterministic: it reads only the state. */
  function unstick(input) {
    const A = TUNE.ASSIST;
    if (car.speed > A.RECOVER_SPEED || !(input.throttle > 0 || input.brake > 0)) { world.stuckT = 0; return; }
    const nearWall = world.touching || (world.lastTouch >= 0 && world.time - world.lastTouch < 0.4);
    let facingBack = false;
    if (ground.centre.length) {
      const c = ground.centre[world.centreIndex];
      const dot = Math.cos(car.yaw - c.heading);
      facingBack = dot < -0.35;
    }
    if (!nearWall && !facingBack) { world.stuckT = 0; return; }
    world.stuckT += STEP;
    if (world.stuckT < A.RECOVER_AFTER) return;
    world.stuckT = 0;
    if (ground.centre.length) {
      const c = ground.centre[world.centreIndex];
      Object.assign(car, createVehicle(c.x, c.z, c.heading));
      car.wvx = -Math.sin(c.heading) * A.RECOVER_LAUNCH; car.wvz = -Math.cos(c.heading) * A.RECOVER_LAUNCH;
      locate(true);
    } else {
      const yaw = Math.atan2(-world.wallNx, -world.wallNz);
      Object.assign(car, createVehicle(car.x + world.wallNx * 1.0, car.z + world.wallNz * 1.0, yaw));
    }
    world.respawned = true; world.recovered = true;
  }

  function stepWorld(input) {
    world.hit = null; world.respawned = false; world.recovered = false;
    stepVehicle(car, input, STEP);
    collideWalls();
    if (world.touching) world.lastTouch = world.time;
    collideCones(STEP);
    if (ground.centre.length) {
      locate(false);
      if (Math.abs(world.lateral) > world.halfWidth + OFF_TRACK) {
        // off the track: back on the line, pointing down it, stopped
        const c = ground.centre[world.centreIndex];
        Object.assign(car, createVehicle(c.x, c.z, c.heading));
        world.respawned = true;
        locate(true);
      }
      bodyPoints(car, pts);
      world.nearest = clipDistance();
    } else {
      bodyPoints(car, pts);
      world.nearest = world.nearestCone;
      world.nearestClip = null;
    }
    unstick(input);
    world.step++;
    world.time = world.step * STEP;
  }

  function hash() {
    let h = vehicleHash(car);
    for (const k of cones) if (k.knocked) h += '|' + k.x + ',' + k.z + ',' + k.vx + ',' + k.vz;
    return h + '|' + world.step + ',' + world.hits + ',' + world.hardHits;
  }

  locate(true);
  return world;
}
