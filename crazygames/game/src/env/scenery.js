/* WHERE THE SCENERY STANDS, as plain data. placeScenery(track, theme,
   terrain, options) returns, for every prop kind, a list of instances
   { x, y, z, ry, s, c } (position on the terrain, heading, scale, an
   optional colour), plus the trackside furniture: grandstands facing
   the big corners, light towers, flags and sponsor boards along the
   straights, tyre stacks behind the outside of corners, lamp posts
   along the road. No three.js, so the probes can run it in Node and
   check every instance against the road.

   The rules the probe checks come from here: a prop's footprint keeps
   at least its kind's keepOut past the road edge and its run-off, and
   the bigger a thing the further back it stands. Everything sits on
   the terrain's height at its position. Density is per hectare of the
   area outside the keep-out, thinned by the tier's share. */
import { makeRng } from './rng.js';

/* Footprint radius and height per kind at scale 1, for placing and for
   the sight line probe. props.js builds them to these sizes. */
export const PROP_DIMS = {
  pine:       { r: 1.7,  h: 9.0 },
  tree:       { r: 2.4,  h: 6.5 },
  palm:       { r: 2.6,  h: 7.5 },
  cactus:     { r: 0.9,  h: 3.6 },
  bush:       { r: 1.0,  h: 1.3 },
  rock:       { r: 1.1,  h: 1.2 },
  boulder:    { r: 2.6,  h: 2.8 },
  mesa:       { r: 17,   h: 15 },
  container:  { r: 3.3,  h: 2.6 },
  warehouse:  { r: 14,   h: 8.5 },
  crane:      { r: 14,   h: 24 },
  lamp:       { r: 0.4,  h: 8.5 },
  tyrestack:  { r: 0.7,  h: 1.0 },
  bollard:    { r: 0.3,  h: 0.9 },
  house:      { r: 5.2,  h: 6.0 },
  barn:       { r: 7.5,  h: 8.0 },
  cabin:      { r: 4.0,  h: 4.5 },
  haybale:    { r: 0.9,  h: 1.6 },
  grandstand: { r: 9.5,  h: 7.0 },
  tower:      { r: 1.4,  h: 15.5 },
  flag:       { r: 0.8,  h: 5.2 },
  board:      { r: 3.2,  h: 3.2 },
};

export const SCENERY = {
  SAMPLE:        2,        // m between centre samples, as the generator lays them
  NEAR_BAND:     60,       // m past the edge counted as near, where `near` thins or thickens a kind
  GRANDSTAND_BACK: 7,      // m from the road edge (plus run-off) to a grandstand's front
  TOWER_BACK:    9,
  FLAG_BACK:     4.5,
  BOARD_BACK:    6,
  TYRE_BACK:     3.5,
  LAMP_BACK:     4.5,
  LAMP_EVERY:    42,       // m along the road between lamp posts
  FLAG_EVERY:    14,
  BOARD_EVERY:   26,
  MIN_CORNER_ANGLE: 50,    // degrees: corners this big get a grandstand or a tower
  FLAG_COLOURS:  [0x19d8ff, 0xf6e7a1, 0xff8a3c, 0xffffff, 0xff4a6a, 0x7bff6a],
  CONTAINER_COLOURS: [0xb0413e, 0x2f6fa8, 0x4f8a3c, 0xd9a13a, 0x6f6f78, 0xe0e0e0, 0x8a3a8a],
  MAX_PER_KIND:  4000,
};

/* The track's corners, from its own list or found from the heading. */
function cornersOf(track) {
  if (track.corners && track.corners.length) return track.corners.map(c => ({ from: c.from, to: c.to, apex: c.apex, angle: Math.abs(c.angle), dir: c.dir, radius: c.radius }));
  const C = track.centre, n = C.length, out = [];
  if (!n) return out;
  let i = 0;
  while (i < n) {
    const kappa = j => { const a = C[(j - 1 + n) % n].heading, b = C[(j + 1) % n].heading; let d = b - a; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); return d / 4; };
    if (Math.abs(kappa(i)) > 1 / 200) {
      const from = i, sign = Math.sign(kappa(i));
      let turn = 0;
      while (i < n && Math.sign(kappa(i)) === sign && Math.abs(kappa(i)) > 1 / 200) { turn += kappa(i) * 2; i++; }
      out.push({ from: from * 2, to: i * 2, apex: (from + i), angle: Math.abs(turn) * 180 / Math.PI, dir: sign > 0 ? 'left' : 'right', radius: 1 / Math.max(1e-6, Math.abs(turn) / ((i - from) * 2)) });
    } else i++;
  }
  return out;
}

/* A point beside the road: s metres along, u metres from the centre
   line to the left (negative right), on the terrain. */
function beside(track, terrain, s, u) {
  const C = track.centre, n = C.length;
  const i = ((Math.round(s / SCENERY.SAMPLE) % n) + n) % n, c = C[i];
  const lx = -Math.cos(c.heading), lz = Math.sin(c.heading);
  const x = c.x + lx * u, z = c.z + lz * u;
  return { x, z, y: terrain.heightAt(x, z), heading: c.heading, sample: c, lx, lz };
}
/* The wall's lateral offset at s on a side, from the wall polyline. */
function wallOffset(track, s, side) {
  const w = track.walls && track.walls.find(x => x.side === side && !x.cap);
  const C = track.centre, n = C.length;
  const i = ((Math.round(s / SCENERY.SAMPLE) % n) + n) % n, c = C[i];
  if (!w || !w.points[i]) return c.width / 2;
  const lx = -Math.cos(c.heading), lz = Math.sin(c.heading), p = w.points[i];
  return Math.abs((p.x - c.x) * lx + (p.z - c.z) * lz);
}

export function placeScenery(track, theme, terrain, options) {
  const o = options || {};
  const share = o.share === undefined ? 1 : o.share;
  const seed = (track.seed >>> 0) || 1;
  const rng = makeRng(seed ^ 0xa5a5a5a5);
  const out = {};
  const add = (kind, inst) => { (out[kind] || (out[kind] = [])).push(inst); };
  const ext = terrain.extent;
  const area = (ext.maxX - ext.minX) * (ext.maxZ - ext.minZ) / 10000;     // hectares, roughly, including the road
  const dims = kind => PROP_DIMS[kind] || { r: 1, h: 1 };

  /* scattered props */
  for (const p of theme.props) {
    const want = Math.min(SCENERY.MAX_PER_KIND, Math.round(p.perHa * area * share * (p.kind === 'bush' || p.kind === 'rock' ? 1 : 1)));
    let placed = 0, tries = 0;
    while (placed < want && tries < want * 6) {
      tries++;
      const x = rng.range(ext.minX, ext.maxX), z = rng.range(ext.minZ, ext.maxZ);
      const s = rng.range(p.scale[0], p.scale[1]);
      const d = terrain.edgeDistance(x, z) - dims(p.kind).r * s;
      if (d < p.keepOut) continue;
      // thin or thicken within the near band
      const near = d < SCENERY.NEAR_BAND;
      if (near && !rng.chance(p.near)) continue;
      if (!near && p.near > 0.6 && !rng.chance(0.55)) continue;   // things that crowd the roadside are rarer far out
      const y = terrain.heightAt(x, z);
      if (terrain.sea && y < terrain.sea.level + 0.5) continue;    // not in the water
      if (p.flat) {
        // buildings want level ground: reject a slope
        const e = 6;
        const dy = Math.max(Math.abs(terrain.heightAt(x + e, z) - y), Math.abs(terrain.heightAt(x, z + e) - y));
        if (dy > 1.2) continue;
      }
      const ry = p.align ? Math.round(rng.range(0, 3)) * Math.PI / 2 + 0.3 : rng.range(0, Math.PI * 2);
      const c = p.colour !== undefined ? p.colour : (p.kind === 'container' ? rng.pick(SCENERY.CONTAINER_COLOURS) : undefined);
      add(p.kind, { x, y, z, ry, s, c });
      if (p.stack) {
        const h = dims(p.kind).h;
        for (let k = 1; k < p.stack && rng.chance(0.55); k++) add(p.kind, { x, y: y + h * k, z, ry, s, c: rng.pick(SCENERY.CONTAINER_COLOURS) });
      }
      placed++;
    }
  }

  /* trackside furniture, only where there is a road */
  const C = track.centre, n = C.length;
  if (n) {
    const side = theme.trackside;
    const corners = cornersOf(track).filter(c => c.angle >= SCENERY.MIN_CORNER_ANGLE).sort((a, b) => b.angle - a.angle);
    const closed = track.kind === 'circuit';
    const length = track.length;
    const used = [];   // along, half length: so furniture does not overlap
    const free = (s, half) => used.every(u => Math.abs(((s - u[0]) % length + length * 1.5) % length - length / 2) > half + u[1]);
    const outsideOf = c => c.dir === 'left' ? -1 : 1;     // the outside of a left hander is to the right
    // grandstands on the outside of the biggest corners, facing the apex
    let stands = 0;
    for (const c of corners) {
      if (stands >= side.grandstands) break;
      const s = c.apex, sgn = outsideOf(c);
      if (!free(s, 12)) continue;
      const w = wallOffset(track, s, sgn > 0 ? 'left' : 'right');
      const u = sgn * (w + SCENERY.GRANDSTAND_BACK + dims('grandstand').r * 0.85);
      const p = beside(track, terrain, s, u);
      // face the road: the stand's front is its -Z side
      const ry = Math.atan2(-(p.lx * sgn), -(p.lz * sgn));
      add('grandstand', { x: p.x, y: p.y, z: p.z, ry, s: 1, c: undefined });
      used.push([s, 14]); stands++;
    }
    // light towers at corner exits and the start
    let towers = 0;
    const towerAt = (s, sgn) => {
      if (towers >= side.towers || !free(s, 4)) return;
      const w = wallOffset(track, s, sgn > 0 ? 'left' : 'right');
      const p = beside(track, terrain, s, sgn * (w + SCENERY.TOWER_BACK));
      add('tower', { x: p.x, y: p.y, z: p.z, ry: p.heading, s: 1 });
      used.push([s, 4]); towers++;
    };
    towerAt(track.startLine === undefined ? 8 : track.startLine, rng.chance(0.5) ? 1 : -1);
    for (const c of corners) towerAt(c.to + 10, -outsideOf(c));
    // lamp posts along the road, alternating sides
    if (side.lamps > 0) {
      let k = 0;
      for (let s = 20; s < length - (closed ? 0 : 30) && k < side.lamps; s += SCENERY.LAMP_EVERY, k++) {
        if (!free(s, 1.5)) continue;
        const sgn = k % 2 ? 1 : -1;
        const w = wallOffset(track, s, sgn > 0 ? 'left' : 'right');
        const p = beside(track, terrain, s, sgn * (w + SCENERY.LAMP_BACK));
        add('lamp', { x: p.x, y: p.y, z: p.z, ry: p.heading + (sgn > 0 ? -Math.PI / 2 : Math.PI / 2), s: 1 });
      }
    }
    // flags and boards along the straights (where the heading barely changes)
    const straight = s => { const i = Math.round(s / 2); const a = C[((i - 3) % n + n) % n].heading, b = C[((i + 3) % n + n) % n].heading; let d = b - a; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); return Math.abs(d) < 0.08; };
    let flags = 0, boards = 0;
    for (let s = 30; s < length - (closed ? 0 : 40); s += SCENERY.FLAG_EVERY) {
      if (!straight(s)) continue;
      if (flags < side.flags && free(s, 1)) {
        const sgn = Math.floor(s / SCENERY.FLAG_EVERY) % 2 ? 1 : -1;
        const w = wallOffset(track, s, sgn > 0 ? 'left' : 'right');
        const p = beside(track, terrain, s, sgn * (w + SCENERY.FLAG_BACK));
        add('flag', { x: p.x, y: p.y, z: p.z, ry: p.heading, s: 1, c: SCENERY.FLAG_COLOURS[flags % SCENERY.FLAG_COLOURS.length] });
        flags++;
      }
    }
    for (let s = 44; s < length - (closed ? 0 : 40); s += SCENERY.BOARD_EVERY) {
      if (!straight(s) || boards >= side.boards || !free(s, 4)) continue;
      const sgn = Math.floor(s / SCENERY.BOARD_EVERY) % 2 ? -1 : 1;
      const w = wallOffset(track, s, sgn > 0 ? 'left' : 'right');
      const p = beside(track, terrain, s, sgn * (w + SCENERY.BOARD_BACK));
      // the board faces across the road: its front is -Z, turned to look at the road
      const ry = Math.atan2(-(p.lx * sgn), -(p.lz * sgn));
      add('board', { x: p.x, y: p.y, z: p.z, ry, s: 1, c: boards });
      used.push([s, 4]); boards++;
    }
    // tyre stacks behind the barrier on the outside of corners
    let tyres = 0;
    for (const c of corners) {
      for (let s = c.from + 6; s < c.to - 4 && tyres < side.tyres; s += 9) {
        const sgn = outsideOf(c);
        const w = wallOffset(track, s, sgn > 0 ? 'left' : 'right');
        const p = beside(track, terrain, s, sgn * (w + SCENERY.TYRE_BACK + rng.range(0, 1.5)));
        add('tyrestack', { x: p.x, y: p.y, z: p.z, ry: rng.range(0, Math.PI), s: 1 });
        tyres++;
      }
    }
  }
  return out;
}

/* Every instance as a flat list with its footprint and height, for the probe. */
export function flatten(placed) {
  const list = [];
  for (const kind of Object.keys(placed)) for (const i of placed[kind]) { const d = PROP_DIMS[kind] || { r: 1, h: 1 }; list.push({ kind, x: i.x, y: i.y, z: i.z, r: d.r * (i.s || 1), h: d.h * (i.s || 1) }); }
  return list;
}
