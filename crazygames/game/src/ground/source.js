/* WHERE TRACKS COME FROM. The game asks for a track by a spec,
   { seed, kind, difficulty, length }, and gets one in the data contract
   of briefs/TRACKS.md. Until the generator (another session, folder
   ../tracks/) is merged, every spec is answered with the hand made test
   track, dressed with the fields the generator promises and the game
   reads (startLine, checkpoints, finish, seed, name). The real one drops
   in by the import at GENERATOR below.

   dailySeed(date) is the generator's contract too: the same seed for the
   same local calendar date everywhere. The stand-in is the FNV-1a hash
   the TRACKS brief's implementation uses, so the daily key does not
   change when the generator lands. */
import { testTrack, carPark } from './track.js';
import { LOOP } from '../tune.js';

/* The generator, when merged: import { generateTrack, dailySeed } from '../tracks/generate.js' */
const GENERATOR = null;

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
export function trackFor(spec) {
  const s = spec || {};
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
  return t;
}

export function freeGround() { return carPark(); }
