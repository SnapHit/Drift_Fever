/* WHERE TRACKS COME FROM. The game asks for a track by a spec,
   { seed, kind, difficulty, length }, and gets one in the data contract
   of briefs/TRACKS.md from the generator in ../tracks/ (merged 31
   October 2026). The hand made test track stood in before that, and
   still can: set GENERATOR to null and every spec is answered with it,
   dressed with the fields the generator promises and the game reads.

   The physics and the scene are flat, so generated tracks are asked for
   with elevation 0 until the car follows the road's height. A track is
   generated once per run (the worst case measured by the track session
   is about half a second). */
import { testTrack, carPark } from './track.js';
import { LOOP } from '../tune.js';
import * as generator from '../tracks/generate.js';

const GENERATOR = generator;

export const STAND_IN = !GENERATOR;

function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/* YYYY-MM-DD in local time, the daily's key. */
export function localDate(date) {
  const d = date || new Date();
  const m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

export function dailySeed(date) {
  if (GENERATOR) return GENERATOR.dailySeed(date);
  return hashString('drift-fever daily ' + localDate(date));
}

/* A track for a spec. The result always has: kind, length, centre,
   walls, clips, start, startLine, checkpoints (at least one per lap),
   finish (sprints), bounds, sections, cones, seed, name. */
let memo = null;   // the last track generated, so going again does not generate it twice
export function trackFor(spec) {
  const s = spec || {};
  const memoKey = [s.seed, s.kind, s.difficulty, s.length].join('|');
  if (memo && memo.key === memoKey) return memo.track;
  let t;
  if (GENERATOR) {
    /* The physics and the scene are flat: the generator's elevation and
       bank are asked off until they are. */
    t = GENERATOR.generateTrack(s.seed, { kind: s.kind, difficulty: s.difficulty, length: s.length, elevation: 0 });
  } else {
    t = testTrack();
    t.seed = s.seed >>> 0;
    t.name = 'test track';
    t.standIn = true;
  }
  if (t.startLine === undefined) t.startLine = 8;
  if (!t.checkpoints || !t.checkpoints.length) {
    const n = LOOP.CHECKPOINTS;
    t.checkpoints = [];
    for (let k = 1; k <= n; k++) t.checkpoints.push(Math.round(t.length * k / (n + 1) / 2) * 2);
  }
  if (t.finish === undefined) t.finish = null;
  if (!t.sections) t.sections = {};
  if (!t.cones) t.cones = [];
  memo = { key: memoKey, track: t };
  return t;
}

export function freeGround() { return carPark(); }
