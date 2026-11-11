/* THE EFFECTS: tyre smoke off the rear wheels while they slide, soft
   and lit by the preset's light and carried by its wind; dust when the
   car is off the asphalt; sparks when it hits a wall; an exhaust flame
   while boosting; and rain around the camera in the rain preset. Five
   particle pools, five draw calls at most, with pool sizes by tier.
   Every number of taste is in FX.

   With the spectacle round on (opts.show), the smoke takes its numbers
   from SHOW.SMOKE instead: it billows and lingers, is born warm in the
   low sun and red from the tail-lights in the dark and fades to the
   preset's lit smoke colour, thickens with the slide and with the heat
   (the chain's multiplier), and thins where it would stand between the
   camera and the car. The sparks are brighter and more (SHOW.SPARKS),
   and the rain throws spray off the tyres (SHOW.SPRAY). Without it,
   everything is exactly as before. */
import { createParticles } from './particles.js';
import { softSprite, sparkSprite, rainSprite, puffSprite } from './textures.js';
import { SHOW } from './show.js';

export const FX = {
  SMOKE_LIFE:     1.4,     // s
  SMOKE_SIZE:     0.55,    // m at birth (half width)
  SMOKE_GROW:     1.2,     // m per second
  SMOKE_RISE:     1.1,     // m per second
  SMOKE_RATE:     26,      // puffs per second per wheel at a full slide
  SMOKE_ALPHA:    0.32,
  SMOKE_DRAG:     1.6,     // per second, how fast a puff gives up the car's speed to the wind
  SMOKE_KEEP:     0.3,     // share of the wheel's velocity a puff is born with
  SMOKE_SPIN:     0.8,     // radians per second
  DUST_LIFE:      1.0,
  DUST_SIZE:      0.5,
  DUST_GROW:      1.8,
  DUST_RATE:      30,
  DUST_ALPHA:     0.5,
  DUST_COLOUR:    0xb8a078,
  DUST_MIN_SPEED: 3,       // m/s
  SPARK_LIFE:     0.55,
  SPARK_SIZE:     0.2,
  SPARK_COUNT:    [10, 40], // per hit, scaled by its speed
  SPARK_SPEED:    [3, 11], // m/s
  SPARK_GRAVITY:  9.8,
  SPARK_MIN_HIT:  1.5,     // m/s along the normal
  SPARK_SCRAPE:   45,      // sparks per second while scraping along a wall
  FLAME_LIFE:     0.12,
  FLAME_SIZE:     0.22,
  FLAME_RATE:     90,      // per second while boosting
  FLAME_COLOUR:   0xffb060,
  RAIN_LIFE:      0.7,
  RAIN_SIZE:      0.012,   // m, half width of a drop
  RAIN_STRETCH:   0.5,     // m, half length
  RAIN_RATE:      320,     // drops per second near the camera
  RAIN_SPEED:     14,      // m/s down
  RAIN_RADIUS:    9,       // m around the camera
  RAIN_ALPHA:     0.45,
};

export function createEffects(THREE, opts) {
  const o = opts || {};
  const tier = o.tier || {};
  const group = new THREE.Group();
  group.name = 'effects';
  const show = !!o.show, tierName = o.tierName || 'low';
  /* a second car's effects (the rival's, briefs/RIVALS.md): its pools are share of the player's, and the rain is the player's alone */
  const share = o.share || 1, size = n => Math.max(8, Math.round(n * share));
  const soft = softSprite(THREE, 128, true), spark = sparkSprite(THREE, 32), drop = rainSprite(THREE);
  const puff = show ? puffSprite(THREE, 128) : null;
  const smoke = createParticles(THREE, show ? { max: size(SHOW.SMOKE.POOL[tierName] || SHOW.SMOKE.POOL.low), texture: puff, colour: 0xffffff, tint: true, name: 'smoke', renderOrder: 4 } : { max: tier.smoke || 60, texture: soft, colour: 0xd0c8c0, name: 'smoke', renderOrder: 4 });
  const dust = createParticles(THREE, { max: tier.dust || 40, texture: soft, colour: FX.DUST_COLOUR, name: 'dust', renderOrder: 4 });
  const sparks = createParticles(THREE, show ? { max: size(SHOW.SPARKS.POOL[tierName] || SHOW.SPARKS.POOL.low), texture: spark, colour: SHOW.SPARKS.COLOUR, additive: true, name: 'sparks', renderOrder: 5 } : { max: tier.sparks || 60, texture: spark, colour: 0xffd090, additive: true, name: 'sparks', renderOrder: 5 });
  const flame = createParticles(THREE, { max: show ? 72 : 24, texture: spark, colour: FX.FLAME_COLOUR, additive: true, name: 'flame', renderOrder: 5 });
  const rain = createParticles(THREE, { max: tier.rain || 150, texture: drop, colour: 0xdde4f0, additive: true, fog: false, name: 'rain', renderOrder: 6, opacity: FX.RAIN_ALPHA });
  for (const p of [smoke, dust, sparks, flame, rain]) group.add(p.mesh);
  let preset = o.preset || { windX: 0, windZ: 0, rain: false, smoke: 0xd0c8c0 };
  const wind = { x: 0, z: 0 };
  const due = { smokeL: 0, smokeR: 0, dust: 0, flame: 0, rain: 0, scrape: 0 };
  const rand = (a, b) => a + (b - a) * Math.random();   // decoration only: nothing here feeds the physics

  /* the show's smoke colours for the preset, linear, and the heat's tint */
  const col = { birth: [1, 1, 1], end: [1, 1, 1], tint: [1, 1, 1], spray: [1, 1, 1] };
  const lin = (hex, out) => { const c = new THREE.Color().setHex(hex); out[0] = c.r; out[1] = c.g; out[2] = c.b; return out; };
  lin(SHOW.SMOKE.HEAT_TINT, col.tint); lin(SHOW.SPRAY.COLOUR, col.spray);
  function setPreset(p) {
    preset = p; wind.x = p.windX || 0; wind.z = p.windZ || 0;
    if (show) { smoke.setColour(0xffffff); lin(SHOW.SMOKE.BIRTH[p.name] || SHOW.SMOKE.BIRTH.dusk, col.birth); lin(SHOW.SMOKE.COLOUR[p.name] || SHOW.SMOKE.COLOUR.dusk, col.end); }
    else smoke.setColour(p.smoke || 0xd0c8c0);
    if (!p.rain) rain.clear();
  }
  setPreset(preset);
  let density = 1;   // the adaptation's share of the spawn rates, 0 to 1
  const c0 = [0, 0, 0], c1 = [0, 0, 0];

  /* pose: the car {x, z, yaw}; world: the physics world; rig: { bRear,
     half } the rear axle from the physics origin; camera: for the rain
     and the billboards. */
  function update(dt, camera, pose, world, rig, heat, clear) {
    const c = world.car, by = pose.y || 0;   // the road's height under the car
    const h = heat || 0, S = SHOW.SMOKE, lp = (pair) => pair[0] + (pair[1] - pair[0]) * h;
    const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw), lz = Math.sin(pose.yaw);
    const sliding = c.rearSlide >= 0.9 || c.hb > 0.5 || c.spinning;
    const off = world.halfWidth !== undefined && world.ground.centre.length > 0 && Math.abs(world.lateral) > world.halfWidth;
    for (const [key, side] of [['smokeL', 1], ['smokeR', -1]]) {
      const wx = pose.x - fx * rig.bRear + lx * rig.half * side, wz = pose.z - fz * rig.bRear + lz * rig.half * side;
      if (off && c.speed > FX.DUST_MIN_SPEED) {
        due.dust += dt * FX.DUST_RATE * Math.min(1, c.speed / 15) * 0.5;
        while (due.dust >= 1) { due.dust -= 1; dust.spawn({ x: wx, y: by + 0.15, z: wz, vx: c.wvx * 0.3 + rand(-1, 1), vy: rand(0.8, 2.2), vz: c.wvz * 0.3 + rand(-1, 1), size: FX.DUST_SIZE, grow: FX.DUST_GROW, life: FX.DUST_LIFE * rand(0.7, 1.2), alpha: FX.DUST_ALPHA, drag: 2.5, rot: rand(0, 6.3), spin: rand(-1, 1) }); }
      } else if (show && sliding && c.speed > 1.5) {
        const strength = Math.min(1, Math.max(c.rearSlide / 2, c.hb, c.spinning ? 0.6 : 0, c.drifting ? 0.7 : 0));
        due[key] += dt * lp(S.RATE) * strength * density;
        const tk = S.HEAT_TINT_MAX * h;
        for (let k = 0; k < 3; k++) { c0[k] = col.birth[k] + (col.tint[k] - col.birth[k]) * tk; c1[k] = col.end[k] + (col.tint[k] - col.end[k]) * tk; }
        /* the way the tyres slide: the car's sideways velocity, along its lateral axis */
        const vlat = c.wvx * lx + c.wvz * lz, th = Math.sign(vlat) * Math.min(1, Math.abs(vlat) / 6) * lp(S.THROW);
        while (due[key] >= 1) {
          due[key] -= 1;
          const tk2 = th * rand(0.5, 1.2);
          smoke.spawn({ x: wx + rand(-0.15, 0.15), y: by + 0.25, z: wz + rand(-0.15, 0.15), vx: c.wvx * S.KEEP + lx * tk2 + rand(-0.7, 0.7), vy: S.RISE * rand(0.6, 1.4), vz: c.wvz * S.KEEP + lz * tk2 + rand(-0.7, 0.7), size: lp(S.SIZE) * rand(0.8, 1.15), grow: lp(S.GROW) * rand(0.8, 1.2), growDecay: S.GROW_DECAY, life: lp(S.LIFE) * rand(0.8, 1.2), alpha: lp(S.ALPHA) * (0.55 + 0.45 * strength), drag: S.DRAG, rot: rand(0, 6.3), spin: rand(-FX.SMOKE_SPIN, FX.SMOKE_SPIN), c0, c1 });
        }
      } else if (show && preset.rain && c.speed > SHOW.SPRAY.FROM) {
        /* the rain: spray off the tyres whenever the car is quick */
        const P = SHOW.SPRAY;
        due[key] += dt * P.RATE * Math.min(1, (c.speed - P.FROM) / 12) * density;
        while (due[key] >= 1) { due[key] -= 1; smoke.spawn({ x: wx + rand(-0.2, 0.2), y: by + 0.12, z: wz + rand(-0.2, 0.2), vx: c.wvx * 0.55 + rand(-1, 1), vy: rand(0.6, 1.8), vz: c.wvz * 0.55 + rand(-1, 1), size: P.SIZE, grow: P.GROW, life: P.LIFE * rand(0.7, 1.2), alpha: P.ALPHA, drag: 2.2, rot: rand(0, 6.3), spin: rand(-1, 1), c0: col.spray, c1: col.spray }); }
      } else if (sliding && c.speed > 1.5) {
        const strength = Math.min(1, Math.max(c.rearSlide / 2, c.hb, c.spinning ? 0.6 : 0));
        due[key] += dt * FX.SMOKE_RATE * strength;
        while (due[key] >= 1) {
          due[key] -= 1;
          smoke.spawn({ x: wx + rand(-0.15, 0.15), y: by + 0.3, z: wz + rand(-0.15, 0.15), vx: c.wvx * FX.SMOKE_KEEP + rand(-0.6, 0.6), vy: FX.SMOKE_RISE * rand(0.7, 1.3), vz: c.wvz * FX.SMOKE_KEEP + rand(-0.6, 0.6), size: FX.SMOKE_SIZE, grow: FX.SMOKE_GROW, life: FX.SMOKE_LIFE * rand(0.8, 1.2), alpha: FX.SMOKE_ALPHA * (0.6 + 0.4 * strength), drag: FX.SMOKE_DRAG, rot: rand(0, 6.3), spin: rand(-FX.SMOKE_SPIN, FX.SMOKE_SPIN) });
        }
      } else due[key] = 0;
    }
    /* sparks: a burst on a hit, a trickle while scraping */
    const hit = world.hit;
    if (hit && hit.speed >= FX.SPARK_MIN_HIT) {
      const k = Math.min(1, hit.speed / 12);
      const SC = show ? SHOW.SPARKS.COUNT : FX.SPARK_COUNT, SS = show ? SHOW.SPARKS.SPEED : FX.SPARK_SPEED;
      const n = Math.round((SC[0] + (SC[1] - SC[0]) * k) * (show ? density : 1));
      const nx = world.wallNx || 0, nz = world.wallNz || 0;
      for (let i = 0; i < n; i++) {
        const sp = rand(SS[0], SS[1]) * (0.5 + k);
        sparks.spawn({ x: hit.x, y: by + rand(0.2, 0.7), z: hit.z, vx: (nx * 0.6 + rand(-1, 1) + c.wvx * 0.08) * sp * 0.5, vy: rand(1, show ? 6 : 5), vz: (nz * 0.6 + rand(-1, 1) + c.wvz * 0.08) * sp * 0.5, size: (show ? SHOW.SPARKS.SIZE : FX.SPARK_SIZE) * rand(0.6, 1.4), life: (show ? SHOW.SPARKS.LIFE : FX.SPARK_LIFE) * rand(0.6, 1.4), gravity: FX.SPARK_GRAVITY, stretch: show ? SHOW.SPARKS.STRETCH : 2.5, drag: 0.5 });
      }
    } else if (world.touching && c.speed > 4) {
      due.scrape += dt * (show ? SHOW.SPARKS.SCRAPE * density : FX.SPARK_SCRAPE);
      while (due.scrape >= 1) { due.scrape -= 1; const nx = world.wallNx || 0, nz = world.wallNz || 0; const px = pose.x - nx * (rig.half + 0.2), pz = pose.z - nz * (rig.half + 0.2); sparks.spawn({ x: px, y: by + rand(0.1, 0.5), z: pz, vx: c.wvx * 0.5 + rand(-2, 2), vy: rand(0.5, 3), vz: c.wvz * 0.5 + rand(-2, 2), size: (show ? SHOW.SPARKS.SIZE : FX.SPARK_SIZE) * 0.8, life: (show ? SHOW.SPARKS.LIFE : FX.SPARK_LIFE) * 0.7, gravity: FX.SPARK_GRAVITY, stretch: show ? SHOW.SPARKS.STRETCH * 0.8 : 2, drag: 0.5 }); }
    } else due.scrape = 0;
    /* the exhaust while boosting: a flicker of flame low at the back */
    if (c.boost > 0 && c.speed > 2) {
      due.flame += dt * FX.FLAME_RATE;
      const ex = pose.x - fx * (rig.bRear + 0.6) + lx * 0.35, ez = pose.z - fz * (rig.bRear + 0.6) + lz * 0.35;
      while (due.flame >= 1) { due.flame -= 1; flame.spawn({ x: ex + rand(-0.05, 0.05), y: by + 0.3, z: ez + rand(-0.05, 0.05), vx: c.wvx * 0.6 - fx * rand(3, 6), vy: rand(0.2, 0.8), vz: c.wvz * 0.6 - fz * rand(3, 6), size: FX.FLAME_SIZE * rand(0.7, 1.4), life: FX.FLAME_LIFE * rand(0.7, 1.3), alpha: 0.9 }); }
    } else due.flame = 0;
    /* rain: born above the camera within a radius, falling with the wind */
    if (preset.rain && !o.noRain) {
      due.rain += dt * FX.RAIN_RATE * ((tier.rain || 150) / 150);
      const cp = camera.position;
      while (due.rain >= 1) { due.rain -= 1; const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * FX.RAIN_RADIUS; rain.spawn({ x: cp.x + Math.sin(a) * r + wind.x * 0.4, y: cp.y + rand(2, 7), z: cp.z + Math.cos(a) * r + wind.z * 0.4, vx: wind.x * 1.5, vy: -FX.RAIN_SPEED, vz: wind.z * 1.5, size: FX.RAIN_SIZE, stretch: FX.RAIN_STRETCH, life: FX.RAIN_LIFE, alpha: 1 }); }
    }
    smoke.update(dt, camera, wind, show ? clear : null);
    dust.update(dt, camera, wind);
    sparks.update(dt, camera, null);
    flame.update(dt, camera, null);
    if (preset.rain || rain.live()) rain.update(dt, camera, null);
  }
  function clear() { for (const p of [smoke, dust, sparks, flame, rain]) p.clear(); for (const k of Object.keys(due)) due[k] = 0; }
  return { group, update, setPreset, clear, setDensity: k => { density = Math.max(0, Math.min(1, k)); }, pools: { smoke, dust, sparks, flame, rain }, dispose() { for (const p of [smoke, dust, sparks, flame, rain]) p.dispose(); soft.dispose(); spark.dispose(); drop.dispose(); if (puff) puff.dispose(); } };
}
