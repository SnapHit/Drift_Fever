/* DRIFT RACE MEASURE 4 (briefs/DRIFT-RACE.md): CONTACT AND PASSING. In
   Node, through the host's race step (race.js), against the rival on his
   track, from the level grid. Four scripted players, each with only the
   player's hands (the throttle always on, no brake; DRIFT with no
   steering is the only way to slow or stop):
   - TAIL: runs into his tail. Pure pursuit on his car, flat out.
   - SWIPE: swipes his side. The mixed player until both are sliding
     with a chain open and within SWIPE_NEAR m, then steered into his
     side for 1.5 s.
   - PARK: parks on his line. Drives to PARK_AT metres along the second
     lap's line he takes, stops there with DRIFT and no steering, holds
     it until he has come by, then drives on.
   - FOLLOW: follows directly behind him for a lap at a higher speed.
     The grip player (quicker on the line than his sliding car) catches
     him; from the first time it is within FOLLOW_NEAR m behind him it is
     aimed for a lap at a point FOLLOW_GAP m behind his car, flat out;
     then it drives its own line again, and when he is within PASS_NEAR m
     ahead it goes for the side of the road with more room.
   Every step, measured here: the depth the two boxes overlap (separating
   axes), whether a hard contact lost an open chain, a respawn in the 2 s
   after a contact (the game's own "off the track"), how long the player
   is held under 1 m/s while asking to drive (anything but DRIFT with no
   steering), whether any number is NaN; and his hash compared with his
   run with no player at all.
   The bar: overlap never over OVERLAP m, every hard contact with a chain
   open loses it, no respawn in the 2 s after a contact, never held more
   than HELD s, no NaN, his hash unchanged, and in FOLLOW the player gets
   past him (ahead of him by PAST m) within the lap after the following
   lap. Known answers: with the pin release off (TANDEM.PIN_SLACK
   Infinity) the following case fails; with him not solid the overlap
   check fails.

   node game/test/driftrace/contact.js [r1]   writes review/driftrace/contact.json */
import path from 'node:path';
import fs from 'node:fs';
import { runRace, handsOk } from './race.js';
import { createRival } from '../../src/rivals/rival.js';
import { createPlayer } from '../../src/rivals/players.js';
import { rivalById } from '../../src/rivals/roster.js';
import { trackFor } from '../../src/ground/source.js';
import { careerSpec, battleLaps } from '../../src/loop/modes.js';
import { TUNE, TANDEM } from '../../src/tune.js';
import { STEP } from '../../src/physics/world.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const outDir = path.resolve(here, '..', '..', '..', 'review', 'driftrace');
export const OVERLAP = 0.3, HELD = 1.0, PARK_AT = 120, SWIPE_NEAR = 8, FOLLOW_GAP = 3, FOLLOW_NEAR = 12, PASS_NEAR = 10, PAST = 6;
const def = rivalById(process.argv.slice(2).find(a => /^r\d/.test(a)) || 'r1'), track = trackFor(careerSpec(def.track)), laps = battleLaps(track, def), L = track.length;
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
const alone = createRival(track, def, laps); alone.finishRun();
const aloneHash = alone.hash();
/* where his second lap passes PARK_AT, from that run */
const solo = createRival(track, def, laps); let parkLat = 0;
for (let i = 0; i < 120 * 200 && !solo.state.finished; i++) { solo.step(); if (solo.runDistance() >= track.start.along + L + PARK_AT) { parkLat = solo.world.lateral; break; } }

function pursuit(world, tx, tz, gain) {
  const c = world.car, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), lx = -Math.cos(c.yaw), lz = Math.sin(c.yaw);
  const dx = tx - c.x, dz = tz - c.z;
  return Math.max(-1, Math.min(1, -Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz) * (gain || 2.4)));
}
const drive = steer => ({ steer, throttle: 1, brake: 0, handbrake: 0 });
const HOLD = { steer: 0, throttle: 1, brake: 0, handbrake: 1 };   // DRIFT with no steering: the player's brake
/* a point on the road ahead of the player, `ahead` m on, `lat` m left of the centre */
function roadPoint(world, ahead, lat) { const C = track.centre, t = C[(world.centreIndex + Math.round(ahead / 2)) % C.length]; return [t.x - Math.cos(t.heading) * lat, t.z + Math.sin(t.heading) * lat]; }
const players = {
  TAIL: () => (world, rival) => { const r = rival.world.car; return rival.solid() ? drive(pursuit(world, r.x, r.z)) : drive(pursuit(world, ...roadPoint(world, 12, 0))); },
  SWIPE: () => { let p = null, swiping = 0; return (world, rival) => {
    if (!p) p = createPlayer(track, 'mixed');
    const inp = { ...p.input(world) };
    const r = rival.world.car, near = Math.hypot(r.x - world.car.x, r.z - world.car.z);
    if (!swiping && rival.solid() && rival.state.sliding && Math.abs(world.car.slip) * 57.3 > 15 && near < SWIPE_NEAR) swiping = 1;
    if (swiping && swiping < 120 * 1.5) { swiping++; inp.steer = pursuit(world, r.x, r.z, 4); inp.handbrake = 0; }
    return inp;
  }; },
  PARK: () => { let parked = false; return (world, rival, ctx) => {
    const c = world.car, C = track.centre, i = Math.round(PARK_AT / 2);
    if (!parked) {
      const t = C[i], tx = t.x - Math.cos(t.heading) * parkLat, tz = t.z + Math.sin(t.heading) * parkLat;
      const near = Math.hypot(tx - c.x, tz - c.z);
      if (ctx.dist > track.start.along + PARK_AT - 30 && c.speed < 0.5) parked = true;
      /* aim at the spot; within reach of it, DRIFT with the wheel straight to stop on it */
      if (ctx.dist > track.start.along + 20 && near < Math.max(6, c.speed * c.speed / 14)) return HOLD;
      return drive(pursuit(world, tx, tz));
    }
    /* wait until he has come by on his second lap, then drive on */
    if (rival.runDistance() < track.start.along + L + PARK_AT + 25) return HOLD;
    return drive(pursuit(world, ...roadPoint(world, 12, 0)));
  }; },
  FOLLOW: () => { let p = null, from = null, phase = 'catch'; return (world, rival, ctx) => {
    if (!p) p = createPlayer(track, 'grip');
    const own = { ...p.input(world) };
    const r = rival.world.car, rd = rival.runDistance(), d = ctx.dist || 0, gap = rd - d;
    if (!rival.solid()) return own;
    /* catch him on the grip player's line (quicker than his sliding one), then a lap directly behind: aimed at a point FOLLOW_GAP m behind his car, flat out */
    if (phase === 'catch' && gap > 0 && gap < FOLLOW_NEAR) { phase = 'follow'; from = d; }
    if (phase === 'follow' && d - from >= L) phase = 'pass';
    ctx.phase = phase; ctx.followFrom = from;
    if (phase === 'follow') {
      const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);
      return drive(pursuit(world, r.x - fx * FOLLOW_GAP, r.z - fz * FOLLOW_GAP));
    }
    /* then its own line again; when he is just ahead, to the side of the road with more room */
    if (phase === 'pass' && gap > 0 && gap < PASS_NEAR) {
      const lat = rival.world.lateral, half = rival.world.halfWidth, side = lat > 0 ? -1 : 1, aim = side * Math.max(0, Math.min(half - 1.6, half * 0.6));
      return { ...own, steer: pursuit(world, ...roadPoint(world, 10, aim)), handbrake: 0 };
    }
    return own;
  }; },
};

function run(name, opts) {
  const st = { maxOverlap: 0, hardContacts: 0, hardWithChain: 0, hardKeptChain: 0, contacts: 0, maxOff: 0, respawns: 0, maxHeld: 0, nan: false, chainBefore: 0, minGap: Infinity, passThroughSteps: 0, followFrom: null, past: null, behindT: 0 };
  let held = 0, lastInp = null, sinceHit = Infinity;
  const who = players[name]();
  let ctxRef = {};
  const res = runRace(def, (w, r, ctx) => { ctxRef = ctx; const i = who(w, r, ctx); lastInp = i; return i; }, { ...opts, maxSeconds: 150, onStep: ({ world, rival, scoring, dist, t }) => {
    const c = world.car, r = rival.world.car;
    const ov = rival.solid() ? overlap({ x: c.x, z: c.z, yaw: c.yaw, hl: V.HALF_LENGTH, hw: V.HALF_WIDTH }, { x: r.x, z: r.z, yaw: r.yaw, hl: rival.box.halfLength, hw: rival.box.halfWidth }) : 0;
    if (ov > st.maxOverlap && !world.passThrough) st.maxOverlap = ov;
    if (world.passThrough) st.passThroughSteps++;
    if (rival.solid()) st.minGap = Math.min(st.minGap, Math.hypot(c.x - r.x, c.z - r.z));
    sinceHit += STEP;
    if (world.hit && world.hit.kind === 'rival') { sinceHit = 0; st.contacts++; if (world.hit.hard) { st.hardContacts++; if (st.chainBefore > 0) { st.hardWithChain++; if (scoring.chain > 0) st.hardKeptChain++; } } }
    st.chainBefore = scoring.chain;
    if (sinceHit <= 2) { if (world.respawned) st.respawns++; st.maxOff = Math.max(st.maxOff, Math.abs(world.lateral) - world.halfWidth); }
    const asking = lastInp && !(lastInp.handbrake && lastInp.steer === 0);
    if (asking && c.speed < 1) { held += STEP; st.maxHeld = Math.max(st.maxHeld, held); } else held = 0;
    if (!isFinite(c.x + c.z + c.wvx + c.wvz + c.r + c.yaw + scoring.chain + scoring.total)) st.nan = true;
    /* the following case: when it is first behind him, and when it is first PAST m ahead of him after a lap behind */
    const rd = rival.runDistance();
    if (process.env.TRACE === name && Math.round(t * 120) % 60 === 0) console.log('  ' + t.toFixed(1) + ' s d ' + dist.toFixed(0) + ' his ' + rd.toFixed(0) + ' lat ' + world.lateral.toFixed(1) + '/' + rival.world.lateral.toFixed(1) + ' v ' + c.speed.toFixed(1) + '/' + r.speed.toFixed(1) + ' gap ' + Math.hypot(c.x - r.x, c.z - r.z).toFixed(1) + ' ' + (ctxRef.phase || ''));
    if (name === 'FOLLOW' ? (st.followFrom === null && ctxRef.followFrom !== null && ctxRef.followFrom !== undefined) : (st.followFrom === null && rd > dist + 1)) st.followFrom = name === 'FOLLOW' ? ctxRef.followFrom : dist;
    if (st.followFrom !== null && rd > dist) st.behindT += STEP;
    if (st.followFrom !== null && st.past === null && dist - st.followFrom >= L && dist > rd + PAST) st.past = +(dist - st.followFrom - L).toFixed(1);
  } });
  for (const k of ['maxOverlap', 'maxOff', 'maxHeld', 'minGap']) st[k] = +st[k].toFixed(3);
  return { ...st, rivalHash: res.rivalHash, finished: res.finished, total: res.total, rival: res.rival, wallHits: res.wallHits, handsBroken: res.handsBroken, nanInHash: /NaN/.test(res.hash + res.rivalHash) };
}

const out = { rival: def.id, overlapTolerance: OVERLAP, held: HELD, parkAt: PARK_AT, parkLateral: +parkLat.toFixed(2), aloneHash, scenarios: {} };
for (const name of Object.keys(players)) {
  const m = run(name, {});
  out.scenarios[name] = m;
  verdict(m.handsBroken === 0, name + ': only the player\'s hands');
  verdict(m.maxOverlap <= OVERLAP, name + ': the boxes overlap at most ' + m.maxOverlap + ' m outside a pin release (bar ' + OVERLAP + '); ' + m.contacts + ' contacts, ' + m.hardContacts + ' hard, closest centres ' + m.minGap + ' m, ' + m.passThroughSteps + ' steps let through by the pin release');
  verdict(m.hardKeptChain === 0 && (name !== 'SWIPE' || m.hardWithChain > 0), name + ': ' + m.hardWithChain + ' hard contacts with a chain open, ' + m.hardKeptChain + ' kept it' + (name === 'SWIPE' && !m.hardWithChain ? ' (the swipe never hit hard with a chain open: the case is not tested)' : ''));
  verdict(m.respawns === 0, name + ': not thrown off the track: ' + m.respawns + ' respawns in the 2 s after a contact; at most ' + Math.max(0, m.maxOff).toFixed(2) + ' m past the edge line then');
  verdict(m.maxHeld <= HELD, name + ': held under 1 m/s while asking to drive for at most ' + m.maxHeld + ' s');
  verdict(!m.nan && !m.nanInHash, name + ': no number NaN');
  verdict(m.rivalHash === aloneHash, name + ': his hash with the player there is his hash with no player: ' + (m.rivalHash === aloneHash ? 'same' : 'DIFFERENT'));
}
const F = out.scenarios.FOLLOW;
verdict(F.past !== null, 'FOLLOW: behind him from ' + (F.followFrom === null ? 'never' : Math.round(F.followFrom) + ' m') + ', ' + F.behindT.toFixed(1) + ' s behind in all; after a lap behind it gets past him: ' + (F.past !== null ? 'yes, ' + F.past + ' m into the next lap' : 'NO'));
/* known answers */
const pin = TANDEM.PIN_SLACK; TANDEM.PIN_SLACK = Infinity;
const np = run('FOLLOW', {});
TANDEM.PIN_SLACK = pin;
out.knownAnswerPin = np;
verdict(np.past === null || np.maxHeld > HELD, 'known answer: with the pin release off the following case fails (does not get past, or is held): ' + (np.past === null || np.maxHeld > HELD ? 'CAUGHT' : 'MISSED (it got past ' + np.past + ' m into the next lap, held at most ' + np.maxHeld + ' s, ' + np.passThroughSteps + ' pin steps)'));
const ghost = run('TAIL', { solid: false });
out.knownAnswerSolid = ghost;
verdict(ghost.maxOverlap > OVERLAP, 'known answer: with him not solid the tail run overlaps ' + ghost.maxOverlap + ' m: ' + (ghost.maxOverlap > OVERLAP ? 'CAUGHT' : 'MISSED'));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'contact.json'), JSON.stringify(out, null, 1));
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
