/* THE FIVE CARS. createCar(THREE, id, options) is the whole contract:

     { group, body, wheels: { fl, fr, rl, rr }, lights, setPaint(colour),
       setUnderglow(colour or null), dims }

   Units metres, Y up, the car facing -Z, its origin on the ground at the
   middle of the wheelbase. Each wheel is { pivot, mesh }: steer the
   pivot (rotation.y), spin the mesh (rotation.x). lights.head and
   lights.tail are meshes with emissive materials, and lights.set(head,
   tail) switches them, 0 off and 1 on. dims are measured from what is
   drawn (length, width, height, and their halves) plus the wheelbase,
   track, wheel radius and axle positions the car was built to.

   options: { paint, underglow } as 0xRRGGBB numbers, both optional.
   THREE is passed in, so the game, the lab and the probes each use their
   own copy. Every car is an original design, built here from numbers,
   with nothing downloaded and no textures. */
import { buildCar } from './build.js';
import starter from './starter.js';
import hatch from './hatch.js';
import tourer from './tourer.js';
import fastback from './fastback.js';
import driftbuild from './driftbuild.js';

const SPECS = [starter, hatch, tourer, fastback, driftbuild];
const BY_ID = Object.fromEntries(SPECS.map(s => [s.id, s]));

/* The five in order, for a garage or a picker. */
export const CARS = SPECS.map(s => ({ id: s.id, label: s.label, character: s.character, paint: s.paint }));

export function createCar(THREE, id, options) {
  const spec = BY_ID[id];
  if (!spec) throw new Error('no car called ' + id);
  return buildCar(THREE, spec, options || {});
}

/* For the probes: the numbers a car is built from. */
export function carSpec(id) { return BY_ID[id]; }
