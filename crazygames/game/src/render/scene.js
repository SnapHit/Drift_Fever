/* THE SCENE. Real 3D around the track: the track from the generator's
   mesh builder restyled by mesh name (asphalt grain, concrete, glowing
   clip posts), the worn racing line, a start gantry with a banner, the
   world around it from ../env/ (a dusk sky with the sun, terrain that
   rolls into hills, a themed spread of instanced props, the backdrop
   on the horizon), real lighting (a warm sun with shadows that follow
   the car, a cool sky fill, fog to the horizon), the car through
   render/car.js, the ghost as a see through copy, the tyre marks the
   rear wheels lay, and the effects (smoke, dust, sparks, exhaust,
   rain). three.js WebGPURenderer, with the WebGL 2 fallback forced by
   ?renderer=webgl2.

   The preset (dusk, night, dawn, rain) and the theme (forest, coastal,
   desert, docks, mountain) are chosen per track by its seed and
   overridden by ?preset= and ?theme=. Quality tiers: low (the WebGL 2
   fallback and small machines) and high, in LOOK.TIERS; ?tier= forces
   one. Every number of taste lives in LOOK at the top. */
import * as THREE from 'three';
import { TUNE, LOOP } from '../tune.js';
import { makeCar, makeGhostly } from './car.js';
import { buildTrackMesh } from '../tracks/mesh.js';
import { carById, carTune, paintById } from '../garage/roster.js';
import { PRESETS, presetFor, sunDirection, presetShow } from '../env/presets.js';
import { buildDressing } from '../env/dressing.js';
import { THEMES, themeFor } from '../env/themes.js';
import { buildEnvironment } from '../env/world.js';
import { styleTrack, racingLine, TRACK_STYLE } from '../env/trackstyle.js';
import { createEffects } from '../env/effects.js';
import { bannerTexture, concreteTexture, SPONSORS_SHOW } from '../env/textures.js';
import { createShow, SHOW, underglowStrength } from '../env/show.js';
import { lookOf, glowHex, smokeHex } from '../garage/cosmetics.js';
import { FX_ON, FX_PARTICLES } from '../fx.js';

export const LOOK = {
  EDGE:         0xf6e7a1,     // the brightest, most saturated thing on screen (the mesh builder paints it)
  WALL:         0x8f8f99,
  WALL_TYRES:   0x3a3f4a,
  WALL_CLIP:    0xff8a3c,     // a wall inside a clipping zone
  WALL_HEIGHT:  1.0,
  PARK:         0x3a3b44,     // the car park's slab
  GANTRY:       0xd8dbe6,     // the start gantry's posts and beam
  GANTRY_BEAM:  0x19d8ff,
  GANTRY_H:     5.0,          // m
  GANTRY_POST:  0.35,
  GANTRY_BANNER: 1.1,         // m tall, hung under the beam
  GANTRY_LIT:   2.0,          // emissive intensity of the beam's lights when the lamps are on
  FINISH_BEAM:  0xf6e7a1,
  CONE:         0xff7a1a,
  CAR:          0x19d8ff,     // fixed cyan
  SUN_DISTANCE: 160,          // m the shadow light sits from its target
  SHADOW_NEAR:  1,
  SHADOW_FAR:   400,
  SHADOW_BIAS:  -0.0006,
  SHADOW_NORMAL_BIAS: 0.03,
  SHADOW_AHEAD: 0.35,         // share of the shadow range the box leads the car by
  HEADLIGHT:    { colour: 0xfff2d0, intensity: 900, angle: 0.42, penumbra: 0.6, distance: 70, decay: 1.6, y: 0.75, z: -1.6 },
  HEADLIGHT_SHOW: { intensity: 1300, angle: 0.48, distance: 110, decay: 1.6, aim: -40 },   // the spectacle round: the headlights reach (aim: m ahead the beam points)
  MARK:         0x000000,     // the marks and the racing line darken the road: black at an opacity
  MARK_WIDTH:   0.22,
  MARK_MIN_SLIDE: 0.9,        // rear slide (as a share of the peak) before a mark is laid
  MARK_SPACING: 0.35,         // m between quads
  MARK_OPACITY: 0.6,
  /* the spectacle round's marks: wider, darker, and enough of them to
     stay for the whole run (quads per tier) */
  MARK_SHOW:    { width: 0.27, opacity: 0.85, low: 6000, high: 12000 },
  RUBBER_SHOW:  0.46,
  /* the rival in the player's lights (briefs/RIVALS.md): the scene's
     headlight washed him to white a few metres ahead, so his materials
     see their own copy of it instead, which lights him no more brightly
     than the real one would REF metres ahead (the beam falls off by its
     decay) */
  RIVAL_BEAM:   { ref: 26 },
        // the rubber laid down the racing line, at most this opaque (TRACK_STYLE.RACING_LINE_ALPHA is 0.3)
  TONE_MAPPING: 'aces',
  BLOOM:        { threshold: 0.85, strength: 0.55, radius: 0.012, taps: 12 },
  LOW_TIER_CORES: 4,
  /* QUALITY THAT ADAPTS (the spectacle round): sustained slow frames
     step the quality down, one level at a time, and fast frames never
     step it back up. Measured on the browser's own frame clock, so a
     probe's fixed 60 Hz clock never trips it. ?adapt=0 turns it off.
     One exception, once: if frames are still slow after the last step
     and no shorter than before the first, the quality was never the
     reason (a phone saving its battery draws 30 frames a second
     whatever it is given), so everything is given back and the
     adaptation stops. */
  ADAPT: {
    SLOW_MS:    22,       // a frame longer than this is slow (under 45 fps)
    WINDOW:     90,       // frames looked at
    SHARE:      0.5,      // share of them slow before a step down
    COOLDOWN:   150,      // frames after a step (or a new track) before the next can come
    IGNORE_MS:  250,      // a gap this long is the tab hidden or a load, not a slow frame
    DENSITY:    0.55,     // level 1: the effects' spawn rates times this
    PIXEL:      [0.8, 0.65],   // levels 3 and 4: the pixel ratio times these (level 2 is the bloom off)
    GAIN:       0.1,      // after the last step frames must be this share shorter than before the first, or it is all given back
  },
  TIERS: {
    low:  { pixelRatio: 1.0, shadow: 1024, shadowRange: 36, terrainCell: 8, sceneryShare: 0.4, shadowMinHeight: 2.5, smoke: 48, dust: 32, sparks: 60, rain: 140, marks: 1400, bloom: false, headlight: true },
    high: { pixelRatio: 2.0, shadow: 2048, shadowRange: 52, terrainCell: 5, sceneryShare: 1.0, shadowMinHeight: 0,   smoke: 120, dust: 80, sparks: 160, rain: 400, marks: 4000, bloom: true,  headlight: true },
  },
};

const query = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');

export function createScene(canvas, opts) {
  const options = opts || {};
  const forceWebGL = options.renderer === 'webgl2';
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL, alpha: false, powerPreference: 'high-performance' });
  renderer.toneMapping = LOOK.TONE_MAPPING === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = query.get('shadows') !== '0';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let backend = 'pending', tier = options.tier || 'low';
  const view = { w: 1, h: 1 };
  const overrides = { preset: options.preset || query.get('preset') || null, theme: options.theme || query.get('theme') || null };
  let post = null;
  const ready = renderer.init().then(() => {
    backend = renderer.backend && renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 0;
    tier = options.tier || ((backend === 'webgl2' || (cores > 0 && cores <= LOOK.LOW_TIER_CORES)) ? 'low' : 'high');
    applyTier();
  });
  function T() { return LOOK.TIERS[tier]; }
  function applyTier() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, T().pixelRatio) * pixelScale());
    renderer.setSize(view.w, view.h, false);
    sun.shadow.mapSize.set(T().shadow, T().shadow);
    sun.shadow.camera.left = -T().shadowRange; sun.shadow.camera.right = T().shadowRange; sun.shadow.camera.top = T().shadowRange; sun.shadow.camera.bottom = -T().shadowRange;
    sun.shadow.camera.updateProjectionMatrix();
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    headlight.visible = !!(T().headlight && preset.headlights);
    rebuildEffects();
    setPost(T().bloom && !(adapt.level >= 2));
  }
  /* the adaptation's state: level 0 is the tier as chosen */
  const adapt = { level: 0, ring: new Uint8Array(LOOK.ADAPT.WINDOW), ms: new Float32Array(LOOK.ADAPT.WINDOW), sum: 0, at: 0, filled: 0, slow: 0, wait: LOOK.ADAPT.COOLDOWN, steps: [], base: 0, done: false, gaveBack: false };
  const adaptOn = FX_ON && query.get('adapt') !== '0';
  function pixelScale() { const P = LOOK.ADAPT.PIXEL; return adapt.level >= 4 ? P[1] : adapt.level >= 3 ? P[0] : 1; }
  function density() { return adapt.level >= 1 ? LOOK.ADAPT.DENSITY : 1; }
  /* one frame's length, from the browser's frame clock */
  function frameTime(ms) {
    if (!adaptOn || adapt.done || !(ms > 0) || ms > LOOK.ADAPT.IGNORE_MS) return adapt.level;
    const A = LOOK.ADAPT, slow = ms > A.SLOW_MS ? 1 : 0, full = adapt.filled >= A.WINDOW;
    adapt.slow += slow - (full ? adapt.ring[adapt.at] : 0);
    adapt.sum += ms - (full ? adapt.ms[adapt.at] : 0);
    adapt.ring[adapt.at] = slow; adapt.ms[adapt.at] = ms; adapt.at = (adapt.at + 1) % A.WINDOW; adapt.filled = Math.min(A.WINDOW, adapt.filled + 1);
    if (adapt.wait > 0) { adapt.wait--; return adapt.level; }
    if (adapt.filled >= A.WINDOW && adapt.slow >= A.SHARE * A.WINDOW) {
      const mean = adapt.sum / A.WINDOW;
      if (adapt.level < 4) { if (!adapt.base) adapt.base = mean; stepDown(); }
      else { adapt.done = true; if (mean > adapt.base * (1 - A.GAIN)) giveBack(); }   // still slow at the last level: did any of it help?
    }
    return adapt.level;
  }
  function clearWindow() { adapt.wait = LOOK.ADAPT.COOLDOWN; adapt.ring.fill(0); adapt.ms.fill(0); adapt.sum = 0; adapt.slow = 0; adapt.filled = 0; }
  function applyPixels() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, T().pixelRatio) * pixelScale()); renderer.setSize(view.w, view.h, false); }
  function stepDown() {
    adapt.level++;
    /* the bloom is only there to lose on the high tier: a low tier goes straight on to the pixels */
    if (adapt.level === 2 && !post) adapt.level = 3;
    adapt.steps.push({ level: adapt.level, at: performance.now() });
    clearWindow();
    if (effects && effects.setDensity) effects.setDensity(density());
    if (rivalFx && rivalFx.setDensity) rivalFx.setDensity(density());
    if (adapt.level === 2) post = null;
    if (adapt.level >= 3) applyPixels();
  }
  /* nothing that was taken away made the frames shorter: put it all back, for good */
  function giveBack() {
    adapt.level = 0; adapt.gaveBack = true;
    adapt.steps.push({ level: 0, at: performance.now() });
    if (effects && effects.setDensity) effects.setDensity(1);
    if (rivalFx && rivalFx.setDensity) rivalFx.setDensity(1);
    setPost(T().bloom);
    applyPixels();
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(TUNE.CAMERA.FOV, 1, TUNE.CAMERA.NEAR, TUNE.CAMERA.FAR);
  scene.add(camera);
  /* ---- the light ---- */
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.bias = LOOK.SHADOW_BIAS; sun.shadow.normalBias = LOOK.SHADOW_NORMAL_BIAS;
  sun.shadow.camera.near = LOOK.SHADOW_NEAR; sun.shadow.camera.far = LOOK.SHADOW_FAR;
  scene.add(sun); scene.add(sun.target);
  const sunDir = new THREE.Vector3(0, 1, 0);
  const headlight = new THREE.SpotLight(LOOK.HEADLIGHT.colour, LOOK.HEADLIGHT.intensity, LOOK.HEADLIGHT.distance, LOOK.HEADLIGHT.angle, LOOK.HEADLIGHT.penumbra, LOOK.HEADLIGHT.decay);
  headlight.visible = false;
  let preset = PRESETS.dusk, theme = THEMES.forest;
  scene.fog = new THREE.Fog(preset.horizon, preset.fogNear, preset.fogFar);
  function applyPreset(p) {
    preset = p;
    hemi.color.setHex(p.hemiSky); hemi.groundColor.setHex(p.hemiGround); hemi.intensity = p.hemi;
    sun.color.setHex(p.sunColour); sun.intensity = p.sun;
    const d = sunDirection(p); sunDir.set(d[0], d[1], d[2]);
    scene.fog.color.setHex(p.horizon); scene.fog.near = p.fogNear; scene.fog.far = p.fogFar;
    scene.background = new THREE.Color(p.horizon);
    renderer.toneMappingExposure = p.exposure;
    headlight.visible = !!(T().headlight && p.headlights);
    if (effects) effects.setPreset(p);
    if (show) show.setPreset(p);
    if (rivalFx) rivalFx.setPreset(p);
    if (rivalShow) rivalShow.setPreset(p);
    if (FX_ON) setGrade(p);
    applyGlows();
  }

  /* ---- the ground and the world around it ---- */
  let groundGroup = null, cones = null, env = null, envKey = null, track = null, currentGround = null, dressing = null;
  const concrete = concreteTexture(THREE, 128);
  function setGround(ground) {
    currentGround = ground;
    const seed = (ground.seed >>> 0) || (ground.centre.length ? 7 : 3);
    /* a track may name its own preset and theme (the Lab's); the query's override wins over the seed's pick */
    let p = presetFor(seed, overrides.preset || ground.preset);
    if (FX_ON) p = presetShow(p);
    const th = ground.centre.length ? themeFor(seed, overrides.theme || ground.theme) : (overrides.theme && THEMES[overrides.theme] ? THEMES[overrides.theme] : THEMES.docks);
    applyPreset(p);
    theme = th;
    if (groundGroup) { scene.remove(groundGroup); groundGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    groundGroup = new THREE.Group();
    const b = ground.bounds;
    if (ground.centre.length) {
      /* the road, edges, kerbs, run-off, lines, barriers and clip posts
         come from the track generator's mesh builder; the look is ours */
      track = buildTrackMesh(ground, THREE);
      styleTrack(THREE, track, p, { edgeGlowNode: edgeGlow });
      groundGroup.add(track);
      const line = racingLine(THREE, ground, markMaterial);
      if (line) groundGroup.add(line);
      const C = ground.centre, n = C.length;
      const at = m => C[Math.max(0, Math.min(n - 1, Math.round(m / 2)))];
      groundGroup.add(gantry(at(ground.startLine === undefined ? 8 : ground.startLine), LOOK.GANTRY_BEAM, true));
      if (ground.finish) groundGroup.add(gantry(at(ground.finish.along), LOOK.FINISH_BEAM, false));
    } else {
      // the car park: a lighter slab inside the walls, and its walls
      track = null;
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX, b.maxZ - b.minZ), p.wet ? new THREE.MeshStandardMaterial({ color: LOOK.PARK, roughness: TRACK_STYLE.ROUGH_WET }) : new THREE.MeshLambertMaterial({ color: LOOK.PARK }));
      slab.rotation.x = -Math.PI / 2;
      slab.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
      slab.receiveShadow = true;
      groundGroup.add(slab);
      parkWalls(ground);
    }
    scene.add(groundGroup);
    // the world around it, rebuilt only when the track or the tier changes
    const key = [seed, ground.name, p.name, th.name, tier].join('|');
    if (env && envKey !== key) { scene.remove(env.group); scene.remove(env.sky); env.dispose(); env = null; }
    if (!env) {
      env = buildEnvironment(THREE, ground, { preset: p, theme: th, tier: T(), sponsors: FX_ON ? SPONSORS_SHOW : null });
      scene.add(env.group); scene.add(env.sky);
      envKey = key;
      if (dressing) { scene.remove(dressing.group); dressing.dispose(); dressing = null; }
      if (FX_ON) { dressing = buildDressing(THREE, ground, { preset: p, theme: th, tierName: tier, env }); scene.add(dressing.group); }
    }
    // cones
    if (cones) { scene.remove(cones); cones.geometry.dispose(); cones = null; }
    if (ground.cones.length) {
      cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 0.75, 8), new THREE.MeshLambertMaterial({ color: LOOK.CONE }), ground.cones.length);
      cones.frustumCulled = false; cones.castShadow = true;
      scene.add(cones);
    }
    clearMarks();
    if (effects) effects.clear();
    if (show) show.clear();
    if (rivalFx) rivalFx.clear();
    if (rivalShow) rivalShow.clear();
    if (dressing) dressing.clear();
  }
  /* The car park's walls: a track's come with its mesh. */
  function parkWalls(ground) {
    const wallGeo = { plain: [], tyres: [], clip: [] };
    for (const wall of ground.walls) {
      const pts = wall.points;
      for (let i = 0; i + 1 < pts.length; i++) {
        const sAlong = i * 2;
        const inClip = ground.clips.some(c => c.side === wall.side && sAlong >= c.from && sAlong <= c.to);
        const list = inClip ? wallGeo.clip : wall.kind === 'tyres' ? wallGeo.tyres : wallGeo.plain;
        const dx = pts[i + 1].x - pts[i].x, dz = pts[i + 1].z - pts[i].z, len = Math.hypot(dx, dz);
        if (len < 1e-6) continue;
        const nx = -dz / len, nz = dx / len;
        const h = LOOK.WALL_HEIGHT, t = 0.25;
        const q = [
          [pts[i].x + nx * t, 0, pts[i].z + nz * t], [pts[i + 1].x + nx * t, 0, pts[i + 1].z + nz * t], [pts[i + 1].x + nx * t, h, pts[i + 1].z + nz * t], [pts[i].x + nx * t, h, pts[i].z + nz * t],
          [pts[i].x - nx * t, 0, pts[i].z - nz * t], [pts[i + 1].x - nx * t, 0, pts[i + 1].z - nz * t], [pts[i + 1].x - nx * t, h, pts[i + 1].z - nz * t], [pts[i].x - nx * t, h, pts[i].z - nz * t],
        ];
        list.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
        list.push(...q[5], ...q[4], ...q[7], ...q[5], ...q[7], ...q[6]);
        list.push(...q[3], ...q[2], ...q[6], ...q[3], ...q[6], ...q[7]);
      }
    }
    const wallMesh = (list, colour) => { if (!list.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: colour, side: THREE.DoubleSide })); m.name = 'wall'; m.castShadow = true; m.receiveShadow = true; groundGroup.add(m); };
    wallMesh(wallGeo.plain, LOOK.WALL); wallMesh(wallGeo.tyres, LOOK.WALL_TYRES); wallMesh(wallGeo.clip, LOOK.WALL_CLIP);
  }

  /* The dark presets: the road mesh's bright vertex colours (the edge
     line, the kerbs, the lines) are emitted a little, so the edge glows
     against the dark. The standard material is swapped for its node
     twin with the vertex colour as the emissive. */
  function edgeGlow(group, k) {
    const TSL = THREE.TSL;
    group.traverse(m => {
      if (!m.isMesh || m.name !== 'road' || !m.geometry.attributes.color) return;
      const old = m.material;
      const nm = old.isMeshStandardMaterial
        ? new THREE.MeshStandardNodeMaterial({ vertexColors: true, map: old.map, color: old.color, roughness: old.roughness, metalness: old.metalness })
        : new THREE.MeshLambertNodeMaterial({ vertexColors: true, map: old.map, color: old.color });
      const vc = TSL.vertexColor();
      // only the bright, saturated paint glows: the asphalt (dark) stays dark
      const lum = vc.r.max(vc.g).max(vc.b);
      nm.emissiveNode = vc.mul(TSL.smoothstep(0.45, 0.8, lum)).mul(TSL.float(k));
      /* the spectacle round's night: the asphalt itself gives back a little light (moonlight on the surface, baked), so the road reads between the lamps' pools */
      if (FX_ON && preset.roadGlow) nm.emissiveNode = nm.emissiveNode.add(vc.mul(TSL.float(1).sub(TSL.smoothstep(0.45, 0.8, lum))).mul(TSL.float(preset.roadGlow)));
      m.material = nm;
      old.dispose();
    });
  }

  /* The material for the tyre marks and the racing line: a node
     material reading a per vertex alpha. */
  function markMaterial() {
    const TSL = THREE.TSL;
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
    m.colorNode = TSL.vec3(((LOOK.MARK >> 16) & 255) / 255, ((LOOK.MARK >> 8) & 255) / 255, (LOOK.MARK & 255) / 255);
    m.opacityNode = TSL.attribute('alpha', 'float').mul(TSL.float(FX_ON ? LOOK.RUBBER_SHOW : TRACK_STYLE.RACING_LINE_ALPHA));
    return m;
  }

  /* Two posts and a beam over the road at a sample, with a banner under
     the beam at the start and a row of lamps that light up at night. */
  let bannerTex = null;
  function gantry(s, beamColour, start) {
    const g = new THREE.Group();
    const lx = -Math.cos(s.heading), lz = Math.sin(s.heading);
    const reach = s.width / 2 + 1.2, h = LOOK.GANTRY_H, p = LOOK.GANTRY_POST;
    const postMat = new THREE.MeshLambertMaterial({ color: LOOK.GANTRY });
    for (const side of [1, -1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(p, h, p), postMat); post.position.set(s.x + lx * reach * side, h / 2, s.z + lz * reach * side); post.castShadow = true; g.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(reach * 2 + p, 0.6, p), new THREE.MeshLambertMaterial({ color: beamColour, emissive: beamColour, emissiveIntensity: preset.lamps ? LOOK.GANTRY_LIT : 0.25 }));
    /* the box runs along x; rotated by the heading about y its x axis is
       (cos h, -sin h), which is the track's left vector (-cos h, sin h) reversed */
    beam.position.set(s.x, h - 0.3, s.z); beam.rotation.y = s.heading; beam.castShadow = true;
    g.add(beam);
    if (start) {
      if (!bannerTex) bannerTex = bannerTexture(THREE, 'DRIFT FEVER', 0x111318, 0x19d8ff);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(reach * 2 - 1, LOOK.GANTRY_BANNER), new THREE.MeshLambertMaterial({ map: bannerTex, emissive: 0xffffff, emissiveMap: bannerTex, emissiveIntensity: preset.lamps ? 0.8 : 0.2, side: THREE.DoubleSide }));
      banner.position.set(s.x, h - 0.6 - LOOK.GANTRY_BANNER / 2, s.z); banner.rotation.y = s.heading;
      g.add(banner);
    }
    return g;
  }

  /* ---- the car, and the ghost ---- */
  const car = new THREE.Group();        // the physics origin: the centre of mass
  scene.add(car);
  headlight.position.set(0, LOOK.HEADLIGHT.y, LOOK.HEADLIGHT.z);
  headlight.target.position.set(0, 0.2, -30);
  if (FX_ON) { const H = LOOK.HEADLIGHT_SHOW; headlight.intensity = H.intensity; headlight.angle = H.angle; headlight.distance = H.distance; headlight.decay = H.decay; headlight.target.position.set(0, 0.2, H.aim); }
  car.add(headlight); car.add(headlight.target);
  const ghostRoot = new THREE.Group();
  ghostRoot.visible = false;
  scene.add(ghostRoot);
  let model = null, ghostModel = null;
  let effects = null, show = null;   // the player's particles and show, made further down (rebuildEffects)
  /* the rival (briefs/RIVALS.md): a second car with his own marks, smoke
     and show, at their own density (SHOW.RIVAL); he fades out after his
     finish */
  const rivalRoot = new THREE.Group();
  rivalRoot.visible = false;
  scene.add(rivalRoot);
  let rivalModel = null, rivalLamps = { tails: [], exhaust: null }, rivalFx = null, rivalShow = null, rivalFaded = 1;
  const rivalRig = { bRear: TUNE.VEHICLE.WHEELBASE - TUNE.VEHICLE.CG_TO_FRONT, half: TUNE.VEHICLE.TRACK / 2 };
  /* his copy of the player's headlight: not in the scene, so only his materials see it; placed by hand every frame */
  const rivalBeam = new THREE.SpotLight(LOOK.HEADLIGHT.colour, 0, LOOK.HEADLIGHT.distance, LOOK.HEADLIGHT.angle, LOOK.HEADLIGHT.penumbra, LOOK.HEADLIGHT.decay);
  rivalBeam.castShadow = false;
  /* Where the rear wheels are from the physics origin, for the marks. */
  const rig = { bRear: TUNE.VEHICLE.WHEELBASE - TUNE.VEHICLE.CG_TO_FRONT, half: TUNE.VEHICLE.TRACK / 2 };
  /* Mount a model at the physics origin: the model's origin is the middle
     of the wheelbase, the physics origin the centre of mass, CG_TO_FRONT
     behind the front axle, so the model sits WHEELBASE / 2 - CG_TO_FRONT
     back along +Z. */
  /* The cosmetics each car on the road wears (briefs/GARAGE.md): the
     wheels are built into the model, the glow is the model's own light
     at the preset's strength, and the smoke colour goes to that car's
     effects. A ghost shows its wheels and a fainter glow; it has no
     smoke of its own. */
  const looks = { car: lookOf(null), ghost: lookOf(null), rival: lookOf(null) };
  function applyGlows() {
    const k = underglowStrength(preset.name, tier === 'high');
    if (model && model.setUnderglow) model.setUnderglow(glowHex(looks.car.glow), k);
    if (ghostModel && ghostModel.setUnderglow) ghostModel.setUnderglow(glowHex(looks.ghost.glow), k * SHOW.UNDERGLOW.GHOST);
    if (rivalModel && rivalModel.setUnderglow) rivalModel.setUnderglow(glowHex(looks.rival.glow), k);
  }
  function mount(root, id, paintHex, ghost, look) {
    const t = carTune(id), V = t ? t.VEHICLE : TUNE.VEHICLE;
    let m = makeCar(THREE, id, { paint: paintHex, wheels: look ? look.wheels : null, glowForm: tier === 'high' ? 'soft' : 'cheap' });
    if (ghost) m = makeGhostly(m, LOOP.GHOST_OPACITY, LOOP.GHOST_TINT);
    else m.group.traverse(o => { if (o.isMesh) { o.castShadow = o !== m.underglow; o.receiveShadow = false; } });   // the glow is light: it throws no shadow
    m.group.position.z = V.WHEELBASE / 2 - V.CG_TO_FRONT;
    root.add(m.group);
    return { model: m, bRear: V.WHEELBASE - V.CG_TO_FRONT, half: V.TRACK / 2 };
  }
  function setCar(id, paintId, look) {
    if (model) { car.remove(model.group); model.dispose(); }
    looks.car = lookOf(look);
    const r = mount(car, id, paintById(paintId || carById(id).paint).hex, false, looks.car);
    model = r.model; rig.bRear = r.bRear; rig.half = r.half;
    applyGlows();
    if (effects) effects.setSmoke(smokeHex(looks.car.smoke));
    if (model.lights && model.lights.set) model.lights.set(preset.headlights ? 1 : 0.35, 1);
    lamps = carLamps(model);
  }
  /* Where the tail-lights and the exhaust are on the car, in the frame
     of the physics origin: the trails and the pops start there. */
  let lamps = { tails: [], exhaust: null };
  function carLamps(m) {
    const out = { tails: [], exhaust: null };
    const tail = m.lights && m.lights.tail;
    const oz = m.group.position.z;
    if (tail && tail.geometry) {
      tail.geometry.computeBoundingBox();
      const b = tail.geometry.boundingBox, y = (b.min.y + b.max.y) / 2, z = b.max.z + oz + 0.02, inset = Math.min(0.15, (b.max.x - b.min.x) * 0.12);
      out.tails.push([b.min.x + inset, y + tail.position.y, z + tail.position.z], [b.max.x - inset, y + tail.position.y, z + tail.position.z]);
    }
    const d = m.dims;
    out.exhaust = [d.halfWidth * 0.45, 0.32, (d.centreZ || 0) + d.halfLength + oz + 0.05];
    return out;
  }
  function setGhost(id, paintId, look) {
    if (ghostModel) { ghostRoot.remove(ghostModel.group); ghostModel.dispose(); ghostModel = null; }
    if (!id) { ghostRoot.visible = false; return; }
    looks.ghost = lookOf(look);
    ghostModel = mount(ghostRoot, id, paintById(paintId || carById(id).paint).hex, true, looks.ghost).model;
    applyGlows();
  }
  function setRival(id, paintId, look) {
    if (rivalModel) { rivalRoot.remove(rivalModel.group); rivalModel.dispose(); rivalModel = null; }
    rivalFaded = 1;
    if (!id) { rivalRoot.visible = false; return; }
    looks.rival = lookOf(look);
    const r = mount(rivalRoot, id, paintById(paintId || carById(id).paint).hex, false, looks.rival);
    rivalModel = r.model; rivalRig.bRear = r.bRear; rivalRig.half = r.half; rivalRoot.visible = true;
    /* the player's headlights never light him: a few metres behind him
       in a tandem they washed his paint to white. The sky and the sun
       still do, so he reads as his colour, lit as the scene is */
    const lit = THREE.TSL.lights([hemi, sun, rivalBeam]);
    rivalModel.group.traverse(o => { if (!o.isMesh || !o.material) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshPhysicalMaterial) m.lightsNode = lit; });
    if (rivalModel.lights && rivalModel.lights.set) rivalModel.lights.set(preset.headlights ? 1 : 0.35, 1);
    rivalLamps = carLamps(rivalModel);
    applyGlows();
    rebuildRivalFx();
  }
  /* see through as he fades: 1 is solid, 0 gone */
  function fadeRival(a) {
    if (!rivalModel || a === rivalFaded) return;
    rivalFaded = a;
    rivalModel.group.traverse(o => { if (!o.isMesh || !o.material) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (m.userData.op === undefined) m.userData.op = { t: m.transparent, o: m.opacity, d: m.depthWrite }; const fade = a < 1; m.transparent = fade || m.userData.op.t; m.opacity = m.userData.op.o * a; m.depthWrite = fade ? false : m.userData.op.d; m.needsUpdate = true; } });
    rivalRoot.visible = a > 0.01;
  }
  function poseWheels(m, c) {
    if (!m) return;
    const w = m.wheels;
    w.fl.pivot.rotation.y = c.steer; w.fr.pivot.rotation.y = c.steer;
    w.fl.mesh.rotation.x = c.wheelF; w.fr.mesh.rotation.x = c.wheelF;
    w.rl.mesh.rotation.x = c.wheelR; w.rr.mesh.rotation.x = c.wheelR;
  }
  setCar('starter');
  const clearOf = { x: 0, y: 0, z: 0, r: 1.8, keep: 0.1, near: 2.5, far: 7 };
  const dressArgs = { dt: 0, pose: null, sliding: false };
  const showCtx = { mult: 1, car: null, tails: null, exhaust: null, lights: null, pools: null, density: 1,
    extraGlows: g => { if (dressing) dressing.update(dressArgs.dt, camera, dressArgs.pose, show.state.heat, dressArgs.sliding, g); } };

  /* ---- tyre marks: a ring of quads under the rear wheels ---- */
  const markLimit = () => FX_ON ? LOOK.MARK_SHOW[tier] || LOOK.MARK_SHOW.low : T().marks;
  const markMax = FX_ON ? Math.max(LOOK.MARK_SHOW.low, LOOK.MARK_SHOW.high) : Math.max(LOOK.TIERS.low.marks, LOOK.TIERS.high.marks);
  const markGeo = new THREE.BufferGeometry();
  const markPos = new Float32Array(markMax * 6 * 3);
  const markAlpha = new Float32Array(markMax * 6);
  markGeo.setAttribute('position', new THREE.BufferAttribute(markPos, 3));
  markGeo.setAttribute('alpha', new THREE.BufferAttribute(markAlpha, 1));
  const markMat = markMaterial();
  markMat.opacityNode = THREE.TSL.attribute('alpha', 'float').mul(THREE.TSL.float(FX_ON ? LOOK.MARK_SHOW.opacity : LOOK.MARK_OPACITY));
  const marks = new THREE.Mesh(markGeo, markMat);
  marks.frustumCulled = false;
  marks.position.y = 0.03;
  marks.renderOrder = 2;
  scene.add(marks);
  let markHead = 0, markCount = 0;
  const lastMark = { rl: null, rr: null };
  function clearMarks() { markPos.fill(0); markAlpha.fill(0); markHead = 0; markCount = 0; lastMark.rl = null; lastMark.rr = null; lastMark.rl2 = null; lastMark.rr2 = null; markGeo.attributes.position.needsUpdate = true; markGeo.attributes.alpha.needsUpdate = true; markGeo.setDrawRange(0, 0); }
  function layMark(name, x, y, z, hx, hz, strength) {
    // hx, hz: the half width vector across the mark
    const prev = lastMark[name];
    lastMark[name] = { x, y, z, hx, hz };
    if (!prev) return;
    if (Math.hypot(x - prev.x, z - prev.z) < LOOK.MARK_SPACING * 0.5) { lastMark[name] = prev; return; }
    const limit = markLimit();
    const o = markHead * 18;
    const q = [prev.x - prev.hx, prev.z - prev.hz, prev.x + prev.hx, prev.z + prev.hz, x + hx, z + hz, x - hx, z - hz];
    const qy = [prev.y, prev.y, y, y];
    const tri = [0, 1, 2, 0, 2, 3];
    for (let i = 0; i < 6; i++) { markPos[o + i * 3] = q[tri[i] * 2]; markPos[o + i * 3 + 1] = qy[tri[i]]; markPos[o + i * 3 + 2] = q[tri[i] * 2 + 1]; markAlpha[markHead * 6 + i] = strength; }
    /* with the round on, only the quad just laid goes to the GPU, not the whole ring */
    if (FX_ON) { markGeo.attributes.position.addUpdateRange(o, 18); markGeo.attributes.alpha.addUpdateRange(markHead * 6, 6); }
    markHead = (markHead + 1) % limit;
    if (markCount < limit) markCount++;
    markGeo.attributes.position.needsUpdate = true; markGeo.attributes.alpha.needsUpdate = true;
    markGeo.setDrawRange(0, markCount * 6);
  }

  /* ---- effects ---- */
  function rebuildEffects() {
    if (effects) { scene.remove(effects.group); effects.dispose(); }
    effects = createEffects(THREE, { tier: T(), tierName: tier, preset, show: FX_ON, smoke: smokeHex(looks.car.smoke) });
    if (FX_ON) effects.setDensity(density());
    scene.add(effects.group);
    if (FX_ON) {
      if (show) { scene.remove(show.group); show.dispose(); }
      show = createShow(THREE, { tier: T(), tierName: tier, preset });
      scene.add(show.group);
    }
    if (rivalModel) rebuildRivalFx();
  }
  function rebuildRivalFx() {
    if (rivalFx) { scene.remove(rivalFx.group); rivalFx.dispose(); rivalFx = null; }
    if (rivalShow) { scene.remove(rivalShow.group); rivalShow.dispose(); rivalShow = null; }
    if (!rivalModel) return;
    rivalFx = createEffects(THREE, { tier: T(), tierName: tier, preset, show: FX_ON, share: FX_ON ? SHOW.RIVAL.SHARE[tier] || SHOW.RIVAL.SHARE.low : 0.5, noRain: true, smoke: smokeHex(looks.rival.smoke) });
    if (FX_ON) rivalFx.setDensity(density());
    scene.add(rivalFx.group);
    if (FX_ON) { rivalShow = createShow(THREE, { tier: T(), tierName: tier, preset, glows: SHOW.RIVAL.GLOWS[tier] || SHOW.RIVAL.GLOWS.low }); scene.add(rivalShow.group); }
  }
  rebuildEffects();

  /* the grade's uniforms, set by the preset */
  const grade = { lift: THREE.TSL.uniform(new THREE.Vector3(0, 0, 0)), gain: THREE.TSL.uniform(new THREE.Vector3(1, 1, 1)), saturation: THREE.TSL.uniform(1), vignette: THREE.TSL.uniform(0) };
  function setGrade(p) {
    const g = p.grade || { lift: [0, 0, 0], gain: [1, 1, 1], saturation: 1, vignette: 0 };
    grade.lift.value.set(...g.lift); grade.gain.value.set(...g.gain); grade.saturation.value = g.saturation; grade.vignette.value = g.vignette;
  }
  /* ---- bloom on the high tier: the scene pass plus a soft ring of
     samples of its bright parts, through the renderer's post pipeline ---- */
  function setPost(on) {
    if (!on) { post = null; return; }
    try {
      const TSL = THREE.TSL;
      const pipeline = new THREE.PostProcessing(renderer);
      const scenePass = TSL.pass(scene, camera);
      const colour = scenePass.getTextureNode('output');
      const B = LOOK.BLOOM;
      let glow = TSL.vec3(0);
      for (let i = 0; i < B.taps; i++) {
        const a = i / B.taps * Math.PI * 2;
        const r = (i % 2 ? 1 : 0.5) * B.radius;
        const uv = TSL.uv().add(TSL.vec2(Math.cos(a) * r, Math.sin(a) * r));
        const s = scenePass.getTextureNode('output').sample(uv);
        glow = glow.add(s.rgb.sub(B.threshold).max(0));
      }
      let out = colour.add(TSL.vec4(glow.mul(B.strength / B.taps), 0));
      if (FX_ON) {
        /* the spectacle round's colour grade: lift, gain, saturation and a vignette, per preset */
        const G = grade;
        let rgb = out.rgb.mul(G.gain).add(G.lift);
        const l = rgb.dot(TSL.vec3(0.2126, 0.7152, 0.0722));
        rgb = TSL.mix(TSL.vec3(l), rgb, G.saturation);
        const r = TSL.uv().sub(0.5).length().mul(1.414);
        rgb = rgb.mul(TSL.float(1).sub(G.vignette.mul(TSL.smoothstep(0.35, 1.0, r))));
        out = TSL.vec4(rgb, out.a);
      }
      pipeline.outputNode = out;
      post = pipeline;
    } catch (e) { console.warn('bloom off: ' + (e && e.message)); post = null; }
  }

  /* ---- per frame ---- */
  const coneM = new THREE.Matrix4(), coneQ = new THREE.Quaternion(), coneE = new THREE.Euler(), coneS = new THREE.Vector3(1, 1, 1);
  const texel = new THREE.Vector3();
  function followSun(pose) {
    // the shadow box follows the car, snapped to its texel grid so the edges do not crawl
    const range = T().shadowRange, size = (range * 2) / T().shadow;
    const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw);
    const ax = pose.x + fx * range * LOOK.SHADOW_AHEAD, az = pose.z + fz * range * LOOK.SHADOW_AHEAD;
    texel.set(Math.round(ax / size) * size, 0, Math.round(az / size) * size);
    sun.target.position.copy(texel);
    sun.position.copy(texel).addScaledVector(sunDir, LOOK.SUN_DISTANCE);
  }
  /* the marks a car's rear wheels lay while they slide, into the one ring */
  function skids(pose, c, rig, nl, nr) {
    const sliding = c.rearSlide >= LOOK.MARK_MIN_SLIDE || c.hb > 0.5 || c.spinning;
    const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw), lz = Math.sin(pose.yaw);
    const bRear = rig.bRear, half = rig.half;
    const strength = Math.min(1, Math.max(c.rearSlide / 2, c.hb, c.spinning ? 0.6 : 0));
    for (const [name, side] of [[nl, 1], [nr, -1]]) {
      const wx = pose.x - fx * bRear + lx * half * side, wz = pose.z - fz * bRear + lz * half * side;
      /* the wheel's height on a banked or sloping road: the car's height plus its roll across and pitch along */
      const wy = (pose.y || 0) - Math.sin(c.roll || 0) * half * side + Math.sin(c.pitch || 0) * bRear;
      const mw = FX_ON ? LOOK.MARK_SHOW.width : LOOK.MARK_WIDTH;
      if (sliding && c.speed > 1.5) layMark(name, wx, wy, wz, lx * mw * 0.5, lz * mw * 0.5, 0.5 + 0.5 * strength);
      else lastMark[name] = null;
    }
  }
  /* the rival's frame: rv { pose, world, mult, fade } (fade 0 solid, 1 gone) */
  const rivalCtx = { mult: 1, car: rivalRoot, tails: null, exhaust: null, lights: null, pools: null, density: 1, extraGlows: null };
  function updateRival(rv, dt) {
    if (!rv || !rivalModel) { if (rivalRoot.visible) rivalRoot.visible = false; return; }
    const p = rv.pose, c = rv.world.car;
    rivalRoot.position.set(p.x, p.y || 0, p.z);
    rivalRoot.rotation.set(c.pitch || 0, p.yaw, c.roll || 0, 'YXZ');
    fadeRival(Math.max(0, 1 - (rv.fade || 0)));
    poseWheels(rivalModel, c);
    if (rivalFaded <= 0.01) return;
    skids(p, c, rivalRig, 'rl2', 'rr2');
    if (FX_ON && rivalFx && rivalShow) {
      rivalFx.update(dt, camera, p, rv.world, rivalRig, rivalShow.state.heat, clearOf);   // his smoke thins over the player's car, as the player's own does
      rivalCtx.mult = rv.mult || 1; rivalCtx.tails = rivalLamps.tails; rivalCtx.exhaust = rivalLamps.exhaust; rivalCtx.lights = rivalModel.lights; rivalCtx.pools = rivalFx.pools; rivalCtx.density = density();
      rivalShow.update(dt, camera, p, rv.world, rivalRig, rivalCtx);
    } else if (FX_PARTICLES && rivalFx) rivalFx.update(dt, camera, p, rv.world, rivalRig);
  }
  function update(pose, world, dt, ghost, extra) {
    /* pose: the interpolated car {x, z, yaw}; world.car for the rest;
       ghost: { x, z, yaw, car } interpolated, or null */
    const c = world.car;
    car.position.set(pose.x, pose.y || 0, pose.z);
    car.rotation.set(c.pitch || 0, pose.yaw, c.roll || 0, 'YXZ');
    poseWheels(model, c);
    if (ghost && ghostModel) {
      ghostRoot.visible = true;
      ghostRoot.position.set(ghost.x, ghost.y || 0, ghost.z); ghostRoot.rotation.set(ghost.car ? ghost.car.pitch || 0 : 0, ghost.yaw, ghost.car ? ghost.car.roll || 0 : 0, 'YXZ');
      if (ghost.car) poseWheels(ghostModel, ghost.car);
    } else ghostRoot.visible = false;
    // marks off the rear wheels while they slide
    skids(pose, c, rig, 'rl', 'rr');
    if (FX_ON) {
      const C = SHOW.SMOKE.CLEAR;
      clearOf.x = pose.x; clearOf.y = (pose.y || 0) + 0.7; clearOf.z = pose.z; clearOf.r = C.r; clearOf.keep = C.keep; clearOf.near = C.near; clearOf.far = C.far;
      effects.update(dt, camera, pose, world, rig, show.state.heat, clearOf);
      const sliding = c.rearSlide >= 0.9 || c.hb > 0.5 || c.drifting;
      /* the show's context, one object kept and refreshed, so nothing is made per frame */
      showCtx.mult = extra ? extra.mult : 1; showCtx.car = car; showCtx.tails = lamps.tails; showCtx.exhaust = lamps.exhaust; showCtx.lights = model && model.lights; showCtx.pools = effects.pools; showCtx.density = density();
      dressArgs.dt = dt; dressArgs.pose = pose; dressArgs.sliding = sliding;
      show.update(dt, camera, pose, world, rig, showCtx);
    } else if (FX_PARTICLES) effects.update(dt, camera, pose, world, rig);
    updateRival(extra && extra.rival, dt);
    /* his copy of the beam: where the headlight is, dimmed by how near he is */
    if (rivalModel && rivalRoot.visible) {
      const rv = extra && extra.rival;
      let k = 0;
      if (rv && headlight.visible) {
        const dx = rv.pose.x - pose.x, dz = rv.pose.z - pose.z, ahead = dx * -Math.sin(pose.yaw) + dz * -Math.cos(pose.yaw);
        k = ahead > 0 ? Math.min(1, Math.pow(Math.max(1, ahead) / LOOK.RIVAL_BEAM.ref, headlight.decay || 1.6)) : 1;
      }
      car.updateMatrixWorld();
      headlight.getWorldPosition(rivalBeam.position); headlight.target.getWorldPosition(rivalBeam.target.position);
      rivalBeam.intensity = headlight.intensity * k; rivalBeam.angle = headlight.angle; rivalBeam.distance = headlight.distance; rivalBeam.decay = headlight.decay; rivalBeam.penumbra = headlight.penumbra;
      rivalBeam.updateMatrixWorld(); rivalBeam.target.updateMatrixWorld();
    }
    followSun(pose);
    if (cones) {
      for (let i = 0; i < world.cones.length; i++) {
        const k = world.cones[i];
        coneE.set(k.tiltX * k.tilt * Math.PI / 2, 0, k.tiltZ * k.tilt * Math.PI / 2);
        coneQ.setFromEuler(coneE);
        const y = 0.375 * (1 - k.tilt) + 0.28 * k.tilt;
        coneM.compose(new THREE.Vector3(k.x, y, k.z), coneQ, coneS);
        cones.setMatrixAt(i, coneM);
      }
      cones.instanceMatrix.needsUpdate = true;
    }
  }

  function resize(w, h) { view.w = w; view.h = h; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); }
  let lastSubmit = 0, lastStats = { drawCalls: 0, triangles: 0 }, lastNodeFrame = -1;
  function render() {
    const t0 = performance.now();
    if (env) env.sky.position.set(camera.position.x, 0, camera.position.z);
    /* The renderer counts frames in its own requestAnimationFrame loop,
       and a shadow map is refreshed once per counted frame. The probes
       stub requestAnimationFrame and drive the frame function by hand,
       so the count would stand still and the shadows would freeze on
       the first frame: when it has not moved since the last render,
       move it here. In a browser the loop moves it and this does nothing. */
    const nf = renderer._nodes && renderer._nodes.nodeFrame;
    if (nf) { if (nf.frameId === lastNodeFrame) nf.update(); lastNodeFrame = nf.frameId; }
    renderer.info.reset();
    if (post) post.render(); else renderer.render(scene, camera);
    lastSubmit = performance.now() - t0;
    const r = renderer.info.render;
    lastStats = { drawCalls: r.drawCalls, triangles: r.triangles };
  }
  function setLook(o) {
    // the lab and the probes: change the preset or the theme and rebuild the world
    if (o.preset) overrides.preset = o.preset;
    if (o.theme) overrides.theme = o.theme;
    if (currentGround) setGround(currentGround);
  }
  return {
    THREE, renderer, scene, camera, car, ready, show: () => show, effects: () => effects, setGround, setCar, setGhost, setRival, rivalRoot, rivalShow: () => rivalShow, rivalEffects: () => rivalFx, update, resize, render, clearMarks, setLook,
    carModel: () => model, ghostModel: () => ghostModel, rivalModel: () => rivalModel, looks,
    frameTime, adaptState: () => ({ level: adapt.level, steps: adapt.steps.slice(), on: adaptOn, done: adapt.done, gaveBack: adapt.gaveBack, pixelRatio: renderer.getPixelRatio(), bloom: !!post, density: density() }),
    info: () => ({ backend, tier, adapt: adapt.level, submitMs: lastSubmit, preset: preset.name, theme: theme.name, drawCalls: lastStats.drawCalls, triangles: lastStats.triangles, env: env ? env.info : null, bloom: !!post }),
    environment: () => env, dressing: () => dressing,
    fireworks: stars => { if (dressing) dressing.fireworks(stars); },
    setTier: t => { if (LOOK.TIERS[t]) { tier = t; applyTier(); if (currentGround) setGround(currentGround); } },
  };
}
