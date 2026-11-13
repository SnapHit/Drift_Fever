/* PARTICLES: one pool of camera facing quads per effect, built on the
   CPU every frame (a few hundred quads at most), with a per vertex
   alpha the node material reads, so every puff fades on its own. Used
   for tyre smoke, dust off the asphalt, sparks on a wall, the exhaust
   flame while boosting, and rain. One draw call per pool.

   The spectacle round adds, only when a pool asks for them: a colour
   per particle that blends from its birth colour to its end colour over
   its life (o.tint: smoke lit red by the tail-lights that turns to the
   scene's smoke colour as it drifts away), growth that slows as a puff
   ages (s.growDecay), and a clearance (update's clear argument) that
   thins any particle standing between the camera and the car, so the
   car's own smoke never hides it. */

const WHITE = [1, 1, 1];

export function createParticles(THREE, opts) {
  const o = opts || {};
  const max = o.max || 100;
  const T = THREE.TSL;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 4 * 3), alpha = new Float32Array(max * 4), uv = new Float32Array(max * 4 * 2);
  const index = new Uint16Array(max * 6);
  for (let i = 0; i < max; i++) {
    uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const tintA = o.tint ? new Float32Array(max * 4 * 3).fill(1) : null;
  if (tintA) geo.setAttribute('tint', new THREE.BufferAttribute(tintA, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.setDrawRange(0, 0);
  const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: o.fog !== false, side: THREE.DoubleSide });
  const colour = T.uniform(new THREE.Color(o.colour === undefined ? 0xffffff : o.colour));
  const tex = T.texture(o.texture, T.uv());
  mat.colorNode = tintA ? colour.mul(tex.rgb).mul(T.attribute('tint', 'vec3')) : colour.mul(tex.rgb);
  mat.opacityNode = tex.a.mul(T.attribute('alpha', 'float')).mul(T.float(o.opacity === undefined ? 1 : o.opacity));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = o.renderOrder === undefined ? 3 : o.renderOrder;
  mesh.name = o.name || 'particles';
  const P = new Array(max).fill(null).map(() => ({ life: 0, age: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, grow: 0, a: 1, g: 0, drag: 0, rot: 0, spin: 0, stretch: 0, gd: 0, c0: [1, 1, 1], c1: [1, 1, 1] }));
  let head = 0, live = 0, awake = false;   // awake: something was spawned since the pool last emptied, so an idle pool costs nothing per frame
  const right = new THREE.Vector3(), up = new THREE.Vector3(), tmp = new THREE.Vector3();

  function spawn(s) {
    const p = P[head]; head = (head + 1) % max;
    p.life = s.life; p.age = 0; p.x = s.x; p.y = s.y; p.z = s.z; p.vx = s.vx || 0; p.vy = s.vy || 0; p.vz = s.vz || 0;
    p.size = s.size; p.grow = s.grow || 0; p.a = s.alpha === undefined ? 1 : s.alpha; p.g = s.gravity || 0; p.drag = s.drag || 0;
    p.rot = s.rot || 0; p.spin = s.spin || 0; p.stretch = s.stretch || 0; p.gd = s.growDecay || 0;
    awake = true;
    if (tintA) { const a = s.c0 || WHITE, b = s.c1 || a; p.c0[0] = a[0]; p.c0[1] = a[1]; p.c0[2] = a[2]; p.c1[0] = b[0]; p.c1[1] = b[1]; p.c1[2] = b[2]; }
  }
  /* fade: in quickly, out over the second half */
  const fade = t => t < 0.12 ? t / 0.12 : t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1;
  /* clear: null, or { x, y, z, r, keep, near, far }: the car's centre
     and radius in metres, the share of a particle's alpha kept where it
     covers the car on the screen, and the distances from the camera over
     which particles fade in */
  function update(dt, camera, wind, clear) {
    if (!awake) return;
    camera.matrixWorld.extractBasis(right, up, tmp);
    const wx = wind ? wind.x : 0, wz = wind ? wind.z : 0;
    const cp = camera.position;
    let cdx = 0, cdy = 0, cdz = 0, cdl = 1;
    if (clear) { cdx = clear.x - cp.x; cdy = clear.y - cp.y; cdz = clear.z - cp.z; cdl = Math.hypot(cdx, cdy, cdz) || 1; cdx /= cdl; cdy /= cdl; cdz /= cdl; }
    let n = 0;
    for (let i = 0; i < max; i++) {
      const p = P[i];
      if (p.age >= p.life) continue;
      p.age += dt;
      if (p.age >= p.life) continue;
      const k = p.drag > 0 ? Math.exp(-p.drag * dt) : 1;
      p.vx = (p.vx - wx) * k + wx; p.vz = (p.vz - wz) * k + wz; p.vy = p.vy * k - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.size += p.grow * dt; p.rot += p.spin * dt;
      if (p.gd > 0) p.grow *= Math.exp(-p.gd * dt);
      const t = p.age / p.life;
      let a = p.a * fade(t);
      if (clear) {
        /* how far along the camera's line to the car the particle is, and how far off it */
        const qx = p.x - cp.x, qy = p.y - cp.y, qz = p.z - cp.z;
        const along = qx * cdx + qy * cdy + qz * cdz;
        const near = Math.max(0, Math.min(1, (along - clear.near) / Math.max(0.01, clear.far - clear.near)));
        a *= near * near * (3 - 2 * near);
        if (along > 0.1 && along < cdl + clear.r) {
          /* on the screen: how far the particle's nearest edge stands from the car's middle, against the car's own size there (angles, so a puff near the camera is judged by what it covers) */
          const ox = qx - cdx * along, oy = qy - cdy * along, oz = qz - cdz * along;
          const q = ((Math.hypot(ox, oy, oz) - p.size * 0.5) / along) / (clear.r / cdl);   // a puff is dense in its middle half
          const k = Math.max(0, Math.min(1, (q - 0.85) / 0.45));   // over the car: 0; just clear of it: 1
          a *= clear.keep + (1 - clear.keep) * k * k * (3 - 2 * k);
        }
      }
      const s = p.size, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
      // a stretched particle (rain, sparks) lies along its velocity instead of the camera's up
      let rx = right.x, ry = right.y, rz = right.z, ux = up.x, uy = up.y, uz = up.z;
      if (p.stretch > 0) {
        const vl = Math.hypot(p.vx, p.vy, p.vz) || 1;
        ux = p.vx / vl * p.stretch; uy = p.vy / vl * p.stretch; uz = p.vz / vl * p.stretch;
        // right: perpendicular to the velocity and the view direction
        const vx = tmp.x, vy = tmp.y, vz = tmp.z;
        rx = uy * vz - uz * vy; ry = uz * vx - ux * vz; rz = ux * vy - uy * vx;
        const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
      }
      const ax = (rx * cr + ux * sr) * s, ay = (ry * cr + uy * sr) * s, az = (rz * cr + uz * sr) * s;
      const bx = (-rx * sr + ux * cr) * s * (p.stretch > 0 ? 1 : 1), by = (-ry * sr + uy * cr) * s, bz = (-rz * sr + uz * cr) * s;
      const o = n * 12;
      pos[o] = p.x - ax - bx; pos[o + 1] = p.y - ay - by; pos[o + 2] = p.z - az - bz;
      pos[o + 3] = p.x + ax - bx; pos[o + 4] = p.y + ay - by; pos[o + 5] = p.z + az - bz;
      pos[o + 6] = p.x + ax + bx; pos[o + 7] = p.y + ay + by; pos[o + 8] = p.z + az + bz;
      pos[o + 9] = p.x - ax + bx; pos[o + 10] = p.y - ay + by; pos[o + 11] = p.z - az + bz;
      alpha[n * 4] = a; alpha[n * 4 + 1] = a; alpha[n * 4 + 2] = a; alpha[n * 4 + 3] = a;
      if (tintA) { const r = p.c0[0] + (p.c1[0] - p.c0[0]) * t, g = p.c0[1] + (p.c1[1] - p.c0[1]) * t, b = p.c0[2] + (p.c1[2] - p.c0[2]) * t; for (let k = 0; k < 4; k++) { tintA[n * 12 + k * 3] = r; tintA[n * 12 + k * 3 + 1] = g; tintA[n * 12 + k * 3 + 2] = b; } }
      n++;
    }
    live = n;
    if (!n) awake = false;
    geo.setDrawRange(0, n * 6);
    if (n) { geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true; if (tintA) geo.attributes.tint.needsUpdate = true; }
    mesh.visible = n > 0;
  }
  function clear() { for (const p of P) { p.age = p.life; } geo.setDrawRange(0, 0); mesh.visible = false; live = 0; head = 0; }   // from the first slot again, so the same run draws its puffs in the same order (the garage probes compare two runs to the pixel)
  return { mesh, spawn, update, clear, setColour: hex => colour.value.setHex(hex), live: () => live, max, dispose: () => { geo.dispose(); mat.dispose(); } };
}

/* GLOWS: camera facing quads placed afresh every frame (a lamp's flare,
   a tail-light's halo, a camera flash in the crowd, the lit reflection
   of a light on a wet road), each with its own colour and alpha, one
   draw call for the lot. begin(), add() as many as fit, end(camera).
   A glow with a stretch lies flat on the road and reaches towards the
   camera instead (a wet road's reflection). */
export function createGlows(THREE, opts) {
  const o = opts || {};
  const max = o.max || 64;
  const T = THREE.TSL;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 4 * 3), col = new Float32Array(max * 4 * 4), uv = new Float32Array(max * 4 * 2);
  const index = new Uint16Array(max * 6);
  for (let i = 0; i < max; i++) { uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('glow', new THREE.BufferAttribute(col, 4));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.setDrawRange(0, 0);
  const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: o.fog !== false, side: THREE.DoubleSide, toneMapped: o.toneMapped !== false });
  const tex = T.texture(o.texture, T.uv());
  const g = T.attribute('glow', 'vec4');
  mat.colorNode = tex.rgb.mul(g.xyz);
  mat.opacityNode = tex.a.mul(g.w);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = o.renderOrder === undefined ? 5 : o.renderOrder;
  mesh.name = o.name || 'glows';
  if (o.depthTest === false) mat.depthTest = false;
  let n = 0;
  const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
  let cam = null;
  function begin(camera) { n = 0; cam = camera; camera.matrixWorld.extractBasis(right, up, fwd); }
  /* size: half width, m; r, g, b may exceed 1 for the bloom; flat: 0, or the half length of a reflection on the road */
  function add(x, y, z, size, r, gg, b, a, flat) {
    if (n >= max || a <= 0.002) return false;
    const o3 = n * 12;
    let ax, ay, az, bx, by, bz;
    if (flat) {
      /* on the road, from the light's foot towards the camera */
      let dx = cam.position.x - x, dz = cam.position.z - z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      ax = -dz * size; ay = 0; az = dx * size;
      bx = dx * flat; by = 0; bz = dz * flat;
      x += bx; z += bz;
    } else { ax = right.x * size; ay = right.y * size; az = right.z * size; bx = up.x * size; by = up.y * size; bz = up.z * size; }
    pos[o3] = x - ax - bx; pos[o3 + 1] = y - ay - by; pos[o3 + 2] = z - az - bz;
    pos[o3 + 3] = x + ax - bx; pos[o3 + 4] = y + ay - by; pos[o3 + 5] = z + az - bz;
    pos[o3 + 6] = x + ax + bx; pos[o3 + 7] = y + ay + by; pos[o3 + 8] = z + az + bz;
    pos[o3 + 9] = x - ax + bx; pos[o3 + 10] = y - ay + by; pos[o3 + 11] = z - az + bz;
    for (let k = 0; k < 4; k++) { col[n * 16 + k * 4] = r; col[n * 16 + k * 4 + 1] = gg; col[n * 16 + k * 4 + 2] = b; col[n * 16 + k * 4 + 3] = a; }
    n++;
    return true;
  }
  function end() {
    geo.setDrawRange(0, n * 6);
    if (n) { geo.attributes.position.needsUpdate = true; geo.attributes.glow.needsUpdate = true; }
    mesh.visible = n > 0;
  }
  return { mesh, begin, add, end, count: () => n, max, dispose: () => { geo.dispose(); mat.dispose(); } };
}
