/* THE SCENE. Plain shapes in real 3D: the ground, the track from the
   generator's mesh builder (road, edges, kerbs, run-off, barriers, clip
   posts, the lines), a gantry over the start and a sprint's finish, the
   car park's walls and cones, the car (through render/car.js: the five
   models), the ghost as a see through copy, and the tyre marks the rear
   wheels lay while they slide. three.js
   WebGPURenderer, with the WebGL 2 fallback forced by ?renderer=webgl2.
   No textures, no shadows, a hemisphere light and a sun, fog to the
   horizon. Every number of taste lives in LOOK at the top. */
import * as THREE from 'three';
import { TUNE, LOOP } from '../tune.js';
import { makeCar, makeGhostly } from './car.js';
import { buildTrackMesh } from '../tracks/mesh.js';
import { carById, carTune, paintById } from '../garage/roster.js';

export const LOOK = {
  SKY:          0x1a1d33,
  FOG:          0x2a2742,
  FOG_NEAR:     60,
  FOG_FAR:      420,
  GROUND:       0x24252b,
  ROAD:         0x3a3b44,
  EDGE:         0xf6e7a1,     // the brightest, most saturated thing on screen
  EDGE_WIDTH:   0.45,
  WALL:         0x8f8f99,
  WALL_TYRES:   0x3a3f4a,
  WALL_CLIP:    0xff8a3c,     // a wall inside a clipping zone
  WALL_HEIGHT:  1.0,
  GANTRY:       0xd8dbe6,     // the start gantry's posts and beam
  GANTRY_BEAM:  0x19d8ff,
  GANTRY_H:     5.0,          // m
  GANTRY_POST:  0.35,
  FINISH_BEAM:  0xf6e7a1,
  CONE:         0xff7a1a,
  CAR:          0x19d8ff,     // fixed cyan
  CAR_DARK:     0x0d6f85,
  WHEEL:        0x15151a,
  LAMP_FRONT:   0xfff6d0,
  LAMP_REAR:    0xff2a2a,
  HEMI_SKY:     0x9ca6ff,
  HEMI_GROUND:  0x2b2418,
  HEMI:         2.4,          // physical units: the renderer divides a light by pi
  SUN:          3.6,
  SUN_DIR:      [-0.5, 0.8, 0.3],
  MARK:         0x101014,
  MARK_WIDTH:   0.22,
  MARK_MAX:     1400,         // quads kept, both wheels
  MARK_MIN_SLIDE: 0.9,        // rear slide (as a share of the peak) before a mark is laid
  MARK_SPACING: 0.35,         // m between quads
  SMOKE_MAX:    120,
  SMOKE_LIFE:   1.1,          // s
  SMOKE_SIZE:   0.45,         // m at birth
  SMOKE_GROW:   1.3,          // m per second
  SMOKE_RISE:   1.4,          // m per second
  SMOKE_RATE:   22,           // puffs per second per wheel at a full slide
  SMOKE:        0x8e8a9a,
  LOW_TIER_CORES: 4,
  TIERS: { low: { pixelRatio: 1.0, smoke: 40 }, high: { pixelRatio: 2.0, smoke: 120 } },
};

export function createScene(canvas, opts) {
  const options = opts || {};
  const forceWebGL = options.renderer === 'webgl2';
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL, alpha: false, powerPreference: 'high-performance' });
  let backend = 'pending', tier = 'low';
  const view = { w: 1, h: 1 };
  const ready = renderer.init().then(() => {
    backend = renderer.backend && renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 0;
    tier = options.tier || ((backend === 'webgl2' || (cores > 0 && cores <= LOOK.LOW_TIER_CORES)) ? 'low' : 'high');
    applyTier();
  });
  function applyTier() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOOK.TIERS[tier].pixelRatio));
    renderer.setSize(view.w, view.h, false);
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LOOK.SKY);
  scene.fog = new THREE.Fog(LOOK.FOG, LOOK.FOG_NEAR, LOOK.FOG_FAR);
  const camera = new THREE.PerspectiveCamera(TUNE.CAMERA.FOV, 1, TUNE.CAMERA.NEAR, TUNE.CAMERA.FAR);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(LOOK.HEMI_SKY, LOOK.HEMI_GROUND, LOOK.HEMI));
  const sun = new THREE.DirectionalLight(0xfff0dd, LOOK.SUN);
  sun.position.set(...LOOK.SUN_DIR);
  scene.add(sun);

  /* ---- the ground ---- */
  let groundGroup = null, cones = null;
  function setGround(ground) {
    if (groundGroup) { scene.remove(groundGroup); groundGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    groundGroup = new THREE.Group();
    const b = ground.bounds;
    const pad = 400;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2), new THREE.MeshLambertMaterial({ color: LOOK.GROUND }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set((b.minX + b.maxX) / 2, -0.02, (b.minZ + b.maxZ) / 2);
    groundGroup.add(plane);
    if (ground.centre.length) {
      /* the road, edges, kerbs, run-off, lines, barriers and clip posts
         come from the track generator's mesh builder; the gantries are ours */
      groundGroup.add(buildTrackMesh(ground, THREE));
      const C = ground.centre, n = C.length;
      const at = m => C[Math.max(0, Math.min(n - 1, Math.round(m / 2)))];
      groundGroup.add(gantry(at(ground.startLine === undefined ? 8 : ground.startLine), LOOK.GANTRY_BEAM));
      if (ground.finish) groundGroup.add(gantry(at(ground.finish.along), LOOK.FINISH_BEAM));
    } else {
      // the car park: a lighter slab inside the walls
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX, b.maxZ - b.minZ), new THREE.MeshLambertMaterial({ color: LOOK.ROAD }));
      slab.rotation.x = -Math.PI / 2;
      slab.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
      groundGroup.add(slab);
    }
    // the car park's walls (a track's come with its mesh)
    if (!ground.centre.length) {
    const wallGeo = { plain: [], tyres: [], clip: [] };
    for (const wall of ground.walls) {
      const p = wall.points;
      for (let i = 0; i + 1 < p.length; i++) {
        const sAlong = i * 2;
        const inClip = ground.clips.some(c => c.side === wall.side && sAlong >= c.from && sAlong <= c.to);
        const list = inClip ? wallGeo.clip : wall.kind === 'tyres' ? wallGeo.tyres : wallGeo.plain;
        const dx = p[i + 1].x - p[i].x, dz = p[i + 1].z - p[i].z, len = Math.hypot(dx, dz);
        if (len < 1e-6) continue;
        const nx = -dz / len, nz = dx / len;       // a side normal, either way
        const h = LOOK.WALL_HEIGHT, t = 0.25;
        const q = [
          [p[i].x + nx * t, 0, p[i].z + nz * t], [p[i + 1].x + nx * t, 0, p[i + 1].z + nz * t], [p[i + 1].x + nx * t, h, p[i + 1].z + nz * t], [p[i].x + nx * t, h, p[i].z + nz * t],
          [p[i].x - nx * t, 0, p[i].z - nz * t], [p[i + 1].x - nx * t, 0, p[i + 1].z - nz * t], [p[i + 1].x - nx * t, h, p[i + 1].z - nz * t], [p[i].x - nx * t, h, p[i].z - nz * t],
        ];
        // two faces and a top
        list.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
        list.push(...q[5], ...q[4], ...q[7], ...q[5], ...q[7], ...q[6]);
        list.push(...q[3], ...q[2], ...q[6], ...q[3], ...q[6], ...q[7]);
      }
    }
    const wallMesh = (list, colour) => { if (!list.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list, 3)); g.computeVertexNormals(); groundGroup.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: colour, side: THREE.DoubleSide }))); };
    wallMesh(wallGeo.plain, LOOK.WALL); wallMesh(wallGeo.tyres, LOOK.WALL_TYRES); wallMesh(wallGeo.clip, LOOK.WALL_CLIP);
    }
    scene.add(groundGroup);
    // cones
    if (cones) { scene.remove(cones); cones.geometry.dispose(); cones = null; }
    if (ground.cones.length) {
      cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 0.75, 8), new THREE.MeshLambertMaterial({ color: LOOK.CONE }), ground.cones.length);
      cones.frustumCulled = false;
      scene.add(cones);
    }
    clearMarks();
  }

  /* Two posts and a beam over the road at a sample. */
  function gantry(s, beamColour) {
    const g = new THREE.Group();
    const lx = -Math.cos(s.heading), lz = Math.sin(s.heading);
    const reach = s.width / 2 + 1.2, h = LOOK.GANTRY_H, p = LOOK.GANTRY_POST;
    const postMat = new THREE.MeshLambertMaterial({ color: LOOK.GANTRY });
    for (const side of [1, -1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(p, h, p), postMat); post.position.set(s.x + lx * reach * side, h / 2, s.z + lz * reach * side); g.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(reach * 2 + p, 0.6, p), new THREE.MeshLambertMaterial({ color: beamColour }));
    /* the box runs along x; rotated by the heading about y its x axis is
       (cos h, -sin h), which is the track's left vector (-cos h, sin h) reversed */
    beam.position.set(s.x, h - 0.3, s.z); beam.rotation.y = s.heading;
    g.add(beam);
    return g;
  }
  /* ---- the car, and the ghost ---- */
  const car = new THREE.Group();        // the physics origin: the centre of mass
  scene.add(car);
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
    m.group.position.z = V.WHEELBASE / 2 - V.CG_TO_FRONT;
    root.add(m.group);
    return { model: m, bRear: V.WHEELBASE - V.CG_TO_FRONT, half: V.TRACK / 2 };
  }
  function setCar(id, paintId) {
    if (model) { car.remove(model.group); model.dispose(); }
    const r = mount(car, id, paintById(paintId || carById(id).paint).hex, false);
    model = r.model; rig.bRear = r.bRear; rig.half = r.half;
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
  const markGeo = new THREE.BufferGeometry();
  const markPos = new Float32Array(LOOK.MARK_MAX * 6 * 3);
  const markAlpha = new Float32Array(LOOK.MARK_MAX * 6);
  markGeo.setAttribute('position', new THREE.BufferAttribute(markPos, 3));
  markGeo.setAttribute('alpha', new THREE.BufferAttribute(markAlpha, 1));
  // double sided: a quad's winding follows the direction of travel, and a car slides either way
  const markMat = new THREE.MeshBasicMaterial({ color: LOOK.MARK, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
  const marks = new THREE.Mesh(markGeo, markMat);
  marks.frustumCulled = false;
  marks.position.y = 0.02;
  scene.add(marks);
  let markHead = 0, markCount = 0;
  const lastMark = { rl: null, rr: null };
  function clearMarks() { markPos.fill(0); markHead = 0; markCount = 0; lastMark.rl = null; lastMark.rr = null; markGeo.attributes.position.needsUpdate = true; markGeo.setDrawRange(0, 0); }
  function layMark(name, x, z, hx, hz) {
    // hx, hz: the half width vector across the mark
    const prev = lastMark[name];
    lastMark[name] = { x, z, hx, hz };
    if (!prev) return;
    if (Math.hypot(x - prev.x, z - prev.z) < LOOK.MARK_SPACING * 0.5) { lastMark[name] = prev; return; }
    const o = markHead * 18;
    const q = [prev.x - prev.hx, prev.z - prev.hz, prev.x + prev.hx, prev.z + prev.hz, x + hx, z + hz, x - hx, z - hz];
    const tri = [0, 1, 2, 0, 2, 3];
    for (let i = 0; i < 6; i++) { markPos[o + i * 3] = q[tri[i] * 2]; markPos[o + i * 3 + 1] = 0; markPos[o + i * 3 + 2] = q[tri[i] * 2 + 1]; }
    markHead = (markHead + 1) % LOOK.MARK_MAX;
    if (markCount < LOOK.MARK_MAX) markCount++;
    markGeo.attributes.position.needsUpdate = true;
    markGeo.setDrawRange(0, markCount * 6);
  }

  /* ---- smoke: billboards off the rear wheels ---- */
  const smokeN = LOOK.SMOKE_MAX;
  const smoke = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 10), new THREE.MeshBasicMaterial({ color: LOOK.SMOKE, transparent: true, opacity: 0.2, depthWrite: false }), smokeN);
  smoke.frustumCulled = false;
  scene.add(smoke);
  const puffs = new Array(smokeN).fill(null).map(() => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0, size: 0 }));
  let puffHead = 0, smokeDue = { rl: 0, rr: 0 };
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  function puff(x, z, vx, vz) {
    const p = puffs[puffHead]; puffHead = (puffHead + 1) % Math.min(smokeN, LOOK.TIERS[tier].smoke);
    p.life = LOOK.SMOKE_LIFE; p.x = x; p.y = 0.25; p.z = z; p.vx = vx * 0.25; p.vz = vz * 0.25; p.size = LOOK.SMOKE_SIZE;
  }
  function updateSmoke(dt) {
    const hide = new THREE.Vector3(0, -100, 0);
    for (let i = 0; i < smokeN; i++) {
      const p = puffs[i];
      if (p.life <= 0) { m4.makeTranslation(hide.x, hide.y, hide.z); smoke.setMatrixAt(i, m4); continue; }
      p.life -= dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += LOOK.SMOKE_RISE * dt; p.size += LOOK.SMOKE_GROW * dt;
      const k = Math.max(0, p.life / LOOK.SMOKE_LIFE);
      v3.set(p.x, p.y, p.z); s3.set(p.size * k, p.size * k, 1); q4.copy(camera.quaternion);
      m4.compose(v3, q4, s3);
      smoke.setMatrixAt(i, m4);
    }
    smoke.instanceMatrix.needsUpdate = true;
  }

  /* ---- per frame ---- */
  const coneM = new THREE.Matrix4(), coneQ = new THREE.Quaternion(), coneE = new THREE.Euler(), coneS = new THREE.Vector3(1, 1, 1);
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
    // marks and smoke off the rear wheels while they slide
    const sliding = c.rearSlide >= LOOK.MARK_MIN_SLIDE || c.hb > 0.5 || c.spinning;
    const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw), lz = Math.sin(pose.yaw);
    const bRear = rig.bRear, half = rig.half;
    for (const [name, side] of [['rl', 1], ['rr', -1]]) {
      const wx = pose.x - fx * bRear + lx * half * side, wz = pose.z - fz * bRear + lz * half * side;
      if (sliding && c.speed > 1.5) {
        layMark(name, wx, wz, lx * LOOK.MARK_WIDTH * 0.5, lz * LOOK.MARK_WIDTH * 0.5);
        const strength = Math.min(1, Math.max(c.rearSlide / 2, c.hb, c.spinning ? 0.6 : 0));
        smokeDue[name] += dt * LOOK.SMOKE_RATE * strength;
        while (smokeDue[name] >= 1) { smokeDue[name] -= 1; puff(wx, wz, c.wvx, c.wvz); }
      } else { lastMark[name] = null; smokeDue[name] = 0; }
    }
    updateSmoke(dt);
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
  let lastSubmit = 0;
  function render() { const t0 = performance.now(); renderer.render(scene, camera); lastSubmit = performance.now() - t0; }
  return {
    THREE, renderer, scene, camera, car, ready, setGround, setCar, setGhost, update, resize, render, clearMarks,
    carModel: () => model,
    info: () => ({ backend, tier, submitMs: lastSubmit }),
    setTier: t => { if (LOOK.TIERS[t]) { tier = t; applyTier(); } },
  };
}
