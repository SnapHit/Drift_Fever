/* THE ROSTER: the five cars as the game knows them. Each has an id (the
   same ids the car models in ../cars/ use, so a model drops in by id), a
   name, its character in a few words, a price in coins, its own paint,
   the body dimensions the stand-in block car is drawn to, and its
   handling: a small set of overrides of TUNE.VEHICLE and TUNE.ASSIST. The
   starter has none, so the starter is the author's tune exactly.

   carTune(id) builds the pair the physics reads: objects whose
   prototypes are TUNE.VEHICLE and TUNE.ASSIST with the overrides as own
   properties, so a ?tune=1 slider still reaches every constant a car
   does not override, and the overrides are the whole difference.

   None of these is balanced; they are characters for the author to play.
   The dimensions follow the car models' specs (length, wheelbase, track,
   wheel radius) so the physics box matches what is drawn. */
import { TUNE } from '../tune.js';

export const PAINTS = [
  { id: 'cyan',    hex: 0x19d8ff, name: 'cyan' },
  { id: 'amber',   hex: 0xffb81c, name: 'amber' },
  { id: 'wine',    hex: 0x8c1f3a, name: 'wine' },
  { id: 'flame',   hex: 0xe8452c, name: 'flame' },
  { id: 'magenta', hex: 0xff2d8a, name: 'magenta' },
  { id: 'lime',    hex: 0x9be31c, name: 'lime' },
  { id: 'white',   hex: 0xeef1f7, name: 'white' },
  { id: 'night',   hex: 0x23252e, name: 'night' },
];

export const ROSTER = [
  {
    id: 'starter', name: 'Starter coupe', character: 'Compact and balanced. Friendly.',
    price: 0, paint: 'cyan',
    dims: { length: 4.36, width: 1.83, wheelbase: 2.55, track: 1.60, wheelRadius: 0.33 },
    handling: { VEHICLE: {}, ASSIST: {} },
  },
  {
    id: 'hatch', name: 'Light hatch', character: 'Small and twitchy. Turns in a flash, slides early.',
    price: 900, paint: 'amber',
    dims: { length: 3.68, width: 1.70, wheelbase: 2.32, track: 1.48, wheelRadius: 0.30 },
    handling: {
      VEHICLE: { MASS: 1020, WHEELBASE: 2.32, CG_TO_FRONT: 1.14, TRACK: 1.48, HALF_LENGTH: 1.84, HALF_WIDTH: 0.85, WHEEL_RADIUS: 0.30, INERTIA_FACTOR: 0.95, ACCEL: 11.5, TOP_SPEED: 55, STEER_RATE: 4.2, STEER_RETURN: 6.0, LOCK: 35 },
      ASSIST: { DRIFT_EASE_IN: 70, DRIFT_CRUISE: 18 },
    },
  },
  {
    id: 'tourer', name: 'Grand tourer', character: 'Long, wide and heavy. Smooth, holds a slide forever.',
    price: 1800, paint: 'wine',
    dims: { length: 4.80, width: 1.90, wheelbase: 2.86, track: 1.66, wheelRadius: 0.35 },
    handling: {
      VEHICLE: { MASS: 1620, WHEELBASE: 2.86, CG_TO_FRONT: 1.40, TRACK: 1.66, HALF_LENGTH: 2.40, HALF_WIDTH: 0.95, WHEEL_RADIUS: 0.35, INERTIA_FACTOR: 1.30, ACCEL: 11, TOP_SPEED: 64, STEER_RATE: 2.6, STEER_RETURN: 4.0, LOCK: 30 },
      ASSIST: { DRIFT_EASE_IN: 38, DRIFT_DAMP: 11, DRIFT_SCRUB: 7, DRIFT_CRUISE: 22 },
    },
  },
  {
    id: 'fastback', name: 'Fastback', character: 'Raw power. Fast everywhere, wants a firm hand.',
    price: 3200, paint: 'flame',
    dims: { length: 4.70, width: 1.92, wheelbase: 2.76, track: 1.62, wheelRadius: 0.35 },
    handling: {
      VEHICLE: { MASS: 1480, WHEELBASE: 2.76, CG_TO_FRONT: 1.32, TRACK: 1.62, HALF_LENGTH: 2.35, HALF_WIDTH: 0.96, WHEEL_RADIUS: 0.35, INERTIA_FACTOR: 1.15, ACCEL: 14.5, TOP_SPEED: 70, TURN_LIFT: 0.75 },
      ASSIST: { DRIFT_CRUISE: 24, DRIFT_SCRUB: 8 },
    },
  },
  {
    id: 'driftbuild', name: 'Drift build', character: 'Low, wide and aggressive. The biggest angles.',
    price: 6000, paint: 'magenta',
    dims: { length: 4.48, width: 2.00, wheelbase: 2.62, track: 1.70, wheelRadius: 0.34 },
    handling: {
      VEHICLE: { MASS: 1280, WHEELBASE: 2.62, CG_TO_FRONT: 1.30, TRACK: 1.70, HALF_LENGTH: 2.24, HALF_WIDTH: 1.00, WHEEL_RADIUS: 0.34, INERTIA_FACTOR: 1.08, ACCEL: 13, TOP_SPEED: 66, LOCK: 36, STEER_RATE: 3.6 },
      ASSIST: { DRIFT_ANGLE: 34, DRIFT_RANGE: 20, ANGLE_LIMIT: 64, DRIFT_CRUISE: 23, DRIFT_SCRUB: 8 },
    },
  },
];

export function carById(id) { return ROSTER.find(c => c.id === id) || ROSTER[0]; }
export function paintById(id) { return PAINTS.find(p => p.id === id) || PAINTS[0]; }

/* The handling the physics reads for a car. The starter returns null,
   which the physics takes as TUNE itself. */
export function carTune(id) {
  const c = carById(id);
  const hv = c.handling.VEHICLE || {}, ha = c.handling.ASSIST || {};
  if (!Object.keys(hv).length && !Object.keys(ha).length) return null;
  return { VEHICLE: Object.assign(Object.create(TUNE.VEHICLE), hv), ASSIST: Object.assign(Object.create(TUNE.ASSIST), ha) };
}

/* The box the physics and the camera use for a car. */
export function carBox(id) {
  const c = carById(id), hv = c.handling.VEHICLE || {};
  return { halfLength: hv.HALF_LENGTH || TUNE.VEHICLE.HALF_LENGTH, halfWidth: hv.HALF_WIDTH || TUNE.VEHICLE.HALF_WIDTH, height: 1.45 };
}
