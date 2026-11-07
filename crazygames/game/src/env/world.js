/* THE WORLD AROUND A TRACK, assembled for three.js: the terrain mesh,
   the water, the backdrop, every prop as an instanced mesh (one draw
   call per kind, a second for its lit parts), the sponsor boards as
   one merged mesh over the atlas, and the sky. buildEnvironment(THREE,
   track, options) returns { group, sky, info, dispose }. The data
   comes from terrain.js and scenery.js, which have no three.js in
   them, so the probes check exactly what is drawn. */
import { buildTerrain } from './terrain.js';
import { placeScenery, PROP_DIMS } from './scenery.js';
import { buildProps } from './props.js';
import { makeSky, makeBackdrop } from './sky.js';
import { sponsorAtlas } from './textures.js';
import { makeRng } from './rng.js';

export const WORLD = {
  WATER_ROUGH_DRY: 0.25,
  WATER_LEVEL_LIFT: 0.0,
  WATER_SIZE:      2400,     // m, the water plane
  WATER_NEAR:      20,       // m inland of the cliff the water's near edge sits, under the ground
  LIT_INTENSITY:   { on: 2.4, off: 0.0 },
  BOARD_W:         6.0, BOARD_H: 1.8, BOARD_Y: 2.3,
  FLAG_SWAY:       0,        // flags are still (no per frame work on the low tier)
};

export function buildEnvironment(THREE, track, options) {
  const o = options || {};
  const theme = o.theme, preset = o.preset, tier = o.tier || {};
  const seed = (track.seed >>> 0) || 1;
  const group = new THREE.Group();
  group.name = 'environment';
  const disposables = [];
  const info = { drawCalls: 0, triangles: 0, instances: 0, kinds: {} };

  /* terrain */
  const terrain = buildTerrain(track, theme, { cell: tier.terrainCell || 8 });
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(terrain.positions, 3));
  tg.setAttribute('color', new THREE.BufferAttribute(terrain.colours, 3));
  tg.setIndex(new THREE.BufferAttribute(terrain.indices, 1));
  tg.computeVertexNormals();
  const terrainMesh = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true }));
  terrainMesh.name = 'terrain';
  terrainMesh.receiveShadow = true;
  terrainMesh.frustumCulled = false;
  group.add(terrainMesh);
  disposables.push(tg, terrainMesh.material);
  info.drawCalls++; info.triangles += terrain.triangles;

  /* water */
  if (terrain.sea) {
    /* the water lies only on the sea's side, its near edge under the
       ground where the coast starts to fall: a plane under the whole track
       would cover a cutting or a banked corner that dips below sea level */
    const wg = new THREE.PlaneGeometry(WORLD.WATER_SIZE, WORLD.WATER_SIZE, 1, 1);
    const wm = new THREE.MeshStandardMaterial({ color: theme.water, roughness: preset.wet ? 0.12 : WORLD.WATER_ROUGH_DRY, metalness: 0.1, transparent: false });
    const water = new THREE.Mesh(wg, wm);
    const sea = terrain.sea, near = sea.from - sea.cliff - WORLD.WATER_NEAR, mid = near + WORLD.WATER_SIZE / 2;
    wg.rotateX(-Math.PI / 2);                                   // flat, its edges along x and z
    water.rotation.y = Math.atan2(sea.dir.x, sea.dir.z);        // its z edge square to the sea's direction
    water.position.set(terrain.centre.x + sea.dir.x * mid, sea.level + WORLD.WATER_LEVEL_LIFT, terrain.centre.z + sea.dir.z * mid);
    water.name = 'water';
    water.receiveShadow = false;
    group.add(water);
    disposables.push(wg, wm);
    info.drawCalls++; info.triangles += 2;
  }

  /* the backdrop */
  const back = makeBackdrop(THREE, theme, preset, seed);

  /* props */
  const placed = placeScenery(track, theme, terrain, { share: tier.sceneryShare === undefined ? 1 : tier.sceneryShare });
  const props = buildProps(THREE, theme, seed);
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: preset.lamps ? WORLD.LIT_INTENSITY.on : WORLD.LIT_INTENSITY.off });
  disposables.push(bodyMat, litMat);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3(), col = new THREE.Color();
  const meshes = {};
  for (const kind of Object.keys(placed)) {
    const list = placed[kind], def = props[kind];
    if (!def || !list.length || kind === 'board') continue;
    const body = new THREE.InstancedMesh(def.body, bodyMat, list.length);
    body.name = 'prop:' + kind;
    body.castShadow = tier.propShadows !== false && PROP_DIMS[kind].h >= (tier.shadowMinHeight || 0);
    body.receiveShadow = true;
    body.frustumCulled = false;
    const lit = def.lit ? new THREE.InstancedMesh(def.lit, litMat, list.length) : null;
    if (lit) { lit.name = 'lit:' + kind; lit.frustumCulled = false; }
    let anyColour = false;
    list.forEach((it, i) => {
      e.set(0, it.ry || 0, 0); q.setFromEuler(e); v.set(it.x, it.y, it.z); s3.set(it.s || 1, it.s || 1, it.s || 1);
      m4.compose(v, q, s3);
      body.setMatrixAt(i, m4);
      if (lit) lit.setMatrixAt(i, m4);
      if (it.c !== undefined) { col.setHex(it.c); body.setColorAt(i, col); anyColour = true; }
    });
    if (anyColour) { list.forEach((it, i) => { if (it.c === undefined) body.setColorAt(i, col.setHex(0xffffff)); }); body.instanceColor.needsUpdate = true; }
    body.instanceMatrix.needsUpdate = true;
    group.add(body);
    if (lit) { lit.instanceMatrix.needsUpdate = true; group.add(lit); }
    meshes[kind] = { body, lit };
    disposables.push(def.body); if (def.lit) disposables.push(def.lit);
    const tris = def.body.attributes.position.count / 3;
    info.drawCalls += lit ? 2 : 1; info.triangles += tris * list.length + (lit ? def.lit.attributes.position.count / 3 * list.length : 0); info.instances += list.length;
    info.kinds[kind] = list.length;
  }
  /* the boards: posts instanced, the printed faces one mesh over the atlas */
  if (placed.board && placed.board.length) {
    const list = placed.board;
    const posts = new THREE.InstancedMesh(props.board.body, bodyMat, list.length);
    posts.name = 'prop:board'; posts.castShadow = true; posts.frustumCulled = false;
    const atlas = sponsorAtlas(THREE);
    const fp = [], fuv = [];
    list.forEach((it, i) => {
      e.set(0, it.ry || 0, 0); q.setFromEuler(e); v.set(it.x, it.y, it.z); s3.set(1, 1, 1);
      m4.compose(v, q, s3); posts.setMatrixAt(i, m4);
      const { v0, v1 } = atlas.uv(it.c === undefined ? i : it.c);
      const w = WORLD.BOARD_W / 2, y0 = WORLD.BOARD_Y - WORLD.BOARD_H / 2, y1 = WORLD.BOARD_Y + WORLD.BOARD_H / 2;
      const corner = (x, y) => { const p = new THREE.Vector3(x, y, 0.03).applyMatrix4(m4); return [p.x, p.y, p.z]; };
      const a = corner(-w, y0), b = corner(w, y0), c = corner(w, y1), d = corner(-w, y1);
      fp.push(...a, ...b, ...c, ...a, ...c, ...d);
      fuv.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1);
    });
    posts.instanceMatrix.needsUpdate = true;
    group.add(posts);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
    fg.computeVertexNormals();
    const faceMat = new THREE.MeshLambertMaterial({ map: atlas.texture, emissive: 0xffffff, emissiveMap: atlas.texture, emissiveIntensity: preset.lamps ? 0.9 : 0.15, side: THREE.DoubleSide });
    const faces = new THREE.Mesh(fg, faceMat);
    faces.name = 'boards';
    faces.frustumCulled = false;
    group.add(faces);
    disposables.push(fg, faceMat, atlas.texture, props.board.body);
    info.drawCalls += 2; info.triangles += list.length * (2 + props.board.body.attributes.position.count / 3); info.instances += list.length;
    info.kinds.board = list.length;
  }

  /* the sky and the backdrop, kept apart so the scene can pin them to the camera */
  const sky = makeSky(THREE, preset);
  if (back) { sky.add(back); info.drawCalls++; info.triangles += back.geometry.attributes.position.count / 3; }
  sky.traverse(m => { if (m.geometry) disposables.push(m.geometry); if (m.material) disposables.push(m.material); });
  info.drawCalls += sky.children.length;

  return {
    group, sky, terrain, placed, info, meshes,
    dispose() { for (const d of disposables) if (d && d.dispose) d.dispose(); },
  };
}

/* A seeded spread of positions for things the scene adds itself. */
export { makeRng };
