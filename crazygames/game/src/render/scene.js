/* THE SCENE. Plain shapes in real 3D: the ground, the road with bright
   edges, the walls, the clipping zone markers, the cones, the car as a
   body, a cabin, four wheels and lights, and the tyre marks the rear
   wheels lay while they slide. three.js WebGPURenderer, with the WebGL 2
   fallback forced by ?renderer=webgl2. No textures, no shadows, a
   hemisphere light and a sun, fog to the horizon. Every number of taste
   lives in LOOK at the top. */
import * as THREE from 'three';
import { TUNE } from '../tune.js';

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
      groundGroup.add(ribbon(ground.centre, true, c => c.width / 2, c => -c.width / 2, LOOK.ROAD, 0));
      groundGroup.add(ribbon(ground.centre, true, c => c.width / 2 + LOOK.EDGE_WIDTH, c => c.width / 2 - LOOK.EDGE_WIDTH, LOOK.EDGE, 0.01));
      groundGroup.add(ribbon(ground.centre, true, c => -(c.width / 2 - LOOK.EDGE_WIDTH), c => -(c.width / 2 + LOOK.EDGE_WIDTH), LOOK.EDGE, 0.01));
      // the start line, a few samples past the car's start
      const s = ground.centre[Math.min(ground.centre.length - 1, 4)];
      const line = new THREE.Mesh(new THREE.PlaneGeometry(s.width, 1.0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      line.rotation.x = -Math.PI / 2; line.rotation.z = -s.heading;
      line.position.set(s.x, 0.015, s.z);
      groundGroup.add(line);
    } else {
      // the car park: a lighter slab inside the walls
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX, b.maxZ - b.minZ), new THREE.MeshLambertMaterial({ color: LOOK.ROAD }));
      slab.rotation.x = -Math.PI / 2;
      slab.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
      groundGroup.add(slab);
    }
    // walls, one mesh per kind, clip spans in their own colour
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

  /* A ribbon along the centre line between two lateral offsets, both
     measured to the left (so the right edge of the road is negative),
     closed or not. */
  function ribbon(centre, closed, offA, offB, colour, lift) {
    const n = centre.length, pos = [];
    const count = closed ? n : n - 1;
    for (let i = 0; i < count; i++) {
      const a = centre[i], b = centre[(i + 1) % n];
      const al = [-Math.cos(a.heading), Math.sin(a.heading)], bl = [-Math.cos(b.heading), Math.sin(b.heading)];
      const aL = [a.x + al[0] * offA(a), a.z + al[1] * offA(a)], aR = [a.x + al[0] * offB(a), a.z + al[1] * offB(a)];
      const bL = [b.x + bl[0] * offA(b), b.z + bl[1] * offA(b)], bR = [b.x + bl[0] * offB(b), b.z + bl[1] * offB(b)];
      // counter clockwise seen from above, so the faces point up
      pos.push(aL[0], lift, aL[1], aR[0], lift, aR[1], bL[0], lift, bL[1], bL[0], lift, bL[1], aR[0], lift, aR[1], bR[0], lift, bR[1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const norm = new Float32Array(pos.length); for (let i = 1; i < norm.length; i += 3) norm[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: colour }));
    m.frustumCulled = false;
    return m;
  }

  /* ---- the car ---- */
  const V = TUNE.VEHICLE;
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: LOOK.CAR });
  const darkMat = new THREE.MeshLambertMaterial({ color: LOOK.CAR_DARK });
  const bodyL = V.HALF_LENGTH * 2, bodyW = V.TRACK - 0.12;    // narrower than the track so the wheels show
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, 0.5, bodyL), bodyMat);
  body.position.y = V.WHEEL_RADIUS + 0.17;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.78, 0.5, bodyL * 0.42), darkMat);
  cabin.position.set(0, V.WHEEL_RADIUS + 0.17 + 0.48, bodyL * 0.04);
  car.add(cabin);
  const lampF = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.9, 0.12, 0.08), new THREE.MeshBasicMaterial({ color: LOOK.LAMP_FRONT }));
  lampF.position.set(0, V.WHEEL_RADIUS + 0.3, -bodyL / 2 + 0.02);
  car.add(lampF);
  const lampR = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.9, 0.12, 0.08), new THREE.MeshBasicMaterial({ color: LOOK.LAMP_REAR }));
  lampR.position.set(0, V.WHEEL_RADIUS + 0.3, bodyL / 2 - 0.02);
  car.add(lampR);
  const wheelGeo = new THREE.CylinderGeometry(V.WHEEL_RADIUS, V.WHEEL_RADIUS, 0.28, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: LOOK.WHEEL });
  const wheels = {};
  const a = V.CG_TO_FRONT, bRear = V.WHEELBASE - a, half = V.TRACK / 2;
  for (const [name, x, z] of [['fl', -half, -a], ['fr', half, -a], ['rl', -half, bRear], ['rr', half, bRear]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, V.WHEEL_RADIUS, z);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    pivot.add(w);
    car.add(pivot);
    wheels[name] = { pivot, mesh: w };
  }
  scene.add(car);

  /* ---- tyre marks: a ring of quads under the rear wheels ---- */
  const markGeo = new THREE.BufferGeometry();
  const markPos = new Float32Array(LOOK.MARK_MAX * 6 * 3);
  const markAlpha = new Float32Array(LOOK.MARK_MAX * 6);
  markGeo.setAttribute('position', new THREE.BufferAttribute(markPos, 3));
  markGeo.setAttribute('alpha', new THREE.BufferAttribute(markAlpha, 1));
  const markMat = new THREE.MeshBasicMaterial({ color: LOOK.MARK, transparent: true, opacity: 0.75, depthWrite: false });
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
  function update(pose, world, dt) {
    /* pose: the interpolated car {x, z, yaw}; world.car for the rest */
    const c = world.car;
    car.position.set(pose.x, 0, pose.z);
    car.rotation.y = pose.yaw;
    wheels.fl.pivot.rotation.y = c.steer; wheels.fr.pivot.rotation.y = c.steer;
    wheels.fl.mesh.rotation.x = c.wheelF; wheels.fr.mesh.rotation.x = c.wheelF;
    wheels.rl.mesh.rotation.x = c.wheelR; wheels.rr.mesh.rotation.x = c.wheelR;
    // marks and smoke off the rear wheels while they slide
    const sliding = c.rearSlide >= LOOK.MARK_MIN_SLIDE || c.hb > 0.5 || c.spinning;
    const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw), lz = Math.sin(pose.yaw);
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
    THREE, renderer, scene, camera, car, ready, setGround, update, resize, render, clearMarks,
    info: () => ({ backend, tier, submitMs: lastSubmit }),
    setTier: t => { if (LOOK.TIERS[t]) { tier = t; applyTier(); } },
  };
}
