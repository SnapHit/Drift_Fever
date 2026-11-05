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
import { PRESETS, presetFor, sunDirection } from '../env/presets.js';
import { THEMES, themeFor } from '../env/themes.js';
import { buildEnvironment } from '../env/world.js';
import { styleTrack, racingLine, TRACK_STYLE } from '../env/trackstyle.js';
import { createEffects } from '../env/effects.js';
import { bannerTexture, concreteTexture } from '../env/textures.js';

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
  MARK:         0x000000,     // the marks and the racing line darken the road: black at an opacity
  MARK_WIDTH:   0.22,
  MARK_MIN_SLIDE: 0.9,        // rear slide (as a share of the peak) before a mark is laid
  MARK_SPACING: 0.35,         // m between quads
  MARK_OPACITY: 0.6,
  TONE_MAPPING: 'aces',
  BLOOM:        { threshold: 0.85, strength: 0.55, radius: 0.012, taps: 12 },
  LOW_TIER_CORES: 4,
  TIERS: {
    low:  { pixelRatio: 1.0, shadow: 1024, shadowRange: 36, terrainCell: 8, sceneryShare: 0.4, shadowMinHeight: 2.5, smoke: 48, dust: 32, sparks: 60, rain: 140, marks: 1400, bloom: false, headlight: false },
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, T().pixelRatio));
    renderer.setSize(view.w, view.h, false);
    sun.shadow.mapSize.set(T().shadow, T().shadow);
    sun.shadow.camera.left = -T().shadowRange; sun.shadow.camera.right = T().shadowRange; sun.shadow.camera.top = T().shadowRange; sun.shadow.camera.bottom = -T().shadowRange;
    sun.shadow.camera.updateProjectionMatrix();
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    headlight.visible = !!(T().headlight && preset.headlights);
    rebuildEffects();
    setPost(T().bloom);
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
  }

  /* ---- the ground and the world around it ---- */
  let groundGroup = null, cones = null, env = null, envKey = null, track = null, currentGround = null;
  const concrete = concreteTexture(THREE, 128);
  function setGround(ground) {
    currentGround = ground;
    const seed = (ground.seed >>> 0) || (ground.centre.length ? 7 : 3);
    const p = presetFor(seed, overrides.preset), th = ground.centre.length ? themeFor(seed, overrides.theme) : (overrides.theme && THEMES[overrides.theme] ? THEMES[overrides.theme] : THEMES.docks);
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
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX, b.maxZ - b.minZ), new THREE.MeshStandardMaterial({ color: LOOK.PARK, roughness: p.wet ? TRACK_STYLE.ROUGH_WET : TRACK_STYLE.ROUGH_DRY }));
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
      env = buildEnvironment(THREE, ground, { preset: p, theme: th, tier: T() });
      scene.add(env.group); scene.add(env.sky);
      envKey = key;
    }
    // cones
    if (cones) { scene.remove(cones); cones.geometry.dispose(); cones = null; }
    if (ground.cones.length) {
      cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 0.75, 8), new THREE.MeshStandardMaterial({ color: LOOK.CONE, roughness: 0.6 }), ground.cones.length);
      cones.frustumCulled = false; cones.castShadow = true;
      scene.add(cones);
    }
    clearMarks();
    if (effects) effects.clear();
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
    const wallMesh = (list, colour) => { if (!list.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9, side: THREE.DoubleSide })); m.name = 'wall'; m.castShadow = true; m.receiveShadow = true; groundGroup.add(m); };
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
      const nm = new THREE.MeshStandardNodeMaterial({ vertexColors: true, map: old.map, color: old.color, roughness: old.roughness, metalness: old.metalness });
      const vc = TSL.vertexColor();
      // only the bright, saturated paint glows: the asphalt (dark) stays dark
      const lum = vc.r.max(vc.g).max(vc.b);
      nm.emissiveNode = vc.mul(TSL.smoothstep(0.45, 0.8, lum)).mul(TSL.float(k));
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
    m.opacityNode = TSL.attribute('alpha', 'float').mul(TSL.float(TRACK_STYLE.RACING_LINE_ALPHA));
    return m;
  }

  /* Two posts and a beam over the road at a sample, with a banner under
     the beam at the start and a row of lamps that light up at night. */
  let bannerTex = null;
  function gantry(s, beamColour, start) {
    const g = new THREE.Group();
    const lx = -Math.cos(s.heading), lz = Math.sin(s.heading);
    const reach = s.width / 2 + 1.2, h = LOOK.GANTRY_H, p = LOOK.GANTRY_POST;
    const postMat = new THREE.MeshStandardMaterial({ color: LOOK.GANTRY, roughness: 0.6, metalness: 0.3 });
    for (const side of [1, -1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(p, h, p), postMat); post.position.set(s.x + lx * reach * side, h / 2, s.z + lz * reach * side); post.castShadow = true; g.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(reach * 2 + p, 0.6, p), new THREE.MeshStandardMaterial({ color: beamColour, roughness: 0.5, emissive: beamColour, emissiveIntensity: preset.lamps ? LOOK.GANTRY_LIT : 0.25 }));
    /* the box runs along x; rotated by the heading about y its x axis is
       (cos h, -sin h), which is the track's left vector (-cos h, sin h) reversed */
    beam.position.set(s.x, h - 0.3, s.z); beam.rotation.y = s.heading; beam.castShadow = true;
    g.add(beam);
    if (start) {
      if (!bannerTex) bannerTex = bannerTexture(THREE, 'DRIFT FEVER', 0x111318, 0x19d8ff);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(reach * 2 - 1, LOOK.GANTRY_BANNER), new THREE.MeshStandardMaterial({ map: bannerTex, emissive: 0xffffff, emissiveMap: bannerTex, emissiveIntensity: preset.lamps ? 0.8 : 0.2, side: THREE.DoubleSide, roughness: 0.6 }));
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
  car.add(headlight); car.add(headlight.target);
  const ghostRoot = new THREE.Group();
  ghostRoot.visible = false;
  scene.add(ghostRoot);
  let model = null, ghostModel = null;
  /* Where the rear wheels are from the physics origin, for the marks. */
  const rig = { bRear: TUNE.VEHICLE.WHEELBASE - TUNE.VEHICLE.CG_TO_FRONT, half: TUNE.VEHICLE.TRACK / 2 };
  /* Mount a model at the physics origin: the model's origin is the middle
     of the wheelbase, the physics origin the centre of mass, CG_TO_FRONT
     behind the front axle, so the model sits WHEELBASE / 2 - CG_TO_FRONT
     back along +Z. */
  function mount(root, id, paintHex, ghost) {
    const t = carTune(id), V = t ? t.VEHICLE : TUNE.VEHICLE;
    let m = makeCar(THREE, id, { paint: paintHex });
    if (ghost) m = makeGhostly(m, LOOP.GHOST_OPACITY, LOOP.GHOST_TINT);
    else m.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    m.group.position.z = V.WHEELBASE / 2 - V.CG_TO_FRONT;
    root.add(m.group);
    return { model: m, bRear: V.WHEELBASE - V.CG_TO_FRONT, half: V.TRACK / 2 };
  }
  function setCar(id, paintId) {
    if (model) { car.remove(model.group); model.dispose(); }
    const r = mount(car, id, paintById(paintId || carById(id).paint).hex, false);
    model = r.model; rig.bRear = r.bRear; rig.half = r.half;
    if (model.lights && model.lights.set) model.lights.set(preset.headlights ? 1 : 0.35, 1);
  }
  function setGhost(id, paintId) {
    if (ghostModel) { ghostRoot.remove(ghostModel.group); ghostModel.dispose(); ghostModel = null; }
    if (!id) { ghostRoot.visible = false; return; }
    ghostModel = mount(ghostRoot, id, paintById(paintId || carById(id).paint).hex, true).model;
  }
  function poseWheels(m, c) {
    if (!m) return;
    const w = m.wheels;
    w.fl.pivot.rotation.y = c.steer; w.fr.pivot.rotation.y = c.steer;
    w.fl.mesh.rotation.x = c.wheelF; w.fr.mesh.rotation.x = c.wheelF;
    w.rl.mesh.rotation.x = c.wheelR; w.rr.mesh.rotation.x = c.wheelR;
  }
  setCar('starter');

  /* ---- tyre marks: a ring of quads under the rear wheels ---- */
  const markMax = Math.max(LOOK.TIERS.low.marks, LOOK.TIERS.high.marks);
  const markGeo = new THREE.BufferGeometry();
  const markPos = new Float32Array(markMax * 6 * 3);
  const markAlpha = new Float32Array(markMax * 6);
  markGeo.setAttribute('position', new THREE.BufferAttribute(markPos, 3));
  markGeo.setAttribute('alpha', new THREE.BufferAttribute(markAlpha, 1));
  const markMat = markMaterial();
  markMat.opacityNode = THREE.TSL.attribute('alpha', 'float').mul(THREE.TSL.float(LOOK.MARK_OPACITY));
  const marks = new THREE.Mesh(markGeo, markMat);
  marks.frustumCulled = false;
  marks.position.y = 0.03;
  marks.renderOrder = 2;
  scene.add(marks);
  let markHead = 0, markCount = 0;
  const lastMark = { rl: null, rr: null };
  function clearMarks() { markPos.fill(0); markAlpha.fill(0); markHead = 0; markCount = 0; lastMark.rl = null; lastMark.rr = null; markGeo.attributes.position.needsUpdate = true; markGeo.attributes.alpha.needsUpdate = true; markGeo.setDrawRange(0, 0); }
  function layMark(name, x, z, hx, hz, strength) {
    // hx, hz: the half width vector across the mark
    const prev = lastMark[name];
    lastMark[name] = { x, z, hx, hz };
    if (!prev) return;
    if (Math.hypot(x - prev.x, z - prev.z) < LOOK.MARK_SPACING * 0.5) { lastMark[name] = prev; return; }
    const limit = T().marks;
    const o = markHead * 18;
    const q = [prev.x - prev.hx, prev.z - prev.hz, prev.x + prev.hx, prev.z + prev.hz, x + hx, z + hz, x - hx, z - hz];
    const tri = [0, 1, 2, 0, 2, 3];
    for (let i = 0; i < 6; i++) { markPos[o + i * 3] = q[tri[i] * 2]; markPos[o + i * 3 + 1] = 0; markPos[o + i * 3 + 2] = q[tri[i] * 2 + 1]; markAlpha[markHead * 6 + i] = strength; }
    markHead = (markHead + 1) % limit;
    if (markCount < limit) markCount++;
    markGeo.attributes.position.needsUpdate = true; markGeo.attributes.alpha.needsUpdate = true;
    markGeo.setDrawRange(0, markCount * 6);
  }

  /* ---- effects ---- */
  let effects = null;
  function rebuildEffects() {
    if (effects) { scene.remove(effects.group); effects.dispose(); }
    effects = createEffects(THREE, { tier: T(), preset });
    scene.add(effects.group);
  }
  rebuildEffects();

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
      pipeline.outputNode = colour.add(TSL.vec4(glow.mul(B.strength / B.taps), 0));
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
  function update(pose, world, dt, ghost) {
    /* pose: the interpolated car {x, z, yaw}; world.car for the rest;
       ghost: { x, z, yaw, car } interpolated, or null */
    const c = world.car;
    car.position.set(pose.x, 0, pose.z);
    car.rotation.y = pose.yaw;
    poseWheels(model, c);
    if (ghost && ghostModel) {
      ghostRoot.visible = true;
      ghostRoot.position.set(ghost.x, 0, ghost.z); ghostRoot.rotation.y = ghost.yaw;
      if (ghost.car) poseWheels(ghostModel, ghost.car);
    } else ghostRoot.visible = false;
    // marks off the rear wheels while they slide
    const sliding = c.rearSlide >= LOOK.MARK_MIN_SLIDE || c.hb > 0.5 || c.spinning;
    const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw), lz = Math.sin(pose.yaw);
    const bRear = rig.bRear, half = rig.half;
    const strength = Math.min(1, Math.max(c.rearSlide / 2, c.hb, c.spinning ? 0.6 : 0));
    for (const [name, side] of [['rl', 1], ['rr', -1]]) {
      const wx = pose.x - fx * bRear + lx * half * side, wz = pose.z - fz * bRear + lz * half * side;
      if (sliding && c.speed > 1.5) layMark(name, wx, wz, lx * LOOK.MARK_WIDTH * 0.5, lz * LOOK.MARK_WIDTH * 0.5, 0.5 + 0.5 * strength);
      else lastMark[name] = null;
    }
    if (query.get('fx') !== '0') effects.update(dt, camera, pose, world, rig);
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
    THREE, renderer, scene, camera, car, ready, setGround, setCar, setGhost, update, resize, render, clearMarks, setLook,
    carModel: () => model,
    info: () => ({ backend, tier, submitMs: lastSubmit, preset: preset.name, theme: theme.name, drawCalls: lastStats.drawCalls, triangles: lastStats.triangles, env: env ? env.info : null, bloom: !!post }),
    environment: () => env,
    setTier: t => { if (LOOK.TIERS[t]) { tier = t; applyTier(); if (currentGround) setGround(currentGround); } },
  };
}
