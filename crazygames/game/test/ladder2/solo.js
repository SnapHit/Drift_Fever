/* A MEASURING PLAYER ALONE (briefs/RIVALS-LADDER-2.md priority 1), in
   Node: one scripted player (rivals/players.js) drives a career track
   over a race's laps in a car, from the player's place on the grid, with
   no rival anywhere, by the host's per step code for a run (the world,
   the scoring, the progress, the clean sectors and the pace), and only
   a player's hands. It reports what the brief asks of a measuring
   player: did it finish, respawns, hard hits, wall contacts, its time,
   its points by part, and the share of each corner it spent sliding
   (scoring), as the rival's measure does (rivals/sim.js). */
import { createWorld, STEP } from '../../src/physics/world.js';
import { createScoring } from '../../src/scoring/drift.js';
import { createProgress } from '../../src/loop/progress.js';
import { createRace } from '../../src/scoring/race.js';
import { gridStart } from '../../src/rivals/rival.js';
import { createPlayer, PLAYERS } from '../../src/rivals/players.js';
import { carTune } from '../../src/garage/roster.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec } from '../../src/loop/modes.js';

const q = r => ({ steer: Math.round(r.steer * 1000) / 1000, throttle: Math.round(r.throttle * 100) / 100, brake: Math.round(r.brake * 100) / 100, handbrake: r.handbrake ? 1 : 0 });
const tracks = new Map();
export function careerTrack(index) { if (!tracks.has(index)) tracks.set(index, trackFor(careerSpec(index))); return tracks.get(index); }

/* where: { index, laps, car, up, side (the rival's grid side; the player takes the other) };
   drive: the player's numbers (none: PLAYERS.AT for this place, else its own);
   opts: { offset [dx, dz] on its start, maxSeconds } */
export function soloPlayer(where, kind, drive, opts) {
  const o = opts || {};
  const track = careerTrack(where.index), laps = track.kind === 'circuit' ? where.laps : 1;
  const start = gridStart(track, -(where.side || 1));
  if (o.offset) { start.x += o.offset[0]; start.z += o.offset[1]; }
  const world = createWorld(Object.assign({}, track, { start }), { tune: carTune(where.car || 'starter', where.up || undefined) });
  const scoring = createScoring(), progress = createProgress(track, laps), race = createRace(track, laps, scoring);
  const p = drive ? createPlayer(track, kind, Object.assign({}, PLAYERS[kind].drive, drive), null) : createPlayer(track, kind, null, null, { index: where.index, car: where.car, up: where.up });
  const corners = [];
  for (let lap = 0; lap < laps; lap++) for (const c of track.corners) corners.push({ name: c.name + (laps > 1 ? ' L' + (lap + 1) : ''), radius: c.radius, from: c.from + lap * track.length, to: c.to + lap * track.length, t: 0, slide: 0, angleSum: 0 });
  let dist = track.start.along || 0, along = world.along, t = 0, respawns = 0, minV = Infinity, handsBroken = 0, finished = false;
  const L = track.length, limit = Math.round((o.maxSeconds || 240) / STEP);
  for (let i = 0; i < limit; i++) {
    const inp = q(p.input(world));
    if (inp.throttle !== 1 || inp.brake !== 0) handsBroken++;
    world.stepWorld(inp);
    if (world.respawned) respawns++;
    let d = world.along - along; if (track.kind === 'circuit') { if (d < -L / 2) d += L; else if (d > L / 2) d -= L; }
    dist += d; along = world.along;
    scoring.step(world, STEP);
    progress.step(world);
    race.step(world, progress.state);
    t += STEP;
    if (t > 3 && world.car.speed < minV) minV = world.car.speed;
    const s = scoring.state, sliding = s.drifting && s.gap === 0;
    for (const c of corners) if (dist >= c.from && dist <= c.to) { c.t += STEP; if (sliding) { c.slide += STEP; c.angleSum += s.angle * STEP; } }
    if (progress.state.finished) { scoring.bank(); race.finish(t); finished = true; break; }
  }
  const s = scoring.state, share = c => c.t ? c.slide / c.t : 0;
  const all = corners.filter(c => c.t > 0), tight = all.filter(c => c.radius <= PLAYERS.MIX_RADIUS);
  const slid = all.filter(c => c.slide > 0);
  return {
    kind, finished, seconds: +t.toFixed(2), total: s.total, drift: s.drift, clean: s.clean, pace: s.pace, best: s.best,
    respawns, hard: world.hardHits, walls: world.hits, minKmh: +(minV * 3.6).toFixed(1), handsBroken,
    worstCorner: all.length ? +Math.min(...all.map(share)).toFixed(3) : 0,
    worstTight: tight.length ? +Math.min(...tight.map(share)).toFixed(3) : null,
    meanCorner: all.length ? +(all.reduce((a, c) => a + share(c), 0) / all.length).toFixed(3) : 0,
    angle: slid.length ? +(slid.reduce((a, c) => a + c.angleSum, 0) / slid.reduce((a, c) => a + c.slide, 0)).toFixed(1) : 0,
    hash: world.hash(),
  };
}
