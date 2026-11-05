/* PARTICLES: one pool of camera facing quads per effect, built on the
   CPU every frame (a few hundred quads at most), with a per vertex
   alpha the node material reads, so every puff fades on its own. Used
   for tyre smoke, dust off the asphalt, sparks on a wall, the exhaust
   flame while boosting, and rain. One draw call per pool. */

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
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.setDrawRange(0, 0);
  const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: o.fog !== false, side: THREE.DoubleSide });
  const colour = T.uniform(new THREE.Color(o.colour === undefined ? 0xffffff : o.colour));
  const tex = T.texture(o.texture, T.uv());
  mat.colorNode = colour.mul(tex.rgb);
  mat.opacityNode = tex.a.mul(T.attribute('alpha', 'float')).mul(T.float(o.opacity === undefined ? 1 : o.opacity));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = o.renderOrder === undefined ? 3 : o.renderOrder;
  mesh.name = o.name || 'particles';
  const P = new Array(max).fill(null).map(() => ({ life: 0, age: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, grow: 0, a: 1, g: 0, drag: 0, rot: 0, spin: 0, stretch: 0 }));
  let head = 0, live = 0;
  const right = new THREE.Vector3(), up = new THREE.Vector3(), tmp = new THREE.Vector3();

  function spawn(s) {
    const p = P[head]; head = (head + 1) % max;
    p.life = s.life; p.age = 0; p.x = s.x; p.y = s.y; p.z = s.z; p.vx = s.vx || 0; p.vy = s.vy || 0; p.vz = s.vz || 0;
    p.size = s.size; p.grow = s.grow || 0; p.a = s.alpha === undefined ? 1 : s.alpha; p.g = s.gravity || 0; p.drag = s.drag || 0;
    p.rot = s.rot || 0; p.spin = s.spin || 0; p.stretch = s.stretch || 0;
  }
  /* fade: in quickly, out over the second half */
  const fade = t => t < 0.12 ? t / 0.12 : t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1;
  function update(dt, camera, wind) {
    camera.matrixWorld.extractBasis(right, up, tmp);
    const wx = wind ? wind.x : 0, wz = wind ? wind.z : 0;
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
      const t = p.age / p.life, a = p.a * fade(t);
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
      n++;
    }
    live = n;
    geo.setDrawRange(0, n * 6);
    if (n) { geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true; }
    mesh.visible = n > 0;
  }
  function clear() { for (const p of P) { p.age = p.life; } geo.setDrawRange(0, 0); mesh.visible = false; live = 0; }
  return { mesh, spawn, update, clear, setColour: hex => colour.value.setHex(hex), live: () => live, max, dispose: () => { geo.dispose(); mat.dispose(); } };
}
