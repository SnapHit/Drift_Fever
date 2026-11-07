/* THE EFFECTS: tyre smoke off the rear wheels while they slide, soft
   and lit by the preset's light and carried by its wind; dust when the
   car is off the asphalt; sparks when it hits a wall; an exhaust flame
   while boosting; and rain around the camera in the rain preset. Five
   particle pools, five draw calls at most, with pool sizes by tier.
   Every number of taste is in FX. */
import { createParticles } from './particles.js';
import { softSprite, sparkSprite, rainSprite } from './textures.js';

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
  const soft = softSprite(THREE, 128, true), spark = sparkSprite(THREE, 32), drop = rainSprite(THREE);
  const smoke = createParticles(THREE, { max: tier.smoke || 60, texture: soft, colour: 0xd0c8c0, name: 'smoke', renderOrder: 4 });
  const dust = createParticles(THREE, { max: tier.dust || 40, texture: soft, colour: FX.DUST_COLOUR, name: 'dust', renderOrder: 4 });
  const sparks = createParticles(THREE, { max: tier.sparks || 60, texture: spark, colour: 0xffd090, additive: true, name: 'sparks', renderOrder: 5 });
  const flame = createParticles(THREE, { max: 24, texture: spark, colour: FX.FLAME_COLOUR, additive: true, name: 'flame', renderOrder: 5 });
  const rain = createParticles(THREE, { max: tier.rain || 150, texture: drop, colour: 0xdde4f0, additive: true, fog: false, name: 'rain', renderOrder: 6, opacity: FX.RAIN_ALPHA });
  for (const p of [smoke, dust, sparks, flame, rain]) group.add(p.mesh);
  let preset = o.preset || { windX: 0, windZ: 0, rain: false, smoke: 0xd0c8c0 };
  const wind = { x: 0, z: 0 };
  const due = { smokeL: 0, smokeR: 0, dust: 0, flame: 0, rain: 0, scrape: 0 };
  const rand = (a, b) => a + (b - a) * Math.random();   // decoration only: nothing here feeds the physics

  function setPreset(p) { preset = p; wind.x = p.windX || 0; wind.z = p.windZ || 0; smoke.setColour(p.smoke || 0xd0c8c0); if (!p.rain) rain.clear(); }
  setPreset(preset);

  /* pose: the car {x, z, yaw}; world: the physics world; rig: { bRear,
     half } the rear axle from the physics origin; camera: for the rain
     and the billboards. */
  function update(dt, camera, pose, world, rig) {
    const c = world.car, by = pose.y || 0;   // the road's height under the car
    const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), lx = -Math.cos(pose.yaw), lz = Math.sin(pose.yaw);
    const sliding = c.rearSlide >= 0.9 || c.hb > 0.5 || c.spinning;
    const off = world.halfWidth !== undefined && world.ground.centre.length > 0 && Math.abs(world.lateral) > world.halfWidth;
    for (const [key, side] of [['smokeL', 1], ['smokeR', -1]]) {
      const wx = pose.x - fx * rig.bRear + lx * rig.half * side, wz = pose.z - fz * rig.bRear + lz * rig.half * side;
      if (off && c.speed > FX.DUST_MIN_SPEED) {
        due.dust += dt * FX.DUST_RATE * Math.min(1, c.speed / 15) * 0.5;
        while (due.dust >= 1) { due.dust -= 1; dust.spawn({ x: wx, y: by + 0.15, z: wz, vx: c.wvx * 0.3 + rand(-1, 1), vy: rand(0.8, 2.2), vz: c.wvz * 0.3 + rand(-1, 1), size: FX.DUST_SIZE, grow: FX.DUST_GROW, life: FX.DUST_LIFE * rand(0.7, 1.2), alpha: FX.DUST_ALPHA, drag: 2.5, rot: rand(0, 6.3), spin: rand(-1, 1) }); }
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
      const n = Math.round(FX.SPARK_COUNT[0] + (FX.SPARK_COUNT[1] - FX.SPARK_COUNT[0]) * k);
      const nx = world.wallNx || 0, nz = world.wallNz || 0;
      for (let i = 0; i < n; i++) {
        const sp = rand(FX.SPARK_SPEED[0], FX.SPARK_SPEED[1]) * (0.5 + k);
        sparks.spawn({ x: hit.x, y: by + rand(0.2, 0.7), z: hit.z, vx: (nx * 0.6 + rand(-1, 1) + c.wvx * 0.08) * sp * 0.5, vy: rand(1, 5), vz: (nz * 0.6 + rand(-1, 1) + c.wvz * 0.08) * sp * 0.5, size: FX.SPARK_SIZE * rand(0.6, 1.4), life: FX.SPARK_LIFE * rand(0.6, 1.4), gravity: FX.SPARK_GRAVITY, stretch: 2.5, drag: 0.5 });
      }
    } else if (world.touching && c.speed > 4) {
      due.scrape += dt * FX.SPARK_SCRAPE;
      while (due.scrape >= 1) { due.scrape -= 1; const nx = world.wallNx || 0, nz = world.wallNz || 0; const px = pose.x - nx * (rig.half + 0.2), pz = pose.z - nz * (rig.half + 0.2); sparks.spawn({ x: px, y: by + rand(0.1, 0.5), z: pz, vx: c.wvx * 0.5 + rand(-2, 2), vy: rand(0.5, 3), vz: c.wvz * 0.5 + rand(-2, 2), size: FX.SPARK_SIZE * 0.8, life: FX.SPARK_LIFE * 0.7, gravity: FX.SPARK_GRAVITY, stretch: 2, drag: 0.5 }); }
    } else due.scrape = 0;
    /* the exhaust while boosting: a flicker of flame low at the back */
    if (c.boost > 0 && c.speed > 2) {
      due.flame += dt * FX.FLAME_RATE;
      const ex = pose.x - fx * (rig.bRear + 0.6) + lx * 0.35, ez = pose.z - fz * (rig.bRear + 0.6) + lz * 0.35;
      while (due.flame >= 1) { due.flame -= 1; flame.spawn({ x: ex + rand(-0.05, 0.05), y: by + 0.3, z: ez + rand(-0.05, 0.05), vx: c.wvx * 0.6 - fx * rand(3, 6), vy: rand(0.2, 0.8), vz: c.wvz * 0.6 - fz * rand(3, 6), size: FX.FLAME_SIZE * rand(0.7, 1.4), life: FX.FLAME_LIFE * rand(0.7, 1.3), alpha: 0.9 }); }
    } else due.flame = 0;
    /* rain: born above the camera within a radius, falling with the wind */
    if (preset.rain) {
      due.rain += dt * FX.RAIN_RATE * ((tier.rain || 150) / 150);
      const cp = camera.position;
      while (due.rain >= 1) { due.rain -= 1; const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * FX.RAIN_RADIUS; rain.spawn({ x: cp.x + Math.sin(a) * r + wind.x * 0.4, y: cp.y + rand(2, 7), z: cp.z + Math.cos(a) * r + wind.z * 0.4, vx: wind.x * 1.5, vy: -FX.RAIN_SPEED, vz: wind.z * 1.5, size: FX.RAIN_SIZE, stretch: FX.RAIN_STRETCH, life: FX.RAIN_LIFE, alpha: 1 }); }
    }
    smoke.update(dt, camera, wind);
    dust.update(dt, camera, wind);
    sparks.update(dt, camera, null);
    flame.update(dt, camera, null);
    if (preset.rain || rain.live()) rain.update(dt, camera, null);
  }
  function clear() { for (const p of [smoke, dust, sparks, flame, rain]) p.clear(); for (const k of Object.keys(due)) due[k] = 0; }
  return { group, update, setPreset, clear, pools: { smoke, dust, sparks, flame, rain }, dispose() { for (const p of [smoke, dust, sparks, flame, rain]) p.dispose(); soft.dispose(); spark.dispose(); drop.dispose(); } };
}
