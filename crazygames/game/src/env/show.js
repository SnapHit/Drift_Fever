/* THE DRIFT SHOW (briefs/SPECTACLE.md 1): what the spectacle round
   adds round the car. Tail-light trails while sliding at dusk, at night
   and in the rain; tail-lights that brighten under the brake, with a
   halo the low tier can see without bloom; an exhaust flame that pops
   on the lift at the end of a slide; a flash where a wall is hit; and
   the heat, one number from 0 to 1 that climbs with the chain's
   multiplier (x1 is 0, SHOW.HEAT_FULL and over is 1) and that every part
   of the show reads, so x1 is modest and x4 is unmistakable: thicker,
   longer smoke, longer and brighter trails, glowing rear tyres shedding
   embers, bigger pops.

   Drawn only. Nothing here is read by the physics or the score; the
   random numbers are Math.random, never the simulation's. Every number
   of taste is in SHOW. Two draw calls: the trails and the glows (the
   flame and the embers go through the effects' pools). */
import { createGlows } from './particles.js';
import { softSprite } from './textures.js';

export const SHOW = {
  GLOWS:            { low: 160, high: 240 },   // flares, halos and flashes drawn at once
  HEAT_FULL:        4,       // the multiplier at which the heat is full
  HEAT_RISE:        2.5,     // per second the heat eases towards its target
  HEAT_FALL:        1.2,     // and back down after a bank or a loss
  /* tail-light trails */
  TRAIL_POINTS:     36,      // points per light
  TRAIL_LIFE:       [0.32, 0.75],   // s a trail point lasts, at heat 0 and 1
  TRAIL_WIDTH:      [0.045, 0.085],   // m half width at the light, at heat 0 and 1
  TRAIL_COLOUR:     [1.0, 0.09, 0.07],   // linear, additive
  TRAIL_GAIN:       [1.6, 3.2],   // brightness at heat 0 and 1 (over 1 feeds the bloom)
  TRAIL_MIN_SPEED:  6,       // m/s
  TRAIL_SPACING:    0.12,    // m the car moves before a new point is laid
  TRAIL_PRESETS:    { dusk: 0.55, night: 1, dawn: 0, rain: 0.9 },   // how strongly each preset shows them (daylight hides a tail-light)
  /* the tail-lights */
  TAIL_BASE:        { dusk: 0.6, night: 1, dawn: 0.35, rain: 1 },   // the tail-lights' glow with no brake
  TAIL_BRAKE:       2.4,     // and under the brake or the handbrake
  TAIL_EASE:        14,      // per second
  HALO_SIZE:        0.34,    // m, the halo round each tail-light
  HALO_ALPHA:       { dusk: 0.35, night: 0.75, dawn: 0.15, rain: 0.7 },
  HALO_BRAKE:       2.0,     // the halo's size and brightness under the brake, times
  /* the exhaust pop on the lift */
  POP_MIN_SLIDE:    0.45,    // s of slide before its end pops
  POP_COUNT:        [2, 5],  // pops at heat 0 and 1
  POP_GAP:          0.09,    // s between pops
  POP_PUFFS:        [6, 12], // flame particles per pop, at heat 0 and 1
  POP_FLASH:        0.55,    // m, the glow at the tip on each pop
  POP_COLOUR:       [1.0, 0.55, 0.18],
  /* a wall hit */
  HIT_FLASH:        [0.9, 2.6],   // m, the flash at the hit, for a soft and a hard hit
  HIT_FLASH_LIFE:   0.16,    // s
  HIT_COLOUR:       [1.0, 0.75, 0.4],
  /* the heat at the rear tyres */
  TYRE_GLOW_FROM:   0.5,     // heat where the rear tyres start to glow
  TYRE_GLOW:        0.42,    // m half width
  TYRE_GLOW_COLOUR: [1.0, 0.32, 0.1],
  EMBERS:           22,      // per second per wheel at full heat
  /* the tyre smoke, which replaces the old smoke's numbers (effects.js
     FX) while the round is on; pairs are at heat 0 and heat 1 */
  SMOKE: {
    POOL:           { low: 110, high: 260 },   // puffs alive at once
    RATE:           [22, 50],    // puffs per second per wheel at a full slide
    LIFE:           [2.0, 3.0],  // s, so a slide's smoke lingers behind it
    SIZE:           [0.6, 0.9],  // m half width at birth
    GROW:           [2.6, 3.4],  // m per second at birth, slowing as the puff ages
    GROW_DECAY:     0.8,         // per second
    RISE:           1.7,         // m per second
    ALPHA:          [0.5, 0.66],
    KEEP:           0.12,        // share of the wheel's velocity a puff is born with
    THROW:          [4.5, 6.5],  // m/s a puff is thrown the way the tyres slide (out of the corner), so the cloud billows beside the car's path where the camera can see it
    DRAG:           1.3,
    COLOUR:         { dusk: 0xe8d4c8, night: 0xa4abc8, dawn: 0xfff0e2, rain: 0xb8bec8 },   // the smoke as it drifts away, lit by the preset
    BIRTH:          { dusk: 0xffc89a, night: 0xff5a4a, dawn: 0xffe2c0, rain: 0xe0c4c4 },   // as it leaves the tyre: warm in the low sun, red from the tail-lights in the dark
    HEAT_TINT:      0xffb48a,    // the smoke warms towards this with the heat
    HEAT_TINT_MAX:  0.3,
    /* the car stays readable: smoke that covers the car on the screen
       keeps only KEEP of its alpha, and all of it once clear of the car by
       half the car's size (R is the car's radius, m); nothing within NEAR
       of the camera shows, fading in by FAR */
    CLEAR:          { r: 2.4, keep: 0.03, near: 1.2, far: 4 },
  },
  /* rain: spray off the tyres whenever the car is quick */
  SPRAY: { FROM: 8, RATE: 34, LIFE: 0.55, SIZE: 0.35, GROW: 1.8, ALPHA: 0.3, COLOUR: 0xd8dee8 },
  /* sparks: brighter, more, longer, on a hit and a scrape */
  SPARKS: { POOL: { low: 120, high: 260 }, COUNT: [18, 70], SPEED: [4, 14], SIZE: 0.28, LIFE: 0.75, STRETCH: 3.4, SCRAPE: 80, COLOUR: 0xffe2a8 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const pick = (pair, t) => lerp(pair[0], pair[1], t);

export function createShow(THREE, opts) {
  const o = opts || {};
  const tier = o.tier || {};
  let preset = o.preset || { name: 'dusk' };
  const group = new THREE.Group();
  group.name = 'show';
  const soft = softSprite(THREE, 64, true);
  const glows = createGlows(THREE, { max: SHOW.GLOWS[o.tierName] || SHOW.GLOWS.low, texture: soft, name: 'glows', renderOrder: 6 });
  group.add(glows.mesh);

  /* ---- the trails: two ribbons, one per tail-light ---- */
  const N = SHOW.TRAIL_POINTS;
  const trail = [0, 1].map(() => ({ pts: new Array(N).fill(null).map(() => ({ x: 0, y: 0, z: 0, age: 1e9, link: false })), head: 0, on: false, lx: 0, lz: 0 }));
  const tgeo = new THREE.BufferGeometry();
  const tpos = new Float32Array(2 * N * 4 * 3), tcol = new Float32Array(2 * N * 4 * 4);
  const tidx = new Uint16Array(2 * (N - 1) * 6);
  tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
  tgeo.setAttribute('glow', new THREE.BufferAttribute(tcol, 4));
  tgeo.setIndex(new THREE.BufferAttribute(tidx, 1));
  tgeo.setDrawRange(0, 0);
  const T = THREE.TSL;
  const tmat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true });
  const tg = T.attribute('glow', 'vec4');
  tmat.colorNode = tg.xyz; tmat.opacityNode = tg.w;
  const trails = new THREE.Mesh(tgeo, tmat);
  trails.frustumCulled = false; trails.renderOrder = 5; trails.name = 'trails';
  group.add(trails);

  const state = { heat: 0, tail: 0, slideT: 0, pops: 0, popDue: 0, popHeat: 0, flash: 0, flashSize: 0, flashX: 0, flashY: 0, flashZ: 0 };
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  const rand = (a, b) => a + (b - a) * Math.random();   // decoration only

  function setPreset(p) { preset = p; }
  /* one ribbon vertex: where, and its alpha from its age */
  function put(i, x, y, z, f, gain) { tpos[i * 3] = x; tpos[i * 3 + 1] = y; tpos[i * 3 + 2] = z; tcol[i * 4] = SHOW.TRAIL_COLOUR[0] * gain; tcol[i * 4 + 1] = SHOW.TRAIL_COLOUR[1] * gain; tcol[i * 4 + 2] = SHOW.TRAIL_COLOUR[2] * gain; tcol[i * 4 + 3] = f * f; }

  /* ctx: { mult, car (the three.js group at the physics origin), tails
     ([[x, y, z], [x, y, z]] in the car's frame), exhaust ([x, y, z] in
     the car's frame), lights (the model's lights), pools (the effects'
     flame and spark pools), density (the adaptation's share, 0 to 1) } */
  function update(dt, camera, pose, world, rig, ctx) {
    const c = world.car, name = preset.name;
    /* the heat follows the multiplier */
    const target = Math.max(0, Math.min(1, ((ctx.mult || 1) - 1) / Math.max(1, SHOW.HEAT_FULL - 1)));
    state.heat += (target - state.heat) * (1 - Math.exp(-dt * (target > state.heat ? SHOW.HEAT_RISE : SHOW.HEAT_FALL)));
    const heat = state.heat;
    const sliding = (c.rearSlide >= 0.9 || c.hb > 0.5 || c.spinning || c.drifting) && c.speed > SHOW.TRAIL_MIN_SPEED;
    ctx.car.updateMatrix();   // the car hangs off the scene, so its own matrix is its world matrix: no need to walk the model's parts
    glows.begin(camera);

    /* the tail-lights: brighter under the brake, a halo round each */
    const braking = (c.brake > 0.1 || c.hb > 0.5) ? 1 : 0;
    const base = SHOW.TAIL_BASE[name] === undefined ? 0.6 : SHOW.TAIL_BASE[name];
    const want = base + (SHOW.TAIL_BRAKE - base) * braking;
    state.tail += (want - state.tail) * (1 - Math.exp(-dt * SHOW.TAIL_EASE));
    if (ctx.lights && ctx.lights.set) ctx.lights.set(null, state.tail);
    const haloA = (SHOW.HALO_ALPHA[name] || 0.3) * (1 + (SHOW.HALO_BRAKE - 1) * braking);
    const tails = ctx.tails || [];
    for (let k = 0; k < tails.length; k++) {
      v.set(tails[k][0], tails[k][1], tails[k][2]).applyMatrix4(ctx.car.matrix);
      glows.add(v.x, v.y, v.z, SHOW.HALO_SIZE * (1 + 0.5 * braking), 1, 0.12, 0.08, haloA);
      /* on a wet road the tail-light shows in it, stretched towards the camera */
      if (preset.wet) glows.add(v.x, (pose.y || 0) + 0.04, v.z, 0.2, 1, 0.1, 0.08, 0.45 * (1 + braking), 2.6);
      /* the trail: a point every few centimetres while sliding */
      const tr = trail[k], strength = SHOW.TRAIL_PRESETS[name] || 0;
      const on = sliding && strength > 0;
      if (on) {
        const last = tr.pts[(tr.head - 1 + N) % N];
        if (!tr.on || Math.hypot(v.x - last.x, v.z - last.z) >= SHOW.TRAIL_SPACING) {
          const p = tr.pts[tr.head]; p.x = v.x; p.y = v.y; p.z = v.z; p.age = 0; p.link = tr.on; tr.head = (tr.head + 1) % N;
        }
      }
      tr.on = on;
    }
    /* the ribbons, newest first */
    const life = pick(SHOW.TRAIL_LIFE, heat), width = pick(SHOW.TRAIL_WIDTH, heat), gain = pick(SHOW.TRAIL_GAIN, heat) * (SHOW.TRAIL_PRESETS[name] || 0);
    const cp = camera.position;
    let quads = 0;
    for (let k = 0; k < 2; k++) {
      const tr = trail[k];
      for (const p of tr.pts) p.age += dt;
      for (let j = 0; j < N - 1; j++) {
        const a = tr.pts[(tr.head - 1 - j + 2 * N) % N], b = tr.pts[(tr.head - 2 - j + 2 * N) % N];
        if (!a.link || a.age >= life || b.age >= life) break;
        /* across the ribbon: square to the segment and to the view */
        const sx = a.x - b.x, sy = a.y - b.y, sz = a.z - b.z;
        const vx = cp.x - a.x, vy = cp.y - a.y, vz = cp.z - a.z;
        let nx = sy * vz - sz * vy, ny = sz * vx - sx * vz, nz = sx * vy - sy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const fa = 1 - a.age / life, fb = 1 - b.age / life;
        const wa = width * (0.4 + 0.6 * fa), wb = width * (0.4 + 0.6 * fb);
        const q = quads * 4;
        put(q, a.x + nx * wa, a.y + ny * wa, a.z + nz * wa, fa, gain); put(q + 1, a.x - nx * wa, a.y - ny * wa, a.z - nz * wa, fa, gain);
        put(q + 2, b.x - nx * wb, b.y - ny * wb, b.z - nz * wb, fb, gain); put(q + 3, b.x + nx * wb, b.y + ny * wb, b.z + nz * wb, fb, gain);
        const o6 = quads * 6; tidx[o6] = q; tidx[o6 + 1] = q + 1; tidx[o6 + 2] = q + 2; tidx[o6 + 3] = q; tidx[o6 + 4] = q + 2; tidx[o6 + 5] = q + 3;
        quads++;
      }
    }
    tgeo.setDrawRange(0, quads * 6);
    if (quads) { tgeo.attributes.position.needsUpdate = true; tgeo.attributes.glow.needsUpdate = true; tgeo.index.needsUpdate = true; }
    trails.visible = quads > 0;

    /* the pop on the lift: a slide held long enough, then let go */
    if (sliding) state.slideT += dt;
    else {
      if (state.slideT >= SHOW.POP_MIN_SLIDE && c.speed > 4) { state.pops = Math.round(pick(SHOW.POP_COUNT, heat)); state.popDue = 0; state.popHeat = heat; }
      state.slideT = 0;
    }
    if (state.pops > 0 && ctx.exhaust) {
      state.popDue -= dt;
      if (state.popDue <= 0) {
        state.pops--; state.popDue = SHOW.POP_GAP * rand(0.7, 1.4);
        v.set(ctx.exhaust[0], ctx.exhaust[1], ctx.exhaust[2]).applyMatrix4(ctx.car.matrix);
        const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw);
        const puffs = Math.round(pick(SHOW.POP_PUFFS, state.popHeat) * (ctx.density === undefined ? 1 : ctx.density));
        for (let i = 0; i < puffs && ctx.pools; i++) ctx.pools.flame.spawn({ x: v.x + rand(-0.05, 0.05), y: v.y + rand(-0.04, 0.04), z: v.z + rand(-0.05, 0.05), vx: c.wvx * 0.7 - fx * rand(3, 7), vy: rand(0.1, 0.9), vz: c.wvz * 0.7 - fz * rand(3, 7), size: rand(0.16, 0.34) * (1 + state.popHeat * 0.6), life: rand(0.08, 0.2), alpha: 1 });
        state.flash = 1; state.flashSize = SHOW.POP_FLASH * (1 + state.popHeat); state.flashX = v.x; state.flashY = v.y; state.flashZ = v.z; state.flashColour = SHOW.POP_COLOUR;
      }
    }
    /* a wall hit: a flash at the point */
    const hit = world.hit;
    if (hit && hit.speed >= 1.5) {
      const k = Math.min(1, hit.speed / 12);
      state.flash = 1; state.flashSize = lerp(SHOW.HIT_FLASH[0], SHOW.HIT_FLASH[1], hit.hard ? 1 : k * 0.6); state.flashX = hit.x; state.flashY = (pose.y || 0) + 0.5; state.flashZ = hit.z; state.flashColour = SHOW.HIT_COLOUR;
    }
    if (state.flash > 0) {
      const col = state.flashColour || SHOW.HIT_COLOUR;
      glows.add(state.flashX, state.flashY, state.flashZ, state.flashSize * (0.6 + 0.4 * state.flash), col[0] * 2, col[1] * 2, col[2] * 2, state.flash);
      state.flash = Math.max(0, state.flash - dt / SHOW.HIT_FLASH_LIFE);
    }
    /* the heat at the rear tyres: a glow and embers, from x3 or so */
    const hot = Math.max(0, (heat - SHOW.TYRE_GLOW_FROM) / (1 - SHOW.TYRE_GLOW_FROM));
    if (hot > 0 && sliding) {
      const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw), lz = Math.sin(pose.yaw);
      for (const side of [1, -1]) {
        const wx = pose.x - fx * rig.bRear + lx * rig.half * side, wz = pose.z - fz * rig.bRear + lz * rig.half * side, wy = (pose.y || 0) + 0.25;
        const col = SHOW.TYRE_GLOW_COLOUR;
        glows.add(wx, wy, wz, SHOW.TYRE_GLOW * (0.7 + 0.3 * hot), col[0] * 1.6, col[1] * 1.6, col[2] * 1.6, 0.85 * hot);
        state['ember' + side] = (state['ember' + side] || 0) + dt * SHOW.EMBERS * hot * (ctx.density === undefined ? 1 : ctx.density);
        while (state['ember' + side] >= 1 && ctx.pools) {
          state['ember' + side] -= 1;
          ctx.pools.sparks.spawn({ x: wx + rand(-0.2, 0.2), y: (pose.y || 0) + 0.08, z: wz + rand(-0.2, 0.2), vx: c.wvx * 0.4 + rand(-1.5, 1.5), vy: rand(1, 3.2), vz: c.wvz * 0.4 + rand(-1.5, 1.5), size: rand(0.06, 0.13), life: rand(0.3, 0.6), gravity: 6, stretch: 1.4, drag: 0.8 });
        }
      }
    }
    if (ctx.extraGlows) ctx.extraGlows(glows);
    glows.end();
  }
  function clear() { for (const tr of trail) { for (const p of tr.pts) { p.age = 1e9; p.link = false; } tr.on = false; } state.heat = 0; state.pops = 0; state.flash = 0; state.slideT = 0; tgeo.setDrawRange(0, 0); trails.visible = false; }
  return { group, update, setPreset, clear, state, glows, dispose() { tgeo.dispose(); tmat.dispose(); glows.dispose(); soft.dispose(); } };
}
