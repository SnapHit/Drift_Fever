/* SEEDED RANDOM AND NOISE FOR THE WORLD AROUND THE TRACK. The scenery
   is decoration, not gameplay, so plain Math is fine here: nothing the
   physics reads comes from this file. The same seed gives the same
   world in the same engine, which is what the screenshots and the
   probes need. */

export function hash32(n) {
  let h = (n >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/* mulberry32: a small fast generator, good enough for placing trees */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: n => Math.floor(next() * n),
    pick: list => list[Math.floor(next() * list.length)],
    chance: p => next() < p,
  };
}

/* Value noise on a lattice, smooth, in [-1, 1], seeded; fbm sums octaves. */
export function makeNoise(seed) {
  const s = hash32(seed);
  const lattice = (ix, iz) => {
    let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1) ^ s;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296 * 2 - 1;
  };
  const fade = t => t * t * (3 - 2 * t);
  const noise = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const a = lattice(ix, iz), b = lattice(ix + 1, iz), c = lattice(ix, iz + 1), d = lattice(ix + 1, iz + 1);
    const u = fade(fx), v = fade(fz);
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
  };
  const fbm = (x, z, octaves, lacunarity, gain) => {
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += noise(x * f, z * f) * amp; norm += amp; amp *= gain === undefined ? 0.5 : gain; f *= lacunarity === undefined ? 2 : lacunarity; }
    return sum / norm;
  };
  return { noise, fbm };
}
