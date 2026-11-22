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
import { TUNE, PROFILES } from '../tune.js';
import { carTune } from '../garage/roster.js';

export const EASY = Object.freeze({ controls: 'easy' });

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
  const base = carTune(carId, up);
  const P = profile && profile.controls === 'pro' ? proVariant(profile.variant) : null;
  if (!P) return base;
  const bv = base ? base.VEHICLE : TUNE.VEHICLE, ba = base ? base.ASSIST : TUNE.ASSIST;
  const V = Object.assign(Object.create(bv), P.VEHICLE || {}), A = Object.assign(Object.create(ba), P.ASSIST || {});
  for (const k of Object.keys(P.SCALE || {})) {
    if (k in TUNE.VEHICLE) V[k] = bv[k] * P.SCALE[k];
    else if (k in TUNE.ASSIST) A[k] = ba[k] * P.SCALE[k];
  }
  return { VEHICLE: V, ASSIST: A };
}

/* What a ghost keeps of a profile: nothing on Easy (a ghost with no
   profile is Easy, as every ghost before this round is), else the
   variant and its revision. */
export function ghostFields(profile) {
  if (!profile || profile.controls !== 'pro') return {};
  return { controls: 'pro', variant: profile.variant, prorev: proVariant(profile.variant).rev };
}
