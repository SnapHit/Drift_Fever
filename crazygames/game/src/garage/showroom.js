/* THE SHOWROOM (briefs/GARAGE.md 1). In the garage the picked car
   stands in a lit space of its own and turns slowly, drawn by the
   game's renderer at the game's quality: a small scene beside the
   game's (a dark floor that shows the car in it, a turntable, a wall of
   light bars, three lights), drawn into the game's canvas while the
   garage is open and never otherwise.

   The car is the game's own model with what it will race in: its paint,
   its wheels, its glow under it and, on the smoke section, its smoke
   off the rear tyres. show() takes the car, a paint and a look, which
   may be a preview of things not bought; nothing here reads or writes
   the save.

   The garage's controls sit beside or under the car, never over it: the
   screen marks a rectangle of the page as the stage (ui/screens.js) and
   frame() stands the camera so the car, through a whole turn, fits
   inside it, by moving the picture's centre to the stage's and choosing
   the distance. carRect() is that fit measured, for the probes.

   A drag across the stage turns the car by hand; left alone for RESUME
   seconds it turns itself again. Every number is in SHOWROOM. */
import { makeCar } from '../render/car.js';
import { createParticles } from '../env/particles.js';
import { puffSprite, softSprite } from '../env/textures.js';
import { smokeColours, SHOW } from '../env/show.js';
import { lookOf, glowHex, smokeHex } from './cosmetics.js';

export const SHOWROOM = {
  BACK:       0x090b16,      // the dark the floor fades into
  FOG:        [15, 34],      // m, where the fade starts and ends
  FLOOR:      0x1a1f33,      // the floor, a little see through so the car shows in it
  FLOOR_OPACITY: 0.8,
  FLOOR_ROUGH: 0.5,
  TABLE_R:    3.25,          // m, the turntable
  TABLE:      0x232a45,
  RING:       0xef5a17,      // the turntable's edge, the brand's orange
  RING_W:     0.06,          // m
  TICKS:      24,            // marks round the turntable, so its turning reads
  BARS:       { n: 9, colour: 0x9fc0ff, dim: 0.42, r: 12, h: 6.5, w: 0.16, arc: 2.0, y: 0.3 },   // the wall of light behind
  WALL:       { r: 15, arc: 2.6, rows: [[0, 0x141a36], [1.4, 0x2a3566], [4.2, 0x141a36], [10, 0x090b16]], steps: 24 },   // the curved wall behind the bars: heights (m) and its colour at each, a band of light at the car's height that the car stands out against
  SKY: 0xdfe7ff, GROUND: 0x20243a, HEMI: 0.9,
  KEY: 1.7, KEY_AT: [-5, 7, 6],      // the key light, in front of the car as the camera sees it, left and high
  RIM: 1.5, RIM_AT: [6, 4, -7],      // from behind, for the roof line
  FILL: 0.45, FILL_AT: [5, 2, 6],
  EXPOSURE:   1.0,
  DISTANCE:   11.5,          // m the camera stands from the car; the field of view is what fits the car's turning circle into the stage from there
  ELEVATION:  11,            // degrees the camera looks down
  LOOK_Y:     0.52,          // m, the height the camera looks at
  PAD:        1.07,          // room round the car's turning circle in the stage
  SPIN:       0.42,          // radians per second, left alone
  START:      Math.PI * 0.82, // the angle the car is first shown at: three quarters from the front
  DRAG:       0.011,         // radians per px dragged
  RESUME:     2.2,           // s after a drag before it turns itself again
  EASE:       2.5,           // per second, how the spin comes back
  GLOW:       0.8,           // the underglow's share in the showroom
  SHADOW:     { size: 3.4, opacity: 0.55 },   // the soft shadow under the car
  STEER:      0.32,          // radians the front wheels are turned, so their faces show
  SMOKE:      { pool: 70, rate: 11, life: 1.7, size: 0.32, grow: 0.85, rise: 0.75, alpha: 0.5, spin: 9, preset: 'dusk', drift: 0.5 },   // the smoke section's show
};

export function createShowroom(THREE, renderer) {
  const S = SHOWROOM;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(S.BACK);
  scene.fog = new THREE.Fog(S.BACK, S.FOG[0], S.FOG[1]);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 90);
  const hemi = new THREE.HemisphereLight(S.SKY, S.GROUND, S.HEMI);
  scene.add(hemi);
  /* each light, and its twin under the floor, which lights the car's
     picture in it. The car itself is given the lights above by name (as
     the rival is given his beam in render/scene.js), so the twins under
     the floor never light it from below. */
  const above = [hemi];
  for (const [k, at] of [[S.KEY, S.KEY_AT], [S.RIM, S.RIM_AT], [S.FILL, S.FILL_AT]]) {
    const l = new THREE.DirectionalLight(0xffffff, k); l.position.set(at[0], at[1], at[2]); scene.add(l); above.push(l);
    const u = new THREE.DirectionalLight(0xffffff, k); u.position.set(at[0], -at[1], at[2]); scene.add(u);
  }
  const aboveLit = THREE.TSL.lights(above);
  /* the floor: see through, drawn after the car's picture under it */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: S.FLOOR, roughness: S.FLOOR_ROUGH, metalness: 0, transparent: true, opacity: S.FLOOR_OPACITY, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = 1;
  scene.add(floor);
  /* the turntable: a disc, a bright edge and marks, turning with the car */
  const table = new THREE.Group();
  scene.add(table);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(S.TABLE_R, 48), new THREE.MeshStandardMaterial({ color: S.TABLE, roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.004; disc.renderOrder = 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(S.TABLE_R - S.RING_W, S.TABLE_R, 64), new THREE.MeshBasicMaterial({ color: S.RING, transparent: true, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.008; ring.renderOrder = 3;
  table.add(disc, ring);
  const tickGeo = new THREE.PlaneGeometry(0.05, 0.3), tickMat = new THREE.MeshBasicMaterial({ color: 0x5a6590, transparent: true, depthWrite: false });
  for (let i = 0; i < S.TICKS; i++) {
    const a = 2 * Math.PI * i / S.TICKS, t = new THREE.Mesh(tickGeo, tickMat);
    t.rotation.set(-Math.PI / 2, 0, -a); t.position.set(Math.sin(a) * (S.TABLE_R - 0.3), 0.008, Math.cos(a) * (S.TABLE_R - 0.3)); t.renderOrder = 3;
    table.add(t);
  }
  /* the wall of light bars behind the car */
  const B = S.BARS, barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(B.colour).multiplyScalar(B.dim), fog: true });
  for (let i = 0; i < B.n; i++) {
    const a = (i / (B.n - 1) - 0.5) * B.arc, bar = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.h), barMat);
    bar.position.set(Math.sin(a) * B.r, B.y + B.h / 2, -Math.cos(a) * B.r); bar.rotation.y = -a;
    scene.add(bar);
  }
  /* the curved wall behind them, lit in a band at the car's height */
  {
    const Wl = S.WALL, pos = [], col = [], c = new THREE.Color();
    const at = (i, row) => { const a = (i / Wl.steps - 0.5) * Wl.arc; c.setHex(row[1]); return [Math.sin(a) * Wl.r, row[0], -Math.cos(a) * Wl.r, c.r, c.g, c.b]; };
    const put = v => { pos.push(v[0], v[1], v[2]); col.push(v[3], v[4], v[5]); };
    for (let i = 0; i < Wl.steps; i++) for (let r = 0; r + 1 < Wl.rows.length; r++) {
      const a = at(i, Wl.rows[r]), b = at(i + 1, Wl.rows[r]), d = at(i + 1, Wl.rows[r + 1]), e = at(i, Wl.rows[r + 1]);
      put(a); put(b); put(d); put(a); put(d); put(e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const wall = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    wall.renderOrder = -2;
    scene.add(wall);
  }
  /* the soft shadow under the car */
  const soft = softSprite(THREE, 64, false);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000, map: soft, transparent: true, opacity: S.SHADOW.opacity, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 4;
  table.add(shadow);
  /* the smoke section's smoke */
  const puff = puffSprite(THREE, 128);
  const smoke = createParticles(THREE, { max: S.SMOKE.pool, texture: puff, colour: 0xffffff, tint: true, name: 'showroom smoke', renderOrder: 6 });
  scene.add(smoke.mesh);

  const state = { car: null, paint: null, look: lookOf(null), angle: S.START, vel: S.SPIN, hold: 0, dragging: false, section: 'cars', stage: null, due: 0 };
  let model = null, twin = null;
  const upright = new THREE.Group(), under = new THREE.Group();
  under.scale.y = -1;
  table.add(upright, under);
  const c0 = [1, 1, 1], c1 = [1, 1, 1], tmpC = new THREE.Color();
  const lin = (hex, out) => { tmpC.setHex(hex); out[0] = tmpC.r; out[1] = tmpC.g; out[2] = tmpC.b; };

  /* the car sees only the lights above the floor */
  function relight() {
    if (!model) return;
    model.group.traverse(o => { if (!o.isMesh || !o.material) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.isMeshStandardMaterial || m.isMeshLambertMaterial) m.lightsNode = aboveLit; });
  }
  function dress() {
    const L = state.look, g = glowHex(L.glow);
    for (const m of [model, twin]) {
      if (!m) continue;
      if (m.setWheels && (m.wheelsId || 'standard') !== L.wheels) { m.setWheels(L.wheels); relight(); }
      if (m.setPaint) m.setPaint(state.paint);
      if (m.setUnderglow) m.setUnderglow(g, S.GLOW);
      m.wheels.fl.pivot.rotation.y = S.STEER; m.wheels.fr.pivot.rotation.y = S.STEER;
    }
    const c = smokeColours(S.SMOKE.preset, smokeHex(L.smoke));
    lin(c.birth, c0); lin(c.end, c1);
  }
  /* Show a car: its id, its paint (0xRRGGBB) and a look. The model is
     rebuilt only when the car changes. */
  function show(id, paintHex, look) {
    state.paint = paintHex; state.look = lookOf(look);
    if (id !== state.car) {
      for (const [m, root] of [[model, upright], [twin, under]]) if (m) { root.remove(m.group); m.dispose(); }
      model = makeCar(THREE, id, { paint: paintHex, wheels: state.look.wheels, glowForm: 'soft' });
      twin = makeCar(THREE, id, { paint: paintHex, wheels: state.look.wheels, glowForm: 'soft' });
      for (const m of [model, twin]) if (m.lights && m.lights.set) m.lights.set(1, 1);
      if (model.underglow) model.underglow.renderOrder = 5;   // over the floor and the turntable, which are see through and would dim it; the picture's glow stays under them
      relight();
      upright.add(model.group); under.add(twin.group);
      /* the body's middle over the turntable's, so it turns about itself */
      const cz = model.dims.centreZ || 0;
      model.group.position.z = -cz; twin.group.position.z = -cz;
      shadow.scale.set(model.dims.width + S.SHADOW.size * 0.45, model.dims.length + S.SHADOW.size * 0.35, 1);
      state.car = id;
      smoke.clear();
    }
    dress();
  }
  function setSection(name) { if (name !== state.section) { state.section = name; if (name !== 'smoke') { smoke.clear(); state.due = 0; for (const m of [model, twin]) if (m) { m.wheels.rl.mesh.rotation.x = 0; m.wheels.rr.mesh.rotation.x = 0; } } } }   // the burnout over: the smoke gone, the rear wheels at rest

  /* Stand the camera so the car fits the stage: rect { left, top, width,
     height } in CSS px of a view w by h. */
  function frame(rect, w, h) {
    if (!model || !rect || rect.width < 8 || rect.height < 8) return;
    state.stage = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, w, h };
    const d = model.dims, R = Math.hypot(d.length, d.width) / 2 * S.PAD, el = S.ELEVATION * Math.PI / 180, dist = S.DISTANCE;
    /* what the turning car spans as the camera sees it: its circle across, and up the screen the circle tilted by the elevation plus its height. The near side of the circle is nearer, so larger: it is measured from there */
    const across = 2 * R, up = 2 * R * Math.sin(el) + d.height * Math.cos(el) * S.PAD, near = dist - R;
    const tan = Math.max(across / (2 * near * rect.width / h), up / (2 * near * rect.height / h));
    camera.fov = 2 * Math.atan(tan) * 180 / Math.PI;
    camera.aspect = w / h;
    camera.position.set(0, S.LOOK_Y + Math.sin(el) * dist, Math.cos(el) * dist);
    camera.lookAt(0, S.LOOK_Y, 0);
    camera.setViewOffset(w, h, w / 2 - (rect.left + rect.width / 2), h / 2 - (rect.top + rect.height / 2), w, h);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function update(dt) {
    if (!model) return;
    if (!state.dragging) {
      if (state.hold > 0) { state.hold -= dt; state.vel += (0 - state.vel) * (1 - Math.exp(-dt * S.EASE * 2)); }
      else state.vel += (S.SPIN - state.vel) * (1 - Math.exp(-dt * S.EASE));
      state.angle += state.vel * dt;
    }
    table.rotation.y = state.angle;
    if (state.section === 'smoke') {
      /* a burnout on the spot: the rear wheels spin and the smoke comes off them in the chosen colour */
      const K = S.SMOKE, d = model.dims, cz = d.centreZ || 0;
      for (const m of [model, twin]) { m.wheels.rl.mesh.rotation.x -= dt * K.spin; m.wheels.rr.mesh.rotation.x -= dt * K.spin; }
      state.due += dt * K.rate * 2;
      const ca = Math.cos(state.angle), sa = Math.sin(state.angle);
      while (state.due >= 1) {
        state.due -= 1;
        const side = Math.random() < 0.5 ? -1 : 1, lx = side * d.track / 2 + (Math.random() - 0.5) * 0.2, lz = d.rearAxle - cz + 0.25 + Math.random() * 0.2;
        /* behind the car and a little out, turned with the table */
        const bx = side * 0.25, bz = 1;
        smoke.spawn({ x: lx * ca + lz * sa, y: 0.2, z: -lx * sa + lz * ca, vx: (bx * ca + bz * sa) * K.drift, vy: K.rise * (0.7 + Math.random() * 0.6), vz: (-bx * sa + bz * ca) * K.drift, size: K.size * (0.8 + Math.random() * 0.4), grow: K.grow, growDecay: 0.6, life: K.life * (0.8 + Math.random() * 0.4), alpha: K.alpha, drag: 0.8, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 1.4, c0, c1 });
      }
    }
    smoke.update(dt, camera, null);
  }

  function render() {
    const exposure = renderer.toneMappingExposure;
    renderer.toneMappingExposure = S.EXPOSURE;
    renderer.render(scene, camera);
    renderer.toneMappingExposure = exposure;
  }

  /* The car's box on the page in CSS px: at the angle it stands at, or
     (whole) the box of every angle of a full turn. */
  const v = new THREE.Vector3();
  function carRect(whole) {
    if (!model || !state.stage) return null;
    const d = model.dims, hl = d.length / 2, hw = d.width / 2, st = state.stage;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    camera.updateMatrixWorld();
    const angles = whole ? Array.from({ length: 72 }, (_, i) => i * Math.PI / 36) : [state.angle];
    for (const a of angles) {
      const ca = Math.cos(a), sa = Math.sin(a);
      for (const f of [-hl, hl]) for (const l of [-hw, hw]) for (const y of [0, d.height]) {
        v.set(l * ca + f * sa, y, -l * sa + f * ca).project(camera);
        const px = (v.x + 1) / 2 * st.w, py = (1 - v.y) / 2 * st.h;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      }
    }
    return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 };
  }

  /* ---- the drag: pointer or touch on the stage ---- */
  let pointer = null, lastX = 0;
  function attach(root) {
    root.addEventListener('pointerdown', e => {
      const st = e.target && e.target.closest ? e.target.closest('.stage') : null;
      if (!st) return;
      pointer = e.pointerId; lastX = e.clientX; state.dragging = true; state.vel = 0;
      try { st.setPointerCapture(e.pointerId); } catch (err) { /* a made event has no pointer to capture */ }
    });
    const move = e => { if (!state.dragging || e.pointerId !== pointer) return; state.angle += (e.clientX - lastX) * S.DRAG; lastX = e.clientX; };
    const end = e => { if (!state.dragging || e.pointerId !== pointer) return; state.dragging = false; pointer = null; state.hold = S.RESUME; state.vel = 0; };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
  }

  return { scene, camera, state, show, setSection, frame, update, render, carRect, attach, model: () => model, smoke };
}
