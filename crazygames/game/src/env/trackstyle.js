/* THE TRACK'S MATERIALS, by mesh name. The generator's mesh builder
   (../tracks/mesh.js) returns a group named `track` whose meshes are
   named for what they are: today `road` (one vertex coloured mesh of
   asphalt, edges, kerbs, run-off and lines) and `barriers`; the next
   track session splits them into `road`, `edge`, `kerb`, `runoff`,
   `line`, `wall`, `clip`, `bridge`, `ramp` and `cut`, and the table
   below names them all. styleTrack replaces each mesh's
   material by its name and leaves the geometry's vertex colours as
   they are, so the road edge keeps exactly the colour the readability
   rule is measured on; the textures are grain around one. Meshes with
   a name not in the table keep their material. Each mesh also gets UVs
   from its position (planar for the flat faces, along and up for the
   vertical ones), since the builder makes none.

   Also the worn racing line: a soft dark ribbon that leans to the
   inside through corners, laid once per track. */
import { asphaltTexture, concreteTexture, asphaltDetail, puddleTexture } from './textures.js';

export const TRACK_STYLE = {
  ASPHALT_TILE:  7,        // m per repeat of the grain
  CONCRETE_TILE: 3,
  EDGE_PAINT:    0xf6e7a1, // what the edge line emits when it is its own mesh (the builder's LOOK.EDGE)
  ROAD_LIFT:     1.5,      // the asphalt's vertex colour is dark; the material brightens the whole road mesh, edge included
  ROUGH_WET:     0.22,     // rain: the road reflects the sky and the lamps
  METAL_WET:     0.08,
  CLIP_EMISSIVE: 0.35,     // the clipping zone glows a little, more at night: the generator names the whole judged barrier `clip`, not only its posts, so a stronger glow outshines the edge line
  LINE_EMISSIVE: 0.35,
  RACING_LINE_ALPHA: 0.3,     // black over the asphalt, at most this opaque
  RACING_LINE_WIDTH: 2.6,  // m
  RACING_LINE_LEAN: 0.55,  // share of the half width the line moves to the inside at full curvature
  RACING_LINE_RADIUS: 80,  // m: corners this tight or tighter get the full lean
};

/* THE COVER LOOK'S ROAD (briefs/COVER-LOOK.md 3, ?look=2): the asphalt
   as a standard material that reflects the world's environment, with
   the stones and grain of env/textures.js asphaltDetail as its relief
   and its roughness, so the surface catches the light. On a wet preset
   the asphalt darkens and goes smooth, and patches of standing water
   lie in it as mirrors (puddleTexture), each its own scale so the two
   tiles never line up. The edge line, the kerbs and the lines stay as
   they are: paint, not water, and the readability rule's brightness
   half is held on them. */
export const TRACK_LOOK = {
  ROUGH:         [0.8, 0.96],   // dry: the roughness over the stones and the binder
  NORMAL:        { dry: 0.16, wet: 0.12 },  // the relief's strength (the low tier has none: its cost is the high tier's alone)
  WET_ROUGH:     [0.34, 0.55],  // wet: the asphalt between the puddles
  PUDDLE_ROUGH:  0.06,          // the standing water: a mirror, just blurred
  PUDDLE_TILE:   41,            // m per repeat of the water's patches
  PUDDLE_SHARE:  0.3,           // about this much of a wet road is under water
  WET_ALBEDO:    0.5,           // wet asphalt is darker: its colour times this
  DETAIL_SIZE:   256,           // px, the relief's and roughness's tile
};

let cache = null;
function textures(THREE) {
  if (!cache) cache = { asphalt: asphaltTexture(THREE, 256), concrete: concreteTexture(THREE, 128) };
  return cache;
}
let lookCache = null;
function lookTextures(THREE) {
  if (!lookCache) { const d = asphaltDetail(THREE, TRACK_LOOK.DETAIL_SIZE); lookCache = { normal: d.normal, rough: d.rough, puddle: puddleTexture(THREE, 256, TRACK_LOOK.PUDDLE_SHARE) }; }
  return lookCache;
}

/* The cover look's asphalt for a preset: a node material, the night's
   baked moonlight (roadGlow) as its emission, as edgeGlow gives the
   road without the look. detail: the relief (the high tier). */
function lookAsphalt(THREE, preset, detail) {
  const T = THREE.TSL, X = lookTextures(THREE), L = TRACK_LOOK, wet = !!preset.wet;
  const k = TRACK_STYLE.ROAD_LIFT * (wet ? L.WET_ALBEDO : 1);
  const m = new THREE.MeshStandardNodeMaterial({ vertexColors: true, map: textures(THREE).asphalt, color: new THREE.Color(k, k, k), metalness: 0 });
  const uv = T.uv(), grain = T.texture(X.rough, uv).r;
  const puddle = wet ? T.texture(X.puddle, uv.mul(TRACK_STYLE.ASPHALT_TILE / L.PUDDLE_TILE)).r : null;
  m.roughnessNode = wet ? T.mix(T.mix(T.float(L.WET_ROUGH[0]), T.float(L.WET_ROUGH[1]), grain), T.float(L.PUDDLE_ROUGH), puddle) : T.mix(T.float(L.ROUGH[0]), T.float(L.ROUGH[1]), grain);
  if (detail) {
    const s = wet ? L.NORMAL.wet : L.NORMAL.dry;
    m.normalNode = T.normalMap(T.texture(X.normal, uv), wet ? T.vec2(s, s).mul(T.float(1).sub(puddle)) : T.vec2(s, s));
  }
  if (preset.roadGlow) m.emissiveNode = T.vertexColor().mul(T.float(preset.roadGlow));
  m.userData.look = true;   // render/scene.js's edge glow leaves it alone: its emission is here
  return m;
}

/* UVs from positions: per triangle, a planar map for faces that face
   up (or down), and distance along the face with height for walls. */
function projectUVs(THREE, geo, tile) {
  const p = geo.attributes.position, n = p.count;
  const uv = new Float32Array(n * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3(), tan = new THREE.Vector3();
  if (geo.index) {
    // the builders make non indexed meshes; an indexed one gets a plain planar map
    for (let i = 0; i < n; i++) { uv[i * 2] = p.getX(i) / tile; uv[i * 2 + 1] = p.getZ(i) / tile; }
  } else for (let i = 0; i + 2 < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    nrm.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    if (Math.abs(nrm.y) > 0.5) {
      for (let k = 0; k < 3; k++) { uv[(i + k) * 2] = p.getX(i + k) / tile; uv[(i + k) * 2 + 1] = p.getZ(i + k) / tile; }
    } else {
      tan.set(nrm.z, 0, -nrm.x).normalize();
      for (let k = 0; k < 3; k++) { uv[(i + k) * 2] = (p.getX(i + k) * tan.x + p.getZ(i + k) * tan.z) / tile; uv[(i + k) * 2 + 1] = p.getY(i + k) / tile; }
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function styleTrack(THREE, group, preset, options) {
  const o = options || {};
  const T = textures(THREE);
  const wet = !!preset.wet;
  const vc = geo => !!geo.attributes.color;
  /* Lambert for everything dry: no specular sheen, so a low sun does
     not turn the road or the ground into a bright sheet brighter than
     the edge line. The wet road is the one standard material, for its
     reflections. */
  const lam = (geo, extra) => new THREE.MeshLambertMaterial(Object.assign({ vertexColors: vc(geo) }, extra));
  const lift = new THREE.Color(TRACK_STYLE.ROAD_LIFT, TRACK_STYLE.ROAD_LIFT, TRACK_STYLE.ROAD_LIFT);
  const asphalt = geo => wet
    ? new THREE.MeshStandardMaterial({ vertexColors: vc(geo), map: T.asphalt, color: lift, roughness: TRACK_STYLE.ROUGH_WET, metalness: TRACK_STYLE.METAL_WET })
    : lam(geo, { map: T.asphalt, color: lift });
  const table = {
    road:     geo => { projectUVs(THREE, geo, TRACK_STYLE.ASPHALT_TILE); return o.look ? lookAsphalt(THREE, preset, o.tierName === 'high') : asphalt(geo); },
    edge:     geo => lam(geo, { emissive: TRACK_STYLE.EDGE_PAINT, emissiveIntensity: preset.edgeGlow || 0 }),
    kerb:     geo => lam(geo, {}),
    runoff:   geo => lam(geo, {}),
    ramp:     geo => lam(geo, {}),
    cut:      geo => lam(geo, {}),
    line:     geo => lam(geo, { emissive: 0xffffff, emissiveIntensity: TRACK_STYLE.LINE_EMISSIVE * (preset.edgeGlow || 0) }),
    wall:     geo => { projectUVs(THREE, geo, TRACK_STYLE.CONCRETE_TILE); return lam(geo, { map: T.concrete, side: THREE.DoubleSide }); },
    barriers: geo => { projectUVs(THREE, geo, TRACK_STYLE.CONCRETE_TILE); return lam(geo, { map: T.concrete, side: THREE.DoubleSide }); },
    bridge:   geo => { projectUVs(THREE, geo, TRACK_STYLE.CONCRETE_TILE); return lam(geo, { map: T.concrete, side: THREE.DoubleSide }); },
    clip:     geo => lam(geo, { emissive: 0xff8a3c, emissiveIntensity: TRACK_STYLE.CLIP_EMISSIVE * (0.3 + (preset.edgeGlow || 0)) }),
  };
  const styled = [];
  group.traverse(m => {
    if (!m.isMesh || !table[m.name]) return;
    const old = m.material;
    m.material = table[m.name](m.geometry);
    if (old && old.dispose) old.dispose();
    m.receiveShadow = true;
    m.castShadow = m.name === 'wall' || m.name === 'barriers' || m.name === 'bridge' || m.name === 'clip';
    styled.push(m.name);
  });
  /* the edge glow for the dark presets: the road mesh's bright vertex
     colours (the edge line) are emitted a little, through the
     emissive map being the vertex colour. A standard material cannot
     do that, so the road gets its own node when a preset asks. */
  if (preset.edgeGlow > 0 && o.edgeGlowNode) o.edgeGlowNode(group, preset.edgeGlow);
  return styled;
}

/* The worn racing line as a ribbon mesh: centre line samples offset to
   the inside of corners by the curvature, with an alpha attribute
   that fades to the ribbon's sides and with the curvature (straights
   show little). The material is a node material that reads the alpha. */
export function racingLine(THREE, track, makeMaterial) {
  const C = track.centre, n = C.length;
  if (!n) return null;
  const closed = track.kind === 'circuit';
  const kappa = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let a = i - 1, b = i + 1, span = 4;
    if (closed) { a = (a + n) % n; b %= n; } else { if (a < 0) { a = 0; span = 2; } if (b >= n) { b = n - 1; span = 2; } }
    let d = C[b].heading - C[a].heading; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    kappa[i] = d / span;
  }
  // smooth the lean over a few samples so the line sweeps, and look ahead a little
  const lean = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, w = 0;
    for (let k = -10; k <= 14; k++) { const j = closed ? ((i + k) % n + n) % n : Math.max(0, Math.min(n - 1, i + k)); const wt = 1 - Math.abs(k) / 16; s += kappa[j] * wt; w += wt; }
    lean[i] = Math.max(-1, Math.min(1, (s / w) * TRACK_STYLE.RACING_LINE_RADIUS));
  }
  const pos = [], alpha = [];
  const half = TRACK_STYLE.RACING_LINE_WIDTH / 2;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n;
    const pt = (k, side) => { const c = C[k], lx = -Math.cos(c.heading), lz = Math.sin(c.heading); const u = lean[k] * TRACK_STYLE.RACING_LINE_LEAN * (c.width / 2 - 1.5) + side * half; return [c.x + lx * u, (c.y || 0) - u * Math.tan(c.bank || 0) + 0.025, c.z + lz * u]; };   // on the road as mesh.js lays it, banked
    const a1 = pt(i, -1), a2 = pt(i, 1), b1 = pt(j, -1), b2 = pt(j, 1);
    const ai = Math.abs(lean[i]) * 0.7 + 0.3, aj = Math.abs(lean[j]) * 0.7 + 0.3;
    // three strips: the middle carries the opacity, the sides fade to nothing
    const c1 = pt(i, -0.45), c2 = pt(i, 0.45), d1 = pt(j, -0.45), d2 = pt(j, 0.45);
    pos.push(...a1, ...c1, ...b1, ...b1, ...c1, ...d1, ...c1, ...c2, ...d1, ...d1, ...c2, ...d2, ...c2, ...a2, ...d2, ...d2, ...a2, ...b2);
    alpha.push(0, ai, 0, 0, ai, aj, ai, ai, aj, aj, ai, aj, ai, 0, aj, aj, 0, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('alpha', new THREE.Float32BufferAttribute(alpha, 1));
  const mesh = new THREE.Mesh(g, makeMaterial());
  mesh.name = 'racingLine';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}
