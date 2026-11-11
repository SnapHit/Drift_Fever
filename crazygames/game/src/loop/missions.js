/* TRACK MISSIONS. Every career track and the daily drift get three
   missions, chosen deterministically from the track (its seed and its
   features) out of six kinds: hold one drift for N seconds, bank a chain
   of N points, a clean lap (circuits) or a clean run (sprints), clip N
   clipping zones, finish under a time, reach a multiplier of xN. Targets
   scale with the track (LOOP.MISSIONS).

   The judge reads the simulation and the scoring state once per physics
   step and nothing else, so a replay of the same input tape completes
   the same missions at the same steps. It freezes when the run finishes,
   so the settle after the line, which runs in frame time, cannot change
   it. Pure data and arithmetic; no DOM. */
import { TUNE, LOOP } from '../tune.js';
import { starTargets, runMetres } from './modes.js';
import { STEP } from '../physics/world.js';

export const KINDS = ['hold', 'chain', 'clean', 'clip', 'time', 'mult'];

/* sfc32, seeded from the track's seed, so the three are the same for
   everyone on the same track. */
function rng32(seed) {
  let a = 0x6d1551 ^ seed, b = 0x243f6a88, c = 0xb7e15162, d = seed >>> 0;
  function next() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  for (let i = 0; i < 12; i++) next();
  return next;
}

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

/* Every mission the track could carry, with its target: [{ kind, target, text }]. */
export function allMissionsFor(track, laps) {
  const M = LOOP.MISSIONS;
  const circuit = track.kind === 'circuit';
  const d = track.requested && track.requested.difficulty !== undefined ? track.requested.difficulty : 0.5;
  const first = starTargets(track, laps)[0];
  const metres = runMetres(track, laps);
  const corners = track.corners || [];
  let longest = 0;
  for (const c of corners) longest = Math.max(longest, c.to - c.from);
  const clips = (track.clips || []).length;
  const all = [];
  if (longest > 0) all.push({ kind: 'hold', target: clamp(Math.round(longest / M.HOLD_SPEED * M.HOLD_SHARE), M.HOLD_RANGE[0], M.HOLD_RANGE[1]) });
  all.push({ kind: 'chain', target: Math.max(M.CHAIN_MIN, Math.round(first * M.CHAIN_SHARE / 10) * 10) });
  all.push({ kind: 'clean', target: circuit ? 1 : 0 });
  if (clips >= 2) all.push({ kind: 'clip', target: Math.max(2, Math.round(clips * M.CLIP_SHARE)) });
  all.push({ kind: 'time', target: Math.round(metres / TUNE.SCORING.PAR_SPEED * M.TIME_FACTOR) });
  all.push({ kind: 'mult', target: d > 0.5 ? M.MULT[1] : M.MULT[0] });
  return all.map(m => ({ ...m, text: textFor(m, circuit) }));
}

/* The three missions for a track run of laps laps, by a seeded shuffle
   of everything it could carry. */
export function missionsFor(track, laps) {
  const all = allMissionsFor(track, laps);
  const next = rng32((track.seed >>> 0) ^ (track.kind === 'circuit' ? 0x3a9 : 0x5c1));
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = all[i]; all[i] = all[j]; all[j] = t; }
  return all.slice(0, 3);
}

export function textFor(m, circuit) {
  switch (m.kind) {
    case 'hold': return 'Hold one drift for ' + m.target + ' s';
    case 'chain': return 'Bank a chain of ' + m.target + ' points';
    case 'clean': return m.target ? 'Drive a clean lap' : 'Drive a clean run';
    case 'clip': return 'Slide close to ' + m.target + ' orange walls';   // a clipping zone, in the player's words (after play, 11 November 2026: nothing said what one was)
    case 'time': return 'Finish under ' + m.target + ' s';
    case 'mult': return 'Reach a x' + m.target + ' multiplier';
  }
  return '';
}

/* The judge for one run. step() after the world, the scoring, the
   progress and the race have stepped; finish(runTime) at the line. */
export function createMissionJudge(missions, track, laps) {
  const n = missions.length;
  const circuit = track.kind === 'circuit';
  const cps = (track.checkpoints || []).length, perLap = cps + 1, sectors = circuit ? laps * perLap : perLap;
  const st = { done: missions.map(() => false), doneAt: missions.map(() => -1), progress: missions.map(() => 0), completed: 0, events: [], frozen: false, holdT: 0, clipped: [], sectorsSeen: 0, cleanSeen: 0, lapClean: [] };
  function reset() {
    for (let i = 0; i < n; i++) { st.done[i] = false; st.doneAt[i] = -1; st.progress[i] = 0; }
    st.completed = 0; st.events.length = 0; st.frozen = false; st.holdT = 0; st.clipped.length = 0; st.sectorsSeen = 0; st.cleanSeen = 0; st.lapClean.length = 0;
  }
  function complete(i, step) { if (st.done[i]) return; st.done[i] = true; st.doneAt[i] = step; st.completed++; st.events.push(i); }
  function step(world, scoring, race, progress) {
    if (st.frozen) return;
    const s = scoring, r = race ? race.state : null;
    /* one continuous slide: scoring this step (the gap is zero while it scores) */
    if (s.drifting && s.gap === 0) st.holdT += STEP; else st.holdT = 0;
    /* a clipping zone drifted close to */
    if (s.near && world.nearestClip) { const k = track.clips.indexOf(world.nearestClip); if (k >= 0 && !st.clipped.includes(k)) st.clipped.push(k); }
    /* sectors as they complete, clean or not, by lap */
    if (r) {
      while (st.sectorsSeen < r.done) {
        const clean = r.clean > st.cleanSeen;
        if (clean) st.cleanSeen++;
        const lap = Math.floor(st.sectorsSeen / perLap);
        st.lapClean[lap] = (st.lapClean[lap] || 0) + (clean ? 1 : 0);
        st.sectorsSeen++;
      }
    }
    for (let i = 0; i < n; i++) {
      if (st.done[i]) continue;
      const m = missions[i];
      let p = 0;
      switch (m.kind) {
        case 'hold': p = st.holdT; if (st.holdT >= m.target - 1e-9) complete(i, world.step); break;
        case 'chain': p = s.best; if (s.best >= m.target) complete(i, world.step); break;
        case 'clean':
          if (circuit) { let best = 0; for (let l = 0; l < st.lapClean.length; l++) best = Math.max(best, st.lapClean[l] || 0); p = best; if (st.lapClean.some(v => v >= perLap)) complete(i, world.step); }
          else { p = st.cleanSeen; if (st.sectorsSeen >= sectors && st.cleanSeen >= sectors) complete(i, world.step); }
          break;
        case 'clip': p = st.clipped.length; if (st.clipped.length >= m.target) complete(i, world.step); break;
        case 'mult': p = s.mult; if (s.mult >= m.target) complete(i, world.step); break;
        case 'time': p = 0; break;   // judged at the finish
      }
      if (p > st.progress[i]) st.progress[i] = p;
    }
    if (progress && progress.finished) finish(world.step * STEP, world.step);
  }
  /* at the line: the time mission, then nothing more changes */
  function finish(seconds, stepNo) {
    if (st.frozen) return;
    for (let i = 0; i < n; i++) { if (missions[i].kind === 'time') { st.progress[i] = seconds; if (seconds <= missions[i].target) complete(i, stepNo === undefined ? -1 : stepNo); } }
    st.frozen = true;
  }
  reset();
  return { missions, state: st, step, finish, reset };
}

/* The mission tally of a save: missions done over the career tracks. */
export function missionTally(state, careerLength) {
  let n = 0;
  for (let i = 0; i < careerLength; i++) { const e = state.missions && state.missions['career:' + i]; if (e) for (const v of e) if (v) n++; }
  return n;
}
