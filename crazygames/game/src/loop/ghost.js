/* THE GHOST. The best run of a track, replayed from its recorded input
   tape through a second physics world in lockstep with the player's: one
   ghost step for every player step, from the same start, with the car
   the run was recorded in. The physics is deterministic, so the ghost
   drives exactly the run it was recorded from. When the tape runs out
   the ghost stops where it finished. Nothing here draws; the scene is
   handed an interpolated pose. */
import { createWorld } from '../physics/world.js';
import { carTune } from '../garage/roster.js';

export function createGhost(track, record) {
  const world = createWorld(track, { tune: carTune(record.car) });
  const tape = record.tape;
  const g = { record, world, entry: 0, left: 0, done: false, steps: 0, prev: { x: world.car.x, z: world.car.z, yaw: world.car.yaw } };
  const inp = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
  function reset() {
    world.reset(); g.entry = 0; g.left = tape.length ? tape[0][0] : 0; g.done = !tape.length; g.steps = 0;
    g.prev.x = world.car.x; g.prev.z = world.car.z; g.prev.yaw = world.car.yaw;
  }
  function step() {
    if (g.done) return;
    const c = world.car;
    g.prev.x = c.x; g.prev.z = c.z; g.prev.yaw = c.yaw;
    const e = tape[g.entry];
    inp.steer = e[1]; inp.throttle = e[2]; inp.brake = e[3]; inp.handbrake = e[4];
    world.stepWorld(inp);
    g.steps++;
    if (--g.left <= 0) { g.entry++; if (g.entry >= tape.length) g.done = true; else g.left = tape[g.entry][0]; }
  }
  /* The pose alpha of the way from the last step to this one. */
  function pose(alpha, out) {
    const c = world.car, p = g.prev;
    let dy = c.yaw - p.yaw; if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
    out.x = p.x + (c.x - p.x) * alpha; out.z = p.z + (c.z - p.z) * alpha; out.yaw = p.yaw + dy * alpha; out.car = c;
    return out;
  }
  reset();
  return { state: g, world, reset, step, pose, hash: () => world.hash() };
}

/* A run's tape (the recorder's run length entries) as the compact form
   the save keeps. */
export function compactTape(tape) { return tape.map(e => [e.n, e.s, e.t, e.b, e.h]); }
