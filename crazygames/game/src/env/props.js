/* THE PROPS: low poly shapes, one merged vertex coloured geometry per
   kind, built to the sizes in scenery.js PROP_DIMS so the probe's
   footprints match what is drawn. Each kind gives { body, lit }: the
   body is drawn with the lit material of the theme, the lit part (lamp
   heads, tower lamps, grandstand strip lights) with an emissive one,
   both as instanced meshes sharing the instance matrices. Flat shaded:
   every face has its own vertices and normal, which is the look.

   Origins are on the ground at the footprint's centre; the front of a
   thing that has one (a grandstand, a board) faces -Z. */
import { makeRng } from './rng.js';

const COL = {
  TRUNK:     0x5a3d28,
  PINE:      [0x1f4a2e, 0x2a5a36, 0x1a3f2a],
  LEAF:      [0x3f6f2e, 0x4e7f34, 0x5f8a3a],
  PALM:      [0x3e7a34, 0x4f8a3c],
  CACTUS:    0x4a7a3a,
  BUSH:      0x3e6a30,
  ROCK:      0x6a665f,
  ROCK_DARK: 0x4e4a45,
  MESA:      0x9a5240,
  MESA_TOP:  0xb8785a,
  STEEL:     0x8a8f99,
  STEEL_DARK: 0x4a4e58,
  CRANE:     0xc9533c,
  WAREHOUSE: 0x7a7f88,
  ROOF:      0x5a5e66,
  WALL_CREAM: 0xd8cdb4,
  TERRACOTTA: 0x9a4a38,
  BARN:      0x7a2e26,
  LOG:       0x6a4a30,
  HAY:       0xc9a84a,
  TYRE:      0x1c1c20,
  TYRE_BAND: 0xdadada,
  BOLLARD:   0xe8c23a,
  STAND:     0x5e6470,
  STAND_SEAT: 0x3a4050,
  CROWD:     [0xe04040, 0x3a7ae0, 0xf0e060, 0xffffff, 0x30c080, 0xf08030, 0x202030, 0xe060c0, 0x19d8ff],
  SKIN:      [0xf0c8a0, 0xc08a60, 0x7a4a30, 0xe8b890],
  LAMP_HEAD: 0xfff0c0,
  FLAG_POLE: 0xd8d8e0,
  BOARD_POST: 0x3a3a40,
};

/* A tiny assembler: push shapes with a transform and a colour into one
   non-indexed geometry with flat normals. */
function assembler(THREE) {
  const pos = [], col = [];
  const c = new THREE.Color();
  const v = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  function push(geo, hex, x, y, z, rx, ry, rz, sx, sy, sz) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    e.set(rx || 0, ry || 0, rz || 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(x || 0, y || 0, z || 0), q, new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? (sx === undefined ? 1 : sx) : sy, sz === undefined ? (sx === undefined ? 1 : sx) : sz));
    const p = g.attributes.position;
    c.setHex(hex);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
    if (g !== geo) g.dispose();
  }
  function build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  return { push, build, count: () => pos.length / 3 };
}

/* a jittered icosahedron, for rocks and canopies */
function lump(THREE, r, detail, jitter, rng) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (rng.next() - 0.5) * 2 * jitter; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); }
  return g;
}
/* a triangular prism roof: width w across x, height h, depth d along z */
function prism(THREE, w, h, d) {
  const g = new THREE.BufferGeometry();
  const a = [-w / 2, 0, -d / 2], b = [w / 2, 0, -d / 2], c = [0, h, -d / 2], a2 = [-w / 2, 0, d / 2], b2 = [w / 2, 0, d / 2], c2 = [0, h, d / 2];
  const t = [a, b, c, b2, a2, c2, a, c, c2, a, c2, a2, b, b2, c2, b, c2, c, a, a2, b2, a, b2, b];
  g.setAttribute('position', new THREE.Float32BufferAttribute(t.flat(), 3));
  return g;
}

export function buildProps(THREE, theme, seed) {
  const rng = makeRng((seed >>> 0) + 303);
  const out = {};
  const make = (kind, fn) => { const A = assembler(THREE), L = assembler(THREE); fn(A, L); out[kind] = { body: A.build(), lit: L.count() ? L.build() : null }; };
  const pick = list => list[rng.int(list.length)];
  const bushColour = (theme.props.find(p => p.kind === 'bush') || {}).colour;
  const rockColour = (theme.props.find(p => p.kind === 'rock') || {}).colour;

  make('pine', (A) => {
    A.push(new THREE.CylinderGeometry(0.12, 0.22, 1.6, 5), COL.TRUNK, 0, 0.8, 0);
    const c = pick(COL.PINE);
    A.push(new THREE.ConeGeometry(1.7, 3.2, 7), c, 0, 2.6, 0);
    A.push(new THREE.ConeGeometry(1.3, 3.0, 7), c, 0, 4.6, 0, 0, 0.4, 0);
    A.push(new THREE.ConeGeometry(0.85, 2.8, 6), c, 0, 6.6, 0, 0, 0.8, 0);
  });
  make('tree', (A) => {
    A.push(new THREE.CylinderGeometry(0.16, 0.3, 2.6, 6), COL.TRUNK, 0, 1.3, 0);
    const c = pick(COL.LEAF);
    A.push(lump(THREE, 2.2, 1, 0.18, rng), c, 0, 4.2, 0);
    A.push(lump(THREE, 1.5, 1, 0.2, rng), c, 1.1, 3.4, 0.6);
    A.push(lump(THREE, 1.3, 1, 0.2, rng), c, -1.0, 3.6, -0.5);
  });
  make('palm', (A) => {
    A.push(new THREE.CylinderGeometry(0.14, 0.26, 6.2, 6), COL.TRUNK, 0.25, 3.0, 0, 0, 0, -0.08);
    const c = pick(COL.PALM);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      A.push(new THREE.BoxGeometry(0.5, 0.06, 2.8), c, 0.5 + Math.sin(a) * 1.2, 6.1 - 0.25, Math.cos(a) * 1.2, 0.55, a, 0);
    }
    A.push(lump(THREE, 0.45, 0, 0.1, rng), COL.TRUNK, 0.5, 6.0, 0);
  });
  make('cactus', (A) => {
    A.push(new THREE.CylinderGeometry(0.32, 0.36, 3.4, 7), COL.CACTUS, 0, 1.7, 0);
    A.push(new THREE.CylinderGeometry(0.2, 0.22, 1.0, 6), COL.CACTUS, 0.55, 1.6, 0, 0, 0, Math.PI / 2);
    A.push(new THREE.CylinderGeometry(0.2, 0.22, 1.4, 6), COL.CACTUS, 0.85, 2.3, 0);
    A.push(new THREE.CylinderGeometry(0.2, 0.22, 0.8, 6), COL.CACTUS, -0.5, 2.0, 0, 0, 0, Math.PI / 2);
    A.push(new THREE.CylinderGeometry(0.2, 0.22, 1.0, 6), COL.CACTUS, -0.75, 2.5, 0);
  });
  make('bush', (A) => {
    const c = bushColour !== undefined ? bushColour : COL.BUSH;
    A.push(lump(THREE, 0.9, 1, 0.25, rng), c, 0, 0.6, 0, 0, 0, 0, 1, 0.75, 1);
    A.push(lump(THREE, 0.6, 0, 0.25, rng), c, 0.5, 0.5, 0.3, 0, 0, 0, 1, 0.8, 1);
  });
  make('rock', (A) => {
    A.push(lump(THREE, 1.0, 1, 0.3, rng), rockColour !== undefined ? rockColour : COL.ROCK, 0, 0.5, 0, 0, 0, 0, 1.1, 0.75, 0.9);
  });
  make('boulder', (A) => {
    const c = rockColour !== undefined ? rockColour : COL.ROCK;
    A.push(lump(THREE, 2.4, 1, 0.28, rng), c, 0, 1.2, 0, 0, 0.4, 0, 1.1, 0.8, 1);
    A.push(lump(THREE, 1.3, 1, 0.3, rng), COL.ROCK_DARK, 1.6, 0.6, 0.8);
  });
  make('mesa', (A) => {
    A.push(new THREE.CylinderGeometry(9, 17, 14, 9), COL.MESA, 0, 7, 0);
    A.push(new THREE.CylinderGeometry(8.5, 9.2, 1.2, 9), COL.MESA_TOP, 0, 14.6, 0);
  });
  make('container', (A) => {
    // white: the instance colour paints it
    A.push(new THREE.BoxGeometry(2.44, 2.6, 6.1), 0xffffff, 0, 1.3, 0);
    A.push(new THREE.BoxGeometry(2.5, 0.12, 6.2), 0x808080, 0, 0.06, 0);
  });
  make('warehouse', (A, L) => {
    A.push(new THREE.BoxGeometry(24, 7, 14), COL.WAREHOUSE, 0, 3.5, 0);
    A.push(prism(THREE, 25, 1.6, 15), COL.ROOF, 0, 7, 0);
    A.push(new THREE.BoxGeometry(6, 5, 0.3), COL.STEEL_DARK, -6, 2.5, -7.0);
    A.push(new THREE.BoxGeometry(6, 5, 0.3), COL.STEEL_DARK, 6, 2.5, -7.0);
    L.push(new THREE.BoxGeometry(2.0, 0.3, 0.3), COL.LAMP_HEAD, 0, 6.4, -7.1);
  });
  make('crane', (A, L) => {
    for (const z of [-6, 6]) for (const x of [-5, 5]) A.push(new THREE.BoxGeometry(1.1, 22, 1.1), COL.CRANE, x, 11, z);
    for (const z of [-6, 6]) A.push(new THREE.BoxGeometry(12, 1.4, 1.2), COL.CRANE, 0, 21.5, z);
    A.push(new THREE.BoxGeometry(1.2, 1.4, 34), COL.CRANE, -4, 22.5, 4);
    A.push(new THREE.BoxGeometry(1.2, 1.4, 34), COL.CRANE, 4, 22.5, 4);
    A.push(new THREE.BoxGeometry(3, 2.2, 3), COL.STEEL_DARK, 0, 19.5, -2);
    A.push(new THREE.BoxGeometry(2.4, 2.6, 6), 0x3a6a9a, 0, 16, 10);
    L.push(new THREE.BoxGeometry(0.4, 0.4, 0.4), 0xff4040, 0, 24.5, -12);
  });
  make('lamp', (A, L) => {
    A.push(new THREE.CylinderGeometry(0.08, 0.14, 8, 6), COL.STEEL, 0, 4, 0);
    A.push(new THREE.BoxGeometry(0.16, 0.16, 1.6), COL.STEEL, 0, 8.0, -0.7);
    L.push(new THREE.BoxGeometry(0.5, 0.22, 1.1), COL.LAMP_HEAD, 0, 7.95, -1.2);
  });
  make('tyrestack', (A) => {
    for (let i = 0; i < 4; i++) A.push(new THREE.CylinderGeometry(0.66, 0.66, 0.24, 10), i === 2 ? COL.TYRE_BAND : COL.TYRE, 0, 0.12 + i * 0.25, 0);
  });
  make('bollard', (A) => {
    A.push(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 8), COL.BOLLARD, 0, 0.45, 0);
    A.push(new THREE.CylinderGeometry(0.27, 0.27, 0.2, 8), COL.TYRE, 0, 0.5, 0);
  });
  make('house', (A, L) => {
    A.push(new THREE.BoxGeometry(8, 3.2, 6), COL.WALL_CREAM, 0, 1.6, 0);
    A.push(prism(THREE, 8.8, 2.6, 6.8), COL.TERRACOTTA, 0, 3.2, 0);
    A.push(new THREE.BoxGeometry(0.7, 1.6, 0.7), COL.ROOF, 2.5, 4.4, 1.2);
    A.push(new THREE.BoxGeometry(1.0, 2.0, 0.2), COL.STEEL_DARK, 0, 1.0, -3.05);
    L.push(new THREE.BoxGeometry(1.1, 0.9, 0.1), 0xffd890, 2.4, 1.8, -3.05);
    L.push(new THREE.BoxGeometry(1.1, 0.9, 0.1), 0xffd890, -2.4, 1.8, -3.05);
  });
  make('barn', (A) => {
    A.push(new THREE.BoxGeometry(12, 4.5, 8), COL.BARN, 0, 2.25, 0);
    A.push(prism(THREE, 13, 3.6, 8.8), COL.ROOF, 0, 4.5, 0);
    A.push(new THREE.BoxGeometry(3.2, 3.4, 0.2), COL.STEEL_DARK, 0, 1.7, -4.05);
  });
  make('cabin', (A, L) => {
    A.push(new THREE.BoxGeometry(6, 2.8, 5), COL.LOG, 0, 1.4, 0);
    A.push(prism(THREE, 6.8, 2.2, 5.8), COL.ROOF, 0, 2.8, 0);
    A.push(new THREE.BoxGeometry(0.6, 1.4, 0.6), COL.ROCK_DARK, 1.8, 3.6, 0.8);
    L.push(new THREE.BoxGeometry(0.9, 0.8, 0.1), 0xffd890, 0, 1.6, -2.55);
  });
  make('haybale', (A) => {
    A.push(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 9), COL.HAY, 0, 0.8, 0, 0, 0, Math.PI / 2);
  });
  make('grandstand', (A, L) => {
    const W = 18, rows = 6, rise = 0.62, depth = 1.15;
    for (let i = 0; i < rows; i++) {
      const y = rise * (i + 1), z = -5 + i * depth;
      A.push(new THREE.BoxGeometry(W, y, depth), COL.STAND, 0, y / 2, z + depth / 2);
      A.push(new THREE.BoxGeometry(W, 0.5, 0.35), COL.STAND_SEAT, 0, y + 0.25, z + depth - 0.2);
      // the crowd: a figure every 0.6 m, most seats taken
      for (let x = -W / 2 + 0.5; x < W / 2 - 0.3; x += 0.6) {
        if (!rng.chance(0.78)) continue;
        const c = pick(COL.CROWD);
        A.push(new THREE.BoxGeometry(0.42, 0.75, 0.3), c, x + rng.range(-0.06, 0.06), y + 0.72, z + depth - 0.55);
        A.push(new THREE.BoxGeometry(0.24, 0.26, 0.24), pick(COL.SKIN), x, y + 1.22, z + depth - 0.55);
      }
    }
    // the back wall and the roof on posts
    A.push(new THREE.BoxGeometry(W, rows * rise + 0.6, 0.3), COL.STAND, 0, (rows * rise + 0.6) / 2, -5 + rows * depth + 0.15);
    for (const x of [-W / 2 + 0.4, W / 2 - 0.4]) for (const z of [-4.6, -5 + rows * depth]) A.push(new THREE.BoxGeometry(0.25, 7, 0.25), COL.STEEL, x, 3.5, z);
    A.push(new THREE.BoxGeometry(W + 0.6, 0.3, rows * depth + 1.2), COL.ROOF, 0, 7.0, -5 + rows * depth / 2 + 0.2, 0.08, 0, 0);
    L.push(new THREE.BoxGeometry(W - 2, 0.12, 0.3), COL.LAMP_HEAD, 0, 6.7, -4.2);
  });
  make('tower', (A, L) => {
    A.push(new THREE.BoxGeometry(0.7, 14, 0.7), COL.STEEL_DARK, 0, 7, 0);
    A.push(new THREE.BoxGeometry(0.9, 0.9, 0.9), COL.STEEL_DARK, 0, 14.4, 0);
    A.push(new THREE.BoxGeometry(2.6, 1.0, 0.5), COL.STEEL, 0, 14.9, 0);
    L.push(new THREE.BoxGeometry(2.4, 0.5, 0.25), COL.LAMP_HEAD, 0, 14.8, -0.35);
    L.push(new THREE.BoxGeometry(2.4, 0.5, 0.25), COL.LAMP_HEAD, 0, 14.8, 0.35);
  });
  make('flag', (A) => {
    A.push(new THREE.CylinderGeometry(0.05, 0.05, 5.2, 5), COL.FLAG_POLE, 0, 2.6, 0);
    // the flag itself is white, the instance colour paints it; it waves a little by its shape
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 5.1, 0, 1.5, 5.0, 0.15, 1.5, 4.2, 0.15, 0, 5.1, 0, 1.5, 4.2, 0.15, 0, 4.2, 0], 3));
    A.push(g, 0xffffff, 0, 0, 0);
    A.push(g, 0xffffff, 0, 0, 0, 0, Math.PI, 0, -1, 1, 1);
  });
  make('board', (A) => {
    // posts and a plain back; the printed face is a separate mesh with the atlas
    for (const x of [-2.6, 2.6]) A.push(new THREE.BoxGeometry(0.16, 3.3, 0.16), COL.BOARD_POST, x, 1.65, 0.1);
    A.push(new THREE.BoxGeometry(6.2, 1.9, 0.12), COL.BOARD_POST, 0, 2.3, 0.1);
  });
  return out;
}
