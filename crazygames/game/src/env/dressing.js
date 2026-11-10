/* THE TRACK'S DRESSING (briefs/SPECTACLE.md 2 and 5): what the
   spectacle round adds to the world round a track, built once per track
   and preset, plus the little that moves each frame.

   Night and rain: a row of lamp posts along the road (as the docks
   already have) with the light they throw baked as warm pools on the
   road, under the towers too; reflective tape along the barriers'
   faces that catches the car's headlights as it nears; flares on every
   lamp head, so the low tier sees them glow without bloom; and on a wet
   road the lights' reflections, stretched towards the camera.
   Every track: a painted start grid behind the line, and a chequered
   line across it; camera flashes in the grandstands as the car slides
   past; flags that swing on the high tier; and fireworks over the
   finish when a star is won.

   All of it is cheap tricks, never more real lights: the pools are
   additive quads on the road, the tape an unlit strip whose glow is the
   distance to the car, the flares and reflections camera facing quads.
   Five draw calls at most (lamp posts, their heads, the pools, the tape,
   the grid) plus the fireworks' pool when they fly; the flares and the
   flashes go through the show's glows. Every number is in DRESS. */
import { buildProps } from './props.js';
import { createParticles } from './particles.js';
import { sparkSprite } from './textures.js';

export const DRESS = {
  /* the lamp row, at night and in the rain */
  LAMP_EVERY:     34,       // m along the road between lamp posts
  LAMP_BACK:      4.5,      // m behind the barrier, as the docks' lamps (env/scenery.js LAMP_BACK)
  LAMP_HEAD:      [0, 7.95, -1.2],   // the head, in the lamp's own frame (env/props.js)
  LAMP_SKIP:      14,       // m: no new lamp this close to a lamp the theme already placed
  LAMP_PRESETS:   { night: 1, rain: 1 },
  /* the pools of light on the road */
  POOL_RADIUS:    { lamp: 10, tower: 17 },   // m
  POOL_IN:        2.5,      // m inside the road's edge the pool is centred, on the lamp's side
  POOL_COLOUR:    { night: [1.0, 0.78, 0.5], rain: [0.9, 0.82, 0.7] },   // linear, additive
  POOL_GAIN:      { night: 0.42, rain: 0.26 },
  POOL_GRID:      6,        // vertices a side, so a pool follows a banked road
  POOL_LIFT:      0.045,    // m over the road
  /* reflective tape on the barriers' faces */
  TAPE_HEIGHT:    0.8,      // m up the barrier
  TAPE_WIDTH:     0.09,     // m tall
  TAPE_INSET:     0.27,     // m in from the barrier's line, its road side face
  TAPE_COLOUR:    [1.0, 0.72, 0.42],   // amber, so the edge line stays the brightest thing
  TAPE_BASE:      { night: 0.22, rain: 0.18, dusk: 0, dawn: 0 },   // glow with nothing near
  TAPE_CATCH:     { night: 0.9, rain: 0.6, dusk: 0, dawn: 0 },     // more glow where the headlights reach
  TAPE_REACH:     [8, 55],  // m: full catch within the first, none past the second
  /* the flares on the lamp heads, and the towers' */
  FLARE_SIZE:     { lamp: 0.75, tower: 1.9, stand: 1.4 },   // m half width
  FLARE_COLOUR:   [1.0, 0.78, 0.5],
  FLARE_ALPHA:    { night: 0.9, rain: 0.6 },
  FLARE_RANGE:    260,      // m, the farthest flare drawn
  /* the wet road's reflections of the lights */
  WET_LENGTH:     { lamp: 9, tower: 14, car: 3 },   // m half length, towards the camera (seen at a grazing angle, so long)
  WET_WIDTH:      { lamp: 0.42, tower: 0.9, car: 0.22 },
  WET_ALPHA:      0.55,
  WET_RANGE:      120,      // m
  /* the start grid */
  GRID_SLOTS:     6,        // boxes behind the line, two abreast
  GRID_GAP:       8,        // m between rows
  GRID_BOX:       [2.6, 4.6],   // m wide and long
  GRID_LINE:      0.16,     // m, the paint's width
  GRID_COLOUR:    0xe8e4d8,
  CHEQUER:        1.0,      // m squares in the chequered line at the start
  CHEQUER_ROWS:   2,
  /* the crowd's camera flashes */
  FLASH_RANGE:    45,       // m from a grandstand the car must be
  FLASH_RATE:     [3, 22],  // per second, cruising and sliding at full heat
  FLASH_LIFE:     0.09,     // s
  FLASH_SIZE:     0.55,     // m
  /* flags (high tier only) */
  FLAG_SWING:     0.32,     // radians either way about the pole
  FLAG_HZ:        0.55,     // swings per second, with gusts
  /* fireworks over the finish when a star is won */
  FIREWORK_POOL:  { low: 160, high: 360 },
  FIREWORK_BURSTS: [3, 6, 9],   // bursts for one, two and three stars
  FIREWORK_GAP:   0.42,     // s between bursts
  FIREWORK_SPARKS: { low: 40, high: 70 },
  FIREWORK_COLOURS: [0xff4a6a, 0x19d8ff, 0xffd34d, 0x8aff6a, 0xff8a3c, 0xd07aff],
  FIREWORK_AHEAD: 46,       // m in front of the camera
  FIREWORK_HIGH:  [14, 26], // m above it
};

const lerp = (a, b, t) => a + (b - a) * t;

/* The road's height at a world point near sample c, as the mesh lays it. */
function roadY(c, x, z) {
  const lx = -Math.cos(c.heading), lz = Math.sin(c.heading);
  const u = (x - c.x) * lx + (z - c.z) * lz, hw = c.width / 2;
  return (c.y || 0) - Math.max(-hw, Math.min(hw, u)) * Math.tan(c.bank || 0);
}
function nearestSample(C, x, z, hint) {
  let best = 0, bd = Infinity;
  const from = hint === undefined ? 0 : Math.max(0, hint - 30), to = hint === undefined ? C.length : Math.min(C.length, hint + 30);
  for (let i = from; i < to; i++) { const d = (C[i].x - x) ** 2 + (C[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}

export function buildDressing(THREE, ground, o) {
  const preset = o.preset, theme = o.theme, tierName = o.tierName || 'low', env = o.env;
  const group = new THREE.Group();
  group.name = 'dressing';
  const disposables = [];
  const C = ground.centre || [], n = C.length;
  const T = THREE.TSL;
  const dark = !!DRESS.LAMP_PRESETS[preset.name];
  const lights = [];   // { kind, x, y, z, foot: { x, y, z } }: every lamp head and tower lamp, for the flares and the reflections
  const stands = [];   // the grandstands' crowd boxes, for the flashes
  const info = { drawCalls: 0, triangles: 0, lamps: 0, pools: 0 };
  if (!n) return { group, update() {}, dispose() {}, info, fireworks: () => {} };
  const closed = ground.kind === 'circuit';
  const left = ground.walls && ground.walls[0], right = ground.walls && ground.walls[1];
  const wallOff = (i, sgn) => { const w = sgn > 0 ? left : right, c = C[i]; if (!w || !w.points[i]) return c.width / 2; const p = w.points[i]; return Math.abs((p.x - c.x) * -Math.cos(c.heading) + (p.z - c.z) * Math.sin(c.heading)); };

  /* ---- the lamp row ---- */
  const placed = (env && env.placed) || {};
  const have = (placed.lamp || []).map(l => [l.x, l.z]);
  if (dark) {
    const props = buildProps(THREE, theme, (ground.seed >>> 0) || 1);
    const list = [];
    const length = ground.length || n * 2;
    for (let s = 12, k = 0; s < length - (closed ? 6 : 20); s += DRESS.LAMP_EVERY, k++) {
      const i = Math.min(n - 1, Math.round(s / 2)), c = C[i];
      if (c.part === 'deck') continue;   // nothing stands on a bridge
      const sgn = k % 2 ? 1 : -1, lx = -Math.cos(c.heading) * sgn, lz = Math.sin(c.heading) * sgn;
      const off = wallOff(i, sgn) + DRESS.LAMP_BACK;
      const x = c.x + lx * off, z = c.z + lz * off;
      if (have.some(h => Math.hypot(h[0] - x, h[1] - z) < DRESS.LAMP_SKIP)) continue;
      /* standing on the ground beside the road: the terrain's height there */
      const y = env && env.terrain && env.terrain.heightAt ? env.terrain.heightAt(x, z) : (c.y || 0);
      const ry = c.heading + (sgn > 0 ? -Math.PI / 2 : Math.PI / 2);
      list.push({ x, y, z, ry, i, sgn });
    }
    if (list.length && props.lamp) {
      const body = new THREE.InstancedMesh(props.lamp.body, new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
      const head = new THREE.InstancedMesh(props.lamp.lit, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 2.4 }), list.length);
      body.name = 'dress:lamp'; head.name = 'dress:lamphead'; body.frustumCulled = head.frustumCulled = false;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      list.forEach((l, j) => { e.set(0, l.ry, 0); q.setFromEuler(e); v.set(l.x, l.y, l.z); m4.compose(v, q, one); body.setMatrixAt(j, m4); head.setMatrixAt(j, m4); });
      body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true;
      group.add(body, head);
      disposables.push(props.lamp.body, props.lamp.lit, body.material, head.material);
      for (const kind of Object.keys(props)) if (kind !== 'lamp') { if (props[kind].body) props[kind].body.dispose(); if (props[kind].lit) props[kind].lit.dispose(); }
      info.drawCalls += 2; info.lamps = list.length;
      for (const l of list) {
        const hx = Math.sin(l.ry) * DRESS.LAMP_HEAD[2], hz = Math.cos(l.ry) * DRESS.LAMP_HEAD[2];
        lights.push({ kind: 'lamp', x: l.x + hx, y: l.y + DRESS.LAMP_HEAD[1], z: l.z + hz, i: l.i, sgn: l.sgn });
      }
    }
    /* the theme's own lamps and the towers light the road too */
    for (const l of placed.lamp || []) { const hx = Math.sin(l.ry) * DRESS.LAMP_HEAD[2], hz = Math.cos(l.ry) * DRESS.LAMP_HEAD[2]; const i = nearestSample(C, l.x, l.z); lights.push({ kind: 'lamp', x: l.x + hx, y: l.y + DRESS.LAMP_HEAD[1], z: l.z + hz, i, sgn: side(C[i], l.x, l.z) }); }
    for (const t of placed.tower || []) { const i = nearestSample(C, t.x, t.z); lights.push({ kind: 'tower', x: t.x, y: t.y + 14.8, z: t.z, i, sgn: side(C[i], t.x, t.z) }); }
  }
  function side(c, x, z) { return ((x - c.x) * -Math.cos(c.heading) + (z - c.z) * Math.sin(c.heading)) >= 0 ? 1 : -1; }
  for (const l of lights) { const c = C[l.i]; const u = l.sgn * (c.width / 2 - DRESS.POOL_IN), lx = -Math.cos(c.heading), lz = Math.sin(c.heading); l.foot = { x: c.x + lx * u, z: c.z + lz * u }; l.foot.y = roadY(c, l.foot.x, l.foot.z); }

  /* ---- the pools of light on the road ---- */
  if (dark && lights.length) {
    const G = DRESS.POOL_GRID, pos = [], uv = [], idx = [];
    for (const l of lights) {
      const r = DRESS.POOL_RADIUS[l.kind] || 10, base = pos.length / 3;
      for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) {
        const u = a / (G - 1), w = b / (G - 1);
        const x = l.foot.x + (u * 2 - 1) * r, z = l.foot.z + (w * 2 - 1) * r;
        const c = C[nearestSample(C, x, z, l.i)];
        pos.push(x, roadY(c, x, z) + DRESS.POOL_LIFT, z); uv.push(u, w);
      }
      for (let a = 0; a + 1 < G; a++) for (let b = 0; b + 1 < G; b++) { const k = base + a * G + b; idx.push(k, k + 1, k + G, k + 1, k + G + 1, k + G); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, side: THREE.DoubleSide });
    const col = DRESS.POOL_COLOUR[preset.name] || DRESS.POOL_COLOUR.night, gain = DRESS.POOL_GAIN[preset.name] || 0.3;
    const d = T.uv().sub(0.5).length().mul(2);
    const fall = T.float(1).sub(d).max(0);
    mat.colorNode = T.vec3(col[0] * gain, col[1] * gain, col[2] * gain).mul(fall.mul(fall));
    const pools = new THREE.Mesh(geo, mat);
    pools.name = 'dress:pools'; pools.renderOrder = 3; pools.frustumCulled = false;
    group.add(pools);
    disposables.push(geo, mat);
    info.drawCalls++; info.triangles += idx.length / 3; info.pools = lights.length;
  }

  /* ---- reflective tape along the barriers ---- */
  const carPos = T.uniform(new THREE.Vector3());
  if ((DRESS.TAPE_CATCH[preset.name] || 0) > 0 && left && right) {
    const pos = [], idx = [];
    for (const [w, sgn] of [[left, 1], [right, -1]]) {
      const segs = closed ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const j = (i + 1) % n, a = w.points[i], b = w.points[j];
        if (!a || !b) continue;
        const lift = k => { const c = C[k]; return [-Math.cos(c.heading) * sgn * DRESS.TAPE_INSET, Math.sin(c.heading) * sgn * DRESS.TAPE_INSET]; };
        const [ax, az] = lift(i), [bx, bz] = lift(j);
        const ya = (a.y || 0) + DRESS.TAPE_HEIGHT, yb = (b.y || 0) + DRESS.TAPE_HEIGHT, h = DRESS.TAPE_WIDTH;
        const k = pos.length / 3;
        pos.push(a.x - ax, ya, a.z - az, b.x - bx, yb, b.z - bz, b.x - bx, yb + h, b.z - bz, a.x - ax, ya + h, a.z - az);
        idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: true });
    const dist = T.positionWorld.sub(carPos).length();
    const reach = T.float(1).sub(T.smoothstep(DRESS.TAPE_REACH[0], DRESS.TAPE_REACH[1], dist));
    const k = T.float(DRESS.TAPE_BASE[preset.name] || 0).add(reach.mul(DRESS.TAPE_CATCH[preset.name] || 0));
    mat.colorNode = T.vec3(...DRESS.TAPE_COLOUR).mul(k);
    const tape = new THREE.Mesh(geo, mat);
    tape.name = 'dress:tape'; tape.frustumCulled = false;
    group.add(tape);
    disposables.push(geo, mat);
    info.drawCalls++; info.triangles += idx.length / 3;
  }

  /* ---- the start grid and the chequered line ---- */
  const start = ground.startLine === undefined ? 8 : ground.startLine;
  {
    const quads = [], cols = [];
    const paint = new THREE.Color().setHex(DRESS.GRID_COLOUR), black = new THREE.Color(0.02, 0.02, 0.025);
    const put = (s, u0, u1, a0, a1, colour) => {
      /* a quad from along a0 to a1 (m behind the line are negative), lateral u0 to u1, on the road */
      const pt = (a, u) => { const i = Math.max(0, Math.min(n - 1, Math.round((start + a) / 2))), c = C[closed ? ((Math.round((start + a) / 2) % n) + n) % n : i]; const fx = -Math.sin(c.heading), fz = -Math.cos(c.heading), lx = -Math.cos(c.heading), lz = Math.sin(c.heading); const da = (start + a) - Math.round((start + a) / 2) * 2; const x = c.x + fx * da + lx * u, z = c.z + fz * da + lz * u; return [x, roadY(c, x, z) + 0.035, z]; };
      const p = [pt(a0, u0), pt(a0, u1), pt(a1, u1), pt(a1, u0)];
      quads.push(p); cols.push(colour);
    };
    const hw = C[Math.min(n - 1, Math.round(start / 2))].width / 2;
    /* the chequered line: squares across the road just past the line */
    const sq = DRESS.CHEQUER, cells = Math.floor((hw * 2 - 1.6) / sq);
    for (let r = 0; r < DRESS.CHEQUER_ROWS; r++) for (let k = 0; k < cells; k++) {
      const u0 = -cells * sq / 2 + k * sq;
      put(0, u0, u0 + sq, 1.0 + r * sq, 1.0 + (r + 1) * sq, (k + r) % 2 ? paint : black);
    }
    /* the grid: open boxes behind the line, two abreast, staggered */
    const [bw, bl] = DRESS.GRID_BOX, L = DRESS.GRID_LINE;
    for (let k = 0; k < DRESS.GRID_SLOTS; k++) {
      const sgn = k % 2 ? -1 : 1, row = Math.floor(k / 2);
      const back = -4 - row * DRESS.GRID_GAP - (k % 2) * DRESS.GRID_GAP / 2;
      const u = sgn * Math.min(hw - bw / 2 - 1.4, 2.4);
      put(0, u - bw / 2, u + bw / 2, back - L, back, paint);                 // the front bar
      put(0, u - bw / 2, u - bw / 2 + L, back - bl, back, paint);           // and the sides
      put(0, u + bw / 2 - L, u + bw / 2, back - bl, back, paint);
    }
    const pos = [], col = [];
    quads.forEach((p, k) => { for (const v of [p[0], p[1], p[2], p[0], p[2], p[3]]) { pos.push(...v); col.push(cols[k].r, cols[k].g, cols[k].b); } });
    if (pos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: dark ? 0.08 : 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const grid = new THREE.Mesh(geo, mat);
      grid.name = 'dress:grid'; grid.receiveShadow = true;
      group.add(grid);
      disposables.push(geo, mat);
      info.drawCalls++; info.triangles += pos.length / 9;
    }
  }

  /* ---- the crowds, for the flashes ---- */
  for (const g of placed.grandstand || []) stands.push({ x: g.x, y: g.y, z: g.z, ry: g.ry || 0 });

  /* ---- the fireworks ---- */
  const fwTex = sparkSprite(THREE, 32);
  const fw = createParticles(THREE, { max: DRESS.FIREWORK_POOL[tierName] || DRESS.FIREWORK_POOL.low, texture: fwTex, colour: 0xffffff, tint: true, additive: true, fog: false, name: 'fireworks', renderOrder: 7 });
  group.add(fw.mesh);
  disposables.push({ dispose: () => { fw.dispose(); fwTex.dispose(); } });
  const fwState = { left: 0, due: 0 };
  const fwCol = DRESS.FIREWORK_COLOURS.map(h => { const c = new THREE.Color().setHex(h); return [c.r * 2.2, c.g * 2.2, c.b * 2.2]; });
  function fireworks(stars) { fwState.left = stars > 0 ? DRESS.FIREWORK_BURSTS[Math.min(3, stars) - 1] : 0; fwState.due = 0.15; }

  /* ---- per frame ---- */
  const rand = (a, b) => a + (b - a) * Math.random();   // decoration only
  const flags = env && env.meshes && env.meshes.flag && env.meshes.flag.body, flagList = placed.flag || [];
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fe = new THREE.Euler(), fv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  let t = 0, flashDue = 0;
  const flashes = [];
  const fwd = new THREE.Vector3();
  /* glows: the show's glow pool, to add flares, flashes and reflections to */
  function update(dt, camera, pose, heat, sliding, glows) {
    t += dt;
    carPos.value.set(pose.x, (pose.y || 0) + 0.6, pose.z);
    const cp = camera.position;
    /* the flares, and their reflections on a wet road */
    if (glows && dark) {
      const fa = DRESS.FLARE_ALPHA[preset.name] || 0.7, fc = DRESS.FLARE_COLOUR;
      for (const l of lights) {
        const d = Math.hypot(l.x - cp.x, l.z - cp.z);
        if (d > DRESS.FLARE_RANGE) continue;
        glows.add(l.x, l.y, l.z, DRESS.FLARE_SIZE[l.kind] || 1, fc[0] * 1.5, fc[1] * 1.5, fc[2] * 1.5, fa * (1 - d / DRESS.FLARE_RANGE * 0.5));
        if (preset.wet && d < DRESS.WET_RANGE) glows.add(l.foot.x, l.foot.y + 0.05, l.foot.z, DRESS.WET_WIDTH[l.kind] || 0.5, fc[0], fc[1] * 0.95, fc[2] * 0.9, DRESS.WET_ALPHA * (1 - d / DRESS.WET_RANGE), DRESS.WET_LENGTH[l.kind] || 3);
      }
    }
    /* the crowd's flashes as the car passes, more while it slides */
    if (glows && stands.length) {
      let near = null, nd = Infinity;
      for (const s of stands) { const d = Math.hypot(s.x - pose.x, s.z - pose.z); if (d < nd) { nd = d; near = s; } }
      if (near && nd < DRESS.FLASH_RANGE) {
        flashDue += dt * lerp(DRESS.FLASH_RATE[0], DRESS.FLASH_RATE[1], sliding ? 0.4 + 0.6 * heat : 0);
        while (flashDue >= 1) {
          flashDue -= 1;
          const row = Math.floor(rand(0, 6)), lx = rand(-8.5, 8.5), ly = 0.62 * (row + 1) + 1.1, lz = -5 + row * 1.15 + 0.6;
          const c = Math.cos(near.ry), s = Math.sin(near.ry);
          flashes.push({ x: near.x + lx * c + lz * s, y: near.y + ly, z: near.z - lx * s + lz * c, life: DRESS.FLASH_LIFE });
        }
      } else flashDue = 0;
    }
    for (let k = flashes.length - 1; k >= 0; k--) { const f = flashes[k]; f.life -= dt; if (f.life <= 0) { flashes.splice(k, 1); continue; } if (glows) glows.add(f.x, f.y, f.z, DRESS.FLASH_SIZE, 2.2, 2.2, 2.4, f.life / DRESS.FLASH_LIFE); }
    /* flags on the high tier swing about their poles */
    if (flags && tierName === 'high') {
      for (let i = 0; i < flagList.length; i++) {
        const f = flagList[i], ph = i * 1.7;
        const a = Math.sin(t * DRESS.FLAG_HZ * Math.PI * 2 + ph) * 0.7 + Math.sin(t * DRESS.FLAG_HZ * 3.1 + ph * 2.3) * 0.3;
        fe.set(0, (f.ry || 0) + a * DRESS.FLAG_SWING, 0); fq.setFromEuler(fe); fv.set(f.x, f.y, f.z); fm.compose(fv, fq, one);
        flags.setMatrixAt(i, fm);
      }
      flags.instanceMatrix.needsUpdate = true;
    }
    /* fireworks */
    if (fwState.left > 0) {
      fwState.due -= dt;
      if (fwState.due <= 0) {
        fwState.left--; fwState.due = DRESS.FIREWORK_GAP * rand(0.7, 1.3);
        camera.getWorldDirection(fwd);
        const fx = fwd.x, fz = fwd.z, fl = Math.hypot(fx, fz) || 1;
        const bx = cp.x + fx / fl * DRESS.FIREWORK_AHEAD + (-fz / fl) * rand(-18, 18), bz = cp.z + fz / fl * DRESS.FIREWORK_AHEAD + (fx / fl) * rand(-18, 18), by = cp.y + rand(DRESS.FIREWORK_HIGH[0], DRESS.FIREWORK_HIGH[1]);
        const c0 = fwCol[Math.floor(rand(0, fwCol.length))], c1 = [c0[0] * 0.35, c0[1] * 0.35, c0[2] * 0.35];
        const count = DRESS.FIREWORK_SPARKS[tierName] || 40;
        for (let k = 0; k < count; k++) {
          const u = rand(-1, 1), a = rand(0, Math.PI * 2), r = Math.sqrt(1 - u * u), sp = rand(9, 13);
          fw.spawn({ x: bx, y: by, z: bz, vx: Math.cos(a) * r * sp, vy: u * sp + 2, vz: Math.sin(a) * r * sp, size: rand(0.25, 0.4), life: rand(1.0, 1.5), gravity: 4, drag: 1.1, stretch: 1.6, c0, c1 });
        }
        if (glows) glows.add(bx, by, bz, 6, c0[0], c0[1], c0[2], 0.7);
      }
    }
    fw.update(dt, camera, null);
  }
  return {
    group, update, fireworks, info, lights,
    clear() { fwState.left = 0; fw.clear(); flashes.length = 0; },
    dispose() { for (const d of disposables) d.dispose(); },
  };
}
