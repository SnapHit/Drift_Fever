/* THE GROUND AROUND A TRACK, as plain data. buildTerrain(track, theme,
   options) returns a vertex coloured height grid over the track's
   bounds plus a wide margin, and the functions the scenery and the
   probes use: the height anywhere, the distance from the road's edge,
   and where the sea is.

   The relief is hills from seeded value noise, masked by the distance
   from the road: dead flat within theme.flatFrom metres of the road
   edge (past its run-off), rising to full height by theme.flatTo. So
   the ground rolls into hills away from the track and never onto it,
   which is a rule the probe checks: the terrain under and beside the
   road is at the road's height.

   The distance field is a coarse grid of the distance to the nearest
   centre sample, found by dead reckoning (two sweeps that pass the
   nearest sample along), then bilinearly interpolated. It is accurate
   to a metre or so, which is plenty for a mask that ramps over a
   hundred; exactEdgeDistance refines it where it matters. No three.js
   here, so Node can run it. */
import { makeNoise, hash32 } from './rng.js';

export const TERRAIN = {
  PAD:          520,      // m beyond the track's bounds the ground reaches
  RUNOFF:       4,        // m of run-off the generator may put before a barrier
  FIELD_CELL:   6,        // m, the distance field's grid
  FIELD_REACH:  150,      // m, the distance a node that no sample reaches reports
  BELOW:        -0.03,    // m, the flat ground sits just under the road against z fighting
  SEA_LEVEL:    -1.5,     // m
  SEA_BEYOND:   { coastal: 70, docks: 36 },   // m past the track's extent the water starts
};

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/* A rough distance from the road edge. For a track: the distance to the
   nearest centre sample less that sample's half width and the run-off.
   For the car park (no centre line): the distance outside its slab. */
export function makeEdgeField(track, extent) {
  const C = track.centre, n = C.length;
  const cell = TERRAIN.FIELD_CELL;
  const cols = Math.ceil((extent.maxX - extent.minX) / cell) + 1, rows = Math.ceil((extent.maxZ - extent.minZ) / cell) + 1;
  const dist = new Float32Array(cols * rows), idx = new Int32Array(cols * rows);
  if (!n) {
    const b = track.bounds;
    const f = (x, z) => { const dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ); return Math.hypot(dx, dz); };
    return { edge: f, nearest: () => -1, cols, rows, cell, alongField: false };
  }
  /* dead reckoning: each node remembers its nearest sample so far, seeded
     at the nodes the samples fall in, then two sweeps pass the nearest
     sample along to neighbours and keep it when it is closer. Two passes
     over the grid, exact to within a cell. */
  dist.fill(Infinity); idx.fill(-1);
  const nx = c => extent.minX + c * cell, nz = r => extent.minZ + r * cell;
  for (let i = 0; i < n; i++) {
    const c = Math.round((C[i].x - extent.minX) / cell), r = Math.round((C[i].z - extent.minZ) / cell);
    if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
    const k = r * cols + c, d = Math.hypot(C[i].x - nx(c), C[i].z - nz(r));
    if (d < dist[k]) { dist[k] = d; idx[k] = i; }
  }
  const relax = (k, kn, x, z) => { const j = idx[kn]; if (j < 0) return; const d = Math.hypot(C[j].x - x, C[j].z - z); if (d < dist[k]) { dist[k] = d; idx[k] = j; } };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c, x = nx(c), z = nz(r);
    if (c > 0) relax(k, k - 1, x, z);
    if (r > 0) { relax(k, k - cols, x, z); if (c > 0) relax(k, k - cols - 1, x, z); if (c + 1 < cols) relax(k, k - cols + 1, x, z); }
  }
  for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) {
    const k = r * cols + c, x = nx(c), z = nz(r);
    if (c + 1 < cols) relax(k, k + 1, x, z);
    if (r + 1 < rows) { relax(k, k + cols, x, z); if (c + 1 < cols) relax(k, k + cols + 1, x, z); if (c > 0) relax(k, k + cols - 1, x, z); }
  }
  for (let k = 0; k < dist.length; k++) { const i = idx[k] < 0 ? 0 : idx[k]; idx[k] = i; dist[k] = (isFinite(dist[k]) ? dist[k] : TERRAIN.FIELD_REACH) - C[i].width / 2 - TERRAIN.RUNOFF; }
  const sample = (x, z) => {
    const fx = (x - extent.minX) / cell, fz = (z - extent.minZ) / cell;
    const c0 = Math.max(0, Math.min(cols - 2, Math.floor(fx))), r0 = Math.max(0, Math.min(rows - 2, Math.floor(fz)));
    const tx = clamp01(fx - c0), tz = clamp01(fz - r0);
    const a = dist[r0 * cols + c0], b = dist[r0 * cols + c0 + 1], cc = dist[(r0 + 1) * cols + c0], d = dist[(r0 + 1) * cols + c0 + 1];
    return mix(mix(a, b, tx), mix(cc, d, tx), tz);
  };
  const nearest = (x, z) => { const c = Math.max(0, Math.min(cols - 1, Math.round((x - extent.minX) / cell))), r = Math.max(0, Math.min(rows - 1, Math.round((z - extent.minZ) / cell))); return idx[r * cols + c]; };
  return { edge: sample, nearest, cols, rows, cell, alongField: true };
}

/* Exact distance from the road edge at a point, for the probe's known
   answers and for props that must be placed precisely: the nearest
   centre sample by the field, refined over its neighbours. */
export function exactEdgeDistance(track, field, x, z) {
  const C = track.centre, n = C.length;
  if (!n) return field.edge(x, z);
  const i0 = field.nearest(x, z);
  let best = Infinity;
  for (let k = -8; k <= 8; k++) {
    const i = ((i0 + k) % n + n) % n;
    const c = C[i], d = Math.hypot(c.x - x, c.z - z) - c.width / 2 - TERRAIN.RUNOFF;
    if (d < best) best = d;
  }
  return best;
}

export function buildTerrain(track, theme, options) {
  const o = options || {};
  const cell = o.cell || 8;
  const seed = (track.seed >>> 0) || 1;
  const b = track.bounds, pad = o.pad === undefined ? TERRAIN.PAD : o.pad;
  const extent = { minX: b.minX - pad, maxX: b.maxX + pad, minZ: b.minZ - pad, maxZ: b.maxZ + pad };
  const field = makeEdgeField(track, extent);
  const hillsN = makeNoise(seed), rollN = makeNoise(seed + 17), colourN = makeNoise(seed + 29), patchN = makeNoise(seed + 41), grainN = makeNoise(seed + 53);
  const centre = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };

  /* the sea, if the theme has one: a half plane beyond the track on a seeded side */
  let sea = null;
  if (theme.sea) {
    const ang = (hash32(seed + 7) % 3600) / 3600 * Math.PI * 2;
    const dir = { x: Math.sin(ang), z: Math.cos(ang) };
    let far = -Infinity;
    const pts = track.centre.length ? track.centre : [{ x: b.minX, z: b.minZ }, { x: b.maxX, z: b.minZ }, { x: b.minX, z: b.maxZ }, { x: b.maxX, z: b.maxZ }];
    for (const c of pts) { const s = (c.x - centre.x) * dir.x + (c.z - centre.z) * dir.z + (c.width || 20) / 2; if (s > far) far = s; }
    sea = { dir, from: far + (TERRAIN.SEA_BEYOND[theme.name] || 60), level: TERRAIN.SEA_LEVEL, drop: theme.sea.drop, cliff: theme.sea.cliff };
  }
  const seaS = (x, z) => sea ? (x - centre.x) * sea.dir.x + (z - centre.z) * sea.dir.z - sea.from : -Infinity;

  const heightAt = (x, z) => {
    const d = field.edge(x, z);
    const mask = smooth(theme.flatFrom, theme.flatTo, d);
    let h = 0;
    if (theme.hill > 0) {
      const f = hillsN.fbm(x * theme.hillScale, z * theme.hillScale, 4, 2.1, 0.5);
      h += theme.hill * Math.pow(Math.max(0, f + 0.35), 1.4) * mask;
    }
    if (theme.rolling > 0) h += theme.rolling * rollN.fbm(x * 0.011, z * 0.011, 2) * smooth(theme.flatFrom, theme.flatFrom + 40, d);
    if (sea) {
      const s = seaS(x, z);
      const toSea = smooth(-sea.cliff / 2, sea.cliff / 2, s);
      h = h * (1 - smooth(-sea.cliff - 20, -sea.cliff / 2, s)) - sea.drop * toSea;
    }
    return h === 0 ? TERRAIN.BELOW : h + TERRAIN.BELOW;
  };
  const edgeDistance = (x, z) => field.edge(x, z);

  /* the grid */
  const cols = Math.ceil((extent.maxX - extent.minX) / cell) + 1, rows = Math.ceil((extent.maxZ - extent.minZ) / cell) + 1;
  const positions = new Float32Array(cols * rows * 3), colours = new Float32Array(cols * rows * 3);
  const col = new Float32Array(3);
  const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);   // hex is sRGB, vertex colours are linear
  const hex = (h, out) => { out[0] = lin(((h >> 16) & 255) / 255); out[1] = lin(((h >> 8) & 255) / 255); out[2] = lin((h & 255) / 255); return out; };
  const g0 = hex(theme.ground[0], new Float32Array(3)), g1 = hex(theme.ground[1], new Float32Array(3)), dry = hex(theme.dry, new Float32Array(3)), rock = hex(theme.rock, new Float32Array(3));
  const snow = theme.snow ? hex(theme.snow, new Float32Array(3)) : null;
  const seaBed = sea ? hex(theme.water || 0x224455, new Float32Array(3)) : null;
  let minY = Infinity, maxY = -Infinity;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c;
    const x = extent.minX + c * cell, z = extent.minZ + r * cell;
    const h = heightAt(x, z);
    positions[k * 3] = x; positions[k * 3 + 1] = h; positions[k * 3 + 2] = z;
    if (h < minY) minY = h; if (h > maxY) maxY = h;
  }
  const hAt = (c, r) => positions[(Math.max(0, Math.min(rows - 1, r)) * cols + Math.max(0, Math.min(cols - 1, c))) * 3 + 1];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c;
    const x = extent.minX + c * cell, z = extent.minZ + r * cell;
    const h = positions[k * 3 + 1];
    /* colour: the two ground tones by broad noise, dry patches, rock on
       the steep, snow up high, sand by the sea, with a fine grain */
    const t = 0.5 + 0.5 * colourN.fbm(x * 0.02, z * 0.02, 2);
    for (let i = 0; i < 3; i++) col[i] = mix(g0[i], g1[i], t);
    const patch = smooth(0.3, 0.75, patchN.fbm(x * 0.009 + 7, z * 0.009, 2) + 0.2);
    const d = field.edge(x, z);
    const verge = 1 - smooth(1, 6, d);     // a worn verge just past the run-off
    const dryK = Math.max(patch * 0.8, verge * 0.6);
    for (let i = 0; i < 3; i++) col[i] = mix(col[i], dry[i], dryK);
    const sx = (hAt(c + 1, r) - hAt(c - 1, r)) / (2 * cell), sz = (hAt(c, r + 1) - hAt(c, r - 1)) / (2 * cell);
    const slope = Math.hypot(sx, sz);
    const rockK = smooth(0.35, 0.75, slope);
    for (let i = 0; i < 3; i++) col[i] = mix(col[i], rock[i], rockK);
    if (snow) { const line = theme.snowLine + 5 * colourN.noise(x * 0.03, z * 0.03); const sk = smooth(line - 3, line + 4, h) * (1 - rockK * 0.6); for (let i = 0; i < 3; i++) col[i] = mix(col[i], snow[i], sk); }
    if (sea) {
      const s = seaS(x, z);
      const sand = smooth(-sea.cliff - 14, -sea.cliff / 2, s) * (theme.name === 'coastal' ? 1 : 0);
      for (let i = 0; i < 3; i++) col[i] = mix(col[i], dry[i], sand);
      const under = smooth(sea.level + 1.5, sea.level - 1, h);
      for (let i = 0; i < 3; i++) col[i] = mix(col[i], seaBed[i] * 0.6, under);
    }
    const grain = 1 + 0.07 * grainN.noise(x * 0.33, z * 0.33);
    colours[k * 3] = col[0] * grain; colours[k * 3 + 1] = col[1] * grain; colours[k * 3 + 2] = col[2] * grain;
  }
  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let q = 0;
  for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) {
    const a = r * cols + c, bb = a + 1, cc = a + cols, dd = cc + 1;
    indices[q++] = a; indices[q++] = cc; indices[q++] = bb; indices[q++] = bb; indices[q++] = cc; indices[q++] = dd;
  }
  return {
    extent, cell, cols, rows, positions, colours, indices, triangles: (cols - 1) * (rows - 1) * 2,
    heightAt, edgeDistance, nearestSample: field.nearest, field, sea, centre, minY, maxY,
    exactEdge: (x, z) => exactEdgeDistance(track, field, x, z),
  };
}
