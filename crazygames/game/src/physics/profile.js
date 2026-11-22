/* THE PLAYER'S HANDLING PROFILE (briefs/PRO-CONTROLS.md, 22 November
   2026). Easy is the game as it always was: the car as the garage tunes
   it, carTune's pair or null for the plain starter. Pro layers one of
   PROFILES.PRO's variants over that pair the way the roster layers a car
   over TUNE: objects whose prototypes are the car's own, with the
   variant's numbers as own properties, so the ?tune=1 panel still reaches
   every number the variant does not set, a car keeps its character
   everywhere else, and a grip or steering upgrade still counts through
   SCALE. Only the player's car is ever given a profile: rivals build
   their own tune and never come here.

   A profile is { controls: 'easy' } or { controls: 'pro', variant }, and
   a ghost records one of those, so it replays with the handling it was
   driven with (loop/ghost.js). */
import { TUNE, PROFILES, FIRST } from '../tune.js';
import { carTune } from '../garage/roster.js';
import { FIRST_ON } from '../first.js';

export const EASY = Object.freeze({ controls: 'easy' });

/* A set of numbers layered over a handling pair (or TUNE itself for
   null): VEHICLE and ASSIST set a number, SCALE multiplies the pair's
   own. A Pro variant is layered so, and the first minute's starter. */
function layer(base, X) {
  const bv = base ? base.VEHICLE : TUNE.VEHICLE, ba = base ? base.ASSIST : TUNE.ASSIST;
  const V = Object.assign(Object.create(bv), X.VEHICLE || {}), A = Object.assign(Object.create(ba), X.ASSIST || {});
  for (const k of Object.keys(X.SCALE || {})) {
    if (k in TUNE.VEHICLE) V[k] = bv[k] * X.SCALE[k];
    else if (k in TUNE.ASSIST) A[k] = ba[k] * X.SCALE[k];
  }
  return { VEHICLE: V, ASSIST: A };
}

/* Is this the first minute's starter (briefs/FIRST-MINUTE.md): the
   player's starter coupe with ?first=2, driven on Easy (every touch run,
   and a keyboard or a pad on Easy). Pro keeps the starter as it was:
   under Pro's throttle the kind wall turned into riding the walls
   (review/first/REPORT.md), and Pro's variants wait for the author's
   pick by play. Rivals never come here. */
export const firstStarter = (carId, profile) => FIRST_ON && carId === 'starter' && !(profile && profile.controls === 'pro');

/* The variant named, or null when it is not one. */
export function proVariant(v) { return PROFILES.PRO_VARIANTS.includes(v) ? PROFILES.PRO[v] : null; }

/* A profile from anything (a ghost record's fields, the address), Easy
   when it is not a whole Pro one. */
export function profileOf(controls, variant) {
  return controls === 'pro' && proVariant(variant) ? { controls: 'pro', variant } : EASY;
}

/* The handling the physics reads for the player's car, upgrades and
   profile. Easy returns exactly carTune's answer, the same object shape
   the game always built, so nothing about an Easy run changes. */
export function handlingFor(carId, up, profile) {
  let base = carTune(carId, up);
  /* the first minute's starter, on Easy (briefs/FIRST-MINUTE.md) */
  if (firstStarter(carId, profile)) base = layer(base, FIRST);
  const P = profile && profile.controls === 'pro' ? proVariant(profile.variant) : null;
  if (!P) return base;
  return layer(base, P);
}

/* What a ghost keeps of a profile: nothing on Easy (a ghost with no
   profile is Easy, as every ghost before this round is), else the
   variant and its revision. */
export function ghostFields(profile) {
  if (!profile || profile.controls !== 'pro') return {};
  return { controls: 'pro', variant: profile.variant, prorev: proVariant(profile.variant).rev };
}
