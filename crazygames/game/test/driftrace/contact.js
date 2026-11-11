/* RIVALS MEASURE 4: CONTACT. In Node, through the host's battle step
   (battle.js), against the first rival on career 1. Three scripted
   players:
   - TAIL: ram his tail. Pure pursuit on his car at up to his speed and
     5 m/s more, from the grid.
   - SWIPE: swipe his side. The chase driver until both are sliding with
     a chain open, then steered into his side.
   - PARK: park on his line. Drive to PARK_AT metres along, stop there
     on the line he takes on his second lap, wait for him, then drive on.
   Every step, measured here, not by the world's own numbers: the depth
   the two boxes overlap (separating axes on the road's plane), whether
   a hard contact lost an open chain, how far the player is outside the
   road, how long he is held under 1 m/s while asking to drive, and
   whether any number is NaN. And the rival's hash at his finish is
   compared with his run with no player at all.
   The bar: overlap never over OVERLAP m (a step at 20 m/s closing is
   0.17 m), every hard contact with a chain open loses it, no respawn
   in the 2 s after a contact (the game's own "off the track"; how far
   into the run-off he goes is reported, against the same script with
   no contact), never held more than 1 s, no NaN. Known answer: with him not solid, the overlap check fails.

   node game/test/rivals/contact.js   writes review/rivals/contact.json */
import path from 'node:path';
import fs from 'node:fs';
import { runBattle } from './battle.js';
import { createRival } from '../../src/rivals/rival.js';
import { createChaseDriver } from '../../src/rivals/chase.js';
import { rivalById } from '../../src/rivals/roster.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec, battleLaps } from '../../src/loop/modes.js';
import { TUNE } from '../../src/tune.js';
import { STEP } from '../../src/physics/world.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const outDir = path.resolve(here, '..', '..', '..', 'review', 'rivals');
export const OVERLAP = 0.3, HELD = 1.0, PARK_AT = 120;
const def = rivalById('r1'), track = trackFor(careerSpec(def.track)), laps = battleLaps(track, def);
let failed = 0;
const verdict = (ok, text) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + text); return ok; };

/* the depth two boxes overlap on the road's plane, by separating axes: 0 when apart */
function overlap(a, b) {
  const box = (x, z, yaw, hl, hw) => { const fx = -Math.sin(yaw), fz = -Math.cos(yaw), lx = -Math.cos(yaw), lz = Math.sin(yaw); return { pts: [[x + fx * hl + lx * hw, z + fz * hl + lz * hw], [x + fx * hl - lx * hw, z + fz * hl - lz * hw], [x - fx * hl - lx * hw, z - fz * hl - lz * hw], [x - fx * hl + lx * hw, z - fz * hl + lz * hw]], ax: [[fx, fz], [lx, lz]] }; };
  const A = box(a.x, a.z, a.yaw, a.hl, a.hw), B = box(b.x, b.z, b.yaw, b.hl, b.hw);
  let depth = Infinity;
  for (const [ax, az] of [...A.ax, ...B.ax]) {
    const pa = A.pts.map(p => p[0] * ax + p[1] * az), pb = B.pts.map(p => p[0] * ax + p[1] * az);
    const d = Math.min(Math.max(...pa) - Math.min(...pb), Math.max(...pb) - Math.min(...pa));
    if (d <= 0) return 0;
    depth = Math.min(depth, d);
  }
  return depth;
}
const V = TUNE.VEHICLE;

/* his run alone: no player anywhere */
const alone = createRival(track, def, laps); alone.finishRun();
const aloneHash = alone.hash();

/* where his second lap passes PARK_AT, from that run */
const solo = createRival(track, def, laps); let parkLat = 0;
for (let i = 0; i < 120 * 200 && !solo.state.finished; i++) { solo.step(); if (solo.runDistance() >= track.length + PARK_AT) { parkLat = solo.world.lateral; break; } }

function pursuit(world, tx, tz, gain) {
  const c = world.car, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), lx = -Math.cos(c.yaw), lz = Math.sin(c.yaw);
  const dx = tx - c.x, dz = tz - c.z;
  return Math.max(-1, Math.min(1, -Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz) * (gain || 2.4)));
}
const players = {
  TAIL: () => (world, rival) => {
    const r = rival.world.car, v = world.car.speed, want = r.speed + 5;
    return { steer: pursuit(world, r.x, r.z), throttle: v < want ? 1 : 0, brake: v > want + 2 ? 0.5 : 0, handbrake: 0 };
  },
  SWIPE: () => { let chase = null, swiping = 0; return (world, rival) => {
    if (!chase) chase = createChaseDriver(track, rival, { GAP: 3.5 });
    const inp = chase.input(world);
    if (!swiping && rival.state.sliding && Math.abs(world.car.slip) * 57.3 > 15 && rival.runDistance() > 60) swiping = 1;
    if (swiping && swiping < 120 * 1.5) { swiping++; const r = rival.world.car; inp.steer = pursuit(world, r.x, r.z, 4); inp.throttle = 1; inp.handbrake = 0; }
    return inp;
  }; },
  PARK: () => { let parked = false, waited = 0; return (world, rival) => {
    const c = world.car, C = track.centre, i = Math.round(PARK_AT / 2);
    if (!parked) {
      const t = C[i], lx = -Math.cos(t.heading), lz = Math.sin(t.heading), tx = t.x + lx * parkLat, tz = t.z + lz * parkLat;
      const near = Math.hypot(tx - c.x, tz - c.z);
      if (world.along > PARK_AT - 1 && world.along < PARK_AT + 30 && c.speed < 0.3) parked = true;
      const v = near > 30 ? 12 : Math.max(0, near * 0.4);
      return { steer: pursuit(world, tx, tz), throttle: c.speed < v ? 1 : 0, brake: c.speed > v + 0.5 ? 1 : 0, handbrake: 0 };
    }
    /* wait until he has come by on his second lap, then drive on */
    if (rival.runDistance() < track.length + PARK_AT + 25) { waited++; return { steer: 0, throttle: 0, brake: 0, handbrake: 1 }; }
    const t = C[(world.centreIndex + 6) % C.length];
    return { steer: pursuit(world, t.x, t.z), throttle: c.speed < 15 ? 1 : 0, brake: 0, handbrake: 0 };
  }; },
};

function run(name, solid) {
  const st = { maxOverlap: 0, hardContacts: 0, hardWithChain: 0, hardKeptChain: 0, contacts: 0, maxOff: 0, respawns: 0, held: 0, maxHeld: 0, nan: false, chainBefore: 0, rivalHits: 0, minGap: Infinity };
  let wasHeld = 0, lastThrottle = 0, sinceHit = Infinity;
  const who = players[name]();
  const res = runBattle(def, (w, r) => { const i = who(w, r); lastThrottle = i.throttle; return i; }, { solid, maxSeconds: 120, onStep: ({ world, rival, scoring }) => {
    const c = world.car, r = rival.world.car;
    const ov = rival.solid() ? overlap({ x: c.x, z: c.z, yaw: c.yaw, hl: V.HALF_LENGTH, hw: V.HALF_WIDTH }, { x: r.x, z: r.z, yaw: r.yaw, hl: rival.box.halfLength, hw: rival.box.halfWidth }) : 0;
    if (ov > st.maxOverlap) st.maxOverlap = ov;
    st.minGap = Math.min(st.minGap, Math.hypot(c.x - r.x, c.z - r.z));
    sinceHit += STEP;
    if (world.hit && world.hit.kind === 'rival') { sinceHit = 0; st.contacts++; if (world.hit.hard) { st.hardContacts++; if (st.chainBefore > 0) { st.hardWithChain++; if (scoring.chain > 0) st.hardKeptChain++; } } }
    st.chainBefore = scoring.chain;
    /* thrown off: in the 2 s after a contact, past the edge or put back on the road */
    if (sinceHit <= 2) { if (world.respawned) st.respawns++; st.maxOff = Math.max(st.maxOff, Math.abs(world.lateral) - world.halfWidth); }
    if (world.respawned) st.allRespawns = (st.allRespawns || 0) + 1;
    st.runOff = Math.max(st.runOff || -Infinity, Math.abs(world.lateral) - world.halfWidth);
    if (lastThrottle > 0 && c.speed < 1) { wasHeld += STEP; st.maxHeld = Math.max(st.maxHeld, wasHeld); } else wasHeld = 0;
    if (!isFinite(c.x + c.z + c.wvx + c.wvz + c.r + c.yaw + scoring.chain + scoring.total)) st.nan = true;
  } });
  st.maxOverlap = +st.maxOverlap.toFixed(3); st.maxOff = +st.maxOff.toFixed(2); st.maxHeld = +st.maxHeld.toFixed(2); st.minGap = +st.minGap.toFixed(2);
  return { ...st, rivalHash: res.rivalHash, finished: res.finished, score: res.score, rival: res.rival, wallHits: res.wallHits, nanInHash: /NaN/.test(res.hash + res.rivalHash) };
}

const out = { overlapTolerance: OVERLAP, held: HELD, parkAt: PARK_AT, parkLateral: +parkLat.toFixed(2), aloneHash, scenarios: {} };
for (const name of Object.keys(players)) {
  const m = run(name, true);
  out.scenarios[name] = m;
  verdict(m.maxOverlap <= OVERLAP, name + ': the boxes overlap at most ' + m.maxOverlap + ' m (bar ' + OVERLAP + '); ' + m.contacts + ' contacts, ' + m.hardContacts + ' hard, closest centres ' + m.minGap + ' m');
  verdict(m.hardKeptChain === 0 && (name !== 'SWIPE' || m.hardWithChain > 0), name + ': ' + m.hardWithChain + ' hard contacts with a chain open, ' + m.hardKeptChain + ' kept it' + (name === 'SWIPE' && !m.hardWithChain ? ' (the swipe never hit hard with a chain open: the case is not tested)' : ''));
  verdict(m.respawns === 0, name + ': not thrown off the track (the game puts a car back on the road 6 m past the edge): ' + m.respawns + ' respawns in the 2 s after a contact; at most ' + Math.max(0, m.maxOff).toFixed(2) + ' m past the edge line into the run-off then (respawns in the whole run: ' + (m.allRespawns || 0) + ')');
  verdict(m.maxHeld <= HELD, name + ': held under 1 m/s while asking to drive for at most ' + m.maxHeld + ' s');
  verdict(!m.nan && !m.nanInHash, name + ': no number NaN');
  verdict(m.rivalHash === aloneHash, name + ': his hash with the player there is his hash with no player: ' + (m.rivalHash === aloneHash ? 'same' : 'DIFFERENT'));
}
const ghost = run('TAIL', false);
console.log('for comparison: the tail ram with him not solid runs ' + ghost.runOff.toFixed(2) + ' m past the edge line on its own; with him solid, ' + out.scenarios.TAIL.runOff.toFixed(2));
out.runOffWithoutContact = ghost.runOff;
out.knownAnswer = ghost;
verdict(ghost.maxOverlap > OVERLAP, 'known answer: with him not solid the tail ram overlaps ' + ghost.maxOverlap + ' m: ' + (ghost.maxOverlap > OVERLAP ? 'CAUGHT' : 'MISSED'));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'contact.json'), JSON.stringify(out, null, 1));
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
